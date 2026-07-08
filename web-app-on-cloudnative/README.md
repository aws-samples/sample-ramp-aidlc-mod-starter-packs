# Web App on Cloud-Native — AI-DLC Starter Pack

A pre-configured Kiro workspace for building a **multi-tier web application** — one or more single-page apps (SPAs) fronted by their own backends-for-frontend (BFFs), talking to a shared domain service — on AWS cloud-native compute, using the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

An end-to-end **SPA + BFF** web platform: multiple frontend experiences (e.g. **Consumer / Cashier / Backoffice**), each backed by its own BFF, sharing a common **domain engine** and identity provider. A typical shape: a **Backoffice** app configures and manages the domain, a **Consumer** app drives the primary end-user journey, and a **Cashier** app handles point-of-service actions — all over one shared domain engine.

The pack is deliberately **stack-flexible**:

- **Compute** — containers (**Amazon ECS / AWS Fargate**) *or* serverless (**AWS Lambda + API Gateway**). The design phase decides which per component.
- **Data** — **Amazon Aurora** (PostgreSQL or MySQL) or **Aurora DSQL**, with an optional cache (e.g. Valkey/Redis).
- **IaC** — **Terraform / OpenTofu**, **AWS CDK**, or **CloudFormation**.
- **Identity** — bring-your-own IdP (e.g. Keycloak, Amazon Cognito).
- **Repos** — anywhere on the **monorepo → multi-repo** spectrum (single repo, workspaces, domain-grouped repos, or one repo per SPA/BFF). See [Repo model](#repo-model-monorepo--multi-repo).

It works for **greenfield** builds and **brownfield** extensions alike — when an existing codebase is present, the workflow runs a reverse-engineering pass (Phase 0) first.

## What's in this pack

```
web-app-on-cloudnative/
├── .kiro/
│   ├── steering/                       # Agent steering rules (always-on core + auto-loaded playbooks)
│   │   ├── aidlc-decisions-workflow.md     # Decision-gated Requirements → Design → Tasks
│   │   ├── multi-repo-projects.md          # Repo-model gate + contract-first multi-repo spec-splitting
│   │   ├── reverse-engineering.md          # Phase 0 playbook (used only for brownfield)
│   │   └── skill-power-mcp-activation.md   # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge MCP
│   ├── skills/                         # Vendored AWS skills (see Skills + Credits below)
│   │   ├── aws-containers/
│   │   ├── aws-cdk/
│   │   ├── aws-cloudformation/
│   │   ├── terraform-skill/
│   │   ├── aws-iam/
│   │   ├── aws-observability/
│   │   ├── signing-in-to-aws/
│   │   ├── aws-lambda/
│   │   ├── api-gateway/
│   │   ├── aws-lambda-durable-functions/
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
| `aidlc-decisions-workflow.md` | The decision-gated workflow. `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file you complete before the agent writes the final document. Tasks are generated as independent parallel groups (waves). Points to `multi-repo-projects.md` when a project spans repos. |
| `multi-repo-projects.md` | The **repo-model decision gate** (monorepo → polyrepo) and the **contract-first multi-repo flow** — capture system-level requirements → high-level design (contracts + topology) once, then **split** into derived per-repo specs and fan out. Includes contract tiers, blast-radius rules, and directory conventions. |
| `reverse-engineering.md` | Phase 0 playbook for analyzing an existing codebase. Used for brownfield work (e.g. extending an already-built domain engine), skipped for greenfield. |
| `skill-power-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when — including during design and decision phases, not just code execution. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior, and resource shapes when authoring IaC. |

> This pack ships with just the AWS Knowledge MCP (remote, no credentials needed). The skills drive the standard CLIs (`cdk`, `cfn-lint`, `cfn-guard`, `aws`, `psql`) directly, so no service-specific MCP is required. If you want live CDK/CloudFormation resource-property validation, add the [AWS IaC MCP](https://awslabs.github.io/mcp/); for Aurora DSQL interaction, add the `awslabs.aurora-dsql-mcp-server`.

### Skills

Skills are curated, domain-specific knowledge bundles the agent activates on demand. This pack vendors skills across four areas — **compute**, **infrastructure-as-code**, **data**, and **operations/identity** — so it can cover both container and serverless paths. See [Credits & attribution](#credits--attribution) for sources and licensing.

| Skill | Activates when… | Source |
|---|---|---|
| `aws-containers` | Deploying/operating containers on ECS, Fargate, ECR — task definitions, ALB integration, scaling, ECS Exec debugging | agent-toolkit-for-aws |
| `aws-cdk` | Authoring/deploying CDK stacks (TypeScript/Python), construct patterns, safe refactors, drift, imports | agent-toolkit-for-aws |
| `aws-cloudformation` | Authoring/validating/troubleshooting raw CloudFormation templates | agent-toolkit-for-aws |
| `terraform-skill` | Writing/reviewing/debugging **Terraform / OpenTofu** — modules, tests, CI, state ops, security scans; diagnoses identity churn, drift, and blast radius | antonbabenko/terraform-skill |
| `aws-iam` | Writing IAM roles, trust policies, least-privilege policies; service/execution roles | agent-toolkit-for-aws |
| `aws-observability` | CloudWatch metrics/logs/alarms/dashboards, X-Ray, CloudTrail, ADOT, Application Signals onboarding | agent-toolkit-for-aws |
| `signing-in-to-aws` | Getting local CLI/SDK credentials via `aws login`; expired/missing credential errors | agent-toolkit-for-aws |
| `aws-lambda` | Designing/authoring Lambda handlers, event sources, Powertools (serverless compute path) | agent-plugins |
| `api-gateway` | Designing/wiring REST / HTTP / WebSocket APIs, authorizers, custom domains | agent-plugins |
| `aws-lambda-durable-functions` | Stateful workflows, approval routing, long-running/saga processes | agent-plugins |
| `aurora-dsql` | Aurora DSQL schemas, IAM auth, safe SQL construction, MySQL→DSQL migration | agent-plugins |
| `amazon-aurora-postgresql` | Aurora PostgreSQL cluster ops, express configuration, ACU sizing, upgrade planning | agent-plugins |
| `amazon-aurora-mysql` | Aurora MySQL cluster ops, ACU sizing, I/O-Optimized, upgrade planning | agent-plugins |
| `creating-amazon-aurora-db-cluster-with-instances` | Standing up a complete Aurora cluster + instances with Secrets Manager passwords | agent-plugins |

## How the workflow works

Every project is **decision-gated**: the agent writes a `_decisions-*.md`, waits for your input, then generates the matching spec document. Two shapes come out of one entry routing.

**Entry (always):**
1. Resume from `aidlc-state.md` if it exists.
2. Detect **greenfield vs brownfield**. Brownfield → run **system-level reverse-engineering first** (it feeds topology + contracts).
3. Set **spec placement** + a *provisional* mono-vs-multi lean; **defer the detailed repo topology** until after requirements.

**Single-repo / monorepo** — the standard flow, each phase gated by a `_decisions-*.md`:
```
Phase 1 Requirements → Phase 2 Design → Phase 3 Tasks (parallel waves) → execute
```

**Multi-repo (domain-grouped or polyrepo) — "capture the whole, then split":**
```
LEVEL 1 — SYSTEM (once, up front)
  S1  System Requirements    (= Phase 1, whole system)
        intent · personas · user stories + acceptance criteria ·
        units of work · cross-cutting NFRs               → approval gate
  S2  System High-Level Design   (= Phase 2, whole system)
        architecture · CONTRACT CATALOG (two-tier freeze) ·
        repo topology (unit → repo) · auth ·
        publish shared contracts = WAVE 0                → approval gate
  S3  Split — the agent decomposes S1+S2 into per-repo slices
        (the stories/ACs each repo owns + its contract obligations)  → confirm
             │
LEVEL 2 — PER REPO (fan-out, in parallel)
  S4  each repo, on its slice:  Requirements → Design → Tasks
        (derived, so substantive; per-repo decisions cover only local concerns)
  S5  contract-driven build:  Wave 0 contracts → repos build in parallel
        (contract tests) → integration wave (end-to-end across repos)
```

- **Topology is decided in S2, after S1** — it follows the bounded contexts (from RE) + overall requirements; never guessed up front.
- **State & audit are per level:** `aidlc-docs/_platform/` for the shared S0–S3 phases, and a separate `aidlc-docs/<repo>/` per sub for its S4 work — so parallel branches never collide. At **hand-off**, a squad copies its `.kiro/specs/<repo>/` + `aidlc-docs/<repo>/` into its own code repo.

**Invariants across all paths:** decision-file before every spec doc · real approval gates · **contract-first, decide-once** (per-repo specs are derived slices that consume shared contracts, never redefine them; changes routed by blast radius) · everything tracked in state + append-only audit.

## Repo model (monorepo → multi-repo)

The repo model is a **decision gate**, not a hardcoded assumption — the workflow adapts to whatever you choose, so you don't need to settle it before opening the pack. It covers the full spectrum: **monorepo**, **monorepo with workspaces** (Nx/Turborepo/Gradle), **domain-grouped repos** (e.g. `consumer`=SPA+BFF, `cashier`, `backoffice`, `engine`, `contracts`), or **repo-per-component** (polyrepo). For small, tightly-coupled teams the workflow leans toward monorepo or a few domain-grouped repos; polyrepo is reserved for many-team / compliance / independent-cadence cases.

The core risk once you split is **contract drift**: independent repos evolve APIs/types (and intent) out of sync, and per-repo specs come out thin. The workflow addresses this by **capturing the whole system once, then splitting it** — a **contract-first, decide-once** flow that applies to *every* model (only the contract *mechanism* differs: an in-repo shared package for monorepos, changed atomically; a versioned published artifact for multi-repo, changed with coordination):

1. **System-level requirements → high-level design** (run once, up front). First the **System Requirements** (the normal Phase 1, whole-system: intent, user stories + acceptance criteria, units of work, cross-cutting NFRs). Then the **System High-Level Design** (the normal Phase 2, whole-system: architecture, the **contract catalog** engine↔BFF / BFF↔SPA, **repo topology** unit→repo, auth). Shared contracts are published = **Wave 0**.
2. **Split into per-repo slices** — Kiro **decomposes** the system requirements + design into each repo's slice (the user stories/ACs it owns + the contracts it consumes/publishes). Per-repo specs are **derived** from this slice, so they're substantive, not thin — and they never redefine a shared contract.
3. **Per-repo detailed specs + contract-driven parallel build** — each repo runs detailed `requirements → design → tasks` on its slice; repos build in parallel against the frozen contract (Wave 0), with an integration wave at the end.

The agent presents the repo-model gate (and, for multi-repo, spec placement and contract ownership/versioning) at project start. See the *Repo Model* and *Multi-Repo Projects* sections of `.kiro/steering/multi-repo-projects.md` for the full flow and directory conventions.

## Getting started

1. Open this folder in Kiro.
2. No MCP configuration is required — the AWS Knowledge MCP is remote and needs no credentials. For any AWS operations or deploys the agent runs locally, make sure you have valid AWS credentials (the `signing-in-to-aws` skill can help via `aws login`).
3. Start a conversation. Try:
   - *"I want to build a multi-channel web platform — consumer, cashier, and backoffice apps over a shared domain engine. Let's start the AI-DLC workflow."*
   - *"This is a multi-repo project — each SPA and BFF is its own repo. Help me split the specs."*
   - *"Here's our existing domain engine repo — analyze it, then let's spec the new BFF that sits in front of it."*

The workflow creates `_decisions-requirements.md` and waits for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. For multi-repo projects it first captures system-level requirements → high-level design (freezing shared contracts), then splits those into per-repo slices and fans out. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. The `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- AWS credentials configured for any local AWS operations or deploys (not needed for the AWS Knowledge MCP)
- `npx` available on your PATH (used to launch the AWS Knowledge MCP)

## Credits & attribution

The skills vendored in `.kiro/skills/` are sourced from three open-source projects, all licensed under **Apache License 2.0**. Full credit to their authors and maintainers:

- **[aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws)** — `aws-core` plugin. Source of the compute, IaC, identity, and operations skills: `aws-containers`, `aws-cdk`, `aws-cloudformation`, `aws-iam`, `aws-observability`, and `signing-in-to-aws`.
- **[awslabs/agent-plugins](https://github.com/awslabs/agent-plugins)** — Agent Plugins for AWS. Source of the serverless and database skills:
  - `aws-serverless` plugin: `aws-lambda`, `api-gateway`, `aws-lambda-durable-functions`
  - `databases-on-aws` plugin: `aurora-dsql`, `amazon-aurora-postgresql`, `amazon-aurora-mysql`, `creating-amazon-aurora-db-cluster-with-instances`
- **[antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill)** by Anton Babenko — source of the `terraform-skill` (Terraform / OpenTofu authoring, testing, CI, state, and security).

Skills are vendored (copied) into this pack so it works offline and pins a known-good version. Refer to the upstream repositories for the latest versions, additional skills, and their `LICENSE` and `NOTICE` files. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
