import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const NUL = Buffer.from([0])

export function comparePortablePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function assertPortableRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty portable relative path`)
  }
  if (
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    value.includes('\\') ||
    /[\0\t\r\n]/.test(value)
  ) {
    throw new Error(`${label} must be a portable relative path: ${value}`)
  }

  const segments = value.split('/')
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`${label} must not contain empty or traversal segments: ${value}`)
  }
  return value
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function hashFileRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error('file records must be an array')
  }

  const seen = new Set()
  const normalized = records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`file record ${index} must be an object`)
    }
    const path = assertPortableRelativePath(record.path, `file record ${index} path`)
    if (seen.has(path)) throw new Error(`duplicate file record path: ${path}`)
    seen.add(path)
    if (
      !Buffer.isBuffer(record.bytes) &&
      !(record.bytes instanceof Uint8Array)
    ) {
      throw new Error(`file record ${path} bytes must be a Buffer or Uint8Array`)
    }
    if (typeof record.executable !== 'boolean') {
      throw new Error(`file record ${path} executable must be boolean`)
    }
    return {
      path,
      bytes: Buffer.from(record.bytes),
      executable: record.executable,
    }
  })

  normalized.sort((left, right) =>
    comparePortablePaths(left.path, right.path))

  const tree = createHash('sha256')
  const files = normalized.map((record) => {
    const size = record.bytes.length
    tree.update('file')
    tree.update(NUL)
    tree.update(record.path)
    tree.update(NUL)
    tree.update(record.executable ? 'x' : '-')
    tree.update(NUL)
    tree.update(String(size))
    tree.update(NUL)
    tree.update(record.bytes)
    tree.update(NUL)

    return {
      path: record.path,
      sha256: sha256(record.bytes),
      size,
      executable: record.executable,
    }
  })

  return {
    treeSha256: tree.digest('hex'),
    files,
  }
}

export function hashSkillTree(
  directory,
  { executableByPath } = {},
) {
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new Error('skill tree directory must be a non-empty path')
  }
  if (executableByPath !== undefined && !(executableByPath instanceof Map)) {
    throw new Error('executableByPath must be a Map')
  }

  if (executableByPath) {
    for (const [path, executable] of executableByPath) {
      assertPortableRelativePath(path, 'executableByPath path')
      if (typeof executable !== 'boolean') {
        throw new Error(`executableByPath value for ${path} must be boolean`)
      }
    }
  }

  const root = resolve(directory)
  const rootStatus = lstatSync(root)
  if (rootStatus.isSymbolicLink()) {
    throw new Error(`skill tree directory is a symbolic link: ${directory}`)
  }
  if (!rootStatus.isDirectory()) {
    throw new Error(`skill tree path is not a directory: ${directory}`)
  }

  const records = []
  const discovered = new Set()

  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      const status = lstatSync(absolute)
      const path = assertPortableRelativePath(
        relative(root, absolute).split(sep).join('/'),
        'skill tree file path',
      )

      if (status.isSymbolicLink()) {
        throw new Error(`skill tree contains a symbolic link: ${path}`)
      }
      if (status.isDirectory()) {
        visit(absolute)
        continue
      }
      if (!status.isFile()) {
        throw new Error(`skill tree contains an unsupported entry: ${path}`)
      }

      discovered.add(path)
      records.push({
        path,
        bytes: readFileSync(absolute),
        executable: executableByPath
          ? executableByPath.get(path)
          : Boolean(status.mode & 0o111),
      })
    }
  }

  visit(root)

  if (executableByPath) {
    const missing = [...discovered]
      .filter((path) => !executableByPath.has(path))
      .sort(comparePortablePaths)
    const extra = [...executableByPath.keys()]
      .filter((path) => !discovered.has(path))
      .sort(comparePortablePaths)
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `executableByPath path set mismatch; missing: ${missing.join(', ') || '<none>'}; extra: ${extra.join(', ') || '<none>'}`,
      )
    }
  }

  return hashFileRecords(records)
}
