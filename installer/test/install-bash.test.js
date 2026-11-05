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

  // A file-size limit fails publishing the larger v3 owner state while every
  // smaller restore copy still fits, so the moved backup is put back.
  it('restores a backup with its modes after a failed upgrade under umask 077', () => {
    const files = (version, count) => Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`f${index}.txt`, `${version}\n`]),
    )
    const v1 = bundle({ files: files('1.0.0', 1) })
    const v2 = bundle({ version: '1.1.0', bundleId: 'demo--kiro--v1.1.0', files: files('1.1.0', 1) })
    const v3 = bundle({
      version: '1.2.0',
      bundleId: `demo--kiro--v1.2.0--${'x'.repeat(200)}`,
      files: files('1.2.0', 4),
    })
    expect(readFileSync(join(v3.root, 'install-files.tsv')).length).toBeGreaterThan(512)
    const target = tempRoot('ramp-install-target-')
    expectSuccess(run(v1, target))
    expectSuccess(run(v2, target))
    const result = spawnSync('sh', [
      '-c', 'trap "" XFSZ && ulimit -f 1 && umask 077 && exec "$@"', 'sh',
      'bash', v3.script, '--target', target,
    ], { cwd: tempRoot('ramp-install-cwd-'), encoding: 'utf8', timeout: 20_000 })
    expect(result.stderr).toContain('install transaction failed and was restored')
    expectSuccess(run(v2, target, '--rollback'))
    expect(readFileSync(join(target, 'f0.txt'), 'utf8')).toBe('1.0.0\n')
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
