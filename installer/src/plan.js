import { loadManifest } from './manifest.js'
import { renderInstructions } from './render/instructions.js'
import { renderMcp } from './render/mcp.js'
import { renderCommand } from './render/command.js'
import { planSkills } from './skills.js'
import { resolveWorkspace } from './workspace.js'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readOrdinaryFile } from './release/entries.js'

const moduleRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GENERATOR_INPUTS = [
  'installer/package.json',
  'installer/package-lock.json',
  'installer/src/plan.js',
  'installer/src/manifest.js',
  'installer/src/workspace.js',
  'installer/src/skills.js',
  'installer/src/adapters/index.js',
  'installer/src/render/instructions.js',
  'installer/src/render/mcp.js',
  'installer/src/render/command.js',
  'installer/src/instructions/compose.js',
  'installer/src/instructions/tokens.js',
  'installer/src/dependencies/checksum.js',
  'installer/src/dependencies/manifests.js',
  'installer/src/dependencies/resolver.js',
  'installer/src/dependencies/git-snapshot.js',
]

function recordGeneratorInputs(root, tool, onInput) {
  if (!onInput) return
  for (const path of [
    ...GENERATOR_INPUTS,
    `installer/src/adapters/${tool}.js`,
  ]) {
    const absolutePath = join(root, ...path.split('/'))
    const bytes = readOrdinaryFile(absolutePath, {
      label: `generator input ${path}`,
      trustedRoot: root,
    }).bytes
    const runtimeBytes = readOrdinaryFile(
      join(moduleRepoRoot, ...path.split('/')),
      {
        label: `executing generator input ${path}`,
        trustedRoot: moduleRepoRoot,
      },
    ).bytes
    if (!bytes.equals(runtimeBytes)) {
      throw new Error(
        `generator input ${path} does not match the executing RAMP generator`,
      )
    }
    onInput({
      absolutePath,
      role: 'generator',
      bytes: Buffer.from(bytes),
    })
  }
}

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
    onInput,
  } = {},
) {
  if (onInput !== undefined && typeof onInput !== 'function') {
    throw new Error('buildPlan onInput must be a function')
  }
  recordGeneratorInputs(repoRoot ? resolve(repoRoot) : moduleRepoRoot, tool, onInput)
  const manifest = loadManifest(packDir, { onInput })
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
    ...renderInstructions(
      manifest,
      packDir,
      tool,
      resolvedWorkspace,
      { onInput },
    ),
    renderMcp(manifest, tool),
    renderCommand(manifest, tool),
  ].filter(Boolean)
}
