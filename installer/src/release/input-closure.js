import { createHash } from 'node:crypto'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { readGitFile } from '../dependencies/git-snapshot.js'
import { comparePortablePaths } from '../dependencies/checksum.js'
import {
  assertArtifactPath,
  readOrdinaryFile,
} from './entries.js'

const COMMIT = /^[0-9a-f]{40}$/
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GITHUB_CLONE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git$/
const EXTERNAL_PROVENANCE_FIELDS = new Set([
  'attribution',
  'source',
  'repository',
  'commit',
])
const REPOSITORY_KINDS = new Set([
  'pack-manifest',
  'instruction',
  'workflow-overlay',
  'generator',
  'repository-license',
  'pack-override-skill',
  'ramp-skill',
  'dependency-manifest',
])
const EXTERNAL_KINDS = new Set([
  'upstream-skill',
  'upstream-license',
  'upstream-notice',
])

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    )
  }
  return value
}

function requireBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new Error(`${label} bytes must be a Buffer or Uint8Array`)
  }
  return Buffer.from(value)
}

function requireCommit(value, label) {
  if (typeof value !== 'string' || !COMMIT.test(value)) {
    throw new Error(`${label} must be a lowercase 40-character Git commit`)
  }
  return value
}

function ownEnumerableDataSnapshot(value, allowed, required, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${label} must be a plain object`)
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new Error(`${label} has unsupported field: ${String(key)}`)
    }
    const descriptor = descriptors[key]
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new Error(
        `${label} fields must be own enumerable data properties: ${key}`,
      )
    }
  }
  const snapshot = {}
  for (const key of required) {
    const descriptor = descriptors[key]
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      throw new Error(`${label} is missing required data field: ${key}`)
    }
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function assertOrdinaryAncestry(repoRoot, absolutePath, label) {
  const root = resolve(repoRoot)
  const candidate = resolve(absolutePath)
  const path = relative(root, candidate)
  if (
    path === '' ||
    path.startsWith('..') ||
    isAbsolute(path)
  ) {
    throw new Error(`${label} escapes repository root: ${absolutePath}`)
  }
  return {
    absolutePath: candidate,
    relativePath: assertArtifactPath(
      path.split(sep).join('/'),
      `${label} path`,
    ),
  }
}

function skillAnnotation(value) {
  if (value === undefined) return {}
  const allowed = new Set(['kind', 'name'])
  const snapshot = ownEnumerableDataSnapshot(
    value,
    allowed,
    allowed,
    'repository input provenance',
  )
  if (
    typeof snapshot.kind !== 'string' ||
    !['ramp', 'pack-override'].includes(snapshot.kind) ||
    typeof snapshot.name !== 'string' ||
    !IDENTIFIER.test(snapshot.name)
  ) {
    throw new Error(
      'repository input provenance requires a valid skill kind and lower-kebab name',
    )
  }
  return { kind: snapshot.kind, name: snapshot.name }
}

function lockedExternalProvenance(value) {
  const snapshot = ownEnumerableDataSnapshot(
    value,
    EXTERNAL_PROVENANCE_FIELDS,
    EXTERNAL_PROVENANCE_FIELDS,
    'external input provenance',
  )
  if (snapshot.attribution !== 'locked') {
    throw new Error('external input provenance attribution must be locked')
  }
  if (
    typeof snapshot.source !== 'string' ||
    !IDENTIFIER.test(snapshot.source)
  ) {
    throw new Error(
      'external input provenance source must be a lower-kebab identifier',
    )
  }
  if (typeof snapshot.repository !== 'string') {
    throw new Error('external input provenance repository must be a string')
  }
  const repositoryMatch = GITHUB_CLONE.exec(snapshot.repository)
  if (
    !repositoryMatch ||
    repositoryMatch.slice(1).some((segment) =>
      segment === '.' || segment === '..')
  ) {
    throw new Error(
      'external input provenance repository must be a canonical HTTPS GitHub clone URL',
    )
  }
  return {
    attribution: 'locked',
    source: snapshot.source,
    repository: snapshot.repository,
    commit: requireCommit(snapshot.commit, 'external input commit'),
  }
}

function stableIdentity(record) {
  const provenance = record.provenance
  return [
    record.path,
    record.sourceKind,
    provenance.attribution,
    provenance.source ?? '',
    provenance.commit ?? '',
    provenance.sourceCommit ?? '',
    provenance.callerSuppliedSourceCommit ?? '',
  ].join('\0')
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createInputClosure({
  repoRoot,
  sourceCommit,
  repositoryVerified,
  onFilesystemPhase,
} = {}) {
  if (typeof repoRoot !== 'string' || repoRoot === '') {
    throw new Error('repoRoot must be a non-empty path')
  }
  const root = resolve(repoRoot)
  const commit = requireCommit(sourceCommit, 'sourceCommit')
  if (typeof repositoryVerified !== 'boolean') {
    throw new Error('repositoryVerified must be boolean')
  }
  const records = new Map()
  const verifiers = new Map()

  function insert(record, verify) {
    const identity = stableIdentity(record)
    const existing = records.get(identity)
    if (existing) {
      if (!sameRecord(existing, record)) {
        throw new Error(`conflicting duplicate consumed input identity: ${record.path}`)
      }
      return
    }
    for (const value of records.values()) {
      if (
        value.path === record.path &&
        value.provenance.attribution === record.provenance.attribution &&
        value.provenance.source === record.provenance.source &&
        value.provenance.commit === record.provenance.commit &&
        value.sourceKind !== record.sourceKind
      ) {
        throw new Error(`conflicting duplicate consumed input path: ${record.path}`)
      }
    }
    records.set(identity, record)
    verifiers.set(identity, verify)
  }

  function recordRepositoryFile({
    absolutePath,
    role,
    bytes,
    provenance,
  } = {}) {
    if (!REPOSITORY_KINDS.has(role)) {
      throw new Error(`unsupported repository input role: ${role}`)
    }
    const captured = requireBytes(bytes, `repository input ${role}`)
    const inspected = assertOrdinaryAncestry(
      root,
      absolutePath,
      `repository input ${role}`,
    )
    const { bytes: workingBytes, status: workingStatus } = readOrdinaryFile(
      inspected.absolutePath,
      {
        label: `repository input ${role}`,
        trustedRoot: root,
        onPhase: onFilesystemPhase,
      },
    )
    if (!workingBytes.equals(captured)) {
      throw new Error(
        `repository input ${inspected.relativePath} working bytes changed after capture`,
      )
    }
    let authoritativeBytes = captured
    let executable = Boolean(workingStatus.mode & 0o111n)
    let sourceProvenance
    if (repositoryVerified) {
      let gitFile
      try {
        gitFile = readGitFile({
          repository: root,
          commit,
          path: inspected.relativePath,
        })
      } catch (error) {
        throw new Error(
          `repository input ${inspected.relativePath} could not be verified at commit ${commit}: ${error.message}`,
        )
      }
      if (
        gitFile.size !== captured.length ||
        !gitFile.bytes.equals(captured)
      ) {
        throw new Error(
          `repository input ${inspected.relativePath} bytes mismatch commit ${commit}`,
        )
      }
      if (
        process.platform !== 'win32' &&
        executable !== gitFile.executable
      ) {
        throw new Error(
          `repository input ${inspected.relativePath} executable mode mismatch commit ${commit}`,
        )
      }
      authoritativeBytes = gitFile.bytes
      executable = gitFile.executable
      sourceProvenance = {
        attribution: 'repository-verified',
        sourceCommit: commit,
      }
    } else {
      sourceProvenance = {
        attribution: 'caller-supplied',
        callerSuppliedSourceCommit: commit,
      }
    }
    const record = {
      path: inspected.relativePath,
      sourceKind: role,
      sha256: sha256(authoritativeBytes),
      size: authoritativeBytes.length,
      executable,
      provenance: {
        ...skillAnnotation(provenance),
        ...sourceProvenance,
      },
    }
    insert(record, () => {
      const current = readOrdinaryFile(inspected.absolutePath, {
        label: `repository input ${role}`,
        trustedRoot: root,
        onPhase: onFilesystemPhase,
      })
      if (
        !current.bytes.equals(captured) ||
        process.platform !== 'win32' &&
        Boolean(current.status.mode & 0o111n) !== executable
      ) {
        throw new Error(
          `repository input ${inspected.relativePath} changed after capture`,
        )
      }
    })
  }

  function recordExternalFile({
    absolutePath,
    path,
    sourceKind,
    executable,
    provenance,
    expectedRecord,
    bytes,
    trustedRoot,
  } = {}) {
    if (!EXTERNAL_KINDS.has(sourceKind)) {
      throw new Error(`unsupported external input sourceKind: ${sourceKind}`)
    }
    const logicalPath = assertArtifactPath(path, 'external input path')
    const lockedProvenance = lockedExternalProvenance(provenance)
    if (
      !expectedRecord ||
      expectedRecord.path !== logicalPath ||
      !/^[0-9a-f]{64}$/.test(expectedRecord.sha256 ?? '') ||
      !Number.isSafeInteger(expectedRecord.size) ||
      expectedRecord.size < 0 ||
      typeof expectedRecord.executable !== 'boolean'
    ) {
      throw new Error('external input requires a matching expectedRecord')
    }
    if (typeof executable !== 'boolean' || executable !== expectedRecord.executable) {
      throw new Error('external input executable does not match expectedRecord')
    }
    const captured = requireBytes(bytes, 'external locked input')
    const { bytes: current, status } = readOrdinaryFile(absolutePath, {
      label: 'external locked input',
      ...(trustedRoot === undefined ? {} : { trustedRoot }),
      onPhase: onFilesystemPhase,
    })
    if (
      captured.length !== expectedRecord.size ||
      sha256(captured) !== expectedRecord.sha256 ||
      !current.equals(captured)
    ) {
      throw new Error(`external locked input hash or size mismatch: ${logicalPath}`)
    }
    if (
      process.platform !== 'win32' &&
      Boolean(status.mode & 0o111n) !== expectedRecord.executable
    ) {
      throw new Error(`external locked input executable mode mismatch: ${logicalPath}`)
    }
    const record = {
      path: logicalPath,
      sourceKind,
      sha256: expectedRecord.sha256,
      size: expectedRecord.size,
      executable: expectedRecord.executable,
      provenance: lockedProvenance,
    }
    insert(record, () => {
      const current = readOrdinaryFile(absolutePath, {
        label: 'external locked input',
        ...(trustedRoot === undefined ? {} : { trustedRoot }),
        onPhase: onFilesystemPhase,
      })
      if (
        !current.bytes.equals(captured) ||
        process.platform !== 'win32' &&
        Boolean(current.status.mode & 0o111n) !== expectedRecord.executable
      ) {
        throw new Error(`external locked input changed after capture: ${logicalPath}`)
      }
    })
  }

  function finalize() {
    for (const verify of verifiers.values()) verify()
    return [...records.values()]
      .sort((left, right) =>
        comparePortablePaths(left.path, right.path) ||
        comparePortablePaths(left.sourceKind, right.sourceKind) ||
        comparePortablePaths(stableIdentity(left), stableIdentity(right)))
      .map((record) => cloneValue(record))
  }

  return {
    recordRepositoryFile,
    recordExternalFile,
    finalize,
  }
}
