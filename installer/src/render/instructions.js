import { basename } from 'node:path'
import { getAdapter } from '../adapters/index.js'
import { resolveInstructionBody } from '../instructions/compose.js'
import { applyInstructionTokens } from '../instructions/tokens.js'

// Read an instruction body, trimming surrounding blank lines. Neutral sources
// can carry a leading blank line (left behind when Kiro frontmatter is stripped);
// trimming keeps every tool's output starting on real content. Also substitutes
// workspace tokens (`{{SPEC_DIR}}` and `{{STATE_DIR}}`).
const body = (manifest, packDir, file, tool, workspace, options) => {
  const raw = resolveInstructionBody(manifest, packDir, file, options)
  return applyInstructionTokens(raw, { manifest, tool, workspace })
}
const stem = (file) => basename(file, '.md')

export function renderInstructions(
  manifest,
  packDir,
  tool,
  workspace,
  { onInput } = {},
) {
  if (onInput !== undefined && typeof onInput !== 'function') {
    throw new Error('renderInstructions onInput must be a function')
  }
  const options = { onInput }
  const adapter = getAdapter(tool)
  const instructions = adapter.instructions
  const resolvedWorkspace = workspace ?? {
    specRoot: adapter.defaultSpecRoot,
    stateRoot: 'aidlc-docs',
  }
  const primary = manifest.instructions.find((i) => i.role === 'primary')
  const companions = manifest.instructions.filter((i) => i.role === 'companion')

  if (instructions.kind === 'kiro-steering') {
    return manifest.instructions.map((i) => ({
      path: i.role === 'primary'
        ? instructions.primaryPath(i.file)
        : instructions.companionPath(i.file),
      content: `---\ninclusion: ${i.load}\n---\n${body(manifest, packDir, i.file, tool, resolvedWorkspace, options)}`,
      kind: 'text',
    }))
  }

  if (instructions.kind === 'claude-rules') {
    const header = companions.length
      ? 'Companion rules files load automatically and MUST be followed:\n' +
        companions.map((c) => `- \`${instructions.companionPath(c.file)}\``).join('\n') +
        '\n\n'
      : ''
    const writes = [{
      path: instructions.primaryPath(primary.file),
      content: header + body(manifest, packDir, primary.file, tool, resolvedWorkspace, options),
      kind: 'text',
    }]
    for (const c of companions) {
      writes.push({
        path: instructions.companionPath(c.file),
        content: body(manifest, packDir, c.file, tool, resolvedWorkspace, options),
        kind: 'text',
      })
    }
    return writes
  }

  if (instructions.kind === 'copilot-instructions') {
    // Primary → the always-on repo-wide instructions file (kept lean).
    // Companions → separate .github/instructions/*.instructions.md files, so the
    // always-on file is not bloated. `applyTo: '**'` mirrors load:always;
    // omitting applyTo mirrors load:auto (Copilot applies it conditionally).
    const writes = [
      {
        path: instructions.primaryPath(primary.file),
        content: body(manifest, packDir, primary.file, tool, resolvedWorkspace, options),
        kind: 'text',
      },
    ]
    for (const c of companions) {
      // load:always → applyTo:'**' (attached to every request).
      // load:auto  → no applyTo (conditional); a rich description drives Copilot's
      //              semantic matching, so prefer the manifest description over the bare filename.
      const fm =
        c.load === 'always'
          ? `---\napplyTo: '**'\n---\n`
          : `---\ndescription: ${c.description ?? stem(c.file)}\n---\n`
      writes.push({
        path: instructions.companionPath(c.file),
        content: fm + body(manifest, packDir, c.file, tool, resolvedWorkspace, options),
        kind: 'text',
      })
    }
    return writes
  }

  if (instructions.kind === 'cursor-rules') {
    return manifest.instructions.map((i) => ({
      path: i.role === 'primary'
        ? instructions.primaryPath(i.file)
        : instructions.companionPath(i.file),
      content: `---\nalwaysApply: ${i.role === 'primary'}\n---\n${body(manifest, packDir, i.file, tool, resolvedWorkspace, options)}`,
      kind: 'text',
    }))
  }

  throw new Error(`unsupported instruction adapter kind: ${instructions.kind}`)
}
