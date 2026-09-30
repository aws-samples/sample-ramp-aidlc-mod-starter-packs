// installer/test/build-all.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAll, listPacks } from '../src/build-all.js'

let packsRoot
beforeEach(() => {
  packsRoot = mkdtempSync(join(tmpdir(), 'packs-'))
  const p = join(packsRoot, 'demo')
  mkdirSync(join(p, 'instructions'), { recursive: true })
  writeFileSync(join(p, 'instructions/aidlc-workflow.md'), 'WORKFLOW')
  writeFileSync(
    join(p, 'pack.yaml'),
    `name: demo\ntitle: Demo\ndescription: d\ninstructions:\n  - file: aidlc-workflow.md\n    role: primary\ncommand:\n  name: aidlc\n  description: go\nskills:\n  - aws-lambda\n  - api-gateway\n`,
  )
})

describe('buildAll (Model C: lean scaffolds + add-skills.sh)', () => {
  it('lists packs by pack.yaml', () => {
    expect(listPacks(packsRoot)).toEqual(['demo'])
  })

  it('renders steering per tool with NO skills, and emits an executable add-skills.sh', () => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))
    buildAll({ packsRoot, outDir: out, includeSkills: false, emitSkillScript: true })

    // steering present, no skills dir bundled
    expect(existsSync(join(out, 'demo/kiro/.kiro/steering/aidlc-workflow.md'))).toBe(true)
    expect(existsSync(join(out, 'demo/kiro/.kiro/skills'))).toBe(false)
    expect(existsSync(join(out, 'demo/claude-code/.claude/skills'))).toBe(false)

    // add-skills.sh generated, executable, with the editable SKILLS list from pack.yaml
    const script = join(out, 'demo/add-skills.sh')
    expect(existsSync(script)).toBe(true)
    expect(statSync(script).mode & 0o111).toBeTruthy() // executable bit
    const body = readFileSync(script, 'utf8')
    expect(body).toContain('PACK_NAME="demo"')
    expect(body).toMatch(/SKILLS=\(\n\s+aws-lambda\n\s+api-gateway\n\)/)
    expect(body).toContain('--tool <kiro|claude-code|copilot|cursor>')
  })

  it('with includeSkills=true it would copy skills (shadow/local resolution)', () => {
    // give the pack a local shadow skill so no external library is needed
    const p = join(packsRoot, 'demo')
    mkdirSync(join(p, 'skills/aws-lambda'), { recursive: true })
    writeFileSync(join(p, 'skills/aws-lambda/SKILL.md'), '# lambda')
    mkdirSync(join(p, 'skills/api-gateway'), { recursive: true })
    writeFileSync(join(p, 'skills/api-gateway/SKILL.md'), '# apigw')

    const out = mkdtempSync(join(tmpdir(), 'out-'))
    buildAll({ packsRoot, outDir: out, includeSkills: true, emitSkillScript: false })
    expect(existsSync(join(out, 'demo/kiro/.kiro/skills/aws-lambda/SKILL.md'))).toBe(true)
    expect(existsSync(join(out, 'demo/add-skills.sh'))).toBe(false)
  })
})
