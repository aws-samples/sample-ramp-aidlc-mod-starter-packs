import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const cli = resolve(here, '..', 'bin', 'ramp-pack.js')

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
  })
}

describe('ramp-pack init workspace options', () => {
  it('describes and reports both generated no-Node helpers for build-all', () => {
    const help = run(['build-all', '--help'])
    expect(help.status, help.stderr).toBe(0)
    expect(help.stdout).toMatch(/add-skills\.sh/)
    expect(help.stdout).toMatch(/add-skills\.ps1/)

    const root = mkdtempSync(join(tmpdir(), 'ramp-cli-build-'))
    const out = join(root, 'out')
    const result = run([
      'build-all',
      '--pack',
      'qa-automated-testing',
      '--out',
      out,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/add-skills\.sh/)
    expect(result.stdout).toMatch(/add-skills\.ps1/)
    expect(
      existsSync(join(out, 'qa-automated-testing', 'add-skills.sh')),
    ).toBe(true)
    expect(
      existsSync(join(out, 'qa-automated-testing', 'add-skills.ps1')),
    ).toBe(true)
  })

  it('installs Kiro and Claude Code with one shared spec root', () => {
    const target = mkdtempSync(join(tmpdir(), 'ramp-cli-'))
    const cache = join(target, 'unused-cache')
    const result = run([
      'init',
      'agentic-ai-workflow',
      '--tools',
      'kiro,claude-code',
      '--cache',
      cache,
      '--target',
      target,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(join(target, '.kiro/steering/aidlc-workflow.md'))).toBe(true)
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(true)
    expect(
      readFileSync(join(target, '.kiro/steering/aidlc-workflow.md'), 'utf8'),
    ).toContain('.kiro/specs/<spec-name>/')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toContain(
      '.kiro/specs/<spec-name>/',
    )
    expect(existsSync(join(target, '.kiro/specs'))).toBe(false)
    expect(existsSync(join(target, 'aidlc-docs'))).toBe(false)
    expect(existsSync(cache)).toBe(false)
  })

  it('accepts build-all --cache without touching it for scaffold-only output', () => {
    const root = mkdtempSync(join(tmpdir(), 'ramp-cli-build-'))
    const out = join(root, 'out')
    const cache = join(root, 'unused-cache')
    const result = run([
      'build-all',
      '--pack',
      'qa-automated-testing',
      '--out',
      out,
      '--cache',
      cache,
    ])

    expect(result.status, result.stderr).toBe(0)
    expect(
      existsSync(
        join(
          out,
          'qa-automated-testing',
          'kiro',
          '.kiro',
          'steering',
          'aidlc-workflow.md',
        ),
      ),
    ).toBe(true)
    expect(existsSync(cache)).toBe(false)
  })

  it.each([
    [[], /exactly one.*--tool.*--tools/i],
    [['--tool', 'kiro', '--tools', 'kiro,claude-code'], /exactly one.*--tool.*--tools/i],
    [['--tools', 'kiro,kiro'], /duplicate.*kiro/i],
    [['--tools', 'kiro,,claude-code'], /empty.*tool|tool.*empty/i],
    [['--tool', 'kiro', '--spec-root', '../outside'], /specRoot.*safe|safe.*specRoot/i],
    [['--tool', 'kiro', '--profile', 'missing'], /unknown workspace profile/i],
  ])('rejects invalid selection %# before writing', (options, message) => {
    const target = mkdtempSync(join(tmpdir(), 'ramp-cli-'))
    const result = run([
      'init',
      'qa-automated-testing',
      ...options,
      '--target',
      target,
    ])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(message)
    expect(readdirSync(target)).toEqual([])
  })
})
