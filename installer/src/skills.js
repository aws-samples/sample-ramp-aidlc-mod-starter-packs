import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = {
  kiro: '.kiro/skills',
  'claude-code': '.claude/skills',
  copilot: '.github/skills',
  cursor: '.cursor/skills',
}

export function planSkills(packDir, manifest, tool) {
  const root = ROOTS[tool]
  if (!root) throw new Error(`unknown tool: ${tool}`)
  const skillsDir = join(packDir, 'skills')

  let names
  if (manifest.skills === 'all' || manifest.skills === undefined) {
    names = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } else {
    names = manifest.skills
    for (const n of names) {
      if (!existsSync(join(skillsDir, n))) throw new Error(`skill not found in pack: ${n}`)
    }
  }

  return names.map((n) => ({
    path: `${root}/${n}`,
    content: join(skillsDir, n),
    kind: 'copy',
  }))
}
