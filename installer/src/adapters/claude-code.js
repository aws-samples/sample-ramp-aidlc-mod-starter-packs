export const claudeCodeAdapter = Object.freeze({
  id: 'claude-code',
  defaultSpecRoot: 'specs',
  skillsRoot: '.claude/skills',
  instructions: Object.freeze({
    kind: 'claude-rules',
    primaryPath: () => 'CLAUDE.md',
    companionPath: (file) => `.claude/rules/${file}`,
  }),
  mcp: Object.freeze({
    path: '.mcp.json',
    rootKey: 'mcpServers',
  }),
  command: Object.freeze({
    kind: 'claude-command',
    path: (name) => `.claude/commands/${name}.md`,
  }),
})
