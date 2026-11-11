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
    // Copy operations come only from planSkills (skills.js), one per skill.
    // A skill's root skill.yaml is RAMP source metadata and is not installed.
    if (w.kind === 'copy') {
      const metadata = join(w.content, 'skill.yaml')
      cpSync(w.content, dest, { recursive: true, filter: (source) => source !== metadata })
    }
    else writeFileSync(dest, w.content)
  }
  return written
}
