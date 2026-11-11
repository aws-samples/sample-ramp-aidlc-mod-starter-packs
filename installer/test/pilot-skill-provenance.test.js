import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSkillResolver } from '../src/dependencies/resolver.js'
import { loadSkillLock } from '../src/dependencies/manifests.js'
import { loadManifest } from '../src/manifest.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const defaultCache = join(repoRoot, '.ramp-cache')

const PILOT_IDS = [
  'qa-automated-testing',
  'legacy-transformation-on-aws',
]

// Locked skills whose skills-library mirror differs from the lock, so they
// resolve only from a synchronized cache. Every mirror matches its lock, so
// with no cache each pilot skill must still resolve from its mirror; any
// mirror drift fails the unsynchronized run.
const EXPECTED_UNSYNCHRONIZED_FAILURES = {
  'qa-automated-testing': [],
  'legacy-transformation-on-aws': [],
}

const PRESERVED_ENTRY_DIGESTS = new Map([
  ['amazon-aurora-mysql', 'a2b7a1b06ac7ca2f6b4f9c92ba2e1ff50aa7a24c6cd3e1ec4aeb8c9d0c1f6e36'],
  ['amazon-aurora-postgresql', '7de7db05324e2680212bb71bc6358182c066f8e6753d6e0f602bdc65642f4222'],
  ['api-gateway', '7b2443843942da74c1162975d9211e29fdd54e167bd9055f1b38efa5d2b1295b'],
  ['aurora-dsql', '079c81f48d4d2deecbb2f44b0efa404a2d622195b50b0001810d4dea64f0ea93'],
  ['aws-iam', '9ae1277ebee068b80202e1c0420f15cdd3ff9e2748fb55361c650e7c2a4fa6e0'],
  ['aws-lambda', '6cb5e9e79877e156a70d7234816a323acbeee0b0b8ac734a89527e1e14991d13'],
  ['aws-step-functions', 'e2701921cce1252bd99fbf16cc3bb1d519271e31ba5fe5c2f44e1be2dbaeb047'],
  ['connecting-lambda-to-api-gateway', 'aa5a516e97957961a701e48f8442b7578631036dbcc7b2d16ead033b3aa07d1f'],
  ['creating-amazon-aurora-db-cluster-with-instances', 'b076af5330d62da5d9aa7ecc48d7d03aea20a9a5f4aa47b4a7f88b3ed9a82ca3'],
  ['signing-in-to-aws', '0c7de07ed3010e87bb270643d41cadf4aa7e707a8b9d1d3244d478b9f28d638d'],
])

const NEW_LOCKS = new Map([
  ['amazon-bedrock', {
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/amazon-bedrock',
    treeSha256: 'ac9a7fa35003b085cdbe4333d8f95e8c0bbc9122b26afacffd7722eef09b2554',
    fileCount: 37,
    noticeSha256: 'd4290ed64c2edd0fce1d84e3f9dfb2881240fe534def76b8cd29ed6af683e287',
    noticeSize: 67,
  }],
  ['aws-cloudformation', {
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/aws-cloudformation',
    treeSha256: '61a92a63c53cb0735a305d1494a0d28546c3cdc3eaa4ad8965eb2671a3a2c568',
    fileCount: 16,
    noticeSha256: 'd4290ed64c2edd0fce1d84e3f9dfb2881240fe534def76b8cd29ed6af683e287',
    noticeSize: 67,
  }],
  ['aws-lambda-durable-functions', {
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/specialized-skills/serverless-skills/aws-lambda-durable-functions',
    treeSha256: 'b168923eb71b9c36a0b5232ee7a8f60e44c2d9c61e86958dc21aa4e6580d944e',
    fileCount: 12,
    noticeSha256: 'd4290ed64c2edd0fce1d84e3f9dfb2881240fe534def76b8cd29ed6af683e287',
    noticeSize: 67,
  }],
  ['aws-observability', {
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/aws-observability',
    treeSha256: '2d32aa645e6d406831503e9f9d3f83bbc23fb4740132fc4993f9cd5c09447f72',
    fileCount: 50,
    noticeSha256: 'd4290ed64c2edd0fce1d84e3f9dfb2881240fe534def76b8cd29ed6af683e287',
    noticeSize: 67,
  }],
  ['aws-lambda-microvms', {
    source: 'agent-plugins',
    repository: 'https://github.com/awslabs/agent-plugins.git',
    commit: '097fe8ad56d8a1d5e2c81d7880adf145553cf244',
    path: 'plugins/aws-serverless/skills/aws-lambda-microvms',
    treeSha256: 'a68e89fe345d716ae824949de5cff78e7947c27a3f977eeb8e3a57cfe1ddd565',
    fileCount: 7,
    noticeSha256: '0295e4b248c03b34b07e1768b791612a367504f73926aa5aad336ac3c789f7c4',
    noticeSize: 89,
  }],
])

const EXPECTED_LOCK_NAMES = [
  ...PRESERVED_ENTRY_DIGESTS.keys(),
  ...NEW_LOCKS.keys(),
].sort(compareText)

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareText)
        .map((key) => [key, stableValue(value[key])]),
    )
  }
  return value
}

function digestEntry(entry) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(entry)))
    .digest('hex')
}

function expectedProvenance(provenance) {
  return (
    provenance.kind === 'ramp' &&
    provenance.attribution === 'declared'
  ) || (
    provenance.kind === 'upstream' &&
    provenance.attribution === 'locked'
  )
}

function resolvePilots(cacheDir) {
  const resolver = createSkillResolver({
    repoRoot,
    cacheDir,
    allowLegacyLocal: true,
    strictProvenance: true,
  })
  const failures = {}
  const details = {}
  const resolved = {}

  for (const packId of PILOT_IDS) {
    const packDir = join(repoRoot, 'packs', packId)
    const manifest = loadManifest(packDir)
    const failedNames = []
    const failedDetails = []
    const resolvedNames = []

    for (const name of manifest.skills) {
      try {
        const result = resolver.resolveSkill(name, { packDir })
        if (!expectedProvenance(result.provenance)) {
          failedNames.push(name)
          failedDetails.push(
            `${name}: unexpected ${result.provenance.kind}/${result.provenance.attribution}`,
          )
          continue
        }
        resolvedNames.push(name)
      } catch (error) {
        failedNames.push(name)
        failedDetails.push(`${name}: ${error.message}`)
      }
    }

    failures[packId] = failedNames
    details[packId] = failedDetails
    resolved[packId] = resolvedNames
  }

  return { failures, details, resolved }
}

function formatFailures(details) {
  return PILOT_IDS.flatMap((packId) => [
    `${packId}:`,
    ...details[packId].map((message) => `  ${message}`),
  ]).join('\n')
}

describe('pilot skill lock contract', () => {
  it('preserves every field of the prior ten locks and adds only the five approved names', () => {
    const lock = loadSkillLock(repoRoot, { required: true })

    expect([...lock.skills.keys()]).toEqual(EXPECTED_LOCK_NAMES)
    for (const [name, digest] of PRESERVED_ENTRY_DIGESTS) {
      expect(digestEntry(lock.skills.get(name)), `${name}: preserved entry`)
        .toBe(digest)
    }
  })

  it.each([...NEW_LOCKS])(
    'pins %s to its exact immutable tree and legal records',
    (name, expected) => {
      const entry = loadSkillLock(repoRoot, { required: true }).skills.get(name)

      expect(entry).toMatchObject({
        name,
        source: expected.source,
        repository: expected.repository,
        commit: expected.commit,
        path: expected.path,
        treeSha256: expected.treeSha256,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        licenseFile: {
          path: 'LICENSE',
          sha256: '09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b',
          size: 10142,
          executable: false,
        },
        noticePath: 'NOTICE',
        noticeFile: {
          path: 'NOTICE',
          sha256: expected.noticeSha256,
          size: expected.noticeSize,
          executable: false,
        },
      })
      expect(entry.files).toHaveLength(expected.fileCount)
      expect(entry.files.map(({ path }) => path)).toEqual(
        [...entry.files.map(({ path }) => path)].sort(compareText),
      )
      expect(entry.files.some(({ path }) => path === 'SKILL.md')).toBe(true)
    },
  )
})

const cacheExpectation = process.env.RAMP_PILOT_CACHE_EXPECTATION
const configuredCache = process.env.RAMP_SKILLS_CACHE
const integrationRequested = (
  cacheExpectation !== undefined ||
  (typeof configuredCache === 'string' && configuredCache.trim() !== '')
)

describe('strict provenance for the two release pilots', () => {
  it.runIf(integrationRequested)(
    'uses only declared RAMP or exact locked upstream skills',
    () => {
      if (cacheExpectation !== undefined && cacheExpectation !== 'unsynchronized') {
        throw new Error(
          `unsupported RAMP_PILOT_CACHE_EXPECTATION: ${cacheExpectation}`,
        )
      }
      if (typeof configuredCache !== 'string' || configuredCache.trim() === '') {
        throw new Error(
          'pilot integration requires an explicit RAMP_SKILLS_CACHE',
        )
      }

      expect(existsSync(defaultCache), 'default repository cache before test')
        .toBe(false)
      const report = resolvePilots(configuredCache)

      if (cacheExpectation === 'unsynchronized') {
        expect(report.failures, formatFailures(report.details))
          .toEqual(EXPECTED_UNSYNCHRONIZED_FAILURES)
      } else if (Object.values(report.failures).some((names) => names.length > 0)) {
        throw new Error(
          `pilot cache not synchronized or strict provenance failed:\n${formatFailures(report.details)}`,
        )
      }

      const expectedFailureCount = (packId) => (
        cacheExpectation === 'unsynchronized'
          ? EXPECTED_UNSYNCHRONIZED_FAILURES[packId].length
          : 0
      )
      expect(report.resolved['qa-automated-testing'])
        .toHaveLength(8 - expectedFailureCount('qa-automated-testing'))
      expect(report.resolved['legacy-transformation-on-aws'])
        .toHaveLength(19 - expectedFailureCount('legacy-transformation-on-aws'))
      expect(existsSync(defaultCache), 'default repository cache after test')
        .toBe(false)
    },
  )
})
