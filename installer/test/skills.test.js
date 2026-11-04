// installer/test/skills.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planSkills } from '../src/skills.js'
import { hashSkillTree } from '../src/dependencies/checksum.js'
import { writeSkillLock } from '../src/dependencies/manifests.js'

let packDir
beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'pack-'))
  for (const s of ['aws-lambda', 'aurora-dsql']) {
    mkdirSync(join(packDir, 'skills', s), { recursive: true })
    writeFileSync(join(packDir, 'skills', s, 'SKILL.md'), `# ${s}`)
  }
})

describe('planSkills', () => {
  it('all: one copy per skill dir to the tool skills root', () => {
    const w = planSkills(
      packDir,
      { name: 'demo-pack', skills: 'all' },
      'claude-code',
    )
    const paths = w.map((x) => x.path)
    expect(paths).toEqual(['.claude/skills/aurora-dsql', '.claude/skills/aws-lambda'])
    expect(w[0].kind).toBe('copy')
    expect(w[0].content).toContain(join(packDir, 'skills'))
    expect(w[0].provenance).toMatchObject({
      kind: 'pack-override',
      attribution: 'legacy-unattributed',
      name: 'aurora-dsql',
      ownerPack: 'demo-pack',
    })
  })

  it('all: returns an empty plan only when the pack-local skills root is absent', () => {
    const emptyPack = mkdtempSync(join(tmpdir(), 'pack-'))
    expect(
      planSkills(
        emptyPack,
        { name: 'demo-pack', skills: 'all' },
        'claude-code',
      ),
    ).toEqual([])
  })

  it.runIf(process.platform !== 'win32')(
    'all: rejects a symlinked or dangling pack-local skills root',
    () => {
      for (const target of ['existing', 'missing']) {
        const symlinkPack = mkdtempSync(join(tmpdir(), 'pack-'))
        const outside = join(symlinkPack, '..', `outside-${target}`)
        if (target === 'existing') mkdirSync(outside, { recursive: true })
        symlinkSync(outside, join(symlinkPack, 'skills'))
        expect(() =>
          planSkills(
            symlinkPack,
            { name: 'demo-pack', skills: 'all' },
            'claude-code',
          ),
        ).toThrow(/pack-local skills root.*symbolic link/i)
      }
    },
  )

  it('all: rejects a non-directory pack-local skills root clearly', () => {
    const invalidPack = mkdtempSync(join(tmpdir(), 'pack-'))
    writeFileSync(join(invalidPack, 'skills'), 'not a directory')
    expect(() =>
      planSkills(
        invalidPack,
        { name: 'demo-pack', skills: 'all' },
        'claude-code',
      ),
    ).toThrow(/pack-local skills root.*directory/i)
  })

  it('kiro uses .kiro/skills root', () => {
    const w = planSkills(packDir, { name: 'demo-pack', skills: 'all' }, 'kiro')
    expect(w.every((x) => x.path.startsWith('.kiro/skills/'))).toBe(true)
  })

  it('explicit list copies only named skills', () => {
    const w = planSkills(
      packDir,
      { name: 'demo-pack', skills: ['aws-lambda'] },
      'kiro',
    )
    expect(w.map((x) => x.path)).toEqual(['.kiro/skills/aws-lambda'])
  })

  it('throws when a named skill is missing', () => {
    expect(() =>
      planSkills(
        packDir,
        { name: 'demo-pack', skills: ['nope'] },
        'kiro',
      ),
    ).toThrow(/nope/)
  })

  it('uses an injected resolver and preserves its provenance', () => {
    const calls = []
    const selected = join(packDir, 'selected')
    const provenance = {
      kind: 'upstream',
      attribution: 'locked',
      name: 'aws-lambda',
      source: 'agent-toolkit-for-aws',
    }
    const resolver = {
      resolveSkill(name, options) {
        calls.push([name, options])
        return { directory: selected, provenance }
      },
    }

    const [entry] = planSkills(
      packDir,
      { name: 'demo-pack', skills: ['aws-lambda'] },
      'claude-code',
      { resolver },
    )

    expect(calls).toEqual([
      ['aws-lambda', { packDir, packId: 'demo-pack' }],
    ])
    expect(entry).toEqual({
      path: '.claude/skills/aws-lambda',
      content: selected,
      kind: 'copy',
      provenance,
    })
  })

  it('keeps a supplied skills-library compatibility fixture working', () => {
    const legacyPack = mkdtempSync(join(tmpdir(), 'pack-'))
    const libraryDir = mkdtempSync(join(tmpdir(), 'library-'))
    mkdirSync(join(libraryDir, 'aws-lambda'), { recursive: true })
    writeFileSync(join(libraryDir, 'aws-lambda', 'SKILL.md'), '# lambda')

    const [entry] = planSkills(
      legacyPack,
      { name: 'demo-pack', skills: ['aws-lambda'] },
      'kiro',
      { libraryDir },
    )

    expect(entry.content).toBe(join(libraryDir, 'aws-lambda'))
    expect(entry.provenance).toMatchObject({
      kind: 'legacy-local',
      name: 'aws-lambda',
    })
  })

  it('prefers a higher provenance registry over a nearer nested skills-library', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'repo-'))
    const nestedRoot = join(repoRoot, 'workspace')
    const nestedPack = join(nestedRoot, 'packs', 'demo-pack')
    const nestedLegacy = join(nestedRoot, 'skills-library', 'aws-iam')
    const reference = join(repoRoot, 'reference')
    const cacheDir = join(repoRoot, 'cache')
    mkdirSync(join(repoRoot, 'dependencies'), { recursive: true })
    mkdirSync(nestedPack, { recursive: true })
    mkdirSync(nestedLegacy, { recursive: true })
    mkdirSync(reference, { recursive: true })
    writeFileSync(join(nestedLegacy, 'SKILL.md'), '# nested legacy\n')
    writeFileSync(join(reference, 'SKILL.md'), '# locked upstream\n')
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
    const hashed = hashSkillTree(reference)
    const locked = {
      name: 'aws-iam',
      source: 'agent-toolkit-for-aws',
      repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
      commit: 'a'.repeat(40),
      path: 'skills/core-skills/aws-iam',
      treeSha256: hashed.treeSha256,
      files: hashed.files,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      noticePath: 'NOTICE',
    }
    writeSkillLock(repoRoot, {
      schemaVersion: 1,
      skills: new Map([['aws-iam', locked]]),
    })
    const cached = join(
      cacheDir,
      'sources',
      locked.source,
      locked.commit,
      locked.path,
    )
    mkdirSync(cached, { recursive: true })
    writeFileSync(join(cached, 'SKILL.md'), '# locked upstream\n')

    const [entry] = planSkills(
      nestedPack,
      { name: 'demo-pack', skills: ['aws-iam'] },
      'claude-code',
      { cacheDir },
    )

    expect(entry.content).toBe(cached)
    expect(entry.provenance).toMatchObject({
      kind: 'upstream',
      attribution: 'locked',
      name: 'aws-iam',
    })
  })
})
