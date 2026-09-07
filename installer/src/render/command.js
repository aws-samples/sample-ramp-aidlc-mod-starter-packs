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
  const cmd = manifest.command
  if (!cmd) return null

  const body = renderBody(cmd)

  if (tool === 'claude-code') {
    return {
      path: `.claude/commands/${cmd.name}.md`,
      content: `---\ndescription: ${cmd.description}\n---\n${body}`,
      kind: 'text',
    }
  }
  if (tool === 'copilot') {
    return {
      path: `.github/prompts/${cmd.name}.prompt.md`,
      content: `---\ndescription: ${cmd.description}\nargument-hint: "describe what you're building"\n---\n${body}`,
      kind: 'text',
    }
  }
  return null // kiro, cursor
}
