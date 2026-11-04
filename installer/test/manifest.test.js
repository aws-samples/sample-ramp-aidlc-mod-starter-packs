// installer/test/manifest.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadManifest } from '../src/manifest.js'

function packWith(yaml) {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'))
  mkdirSync(join(dir, 'instructions'), { recursive: true })
  writeFileSync(join(dir, 'pack.yaml'), yaml)
  return dir
}

function validV2(overrides = '') {
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
workflow:
  provider: local-instructions-v1
  overlays: []
instructions:
  - file: main.md
    role: primary
  - file: helper.md
    role: companion
    load: auto
skills:
  - aws-lambda
distribution:
  targets: [kiro, claude-code, copilot, cursor]
  qualifiedTargets: [kiro, claude-code]
  profiles:
    - name: shared-kiro-claude
      targets: [kiro, claude-code]
      workspaceMode: shared
      specRoot: .kiro/specs
      stateRoot: aidlc-docs
${overrides}`
}

describe('loadManifest', () => {
  it('parses instructions, command, mcp and defaults skills to "all"', () => {
    const dir = packWith(`
name: demo
title: Demo
description: A demo pack.
instructions:
  - file: main.md
    role: primary
  - file: helper.md
    role: companion
    load: auto
command:
  name: aidlc
  description: Start it
mcp:
  - id: aws-knowledge
    command: npx
    args: ["mcp-remote", "https://x"]
`)
    const m = loadManifest(dir)
    expect(m.name).toBe('demo')
    expect(m.instructions).toHaveLength(2)
    expect(m.instructions[0].role).toBe('primary')
    expect(m.command.name).toBe('aidlc')
    expect(m.mcp[0].id).toBe('aws-knowledge')
    expect(m.skills).toBe('all')
    expect(m).not.toHaveProperty('schemaVersion')
    expect(m).not.toHaveProperty('catalog')
  })

  it('throws when there is no primary instruction', () => {
    const dir = packWith(`
name: demo
title: Demo
description: d
instructions:
  - file: a.md
    role: companion
    load: always
`)
    expect(() => loadManifest(dir)).toThrow(/exactly one .*primary/i)
  })

  it('throws when there are two primary instructions', () => {
    const dir = packWith(`
name: demo
title: Demo
description: d
instructions:
  - file: a.md
    role: primary
  - file: b.md
    role: primary
`)
    expect(() => loadManifest(dir)).toThrow(/exactly one .*primary/i)
  })

  it('normalizes a v2 RAMP manifest while retaining role-bearing instructions', () => {
    const m = loadManifest(packWith(validV2()))

    expect(m).toMatchObject({
      schemaVersion: 2,
      kind: 'ramp-pack',
      version: '1.2.3',
      catalog: {
        outcome: 'automate',
        domain: 'quality-engineering',
        executionModel: 'assisted-builder',
        maturity: 'preview',
      },
      workflow: {
        provider: 'local-instructions-v1',
        overlays: [],
      },
      distribution: {
        targets: ['kiro', 'claude-code', 'copilot', 'cursor'],
        qualifiedTargets: ['kiro', 'claude-code'],
      },
    })
    expect(m.instructions.map(({ file, role }) => ({ file, role }))).toEqual([
      { file: 'main.md', role: 'primary' },
      { file: 'helper.md', role: 'companion' },
    ])
  })

  it.each([
    ['schema version', validV2().replace('schemaVersion: 2', 'schemaVersion: 99'), /schemaVersion/i],
    ['kind', validV2().replace('kind: ramp-pack', 'kind: other'), /kind/i],
    ['semantic version', validV2().replace('version: 1.2.3', 'version: latest'), /version/i],
    ['empty domain', validV2().replace('domain: quality-engineering', 'domain: ""'), /domain/i],
    ['outcome', validV2().replace('outcome: automate', 'outcome: migrate'), /outcome/i],
    [
      'execution model',
      validV2().replace('executionModel: assisted-builder', 'executionModel: manual'),
      /executionModel/i,
    ],
    ['maturity', validV2().replace('maturity: preview', 'maturity: beta'), /maturity/i],
    [
      'workflow provider',
      validV2().replace('provider: local-instructions-v1', 'provider: experimental'),
      /provider/i,
    ],
    [
      'adapter target',
      validV2().replace(
        'targets: [kiro, claude-code, copilot, cursor]',
        'targets: [kiro, future-tool]',
      ),
      /future-tool|target/i,
    ],
    [
      'qualified target subset',
      validV2().replace('qualifiedTargets: [kiro, claude-code]', 'qualifiedTargets: [kiro, cursor-plus]'),
      /qualifiedTargets/i,
    ],
    [
      'profile target subset',
      validV2().replace('targets: [kiro, claude-code]\n      workspaceMode', 'targets: [kiro, cursor-plus]\n      workspaceMode'),
      /profile.*target/i,
    ],
    [
      'duplicate instruction files',
      validV2().replace('file: helper.md', 'file: main.md'),
      /duplicate.*instruction/i,
    ],
    [
      'instruction load mode',
      validV2().replace('load: auto', 'load: sometimes'),
      /instruction.*load/i,
    ],
    [
      'instruction description type',
      validV2().replace('    load: auto', '    load: auto\n    description: 42'),
      /instruction.*description.*string/i,
    ],
    [
      'instruction role',
      validV2().replace('role: companion', 'role: sidecar'),
      /instruction.*role/i,
    ],
    [
      'duplicate profile names',
      validV2(`
    - name: shared-kiro-claude
      targets: [kiro]
`),
      /duplicate.*profile/i,
    ],
    [
      'instruction traversal',
      validV2().replace('file: helper.md', 'file: ../helper.md'),
      /instruction.*traversal|unsafe.*instruction/i,
    ],
    [
      'skill traversal',
      validV2().replace('aws-lambda', '../aws-lambda'),
      /skill.*traversal|unsafe.*skill/i,
    ],
    [
      'profile traversal',
      validV2().replace('name: shared-kiro-claude', 'name: ../shared-kiro-claude'),
      /profile.*traversal|unsafe.*profile/i,
    ],
    [
      'profile workspace mode',
      validV2().replace('workspaceMode: shared', 'workspaceMode: merged'),
      /workspaceMode/i,
    ],
    [
      'profile spec root traversal',
      validV2().replace('specRoot: .kiro/specs', 'specRoot: ../specs'),
      /specRoot.*traversal|unsafe.*specRoot/i,
    ],
  ])('rejects invalid v2 %s', (_name, yaml, message) => {
    expect(() => loadManifest(packWith(yaml))).toThrow(message)
  })

  it('rejects disagreement between legacy and capability skill declarations', () => {
    const yaml = validV2(`
capabilities:
  skills:
    - aws-step-functions
`)
    expect(() => loadManifest(packWith(yaml))).toThrow(/skills.*disagree/i)
  })

  it.each([
    ['workflow.primary', validV2().replace('workflow:\n', 'workflow:\n  primary: main.md\n'), /workflow.*primary|unknown.*workflow/i],
    ['an unknown top-level field', `${validV2()}\nunexpected: true\n`, /unknown.*unexpected|unexpected.*field/i],
    [
      'an unknown catalog field',
      validV2().replace('  maturity: preview', '  maturity: preview\n  phase: assess'),
      /catalog.*phase|unknown.*phase/i,
    ],
    [
      'an unknown instruction field',
      validV2().replace('    load: auto', '    load: auto\n    target: all'),
      /instruction.*target|unknown.*target/i,
    ],
    [
      'an unknown distribution field',
      validV2().replace('  qualifiedTargets:', '  channel: preview\n  qualifiedTargets:'),
      /distribution.*channel|unknown.*channel/i,
    ],
    [
      'an unknown profile field',
      validV2().replace('      stateRoot: aidlc-docs', '      stateRoot: aidlc-docs\n      merge: true'),
      /profile.*merge|unknown.*merge/i,
    ],
  ])('rejects schema-forbidden shape: %s', (_name, yaml, message) => {
    expect(() => loadManifest(packWith(yaml))).toThrow(message)
  })

  it('accepts SemVer prerelease identifiers that start numeric but are alphanumeric', () => {
    const manifest = loadManifest(packWith(validV2().replace('version: 1.2.3', 'version: 1.0.0-1a')))

    expect(manifest.version).toBe('1.0.0-1a')
  })

  it('rejects numeric SemVer prerelease identifiers with a leading zero', () => {
    expect(() =>
      loadManifest(packWith(validV2().replace('version: 1.2.3', 'version: 1.0.0-01'))),
    ).toThrow(/version/i)
  })

  it('publishes the same SemVer edge-case behavior in the JSON schema', () => {
    const schema = JSON.parse(
      readFileSync(new URL('../../schemas/pack-v2.schema.json', import.meta.url), 'utf8'),
    )
    const semver = new RegExp(schema.properties.version.pattern)

    expect(semver.test('1.0.0-1a')).toBe(true)
    expect(semver.test('1.0.0-01')).toBe(false)
  })

  it('publishes non-empty declared and profile target arrays in the JSON schema', () => {
    const schema = JSON.parse(
      readFileSync(new URL('../../schemas/pack-v2.schema.json', import.meta.url), 'utf8'),
    )

    expect(schema.$defs.nonEmptyTargets).toMatchObject({ minItems: 1 })
    expect(schema.properties.distribution.properties.targets.$ref).toBe(
      '#/$defs/nonEmptyTargets',
    )
    expect(
      schema.properties.distribution.properties.profiles.items.properties.targets.$ref,
    ).toBe('#/$defs/nonEmptyTargets')
  })

  it('accepts equivalent legacy and capability skill declarations regardless of order', () => {
    const yaml = validV2()
      .replace('  - aws-lambda', '  - aws-lambda\n  - aws-step-functions')
      .concat(`
capabilities:
  skills:
    - aws-step-functions
    - aws-lambda
`)
    expect(() => loadManifest(packWith(yaml))).not.toThrow()
  })

  it('uses a capabilities-only skill declaration as the effective v2 skill list', () => {
    const yaml = validV2()
      .replace('skills:\n  - aws-lambda\n', '')
      .concat(`
capabilities:
  skills:
    - aws-step-functions
`)
    const manifest = loadManifest(packWith(yaml))

    expect(manifest.skills).toEqual(['aws-step-functions'])
    expect(manifest.capabilities.skills).toEqual(['aws-step-functions'])
  })

  it('rejects a non-object capabilities declaration', () => {
    const yaml = validV2(`
capabilities: invalid
`)
    expect(() => loadManifest(packWith(yaml))).toThrow(/capabilities.*object/i)
  })

  it.each([
    ['an array', '[]'],
    ['a scalar', 'invalid'],
  ])('rejects a v2 command declared as %s', (_name, value) => {
    const yaml = `${validV2()}\ncommand: ${value}\n`

    expect(() => loadManifest(packWith(yaml))).toThrow(/command.*object/i)
  })

  it.each([
    ['an object', '{}'],
    ['a scalar', 'invalid'],
  ])('rejects v2 mcp declared as %s', (_name, value) => {
    const yaml = `${validV2()}\nmcp: ${value}\n`

    expect(() => loadManifest(packWith(yaml))).toThrow(/mcp.*array/i)
  })

  it('accepts matching legacy and capability all-skill declarations', () => {
    const yaml = validV2()
      .replace('skills:\n  - aws-lambda', 'skills: all')
      .concat(`
capabilities:
  skills: all
`)
    const manifest = loadManifest(packWith(yaml))

    expect(manifest.skills).toBe('all')
    expect(manifest.capabilities.skills).toBe('all')
  })
})
