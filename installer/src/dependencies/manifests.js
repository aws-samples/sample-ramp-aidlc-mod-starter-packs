import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import {
  assertPortableRelativePath,
  comparePortablePaths,
} from './checksum.js'

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMMIT = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
const SPDX_STYLE =
  /^[A-Za-z0-9][A-Za-z0-9.+-]*(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9][A-Za-z0-9.+-]*)*$/
const GITHUB_CLONE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git$/

const SOURCE_ROOT_FIELDS = new Set(['schemaVersion', 'sources'])
const SOURCE_FIELDS = new Set([
  'id',
  'repository',
  'priority',
  'license',
  'licensePath',
  'noticePath',
])
const LOCK_ROOT_FIELDS = new Set(['schemaVersion', 'skills'])
const LOCK_SKILL_FIELDS = new Set([
  'name',
  'source',
  'commit',
  'path',
  'treeSha256',
  'files',
  'license',
  'licensePath',
  'licenseFile',
  'noticePath',
  'noticeFile',
])
const NORMALIZED_LOCK_SKILL_FIELDS = new Set([
  ...LOCK_SKILL_FIELDS,
  'repository',
])
const LOCK_FILE_FIELDS = new Set([
  'path',
  'sha256',
  'size',
  'executable',
])
const RAMP_SKILL_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'name',
  'version',
  'license',
  'basedOn',
  'ownerPack',
])
const BASED_ON_FIELDS = new Set(['source', 'commit', 'path'])

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
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

function requirePattern(value, pattern, label) {
  requireString(value, label)
  if (!pattern.test(value)) throw new Error(`${label} has an invalid format`)
  return value
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field: ${key}`)
  }
}

function assertRequiredKeys(value, required, label) {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing required field: ${key}`)
    }
  }
}

function parseYamlFile(path, label) {
  let value
  try {
    value = parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${label} could not be loaded: ${error.message}`)
  }
  return requireObject(value, label)
}

function normalizeSource(source, index) {
  const label = `skills.sources.yaml source ${index}`
  requireObject(source, label)
  assertOnlyKeys(source, SOURCE_FIELDS, label)
  assertRequiredKeys(source, SOURCE_FIELDS, label)

  const id = requireIdentifier(source.id, `${label} id`)
  requireString(source.repository, `${label} repository`)
  const repositoryMatch = GITHUB_CLONE.exec(source.repository)
  if (
    !repositoryMatch ||
    repositoryMatch.slice(1).some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} repository must be an HTTPS GitHub clone URL ending in .git`)
  }
  const priority = requireSafeInteger(source.priority, `${label} priority`)
  const license = requirePattern(source.license, SPDX_STYLE, `${label} license`)
  const licensePath = assertPortableRelativePath(
    source.licensePath,
    `${label} licensePath`,
  )
  const noticePath = assertPortableRelativePath(
    source.noticePath,
    `${label} noticePath`,
  )

  return {
    id,
    repository: source.repository,
    priority,
    license,
    licensePath,
    noticePath,
  }
}

export function loadSkillSources(repoRoot) {
  const path = join(resolve(repoRoot), 'dependencies', 'skills.sources.yaml')
  const value = parseYamlFile(path, 'skills.sources.yaml')
  assertOnlyKeys(value, SOURCE_ROOT_FIELDS, 'skills.sources.yaml')
  assertRequiredKeys(value, SOURCE_ROOT_FIELDS, 'skills.sources.yaml')
  if (value.schemaVersion !== 1) {
    throw new Error(`skills.sources.yaml has unsupported schemaVersion: ${value.schemaVersion}`)
  }

  const seen = new Set()
  const sources = requireArray(value.sources, 'skills.sources.yaml sources')
    .map((source, index) => normalizeSource(source, index))
  for (const source of sources) {
    if (seen.has(source.id)) {
      throw new Error(`skills.sources.yaml has duplicate source id: ${source.id}`)
    }
    seen.add(source.id)
  }
  sources.sort((left, right) =>
    left.priority - right.priority ||
    comparePortablePaths(left.id, right.id))

  return {
    schemaVersion: 1,
    sources,
    byId: new Map(sources.map((source) => [source.id, source])),
  }
}

function normalizeFileRecord(file, label) {
  requireObject(file, label)
  assertOnlyKeys(file, LOCK_FILE_FIELDS, label)
  assertRequiredKeys(file, LOCK_FILE_FIELDS, label)
  return {
    path: assertPortableRelativePath(file.path, `${label} path`),
    sha256: requirePattern(file.sha256, SHA256, `${label} sha256`),
    size: requireSafeInteger(file.size, `${label} size`),
    executable:
      typeof file.executable === 'boolean'
        ? file.executable
        : (() => {
            throw new Error(`${label} executable must be boolean`)
          })(),
  }
}

function normalizeLockFile(file, index, skillName) {
  return normalizeFileRecord(
    file,
    `skills.lock.yaml skill ${skillName} file ${index}`,
  )
}

function sameFileRecord(left, right) {
  return LOCK_FILE_FIELDS.size === Object.keys(left).length &&
    [...LOCK_FILE_FIELDS].every((field) => left[field] === right[field])
}

function validateCompleteLock(skills) {
  const sourceFilesByGroup = new Map()
  const claimedTrees = new Map()
  const coordinatesByGroup = new Map()

  for (const skill of skills) {
    const group = `${skill.source}\0${skill.commit}`
    const priorSourceFiles = sourceFilesByGroup.get(group)
    if (priorSourceFiles) {
      for (const field of ['licenseFile', 'noticeFile']) {
        if (!sameFileRecord(priorSourceFiles[field], skill[field])) {
          throw new Error(
            `skills.lock.yaml source ${skill.source} commit ${skill.commit} ${field} records disagree`,
          )
        }
      }
    } else {
      sourceFilesByGroup.set(group, {
        licenseFile: { ...skill.licenseFile },
        noticeFile: { ...skill.noticeFile },
      })
    }

    const treeCoordinate = `${group}\0${skill.path}`
    const priorClaim = claimedTrees.get(treeCoordinate)
    if (priorClaim) {
      throw new Error(
        `skills.lock.yaml duplicate source/commit/path claim: ${skill.source} ${skill.commit} ${skill.path} (${priorClaim}, ${skill.name})`,
      )
    }
    claimedTrees.set(treeCoordinate, skill.name)

    let coordinates = coordinatesByGroup.get(group)
    if (!coordinates) {
      coordinates = new Map()
      coordinatesByGroup.set(group, coordinates)
    }
    const records = [
      skill.licenseFile,
      skill.noticeFile,
      ...skill.files.map((file) => ({
        ...file,
        path: assertPortableRelativePath(
          `${skill.path}/${file.path}`,
          `skills.lock.yaml skill ${skill.name} source coordinate`,
        ),
      })),
    ]
    for (const record of records) {
      const prior = coordinates.get(record.path)
      if (prior && !sameFileRecord(prior, record)) {
        throw new Error(
          `skills.lock.yaml conflicting source coordinate ${record.path} for ${skill.source} ${skill.commit}`,
        )
      }
      if (!prior) coordinates.set(record.path, { ...record })
    }
  }
}

function normalizeLockSkill(
  skill,
  index,
  sources,
  {
    allowRepository = false,
    requireRepository = false,
    requireSortedFiles = true,
  } = {},
) {
  const label = `skills.lock.yaml skill ${index}`
  requireObject(skill, label)
  assertOnlyKeys(
    skill,
    allowRepository ? NORMALIZED_LOCK_SKILL_FIELDS : LOCK_SKILL_FIELDS,
    label,
  )
  assertRequiredKeys(
    skill,
    requireRepository
      ? NORMALIZED_LOCK_SKILL_FIELDS
      : LOCK_SKILL_FIELDS,
    label,
  )

  const name = requireIdentifier(skill.name, `${label} name`)
  const sourceId = requireIdentifier(skill.source, `${label} source`)
  const source = sources.byId.get(sourceId)
  if (!source) throw new Error(`${label} source is not declared: ${sourceId}`)
  if (
    allowRepository &&
    skill.repository !== undefined &&
    skill.repository !== source.repository
  ) {
    throw new Error(`${label} repository does not match source ${sourceId}`)
  }

  const files = requireArray(skill.files, `${label} files`)
    .map((file, fileIndex) => normalizeLockFile(file, fileIndex, name))
  const seenFiles = new Set()
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const path = files[fileIndex].path
    if (seenFiles.has(path)) {
      throw new Error(`${label} has duplicate file path: ${path}`)
    }
    seenFiles.add(path)
    if (
      requireSortedFiles &&
      fileIndex > 0 &&
      comparePortablePaths(files[fileIndex - 1].path, path) >= 0
    ) {
      throw new Error(`${label} files must already be sorted by path`)
    }
  }
  if (!requireSortedFiles) {
    files.sort((left, right) => comparePortablePaths(left.path, right.path))
  }
  if (!files.some((file) => file.path === 'SKILL.md')) {
    throw new Error(`${label} file closure must include root SKILL.md`)
  }

  const license = requirePattern(skill.license, SPDX_STYLE, `${label} license`)
  const licensePath = assertPortableRelativePath(
    skill.licensePath,
    `${label} licensePath`,
  )
  const licenseFile = normalizeFileRecord(
    skill.licenseFile,
    `${label} licenseFile`,
  )
  const noticePath = assertPortableRelativePath(
    skill.noticePath,
    `${label} noticePath`,
  )
  const noticeFile = normalizeFileRecord(
    skill.noticeFile,
    `${label} noticeFile`,
  )
  if (license !== source.license) {
    throw new Error(`${label} license does not match source ${sourceId}`)
  }
  if (licensePath !== source.licensePath) {
    throw new Error(`${label} licensePath does not match source ${sourceId}`)
  }
  if (noticePath !== source.noticePath) {
    throw new Error(`${label} noticePath does not match source ${sourceId}`)
  }
  if (licenseFile.path !== licensePath) {
    throw new Error(`${label} licenseFile path does not match licensePath`)
  }
  if (noticeFile.path !== noticePath) {
    throw new Error(`${label} noticeFile path does not match noticePath`)
  }

  return {
    name,
    source: sourceId,
    repository: source.repository,
    commit: requirePattern(skill.commit, COMMIT, `${label} commit`),
    path: assertPortableRelativePath(skill.path, `${label} path`),
    treeSha256: requirePattern(
      skill.treeSha256,
      SHA256,
      `${label} treeSha256`,
    ),
    files,
    license,
    licensePath,
    licenseFile,
    noticePath,
    noticeFile,
  }
}

export function loadSkillLock(repoRoot, { required = false } = {}) {
  const root = resolve(repoRoot)
  const path = join(root, 'dependencies', 'skills.lock.yaml')
  let status
  try {
    status = lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (required) throw new Error(`required skill lock does not exist: ${path}`)
      return null
    }
    throw new Error(`skill lock path could not be inspected: ${error.message}`)
  }
  if (status.isSymbolicLink()) {
    throw new Error(`skill lock must be a regular file, not a symbolic link: ${path}`)
  }
  if (!status.isFile()) {
    throw new Error(`skill lock must be a regular file: ${path}`)
  }

  const value = parseYamlFile(path, 'skills.lock.yaml')
  assertOnlyKeys(value, LOCK_ROOT_FIELDS, 'skills.lock.yaml')
  assertRequiredKeys(value, LOCK_ROOT_FIELDS, 'skills.lock.yaml')
  if (value.schemaVersion !== 1) {
    throw new Error(`skills.lock.yaml has unsupported schemaVersion: ${value.schemaVersion}`)
  }

  const sources = loadSkillSources(root)
  const rawSkills = requireArray(value.skills, 'skills.lock.yaml skills')
  const skills = rawSkills.map((skill, index) =>
    normalizeLockSkill(skill, index, sources))
  const map = new Map()
  for (let index = 0; index < skills.length; index += 1) {
    const skill = skills[index]
    if (map.has(skill.name)) {
      throw new Error(`skills.lock.yaml has duplicate skill name: ${skill.name}`)
    }
    if (
      index > 0 &&
      comparePortablePaths(skills[index - 1].name, skill.name) >= 0
    ) {
      throw new Error('skills.lock.yaml skills must already be sorted by name')
    }
    map.set(skill.name, skill)
  }
  validateCompleteLock(skills)

  return {
    schemaVersion: 1,
    skills: map,
  }
}

export function writeSkillLock(repoRoot, normalizedLock) {
  requireObject(normalizedLock, 'normalized skill lock')
  assertOnlyKeys(normalizedLock, LOCK_ROOT_FIELDS, 'normalized skill lock')
  assertRequiredKeys(normalizedLock, LOCK_ROOT_FIELDS, 'normalized skill lock')
  if (normalizedLock.schemaVersion !== 1) {
    throw new Error(`normalized skill lock has unsupported schemaVersion: ${normalizedLock.schemaVersion}`)
  }
  if (!(normalizedLock.skills instanceof Map)) {
    throw new Error('normalized skill lock skills must be a Map')
  }

  const root = resolve(repoRoot)
  const sources = loadSkillSources(root)
  const skills = []
  let index = 0
  for (const [mapName, value] of normalizedLock.skills) {
    requireIdentifier(mapName, `normalized skill lock map key ${index}`)
    const skill = normalizeLockSkill(value, index, sources, {
      allowRepository: true,
      requireRepository: true,
      requireSortedFiles: false,
    })
    if (skill.name !== mapName) {
      throw new Error(`normalized skill lock map key ${mapName} does not match skill name ${skill.name}`)
    }
    skills.push(skill)
    index += 1
  }
  skills.sort((left, right) => comparePortablePaths(left.name, right.name))
  validateCompleteLock(skills)

  const serializable = {
    schemaVersion: 1,
    skills: skills.map((skill) => ({
      name: skill.name,
      source: skill.source,
      commit: skill.commit,
      path: skill.path,
      treeSha256: skill.treeSha256,
      files: skill.files.map((file) => ({
        path: file.path,
        sha256: file.sha256,
        size: file.size,
        executable: file.executable,
      })),
      license: skill.license,
      licensePath: skill.licensePath,
      licenseFile: {
        path: skill.licenseFile.path,
        sha256: skill.licenseFile.sha256,
        size: skill.licenseFile.size,
        executable: skill.licenseFile.executable,
      },
      noticePath: skill.noticePath,
      noticeFile: {
        path: skill.noticeFile.path,
        sha256: skill.noticeFile.sha256,
        size: skill.noticeFile.size,
        executable: skill.noticeFile.executable,
      },
    })),
  }
  const content = stringify(serializable, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  }).replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
  const path = join(root, 'dependencies', 'skills.lock.yaml')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  return path
}

function requireRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`)
  const status = lstatSync(path)
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${path}`)
  }
}

export function loadRampSkillMetadata(
  skillDir,
  { expectedName, ownerPack } = {},
) {
  const root = resolve(skillDir)
  const skillPath = join(root, 'SKILL.md')
  const metadataPath = join(root, 'skill.yaml')
  requireRegularFile(skillPath, 'SKILL.md')
  requireRegularFile(metadataPath, 'skill.yaml')

  const value = parseYamlFile(metadataPath, 'skill.yaml')
  assertOnlyKeys(value, RAMP_SKILL_FIELDS, 'skill.yaml')
  assertRequiredKeys(
    value,
    new Set(['schemaVersion', 'kind', 'name', 'version', 'license']),
    'skill.yaml',
  )
  if (value.schemaVersion !== 1) {
    throw new Error(`skill.yaml has unsupported schemaVersion: ${value.schemaVersion}`)
  }
  if (value.kind !== 'ramp-skill') {
    throw new Error(`skill.yaml kind must be ramp-skill`)
  }

  const name = requireIdentifier(value.name, 'skill.yaml name')
  if (expectedName !== undefined && name !== expectedName) {
    throw new Error(`skill.yaml name ${name} does not match expectedName ${expectedName}`)
  }
  const version = requirePattern(value.version, SEMVER, 'skill.yaml version')
  const license = requirePattern(value.license, SPDX_STYLE, 'skill.yaml license')

  let basedOn
  if (value.basedOn !== undefined) {
    const source = requireObject(value.basedOn, 'skill.yaml basedOn')
    assertOnlyKeys(source, BASED_ON_FIELDS, 'skill.yaml basedOn')
    assertRequiredKeys(source, BASED_ON_FIELDS, 'skill.yaml basedOn')
    basedOn = {
      source: requireIdentifier(source.source, 'skill.yaml basedOn source'),
      commit: requirePattern(
        source.commit,
        COMMIT,
        'skill.yaml basedOn commit',
      ),
      path: assertPortableRelativePath(
        source.path,
        'skill.yaml basedOn path',
      ),
    }
  }

  let normalizedOwnerPack
  if (ownerPack === undefined) {
    if (value.ownerPack !== undefined) {
      throw new Error('skill.yaml ownerPack is forbidden for RAMP-owned skills')
    }
  } else {
    requireIdentifier(ownerPack, 'expected ownerPack')
    normalizedOwnerPack = requireIdentifier(
      value.ownerPack,
      'skill.yaml ownerPack',
    )
    if (normalizedOwnerPack !== ownerPack) {
      throw new Error(`skill.yaml ownerPack ${normalizedOwnerPack} does not match ${ownerPack}`)
    }
  }

  return {
    schemaVersion: 1,
    kind: 'ramp-skill',
    name,
    version,
    license,
    ...(basedOn ? { basedOn } : {}),
    ...(normalizedOwnerPack ? { ownerPack: normalizedOwnerPack } : {}),
  }
}
