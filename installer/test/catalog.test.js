import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog } from '../src/catalog.js'

const here = dirname(fileURLToPath(import.meta.url))

function writePack(root, directory, yaml) {
  const packDir = join(root, directory)
  mkdirSync(join(packDir, 'instructions'), { recursive: true })
  writeFileSync(join(packDir, 'pack.yaml'), yaml)
}

describe('buildCatalog', () => {
  it('includes legacy and v2 packs in deterministic manifest-name order', () => {
    const root = mkdtempSync(join(tmpdir(), 'packs-'))
    writePack(
      root,
      'z-directory',
      `
name: legacy-z
title: Legacy Z
description: Legacy pack.
instructions:
  - file: main.md
    role: primary
`,
    )
    writePack(
      root,
      'a-directory',
      `
schemaVersion: 2
kind: ramp-pack
name: classified-a
title: Classified A
description: Classified pack.
version: 0.1.0
catalog:
  outcome: transform
  domain: application-modernization
  executionModel: assisted-builder
  maturity: preview
workflow:
  provider: local-instructions-v1
  overlays: []
instructions:
  - file: main.md
    role: primary
skills: []
distribution:
  targets: [kiro, claude-code]
  qualifiedTargets: [kiro]
  profiles: []
`,
    )
    mkdirSync(join(root, 'not-a-pack'))

    const catalog = buildCatalog(root)

    expect(catalog.map((entry) => entry.name)).toEqual(['classified-a', 'legacy-z'])
    expect(catalog[0]).toMatchObject({
      schemaVersion: 2,
      kind: 'ramp-pack',
      version: '0.1.0',
      catalog: {
        outcome: 'transform',
        domain: 'application-modernization',
        executionModel: 'assisted-builder',
        maturity: 'preview',
      },
      workflow: { provider: 'local-instructions-v1', overlays: [] },
      distribution: {
        targets: ['kiro', 'claude-code'],
        qualifiedTargets: ['kiro'],
        profiles: [],
      },
    })
    expect(catalog[1]).toEqual({
      name: 'legacy-z',
      title: 'Legacy Z',
      description: 'Legacy pack.',
      schemaVersion: 1,
      catalog: null,
    })
  })

  it('classifies the two migrated pilot packs and exposes legacy migration status', () => {
    const packsRoot = join(here, '..', '..', 'packs')
    const catalog = buildCatalog(packsRoot)
    const qa = catalog.find((entry) => entry.name === 'qa-automated-testing')
    const legacy = catalog.find((entry) => entry.name === 'legacy-transformation-on-aws')
    const unmigrated = catalog.find((entry) => entry.name === 'agentic-ai-workflow')

    expect(qa).toMatchObject({
      schemaVersion: 2,
      catalog: {
        outcome: 'automate',
        domain: 'quality-engineering',
        executionModel: 'assisted-builder',
        maturity: 'preview',
      },
      distribution: {
        targets: ['kiro', 'claude-code', 'copilot', 'cursor'],
        qualifiedTargets: ['kiro', 'claude-code'],
      },
    })
    expect(legacy).toMatchObject({
      schemaVersion: 2,
      catalog: {
        outcome: 'transform',
        domain: 'application-modernization',
        executionModel: 'assisted-builder',
        maturity: 'preview',
      },
    })
    expect(unmigrated).toMatchObject({ schemaVersion: 1, catalog: null })
  })
})
