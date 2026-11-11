#!/usr/bin/env node
import { Command } from 'commander'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'
import { buildAll, listPacks } from '../src/build-all.js'
import { listAdapterIds } from '../src/adapters/index.js'
import { loadManifest } from '../src/manifest.js'
import { resolveWorkspace } from '../src/workspace.js'
import { createSkillResolver } from '../src/dependencies/resolver.js'
import { releasePack } from '../src/release/index.js'
import {
  syncLockedSkills,
  updateSkillLocks,
  verifyLockedSkills,
} from '../src/dependencies/sync.js'

const TOOLS = listAdapterIds()
const here = dirname(fileURLToPath(import.meta.url))
// Packs live under <repo>/packs/, each in its own directory containing a pack.yaml.
const repoRoot = resolve(here, '..', '..')
const packsRoot = join(repoRoot, 'packs')

const program = new Command()
program.name('ramp-pack')

function selectedTools(opts) {
  const hasTool = opts.tool !== undefined
  const hasTools = opts.tools !== undefined
  if (hasTool === hasTools) {
    throw new Error('select exactly one of --tool or --tools')
  }

  const raw = hasTool ? [opts.tool] : opts.tools.split(',')
  const tools = raw.map((tool) => tool.trim())
  if (tools.some((tool) => tool === '')) {
    throw new Error('--tools must not contain an empty tool')
  }
  return tools
}

function collect(value, previous) {
  return [...previous, value]
}

function parseMappings(values, label) {
  const result = new Map()
  for (const value of values) {
    const separator = value.indexOf('=')
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`${label} must use <source-id>=<value>`)
    }
    const key = value.slice(0, separator)
    const mapped = value.slice(separator + 1)
    if (result.has(key)) throw new Error(`duplicate ${label} source: ${key}`)
    result.set(key, mapped)
  }
  return result
}

function parseSelections(values) {
  return values.map((value) => {
    const equals = value.indexOf('=')
    const colon = equals === -1 ? -1 : value.indexOf(':', equals + 1)
    if (
      equals <= 0 ||
      colon <= equals + 1 ||
      colon === value.length - 1
    ) {
      throw new Error(
        '--select must use <name>=<source-id>:<portable-path>',
      )
    }
    return {
      name: value.slice(0, equals),
      source: value.slice(equals + 1, colon),
      path: value.slice(colon + 1),
    }
  })
}

function failCli(error) {
  console.error(error.message)
  process.exit(1)
}

program
  .command('init <pack>')
  .option('--tool <tool>', `single target tool: ${TOOLS.join(', ')}`)
  .option('--tools <tools>', 'comma-separated target tools for one shared workspace')
  .option('--profile <name>', 'named workspace profile from the pack manifest')
  .option('--spec-root <path>', 'shared relative spec directory')
  .option('--state-root <path>', 'shared relative workflow state directory')
  .option('--cache <dir>', 'skill cache root; overrides RAMP_SKILLS_CACHE')
  .option('--dry-run', 'print planned writes without touching disk', false)
  .option('--force', 'overwrite existing files', false)
  .option('--target <dir>', 'target project dir (default: cwd)', process.cwd())
  .action((pack, opts) => {
    const packDir = join(packsRoot, pack)
    // A valid pack is a directory with a pack.yaml — this also prevents non-pack
    // dirs (installer/, docs/, a generated dist/) being treated as packs.
    if (!existsSync(join(packDir, 'pack.yaml'))) {
      console.error(`Pack not found: ${pack} (no ${pack}/pack.yaml under ${packsRoot})`)
      process.exit(1)
    }
    try {
      const tools = selectedTools(opts)
      const manifest = loadManifest(packDir)
      const workspace = resolveWorkspace(manifest, {
        tools,
        profile: opts.profile,
        specRoot: opts.specRoot,
        stateRoot: opts.stateRoot,
      })
      const resolver = createSkillResolver({
        repoRoot,
        ...(opts.cache !== undefined ? { cacheDir: opts.cache } : {}),
        allowLegacyLocal: true,
        strictProvenance: false,
      })
      const plan = tools.flatMap((tool) =>
        buildPlan(packDir, tool, { workspace, resolver }))
      const written = applyPlan(plan, opts.target, { dryRun: opts.dryRun, force: opts.force })
      const verb = opts.dryRun ? 'Would write' : 'Wrote'
      for (const p of written) console.log(`  ${verb}: ${p}`)
      console.log(`\n${verb} ${written.length} paths for ${pack} → ${tools.join(', ')}.`)
      if (!opts.dryRun) console.log('Next: review generated files; edit AWS_PROFILE in the MCP config if present.')
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  })

// build-all: regenerate the per-tool output for every pack (or one) into <out>.
// Replaces the committed scaffolded-packs/ tree. CI publishes <out> to gh-pages;
// hand-editors run it locally to preview their changes rendered per tool.
program
  .command('build-all')
  .option('--out <dir>', 'output directory (default: dist)', 'dist')
  .option('--pack <pack>', 'build a single pack instead of all')
  .option('--in-place', 'write committed scaffolds into packs/<pack>/scaffolded-packs/', false)
  .option('--with-skills', 'also copy skills (default: steering-only + add-skills.sh/add-skills.ps1)', false)
  .option('--cache <dir>', 'skill cache root when --with-skills is used')
  .action((opts) => {
    try {
      if (opts.pack && !existsSync(join(packsRoot, opts.pack, 'pack.yaml'))) {
        console.error(`Pack not found: ${opts.pack} (no ${opts.pack}/pack.yaml under ${packsRoot})`)
        process.exit(1)
      }
      const outDir = resolve(process.cwd(), opts.out)
      const results = buildAll({
        packsRoot,
        repoRoot,
        cacheDir: opts.cache,
        outDir,
        pack: opts.pack,
        includeSkills: opts.withSkills,
        inPlace: opts.inPlace,
      })
      const packs = opts.pack ? [opts.pack] : listPacks(packsRoot)
      for (const r of results) console.log(`  ${r.pack} → ${r.tool}: ${r.count} paths`)
      const where = opts.inPlace ? 'packs/<pack>/scaffolded-packs/' : outDir
      console.log(`\nBuilt ${packs.length} pack(s) → ${where}${opts.withSkills ? ' (with skills)' : ' (steering + add-skills.sh/add-skills.ps1)'}`)
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  })

// release: build deterministic per-target ZIPs into ignored dist/. Never publishes.
program
  .command('release <pack>')
  .option('--target <tool>', `single qualified target: ${TOOLS.join(', ')}`)
  .option('--all-targets', 'every target in distribution.qualifiedTargets', false)
  .option('--profile <name>', 'named workspace profile from the pack manifest')
  .option('--spec-root <path>', 'shared relative spec directory')
  .option('--state-root <path>', 'shared relative workflow state directory')
  .option('--out <dir>', 'output directory (default: <repo>/dist)')
  .option('--cache <dir>', 'skill cache root; overrides RAMP_SKILLS_CACHE')
  .option('--source-commit <sha>', 'source commit (default: git rev-parse HEAD)')
  .option('--build-time <ISO-8601>', 'build time (default: SOURCE_DATE_EPOCH or commit time)')
  .action(async (pack, opts) => {
    try {
      const packDir = join(packsRoot, pack)
      if (!existsSync(join(packDir, 'pack.yaml'))) {
        throw new Error(`Pack not found: ${pack} (no ${pack}/pack.yaml under ${packsRoot})`)
      }
      if ((opts.target !== undefined) === opts.allTargets) {
        throw new Error('select exactly one of --target or --all-targets')
      }
      let targets = [opts.target]
      if (opts.allTargets) {
        targets = loadManifest(packDir).distribution?.qualifiedTargets ?? []
        if (targets.length === 0) throw new Error(`pack ${pack} has no qualified targets`)
      }
      for (const target of targets) {
        const result = await releasePack(packDir, {
          target,
          profile: opts.profile,
          specRoot: opts.specRoot,
          stateRoot: opts.stateRoot,
          outDir: opts.out !== undefined ? resolve(process.cwd(), opts.out) : undefined,
          repoRoot,
          cacheDir: opts.cache,
          sourceCommit: opts.sourceCommit,
          buildTime: opts.buildTime,
        })
        for (const warning of result.warnings) console.error(`warning: ${warning}`)
        console.log(`${result.sha256}  ${result.archivePath}`)
      }
    } catch (error) {
      failCli(error)
    }
  })

const skills = program.command('skills')
skills.description('verify, synchronize, and update immutable upstream skills')

skills
  .command('verify')
  .option('--cache <dir>', 'skill cache root; overrides RAMP_SKILLS_CACHE')
  .action((opts) => {
    try {
      const result = verifyLockedSkills({
        repoRoot,
        ...(opts.cache !== undefined ? { cacheDir: opts.cache } : {}),
      })
      console.log(`Verified ${result.skills.length} locked skill(s) in ${result.cacheDir}`)
    } catch (error) {
      failCli(error)
    }
  })

skills
  .command('sync')
  .option('--locked', 'synchronize only the committed immutable lock', false)
  .option('--cache <dir>', 'skill cache root; overrides RAMP_SKILLS_CACHE')
  .option(
    '--source-root <source-id=dir>',
    'local Git object database for one source',
    collect,
    [],
  )
  .option('--offline', 'disable network acquisition', false)
  .action((opts) => {
    try {
      if (!opts.locked) throw new Error('skills sync requires --locked')
      const result = syncLockedSkills({
        repoRoot,
        ...(opts.cache !== undefined ? { cacheDir: opts.cache } : {}),
        sourceRoots: parseMappings(opts.sourceRoot, '--source-root'),
        allowNetwork: !opts.offline,
      })
      for (const source of result.sources) {
        console.log(`${source.source}@${source.commit} ${source.status}`)
      }
      for (const skill of result.skills) {
        console.log(`${skill.name} ${skill.status}`)
      }
      console.log(`Cache: ${result.cacheDir}`)
    } catch (error) {
      failCli(error)
    }
  })

skills
  .command('update-lock')
  .option('--skill <name>', 'skill name to discover or refresh', collect, [])
  .option(
    '--select <name=source:path>',
    'exact skill source and source-relative path',
    collect,
    [],
  )
  .option('--ref <source-id=ref>', 'per-source Git ref', collect, [])
  .option('--cache <dir>', 'skill cache root; overrides RAMP_SKILLS_CACHE')
  .option(
    '--source-root <source-id=dir>',
    'local Git object database for one source',
    collect,
    [],
  )
  .option('--offline', 'disable network acquisition', false)
  .action((opts) => {
    try {
      if (opts.skill.length + opts.select.length === 0) {
        throw new Error('skills update-lock requires --skill or --select')
      }
      const result = updateSkillLocks({
        repoRoot,
        names: opts.skill,
        selections: parseSelections(opts.select),
        ...(opts.cache !== undefined ? { cacheDir: opts.cache } : {}),
        sourceRoots: parseMappings(opts.sourceRoot, '--source-root'),
        sourceRefs: parseMappings(opts.ref, '--ref'),
        allowNetwork: !opts.offline,
      })
      for (const captured of result.commits) {
        console.log(`${captured.source}: ${captured.ref} -> ${captured.commit}`)
      }
      console.log(`Updated: ${result.updated.join(', ')}`)
      if (result.preserved.length > 0) {
        console.log(`Preserved: ${result.preserved.join(', ')}`)
      }
      console.log(`Lock: ${result.lockPath}`)
      console.log(`Cache: ${result.cacheDir}`)
    } catch (error) {
      failCli(error)
    }
  })

await program.parseAsync()
