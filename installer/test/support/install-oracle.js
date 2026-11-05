// Shared filesystem oracle for the generated bundle installers. Every engine
// (install.sh, and install.ps1 on each available PowerShell) runs the same
// scenarios against the same bytes; only how a run is spawned differs.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderInstallManifest } from '../../src/release/install-manifest.js'
import { renderInstallers } from '../../src/release/installers.js'

const roots = []
export const templates = {
  bash: readFileSync(new URL('../../src/release/templates/install.sh', import.meta.url)),
  powershell: readFileSync(new URL('../../src/release/templates/install.ps1', import.meta.url)),
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

export function tempRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

export function write(root, path, bytes, mode = 0o644) {
  const absolute = join(root, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, bytes)
  chmodSync(absolute, mode)
  return absolute
}

export function bundle({
  owner = 'demo--kiro--standalone',
  bundleId = `demo--kiro--v1.0.0`,
  version = '1.0.0',
  files = { 'guide.md': 'guide\n' },
} = {}) {
  const root = tempRoot('ramp-install-bundle-')
  const entries = Object.entries(files).map(([path, value]) => {
    const record = typeof value === 'object' && !Buffer.isBuffer(value)
      ? value
      : { bytes: value }
    const bytes = Buffer.from(record.bytes)
    const mode = record.mode ?? 0o100644
    write(root, `overlay/${path}`, bytes, mode & 0o777)
    return { path: `overlay/${path}`, bytes, mode }
  })
  write(root, 'install-files.tsv', renderInstallManifest({
    bundleId,
    ownershipKey: owner,
    version,
    files: entries,
  }))
  const scripts = renderInstallers({
    manifestName: 'install-files.tsv',
    overlayRoot: 'overlay',
    conflictName: 'install-conflicts.txt',
    stateRoot: '.ramp',
    templates,
  })
  const script = write(root, 'install.sh', scripts.bash, 0o755)
  const powershell = write(root, 'install.ps1', scripts.powershell)
  return { root, script, powershell, owner, version }
}

export function snapshot(root) {
  if (!existsSync(root)) return []
  const records = []
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name)
      const status = lstatSync(absolute)
      const path = relative(root, absolute).split(sep).join('/')
      if (status.isDirectory()) {
        records.push([path, Buffer.from('directory'), status.mode & 0o777])
        visit(absolute)
      }
      else if (status.isSymbolicLink()) {
        records.push([path, Buffer.from(`symlink:${readlinkSync(absolute)}`), status.mode & 0o777])
      }
      else if (!status.isFile()) records.push([path, Buffer.from('special'), status.mode & 0o777])
      else records.push([path, readFileSync(absolute), status.mode & 0o777])
    }
  }
  visit(root)
  return records
}

export function expectSuccess(result) {
  expect(result.error).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
}

function linkDirectory(target, path) {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir')
}

// Root ignores directory modes, so the forced-failure tests skip as root.
const asRoot = process.getuid?.() === 0

// Makes a directory refuse new entries until the returned undo runs: mode
// 0555 on POSIX, and on Windows, where directory modes do not block writes, a
// deny ACE for add-file and add-subdirectory.
function denyNewEntries(directory) {
  if (process.platform === 'win32') {
    const deny = spawnSync('icacls', [directory, '/deny', '*S-1-1-0:(WD,AD)'], { encoding: 'utf8' })
    expect(deny.status, deny.stdout).toBe(0)
    return () => {
      spawnSync('icacls', [directory, '/remove:d', '*S-1-1-0'])
    }
  }
  const mode = lstatSync(directory).mode & 0o777
  chmodSync(directory, 0o555)
  return () => chmodSync(directory, mode)
}

// Registers the shared scenarios for one engine:
// { run(state, target, ...args), runBounded(state, target, args, ms), timeout }.
// Arguments are written in install.sh form; an engine maps them.
export function registerInstallerContract(engine) {
  const test = (name, fn, timeout = engine.timeout) => it(name, fn, timeout)
  test.skipIf = (condition) => (name, fn, timeout = engine.timeout) =>
    it.skipIf(condition)(name, fn, timeout)
  const run = (...args) => engine.run(...args)
  const onWindows = process.platform === 'win32'

  test('installs exact bytes and modes and records ownership', () => {
    const state = bundle({
      files: {
        'docs/guide.md': 'guide\n',
        'scripts/check.sh': { bytes: '#!/bin/sh\n', mode: 0o100755 },
      },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(state, target))
    expect(readFileSync(join(target, 'docs/guide.md'), 'utf8')).toBe('guide\n')
    if (!onWindows) expect(lstatSync(join(target, 'scripts/check.sh')).mode & 0o777).toBe(0o755)
    expect(readFileSync(
      join(target, '.ramp/installed/demo--kiro--standalone.tsv'),
      'utf8',
    )).toBe(readFileSync(join(state.root, 'install-files.tsv'), 'utf8'))
    expect(existsSync(join(target, '.ramp/installed/.origins.tsv'))).toBe(true)
  })

  test('keeps dry-run and late conflicts completely outside the target', () => {
    const state = bundle({ files: { 'a/new.txt': 'new\n', 'z/conflict.txt': 'new\n' } })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(state, target, '--dry-run'))
    expect(snapshot(target)).toEqual([])
    write(target, 'z/conflict.txt', 'customer\n')
    const before = snapshot(target)
    const result = run(state, target)
    expect(result.status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)
    expect(readFileSync(join(state.root, 'install-conflicts.txt'), 'utf8'))
      .toMatch(/z\/conflict\.txt/)
  })

  test('rejects a tampered source before target writes', () => {
    const state = bundle()
    const target = tempRoot('ramp-install-target-')
    writeFileSync(join(state.root, 'overlay/guide.md'), 'tampered\n')
    expect(run(state, target).status).not.toBe(0)
    expect(snapshot(target)).toEqual([])
  })

  test('reinstalls idempotently and preserves adopted identical files', () => {
    const state = bundle()
    const target = tempRoot('ramp-install-target-')
    write(target, 'guide.md', 'guide\n')
    expectSuccess(run(state, target))
    const installed = snapshot(target)
    expectSuccess(run(state, target))
    expect(snapshot(target)).toEqual(installed)
    expectSuccess(run(state, target, '--uninstall'))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide\n')
  })

  test('supports two owners of one identical file in either order', () => {
    for (const order of [['owner-a', 'owner-b'], ['owner-b', 'owner-a']]) {
      const target = tempRoot('ramp-install-target-')
      const states = new Map(order.map((owner) => [owner, bundle({ owner })]))
      for (const owner of order) expectSuccess(run(states.get(owner), target))
      expectSuccess(run(states.get(order[0]), target, '--uninstall'))
      expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide\n')
      expectSuccess(run(states.get(order[1]), target, '--uninstall'))
      expect(existsSync(join(target, 'guide.md'))).toBe(false)
    }
  })

  test('upgrades safely and rolls back changed, added, and removed files', () => {
    const v1 = bundle({
      version: '1.0.0',
      files: { 'changed.txt': 'old\n', 'removed.txt': 'remove\n', 'same.txt': 'same\n' },
    })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'added.txt': 'add\n', 'changed.txt': 'new\n', 'same.txt': 'same\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    expectSuccess(run(v2, target))
    expect(readFileSync(join(target, 'changed.txt'), 'utf8')).toBe('new\n')
    expect(existsSync(join(target, 'removed.txt'))).toBe(false)
    expect(existsSync(join(target, '.ramp/backups/demo--kiro--standalone/1.0.0/install-files.tsv'))).toBe(true)
    expectSuccess(run(v2, target, '--rollback'))
    expect(readFileSync(join(target, 'changed.txt'), 'utf8')).toBe('old\n')
    expect(readFileSync(join(target, 'removed.txt'), 'utf8')).toBe('remove\n')
    expect(existsSync(join(target, 'added.txt'))).toBe(false)
    expect(run(v2, target, '--rollback').status).not.toBe(0)
  })

  test('backs up and rolls back a bundle file named SHA256SUMS below the root', () => {
    const v1 = bundle({ files: { 'docs/SHA256SUMS': 'listed\n', 'guide.md': 'old\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'docs/SHA256SUMS': 'listed\n', 'guide.md': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    expectSuccess(run(v2, target))
    expect(readFileSync(
      join(target, '.ramp/backups/demo--kiro--standalone/1.0.0/SHA256SUMS'),
      'utf8',
    )).toMatch(/  overlay\/docs\/SHA256SUMS\n/)
    expectSuccess(run(v2, target))
    expectSuccess(run(v2, target, '--rollback'))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('old\n')
    expect(readFileSync(join(target, 'docs/SHA256SUMS'), 'utf8')).toBe('listed\n')
  })

  test('blocks upgrade, uninstall, and rollback after customer modification', () => {
    const v1 = bundle()
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'guide.md': 'new\n' },
    })
    for (const operation of ['upgrade', 'uninstall', 'rollback']) {
      const target = tempRoot('ramp-install-target-')
      expectSuccess(run(v1, target))
      if (operation === 'rollback') expectSuccess(run(v2, target))
      writeFileSync(join(target, 'guide.md'), 'customer\n')
      const before = snapshot(target)
      const result = operation === 'upgrade'
        ? run(v2, target)
        : run(operation === 'rollback' ? v2 : v1, target, `--${operation}`)
      expect(result.status).not.toBe(0)
      expect(snapshot(target)).toEqual(before)
    }
  })

  test('requires an existing ordinary target and rejects invalid arguments', () => {
    const state = bundle()
    const missing = join(tempRoot('ramp-install-parent-'), 'missing')
    expect(run(state, missing).status).not.toBe(0)
    const unknown = run(state, tempRoot('ramp-install-target-'), '--unknown')
    expect(unknown.status).not.toBe(0)
  })

  test('rejects empty TSV fields and cross-owner portable path collisions', () => {
    const forged = bundle()
    const target = tempRoot('ramp-install-target-')
    writeFileSync(
      join(forged.root, 'install-files.tsv'),
      readFileSync(join(forged.root, 'install-files.tsv'), 'utf8')
        .replace('bundle\tdemo', 'bundle\t\tdemo'),
    )
    expect(run(forged, target).status).not.toBe(0)
    expect(snapshot(target)).toEqual([])

    const upper = bundle({ owner: 'owner-upper', files: { 'Guide.md': 'same\n' } })
    const lower = bundle({ owner: 'owner-lower', files: { 'guide.md': 'same\n' } })
    expectSuccess(run(upper, target))
    const before = snapshot(target)
    expect(run(lower, target).status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)
  })

  test('treats external-origin files as adopt-only during upgrade and removal', () => {
    const v1 = bundle({ files: { 'external.txt': 'customer\n' } })
    const changed = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'external.txt': 'changed\n' },
    })
    const removed = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'other.txt': 'other\n' },
    })
    for (const next of [changed, removed]) {
      const target = tempRoot('ramp-install-target-')
      write(target, 'external.txt', 'customer\n')
      expectSuccess(run(v1, target))
      const before = snapshot(target)
      if (next === changed) {
        expect(run(next, target).status).not.toBe(0)
        expect(snapshot(target)).toEqual(before)
      } else {
        expectSuccess(run(next, target))
        expect(readFileSync(join(target, 'external.txt'), 'utf8')).toBe('customer\n')
      }
    }
  })

  test('rejects tampered or linked rollback snapshots and cleans owned directories', () => {
    const v1 = bundle({ files: { 'nested/old.txt': 'old\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'nested/new.txt': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    expectSuccess(run(v2, target))
    const backup = join(target, '.ramp/backups/demo--kiro--standalone/1.0.0')
    write(backup, 'extra.txt', 'forged\n')
    const before = snapshot(target)
    expect(run(v2, target, '--rollback').status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)

    rmSync(join(backup, 'extra.txt'))
    const sums = join(backup, 'SHA256SUMS')
    const real = `${sums}.real`
    renameSync(sums, real)
    symlinkSync(real, sums)
    expect(run(v2, target, '--rollback').status).not.toBe(0)
    rmSync(sums)
    renameSync(real, sums)

    expectSuccess(run(v2, target, '--uninstall'))
    expect(existsSync(join(target, 'nested'))).toBe(false)
  })

  test('rejects NUL bytes and missing terminal LF in canonical TSV inputs', () => {
    for (const mutation of ['nul', 'missing-lf']) {
      const state = bundle()
      const target = tempRoot('ramp-install-target-')
      const manifest = join(state.root, 'install-files.tsv')
      const original = readFileSync(manifest)
      if (mutation === 'nul') {
        const text = original.toString('utf8')
        writeFileSync(manifest, Buffer.from(text.replace('bundle\tdemo', 'bundle\tde\0mo')))
      } else {
        writeFileSync(manifest, original.subarray(0, original.length - 1))
      }
      expect(run(state, target).status).not.toBe(0)
      expect(snapshot(target)).toEqual([])
    }
  })

  test('rejects hidden owners, non-SemVer versions, and folded manifest ancestors', () => {
    for (const [pattern, replacement] of [
      ['owner\tdemo--kiro--standalone', 'owner\t.hidden'],
      ['version\t1.0.0', 'version\trelease'],
    ]) {
      const state = bundle()
      const target = tempRoot('ramp-install-target-')
      const manifest = join(state.root, 'install-files.tsv')
      writeFileSync(
        manifest,
        readFileSync(manifest, 'utf8').replace(pattern, replacement),
      )
      const result = run(state, target)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('invalid install manifest')
      expect(snapshot(target)).toEqual([])
    }

    const state = bundle()
    const target = tempRoot('ramp-install-target-')
    const manifest = join(state.root, 'install-files.tsv')
    const original = readFileSync(manifest, 'utf8')
    const hash = original.match(/^file\t([0-9a-f]{64})\t/m)?.[1]
    expect(hash).toBeTruthy()
    writeFileSync(
      manifest,
      [
        'RAMP-INSTALL-MANIFEST\t1',
        'bundle\tdemo--kiro--v1.0.0',
        'owner\tdemo--kiro--standalone',
        'version\t1.0.0',
        `file\t${hash}\t0644\tA`,
        `file\t${hash}\t0644\ta-b`,
        `file\t${hash}\t0644\ta/x`,
        '',
      ].join('\n'),
    )
    const result = run(state, target)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('invalid install manifest')
    expect(snapshot(target)).toEqual([])
  })

  describe('rollback-only destinations get the same safety checks', () => {
    const v1 = () => bundle({ files: { 'keep.txt': 'keep\n', 'nested/removed.txt': 'remove\n' } })
    const v2 = () => bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'keep.txt': 'keep\n' },
    })
    const upgraded = () => {
      const states = { v1: v1(), v2: v2() }
      const target = tempRoot('ramp-install-target-')
      expectSuccess(run(states.v1, target))
      expectSuccess(run(states.v2, target))
      expect(existsSync(join(target, 'nested'))).toBe(false)
      return { target, v2: states.v2 }
    }
    const expectBlockedRollback = ({ target, v2: state }) => {
      const before = snapshot(target)
      const result = run(state, target, '--rollback')
      expect(result.error).toBeUndefined()
      expect(result.status).not.toBe(0)
      expect(snapshot(target)).toEqual(before)
    }

    test('rejects a symlinked parent even when the outside file is identical', () => {
      const upgrade = upgraded()
      const outside = tempRoot('ramp-install-outside-')
      write(outside, 'removed.txt', 'remove\n')
      linkDirectory(outside, join(upgrade.target, 'nested'))
      expectBlockedRollback(upgrade)
    })

    test.skipIf(onWindows)('rejects a FIFO without opening it', async () => {
      const upgrade = upgraded()
      mkdirSync(join(upgrade.target, 'nested'))
      expect(spawnSync('mkfifo', [join(upgrade.target, 'nested/removed.txt')]).status).toBe(0)
      const before = snapshot(upgrade.target)
      const result = await engine.runBounded(upgrade.v2, upgrade.target, ['--rollback'])
      expect(result.timedOut).toBe(false)
      expect(result.status).not.toBe(0)
      expect(snapshot(upgrade.target)).toEqual(before)
    }, Math.max(30_000, engine.timeout ?? 0))

    test('rejects a case-folded collision with a later owner claim', () => {
      const upgrade = upgraded()
      const other = bundle({ owner: 'owner-other', files: { 'Nested/removed.txt': 'other\n' } })
      expectSuccess(run(other, upgrade.target))
      expectBlockedRollback(upgrade)
    })
  })

  test('rejects hidden and dangling rollback generations', () => {
    const v1 = bundle()
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'guide.md': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    expectSuccess(run(v2, target))
    const ownerBackup = join(target, '.ramp/backups/demo--kiro--standalone')

    mkdirSync(join(ownerBackup, '.hidden'))
    let before = snapshot(target)
    expect(run(v2, target, '--rollback').status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)
    rmSync(join(ownerBackup, '.hidden'), { recursive: true })

    symlinkSync('missing-generation', join(ownerBackup, 'dangling'))
    before = snapshot(target)
    expect(run(v2, target, '--rollback').status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)
  })

  test('fails closed on case-colliding claims already present in owner state', () => {
    const upper = bundle({ owner: 'owner-upper', files: { 'Guide.md': 'same\n' } })
    const other = bundle({ owner: 'owner-other', files: { 'Guide.md': 'same\n' } })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(upper, target))
    expectSuccess(run(other, target))

    const lowerPath = join(target, 'guide.md')
    if (!existsSync(lowerPath)) write(target, 'guide.md', 'same\n')
    const otherState = join(target, '.ramp/installed/owner-other.tsv')
    writeFileSync(
      otherState,
      readFileSync(otherState, 'utf8').replace('\tGuide.md\n', '\tguide.md\n'),
    )
    const origins = join(target, '.ramp/installed/.origins.tsv')
    writeFileSync(
      origins,
      readFileSync(origins, 'utf8') + 'file\tmanaged\tguide.md\n',
    )

    const before = snapshot(target)
    expect(run(upper, target, '--uninstall').status).not.toBe(0)
    expect(snapshot(target)).toEqual(before)
  })

  test('rejects non-adjacent folded prefix collisions across installed owners', () => {
    const owners = ['owner-root', 'owner-sibling', 'owner-child']
    const paths = ['A', 'a-b', 'a/x']
    const states = owners.map((owner) => bundle({ owner }))
    const target = tempRoot('ramp-install-target-')
    for (const state of states) expectSuccess(run(state, target))

    for (let index = 0; index < owners.length; index += 1) {
      const statePath = join(target, `.ramp/installed/${owners[index]}.tsv`)
      writeFileSync(
        statePath,
        readFileSync(statePath, 'utf8').replace('\tguide.md\n', `\t${paths[index]}\n`),
      )
    }
    writeFileSync(
      join(target, '.ramp/installed/.origins.tsv'),
      [
        'RAMP-INSTALL-ORIGINS\t1',
        'file\tmanaged\tA',
        'file\tmanaged\ta-b',
        'file\tmanaged\ta/x',
        '',
      ].join('\n'),
    )

    const before = snapshot(target)
    const result = run(states[0], target, '--uninstall')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('portable collision in installed owner state')
    expect(snapshot(target)).toEqual(before)
  })

  test.skipIf(asRoot)('removes transaction staging after a recoverable state-publish failure', () => {
    const first = bundle({ owner: 'owner-first' })
    const second = bundle({
      owner: 'owner-second',
      files: { 'nested/new.txt': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(first, target))
    const before = snapshot(target)
    const undo = denyNewEntries(join(target, '.ramp/installed'))
    let result
    try {
      result = run(second, target)
    } finally {
      undo()
    }

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('install transaction failed and was restored')
    expect(snapshot(target)).toEqual(before)
    expect(readdirSync(join(target, '.ramp')).some((name) => name.startsWith('.transaction.')))
      .toBe(false)
  })

  test.skipIf(asRoot)('restores a failed write that precedes a new file in a new folder', () => {
    const state = bundle({ files: { 'd/x.txt': 'x\n', 'e/y.txt': 'y\n' } })
    const target = tempRoot('ramp-install-target-')
    mkdirSync(join(target, 'd'))
    const before = snapshot(target)
    const undo = denyNewEntries(join(target, 'd'))
    let result
    try {
      result = run(state, target)
    } finally {
      undo()
    }

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('install transaction failed and was restored')
    expect(snapshot(target)).toEqual(before)
  })
}
