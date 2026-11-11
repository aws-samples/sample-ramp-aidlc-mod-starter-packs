// Customer-layout equivalence: every file a customer project receives from a
// release bundle, `ramp-pack init`, add-skills.sh or add-skills.ps1 must match
// the committed baseline (fixtures/customer-layout-baseline.json), captured
// before the skills-namespace migration by scripts/capture-customer-layout.mjs.
//
// npm test samples one target tool per pack. The CI verify job runs the full
// matrix with RAMP_CUSTOMER_LAYOUT=full and RAMP_REQUIRE_POWERSHELL=pwsh, so a
// missing skill cache or PowerShell engine fails there instead of skipping.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  POWERSHELL,
  computeLayout,
  createLayoutContext,
  layoutDifferences,
  layoutSpecs,
  powerShellAvailable,
  readBaseline,
} from './support/customer-layout.js'

// Allowed differences from the baseline, keyed by a short reason. Each rule is
// { change: 'added' | 'removed' | 'changed', match: RegExp over '<layout id> <path>' }.
const ALLOWLIST = {}

const full = process.env.RAMP_CUSTOMER_LAYOUT === 'full'
const cacheDir = process.env.RAMP_SKILLS_CACHE?.trim() || undefined
const powerShellRequired = (process.env.RAMP_REQUIRE_POWERSHELL ?? '')
  .split(',')
  .map((name) => name.trim())
  .includes(POWERSHELL)
const powerShell = powerShellAvailable()
const baseline = readBaseline()
const FIRST_DIFFERENCES = 10

describe('customer-layout baseline', () => {
  it('records every route, pack and target tool, and nothing else', () => {
    expect(Object.keys(baseline)).toEqual(layoutSpecs().map((spec) => spec.id))
  })

  it('keeps every allowlist rule well formed', () => {
    for (const [reason, rule] of Object.entries(ALLOWLIST)) {
      expect(['added', 'removed', 'changed'], reason).toContain(rule.change)
      expect(rule.match, reason).toBeInstanceOf(RegExp)
    }
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
      const differences = layoutDifferences(id, baseline[id], await computeLayout(context, spec), ALLOWLIST)
      expect(
        differences.length,
        `${id} differs from the baseline in ${differences.length} path(s); first:\n  ` +
          differences.slice(0, FIRST_DIFFERENCES).join('\n  '),
      ).toBe(0)
    }, 180_000)
  },
)
