# API Gateway Platform — AI-DLC Starter Pack

A pre-configured Kiro workspace for planning and building an **Amazon API Gateway** platform
or proof-of-concept on AWS, driven by the **AI-Driven Development Lifecycle (AI-DLC)**
decision-driven workflow and infrastructure-as-code with **Terraform**.

When you open this folder in Kiro, the agent automatically gains deep API Gateway expertise
and follows structured, decision-gated workflows — no manual setup needed.

## Use case

Stand up an API Gateway platform (REST / HTTP / WebSocket) — authorizers, custom domains,
WAF, throttling, observability, and CI/CD — using Terraform as the IaC tool. Suited to a
platform team building a reusable API Gateway pattern or running a focused POC.

## What's in this pack

```
api-platform-migration-n-modernization/
├── .kiro/
│   ├── steering/                       # Always-on agent rules
│   │   ├── aidlc-decisions-workflow.md     # Decision-gated Requirements → Design → Tasks
│   │   └── skill-power-mcp-activation.md   # When to activate the skill, Terraform power, MCP
│   ├── settings/mcp.json               # AWS Knowledge MCP
│   └── skills/api-gateway/             # API Gateway expertise (SKILL.md + 16 reference files)
└── README.md
```

### Steering

| File | What it does |
|------|-------------|
| `aidlc-decisions-workflow.md` | The agent creates a **decision file** (`_decisions-*.md`) before generating any spec document (requirements, design, tasks), and waits for your choices first. |
| `skill-power-mcp-activation.md` | The agent activates the right capability at the right time — the API Gateway skill for spec work, the Terraform power for code generation, and the AWS Knowledge MCP for validating best practices. |

### Skill — API Gateway

`.kiro/skills/api-gateway/` gives the agent domain-specific knowledge that activates
automatically when your conversation mentions API Gateway, REST API, custom domain, mTLS,
authorizers, etc. It bundles `SKILL.md` plus a `references/` library covering architecture
patterns, authentication, security, custom domains, performance, observability, deployment,
governance, service integrations, SAM/CloudFormation, WebSocket, requirements gathering,
pitfalls, troubleshooting, and service limits.

### MCP servers (`.kiro/settings/mcp.json`)

| MCP Server | When the agent uses it |
|-----------|-------------|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, page reading, regional availability, and recommendations — used proactively when validating best practices, checking service limits, or when you question a recommendation. |

## Install the Terraform power (optional but recommended)

The HashiCorp Terraform power lets Kiro search Terraform provider docs, discover modules, and
follow Terraform best practices — activated automatically when you work with `.tf` files or
mention Terraform.

1. Open Kiro and click the **Powers panel** (👻⚡).
2. Search for **"Terraform"** by HashiCorp → **Install** → **Confirm**.

Or install from the web: **https://kiro.dev/powers/hashicorp/terraform**

> **Prerequisites for the power:** Kiro signed in, and Docker installed and running.

## Getting started

1. Open this folder in Kiro.
2. **(Optional)** Install the Terraform power (steps above).
3. Start a conversation. Try:
   - *"Help me plan the API Gateway POC based on the success criteria."*
   - *"Create requirements for the API Gateway platform."*
   - *"Write Terraform for a REST API with JWT auth and a custom domain."*

The steering file guides the agent to ask for your decisions first, and the API Gateway skill
provides expert-level guidance throughout.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- *(For the Terraform power)* Docker installed and running
