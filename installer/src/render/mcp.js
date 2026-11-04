import { getAdapter } from '../adapters/index.js'

// A remote server is commonly declared as the `npx mcp-remote <url>` stdio shim.
// VS Code speaks HTTP MCP natively, so detect that shape and return the URL.
function remoteUrl(s) {
  if (s.url) return s.url
  if (s.command === 'npx' && Array.isArray(s.args)) {
    const i = s.args.indexOf('mcp-remote')
    if (i !== -1 && s.args[i + 1]) return s.args[i + 1]
  }
  return null
}

export function renderMcp(manifest, tool) {
  const adapter = getAdapter(tool)
  const servers = manifest.mcp ?? []
  if (servers.length === 0) return null

  const out = {}
  for (const s of servers) {
    const entry = {}
    // Copilot: prefer native HTTP transport for remote servers instead of the
    // `mcp-remote` stdio shim, and use the `type: http` + `url` schema.
    const url = adapter.mcp.preferNativeHttp ? remoteUrl(s) : s.url
    if (adapter.mcp.preferNativeHttp && url) {
      entry.type = s.transport ?? 'http'
      entry.url = url
    } else {
      if (s.command) entry.command = s.command
      if (s.args) entry.args = s.args
      if (s.url) entry.url = s.url
      if (s.transport) entry.type = s.transport
    }
    if (s.env) entry.env = s.env
    if (adapter.mcp.preserveAgentFields) {
      if (s.autoApprove) entry.autoApprove = s.autoApprove
      if (s.disabled !== undefined) entry.disabled = s.disabled
    }
    out[s.id] = entry
  }
  return {
    path: adapter.mcp.path,
    content: JSON.stringify({ [adapter.mcp.rootKey]: out }, null, 2) + '\n',
    kind: 'text',
  }
}
