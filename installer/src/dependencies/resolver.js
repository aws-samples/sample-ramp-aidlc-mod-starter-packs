import { lstatSync, readFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import {
  comparePortablePaths,
  hashFileRecords,
  hashSkillTree,
} from './checksum.js'
import {
  loadRampSkillMetadata,
  loadSkillLock,
} from './manifests.js'

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  if (value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (value.includes('\0')) {
    throw new Error(`${label} must not contain NUL`)
  }
  return value
}

function requireIdentifier(value, label) {
  requireNonEmptyString(value, label)
  if (!IDENTIFIER.test(value)) {
    throw new Error(`${label} must be a lower-kebab identifier`)
  }
  return value
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`)
  return value
}

function requireDirectory(path, label) {
  let status
  try {
    status = lstatSync(path)
  } catch (error) {
    throw new Error(`${label} could not be inspected: ${error.message}`)
  }
  if (status.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link: ${path}`)
  }
  if (!status.isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`)
  }
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

function candidateAnchor(repoRoot, configuredRoot) {
  return isWithin(repoRoot, configuredRoot) ? repoRoot : configuredRoot
}

function inspectDirectoryCandidate(anchor, candidate, label) {
  const root = resolve(anchor)
  const target = resolve(candidate)
  if (!isWithin(root, target)) {
    throw new Error(`${label} escapes its trusted root: ${target}`)
  }

  const rootStatus = optionalStatus(root, `${label} trusted root`)
  if (rootStatus === null) return null
  if (rootStatus.isSymbolicLink()) {
    throw new Error(`${label} trusted root is a symbolic link: ${root}`)
  }
  if (!rootStatus.isDirectory()) {
    throw new Error(`${label} trusted root must be a directory: ${root}`)
  }

  const path = relative(root, target)
  if (path === '') return root
  let current = root
  for (const segment of path.split(/[\\/]/)) {
    current = join(current, segment)
    const status = optionalStatus(current, label)
    if (status === null) return null
    if (status.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic link: ${current}`)
    }
    if (!status.isDirectory()) {
      throw new Error(`${label} must be a directory: ${current}`)
    }
  }
  return target
}

function hasMetadata(directory) {
  const path = join(directory, 'skill.yaml')
  const status = optionalStatus(path, 'skill.yaml')
  if (status === null) return false
  if (status.isSymbolicLink()) {
    throw new Error(`skill.yaml must not be a symbolic link: ${path}`)
  }
  if (!status.isFile()) throw new Error(`skill.yaml must be a regular file: ${path}`)
  return true
}

function requireSkillMarkdown(directory) {
  const path = join(directory, 'SKILL.md')
  const status = optionalStatus(path, 'SKILL.md')
  if (status === null) throw new Error(`SKILL.md does not exist: ${path}`)
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`SKILL.md must be a regular file: ${path}`)
  }
}

function copyFiles(files) {
  return files.map((file) => ({ ...file }))
}

function copyBasedOn(basedOn) {
  return basedOn ? { ...basedOn } : undefined
}

function compareFileRecords(actual, expected, { compareExecutable = true } = {}) {
  if (actual.length !== expected.length) {
    return `file count ${actual.length} does not match locked count ${expected.length}`
  }
  for (let index = 0; index < expected.length; index += 1) {
    const left = actual[index]
    const right = expected[index]
    for (const field of ['path', 'sha256', 'size']) {
      if (left[field] !== right[field]) {
        return `file ${right.path} ${field} mismatch`
      }
    }
    if (compareExecutable && left.executable !== right.executable) {
      return `file ${right.path} executable mismatch`
    }
  }
  return null
}

// An in-tree upstream mirror may hold RAMP metadata as a root skill.yaml
// sidecar with origin: upstream. With allowSidecar, lock verification ignores
// exactly that one file; any other extra file, or a skill.yaml with another
// origin, still fails. Cache trees come from Git and never hold a sidecar.
function hasUpstreamSidecar(directory, name, expectedFiles) {
  if (expectedFiles.some((file) => file.path === 'skill.yaml')) return false
  if (!hasMetadata(directory)) return false
  const metadata = loadRampSkillMetadata(directory, {
    expectedName: name,
    allowedOrigins: ['upstream'],
  })
  return metadata.origin === 'upstream'
}

// Hashes a locked skill tree without its sidecar, so the result compares
// directly with the lock. The sidecar must still be an ordinary file.
function hashLockedTree(directory, { sidecar, executableByPath } = {}) {
  if (!sidecar) return hashSkillTree(directory, { executableByPath })
  const hashed = hashSkillTree(directory, {
    executableByPath: executableByPath &&
      new Map([...executableByPath, ['skill.yaml', false]]),
  })
  return hashFileRecords(
    hashed.files
      .filter((file) => file.path !== 'skill.yaml')
      .map((file) => ({
        path: file.path,
        bytes: readFileSync(join(directory, ...file.path.split('/'))),
        executable: file.executable,
      })),
  )
}

export function resolveCacheDir(options = {}) {
  const repoRoot = requireNonEmptyString(options.repoRoot, 'repoRoot')
  const hasExplicit = Object.prototype.hasOwnProperty.call(options, 'cacheDir')
  let selected

  if (hasExplicit) {
    selected = requireNonEmptyString(options.cacheDir, 'cacheDir')
  } else {
    const env = Object.prototype.hasOwnProperty.call(options, 'env')
      ? options.env
      : process.env.RAMP_SKILLS_CACHE
    if (env !== undefined && env !== null && typeof env !== 'string') {
      throw new Error('env must be a string, null, or undefined')
    }
    selected =
      typeof env === 'string' && env.trim() !== ''
        ? requireNonEmptyString(env, 'env')
        : null
  }

  return selected === null || selected === undefined
    ? join(resolve(repoRoot), '.ramp-cache', 'skills')
    : resolve(process.cwd(), selected)
}

export function verifyLockedSkillDirectory(
  directory,
  lockedSkill,
  { platform = process.platform, allowSidecar = false } = {},
) {
  requireNonEmptyString(directory, 'locked skill directory')
  if (!lockedSkill || typeof lockedSkill !== 'object' || Array.isArray(lockedSkill)) {
    throw new Error('locked skill must be an object')
  }
  const name = requireIdentifier(lockedSkill.name, 'locked skill name')
  if (!Array.isArray(lockedSkill.files)) {
    throw new Error(`locked skill ${name} files must be an array`)
  }
  requireNonEmptyString(platform, 'platform')

  const expectedFiles = copyFiles(lockedSkill.files)
    .sort((left, right) => comparePortablePaths(left.path, right.path))
  if (!expectedFiles.some((file) => file.path === 'SKILL.md')) {
    throw new Error(
      `locked skill ${name} file closure must include an ordinary SKILL.md`,
    )
  }
  try {
    requireSkillMarkdown(directory)
  } catch (error) {
    throw new Error(
      `locked skill ${name} at ${directory} failed SKILL.md verification: ${error.message}`,
    )
  }
  const executableByPath = new Map(
    expectedFiles.map((file) => [file.path, file.executable]),
  )

  requireBoolean(allowSidecar, 'allowSidecar')

  let sidecar = false
  try {
    sidecar = allowSidecar && hasUpstreamSidecar(directory, name, expectedFiles)
  } catch (error) {
    throw new Error(
      `locked skill ${name} at ${directory} has an invalid skill.yaml sidecar: ${error.message}`,
    )
  }

  let computed
  try {
    computed = hashLockedTree(directory, { sidecar, executableByPath })
  } catch (error) {
    throw new Error(
      `locked skill ${name} at ${directory} failed verification: ${error.message}`,
    )
  }
  const recordMismatch = compareFileRecords(computed.files, expectedFiles)
  if (recordMismatch) {
    throw new Error(
      `locked skill ${name} at ${directory} ${recordMismatch}`,
    )
  }
  if (computed.treeSha256 !== lockedSkill.treeSha256) {
    throw new Error(
      `locked skill ${name} at ${directory} tree checksum mismatch`,
    )
  }

  if (platform !== 'win32') {
    let actual
    try {
      actual = hashLockedTree(directory, { sidecar })
    } catch (error) {
      throw new Error(
        `locked skill ${name} at ${directory} failed POSIX mode verification: ${error.message}`,
      )
    }
    const contentMismatch = compareFileRecords(actual.files, expectedFiles, {
      compareExecutable: false,
    })
    if (contentMismatch) {
      throw new Error(
        `locked skill ${name} at ${directory} changed during verification: ${contentMismatch}`,
      )
    }
    for (let index = 0; index < expectedFiles.length; index += 1) {
      if (actual.files[index].executable !== expectedFiles[index].executable) {
        throw new Error(
          `locked skill ${name} at ${directory} executable mismatch for ${expectedFiles[index].path}`,
        )
      }
    }
  }

  return {
    treeSha256: lockedSkill.treeSha256,
    files: copyFiles(expectedFiles),
  }
}

function localTreeProvenance(directory) {
  const hashed = hashSkillTree(directory)
  return {
    treeSha256: hashed.treeSha256,
    files: copyFiles(hashed.files),
  }
}

function upstreamProvenance(lockedSkill) {
  return {
    kind: 'upstream',
    attribution: 'locked',
    name: lockedSkill.name,
    source: lockedSkill.source,
    repository: lockedSkill.repository,
    commit: lockedSkill.commit,
    path: lockedSkill.path,
    treeSha256: lockedSkill.treeSha256,
    files: copyFiles(lockedSkill.files),
    license: lockedSkill.license,
    licensePath: lockedSkill.licensePath,
    licenseFile: { ...lockedSkill.licenseFile },
    noticePath: lockedSkill.noticePath,
    noticeFile: { ...lockedSkill.noticeFile },
  }
}

function declaredProvenance(kind, metadata, hashed) {
  return {
    kind,
    attribution: 'declared',
    name: metadata.name,
    ...(metadata.ownerPack ? { ownerPack: metadata.ownerPack } : {}),
    version: metadata.version,
    license: metadata.license,
    treeSha256: hashed.treeSha256,
    files: copyFiles(hashed.files),
    ...(metadata.basedOn
      ? { basedOn: copyBasedOn(metadata.basedOn) }
      : {}),
  }
}

export function createSkillResolver(options = {}) {
  const repoRoot = resolve(requireNonEmptyString(options.repoRoot, 'repoRoot'))
  requireDirectory(repoRoot, 'repoRoot')
  const libraryDir = resolve(
    options.libraryDir === undefined
      ? join(repoRoot, 'skills-library')
      : requireNonEmptyString(options.libraryDir, 'libraryDir'),
  )
  const rampDir = resolve(
    options.rampDir === undefined
      ? join(repoRoot, 'skills', 'ramp')
      : requireNonEmptyString(options.rampDir, 'rampDir'),
  )
  const allowLegacyLocal =
    options.allowLegacyLocal === undefined
      ? true
      : requireBoolean(options.allowLegacyLocal, 'allowLegacyLocal')
  const strictProvenance =
    options.strictProvenance === undefined
      ? false
      : requireBoolean(options.strictProvenance, 'strictProvenance')
  const platform =
    options.platform === undefined
      ? process.platform
      : requireNonEmptyString(options.platform, 'platform')
  const cacheDir = resolveCacheDir({
    repoRoot,
    ...(Object.prototype.hasOwnProperty.call(options, 'cacheDir')
      ? { cacheDir: options.cacheDir }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(options, 'env')
      ? { env: options.env }
      : {}),
  })
  const lock = loadSkillLock(repoRoot)

  function resolveSkill(
    name,
    {
      packDir,
      packId = typeof packDir === 'string' ? basename(packDir) : undefined,
    } = {},
  ) {
    requireIdentifier(name, 'skill name')
    const packRoot = resolve(requireNonEmptyString(packDir, 'packDir'))
    requireIdentifier(packId, 'packId')
    requireDirectory(packRoot, 'packDir')

    const packCandidate = inspectDirectoryCandidate(
      packRoot,
      join(packRoot, 'skills', name),
      `pack override ${name}`,
    )
    if (packCandidate) {
      requireSkillMarkdown(packCandidate)
      const hashed = localTreeProvenance(packCandidate)
      if (hasMetadata(packCandidate)) {
        const value = loadRampSkillMetadata(packCandidate, {
          expectedName: name,
          ownerPack: packId,
        })
        return {
          directory: packCandidate,
          provenance: declaredProvenance('pack-override', value, hashed),
        }
      }
      if (strictProvenance) {
        throw new Error(
          `strict provenance requires ${join(packCandidate, 'skill.yaml')} with ownerPack: ${packId}`,
        )
      }
      return {
        directory: packCandidate,
        provenance: {
          kind: 'pack-override',
          attribution: 'legacy-unattributed',
          name,
          ownerPack: packId,
          ...hashed,
        },
      }
    }

    const rampCandidate = inspectDirectoryCandidate(
      candidateAnchor(repoRoot, rampDir),
      join(rampDir, name),
      `RAMP skill ${name}`,
    )
    if (rampCandidate) {
      const hashed = localTreeProvenance(rampCandidate)
      const value = loadRampSkillMetadata(rampCandidate, {
        expectedName: name,
      })
      return {
        directory: rampCandidate,
        provenance: declaredProvenance('ramp', value, hashed),
      }
    }

    const lockedSkill = lock?.skills.get(name)
    const mirrorCandidatePath = join(libraryDir, name)
    if (lockedSkill) {
      const cacheCandidatePath = join(
        cacheDir,
        'sources',
        lockedSkill.source,
        lockedSkill.commit,
        lockedSkill.path,
      )
      const cached = inspectDirectoryCandidate(
        cacheDir,
        cacheCandidatePath,
        `locked cache skill ${name}`,
      )
      if (cached) {
        try {
          verifyLockedSkillDirectory(cached, lockedSkill, { platform })
        } catch (error) {
          throw new Error(
            `locked cache skill ${name} failed verification: ${error.message}`,
          )
        }
        return {
          directory: cached,
          provenance: upstreamProvenance(lockedSkill),
        }
      }

      const mirror = inspectDirectoryCandidate(
        candidateAnchor(repoRoot, libraryDir),
        mirrorCandidatePath,
        `locked compatibility mirror ${name}`,
      )
      if (mirror) {
        try {
          verifyLockedSkillDirectory(mirror, lockedSkill, {
            platform,
            allowSidecar: true,
          })
        } catch (error) {
          throw new Error(
            `locked compatibility mirror ${name} failed verification: ${error.message}`,
          )
        }
        return {
          directory: mirror,
          provenance: upstreamProvenance(lockedSkill),
        }
      }

      throw new Error(
        [
          `locked skill ${name} is not available locally`,
          `cache: ${cacheCandidatePath}`,
          `compatibility mirror: ${mirrorCandidatePath}`,
          `run ramp-pack skills sync --locked --cache "${cacheDir}"`,
        ].join('; '),
      )
    }

    const legacy = inspectDirectoryCandidate(
      candidateAnchor(repoRoot, libraryDir),
      mirrorCandidatePath,
      `legacy skills-library skill ${name}`,
    )
    if (legacy) {
      if (strictProvenance) {
        throw new Error(
          `strict provenance rejects legacy-local skill ${name}: ${legacy}`,
        )
      }
      if (!allowLegacyLocal) {
        throw new Error(
          `legacy-local skill ${name} is not allowed by allowLegacyLocal`,
        )
      }
      requireSkillMarkdown(legacy)
      return {
        directory: legacy,
        provenance: {
          kind: 'legacy-local',
          attribution: 'legacy-unattributed',
          name,
          ...localTreeProvenance(legacy),
        },
      }
    }

    throw new Error(
      `skill ${name} not found in pack override, RAMP skills, locked cache, or skills-library`,
    )
  }

  return {
    cacheDir,
    resolveSkill,
  }
}
