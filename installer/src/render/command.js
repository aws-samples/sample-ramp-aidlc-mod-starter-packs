import { getAdapter } from '../adapters/index.js'

const BODY =
  'You are an AI-DLC modernization architect. Begin the decision-gated workflow ' +
  'defined in the primary instructions. Start from the entry step: detect greenfield ' +
  'vs brownfield, then Requirements → Design → Tasks. Follow every approval gate. ' +
  'Do not skip ahead.\n'

function renderBody(cmd) {
  if (typeof cmd.body !== 'string' || cmd.body.trim() === '') return BODY
  return `${cmd.body.replace(/(?:\r?\n)+$/, '')}\n`
}

export function renderCommand(manifest, tool) {
  const adapter = getAdapter(tool)
  const cmd = manifest.command
  if (!cmd) return null

  const body = renderBody(cmd)

  if (adapter.command.kind === 'claude-command') {
    return {
      path: adapter.command.path(cmd.name),
      content: `---\ndescription: ${cmd.description}\n---\n${body}`,
      kind: 'text',
    }
  }
  if (adapter.command.kind === 'copilot-prompt') {
    return {
      path: adapter.command.path(cmd.name),
      content: `---\ndescription: ${cmd.description}\nargument-hint: "describe what you're building"\n---\n${body}`,
      kind: 'text',
    }
  }
  if (adapter.command.kind === 'none') return null
  throw new Error(`unsupported command adapter kind: ${adapter.command.kind}`)
}
