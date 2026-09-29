import { readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOTS = {
  kiro: '.kiro/skills',
  'claude-code': '.claude/skills',
  copilot: '.github/skills',
  cursor: '.cursor/skills',
}

// The shared skill library is a sibling of the packs root at the repo root.
// Walk up from the pack dir until we find it, so resolution works whether packs
// live at <repo>/<pack> or <repo>/packs/<pack>. Tests that create a temp pack
// with a local skills/ dir never reach here (the shadow path wins).
function findLibrary(packDir) {
  let dir = resolve(packDir, '..')
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'skills-library')
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return join(resolve(packDir, '..'), 'skills-library') // best-effort fallback
}

// Resolve each requested skill to a source directory, then plan a copy into the
// tool's skills root. Resolution order per skill:
//   1. pack-local skills/<name>  (a deliberate per-pack override / "shadow")
//   2. skills-library/<name>     (the shared canonical copy)
// manifest.skills is normally an explicit list; the legacy value "all" means
// "every dir in the pack-local skills/", used only by unit tests / local packs.
export function planSkills(packDir, manifest, tool, { libraryDir } = {}) {
  const root = ROOTS[tool]
  if (!root) throw new Error(`unknown tool: ${tool}`)

  const localSkillsDir = join(packDir, 'skills')
  const lib = libraryDir ?? findLibrary(packDir)

  let names
  if (manifest.skills === 'all' || manifest.skills === undefined) {
    names = existsSync(localSkillsDir)
      ? readdirSync(localSkillsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : []
  } else {
    names = manifest.skills
  }

  return names.map((n) => {
    const local = join(localSkillsDir, n)
    const source = existsSync(local) ? local : join(lib, n)
    if (!existsSync(source)) {
      throw new Error(`skill not found in pack or library: ${n} (looked in ${local} and ${join(lib, n)})`)
    }
    return { path: `${root}/${n}`, content: source, kind: 'copy' }
  })
}
