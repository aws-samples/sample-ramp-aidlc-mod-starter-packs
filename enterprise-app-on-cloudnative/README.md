# Enterprise App on Cloud-Native — AI-DLC Starter Pack

A pre-configured Kiro workspace for **greenfield** development of a cloud-native **enterprise application** — a line-of-business or transactional system (e.g. order management, case management, a customer/operator portal) — built with the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Greenfield build of an end-to-end business workflow, suitable for a working demo. The pack's **default lean is serverless — AWS Lambda + Amazon API Gateway + Aurora DSQL** — but it ships the **full cloud-native skill set** (containers, multiple Aurora engines, CDK / CloudFormation / Terraform, IAM, observability), so the design phase can flex the stack to fit your domain. This is a **single-repo** pack: one workspace, one spec lifecycle. Because there is no existing source, the workflow skips Phase 0 (reverse engineering) and starts at requirements.

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
├── .kiro/
│   ├── steering/                       # Agent steering rules
│   │   ├── aidlc-decisions-workflow.md     # Decision-gated Requirements → Design → Tasks (single-repo)
│   │   ├── reverse-engineering.md          # Phase 0 playbook (auto-loads only for brownfield)
│   │   └── skill-power-mcp-activation.md   # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge + Aurora DSQL + AWS IaC MCP
│   ├── skills/                         # Vendored AWS skills (see Skills + Credits below)
│   │   ├── aws-lambda/
│   │   ├── api-gateway/
│   │   ├── aws-lambda-durable-functions/
│   │   ├── aws-serverless-deployment/
│   │   ├── aws-containers/
│   │   ├── aws-cdk/
│   │   ├── aws-cloudformation/
│   │   ├── terraform-skill/
│   │   ├── aws-iam/
│   │   ├── aws-observability/
│   │   ├── signing-in-to-aws/
│   │   ├── aurora-dsql/
│   │   ├── amazon-aurora-postgresql/
│   │   ├── amazon-aurora-mysql/
│   │   └── creating-amazon-aurora-db-cluster-with-instances/
│   └── specs/                          # Created during the workflow
└── aidlc-docs/                         # Created during the workflow (progress tracker + audit log)
```

### Steering

| File | What it does |
|---|---|
| `aidlc-decisions-workflow.md` | The decision-gated **single-repo** workflow. `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` you complete before the agent writes the final document. Tasks are generated as independent parallel groups (waves). |
| `reverse-engineering.md` | Phase 0 playbook for analyzing an existing codebase. Auto-loads only for brownfield work; skipped for this greenfield pack. |
| `skill-power-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when — including during design and decision phases, not just code execution. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior, and resource shapes. |
| **Aurora DSQL** (`aurora-dsql`) | Validate Aurora DSQL schemas, connection patterns, and DSQL-specific semantics. |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validate CDK constructs, CloudFormation resource properties, and IaC patterns. Update `AWS_PROFILE` to your named profile. |

### Skills

Curated, domain-specific knowledge bundles the agent activates on demand — spanning **compute, IaC, data, identity, and operations**, so the pack covers both the serverless default and container/multi-engine alternatives. See [Credits & attribution](#credits--attribution) for sources and licensing.

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

## Getting started

1. Open this folder in Kiro.
2. Update `AWS_PROFILE` in `.kiro/settings/mcp.json` for the AWS IaC MCP.
3. Start a conversation. Try:
   - *"I want to build a cloud-native enterprise app — [describe your domain and core workflow]. Let's start the AI-DLC workflow."*
   - *"Create a spec for the [core business] flow."*

The workflow will create `_decisions-requirements.md` and wait for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. Both the `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- An AWS profile configured (for the AWS IaC MCP; also used by the `signing-in-to-aws` / Aurora skills for live AWS operations)
- `uvx` / `npx` available on your PATH (used to launch the MCP servers)

## Credits & attribution

The skills vendored in `.kiro/skills/` are sourced from three open-source projects, all licensed under **Apache License 2.0**. Full credit to their authors and maintainers:

- **[aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws)** — `aws-core` plugin. Source of the compute, IaC, identity, and operations skills: `aws-containers`, `aws-cdk`, `aws-cloudformation`, `aws-iam`, `aws-observability`, and `signing-in-to-aws`.
- **[awslabs/agent-plugins](https://github.com/awslabs/agent-plugins)** — Agent Plugins for AWS. Source of the serverless and database skills:
  - `aws-serverless` plugin: `aws-lambda`, `api-gateway`, `aws-lambda-durable-functions`, `aws-serverless-deployment`
  - `databases-on-aws` plugin: `aurora-dsql`, `amazon-aurora-postgresql`, `amazon-aurora-mysql`, `creating-amazon-aurora-db-cluster-with-instances`
- **[antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill)** by Anton Babenko — source of the `terraform-skill` (Terraform / OpenTofu authoring, testing, CI, state, and security).

Skills are vendored (copied) into this pack so it works offline and pins a known-good version. Refer to the upstream repositories for the latest versions, additional skills, and their `LICENSE` and `NOTICE` files. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
