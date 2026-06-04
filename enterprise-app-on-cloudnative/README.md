# ERP on Serverless — AI-DLC Starter Pack

A pre-configured Kiro workspace for **greenfield** development of an ERP-style **Customer 360** application (CRM + Inventory) on AWS serverless — built with the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow — it never writes a spec document until you have filled in your decisions first.

## Use case

Greenfield build of an end-to-end **Lead → Opportunity → Customer → Order → Inventory** flow, suitable for a C-Suite demo. Target stack is AWS serverless: **AWS Lambda, Amazon API Gateway, and Aurora DSQL**. Because there is no existing source, the workflow skips Phase 0 (reverse engineering) and starts at requirements.

## What's in this pack

```
enterprise-app-on-cloudnative/
├── .kiro/
│   ├── steering/                       # Always-on agent rules
│   │   ├── aidlc-decisions-workflow.md     # Decision-gated Requirements → Design → Tasks
│   │   ├── reverse-engineering.md          # Phase 0 playbook (used only for brownfield)
│   │   └── skill-power-mcp-activation.md   # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge + Aurora DSQL + AWS IaC MCP
│   ├── skills/                         # Vendored AWS serverless skills
│   │   ├── aws-lambda/
│   │   ├── api-gateway/
│   │   ├── aws-serverless-deployment/
│   │   ├── aws-lambda-durable-functions/
│   │   └── dsql/
│   └── specs/                          # Created during the workflow
└── aidlc-docs/                         # Created during the workflow (progress tracker + audit log)
```

### Steering

| File | What it does |
|---|---|
| `aidlc-decisions-workflow.md` | The decision-gated workflow. `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file you complete before the agent writes the final document. Tasks are generated as independent parallel groups (waves). |
| `reverse-engineering.md` | Phase 0 playbook for analyzing an existing codebase. Not used for this greenfield pack, but kept so the same workspace works on brownfield projects. |
| `skill-power-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when — including during design and decision phases, not just code execution. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior. |
| **Aurora DSQL** (`aurora-dsql`) | Validate Aurora DSQL schemas, connection patterns, and DSQL-specific semantics. |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validate CDK constructs, CloudFormation resource properties, and IaC patterns. Update `AWS_PROFILE` to your named profile. |

### Skills

| Skill | Activates when… |
|---|---|
| `aws-lambda` | Designing or authoring Lambda handlers, event sources, Powertools instrumentation |
| `api-gateway` | Designing or wiring REST / HTTP / WebSocket APIs, authorizers, custom domains |
| `aws-serverless-deployment` | Writing SAM / CDK templates and serverless CI/CD pipelines |
| `aws-lambda-durable-functions` | Building stateful workflows, approval routing, long-running processes |
| `dsql` | Working with Aurora DSQL schemas, queries, and connection patterns |

## Getting started

1. Open this folder in Kiro.
2. Update `AWS_PROFILE` in `.kiro/settings/mcp.json` for the AWS IaC MCP.
3. Start a conversation. Try:
   - *"I want to build a Customer 360 system — CRM plus inventory — as an end-to-end demo. Let's start the AI-DLC workflow."*
   - *"Create a spec for the lead-to-order flow."*

The workflow will create `_decisions-requirements.md` and wait for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`. Every decision is appended to `aidlc-docs/audit.md`, and progress is tracked in `aidlc-docs/aidlc-state.md` so you can resume across sessions. Both the `specs/` and `aidlc-docs/` directories are created by the agent on the first run.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- An AWS profile configured (for the AWS IaC MCP)
- `uvx` / `npx` available on your PATH (used to launch the MCP servers)
