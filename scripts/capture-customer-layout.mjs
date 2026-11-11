#!/usr/bin/env node
// Captures the customer-layout baseline: for every delivery route (release
// bundle, `ramp-pack init`, add-skills.sh, add-skills.ps1), pack and target
// tool, the sorted {path, sha256, mode} list a customer project receives.
//
//   RAMP_SKILLS_CACHE=<synchronized cache> node scripts/capture-customer-layout.mjs [--out <file>] [--add]
//
// The baseline records the layout before the skills-namespace migration and
// is captured once. Later allowed changes go into the allowlist of
// installer/test/customer-layout.test.js, never into a re-capture.
//
// --add captures only the layout ids missing from the baseline at --out (for
// example the layouts of a new target tool) and writes them into it. It never
// changes an existing entry: stored lists and sameAs references keep their
// bytes, and an id that is already present is refused.
import { readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  POWERSHELL,
  addToBaseline,
  baselinePath,
  computeLayouts,
  createLayoutContext,
  layoutSpecs,
  powerShellAvailable,
  readBaseline,
  renderBaseline,
} from '../installer/test/support/customer-layout.js'

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: baselinePath },
      add: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!powerShellAvailable()) {
    throw new Error(`${POWERSHELL} is required: the baseline keeps one list per helper`)
  }
  const context = createLayoutContext({ cacheDir: process.env.RAMP_SKILLS_CACHE?.trim() })
  try {
    const out = resolve(values.out)
    const existing = values.add ? readBaseline(out) : {}
    const specs = layoutSpecs().filter((spec) => !Object.hasOwn(existing, spec.id))
    const layouts = await computeLayouts(context, specs, { concurrency: availableParallelism() })
    writeFileSync(
      out,
      values.add ? addToBaseline(readFileSync(out, 'utf8'), layouts) : renderBaseline(layouts),
    )
    const files = Object.values(layouts).reduce((total, layout) => total + layout.length, 0)
    console.log(`${values.add ? 'Added' : 'Captured'} ${specs.length} layouts (${files} files) into ${out}`)
  } finally {
    context.dispose()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`error: ${error.message}`)
    process.exitCode = 1
  })
}
