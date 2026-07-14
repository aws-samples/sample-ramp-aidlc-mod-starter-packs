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

This pack targets a **greenfield cloud-native enterprise application** (a line-of-business or transactional system). Its **default lean is serverless — AWS Lambda + API Gateway + Aurora DSQL** — but it now carries the **full compute / data / IaC skill set**, so the design can flex (containers, other Aurora engines, CDK / CloudFormation / Terraform). Activate the skills that match the path chosen in the design decisions — don't assume a single stack.


## 🔴 ACTIVATION CHECKLIST (run mentally on EVERY response)

Before responding, ask yourself:
- Am I about to design for **Lambda**? → **STOP. Activate `aws-lambda` skill FIRST.**
- Am I about to design an **API**? → **STOP. Activate `api-gateway` skill FIRST.**
- Am I about to design a **multi-step / long-running workflow**? → **STOP. Activate `aws-lambda-durable-functions` skill FIRST.**
- Am I about to design/deploy **containers** (ECS, Fargate, ECR, task definitions, ALB)? → **STOP. Activate `aws-containers` skill FIRST.**
- Am I about to write **SAM / serverless CDK deploys / serverless CI-CD**? → **STOP. Activate `aws-serverless-deployment` skill FIRST.**
- Am I about to write **CDK**? → **STOP. Activate `aws-cdk` skill FIRST.**
- Am I about to write **raw CloudFormation**? → **STOP. Activate `aws-cloudformation` skill FIRST.**
- Am I about to write **Terraform / OpenTofu**? → **STOP. Activate `terraform-skill` FIRST.**
- Am I about to design **Aurora DSQL**? → **STOP. Activate `aurora-dsql` skill FIRST (and use the Aurora DSQL MCP).**
- Am I about to design/query **Aurora PostgreSQL**? → **STOP. Activate `amazon-aurora-postgresql` skill FIRST.**
- Am I about to design/query **Aurora MySQL**? → **STOP. Activate `amazon-aurora-mysql` skill FIRST.**
- Am I standing up a **new Aurora cluster + instances**? → **STOP. Activate `creating-amazon-aurora-db-cluster-with-instances` skill FIRST.**
- Am I writing **IAM roles/policies** (service roles, execution roles, trust policies)? → **STOP. Activate `aws-iam` skill FIRST.**
- Am I designing **logging/metrics/tracing/alarms/dashboards**? → **STOP. Activate `aws-observability` skill FIRST.**
- Do I need **local AWS credentials** (CLI/SDK, expired token, `AccessDenied`)? → **STOP. Activate `signing-in-to-aws` skill FIRST.**
- Am I making ANY claim about AWS limits/quotas/features? → **STOP. Search AWS docs via MCP FIRST.**
- Am I writing CloudFormation/CDK resource properties? → **STOP. Use the AWS IaC MCP to validate FIRST.**


## 📚 AWS Knowledge MCP — use proactively

The most important one. Use whenever validating AWS-specific guidance — service limits, quotas, regional availability, feature behavior, current API shape, or when proposing options in decision files.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**Rule:** Don't rely on training data alone for AWS service limits, quotas, or current feature behavior. Search AWS docs first — especially when writing decision options that compare services (e.g., Lambda vs Fargate, Aurora DSQL vs standard Aurora).


## 🖥️ Compute

### AWS Lambda

**Triggers:** Lambda, handler, event source, Powertools, cold start, layer, function URL, EventBridge rule, SQS trigger, DLQ, concurrency, SnapStart, runtime, response streaming.

**Activate:** load the `aws-lambda` skill.

Activate during design decisions too — e.g., when proposing serverless compute or event-driven patterns for the application.

### AWS Containers (ECS / Fargate / ECR)

**Triggers:** container, Docker image, ECS, Fargate, task definition, service, ALB, ECR, ECS Exec, service scaling, blue/green, App Runner, sidecar, health check, OOM, secrets injection.

**Activate:** load the `aws-containers` skill.

Activate during design decisions too — e.g., when comparing ECS/Fargate vs Lambda for a long-running or non-serverless workload.


## 🌐 Amazon API Gateway

**Triggers:** API Gateway, REST API, HTTP API, WebSocket API, custom domain, Lambda authorizer, usage plan, throttling, CORS, VPC link, private API, stage, mapping template.

**Activate:** load the `api-gateway` skill.

Activate during design decisions too — e.g., when comparing API styles or auth strategies.


## ⏳ AWS Lambda Durable Functions

**Triggers:** durable function, workflow orchestration, long-running process, human approval, checkpoint, replay, stateful Lambda, multi-step workflow, approval routing, saga pattern.

**Activate:** load the `aws-lambda-durable-functions` skill.

Activate during design decisions too — e.g., when comparing Step Functions vs durable functions vs polling for multi-step business flows (approvals, fulfilment, sagas, etc.).


## 🏗️ Infrastructure as Code

> **Primary IaC for this pack is AWS CDK**, validated via the AWS IaC MCP. CloudFormation and Terraform skills are also available if the design chooses them — keep the IaC-tool choice an explicit design decision.

### AWS Serverless Deployment (SAM / CDK for serverless)

**Triggers:** SAM, `template.yaml`, `sam deploy`, NodejsFunction / PythonFunction constructs, serverless CI/CD pipeline, serverless CDK deploy.

**Activate:** load the `aws-serverless-deployment` skill. Use for packaging/deploying Lambda + API Gateway stacks and serverless pipelines.

### AWS CDK

**Triggers:** CDK, construct, `cdk deploy`/`synth`/`diff`, L2/L3 construct, stack architecture, cdk-nag, drift, importing resources, refactor without replacement.

**Activate:** load the `aws-cdk` skill.

### AWS CloudFormation

**Triggers:** CloudFormation, template.yaml/json, cfn-lint, cfn-guard, change set, `DeletionPolicy`, stack failure (`CREATE_FAILED`, `ROLLBACK_COMPLETE`, `UPDATE_ROLLBACK_FAILED`).

**Activate:** load the `aws-cloudformation` skill.

### Terraform / OpenTofu

**Triggers:** Terraform, OpenTofu, `.tf` files, HCL, `terraform plan`/`apply`, module, provider, state file, remote state, backend, drift, `tfsec`/`checkov`/`trivy`, workspace.

**Activate:** load the `terraform-skill`. Available if the team standardises on Terraform instead of CDK; still validate AWS resource shapes via the AWS Knowledge MCP.

### AWS IaC MCP

**Triggers:** CDK construct, CloudFormation resource, CFN property, resource type, L2/L3 construct.

**MCP:** `awslabs.aws-iac-mcp-server`

Use when generating or validating CDK / CloudFormation — including during design phase when specifying resource configurations. Update `AWS_PROFILE` in `mcp.json` to your named profile.


## 🗄️ Data

### Aurora DSQL

**Triggers:** Aurora DSQL, distributed SQL, DSQL cluster, multi-region database, serverless SQL, DSQL IAM auth, DSQL connector.

**Activate:** load the `aurora-dsql` skill **AND use the `aurora-dsql` MCP tools**.

Aurora DSQL is the default data store for this pack. It has different semantics from standard Aurora PostgreSQL (no sequences, optimistic concurrency / no locking, transaction-size limits). Decision options and schema/redemption logic must reflect these constraints — do not conflate DSQL with standard Aurora.

### Amazon Aurora PostgreSQL

**Triggers:** Aurora PostgreSQL, Aurora Postgres, express configuration, pgvector, Babelfish, ACU sizing, I/O-Optimized, PostgreSQL upgrade planning.

**Activate:** load the `amazon-aurora-postgresql` skill.

### Amazon Aurora MySQL

**Triggers:** Aurora MySQL, MySQL-compatible cluster, parallel query, ACU sizing, I/O-Optimized, MySQL upgrade planning.

**Activate:** load the `amazon-aurora-mysql` skill.

### Creating an Aurora Cluster with Instances

**Triggers:** create Aurora cluster, provision Aurora instances, managed master password, Secrets Manager for Aurora, production-ready Aurora setup.

**Activate:** load the `creating-amazon-aurora-db-cluster-with-instances` skill.

> Pick the data skill that matches the engine chosen in design — `aurora-dsql` for DSQL (the default), the Aurora PostgreSQL/MySQL skills for standard Aurora.


## 🔐 Identity & Access

### AWS IAM

**Triggers:** IAM role, trust policy, least-privilege policy, service role, execution role, bucket policy, STS session, confused deputy, `aws:SourceAccount`/`aws:SourceArn`, condition operators.

**Activate:** load the `aws-iam` skill.

> **App-level auth note:** IAM covers AWS authorization. For end-user/app identity (e.g. Cognito user pools, OIDC/JWT), IAM does not apply — treat the IdP integration as an explicit design decision and validate patterns via the AWS Knowledge MCP.

### Signing in to AWS

**Triggers:** set up AWS, configure AWS, `aws login`, get credentials, authenticate, session/token expired, no credentials, `AccessDeniedException` with no configured credentials.

**Activate:** load the `signing-in-to-aws` skill. **Always ask the user for confirmation before running `aws login`.**


## 📈 Observability

### AWS Observability

**Triggers:** CloudWatch, Log Insights, metrics, alarms, dashboards, EMF, X-Ray, tracing, CloudTrail, ADOT, OpenTelemetry, synthetics/canaries, Application Signals, instrument a service.

**Activate:** load the `aws-observability` skill.

Activate during design decisions too — e.g., when defining the observability strategy (structured logging, alarms, tracing) for the app.


## Multiple Skills

When multiple skills apply (common in an end-to-end enterprise-app design — e.g. `aws-lambda` + `api-gateway` + `aurora-dsql` + `aws-iam` + `aws-observability`, plus `aws-serverless-deployment` for IaC), activate all of them. This is expected during design decisions where you're proposing an architecture that spans compute, API, data, identity, and operations.
