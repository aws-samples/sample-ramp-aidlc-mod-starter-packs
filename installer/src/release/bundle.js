import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPlan } from '../plan.js'
import { loadManifest, } from '../manifest.js'
import { resolveWorkspace } from '../workspace.js'
import { loadSkillLock } from '../dependencies/manifests.js'
import {
  createSkillResolver,
  resolveCacheDir,
} from '../dependencies/resolver.js'
import { comparePortablePaths } from '../dependencies/checksum.js'
import {
  collectPlanEntries,
  assertArtifactPath,
  readOrdinaryFile,
} from './entries.js'
import { createInputClosure } from './input-closure.js'
import {
  collectLegalPayloads,
  renderThirdPartyNotices,
} from './notices.js'
import {
  containsLocalAbsolutePath,
  renderReadmeFirst,
} from './readme-first.js'
import {
  overlayFileRecords,
  publicLegalRecords,
  uniqueSkillProvenance,
} from './provenance.js'
import {
  renderSha256Sums,
  stableJson,
} from './stable-json.js'

const COMMIT = /^[0-9a-f]{40}$/
const RELEASE_GENERATOR_FILES = [
  'installer/src/release/entries.js',
  'installer/src/release/stable-json.js',
  'installer/src/release/input-closure.js',
  'installer/src/release/provenance.js',
  'installer/src/release/notices.js',
  'installer/src/release/readme-first.js',
  'installer/src/release/bundle.js',
]
const DEPENDENCY_INPUTS = [
  'dependencies/skills.sources.yaml',
  'dependencies/skills.lock.yaml',
]
const runtimeRepoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (Buffer.isBuffer(value)) return Buffer.from(value)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    )
  }
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function canonicalBuildTime(value) {
  requireString(value, 'buildTime')
  const parsed = new Date(value)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    throw new Error('buildTime must be a canonical ISO-8601 UTC value')
  }
  return value
}

function repositoryVerified(root) {
  const gitPath = join(root, '.git')
  if (!existsSync(gitPath)) return false
  const status = lstatSync(gitPath)
  if (status.isSymbolicLink()) {
    throw new Error(`repository .git must not be a symbolic link: ${gitPath}`)
  }
  return status.isDirectory() || status.isFile()
}

function assertContainedDirectory(root, directory, label) {
  const repository = resolve(root)
  const candidate = resolve(directory)
  const path = relative(repository, candidate)
  if (path.startsWith('..') || isAbsolute(path)) {
    throw new Error(`${label} escapes repoRoot`)
  }
  let current = repository
  for (const segment of path.split(sep).filter(Boolean)) {
    current = join(current, segment)
    const status = lstatSync(current)
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(`${label} contains a non-ordinary directory: ${current}`)
    }
  }
  return candidate
}

function dispatchInput(closure, event) {
  if (event.kind === 'external') closure.recordExternalFile(event)
  else {
    closure.recordRepositoryFile({
      absolutePath: event.absolutePath,
      role: event.role,
      bytes: event.bytes,
      provenance: event.provenance,
    })
  }
}

function recordRepositoryPath(closure, root, path, role) {
  const absolutePath = join(root, ...path.split('/'))
  const bytes = readOrdinaryFile(absolutePath, {
    label: `${role} input`,
    trustedRoot: root,
  }).bytes
  closure.recordRepositoryFile({
    absolutePath,
    role,
    bytes,
  })
  return bytes
}

function recordReleaseGeneratorInputs(closure, repoRoot) {
  for (const path of RELEASE_GENERATOR_FILES) {
    const repositoryBytes = readOrdinaryFile(
      join(repoRoot, ...path.split('/')),
      {
        label: `generator input ${path}`,
        trustedRoot: repoRoot,
      },
    ).bytes
    const runtimeBytes = readOrdinaryFile(
      join(runtimeRepoRoot, ...path.split('/')),
      {
        label: `executing generator input ${path}`,
        trustedRoot: runtimeRepoRoot,
      },
    ).bytes
    if (!repositoryBytes.equals(runtimeBytes)) {
      throw new Error(
        `generator input ${path} does not match the executing RAMP generator`,
      )
    }
    closure.recordRepositoryFile({
      absolutePath: join(repoRoot, ...path.split('/')),
      role: 'generator',
      bytes: repositoryBytes,
    })
  }
}

function loadCapturedDependencyEnvironment({
  sourceBytes,
  lockBytes,
  repoRoot,
  cacheDir,
}) {
  const contractRoot = mkdtempSync(
    join(tmpdir(), 'ramp-release-contracts-'),
  )
  try {
    const dependencyRoot = join(contractRoot, 'dependencies')
    mkdirSync(dependencyRoot, { mode: 0o700 })
    writeFileSync(
      join(dependencyRoot, 'skills.sources.yaml'),
      Buffer.from(sourceBytes),
      { flag: 'wx', mode: 0o600 },
    )
    writeFileSync(
      join(dependencyRoot, 'skills.lock.yaml'),
      Buffer.from(lockBytes),
      { flag: 'wx', mode: 0o600 },
    )

    let authenticatedLock
    try {
      authenticatedLock = loadSkillLock(contractRoot, { required: true })
    } catch (error) {
      throw new Error(
        `captured dependency manifests failed strict validation: ${error.message}`,
      )
    }
    const skills = new Map()
    const byCoordinate = new Map()
    for (const [name, skill] of authenticatedLock.skills) {
      const normalized = cloneValue(skill)
      skills.set(name, normalized)
      byCoordinate.set(
        `${normalized.source}\0${normalized.commit}\0${normalized.path}`,
        normalized,
      )
    }
    const resolver = createSkillResolver({
      repoRoot: contractRoot,
      rampDir: join(repoRoot, 'skills', 'ramp'),
      libraryDir: join(repoRoot, 'skills-library'),
      cacheDir,
      strictProvenance: true,
      allowLegacyLocal: false,
    })
    return {
      contracts: { skills, byCoordinate },
      resolver,
    }
  } finally {
    rmSync(contractRoot, { recursive: true, force: true })
  }
}

function assertUpstreamSkillsMatchLock(lock, skills) {
  for (const skill of skills) {
    if (skill.kind !== 'upstream') continue
    const locked = lock.skills.get(skill.name)
    if (!locked) throw new Error(`upstream skill is absent from lock: ${skill.name}`)
    for (const field of [
      'source',
      'repository',
      'commit',
      'path',
      'treeSha256',
      'license',
      'licensePath',
      'noticePath',
    ]) {
      if (skill[field] !== locked[field]) {
        throw new Error(`upstream skill ${skill.name} disagrees with lock field ${field}`)
      }
    }
    if (JSON.stringify(skill.files) !== JSON.stringify(locked.files)) {
      throw new Error(`upstream skill ${skill.name} file closure disagrees with lock`)
    }
    for (const field of ['licenseFile', 'noticeFile']) {
      if (JSON.stringify(skill[field]) !== JSON.stringify(locked[field])) {
        throw new Error(
          `upstream skill ${skill.name} ${field} disagrees with lock`,
        )
      }
    }
  }
}

function legalSkillsForDeclaredBasedOn(skills, lock) {
  const resolved = []
  for (const skill of skills) {
    if (
      (skill.kind !== 'ramp' && skill.kind !== 'pack-override') ||
      skill.basedOn === undefined
    ) {
      continue
    }
    const basedOn = skill.basedOn
    const locked = lock.byCoordinate.get(
      `${basedOn.source}\0${basedOn.commit}\0${basedOn.path}`,
    )
    if (!locked) {
      throw new Error(
        `${skill.kind} skill ${skill.name} has unresolved basedOn ` +
        `${basedOn.source}@${basedOn.commit}:${basedOn.path}`,
      )
    }
    resolved.push({
      kind: 'upstream',
      attribution: 'locked',
      ...cloneValue(locked),
      name: `${skill.name}-based-on-${locked.name}`,
    })
  }
  return resolved
}

function sourceMetadata(repositoryIsVerified, sourceCommit, buildTime) {
  return repositoryIsVerified
    ? {
        attribution: 'repository-verified',
        sourceCommit,
        buildTime,
      }
    : {
        attribution: 'caller-supplied',
        callerSuppliedSourceCommit: sourceCommit,
        buildTime,
      }
}

function generatedEntry(path, value) {
  const bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8')
  return {
    path: assertArtifactPath(path),
    bytes,
    mode: 0o100644,
    provenance: { kind: 'generated' },
  }
}

function exactMcp(manifest) {
  return (manifest.mcp ?? []).map((server) => cloneValue(server))
}

function stringValues(value, result = []) {
  if (typeof value === 'string') {
    result.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) stringValues(item, result)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) stringValues(item, result)
  }
  return result
}

function entryContainsLocalAbsolutePath(entry, text) {
  const path = entry.path.toLowerCase()
  if (path.endsWith('.json')) {
    try {
      return stringValues(JSON.parse(text))
        .some((value) => containsLocalAbsolutePath(value))
    } catch {
      return containsLocalAbsolutePath(text)
    }
  }
  return path === 'readme-first.md' && containsLocalAbsolutePath(text)
}

function isPrivateMaterialBoundary(entry) {
  const path = entry.path.toLowerCase()
  return path === 'readme-first.md' || path.endsWith('.json')
}

function assertNoPrivateMaterial(entries, { repoRoot, cacheDir, manifest }) {
  const credentialValues = (manifest.mcp ?? [])
    .flatMap((server) => Object.entries(server.env ?? {}))
    .filter(([name, value]) =>
      /(?:^|_)(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY|CREDENTIALS?)(?:_|$)/i
        .test(name) &&
      typeof value === 'string' &&
      value !== '' &&
      !/(?:example|placeholder|replace[-_ ]?me|\$\{|<[^>]+>)/i.test(value))
    .map(([, value]) => value)
  for (const entry of entries) {
    if (!isPrivateMaterialBoundary(entry)) continue
    const text = entry.bytes.toString('utf8')
    if (
      text.includes(repoRoot) ||
      text.includes(cacheDir) ||
      entryContainsLocalAbsolutePath(entry, text) ||
      /https?:\/\/[^/\s@]+@/i.test(text) ||
      /(?:AKIA|ASIA)[0-9A-Z]{16}/.test(text) ||
      /gh[pousr]_[A-Za-z0-9]{20,}/.test(text) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
      credentialValues.some((value) => text.includes(value))
    ) {
      throw new Error(
        `release entry contains an absolute local path or credential-bearing value: ${entry.path}`,
      )
    }
  }
}

export function buildBundle(packDir, options = {}) {
  const repoRoot = resolve(requireString(options.repoRoot, 'repoRoot'))
  const selectedPackDir = assertContainedDirectory(
    repoRoot,
    requireString(packDir, 'packDir'),
    'packDir',
  )
  const target = requireString(options.target, 'target')
  const sourceCommit = requireString(options.sourceCommit, 'sourceCommit')
  if (!COMMIT.test(sourceCommit)) {
    throw new Error('sourceCommit must be a lowercase 40-character Git commit')
  }
  const buildTime = canonicalBuildTime(options.buildTime)
  if (
    options.onReleasePhase !== undefined &&
    typeof options.onReleasePhase !== 'function'
  ) {
    throw new Error('onReleasePhase must be a function')
  }
  const isRepositoryVerified = repositoryVerified(repoRoot)
  const closure = createInputClosure({
    repoRoot,
    sourceCommit,
    repositoryVerified: isRepositoryVerified,
    onFilesystemPhase: options.onFilesystemPhase,
  })
  const capturedRepositoryInputs = new Map()
  const onInput = (event) => {
    if (event.kind !== 'external' && event.bytes !== undefined) {
      const path = resolve(event.absolutePath)
      const bytes = Buffer.from(event.bytes)
      const previous = capturedRepositoryInputs.get(path)
      if (previous && !previous.equals(bytes)) {
        throw new Error(`repository input was captured with conflicting bytes: ${path}`)
      }
      capturedRepositoryInputs.set(path, bytes)
    }
    dispatchInput(closure, event)
  }

  recordReleaseGeneratorInputs(closure, repoRoot)
  const dependencyBytes = new Map()
  for (const path of DEPENDENCY_INPUTS) {
    const bytes = recordRepositoryPath(
      closure,
      repoRoot,
      path,
      'dependency-manifest',
    )
    dependencyBytes.set(path, Buffer.from(bytes))
  }
  options.onReleasePhase?.({
    phase: 'afterDependencyInputsCaptured',
    repoRoot,
  })
  const cacheDir = resolveCacheDir({
    repoRoot,
    ...(options.cacheDir !== undefined ? { cacheDir: options.cacheDir } : {}),
  })
  const {
    contracts: dependencyContracts,
    resolver,
  } = loadCapturedDependencyEnvironment({
    sourceBytes: dependencyBytes.get('dependencies/skills.sources.yaml'),
    lockBytes: dependencyBytes.get('dependencies/skills.lock.yaml'),
    repoRoot,
    cacheDir,
  })

  const manifest = loadManifest(selectedPackDir, { onInput })
  if (manifest.schemaVersion !== 2) {
    throw new Error('release bundles require a schemaVersion 2 pack')
  }
  if (!manifest.distribution.targets.includes(target)) {
    throw new Error(`release target is not declared by this pack: ${target}`)
  }

  let workspace
  if (options.workspace !== undefined) {
    workspace = options.workspace
    if (!workspace?.tools?.includes(target)) {
      throw new Error(`workspace does not include target: ${target}`)
    }
    if (
      options.profile !== undefined &&
      workspace.profile !== options.profile
    ) {
      throw new Error('workspace profile conflicts with requested profile')
    }
  } else {
    workspace = resolveWorkspace(manifest, {
      tools: [target],
      ...(options.profile !== undefined
        ? { profile: options.profile }
        : {}),
    })
  }
  const profile = options.profile ?? workspace.profile ?? null
  const plan = buildPlan(selectedPackDir, target, {
    workspace,
    resolver,
    repoRoot,
    cacheDir,
    onInput,
  })
  options.onReleasePhase?.({
    phase: 'afterPlanInputsCaptured',
    repoRoot,
  })
  const collected = collectPlanEntries(plan, {
    repoRoot,
    recordInput: onInput,
    onFilesystemPhase: options.onFilesystemPhase,
  })
  const overlayEntries = collected.map((entry) => ({
    ...entry,
    path: assertArtifactPath(`overlay/${entry.path}`),
    bytes: Buffer.from(entry.bytes),
  }))
  const skills = uniqueSkillProvenance(plan)
  const resolvedSkillsByName = new Map()
  for (const operation of plan) {
    if (operation.kind !== 'copy') continue
    if (!resolvedSkillsByName.has(operation.provenance.name)) {
      resolvedSkillsByName.set(
        operation.provenance.name,
        operation.provenance,
      )
    }
  }
  const resolvedSkills = skills.map((skill) => {
    const provenance = resolvedSkillsByName.get(skill.name)
    if (!provenance) {
      throw new Error(`missing resolved provenance for skill: ${skill.name}`)
    }
    return provenance
  })
  assertUpstreamSkillsMatchLock(dependencyContracts, resolvedSkills)
  for (const skill of skills) {
    if (
      (skill.kind === 'ramp' || skill.kind === 'pack-override') &&
      skill.license !== 'MIT-0'
    ) {
      throw new Error(
        `${skill.kind} skill ${skill.name} requires an explicit non-MIT-0 license payload`,
      )
    }
  }
  const basedOnLegalSkills = legalSkillsForDeclaredBasedOn(
    resolvedSkills,
    dependencyContracts,
  )
  const legal = collectLegalPayloads({
    repoRoot,
    cacheDir,
    usedSkills: [...resolvedSkills, ...basedOnLegalSkills],
    recordInput: onInput,
    onFilesystemPhase: options.onFilesystemPhase,
  })
  const packagePath = resolve(repoRoot, 'installer', 'package.json')
  const packageBytes = capturedRepositoryInputs.get(packagePath)
  if (!packageBytes) {
    throw new Error('executing generator package metadata was not captured')
  }
  let packageMetadata
  try {
    packageMetadata = JSON.parse(packageBytes.toString('utf8'))
  } catch (error) {
    throw new Error(`captured generator package metadata is invalid: ${error.message}`)
  }
  const consumedInputs = closure.finalize()

  const profilePart = profile ? `--${profile}` : ''
  const artifactName = `${manifest.name}--${target}${profilePart}--v${manifest.version}`
  const ownershipKey =
    `${manifest.name}--${target}--${profile ?? 'standalone'}`
  assertArtifactPath(artifactName, 'artifactName')
  assertArtifactPath(ownershipKey, 'ownershipKey')

  const entries = [
    generatedEntry(
      'README-FIRST.md',
      renderReadmeFirst({
        manifest,
        target,
        profile,
        workspace,
        artifactName,
      }),
    ),
    generatedEntry('LICENSE', legal.repositoryLicense),
    generatedEntry(
      'THIRD_PARTY_NOTICES.md',
      renderThirdPartyNotices(legal.sources),
    ),
    ...legal.sources.flatMap((source) => [
      generatedEntry(`licenses/${source.id}/LICENSE`, source.licenseBytes),
      generatedEntry(`licenses/${source.id}/NOTICE`, source.noticeBytes),
    ]),
    ...overlayEntries,
  ].sort((left, right) => comparePortablePaths(left.path, right.path))
  assertNoPrivateMaterial(entries, { repoRoot, cacheDir, manifest })

  const manifestValue = {
    schemaVersion: 1,
    bundle: { artifactName, ownershipKey },
    pack: {
      id: manifest.name,
      title: manifest.title,
      version: manifest.version,
      schemaVersion: manifest.schemaVersion,
      catalog: cloneValue(manifest.catalog),
    },
    target,
    profile,
    workspace: {
      workspaceMode: workspace.workspaceMode,
      specRoot: workspace.specRoot,
      stateRoot: workspace.stateRoot,
    },
    workflow: {
      provider: manifest.workflow.provider,
      providerVersion: 1,
      overlays: [...manifest.workflow.overlays],
    },
    generator: {
      name: packageMetadata.name,
      version: packageMetadata.version,
    },
    source: sourceMetadata(isRepositoryVerified, sourceCommit, buildTime),
    skills,
    mcp: exactMcp(manifest),
    licenses: publicLegalRecords(legal.sources),
    relatedAssets: [],
    files: overlayFileRecords(overlayEntries),
    consumedInputs,
  }
  entries.push(generatedEntry('bundle-manifest.json', stableJson(manifestValue)))
  entries.sort((left, right) => comparePortablePaths(left.path, right.path))
  assertNoPrivateMaterial(entries, { repoRoot, cacheDir, manifest })
  entries.push(generatedEntry('SHA256SUMS', renderSha256Sums(entries)))
  entries.sort((left, right) => comparePortablePaths(left.path, right.path))

  return {
    artifactName,
    ownershipKey,
    entries: entries.map((entry) => cloneValue(entry)),
    manifest: cloneValue(manifestValue),
    consumedInputs: cloneValue(consumedInputs),
  }
}
