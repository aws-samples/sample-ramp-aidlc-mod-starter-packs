export const kiroAdapter = Object.freeze({
  id: 'kiro',
  defaultSpecRoot: '.kiro/specs',
  skillsRoot: '.kiro/skills',
  instructions: Object.freeze({
    kind: 'kiro-steering',
    primaryPath: (file) => `.kiro/steering/${file}`,
    companionPath: (file) => `.kiro/steering/${file}`,
  }),
  mcp: Object.freeze({
    path: '.kiro/settings/mcp.json',
    rootKey: 'mcpServers',
    preserveAgentFields: true,
  }),
  command: Object.freeze({
    kind: 'none',
    path: () => null,
  }),
})
