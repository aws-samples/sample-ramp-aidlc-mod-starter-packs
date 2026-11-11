import { createHash } from 'node:crypto'
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import yazl from 'yazl'
import { comparePortablePaths } from '../dependencies/checksum.js'
import { assertArtifactPath } from './entries.js'

const FILE_MODES = new Set([0o100644, 0o100755])
const MIN_DOS_TIME = Date.UTC(1980, 0, 1)
const MAX_DOS_TIME = Date.UTC(2107, 11, 31, 23, 59, 58)

function asciiFold(value) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase())
}

function requireMtime(mtime) {
  if (!(mtime instanceof Date) || Number.isNaN(mtime.getTime())) {
    throw new Error('ZIP mtime must be a valid Date')
  }
  const time = mtime.getTime()
  if (time < MIN_DOS_TIME || time > MAX_DOS_TIME) {
    throw new Error('ZIP mtime must fall within the DOS range 1980-2107')
  }
  return mtime
}

// yazl derives DOS timestamps from local-time fields. Build a Date whose local
// fields equal the UTC fields so TZ never reaches the archive bytes.
function dosLocalDate(mtime) {
  const local = new Date(
    mtime.getUTCFullYear(),
    mtime.getUTCMonth(),
    mtime.getUTCDate(),
    mtime.getUTCHours(),
    mtime.getUTCMinutes(),
    mtime.getUTCSeconds(),
  )
  if (
    local.getFullYear() !== mtime.getUTCFullYear() ||
    local.getMonth() !== mtime.getUTCMonth() ||
    local.getDate() !== mtime.getUTCDate() ||
    local.getHours() !== mtime.getUTCHours() ||
    local.getMinutes() !== mtime.getUTCMinutes() ||
    local.getSeconds() !== mtime.getUTCSeconds()
  ) {
    throw new Error(
      'ZIP mtime falls in a local daylight-saving gap; rebuild with TZ=UTC',
    )
  }
  return local
}

function normalizedEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('ZIP requires at least one entry')
  }
  const normalized = entries.map((entry) => {
    const path = assertArtifactPath(entry?.path, 'ZIP entry path')
    if (!Buffer.isBuffer(entry.bytes)) {
      throw new Error(`ZIP entry bytes must be a Buffer: ${path}`)
    }
    if (!FILE_MODES.has(entry.mode)) {
      throw new Error(`ZIP entry mode must be 0100644 or 0100755: ${path}`)
    }
    return { path, bytes: Buffer.from(entry.bytes), mode: entry.mode }
  }).sort((left, right) => comparePortablePaths(left.path, right.path))

  const roots = new Set()
  const folded = new Map()
  for (const entry of normalized) {
    const segments = entry.path.split('/')
    if (segments.length < 2) {
      throw new Error(`ZIP entry must live under one top-level directory: ${entry.path}`)
    }
    roots.add(segments[0])
    const key = asciiFold(entry.path)
    const prior = folded.get(key)
    if (prior === entry.path) throw new Error(`ZIP duplicate entry path: ${entry.path}`)
    if (prior !== undefined) {
      throw new Error(`ZIP entry ASCII case-fold collision: ${prior} and ${entry.path}`)
    }
    folded.set(key, entry.path)
  }
  if (roots.size !== 1) {
    throw new Error('ZIP entries must share exactly one top-level directory')
  }
  const keys = [...folded.keys()].sort(comparePortablePaths)
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (keys[index + 1].startsWith(`${keys[index]}/`)) {
      throw new Error(
        `ZIP entry file-directory prefix collision: ${folded.get(keys[index])}`,
      )
    }
  }
  return normalized
}

export async function encodeDeterministicZip(entries, { mtime } = {}) {
  const sorted = normalizedEntries(entries)
  const date = dosLocalDate(requireMtime(mtime))
  const zip = new yazl.ZipFile()
  for (const entry of sorted) {
    zip.addBuffer(entry.bytes, entry.path, {
      mtime: date,
      mode: entry.mode,
      compress: false,
      forceDosTimestamp: true,
    })
  }
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    zip.outputStream.on('data', (chunk) => chunks.push(chunk))
    zip.outputStream.on('error', reject)
    zip.outputStream.on('end', () => resolvePromise(Buffer.concat(chunks)))
    zip.end()
  })
}

export async function writeDeterministicZip(entries, outFile, options = {}) {
  const bytes = await encodeDeterministicZip(entries, options)
  // The temporary name stays beside the target and never enters the archive.
  const temporary = join(dirname(outFile), `.${basename(outFile)}.${process.pid}.tmp`)
  try {
    writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o644 })
    renameSync(temporary, outFile)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
  return {
    path: outFile,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
  }
}
