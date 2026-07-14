// installer/test/render-mcp.test.js
import { describe, it, expect } from 'vitest'
import { renderMcp } from '../src/render/mcp.js'

const manifest = {
  mcp: [
    { id: 'aws-knowledge', command: 'npx', args: ['mcp-remote', 'https://x'], autoApprove: ['a', 'b'] },
    { id: 'aurora-dsql', command: 'uvx', args: ['pkg@latest'], env: { FASTMCP_LOG_LEVEL: 'ERROR' } },
  ],
}

describe('renderMcp', () => {
  it('kiro: keeps autoApprove, wraps in mcpServers', () => {
    const w = renderMcp(manifest, 'kiro')
    expect(w.path).toBe('.kiro/settings/mcp.json')
    const cfg = JSON.parse(w.content)
    expect(cfg.mcpServers['aws-knowledge'].autoApprove).toEqual(['a', 'b'])
    expect(cfg.mcpServers['aurora-dsql'].env.FASTMCP_LOG_LEVEL).toBe('ERROR')
  })

  it('claude-code: strips autoApprove, uses .mcp.json', () => {
    const w = renderMcp(manifest, 'claude-code')
    expect(w.path).toBe('.mcp.json')
    const cfg = JSON.parse(w.content)
    expect(cfg.mcpServers['aws-knowledge'].autoApprove).toBeUndefined()
    expect(cfg.mcpServers['aws-knowledge'].command).toBe('npx')
  })

  it('copilot uses .vscode/mcp.json and cursor uses .cursor/mcp.json', () => {
    expect(renderMcp(manifest, 'copilot').path).toBe('.vscode/mcp.json')
    expect(renderMcp(manifest, 'cursor').path).toBe('.cursor/mcp.json')
  })

  it('copilot uses the `servers` root key (VS Code schema), not `mcpServers`', () => {
    const cfg = JSON.parse(renderMcp(manifest, 'copilot').content)
    expect(cfg.servers).toBeDefined()
    expect(cfg.mcpServers).toBeUndefined()
  })

  it('copilot converts an npx mcp-remote shim to native http transport', () => {
    const cfg = JSON.parse(renderMcp(manifest, 'copilot').content)
    // aws-knowledge was `npx mcp-remote https://x` → should become type:http + url
    expect(cfg.servers['aws-knowledge'].type).toBe('http')
    expect(cfg.servers['aws-knowledge'].url).toBe('https://x')
    expect(cfg.servers['aws-knowledge'].command).toBeUndefined()
    // a plain stdio server keeps command/args
    expect(cfg.servers['aurora-dsql'].command).toBe('uvx')
  })

  it('copilot and cursor strip autoApprove and disabled', () => {
    const m = { mcp: [{ id: 'k', command: 'npx', args: ['x'], autoApprove: ['a'], disabled: false }] }
    const copilot = JSON.parse(renderMcp(m, 'copilot').content)
    const cursor = JSON.parse(renderMcp(m, 'cursor').content)
    expect(copilot.servers.k.autoApprove).toBeUndefined()
    expect(copilot.servers.k.disabled).toBeUndefined()
    expect(cursor.mcpServers.k.autoApprove).toBeUndefined()
    expect(cursor.mcpServers.k.disabled).toBeUndefined()
  })

  it('returns null when there are no mcp servers', () => {
    expect(renderMcp({ mcp: [] }, 'kiro')).toBeNull()
  })
})
