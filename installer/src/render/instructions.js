import { readFileSync, existsSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { getAdapter } from '../adapters/index.js'

// Shared instruction defaults live in <repo>/common/instructions/. A pack may
// omit an instruction file it declares in pack.yaml and inherit the common
// default (e.g. the shared reverse-engineering playbook); a pack that ships its
// own copy overrides it. Walk up from the pack dir so this works whether packs
// live at <repo>/<pack> or <repo>/packs/<pack>.
function findCommon(packDir) {
  let dir = resolve(packDir, '..')
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'common')
    if (existsSync(join(candidate, 'instructions'))) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(resolve(packDir, '..'), 'common') // best-effort fallback
}

// Resolve an instruction file: pack-local first (override), else common default.
function resolveInstruction(packDir, file) {
  const local = join(packDir, 'instructions', file)
  if (existsSync(local)) return local
  const shared = join(findCommon(packDir), 'instructions', file)
  if (existsSync(shared)) return shared
  throw new Error(`instruction not found in pack or common/: ${file}`)
}

// Read an instruction body, trimming surrounding blank lines. Neutral sources
// can carry a leading blank line (left behind when Kiro frontmatter is stripped);
// trimming keeps every tool's output starting on real content. Also substitutes
// workspace tokens (`{{SPEC_DIR}}` and `{{STATE_DIR}}`).
const body = (packDir, file, workspace) => {
  const raw = readFileSync(resolveInstruction(packDir, file), 'utf8').trim() + '\n'
  return raw
    .replaceAll('{{SPEC_DIR}}', workspace.specRoot)
    .replaceAll('{{STATE_DIR}}', workspace.stateRoot)
}
const stem = (file) => basename(file, '.md')

export function renderInstructions(manifest, packDir, tool, workspace) {
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
      content: `---\ninclusion: ${i.load}\n---\n${body(packDir, i.file, resolvedWorkspace)}`,
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
      content: header + body(packDir, primary.file, resolvedWorkspace),
      kind: 'text',
    }]
    for (const c of companions) {
      writes.push({
        path: instructions.companionPath(c.file),
        content: body(packDir, c.file, resolvedWorkspace),
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
        content: body(packDir, primary.file, resolvedWorkspace),
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
        content: fm + body(packDir, c.file, resolvedWorkspace),
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
      content: `---\nalwaysApply: ${i.role === 'primary'}\n---\n${body(packDir, i.file, resolvedWorkspace)}`,
      kind: 'text',
    }))
  }

  throw new Error(`unsupported instruction adapter kind: ${instructions.kind}`)
}
