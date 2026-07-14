// installer/test/plan.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'

let packDir
beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'pack-'))
  mkdirSync(join(packDir, 'instructions'), { recursive: true })
  mkdirSync(join(packDir, 'skills', 'aws-lambda'), { recursive: true })
  writeFileSync(join(packDir, 'skills', 'aws-lambda', 'SKILL.md'), '# lambda')
  writeFileSync(join(packDir, 'instructions/main.md'), 'MAIN')
  writeFileSync(
    join(packDir, 'pack.yaml'),
    `name: demo\ntitle: Demo\ndescription: d\ninstructions:\n  - file: main.md\n    role: primary\ncommand:\n  name: aidlc\n  description: go\nmcp:\n  - id: k\n    command: npx\n    args: ["x"]\n`,
  )
})

describe('buildPlan + applyPlan', () => {
  it('claude-code plan includes CLAUDE.md, .mcp.json, command, and skill copy', () => {
    const plan = buildPlan(packDir, 'claude-code')
    const paths = plan.map((p) => p.path)
    expect(paths).toContain('CLAUDE.md')
    expect(paths).toContain('.mcp.json')
    expect(paths).toContain('.claude/commands/aidlc.md')
    expect(paths).toContain('.claude/skills/aws-lambda')
  })

  it('dry-run writes nothing but returns planned paths', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    const written = applyPlan(buildPlan(packDir, 'kiro'), target, { dryRun: true, force: false })
    expect(written.length).toBeGreaterThan(0)
    expect(existsSync(join(target, '.kiro/steering/main.md'))).toBe(false)
  })

  it('apply writes text files and copies skill dirs', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(buildPlan(packDir, 'kiro'), target, { dryRun: false, force: false })
    expect(existsSync(join(target, '.kiro/steering/main.md'))).toBe(true)
    expect(existsSync(join(target, '.kiro/skills/aws-lambda/SKILL.md'))).toBe(true)
  })

  it('refuses to overwrite without force', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    mkdirSync(join(target, '.kiro/steering'), { recursive: true })
    writeFileSync(join(target, '.kiro/steering/main.md'), 'OLD')
    expect(() => applyPlan(buildPlan(packDir, 'kiro'), target, { dryRun: false, force: false })).toThrow(/exists/i)
  })

  it('force allows overwriting an existing target file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    mkdirSync(join(target, '.kiro/steering'), { recursive: true })
    writeFileSync(join(target, '.kiro/steering/main.md'), 'OLD')
    const plan = buildPlan(packDir, 'kiro')
    expect(() => applyPlan(plan, target, { dryRun: false, force: true })).not.toThrow()
    const written = readFileSync(join(target, '.kiro/steering/main.md'), 'utf8')
    expect(written).not.toBe('OLD')
  })
})
