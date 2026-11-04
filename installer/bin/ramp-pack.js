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
  .option('--with-skills', 'also copy skills (default: steering-only + add-skills.sh)', false)
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
      console.log(`\nBuilt ${packs.length} pack(s) → ${where}${opts.withSkills ? ' (with skills)' : ' (steering + add-skills.sh)'}`)
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  })

program.parse()
