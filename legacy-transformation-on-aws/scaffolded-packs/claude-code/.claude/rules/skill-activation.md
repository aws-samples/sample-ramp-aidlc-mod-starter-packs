# Mandatory Skill, Tooling & MCP Activation

Activate the relevant skill or tooling **BEFORE** generating any decision file, spec document, or code. Each activation only lasts for the current session — re-activate at the start of every new session when the topic is relevant.

> Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

## 🧠 API Gateway Skill

**Trigger keywords:** API Gateway, REST API, HTTP API, strangler fig routing, traffic splitting, custom domain, Lambda authorizer, JWT authorizer, usage plan, throttling, VPC link, private API, canary deployment, stage variables, CORS

**Action:** Activate/load the `api-gateway` skill.

**Why:** The strangler fig pattern routes traffic through API Gateway to either the monolith or new microservices. The 16 reference files (authentication, security, custom domains, observability, performance, governance, deployment, service integrations) are critical for getting the routing layer right.

**🔒 RULE:** NEVER configure API Gateway routing, strangler fig patterns, or API migration without first activating this skill.

## 🧠 AWS Lambda Skill

**Trigger keywords:** Lambda function, serverless, event source, Lambda handler, Lambda Web Adapter, event-driven, SAM init, cold start, Lambda layer, function URL

**Action:** Activate/load the `aws-lambda` skill.

**Why:** Extracted microservices will likely run on Lambda. This skill covers SAM project setup, event sources, web adapter (for migrating Spring Boot controllers), observability, and performance optimization.

**🔒 RULE:** NEVER create Lambda functions or SAM templates for extracted microservices without first activating this skill.

## 🧠 AWS Serverless Deployment Skill

**Trigger keywords:** SAM template, SAM deploy, CDK serverless, CDK Lambda construct, NodejsFunction, PythonFunction, serverless CI/CD, sam build, cdk deploy

**Action:** Activate/load the `aws-serverless-deployment` skill.

**Why:** Each extracted microservice needs independent deployment. This skill covers SAM/CDK project setup, deployment workflows, CI/CD pipelines, and SAM/CDK coexistence patterns.

**🔒 RULE:** NEVER write SAM templates, CDK stacks, or deployment configs without first activating this skill.

---

## 📚 AWS Knowledge MCP

**Trigger:** Use proactively to validate AWS best practices, service limits, and feature behavior — especially when making architectural decisions during decomposition, choosing between DynamoDB vs Aurora, validating migration patterns, or recommending service configurations.

**Available tools:**
- `search_documentation` — Search AWS docs (general, reference, troubleshooting, current_awareness, cdk_docs, cloudformation, agent_sops)
- `read_documentation` — Fetch specific AWS doc pages
- `get_regional_availability` — Check service/feature availability across regions

**🔒 RULE:** When uncertain about AWS-specific guidance, ALWAYS search AWS docs first before answering. Do not rely solely on training data for service limits, quotas, migration patterns, or current feature behavior.

---

## Activation Checklist

1. Read the user's message and spec context for keyword matches
2. Activate ALL matching skills/powers before proceeding
3. Skills and powers are independent — activate multiple if multiple are relevant
4. Only activate once per session — no need to re-activate mid-conversation
5. When unsure about AWS specifics, use AWS Knowledge MCP tools to verify
6. For modernization work, expect to activate **multiple skills together** (e.g., Lambda + API Gateway + Serverless Deployment when extracting a service)
