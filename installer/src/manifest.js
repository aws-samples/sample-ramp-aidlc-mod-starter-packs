import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { getAdapter } from './adapters/index.js'
import { readOrdinaryFile } from './release/entries.js'
import { loadTaxonomy } from './taxonomy.js'

const OUTCOMES = new Set(['transform', 'reimagine', 'automate', 'foundation'])
const EXECUTION_MODELS = new Set(['assisted-builder', 'autonomous-pipeline', 'foundation'])
const MATURITY_LEVELS = new Set(['experimental', 'preview', 'stable', 'deprecated'])
const WORKFLOW_PROVIDERS = new Set(['local-instructions-v1'])
const INSTRUCTION_ROLES = new Set(['primary', 'companion'])
const INSTRUCTION_LOAD_MODES = new Set(['always', 'auto'])
const WORKSPACE_MODES = new Set(['standalone', 'shared'])
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
const ROOT_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'name',
  'title',
  'description',
  'version',
  'catalog',
  'workflow',
  'instructions',
  'command',
  'mcp',
  'skills',
  'capabilities',
  'distribution',
])
const CATALOG_FIELDS = new Set(['outcome', 'domain', 'executionModel', 'maturity', 'useCases'])
const V1_CATALOG_FIELDS = new Set(['useCases'])
const WORKFLOW_FIELDS = new Set(['provider', 'overlays'])
const INSTRUCTION_FIELDS = new Set(['file', 'role', 'load', 'description'])
const DISTRIBUTION_FIELDS = new Set(['targets', 'qualifiedTargets', 'profiles'])
const PROFILE_FIELDS = new Set(['name', 'targets', 'workspaceMode', 'specRoot', 'stateRoot'])
const runtimeRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`pack.yaml ${label} must be an object`)
  }
  return value
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`pack.yaml ${label} must be an array`)
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`pack.yaml ${label} must be a non-empty string`)
  }
  return value
}

function requireEnum(value, allowed, label) {
  requireString(value, label)
  if (!allowed.has(value)) {
    throw new Error(`pack.yaml ${label} has unsupported value: ${value}`)
  }
  return value
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`pack.yaml ${label} has unknown field: ${key}`)
    }
  }
}

function assertSafePath(value, label) {
  requireString(value, label)
  const portable = value.replaceAll('\\', '/')
  const segments = portable.split('/')
  if (
    portable.startsWith('/') ||
    /^[a-zA-Z]:\//.test(portable) ||
    segments.some((segment) => segment === '..')
  ) {
    throw new Error(`pack.yaml ${label} contains unsafe traversal: ${value}`)
  }
  return value
}

function assertSafeIdentifier(value, label) {
  requireString(value, label)
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`pack.yaml ${label} contains unsafe traversal: ${value}`)
  }
  return value
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`pack.yaml has duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function normalizeInstructions(rawInstructions) {
  const instructions = (rawInstructions ?? []).map((i) => ({
    file: i.file,
    role: i.role,
    load: i.load ?? 'always',
    description: i.description,
  }))
  const primaries = instructions.filter((i) => i.role === 'primary')
  if (primaries.length !== 1) {
    throw new Error(`pack.yaml must declare exactly one instruction with role: primary (found ${primaries.length})`)
  }
  return instructions
}

function sameSkillDeclaration(left, right) {
  if (left === 'all' || right === 'all') return left === right
  return left.length === right.length && left.every((value) => right.includes(value))
}

function validateSkillList(value, label) {
  if (value === 'all') return
  requireArray(value, label)
  for (const skill of value) assertSafeIdentifier(skill, `${label} identifier`)
  assertUnique(value, 'skill identifier')
}

// Use cases come from schemas/taxonomy.yaml of the RAMP repository this loader
// runs from, the same vocabulary the skill metadata lint uses.
function validateUseCases(value) {
  const useCases = requireArray(value, 'catalog.useCases')
  if (useCases.length === 0) throw new Error('pack.yaml catalog.useCases must not be empty')
  for (const useCase of useCases) requireString(useCase, 'catalog.useCases item')
  assertUnique(useCases, 'use case')
  const vocabulary = loadTaxonomy(runtimeRepoRoot).useCases
  for (const useCase of useCases) {
    if (!vocabulary.has(useCase)) {
      throw new Error(`pack.yaml catalog.useCases value is not in schemas/taxonomy.yaml: ${useCase}`)
    }
  }
  return [...useCases]
}

// A v1 manifest has no catalog of its own; it may declare only its use cases.
function validateV1Catalog(raw) {
  const catalog = requireObject(raw, 'catalog')
  assertOnlyKeys(catalog, V1_CATALOG_FIELDS, 'catalog')
  return { useCases: validateUseCases(catalog.useCases) }
}

function validateV2(raw, instructions) {
  assertOnlyKeys(raw, ROOT_FIELDS, 'top level')
  assertSafeIdentifier(raw.name, 'name')
  requireString(raw.title, 'title')
  requireString(raw.description, 'description')
  if (raw.kind !== 'ramp-pack') {
    throw new Error(`pack.yaml kind must be ramp-pack (received ${raw.kind})`)
  }
  if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) {
    throw new Error(`pack.yaml version must be valid semantic version`)
  }

  const catalog = requireObject(raw.catalog, 'catalog')
  assertOnlyKeys(catalog, CATALOG_FIELDS, 'catalog')
  requireEnum(catalog.outcome, OUTCOMES, 'catalog.outcome')
  requireString(catalog.domain, 'catalog.domain')
  requireEnum(catalog.executionModel, EXECUTION_MODELS, 'catalog.executionModel')
  requireEnum(catalog.maturity, MATURITY_LEVELS, 'catalog.maturity')
  const useCases =
    catalog.useCases === undefined ? undefined : validateUseCases(catalog.useCases)

  const workflow = requireObject(raw.workflow, 'workflow')
  assertOnlyKeys(workflow, WORKFLOW_FIELDS, 'workflow')
  requireEnum(workflow.provider, WORKFLOW_PROVIDERS, 'workflow.provider')
  const overlays = requireArray(workflow.overlays, 'workflow.overlays')
  for (const overlay of overlays) assertSafePath(overlay, 'workflow overlay')
  assertUnique(overlays, 'workflow overlay')

  requireArray(raw.instructions, 'instructions')
  raw.instructions.forEach((instruction, index) => {
    const source = requireObject(instruction, `instruction ${index}`)
    assertOnlyKeys(source, INSTRUCTION_FIELDS, `instruction ${source.file ?? index}`)
    if (source.description !== undefined && typeof source.description !== 'string') {
      throw new Error(`pack.yaml instruction ${source.file ?? index} description must be a string`)
    }
  })
  for (const instruction of instructions) {
    assertSafePath(instruction.file, 'instruction identifier')
    requireEnum(instruction.role, INSTRUCTION_ROLES, `instruction ${instruction.file} role`)
    requireEnum(instruction.load, INSTRUCTION_LOAD_MODES, `instruction ${instruction.file} load`)
  }
  assertUnique(instructions.map((instruction) => instruction.file), 'instruction file')

  if (raw.command !== undefined) requireObject(raw.command, 'command')
  if (raw.mcp !== undefined) {
    const servers = requireArray(raw.mcp, 'mcp')
    servers.forEach((server, index) => requireObject(server, `mcp item ${index}`))
  }

  const capabilities =
    raw.capabilities === undefined ? undefined : requireObject(raw.capabilities, 'capabilities')
  const legacySkills = raw.skills
  const capabilitySkills = capabilities?.skills
  if (legacySkills !== undefined) validateSkillList(legacySkills, 'skills')
  if (capabilitySkills !== undefined) validateSkillList(capabilitySkills, 'capabilities.skills')
  if (
    legacySkills !== undefined &&
    capabilitySkills !== undefined &&
    !sameSkillDeclaration(legacySkills, capabilitySkills)
  ) {
    throw new Error('pack.yaml skills and capabilities.skills disagree')
  }

  const distribution = requireObject(raw.distribution, 'distribution')
  assertOnlyKeys(distribution, DISTRIBUTION_FIELDS, 'distribution')
  const targets = requireArray(distribution.targets, 'distribution.targets')
  if (targets.length === 0) throw new Error('pack.yaml distribution.targets must not be empty')
  assertUnique(targets, 'distribution target')
  for (const target of targets) {
    requireString(target, 'distribution target')
    try {
      getAdapter(target)
    } catch {
      throw new Error(`pack.yaml distribution target is not a registered adapter: ${target}`)
    }
  }

  const qualifiedTargets = requireArray(
    distribution.qualifiedTargets,
    'distribution.qualifiedTargets',
  )
  assertUnique(qualifiedTargets, 'qualified target')
  for (const target of qualifiedTargets) {
    if (!targets.includes(target)) {
      throw new Error(`pack.yaml distribution.qualifiedTargets contains undeclared target: ${target}`)
    }
  }

  const profiles = requireArray(distribution.profiles, 'distribution.profiles')
  const profileNames = []
  for (const profile of profiles) {
    requireObject(profile, 'distribution profile')
    assertOnlyKeys(profile, PROFILE_FIELDS, `profile ${profile.name ?? '<unnamed>'}`)
    profileNames.push(assertSafeIdentifier(profile.name, 'profile identifier'))
    const profileTargets = requireArray(profile.targets, `profile ${profile.name} targets`)
    if (profileTargets.length === 0) {
      throw new Error(`pack.yaml profile ${profile.name} targets must not be empty`)
    }
    assertUnique(profileTargets, `profile ${profile.name} target`)
    for (const target of profileTargets) {
      if (!targets.includes(target)) {
        throw new Error(`pack.yaml profile ${profile.name} target is not declared: ${target}`)
      }
    }
    if (profile.workspaceMode !== undefined) {
      requireEnum(
        profile.workspaceMode,
        WORKSPACE_MODES,
        `profile ${profile.name} workspaceMode`,
      )
    }
    if (profile.specRoot !== undefined) {
      assertSafePath(profile.specRoot, `profile ${profile.name} specRoot`)
    }
    if (profile.stateRoot !== undefined) {
      assertSafePath(profile.stateRoot, `profile ${profile.name} stateRoot`)
    }
  }
  assertUnique(profileNames, 'profile name')

  return {
    catalog: {
      outcome: catalog.outcome,
      domain: catalog.domain,
      executionModel: catalog.executionModel,
      maturity: catalog.maturity,
      ...(useCases ? { useCases } : {}),
    },
    workflow: {
      provider: workflow.provider,
      overlays: [...overlays],
    },
    distribution: {
      targets: [...targets],
      qualifiedTargets: [...qualifiedTargets],
      profiles: profiles.map((profile) => ({
        ...profile,
        targets: [...profile.targets],
      })),
    },
    capabilities: capabilities
      ? {
          ...capabilities,
          ...(capabilitySkills === undefined
            ? {}
            : { skills: Array.isArray(capabilitySkills) ? [...capabilitySkills] : capabilitySkills }),
        }
      : undefined,
    skills: capabilitySkills ?? legacySkills ?? 'all',
  }
}

export function loadManifest(packDir, { onInput } = {}) {
  if (onInput !== undefined && typeof onInput !== 'function') {
    throw new Error('loadManifest onInput must be a function')
  }
  const manifestPath = join(packDir, 'pack.yaml')
  const bytes = onInput === undefined
    ? readFileSync(manifestPath)
    : readOrdinaryFile(manifestPath, {
        label: 'pack.yaml',
        trustedRoot: packDir,
      }).bytes
  onInput?.({
    absolutePath: manifestPath,
    role: 'pack-manifest',
    bytes: Buffer.from(bytes),
  })
  const raw = bytes.toString('utf8')
  const m = parse(raw)
  if (m?.schemaVersion !== undefined && m.schemaVersion !== 1 && m.schemaVersion !== 2) {
    throw new Error(`pack.yaml has unsupported schemaVersion: ${m.schemaVersion}`)
  }
  const instructions = normalizeInstructions(m?.instructions)
  const base = {
    name: m.name,
    title: m.title,
    description: m.description,
    instructions,
    command: m.command,
    mcp: m.mcp ?? [],
    skills: m.skills ?? 'all',
  }

  if (m.schemaVersion !== 2) {
    return m.catalog === undefined ? base : { ...base, catalog: validateV1Catalog(m.catalog) }
  }

  const v2 = validateV2(m, instructions)
  return {
    ...base,
    schemaVersion: 2,
    kind: m.kind,
    version: m.version,
    catalog: v2.catalog,
    workflow: v2.workflow,
    distribution: v2.distribution,
    ...(v2.capabilities ? { capabilities: v2.capabilities } : {}),
    skills: v2.skills,
  }
}
