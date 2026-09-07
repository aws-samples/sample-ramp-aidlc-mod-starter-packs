# Legacy Transformation on AWS — AI-DLC Starter Pack

A **tool-agnostic** starter pack for analyzing and decomposing a **brownfield monolith** into microservices on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow. The output is a defensible, decision-audited modernization blueprint at a depth proportional to the objective.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains the same structured modernization workflow, generated in the tool's native format.

## Use case

Analyze an existing monolith (any stack — for example Java/Spring Boot, .NET, or Node.js), understand a bounded modernization objective or the complete system, identify coupling and decomposition boundaries, and produce a phased extraction roadmap grounded in source evidence.

Reverse engineering is adaptive:

- **Targeted is the default** when the prompt names a feature, journey, module, endpoint, data area, bounded context, modernization surface, or other bounded objective. It traces that target end-to-end, performs a mandatory cross-cutting sentinel sweep, and expands only when evidence requires it.
- **Full is explicit or approved**. It runs only when the user requests whole-system analysis or approves a major scope expansion. A Targeted run never silently becomes Full or claims whole-system completeness.
- **Orientation** is a cheap locating pass for ambiguous prompts. It inspects prior analysis, manifests, module topology, entry points, and likely anchors before deep scanning. If ambiguity remains, the workflow allows one informed scope clarification and records it in the audit log.
- **Reuse & Verify** applies to either mode only when prior evidence is suitable. Existing AWS Transform/ATX output, migration assessments, architecture documents, and prior AI-DLC analysis are assessed for freshness and coverage; when sufficiently current and relevant they are reused as primary input, verified where risk or gaps warrant it, and reconciled with explicit provenance. Otherwise the workflow uses **Direct Scan**.

Before deep analysis, the workflow records the objective, anchors, in-scope and not-in-scope boundaries, prior evidence, assumptions, confidence, provenance, and areas not analyzed. Major expansion into another capability, bounded context, high-fan-in shared kernel, or Full mode requires approval.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the contents for your tool into your project root:

| Your tool | Copy from | Generated project files |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout into your target project:

```bash
node installer/bin/ramp-pack.js init legacy-transformation-on-aws --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/monolith
```

Add `--dry-run` to preview or `--force` to overwrite existing generated files. The neutral source is the source of truth.

### Then

1. Open the project in your tool and start a conversation. Try a bounded objective or an explicit whole-system request:
   - *"Modernize the customer checkout journey for extraction onto AWS."*
   - *"Analyze the `/orders/{id}` endpoint and its data and event dependencies."*
   - *"Run a Full reverse-engineering assessment of this monolith for decomposition."*
   - *"Create a strangler fig migration plan for the approved analysis scope."*
   - On Claude Code or Copilot, you can also run the **`/aidlc`** command to start the workflow.

The workflow detects the workspace, selects Targeted or Full reverse engineering, and waits for explicit approval of the evidence before entering Requirements. It then creates `_decisions-requirements.md` and waits for input before writing `requirements.md`; the same decision and approval gates apply to `design.md` and `tasks.md`. State and append-only audit files preserve scope, evidence, expansions, and decisions across sessions.

## Proportional reverse-engineering artifacts

Both modes write analysis under `aidlc-docs/analysis/` and state the mode, objective, scope boundary, provenance, confidence, coverage, and what was not analyzed.

### Targeted bundle

A bounded objective produces a focused evidence set:

- `reverse-engineering-scope.md`
- `target-analysis.md`
- `target-coupling-assessment.md`
- `reverse-engineering-coverage.md`
- `reverse-engineering-timestamp.md`

### Full bundle

An explicit or approved whole-system assessment produces the comprehensive set:

- `business-overview.md`
- `architecture.md`
- `code-structure.md`
- `api-documentation.md`
- `component-inventory.md`
- `technology-stack.md`
- `dependencies.md`
- `bounded-contexts.md`
- `coupling-assessment.md`
- `reverse-engineering-scope.md`
- `reverse-engineering-coverage.md`
- `reverse-engineering-timestamp.md`

If critical evidence is unavailable or a time/budget boundary is reached, the workflow records `Partial/Awaiting Evidence` rather than reporting false completeness.

## What's in this pack

```text
legacy-transformation-on-aws/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, skills, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Detection → adaptive RE → Requirements → Design → Tasks
│   ├── skill-activation.md       # Routing for all 16 bundled skills + AWS Knowledge validation
│   └── reverse-engineering.md    # Targeted/Full, Orientation, Reuse & Verify playbook
├── skills/                   # 16 bundled AWS domain and delivery skills
└── scaffolded-packs/         # Generated per-tool configs
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> Edit `instructions/`, `pack.yaml`, `skills/`, and this README as canonical source. Regenerate `scaffolded-packs/` with the installer; do not hand-edit generated output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` or `companion`) and a **load** rule (`always` or `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*`, `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc`, `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*`, `applyTo: '**'` | `.mdc`, `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*`, semantic description-driven with no `applyTo` | `.mdc`, `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### MCP server

The manifest declares AWS Knowledge once; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, or `.cursor/mcp.json`).

| MCP server | Purpose |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate current AWS service behavior, limits, regional availability, documentation, and CloudFormation resource shapes before load-bearing recommendations or generated IaC. |

## Bundled skills (16)

Skills are copied into every generated scaffold and activated by intent. During reverse engineering, discovery/assessment skills are used only when their capabilities apply to the approved scope; target design or implementation skills wait for the corresponding decision gate.

### ECS discovery and review

- **`ecs-recon`** — read-only inventory of an existing ECS estate.
- **`ecs-operation-review`** — evidence-based, scored operational assessment of a live ECS estate.

### ECS architecture, build, and deployment

- **`ecs-architect`** — target ECS deployment-model, capacity, networking, and service design after modernization intent is settled.
- **`ecs-build`** — Terraform generation for an already-settled ECS design.
- **`ecs-devops`** — ECS release strategy, traffic shifting, rollback, and CI/CD.

### Observability, security, and identity

- **`ecs-observability`** — ECS-specific logs, metrics, and traces architecture.
- **`aws-observability`** — general and cross-service CloudWatch, X-Ray, ADOT, synthetics, dashboards, and Application Signals guidance.
- **`ecs-security`** — ECS hardening, secrets, runtime protection, supply chain, and compliance.
- **`aws-iam`** — IAM roles, trust and permission policies, least privilege, `iam:PassRole`, and confused-deputy protections.

### API and durable workflows

- **`api-gateway`** — REST, HTTP, and WebSocket API Gateway design, integrations, security, deployment, and troubleshooting.
- **`aws-lambda-durable-functions`** — replay-safe, long-running durable Lambda workflows, waits, callbacks, compensation, and testing.

### Infrastructure as code

- **`aws-cloudformation`** — plain CloudFormation YAML/JSON authoring, validation, and troubleshooting. Keep its resource ownership separate from ECS Terraform generated by `ecs-build`.

### Data engines and provisioning

- **`aurora-dsql`** — Aurora DSQL lifecycle, IAM authentication, connectors, schema/query semantics, safe SQL, and migration guidance.
- **`amazon-aurora-postgresql`** — Aurora PostgreSQL compatibility, Babelfish/pgvector, sizing, I/O, pricing, and upgrades.
- **`amazon-aurora-mysql`** — Aurora MySQL compatibility, sizing, I/O, pricing, parallel query, and upgrades.
- **`creating-amazon-aurora-db-cluster-with-instances`** — sequenced provisioning of a conventional Aurora cluster, instances, and managed credentials.

The workflow selects data guidance only after target engine intent is known and deliberately chooses CloudFormation or Terraform ownership instead of silently blending generated IaC.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+.
- Network access to the direct HTTP AWS Knowledge MCP endpoint declared in `pack.yaml`.
