import { mkdirSync, writeFileSync, existsSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'

export function applyPlan(plan, targetDir, { dryRun, force }) {
  // pre-flight: detect all conflicts before writing anything
  if (!force) {
    const conflicts = plan
      .map((w) => w.path)
      .filter((p) => existsSync(join(targetDir, p)))
    if (conflicts.length) {
      throw new Error(`target already exists (use --force to overwrite): ${conflicts.join(', ')}`)
    }
  }
  const written = []
  for (const w of plan) {
    const dest = join(targetDir, w.path)
    written.push(w.path)
    if (dryRun) continue
    mkdirSync(dirname(dest), { recursive: true })
    if (w.kind === 'copy') cpSync(w.content, dest, { recursive: true })
    else writeFileSync(dest, w.content)
  }
  return written
}
