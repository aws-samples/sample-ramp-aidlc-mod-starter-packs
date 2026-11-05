import { spawn, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync } from 'node:fs'
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
  it('installs into a target whose path holds a backslash', () => {
    const state = bundle()
    const target = join(tempRoot('ramp-install-parent-'), 'back\\slash')
    mkdirSync(target)
    expectSuccess(run(state, target))
    expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide\n')
    expectSuccess(run(state, target, '--uninstall'))
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
