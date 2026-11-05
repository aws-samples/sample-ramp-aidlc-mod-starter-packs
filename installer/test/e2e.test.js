// installer/test/e2e.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const packDir = resolve(here, '..', '..', 'packs', 'cots-rewrite-on-cloudnative')
const cacheDir = process.env.RAMP_SKILLS_CACHE?.trim()
const runLockedIntegration = (
  cacheDir &&
  process.env.RAMP_PILOT_CACHE_EXPECTATION !== 'unsynchronized'
)

describe('e2e: cots-rewrite-on-cloudnative', () => {
  it('kiro: steering has inclusion frontmatter and mcp has autoApprove', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(
      buildPlan(packDir, 'kiro', { includeSkills: false }),
      target,
      { dryRun: false, force: false },
    )
    const wf = readFileSync(join(target, '.kiro/steering/aidlc-workflow.md'), 'utf8')
    expect(wf.startsWith('---\ninclusion: always\n---')).toBe(true)
    const mcp = JSON.parse(readFileSync(join(target, '.kiro/settings/mcp.json'), 'utf8'))
    expect(mcp.mcpServers['aws-knowledge-mcp-server'].autoApprove).toContain('aws___read_documentation')
  })

  it('claude-code: CLAUDE.md references both companion rules, no autoApprove in .mcp.json', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(
      buildPlan(packDir, 'claude-code', { includeSkills: false }),
      target,
      { dryRun: false, force: false },
    )
    const claude = readFileSync(join(target, 'CLAUDE.md'), 'utf8')
    expect(claude).toContain('.claude/rules/skill-activation.md')
    expect(claude).toContain('.claude/rules/reverse-engineering.md')
    expect(existsSync(join(target, '.claude/commands/aidlc.md'))).toBe(true)
    const mcp = JSON.parse(readFileSync(join(target, '.mcp.json'), 'utf8'))
    expect(mcp.mcpServers['aws-knowledge-mcp-server'].autoApprove).toBeUndefined()
  })

  it('copilot: lean primary + companions split into .github/instructions + prompt file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(
      buildPlan(packDir, 'copilot', { includeSkills: false }),
      target,
      { dryRun: false, force: false },
    )
    // primary file must NOT contain the companion bodies (no concatenation bloat)
    const primary = readFileSync(join(target, '.github/copilot-instructions.md'), 'utf8')
    expect(primary).not.toContain('MANDATORY: Skill') // a heading unique to skill-activation
    // companions live as separate .instructions.md files
    const skill = readFileSync(join(target, '.github/instructions/skill-activation.instructions.md'), 'utf8')
    expect(skill.startsWith("---\napplyTo: '**'\n---")).toBe(true)
    expect(existsSync(join(target, '.github/instructions/reverse-engineering.instructions.md'))).toBe(true)
    expect(existsSync(join(target, '.github/prompts/aidlc.prompt.md'))).toBe(true)
  })

  it('cursor: mdc rules with alwaysApply, no command file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(
      buildPlan(packDir, 'cursor', { includeSkills: false }),
      target,
      { dryRun: false, force: false },
    )
    const primary = readFileSync(join(target, '.cursor/rules/aidlc-workflow.mdc'), 'utf8')
    expect(primary.startsWith('---\nalwaysApply: true\n---')).toBe(true)
  })

  it.runIf(runLockedIntegration)(
    'copies exact locked upstream and declared RAMP skills from an explicit synchronized cache',
    () => {
      const target = mkdtempSync(join(tmpdir(), 'proj-'))
      const plan = buildPlan(packDir, 'kiro', { repoRoot, cacheDir })
      expect(
        plan.find(({ path }) => path === '.kiro/skills/aws-cloudformation')
          ?.provenance,
      ).toMatchObject({
        kind: 'upstream',
        attribution: 'locked',
        name: 'aws-cloudformation',
      })
      expect(
        plan.find(({ path }) => path === '.kiro/skills/web-test-automation')
          ?.provenance,
      ).toMatchObject({
        kind: 'ramp',
        attribution: 'declared',
        name: 'web-test-automation',
      })

      applyPlan(plan, target, { dryRun: false, force: false })
      expect(
        existsSync(join(target, '.kiro/skills/aws-cloudformation/SKILL.md')),
      ).toBe(true)
      expect(
        existsSync(join(target, '.kiro/skills/web-test-automation/skill.yaml')),
      ).toBe(true)
    },
  )
})
