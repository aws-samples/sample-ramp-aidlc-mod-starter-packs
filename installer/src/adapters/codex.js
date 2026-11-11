export const codexAdapter = Object.freeze({
  id: 'codex',
  defaultSpecRoot: 'specs',
  skillsRoot: '.agents/skills',
  instructions: Object.freeze({
    kind: 'codex-agents',
    primaryPath: () => 'AGENTS.md',
    companionPath: (file) => `.codex/instructions/${file}`,
    // Codex reads at most project_doc_max_bytes (32 KiB by default) of AGENTS.md.
    maxPrimaryBytes: 32 * 1024,
  }),
  mcp: Object.freeze({
    path: '.codex/config.toml',
    rootKey: 'mcp_servers',
    format: 'toml',
  }),
  command: Object.freeze({
    kind: 'none',
    path: () => null,
  }),
})
