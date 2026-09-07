import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const skillsRoot = join(repoRoot, 'legacy-transformation-on-aws/skills')
const activationPath = join(repoRoot, 'legacy-transformation-on-aws/instructions/skill-activation.md')

const bundledSkills = readdirSync(skillsRoot)
  .filter((name) => {
    const skillDir = join(skillsRoot, name)
    const skillPath = join(skillDir, 'SKILL.md')
    return existsSync(skillDir)
      && statSync(skillDir).isDirectory()
      && existsSync(skillPath)
      && statSync(skillPath).isFile()
  })
  .sort()

const activation = readFileSync(activationPath, 'utf8')
const activationWithSentinel = `${activation}\n## End of skill sections\n`
const skillSections = new Map(
  [...activationWithSentinel.matchAll(/^### `([^`]+)`\s*\n([\s\S]*?)(?=^### `|^## )/gm)]
    .map(([, name, body]) => [name, body]),
)
const documentedSkills = [...skillSections.keys()].sort()

function sectionFor(skillName) {
  const section = skillSections.get(skillName)
  if (!section) throw new Error(`Missing activation section for ${skillName}`)
  return section
}

describe('legacy transformation bundled skill activation guidance', () => {
  it('represents exactly the 16 bundled skills', () => {
    expect(bundledSkills).toHaveLength(16)
    expect(documentedSkills).toEqual(bundledSkills)
  })

  it('routes each bundled skill within its own section and excludes absent standalone skills', () => {
    expect(sectionFor('ecs-recon')).toMatch(/read-only discovery/i)
    expect(sectionFor('ecs-operation-review')).toMatch(/scored|GREEN\/AMBER\/RED/i)
    expect(sectionFor('ecs-architect')).toMatch(/(?:target|Day-0).*design/i)
    expect(sectionFor('ecs-build')).toMatch(/Terraform/i)
    expect(sectionFor('ecs-devops')).toMatch(/release|deployment strategy|CI\/CD/i)
    expect(sectionFor('ecs-observability')).toMatch(/(?:ECS-specific|ECS).*logs.*metrics.*traces/i)
    expect(sectionFor('ecs-security')).toMatch(/hardening|compliance/i)
    expect(sectionFor('api-gateway')).toMatch(/(?:REST|HTTP).*WebSocket/i)
    expect(sectionFor('aws-lambda-durable-functions')).toMatch(/replay|checkpoint|long-running/i)
    expect(sectionFor('aws-cloudformation')).toMatch(/YAML|JSON/i)
    expect(sectionFor('aws-iam')).toMatch(/least-privilege|trust polic/i)
    expect(sectionFor('aws-observability')).toMatch(/(?:general|cross-service).*observability/i)

    expect(documentedSkills).not.toContain('aws-lambda')
    expect(documentedSkills).not.toContain('aws-serverless-deployment')
    expect(activation).not.toMatch(/activate(?:\/load)? (?:the )?`aws-lambda` skill/i)
    expect(activation).not.toMatch(/activate(?:\/load)? (?:the )?`aws-serverless-deployment` skill/i)
  })

  it('keeps existing-app modernization assessment out of ecs-architect', () => {
    const ecsArchitect = sectionFor('ecs-architect')

    expect(ecsArchitect).toMatch(/existing-app replatform\/refactor assessment/i)
    expect(ecsArchitect).toMatch(/`ecs-modernize` is not bundled/i)
    expect(ecsArchitect).toMatch(/pack(?:'s)? reverse-engineering\/modernization workflow[\s\S]*AWS Knowledge MCP/i)
    expect(ecsArchitect).toMatch(/only for downstream ECS deployment-model\/design[\s\S]*intent is settled/i)
  })

  it('requires activation before decisions, design, code, and IaC', () => {
    expect(activation).toMatch(/activate[\s\S]{0,120}before[\s\S]{0,160}_decisions-[\s\S]{0,160}design[\s\S]{0,160}code[\s\S]{0,80}IaC/i)
  })

  it('limits reverse-engineering activation to applicable discovery or assessment capabilities', () => {
    expect(activation).toMatch(/during reverse engineering[\s\S]{0,180}only[\s\S]{0,100}discovery or assessment capability applies/i)
    expect(sectionFor('ecs-recon')).toMatch(/reverse engineering[\s\S]*live ECS estate is in scope/i)
    expect(sectionFor('ecs-architect')).not.toMatch(/reverse engineering assessment/i)
  })

  it('keeps IaC and database routing explicit within the relevant sections', () => {
    expect(activation).toMatch(/CloudFormation[\s\S]*Terraform[\s\S]*(?:do not|never|must not).*blend/i)
    expect(sectionFor('aurora-dsql')).toMatch(/MCP|connector|semantics/i)
    expect(sectionFor('amazon-aurora-postgresql')).toMatch(/PostgreSQL/i)
    expect(sectionFor('amazon-aurora-mysql')).toMatch(/MySQL/i)
    expect(sectionFor('creating-amazon-aurora-db-cluster-with-instances')).toMatch(/cluster creation|instances/i)
    expect(activation).toMatch(/target engine intent/i)
  })

  it('preserves mandatory AWS Knowledge MCP validation', () => {
    expect(activation).toMatch(/AWS Knowledge MCP/i)
    expect(activation).toMatch(/search_documentation/)
    expect(activation).toMatch(/read_documentation/)
    expect(activation).toMatch(/get_regional_availability/)
    expect(activation).toMatch(/resource shapes/i)
    expect(activation).toMatch(/current (?:AWS )?(?:service )?behavior/i)
  })
})
