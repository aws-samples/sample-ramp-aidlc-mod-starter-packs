const stem = (file) => file.replace(/\.md$/, '')

export const copilotAdapter = Object.freeze({
  id: 'copilot',
  defaultSpecRoot: 'specs',
  skillsRoot: '.github/skills',
  instructions: Object.freeze({
    kind: 'copilot-instructions',
    primaryPath: () => '.github/copilot-instructions.md',
    companionPath: (file) => `.github/instructions/${stem(file)}.instructions.md`,
  }),
  mcp: Object.freeze({
    path: '.vscode/mcp.json',
    rootKey: 'servers',
    preferNativeHttp: true,
  }),
  command: Object.freeze({
    kind: 'copilot-prompt',
    path: (name) => `.github/prompts/${name}.prompt.md`,
  }),
})
