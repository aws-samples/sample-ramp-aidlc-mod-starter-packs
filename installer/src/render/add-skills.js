import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const BASH_TEMPLATE = join(here, 'add-skills.template.sh')
const POWERSHELL_TEMPLATE = join(here, 'add-skills.template.ps1')
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validatedInput(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest must be an object')
  }
  if (typeof manifest.name !== 'string' || !IDENTIFIER.test(manifest.name)) {
    throw new Error('pack name must be a lower-kebab identifier')
  }
  if (!Array.isArray(manifest.skills)) {
    throw new Error('manifest skills must be an array')
  }
  const seen = new Set()
  for (const name of manifest.skills) {
    if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
      throw new Error(`skill name must be a lower-kebab identifier: ${name}`)
    }
    if (seen.has(name)) throw new Error(`duplicate skill name: ${name}`)
    seen.add(name)
  }
  return { packName: manifest.name, skills: [...manifest.skills] }
}

function renderTemplate(path, replacements) {
  let rendered = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
  for (const [token, value] of Object.entries(replacements)) {
    const occurrences = rendered.split(token).length - 1
    if (occurrences !== 1) {
      throw new Error(`template must contain exactly one ${token} token`)
    }
    rendered = rendered.replace(token, value)
  }
  const remaining = rendered.match(/__(?:PACK_NAME|SKILLS_BASH|SKILLS_POWERSHELL)__/)
  if (remaining) throw new Error(`unreplaced template token: ${remaining[0]}`)
  return rendered.replace(/\n*$/, '\n')
}

export function renderAddSkillsBash(manifest) {
  const { packName, skills } = validatedInput(manifest)
  return renderTemplate(BASH_TEMPLATE, {
    __PACK_NAME__: packName,
    __SKILLS_BASH__: skills.map((name) => `  ${name}`).join('\n'),
  })
}

export function renderAddSkillsPowerShell(manifest) {
  const { packName, skills } = validatedInput(manifest)
  return renderTemplate(POWERSHELL_TEMPLATE, {
    __PACK_NAME__: packName,
    __SKILLS_POWERSHELL__: skills.map((name) => `  '${name}'`).join('\n'),
  })
}

export const renderAddSkills = renderAddSkillsBash
