#!/usr/bin/env node
// Builds every qualified release artifact of one pack twice from the same
// explicit source commit and build time, fails unless both builds are
// byte-identical, and then writes the first build plus SHA256SUMS to --out.
//
//   node scripts/verify-release-determinism.mjs --pack <name>
//     [--out <dir>] [--cache <dir>]
//     [--source-commit <sha>] [--build-time <ISO-8601>]
//
// Without --source-commit the script uses `git rev-parse HEAD`. Without
// --build-time it uses SOURCE_DATE_EPOCH, else the source commit's committer
// time. Both values are always passed explicitly to `ramp-pack release`, so
// the two builds cannot derive different provenance.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadManifest } from '../installer/src/manifest.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  throw new Error(message)
}

function git(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    fail(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`)
  }
  return result.stdout.trim()
}

function isoFromEpochSeconds(seconds, label) {
  if (!/^\d+$/.test(seconds)) fail(`${label} must be whole seconds since the epoch: ${seconds}`)
  return new Date(Number(seconds) * 1000).toISOString().replace('.000Z', 'Z')
}

// Code-point order, so the result never depends on the runner locale.
function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function listFiles(root) {
  const files = []
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else files.push(relative(root, path).split(sep).join('/'))
    }
  }
  visit(root)
  return files.sort(compareNames)
}

// One `ramp-pack release` invocation per qualified target set: all qualified
// targets, then each qualified target of each named profile.
export function releaseInvocations(pack, distribution) {
  const qualified = new Set(distribution.qualifiedTargets)
  const invocations = []
  if (qualified.size > 0) invocations.push(['release', pack, '--all-targets'])
  for (const profile of distribution.profiles) {
    for (const target of profile.targets) {
      if (qualified.has(target)) {
        invocations.push(['release', pack, '--target', target, '--profile', profile.name])
      }
    }
  }
  return invocations
}

function build(cli, invocations, common) {
  const outDir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'ramp-release-'))
  for (const args of invocations) {
    const result = spawnSync(process.execPath, [cli, ...args, '--out', outDir, ...common], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    if (result.error || result.status !== 0) {
      rmSync(outDir, { recursive: true, force: true })
      fail(`ramp-pack ${args.join(' ')} exited with ${result.error?.message ?? result.status}`)
    }
  }
  return outDir
}

function compareBuilds(first, second) {
  const firstFiles = listFiles(first)
  const secondFiles = listFiles(second)
  const differences = []
  for (const path of new Set([...firstFiles, ...secondFiles])) {
    if (!firstFiles.includes(path)) differences.push(`${path}: only in the second build`)
    else if (!secondFiles.includes(path)) differences.push(`${path}: only in the first build`)
    else if (!readFileSync(join(first, path)).equals(readFileSync(join(second, path)))) {
      differences.push(`${path}: bytes differ`)
    }
  }
  return { files: firstFiles, differences }
}

function main() {
  const { values } = parseArgs({
    options: {
      pack: { type: 'string' },
      out: { type: 'string', default: 'dist' },
      cache: { type: 'string' },
      'source-commit': { type: 'string' },
      'build-time': { type: 'string' },
      cli: { type: 'string', default: join(repoRoot, 'installer', 'bin', 'ramp-pack.js') },
    },
    strict: true,
  })
  const pack = values.pack
  if (!pack) fail('--pack <name> is required')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pack)) fail(`--pack must be a pack directory name: ${pack}`)
  const packDir = join(repoRoot, 'packs', pack)
  if (!existsSync(join(packDir, 'pack.yaml'))) fail(`no pack.yaml for pack: ${pack}`)

  const invocations = releaseInvocations(pack, loadManifest(packDir).distribution ?? {
    qualifiedTargets: [],
    profiles: [],
  })
  if (invocations.length === 0) fail(`pack ${pack} declares no qualified release targets`)

  const sourceCommit = values['source-commit'] ?? git(['rev-parse', 'HEAD'])
  const buildTime = values['build-time'] ??
    (process.env.SOURCE_DATE_EPOCH
      ? isoFromEpochSeconds(process.env.SOURCE_DATE_EPOCH, 'SOURCE_DATE_EPOCH')
      : isoFromEpochSeconds(git(['show', '-s', '--format=%ct', sourceCommit]), 'commit time'))
  const common = [
    '--source-commit', sourceCommit,
    '--build-time', buildTime,
    ...(values.cache !== undefined ? ['--cache', values.cache] : []),
  ]

  const outDir = resolve(repoRoot, values.out)
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    fail(`output directory is not empty: ${outDir}`)
  }

  console.log(`Building ${pack} twice at ${sourceCommit} (${buildTime})`)
  const first = build(values.cli, invocations, common)
  let second
  try {
    second = build(values.cli, invocations, common)
    const { files, differences } = compareBuilds(first, second)
    if (differences.length > 0) {
      fail(`release builds are not byte-identical:\n  ${differences.join('\n  ')}`)
    }
    const archives = files.filter((path) => path.endsWith('.zip'))
    if (archives.length === 0) fail('release produced no .zip archives')

    mkdirSync(outDir, { recursive: true })
    const sums = []
    const names = new Set()
    for (const path of archives) {
      const name = path.split('/').pop()
      if (names.has(name)) fail(`two archives share one file name: ${name}`)
      names.add(name)
      const bytes = readFileSync(join(first, path))
      writeFileSync(join(outDir, name), bytes)
      sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`)
    }
    writeFileSync(join(outDir, 'SHA256SUMS'), sums.join(''))
    console.log(`Identical across both builds: ${archives.length} archive(s)`)
    process.stdout.write(sums.join(''))
  } finally {
    rmSync(first, { recursive: true, force: true })
    if (second) rmSync(second, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(`error: ${error.message}`)
    process.exitCode = 1
  }
}
