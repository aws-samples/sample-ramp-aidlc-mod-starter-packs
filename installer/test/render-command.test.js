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

  it('claude-code: uses a custom command body with exactly one trailing newline', () => {
    const customManifest = {
      command: {
        ...manifest.command,
        body: 'Run the custom Claude workflow.\n\n',
      },
    }

    const w = renderCommand(customManifest, 'claude-code')

    expect(w.content).toBe(
      '---\ndescription: Start the AI-DLC workflow\n---\nRun the custom Claude workflow.\n',
    )
    expect(w.content).not.toContain('decision-gated workflow')
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

  it('copilot: uses a custom command body with exactly one trailing newline', () => {
    const customManifest = {
      command: {
        ...manifest.command,
        body: 'Run the custom Copilot workflow.',
      },
    }

    const w = renderCommand(customManifest, 'copilot')

    expect(w.content).toBe(
      '---\ndescription: Start the AI-DLC workflow\nargument-hint: "describe what you\'re building"\n---\nRun the custom Copilot workflow.\n',
    )
    expect(w.content).not.toContain('decision-gated workflow')
  })

  it.each([undefined, '', '  \n'])('falls back to the generic body for a non-meaningful body (%j)', (body) => {
    const fallbackManifest = {
      command: {
        ...manifest.command,
        body,
      },
    }

    const w = renderCommand(fallbackManifest, 'claude-code')

    expect(w.content).toContain('decision-gated workflow')
    expect(w.content).toMatch(/Do not skip ahead\.\n$/)
  })

  it('kiro and cursor: no command file', () => {
    expect(renderCommand(manifest, 'kiro')).toBeNull()
    expect(renderCommand(manifest, 'cursor')).toBeNull()
  })

  it('returns null when manifest has no command', () => {
    expect(renderCommand({}, 'claude-code')).toBeNull()
  })
})
