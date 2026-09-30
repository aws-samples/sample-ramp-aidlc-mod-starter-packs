import { loadManifest } from './manifest.js'
import { renderInstructions } from './render/instructions.js'
import { renderMcp } from './render/mcp.js'
import { renderCommand } from './render/command.js'
import { planSkills } from './skills.js'

// Build the write-plan for a pack + tool.
// includeSkills=true (default) copies the pack's skills into the tool's skills
// dir — used by `init` for a full local install. Set false for the committed
// scaffolds, where skills are ported separately by the generated add-skills.sh
// (keeps the committed output tiny and avoids re-forking the skill library).
export function buildPlan(packDir, tool, { includeSkills = true } = {}) {
  const manifest = loadManifest(packDir)
  return [
    ...(includeSkills ? planSkills(packDir, manifest, tool) : []),
    ...renderInstructions(manifest, packDir, tool),
    renderMcp(manifest, tool),
    renderCommand(manifest, tool),
  ].filter(Boolean)
}
