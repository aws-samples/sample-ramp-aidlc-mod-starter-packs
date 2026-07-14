import { describe, it, expect } from 'vitest'
import { parse } from 'yaml'
import { renderCommand } from '../src/render/command.js'

// Parse the leading YAML frontmatter block from a rendered file's content.
function frontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/)
  return parse(m[1])
}

const manifest = { command: { name: 'aidlc', description: 'Start the AI-DLC workflow' } }

describe('renderCommand', () => {
  it('claude-code: writes .claude/commands/aidlc.md with description frontmatter', () => {
    const w = renderCommand(manifest, 'claude-code')
    expect(w.path).toBe('.claude/commands/aidlc.md')
    expect(w.content).toContain('description: Start the AI-DLC workflow')
    expect(w.content).toContain('decision-gated workflow')
  })

  it('copilot: writes .github/prompts/aidlc.prompt.md with a string argument-hint', () => {
    const w = renderCommand(manifest, 'copilot')
    expect(w.path).toBe('.github/prompts/aidlc.prompt.md')
    const fm = frontmatter(w.content)
    // argument-hint must be a STRING, not a YAML list (unquoted [..] parses as an array)
    expect(typeof fm['argument-hint']).toBe('string')
    expect(fm['argument-hint']).toBe("describe what you're building")
    expect(fm.description).toBe('Start the AI-DLC workflow')
  })

  it('kiro and cursor: no command file', () => {
    expect(renderCommand(manifest, 'kiro')).toBeNull()
    expect(renderCommand(manifest, 'cursor')).toBeNull()
  })

  it('returns null when manifest has no command', () => {
    expect(renderCommand({}, 'claude-code')).toBeNull()
  })
})
