import {
  chmodSync,
  readdirSync,
  existsSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { buildPlan } from './plan.js'
import { applyPlan } from './apply.js'
import { loadManifest } from './manifest.js'
import {
  renderAddSkillsBash,
  renderAddSkillsPowerShell,
} from './render/add-skills.js'
import { listAdapterIds } from './adapters/index.js'
import { resolveWorkspace } from './workspace.js'
import { createSkillResolver } from './dependencies/resolver.js'

export const TOOLS = listAdapterIds()

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
// Model C: the committed scaffolds are steering-only (no skills) plus
// generated, editable Bash and PowerShell helpers for installing skills.
// - includeSkills=false (default): lean scaffold + both add-skills helpers
// - includeSkills=true: also copy skills (full preview, e.g. for local checks)
// - inPlace=true: write to <repo>/packs/<pack>/scaffolded-packs/<tool>/ and
//   both helpers at the pack root (the committed layout)
// - inPlace=false: write tool folders and both helpers below <outDir>/<pack>/
export function buildAll({
  packsRoot,
  repoRoot = resolve(packsRoot, '..'),
  cacheDir,
  outDir,
  pack,
  tools = TOOLS,
  includeSkills = false,
  emitSkillScript = true,
  inPlace = false,
  profile,
  workspaceMode,
  specRoot,
  stateRoot,
}) {
  const packs = pack ? [pack] : listPacks(packsRoot)
  if (packs.length === 0) throw new Error(`no packs found under ${packsRoot}`)
  const resolver = includeSkills
    ? createSkillResolver({
        repoRoot,
        ...(cacheDir !== undefined ? { cacheDir } : {}),
        allowLegacyLocal: true,
        strictProvenance: false,
      })
    : null
  const results = []
  for (const p of packs) {
    const packDir = join(packsRoot, p)
    if (!existsSync(join(packDir, 'pack.yaml'))) throw new Error(`not a pack (no pack.yaml): ${p}`)
    const manifest = loadManifest(packDir)
    resolveWorkspace(manifest, { tools })
    const usesSharedResolution =
      profile !== undefined ||
      workspaceMode !== undefined ||
      specRoot !== undefined ||
      stateRoot !== undefined
    const sharedWorkspace = usesSharedResolution
      ? resolveWorkspace(manifest, { tools, profile, workspaceMode, specRoot, stateRoot })
      : null
    const plans = tools.map((tool) => ({
      tool,
      plan: buildPlan(packDir, tool, {
        includeSkills,
        ...(resolver ? { resolver } : {}),
        ...(sharedWorkspace ? { workspace: sharedWorkspace } : {}),
      }),
    }))

    const packOut = inPlace ? join(packDir, 'scaffolded-packs') : join(outDir, p)
    if (inPlace) rmSync(packOut, { recursive: true, force: true }) // clean rebuild of committed scaffolds

    for (const { tool, plan } of plans) {
      const target = join(packOut, tool)
      rmSync(target, { recursive: true, force: true })
      const written = applyPlan(plan, target, { dryRun: false, force: true })
      results.push({ pack: p, tool, count: written.length })
    }

    if (emitSkillScript) {
      // Committed layout: add-skills.sh sits at the pack root, a sibling of
      // scaffolded-packs/. In --out preview mode it sits beside the tool folders.
      const scriptDir = inPlace ? packDir : join(outDir, p)
      mkdirSync(scriptDir, { recursive: true })
      const bashPath = join(scriptDir, 'add-skills.sh')
      const powerShellPath = join(scriptDir, 'add-skills.ps1')
      writeFileSync(bashPath, renderAddSkillsBash(manifest), { mode: 0o755 })
      writeFileSync(
        powerShellPath,
        renderAddSkillsPowerShell(manifest),
        { mode: 0o644 },
      )
      if (process.platform !== 'win32') {
        chmodSync(bashPath, 0o755)
        chmodSync(powerShellPath, 0o644)
      }
      results.push({ pack: p, tool: 'add-skills.sh', count: 1 })
      results.push({ pack: p, tool: 'add-skills.ps1', count: 1 })
    }
  }
  return results
}
