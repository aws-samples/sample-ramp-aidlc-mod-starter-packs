import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundle,
  expectSuccess,
  registerInstallerContract,
  snapshot,
  tempRoot,
  write,
} from './support/install-oracle.js'

function run(state, target, ...args) {
  return spawnSync('bash', [state.script, '--target', target, ...args], {
    cwd: tempRoot('ramp-install-cwd-'),
    encoding: 'utf8',
    shell: false,
    timeout: 20_000,
  })
}

// Runs the helper in its own process group so a blocked child (for example a
// hash of a FIFO) is killed with it instead of hanging the test runner.
function runBounded(state, target, args, ms = 10_000) {
  return new Promise((resolve) => {
    const child = spawn('bash', [state.script, '--target', target, ...args], {
      cwd: tempRoot('ramp-install-cwd-'),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let timedOut = false
    child.stdout.resume()
    child.stderr.on('data', (chunk) => { stderr += chunk })
    const timer = setTimeout(() => {
      timedOut = true
      process.kill(-child.pid, 'SIGKILL')
    }, ms)
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stderr, timedOut })
    })
  })
}

describe('generated Bash bundle installer', () => {
  registerInstallerContract({ run, runBounded })

  // A cp shim fails only the owner-state publish, after the backup moved, so
  // the restore copies run under the strict umask.
  it('restores a backup with its modes after a failed upgrade under umask 077', () => {
    const versions = ['1.0.0', '1.1.0', '1.2.0'].map((version) => bundle({
      version,
      bundleId: `demo--kiro--v${version}`,
      files: { 'guide.md': `guide ${version}\n` },
    }))
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(versions[0], target))
    expectSuccess(run(versions[1], target))
    const realCp = spawnSync('sh', ['-c', 'command -v cp'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'cp', [
      '#!/bin/sh',
      'for last; do :; done',
      'case "$last" in */.ramp/installed/*.tsv.new) exit 1 ;; esac',
      `exec ${realCp} "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('sh', ['-c', 'umask 077 && exec "$@"', 'sh', 'bash', versions[2].script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}` },
      timeout: 20_000,
    })
    expect(result.stderr).toContain('install transaction failed and was restored')
    expectSuccess(run(versions[1], target, '--rollback'))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1.0.0\n')
  })

  // PowerShell reads a backslash as a separator on every platform.
  it('rejects two operation flags and a missing target value as usage errors', () => {
    const state = bundle()
    const target = tempRoot('ramp-install-target-')
    const modes = run(state, target, '--dry-run', '--uninstall')
    expect(modes.status).toBe(2)
    expect(modes.stderr).toContain('operation flags are mutually exclusive')
    const missing = spawnSync('bash', [state.script, '--target'], { encoding: 'utf8', timeout: 20_000 })
    expect(missing.status).toBe(2)
    expect(missing.stderr).toContain('--target requires one value')
    expect(snapshot(target)).toEqual([])
  })

  it('installs into a target whose path holds a backslash', () => {
    const state = bundle()
    const target = join(tempRoot('ramp-install-parent-'), 'back\\slash')
    mkdirSync(target)
    expectSuccess(run(state, target))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide\n')
    expectSuccess(run(state, target, '--uninstall'))
  })

  // An mkdir shim writes a customer file just before the lock is taken, so
  // only the locked second preflight can see it.
  it('catches a change made between the first preflight and the lock', () => {
    const state = bundle({ files: { 'early.txt': 'early\n', 'late.txt': 'bundle\n' } })
    const target = tempRoot('ramp-install-target-')
    const realMkdir = spawnSync('sh', ['-c', 'command -v mkdir'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'mkdir', [
      '#!/bin/sh',
      'for last; do :; done',
      'case "$last" in */.ramp/install.lock) printf \'customer\\n\' > "$RAMP_TEST_LATE" ;; esac',
      `exec ${realMkdir} "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('bash', [state.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}`, RAMP_TEST_LATE: join(target, 'late.txt') },
      timeout: 20_000,
    })
    expect(result.status).not.toBe(0)
    expect(readFileSync(join(state.root, 'install-conflicts.txt'), 'utf8'))
      .toBe('late.txt\tcustomer file differs\n')
    expect(snapshot(target)).toEqual([['late.txt', Buffer.from('customer\n'), expect.any(Number)]])
  })

  // Command substitution strips trailing newlines, so a directory named
  // "proj<LF>" must not resolve to its sibling "proj".
  it('keeps a trailing newline in target and bundle directory names', () => {
    const parent = tempRoot('ramp-install-parent-')
    const real = bundle()
    const decoy = bundle({ files: { 'guide.md': 'decoy\n' } })
    cpSync(real.root, join(parent, 'b\n'), { recursive: true })
    cpSync(decoy.root, join(parent, 'b'), { recursive: true })
    const script = join(parent, 'b\n', 'install.sh')
    for (const name of ['proj\n', 'here\n']) {
      mkdirSync(join(parent, name))
      mkdirSync(join(parent, name.trimEnd()))
    }
    expectSuccess(run({ script }, join(parent, 'proj\n')))
    const dot = spawnSync('bash', [script, '--target', '.'], {
      cwd: join(parent, 'here\n'),
      encoding: 'utf8',
      shell: false,
      timeout: 20_000,
    })
    expectSuccess(dot)
    for (const name of ['proj', 'here']) {
      expect(readFileSync(join(parent, `${name}\n`, 'guide.md'), 'utf8')).toBe('guide\n')
      expect(snapshot(join(parent, name))).toEqual([])
    }
  })

  it('installs into relative targets that look like cd options or CDPATH names', () => {
    const state = bundle()
    const parent = tempRoot('ramp-install-parent-')
    const decoy = tempRoot('ramp-install-decoy-')
    mkdirSync(join(decoy, 'proj'))
    for (const name of ['-', '-P', '-L', '-e', '--', 'proj']) {
      mkdirSync(join(parent, name))
      const result = spawnSync('bash', [state.script, '--target', name], {
        cwd: parent,
        encoding: 'utf8',
        env: { ...process.env, HOME: decoy, OLDPWD: decoy, CDPATH: decoy },
        shell: false,
        timeout: 20_000,
      })
      expectSuccess(result)
      expect(readFileSync(join(parent, name, 'guide.md'), 'utf8')).toBe('guide\n')
      expect(snapshot(decoy)).toEqual([['proj', Buffer.from('directory'), lstatSync(join(decoy, 'proj')).mode & 0o777]])
    }
  })

  // A cp that fails only for snapshot overlay copies stands in for ENOSPC or
  // EIO while the rollback snapshot is built: the upgrade must not commit.
  it('refuses an upgrade whose rollback snapshot cannot be built', () => {
    const v1 = bundle({ files: { 'guide.md': 'guide 1\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'guide.md': 'guide 2\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    const realCp = spawnSync('sh', ['-c', 'command -v cp'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'cp', [
      '#!/bin/sh',
      'for last; do :; done',
      'case "$last" in */backup/*/overlay/*) exit 1 ;; esac',
      `exec ${realCp} "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('bash', [v2.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}` },
      shell: false,
      timeout: 20_000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('could not build the rollback snapshot')
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1\n')
    expect(existsSync(join(target, '.ramp/backups/demo--kiro--standalone/1.0.0'))).toBe(false)
    expectSuccess(run(v2, target))
    expectSuccess(run(v2, target, '--rollback'))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1\n')
  })

  // A cp shim edits the target when the helper copies to a matching
  // destination, standing in for an editor or agent writing during the
  // transaction. The edit must survive and the upgrade must not commit.
  it.each([
    ['while staging the old bytes', '*/.transaction.*/old/guide.md', 'guide.md'],
    ['after an earlier file was committed', '*/a.txt.ramp-install.*', 'guide.md'],
    ['as a new file the upgrade would add', '*/a.txt.ramp-install.*', 'new.txt'],
  ])('keeps an edit made %s', (_, trigger, edited) => {
    const v1 = bundle({ files: { 'a.txt': 'a 1\n', 'guide.md': 'guide 1\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'a.txt': 'a 2\n', 'guide.md': 'guide 2\n', 'new.txt': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    const realCp = spawnSync('sh', ['-c', 'command -v cp'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'cp', [
      '#!/bin/sh',
      'for last; do :; done',
      `case "$last" in ${trigger}) printf 'customer\\n' > "$RAMP_EDIT" ;; esac`,
      `exec ${realCp} "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('bash', [v2.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}`, RAMP_EDIT: join(target, edited) },
      shell: false,
      timeout: 20_000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`${edited} changed while the installer ran`)
    expect(readFileSync(join(target, edited), 'utf8')).toBe('customer\n')
    expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('a 1\n')
    expect(readFileSync(join(target, '.ramp/installed/demo--kiro--standalone.tsv'), 'utf8'))
      .toContain('1.0.0')
  })

  // GNU stat reads a BSD-style '%Lp' format as a file operand.
  it('installs from a working directory that holds a file named %Lp', () => {
    const state = bundle()
    const target = tempRoot('ramp-install-target-')
    const cwd = tempRoot('ramp-install-cwd-')
    write(cwd, '%Lp', 'decoy\n')
    const result = spawnSync('bash', [state.script, '--target', target], {
      cwd,
      encoding: 'utf8',
      shell: false,
      timeout: 20_000,
    })
    expectSuccess(result)
    expectSuccess(run(state, target, '--uninstall'))
  })

  // Per-path subprocesses made each run grow with files times installed
  // paths: 300 files took minutes. Every run here has a 60 s budget, which
  // the old helper missed at 100 files and the current one meets with room.
  it('installs, reinstalls, and shares a 300-file bundle within a time budget', () => {
    const files = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`dir${i % 10}/file${i}.md`, `file ${i}\n`]))
    const first = bundle({ files })
    const second = bundle({ owner: 'other--kiro--standalone', bundleId: 'other--kiro--v1.0.0', files })
    const target = tempRoot('ramp-install-target-')
    const timed = (state, ...args) => spawnSync('bash', [state.script, '--target', target, ...args], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      shell: false,
      timeout: 60_000,
    })
    expectSuccess(timed(first))
    expectSuccess(timed(first))
    expectSuccess(timed(second))
    expectSuccess(timed(first, '--uninstall'))
    expect(readFileSync(join(target, 'dir9/file299.md'), 'utf8')).toBe('file 299\n')
  }, 300_000)

  it('exits 130 and restores the target on SIGINT mid-commit', () => {
    const v1 = bundle({ files: { 'a.txt': 'a 1\n', 'guide.md': 'guide 1\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'a.txt': 'a 2\n', 'guide.md': 'guide 2\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    const before = snapshot(target)
    const realCp = spawnSync('sh', ['-c', 'command -v cp'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'cp', [
      '#!/bin/sh',
      'for last; do :; done',
      'case "$last" in */guide.md.ramp-install.*) kill -INT "$PPID" ;; esac',
      `exec ${realCp} "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('bash', [v2.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}` },
      shell: false,
      timeout: 20_000,
    })
    expect(result.status).toBe(130)
    expect(snapshot(target)).toEqual(before)
  })

  it('keeps a committed upgrade when removing transaction staging fails', () => {
    const v1 = bundle({
      version: '1.0.0',
      files: { 'changed.txt': 'old\n', 'removed.txt': 'remove\n' },
    })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'added.txt': 'add\n', 'changed.txt': 'new\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    // An rm that fails only on the transaction directory stands in for a
    // signal or set -e exit after the commit and before staging is gone.
    const realRm = spawnSync('bash', ['-c', 'command -v rm'], { encoding: 'utf8' }).stdout.trim()
    const shims = tempRoot('ramp-install-shims-')
    write(shims, 'rm', [
      '#!/bin/bash',
      'for arg in "$@"; do',
      '  [[ $arg =~ /\\.ramp/\\.transaction\\.[0-9]+$ ]] && exit 1',
      'done',
      `exec '${realRm}' "$@"`,
      '',
    ].join('\n'), 0o755)
    const result = spawnSync('bash', [v2.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}` },
      shell: false,
      timeout: 20_000,
    })

    // The committed files and state come first: the bug restores over them.
    expect(readFileSync(join(target, 'changed.txt'), 'utf8')).toBe('new\n')
    expect(readFileSync(join(target, 'added.txt'), 'utf8')).toBe('add\n')
    expect(existsSync(join(target, 'removed.txt'))).toBe(false)
    expect(readFileSync(join(target, '.ramp/installed/demo--kiro--standalone.tsv'), 'utf8'))
      .toContain('1.1.0')
    expect(existsSync(join(target, '.ramp/backups/demo--kiro--standalone/1.0.0/install-files.tsv'))).toBe(true)
    expectSuccess(result)
    expect(result.stderr).toContain('could not remove transaction staging')
  })
})
