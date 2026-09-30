import { readdirSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPlan } from './plan.js'
import { applyPlan } from './apply.js'
import { loadManifest } from './manifest.js'
import { renderAddSkills } from './render/add-skills.js'

export const TOOLS = ['kiro', 'claude-code', 'copilot', 'cursor']

// Discover packs: any direct child of packsRoot containing a pack.yaml.
export function listPacks(packsRoot) {
  return readdirSync(packsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(packsRoot, name, 'pack.yaml')))
    .sort()
}

// Regenerate per-tool output for one pack (or all) from source.
//
// Model C: the committed scaffolds are steering-only (no skills) plus a
// generated, editable add-skills.sh that ports skills from skills-library/.
// - includeSkills=false (default): lean scaffold + add-skills.sh
// - includeSkills=true: also copy skills (full preview, e.g. for local checks)
// - inPlace=true: write to <repo>/packs/<pack>/scaffolded-packs/<tool>/ and
//   .../scaffolded-packs/add-skills.sh (the committed layout)
// - inPlace=false: write to <outDir>/<pack>/<tool>/ + <outDir>/<pack>/add-skills.sh
export function buildAll({
  packsRoot,
  outDir,
  pack,
  tools = TOOLS,
  includeSkills = false,
  emitSkillScript = true,
  inPlace = false,
}) {
  const packs = pack ? [pack] : listPacks(packsRoot)
  if (packs.length === 0) throw new Error(`no packs found under ${packsRoot}`)
  const results = []
  for (const p of packs) {
    const packDir = join(packsRoot, p)
    if (!existsSync(join(packDir, 'pack.yaml'))) throw new Error(`not a pack (no pack.yaml): ${p}`)

    const packOut = inPlace ? join(packDir, 'scaffolded-packs') : join(outDir, p)
    if (inPlace) rmSync(packOut, { recursive: true, force: true }) // clean rebuild of committed scaffolds

    for (const tool of tools) {
      const target = join(packOut, tool)
      rmSync(target, { recursive: true, force: true })
      const written = applyPlan(buildPlan(packDir, tool, { includeSkills }), target, { dryRun: false, force: true })
      results.push({ pack: p, tool, count: written.length })
    }

    if (emitSkillScript) {
      const manifest = loadManifest(packDir)
      const scriptPath = join(packOut, 'add-skills.sh')
      mkdirSync(packOut, { recursive: true })
      writeFileSync(scriptPath, renderAddSkills(manifest), { mode: 0o755 })
      results.push({ pack: p, tool: 'add-skills.sh', count: 1 })
    }
  }
  return results
}
