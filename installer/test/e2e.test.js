// installer/test/e2e.test.js
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseToml } from 'smol-toml'
import { parse as parseYaml } from 'yaml'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'
import { listPacks } from '../src/build-all.js'
import { loadManifest } from '../src/manifest.js'

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
    const skill = readFileSync(join(target, '.cursor/rules/skill-activation.mdc'), 'utf8')
    expect(skill.startsWith('---\nalwaysApply: true\n---')).toBe(true)
    const re = readFileSync(join(target, '.cursor/rules/reverse-engineering.mdc'), 'utf8')
    expect(re).toMatch(/^---\ndescription: "Phase 0 .+"\nalwaysApply: false\n---\n/)
  })

  it('codex: AGENTS.md names every companion, MCP servers in .codex/config.toml, no command file', () => {
    const target = mkdtempSync(join(tmpdir(), 'proj-'))
    applyPlan(
      buildPlan(packDir, 'codex', { includeSkills: false }),
      target,
      { dryRun: false, force: false },
    )
    const agents = readFileSync(join(target, 'AGENTS.md'), 'utf8')
    expect(agents.startsWith('Codex loads only this file.')).toBe(true)
    expect(agents).toContain('- `.codex/instructions/skill-activation.md`: read at session start.\n')
    expect(agents).toContain('- `.codex/instructions/reverse-engineering.md`: read when this applies: Phase 0 ')
    expect(agents).toContain('- `.codex/instructions/requirements-traceability.md`: read when this applies: ')
    expect(readdirSync(join(target, '.codex/instructions')).sort()).toEqual([
      'requirements-traceability.md',
      'reverse-engineering.md',
      'skill-activation.md',
    ])
    const config = parseToml(readFileSync(join(target, '.codex/config.toml'), 'utf8'))
    expect(config.mcp_servers['aws-knowledge-mcp-server'].autoApprove).toBeUndefined()
    expect(readdirSync(target).sort()).toEqual(['.codex', 'AGENTS.md'])
  })

  it.runIf(runLockedIntegration)(
    'codex: ramp-pack init --tool codex installs instructions, MCP config and skills',
    () => {
      const target = mkdtempSync(join(tmpdir(), 'proj-'))
      execFileSync(process.execPath, [
        join(repoRoot, 'installer', 'bin', 'ramp-pack.js'),
        'init', 'cots-rewrite-on-cloudnative',
        '--tool', 'codex',
        '--target', target,
        '--cache', cacheDir,
      ], { cwd: target, stdio: 'pipe' })
      expect(readFileSync(join(target, 'AGENTS.md'), 'utf8')).toContain('.codex/instructions/skill-activation.md')
      expect(existsSync(join(target, '.codex/config.toml'))).toBe(true)
      expect(existsSync(join(target, '.agents/skills/aws-cloudformation/SKILL.md'))).toBe(true)
      expect(existsSync(join(target, '.codex/skills'))).toBe(false)
    },
  )

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
        existsSync(join(target, '.kiro/skills/web-test-automation/SKILL.md')),
      ).toBe(true)
      expect(
        existsSync(join(target, '.kiro/skills/web-test-automation/skill.yaml')),
      ).toBe(false)
    },
  )
})

describe('codex: every pack fits Codex project instructions', () => {
  const packsRoot = join(repoRoot, 'packs')
  const codexPacks = listPacks(packsRoot).filter((pack) => {
    const manifest = loadManifest(join(packsRoot, pack))
    return manifest.schemaVersion !== 2 || manifest.distribution.targets.includes('codex')
  })

  // The fallback would keep AGENTS.md small anyway, so also require that no
  // pack needs it: the primary stays inline in AGENTS.md.
  it.each(codexPacks)('%s keeps its primary inline in an AGENTS.md within 32 KiB', (pack) => {
    const manifest = loadManifest(join(packsRoot, pack))
    const primary = manifest.instructions.find(({ role }) => role === 'primary')
    const plan = buildPlan(join(packsRoot, pack), 'codex', { includeSkills: false })
    const agents = plan.find(({ path }) => path === 'AGENTS.md')
    expect(plan.find(({ path }) => path === `.codex/instructions/${primary.file}`)).toBeUndefined()
    expect(Buffer.byteLength(agents.content, 'utf8')).toBeLessThanOrEqual(32 * 1024)
  })
})

describe('cursor: every pack writes rule frontmatter that parses as strict YAML', () => {
  const packsRoot = join(repoRoot, 'packs')
  const cursorPacks = listPacks(packsRoot).filter((pack) => {
    const manifest = loadManifest(join(packsRoot, pack))
    return manifest.schemaVersion !== 2 || manifest.distribution.targets.includes('cursor')
  })

  it('includes the description with ": " in it', () => {
    const manifest = loadManifest(join(packsRoot, 'cots-rewrite-on-cloudnative'))
    const rule = manifest.instructions.find(({ file }) => file === 'requirements-traceability.md')
    expect(rule.description).toContain(': ')
  })

  it.each(cursorPacks)('%s', (pack) => {
    const manifest = loadManifest(join(packsRoot, pack))
    const plan = buildPlan(join(packsRoot, pack), 'cursor', { includeSkills: false })
    for (const instruction of manifest.instructions) {
      const path = `.cursor/rules/${instruction.file.replace(/\.md$/, '')}.mdc`
      const content = plan.find((write) => write.path === path).content
      const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/)[1]
      const parsed = parseYaml(frontmatter, { strict: true, uniqueKeys: true })
      if (instruction.role === 'primary' || instruction.load === 'always') {
        expect(parsed, path).toEqual({ alwaysApply: true })
      } else {
        expect(parsed, path).toEqual({
          description: instruction.description ?? instruction.file.replace(/\.md$/, ''),
          alwaysApply: false,
        })
      }
    }
  })
})
