# AI-DLC for Modernization Starter Packs

A collection of ready-to-use, **tool-agnostic** starter packs that apply the **AI-Driven Development Lifecycle (AI-DLC)** to real-world application modernization scenarios. Each pack is a pre-configured starting point — instructions, skills, and MCP server registrations — that works with **Kiro, Claude Code, GitHub Copilot, and Cursor**, so you can drop it into your own project and start a structured, decision-driven engagement immediately.

Each pack is authored once as tool-neutral source and ships pre-generated per-tool configs (plus an installer that regenerates them) — see [How to use a pack](#how-to-use-a-pack).

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
| [**enterprise-app-on-cloudnative**](enterprise-app-on-cloudnative/) | Greenfield cloud-native enterprise app — a line-of-business / transactional system | Serverless default (Lambda + API Gateway + Aurora DSQL); full cloud-native skill set (containers, CDK/CloudFormation/Terraform, multi-engine Aurora, IAM, observability); single-repo |
| [**web-app-on-cloudnative**](web-app-on-cloudnative/) | Multi-tier web app (SPA + BFF over a shared domain service) on cloud-native AWS — e.g. a multi-channel consumer/operator platform | Containers (ECS/Fargate) or serverless; Aurora / Aurora DSQL; Terraform/CDK/CloudFormation; multi-repo spec-splitting; container/IaC/IAM/observability + serverless & Aurora skills |
| [**genai-on-serverless**](genai-on-serverless/) | GenAI on serverless — e.g. intelligent document processing | Bedrock + Lambda + API Gateway + S3; ingest/classify/extract/search |
| [**voice-ai-agent-on-aws**](voice-ai-agent-on-aws/) | Real-time voice AI agents on AWS — e.g. adding a voice channel to an existing text/chat platform | Amazon Nova Sonic speech-to-speech + Strands BidiAgent; text-agent→voice migration (LangChain/OpenAI/custom); voice UX, latency & cost optimization skills |
| [**ocr-mobile-app-on-serverless**](ocr-mobile-app-on-serverless/) | Mobile capture app + serverless computer-vision extraction pipeline — e.g. digitizing printed/handwritten forms into structured data | Android/Kotlin (Compose + CameraX) + Textract/Bedrock/Step Functions CV pipeline; human-in-the-loop review; Kotlin/Android/serverless/Terraform + PBT skills |
| [**api-platform-migration-n-modernization**](api-platform-migration-n-modernization/) | API platform migration & modernization — e.g. API Gateway platform / POC with Terraform | Deep API Gateway skill (16 references) + HashiCorp Terraform tooling |
| [**regression-software-testing**](regression-software-testing/) | Build a regression safety net before a major upgrade | Behavior-first test strategy; steering-only; survives version/framework upgrades |
| [**qa-automated-testing**](qa-automated-testing/) | Build automated test suites for web and/or mobile apps | Web (Playwright-first) & mobile (Maestro/Appium-first) testing skills; AWS Device Farm CI guidance |
| [**agentic-ai-workflow**](agentic-ai-workflow/) | Reusable AI-DLC + skills + MCP environment | Agentic-AI & Terraform skills; install script; worked sample guide |

## How to use a pack

1. **Pick the pack** that matches your scenario from the table above.
2. **Add it to your project** in whichever agent you use — two ways:
   - **Copy a pre-built folder (no tooling):** each pack ships pre-generated configs under `<pack>/scaffolded-packs/<tool>/`. Copy the folder for your tool (`kiro`, `claude-code`, `copilot`, or `cursor`) into your project root.
   - **Generate it (installer):** run the `ramp-pack` installer from the repo root — it reads the pack's tool-neutral source and writes the correct layout into your project:
     ```bash
     node installer/bin/ramp-pack.js init <pack> --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
     ```
3. **Read the pack's README** for the kickoff prompt and any pack-specific setup (e.g., updating an `AWS_PROFILE`, or adding Terraform tooling).
4. **Start a conversation.** The agent creates decision files first, waits for your input, then generates requirements, design, and tasks — gate by gate. On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

Each pack's README documents its instructions, skills, MCP servers, and getting-started flow in detail.

## Repository layout

```
aidlc-for-modernization-starter-packs/
├── README.md                                       # You are here
├── installer/                                      # `ramp-pack` — scaffolds a pack into a project per tool
├── legacy-transformation-on-aws/             # Legacy transformation — e.g. monolith → microservices
├── enterprise-app-on-cloudnative/            # Cloud-native enterprise app — line-of-business / transactional system
├── web-app-on-cloudnative/                   # Multi-tier web app (SPA + BFF) — e.g. multi-channel consumer/operator platform
├── genai-on-serverless/                      # GenAI on serverless — e.g. intelligent document processing
├── voice-ai-agent-on-aws/                    # Real-time voice AI agents on AWS (Amazon Nova Sonic)
├── ocr-mobile-app-on-serverless/             # Mobile capture + serverless computer-vision extraction pipeline
├── api-platform-migration-n-modernization/   # API platform migration & modernization (Terraform)
├── regression-software-testing/                    # Pre-upgrade regression testing (steering-only docs)
├── qa-automated-testing/                           # Automated web & mobile test suites
└── agentic-ai-workflow/                            # Reusable AI-DLC + skills + MCP environment
```

Each tool-agnostic pack is laid out as tool-neutral source plus generated per-tool configs:

```
<pack>/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
├── skills/                   # Agent Skills (SKILL.md + references) — omitted for steering-only packs
└── scaffolded-packs/         # Pre-generated per-tool configs
    ├── kiro/  claude-code/  copilot/  cursor/
```

## Common building blocks

Most packs share the same AI-DLC configuration primitives, authored once in the neutral source and rendered into each tool's native location by the installer:

- **Instructions** (`instructions/*.md`) — the workflow, decision gates, and when to activate skills/MCP. Rendered per tool (Kiro `steering/` with `inclusion:`, Claude Code `CLAUDE.md` + `.claude/rules/`, Copilot `.github/copilot-instructions.md` + `.github/instructions/`, Cursor `.cursor/rules/*.mdc`).
- **Skills** (`skills/*/`) — curated, domain-specific knowledge bundles (e.g., AWS Lambda, API Gateway, Aurora DSQL) following the [Agent Skills open standard](https://agentskills.io/), copied verbatim into each tool's skills directory.
- **MCP servers** (declared in `pack.yaml`) — runtime tools the agent calls during a conversation, rendered into each tool's MCP config. The **AWS Knowledge MCP** appears in every pack for validating AWS guidance, service limits, and regional availability.

Because instructions and skills are plain Markdown, treat them as code: version them, review them, and adapt them to your own use cases.

> **Note:** `regression-software-testing` is a lightweight, steering-only pack — a set of Markdown docs you point any agent at directly; it doesn't use the installer / `scaffolded-packs` layout.

## Requirements

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in
- [Git](https://git-scm.com/downloads)
- [Node.js 18+](https://nodejs.org/) — only if you use the `ramp-pack` installer to generate a pack (copying a pre-built `scaffolded-packs/` folder needs no Node)
- Pack-specific tools as noted in each README (e.g., an AWS profile, Terraform tooling, or `uvx`/`npx` for certain MCP servers)

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the [`LICENSE`](LICENSE) file.

AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0). See individual skill files for their respective attribution.
