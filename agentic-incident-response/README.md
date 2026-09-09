# Agentic Incident Response & Production Support on AWS — AI-DLC Starter Pack

A **tool-agnostic** starter pack for **designing, building, and deploying a governed, agentic AI
production-support and incident-analysis capability on AWS serverless**, built on the **AI-Driven Development
Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and
Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured,
decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Production-support work arrives through monitoring alerts, incident tickets, user/client reports, chats, and
calls — and the quality and speed of the first response depends on the right application expert being
available 24/7. Replace that bottleneck with a **deployed AWS pipeline** that does the first-response analysis
automatically:

**Ingest an incident ticket or monitoring alert → normalize it into a uniform incident record → identify the
affected application/business flow → retrieve & correlate evidence (logs, telemetry, traces, source-code
context, configuration, deployment history, dependency status, known issues) → generate an incident summary
with evidence-backed, confidence-rated root-cause hypotheses, impacted components, recommended
diagnostic/remediation steps, and routing/escalation guidance** — for human review. It also supports
proactive, rule/threshold-based **anomaly detection** that raises alerts or creates incidents.

This is a **build-and-deploy** pack: the AI-DLC workflow guides you through Requirements → Design → Tasks to
**produce and deploy the pipeline itself** on AWS serverless. The reusable domain logic ships as skills;
the pipeline's AWS *architecture* — trigger, orchestration, reasoning model, and IaC — is decided at design
gates, not assumed. The pipeline **proposes; humans approve** — no state-changing production action executes
without an explicit human gate, and every decision lands in a durable audit trail. Supports **greenfield** (new
capability) and **brownfield** grounding (Phase 0 reverse-engineering builds the flow-to-component map from the
monitored application's source).

## How the pieces fit

- **The workflow** (`aidlc-workflow.md`) is the standard, generic AI-DLC decision-gated workflow used across
  these starter packs — greenfield/brownfield detection, then Requirements → Design → Tasks with approval
  gates. The pipeline you build is the *output* of that workflow.
- **The domain skills** encode *what the pipeline does*. The agent uses them to design the pipeline's triage, analysis, and anomaly-detection stages and to author the
  Lambda/Bedrock logic that automates them.
- **The AWS skills** are the *building blocks* used to construct and deploy the pipeline on serverless.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the folder for
your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout
into your target project:

```bash
node installer/bin/ramp-pack.js init agentic-incident-response --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite. Option B always works even if `scaffolded-packs/` is
missing or out of date — the neutral source is the single source of truth.

### Then

1. The **AWS Knowledge MCP** (default-on) needs no credentials — it validates AWS service behavior, limits,
   and regional availability while you design and build the pipeline.
2. **Integrations with your ticketing/chat/monitoring systems are engagement-specific** — add your
   organization's approved MCP servers (or API integrations) at the Design gate.
3. **(Optional)** If you choose **Terraform** as your IaC path at the design gate, set up Terraform tooling so
   the agent has live provider/module knowledge — see [Terraform tooling](#terraform-tooling) below.
4. Open the project in your tool and start a conversation. On Claude Code / Copilot you can also run the
   **`/aidlc`** command.

## Kickoff prompt

> *"Help me build and deploy a governed, agentic incident-response and production-support capability on AWS
> serverless. It should ingest incident tickets and monitoring alerts, identify the affected business flow,
> correlate evidence (logs, metrics, traces, deployments, config, dependencies, known issues), and produce
> evidence-backed, confidence-rated root-cause hypotheses with recommended actions and routing — always with
> human review before any production action. Start the AI-DLC workflow: take me through Requirements, then
> Design (ask me about the trigger model, orchestration, reasoning model, and IaC), then Tasks — with the
> decision gates."*

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md` —
the same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`;
progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions.

## What's in this pack

```
agentic-incident-response/
├── pack.yaml                         # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/                     # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md                 # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md               # When to activate skills + MCP (companion, always)
│   └── reverse-engineering.md            # Phase 0 playbook (companion, auto — brownfield grounding)
├── skills/
│   ├── incident-triage/              # DOMAIN: intake → flow ID → evidence correlation → RCA → routing
│   ├── aws-event-driven-patterns/        # Event-driven composition (intake/alerting side)
│   ├── aws-messaging-and-streaming/      # EventBridge, SNS/SQS, Kafka/MSK — pipeline + platform signals
│   ├── aws-lambda/                       # Lambda functions for each pipeline stage
│   ├── aws-lambda-durable-functions/     # Durable, checkpointed Lambda execution (orchestration option)
│   ├── aws-step-functions/               # State-machine orchestration + human-approval task-token state
│   ├── api-gateway/                      # Webhook ingress (ticketing/chat triggers)
│   ├── aws-serverless-deployment/        # SAM/CDK scaffolding & deployment (default IaC)
│   ├── terraform-skill/                  # Terraform IaC (alternative path)
│   ├── aws-iam/                          # Least-privilege + cross-account read-only evidence access
│   └── aws-observability/                # CloudWatch/X-Ray — instrument the pipeline & query evidence
└── scaffolded-packs/                 # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is
> **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the
> scaffolded output.

### Instructions

- **`aidlc-workflow.md`** (primary) — the generic AI-DLC decision-gated workflow (Requirements → Design →
  Tasks with approval gates), same as the other starter packs.
- **`skill-activation.md`** (always) — when to activate which skill + the MCP servers.
- **`reverse-engineering.md`** (auto) — Phase 0 reverse-engineering playbook for brownfield grounding (e.g.
  building the flow-to-component map from the monitored application's source).

### Skills

**Domain logic — what the pipeline does:**

| Skill | Activates when… |
|---|---|
| `incident-triage` | Interpreting an incident ticket or monitoring alert, identifying the affected business flow, correlating the seven evidence classes, producing ranked evidence-backed root-cause hypotheses with confidence indicators, and recommending diagnostics, remediation candidates, and routing/escalation — the pipeline's **triage**, **analysis**, and proactive **anomaly-detection** stages |

**AWS building blocks — how the pipeline is built & deployed:**

| Skill | Used for |
|---|---|
| `aws-event-driven-patterns` | Event-driven composition for the intake/alerting side (fan-out, idempotency, effectively-once processing) |
| `aws-messaging-and-streaming` | EventBridge (rules/thresholds → alerts or incident creation), SNS/SQS (notifications, work queues, DLQs), Kafka/MSK + RabbitMQ concepts (pipeline + monitored-platform signals) |
| `aws-lambda` | The Lambda functions for each pipeline stage (intake, evidence retrieval, analysis, report/routing) |
| `aws-lambda-durable-functions` | Durable, checkpointed Lambda execution for long-running/stateful stages (distinct from Step Functions) |
| `aws-step-functions` | State-machine orchestration across stages, with retries, branching, and a manual-approval (task-token) state for the human-review gate |
| `api-gateway` | HTTP ingress when the trigger is a ticketing/chat webhook |
| `aws-serverless-deployment` | SAM/CDK scaffolding and deployment (default IaC path) |
| `terraform-skill` | Terraform IaC (alternative path — pick one at the IaC design gate) |
| `aws-iam` | Least-privilege roles and cross-account **read-only** access to the monitored platform's CloudWatch/logs |
| `aws-observability` | CloudWatch/X-Ray logs, metrics, traces, and alarms — to instrument the pipeline and design the evidence-retrieval and anomaly-detection queries |

> Trigger model, orchestration (durable functions vs. Step Functions), reasoning model, and IaC (SAM/CDK vs.
> Terraform) are **design-gate decisions** — the workflow asks; nothing is assumed.

### MCP servers

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, service limits, regional availability, and recommendations — used proactively while designing and building on AWS. Default-on, no credentials. |

## Terraform tooling

SAM/CDK is the default IaC path; **Terraform is the alternative** (chosen at the IaC design gate, backed by
the `terraform-skill`). If you pick it, give your agent live Terraform provider/module knowledge:

- **Kiro** — install the HashiCorp **Terraform power**: open the **Powers panel** (👻⚡), search **"Terraform"**
  by HashiCorp → **Install** → **Confirm** (or from the web: <https://kiro.dev/powers/hashicorp/terraform>).
  Requires Kiro signed in and Docker running.
- **Claude Code / Copilot / Cursor** — add the HashiCorp **Terraform MCP server**
  ([`hashicorp/terraform-mcp-server`](https://github.com/hashicorp/terraform-mcp-server)) to your tool's MCP
  config. It runs as a Docker image, e.g.:
  ```json
  {
    "mcpServers": {
      "terraform": { "command": "docker", "args": ["run", "-i", "--rm", "hashicorp/terraform-mcp-server"] }
    }
  }
  ```
  (Copilot uses the `servers` key instead of `mcpServers`.) The agent then searches Terraform provider docs and
  modules. Requires Docker running.

The AWS Knowledge MCP (included) still validates the AWS resource shapes regardless of the IaC tooling you choose.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor —
  installed and signed in.
- An **AWS account** and credentials for deploying the pipeline (an `AWS_PROFILE` or equivalent).
- **(Brownfield grounding only)** access to the monitored application's source and its
  CloudWatch/observability data (read-only) so Phase 0 can build the flow-to-component map.
- **Option B (installer) only:** Node.js 18+.
- `npx` available on your PATH (used to launch the AWS Knowledge MCP).
- *(If you choose the Terraform IaC path)* Docker installed and running — for the Kiro Terraform power or the
  HashiCorp Terraform MCP server (see [Terraform tooling](#terraform-tooling)).

> **Important:** This is sample code for demonstration and non-production usage. Work with your security and
> legal teams to meet your organizational security, regulatory, and compliance requirements before any
> production deployment. Evidence access to production observability data should be **read-only and
> least-privilege** (see the `aws-iam` skill); incident evidence in financial systems contains PII — mask
> identifiers in reports and keep raw data inside approved boundaries. The pipeline never executes
> state-changing production remediation autonomously; the human-approval gate is a hard requirement, not a
> configuration default.
