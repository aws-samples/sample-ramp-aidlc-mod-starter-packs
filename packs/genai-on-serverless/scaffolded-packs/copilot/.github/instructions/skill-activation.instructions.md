---
applyTo: '**'
---
# Skill & MCP Activation

Activate the relevant skill or MCP **before** generating any decision file,
spec document, or code. Activate once per session.

Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

---

## 📚 AWS Knowledge MCP — use proactively

The most important one. Use **whenever** validating AWS-specific guidance —
service limits, quotas, regional availability, feature behavior, current API
shape, or anytime the user questions a recommendation.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**🔒 RULE:** NEVER rely on training data alone for AWS service limits,
quotas, or current feature behavior. Search AWS docs first.

---

## ⚡ AWS Lambda — when authoring Lambda code

**Trigger keywords:** Lambda function, handler, event source, Powertools,
cold start, layer, function URL, EventBridge rule, SQS trigger.

**Activate the `aws-lambda` skill** before authoring Lambda handlers or event-source wiring.

---

## 🌐 Amazon API Gateway — when designing or wiring HTTP/REST/WebSocket APIs

**Trigger keywords:** API Gateway, REST API, HTTP API, WebSocket API,
custom domain, Lambda authorizer, usage plan, throttling, CORS, VPC link,
private API.

**Activate the `api-gateway` skill** before designing API Gateway routes, integrations, authorizers, or stage configuration.

---

## 🚀 AWS Serverless Deployment — when writing IaC or pipelines

**Trigger keywords:** SAM template, CDK Lambda construct, NodejsFunction,
PythonFunction, sam deploy, cdk deploy, serverless CI/CD.

**Activate the `aws-serverless-deployment` skill** before writing SAM/CDK templates or pipeline configs.
