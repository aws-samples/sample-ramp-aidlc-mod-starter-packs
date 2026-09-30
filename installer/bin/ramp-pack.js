#!/usr/bin/env node
import { Command } from 'commander'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'
import { buildAll, listPacks } from '../src/build-all.js'

const TOOLS = ['kiro', 'claude-code', 'copilot', 'cursor']
const here = dirname(fileURLToPath(import.meta.url))
// Packs live under <repo>/packs/, each in its own directory containing a pack.yaml.
const packsRoot = resolve(here, '..', '..', 'packs')

const program = new Command()
program.name('ramp-pack')

program
  .command('init <pack>')
  .requiredOption('--tool <tool>', `target tool: ${TOOLS.join(', ')}`)
  .option('--dry-run', 'print planned writes without touching disk', false)
  .option('--force', 'overwrite existing files', false)
  .option('--target <dir>', 'target project dir (default: cwd)', process.cwd())
  .action((pack, opts) => {
    if (!TOOLS.includes(opts.tool)) {
      console.error(`Unknown --tool "${opts.tool}". Valid: ${TOOLS.join(', ')}`)
      process.exit(1)
    }
    const packDir = join(packsRoot, pack)
    // A valid pack is a directory with a pack.yaml — this also prevents non-pack
    // dirs (installer/, docs/, a generated dist/) being treated as packs.
    if (!existsSync(join(packDir, 'pack.yaml'))) {
      console.error(`Pack not found: ${pack} (no ${pack}/pack.yaml under ${packsRoot})`)
      process.exit(1)
    }
    try {
      const plan = buildPlan(packDir, opts.tool)
      const written = applyPlan(plan, opts.target, { dryRun: opts.dryRun, force: opts.force })
      const verb = opts.dryRun ? 'Would write' : 'Wrote'
      for (const p of written) console.log(`  ${verb}: ${p}`)
      console.log(`\n${verb} ${written.length} paths for ${pack} → ${opts.tool}.`)
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
  .action((opts) => {
    try {
      if (opts.pack && !existsSync(join(packsRoot, opts.pack, 'pack.yaml'))) {
        console.error(`Pack not found: ${opts.pack} (no ${opts.pack}/pack.yaml under ${packsRoot})`)
        process.exit(1)
      }
      const outDir = resolve(process.cwd(), opts.out)
      const results = buildAll({
        packsRoot,
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
