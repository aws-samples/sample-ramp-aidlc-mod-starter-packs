// Customer-layout equivalence: every file a customer project receives from a
// release bundle, `ramp-pack init`, add-skills.sh or add-skills.ps1 must match
// the committed baseline (fixtures/customer-layout-baseline.json), captured
// before the skills-namespace migration by scripts/capture-customer-layout.mjs.
//
// npm test samples one target tool per pack. The CI verify job runs the full
// matrix with RAMP_CUSTOMER_LAYOUT=full and RAMP_REQUIRE_POWERSHELL=pwsh, so a
// missing skill cache or PowerShell engine fails there instead of skipping.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  POWERSHELL,
  addToBaseline,
  allowlistProblems,
  computeLayout,
  createLayoutContext,
  layoutDifferences,
  layoutSpecs,
  powerShellAvailable,
  readBaseline,
  renderBaseline,
} from './support/customer-layout.js'

// Allowed differences from the baseline, keyed by a short reason. Each rule is
// { change: 'added' | 'removed' | 'changed', match: RegExp over '<layout id> <path>' }
// without the g or y flag. The full matrix fails on a rule that never matched.
//
// Cursor rules honour each instruction's load: a load:always companion renders
// alwaysApply: true, and a load:auto companion its description. Only `init`
// writes the rules, so only the init/<pack>/cursor layouts change.
const CURSOR_RULE_CHANGES = {
  'agentic-ai-workflow': ['reverse-engineering'],
  'agentic-incident-response': ['reverse-engineering', 'skill-activation'],
  'api-platform-migration-n-modernization': ['reverse-engineering', 'skill-activation'],
  'cots-rewrite-on-cloudnative': ['requirements-traceability', 'reverse-engineering', 'skill-activation'],
  'dotnet-app-modernization-on-aws': ['reverse-engineering', 'skill-activation'],
  'framework-upgrade-containerise': ['reverse-engineering', 'skill-activation'],
  'genai-on-serverless': ['reverse-engineering', 'skill-activation'],
  'legacy-transformation-on-aws': ['reverse-engineering', 'skill-activation'],
  'ocr-mobile-app-on-serverless': ['reverse-engineering', 'skill-activation'],
  'qa-automated-testing': ['reverse-engineering', 'skill-activation'],
  'serverless-event-driven-on-aws': ['multi-repo-projects', 'practices-discovery', 'reverse-engineering', 'skill-activation'],
  'voice-ai-agent-on-aws': ['reverse-engineering', 'skill-activation'],
  'vulnerability-remediation-pipeline': ['reverse-engineering', 'skill-activation'],
  'web-app-on-cloudnative': ['multi-repo-projects', 'reverse-engineering', 'skill-activation'],
}
const ALLOWLIST = Object.fromEntries(
  Object.entries(CURSOR_RULE_CHANGES).flatMap(([pack, rules]) => rules.map((rule) => [
    `cursor rule load: ${pack} ${rule}.mdc`,
    { change: 'changed', match: new RegExp(`^init/${pack}/cursor \\.cursor/rules/${rule}\\.mdc$`) },
  ])),
)

const full = process.env.RAMP_CUSTOMER_LAYOUT === 'full'
const cacheDir = process.env.RAMP_SKILLS_CACHE?.trim() || undefined
const powerShellRequired = (process.env.RAMP_REQUIRE_POWERSHELL ?? '')
  .split(',')
  .map((name) => name.trim())
  .includes(POWERSHELL)
const powerShell = powerShellAvailable()
const baseline = readBaseline()
const FIRST_DIFFERENCES = 10
const matchedRules = new Set()
const record = (path) => ({ path, sha256: '0'.repeat(64), mode: '0644' })

function unusedRules(allowlist, matched) {
  return Object.keys(allowlist).filter((reason) => !matched.has(reason))
}

describe('customer-layout baseline', () => {
  it('records every route, pack and target tool, and nothing else', () => {
    expect(Object.keys(baseline)).toEqual(layoutSpecs().map((spec) => spec.id))
  })

  it('keeps every allowlist rule well formed', () => {
    expect(allowlistProblems(ALLOWLIST)).toEqual([])
  })

  it('rejects allowlist rules with the global or sticky flag', () => {
    expect(allowlistProblems({
      global: { change: 'removed', match: /skill\.yaml$/g },
      sticky: { change: 'removed', match: /skill\.yaml$/y },
      plain: { change: 'removed', match: /skill\.yaml$/ },
    })).toEqual([
      'global: match must not use the g or y flag',
      'sticky: match must not use the g or y flag',
    ])
  })

  it('reports an allowlist rule that never matched a difference', () => {
    const allowlist = {
      used: { change: 'removed', match: /^init\/demo\/kiro \.kiro\/skills\/a\/skill\.yaml$/ },
      stale: { change: 'removed', match: /never-present\.md$/ },
    }
    const matched = new Set()
    const expected = [record('.kiro/skills/a/SKILL.md'), record('.kiro/skills/a/skill.yaml')]
    const actual = [record('.kiro/skills/a/SKILL.md')]
    expect(layoutDifferences('init/demo/kiro', expected, actual, allowlist, matched)).toEqual([])
    expect(unusedRules(allowlist, matched)).toEqual(['stale'])
  })

  it('refuses an empty layout in the baseline', () => {
    expect(() => renderBaseline({ 'init/demo/kiro': [] })).toThrow(/init\/demo\/kiro is empty/)
    const root = mkdtempSync(join(tmpdir(), 'ramp-customer-layout-baseline-'))
    try {
      const path = join(root, 'baseline.json')
      writeFileSync(path, JSON.stringify({ schemaVersion: 1, layouts: { 'init/demo/kiro': [] } }))
      expect(() => readBaseline(path)).toThrow(/init\/demo\/kiro is empty/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('adds layouts without rewriting an existing entry', () => {
    const stored = [record('AGENTS.md')]
    const text = renderBaseline({ 'init/demo/kiro': stored, 'init/demo/zed': stored })
    const added = addToBaseline(text, {
      'init/demo/codex': stored,
      'init/demo/cursor': [record('.cursor/rules/a.mdc')],
    })

    // the new id sorts first, yet refers to the existing holder
    expect(JSON.parse(added).layouts).toEqual({
      'init/demo/codex': { sameAs: 'init/demo/kiro' },
      'init/demo/cursor': [record('.cursor/rules/a.mdc')],
      'init/demo/kiro': stored,
      'init/demo/zed': { sameAs: 'init/demo/kiro' },
    })
    expect(addToBaseline(text, {})).toBe(text)
    expect(() => addToBaseline(text, { 'init/demo/kiro': [record('CLAUDE.md')] }))
      .toThrow(/init\/demo\/kiro is already in the baseline/)
  })

  if (full) {
    it('has a synchronized skill cache', () => {
      expect(cacheDir, 'RAMP_SKILLS_CACHE must name the synchronized cache').toBeDefined()
    })
  } else if (cacheDir === undefined) {
    it.skip('set RAMP_SKILLS_CACHE to compare customer layouts', () => {})
  }
  if (powerShellRequired) {
    it(`${POWERSHELL} runs the PowerShell helper lists`, () => {
      expect(powerShell, `${POWERSHELL} must run on this runner`).toBe(true)
    })
  } else if (!powerShell) {
    it.skip(`${POWERSHELL} not found: PowerShell helper lists skipped (RAMP_REQUIRE_POWERSHELL=pwsh requires them)`, () => {})
  }
})

const specs = layoutSpecs({ sample: !full })
  .filter((spec) => powerShell || powerShellRequired || spec.route !== 'add-skills.ps1')

describe.skipIf(cacheDir === undefined)(
  `customer layout equals the baseline (${full ? 'full matrix' : 'one target tool per pack'})`,
  () => {
    let context
    beforeAll(() => {
      context = createLayoutContext({ cacheDir })
    })
    afterAll(() => context?.dispose())

    it.concurrent.each(specs.map((spec) => [spec.id, spec]))('%s', async (id, spec) => {
      const actual = await computeLayout(context, spec)
      expect(actual.length, `${id} recomputed an empty layout`).toBeGreaterThan(0)
      const differences = layoutDifferences(id, baseline[id], actual, ALLOWLIST, matchedRules)
      expect(
        differences.length,
        `${id} differs from the baseline in ${differences.length} path(s); first:\n  ` +
          differences.slice(0, FIRST_DIFFERENCES).join('\n  '),
      ).toBe(0)
    }, 180_000)

    // Runs after the concurrent layouts above. Only the full matrix sees every
    // layout, so only it can tell that a rule is stale or broader than needed.
    it.runIf(full)('uses every allowlist rule', () => {
      expect(unusedRules(ALLOWLIST, matchedRules), 'allowlist rules that matched no difference')
        .toEqual([])
    })
  },
)
