// installer/test/render-instructions.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderInstructions } from '../src/render/instructions.js'

const manifest = {
  instructions: [
    { file: 'aidlc-workflow.md', role: 'primary', load: 'always' },
    { file: 'skill-activation.md', role: 'companion', load: 'always' },
    { file: 'reverse-engineering.md', role: 'companion', load: 'auto' },
  ],
}

let packDir
beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'pack-'))
  mkdirSync(join(packDir, 'instructions'), { recursive: true })
  writeFileSync(join(packDir, 'instructions/aidlc-workflow.md'), 'WORKFLOW BODY')
  writeFileSync(join(packDir, 'instructions/skill-activation.md'), 'SKILL BODY')
  writeFileSync(join(packDir, 'instructions/reverse-engineering.md'), 'RE BODY')
})

const byPath = (writes, p) => writes.find((w) => w.path === p)

describe('renderInstructions', () => {
  it('kiro: writes steering files with inclusion frontmatter', () => {
    const w = renderInstructions(manifest, packDir, 'kiro')
    expect(byPath(w, '.kiro/steering/aidlc-workflow.md').content).toBe('---\ninclusion: always\n---\nWORKFLOW BODY\n')
    expect(byPath(w, '.kiro/steering/reverse-engineering.md').content).toBe('---\ninclusion: auto\n---\nRE BODY\n')
  })

  it('claude-code: primary -> CLAUDE.md with companion header, companions -> rules', () => {
    const w = renderInstructions(manifest, packDir, 'claude-code')
    const claudeMd = byPath(w, 'CLAUDE.md').content
    expect(claudeMd).toContain('.claude/rules/skill-activation.md')
    expect(claudeMd).toContain('.claude/rules/reverse-engineering.md')
    expect(claudeMd).toContain('WORKFLOW BODY')
    expect(byPath(w, '.claude/rules/skill-activation.md').content).toBe('SKILL BODY\n')
  })

  it('copilot: primary is lean copilot-instructions.md, companions split into .github/instructions', () => {
    const w = renderInstructions(manifest, packDir, 'copilot')
    // primary file holds ONLY the primary body — companions are NOT concatenated in
    const primaryFile = byPath(w, '.github/copilot-instructions.md')
    expect(primaryFile.content).toBe('WORKFLOW BODY\n')
    expect(primaryFile.content).not.toContain('SKILL BODY')

    // always-companion → applyTo: '**'
    const skill = byPath(w, '.github/instructions/skill-activation.instructions.md')
    expect(skill.content).toBe("---\napplyTo: '**'\n---\nSKILL BODY\n")

    // auto-companion → no applyTo (conditional), gets a description instead
    const re = byPath(w, '.github/instructions/reverse-engineering.instructions.md')
    expect(re.content).toContain('RE BODY')
    expect(re.content).not.toContain('applyTo')
    expect(re.content).toContain('description: reverse-engineering')
  })

  it('cursor: mdc per instruction with alwaysApply reflecting primary', () => {
    const w = renderInstructions(manifest, packDir, 'cursor')
    expect(byPath(w, '.cursor/rules/aidlc-workflow.mdc').content).toBe('---\nalwaysApply: true\n---\nWORKFLOW BODY\n')
    expect(byPath(w, '.cursor/rules/reverse-engineering.mdc').content).toBe('---\nalwaysApply: false\n---\nRE BODY\n')
  })
})
