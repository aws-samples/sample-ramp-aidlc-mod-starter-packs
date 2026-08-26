# Java LTS Upgrade + Containerisation — AI-DLC Starter Pack

A **tool-agnostic** starter pack for **upgrading a Java service to the latest Java LTS and running it as a
container on AWS**, built on the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and
Cursor**. Whichever agent you use picks up the instructions automatically and follows a structured,
decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Take an existing **Java** service and modernise it:

**Assess → upgrade to the latest Java LTS (framework upgrade included) → containerise (if not already) →
deploy to a container platform (ECS or EKS) → verify behaviour parity.**

This is a **brownfield-first** pack: it runs an upgrade-focused **assessment** first, recommends the
newest Java LTS the stack supports (e.g. Java 25, falling back to 21/17 if a dependency blocks it), and
carries the change through to a container running on your target platform. **Monolith → microservices
decomposition** is available as an **optional, separately-gated stretch target** — not the default path.

**Nothing about your environment is assumed.** The workflow *discovers* your target **region and any
restrictions**, your **version-control** (PR vs MR) and **CI/CD** system, your **compliance** regime, and
any **permitted or prohibited tooling** — validating AWS services and regional availability with the
**AWS Knowledge MCP** and turning every constraint into an explicit, audited decision. For example, if a
service isn't available in your only-allowed region, it asks whether another region is acceptable before
proposing an alternative; if a particular tool isn't permitted, it asks for your preferred alternative.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under `scaffolded-packs/` (or the generated harness folders).
Copy the folder for your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `kiro/` | `.kiro/` |
| **Claude Code** | `claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `cursor/` | `.cursor/` |

### Option B — generate it (installer)

```bash
node installer/bin/ramp-pack.js init framework-upgrade-containerise --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/service
```

Add `--dry-run` to preview, `--force` to overwrite.

### Then

1. The **AWS Knowledge MCP** (default-on) needs no credentials — it validates regional availability and
   service behaviour during the workflow.
2. Open the project in your tool and start a conversation. On Claude Code / Copilot you can also run the
   **`/aidlc`** command.

## Kickoff prompt

> *"Modernise this Java application: upgrade it to the latest supported Java LTS plus any required framework
> upgrade, then run it as a container on AWS. Start the AI-DLC workflow — run the assessment first, ask me
> about my target region, version control, CI/CD, and any tooling restrictions, then take me through the
> decision gates. Treat monolith decomposition as a stretch goal only."*

The workflow runs the assessment, then creates `_decisions-requirements.md` and waits for your input before
writing `requirements.md` — the same gate applies before `design.md` and `tasks.md`. Every decision
(including region/tooling choices) is appended to `aidlc-docs/audit.md`; progress is tracked in
`aidlc-docs/aidlc-state.md` so you can resume across sessions.

## What's in this pack

- **`aidlc-workflow.md`** (primary) — Assessment → Upgrade + Containerisation spec (Requirements → Design → Tasks), with decomposition as a separately-gated stretch stage. Includes the baked-in **Environment, Region & Tooling** discovery/decision gates (region/restrictions, VCS PR/MR, CI/CD, compliance, permitted tooling; region-fallback and alternative-tooling gates).
- **`skill-activation.md`** (always) — when to activate which skill + the AWS Knowledge MCP.
- **`reverse-engineering.md`** (auto) — upgrade-focused assessment (JDK/framework/build tool, container status, Java-version risk surface).

### Skills

| Skill | Activates when… |
|---|---|
| `java-upgrade` | Any Java runtime/framework upgrade — upgrade tooling (OpenRewrite, `jdeps`, `jdeprscan`, Maven/Gradle), common 8→17/21/25 breakages, the ECS/EKS containerisation arc, and (in `references/`) the **prescriptive, group-by-group, build-verified language-native** upgrade path used when a managed transformation service is not available/approved |
| `regression-testing` | Planning/writing the behaviour-first regression net that survives the version jump — test-priority tiers plus (in `references/`) a staged, decision-gated, per-unit test-generation workflow |
| `aws-containers` | Authoring Dockerfiles / debugging containers on ECS |
| `ecs-architect` | Choosing the compute model (ECS Fargate / EKS), sizing, networking |
| `ecs-build` | Generating **Terraform** for ECS |
| `ecs-devops` | Release strategy & CI/CD (mapped to your discovered pipeline) |
| `ecs-observability` | Logs/metrics/traces (Container Insights, X-Ray, ADOT) |
| `ecs-security` | Task/execution roles, secrets injection, hardening |
| `aws-iam` | IAM roles, least-privilege |
| `aws-observability` | CloudWatch/X-Ray/ADOT observability |
| `aws-cloudformation` | Authoring/validating **CloudFormation** (CFN IaC path) |
| `web-test-automation` | Regression-testing a web/UI surface |

> **IaC choice** is a decision gate: keep **`ecs-build`** (Terraform) *or* **`aws-cloudformation`** (CFN) per your project.

### MCP servers

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, page reading, regional availability, and recommendations — used proactively when validating best practices, checking service limits, etc. |

**Optional add-ons (not shipped by default):** if your workflow benefits from them, add a **VCS MCP**
(e.g. a GitLab/GitHub server, to read the repo and raise PRs/MRs) and/or an **issue-tracker MCP** (e.g.
JIRA, to pull requirements and link changes). Configure these with scoped tokens per your environment's
data-egress rules.

## Prerequisites

- One of: Kiro, Claude Code, GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+.
- `npx` available on your PATH (used to launch the AWS Knowledge MCP).
