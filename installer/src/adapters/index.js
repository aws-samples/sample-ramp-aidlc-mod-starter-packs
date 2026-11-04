import { kiroAdapter } from './kiro.js'
import { claudeCodeAdapter } from './claude-code.js'
import { copilotAdapter } from './copilot.js'
import { cursorAdapter } from './cursor.js'

const adapters = Object.freeze([
  kiroAdapter,
  claudeCodeAdapter,
  copilotAdapter,
  cursorAdapter,
])

const adaptersById = new Map(adapters.map((adapter) => [adapter.id, adapter]))

export function listAdapterIds() {
  return adapters.map((adapter) => adapter.id)
}

export function getAdapter(id) {
  const adapter = adaptersById.get(id)
  if (!adapter) throw new Error(`unknown tool: ${id}`)
  return adapter
}
