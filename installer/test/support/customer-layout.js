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
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
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
// Top-level entries left out of the release snapshot of a tree without Git.
const SNAPSHOT_EXCLUDED = new Set(['.git', '.claude', '.beads', '.ramp-cache', 'node_modules', 'dist'])
const ALLOWED_CHANGES = new Set(['added', 'removed', 'changed'])

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

// Every layout id, in code-point order. A schemaVersion 2 pack renders its
// declared targets, any other pack every registered tool. `sample` keeps one
// target tool per pack, rotating through the tools so every tool is still
// exercised.
export function layoutSpecs({ root = repoRoot, sample = false } = {}) {
  const registered = listAdapterIds()
  const specs = []
  listPacks(join(root, 'packs')).forEach((pack, index) => {
    const manifest = loadManifest(join(root, 'packs', pack))
    const tools = manifest.schemaVersion === 2 ? manifest.distribution.targets : registered
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
        snapshotReleaseInputs(root, snapshot)
      }
      return snapshot
    },
    dispose() {
      rmSync(scratch, { recursive: true, force: true })
    },
  }
}

// In a Git checkout release accepts only tracked inputs (each one is verified
// against the source commit), so the snapshot holds exactly the tracked files,
// with their working-tree bytes; a tracked file deleted from the working tree
// stays absent. Outside Git, everything is copied except SNAPSHOT_EXCLUDED at
// the top level.
function snapshotReleaseInputs(root, snapshot) {
  if (!existsSync(join(root, '.git'))) {
    cpSync(root, snapshot, {
      recursive: true,
      filter: (source) => !SNAPSHOT_EXCLUDED.has(relative(root, source).split(sep)[0]),
    })
    return
  }
  const tracked = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(Boolean)
  for (const path of tracked) {
    const source = join(root, ...path.split('/'))
    if (!existsSync(source) || !lstatSync(source).isFile()) continue
    const destination = join(snapshot, ...path.split('/'))
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
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

// Problems with allowlist rules. A global or sticky RegExp keeps lastIndex
// between test() calls, so it would match or miss depending on call order.
export function allowlistProblems(allowlist) {
  const problems = []
  for (const [reason, rule] of Object.entries(allowlist)) {
    if (!ALLOWED_CHANGES.has(rule?.change)) {
      problems.push(`${reason}: change must be added, removed or changed`)
    }
    if (!(rule?.match instanceof RegExp)) problems.push(`${reason}: match must be a RegExp`)
    else if (rule.match.global || rule.match.sticky) {
      problems.push(`${reason}: match must not use the g or y flag`)
    }
  }
  return problems
}

// A rule allows one kind of change ('added', 'removed' or 'changed') for every
// `<layout id> <path>` its RegExp matches. The reason of every rule that allowed
// a difference is added to `matched`.
export function layoutDifferences(id, expected, actual, allowlist = {}, matched = new Set()) {
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
    const allowing = Object.entries(allowlist).filter(
      ([, rule]) => rule.change === change && rule.match.test(`${id} ${path}`),
    )
    for (const [reason] of allowing) matched.add(reason)
    if (allowing.length === 0) {
      const detail = change === 'changed'
        ? ` (${left.mode} ${left.sha256.slice(0, 12)} -> ${right.mode} ${right.sha256.slice(0, 12)})`
        : ''
      differences.push(`${change}: ${path}${detail}`)
    }
  }
  return differences
}

function recordLines(layout) {
  return layout.map((record) => JSON.stringify({
    path: record.path,
    sha256: record.sha256,
    mode: record.mode,
  }))
}

// One record per line keeps the committed baseline reviewable in a diff. Each
// entry is a list or a { "sameAs": "<id>" } reference to a stored list.
function serializeBaseline(entries) {
  const ids = Object.keys(entries).sort(comparePaths)
  const lines = ['{', '  "schemaVersion": 1,', '  "layouts": {']
  ids.forEach((id, index) => {
    const comma = index < ids.length - 1 ? ',' : ''
    const entry = entries[id]
    if (!Array.isArray(entry)) {
      lines.push(`    ${JSON.stringify(id)}: ${JSON.stringify({ sameAs: entry.sameAs })}${comma}`)
      return
    }
    const records = recordLines(entry)
    lines.push(`    ${JSON.stringify(id)}: [`)
    records.forEach((value, position) => {
      lines.push(`      ${value}${position < records.length - 1 ? ',' : ''}`)
    })
    lines.push(`    ]${comma}`)
  })
  lines.push('  }', '}', '')
  return lines.join('\n')
}

// A layout whose list equals an earlier layout's (in id order) is stored as
// { "sameAs": "<that id>" }; the reference always names a stored list.
export function renderBaseline(layouts) {
  const firstHolder = new Map()
  const entries = {}
  for (const id of Object.keys(layouts).sort(comparePaths)) {
    if (layouts[id].length === 0) throw new Error(`customer layout ${id} is empty`)
    const key = recordLines(layouts[id]).join('\n')
    if (firstHolder.has(key)) {
      entries[id] = { sameAs: firstHolder.get(key) }
      continue
    }
    firstHolder.set(key, id)
    entries[id] = layouts[id]
  }
  return serializeBaseline(entries)
}

// Adds layouts for new ids to a committed baseline (its text) without
// rewriting any stored entry: every existing id keeps its list or reference,
// and a new layout whose list is already stored refers to that list's
// existing holder, even when the new id sorts first. An id that is already in
// the baseline is refused.
export function addToBaseline(text, layouts) {
  const baseline = JSON.parse(text)
  if (baseline.schemaVersion !== 1) {
    throw new Error(`unsupported customer layout baseline schemaVersion: ${baseline.schemaVersion}`)
  }
  const entries = { ...baseline.layouts }
  const holders = new Map()
  for (const id of Object.keys(entries).sort(comparePaths)) {
    const entry = entries[id]
    if (!Array.isArray(entry)) continue
    const key = recordLines(entry).join('\n')
    if (!holders.has(key)) holders.set(key, id)
  }
  for (const id of Object.keys(layouts).sort(comparePaths)) {
    if (Object.hasOwn(entries, id)) {
      throw new Error(`customer layout ${id} is already in the baseline; --add never changes an existing entry`)
    }
    if (layouts[id].length === 0) throw new Error(`customer layout ${id} is empty`)
    const key = recordLines(layouts[id]).join('\n')
    if (holders.has(key)) {
      entries[id] = { sameAs: holders.get(key) }
      continue
    }
    holders.set(key, id)
    entries[id] = layouts[id]
  }
  return serializeBaseline(entries)
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
      if (value.length === 0) throw new Error(`customer layout ${id} is empty in the baseline`)
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
