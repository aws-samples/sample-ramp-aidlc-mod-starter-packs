# Mobile Document Capture on Serverless — AI-DLC Starter Pack

A **tool-agnostic** starter pack for building a **mobile document-capture app plus a serverless computer-vision extraction pipeline** on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use follows structured, decision-gated workflows and gains deep domain expertise — no manual setup needed.

## Use case

Digitizing a manual, paper-form data-entry (**encoding**) process. A mobile app captures multi-page forms, and an event-driven serverless pipeline turns those images into structured, validated records that a person reviews and confirms.

The scenario decomposes into independent workstreams:

- **Mobile capture & pre-processing** — multi-page capture with on-device quality gating (blur/glare/coverage checks, edge detection, perspective correction).
- **OCR with spatial preservation** — layout-aware OCR returning bounding boxes per token/line.
- **Layout understanding** — infer table/structure from the page when the template is unknown.
- **Checkbox / mark detection** — detect which items/rows are selected.
- **Handwriting recognition** — read handwritten quantities/values.
- **Catalog reconciliation** — match extracted text against a reference catalog.
- **Math reconciliation** — validate arithmetic (line totals, printed totals) within tolerance.
- **Human-in-the-loop review** — the user edits and confirms the digitized result.

A reference target stack: **Android/Kotlin (Jetpack Compose + CameraX)** on the client; **S3, AWS Lambda, AWS Step Functions, Amazon Textract, Amazon Bedrock, Amazon DynamoDB, Amazon EventBridge, Amazon API Gateway, and Amazon CloudFront** on the serverless backend. See [`reference-architecture.md`](reference-architecture.md) for the shape. It works for **greenfield** builds and **brownfield** extensions alike — when an existing codebase is present, the workflow runs a reverse-engineering pass (Phase 0) first.

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
node installer/bin/ramp-pack.js init ocr-mobile-app-on-serverless --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. **(For brownfield / Phase 0)** Make any existing codebase available to the agent: clone it into a gitignored folder, symlink your local checkout, or point the agent at an absolute path when it asks.
2. Open the project in your tool and start a conversation. Try:
   - *"Let's start the AI-DLC workflow. I want to build a mobile app that captures paper forms and a serverless pipeline that extracts and validates the data."*
   - *"Create a spec for the on-device capture and quality-check flow."*
   - *"Design the Step Functions CV pipeline — OCR, layout, checkbox detection, handwriting, and reconciliation."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions.

## What's in this pack

```
ocr-mobile-app-on-serverless/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate skills + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, brownfield-only)
├── skills/                   # Domain expertise (Agent Skills standard)
│   ├── kotlin-coding-standards/
│   ├── android-design-best-practices/
│   ├── aws-serverless-best-practices/
│   ├── terraform-best-practices/
│   ├── property-based-testing-guide/
│   ├── aws-lambda/
│   └── api-gateway/
├── reference-architecture.md # Sanitized reference CV-pipeline diagram + workstreams
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

### Skills

Skills follow the [Agent Skills open standard](https://agentskills.io/), so they copy verbatim into every supported tool. The agent activates them automatically when relevant or on demand.

| Skill | Activates when… |
|---|---|
| `kotlin-coding-standards` | Writing or reviewing Kotlin — idiomatic style, null safety, coroutines, `BigDecimal` money handling, DI |
| `android-design-best-practices` | Designing Android UI/architecture — Jetpack Compose, UDF, CameraX capture, accessibility |
| `aws-serverless-best-practices` | Designing/reviewing the serverless extraction backend — Lambda, Step Functions, S3, DynamoDB, Textract, Bedrock |
| `terraform-best-practices` | Authoring or reviewing Terraform / OpenTofu — structure, state, security, testing |
| `property-based-testing-guide` | Defining correctness properties or writing property-based tests (Kotest / fast-check) |
| `aws-lambda` | Authoring Lambda handlers, event sources, Powertools, Step Functions orchestration |
| `api-gateway` | Designing or wiring REST / HTTP / WebSocket APIs, authorizers, custom domains |

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability (e.g. Bedrock models, Textract features), current API behavior. |
| **AWS Docs** (`aws-documentation-mcp-server`) | Fallback documentation search/read when the AWS Knowledge MCP returns nothing useful. |

> Both MCP servers launch via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, ensure you have valid AWS credentials configured.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- [`uvx`](https://docs.astral.sh/uv/) available on your PATH (used to launch the AWS Knowledge and AWS Docs MCP servers).
- AWS credentials configured for any local AWS operations or deploys (not needed for the MCP servers).
- [Git](https://git-scm.com/downloads) (for branches and any existing-codebase clone in Phase 0).

## Credits & attribution

- The **`aws-lambda`** and **`api-gateway`** skills are sourced from [**awslabs/agent-plugins**](https://github.com/awslabs/agent-plugins) (`aws-serverless` plugin), licensed under the **Apache License 2.0**. Full credit to their authors and maintainers. They are vendored (copied) here so the pack works offline and pins a known-good version — refer to the upstream repository for the latest versions and their `LICENSE`/`NOTICE` files.
- The `kotlin-coding-standards`, `android-design-best-practices`, `aws-serverless-best-practices`, `terraform-best-practices`, and `property-based-testing-guide` skills are original quick-reference guides authored for this pack. The Terraform guide draws on the [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style).
- AI-DLC steering is adapted from [**awslabs/aidlc-workflows**](https://github.com/awslabs/aidlc-workflows) (MIT-0).
