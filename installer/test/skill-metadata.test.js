import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { describe, expect, it } from 'vitest'
import {
  loadRampSkillMetadata,
  skillMetadataFindings,
  skillMetadataView,
} from '../src/dependencies/manifests.js'
import { createSkillResolver } from '../src/dependencies/resolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const commit = 'a'.repeat(40)
const allOrigins = ['ramp', 'upstream', 'local']
const basedOn = {
  source: 'agent-toolkit-for-aws',
  commit,
  path: 'skills/core-skills/aws-iam',
}

function withTempRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-skill-metadata-'))
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function writeSkill(directory, metadata) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'SKILL.md'), '# Skill\n')
  writeFileSync(join(directory, 'skill.yaml'), stringify(metadata, { lineWidth: 0 }))
  return directory
}

function load(metadata, options = { expectedName: 'custom-skill' }) {
  return withTempRoot((root) =>
    loadRampSkillMetadata(writeSkill(root, metadata), options))
}

function v1(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'ramp-skill',
    name: 'custom-skill',
    version: '1.2.3',
    license: 'MIT-0',
    ...overrides,
  }
}

function v2(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'ramp-skill',
    name: 'custom-skill',
    origin: 'ramp',
    version: '1.2.3',
    license: 'MIT-0',
    classification: {
      useCases: ['cloud-native-development'],
      awsServices: ['lambda'],
      technologies: [],
    },
    ...overrides,
  }
}

function upstream(overrides = {}) {
  const { version, license, ...rest } = v2({ origin: 'upstream' })
  return { ...rest, ...overrides }
}

function without(value, key) {
  const { [key]: _removed, ...rest } = value
  return rest
}

describe('skill.yaml schemaVersion 1 stays byte-identical', () => {
  it('returns the v1 shape with no origin or classification added', () => {
    expect(load(v1({ basedOn }))).toEqual({
      schemaVersion: 1,
      kind: 'ramp-skill',
      name: 'custom-skill',
      version: '1.2.3',
      license: 'MIT-0',
      basedOn,
    })
  })

  it.each([
    ['unsupported schemaVersion', v1({ schemaVersion: 3 }), {}, 'skill.yaml has unsupported schemaVersion: 3'],
    ['schemaVersion 2 as a string', v1({ schemaVersion: '2' }), {}, 'skill.yaml has unsupported schemaVersion: 2'],
    ['v2 field in a v1 file', v1({ origin: 'ramp' }), {}, 'skill.yaml has unknown field: origin'],
    ['classification in a v1 file', v1({ classification: {} }), {}, 'skill.yaml has unknown field: classification'],
    ['missing version', without(v1(), 'version'), {}, 'skill.yaml is missing required field: version'],
    ['wrong kind', v1({ kind: 'x' }), {}, 'skill.yaml kind must be ramp-skill'],
    ['invalid name', v1({ name: 'Bad_Name' }), {}, 'skill.yaml name must be a lower-kebab identifier'],
    ['name mismatch', v1(), { expectedName: 'other' }, 'skill.yaml name custom-skill does not match expectedName other'],
    ['invalid version', v1({ version: 'latest' }), {}, 'skill.yaml version has an invalid format'],
    ['empty license', v1({ license: '' }), {}, 'skill.yaml license must be a non-empty string'],
    ['basedOn field', v1({ basedOn: { ...basedOn, repository: 'r' } }), {}, 'skill.yaml basedOn has unknown field: repository'],
    ['RAMP-owned ownerPack', v1({ ownerPack: 'pack-a' }), {}, 'skill.yaml ownerPack is forbidden for RAMP-owned skills'],
    ['override mismatch', v1({ ownerPack: 'pack-a' }), { ownerPack: 'pack-b' }, 'skill.yaml ownerPack pack-a does not match pack-b'],
  ])('keeps the exact v1 message for %s', (_label, metadata, options, message) => {
    expect(() => load(metadata, options)).toThrow(new Error(message))
  })
})

describe('skill.yaml schemaVersion 2', () => {
  it('loads a ramp skill with every optional field', () => {
    expect(load(
      v2({ maturity: 'stable', ownerPack: 'pack-a', basedOn }),
      { expectedName: 'custom-skill', ownerPack: 'pack-a' },
    )).toEqual({
      schemaVersion: 2,
      kind: 'ramp-skill',
      name: 'custom-skill',
      origin: 'ramp',
      version: '1.2.3',
      license: 'MIT-0',
      maturity: 'stable',
      ownerPack: 'pack-a',
      basedOn,
      classification: {
        useCases: ['cloud-native-development'],
        awsServices: ['lambda'],
        technologies: [],
      },
    })
  })

  it('loads an upstream sidecar without version or license when upstream is allowed', () => {
    expect(load(upstream(), { allowedOrigins: allOrigins })).toEqual({
      schemaVersion: 2,
      kind: 'ramp-skill',
      name: 'custom-skill',
      origin: 'upstream',
      classification: {
        useCases: ['cloud-native-development'],
        awsServices: ['lambda'],
        technologies: [],
      },
    })
  })

  it('loads a local skill and fills omitted classification lists', () => {
    expect(load(
      v2({ origin: 'local', license: 'NOASSERTION', classification: {} }),
      { allowedOrigins: ['local'] },
    )).toMatchObject({
        origin: 'local',
        version: '1.2.3',
        license: 'NOASSERTION',
        classification: { useCases: [], awsServices: [], technologies: [] },
      })
  })

  it('accepts every maturity level', () => {
    for (const maturity of ['experimental', 'preview', 'stable', 'deprecated']) {
      expect(load(v2({ maturity }))).toMatchObject({ maturity })
    }
  })

  it('accepts only origin ramp by default, as the RAMP skill paths need', () => {
    expect(() => load(upstream())).toThrow(
      new Error('skill.yaml origin upstream is not accepted here (accepted: ramp)'),
    )
    expect(() => load(v2({ origin: 'local' }))).toThrow(
      new Error('skill.yaml origin local is not accepted here (accepted: ramp)'),
    )
    expect(() => load(v2(), { allowedOrigins: ['upstream', 'local'] })).toThrow(
      new Error('skill.yaml origin ramp is not accepted here (accepted: upstream, local)'),
    )
  })

  it.each([[[]], ['ramp'], [['ramp', 'legacy-local']]])(
    'rejects allowedOrigins %j',
    (allowedOrigins) => {
      expect(() => load(v2(), { allowedOrigins })).toThrow(
        new Error('allowedOrigins must be a non-empty array of: ramp, upstream, local'),
      )
    },
  )

  it('keeps the v1 rule that only a pack-local override may declare ownerPack', () => {
    expect(() => load(v2({ ownerPack: 'pack-a' }))).toThrow(
      new Error('skill.yaml ownerPack is forbidden for RAMP-owned skills'),
    )
  })

  it('requires the exact ownerPack for pack-local overrides', () => {
    const options = { expectedName: 'custom-skill', ownerPack: 'pack-a' }
    expect(load(v2({ ownerPack: 'pack-a' }), options)).toMatchObject({ ownerPack: 'pack-a' })
    expect(() => load(v2({ ownerPack: 'pack-b' }), options)).toThrow(
      new Error('skill.yaml ownerPack pack-b does not match pack-a'),
    )
    expect(() => load(v2(), options)).toThrow(
      new Error('skill.yaml ownerPack must be a non-empty string'),
    )
  })

  it.each([
    ['a v1 body labelled schemaVersion 2', without(without(v2(), 'origin'), 'classification'), 'skill.yaml schemaVersion 2 is missing required field: origin'],
    ['missing classification', without(v2(), 'classification'), 'skill.yaml schemaVersion 2 is missing required field: classification'],
    ['unknown field', v2({ extra: true }), 'skill.yaml has unknown field: extra'],
    ['wrong kind', v2({ kind: 'upstream-skill' }), 'skill.yaml kind must be ramp-skill'],
    ['invalid name', v2({ name: 'Bad_Name' }), 'skill.yaml name must be a lower-kebab identifier'],
    ['name mismatch', v2({ name: 'other-skill' }), 'skill.yaml name other-skill does not match expectedName custom-skill'],
    ['unknown origin', v2({ origin: 'legacy-local' }), 'skill.yaml origin must be one of: ramp, upstream, local'],
    ['ramp without version', without(v2(), 'version'), 'skill.yaml origin ramp is missing required field: version'],
    ['ramp without license', without(v2(), 'license'), 'skill.yaml origin ramp is missing required field: license'],
    ['local without version', without(v2({ origin: 'local' }), 'version'), 'skill.yaml origin local is missing required field: version'],
    ['local without license', without(v2({ origin: 'local' }), 'license'), 'skill.yaml origin local is missing required field: license'],
    ['upstream with version', upstream({ version: '1.0.0' }), 'skill.yaml version is forbidden for origin upstream; the skill lock supplies it'],
    ['upstream with license', upstream({ license: 'MIT-0' }), 'skill.yaml license is forbidden for origin upstream; the skill lock supplies it'],
    ['upstream with ownerPack', upstream({ ownerPack: 'pack-a' }), 'skill.yaml ownerPack is forbidden for origin upstream'],
    ['upstream with basedOn', upstream({ basedOn }), 'skill.yaml basedOn is forbidden for origin upstream'],
    ['local with basedOn', v2({ origin: 'local', basedOn }), 'skill.yaml basedOn is forbidden for origin local'],
    ['invalid version', v2({ version: 'latest' }), 'skill.yaml version has an invalid format'],
    ['invalid license', v2({ license: 'MIT AND' }), 'skill.yaml license has an invalid format'],
    ['invalid ownerPack', v2({ ownerPack: 'Pack A' }), 'skill.yaml ownerPack must be a lower-kebab identifier'],
    ['unknown maturity', v2({ maturity: 'beta' }), 'skill.yaml maturity must be one of: experimental, preview, stable, deprecated'],
    ['unknown basedOn field', v2({ basedOn: { ...basedOn, repository: 'r' } }), 'skill.yaml basedOn has unknown field: repository'],
    ['unsafe basedOn path', v2({ basedOn: { ...basedOn, path: '../escape' } }), 'skill.yaml basedOn path must not contain empty or traversal segments: ../escape'],
    ['classification not an object', v2({ classification: ['lambda'] }), 'skill.yaml classification must be an object'],
    ['unknown classification facet', v2({ classification: { regions: [] } }), 'skill.yaml classification has unknown field: regions'],
    ['facet not an array', v2({ classification: { awsServices: 'lambda' } }), 'skill.yaml classification.awsServices must be an array'],
    ['malformed facet value', v2({ classification: { technologies: ['Node.js'] } }), 'skill.yaml classification.technologies value 0 must be a lower-kebab identifier'],
    ['duplicate facet value', v2({ classification: { awsServices: ['lambda', 'lambda'] } }), 'skill.yaml classification.awsServices has duplicate value: lambda'],
  ])('rejects %s', (_label, metadata, message) => {
    expect(() => load(metadata)).toThrow(new Error(message))
    expect(skillMetadataFindings(metadata, { expectedName: 'custom-skill' }))
      .toContain(message)
  })

  it('collects every structural finding instead of stopping at the first', () => {
    expect(skillMetadataFindings(
      upstream({ name: 'other-skill', version: '1.0.0', ownerPack: 'pack-a', maturity: 'ga' }),
      { expectedName: 'custom-skill' },
    )).toEqual([
      'skill.yaml name other-skill does not match expectedName custom-skill',
      'skill.yaml version is forbidden for origin upstream; the skill lock supplies it',
      'skill.yaml ownerPack is forbidden for origin upstream',
      'skill.yaml maturity must be one of: experimental, preview, stable, deprecated',
    ])
    expect(skillMetadataFindings(v2())).toEqual([])
    expect(skillMetadataFindings(v1())).toEqual([])
    expect(skillMetadataFindings(v1({ version: 'latest' }))).toEqual([
      'skill.yaml version has an invalid format',
    ])
    expect(skillMetadataFindings(null)).toEqual(['skill.yaml must be an object'])
  })

})

describe('schemaVersion 2 in the resolver RAMP skill paths', () => {
  // Writes one skill in skills/ramp/ or as a pack override and resolves it.
  function resolveWith(metadata, { override = false, strictProvenance = false } = {}) {
    return withTempRoot((root) => {
      const packDir = join(root, 'packs', 'demo-pack')
      mkdirSync(packDir, { recursive: true })
      writeSkill(
        override
          ? join(packDir, 'skills', 'custom-skill')
          : join(root, 'skills', 'ramp', 'custom-skill'),
        metadata,
      )
      const resolver = createSkillResolver({
        repoRoot: root,
        cacheDir: join(root, 'cache'),
        strictProvenance,
      })
      const { provenance } = resolver.resolveSkill('custom-skill', { packDir })
      const { treeSha256, files, ...declared } = provenance
      return declared
    })
  }

  it('resolves a v2 RAMP skill with the same declared provenance as its v1 form', () => {
    expect(resolveWith(v2({ basedOn, maturity: 'stable' })))
      .toEqual(resolveWith(v1({ basedOn })))
    expect(resolveWith(v2({ ownerPack: 'demo-pack' }), { override: true }))
      .toEqual(resolveWith(v1({ ownerPack: 'demo-pack' }), { override: true }))
  })

  it.each([false, true])(
    'refuses v2 upstream and local metadata in skills/ramp (strictProvenance %s)',
    (strictProvenance) => {
      expect(() => resolveWith(upstream(), { strictProvenance })).toThrow(
        new Error('skill.yaml origin upstream is not accepted here (accepted: ramp)'),
      )
      expect(() => resolveWith(v2({ origin: 'local' }), { strictProvenance })).toThrow(
        new Error('skill.yaml origin local is not accepted here (accepted: ramp)'),
      )
    },
  )

  it('refuses v2 upstream and local metadata in a pack override', () => {
    expect(() => resolveWith(upstream(), { override: true })).toThrow(
      new Error('skill.yaml origin upstream is not accepted here (accepted: ramp)'),
    )
    expect(() =>
      resolveWith(v2({ origin: 'local', ownerPack: 'demo-pack' }), { override: true }),
    ).toThrow(new Error('skill.yaml origin local is not accepted here (accepted: ramp)'))
  })

  it('refuses ownerPack on a v2 skill in skills/ramp, as for v1', () => {
    expect(() => resolveWith(v2({ ownerPack: 'demo-pack' }))).toThrow(
      new Error('skill.yaml ownerPack is forbidden for RAMP-owned skills'),
    )
    expect(() => resolveWith(v1({ ownerPack: 'demo-pack' }))).toThrow(
      new Error('skill.yaml ownerPack is forbidden for RAMP-owned skills'),
    )
  })
})

describe('skillMetadataView', () => {
  it('presents a v1 result as origin ramp with an empty classification', () => {
    const result = load(v1({ basedOn }))
    const snapshot = structuredClone(result)
    expect(skillMetadataView(result)).toEqual({
      ...snapshot,
      origin: 'ramp',
      classification: { useCases: [], awsServices: [], technologies: [] },
    })
    expect(result).toEqual(snapshot)
    expect(result).not.toHaveProperty('origin')
  })

  it('returns v2 and unsupported values unchanged', () => {
    const result = load(v2())
    expect(skillMetadataView(result)).toBe(result)
    expect(skillMetadataView(null)).toBe(null)
    const unsupported = { schemaVersion: 3 }
    expect(skillMetadataView(unsupported)).toBe(unsupported)
  })
})

describe('published skill-v2 schema', () => {
  const schemaFile = (name) =>
    JSON.parse(readFileSync(join(repoRoot, 'schemas', name), 'utf8'))
  const schema = schemaFile('skill-v2.schema.json')
  const rampV1 = schemaFile('ramp-skill-v1.schema.json')

  function originRule(origin) {
    return schema.allOf.find((rule) =>
      rule.if.properties.origin.const === origin).then
  }

  it('is a closed draft 2020-12 schema with the v2 required fields', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.$id).toBe('skill-v2.schema.json')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'schemaVersion',
      'kind',
      'name',
      'origin',
      'classification',
    ])
    expect(schema.properties.schemaVersion.const).toBe(2)
    expect(schema.properties.kind.const).toBe('ramp-skill')
    expect(schema.properties.origin.enum).toEqual(['ramp', 'upstream', 'local'])
    expect(schema.properties.maturity.enum).toEqual([
      'experimental',
      'preview',
      'stable',
      'deprecated',
    ])
    expect(schema.properties.classification.additionalProperties).toBe(false)
    expect(Object.keys(schema.properties.classification.properties)).toEqual([
      'useCases',
      'awsServices',
      'technologies',
    ])
    expect(schema.$defs.vocabularyList).toMatchObject({ type: 'array', uniqueItems: true })
  })

  it('publishes the origin-specific required and forbidden fields', () => {
    expect(originRule('ramp')).toEqual({ required: ['version', 'license'] })
    expect(originRule('local')).toEqual({
      required: ['version', 'license'],
      properties: { basedOn: false },
    })
    expect(originRule('upstream')).toEqual({
      properties: { version: false, license: false, ownerPack: false, basedOn: false },
    })
  })

  it('keeps the v1 patterns and basedOn contract', () => {
    expect(schema.properties.version.pattern).toBe(rampV1.properties.version.pattern)
    expect(schema.properties.basedOn).toEqual(rampV1.properties.basedOn)
    for (const name of ['identifier', 'commit', 'license', 'portablePath']) {
      expect(schema.$defs[name]).toEqual(rampV1.$defs[name])
    }
  })

  it('accepts at runtime every origin and maturity the schema publishes', () => {
    for (const origin of schema.properties.origin.enum) {
      const metadata = origin === 'upstream' ? upstream() : v2({ origin })
      expect(load(metadata, { allowedOrigins: allOrigins })).toMatchObject({ origin })
    }
    for (const maturity of schema.properties.maturity.enum) {
      expect(load(v2({ maturity }))).toMatchObject({ maturity })
    }
  })
})
