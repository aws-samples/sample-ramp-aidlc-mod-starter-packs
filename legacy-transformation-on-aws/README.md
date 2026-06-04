# Monolith to Microservices — AI-DLC Starter Pack

A pre-configured Kiro workspace for decomposing a **brownfield monolith** into microservices on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow. The output is a defensible, decision-audited decomposition blueprint.

Open your project in Kiro with these steering files in place. The agent picks them up automatically and follows a structured, decision-gated workflow — every architectural decision is captured in a spec file and logged in an audit trail.

## Use case

Analyze an existing monolith (any stack — e.g., Java/Spring Boot, .NET, Node.js), identify bounded contexts and coupling hot-spots, and produce a phased extraction roadmap. The workflow starts with **Phase 0 reverse engineering** so every decomposition decision is grounded in the actual codebase.

## What's in this pack

```
legacy-transformation-on-aws/
└── .kiro/
    ├── steering/                       # Always-on agent rules
    │   ├── aidlc-decisions-workflow.md     # Reverse Engineering → Requirements → Design → Tasks
    │   ├── reverse-engineering.md          # Phase 0 analysis playbook
    │   └── skill-power-mcp-activation.md   # When to activate skills + MCP
    └── settings/mcp.json               # AWS Knowledge MCP
```

This is a **steering-only** pack — it carries the reusable AI-DLC configuration and no sample application. Drop it into your own monolith's repository to get started.

### Steering

| File | What it does |
|---|---|
| `aidlc-decisions-workflow.md` | The decomposition workflow: Phase 0 reverse engineering, then `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file you complete before the agent writes the final document. |
| `reverse-engineering.md` | Phase 0 playbook — produces a full analysis bundle (business overview, architecture, bounded contexts, coupling assessment, etc.) under `aidlc-docs/analysis/`. |
| `skill-power-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance during design — service limits, quotas, regional availability, migration patterns. |

## Getting started

1. Copy `.kiro/` into your monolith's repository (or open this folder alongside your source).
2. From the project root, start a Kiro session.
3. Send the kickoff prompt:

    ```
    Modernise this legacy monolith to microservice architecture on AWS
    ```

The workflow will detect the stack, run Phase 0 reverse engineering (producing analysis artifacts under `aidlc-docs/analysis/`), then create `_decisions-requirements.md` and wait for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to an audit log for a defensible paper trail.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads)
