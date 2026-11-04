const stem = (file) => file.replace(/\.md$/, '')

export const cursorAdapter = Object.freeze({
  id: 'cursor',
  defaultSpecRoot: 'specs',
  skillsRoot: '.cursor/skills',
  instructions: Object.freeze({
    kind: 'cursor-rules',
    primaryPath: (file) => `.cursor/rules/${stem(file)}.mdc`,
    companionPath: (file) => `.cursor/rules/${stem(file)}.mdc`,
  }),
  mcp: Object.freeze({
    path: '.cursor/mcp.json',
    rootKey: 'mcpServers',
  }),
  command: Object.freeze({
    kind: 'none',
    path: () => null,
  }),
})
