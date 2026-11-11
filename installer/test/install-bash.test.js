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

  // dirname in $(...) also dropped the newline for a top-level file: it made
  // an empty sibling, or failed when the sibling name was taken by a file.
  it('creates nothing beside a target whose name ends in a newline', () => {
    const parent = tempRoot('ramp-install-parent-')
    mkdirSync(join(parent, 'empty\n'))
    mkdirSync(join(parent, 'taken\n'))
    write(parent, 'taken', 'customer\n')
    for (const name of ['empty\n', 'taken\n']) {
      const state = bundle()
      expectSuccess(run(state, join(parent, name)))
      expect(readFileSync(join(parent, name, 'guide.md'), 'utf8')).toBe('guide\n')
      expectSuccess(run(state, join(parent, name), '--uninstall'))
    }
    expect(existsSync(join(parent, 'empty'))).toBe(false)
    expect(readFileSync(join(parent, 'taken'), 'utf8')).toBe('customer\n')
  })

  // bash ignores set -e inside a function called under ||, so the hashing
  // subshell must check each step itself.
  it('refuses an upgrade whose snapshot checksums cannot be computed', () => {
    const v1 = bundle({ files: { 'a.txt': 'a 1\n', 'guide.md': 'guide 1\n' } })
    const v2 = bundle({
      version: '1.1.0',
      bundleId: 'demo--kiro--v1.1.0',
      files: { 'a.txt': 'a 2\n', 'guide.md': 'guide 2\n' },
    })
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    const realSum = spawnSync('sh', ['-c', 'command -v sha256sum || command -v shasum'], { encoding: 'utf8' }).stdout.trim().split('\n')[0]
    const shims = tempRoot('ramp-install-shims-')
    for (const tool of ['sha256sum', 'shasum']) {
      write(shims, tool, [
        '#!/bin/sh',
        'case "$PWD" in */backup/*) [ -f overlay/a.txt ] && [ ! -e "$RAMP_ONCE" ] && : > "$RAMP_ONCE" && exit 1 ;; esac',
        `exec ${realSum} "$@"`,
        '',
      ].join('\n'), 0o755)
    }
    const result = spawnSync('bash', [v2.script, '--target', target], {
      cwd: tempRoot('ramp-install-cwd-'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}`, RAMP_ONCE: join(shims, 'once') },
      shell: false,
      timeout: 20_000,
    })
    expect(existsSync(join(shims, 'once'))).toBe(true)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('could not build the rollback snapshot')
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1\n')
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
  // paths: 300 files took minutes. A fixed budget also failed on loaded CI
  // runners, so the same four runs on 30 and 300 files are timed step by
  // step, side by side, and only their ratio is asserted: about 10x when
  // linear, far more for work per pair of paths. The shared deadline only
  // stops a hang.
  it('installs, reinstalls, and shares a 300-file bundle in near-linear time', () => {
    const deadline = Date.now() + 600_000
    const sized = (count) => {
      const files = Object.fromEntries(Array.from({ length: count }, (_, i) => [`dir${i % 10}/file${i}.md`, `file ${i}\n`]))
      const first = bundle({ files })
      const second = bundle({ owner: 'other--kiro--standalone', bundleId: 'other--kiro--v1.0.0', files })
      const runs = [[first], [first], [second], [first, '--uninstall']]
      return { count, runs, target: tempRoot('ramp-install-target-'), steps: [] }
    }
    const small = sized(30)
    const large = sized(300)
    for (let step = 0; step < large.runs.length; step++) {
      for (const scenario of [small, large]) {
        const [state, ...args] = scenario.runs[step]
        const started = performance.now()
        expectSuccess(spawnSync('bash', [state.script, '--target', scenario.target, ...args], {
          cwd: tempRoot('ramp-install-cwd-'),
          encoding: 'utf8',
          shell: false,
          // spawnSync treats a timeout of 0 as none, so the 1 ms floor keeps
          // the hang guard alive once the deadline has passed.
          timeout: Math.max(1, deadline - Date.now()),
        }))
        scenario.steps.push(Math.round(performance.now() - started))
      }
    }
    expect(readFileSync(join(large.target, 'dir9/file299.md'), 'utf8')).toBe('file 299\n')
    // Per-step times tell one stalled run apart from every step growing.
    const total = (scenario) => scenario.steps.reduce((sum, ms) => sum + ms, 0)
    const timings = [small, large]
      .map((scenario) => `${scenario.count} files: ${scenario.steps.join(' + ')} = ${total(scenario)} ms`)
      .join('; ')
    expect(total(large) / total(small), `install, reinstall, share, uninstall; ${timings}`).toBeLessThan(20)
  }, 660_000)

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
    expect(result.stderr).toContain('installer interrupted')
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
