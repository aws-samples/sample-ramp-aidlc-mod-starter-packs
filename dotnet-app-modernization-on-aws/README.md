# .NET App Modernization on AWS — AI-DLC Starter Pack

A **tool-agnostic** starter pack for **modernizing .NET applications onto AWS**, built on the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Take an existing **.NET application** — typically **ASP.NET Framework on Windows/IIS** — and modernize it for AWS. The pack's default arc is:

**Reverse-engineer the legacy app → (optionally) run AWS Transform for .NET (Framework → Core) → stabilize the transformed app → externalize session state & configuration → containerize → deploy to Amazon ECS Fargate (Linux) → instrument with OpenTelemetry/ADOT → harden & review.**

This is a **brownfield-first** pack: because modernization assumes existing code, the workflow runs **Phase 0 (reverse engineering) by default**, and — uniquely — it will **ingest any pre-existing AWS Transform (ATX) analysis** it finds and fold it into the analysis rather than starting from scratch. It still degrades gracefully to a greenfield "reimagine" build when no prior code exists.

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
node installer/bin/ramp-pack.js init dotnet-app-modernization-on-aws --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. Update `AWS_PROFILE` in the generated MCP config (`mcp.json` / `.mcp.json`) for the AWS IaC MCP.
2. (Optional) If you have **AWS Transform / ATX** analysis for your app, drop it in the workspace (or note its path) — the reverse-engineering phase will detect and reuse it.
3. Open the project in your tool and start a conversation. Try:
   - *"I want to modernize this ASP.NET Framework app onto AWS ECS Fargate. Let's start the AI-DLC workflow."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow runs reverse engineering first (brownfield default), then creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## How the workflow works

Every phase is **decision-gated**: the agent writes a `_decisions-*.md`, waits for your input, then generates the matching spec document.

**Entry (always):**
1. Resume from `aidlc-docs/aidlc-state.md` if it exists.
2. Detect **brownfield vs greenfield**. Brownfield (this pack's default) → run Phase 0 reverse engineering first; greenfield reimagine → skip it.

**Phase 0 — Reverse Engineering (brownfield):**
- Ingests pre-existing **AWS Transform (ATX)** analysis if present, then scans the codebase.
- Captures .NET-specific modernization signals (target framework, IIS/`web.config`, Windows-only dependencies, session/state, config/secrets, auth).
- Produces analysis docs under `aidlc-docs/analysis/` (architecture, bounded contexts, modernization-readiness, etc.).

**Then the standard flow:**
```
Phase 1 Requirements → Phase 2 Design → Phase 3 Tasks (independent parallel waves) → execute
```
- **Phase 1** — modernization goals, cutover strategy, functional parity, NFRs, migration constraints.
- **Phase 2** — target architecture: transformation path, ECS compute, containerization, state/config externalization, data migration, IaC, observability, identity.
- **Phase 3** — an ordered task plan grouped into independent **waves** that can run in parallel.

**Invariants:** decision-file before every spec doc · real approval gates · skills/MCP activated before design & code · every decision appended to an append-only audit log; progress tracked for session resume.

## What's in this pack

```
dotnet-app-modernization-on-aws/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate which skill + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook + ATX ingest (companion, brownfield-first)
├── skills/                   # Vendored skills (see Skills + Credits below)
│   ├── dotnet-post-transform/  dotnet-aws-ecs/  dotnet-adot-sidecar/
│   ├── dotnet-aspnet-sessionstate-aws/  dotnet-aws-parameterstore/
│   ├── ecs-architect/  ecs-build/  ecs-devops/  ecs-observability/  ecs-security/
│   ├── ecs-recon/  ecs-operation-review/
│   ├── aws-cloudformation/  aws-iam/  aws-observability/  api-gateway/
│   ├── aurora-dsql/  amazon-aurora-postgresql/  amazon-aurora-mysql/
│   └── creating-amazon-aurora-db-cluster-with-instances/
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/  claude-code/  copilot/  cursor/
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### MCP servers

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior, resource shapes. |
| **Aurora DSQL** (`aurora-dsql`) | Validate Aurora DSQL schemas, connection patterns, and DSQL-specific semantics (for reimagine/greenfield data targets). |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validate CloudFormation resource properties and CDK constructs. Update `AWS_PROFILE` to your named profile. |

### Skills

Curated, domain-specific knowledge bundles the agent activates on demand. They follow the [Agent Skills open standard](https://agentskills.io/) (`<skill>/SKILL.md` + `references/`), so they copy verbatim into every supported tool. See [Credits & attribution](#credits--attribution) for sources and licensing.

| Skill | Activates when… | Source |
|---|---|---|
| `dotnet-post-transform` | Stabilizing a project just transformed by AWS Transform for .NET — build errors, DI wiring, static files, middleware | sample-appmod-skills |
| `dotnet-aws-ecs` | Deploying a .NET workload to ECS Fargate (Linux) with ALB — generates CloudFormation/CDK + deployment guide | sample-appmod-skills |
| `dotnet-adot-sidecar` | Adding OpenTelemetry/ADOT sidecar instrumentation to a containerized .NET app | sample-appmod-skills |
| `dotnet-aspnet-sessionstate-aws` | Externalizing ASP.NET session state to ElastiCache (Valkey/Redis) for horizontal scaling | sample-appmod-skills |
| `dotnet-aws-parameterstore` | Externalizing configuration/secrets to SSM Parameter Store / Secrets Manager | sample-appmod-skills |
| `ecs-architect` | Choosing the ECS deployment model (Fargate vs EC2 vs Managed Instances), task sizing, networking | sample-apex-skills |
| `ecs-build` | Generating apply-ready **Terraform** for ECS clusters/services/task definitions | sample-apex-skills |
| `ecs-devops` | ECS release strategy & CI/CD — blue/green, canary, rolling, circuit breaker, rollback | sample-apex-skills |
| `ecs-observability` | Selecting the ECS logs/metrics/traces stack (Container Insights, X-Ray, ADOT, Prometheus, FireLens) | sample-apex-skills |
| `ecs-security` | ECS security & compliance — task/execution roles, PassRole, secrets injection, GuardDuty, hardening | sample-apex-skills |
| `ecs-recon` | Read-only discovery/documentation of an existing ECS environment (pairs with Phase 0) | sample-apex-skills |
| `ecs-operation-review` | GREEN/AMBER/RED operational-excellence audit of a live ECS estate | sample-apex-skills |
| `aws-cloudformation` | Authoring/validating/troubleshooting raw CloudFormation templates | enterprise-app-on-cloudnative |
| `aws-iam` | IAM roles, trust policies, least-privilege; service/task/execution roles | enterprise-app-on-cloudnative |
| `aws-observability` | CloudWatch metrics/logs/alarms/dashboards, X-Ray, CloudTrail, ADOT, Application Signals (general) | enterprise-app-on-cloudnative |
| `api-gateway` | Fronting the modernized service with REST/HTTP/WebSocket APIs, authorizers, custom domains | enterprise-app-on-cloudnative |
| `aurora-dsql` | Aurora DSQL schemas, IAM auth, safe SQL construction (reimagine/greenfield data target) | enterprise-app-on-cloudnative |
| `amazon-aurora-postgresql` | Aurora PostgreSQL ops, Babelfish (SQL Server compat), ACU sizing, upgrade planning | enterprise-app-on-cloudnative |
| `amazon-aurora-mysql` | Aurora MySQL ops, ACU sizing, I/O-Optimized, upgrade planning | enterprise-app-on-cloudnative |
| `creating-amazon-aurora-db-cluster-with-instances` | Standing up a complete Aurora cluster + instances with Secrets Manager passwords | enterprise-app-on-cloudnative |

> **IaC mix — heads up:** the `dotnet-*` skills generate **CloudFormation or CDK**, while `ecs-build` generates **Terraform**. Pick one IaC tool per project and activate the matching skill; the workflow makes IaC-tool an explicit design decision. `ecs-recon` and `ecs-operation-review` were added beyond the core five ECS skills to round out the discover→…→review lifecycle — remove them if you don't need discovery/audit.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- An AWS profile configured (for the AWS IaC MCP and any live AWS operations).
- `uvx` / `npx` available on your PATH (used to launch the MCP servers).
- For the transformation path: [AWS Transform for .NET](https://aws.amazon.com/transform/) (optional but recommended for ASP.NET Framework → Core).

## Credits & attribution

The skills vendored in `skills/` are sourced from the following open-source projects. Full credit to their authors and maintainers:

- **[adisimon217/sample-appmod-skills](https://github.com/adisimon217/sample-appmod-skills)** — Application Modernization Agent Skills, licensed under the **MIT License**. Source of the .NET modernization skills: `dotnet-post-transform`, `dotnet-aws-ecs`, `dotnet-adot-sidecar`, `dotnet-aspnet-sessionstate-aws`, and `dotnet-aws-parameterstore`.
- **[aws-samples/sample-apex-skills](https://github.com/aws-samples/sample-apex-skills)** — APEX (Agentic Platform Engineering eXperience) skills by AWS, licensed under the **MIT-0 License**. Source of the ECS platform skills: `ecs-architect`, `ecs-build`, `ecs-devops`, `ecs-observability`, `ecs-security`, `ecs-recon`, and `ecs-operation-review`.
- The **data, identity, IaC, observability, and API** skills (`aws-cloudformation`, `aws-iam`, `aws-observability`, `api-gateway`, `aurora-dsql`, `amazon-aurora-postgresql`, `amazon-aurora-mysql`, `creating-amazon-aurora-db-cluster-with-instances`) are the same tool-agnostic skills used by the sibling [`enterprise-app-on-cloudnative`](../enterprise-app-on-cloudnative/) pack, originally sourced from **[aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws)** and **[awslabs/agent-plugins](https://github.com/awslabs/agent-plugins)** (Apache License 2.0). See that pack's README for detailed per-skill provenance.

Skills are vendored (copied) into this pack so it works offline and pins a known-good version. Refer to the upstream repositories for the latest versions, additional skills, and their `LICENSE` / `NOTICE` files. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
