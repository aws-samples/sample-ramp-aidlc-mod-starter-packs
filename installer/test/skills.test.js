// installer/test/skills.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planSkills } from '../src/skills.js'

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
    const w = planSkills(packDir, { skills: 'all' }, 'claude-code')
    const paths = w.map((x) => x.path).sort()
    expect(paths).toEqual(['.claude/skills/aurora-dsql', '.claude/skills/aws-lambda'])
    expect(w[0].kind).toBe('copy')
    expect(w[0].content).toContain(join(packDir, 'skills'))
  })

  it('kiro uses .kiro/skills root', () => {
    const w = planSkills(packDir, { skills: 'all' }, 'kiro')
    expect(w.every((x) => x.path.startsWith('.kiro/skills/'))).toBe(true)
  })

  it('explicit list copies only named skills', () => {
    const w = planSkills(packDir, { skills: ['aws-lambda'] }, 'kiro')
    expect(w.map((x) => x.path)).toEqual(['.kiro/skills/aws-lambda'])
  })

  it('throws when a named skill is missing', () => {
    expect(() => planSkills(packDir, { skills: ['nope'] }, 'kiro')).toThrow(/nope/)
  })
})
