import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'
import { describe, expect, it } from 'vitest'
import { lintSkillMetadata, loadTaxonomy } from '../src/taxonomy.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const committedTaxonomy = parse(
  readFileSync(join(repoRoot, 'schemas', 'taxonomy.yaml'), 'utf8'),
)

function withTaxonomy(value, run) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-taxonomy-'))
  try {
    mkdirSync(join(root, 'schemas'))
    writeFileSync(
      join(root, 'schemas', 'taxonomy.yaml'),
      typeof value === 'string' ? value : stringify(value),
    )
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function taxonomyWith(edit) {
  const value = structuredClone(committedTaxonomy)
  edit(value)
  return value
}

function v2(overrides = {}) {
  return {
    schemaVersion: 2,
    kind: 'ramp-skill',
    name: 'custom-skill',
    origin: 'ramp',
    version: '1.0.0',
    license: 'MIT-0',
    classification: {
      useCases: ['cloud-native-development'],
      awsServices: ['step-functions'],
      technologies: ['nodejs'],
    },
    ...overrides,
  }
}

function upstream(overrides = {}) {
  const { version, license, ...rest } = v2({ origin: 'upstream' })
  return { ...rest, ...overrides }
}

describe('loadTaxonomy', () => {
  const taxonomy = loadTaxonomy(repoRoot)

  it('loads the design vocabulary (decision D6) in display order', () => {
    expect([...taxonomy.useCases.keys()]).toEqual([
      'application-modernization',
      'cloud-native-development',
      'generative-ai-and-agents',
      'quality-engineering',
      'security-remediation',
      'operations-and-incident-response',
      'infrastructure-as-code',
      'cloud-foundations',
    ])
    expect([...taxonomy.awsServices.keys()]).toEqual([
      'lambda', 'step-functions', 'api-gateway', 'ecs', 'fargate', 'ecr', 'ec2',
      'aurora', 'aurora-dsql', 'dynamodb', 'elasticache', 's3', 'eventbridge',
      'sqs', 'sns', 'kinesis', 'bedrock', 'iam', 'cognito', 'cloudwatch', 'x-ray',
      'cloudformation', 'cdk', 'sam', 'systems-manager', 'secrets-manager',
      'device-farm', 'transform',
    ])
    expect([...taxonomy.technologies.keys()]).toEqual([
      'terraform', 'opentofu', 'ansible', 'pulumi', 'dotnet', 'java', 'kotlin',
      'android', 'ios', 'nodejs', 'mysql', 'postgresql', 'opentelemetry',
      'gitlab', 'nova-sonic', 'strands-agents',
    ])
  })

  it('maps each use case to its pack outcome with a label and description', () => {
    expect(Object.fromEntries(
      [...taxonomy.useCases.values()].map((entry) => [entry.id, entry.outcome]),
    )).toEqual({
      'application-modernization': 'transform',
      'cloud-native-development': 'reimagine',
      'generative-ai-and-agents': 'reimagine',
      'quality-engineering': 'automate',
      'security-remediation': 'automate',
      'operations-and-incident-response': 'automate',
      'infrastructure-as-code': 'foundation',
      'cloud-foundations': 'foundation',
    })
    expect(taxonomy.useCases.get('quality-engineering')).toEqual({
      id: 'quality-engineering',
      label: 'Automate testing',
      description: 'Web, mobile, regression and property-based testing.',
      outcome: 'automate',
      order: 40,
    })
    expect(taxonomy.awsServices.get('lambda')).not.toHaveProperty('outcome')
  })

  it('sorts by order, then id, regardless of file order', () => {
    const value = taxonomyWith((draft) => {
      draft.technologies = [
        { id: 'zeta', label: 'Zeta', description: 'Z.', order: 5 },
        { id: 'beta', label: 'Beta', description: 'B.', order: 5 },
        { id: 'alpha', label: 'Alpha', description: 'A.', order: 9 },
      ]
    })
    withTaxonomy(value, (root) => {
      expect([...loadTaxonomy(root).technologies.keys()]).toEqual([
        'beta',
        'zeta',
        'alpha',
      ])
    })
  })

  it.each([
    ['unsupported schemaVersion', taxonomyWith((t) => { t.schemaVersion = 2 }), 'taxonomy.yaml has unsupported schemaVersion: 2'],
    ['unknown root field', taxonomyWith((t) => { t.regions = [] }), 'taxonomy.yaml has unknown field: regions'],
    ['missing facet', taxonomyWith((t) => { delete t.technologies }), 'taxonomy.yaml is missing required field: technologies'],
    ['empty facet', taxonomyWith((t) => { t.awsServices = [] }), 'taxonomy.yaml awsServices must be a non-empty array'],
    ['duplicate id', taxonomyWith((t) => { t.awsServices.push({ ...t.awsServices[0] }) }), 'taxonomy.yaml awsServices has duplicate id: lambda'],
    ['malformed id', taxonomyWith((t) => { t.technologies[0].id = 'Terraform' }), 'taxonomy.yaml technologies entry 0 id must be a lower-kebab identifier'],
    ['missing label', taxonomyWith((t) => { delete t.awsServices[1].label }), 'taxonomy.yaml awsServices entry 1 is missing required field: label'],
    ['empty description', taxonomyWith((t) => { t.technologies[2].description = ' ' }), 'taxonomy.yaml technologies entry 2 description must be a non-empty string'],
    ['invalid order', taxonomyWith((t) => { t.useCases[0].order = -1 }), 'taxonomy.yaml useCases entry 0 order must be a non-negative safe integer'],
    ['unknown outcome', taxonomyWith((t) => { t.useCases[3].outcome = 'modernize' }), 'taxonomy.yaml useCases entry 3 outcome must be one of: transform, reimagine, automate, foundation'],
    ['missing outcome', taxonomyWith((t) => { delete t.useCases[0].outcome }), 'taxonomy.yaml useCases entry 0 is missing required field: outcome'],
    ['outcome outside use cases', taxonomyWith((t) => { t.awsServices[0].outcome = 'automate' }), 'taxonomy.yaml awsServices entry 0 has unknown field: outcome'],
    ['a list root', '- lambda\n', 'taxonomy.yaml must be an object'],
  ])('rejects %s', (_label, value, message) => {
    withTaxonomy(value, (root) => {
      expect(() => loadTaxonomy(root)).toThrow(new Error(message))
    })
  })

  it('reports a missing or unparsable file', () => {
    expect(() => loadTaxonomy(tmpdir())).toThrow(/taxonomy\.yaml could not be loaded/)
    withTaxonomy('useCases: [\n', (root) => {
      expect(() => loadTaxonomy(root)).toThrow(/taxonomy\.yaml could not be loaded/)
    })
  })
})

describe('lintSkillMetadata', () => {
  const taxonomy = loadTaxonomy(repoRoot)
  const lock = { schemaVersion: 1, skills: new Map([['custom-skill', {}]]) }

  it('returns no findings for valid metadata of every origin', () => {
    expect(lintSkillMetadata(v2(), taxonomy)).toEqual([])
    expect(lintSkillMetadata(v2({ origin: 'local' }), taxonomy)).toEqual([])
    expect(lintSkillMetadata(upstream(), taxonomy, { lock })).toEqual([])
    expect(lintSkillMetadata(
      v2({ classification: { useCases: ['quality-engineering'] } }),
      taxonomy,
      { requireUseCases: true, expectedName: 'custom-skill' },
    )).toEqual([])
  })

  it('reports an unknown awsServices value', () => {
    expect(lintSkillMetadata(
      v2({ classification: { awsServices: ['lambda', 'aws-lambda'] } }),
      taxonomy,
    )).toEqual(['skill.yaml classification.awsServices has unknown value: aws-lambda'])
  })

  it('reports each distinct unknown value once', () => {
    expect(lintSkillMetadata(
      v2({ classification: { awsServices: ['lamda', 'lambda', 'lamda'] } }),
      taxonomy,
    )).toEqual([
      'skill.yaml classification.awsServices has duplicate value: lamda',
      'skill.yaml classification.awsServices has unknown value: lamda',
    ])
  })

  it('throws a clear error when no loaded taxonomy is passed', () => {
    const message = 'lintSkillMetadata requires the taxonomy returned by loadTaxonomy'
    expect(() => lintSkillMetadata(v2())).toThrow(new Error(message))
    expect(() => lintSkillMetadata(v2(), { useCases: [] })).toThrow(new Error(message))
    expect(() => lintSkillMetadata(null, undefined)).toThrow(new Error(message))
  })

  it('reports unknown use case and technology values', () => {
    expect(lintSkillMetadata(
      v2({
        classification: {
          useCases: ['modernization'],
          awsServices: [],
          technologies: ['terraform', 'tofu'],
        },
      }),
      taxonomy,
    )).toEqual([
      'skill.yaml classification.useCases has unknown value: modernization',
      'skill.yaml classification.technologies has unknown value: tofu',
    ])
  })

  it('checks each value against its own facet only', () => {
    expect(lintSkillMetadata(
      v2({ classification: { awsServices: ['nova-sonic'], technologies: ['bedrock'] } }),
      taxonomy,
    )).toEqual([
      'skill.yaml classification.awsServices has unknown value: nova-sonic',
      'skill.yaml classification.technologies has unknown value: bedrock',
    ])
  })

  it('returns every finding without throwing on the first', () => {
    expect(lintSkillMetadata(
      upstream({
        name: 'other-skill',
        license: 'MIT-0',
        ownerPack: 'qa-automated-testing',
        classification: { useCases: ['testing'], awsServices: ['lamda'] },
      }),
      taxonomy,
      { expectedName: 'custom-skill' },
    )).toEqual([
      'skill.yaml name other-skill does not match expectedName custom-skill',
      'skill.yaml license is forbidden for origin upstream; the skill lock supplies it',
      'skill.yaml ownerPack is forbidden for origin upstream',
      'skill.yaml classification.useCases has unknown value: testing',
      'skill.yaml classification.awsServices has unknown value: lamda',
    ])
  })

  it('enforces the origin-specific required and forbidden fields', () => {
    const { version, ...rampWithoutVersion } = v2()
    const { license, ...localWithoutLicense } = v2({ origin: 'local' })
    expect(lintSkillMetadata(rampWithoutVersion, taxonomy)).toEqual([
      'skill.yaml origin ramp is missing required field: version',
    ])
    expect(lintSkillMetadata(localWithoutLicense, taxonomy)).toEqual([
      'skill.yaml origin local is missing required field: license',
    ])
    expect(lintSkillMetadata(upstream({ version: '1.0.0' }), taxonomy)).toEqual([
      'skill.yaml version is forbidden for origin upstream; the skill lock supplies it',
    ])
    expect(lintSkillMetadata(upstream({ ownerPack: 'qa-automated-testing' }), taxonomy))
      .toEqual(['skill.yaml ownerPack is forbidden for origin upstream'])
    expect(lintSkillMetadata(v2({ ownerPack: 'qa-automated-testing' }), taxonomy))
      .toEqual([])
  })

  it('reports a name that does not match the skill directory', () => {
    expect(lintSkillMetadata(v2(), taxonomy, { expectedName: 'other-skill' })).toEqual([
      'skill.yaml name custom-skill does not match expectedName other-skill',
    ])
  })

  it('requires a use case only when asked to', () => {
    const unclassified = v2({ classification: { awsServices: ['lambda'] } })
    expect(lintSkillMetadata(unclassified, taxonomy)).toEqual([])
    expect(lintSkillMetadata(unclassified, taxonomy, { requireUseCases: true })).toEqual([
      'skill.yaml classification.useCases needs at least one value',
    ])
    expect(lintSkillMetadata(
      v2({ classification: { useCases: [] } }),
      taxonomy,
      { requireUseCases: true },
    )).toEqual(['skill.yaml classification.useCases needs at least one value'])
  })

  it('requires a lock entry for origin upstream when given the lock', () => {
    expect(lintSkillMetadata(upstream({ name: 'unlocked-skill' }), taxonomy, { lock }))
      .toEqual([
        'skill.yaml origin upstream requires a skills.lock.yaml entry named unlocked-skill',
      ])
    expect(lintSkillMetadata(v2({ name: 'unlocked-skill' }), taxonomy, { lock }))
      .toEqual([])
  })

  it('reads schemaVersion 1 as origin ramp and reports the missing classification', () => {
    const v1 = {
      schemaVersion: 1,
      kind: 'ramp-skill',
      name: 'custom-skill',
      version: '1.0.0',
      license: 'MIT-0',
    }
    const missing =
      'skill.yaml schemaVersion 1 has no classification; it is read as origin: ramp with an empty classification'
    expect(lintSkillMetadata(v1, taxonomy)).toEqual([missing])
    expect(lintSkillMetadata({ ...v1, version: 'latest' }, taxonomy)).toEqual([
      'skill.yaml version has an invalid format',
      missing,
    ])
    expect(lintSkillMetadata(v1, taxonomy, { requireUseCases: true })).toEqual([
      missing,
      'skill.yaml classification.useCases needs at least one value',
    ])
    expect(lintSkillMetadata(v1, taxonomy, { lock: { skills: new Map() } }))
      .toEqual([missing])
  })

  it('reports metadata that is not a supported skill.yaml', () => {
    expect(lintSkillMetadata(null, taxonomy)).toEqual(['skill.yaml must be an object'])
    expect(lintSkillMetadata({ ...v2(), schemaVersion: 3 }, taxonomy)).toEqual([
      'skill.yaml has unknown field: origin',
    ])
  })
})

describe('published taxonomy-v1 schema', () => {
  const schemaFile = (name) =>
    JSON.parse(readFileSync(join(repoRoot, 'schemas', name), 'utf8'))
  const schema = schemaFile('taxonomy-v1.schema.json')

  it('is a closed draft 2020-12 schema with three non-empty lists', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.$id).toBe('taxonomy-v1.schema.json')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'schemaVersion',
      'useCases',
      'awsServices',
      'technologies',
    ])
    expect(schema.properties.schemaVersion.const).toBe(1)
    expect(schema.properties.useCases).toMatchObject({ type: 'array', minItems: 1 })
    expect(schema.properties.useCases.items.additionalProperties).toBe(false)
    expect(schema.properties.useCases.items.required).toEqual([
      'id',
      'label',
      'description',
      'outcome',
      'order',
    ])
    expect(schema.properties.awsServices.$ref).toBe('#/$defs/facet')
    expect(schema.properties.technologies.$ref).toBe('#/$defs/facet')
    expect(schema.$defs.facet).toMatchObject({ type: 'array', minItems: 1 })
    expect(schema.$defs.facet.items.additionalProperties).toBe(false)
    expect(schema.$defs.facet.items.required).toEqual([
      'id',
      'label',
      'description',
      'order',
    ])
  })

  it('keeps use-case outcomes aligned with pack catalog.outcome', () => {
    const pack = schemaFile('pack-v2.schema.json')
    expect(schema.properties.useCases.items.properties.outcome.enum).toEqual(
      pack.properties.catalog.properties.outcome.enum,
    )
  })

  it('shares the skill identifier pattern', () => {
    const skill = schemaFile('skill-v2.schema.json')
    expect(schema.$defs.identifier).toEqual(skill.$defs.identifier)
  })
})
