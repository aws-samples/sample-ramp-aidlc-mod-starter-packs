import {
  cpSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { loadSkillLock, skillMetadataView } from '../src/dependencies/manifests.js'
import { lintSkillMetadata, loadTaxonomy } from '../src/taxonomy.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const fixtures = join(here, 'fixtures', 'skill-lint')
const taxonomy = loadTaxonomy(repoRoot)

// The resolver's shared skill roots and the reserved names in skills/, as in
// catalog.js.
const SKILL_ROOTS = ['skills', 'skills/ramp', 'skills-library']
const RESERVED_SKILL_SLUGS = new Set(['ramp', 'README.md', 'taxonomy'])
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

// Replaced terms from the "Terms" table of the skills namespace design that
// can be matched as text. "target", "profile", "overlay" and "shadow" also
// have correct uses, so only unambiguous phrases are listed.
const REPLACED_TERMS = [
  ['canonical lifecycle', 'Workflow'],
  ['common/instructions', 'Workflow'],
  ['workflow overlay', 'Workflow variant'],
  ['RAMP-owned', 'Skill origin'],
  ['compatibility library', 'Skill origin'],
  ['legacy-local', 'Skill origin'],
]
// Generated scaffolds and design records are not checked for terms.
const SKIPPED_PROSE = [/^packs\/[^/]+\/scaffolded-packs\//, /^docs\/design\//]

function portable(path) {
  return path.split(sep).join('/')
}

function isFile(path) {
  try {
    const status = lstatSync(path)
    return status.isFile() && !status.isSymbolicLink()
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function directoryNames(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function markdownFiles(directory) {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  return entries
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return markdownFiles(path)
      return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
    })
}

function readYaml(path) {
  return parse(readFileSync(path, 'utf8'))
}

function skillMarkdownName(directory) {
  const match = readFileSync(join(directory, 'SKILL.md'), 'utf8').match(FRONTMATTER)
  return match ? parse(match[1])?.name : undefined
}

// During the compatibility window the root a skill lives in fixes its origin:
// the resolver reads skills/ramp/ as RAMP skills and skills-library/ as locked
// mirrors or legacy-local skills. Everywhere, a locked skill is upstream.
function expectedOrigin(skillRoot, name, lock) {
  const locked = lock?.skills.has(name) ?? false
  if (skillRoot === 'skills/ramp') return 'ramp'
  if (skillRoot === 'skills-library') return locked ? 'upstream' : 'local'
  return locked ? 'upstream' : undefined
}

function lintSkill(root, skillRoot, name, lock) {
  const path = `${skillRoot}/${name}`
  const directory = join(root, skillRoot, name)
  const hasMetadata = isFile(join(directory, 'skill.yaml'))
  if (!isFile(join(directory, 'SKILL.md'))) {
    return { findings: [hasMetadata
      ? `${path} has skill.yaml but no SKILL.md`
      : `${path} has no SKILL.md`] }
  }
  if (!hasMetadata) return { findings: [`${path} has no skill.yaml`] }

  let metadata
  try {
    metadata = readYaml(join(directory, 'skill.yaml'))
  } catch (error) {
    return { findings: [`${path}: skill.yaml is not valid YAML: ${error.message}`] }
  }
  const findings = lintSkillMetadata(metadata, taxonomy, {
    requireUseCases: true,
    expectedName: name,
    lock,
  }).map((finding) => `${path}: ${finding}`)

  const declaredName = skillMarkdownName(directory)
  if (declaredName !== name) {
    findings.push(`${path}: SKILL.md name ${declaredName} does not match the directory name`)
  }
  const origin = skillMetadataView(metadata)?.origin
  const expected = expectedOrigin(skillRoot, name, lock)
  if (expected !== undefined && origin !== expected) {
    findings.push(`${path}: skill.yaml origin must be ${expected}, found ${origin}`)
  }
  return { findings, name, origin, ownerPack: metadata?.ownerPack }
}

// Walks every skill directory and every pack of a repository. Errors fail the
// lint; warnings name replaced terms in prose and never fail it.
function lintRepository(root) {
  const lock = loadSkillLock(root)
  const errors = []
  const skills = []
  for (const skillRoot of SKILL_ROOTS) {
    for (const name of directoryNames(join(root, skillRoot))) {
      if (skillRoot === 'skills' && RESERVED_SKILL_SLUGS.has(name)) continue
      const { findings, ...skill } = lintSkill(root, skillRoot, name, lock)
      errors.push(...findings)
      if (skill.name) skills.push(skill)
    }
  }

  const owners = new Map(
    skills
      .filter((skill) => typeof skill.ownerPack === 'string')
      .map((skill) => [skill.name, skill.ownerPack]),
  )
  for (const pack of directoryNames(join(root, 'packs'))) {
    const manifest = join(root, 'packs', pack, 'pack.yaml')
    if (!isFile(manifest)) continue
    const names = readYaml(manifest)?.skills
    // The legacy value "all" names only pack-local skills.
    if (!Array.isArray(names)) continue
    for (const name of names) {
      const owner = owners.get(name)
      if (owner !== undefined && owner !== pack) {
        errors.push(`packs/${pack}/pack.yaml names skill ${name}, which pack ${owner} owns`)
      }
    }
  }

  const warnings = []
  for (const top of ['packs', 'docs']) {
    for (const file of markdownFiles(join(root, top))) {
      const path = portable(relative(root, file))
      if (SKIPPED_PROSE.some((pattern) => pattern.test(path))) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const [term, replacement] of REPLACED_TERMS) {
          if (line.toLowerCase().includes(term.toLowerCase())) {
            warnings.push(`${path}:${index + 1}: "${term}" is replaced by "${replacement}"`)
          }
        }
      })
    }
  }
  return { errors, warnings, skills }
}

function withRepositoryCopy(skillPaths, edit) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-skill-lint-'))
  try {
    for (const path of skillPaths) {
      cpSync(join(repoRoot, path), join(root, path), { recursive: true })
    }
    edit(root)
    return lintRepository(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('skill taxonomy lint', () => {
  it('passes for every skill in the repository', () => {
    const { errors, warnings, skills } = lintRepository(repoRoot)
    expect(errors).toEqual([])

    const byOrigin = {}
    for (const skill of skills) byOrigin[skill.origin] = (byOrigin[skill.origin] ?? 0) + 1
    expect(skills).toHaveLength(55)
    expect(byOrigin).toEqual({ ramp: 9, upstream: 15, local: 31 })
    const lock = loadSkillLock(repoRoot, { required: true })
    expect(
      skills.filter((skill) => skill.origin === 'upstream').map((skill) => skill.name),
    ).toEqual([...lock.skills.keys()].sort())

    for (const warning of warnings) console.warn(`skill taxonomy lint warning: ${warning}`)
  })

  it('fails when a skill directory has no skill.yaml', () => {
    const path = 'skills/ramp/web-test-automation'
    const { errors } = withRepositoryCopy([path], (root) => {
      unlinkSync(join(root, path, 'skill.yaml'))
    })
    expect(errors).toEqual([`${path} has no skill.yaml`])
  })

  it('fails on a classification value outside the vocabulary', () => {
    const path = 'skills/ramp/web-test-automation'
    const { errors } = withRepositoryCopy([path], (root) => {
      const file = join(root, path, 'skill.yaml')
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace(
          'useCases: [quality-engineering]',
          'useCases: [quality-engineering, quality-assurance]',
        ),
      )
    })
    expect(errors).toEqual([
      `${path}: skill.yaml classification.useCases has unknown value: quality-assurance`,
    ])
  })

  it('fails on a skill without a use case, a v1 file or a mismatched SKILL.md name', () => {
    const path = 'skills/ramp/web-test-automation'
    const { errors } = withRepositoryCopy([path], (root) => {
      const file = join(root, path, 'skill.yaml')
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace('[quality-engineering]', '[]'),
      )
    })
    expect(errors).toEqual([
      `${path}: skill.yaml classification.useCases needs at least one value`,
    ])

    expect(withRepositoryCopy([path], (root) => {
      writeFileSync(join(root, path, 'skill.yaml'), [
        'schemaVersion: 1',
        'kind: ramp-skill',
        'name: web-test-automation',
        'version: 1.0.0',
        'license: MIT-0',
        '',
      ].join('\n'))
    }).errors).toEqual([
      `${path}: skill.yaml schemaVersion 1 has no classification; it is read as origin: ramp with an empty classification`,
      `${path}: skill.yaml classification.useCases needs at least one value`,
    ])

    expect(withRepositoryCopy([path], (root) => {
      const file = join(root, path, 'SKILL.md')
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace('name: web-test-automation', 'name: web-testing'),
      )
    }).errors).toEqual([
      `${path}: SKILL.md name web-testing does not match the directory name`,
    ])
  })

  it('fails when an origin does not match the skill root or the lock', () => {
    const ramp = 'skills/ramp/web-test-automation'
    const local = 'skills-library/java-upgrade'
    const { errors } = withRepositoryCopy([ramp, local], (root) => {
      for (const [path, from, to] of [
        [ramp, 'origin: ramp', 'origin: local'],
        [local, 'origin: local', 'origin: ramp'],
      ]) {
        const file = join(root, path, 'skill.yaml')
        writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
      }
    })
    expect(errors).toEqual([
      `${ramp}: skill.yaml origin must be ramp, found local`,
      `${local}: skill.yaml origin must be local, found ramp`,
    ])

    const locked = 'skills-library/aws-iam'
    expect(withRepositoryCopy([locked, local, 'dependencies'], (root) => {
      for (const [path, from, to] of [
        [locked, 'origin: upstream', 'origin: local\nversion: 0.0.0\nlicense: MIT-0'],
        [local, 'origin: local\nversion: 0.0.0\nlicense: MIT-0', 'origin: upstream'],
      ]) {
        const file = join(root, path, 'skill.yaml')
        writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
      }
    }).errors).toEqual([
      `${locked}: skill.yaml origin must be upstream, found local`,
      `${local}: skill.yaml origin upstream requires a skills.lock.yaml entry named java-upgrade`,
      `${local}: skill.yaml origin must be local, found upstream`,
    ])
  })

  it('fails on a skill directory holding only skill.yaml', () => {
    expect(lintRepository(join(fixtures, 'metadata-only')).errors).toEqual([
      'skills-library/orphan-skill has skill.yaml but no SKILL.md',
    ])
  })

  it('fails when a pack names a skill another pack owns', () => {
    expect(lintRepository(join(fixtures, 'owner-pack')).errors).toEqual([
      'packs/other-pack/pack.yaml names skill owned-skill, which pack owner-pack owns',
    ])
  })

  it('warns once, without failing, on a replaced term outside generated and design files', () => {
    expect(lintRepository(join(fixtures, 'terms'))).toEqual({
      errors: [],
      warnings: ['docs/guide.md:3: "workflow overlay" is replaced by "Workflow variant"'],
      skills: [],
    })
  })
})
