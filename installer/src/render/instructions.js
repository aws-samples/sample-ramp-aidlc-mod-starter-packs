import { readFileSync } from 'node:fs'
import { join, basename } from 'node:path'

// Read an instruction body, trimming surrounding blank lines. Neutral sources
// can carry a leading blank line (left behind when Kiro frontmatter is stripped);
// trimming keeps every tool's output starting on real content.
const body = (packDir, file) => readFileSync(join(packDir, 'instructions', file), 'utf8').trim() + '\n'
const stem = (file) => basename(file, '.md')

export function renderInstructions(manifest, packDir, tool) {
  const primary = manifest.instructions.find((i) => i.role === 'primary')
  const companions = manifest.instructions.filter((i) => i.role === 'companion')

  if (tool === 'kiro') {
    return manifest.instructions.map((i) => ({
      path: `.kiro/steering/${i.file}`,
      content: `---\ninclusion: ${i.load}\n---\n${body(packDir, i.file)}`,
      kind: 'text',
    }))
  }

  if (tool === 'claude-code') {
    const header = companions.length
      ? 'Companion rules files load automatically and MUST be followed:\n' +
        companions.map((c) => `- \`.claude/rules/${c.file}\``).join('\n') +
        '\n\n'
      : ''
    const writes = [{ path: 'CLAUDE.md', content: header + body(packDir, primary.file), kind: 'text' }]
    for (const c of companions) {
      writes.push({ path: `.claude/rules/${c.file}`, content: body(packDir, c.file), kind: 'text' })
    }
    return writes
  }

  if (tool === 'copilot') {
    // Primary → the always-on repo-wide instructions file (kept lean).
    // Companions → separate .github/instructions/*.instructions.md files, so the
    // always-on file is not bloated. `applyTo: '**'` mirrors load:always;
    // omitting applyTo mirrors load:auto (Copilot applies it conditionally).
    const writes = [
      { path: '.github/copilot-instructions.md', content: body(packDir, primary.file), kind: 'text' },
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
        path: `.github/instructions/${stem(c.file)}.instructions.md`,
        content: fm + body(packDir, c.file),
        kind: 'text',
      })
    }
    return writes
  }

  if (tool === 'cursor') {
    return manifest.instructions.map((i) => ({
      path: `.cursor/rules/${stem(i.file)}.mdc`,
      content: `---\nalwaysApply: ${i.role === 'primary'}\n---\n${body(packDir, i.file)}`,
      kind: 'text',
    }))
  }

  throw new Error(`unknown tool: ${tool}`)
}
