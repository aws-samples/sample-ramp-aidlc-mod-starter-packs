import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(here, 'add-skills.template.sh')

// Render the per-pack add-skills.sh: an editable bash script that copies this
// pack's skills from skills-library/ into a project, with no Node dependency.
// The SKILLS list is seeded from the pack manifest so it stays in sync with
// pack.yaml, but users can freely edit their copy.
export function renderAddSkills(manifest) {
  const names = Array.isArray(manifest.skills) ? manifest.skills : []
  const list = names.map((n) => `  ${n}`).join('\n')
  return readFileSync(TEMPLATE, 'utf8')
    .replaceAll('__PACK_NAME__', manifest.name ?? '')
    .replace('__SKILLS__', list)
}
