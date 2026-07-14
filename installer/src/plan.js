import { loadManifest } from './manifest.js'
import { renderInstructions } from './render/instructions.js'
import { renderMcp } from './render/mcp.js'
import { renderCommand } from './render/command.js'
import { planSkills } from './skills.js'

export function buildPlan(packDir, tool) {
  const manifest = loadManifest(packDir)
  return [
    ...planSkills(packDir, manifest, tool),
    ...renderInstructions(manifest, packDir, tool),
    renderMcp(manifest, tool),
    renderCommand(manifest, tool),
  ].filter(Boolean)
}
