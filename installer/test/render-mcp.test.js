// installer/test/render-mcp.test.js
import { describe, it, expect } from 'vitest'
import { parse as parseToml } from 'smol-toml'
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
    expect(renderMcp({ mcp: [] }, 'codex')).toBeNull()
  })
})

describe('renderMcp for codex (.codex/config.toml)', () => {
  it('writes a stdio server as command and args, without agent-only fields', () => {
    const w = renderMcp(
      { mcp: [{ id: 'aws-knowledge', command: 'npx', args: ['mcp-remote', 'https://x'], autoApprove: ['a'], disabled: false }] },
      'codex',
    )
    expect(w).toEqual({
      path: '.codex/config.toml',
      content: '[mcp_servers.aws-knowledge]\ncommand = "npx"\nargs = ["mcp-remote", "https://x"]\n',
      kind: 'text',
    })
    expect(parseToml(w.content)).toEqual({
      mcp_servers: { 'aws-knowledge': { command: 'npx', args: ['mcp-remote', 'https://x'] } },
    })
  })

  it('writes an HTTP server as url, without a transport key', () => {
    const w = renderMcp(
      { mcp: [{ id: 'aws-knowledge-mcp-server', transport: 'http', url: 'https://knowledge-mcp.global.api.aws' }] },
      'codex',
    )
    expect(w.content).toBe('[mcp_servers.aws-knowledge-mcp-server]\nurl = "https://knowledge-mcp.global.api.aws"\n')
    expect(parseToml(w.content)).toEqual({
      mcp_servers: { 'aws-knowledge-mcp-server': { url: 'https://knowledge-mcp.global.api.aws' } },
    })
  })

  it('writes env as a string table and separates servers by one blank line', () => {
    const w = renderMcp(manifest, 'codex')
    expect(w.content).toBe(
      '[mcp_servers.aws-knowledge]\n' +
        'command = "npx"\n' +
        'args = ["mcp-remote", "https://x"]\n' +
        '\n' +
        '[mcp_servers.aurora-dsql]\n' +
        'command = "uvx"\n' +
        'args = ["pkg@latest"]\n' +
        '\n' +
        '[mcp_servers.aurora-dsql.env]\n' +
        'FASTMCP_LOG_LEVEL = "ERROR"\n',
    )
    expect(parseToml(w.content)).toEqual({
      mcp_servers: {
        'aws-knowledge': { command: 'npx', args: ['mcp-remote', 'https://x'] },
        'aurora-dsql': { command: 'uvx', args: ['pkg@latest'], env: { FASTMCP_LOG_LEVEL: 'ERROR' } },
      },
    })
  })

  it('quotes keys that are not bare and escapes strings so they parse back unchanged', () => {
    const tricky = 'quote " backslash \\ tab \t newline \n delete \u007f é'
    const w = renderMcp(
      { mcp: [{ id: 'dotted.id', command: tricky, args: [], env: { 'A KEY': tricky } }] },
      'codex',
    )
    expect(w.content.split('\n')[0]).toBe('[mcp_servers."dotted.id"]')
    expect(parseToml(w.content)).toEqual({
      mcp_servers: { 'dotted.id': { command: tricky, args: [], env: { 'A KEY': tricky } } },
    })
  })

  it.each([
    [{ id: 'k', command: 42 }, /k\.command must be a string/],
    [{ id: 'k', command: 'npx', args: 'mcp-remote' }, /k\.args must be an array of strings/],
    [{ id: 'k', command: 'npx', args: ['ok', 1] }, /k\.args\[1\] must be a string/],
    [{ id: 'k', command: 'npx', env: ['A=1'] }, /k\.env must be a table of strings/],
    [{ id: 'k', command: 'npx', env: { DEBUG: true } }, /k\.env\.DEBUG must be a string/],
    [{ id: 'k', url: { href: 'https://x' } }, /k\.url must be a string/],
    [{ id: 'k', command: 'bad \ud800' }, /k\.command holds a lone surrogate/],
    [{ id: 'k', command: 'npx', disabled: 'yes' }, /k\.disabled must be true or false/],
  ])('refuses an unsupported value shape %#', (server, message) => {
    expect(() => renderMcp({ mcp: [server] }, 'codex')).toThrow(message)
  })

  it.each([
    [{ id: 'k' }, /MCP server k needs exactly one of url or command/],
    [{ id: 'k', url: 'https://x', command: 'npx' }, /MCP server k needs exactly one of url or command/],
    [{ id: 'k', url: 'https://x', args: ['a'] }, /MCP server k has a url, so it cannot take args/],
    [{ id: 'k', url: 'https://x', env: { A: '1' } }, /MCP server k has a url, so it cannot take env/],
    [{ id: 'k', transport: 'sse', url: 'https://x' }, /MCP server k transport sse is not supported for Codex/],
  ])('refuses a server Codex cannot load %#', (server, message) => {
    expect(() => renderMcp({ mcp: [server] }, 'codex')).toThrow(message)
  })

  it.each([
    [[{ command: 'npx' }], /MCP server 0 needs a string id/],
    [[{ id: 'a', command: 'npx' }, { id: '', command: 'npx' }], /MCP server 1 needs a string id/],
  ])('refuses a server without an id %#', (servers, message) => {
    expect(() => renderMcp({ mcp: servers }, 'codex')).toThrow(message)
  })

  it('refuses a duplicate server id', () => {
    const servers = [{ id: 'k', command: 'npx' }, { id: 'k', url: 'https://x' }]
    expect(() => renderMcp({ mcp: servers }, 'codex')).toThrow(/duplicate MCP server id: k/)
  })

  it('writes enabled = false for a disabled server and nothing for an enabled one', () => {
    const w = renderMcp({
      mcp: [
        { id: 'off', command: 'uvx', args: ['pkg'], env: { A: '1' }, disabled: true },
        { id: 'on', transport: 'http', url: 'https://x', disabled: false },
      ],
    }, 'codex')
    expect(w.content).toBe(
      '[mcp_servers.off]\n' +
        'command = "uvx"\n' +
        'args = ["pkg"]\n' +
        'enabled = false\n' +
        '\n' +
        '[mcp_servers.off.env]\n' +
        'A = "1"\n' +
        '\n' +
        '[mcp_servers.on]\n' +
        'url = "https://x"\n',
    )
    expect(parseToml(w.content).mcp_servers.off.enabled).toBe(false)
  })
})
