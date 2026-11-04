// installer/test/plan.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'
import { resolveWorkspace } from '../src/workspace.js'

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
    expect(
      plan.find((entry) => entry.path === '.claude/skills/aws-lambda')
        .provenance,
    ).toMatchObject({
      kind: 'pack-override',
      name: 'aws-lambda',
    })
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

  it('threads a shared workspace through the selected adapter', () => {
    writeFileSync(
      join(packDir, 'instructions/main.md'),
      'Spec {{SPEC_DIR}} State {{STATE_DIR}}',
    )
    const workspace = resolveWorkspace({}, { tools: ['kiro', 'claude-code'] })
    const plan = buildPlan(packDir, 'claude-code', {
      includeSkills: false,
      workspace,
    })
    const primary = plan.find((entry) => entry.path === 'CLAUDE.md')

    expect(primary.content).toContain('Spec .kiro/specs State aidlc-docs')
  })

  it('rejects a plan for a tool outside the supplied workspace', () => {
    const workspace = resolveWorkspace({}, { tools: ['kiro'] })

    expect(() =>
      buildPlan(packDir, 'claude-code', { includeSkills: false, workspace }),
    ).toThrow(/workspace.*claude-code|claude-code.*workspace/i)
  })

  it('threads one injected resolver and the manifest pack id into skill entries', () => {
    const calls = []
    const selected = join(packDir, 'selected-skill')
    const provenance = {
      kind: 'legacy-local',
      attribution: 'legacy-unattributed',
      name: 'aws-lambda',
    }
    const resolver = {
      resolveSkill(name, options) {
        calls.push([name, options])
        return { directory: selected, provenance }
      },
    }

    const plan = buildPlan(packDir, 'claude-code', { resolver })
    const skill = plan.find(
      (entry) => entry.path === '.claude/skills/aws-lambda',
    )
    expect(calls).toEqual([
      ['aws-lambda', { packDir, packId: 'demo' }],
    ])
    expect(skill).toEqual({
      path: '.claude/skills/aws-lambda',
      content: selected,
      kind: 'copy',
      provenance,
    })
  })

  it('does not touch an injected resolver when skills are excluded', () => {
    const resolver = {
      resolveSkill() {
        throw new Error('resolver must not be called')
      },
    }
    expect(() =>
      buildPlan(packDir, 'kiro', { includeSkills: false, resolver }),
    ).not.toThrow()
  })

  it('fails unresolved skill planning before any target write', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    const resolver = {
      resolveSkill() {
        throw new Error('unresolved skill')
      },
    }
    expect(() => buildPlan(packDir, 'kiro', { resolver })).toThrow(
      /unresolved skill/i,
    )
    expect(existsSync(join(target, '.kiro'))).toBe(false)
  })
})
