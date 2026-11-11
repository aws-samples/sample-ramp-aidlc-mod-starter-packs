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
    // The primary and load:always companions apply to every request. A
    // load:auto companion carries a description, so the Cursor agent can
    // request it when the description applies. A JSON string is a valid YAML
    // double-quoted scalar, so a description holding ': ' still parses.
    return manifest.instructions.map((i) => {
      const fm = i.role === 'primary' || i.load === 'always'
        ? '---\nalwaysApply: true\n---\n'
        : `---\ndescription: ${JSON.stringify(i.description ?? stem(i.file))}\nalwaysApply: false\n---\n`
      return {
        path: i.role === 'primary'
          ? instructions.primaryPath(i.file)
          : instructions.companionPath(i.file),
        content: fm + body(manifest, packDir, i.file, tool, resolvedWorkspace, options),
        kind: 'text',
      }
    })
  }

  if (instructions.kind === 'codex-agents') {
    // Codex loads only AGENTS.md, so AGENTS.md opens with a header naming every
    // other instruction file and when to read it, each on one line.
    const header = (entries) =>
      'Codex loads only this file. Read each instruction file below and follow it:\n' +
      entries.map(([path, when]) => `- \`${path}\`: ${when}`).join('\n') +
      '\n'
    const companionEntries = companions.map((c) => [
      instructions.companionPath(c.file),
      c.load === 'always'
        ? 'read at session start.'
        : `read when this applies: ${(c.description ?? stem(c.file)).replace(/\s+/g, ' ').trim()}`,
    ])
    // Read every source once; tokens naming the primary resolve to wherever
    // the primary ends up.
    const sources = [primary, ...companions].map((i) =>
      resolveInstructionBody(manifest, packDir, i.file, options))
    const render = (primaryPath) => sources.map((raw) => applyInstructionTokens(
      raw.replaceAll(`{{INSTRUCTION:${primary.file}}}`, primaryPath),
      { manifest, tool, workspace: resolvedWorkspace },
    ))
    const companionWrites = (bodies) => companions.map((c, index) => ({
      path: instructions.companionPath(c.file),
      content: bodies[index],
      kind: 'text',
    }))

    const [primaryBody, ...companionBodies] = render(instructions.primaryPath(primary.file))
    const agents = companionEntries.length
      ? `${header(companionEntries)}\n${primaryBody}`
      : primaryBody
    if (Buffer.byteLength(agents, 'utf8') <= instructions.maxPrimaryBytes) {
      return [
        { path: instructions.primaryPath(primary.file), content: agents, kind: 'text' },
        ...companionWrites(companionBodies),
      ]
    }
    // Codex would cut the primary off at its byte limit, so the primary moves
    // beside the companions and AGENTS.md keeps only the header.
    const movedPrimary = instructions.companionPath(primary.file)
    const shortAgents = header([[movedPrimary, 'read first, at session start.'], ...companionEntries])
    const shortBytes = Buffer.byteLength(shortAgents, 'utf8')
    if (shortBytes > instructions.maxPrimaryBytes) {
      throw new Error(
        `Codex AGENTS.md header alone is ${shortBytes} bytes, over the ${instructions.maxPrimaryBytes}-byte limit`,
      )
    }
    const [movedBody, ...movedCompanionBodies] = render(movedPrimary)
    return [
      { path: instructions.primaryPath(primary.file), content: shortAgents, kind: 'text' },
      { path: movedPrimary, content: movedBody, kind: 'text' },
      ...companionWrites(movedCompanionBodies),
    ]
  }

  throw new Error(`unsupported instruction adapter kind: ${instructions.kind}`)
}
