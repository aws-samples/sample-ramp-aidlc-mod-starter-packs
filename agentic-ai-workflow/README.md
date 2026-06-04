# Agentic AI Workflow — AI-DLC Starter Pack

A shareable Kiro configuration package that bundles **AI-Driven Development Lifecycle (AI-DLC)** steering, AWS infrastructure and agentic-AI skills, and the AWS Knowledge MCP server into a ready-to-use development environment. Best suited for building **agentic AI workflows** (e.g., with LangGraph, CrewAI, or Strands) and AWS infrastructure work.

A worked, vendor-neutral sample (`AIDLC_Workshop_Guide_EN.md`) walks through the full Inception → Construction → Operations flow on a fictional "AWSomeShop" demo app.

## What's Included

### Steering

**Decision-Driven Spec Workflow** (`aidlc-decisions-approval.md`) — Enforces a decision-first approach for spec-driven development. Before generating requirements, design, or task documents, Kiro creates structured decision files for user input, ensuring high-quality aligned deliverables. Based on the [AI-DLC methodology](https://github.com/awslabs/aidlc-workflows).

### Skills

| Skill | Description |
|-------|-------------|
| `agentic-optimizer` | Build agentic AI workflows with LangGraph, CrewAI, or Strands. Optimize existing agents. |
| `terraform-skill` | Terraform/OpenTofu best practices — testing, modules, CI/CD, security |
| `terraform-aws` | AWS infrastructure patterns — VPC, IAM, S3, RDS, EKS, state management |
| `aws-skills` | AWS cloud architecture — IaC tool selection, CI/CD, cost optimization |
| `iac` | IaC best practices across Terraform, Ansible, Pulumi, CloudFormation |

### MCP Server

[AWS Knowledge MCP Server](https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server/) — real-time access to AWS documentation, API references, troubleshooting guides, SOPs, and regional availability info. No authentication required.

## Quick Start

### Option 1: Setup Script (Recommended)

```bash
git clone <this-repo-url>
cd <this-repo>

# Install into your project
./setup.sh /path/to/your/project
```

The script installs steering, skills, and MCP config automatically.

### Option 2: Manual Setup

#### 1. Copy steering

```bash
mkdir -p <your-project>/.kiro/steering
cp .kiro/steering/aidlc-decisions-approval.md <your-project>/.kiro/steering/
```

#### 2. Copy skills

```bash
mkdir -p <your-project>/.kiro/skills
cp -R .kiro/skills/* <your-project>/.kiro/skills/
```

#### 3. Copy MCP config

```bash
mkdir -p <your-project>/.kiro/settings
cp .kiro/settings/mcp.json <your-project>/.kiro/settings/mcp.json
```

If you already have a `mcp.json`, merge the `aws-knowledge-mcp-server` entry:

```json
{
  "mcpServers": {
    "aws-knowledge-mcp-server": {
      "url": "https://knowledge-mcp.global.api.aws",
      "type": "http",
      "disabled": false
    }
  }
}
```

### Optional: AI-DLC Core Workflow

For the full AI-DLC three-phase development workflow (Inception → Construction → Operations), download from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows/releases):

```bash
curl -L -o /tmp/aidlc.zip https://github.com/awslabs/aidlc-workflows/releases/latest/download/aidlc-rules.zip
unzip -o /tmp/aidlc.zip -d /tmp/aidlc-rules
cp -R /tmp/aidlc-rules/aidlc-rules/aws-aidlc-rules <your-project>/.kiro/steering/
cp -R /tmp/aidlc-rules/aidlc-rules/aws-aidlc-rule-details <your-project>/.kiro/
```

## Final Project Structure

```
your-project/
├── .kiro/
│   ├── settings/
│   │   └── mcp.json                          # AWS Knowledge MCP server
│   ├── steering/
│   │   ├── aidlc-decisions-approval.md        # Decision-driven spec workflow
│   │   └── aws-aidlc-rules/                   # AI-DLC core workflow (optional)
│   ├── aws-aidlc-rule-details/                # AI-DLC rule details (optional)
│   └── skills/
│       ├── agentic-optimizer/
│       ├── terraform-skill/
│       ├── terraform-aws/
│       ├── aws-skills/
│       └── iac/
└── ... (your project files)
```

## Verification

After setup, open your project in Kiro and verify:

1. **Steering** — Open "Agent Steering & Skills" in the Kiro panel. Confirm `aidlc-decisions-approval` appears under Workspace steering.
2. **Skills** — In the same panel, you should see all 5 skills listed.
3. **MCP** — Check the MCP Servers view. `aws-knowledge-mcp-server` should show as connected.

## Usage

- **Steering** activates automatically when creating spec documents (requirements.md, design.md, tasks.md). Kiro will create decision files first and wait for your input before generating final documents.
- **Skills** activate automatically when your request matches their description, or invoke manually with `/skill-name` in chat.
- **MCP** is used automatically when Kiro needs AWS documentation or guidance.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- Internet access (for the MCP server)

## License

AI-DLC steering based on [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0). See individual skill files for attribution.
