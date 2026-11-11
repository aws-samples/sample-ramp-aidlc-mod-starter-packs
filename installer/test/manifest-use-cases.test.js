// installer/test/manifest-use-cases.test.js
import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadManifest } from '../src/manifest.js'

const packsRoot = fileURLToPath(new URL('../../packs', import.meta.url))

// Appendix B of docs/design/skills-namespace-and-navigation.md.
// regression-software-testing has no pack.yaml yet, so it is not listed.
const PACK_USE_CASES = {
  'agentic-ai-workflow': ['generative-ai-and-agents', 'infrastructure-as-code'],
  'agentic-incident-response': ['operations-and-incident-response'],
  'api-platform-migration-n-modernization': ['application-modernization'],
  'cots-rewrite-on-cloudnative': ['application-modernization', 'cloud-native-development'],
  'dotnet-app-modernization-on-aws': ['application-modernization'],
  'framework-upgrade-containerise': ['application-modernization'],
  'genai-on-serverless': ['generative-ai-and-agents'],
  'legacy-transformation-on-aws': ['application-modernization'],
  'ocr-mobile-app-on-serverless': ['cloud-native-development', 'generative-ai-and-agents'],
  'qa-automated-testing': ['quality-engineering'],
  'serverless-event-driven-on-aws': ['cloud-native-development'],
  'voice-ai-agent-on-aws': ['generative-ai-and-agents'],
  'vulnerability-remediation-pipeline': ['security-remediation'],
  'web-app-on-cloudnative': ['cloud-native-development'],
}

function packWith(yaml) {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'))
  mkdirSync(join(dir, 'instructions'), { recursive: true })
  writeFileSync(join(dir, 'pack.yaml'), yaml)
  return dir
}

function v1(catalog = '') {
  return `
name: demo
title: Demo
description: A demo pack.
${catalog}
instructions:
  - file: main.md
    role: primary
`
}

function v2(useCases = '') {
  return `
schemaVersion: 2
kind: ramp-pack
name: demo
title: Demo
description: A demo pack.
version: 1.2.3
catalog:
  outcome: automate
  domain: quality-engineering
  executionModel: assisted-builder
  maturity: preview
${useCases}
workflow:
  provider: local-instructions-v1
  overlays: []
instructions:
  - file: main.md
    role: primary
distribution:
  targets: [kiro]
  qualifiedTargets: []
  profiles: []
`
}

describe('catalog.useCases', () => {
  it('loads every pack manifest of the repository with its Appendix B use cases', () => {
    const declared = Object.fromEntries(
      readdirSync(packsRoot)
        .filter((name) => existsSync(join(packsRoot, name, 'pack.yaml')))
        .map((name) => [name, loadManifest(join(packsRoot, name)).catalog?.useCases]),
    )
    expect(declared).toEqual(PACK_USE_CASES)
    expect(existsSync(join(packsRoot, 'regression-software-testing', 'pack.yaml'))).toBe(false)
  })

  it('loads a v2 manifest that declares use cases', () => {
    const m = loadManifest(packWith(v2('  useCases: [quality-engineering, application-modernization]')))
    expect(m.catalog).toEqual({
      outcome: 'automate',
      domain: 'quality-engineering',
      executionModel: 'assisted-builder',
      maturity: 'preview',
      useCases: ['quality-engineering', 'application-modernization'],
    })
  })

  it('still loads a v2 manifest without use cases', () => {
    const m = loadManifest(packWith(v2()))
    expect(m.catalog).not.toHaveProperty('useCases')
  })

  it('loads a v1 manifest whose catalog block holds only use cases', () => {
    const m = loadManifest(packWith(v1('catalog:\n  useCases: [cloud-native-development]')))
    expect(m.catalog).toEqual({ useCases: ['cloud-native-development'] })
    expect(m).not.toHaveProperty('schemaVersion')
  })

  it('still loads a v1 manifest without a catalog block', () => {
    expect(loadManifest(packWith(v1()))).not.toHaveProperty('catalog')
  })

  it('refuses an unknown use case in v1 and v2 manifests', () => {
    const message = 'pack.yaml catalog.useCases value is not in schemas/taxonomy.yaml: build-things'
    expect(() => loadManifest(packWith(v1('catalog:\n  useCases: [build-things]')))).toThrow(message)
    expect(() => loadManifest(packWith(v2('  useCases: [quality-engineering, build-things]')))).toThrow(message)
  })

  it('refuses any other catalog field in a v1 manifest', () => {
    expect(() => loadManifest(packWith(v1('catalog:\n  outcome: automate\n  useCases: [quality-engineering]'))))
      .toThrow('pack.yaml catalog has unknown field: outcome')
    expect(() => loadManifest(packWith(v1('catalog:\n  maturity: preview'))))
      .toThrow('pack.yaml catalog has unknown field: maturity')
    expect(() => loadManifest(packWith(v1('catalog: {}'))))
      .toThrow('pack.yaml catalog.useCases must be an array')
    expect(() => loadManifest(packWith(v1('catalog: quality-engineering'))))
      .toThrow('pack.yaml catalog must be an object')
  })

  it('refuses an empty, duplicated or non-list use case declaration', () => {
    expect(() => loadManifest(packWith(v2('  useCases: []'))))
      .toThrow('pack.yaml catalog.useCases must not be empty')
    expect(() => loadManifest(packWith(v2('  useCases: [quality-engineering, quality-engineering]'))))
      .toThrow('pack.yaml has duplicate use case: quality-engineering')
    expect(() => loadManifest(packWith(v2('  useCases: quality-engineering'))))
      .toThrow('pack.yaml catalog.useCases must be an array')
  })

  it('publishes catalog.useCases as an optional vocabulary list in the JSON schema', () => {
    const schema = JSON.parse(
      readFileSync(new URL('../../schemas/pack-v2.schema.json', import.meta.url), 'utf8'),
    )
    const catalog = schema.properties.catalog
    expect(catalog.required).not.toContain('useCases')
    expect(catalog.properties.useCases).toMatchObject({
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { $ref: '#/$defs/identifier' },
    })
  })
})
