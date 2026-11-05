import {
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { dirname, extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { createSkillResolver } from '../src/dependencies/resolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const cacheDir = process.env.RAMP_SKILLS_CACHE
const cacheExpectation = process.env.RAMP_PILOT_CACHE_EXPECTATION
const runIntegration = (
  typeof cacheDir === 'string' &&
  cacheDir.trim() !== '' &&
  cacheExpectation !== 'unsynchronized'
)

const CAPABILITY_ROWS = [
  {
    name: 'amazon-bedrock',
    pack: 'qa-automated-testing',
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/amazon-bedrock',
    treeSha256: 'ac9a7fa35003b085cdbe4333d8f95e8c0bbc9122b26afacffd7722eef09b2554',
    groups: {
      'model invocation': ['model invocation', 'converse', 'invokemodel'],
      Guardrails: ['guardrail'],
      'Knowledge Bases/RAG': ['knowledge base', 'rag'],
      AgentCore: ['agentcore'],
    },
  },
  {
    name: 'aws-lambda-microvms',
    pack: 'qa-automated-testing',
    source: 'agent-plugins',
    repository: 'https://github.com/awslabs/agent-plugins.git',
    commit: '097fe8ad56d8a1d5e2c81d7880adf145553cf244',
    path: 'plugins/aws-serverless/skills/aws-lambda-microvms',
    treeSha256: 'a68e89fe345d716ae824949de5cff78e7947c27a3f977eeb8e3a57cfe1ddd565',
    groups: {
      isolation: ['isolation', 'firecracker'],
      'image creation': ['image creation', 'image build', 'build an image'],
      'run/invoke': ['run a microvm', 'invoke'],
      'suspend/resume': ['suspend', 'resume'],
      'IAM/security': ['iam', 'security'],
    },
  },
  {
    name: 'aws-cloudformation',
    pack: 'legacy-transformation-on-aws',
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/aws-cloudformation',
    treeSha256: '61a92a63c53cb0735a305d1494a0d28546c3cdc3eaa4ad8965eb2671a3a2c568',
    groups: {
      'template authoring': ['template authoring', 'authors'],
      validation: ['validation', 'validate'],
      'change sets': ['change set'],
      'failed-stack diagnosis': ['failed stack', 'failed-stack', 'troubleshoot'],
    },
  },
  {
    name: 'aws-lambda-durable-functions',
    pack: 'legacy-transformation-on-aws',
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/specialized-skills/serverless-skills/aws-lambda-durable-functions',
    treeSha256: 'b168923eb71b9c36a0b5232ee7a8f60e44c2d9c61e86958dc21aa4e6580d944e',
    groups: {
      'replay/determinism': ['replay', 'determinism', 'deterministic'],
      'waits/callbacks': ['wait', 'callback'],
      retries: ['retry', 'retries'],
      compensation: ['compensation', 'saga'],
      testing: ['testing', 'test runner', 'localdurabletestrunner'],
    },
  },
  {
    name: 'aws-observability',
    pack: 'legacy-transformation-on-aws',
    source: 'agent-toolkit-for-aws',
    repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    commit: 'b6d5b7894cc8ae875307f232830acdad683164dc',
    path: 'skills/core-skills/aws-observability',
    treeSha256: '2d32aa645e6d406831503e9f9d3f83bbc23fb4740132fc4993f9cd5c09447f72',
    groups: {
      'CloudWatch logs': ['cloudwatch logs', 'log insights'],
      metrics: ['metrics'],
      alarms: ['alarms'],
      'traces/X-Ray': ['traces', 'x-ray'],
      'ADOT/OpenTelemetry': ['adot', 'opentelemetry'],
      'Application Signals': ['application signals'],
    },
  },
]

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function inspectRegularFile(path, label) {
  const status = lstatSync(path)
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file: ${path}`)
  }
}

function collectMarkdown(root) {
  const rootStatus = lstatSync(root)
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
    throw new Error(`skill root must be an ordinary directory: ${root}`)
  }
  const documents = []

  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const status = lstatSync(path)
      const display = relative(root, path).split(sep).join('/')
      if (status.isSymbolicLink()) {
        throw new Error(`skill Markdown closure contains a symlink: ${display}`)
      }
      if (status.isDirectory()) {
        visit(path)
        continue
      }
      if (status.isFile() && extname(entry.name).toLowerCase() === '.md') {
        documents.push({
          path: display,
          text: readFileSync(path, 'utf8'),
        })
      }
    }
  }

  visit(root)
  return documents
}

function parseSkillFrontmatter(path, expectedName) {
  inspectRegularFile(path, `${expectedName} SKILL.md`)
  const text = readFileSync(path, 'utf8')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error(`${expectedName} SKILL.md has no frontmatter`)

  let metadata
  try {
    metadata = parse(match[1])
  } catch (error) {
    throw new Error(
      `${expectedName} SKILL.md frontmatter is invalid: ${error.message}`,
    )
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${expectedName} SKILL.md frontmatter must be an object`)
  }
  if (metadata.name !== expectedName) {
    throw new Error(
      `${expectedName} SKILL.md declares unexpected name: ${metadata.name}`,
    )
  }
  return metadata
}

function normalizeText(text) {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')
}

describe('locked pilot upstream capability contracts', () => {
  it.runIf(runIntegration).each(CAPABILITY_ROWS)(
    '$name retains every capability required by its pilot',
    (row) => {
      const packDir = join(repoRoot, 'packs', row.pack)
      const resolver = createSkillResolver({
        repoRoot,
        cacheDir,
        allowLegacyLocal: true,
        strictProvenance: true,
      })
      const resolved = resolver.resolveSkill(row.name, { packDir })

      expect(resolved.provenance).toMatchObject({
        kind: 'upstream',
        attribution: 'locked',
        name: row.name,
        source: row.source,
        repository: row.repository,
        commit: row.commit,
        path: row.path,
        treeSha256: row.treeSha256,
      })
      expect(resolved.directory).toBe(
        join(cacheDir, 'sources', row.source, row.commit, row.path),
      )

      parseSkillFrontmatter(
        join(resolved.directory, 'SKILL.md'),
        row.name,
      )
      const documents = collectMarkdown(resolved.directory)
      const corpus = normalizeText(
        documents.map(({ text }) => text).join('\n'),
      )
      for (const [group, alternatives] of Object.entries(row.groups)) {
        const present = alternatives.some((term) =>
          corpus.includes(normalizeText(term)))
        expect(
          present,
          `${row.name}: missing semantic group ${group} (${alternatives.join(' | ')})`,
        ).toBe(true)
      }
    },
  )
})
