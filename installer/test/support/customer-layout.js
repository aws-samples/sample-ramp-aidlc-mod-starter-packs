// Customer layout: the sorted {path, sha256, mode} list a customer project
// receives from each delivery route. The routes are the release bundle of
// every v2 pack and qualified target (overlay/ entries with the prefix
// stripped, plus install.sh and install.ps1), `ramp-pack init` for every pack
// and target tool, and both no-Node skill helpers for every pack and target
// tool. Every list is computed from the working tree, so an uncommitted edit
// shows up as a path difference instead of a provenance error.
//
// Modes are recorded as 0644 or 0755 from the executable bit, so the umask of
// the machine that runs a route never changes the layout.
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listAdapterIds } from '../../src/adapters/index.js'
import { listPacks } from '../../src/build-all.js'
import { loadManifest } from '../../src/manifest.js'
import { buildBundle } from '../../src/release/bundle.js'

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')
export const baselinePath = fileURLToPath(
  new URL('../fixtures/customer-layout-baseline.json', import.meta.url),
)
export const HELPERS = ['add-skills.sh', 'add-skills.ps1']
export const POWERSHELL = 'pwsh'

// Fixed release identity. The files that carry it (README-FIRST.md,
// bundle-manifest.json, SHA256SUMS) stay in the bundle and never reach the
// customer project, so the values only have to be valid.
const RELEASE_SOURCE_COMMIT = '0'.repeat(40)
const RELEASE_BUILD_TIME = '2026-01-01T00:00:00.000Z'
const RELEASE_INSTALLERS = new Set(['install.sh', 'install.ps1'])
// Never copied into the release snapshot of the working tree.
const SNAPSHOT_EXCLUDED = new Set(['.git', '.claude', '.beads', '.ramp-cache', 'node_modules', 'dist'])

// Code-point order, so the result never depends on the runner locale.
export function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function modeOf(mode) {
  return (Number(mode) & 0o111) !== 0 ? '0755' : '0644'
}

function sortLayout(records) {
  return records.sort((left, right) => comparePaths(left.path, right.path))
}

export function treeLayout(root) {
  const records = []
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const path = relative(root, absolute).split(sep).join('/')
      const status = lstatSync(absolute)
      if (status.isDirectory()) visit(absolute)
      else if (status.isFile()) {
        records.push({ path, sha256: sha256(readFileSync(absolute)), mode: modeOf(status.mode) })
      } else {
        throw new Error(`customer layout holds a non-regular file: ${path}`)
      }
    }
  }
  visit(root)
  return sortLayout(records)
}

// Every layout id, in code-point order. `sample` keeps one target tool per
// pack, rotating through the tools so every tool is still exercised.
export function layoutSpecs({ root = repoRoot, sample = false } = {}) {
  const tools = listAdapterIds()
  const specs = []
  listPacks(join(root, 'packs')).forEach((pack, index) => {
    const manifest = loadManifest(join(root, 'packs', pack))
    const packTools = sample ? [tools[index % tools.length]] : tools
    for (const tool of packTools) {
      specs.push({ id: `init/${pack}/${tool}`, route: 'init', pack, tool })
      for (const helper of HELPERS) {
        specs.push({ id: `${helper}/${pack}/${tool}`, route: helper, pack, tool })
      }
    }
    if (manifest.schemaVersion !== 2) return
    const { qualifiedTargets, profiles } = manifest.distribution
    for (const target of qualifiedTargets) {
      specs.push({ id: `release/${pack}/${target}`, route: 'release', pack, tool: target })
      for (const profile of profiles) {
        if (!profile.targets.includes(target)) continue
        specs.push({
          id: `release/${pack}/${target}--${profile.name}`,
          route: 'release',
          pack,
          tool: target,
          profile: profile.name,
        })
      }
    }
  })
  return specs.sort((left, right) => comparePaths(left.id, right.id))
}

export function powerShellAvailable(command = POWERSHELL) {
  const result = spawnSync(command, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], {
    encoding: 'utf8',
    shell: false,
  })
  return !result.error && result.status === 0
}

function run(command, args, { cwd }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', rejectPromise)
    child.on('close', (status) => {
      if (status === 0) resolvePromise()
      else rejectPromise(new Error(`${command} ${args.join(' ')} exited ${status}:\n${output}`))
    })
  })
}

// One context per process: a scratch root, the skill cache, and a lazily
// copied snapshot of the working tree without .git for release builds.
export function createLayoutContext({ root = repoRoot, cacheDir }) {
  if (typeof cacheDir !== 'string' || cacheDir.trim() === '') {
    throw new Error('customer layout needs a synchronized skill cache (RAMP_SKILLS_CACHE)')
  }
  const scratch = mkdtempSync(join(tmpdir(), 'ramp-customer-layout-'))
  let snapshot
  let counter = 0
  const fresh = (label) => {
    counter += 1
    const directory = join(scratch, `${counter}-${label}`)
    mkdirSync(directory)
    return directory
  }
  return {
    root,
    cacheDir,
    fresh,
    // Release verifies every input against the source commit when .git is
    // present. A snapshot without .git lets release read the working tree.
    releaseRoot() {
      if (snapshot === undefined) {
        snapshot = join(scratch, 'release-root')
        cpSync(root, snapshot, {
          recursive: true,
          filter: (source) => {
            const path = relative(root, source)
            return !path.split(sep).some((segment) => SNAPSHOT_EXCLUDED.has(segment))
          },
        })
      }
      return snapshot
    },
    dispose() {
      rmSync(scratch, { recursive: true, force: true })
    },
  }
}

function releaseLayout(context, { pack, tool, profile }) {
  const releaseRoot = context.releaseRoot()
  const bundle = buildBundle(join(releaseRoot, 'packs', pack), {
    target: tool,
    ...(profile !== undefined ? { profile } : {}),
    repoRoot: releaseRoot,
    cacheDir: context.cacheDir,
    sourceCommit: RELEASE_SOURCE_COMMIT,
    buildTime: RELEASE_BUILD_TIME,
  })
  const records = []
  for (const entry of bundle.entries) {
    const path = entry.path.startsWith('overlay/')
      ? entry.path.slice('overlay/'.length)
      : RELEASE_INSTALLERS.has(entry.path) ? entry.path : undefined
    if (path === undefined) continue
    records.push({ path, sha256: sha256(entry.bytes), mode: modeOf(entry.mode) })
  }
  return sortLayout(records)
}

export async function computeLayout(context, spec) {
  if (spec.route === 'release') return releaseLayout(context, spec)
  const cwd = context.fresh('cwd')
  const target = context.fresh('project')
  const packDir = join(context.root, 'packs', spec.pack)
  if (spec.route === 'init') {
    await run(process.execPath, [
      join(context.root, 'installer', 'bin', 'ramp-pack.js'),
      'init', spec.pack,
      '--tool', spec.tool,
      '--target', target,
      '--cache', context.cacheDir,
    ], { cwd })
  } else if (spec.route === 'add-skills.sh') {
    await run('bash', [join(packDir, 'add-skills.sh'), '--tool', spec.tool, '--target', target], { cwd })
  } else if (spec.route === 'add-skills.ps1') {
    await run(POWERSHELL, [
      '-NoLogo', '-NoProfile', '-NonInteractive',
      '-File', join(packDir, 'add-skills.ps1'),
      '-Tool', spec.tool,
      '-Target', target,
    ], { cwd })
  } else {
    throw new Error(`unknown customer layout route: ${spec.route}`)
  }
  const layout = treeLayout(target)
  rmSync(cwd, { recursive: true, force: true })
  rmSync(target, { recursive: true, force: true })
  return layout
}

// Runs computeLayout over specs with at most `concurrency` at a time.
export async function computeLayouts(context, specs, { concurrency = 4 } = {}) {
  const layouts = {}
  let next = 0
  async function worker() {
    while (next < specs.length) {
      const spec = specs[next]
      next += 1
      layouts[spec.id] = await computeLayout(context, spec)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return Object.fromEntries(
    Object.keys(layouts).sort(comparePaths).map((id) => [id, layouts[id]]),
  )
}

// A rule allows one kind of change ('added', 'removed' or 'changed') for every
// `<layout id> <path>` its RegExp matches.
export function layoutDifferences(id, expected, actual, allowlist = {}) {
  const before = new Map(expected.map((record) => [record.path, record]))
  const after = new Map(actual.map((record) => [record.path, record]))
  const differences = []
  for (const path of [...new Set([...before.keys(), ...after.keys()])].sort(comparePaths)) {
    const left = before.get(path)
    const right = after.get(path)
    let change
    if (right === undefined) change = 'removed'
    else if (left === undefined) change = 'added'
    else if (left.sha256 !== right.sha256 || left.mode !== right.mode) change = 'changed'
    else continue
    const allowed = Object.values(allowlist).some(
      (rule) => rule.change === change && rule.match.test(`${id} ${path}`),
    )
    if (!allowed) {
      const detail = change === 'changed'
        ? ` (${left.mode} ${left.sha256.slice(0, 12)} -> ${right.mode} ${right.sha256.slice(0, 12)})`
        : ''
      differences.push(`${change}: ${path}${detail}`)
    }
  }
  return differences
}

// One record per line keeps the committed baseline reviewable in a diff. A
// layout whose list equals an earlier layout's (in id order) is stored as
// { "sameAs": "<that id>" }; the reference always names a stored list.
export function renderBaseline(layouts) {
  const ids = Object.keys(layouts).sort(comparePaths)
  const firstHolder = new Map()
  const lines = ['{', '  "schemaVersion": 1,', '  "layouts": {']
  ids.forEach((id, index) => {
    const records = layouts[id].map((record) => JSON.stringify({
      path: record.path,
      sha256: record.sha256,
      mode: record.mode,
    }))
    const key = records.join('\n')
    const comma = index < ids.length - 1 ? ',' : ''
    if (firstHolder.has(key)) {
      lines.push(`    ${JSON.stringify(id)}: ${JSON.stringify({ sameAs: firstHolder.get(key) })}${comma}`)
      return
    }
    firstHolder.set(key, id)
    lines.push(`    ${JSON.stringify(id)}: [`)
    records.forEach((value, position) => {
      lines.push(`      ${value}${position < records.length - 1 ? ',' : ''}`)
    })
    lines.push(`    ]${comma}`)
  })
  lines.push('  }', '}', '')
  return lines.join('\n')
}

// Returns every layout as its full list, with sameAs references resolved.
export function readBaseline(path = baselinePath) {
  const baseline = JSON.parse(readFileSync(path, 'utf8'))
  if (baseline.schemaVersion !== 1) {
    throw new Error(`unsupported customer layout baseline schemaVersion: ${baseline.schemaVersion}`)
  }
  const layouts = {}
  for (const [id, value] of Object.entries(baseline.layouts)) {
    if (Array.isArray(value)) {
      layouts[id] = value
      continue
    }
    const target = baseline.layouts[value?.sameAs]
    if (!Array.isArray(target)) {
      throw new Error(`customer layout ${id} must be a list or a sameAs reference to a stored list`)
    }
    layouts[id] = target
  }
  return layouts
}
