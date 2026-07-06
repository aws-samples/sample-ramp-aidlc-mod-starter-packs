# Mobile Document Capture on Serverless — AI-DLC Starter Pack

A pre-configured Kiro workspace for building a **mobile document-capture app plus a serverless computer-vision extraction pipeline** on AWS — capturing images of printed/handwritten forms, extracting structured data, validating it, and confirming it through human review — driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

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

## What's in this pack

```
mobile-document-capture-on-serverless/
├── .kiro/
│   ├── steering/                       # Always-on agent rules
│   │   ├── decision-driven-specs.md        # Phase 0 → Requirements → Design → Tasks
│   │   ├── reverse-engineering.md          # Phase 0 analysis playbook (brownfield)
│   │   └── skill-mcp-activation.md         # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge MCP + AWS Docs MCP
│   └── skills/                         # Curated knowledge bundles (see Skills below)
│       ├── kotlin-coding-standards.md
│       ├── android-design-best-practices.md
│       ├── aws-serverless-best-practices.md
│       ├── terraform-best-practices.md
│       ├── property-based-testing-guide.md
│       ├── aws-lambda/
│       └── api-gateway/
├── reference-architecture.md           # Sanitized reference CV-pipeline diagram + workstreams
└── (aidlc-docs/ and .kiro/specs/ are created by the agent during the workflow)
```

### Steering

| File | What it does |
|---|---|
| `decision-driven-specs.md` | The workflow. Optional **Phase 0: Reverse Engineering** for brownfield codebases, then `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file. The agent never produces a spec document until you've filled in your decisions. |
| `reverse-engineering.md` | Phase 0 playbook — which artifacts to produce when analyzing an existing codebase (business overview, architecture, API docs, code quality, bounded contexts, modernization readiness). |
| `skill-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability (e.g. Bedrock models, Textract features), current API behavior. |
| **AWS Docs** (`aws-documentation-mcp-server`) | Fallback documentation search/read when the AWS Knowledge MCP returns nothing useful. |

> Both MCP servers launch via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, make sure you have valid AWS credentials configured.

### Skills

Skills are curated, domain-specific knowledge bundles the agent activates on demand. See [Credits & attribution](#credits--attribution) for sources and licensing.

| Skill | Activates when… |
|---|---|
| `kotlin-coding-standards` | Writing or reviewing Kotlin — idiomatic style, null safety, coroutines, `BigDecimal` money handling, DI |
| `android-design-best-practices` | Designing Android UI/architecture — Jetpack Compose, UDF, CameraX capture, accessibility |
| `aws-serverless-best-practices` | Designing/reviewing the serverless extraction backend — Lambda, Step Functions, S3, DynamoDB, Textract, Bedrock |
| `terraform-best-practices` | Authoring or reviewing Terraform / OpenTofu — structure, state, security, testing |
| `property-based-testing-guide` | Defining correctness properties or writing property-based tests (Kotest / fast-check) |
| `aws-lambda` | Authoring Lambda handlers, event sources, Powertools, Step Functions orchestration |
| `api-gateway` | Designing or wiring REST / HTTP / WebSocket APIs, authorizers, custom domains |

## Getting started

1. Open this folder in Kiro.
2. No MCP configuration is required — the AWS Knowledge and AWS Docs MCP servers are launched via `uvx` and need no credentials. For any AWS operations or deploys the agent runs locally, ensure you have valid AWS credentials.
3. **(For brownfield / Phase 0)** Make any existing codebase available to the agent: clone it into a gitignored folder, symlink your local checkout, or point the agent at an absolute path when it asks.
4. Start a conversation. Try:
   - *"Let's start the AI-DLC workflow. I want to build a mobile app that captures paper forms and a serverless pipeline that extracts and validates the data."*
   - *"Create a spec for the on-device capture and quality-check flow."*
   - *"Design the Step Functions CV pipeline — OCR, layout, checkbox detection, handwriting, and reconciliation."*

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `.kiro/specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads) (for branches and any existing-codebase clone)
- AWS credentials configured for any local AWS operations or deploys (not needed for the MCP servers)
- [`uvx`](https://docs.astral.sh/uv/) available on your PATH (used to launch the AWS Knowledge and AWS Docs MCP servers)

## Credits & attribution

- The **`aws-lambda`** and **`api-gateway`** skills vendored in `.kiro/skills/` are sourced from [**awslabs/agent-plugins**](https://github.com/awslabs/agent-plugins) (`aws-serverless` plugin), licensed under the **Apache License 2.0**. Full credit to their authors and maintainers. They are vendored (copied) here so the pack works offline and pins a known-good version — refer to the upstream repository for the latest versions and their `LICENSE`/`NOTICE` files.
- The `kotlin-coding-standards`, `android-design-best-practices`, `aws-serverless-best-practices`, `terraform-best-practices`, and `property-based-testing-guide` skills are original quick-reference guides authored for this pack. The Terraform guide draws on the [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style).
- AI-DLC steering is adapted from [**awslabs/aidlc-workflows**](https://github.com/awslabs/aidlc-workflows) (MIT-0).
