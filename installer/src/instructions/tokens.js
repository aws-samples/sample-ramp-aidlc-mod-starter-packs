import { getAdapter } from '../adapters/index.js'

const INSTRUCTION_TOKEN = /\{\{INSTRUCTION:([^{}]+)\}\}/g
const OWNED_TOKEN_CANDIDATE =
  /\{{1,2}(?:INSTRUCTION(?=:|(?=[}\s]|$))|SPEC_DIR(?=[}\s]|$)|STATE_DIR(?=[}\s]|$)|SPEC_DI(?=[}\s]|$)|STATE_DI(?=[}\s]|$))/

function assertNoInvalidOwnedTokens(content, { allowValid }) {
  const candidate = allowValid
    ? content
        .replace(INSTRUCTION_TOKEN, '')
        .replaceAll('{{SPEC_DIR}}', '')
        .replaceAll('{{STATE_DIR}}', '')
    : content
  const match = candidate.match(OWNED_TOKEN_CANDIDATE)
  if (match) {
    const excerpt = candidate.slice(match.index, match.index + 80).match(/^\S*/)?.[0]
    throw new Error(`invalid or unresolved RAMP token syntax near: ${excerpt}`)
  }
}

export function applyInstructionTokens(content, { manifest, tool, workspace }) {
  const adapter = getAdapter(tool)
  const instructions = manifest.instructions ?? []
  assertNoInvalidOwnedTokens(content, { allowValid: true })

  const withInstructionPaths = content.replace(
    INSTRUCTION_TOKEN,
    (_token, file) => {
      const instruction = instructions.find((candidate) => candidate.file === file)
      if (!instruction) {
        throw new Error(`instruction token references undeclared file: ${file}`)
      }
      if (instruction.role === 'primary') {
        return adapter.instructions.primaryPath(instruction.file)
      }
      if (instruction.role === 'companion') {
        return adapter.instructions.companionPath(instruction.file)
      }
      throw new Error(
        `instruction token references file with unsupported role: ${file} (${instruction.role})`,
      )
    },
  )

  const rendered = withInstructionPaths
    .replaceAll('{{SPEC_DIR}}', workspace.specRoot)
    .replaceAll('{{STATE_DIR}}', workspace.stateRoot)
  assertNoInvalidOwnedTokens(rendered, { allowValid: false })
  return rendered
}
