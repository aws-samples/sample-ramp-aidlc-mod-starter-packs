# Enterprise App on Cloud-Native — AI-DLC Starter Pack

A **tool-agnostic** starter pack for **greenfield** development of a cloud-native **enterprise application** — a line-of-business or transactional system (e.g. order management, case management, a customer/operator portal) — built with the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Greenfield build of an end-to-end business workflow, suitable for a working demo. The pack's **default lean is serverless — AWS Lambda + Amazon API Gateway + Aurora DSQL** — but it ships the **full cloud-native skill set** (containers, multiple Aurora engines plus DynamoDB, messaging & streaming, Step Functions orchestration, CDK / CloudFormation / Terraform, IAM, observability) and **automated-testing skills** (web E2E and .NET), so the design phase can flex the stack to fit your domain. This is a **single-repo** pack: one workspace, one spec lifecycle. Greenfield is the default; if existing source is present the workflow runs Phase 0 (reverse engineering) first.

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
node installer/bin/ramp-pack.js init enterprise-app-on-cloudnative --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Update `AWS_PROFILE` in the generated MCP config (`mcp.json` / `.mcp.json`) for the AWS IaC MCP.
2. Open the project in your tool and start a conversation. Try:
   - *"I want to build a cloud-native enterprise app — [describe your domain and core workflow]. Let's start the AI-DLC workflow."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## How the workflow works

Every phase is **decision-gated**: the agent writes a `_decisions-*.md`, waits for your input, then generates the matching spec document.

**Entry (always):**
1. Resume from `aidlc-docs/aidlc-state.md` if it exists.
2. Detect the **input mode**: existing **source code** and/or **functional documents (FSDs**, platform exports such as OutSystems). If either is present → run **Phase 0** (Reverse Engineering / Input Analysis). Pure greenfield (no source, no docs) → skip Phase 0.

**Then the single-repo flow:**
```
Phase 1 Requirements → Phase 2 Domain Model → Phase 3 Design → Phase 4 Tasks (independent parallel waves) → execute
```
- **Phase 1** — user stories + acceptance criteria, functional & non-functional requirements.
- **Phase 2** — bounded contexts, context map, aggregates/entities, domain events, and ubiquitous language. **Always runs** (seeded from Phase 0 when present); it's the domain contract Design and Tasks map onto.
- **Phase 3** — architecture (components mapped to bounded contexts), data model, API contracts, sequence diagrams (Mermaid), cross-cutting concerns.
- **Phase 4** — an ordered task plan grouped into independent **waves** that can run in parallel (groups aligned to bounded contexts).

**Invariants:** decision-file before every spec doc · real approval gates · skills/MCP activated before design & code · every decision appended to an append-only audit log; progress tracked for session resume.

## What's in this pack

```
enterprise-app-on-cloudnative/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Domain Model → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate which skill + MCP (companion, always)
│   ├── reverse-engineering.md    # Phase 0 playbook — source code and/or FSDs/docs (companion, auto)
│   └── requirements-traceability.md  # Trace requirements to FSD/screen anchors + coverage gate (companion, auto)
├── skills/                   # AWS domain skills + RAMP testing skills (see Skills + Credits below)
│   ├── aws-lambda/            api-gateway/            aws-lambda-durable-functions/
│   ├── aws-step-functions/    aws-serverless-deployment/  aws-messaging-and-streaming/
│   ├── aws-containers/        aws-cdk/                aws-cloudformation/
│   ├── terraform-skill/       aws-iam/                aws-observability/
│   ├── signing-in-to-aws/     aurora-dsql/            amazon-dynamodb/
│   ├── amazon-aurora-postgresql/   amazon-aurora-mysql/
│   ├── creating-amazon-aurora-db-cluster-with-instances/
│   └── web-test-automation/   dotnet-testing/
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
| `requirements-traceability` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### MCP servers

Declared once in `pack.yaml`; the installer writes them to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior, and resource shapes. |
| **Aurora DSQL** (`aurora-dsql`) | Validate Aurora DSQL schemas, connection patterns, and DSQL-specific semantics. |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validate CDK constructs, CloudFormation resource properties, and IaC patterns. Update `AWS_PROFILE` to your named profile. |

### Skills

Curated, domain-specific knowledge bundles the agent activates on demand — spanning **compute, IaC, data, identity, and operations**, so the pack covers both the serverless default and container/multi-engine alternatives. They follow the [Agent Skills open standard](https://agentskills.io/) (`<skill>/SKILL.md` + `references/`), so they copy verbatim into every supported tool. See [Credits & attribution](#credits--attribution) for sources and licensing.

| Skill | Activates when… | Source |
|---|---|---|
| `aws-lambda` | Designing/authoring Lambda handlers, event sources, Powertools | agent-plugins |
| `api-gateway` | Designing/wiring REST / HTTP / WebSocket APIs, authorizers, custom domains | agent-plugins |
| `aws-lambda-durable-functions` | Stateful workflows, approval routing, long-running/saga processes | agent-plugins |
| `aws-step-functions` | Authoring Step Functions state machines in ASL/JSONata — state types, Retry/Catch, service integrations, Distributed Map, JSONPath→JSONata migration | agent-toolkit-for-aws |
| `aws-messaging-and-streaming` | Messaging & streaming patterns across SQS, SNS, EventBridge, MQ, Kinesis, Firehose, MSK, Managed Flink | agent-toolkit-for-aws |
| `aws-serverless-deployment` | SAM / serverless-CDK packaging & deploy, serverless CI/CD | agent-plugins |
| `aws-containers` | Deploying/operating containers on ECS, Fargate, ECR | agent-toolkit-for-aws |
| `aws-cdk` | Authoring/deploying CDK stacks, construct patterns, safe refactors, drift | agent-toolkit-for-aws |
| `aws-cloudformation` | Authoring/validating/troubleshooting raw CloudFormation templates | agent-toolkit-for-aws |
| `terraform-skill` | Writing/reviewing/debugging **Terraform / OpenTofu** — modules, tests, CI, state, scans | antonbabenko/terraform-skill |
| `aws-iam` | IAM roles, trust policies, least-privilege policies; service/execution roles | agent-toolkit-for-aws |
| `aws-observability` | CloudWatch metrics/logs/alarms/dashboards, X-Ray, CloudTrail, ADOT, Application Signals | agent-toolkit-for-aws |
| `signing-in-to-aws` | Getting local CLI/SDK credentials via `aws login`; expired/missing credential errors | agent-toolkit-for-aws |
| `aurora-dsql` | Aurora DSQL schemas, IAM auth, safe SQL construction, MySQL→DSQL migration (the default engine) | agent-plugins |
| `amazon-aurora-postgresql` | Aurora PostgreSQL cluster ops, express configuration, ACU sizing, upgrade planning | agent-plugins |
| `amazon-aurora-mysql` | Aurora MySQL cluster ops, ACU sizing, I/O-Optimized, upgrade planning | agent-plugins |
| `creating-amazon-aurora-db-cluster-with-instances` | Standing up a complete Aurora cluster + instances with Secrets Manager passwords | agent-plugins |
| `amazon-dynamodb` | DynamoDB data-layer design from access patterns — partition/sort keys, GSIs, single- vs. multi-table, Streams, Global Tables, TTL, zero-ETL, cost model; hot-partition/throttling debugging | agent-toolkit-for-aws |
| `web-test-automation` | Web E2E/UI tests — Playwright-first (Cypress/Selenium migration), page objects, locators, flaky-test debugging, visual regression, accessibility (axe-core), CI sharding | RAMP (this pack) |
| `dotnet-testing` | Automated tests for .NET / C# — xUnit (NUnit/MSTest), test project structure, mocking (Moq), coverage (coverlet), trunk-keeping merge gates | RAMP (this pack) |

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- An AWS profile configured (for the AWS IaC MCP; also used by the `signing-in-to-aws` / Aurora skills for live AWS operations).
- `uvx` / `npx` available on your PATH (used to launch the MCP servers).

## Credits & attribution

Most skills vendored in `skills/` are sourced from three open-source projects licensed under **Apache License 2.0**; two automated-testing skills are authored by this repository under **MIT-0**. Full credit to their authors and maintainers:

- **[aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws)** — `aws-core` plugin. Source of the compute, data, messaging, orchestration, IaC, identity, and operations skills: `aws-containers`, `aws-cdk`, `aws-cloudformation`, `aws-iam`, `aws-observability`, `signing-in-to-aws`, `amazon-dynamodb`, `aws-messaging-and-streaming`, and `aws-step-functions`.
- **[awslabs/agent-plugins](https://github.com/awslabs/agent-plugins)** — Agent Plugins for AWS. Source of the serverless and database skills:
  - `aws-serverless` plugin: `aws-lambda`, `api-gateway`, `aws-lambda-durable-functions`, `aws-serverless-deployment`
  - `databases-on-aws` plugin: `aurora-dsql`, `amazon-aurora-postgresql`, `amazon-aurora-mysql`, `creating-amazon-aurora-db-cluster-with-instances`
- **[antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill)** by Anton Babenko — source of the `terraform-skill` (Terraform / OpenTofu authoring, testing, CI, state, and security).
- **RAMP AI-DLC Starter Packs** (this repository, **MIT-0**) — authored testing skills: `web-test-automation` (web E2E/UI, Playwright-first) and `dotnet-testing` (.NET / C# unit & integration testing).

Skills are vendored (copied) into this pack so it works offline and pins a known-good version. Refer to the upstream repositories for the latest versions, additional skills, and their `LICENSE` and `NOTICE` files. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
