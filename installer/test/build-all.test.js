// installer/test/build-all.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAll, listPacks } from '../src/build-all.js'
import { hashSkillTree } from '../src/dependencies/checksum.js'
import { writeSkillLock } from '../src/dependencies/manifests.js'

let packsRoot
beforeEach(() => {
  packsRoot = mkdtempSync(join(tmpdir(), 'packs-'))
  const p = join(packsRoot, 'demo')
  mkdirSync(join(p, 'instructions'), { recursive: true })
  writeFileSync(
    join(p, 'instructions/aidlc-workflow.md'),
    'Spec {{SPEC_DIR}} State {{STATE_DIR}}',
  )
  writeFileSync(
    join(p, 'pack.yaml'),
    `name: demo\ntitle: Demo\ndescription: d\ninstructions:\n  - file: aidlc-workflow.md\n    role: primary\ncommand:\n  name: aidlc\n  description: go\nskills:\n  - aws-lambda\n  - api-gateway\n`,
  )
})

describe('buildAll (Model C: lean scaffolds + generated skill helpers)', () => {
  it('lists packs by pack.yaml', () => {
    expect(listPacks(packsRoot)).toEqual(['demo'])
  })

  it('renders steering per tool with NO skills, and emits both skill helpers', () => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))
    const results = buildAll({
      packsRoot,
      outDir: out,
      includeSkills: false,
      emitSkillScript: true,
    })

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

    const powerShell = join(out, 'demo/add-skills.ps1')
    expect(existsSync(powerShell)).toBe(true)
    if (process.platform !== 'win32') {
      expect(statSync(script).mode & 0o777).toBe(0o755)
      expect(statSync(powerShell).mode & 0o777).toBe(0o644)
    }
    expect(readFileSync(powerShell, 'utf8')).toMatch(
      /\$Skills = @\(\n\s+'aws-lambda'\n\s+'api-gateway'\n\)/,
    )
    expect(results).toContainEqual({
      pack: 'demo',
      tool: 'add-skills.sh',
      count: 1,
    })
    expect(results).toContainEqual({
      pack: 'demo',
      tool: 'add-skills.ps1',
      count: 1,
    })
  })

  it.runIf(process.platform !== 'win32')(
    'repairs deliberately wrong existing helper modes during in-place regeneration',
    () => {
      const packDir = join(packsRoot, 'demo')
      writeFileSync(join(packDir, 'add-skills.sh'), 'old bash\n')
      writeFileSync(join(packDir, 'add-skills.ps1'), 'old powershell\n')
      chmodSync(join(packDir, 'add-skills.sh'), 0o644)
      chmodSync(join(packDir, 'add-skills.ps1'), 0o755)

      buildAll({
        packsRoot,
        inPlace: true,
        includeSkills: false,
        emitSkillScript: true,
      })

      expect(statSync(join(packDir, 'add-skills.sh')).mode & 0o777).toBe(0o755)
      expect(statSync(join(packDir, 'add-skills.ps1')).mode & 0o777).toBe(0o644)
    },
  )

  it('with includeSkills=true it would copy skills (shadow/local resolution)', () => {
    // give the pack a local shadow skill so no external library is needed
    const p = join(packsRoot, 'demo')
    mkdirSync(join(p, 'skills/aws-lambda'), { recursive: true })
    writeFileSync(join(p, 'skills/aws-lambda/SKILL.md'), '# lambda')
    mkdirSync(join(p, 'skills/api-gateway'), { recursive: true })
    writeFileSync(join(p, 'skills/api-gateway/SKILL.md'), '# apigw')

    const out = mkdtempSync(join(tmpdir(), 'out-'))
    const cacheDir = join(out, 'unused-cache')
    buildAll({
      packsRoot,
      outDir: out,
      cacheDir,
      includeSkills: true,
      emitSkillScript: false,
    })
    expect(existsSync(join(out, 'demo/kiro/.kiro/skills/aws-lambda/SKILL.md'))).toBe(true)
    expect(existsSync(join(out, 'demo/add-skills.sh'))).toBe(false)
    expect(existsSync(join(out, 'demo/add-skills.ps1'))).toBe(false)
    expect(existsSync(cacheDir)).toBe(false)
  })

  it('keeps default multi-target builds as independent standalone projections', () => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))
    buildAll({ packsRoot, outDir: out, includeSkills: false, emitSkillScript: false })

    expect(
      readFileSync(join(out, 'demo/kiro/.kiro/steering/aidlc-workflow.md'), 'utf8'),
    ).toContain('Spec .kiro/specs State aidlc-docs')
    expect(readFileSync(join(out, 'demo/claude-code/CLAUDE.md'), 'utf8')).toContain(
      'Spec specs State aidlc-docs',
    )
  })

  it('can render selected tools against one explicit shared workspace', () => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))
    buildAll({
      packsRoot,
      outDir: out,
      tools: ['kiro', 'claude-code'],
      workspaceMode: 'shared',
      includeSkills: false,
      emitSkillScript: false,
    })

    expect(
      readFileSync(join(out, 'demo/kiro/.kiro/steering/aidlc-workflow.md'), 'utf8'),
    ).toContain('Spec .kiro/specs State aidlc-docs')
    expect(readFileSync(join(out, 'demo/claude-code/CLAUDE.md'), 'utf8')).toContain(
      'Spec .kiro/specs State aidlc-docs',
    )
  })

  it.each([
    [[], /tools.*non-empty/i],
    [['kiro', 'kiro'], /duplicate.*kiro/i],
  ])('rejects an invalid selected tool set before building: %#', (tools, message) => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))

    expect(() =>
      buildAll({
        packsRoot,
        outDir: out,
        tools,
        includeSkills: false,
        emitSkillScript: false,
      }),
    ).toThrow(message)
    expect(existsSync(join(out, 'demo'))).toBe(false)
  })

  it('uses one explicit cache for skill-inclusive builds', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'resolver-repo-'))
    const isolatedPacks = join(repoRoot, 'custom-packs')
    const packDir = join(isolatedPacks, 'demo')
    mkdirSync(join(packDir, 'instructions'), { recursive: true })
    writeFileSync(join(packDir, 'instructions', 'main.md'), 'MAIN')
    writeFileSync(
      join(packDir, 'pack.yaml'),
      [
        'name: demo',
        'title: Demo',
        'description: d',
        'instructions:',
        '  - file: main.md',
        '    role: primary',
        'command:',
        '  name: aidlc',
        '  description: go',
        'skills:',
        '  - aws-lambda',
        '',
      ].join('\n'),
    )
    mkdirSync(join(repoRoot, 'dependencies'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'dependencies', 'skills.sources.yaml'),
      [
        'schemaVersion: 1',
        'sources:',
        '  - id: agent-toolkit-for-aws',
        '    repository: https://github.com/aws/agent-toolkit-for-aws.git',
        '    priority: 10',
        '    license: Apache-2.0',
        '    licensePath: LICENSE',
        '    noticePath: NOTICE',
        '',
      ].join('\n'),
    )
    const reference = join(repoRoot, 'reference')
    mkdirSync(reference, { recursive: true })
    writeFileSync(join(reference, 'SKILL.md'), '# lambda\n')
    const hashed = hashSkillTree(reference)
    const entry = {
      name: 'aws-lambda',
      source: 'agent-toolkit-for-aws',
      repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
      commit: 'a'.repeat(40),
      path: 'skills/core-skills/aws-lambda',
      treeSha256: hashed.treeSha256,
      files: hashed.files,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      licenseFile: {
        path: 'LICENSE',
        sha256: 'b'.repeat(64),
        size: 11357,
        executable: false,
      },
      noticePath: 'NOTICE',
      noticeFile: {
        path: 'NOTICE',
        sha256: 'c'.repeat(64),
        size: 314,
        executable: false,
      },
    }
    writeSkillLock(repoRoot, {
      schemaVersion: 1,
      skills: new Map([['aws-lambda', entry]]),
    })
    const cacheDir = join(repoRoot, 'configured-cache')
    const cached = join(
      cacheDir,
      'sources',
      entry.source,
      entry.commit,
      entry.path,
    )
    mkdirSync(cached, { recursive: true })
    writeFileSync(join(cached, 'SKILL.md'), '# lambda\n')
    const out = mkdtempSync(join(tmpdir(), 'out-'))

    buildAll({
      packsRoot: isolatedPacks,
      repoRoot,
      cacheDir,
      outDir: out,
      tools: ['kiro'],
      includeSkills: true,
      emitSkillScript: false,
    })

    expect(
      readFileSync(
        join(out, 'demo', 'kiro', '.kiro', 'skills', 'aws-lambda', 'SKILL.md'),
        'utf8',
      ),
    ).toBe('# lambda\n')
  })

  it('does not validate or create cache input for scaffold-only builds', () => {
    const out = mkdtempSync(join(tmpdir(), 'out-'))
    expect(() =>
      buildAll({
        packsRoot,
        outDir: out,
        cacheDir: 42,
        includeSkills: false,
        emitSkillScript: false,
      }),
    ).not.toThrow()
    expect(existsSync(join(out, 'demo', 'kiro'))).toBe(true)
  })
})
