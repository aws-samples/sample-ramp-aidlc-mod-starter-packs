# AI-DLC for Modernization Starter Packs

A collection of ready-to-use **Kiro** starter packs that apply the **AI-Driven Development Lifecycle (AI-DLC)** to real-world application modernization scenarios. Each pack is a pre-configured starting point — steering files, skills, and MCP server registrations — so you can drop it into your own project and start a structured, decision-driven engagement immediately.

These packs are distilled from real modernization engagements and have been generalized for reuse. They contain no customer-identifying information.

> **Important:** This is sample code for demonstration and non-production usage. You should work with your security and legal teams to meet your organizational security, regulatory, and compliance requirements before any production deployment.

## Part of RAMP

These packs are part of the **Rapid Agentic Modernisation Program (RAMP)** — a structured engagement model that accelerates enterprise application modernisation to cloud-native architectures using agentic AI tooling. RAMP covers the full lifecycle: identifying high-impact workloads, a 2-3 day hands-on AI-DLC workshop that produces deployed output at 5-7x speed, driving those workloads to production, and scaling the methodology across the customer's portfolio.

RAMP addresses two modernisation types:

- **Transform from Legacy** — existing codebase (on-prem or EC2) converted/refactored into a cloud-native form (app + DB).
- **Reimagine and Build** — a new cloud-native system designed to replace or extend legacy, with legacy as requirements input (app + DB). Includes ERP/CRM consolidation, platform rebuilds, and brownfield extension with agentic AI.

These packs are designed for the hands-on AI-DLC for modernization workshop as part of RAMP.

## What is AI-DLC?

**AI-DLC (AI-Driven Development Life Cycle)** is an AWS methodology for building and modernizing software with AI as a central collaborator rather than a code-completion assistant. It is built on two principles: **AI-powered execution with human oversight** (the AI plans, asks clarifying questions, and defers key decisions to humans) and **dynamic team collaboration** (teams decide the things that matter while the AI does the heavy lifting). Work is organized across three phases — **Inception → Construction → Operations** — and every artifact (requirements, design, tasks, audit log) is persisted to the repository so work resumes cleanly across sessions.

These starter packs use a **streamlined, modernization-focused adaptation** of AI-DLC — the full Inception → Construction → Operations methodology condensed into a practical, decision-gated workflow:

- **Decision gates** — before the agent writes any spec document, it first produces a `_decisions-*.md` file with options and waits for your input. No assumptions, no premature code.
- **Audit trail** — every decision, approval, and rationale is appended to an audit log, producing a defensible paper trail for your architecture choices.

Learn more:
- [AI-Driven Development Life Cycle (AWS blog)](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)
- [Open-sourcing Adaptive Workflows for AI-DLC](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/)
- [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)

## The starter packs

| Pack | Scenario | Highlights |
|------|----------|-----------|
| [**legacy-transformation-on-aws**](legacy-transformation-on-aws/) | Transform a legacy app on AWS — e.g. monolith → microservices | Reverse engineering → decomposition blueprint; steering-only, stack-agnostic |
| [**enterprise-app-on-cloudnative**](enterprise-app-on-cloudnative/) | Greenfield cloud-native enterprise app — e.g. ERP (Customer 360: CRM + Inventory) | Lambda + API Gateway + Aurora DSQL; durable-functions & DSQL skills |
| [**genai-on-serverless**](genai-on-serverless/) | GenAI on serverless — e.g. intelligent document processing | Bedrock + Lambda + API Gateway + S3; ingest/classify/extract/search |
| [**api-platform-migration-n-modernization**](api-platform-migration-n-modernization/) | API platform migration & modernization — e.g. API Gateway platform / POC with Terraform | Deep API Gateway skill (16 references) + HashiCorp Terraform power |
| [**regression-software-testing**](regression-software-testing/) | Build a regression safety net before a major upgrade | Behavior-first test strategy; steering-only; survives version/framework upgrades |
| [**agentic-ai-workflow**](agentic-ai-workflow/) | Reusable AI-DLC + skills + MCP environment | Agentic-AI & Terraform skills; install script; worked sample guide |

## How to use a pack

1. **Pick the pack** that matches your scenario from the table above.
2. **Open it in [Kiro](https://kiro.dev)** — or copy its `.kiro/` directory into your own project's repository. Kiro automatically loads steering files and registers MCP servers from the workspace's `.kiro/` directory when a session starts.
3. **Read the pack's README** for the kickoff prompt and any pack-specific setup (e.g., updating an `AWS_PROFILE`, installing the Terraform power, or copying steering files).
4. **Start a conversation.** The agent creates decision files first, waits for your input, then generates requirements, design, and tasks — gate by gate.

Each pack's README documents its steering files, skills, MCP servers, and getting-started flow in detail.

## Repository layout

```
aidlc-for-modernization-starter-packs/
├── README.md                                       # You are here
├── legacy-transformation-on-aws/             # Legacy transformation — e.g. monolith → microservices
├── enterprise-app-on-cloudnative/            # Cloud-native enterprise app — e.g. ERP (Customer 360)
├── genai-on-serverless/                      # GenAI on serverless — e.g. intelligent document processing
├── api-platform-migration-n-modernization/   # API platform migration & modernization (Terraform)
├── regression-software-testing/                    # Pre-upgrade regression testing
└── agentic-ai-workflow/                            # Reusable AI-DLC + skills + MCP environment
```

## Common building blocks

Most packs share the same AI-DLC configuration primitives:

- **Steering** (`.kiro/steering/*.md`) — always-on instructions that define the workflow, decision gates, and when to activate skills/MCP.
- **Skills** (`.kiro/skills/*/`) — curated, domain-specific knowledge bundles (e.g., AWS Lambda, API Gateway, Aurora DSQL) the agent activates on demand.
- **MCP servers** (`.kiro/settings/mcp.json`) — runtime tools the agent calls during a conversation. The **AWS Knowledge MCP** appears in every pack for validating AWS guidance, service limits, and regional availability.

Because steering files are plain Markdown, treat them as code: version them, review them, and adapt them to your own use cases.

## Requirements

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads)
- Pack-specific tools as noted in each README (e.g., an AWS profile, Docker for the Terraform power, or `uvx`/`npx` for certain MCP servers)

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [`LICENSE`](LICENSE) file.

AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0). See individual skill files for their respective attribution.
