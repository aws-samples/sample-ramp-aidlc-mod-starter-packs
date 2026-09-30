---
inclusion: always
---
# MCP & Skill Activation

Activate the relevant MCP or skill **before** generating any decision file, spec document, or code. Activate once per session.

The MCP servers below are configured in your agent's settings. Skills are available at the workspace or user level depending on your agent.

---

## 📚 AWS Knowledge MCP — use proactively

Use whenever validating AWS-specific guidance: service limits, quotas, regional availability, feature behavior, current API shape, or anytime a recommendation is questioned.

**Tools:** `mcp_aws_knowledge_search_documentation`, `mcp_aws_knowledge_read_documentation`

**🔒 RULE:** Never rely on training data alone for AWS service limits, quotas, or current feature behavior. Search AWS docs first.

---

## 📖 AWS Docs MCP — fallback for documentation reads

A second AWS documentation server is configured. Prefer the AWS Knowledge MCP above; fall back to this one if it returns nothing useful.

**Tools:** `mcp_aws_docs_search_documentation`, `mcp_aws_docs_read_documentation`, `mcp_aws_docs_recommend`

---

## 🧠 Skills — activate on demand

Skills are curated, domain-specific knowledge bundles. Activate the relevant one before designing or writing code in that area. Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

| Skill | Activate when… |
|---|---|
| `kotlin-coding-standards` | Writing or reviewing Kotlin (mobile app or JVM code) |
| `android-design-best-practices` | Designing Android UI/architecture, Jetpack Compose, CameraX capture flows |
| `aws-serverless-best-practices` | Designing/reviewing the serverless extraction backend (Lambda, Step Functions, S3, DynamoDB, Textract, Bedrock) |
| `terraform-best-practices` | Authoring or reviewing Terraform / OpenTofu IaC |
| `property-based-testing-guide` | Defining correctness properties or writing property-based tests |
| `aws-lambda` | Authoring Lambda handlers, event sources, Powertools, Step Functions orchestration |
| `api-gateway` | Designing or wiring REST / HTTP / WebSocket APIs, authorizers, custom domains |

---

## 🔌 Adding more skills and MCPs

When new skills or MCPs are installed, add them here with the same shape:

- Trigger (when to activate)
- Tool or skill name
- One-line rule
