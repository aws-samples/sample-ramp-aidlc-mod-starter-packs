# Agentic AI Workflow — AI-DLC Starter Pack

A **tool-agnostic** starter pack for building **agentic AI workflows** (e.g., with LangGraph, CrewAI, or Strands) and AWS infrastructure, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-driven workflow.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains structured decision-gated workflows, AWS infrastructure and agentic-AI expertise, plus real-time AWS documentation — no manual setup needed.

## Use case

Build agentic AI workflows on AWS with infrastructure-as-code (Terraform/OpenTofu). Suited for developers creating multi-agent systems, optimizing existing agents, or building AWS infrastructure for agentic applications. Includes a vendor-neutral sample workshop guide demonstrating the full Inception → Construction → Operations flow.

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the folder for your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout into your target project:

```bash
node installer/bin/ramp-pack.js init agentic-ai-workflow --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. **(Recommended)** Set up Terraform tooling for your agent — see [Terraform tooling](#terraform-tooling) below.
2. Open the project in your tool and start a conversation. Try:
   - *"Create requirements for a multi-agent workflow using LangGraph."*
   - *"Help me design the agentic AI architecture."*
   - *"Write Terraform for the AWS infrastructure."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow guides the agent to ask for your decisions first (writing a `_decisions-*.md` before each spec document), and the skills provide expert-level guidance throughout.

## What's in this pack

```
agentic-ai-workflow/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   └── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
├── skills/                   # Agent Skills standard (SKILL.md + references)
│   ├── agentic-optimizer/        # Build & optimize agentic AI workflows (LangGraph, CrewAI, Strands)
│   ├── terraform-skill/          # Terraform/OpenTofu best practices — testing, modules, CI/CD, security
│   ├── terraform-aws/            # AWS infrastructure patterns — VPC, IAM, S3, RDS, EKS, state management
│   ├── aws-skills/               # AWS cloud architecture — IaC tool selection, CI/CD, cost optimization
│   └── iac/                      # IaC best practices across Terraform, Ansible, Pulumi, CloudFormation
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### Skills

All skills follow the [Agent Skills open standard](https://agentskills.io/), so they copy verbatim into every supported tool. The agent activates them when your conversation matches their domain.

| Skill | Description |
|-------|-------------|
| `agentic-optimizer` | Build agentic AI workflows with LangGraph, CrewAI, or Strands. Optimize existing agents. |
| `terraform-skill` | Terraform/OpenTofu best practices — testing, modules, CI/CD, security |
| `terraform-aws` | AWS infrastructure patterns — VPC, IAM, S3, RDS, EKS, state management |
| `aws-skills` | AWS cloud architecture — IaC tool selection, CI/CD, cost optimization |
| `iac` | IaC best practices across Terraform, Ansible, Pulumi, CloudFormation |

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Documentation search, page reading, regional availability, and recommendations — used proactively when validating best practices, checking service limits, or when you question a recommendation. |

## Terraform tooling

The workflow generates infrastructure as **Terraform**. Give your agent live Terraform provider/module knowledge:

- **Kiro** — install the HashiCorp **Terraform power**: open the **Powers panel** (👻⚡), search **"Terraform"** by HashiCorp → **Install** → **Confirm** (or from the web: <https://kiro.dev/powers/hashicorp/terraform>). Requires Kiro signed in and Docker running.
- **Claude Code / Copilot / Cursor** — add the HashiCorp **Terraform MCP server** ([`hashicorp/terraform-mcp-server`](https://github.com/hashicorp/terraform-mcp-server)) to your tool's MCP config. It runs as a Docker image, e.g.:
  ```json
  {
    "mcpServers": {
      "terraform": { "command": "docker", "args": ["run", "-i", "--rm", "hashicorp/terraform-mcp-server"] }
    }
  }
  ```
  (Copilot uses the `servers` key instead of `mcpServers`.) The agent then searches Terraform provider docs and modules. Requires Docker running.

The AWS Knowledge MCP (included) still validates the AWS resource shapes regardless of the Terraform tooling you choose.

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- `npx` available on your PATH (used to launch the AWS Knowledge MCP).
- *(For the Kiro Terraform power)* Docker installed and running.

## License

AI-DLC steering based on [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0). See individual skill files for attribution.
