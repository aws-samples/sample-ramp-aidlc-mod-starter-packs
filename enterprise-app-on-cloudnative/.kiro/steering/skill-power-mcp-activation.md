---
inclusion: always
---

# 🚨 MANDATORY: Skill, Power & MCP Activation

## CRITICAL ENFORCEMENT — READ BEFORE EVERY RESPONSE

**You MUST activate the relevant skill or MCP when relevant BEFORE generating _decisions-*.md, design.md and code execution.**

**RULES:**
1. **NEVER generate code, IaC or design decision files without first activating the matching skill/MCP**
2. **NEVER rely on training data for AWS service behavior** — always search AWS docs via MCP first
3. **If in doubt whether a skill applies — activate it anyway.** False activation is harmless; missing activation produces wrong output.
4. **Activate ONCE per session, at FIRST encounter of a trigger keyword**

---

## 🔴 ACTIVATION CHECKLIST (run mentally on EVERY response)

Before responding, ask yourself:
- Am I about to design for Lambda? → **STOP. Activate `aws-lambda` skill FIRST.**
- Am I about to design an API? → **STOP. Activate `api-gateway` skill FIRST.**
- Am I about to design a multi-step workflow? → **STOP. Activate `aws-lambda-durable-functions` skill FIRST.**
- Am I about to design Aurora DSQL? → **STOP. Activate `dsql` skill FIRST.**
- Am I about to write SAM/CDK/IaC? → **STOP. Activate `aws-serverless-deployment` skill FIRST.**
- Am I making ANY claim about AWS limits/quotas/features? → **STOP. Search AWS docs via MCP FIRST.**
- Am I writing CloudFormation/CDK resource properties? → **STOP. Use IaC MCP to validate FIRST.**

---

## 📚 AWS Knowledge MCP — use proactively

The most important one. Use whenever validating AWS-specific guidance — service limits, quotas, regional availability, feature behavior, current API shape, or when proposing options in decision files.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**Rule:** Don't rely on training data alone for AWS service limits, quotas, or current feature behavior. Search AWS docs first — especially when writing decision options that compare services.

---

## ⚡ AWS Lambda

**Triggers:** Lambda, handler, event source, Powertools, cold start, layer, function URL, EventBridge rule, SQS trigger, DLQ, concurrency, SnapStart, runtime, response streaming.

**Activate:** `aws___retrieve_skill` → `skill_name` = `aws-lambda`

Activate during design decisions too — e.g., when proposing compute options or event-driven patterns.

---

## 🌐 Amazon API Gateway

**Triggers:** API Gateway, REST API, HTTP API, WebSocket API, custom domain, Lambda authorizer, usage plan, throttling, CORS, VPC link, private API, stage, mapping template.

**Activate:** `aws___retrieve_skill` → `skill_name` = `api-gateway`

Activate during design decisions too — e.g., when comparing API styles or auth strategies.

---

## 🚀 AWS Serverless Deployment

**Triggers:** SAM, CDK, template.yaml, NodejsFunction, PythonFunction, sam deploy, cdk deploy, serverless CI/CD, pipeline, stack, construct.

**Activate:** `aws___retrieve_skill` → `skill_name` = `aws-serverless-deployment`

Activate during task decisions too — e.g., when proposing deployment strategies or IaC tooling options.

---

## ⏳ AWS Lambda Durable Functions

**Triggers:** durable function, workflow orchestration, long-running process, human approval, checkpoint, replay, stateful Lambda, multi-step workflow, approval routing, saga pattern.

**Activate:** `aws___retrieve_skill` → `skill_name` = `aws-lambda-durable-functions`

Activate during design decisions too — e.g., when comparing Step Functions vs durable functions vs polling patterns.

---

## 🗄️ Aurora DSQL

**Triggers:** Aurora DSQL, distributed SQL, DSQL cluster, multi-region database, serverless SQL.

**Activate:** `aws___retrieve_skill` → `skill_name` = `dsql` AND use `aurora-dsql` MCP tools.

Activate during design decisions too — Aurora DSQL has different semantics from standard Aurora PostgreSQL (no sequences, different transaction model). Decision options must reflect these constraints.

---

## 🏗️ AWS IaC MCP

**Triggers:** CDK construct, CloudFormation resource, CFN property, Terraform provider, resource type, L2/L3 construct.

**MCP:** `awslabs.aws-iac-mcp-server`

Use when generating or validating CDK/CloudFormation — including during design phase when specifying resource configurations.

---

## Multiple Skills

When multiple skills apply (e.g., Lambda + API Gateway + SAM), activate all of them. This is common during design decisions where you're proposing an architecture that spans multiple services.
