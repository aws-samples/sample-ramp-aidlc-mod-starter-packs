import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  assertPortableRelativePath,
  comparePortablePaths,
  hashFileRecords,
} from './checksum.js'
import {
  NO_GLOBAL_GIT_CONFIG,
  materializeGitTree,
  readGitFile,
  readGitTree,
  resolveGitCommit,
} from './git-snapshot.js'
import {
  loadSkillLock,
  loadSkillSources,
  writeSkillLock,
} from './manifests.js'
import {
  resolveCacheDir,
  verifyLockedSkillDirectory,
} from './resolver.js'

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GIT_ENV = {
  GCM_INTERACTIVE: 'Never',
  GIT_CONFIG_GLOBAL: NO_GLOBAL_GIT_CONFIG,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0',
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC',
}
const GIT_OUTPUT_LIMIT = 32 * 1024 * 1024
const VERIFY_OPTIONS = new Set(['repoRoot', 'cacheDir', 'env', 'platform'])
const SYNC_OPTIONS = new Set([
  ...VERIFY_OPTIONS,
  'sourceRoots',
  'allowNetwork',
])
const UPDATE_OPTIONS = new Set([
  'repoRoot',
  'names',
  'selections',
  'cacheDir',
  'env',
  'sourceRoots',
  'sourceRefs',
  'defaultRef',
  'allowNetwork',
  'platform',
])

function validatePublicOptions(value, allowed, label) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be an object`)
  }
  const unknown = Object.keys(value)
    .filter((name) => !allowed.has(name))
    .sort(comparePortablePaths)
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown option${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`)
  }
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${label} must not contain NUL, CR, or LF`)
  }
  return value
}

function requireIdentifier(value, label) {
  requireString(value, label)
  if (!IDENTIFIER.test(value)) {
    throw new Error(`${label} must be a lower-kebab identifier`)
  }
  return value
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`)
  return value
}

function optionalStatus(path, label) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw new Error(`${label} could not be inspected: ${error.message}`)
  }
}

function isWithin(anchor, candidate) {
  const path = relative(anchor, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

function ensureDirectory(path, {
  anchor = path,
  create = false,
  label = 'directory',
} = {}) {
  const target = resolve(path)
  const trusted = resolve(anchor)
  if (!isWithin(trusted, target)) {
    throw new Error(`${label} escapes its trusted root: ${target}`)
  }

  let current = trusted
  let status = optionalStatus(current, `${label} trusted root`)
  if (status === null) {
    if (!create || trusted !== target) {
      throw new Error(`${label} trusted root does not exist: ${trusted}`)
    }
    const missing = []
    while (status === null) {
      missing.unshift(current)
      const parent = dirname(current)
      if (parent === current) break
      current = parent
      status = optionalStatus(current, `${label} ancestor`)
    }
    if (status === null || status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(`${label} has an unsafe existing ancestor: ${current}`)
    }
    for (const directory of missing) {
      mkdirSync(directory, { mode: 0o700 })
      chmodSync(directory, 0o755)
    }
    current = trusted
  } else if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`${label} trusted root must be a non-symlink directory: ${trusted}`)
  }

  const suffix = relative(trusted, target)
  for (const segment of suffix === '' ? [] : suffix.split(sep)) {
    current = join(current, segment)
    status = optionalStatus(current, label)
    if (status === null) {
      if (!create) throw new Error(`${label} does not exist: ${current}`)
      mkdirSync(current, { mode: 0o700 })
      chmodSync(current, 0o755)
      continue
    }
    if (status.isSymbolicLink()) {
      throw new Error(`${label} must not contain a symbolic link: ${current}`)
    }
    if (!status.isDirectory()) {
      throw new Error(`${label} must be a directory: ${current}`)
    }
  }
  return target
}

function validateMap(value, label, sources) {
  if (!(value instanceof Map)) throw new Error(`${label} must be a Map`)
  const normalized = new Map()
  for (const [key, raw] of value) {
    const id = requireIdentifier(key, `${label} key`)
    if (!sources.byId.has(id)) throw new Error(`${label} source is not declared: ${id}`)
    if (normalized.has(id)) throw new Error(`${label} has duplicate source: ${id}`)
    normalized.set(id, resolve(process.cwd(), requireString(raw, `${label} ${id}`)))
  }
  return normalized
}

function resolveOperationCache({ repoRoot, cacheDir, env }) {
  return resolveCacheDir({
    repoRoot,
    ...(cacheDir !== undefined ? { cacheDir } : {}),
    ...(env !== undefined ? { env } : {}),
  })
}

function cloneRecord(record) {
  return {
    path: record.path,
    sha256: record.sha256,
    size: record.size,
    executable: record.executable,
  }
}

function sameRecord(actual, expected, { compareMode = true } = {}) {
  return actual.path === expected.path &&
    actual.sha256 === expected.sha256 &&
    actual.size === expected.size &&
    (!compareMode || actual.executable === expected.executable)
}

function groupsFromLock(lock) {
  const groups = new Map()
  const claimedTrees = new Map()
  for (const skill of lock.skills.values()) {
    const key = `${skill.source}\0${skill.commit}`
    const treeKey = `${key}\0${skill.path}`
    const priorClaim = claimedTrees.get(treeKey)
    if (priorClaim) {
      throw new Error(
        `duplicate source/commit/path claim for ${skill.source} ${skill.commit} ${skill.path}: ${priorClaim}, ${skill.name}`,
      )
    }
    claimedTrees.set(treeKey, skill.name)
    let group = groups.get(key)
    if (!group) {
      group = {
        source: skill.source,
        repository: skill.repository,
        commit: skill.commit,
        licenseFile: cloneRecord(skill.licenseFile),
        noticeFile: cloneRecord(skill.noticeFile),
        skills: [],
      }
      groups.set(key, group)
    } else if (
      !sameRecord(group.licenseFile, skill.licenseFile) ||
      !sameRecord(group.noticeFile, skill.noticeFile)
    ) {
      throw new Error(
        `source ${skill.source} commit ${skill.commit} has conflicting LICENSE/NOTICE records`,
      )
    }
    group.skills.push(skill)
  }
  for (const group of groups.values()) {
    group.skills.sort((left, right) =>
      comparePortablePaths(left.path, right.path) ||
      comparePortablePaths(left.name, right.name))
  }
  return [...groups.values()].sort((left, right) =>
    comparePortablePaths(left.source, right.source) ||
    comparePortablePaths(left.commit, right.commit))
}

function snapshotPath(cacheDir, group) {
  return join(cacheDir, 'sources', group.source, group.commit)
}

function sourceCoordinates(group) {
  const files = new Map()
  const directories = new Set([''])
  function add(record) {
    const path = assertPortableRelativePath(record.path, 'locked source coordinate')
    const prior = files.get(path)
    if (prior && !sameRecord(prior, record)) {
      throw new Error(
        `conflicting locked source coordinate ${group.source} ${group.commit} ${path}`,
      )
    }
    if (!prior) files.set(path, cloneRecord(record))
    const segments = path.split('/')
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join('/'))
    }
  }
  add(group.licenseFile)
  add(group.noticeFile)
  for (const skill of group.skills) {
    for (const file of skill.files) {
      add({
        ...file,
        path: assertPortableRelativePath(
          `${skill.path}/${file.path}`,
          `locked skill ${skill.name} source coordinate`,
        ),
      })
    }
  }
  return { files, directories }
}

function inspectSnapshotClosure(root, group) {
  const status = optionalStatus(root, `source snapshot ${group.source} ${group.commit}`)
  if (status === null) return false
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(
      `source snapshot ${group.source} ${group.commit} must be a non-symlink directory: ${root}`,
    )
  }
  const expected = sourceCoordinates(group)
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const relativePath = relative(root, absolute).split(sep).join('/')
      const current = lstatSync(absolute)
      if (current.isSymbolicLink()) {
        throw new Error(
          `source snapshot ${group.source} ${group.commit} contains a symbolic link: ${relativePath}`,
        )
      }
      if (current.isDirectory()) {
        if (!expected.directories.has(relativePath)) {
          throw new Error(
            `source snapshot ${group.source} ${group.commit} contains unexpected directory outside lock closure: ${relativePath}`,
          )
        }
        visit(absolute)
        continue
      }
      if (!current.isFile()) {
        throw new Error(
          `source snapshot ${group.source} ${group.commit} contains unsupported entry: ${relativePath}`,
        )
      }
      if (!expected.files.has(relativePath)) {
        throw new Error(
          `source snapshot ${group.source} ${group.commit} contains unexpected file outside lock closure: ${relativePath}`,
        )
      }
    }
  }
  visit(root)
  return true
}

function verifySourceFile(root, group, record, platform) {
  const path = join(root, ...record.path.split('/'))
  const status = optionalStatus(
    path,
    `locked source file ${group.source} ${group.commit} ${record.path}`,
  )
  if (status === null) return false
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(
      `locked source file ${group.source} ${group.commit} ${record.path} must be a regular non-symlink file: ${path}`,
    )
  }
  const bytes = readFileSync(path)
  const actual = {
    path: record.path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    executable: Boolean(status.mode & 0o111),
  }
  if (!sameRecord(actual, record, { compareMode: platform !== 'win32' })) {
    throw new Error(
      `locked source file ${group.source} ${group.commit} ${record.path} checksum, size, or executable mode mismatch at ${path}`,
    )
  }
  return true
}

function verifySkill(root, skill, platform) {
  const directory = join(root, ...skill.path.split('/'))
  const status = optionalStatus(
    directory,
    `locked skill ${skill.name} ${skill.commit}`,
  )
  if (status === null) return false
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(
      `locked skill ${skill.name} ${skill.commit} must be a non-symlink directory: ${directory}`,
    )
  }
  verifyLockedSkillDirectory(directory, skill, { platform })
  return true
}

function inspectGroup(cacheDir, group, platform, { requireComplete = false } = {}) {
  const root = snapshotPath(cacheDir, group)
  const present = inspectSnapshotClosure(root, group)
  if (!present) {
    if (requireComplete) {
      throw new Error(
        `locked source snapshot ${group.source} ${group.commit} is missing from cache: ${root}`,
      )
    }
    return {
      root,
      present: false,
      license: false,
      notice: false,
      skills: new Map(group.skills.map((skill) => [skill.name, false])),
    }
  }
  const license = verifySourceFile(root, group, group.licenseFile, platform)
  const notice = verifySourceFile(root, group, group.noticeFile, platform)
  const skills = new Map(
    group.skills.map((skill) => [skill.name, verifySkill(root, skill, platform)]),
  )
  if (requireComplete) {
    if (!license) {
      throw new Error(
        `locked LICENSE file ${group.licenseFile.path} is missing for ${group.source} ${group.commit} at ${root}`,
      )
    }
    if (!notice) {
      throw new Error(
        `locked NOTICE file ${group.noticeFile.path} is missing for ${group.source} ${group.commit} at ${root}`,
      )
    }
    for (const skill of group.skills) {
      if (!skills.get(skill.name)) {
        throw new Error(
          `locked skill ${skill.name} ${skill.commit} is missing from cache: ${join(root, ...skill.path.split('/'))}`,
        )
      }
    }
  }
  return { root, present: true, license, notice, skills }
}

function verifyResult(cacheDir, groups) {
  return {
    cacheDir,
    sources: groups.map((group) => ({
      source: group.source,
      commit: group.commit,
      licenseFile: cloneRecord(group.licenseFile),
      noticeFile: cloneRecord(group.noticeFile),
    })),
    skills: groups
      .flatMap((group) => group.skills)
      .sort((left, right) =>
        comparePortablePaths(left.name, right.name) ||
        comparePortablePaths(left.source, right.source) ||
        comparePortablePaths(left.commit, right.commit) ||
        comparePortablePaths(left.path, right.path))
      .map((skill) => ({
        name: skill.name,
        source: skill.source,
        commit: skill.commit,
        path: skill.path,
        treeSha256: skill.treeSha256,
      })),
  }
}

function loadOperation({ repoRoot, cacheDir, env }) {
  const root = resolve(requireString(repoRoot, 'repoRoot'))
  const selectedCache = resolveOperationCache({ repoRoot: root, cacheDir, env })
  const lock = loadSkillLock(root, { required: true })
  const sources = loadSkillSources(root)
  return {
    repoRoot: root,
    cacheDir: selectedCache,
    lock,
    sources,
    groups: groupsFromLock(lock),
  }
}

function cacheAnchor(repoRoot, cacheDir) {
  return isWithin(repoRoot, cacheDir) ? repoRoot : cacheDir
}

function inspectExistingCache(repoRoot, cacheDir, { required = false } = {}) {
  const status = optionalStatus(cacheDir, 'skills cache')
  if (status === null) {
    if (required) throw new Error(`skills cache does not exist: ${cacheDir}`)
    return false
  }
  ensureDirectory(cacheDir, {
    anchor: cacheAnchor(repoRoot, cacheDir),
    label: 'skills cache',
  })
  return true
}

export function verifyLockedSkills(options = {}) {
  const {
    repoRoot,
    cacheDir,
    env,
    platform = process.platform,
  } = validatePublicOptions(options, VERIFY_OPTIONS, 'verifyLockedSkills options')
  requireString(platform, 'platform')
  const operation = loadOperation({ repoRoot, cacheDir, env })
  inspectExistingCache(operation.repoRoot, operation.cacheDir, { required: true })
  for (const group of operation.groups) {
    inspectGroup(operation.cacheDir, group, platform, { requireComplete: true })
  }
  return verifyResult(operation.cacheDir, operation.groups)
}

function sanitize(value) {
  return String(value)
    .replace(
      /([a-z][a-z0-9+.-]*:\/{1,2})[^/@\s?#]+@/gi,
      '$1<credentials>@',
    )
    .replace(
      /([/\\])[^/\\\s@:]+:[^/\\\s@]+@/g,
      '$1<credentials>@',
    )
    .replace(
      /([?&](?:access[_-]?token|auth|credential|key|password|secret|token)=)[^&#\s]*/gi,
      '$1<redacted>',
    )
}

function gitEnvironment() {
  const environment = {}
  for (const [name, value] of Object.entries(process.env)) {
    const upper = name.toUpperCase()
    if (
      upper.startsWith('GIT_') ||
      upper.startsWith('GCM_') ||
      upper === 'SSH_ASKPASS' ||
      upper === 'SSH_ASKPASS_REQUIRE'
    ) {
      continue
    }
    environment[name] = value
  }
  return {
    ...environment,
    ...GIT_ENV,
  }
}

function runGitBytes(repository, args, operation) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    shell: false,
    encoding: null,
    maxBuffer: GIT_OUTPUT_LIMIT,
    env: gitEnvironment(),
  })
  const context = `${sanitize(operation)} for ${sanitize(repository)}`
  if (result.error) {
    const detail = result.error.code === 'ENOBUFS'
      ? ` exceeded the ${GIT_OUTPUT_LIMIT}-byte output bound`
      : ` could not launch Git: ${sanitize(result.error.message)}`
    throw new Error(`${context}${detail}`)
  }
  if (result.signal) {
    throw new Error(`${context} was terminated by signal ${result.signal}`)
  }
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0))
      .toString('utf8')
      .trim()
    throw new Error(`${context} failed${stderr ? `: ${sanitize(stderr)}` : ''}`)
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0))
}

function runGit(repository, args, operation) {
  return runGitBytes(repository, args, operation).toString('utf8').trim()
}

function discoverGitDirectory(repository) {
  const path = resolve(requireString(repository, 'repository'))
  const gitDirectory = runGit(
    path,
    ['-C', path, 'rev-parse', '--absolute-git-dir'],
    'discover Git directory',
  )
  if (/[\0\r\n]/.test(gitDirectory) || gitDirectory === '') {
    throw new Error(`Git directory discovery for ${sanitize(path)} returned invalid output`)
  }
  return resolve(gitDirectory)
}

function acquisitionRepository({
  cacheDir,
  source,
  sourceRoots,
  allowNetwork,
  operationRoot,
  required,
}) {
  const explicit = sourceRoots.get(source.id)
  if (explicit) {
    return {
      repository: explicit,
      repositoryCache: null,
      staged: false,
    }
  }

  const repositoryCache = join(cacheDir, 'repositories', `${source.id}.git`)
  const status = optionalStatus(repositoryCache, `repository cache ${source.id}`)
  if (status !== null) {
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(`repository cache ${source.id} is invalid: ${repositoryCache}`)
    }
    const bare = runGit(
      repositoryCache,
      [`--git-dir=${repositoryCache}`, 'rev-parse', '--is-bare-repository'],
      `inspect repository cache ${source.id}`,
    )
    const origin = runGit(
      repositoryCache,
      [`--git-dir=${repositoryCache}`, 'config', '--get', 'remote.origin.url'],
      `inspect repository cache origin ${source.id}`,
    )
    if (bare !== 'true' || origin !== source.repository) {
      throw new Error(
        `repository cache ${source.id} must be bare with origin ${sanitize(source.repository)}: ${sanitize(repositoryCache)}`,
      )
    }
    return {
      repository: repositoryCache,
      repositoryCache,
      staged: false,
    }
  }

  if (!allowNetwork) {
    throw new Error(
      `source ${source.id} requires ${required}; offline repository cache is missing at ${repositoryCache}; supply --source-root ${source.id}=<repository> or allow network acquisition`,
    )
  }
  const staged = join(operationRoot, `${source.id}.git`)
  runGit(
    source.repository,
    ['init', '--bare', '--quiet', staged],
    `initialize source ${source.id} repository cache`,
  )
  runGit(
    source.repository,
    [`--git-dir=${staged}`, 'config', 'remote.origin.url', source.repository],
    `configure source ${source.id} repository cache origin`,
  )
  return {
    repository: staged,
    repositoryCache,
    staged: true,
  }
}

function installRepositoryCache(acquired, source, cacheDir) {
  if (!acquired.staged) return acquired.repository
  const staged = acquired.repository
  const { repositoryCache } = acquired
  ensureDirectory(dirname(repositoryCache), {
    anchor: cacheDir,
    create: true,
    label: 'repository cache parent',
  })
  try {
    renameSync(staged, repositoryCache)
  } catch (error) {
    if (!existsSync(repositoryCache)) throw error
    rmSync(staged, { recursive: true, force: true })
  }
  const status = lstatSync(repositoryCache)
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`repository cache ${source.id} is invalid: ${sanitize(repositoryCache)}`)
  }
  const bare = runGit(
    repositoryCache,
    [`--git-dir=${repositoryCache}`, 'rev-parse', '--is-bare-repository'],
    `inspect repository cache ${source.id}`,
  )
  const origin = runGit(
    repositoryCache,
    [`--git-dir=${repositoryCache}`, 'config', '--get', 'remote.origin.url'],
    `inspect repository cache origin ${source.id}`,
  )
  if (bare !== 'true' || origin !== source.repository) {
    throw new Error(
      `repository cache ${source.id} must be bare with origin ${sanitize(source.repository)}: ${sanitize(repositoryCache)}`,
    )
  }
  return repositoryCache
}

function exactSourceRepository(options) {
  const acquired = acquisitionRepository(options)
  let repository = acquired.repository
  try {
    const resolved = resolveGitCommit({
      repository,
      ref: options.required,
    })
    if (resolved !== options.required) {
      throw new Error(`resolved ${resolved}, expected ${options.required}`)
    }
  } catch (error) {
    if (options.sourceRoots.has(options.source.id)) {
      throw new Error(
        `source root ${options.source.id} does not contain exact commit ${options.required}: ${error.message}`,
      )
    }
    if (!options.allowNetwork) {
      throw new Error(
        `source ${options.source.id} exact commit ${options.required} is unavailable in ${repository}; supply --source-root or allow network: ${error.message}`,
      )
    }
    runGit(
      repository,
      [`--git-dir=${repository}`, 'fetch', '--quiet', '--no-tags', 'origin', options.required],
      `fetch exact commit ${options.required} for ${options.source.id}`,
    )
    const resolved = resolveGitCommit({ repository, ref: options.required })
    if (resolved !== options.required) {
      throw new Error(`source ${options.source.id} did not acquire exact commit ${options.required}`)
    }
  }
  const installed = installRepositoryCache(
    acquired,
    options.source,
    options.cacheDir,
  )
  if (installed !== repository) {
    repository = installed
    const resolved = resolveGitCommit({
      repository,
      ref: options.required,
    })
    if (resolved !== options.required) {
      throw new Error(
        `concurrent repository cache ${options.source.id} does not contain exact commit ${options.required}`,
      )
    }
  }
  return repository
}

function requireGitRecord(actual, expected, label) {
  const comparable = {
    path: actual.path,
    sha256: actual.sha256,
    size: actual.size,
    executable: actual.executable,
  }
  if (!sameRecord(comparable, expected)) {
    throw new Error(`${label} does not match the committed lock`)
  }
}

function createParents(root, portablePath) {
  const segments = portablePath.split('/')
  let current = root
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment)
    ensureDirectory(current, {
      anchor: root,
      create: true,
      label: 'staging parent',
    })
  }
}

function writeStagedFile(root, record, bytes) {
  createParents(root, record.path)
  const path = join(root, ...record.path.split('/'))
  const descriptor = openSync(path, 'wx', record.executable ? 0o755 : 0o644)
  try {
    writeFileSync(descriptor, bytes)
  } finally {
    closeSync(descriptor)
  }
  chmodSync(path, record.executable ? 0o755 : 0o644)
  return path
}

function installDirectory(staged, destination, anchor) {
  ensureDirectory(dirname(destination), {
    anchor,
    create: true,
    label: 'cache skill parent',
  })
  if (optionalStatus(destination, 'cache destination') !== null) return false
  try {
    renameSync(staged, destination)
    return true
  } catch (error) {
    if (!existsSync(destination)) throw error
    return false
  }
}

function materializeSkill({
  skill,
  source,
  repository,
  group,
  destination,
  stagingAnchor,
  platform,
}) {
  const records = readGitTree({
    repository,
    commit: group.commit,
    subpath: skill.path,
  })
  const hashed = hashFileRecords(records)
  if (
    hashed.treeSha256 !== skill.treeSha256 ||
    hashed.files.length !== skill.files.length ||
    hashed.files.some((record, index) => !sameRecord(record, skill.files[index]))
  ) {
    throw new Error(
      `source ${source.id} skill ${skill.name} at ${group.commit}:${skill.path} does not match the committed lock`,
    )
  }
  ensureDirectory(dirname(destination), {
    anchor: stagingAnchor,
    create: true,
    label: 'operation skill staging parent',
  })
  materializeGitTree({
    repository,
    commit: group.commit,
    subpath: skill.path,
    destination,
  })
  verifyLockedSkillDirectory(destination, skill, { platform })
}

function materializeAbsentGroup({
  group,
  source,
  repository,
  cacheDir,
  operationRoot,
  state,
  platform,
}) {
  const stagedCache = join(operationRoot, 'snapshot-cache')
  const stagedRoot = snapshotPath(stagedCache, group)
  ensureDirectory(stagedRoot, {
    anchor: operationRoot,
    create: true,
    label: 'operation staging source',
  })

  for (const field of ['licenseFile', 'noticeFile']) {
    const expected = group[field]
    const actual = readGitFile({
      repository,
      commit: group.commit,
      path: expected.path,
    })
    requireGitRecord(actual, expected, `${source.id} ${field}`)
    writeStagedFile(stagedRoot, expected, actual.bytes)
  }

  for (const skill of group.skills) {
    materializeSkill({
      skill,
      source,
      repository,
      group,
      destination: join(stagedRoot, ...skill.path.split('/')),
      stagingAnchor: stagedRoot,
      platform,
    })
  }

  inspectGroup(stagedCache, group, platform, { requireComplete: true })
  installDirectory(stagedRoot, state.root, cacheDir)
  inspectGroup(cacheDir, group, platform, { requireComplete: true })
}

function materializeMissingGroup({
  group,
  source,
  repository,
  cacheDir,
  operationRoot,
  state,
  platform,
}) {
  if (!state.present) {
    materializeAbsentGroup({
      group,
      source,
      repository,
      cacheDir,
      operationRoot,
      state,
      platform,
    })
    return
  }
  if (!state.license || !state.notice) {
    throw new Error(
      `present source snapshot ${group.source} ${group.commit} is partial or corrupt`,
    )
  }

  const root = state.root
  const stagedGroup = join(operationRoot, 'sources', group.source, group.commit)
  ensureDirectory(stagedGroup, {
    anchor: operationRoot,
    create: true,
    label: 'operation staging source',
  })

  for (const skill of group.skills) {
    if (state.skills.get(skill.name)) continue
    const staged = join(stagedGroup, 'skills', skill.name)
    materializeSkill({
      skill,
      source,
      repository,
      destination: staged,
      group,
      stagingAnchor: stagedGroup,
      platform,
    })
    const destination = join(root, ...skill.path.split('/'))
    installDirectory(staged, destination, root)
    verifySkill(root, skill, platform)
  }
}

export function syncLockedSkills(options = {}) {
  const {
    repoRoot,
    cacheDir,
    env,
    sourceRoots = new Map(),
    allowNetwork = true,
    platform = process.platform,
  } = validatePublicOptions(options, SYNC_OPTIONS, 'syncLockedSkills options')
  requireBoolean(allowNetwork, 'allowNetwork')
  requireString(platform, 'platform')
  const operation = loadOperation({ repoRoot, cacheDir, env })
  const roots = validateMap(sourceRoots, 'sourceRoots', operation.sources)
  inspectExistingCache(operation.repoRoot, operation.cacheDir)
  const states = operation.groups.map((group) =>
    inspectGroup(operation.cacheDir, group, platform))
  for (let index = 0; index < operation.groups.length; index += 1) {
    const group = operation.groups[index]
    const state = states[index]
    if (state.present && (!state.license || !state.notice)) {
      throw new Error(
        `present source snapshot ${group.source} ${group.commit} is partial or corrupt: locked LICENSE/NOTICE content is missing`,
      )
    }
  }
  const needsSource = states.some((state, index) => {
    const group = operation.groups[index]
    return !state.license ||
      !state.notice ||
      group.skills.some((skill) => !state.skills.get(skill.name))
  })

  let operationRoot
  if (needsSource) {
    ensureDirectory(operation.cacheDir, {
      anchor: cacheAnchor(operation.repoRoot, operation.cacheDir),
      create: true,
      label: 'skills cache',
    })
    ensureDirectory(join(operation.cacheDir, '.tmp'), {
      anchor: operation.cacheDir,
      create: true,
      label: 'skills cache staging root',
    })
    operationRoot = join(operation.cacheDir, '.tmp', randomUUID())
    ensureDirectory(operationRoot, {
      anchor: join(operation.cacheDir, '.tmp'),
      create: true,
      label: 'operation staging',
    })
  }

  try {
    for (let index = 0; index < operation.groups.length; index += 1) {
      const group = operation.groups[index]
      const state = states[index]
      if (
        state.license &&
        state.notice &&
        group.skills.every((skill) => state.skills.get(skill.name))
      ) {
        continue
      }
      const source = operation.sources.byId.get(group.source)
      const repository = exactSourceRepository({
        cacheDir: operation.cacheDir,
        source,
        sourceRoots: roots,
        allowNetwork,
        operationRoot,
        required: group.commit,
      })
      materializeMissingGroup({
        group,
        source,
        repository,
        cacheDir: operation.cacheDir,
        operationRoot,
        state,
        platform,
      })
      inspectGroup(operation.cacheDir, group, platform, { requireComplete: true })
    }
  } finally {
    if (operationRoot) rmSync(operationRoot, { recursive: true, force: true })
  }

  return {
    cacheDir: operation.cacheDir,
    sources: operation.groups.map((group, index) => ({
      source: group.source,
      commit: group.commit,
      status: states[index].license && states[index].notice
        ? 'reused'
        : 'materialized',
      licenseFile: cloneRecord(group.licenseFile),
      noticeFile: cloneRecord(group.noticeFile),
    })),
    skills: operation.groups
      .flatMap((group, groupIndex) =>
        group.skills.map((skill) => ({
          name: skill.name,
          source: skill.source,
          commit: skill.commit,
          path: skill.path,
          treeSha256: skill.treeSha256,
          status: states[groupIndex].skills.get(skill.name)
            ? 'reused'
            : 'materialized',
        })))
      .sort((left, right) =>
        comparePortablePaths(left.name, right.name) ||
        comparePortablePaths(left.source, right.source) ||
        comparePortablePaths(left.commit, right.commit) ||
        comparePortablePaths(left.path, right.path)),
  }
}

function validateNameRequests(names, selections, sources) {
  if (!Array.isArray(names)) throw new Error('names must be an array')
  if (!Array.isArray(selections)) throw new Error('selections must be an array')
  if (names.length + selections.length === 0) {
    throw new Error('update-lock requires at least one requested skill')
  }
  const requested = new Set()
  const normalizedNames = names.map((name, index) => {
    const value = requireIdentifier(name, `names ${index}`)
    if (requested.has(value)) throw new Error(`duplicate requested skill name: ${value}`)
    requested.add(value)
    return value
  })
  const normalizedSelections = selections.map((selection, index) => {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
      throw new Error(`selection ${index} must be an object`)
    }
    const keys = Object.keys(selection).sort(comparePortablePaths)
    if (keys.join(',') !== 'name,path,source') {
      throw new Error(`selection ${index} must contain exactly name, source, and path`)
    }
    const name = requireIdentifier(selection.name, `selection ${index} name`)
    if (requested.has(name)) throw new Error(`duplicate requested skill name: ${name}`)
    requested.add(name)
    const source = requireIdentifier(selection.source, `selection ${index} source`)
    if (!sources.byId.has(source)) {
      throw new Error(`selection ${index} source is not declared: ${source}`)
    }
    const path = assertPortableRelativePath(selection.path, `selection ${index} path`)
    if (path.split('/').at(-1) !== name) {
      throw new Error(`selection ${index} final path segment must equal skill name ${name}`)
    }
    return { name, source, path }
  })
  return {
    names: normalizedNames,
    selections: normalizedSelections,
    requested,
  }
}

function validateRefMap(sourceRefs, sources) {
  if (!(sourceRefs instanceof Map)) throw new Error('sourceRefs must be a Map')
  const normalized = new Map()
  for (const [key, value] of sourceRefs) {
    const id = requireIdentifier(key, 'sourceRefs key')
    if (!sources.byId.has(id)) throw new Error(`sourceRefs source is not declared: ${id}`)
    const ref = requireString(value, `sourceRefs ${id}`)
    if (ref.startsWith('-')) throw new Error(`sourceRefs ${id} must not start with -`)
    normalized.set(id, ref)
  }
  return normalized
}

function listSkillPaths(repository, commit, name) {
  const gitDirectory = discoverGitDirectory(repository)
  const bytes = runGitBytes(
    repository,
    [`--git-dir=${gitDirectory}`, 'ls-tree', '-rz', '--name-only', commit],
    `discover skills named ${name} at ${commit}`,
  )
  const paths = []
  let start = 0
  while (start < bytes.length) {
    const end = bytes.indexOf(0, start)
    if (end === -1) throw new Error(`Git tree discovery for ${name} is not NUL-delimited`)
    const raw = bytes.subarray(start, end)
    if (raw.length === 0) throw new Error(`Git tree discovery for ${name} contains an empty record`)
    const path = raw.toString('utf8')
    if (!Buffer.from(path).equals(raw)) {
      throw new Error(`Git tree discovery for ${name} contains an invalid UTF-8 path`)
    }
    assertPortableRelativePath(path, `Git tree discovery path for ${name}`)
    const suffix = '/SKILL.md'
    if (path.endsWith(suffix)) {
      const parent = path.slice(0, -suffix.length)
      if (parent.split('/').at(-1) === name) paths.push(parent)
    }
    start = end + 1
  }
  return paths.sort(comparePortablePaths)
}

function updateRepository({
  cacheDir,
  source,
  sourceRoots,
  sourceRef,
  allowNetwork,
  operationRoot,
}) {
  const acquired = acquisitionRepository({
    cacheDir,
    source,
    sourceRoots,
    allowNetwork,
    operationRoot,
    required: sourceRef,
  })
  let repository = acquired.repository
  let commit
  if (!sourceRoots.has(source.id) && allowNetwork) {
    runGit(
      repository,
      [`--git-dir=${repository}`, 'fetch', '--quiet', '--no-tags', 'origin', sourceRef],
      `fetch ref ${sourceRef} for ${source.id}`,
    )
    commit = resolveGitCommit({ repository, ref: 'FETCH_HEAD' })
  }
  if (commit === undefined) {
    try {
      commit = resolveGitCommit({ repository, ref: sourceRef })
    } catch (error) {
      const location = sourceRoots.has(source.id)
        ? `source root ${sanitize(sourceRoots.get(source.id))}`
        : `repository cache ${sanitize(repository)}`
      throw new Error(
        `source ${source.id} ref ${sanitize(sourceRef)} is unavailable in ${location}: ${error.message}`,
      )
    }
  }
  const installed = installRepositoryCache(acquired, source, cacheDir)
  if (installed !== repository) {
    repository = installed
    const winnerCommit = resolveGitCommit({ repository, ref: commit })
    if (winnerCommit !== commit) {
      throw new Error(
        `concurrent repository cache ${source.id} does not contain captured commit ${commit}`,
      )
    }
  }
  return { repository, commit }
}

function sourceFileRecord(record) {
  return {
    path: record.path,
    sha256: record.sha256,
    size: record.size,
    executable: record.executable,
  }
}

function buildLockedEntry({ name, path, source, repository, commit }) {
  const records = readGitTree({ repository, commit, subpath: path })
  if (!records.some((record) => record.path === 'SKILL.md')) {
    throw new Error(`selected skill ${name} at ${commit}:${path} has no root SKILL.md`)
  }
  const hashed = hashFileRecords(records)
  const license = readGitFile({
    repository,
    commit,
    path: source.licensePath,
  })
  const notice = readGitFile({
    repository,
    commit,
    path: source.noticePath,
  })
  return {
    name,
    source: source.id,
    repository: source.repository,
    commit,
    path,
    treeSha256: hashed.treeSha256,
    files: hashed.files,
    license: source.license,
    licensePath: source.licensePath,
    licenseFile: sourceFileRecord(license),
    noticePath: source.noticePath,
    noticeFile: sourceFileRecord(notice),
  }
}

function copyLockedSkill(skill) {
  return {
    ...skill,
    files: skill.files.map(cloneRecord),
    licenseFile: cloneRecord(skill.licenseFile),
    noticeFile: cloneRecord(skill.noticeFile),
  }
}

function fileState(path, label, { required = false } = {}) {
  const before = optionalStatus(path, label)
  if (before === null) {
    if (required) throw new Error(`${label} does not exist: ${path}`)
    return { exists: false }
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file: ${path}`)
  }
  const bytes = readFileSync(path)
  const after = lstatSync(path)
  if (
    after.isSymbolicLink() ||
    !after.isFile() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new Error(`${label} changed while its initial state was captured: ${path}`)
  }
  return {
    exists: true,
    bytes,
    dev: after.dev,
    ino: after.ino,
    mode: after.mode,
    size: after.size,
    mtimeMs: after.mtimeMs,
  }
}

function sameFileState(left, right) {
  if (left.exists !== right.exists) return false
  if (!left.exists) return true
  return left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.bytes.equals(right.bytes)
}

function assertFileUnchanged(path, initial, label) {
  if (!sameFileState(initial, fileState(path, label))) {
    throw new Error(
      `${label} changed concurrently; compare-and-swap publication was refused: ${path}`,
    )
  }
}

function acquireLockGuard(lockPath) {
  const guardPath = join(dirname(lockPath), '.skills.lock.yaml.update-lock')
  const content = Buffer.from('RAMP update-lock in progress\n')
  let descriptor
  let state
  try {
    descriptor = openSync(guardPath, 'wx', 0o600)
    writeFileSync(descriptor, content)
    fsyncSync(descriptor)
    const status = fstatSync(descriptor)
    state = {
      exists: true,
      bytes: content,
      dev: status.dev,
      ino: status.ino,
      mode: status.mode,
      size: status.size,
      mtimeMs: status.mtimeMs,
    }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor)
    if (error.code === 'EEXIST') {
      throw new Error(
        `another update-lock operation holds the exclusive guard: ${guardPath}`,
      )
    }
    throw error
  }
  closeSync(descriptor)
  return { path: guardPath, state }
}

function assertGuardOwned(guard) {
  if (!sameFileState(guard.state, fileState(guard.path, 'update-lock guard'))) {
    throw new Error(
      `update-lock guard changed concurrently; ownership was lost: ${guard.path}`,
    )
  }
}

function releaseLockGuard(guard) {
  const current = fileState(guard.path, 'update-lock guard')
  if (!current.exists || !sameFileState(guard.state, current)) return
  try {
    unlinkSync(guard.path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function serializeCandidateLock(operationRoot, candidateLock, sourceRegistryBytes) {
  const serializerRoot = join(operationRoot, 'lock-serializer')
  const dependencies = join(serializerRoot, 'dependencies')
  ensureDirectory(dependencies, {
    anchor: operationRoot,
    create: true,
    label: 'lock serializer directory',
  })
  const stagedSourcePath = join(dependencies, 'skills.sources.yaml')
  const sourceDescriptor = openSync(stagedSourcePath, 'wx', 0o644)
  try {
    writeFileSync(sourceDescriptor, sourceRegistryBytes)
    fsyncSync(sourceDescriptor)
  } finally {
    closeSync(sourceDescriptor)
  }
  chmodSync(stagedSourcePath, 0o644)
  const generatedPath = writeSkillLock(serializerRoot, candidateLock)
  return readFileSync(generatedPath)
}

function publishLock({
  lockPath,
  initial,
  sourceRegistryPath,
  initialSourceRegistry,
  guard,
  bytes,
}) {
  const parent = dirname(lockPath)
  const temporary = join(parent, `.skills.lock.yaml.${randomUUID()}.tmp`)
  let descriptor
  try {
    assertGuardOwned(guard)
    assertFileUnchanged(lockPath, initial, 'skill lock')
    assertFileUnchanged(
      sourceRegistryPath,
      initialSourceRegistry,
      'skill source registry',
    )
    descriptor = openSync(temporary, 'wx', 0o600)
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    chmodSync(temporary, 0o644)
    assertGuardOwned(guard)
    assertFileUnchanged(lockPath, initial, 'skill lock')
    assertFileUnchanged(
      sourceRegistryPath,
      initialSourceRegistry,
      'skill source registry',
    )
    renameSync(temporary, lockPath)

    let directoryDescriptor
    try {
      directoryDescriptor = openSync(parent, 'r')
      fsyncSync(directoryDescriptor)
    } catch (error) {
      if (!['EINVAL', 'ENOTSUP', 'EPERM'].includes(error.code)) throw error
    } finally {
      if (directoryDescriptor !== undefined) closeSync(directoryDescriptor)
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    try {
      unlinkSync(temporary)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return lockPath
}

export function updateSkillLocks(options = {}) {
  const {
    repoRoot,
    names = [],
    selections = [],
    cacheDir,
    env,
    sourceRoots = new Map(),
    sourceRefs = new Map(),
    defaultRef = 'main',
    allowNetwork = true,
    platform = process.platform,
  } = validatePublicOptions(options, UPDATE_OPTIONS, 'updateSkillLocks options')
  const root = resolve(requireString(repoRoot, 'repoRoot'))
  requireBoolean(allowNetwork, 'allowNetwork')
  requireString(platform, 'platform')
  const selectedDefaultRef = requireString(defaultRef, 'defaultRef')
  if (selectedDefaultRef.startsWith('-')) throw new Error('defaultRef must not start with -')

  const sourceRegistryPath = join(
    root,
    'dependencies',
    'skills.sources.yaml',
  )
  const initialSourceRegistryState = fileState(
    sourceRegistryPath,
    'skill source registry',
    { required: true },
  )
  const sources = loadSkillSources(root)
  assertFileUnchanged(
    sourceRegistryPath,
    initialSourceRegistryState,
    'skill source registry',
  )
  const roots = validateMap(sourceRoots, 'sourceRoots', sources)
  const refs = validateRefMap(sourceRefs, sources)
  const requests = validateNameRequests(names, selections, sources)
  const lockPath = join(root, 'dependencies', 'skills.lock.yaml')
  const initialLockState = fileState(lockPath, 'skill lock')
  const existing = loadSkillLock(root)
  const selectedCache = resolveOperationCache({
    repoRoot: root,
    cacheDir,
    env,
  })

  const selectionsByName = new Map(
    requests.selections.map((selection) => [selection.name, selection]),
  )
  const requiredSourceIds = new Set(
    requests.selections.map((selection) => selection.source),
  )
  const newNames = []
  for (const name of requests.names) {
    const locked = existing?.skills.get(name)
    if (locked) requiredSourceIds.add(locked.source)
    else newNames.push(name)
  }
  if (newNames.length > 0) {
    for (const source of sources.sources) requiredSourceIds.add(source.id)
  }

  const guard = acquireLockGuard(lockPath)
  let operationRoot
  const resolvedSources = new Map()
  const commits = []
  try {
    ensureDirectory(selectedCache, {
      anchor: cacheAnchor(root, selectedCache),
      create: true,
      label: 'skills cache',
    })
    ensureDirectory(join(selectedCache, '.tmp'), {
      anchor: selectedCache,
      create: true,
      label: 'skills cache staging root',
    })
    operationRoot = join(selectedCache, '.tmp', randomUUID())
    ensureDirectory(operationRoot, {
      anchor: join(selectedCache, '.tmp'),
      create: true,
      label: 'operation staging',
    })

    for (const sourceId of [...requiredSourceIds].sort(comparePortablePaths)) {
      const source = sources.byId.get(sourceId)
      const ref = refs.get(sourceId) ?? selectedDefaultRef
      const captured = updateRepository({
        cacheDir: selectedCache,
        source,
        sourceRoots: roots,
        sourceRef: ref,
        allowNetwork,
        operationRoot,
      })
      resolvedSources.set(sourceId, { source, ref, ...captured })
      commits.push({ source: sourceId, ref, commit: captured.commit })
    }

    for (const name of newNames) {
      const matches = []
      for (const source of sources.sources) {
        const captured = resolvedSources.get(source.id)
        const paths = listSkillPaths(captured.repository, captured.commit, name)
        if (paths.length > 1) {
          throw new Error(
            `source ${source.id} has multiple matches for ${name}: ${paths.join(', ')}`,
          )
        }
        if (paths.length === 1) {
          matches.push({ name, source: source.id, path: paths[0] })
        }
      }
      if (matches.length === 0) {
        throw new Error(`no declared source contains skill ${name}`)
      }
      const selected = matches
        .sort((left, right) => {
          const leftSource = sources.byId.get(left.source)
          const rightSource = sources.byId.get(right.source)
          return leftSource.priority - rightSource.priority ||
            comparePortablePaths(left.source, right.source)
        })[0]
      selectionsByName.set(name, selected)
    }

    for (const name of requests.names) {
      if (selectionsByName.has(name)) continue
      const locked = existing.skills.get(name)
      selectionsByName.set(name, {
        name,
        source: locked.source,
        path: locked.path,
      })
    }

    const candidate = new Map(
      [...(existing?.skills ?? new Map())].map(([name, skill]) => [
        name,
        copyLockedSkill(skill),
      ]),
    )
    for (const name of [...requests.requested].sort(comparePortablePaths)) {
      const selection = selectionsByName.get(name)
      const captured = resolvedSources.get(selection.source)
      candidate.set(name, buildLockedEntry({
        name,
        path: selection.path,
        source: captured.source,
        repository: captured.repository,
        commit: captured.commit,
      }))
    }

    const candidateLock = { schemaVersion: 1, skills: candidate }
    const candidateGroups = groupsFromLock(candidateLock)
    for (const group of candidateGroups) sourceCoordinates(group)

    const updatedSet = requests.requested
    const groupsToMaterialize = candidateGroups.filter((group) =>
      group.skills.some((skill) => updatedSet.has(skill.name)))
    for (const group of groupsToMaterialize) {
      const state = inspectGroup(selectedCache, group, platform)
      if (state.present && (!state.license || !state.notice)) {
        throw new Error(
          `present source snapshot ${group.source} ${group.commit} is partial or corrupt`,
        )
      }
      const captured = resolvedSources.get(group.source)
      if (!captured || captured.commit !== group.commit) {
        throw new Error(
          `updated source ${group.source} commit ${group.commit} was not captured`,
        )
      }
      materializeMissingGroup({
        group,
        source: captured.source,
        repository: captured.repository,
        cacheDir: selectedCache,
        operationRoot,
        state,
        platform,
      })
      inspectGroup(selectedCache, group, platform, { requireComplete: true })
    }

    const lockBytes = serializeCandidateLock(
      operationRoot,
      candidateLock,
      initialSourceRegistryState.bytes,
    )
    publishLock({
      lockPath,
      initial: initialLockState,
      sourceRegistryPath,
      initialSourceRegistry: initialSourceRegistryState,
      guard,
      bytes: lockBytes,
    })
    return {
      lockPath,
      cacheDir: selectedCache,
      updated: [...requests.requested].sort(comparePortablePaths),
      preserved: [...candidate.keys()]
        .filter((name) => !requests.requested.has(name))
        .sort(comparePortablePaths),
      commits,
    }
  } finally {
    if (operationRoot) rmSync(operationRoot, { recursive: true, force: true })
    releaseLockGuard(guard)
  }
}
