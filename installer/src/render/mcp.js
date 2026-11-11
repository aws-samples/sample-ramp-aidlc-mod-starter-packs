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

// Codex reads its MCP servers from TOML. A small writer covers the value shapes
// pack.yaml allows: strings, string arrays and a string table for `env`. Any
// other shape fails instead of being guessed.
const BARE_KEY = /^[A-Za-z0-9_-]+$/

function tomlString(value, label) {
  if (typeof value !== 'string') throw new Error(`MCP ${label} must be a string for TOML`)
  if (/\p{Cs}/u.test(value)) throw new Error(`MCP ${label} holds a lone surrogate`)
  // A JSON string is a valid TOML basic string once DEL is escaped too.
  return JSON.stringify(value).replace(/\u007f/g, '\\u007f')
}

function tomlKey(key) {
  return typeof key === 'string' && BARE_KEY.test(key) ? key : tomlString(key, `key ${key}`)
}

function tomlStringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`MCP ${label} must be an array of strings for TOML`)
  return `[${value.map((item, index) => tomlString(item, `${label}[${index}]`)).join(', ')}]`
}

function renderTomlServer(rootKey, s) {
  const table = `${rootKey}.${tomlKey(s.id)}`
  const lines = [`[${table}]`]
  if (s.url !== undefined) lines.push(`url = ${tomlString(s.url, `${s.id}.url`)}`)
  if (s.command !== undefined) lines.push(`command = ${tomlString(s.command, `${s.id}.command`)}`)
  if (s.args !== undefined) lines.push(`args = ${tomlStringArray(s.args, `${s.id}.args`)}`)
  if (s.env !== undefined) {
    if (!s.env || typeof s.env !== 'object' || Array.isArray(s.env)) {
      throw new Error(`MCP ${s.id}.env must be a table of strings for TOML`)
    }
    lines.push('', `[${table}.env]`)
    for (const [name, value] of Object.entries(s.env)) {
      lines.push(`${tomlKey(name)} = ${tomlString(value, `${s.id}.env.${name}`)}`)
    }
  }
  return lines.join('\n')
}

export function renderMcp(manifest, tool) {
  const adapter = getAdapter(tool)
  const servers = manifest.mcp ?? []
  if (servers.length === 0) return null

  if (adapter.mcp.format === 'toml') {
    return {
      path: adapter.mcp.path,
      content: servers.map((s) => renderTomlServer(adapter.mcp.rootKey, s)).join('\n\n') + '\n',
      kind: 'text',
    }
  }

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
