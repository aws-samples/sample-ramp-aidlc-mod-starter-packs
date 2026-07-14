# Legacy Transformation on AWS — AI-DLC Starter Pack

A **tool-agnostic** starter pack for analyzing and decomposing a **brownfield monolith** into microservices on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow. The output is a defensible, decision-audited decomposition blueprint.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains structured modernization workflow guidance — no manual setup needed.

## Use case

Analyze an existing monolith (any stack — e.g., Java/Spring Boot, .NET, Node.js), identify bounded contexts and coupling hot-spots, and produce a phased extraction roadmap. The workflow starts with **Phase 0 reverse engineering** so every decomposition decision is grounded in the actual codebase.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the folder for your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout into your target project:

```bash
node installer/bin/ramp-pack.js init legacy-transformation-on-aws --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/monolith
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Open the project in your tool and start a conversation. Try:
   - *"Modernise this legacy monolith to microservice architecture on AWS"*
   - *"Analyze the codebase and identify bounded contexts for decomposition"*
   - *"Create a strangler fig migration plan for extracting services"*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow detects the stack, runs Phase 0 reverse engineering (producing analysis artifacts under `aidlc-docs/analysis/`), then creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to an audit log for a defensible paper trail.

## What's in this pack

```
legacy-transformation-on-aws/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Reverse Engineering → Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate skills + Terraform + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, auto — brownfield only)
├── skills/                   # (empty — no skills in this pack)
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules}, .cursor/mcp.json
```

> `instructions/` and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*` `applyTo: '**'` | `.mdc` `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, page reading, regional availability, and recommendations — used proactively when validating best practices, checking service limits, or when you question a recommendation during decomposition decisions. |

### Skills

This pack **does not include any skills**. The `skill-activation.md` instruction references AWS Lambda, API Gateway, and AWS Serverless Deployment skills — these are expected to be present in your agent environment (e.g., from other installed packs or the agent's skill catalog). If your environment does not have these skills, the pack will still guide the decision-driven workflow; you'll just miss the domain-specific deep-dive guidance.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- `npx` available on your PATH (used to launch the AWS Knowledge MCP).
