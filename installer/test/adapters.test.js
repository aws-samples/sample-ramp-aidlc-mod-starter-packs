import { describe, expect, it } from 'vitest'
import { getAdapter, listAdapterIds } from '../src/adapters/index.js'
import { renderCommand } from '../src/render/command.js'
import { renderMcp } from '../src/render/mcp.js'

describe('tool adapter registry', () => {
  it('lists every supported adapter in stable release order', () => {
    expect(listAdapterIds()).toEqual(['kiro', 'claude-code', 'copilot', 'cursor', 'codex'])
  })

  it.each([
    ['kiro', '.kiro/specs', '.kiro/skills', '.kiro/settings/mcp.json', 'mcpServers'],
    ['claude-code', 'specs', '.claude/skills', '.mcp.json', 'mcpServers'],
    ['copilot', 'specs', '.github/skills', '.vscode/mcp.json', 'servers'],
    ['cursor', 'specs', '.cursor/skills', '.cursor/mcp.json', 'mcpServers'],
    ['codex', 'specs', '.agents/skills', '.codex/config.toml', 'mcp_servers'],
  ])('owns the rendering destinations for %s', (id, defaultSpecRoot, skillsRoot, mcpPath, mcpRootKey) => {
    const adapter = getAdapter(id)

    expect(adapter.id).toBe(id)
    expect(adapter.defaultSpecRoot).toBe(defaultSpecRoot)
    expect(adapter.skillsRoot).toBe(skillsRoot)
    expect(adapter.instructions.kind).toBeTruthy()
    expect(adapter.instructions.primaryPath).toBeTypeOf('function')
    expect(adapter.instructions.companionPath).toBeTypeOf('function')
    expect(adapter.mcp).toMatchObject({ path: mcpPath, rootKey: mcpRootKey })
    expect(adapter.command.kind).toBeTruthy()
  })

  it('renders Codex instructions to AGENTS.md and companions under .codex/instructions', () => {
    const { instructions, command } = getAdapter('codex')

    expect(instructions.kind).toBe('codex-agents')
    expect(instructions.primaryPath('aidlc-workflow.md')).toBe('AGENTS.md')
    expect(instructions.companionPath('skill-activation.md')).toBe('.codex/instructions/skill-activation.md')
    expect(instructions.maxPrimaryBytes).toBe(32 * 1024)
    expect(command.kind).toBe('none')
  })

  it('fails consistently for an unknown adapter', () => {
    expect(() => getAdapter('future-tool')).toThrow('unknown tool: future-tool')
    expect(() => renderMcp({ mcp: [] }, 'future-tool')).toThrow('unknown tool: future-tool')
    expect(() => renderCommand({}, 'future-tool')).toThrow('unknown tool: future-tool')
  })
})
