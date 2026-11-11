#!/usr/bin/env node
// Captures the customer-layout baseline: for every delivery route (release
// bundle, `ramp-pack init`, add-skills.sh, add-skills.ps1), pack and target
// tool, the sorted {path, sha256, mode} list a customer project receives.
//
//   RAMP_SKILLS_CACHE=<synchronized cache> node scripts/capture-customer-layout.mjs [--out <file>]
//
// The baseline records the layout before the skills-namespace migration and
// is captured once. Later allowed changes go into the allowlist of
// installer/test/customer-layout.test.js, never into a re-capture.
import { writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  POWERSHELL,
  baselinePath,
  computeLayouts,
  createLayoutContext,
  layoutSpecs,
  powerShellAvailable,
  renderBaseline,
} from '../installer/test/support/customer-layout.js'

async function main() {
  const { values } = parseArgs({
    options: { out: { type: 'string', default: baselinePath } },
    strict: true,
  })
  if (!powerShellAvailable()) {
    throw new Error(`${POWERSHELL} is required: the baseline keeps one list per helper`)
  }
  const context = createLayoutContext({ cacheDir: process.env.RAMP_SKILLS_CACHE?.trim() })
  try {
    const specs = layoutSpecs()
    const layouts = await computeLayouts(context, specs, { concurrency: availableParallelism() })
    const out = resolve(values.out)
    writeFileSync(out, renderBaseline(layouts))
    const files = Object.values(layouts).reduce((total, layout) => total + layout.length, 0)
    console.log(`Captured ${specs.length} layouts (${files} files) into ${out}`)
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
