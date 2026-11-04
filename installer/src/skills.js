import { readdirSync, existsSync, lstatSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { getAdapter } from './adapters/index.js'
import { createSkillResolver } from './dependencies/resolver.js'

function findRepoRoot(packDir) {
  const ancestors = []
  let current = resolve(packDir)
  while (true) {
    ancestors.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  for (const ancestor of ancestors) {
    if (existsSync(join(ancestor, 'dependencies', 'skills.sources.yaml'))) {
      return ancestor
    }
  }
  for (const ancestor of ancestors) {
    if (existsSync(join(ancestor, 'skills-library'))) return ancestor
  }
  return resolve(packDir, '..')
}

function listPackLocalSkills(localSkillsDir) {
  let status
  try {
    status = lstatSync(localSkillsDir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw new Error(
      `pack-local skills root could not be inspected: ${error.message}`,
    )
  }
  if (status.isSymbolicLink()) {
    throw new Error(
      `pack-local skills root must not be a symbolic link: ${localSkillsDir}`,
    )
  }
  if (!status.isDirectory()) {
    throw new Error(
      `pack-local skills root must be a directory: ${localSkillsDir}`,
    )
  }
  return readdirSync(localSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

// manifest.skills is normally an explicit list; the legacy value "all" means
// "every dir in the pack-local skills/", used only by unit tests / local packs.
export function planSkills(
  packDir,
  manifest,
  tool,
  {
    resolver,
    repoRoot,
    cacheDir,
    libraryDir,
  } = {},
) {
  const root = getAdapter(tool).skillsRoot
  const localSkillsDir = join(packDir, 'skills')
  const selectedResolver =
    resolver ??
    createSkillResolver({
      repoRoot: repoRoot ?? findRepoRoot(packDir),
      ...(cacheDir !== undefined ? { cacheDir } : {}),
      ...(libraryDir !== undefined ? { libraryDir } : {}),
    })

  let names
  if (manifest.skills === 'all' || manifest.skills === undefined) {
    names = listPackLocalSkills(localSkillsDir)
  } else {
    names = manifest.skills
  }

  return names.map((name) => {
    const resolved = selectedResolver.resolveSkill(name, {
      packDir,
      packId: manifest.name ?? basename(packDir),
    })
    return {
      path: `${root}/${name}`,
      content: resolved.directory,
      kind: 'copy',
      provenance: resolved.provenance,
    }
  })
}
