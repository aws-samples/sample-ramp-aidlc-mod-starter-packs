import { comparePortablePaths } from '../dependencies/checksum.js'
import { assertArtifactPath, RELEASE_LIMITS } from './entries.js'
import { sha256Hex } from './stable-json.js'

const MODES = new Map([
  [0o100644, '0644'],
  [0o100755, '0755'],
])
const MODEL_FIELDS = new Set(['bundleId', 'ownershipKey', 'version', 'files'])
const FILE_FIELDS = new Set(['path', 'bytes', 'mode', 'sha256', 'provenance'])
const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function plainObject(value, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(`${label} must be a plain object`)
  }
  return value
}

function ownData(value, name, label) {
  const descriptor = Object.getOwnPropertyDescriptor(value, name)
  if (!descriptor || descriptor.get || descriptor.set) {
    throw new Error(`${label}.${name} must be an own data property`)
  }
  return descriptor.value
}

function exactFields(value, allowed, label) {
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) throw new Error(`${label} has unknown field: ${name}`)
  }
}

function scalar(value, label, { segment = false } = {}) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    /[\0\t\r\n]/.test(value)
  ) {
    throw new Error(`${label} must be a non-empty canonical scalar`)
  }
  assertArtifactPath(value, label)
  if (segment && value.includes('/')) {
    throw new Error(`${label} must be one portable path segment`)
  }
  return value
}

function assertNoCollisions(files) {
  const folded = new Map()
  const exact = new Set()
  for (const file of files) {
    if (exact.has(file.path)) {
      throw new Error(`duplicate install path: ${file.path}`)
    }
    exact.add(file.path)
    const key = file.path.toLowerCase()
    const previous = folded.get(key)
    if (previous && previous !== file.path) {
      throw new Error(`case-colliding install paths: ${previous}, ${file.path}`)
    }
    folded.set(key, file.path)
  }
  // A case-insensitive filesystem would merge Dir/ and dir/ into one directory.
  const directories = new Map()
  for (const file of files) {
    let separator = file.path.indexOf('/')
    while (separator !== -1) {
      const directory = file.path.slice(0, separator)
      const previous = directories.get(directory.toLowerCase())
      if (previous !== undefined && previous !== directory) {
        throw new Error(`case-colliding install directories: ${previous}, ${directory}`)
      }
      directories.set(directory.toLowerCase(), directory)
      separator = file.path.indexOf('/', separator + 1)
    }
  }
  for (const [path, original] of folded) {
    let separator = path.indexOf('/')
    while (separator !== -1) {
      const ancestor = path.slice(0, separator)
      if (folded.has(ancestor)) {
        throw new Error(
          `file/directory install path collision: ${folded.get(ancestor)}, ${original}`,
        )
      }
      separator = path.indexOf('/', separator + 1)
    }
  }
}

function normalizeFile(value, index) {
  const file = plainObject(value, `files[${index}]`)
  exactFields(file, FILE_FIELDS, `files[${index}]`)
  const path = ownData(file, 'path', `files[${index}]`)
  if (typeof path !== 'string' || !path.startsWith('overlay/')) {
    throw new Error(`files[${index}].path must begin with overlay/`)
  }
  const relativePath = assertArtifactPath(
    path.slice('overlay/'.length),
    `files[${index}].path`,
  )
  const bytes = ownData(file, 'bytes', `files[${index}]`)
  if (!Buffer.isBuffer(bytes)) {
    throw new Error(`files[${index}].bytes must be a Buffer`)
  }
  if (bytes.length > RELEASE_LIMITS.fileBytes) {
    throw new Error(`files[${index}] exceeds the release file byte limit`)
  }
  const modeValue = ownData(file, 'mode', `files[${index}]`)
  const mode = MODES.get(modeValue)
  if (!mode) throw new Error(`unsupported install file mode: ${modeValue}`)
  const hash = sha256Hex(bytes)
  if (Object.hasOwn(file, 'sha256')) {
    const declared = ownData(file, 'sha256', `files[${index}]`)
    if (!/^[0-9a-f]{64}$/.test(declared) || declared !== hash) {
      throw new Error(`files[${index}].sha256 disagrees with captured bytes`)
    }
  }
  return { path: relativePath, sha256: hash, mode }
}

export function renderInstallManifest(model) {
  plainObject(model, 'model')
  exactFields(model, MODEL_FIELDS, 'model')
  const bundleId = scalar(ownData(model, 'bundleId', 'model'), 'bundleId', {
    segment: true,
  })
  const ownershipKey = scalar(
    ownData(model, 'ownershipKey', 'model'),
    'ownershipKey',
    { segment: true },
  )
  if (ownershipKey.startsWith('.')) {
    throw new Error('ownershipKey must not use a reserved dot-state name')
  }
  const version = scalar(ownData(model, 'version', 'model'), 'version', {
    segment: true,
  })
  if (!SEMVER.test(version)) throw new Error('version must be semantic version text')
  const inputFiles = ownData(model, 'files', 'model')
  if (!Array.isArray(inputFiles) || inputFiles.length === 0) {
    throw new Error('files must be a non-empty array')
  }
  if (inputFiles.length > RELEASE_LIMITS.bundleEntries) {
    throw new Error('files exceeds the release entry limit')
  }
  const files = inputFiles
    .map(normalizeFile)
    .sort((left, right) => comparePortablePaths(left.path, right.path))
  const totalBytes = inputFiles.reduce(
    (total, file) => total + ownData(file, 'bytes', 'file').length,
    0,
  )
  if (totalBytes > RELEASE_LIMITS.bundleBytes) {
    throw new Error('files exceed the release bundle byte limit')
  }
  assertNoCollisions(files)
  return [
    'RAMP-INSTALL-MANIFEST\t1',
    `bundle\t${bundleId}`,
    `owner\t${ownershipKey}`,
    `version\t${version}`,
    ...files.map((file) =>
      `file\t${file.sha256}\t${file.mode}\t${file.path}`),
    '',
  ].join('\n')
}
