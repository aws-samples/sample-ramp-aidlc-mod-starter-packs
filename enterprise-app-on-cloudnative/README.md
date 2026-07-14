# Enterprise App on Cloud-Native — AI-DLC Starter Pack

A **tool-agnostic** starter pack for **greenfield** development of a cloud-native **enterprise application** — a line-of-business or transactional system (e.g. order management, case management, a customer/operator portal) — built with the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Greenfield build of an end-to-end business workflow, suitable for a working demo. The pack's **default lean is serverless — AWS Lambda + Amazon API Gateway + Aurora DSQL** — but it ships the **full cloud-native skill set** (containers, multiple Aurora engines, CDK / CloudFormation / Terraform, IAM, observability), so the design phase can flex the stack to fit your domain. This is a **single-repo** pack: one workspace, one spec lifecycle. Greenfield is the default; if existing source is present the workflow runs Phase 0 (reverse engineering) first.

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
2. Detect **greenfield vs brownfield**. Greenfield (this pack's default) → skip Phase 0. Brownfield → run reverse-engineering first.

**Then the standard single-repo flow:**
```
Phase 1 Requirements → Phase 2 Design → Phase 3 Tasks (independent parallel waves) → execute
```
- **Phase 1** — user stories + acceptance criteria, functional & non-functional requirements.
- **Phase 2** — architecture, data model, API contracts, sequence diagrams (Mermaid), cross-cutting concerns.
- **Phase 3** — an ordered task plan grouped into independent **waves** that can run in parallel.

**Invariants:** decision-file before every spec doc · real approval gates · skills/MCP activated before design & code · every decision appended to an append-only audit log; progress tracked for session resume.

## What's in this pack

```
enterprise-app-on-cloudnative/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate which skill + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, brownfield-only)
├── skills/                   # Vendored AWS skills (see Skills + Credits below)
│   ├── aws-lambda/            api-gateway/            aws-lambda-durable-functions/
│   ├── aws-serverless-deployment/  aws-containers/    aws-cdk/
│   ├── aws-cloudformation/    terraform-skill/        aws-iam/
│   ├── aws-observability/     signing-in-to-aws/      aurora-dsql/
│   ├── amazon-aurora-postgresql/   amazon-aurora-mysql/
│   └── creating-amazon-aurora-db-cluster-with-instances/
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

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- An AWS profile configured (for the AWS IaC MCP; also used by the `signing-in-to-aws` / Aurora skills for live AWS operations).
- `uvx` / `npx` available on your PATH (used to launch the MCP servers).

## Credits & attribution

The skills vendored in `skills/` are sourced from three open-source projects, all licensed under **Apache License 2.0**. Full credit to their authors and maintainers:

- **[aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws)** — `aws-core` plugin. Source of the compute, IaC, identity, and operations skills: `aws-containers`, `aws-cdk`, `aws-cloudformation`, `aws-iam`, `aws-observability`, and `signing-in-to-aws`.
- **[awslabs/agent-plugins](https://github.com/awslabs/agent-plugins)** — Agent Plugins for AWS. Source of the serverless and database skills:
  - `aws-serverless` plugin: `aws-lambda`, `api-gateway`, `aws-lambda-durable-functions`, `aws-serverless-deployment`
  - `databases-on-aws` plugin: `aurora-dsql`, `amazon-aurora-postgresql`, `amazon-aurora-mysql`, `creating-amazon-aurora-db-cluster-with-instances`
- **[antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill)** by Anton Babenko — source of the `terraform-skill` (Terraform / OpenTofu authoring, testing, CI, state, and security).

Skills are vendored (copied) into this pack so it works offline and pins a known-good version. Refer to the upstream repositories for the latest versions, additional skills, and their `LICENSE` and `NOTICE` files. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
