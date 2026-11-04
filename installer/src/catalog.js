import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadManifest } from './manifest.js'

export function buildCatalog(packsRoot) {
  const entries = readdirSync(packsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packsRoot, entry.name))
    .filter((packDir) => existsSync(join(packDir, 'pack.yaml')))
    .map((packDir) => {
      const manifest = loadManifest(packDir)
      const entry = {
        name: manifest.name,
        title: manifest.title,
        description: manifest.description,
        schemaVersion: manifest.schemaVersion ?? 1,
        catalog: manifest.catalog ?? null,
      }
      if (manifest.schemaVersion === 2) {
        Object.assign(entry, {
          kind: manifest.kind,
          version: manifest.version,
          workflow: manifest.workflow,
          distribution: manifest.distribution,
        })
      }
      return entry
    })

  return entries.sort((left, right) => {
    if (left.name < right.name) return -1
    if (left.name > right.name) return 1
    return 0
  })
}
