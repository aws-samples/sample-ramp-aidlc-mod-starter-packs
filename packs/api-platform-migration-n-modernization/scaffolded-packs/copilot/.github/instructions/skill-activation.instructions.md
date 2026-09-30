---
applyTo: '**'
---
# Mandatory Skill, Tooling & MCP Activation

Activate the relevant skill or tooling **BEFORE** generating any decision file, spec document, or code. Each activation only lasts for the current session — re-activate at the start of every new session when the topic is relevant.

> Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

## 🧠 API Gateway Skill

**Trigger keywords:** API Gateway, REST API, HTTP API, WebSocket API, custom domain, mTLS, Lambda authorizer, JWT authorizer, usage plan, throttling, caching, WAF, VPC link, private API, base path mapping, routing rules, canary deployment, stage variables, gateway response, access logging, execution logging

**Action:** Activate/load the `api-gateway` skill.

**Why:** Loads deep-dive reference files (authentication, security, custom domains, observability, performance, governance, deployment, etc.) that inform accurate recommendations and decision options.

**🔒 RULE:** NEVER create a decision file or spec document for an API Gateway project without first activating this skill. Read the relevant reference files to inform your recommendations.

## 🏗️ Terraform Tooling

**Trigger:** Activate when you are about to **write, review, or generate Terraform/HCL code** (e.g., `.tf` files, task execution, code generation phase), when Terraform is referenced in the spec context as the chosen IaC tool, or when the user asks about Terraform.

**Action:** Use your agent's Terraform tooling if available — the HashiCorp **Terraform power** (Kiro) or the HashiCorp **Terraform MCP server** (`hashicorp/terraform-mcp-server`) in other agents.

**Why:** Provides live access to Terraform provider docs, module discovery, and best practices. Essential for getting resource arguments, attribute names, and module inputs right on the first shot.

**When NOT needed:** Decision files, requirements docs, design docs — training data is sufficient for architecture-level Terraform discussions.

**🔒 RULE:** NEVER write or generate `.tf` files without first activating your Terraform tooling. During code generation:
1. Activate the Terraform tooling before writing any HCL.
2. Look up exact resource schemas (provider docs) before writing resources — don't guess argument or attribute names.
3. Check for verified community modules before writing boilerplate.
4. Pin the AWS provider version to a known-good release.

If no Terraform tooling is available in your agent, fall back to the **AWS Knowledge MCP** to validate resource shapes, and state clearly that provider schemas were not verified against live registry data.

## 📚 AWS Knowledge MCP

**Trigger:** Use proactively to validate AWS best practices, service limits, and feature behavior — especially when unsure, when the user questions a recommendation, or when making architectural decisions in spec documents.

**Available tools:**
- `search_documentation` — Search AWS docs (general, reference, troubleshooting, current_awareness, cdk_docs, cloudformation, agent_sops)
- `read_documentation` — Fetch specific AWS doc pages
- `get_regional_availability` — Check service/feature availability across regions

**🔒 RULE:** When uncertain about AWS-specific guidance, ALWAYS search AWS docs first before answering. Do not rely solely on training data for service limits, quotas, or current feature behavior.

## Activation Checklist

1. Read the user's message and spec context for keyword matches.
2. Activate ALL matching skills/tooling before proceeding.
3. Skills, Terraform tooling, and MCP servers are independent — activate each that is relevant.
4. Only activate once per session — no need to re-activate mid-conversation.
5. When unsure about AWS specifics, use AWS Knowledge MCP tools to verify.
