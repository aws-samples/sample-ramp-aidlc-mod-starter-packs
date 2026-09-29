import { readdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildPlan } from './plan.js'
import { applyPlan } from './apply.js'

export const TOOLS = ['kiro', 'claude-code', 'copilot', 'cursor']

// Discover packs: any direct child of packsRoot containing a pack.yaml.
// Mirrors the guard in bin/ramp-pack.js so non-pack dirs (installer/, docs/,
// skills-library/, common/, a generated dist/) are never treated as packs.
export function listPacks(packsRoot) {
  return readdirSync(packsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(packsRoot, name, 'pack.yaml')))
    .sort()
}

// Render one pack (or all) for every tool into <outDir>/<pack>/<tool>/.
// This is the deterministic, from-source regeneration of what used to be the
// committed scaffolded-packs/ tree. CI publishes <outDir> to gh-pages; humans
// who hand-edit a pack run it locally to preview per-tool output.
export function buildAll({ packsRoot, outDir, pack, tools = TOOLS }) {
  const packs = pack ? [pack] : listPacks(packsRoot)
  if (packs.length === 0) throw new Error(`no packs found under ${packsRoot}`)
  const results = []
  for (const p of packs) {
    const packDir = join(packsRoot, p)
    if (!existsSync(join(packDir, 'pack.yaml'))) {
      throw new Error(`not a pack (no pack.yaml): ${p}`)
    }
    for (const tool of tools) {
      const target = join(outDir, p, tool)
      rmSync(target, { recursive: true, force: true }) // idempotent rebuild
      const written = applyPlan(buildPlan(packDir, tool), target, { dryRun: false, force: true })
      results.push({ pack: p, tool, count: written.length })
    }
  }
  return results
}
