import { comparePortablePaths } from '../dependencies/checksum.js'
import { sha256Hex } from './stable-json.js'

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    )
  }
  return value
}

export function normalizeSkillProvenance(provenance) {
  const common = {
    kind: provenance.kind,
    attribution: provenance.attribution,
    name: provenance.name,
    ...(provenance.ownerPack ? { ownerPack: provenance.ownerPack } : {}),
    ...(provenance.version ? { version: provenance.version } : {}),
    ...(provenance.license ? { license: provenance.license } : {}),
    treeSha256: provenance.treeSha256,
    files: provenance.files
      .map((file) => ({
        path: file.path,
        sha256: file.sha256,
        size: file.size,
        executable: file.executable,
      }))
      .sort((left, right) => comparePortablePaths(left.path, right.path)),
    ...(provenance.basedOn
      ? { basedOn: cloneValue(provenance.basedOn) }
      : {}),
  }
  if (provenance.kind === 'upstream') {
    return {
      ...common,
      source: provenance.source,
      repository: provenance.repository,
      commit: provenance.commit,
      path: provenance.path,
      licensePath: provenance.licensePath,
      noticePath: provenance.noticePath,
    }
  }
  return common
}

export function uniqueSkillProvenance(plan) {
  const byName = new Map()
  for (const operation of plan) {
    if (operation.kind !== 'copy') continue
    const normalized = normalizeSkillProvenance(operation.provenance)
    const existing = byName.get(normalized.name)
    if (
      existing &&
      JSON.stringify(existing) !== JSON.stringify(normalized)
    ) {
      throw new Error(`conflicting skill provenance: ${normalized.name}`)
    }
    byName.set(normalized.name, normalized)
  }
  return [...byName.values()].sort((left, right) =>
    comparePortablePaths(left.name, right.name))
}

export function overlayFileRecords(entries) {
  return entries
    .map((entry) => ({
      path: entry.path,
      sha256: sha256Hex(entry.bytes),
      size: entry.bytes.length,
      executable: entry.mode === 0o100755,
    }))
    .sort((left, right) => comparePortablePaths(left.path, right.path))
}

export function publicLegalRecords(sources) {
  return sources.map((source) => ({
    id: source.id,
    license: source.license,
    repository: source.repository,
    commit: source.commit,
    licensePath: source.licensePath,
    noticePath: source.noticePath,
  }))
}
