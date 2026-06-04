# Intelligent Document Processing on Serverless — AI-DLC Starter Pack

A pre-configured Kiro workspace for modernizing an existing application into a serverless **Intelligent Document Processing (IDP)** pipeline on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

Open this folder in Kiro. The agent picks up the steering files automatically and follows a structured, decision-gated workflow throughout the engagement.

## Use case

**Brownfield** modernization of a document-management application (e.g., a PHP/Laravel + Vue.js monolith backed by PostgreSQL and S3) into an event-driven serverless IDP pipeline — ingest, classify, extract, index, and search documents using **AWS Lambda, Amazon API Gateway, Amazon Bedrock, and Amazon S3**. The workflow begins with **Phase 0 reverse engineering** of the existing codebase to ground every modernization decision in evidence.

## What's in this pack

```
genai-on-serverless/
├── .kiro/
│   ├── steering/                       # Always-on agent rules
│   │   ├── aidlc-decisions-workflow.md     # Phase 0 → Requirements → Design → Tasks
│   │   ├── reverse-engineering.md          # Phase 0 analysis playbook
│   │   └── skill-power-mcp-activation.md   # When to activate skills + MCP
│   ├── settings/mcp.json               # AWS Knowledge MCP
│   └── skills/                         # Vendored AWS serverless skills
│       ├── aws-lambda/
│       ├── api-gateway/
│       └── aws-serverless-deployment/
└── (create references/ yourself for your own current-state notes — optional)
```

### Steering

| File | What it does |
|---|---|
| `aidlc-decisions-workflow.md` | The workflow. Optional **Phase 0: Reverse Engineering** for brownfield codebases, then `Requirements → Design → Tasks`, each gated by a `_decisions-*.md` file. The agent never produces a spec document until you've filled in your decisions. |
| `reverse-engineering.md` | Phase 0 playbook — which artifacts to produce when analyzing an existing codebase (business overview, architecture, API docs, code quality, bounded contexts, modernization readiness). |
| `skill-power-mcp-activation.md` | Tells the agent which skills and MCP tools to activate, and when. |

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validate AWS guidance — service limits, quotas, regional availability, current API behavior. |

### Skills

| Skill | Activates when… |
|---|---|
| `aws-lambda` | Authoring Lambda handlers, event sources, Powertools instrumentation |
| `api-gateway` | Designing or wiring REST / HTTP / WebSocket APIs, authorizers, custom domains |
| `aws-serverless-deployment` | Writing SAM / CDK templates and serverless CI/CD pipelines |

## Getting started

1. Open this folder in Kiro.
2. **(Optional, recommended)** Capture your application's current state and put it in a `references/` folder you create — current-state notes, questionnaire outputs, architecture diagrams. The agent reads these during Phase 0 and requirements gathering.
3. **(For Phase 0)** Make the existing codebase available to the agent: clone it into `existing-codebase/` (gitignored), symlink your local checkout, or point the agent at an absolute path when it asks.
4. Start a conversation. Try:
   - *"Let's start the AI-DLC workflow with Phase 0 reverse engineering of the existing codebase."*
   - *"Create a spec for the document ingest pipeline."*

The workflow will run Phase 0 first (producing analysis artifacts under `aidlc-docs/analysis/`), then create `_decisions-requirements.md` and wait for your input before writing `requirements.md`. The same gate applies before `design.md` and `tasks.md`.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads) (for branches and any existing-codebase clone)
