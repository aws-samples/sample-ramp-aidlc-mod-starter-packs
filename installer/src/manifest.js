import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export function loadManifest(packDir) {
  const raw = readFileSync(join(packDir, 'pack.yaml'), 'utf8')
  const m = parse(raw)
  const instructions = (m.instructions ?? []).map((i) => ({
    file: i.file,
    role: i.role,
    load: i.load ?? 'always',
  }))
  const primaries = instructions.filter((i) => i.role === 'primary')
  if (primaries.length !== 1) {
    throw new Error(`pack.yaml must declare exactly one instruction with role: primary (found ${primaries.length})`)
  }
  return {
    name: m.name,
    title: m.title,
    description: m.description,
    instructions,
    command: m.command,
    mcp: m.mcp ?? [],
    skills: m.skills ?? 'all',
  }
}
