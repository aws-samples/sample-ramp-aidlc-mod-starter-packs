import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  comparePortablePaths,
  hashFileRecords,
} from '../dependencies/checksum.js'

const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_TREE_BYTES = 64 * 1024 * 1024
const MAX_TREE_ENTRIES = 4096
const MAX_BUNDLE_ENTRIES = 16384
const MAX_BUNDLE_BYTES = 256 * 1024 * 1024
const MAX_PATH_BYTES = 1024
const MAX_SEGMENT_BYTES = 255
const MAX_DEPTH = 64
const WINDOWS_RESERVED =
  /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9])(?:\..*)?$/i
const PROHIBITED_COPY_SEGMENTS = new Set(['.git', 'node_modules', '.ds_store'])
// RAMP source metadata at a skill root. It never enters the overlay; the
// closure records it as a metadata input instead.
const SKILL_METADATA = 'skill.yaml'

export const RELEASE_LIMITS = Object.freeze({
  fileBytes: MAX_FILE_BYTES,
  treeBytes: MAX_TREE_BYTES,
  treeEntries: MAX_TREE_ENTRIES,
  bundleEntries: MAX_BUNDLE_ENTRIES,
  bundleBytes: MAX_BUNDLE_BYTES,
})

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

function asciiFold(value) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase())
}

function inspect(path, label) {
  try {
    return lstatSync(path, { bigint: true })
  } catch (error) {
    throw new Error(`${label} could not be inspected: ${error.message}`)
  }
}

function sameIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  )
}

function ancestrySnapshot(anchor, candidate, label, finalKind) {
  const root = resolve(anchor)
  const target = resolve(candidate)
  const path = relative(root, target)
  if (path.startsWith('..') || isAbsolute(path)) {
    throw new Error(`${label} escapes its trusted root: ${candidate}`)
  }
  const components = []
  let current = root
  const segments = path === '' ? [] : path.split(sep)
  for (let index = -1; index < segments.length; index += 1) {
    if (index >= 0) current = join(current, segments[index])
    const status = inspect(current, label)
    if (status.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic link: ${current}`)
    }
    const isFinal = index === segments.length - 1
    if (!isFinal || finalKind === 'directory') {
      if (!status.isDirectory()) {
        throw new Error(`${label} path component must be a directory: ${current}`)
      }
    } else if (!status.isFile()) {
      throw new Error(`${label} must be an ordinary file: ${current}`)
    }
    components.push({ path: current, status })
  }
  return { root, target, components }
}

function assertSameSnapshot(before, after, label) {
  if (before.components.length !== after.components.length) {
    throw new Error(`${label} ancestry changed during access`)
  }
  for (let index = 0; index < before.components.length; index += 1) {
    if (
      before.components[index].path !== after.components[index].path ||
      !sameIdentity(before.components[index].status, after.components[index].status)
    ) {
      throw new Error(`${label} path or ancestry changed during access`)
    }
  }
}

export function readOrdinaryFile(
  path,
  {
    label = 'file',
    trustedRoot,
    maxBytes = MAX_FILE_BYTES,
    onPhase,
  } = {},
) {
  const absolutePath = resolve(path)
  const anchor = trustedRoot === undefined
    ? resolve(absolutePath, '..')
    : resolve(trustedRoot)
  const before = ancestrySnapshot(anchor, absolutePath, label, 'file')
  const inspected = before.components.at(-1).status
  if (inspected.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds byte limit`)
  }
  onPhase?.({ phase: 'afterInspect', path: absolutePath })

  let descriptor
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    )
  } catch (error) {
    throw new Error(`${label} could not be opened as an ordinary file: ${error.message}`)
  }
  try {
    const opened = fstatSync(descriptor, { bigint: true })
    if (!opened.isFile() || !sameIdentity(inspected, opened)) {
      throw new Error(`${label} changed between inspection and open`)
    }
    onPhase?.({ phase: 'afterOpen', path: absolutePath, descriptor })
    const length = Number(opened.size)
    const bytes = Buffer.alloc(length)
    let offset = 0
    while (offset < length) {
      onPhase?.({
        phase: 'beforeRead',
        path: absolutePath,
        descriptor,
        offset,
        length,
      })
      const count = readSync(descriptor, bytes, offset, length - offset, offset)
      if (count === 0) throw new Error(`${label} ended before its inspected size`)
      offset += count
    }
    const extra = Buffer.alloc(1)
    if (readSync(descriptor, extra, 0, 1, length) !== 0) {
      throw new Error(`${label} grew during read`)
    }
    const afterRead = fstatSync(descriptor, { bigint: true })
    if (!sameIdentity(opened, afterRead)) {
      throw new Error(`${label} changed during read`)
    }
    onPhase?.({ phase: 'beforePathCheck', path: absolutePath, descriptor })
    const after = ancestrySnapshot(anchor, absolutePath, label, 'file')
    assertSameSnapshot(before, after, label)
    if (!sameIdentity(after.components.at(-1).status, afterRead)) {
      throw new Error(`${label} path no longer names the opened file`)
    }
    return {
      bytes: Buffer.from(bytes),
      status: afterRead,
    }
  } finally {
    closeSync(descriptor)
  }
}

export function assertArtifactPath(value, label = 'artifact path') {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${label} must be a non-empty path`)
  }
  if (
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith('\\\\') ||
    value.includes('\\') ||
    /[\0\t\r\n]/.test(value)
  ) {
    throw new Error(`${label} must be a portable relative path: ${value}`)
  }
  if (Buffer.byteLength(value) > MAX_PATH_BYTES) {
    throw new Error(`${label} exceeds the path length limit`)
  }
  const segments = value.split('/')
  if (segments.length > MAX_DEPTH) throw new Error(`${label} exceeds depth limit`)
  for (const segment of segments) {
    if (
      segment === '' ||
      segment === '.' ||
      segment === '..' ||
      segment.trim() !== segment
    ) {
      throw new Error(`${label} contains an unsafe path segment: ${value}`)
    }
    if (Buffer.byteLength(segment) > MAX_SEGMENT_BYTES) {
      throw new Error(`${label} contains an overlong path segment`)
    }
    for (const character of segment) {
      const code = character.codePointAt(0)
      if (code < 0x20 || code > 0x7e) {
        throw new Error(`${label} must contain printable ASCII only: ${value}`)
      }
    }
    if (
      WINDOWS_RESERVED.test(segment) ||
      /[<>:"|?*]/.test(segment) ||
      /[. ]$/.test(segment)
    ) {
      throw new Error(`${label} contains a Windows-unsafe segment: ${value}`)
    }
  }
  return value
}

function assertNoPathCollisions(entries, label = 'artifact entries') {
  const exact = new Set()
  const folded = new Map()
  const paths = entries.map((entry) =>
    assertArtifactPath(entry.path, `${label} path`))
  for (const path of paths) {
    if (exact.has(path)) throw new Error(`${label} duplicate path: ${path}`)
    exact.add(path)
    const foldedPath = asciiFold(path)
    const prior = folded.get(foldedPath)
    if (prior !== undefined) {
      throw new Error(`${label} ASCII case-fold collision: ${prior} and ${path}`)
    }
    folded.set(foldedPath, path)
  }
  const sorted = [...folded.keys()].sort(comparePortablePaths)
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (sorted[index + 1].startsWith(`${sorted[index]}/`)) {
      throw new Error(
        `${label} file-directory prefix collision: ` +
        `${folded.get(sorted[index])} and ${folded.get(sorted[index + 1])}`,
      )
    }
  }
}

function requireProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    throw new Error('copy operation requires release provenance')
  }
  const allowed =
    provenance.kind === 'upstream' &&
    provenance.attribution === 'locked' ||
    provenance.kind === 'ramp' &&
    provenance.attribution === 'declared' ||
    provenance.kind === 'pack-override' &&
    provenance.attribution === 'declared'
  if (!allowed) {
    throw new Error(
      `release rejects legacy or unattributed provenance for ${provenance.name ?? 'skill'}`,
    )
  }
  if (!Array.isArray(provenance.files) || provenance.files.length === 0) {
    throw new Error('release provenance files must be a non-empty array')
  }
  return provenance
}

function resolveLimits(overrides = {}) {
  const result = {}
  for (const [name, maximum] of Object.entries(RELEASE_LIMITS)) {
    const value = overrides[name] ?? maximum
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error(`release limit ${name} must be an integer from 0 to ${maximum}`)
    }
    result[name] = value
  }
  return result
}

function listTree(root, { limits, onFilesystemPhase } = {}) {
  const rootSnapshot = ancestrySnapshot(root, root, 'copy source root', 'directory')
  const files = []
  let totalBytes = 0
  let totalEntries = 0

  function visit(directory) {
    const directoryBefore = ancestrySnapshot(
      root,
      directory,
      'copy source directory',
      'directory',
    )
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => comparePortablePaths(left.name, right.name))
    onFilesystemPhase?.({
      phase: 'afterDirectoryRead',
      path: directory,
      entries: entries.map((entry) => entry.name),
    })
    for (const entry of entries) {
      totalEntries += 1
      if (totalEntries > limits.treeEntries) {
        throw new Error(`copy source tree exceeds ${limits.treeEntries}-entry limit`)
      }
      const absolutePath = join(directory, entry.name)
      const status = lstatSync(absolutePath)
      const path = relative(root, absolutePath).split(sep).join('/')
      assertArtifactPath(path, 'copy source path')
      const prohibited = path.split('/').find((segment) =>
        PROHIBITED_COPY_SEGMENTS.has(asciiFold(segment)))
      if (prohibited) {
        throw new Error(
          `prohibited release copy content violates exact provenance: ${path}`,
        )
      }
      if (status.isSymbolicLink()) {
        throw new Error(`copy source contains a symbolic link: ${path}`)
      }
      if (status.isDirectory()) {
        visit(absolutePath)
        continue
      }
      if (!status.isFile()) {
        throw new Error(`copy source contains a non-regular special file: ${path}`)
      }
      const { bytes, status: stableStatus } = readOrdinaryFile(absolutePath, {
        label: `copy source file ${path}`,
        trustedRoot: root,
        maxBytes: limits.fileBytes,
        onPhase: onFilesystemPhase,
      })
      totalBytes += bytes.length
      if (totalBytes > limits.treeBytes) {
        throw new Error(`copy source tree exceeds ${limits.treeBytes}-byte limit`)
      }
      files.push({
        absolutePath,
        path,
        bytes,
        filesystemExecutable: Boolean(stableStatus.mode & 0o111n),
      })
    }
    const directoryAfter = ancestrySnapshot(
      root,
      directory,
      'copy source directory',
      'directory',
    )
    assertSameSnapshot(directoryBefore, directoryAfter, 'copy source directory')
  }
  visit(root)
  const rootAfter = ancestrySnapshot(root, root, 'copy source root', 'directory')
  assertSameSnapshot(rootSnapshot, rootAfter, 'copy source root')
  // Full-path order, as in the provenance list; per-directory order puts a/ before a-b/.
  return files.sort((left, right) => comparePortablePaths(left.path, right.path))
}

function normalizedExpectedFiles(provenance) {
  const seen = new Set()
  const files = provenance.files.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`provenance file ${index} must be an object`)
    }
    const path = assertArtifactPath(record.path, `provenance file ${index}`)
    if (seen.has(path)) throw new Error(`duplicate provenance file path: ${path}`)
    seen.add(path)
    if (
      !/^[0-9a-f]{64}$/.test(record.sha256 ?? '') ||
      !Number.isSafeInteger(record.size) ||
      record.size < 0 ||
      typeof record.executable !== 'boolean'
    ) {
      throw new Error(`invalid provenance file record: ${path}`)
    }
    return {
      path,
      sha256: record.sha256,
      size: record.size,
      executable: record.executable,
    }
  }).sort((left, right) => comparePortablePaths(left.path, right.path))
  assertNoPathCollisions(files, 'provenance files')
  return files
}

function recordSkillMetadata(recordInput, provenance, source) {
  recordInput({
    kind: 'repository',
    absolutePath: source.absolutePath,
    role: 'skill-metadata',
    bytes: Buffer.from(source.bytes),
    // Repository input provenance names RAMP-declared skills only; the path of
    // an upstream sidecar already names its skill.
    ...(provenance.kind === 'upstream'
      ? {}
      : { provenance: { kind: provenance.kind, name: provenance.name } }),
  })
}

function collectCopy(operation, recordInput, options) {
  const provenance = requireProvenance(operation.provenance)
  if (typeof operation.content !== 'string' || operation.content === '') {
    throw new Error('copy operation content must be a source directory')
  }
  const root = resolve(operation.content)
  const listed = listTree(root, options)
  if (!/^[0-9a-f]{64}$/.test(provenance.treeSha256 ?? '')) {
    throw new Error('release provenance tree checksum must be SHA-256')
  }
  const expected = normalizedExpectedFiles(provenance)
  // An upstream mirror may hold a skill.yaml sidecar outside its locked tree.
  const sidecar = provenance.kind === 'upstream' &&
    !expected.some((record) => record.path === SKILL_METADATA)
    ? listed.find((source) => source.path === SKILL_METADATA)
    : undefined
  const actual = listed.filter((source) => source !== sidecar)
  if (actual.length !== expected.length) {
    throw new Error(
      `copy source provenance drift: file count ${actual.length} ` +
      `does not match expected ${expected.length}`,
    )
  }
  // The provenance files and treeSha256 describe the source skill tree,
  // skill.yaml included, while the overlay leaves skill.yaml out.
  const outputProvenance = {
    ...cloneValue(provenance),
    files: cloneValue(expected),
  }

  const hashRecords = []
  const outputs = []
  for (let index = 0; index < expected.length; index += 1) {
    const source = actual[index]
    const record = expected[index]
    if (source.path !== record.path) {
      throw new Error(
        `copy source path mismatch: ${source.path} !== ${record.path}`,
      )
    }
    if (
      source.bytes.length !== record.size ||
      sha256(source.bytes) !== record.sha256
    ) {
      throw new Error(`copy source hash or size mismatch: ${record.path}`)
    }
    if (
      process.platform !== 'win32' &&
      source.filesystemExecutable !== record.executable
    ) {
      throw new Error(`copy source executable mode mismatch: ${record.path}`)
    }
    hashRecords.push({
      path: record.path,
      bytes: source.bytes,
      executable: record.executable,
    })
    if (record.path === SKILL_METADATA) {
      if (recordInput) recordSkillMetadata(recordInput, provenance, source)
      continue
    }
    const outputPath = `${assertArtifactPath(operation.path, 'plan path')}/${record.path}`
    outputs.push({
      path: assertArtifactPath(outputPath, 'copy output path'),
      bytes: Buffer.from(source.bytes),
      mode: record.executable ? 0o100755 : 0o100644,
      provenance: cloneValue(outputProvenance),
    })
    if (recordInput) {
      if (provenance.kind === 'upstream') {
        recordInput({
          kind: 'external',
          absolutePath: source.absolutePath,
          path: `${provenance.path}/${record.path}`,
          sourceKind: 'upstream-skill',
          executable: record.executable,
          provenance: {
            attribution: 'locked',
            source: provenance.source,
            repository: provenance.repository,
            commit: provenance.commit,
          },
          expectedRecord: {
            path: `${provenance.path}/${record.path}`,
            sha256: record.sha256,
            size: record.size,
            executable: record.executable,
          },
          bytes: Buffer.from(source.bytes),
          trustedRoot: root,
        })
      } else {
        recordInput({
          kind: 'repository',
          absolutePath: source.absolutePath,
          role: provenance.kind === 'ramp'
            ? 'ramp-skill'
            : 'pack-override-skill',
          bytes: Buffer.from(source.bytes),
          provenance: {
            kind: provenance.kind,
            name: provenance.name,
          },
        })
      }
    }
  }
  if (hashFileRecords(hashRecords).treeSha256 !== provenance.treeSha256) {
    throw new Error(`copy source tree checksum mismatch for ${provenance.name}`)
  }
  if (sidecar && recordInput) recordSkillMetadata(recordInput, provenance, sidecar)
  return outputs
}

export function collectPlanEntries(
  plan,
  { recordInput, limits: limitOverrides, onFilesystemPhase } = {},
) {
  if (!Array.isArray(plan)) throw new Error('plan must be an array')
  if (recordInput !== undefined && typeof recordInput !== 'function') {
    throw new Error('recordInput must be a function')
  }
  const limits = resolveLimits(limitOverrides)
  const entries = []
  let totalBytes = 0
  for (const operation of plan) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      throw new Error('plan operation must be an object')
    }
    const path = assertArtifactPath(operation.path, 'plan path')
    if (operation.kind === 'text') {
      if (typeof operation.content !== 'string') {
        throw new Error(`text operation content must be a string: ${path}`)
      }
      const bytes = Buffer.from(operation.content, 'utf8')
      if (bytes.length > limits.fileBytes) {
        throw new Error(`text operation exceeds ${limits.fileBytes}-byte limit: ${path}`)
      }
      entries.push({
        path,
        bytes,
        mode: 0o100644,
        provenance: null,
      })
    } else if (operation.kind === 'copy') {
      entries.push(...collectCopy(operation, recordInput, {
        limits,
        onFilesystemPhase,
      }))
    } else {
      throw new Error(`unsupported plan operation kind: ${operation.kind}`)
    }
    if (entries.length > limits.bundleEntries) {
      throw new Error(`release plan exceeds ${limits.bundleEntries}-entry limit`)
    }
    totalBytes = entries.reduce((sum, entry) => sum + entry.bytes.length, 0)
    if (totalBytes > limits.bundleBytes) {
      throw new Error(`release plan exceeds ${limits.bundleBytes}-byte limit`)
    }
  }
  assertNoPathCollisions(entries)
  return entries
    .sort((left, right) => comparePortablePaths(left.path, right.path))
    .map((entry) => ({
      ...entry,
      bytes: Buffer.from(entry.bytes),
      provenance: entry.provenance ? cloneValue(entry.provenance) : null,
    }))
}
