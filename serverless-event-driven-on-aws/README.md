# Serverless Event-Driven on AWS — AI-DLC Starter Pack

A **tool-agnostic** starter pack for building **event-driven, serverless systems on AWS** — real-time data streaming, event-sourced notifications, and third-party integration services — driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-gated workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Event-driven systems that process real-time data streams, match subscriptions against events, and trigger downstream actions (notifications, order execution, state updates). The pack's **default lean is serverless + managed streaming — Amazon MSK, AWS Lambda, Amazon EventBridge, ECS/Fargate, and DynamoDB** — but it ships the full event-driven skill set (stream processing, containers, CDK, IAM, observability), so the design phase can flex the architecture to fit your domain. This is a **single-repo or multi-repo** pack depending on how many use cases you target.

Supports **greenfield** (new event-driven system) and **brownfield** (existing POC or legacy system to productionise). When existing source is present the workflow runs Phase 0 (reverse engineering) first.

### Example scenarios

- Real-time market data processing (MSK → stream processor → action)
- Event-driven push notifications (subscribe → match → deliver)
- Third-party API integration with event-sourced state (external protocol gateways, REST, WebSocket)
- Subscription matching engines (price thresholds, conditional triggers)
- Multi-channel notification delivery (push, email, SMS, in-app)

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
node installer/bin/ramp-pack.js init serverless-event-driven-on-aws --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Update `AWS_PROFILE` in the generated MCP config (`mcp.json` / `.mcp.json`) for the AWS IaC MCP.
2. Open the project in your tool and start a conversation. Try:
   - *"I want to build a real-time event-driven notification system — market data stream to push alerts within 60 seconds. Let's start the AI-DLC workflow."*
   - *"I have an existing MSK POC for market data. Help me productionise it with subscription matching and notification delivery."*
   - *"Build a third-party integration — route requests to an external service gateway with validation and status tracking."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## How the workflow works

Every phase is **decision-gated**: the agent writes a `_decisions-*.md`, waits for your input, then generates the matching spec document.

**Entry (always):**
1. Resume from `aidlc-docs/aidlc-state.md` if it exists.
2. Detect **greenfield vs brownfield**. Greenfield → skip Phase 0. Brownfield → run reverse-engineering first.

**Then the standard flow:**
```
Phase 1 Requirements → Phase 2 Design → Phase 3 Tasks (independent parallel waves) → execute
```
- **Phase 1** — user stories + acceptance criteria, functional & non-functional requirements.
- **Phase 2** — architecture, data model, API contracts, sequence diagrams (Mermaid), cross-cutting concerns.
- **Phase 3** — an ordered task plan grouped into independent **waves** that can run in parallel.

**Quality shaped in at every gate:** each decision file surfaces **both** the phase's primary decisions **and** its testability/quality decisions — Phase 1 pairs Product scope with Testability (a test-per-requirement + Definition of Done), Phase 2 pairs Architecture with a Test Architecture (contract tests per seam + CI merge gate), and Phase 3 makes test sequencing an explicit choice (same-wave-as-code recommended). So testing is designed in, not bolted on at the end.

**Practices Discovery:** On first run, a lightweight team-practices capture exercise grounds the AI in your conventions (tech stack, testing posture current→target, coding standards, compliance constraints).

**Invariants:** decision-file before every spec doc · real approval gates · skills/MCP activated before design & code · every decision appended to an append-only audit log; progress tracked for session resume.

## What's in this pack

```
serverless-event-driven-on-aws/
├── pack.yaml                     # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/                 # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md           # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md         # When to activate which skill + MCP (companion, always)
│   ├── practices-discovery.md      # Team context capture, run once before Phase 1 (companion, auto)
│   └── reverse-engineering.md      # Phase 0 playbook (companion, brownfield-only)
└── skills/                       # AWS + patterns + testing skills (see Skills below)
    ├── aws-event-driven-patterns/    aws-messaging-and-streaming/  amazon-dynamodb/
    ├── aws-lambda/                    aws-lambda-durable-functions/ aws-containers/
    ├── api-gateway/                   aws-cdk/                      aws-cloudformation/
    ├── terraform-skill/               aws-serverless-deployment/    aws-iam/
    ├── aws-observability/             signing-in-to-aws/
    └── web-test-automation/           mobile-test-automation/       dotnet-testing/
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*` `applyTo: '**'` | `.mdc` `alwaysApply: false` |
| `practices-discovery` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### MCP servers

Declared once in `pack.yaml`; the installer writes them to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior, and resource shapes. |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validate CDK constructs, CloudFormation resource properties, and IaC patterns. Update `AWS_PROFILE` to your named profile. |

### Skills

Curated, domain-specific knowledge bundles the agent activates on demand — spanning **streaming, compute, eventing, data, identity, and operations**. They follow the [Agent Skills open standard](https://agentskills.io/) (`<skill>/SKILL.md` + `references/`).

| Skill | Activates when… | Source |
|---|---|---|
| `aws-event-driven-patterns` | Event-driven **composition & decisions** — pattern selection, MSK topic/partition strategy, Flink-vs-Lambda-vs-ECS stream processing, subscription matching, external-integration order lifecycle, idempotency/effectively-once, event-driven observability, CDK stack decomposition. Load first for any event-driven design. | RAMP AI-DLC Starter Packs |
| `aws-messaging-and-streaming` | Kafka/MSK topics & partitions, EventBridge buses/rules/Pipes, SNS/SQS fan-out & DLQ, Kinesis, Managed Flink — the streaming & eventing authority for this pack | agent-toolkit-for-aws |
| `amazon-dynamodb` | Subscription store, alert/order state, single-table design, GSIs, Streams, TTL, idempotency, cost model | agent-toolkit-for-aws |
| `aws-lambda` | Lambda handlers, event sources (MSK/SQS/EventBridge), Powertools, stream consumers | agent-plugins |
| `aws-lambda-durable-functions` | Order saga, settlement tracking, long-running transaction/order lifecycle — wait/callback, compensation | agent-plugins |
| `aws-containers` | ECS/Fargate for long-running services (notification service, integration gateway, WebSocket) | agent-toolkit-for-aws |
| `api-gateway` | REST/HTTP/WebSocket APIs (order placement, holdings, real-time price feed), authorizers, throttling | agent-plugins |
| `aws-cdk` | CDK TypeScript stacks, construct patterns — the default IaC for this pack | agent-toolkit-for-aws |
| `aws-cloudformation` | Authoring/validating raw CloudFormation (situational, alongside CDK) | agent-toolkit-for-aws |
| `terraform-skill` | Terraform/OpenTofu modules & CI (situational, if HCL IaC is used) | agent-toolkit-for-aws |
| `aws-serverless-deployment` | SAM / serverless-CDK packaging, aliases, traffic shifting, deploy | agent-plugins |
| `aws-iam` | Least-privilege roles, trust policies, service/execution roles | agent-toolkit-for-aws |
| `aws-observability` | CloudWatch metrics/logs/alarms, X-Ray tracing, Application Signals (delivery latency, alert SLOs) | agent-toolkit-for-aws |
| `signing-in-to-aws` | Local CLI/SDK credential resolution | agent-toolkit-for-aws |
| `web-test-automation` | Playwright E2E/UI tests, POM patterns, accessibility, CI sharding (web) | agent-plugins |
| `mobile-test-automation` | Appium/Maestro/Detox/Espresso/XCUITest — push-notification app testing, device farms (mobile) | agent-plugins |
| `dotnet-testing` | Authoring .NET/C# tests — xUnit, Moq, coverlet, WebApplicationFactory/Testcontainers, test-pyramid strategy, `dotnet test` CI gating (backend) | RAMP AI-DLC Starter Packs |

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- An AWS account with permissions for MSK, Lambda, EventBridge, DynamoDB, ECS, and CDK deploys.
- *(Brownfield)* Your existing POC or codebase in the workspace for reverse engineering.

## License

Sample code, licensed under MIT-0. See the repository [`LICENSE`](../LICENSE). Skill content is distilled from official AWS documentation; see each `SKILL.md` for attribution. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
