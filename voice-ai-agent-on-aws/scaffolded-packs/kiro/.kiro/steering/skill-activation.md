---
inclusion: always
---
# MCP & Skill Activation

Activate the relevant MCP or skill **before** generating any decision file, spec document, or code. Activate once per session.

The MCP servers below are project-scoped. Skills live under `skills/` (workspace-level) or at user-level depending on your AI agent configuration.

**Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.**

---

## 📚 AWS Knowledge MCP — use proactively

Use whenever validating AWS-specific guidance: service limits, quotas, regional availability, feature behavior, current API shape, or anytime a recommendation is questioned.

**Tools:** `mcp_aws_knowledge_search_documentation`, `mcp_aws_knowledge_read_documentation`

**🔒 RULE:** Never rely on training data alone for AWS service limits, quotas, or current feature behavior — including Amazon Bedrock / Nova Sonic model availability per region. Search AWS docs first.

---

## 📖 AWS Docs MCP — fallback for documentation reads

A second AWS documentation server is configured. Prefer the AWS Knowledge MCP above; fall back to this one if it returns nothing useful.

**Tools:** `mcp_aws_docs_search_documentation`, `mcp_aws_docs_read_documentation`, `mcp_aws_docs_recommend`

---

## 🧠 Skills — activate on demand

Skills are curated, domain-specific knowledge bundles in `skills/`. Activate the relevant one before designing or writing code in that area.

| Skill | Activate when… |
|---|---|
| `nova-sonic-best-practices` | Designing a new Nova Sonic voice agent — model choice, voice prompt design, tool calling, conversation UX |
| `nova-sonic-optimization` | Reducing voice latency, streaming inference, same-region deployment, cost tuning, multi-region reliability |
| `text-agent-to-nova-sonic-voice` | Migrating an existing text/chatbot agent to real-time voice using Strands BidiAgent + Nova Sonic |

---

## 🔌 Adding more skills and MCPs

When new skills or MCPs are installed, add them here with the same shape:

- Trigger (when to activate)
- Tool or skill name
- One-line rule
