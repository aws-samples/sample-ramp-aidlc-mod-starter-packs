import { loadManifest } from './manifest.js'
import { renderInstructions } from './render/instructions.js'
import { renderMcp } from './render/mcp.js'
import { renderCommand } from './render/command.js'
import { planSkills } from './skills.js'
import { resolveWorkspace } from './workspace.js'

// Build the write-plan for a pack + tool.
// includeSkills=true (default) copies the pack's skills into the tool's skills
// dir — used by `init` for a full local install. Set false for the committed
// scaffolds, where skills are ported separately by the generated add-skills.sh
// (keeps the committed output tiny and avoids re-forking the skill library).
export function buildPlan(
  packDir,
  tool,
  {
    includeSkills = true,
    workspace,
    resolver,
    repoRoot,
    cacheDir,
  } = {},
) {
  const manifest = loadManifest(packDir)
  const resolvedWorkspace = workspace ?? resolveWorkspace(manifest, { tools: [tool] })
  if (!resolvedWorkspace.tools?.includes(tool)) {
    throw new Error(`workspace does not include tool: ${tool}`)
  }
  return [
    ...(includeSkills
      ? planSkills(packDir, manifest, tool, {
          resolver,
          repoRoot,
          cacheDir,
        })
      : []),
    ...renderInstructions(manifest, packDir, tool, resolvedWorkspace),
    renderMcp(manifest, tool),
    renderCommand(manifest, tool),
  ].filter(Boolean)
}
