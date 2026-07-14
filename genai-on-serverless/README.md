# Intelligent Document Processing on Serverless — AI-DLC Starter Pack

A **tool-agnostic** starter pack for building a serverless **Intelligent Document Processing (IDP)** pipeline on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow, using **AWS Lambda, Amazon API Gateway, Amazon Bedrock, and Amazon S3**.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains deep serverless expertise and follows structured, decision-gated workflows — no manual setup needed.

## Use case

Build or modernize into an event-driven serverless IDP pipeline — ingest, classify, extract, index, and search documents using AWS serverless services and generative AI. Suited to brownfield modernization (e.g., from a PHP/Laravel + Vue.js monolith) or greenfield builds. For brownfield work, the workflow begins with **Phase 0 reverse engineering** of the existing codebase to ground every decision in evidence.

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
node installer/bin/ramp-pack.js init genai-on-serverless --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Open the project in your tool and start a conversation. Try:
   - *"Help me plan the IDP pipeline based on the success criteria."*
   - *"Create requirements for document ingestion and classification."*
   - *"Write a Lambda handler for extracting text from PDFs using Textract."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow guides the agent to ask for your decisions first (writing a `_decisions-*.md` before each spec document), and the skills provide expert-level guidance for Lambda, API Gateway, and serverless deployment throughout.

## What's in this pack

```
genai-on-serverless/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate skills + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, brownfield-only)
├── skills/
│   ├── aws-lambda/           # Lambda expertise (SKILL.md + reference library)
│   ├── api-gateway/          # API Gateway expertise (SKILL.md + reference library)
│   └── aws-serverless-deployment/ # SAM/CDK deployment guidance
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*` `applyTo: '**'` | `.mdc` `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### Skills — AWS Lambda, API Gateway, Serverless Deployment

The pack includes three skills:

- **`aws-lambda`** — Lambda handler patterns, event sources, Powertools, cold starts, layers, function URLs, EventBridge, SQS triggers, and more.
- **`api-gateway`** — REST / HTTP / WebSocket APIs, authorizers, custom domains, throttling, CORS, observability, and service integrations.
- **`aws-serverless-deployment`** — SAM / CDK templates, deployment patterns, CI/CD pipelines, and infrastructure best practices.

Skills activate when your conversation mentions relevant keywords (Lambda function, API Gateway, SAM template, etc.). Each follows the [Agent Skills open standard](https://agentskills.io/), so they copy verbatim into every supported tool.

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, page reading, regional availability, and recommendations — used proactively when validating best practices, checking service limits, or when you question a recommendation. |

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- `npx` available on your PATH (used to launch the AWS Knowledge MCP).
