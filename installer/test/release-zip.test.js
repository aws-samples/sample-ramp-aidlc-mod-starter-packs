import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import yauzl from 'yauzl'
import {
  encodeDeterministicZip,
  writeDeterministicZip,
} from '../src/release/zip.js'

const roots = []
const MTIME = new Date('2026-11-05T04:00:00.000Z')
const ENTRIES = [
  { path: 'demo--kiro--v1.0.0/README-FIRST.md', bytes: Buffer.from('# Read me\n'), mode: 0o100644 },
  { path: 'demo--kiro--v1.0.0/install.sh', bytes: Buffer.from('#!/bin/sh\nexit 0\n'), mode: 0o100755 },
  { path: 'demo--kiro--v1.0.0/overlay/.kiro/steering/a.md', bytes: Buffer.from('steering\n'), mode: 0o100644 },
  { path: 'demo--kiro--v1.0.0/overlay/.kiro/skills/demo/scripts/run.sh', bytes: Buffer.from('#!/bin/sh\n'), mode: 0o100755 },
  { path: 'demo--kiro--v1.0.0/overlay/.mcp.json', bytes: Buffer.from('{}\n'), mode: 0o100644 },
]

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ramp-release-zip-'))
  roots.push(root)
  return root
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function withTimezone(tz, operation) {
  const previous = process.env.TZ
  process.env.TZ = tz
  try {
    return operation()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

function readZip(bytes) {
  return new Promise((resolvePromise, reject) => {
    yauzl.fromBuffer(
      bytes,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error) return reject(error)
        const entries = []
        zip.on('error', reject)
        zip.on('end', () => resolvePromise(entries))
        zip.on('entry', (entry) => {
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError) return reject(streamError)
            const chunks = []
            stream.on('data', (chunk) => chunks.push(chunk))
            stream.on('error', reject)
            stream.on('end', () => {
              entries.push({
                path: entry.fileName,
                bytes: Buffer.concat(chunks),
                mode: entry.externalFileAttributes >>> 16,
                compressionMethod: entry.compressionMethod,
                utf8: Boolean(entry.generalPurposeBitFlag & 0x800),
                extraFields: entry.extraFields.length,
                dosDate: entry.lastModFileDate,
                dosTime: entry.lastModFileTime,
              })
              zip.readEntry()
            })
          })
        })
        zip.readEntry()
      },
    )
  })
}

describe('deterministic ZIP encoding', () => {
  it('writes sorted, stored, UTF-8 flagged entries with exact bytes and modes', async () => {
    const archive = await encodeDeterministicZip([...ENTRIES].reverse(), { mtime: MTIME })
    const read = await readZip(archive)

    expect(read.map((entry) => entry.path)).toEqual(
      ENTRIES.map((entry) => entry.path).sort(),
    )
    for (const entry of read) {
      const expected = ENTRIES.find((candidate) => candidate.path === entry.path)
      expect(entry.bytes.equals(expected.bytes)).toBe(true)
      expect(entry.mode).toBe(expected.mode)
      expect(entry.compressionMethod).toBe(0)
      expect(entry.utf8).toBe(true)
      expect(entry.extraFields).toBe(0)
    }
    expect(read.some((entry) => entry.path.includes('/.kiro/'))).toBe(true)
    expect(read.some((entry) => entry.path.endsWith('/.mcp.json'))).toBe(true)
  })

  it('produces identical bytes regardless of entry order and timezone', async () => {
    const first = await withTimezone('UTC', () =>
      encodeDeterministicZip(ENTRIES, { mtime: MTIME }))
    const shuffled = [ENTRIES[3], ENTRIES[0], ENTRIES[4], ENTRIES[2], ENTRIES[1]]
    const second = await withTimezone('Pacific/Chatham', () =>
      encodeDeterministicZip(shuffled, { mtime: MTIME }))
    const third = await withTimezone('America/New_York', () =>
      encodeDeterministicZip(ENTRIES, { mtime: MTIME }))

    expect(sha256(second)).toBe(sha256(first))
    expect(third.equals(first)).toBe(true)
  })

  it('stores the UTC build time as the DOS timestamp of every entry', async () => {
    const archive = await withTimezone('Asia/Kolkata', () =>
      encodeDeterministicZip(ENTRIES, { mtime: MTIME }))
    const read = await readZip(archive)
    // 2026-11-05 04:00:00 UTC
    const dosDate = ((2026 - 1980) << 9) | (11 << 5) | 5
    const dosTime = 4 << 11
    for (const entry of read) {
      expect(entry.dosDate).toBe(dosDate)
      expect(entry.dosTime).toBe(dosTime)
    }
  })

  it('changes the archive checksum when one byte changes', async () => {
    const original = await encodeDeterministicZip(ENTRIES, { mtime: MTIME })
    const changed = ENTRIES.map((entry, index) =>
      index === 2 ? { ...entry, bytes: Buffer.from('steerinG\n') } : entry)
    const archive = await encodeDeterministicZip(changed, { mtime: MTIME })

    expect(sha256(archive)).not.toBe(sha256(original))
  })

  it('does not mutate caller entries', async () => {
    const entries = ENTRIES.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }))
    const order = entries.map((entry) => entry.path)
    await encodeDeterministicZip(entries, { mtime: MTIME })
    expect(entries.map((entry) => entry.path)).toEqual(order)
  })

  it.each([
    ['../escape.txt', 'traversal'],
    ['root/../escape.txt', 'inner traversal'],
    ['/absolute.txt', 'absolute'],
    ['C:/drive.txt', 'drive letter'],
    ['root\\windows.txt', 'backslash'],
    ['root/tab\tname', 'tab'],
    ['root/new\nline', 'newline'],
    ['root/caf\u00e9.md', 'non-ASCII'],
    ['root//empty.md', 'empty segment'],
    ['root/dir/', 'directory'],
  ])('rejects unsafe entry path %s (%s)', async (path) => {
    await expect(encodeDeterministicZip(
      [{ path, bytes: Buffer.from('x'), mode: 0o100644 }],
      { mtime: MTIME },
    )).rejects.toThrow()
  })

  it('rejects duplicate and case-fold colliding paths', async () => {
    const entry = { path: 'root/a.md', bytes: Buffer.from('a'), mode: 0o100644 }
    await expect(encodeDeterministicZip([entry, { ...entry }], { mtime: MTIME }))
      .rejects.toThrow(/duplicate/)
    await expect(encodeDeterministicZip(
      [entry, { ...entry, path: 'root/A.md' }],
      { mtime: MTIME },
    )).rejects.toThrow(/case-fold/)
  })

  it('rejects a file that would also be a directory prefix', async () => {
    await expect(encodeDeterministicZip([
      { path: 'root/a', bytes: Buffer.from('a'), mode: 0o100644 },
      { path: 'root/a/b', bytes: Buffer.from('b'), mode: 0o100644 },
    ], { mtime: MTIME })).rejects.toThrow(/prefix/)
  })

  it('rejects entries outside one top-level directory', async () => {
    await expect(encodeDeterministicZip([
      { path: 'one/a.md', bytes: Buffer.from('a'), mode: 0o100644 },
      { path: 'two/b.md', bytes: Buffer.from('b'), mode: 0o100644 },
    ], { mtime: MTIME })).rejects.toThrow(/top-level/)
    await expect(encodeDeterministicZip([
      { path: 'loose.md', bytes: Buffer.from('a'), mode: 0o100644 },
    ], { mtime: MTIME })).rejects.toThrow(/top-level/)
  })

  it.each([
    [0o100666],
    [0o120777],
    [0o40755],
    [undefined],
  ])('rejects non-normalized mode %s', async (mode) => {
    await expect(encodeDeterministicZip(
      [{ path: 'root/a.md', bytes: Buffer.from('a'), mode }],
      { mtime: MTIME },
    )).rejects.toThrow(/mode/)
  })

  it('rejects non-buffer bytes, empty input, and invalid mtimes', async () => {
    await expect(encodeDeterministicZip(
      [{ path: 'root/a.md', bytes: 'text', mode: 0o100644 }],
      { mtime: MTIME },
    )).rejects.toThrow(/bytes/)
    await expect(encodeDeterministicZip([], { mtime: MTIME })).rejects.toThrow(/at least one/)
    for (const mtime of [
      undefined,
      '2026-11-05T04:00:00.000Z',
      new Date('invalid'),
      new Date('1979-12-31T23:59:59.000Z'),
      new Date('2108-01-01T00:00:00.000Z'),
    ]) {
      await expect(encodeDeterministicZip(ENTRIES, { mtime })).rejects.toThrow(/mtime/)
    }
  })
})

describe('deterministic ZIP files', () => {
  it('writes the exact encoded bytes without leaving temporary files', async () => {
    const root = tempRoot()
    const outFile = join(root, 'demo.zip')
    const result = await writeDeterministicZip(ENTRIES, outFile, { mtime: MTIME })
    const expected = await encodeDeterministicZip(ENTRIES, { mtime: MTIME })
    const written = readFileSync(outFile)

    expect(written.equals(expected)).toBe(true)
    expect(result).toEqual({ path: outFile, sha256: sha256(expected), size: expected.length })
    expect(readdirSync(root)).toEqual(['demo.zip'])
  })

  it('replaces a previous archive atomically', async () => {
    const root = tempRoot()
    const outFile = join(root, 'demo.zip')
    await writeDeterministicZip(ENTRIES, outFile, { mtime: MTIME })
    const changed = [{ ...ENTRIES[0], bytes: Buffer.from('changed\n') }]
    const result = await writeDeterministicZip(changed, outFile, { mtime: MTIME })

    expect(sha256(readFileSync(outFile))).toBe(result.sha256)
    expect(readdirSync(root)).toEqual(['demo.zip'])
  })

  it('leaves no file behind when encoding fails', async () => {
    const root = tempRoot()
    await expect(writeDeterministicZip(
      [{ path: '../escape', bytes: Buffer.from('x'), mode: 0o100644 }],
      join(root, 'demo.zip'),
      { mtime: MTIME },
    )).rejects.toThrow()
    expect(readdirSync(root)).toEqual([])
  })
})
