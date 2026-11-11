import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { loadManifest } from '../manifest.js'
import { resolveWorkspace } from '../workspace.js'
import { buildBundle } from './bundle.js'
import { writeDeterministicZip } from './zip.js'

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/
const MIN_BUILD_TIME = Date.UTC(1980, 0, 1)
const MAX_BUILD_TIME = Date.UTC(2107, 11, 31, 23, 59, 58)
const EXACT_VERSION = /^v?\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/
const FLOATING_TAG =
  /@(?:latest|next|canary|beta|alpha|nightly|insiders|edge|dev|rc)(?![0-9A-Za-z.-])/i
const RANGE_SPECIFIER = /(?:>=|<=|~=|!=|===|[<>*^~])/
const NPX_VALUE_FLAGS = new Set(['-p', '--package', '-c', '--call'])
const UVX_VALUE_FLAGS = new Set([
  '--from',
  '--with',
  '--with-requirements',
  '--python',
  '-p',
  '--index',
  '--index-url',
  '--extra-index-url',
])

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function canonicalTime(milliseconds, label) {
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < MIN_BUILD_TIME ||
    milliseconds > MAX_BUILD_TIME
  ) {
    throw new Error(`${label} must fall between 1980 and 2107 UTC`)
  }
  return new Date(milliseconds).toISOString()
}

function explicitBuildTime(value) {
  requireString(value, 'buildTime')
  if (!ISO_8601.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(
      'buildTime must be an ISO-8601 date-time with Z or an explicit offset',
    )
  }
  return canonicalTime(Date.parse(value), 'buildTime')
}

function epochBuildTime(value, label) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer of seconds`)
  }
  return canonicalTime(Number(value) * 1000, label)
}

function git(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

// Explicit options win; SOURCE_DATE_EPOCH replaces only the build time; a Git
// checkout supplies whatever remains. buildBundle() then verifies every
// consumed input against sourceCommit, so derivation never relaxes that gate.
// Deriving sourceCommit from HEAD is honest only when no tracked release input
// differs from it; untracked planning files elsewhere never block a build.
function assertCleanReleaseInputs(repoRoot, packDir) {
  const pack = relative(repoRoot, resolve(packDir)).split(sep).join('/')
  // The union of the old and new roots for the compatibility window.
  const inputs = [
    pack,
    'common',
    'workflow-overlays',
    'workflows',
    'skills',
    'skills-library',
    'dependencies',
    'installer',
  ]
  const changed = git(repoRoot, ['diff', '--name-only', 'HEAD', '--', ...inputs])
  if (changed !== '') {
    const paths = changed.split('\n').join(', ')
    throw new Error(
      `tracked changes under release inputs: ${paths}; commit them or pass --source-commit and --build-time`,
    )
  }
}

function releaseSource(repoRoot, { sourceCommit, buildTime, env }, packDir) {
  const inGit = existsSync(join(repoRoot, '.git'))
  const epoch = env.SOURCE_DATE_EPOCH
  if (!inGit && (sourceCommit === undefined || (buildTime === undefined && epoch === undefined))) {
    throw new Error(
      'release outside Git requires --source-commit and --build-time (or SOURCE_DATE_EPOCH)',
    )
  }
  if (sourceCommit === undefined) assertCleanReleaseInputs(repoRoot, packDir)
  const commit = sourceCommit ?? git(repoRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])
  let time
  if (buildTime !== undefined) time = explicitBuildTime(buildTime)
  else if (epoch !== undefined) time = epochBuildTime(epoch, 'SOURCE_DATE_EPOCH')
  else {
    time = epochBuildTime(
      git(repoRoot, ['show', '-s', '--format=%ct', `${commit}^{commit}`]),
      'source commit time',
    )
  }
  return { sourceCommit: commit, buildTime: time }
}

function stringValues(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function packageSpec(args, valueFlags, specFlags) {
  let spec
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const [flag, inline] = arg.split(/=(.*)/s)
    if (valueFlags.has(flag)) {
      const value = inline ?? args[(index += 1)]
      if (specFlags.has(flag) && spec === undefined) spec = value
      continue
    }
    if (arg.startsWith('-')) continue
    return spec ?? arg
  }
  return spec
}

function splitNpmSpec(spec) {
  const at = spec.indexOf('@', spec.startsWith('@') ? 1 : 0)
  return at === -1
    ? { name: spec }
    : { name: spec.slice(0, at), version: spec.slice(at + 1) }
}

function splitPythonSpec(spec) {
  const match = /^([A-Za-z0-9][A-Za-z0-9._-]*(?:\[[^\]]*\])?)(.*)$/.exec(spec)
  if (!match) return { name: spec, floating: true }
  const [, name, rest] = match
  if (rest === '') return { name }
  const exact = /^(?:==|@)(.+)$/.exec(rest)
  return exact ? { name, version: exact[1] } : { name, floating: true }
}

function runtimePackage(server) {
  const command = basename(String(server.command ?? '')).replace(/\.(?:cmd|exe)$/i, '')
  const args = stringValues(server.args)
  if (command === 'npx') {
    const spec = packageSpec(args, NPX_VALUE_FLAGS, new Set(['-p', '--package']))
    return spec === undefined ? undefined : { runner: 'npx', spec, ...splitNpmSpec(spec) }
  }
  if (command === 'uvx') {
    const spec = packageSpec(args, UVX_VALUE_FLAGS, new Set(['--from']))
    return spec === undefined ? undefined : { runner: 'uvx', spec, ...splitPythonSpec(spec) }
  }
  return undefined
}

// Floating selectors fail the release; an unversioned npx/uvx package is a
// warning that still blocks profile qualification.
export function inspectRuntimeDeclarations(mcp = []) {
  const warnings = []
  for (const server of mcp) {
    for (const value of [server.command, ...stringValues(server.args)]) {
      if (typeof value === 'string' && FLOATING_TAG.test(value)) {
        throw new Error(`MCP server ${server.id} uses a floating runtime selector: ${value}`)
      }
    }
    const runtime = runtimePackage(server)
    if (!runtime) continue
    if (
      runtime.floating ||
      (runtime.version !== undefined &&
        (!EXACT_VERSION.test(runtime.version) || RANGE_SPECIFIER.test(runtime.version)))
    ) {
      throw new Error(
        `MCP server ${server.id} uses a floating runtime selector: ${runtime.spec}`,
      )
    }
    if (runtime.version === undefined) {
      warnings.push(
        `MCP server ${server.id} runs unversioned ${runtime.runner} package ` +
        `${runtime.name}; pin an exact version`,
      )
    }
  }
  return warnings
}

function assertReleasePolicy(manifest, { target, profile }) {
  if (manifest.schemaVersion !== 2) {
    throw new Error('release requires a schemaVersion 2 pack')
  }
  if (!manifest.distribution.targets.includes(target)) {
    throw new Error(`release target is not declared by this pack: ${target}`)
  }
  if (!manifest.distribution.qualifiedTargets.includes(target)) {
    throw new Error(`release target is not qualified by this pack: ${target}`)
  }
  const warnings = inspectRuntimeDeclarations(manifest.mcp)
  if (profile !== undefined && warnings.length > 0) {
    throw new Error(
      `profile ${profile} cannot be qualified until runtime warnings are resolved: ` +
      warnings.join('; '),
    )
  }
  return warnings
}

function isInside(root, candidate) {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

function assertIgnoredOutput(repoRoot, archivePath) {
  if (!existsSync(join(repoRoot, '.git')) || !isInside(repoRoot, archivePath)) return
  const path = relative(repoRoot, archivePath).split(sep).join('/')
  const result = spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', path], {
    env: { ...process.env, LC_ALL: 'C' },
    stdio: 'ignore',
  })
  if (result.status !== 0) {
    throw new Error(`release output inside the repository must be git-ignored: ${path}`)
  }
}

export async function releasePack(packDir, options = {}) {
  const repoRoot = resolve(requireString(options.repoRoot, 'repoRoot'))
  const target = requireString(options.target, 'target')
  const { profile, specRoot, stateRoot, cacheDir } = options
  const env = options.env ?? process.env

  let manifestBytes
  const manifest = loadManifest(packDir, {
    onInput: (event) => { manifestBytes = Buffer.from(event.bytes) },
  })
  const warnings = assertReleasePolicy(manifest, { target, profile })
  const source = releaseSource(repoRoot, {
    sourceCommit: options.sourceCommit,
    buildTime: options.buildTime,
    env,
  }, packDir)
  const workspace = resolveWorkspace(manifest, {
    tools: [target],
    ...(profile !== undefined ? { profile } : {}),
    ...(specRoot !== undefined ? { specRoot } : {}),
    ...(stateRoot !== undefined ? { stateRoot } : {}),
  })

  const bundle = buildBundle(packDir, {
    target,
    ...(profile !== undefined ? { profile } : {}),
    workspace,
    repoRoot,
    ...(cacheDir !== undefined ? { cacheDir } : {}),
    ...source,
  })
  // The policy above must describe the exact pack.yaml bytes that were bundled.
  const bundledManifest = bundle.consumedInputs.filter(
    (record) => record.sourceKind === 'pack-manifest',
  )
  if (bundledManifest.length !== 1 || bundledManifest[0].sha256 !== sha256(manifestBytes)) {
    throw new Error('pack.yaml changed between release policy checks and bundling')
  }

  const outDir = resolve(options.outDir ?? join(repoRoot, 'dist'))
  const archivePath = join(outDir, `${bundle.artifactName}.zip`)
  assertIgnoredOutput(repoRoot, archivePath)
  mkdirSync(outDir, { recursive: true })
  const written = await writeDeterministicZip(
    bundle.entries.map((entry) => ({
      path: `${bundle.artifactName}/${entry.path}`,
      bytes: entry.bytes,
      mode: entry.mode,
    })),
    archivePath,
    { mtime: new Date(source.buildTime) },
  )
  return {
    archivePath,
    sha256: written.sha256,
    manifest: bundle.manifest,
    warnings,
  }
}
