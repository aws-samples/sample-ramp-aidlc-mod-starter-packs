#!/usr/bin/env node
import { Command } from 'commander'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { buildPlan } from '../src/plan.js'
import { applyPlan } from '../src/apply.js'

const TOOLS = ['kiro', 'claude-code', 'copilot', 'cursor']
const here = dirname(fileURLToPath(import.meta.url))
// Packs live at the repo root, each in its own directory containing a pack.yaml.
const packsRoot = resolve(here, '..', '..')

const program = new Command()
program
  .name('ramp-pack')
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
    // dirs (installer/, docs/, a generated scaffolded-packs/) being treated as packs.
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

program.parse()
