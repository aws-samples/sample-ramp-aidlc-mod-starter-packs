import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstatSync,
  mkdirSync,
  realpathSync,
} from 'node:fs'
import { devNull } from 'node:os'
import {
  basename,
  dirname,
  join,
  parse,
  resolve,
  sep,
} from 'node:path'
import {
  assertPortableRelativePath,
  comparePortablePaths,
} from './checksum.js'

const COMMIT = /^[0-9a-f]{40}$/
const GIT_ENV = {
  GCM_INTERACTIVE: 'Never',
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0',
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC',
}
const METADATA_LIMIT = 32 * 1024 * 1024
const BLOB_LIMIT = 16 * 1024 * 1024
const TREE_BYTES_LIMIT = 64 * 1024 * 1024
const TREE_ENTRY_LIMIT = 4096
const SUPPORTED_MODES = new Set(['100644', '100755'])
const ANCHORED_MUTATION_MARKER = 'ramp-anchored-mutation-v1'
const ANCHORED_MUTATION_OUTPUT_LIMIT = 64 * 1024
const TRUSTED_DARWIN_ROOT_LINKS = new Set(['/etc', '/tmp', '/var'])
const ANCHORED_MUTATION_SCRIPT = String.raw`
'use strict'
const fs = require('node:fs')
const path = require('node:path')
process.umask(0o077)

function fail(message) {
  process.stderr.write(String(message))
  process.exit(91)
}

function directName(value) {
  return typeof value === 'string' &&
    value !== '' &&
    value !== '.' &&
    value !== '..' &&
    path.basename(value) === value &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
}

try {
  const [
    marker,
    action,
    expectedPath,
    expectedDevice,
    expectedInode,
    name = '',
    rawMode = '',
  ] = process.argv.slice(1)
  if (marker !== 'ramp-anchored-mutation-v1') fail('invalid mutation marker')

  const cwdStatus = fs.lstatSync('.')
  const cwdPath = fs.realpathSync('.')
  if (
    !cwdStatus.isDirectory() ||
    cwdStatus.isSymbolicLink() ||
    String(cwdStatus.dev) !== expectedDevice ||
    String(cwdStatus.ino) !== expectedInode ||
    cwdPath !== expectedPath
  ) {
    fail('working directory identity changed before mutation')
  }

  if (action === 'mkdir') {
    if (!directName(name)) fail('invalid direct directory name')
    fs.mkdirSync(name, { mode: 0o700 })
    const childStatus = fs.lstatSync(name)
    const childPath = fs.realpathSync(name)
    if (
      childStatus.isSymbolicLink() ||
      !childStatus.isDirectory() ||
      path.dirname(childPath) !== cwdPath
    ) {
      fail('created directory escaped its anchored parent')
    }
    process.stdout.write(JSON.stringify({
      path: childPath,
      device: String(childStatus.dev),
      inode: String(childStatus.ino),
      uid: childStatus.uid,
      mode: childStatus.mode & 0o777,
    }))
    process.exit(0)
  }

  if (action === 'write-batch') {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'))
    if (!Array.isArray(payload) || payload.length > 4096) {
      fail('invalid file batch')
    }
    for (const file of payload) {
      if (
        !file ||
        !directName(file.name) ||
        !Number.isSafeInteger(file.mode) ||
        !Number.isSafeInteger(file.size) ||
        typeof file.base64 !== 'string'
      ) {
        fail('invalid file batch entry')
      }
      const bytes = Buffer.from(file.base64, 'base64')
      if (bytes.length !== file.size) fail('invalid file batch size')
      const flags = fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        (fs.constants.O_NOFOLLOW || 0)
      const descriptor = fs.openSync(file.name, flags, file.mode)
      try {
        const status = fs.fstatSync(descriptor)
        if (!status.isFile()) fail('created output is not a regular file')
        fs.writeFileSync(descriptor, bytes)
        fs.fchmodSync(descriptor, file.mode)
      } finally {
        fs.closeSync(descriptor)
      }
    }
    process.exit(0)
  }

  if (action === 'chmod-directory') {
    const mode = Number(rawMode)
    if (!Number.isSafeInteger(mode)) fail('invalid directory mode')
    fs.chmodSync('.', mode)
    process.exit(0)
  }

  fail('invalid anchored mutation action')
} catch (error) {
  fail(error && error.code
    ? 'anchored mutation failed (' + error.code + ')'
    : 'anchored mutation failed')
}
`

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${label} must not contain NUL, CR, or LF`)
  }
  return value
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

function runGit(args, {
  operation,
  repository,
  maxBuffer = METADATA_LIMIT,
} = {}) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    shell: false,
    encoding: null,
    maxBuffer,
    env: gitEnvironment(),
  })
  const context = `${operation} in ${sanitize(repository)}`
  if (result.error) {
    const suffix = result.error.code === 'ENOBUFS'
      ? ` exceeded the ${maxBuffer}-byte output bound`
      : ` could not launch Git: ${sanitize(result.error.message)}`
    throw new Error(`${context}${suffix}`)
  }
  if (result.signal) {
    throw new Error(`${context} was terminated by signal ${result.signal}`)
  }
  if (result.status !== 0) {
    const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0))
      .toString('utf8')
      .trim()
    throw new Error(
      `${context} failed${stderr ? `: ${sanitize(stderr)}` : ''}`,
    )
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0))
}

function decodeSingleLine(bytes, label) {
  const text = bytes.toString('utf8').replace(/\r?\n$/, '')
  if (text.includes('\n') || text.includes('\r') || text.length === 0) {
    throw new Error(`${label} returned invalid output`)
  }
  return text
}

function discoverGitDirectory(repository) {
  const supplied = requireString(repository, 'repository')
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(supplied)) {
    throw new Error(
      `repository must be a local path: ${sanitize(supplied)}`,
    )
  }
  const local = resolve(supplied)
  const bytes = runGit(
    ['-C', local, 'rev-parse', '--absolute-git-dir'],
    {
      operation: 'discover Git directory',
      repository: local,
    },
  )
  return {
    repository: local,
    gitDirectory: resolve(decodeSingleLine(bytes, 'Git directory discovery')),
  }
}

function runRepositoryGit(repository, gitDirectory, args, options = {}) {
  return runGit([`--git-dir=${gitDirectory}`, ...args], {
    repository,
    ...options,
  })
}

function validateRef(ref) {
  const value = requireString(ref, 'ref')
  if (value.startsWith('-')) throw new Error('ref must not start with -')
  return value
}

function validateCommit(repository, gitDirectory, commit) {
  if (typeof commit !== 'string' || !COMMIT.test(commit)) {
    throw new Error('commit must be a lowercase 40-character object ID')
  }
  const resolved = decodeSingleLine(
    runRepositoryGit(
      repository,
      gitDirectory,
      ['rev-parse', '--verify', `${commit}^{commit}`],
      {
        operation: `verify commit ${commit}`,
      },
    ),
    `commit ${commit} verification`,
  )
  if (resolved !== commit) {
    throw new Error(
      `commit ${commit} in ${sanitize(repository)} dereferences to ${resolved}, not itself`,
    )
  }
  return commit
}

function decodePortablePath(bytes, label) {
  const path = bytes.toString('utf8')
  if (!Buffer.from(path, 'utf8').equals(bytes)) {
    throw new Error(`${label} is not round-trip-valid UTF-8`)
  }
  return assertPortableRelativePath(path, label)
}

function parseTreeEntries(bytes, label) {
  const records = []
  const seen = new Set()
  let start = 0
  while (start < bytes.length) {
    const end = bytes.indexOf(0, start)
    if (end === -1) throw new Error(`${label} is not NUL-delimited`)
    if (end === start) {
      throw new Error(`${label} contains an empty NUL-delimited record`)
    }
    const entry = bytes.subarray(start, end)
    const tab = entry.indexOf(9)
    if (tab === -1) throw new Error(`${label} entry has no path separator`)
    const metadata = entry.subarray(0, tab).toString('ascii').split(' ')
    if (metadata.length !== 3) throw new Error(`${label} entry has invalid metadata`)
    const [gitMode, type, objectId] = metadata
    if (!/^[0-7]{6}$/.test(gitMode) || !/^[0-9a-f]{40,64}$/.test(objectId)) {
      throw new Error(`${label} entry has invalid Git metadata`)
    }
    const path = decodePortablePath(entry.subarray(tab + 1), `${label} path`)
    if (seen.has(path)) throw new Error(`${label} has duplicate path: ${path}`)
    seen.add(path)
    records.push({ path, gitMode, type, objectId })
    start = end + 1
  }
  return records
}

function listTree(repository, gitDirectory, commit, path, recursive = false) {
  const args = ['ls-tree', '-z']
  if (recursive) args.push('-r')
  args.push(commit, '--', path)
  return parseTreeEntries(
    runRepositoryGit(repository, gitDirectory, args, {
      operation: `read Git tree ${commit}:${path}`,
    }),
    `Git tree ${commit}:${path}`,
  )
}

function readBlob(repository, gitDirectory, objectId, context) {
  return runRepositoryGit(
    repository,
    gitDirectory,
    ['cat-file', 'blob', objectId],
    {
      operation: `read Git blob ${context}`,
      maxBuffer: BLOB_LIMIT,
    },
  )
}

function fileRecord(repository, gitDirectory, entry, returnedPath) {
  if (!SUPPORTED_MODES.has(entry.gitMode)) {
    const kind = entry.gitMode === '120000'
      ? 'symlink'
      : entry.gitMode === '160000'
        ? 'submodule'
        : entry.gitMode === '040000'
          ? 'tree, not an ordinary file'
          : `unsupported mode ${entry.gitMode}`
    throw new Error(`Git path ${entry.path} in ${sanitize(repository)} is a ${kind}`)
  }
  if (entry.type !== 'blob') {
    throw new Error(
      `Git path ${entry.path} in ${sanitize(repository)} is a ${entry.type}, not an ordinary file`,
    )
  }
  const bytes = readBlob(
    repository,
    gitDirectory,
    entry.objectId,
    entry.path,
  )
  return {
    path: returnedPath,
    bytes,
    gitMode: entry.gitMode,
    executable: entry.gitMode === '100755',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
  }
}

export function resolveGitCommit({ repository, ref } = {}) {
  const selectedRef = validateRef(ref)
  const discovered = discoverGitDirectory(repository)
  const resolved = decodeSingleLine(
    runRepositoryGit(
      discovered.repository,
      discovered.gitDirectory,
      ['rev-parse', '--verify', `${selectedRef}^{commit}`],
      {
        operation: `resolve Git ref ${sanitize(selectedRef)}`,
      },
    ),
    `Git ref ${sanitize(selectedRef)}`,
  )
  if (!COMMIT.test(resolved)) {
    throw new Error(
      `Git ref ${sanitize(selectedRef)} did not resolve to one lowercase 40-character commit`,
    )
  }
  return resolved
}

export function readGitFile({ repository, commit, path } = {}) {
  const selectedPath = assertPortableRelativePath(path, 'Git file path')
  const discovered = discoverGitDirectory(repository)
  validateCommit(discovered.repository, discovered.gitDirectory, commit)
  const entries = listTree(
    discovered.repository,
    discovered.gitDirectory,
    commit,
    selectedPath,
  )
  if (entries.length !== 1 || entries[0].path !== selectedPath) {
    throw new Error(
      `Git file ${commit}:${selectedPath} does not exist as one ordinary blob in ${sanitize(discovered.repository)}`,
    )
  }
  return fileRecord(
    discovered.repository,
    discovered.gitDirectory,
    entries[0],
    selectedPath,
  )
}

export function readGitTree({ repository, commit, subpath } = {}) {
  const selectedPath = assertPortableRelativePath(subpath, 'Git tree subpath')
  const discovered = discoverGitDirectory(repository)
  validateCommit(discovered.repository, discovered.gitDirectory, commit)
  const roots = listTree(
    discovered.repository,
    discovered.gitDirectory,
    commit,
    selectedPath,
  )
  if (
    roots.length !== 1 ||
    roots[0].path !== selectedPath ||
    roots[0].type !== 'tree' ||
    roots[0].gitMode !== '040000'
  ) {
    throw new Error(
      `Git path ${commit}:${selectedPath} is not exactly one tree in ${sanitize(discovered.repository)}`,
    )
  }

  const prefix = `${selectedPath}/`
  const entries = listTree(
    discovered.repository,
    discovered.gitDirectory,
    commit,
    selectedPath,
    true,
  )
  if (entries.length > TREE_ENTRY_LIMIT) {
    throw new Error(
      `Git tree ${commit}:${selectedPath} exceeds the ${TREE_ENTRY_LIMIT}-entry safety limit`,
    )
  }
  const records = []
  let totalBytes = 0
  for (const entry of entries) {
    if (!entry.path.startsWith(prefix)) {
      throw new Error(`Git tree entry escapes selected tree ${selectedPath}: ${entry.path}`)
    }
    const returnedPath = assertPortableRelativePath(
      entry.path.slice(prefix.length),
      `Git tree ${selectedPath} relative path`,
    )
    const record = fileRecord(
      discovered.repository,
      discovered.gitDirectory,
      entry,
      returnedPath,
    )
    totalBytes += record.size
    if (totalBytes > TREE_BYTES_LIMIT) {
      throw new Error(
        `Git tree ${commit}:${selectedPath} exceeds the ${TREE_BYTES_LIMIT}-byte cumulative safety limit`,
      )
    }
    records.push(record)
  }
  records.sort((left, right) => comparePortablePaths(left.path, right.path))
  return records
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function assertNoMaterializationCollisions(records) {
  const coordinates = new Map()
  for (const record of records) {
    const segments = record.path.split('/')
    for (let index = 1; index <= segments.length; index += 1) {
      const coordinate = segments.slice(0, index).join('/')
      const kind = index === segments.length ? 'file' : 'directory'
      const key = coordinate.normalize('NFC').toLowerCase()
      const existing = coordinates.get(key)
      if (
        existing &&
        (existing.coordinate !== coordinate || existing.kind !== kind)
      ) {
        throw new Error(
          `materialization case-fold path collision: ${existing.coordinate} and ${coordinate}`,
        )
      }
      coordinates.set(key, { coordinate, kind })
    }
  }
}

function directoryIdentity(path, label) {
  const status = lstatSync(path)
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`${label} is not a non-symbolic directory: ${path}`)
  }
  return {
    path: realpathSync(path),
    device: String(status.dev),
    inode: String(status.ino),
    uid: status.uid,
    mode: status.mode & 0o777,
    kind: 'directory',
  }
}

function assertDirectoryIdentity(path, expected, label) {
  const current = directoryIdentity(path, label)
  if (
    current.path !== expected.path ||
    current.device !== expected.device ||
    current.inode !== expected.inode
  ) {
    throw new Error(`${label} changed during materialization: ${path}`)
  }
}

function trustedPlatformRootLink(path, root, status, rootStatus) {
  return process.platform === 'darwin' &&
    dirname(path) === root &&
    TRUSTED_DARWIN_ROOT_LINKS.has(path) &&
    status.uid === 0 &&
    rootStatus.uid === 0 &&
    (rootStatus.mode & 0o022) === 0
}

function checkedDirectoryAncestry(path, label, {
  allowPlatformRootLinks = false,
} = {}) {
  const absolute = resolve(path)
  const { root } = parse(absolute)
  const segments = absolute.slice(root.length).split(sep).filter(Boolean)
  const rootStatus = lstatSync(root)
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new Error(`${label} has an unsafe filesystem root: ${root}`)
  }
  const ancestry = [{
    path: root,
    device: String(rootStatus.dev),
    inode: String(rootStatus.ino),
    kind: 'directory',
  }]
  let current = root
  for (const segment of segments) {
    current = join(current, segment)
    let status
    try {
      status = lstatSync(current)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`${label} does not exist: ${current}`)
      }
      throw error
    }
    if (status.isSymbolicLink()) {
      if (
        !allowPlatformRootLinks ||
        !trustedPlatformRootLink(current, root, status, rootStatus)
      ) {
        throw new Error(
          `${label} contains a symbolic-link ancestor: ${current}`,
        )
      }
      ancestry.push({
        path: current,
        device: String(status.dev),
        inode: String(status.ino),
        kind: 'symlink',
      })
      continue
    }
    if (!status.isDirectory()) {
      throw new Error(`${label} contains a non-directory ancestor: ${current}`)
    }
    ancestry.push({
      path: current,
      device: String(status.dev),
      inode: String(status.ino),
      kind: 'directory',
    })
  }
  return ancestry
}

function assertDirectoryAncestry(ancestry, label) {
  for (const entry of ancestry) {
    const status = lstatSync(entry.path)
    const kind = status.isSymbolicLink()
      ? 'symlink'
      : status.isDirectory()
        ? 'directory'
        : 'other'
    if (
      kind !== entry.kind ||
      String(status.dev) !== entry.device ||
      String(status.ino) !== entry.inode
    ) {
      throw new Error(`${label} changed during materialization: ${entry.path}`)
    }
  }
}

function assertPrivateParent(status, path) {
  if (typeof process.getuid !== 'function') return
  if (status.uid !== process.getuid()) {
    throw new Error(
      `materialization parent must be owned by the current user: ${path}`,
    )
  }
  if ((status.mode & 0o022) !== 0) {
    throw new Error(
      `materialization parent must not be group/other writable: ${path}`,
    )
  }
}

/*
 * Materialization security boundary:
 *
 * - only immutable, root-owned macOS aliases at the filesystem root
 *   (/var, /tmp, /etc) may be canonicalized;
 * - every component below that platform boundary is lstat-validated;
 * - the caller-controlled existing parent must be current-user-owned and
 *   not writable by group/other;
 * - destination creation is exclusive and produces a 0700 private root;
 * - every mutation is executed by a helper whose cwd is bound to, and then
 *   validated against, the expected directory identity before mutation.
 *
 * The cwd binding provides the directory-handle-relative boundary missing
 * from Node's public fs API: a pathname substitution either resolves to the
 * recorded directory or fails identity validation before creating content.
 * The 0700 root excludes other OS principals. A process running as the same
 * principal has equivalent authority over user-owned filesystem content and
 * is outside this boundary; protecting against it requires native openat-like
 * handles that Node does not expose portably.
 */
function ensureSafeParent(destination) {
  const absolute = resolve(destination)
  const parent = dirname(absolute)
  const requestedAncestry = checkedDirectoryAncestry(
    parent,
    'materialization parent ancestry',
    { allowPlatformRootLinks: true },
  )
  let parentStatus
  try {
    parentStatus = lstatSync(parent)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`materialization parent does not exist: ${parent}`)
    }
    throw error
  }
  if (parentStatus.isSymbolicLink() || !parentStatus.isDirectory()) {
    throw new Error(
      `materialization parent is not a non-symbolic directory: ${parent}`,
    )
  }
  assertPrivateParent(parentStatus, parent)
  const realParent = realpathSync(parent)
  const canonicalAncestry = checkedDirectoryAncestry(
    realParent,
    'materialization canonical parent ancestry',
  )
  const parentIdentity = directoryIdentity(
    realParent,
    'materialization parent',
  )
  if (
    parentIdentity.device !== String(parentStatus.dev) ||
    parentIdentity.inode !== String(parentStatus.ino)
  ) {
    throw new Error(`materialization parent changed while resolving: ${parent}`)
  }
  return {
    parent: realParent,
    parentIdentity,
    ancestry: [...requestedAncestry, ...canonicalAncestry],
    target: join(realParent, basename(absolute)),
  }
}

function anchoredMutationEnvironment() {
  const environment = {
    LC_ALL: 'C',
    LANG: 'C',
    TZ: 'UTC',
  }
  for (const name of ['SystemRoot', 'WINDIR']) {
    if (typeof process.env[name] === 'string') {
      environment[name] = process.env[name]
    }
  }
  return environment
}

function runAnchoredMutation({
  action,
  directory,
  name = '',
  mode = '',
  input = Buffer.alloc(0),
}) {
  const result = spawnSync(
    process.execPath,
    [
      '--eval',
      ANCHORED_MUTATION_SCRIPT,
      ANCHORED_MUTATION_MARKER,
      action,
      directory.path,
      directory.device,
      directory.inode,
      name,
      String(mode),
    ],
    {
      cwd: directory.path,
      shell: false,
      encoding: null,
      input,
      maxBuffer: ANCHORED_MUTATION_OUTPUT_LIMIT,
      env: anchoredMutationEnvironment(),
    },
  )
  const context = `anchored ${action}${name ? ` ${sanitize(name)}` : ''}`
  if (result.error) {
    throw new Error(
      `${context} could not launch: ${sanitize(result.error.message)}`,
    )
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

function createAnchoredDirectory(parent, name) {
  const output = runAnchoredMutation({
    action: 'mkdir',
    directory: parent,
    name,
  })
  let identity
  try {
    identity = JSON.parse(output.toString('utf8'))
  } catch {
    throw new Error(`anchored mkdir ${sanitize(name)} returned invalid output`)
  }
  if (
    !identity ||
    typeof identity.path !== 'string' ||
    typeof identity.device !== 'string' ||
    typeof identity.inode !== 'string' ||
    !Number.isInteger(identity.uid) ||
    !Number.isInteger(identity.mode)
  ) {
    throw new Error(`anchored mkdir ${sanitize(name)} returned invalid identity`)
  }
  if (typeof process.getuid === 'function') {
    if (identity.uid !== process.getuid() || identity.mode !== 0o700) {
      throw new Error(
        `anchored mkdir ${sanitize(name)} did not create a current-user 0700 private directory`,
      )
    }
  }
  return { ...identity, kind: 'directory' }
}

function directoryPrefixes(records) {
  const prefixes = new Set()
  for (const record of records) {
    const segments = record.path.split('/')
    for (let index = 1; index < segments.length; index += 1) {
      prefixes.add(segments.slice(0, index).join('/'))
    }
  }
  return [...prefixes].sort((left, right) => {
    const depth = left.split('/').length - right.split('/').length
    return depth || comparePortablePaths(left, right)
  })
}

function parentPrefix(path) {
  const separator = path.lastIndexOf('/')
  return separator === -1 ? '' : path.slice(0, separator)
}

function portableDepth(path) {
  return path === '' ? 0 : path.split('/').length
}

function directPortableName(path) {
  const separator = path.lastIndexOf('/')
  return separator === -1 ? path : path.slice(separator + 1)
}

function writeAnchoredFiles(directory, records) {
  const payload = records.map((record) => ({
    name: directPortableName(record.path),
    mode: record.executable ? 0o755 : 0o644,
    size: record.size,
    base64: record.bytes.toString('base64'),
  }))
  runAnchoredMutation({
    action: 'write-batch',
    directory,
    input: Buffer.from(JSON.stringify(payload)),
  })
}

export function materializeGitTree({
  repository,
  commit,
  subpath,
  destination,
} = {}) {
  requireString(destination, 'destination')
  const records = readGitTree({ repository, commit, subpath })
  assertNoMaterializationCollisions(records)
  const safeParent = ensureSafeParent(destination)
  const { target } = safeParent
  const existingTarget = lstatIfPresent(target)
  if (existingTarget) {
    const status = existingTarget
    if (status.isSymbolicLink()) {
      throw new Error(`materialization destination is a symbolic link: ${target}`)
    }
    throw new Error(`materialization destination already exists: ${target}`)
  }
  assertDirectoryAncestry(
    safeParent.ancestry,
    'materialization parent ancestry',
  )
  assertDirectoryIdentity(
    safeParent.parent,
    safeParent.parentIdentity,
    'materialization parent',
  )
  const targetIdentity = createAnchoredDirectory(
    safeParent.parentIdentity,
    basename(target),
  )
  const directoryIdentities = new Map([['', targetIdentity]])

  for (const prefix of directoryPrefixes(records)) {
    const parent = directoryIdentities.get(parentPrefix(prefix))
    const identity = createAnchoredDirectory(
      parent,
      directPortableName(prefix),
    )
    directoryIdentities.set(prefix, identity)
  }

  const fileGroups = new Map()
  for (const record of records) {
    const prefix = parentPrefix(record.path)
    if (!fileGroups.has(prefix)) fileGroups.set(prefix, [])
    fileGroups.get(prefix).push(record)
  }
  for (const [prefix, group] of fileGroups) {
    writeAnchoredFiles(directoryIdentities.get(prefix), group)
  }

  const directories = [...directoryIdentities.entries()].sort(
    ([left], [right]) => {
      const depth = portableDepth(right) - portableDepth(left)
      return depth || comparePortablePaths(right, left)
    },
  )
  for (const [, directory] of directories) {
    runAnchoredMutation({
      action: 'chmod-directory',
      directory,
      mode: 0o755,
    })
  }
  return records.map((record) => ({
    ...record,
    bytes: Buffer.from(record.bytes),
  }))
}
