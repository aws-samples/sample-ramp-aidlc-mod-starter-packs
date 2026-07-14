// installer/test/e2e.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'

const here = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(here, '..', '..', 'enterprise-app-on-cloudnative')

describe('e2e: enterprise-app-on-cloudnative', () => {
  it('kiro: steering has inclusion frontmatter, mcp has autoApprove, 15 skills', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(buildPlan(packDir, 'kiro'), target, { dryRun: false, force: false })
    const wf = readFileSync(join(target, '.kiro/steering/aidlc-workflow.md'), 'utf8')
    expect(wf.startsWith('---\ninclusion: always\n---')).toBe(true)
    const mcp = JSON.parse(readFileSync(join(target, '.kiro/settings/mcp.json'), 'utf8'))
    expect(mcp.mcpServers['aws-knowledge-mcp-server'].autoApprove).toContain('aws___read_documentation')
    expect(existsSync(join(target, '.kiro/skills/aurora-dsql/SKILL.md'))).toBe(true)
  })

  it('claude-code: CLAUDE.md references both companion rules, no autoApprove in .mcp.json', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(buildPlan(packDir, 'claude-code'), target, { dryRun: false, force: false })
    const claude = readFileSync(join(target, 'CLAUDE.md'), 'utf8')
    expect(claude).toContain('.claude/rules/skill-activation.md')
    expect(claude).toContain('.claude/rules/reverse-engineering.md')
    expect(existsSync(join(target, '.claude/commands/aidlc.md'))).toBe(true)
    const mcp = JSON.parse(readFileSync(join(target, '.mcp.json'), 'utf8'))
    expect(mcp.mcpServers['aws-knowledge-mcp-server'].autoApprove).toBeUndefined()
  })

  it('copilot: lean primary + companions split into .github/instructions + prompt file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(buildPlan(packDir, 'copilot'), target, { dryRun: false, force: false })
    // primary file must NOT contain the companion bodies (no concatenation bloat)
    const primary = readFileSync(join(target, '.github/copilot-instructions.md'), 'utf8')
    expect(primary).not.toContain('MANDATORY: Skill') // a heading unique to skill-activation
    // companions live as separate .instructions.md files
    const skill = readFileSync(join(target, '.github/instructions/skill-activation.instructions.md'), 'utf8')
    expect(skill.startsWith("---\napplyTo: '**'\n---")).toBe(true)
    expect(existsSync(join(target, '.github/instructions/reverse-engineering.instructions.md'))).toBe(true)
    expect(existsSync(join(target, '.github/prompts/aidlc.prompt.md'))).toBe(true)
    expect(existsSync(join(target, '.github/skills/aws-lambda/SKILL.md'))).toBe(true)
  })

  it('cursor: mdc rules with alwaysApply, no command file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(buildPlan(packDir, 'cursor'), target, { dryRun: false, force: false })
    const primary = readFileSync(join(target, '.cursor/rules/aidlc-workflow.mdc'), 'utf8')
    expect(primary.startsWith('---\nalwaysApply: true\n---')).toBe(true)
    expect(existsSync(join(target, '.cursor/skills/terraform-skill/SKILL.md'))).toBe(true)
  })
})
