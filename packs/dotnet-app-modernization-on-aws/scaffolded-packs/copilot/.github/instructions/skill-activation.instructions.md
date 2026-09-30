---
applyTo: '**'
---
# 🚨 MANDATORY: Skill & MCP Activation

## CRITICAL ENFORCEMENT — READ BEFORE EVERY RESPONSE

**You MUST activate the relevant skill or MCP BEFORE generating `_decisions-*.md`, `design.md`, or executing code/IaC.**

**RULES:**
1. **NEVER generate code, IaC, or design decision files without first activating the matching skill/MCP**
2. **NEVER rely on training data for AWS service behavior** — always search AWS docs via MCP first
3. **If in doubt whether a skill applies — activate it anyway.** False activation is harmless; missing activation produces wrong output.
4. **Activate ONCE per session, at FIRST encounter of a trigger keyword**

This pack targets **modernizing .NET applications onto AWS** — the default arc is
**ASP.NET Framework → ASP.NET Core (often via AWS Transform for .NET) → Linux
containers on Amazon ECS Fargate**, with state/config externalized and the app
instrumented. Skills fall into two families:

- **.NET modernization skills** (`dotnet-*`) — the hands-on transformation steps.
- **ECS platform skills** (`ecs-*`) — the container platform lifecycle: discover → architect → build → deploy → secure → observe → review.
- Plus supporting **data, identity, IaC, observability, and API** skills.

Activate the skills that match the path chosen in the design decisions — don't assume a single stack.

> **IaC mix — read this:** the `dotnet-*` skills emit **CloudFormation or CDK**; the `ecs-build` skill emits **Terraform**. Pick ONE IaC tool per project, activate the matching skill, and don't blend their outputs. Validate resource shapes via the AWS Knowledge MCP either way.


## 🔴 ACTIVATION CHECKLIST (run mentally on EVERY response)

- Stabilizing an app just transformed by **AWS Transform for .NET** (build errors, DI, static files, middleware)? → **STOP. Activate `dotnet-post-transform` FIRST.**
- Deploying a **.NET workload to ECS Fargate** (VPC, cluster, task def, ALB, autoscaling; Dockerfile; health check)? → **STOP. Activate `dotnet-aws-ecs` FIRST.**
- Adding **OpenTelemetry / ADOT sidecar** to a containerized .NET app? → **STOP. Activate `dotnet-adot-sidecar` FIRST.**
- Externalizing **ASP.NET session state** to ElastiCache (Valkey/Redis)? → **STOP. Activate `dotnet-aspnet-sessionstate-aws` FIRST.**
- Externalizing **configuration/secrets** to SSM Parameter Store / Secrets Manager? → **STOP. Activate `dotnet-aws-parameterstore` FIRST.**
- Choosing an **ECS deployment model** (Fargate vs EC2 vs Managed Instances; task sizing; networking)? → **STOP. Activate `ecs-architect` FIRST.**
- Generating **ECS infrastructure in Terraform**? → **STOP. Activate `ecs-build` FIRST.**
- Designing **deployment/release** for ECS (blue/green, canary, rolling, CI/CD, rollback)? → **STOP. Activate `ecs-devops` FIRST.**
- Designing **ECS observability** (logs/metrics/traces stack selection)? → **STOP. Activate `ecs-observability` FIRST.**
- Hardening **ECS security/compliance** (task vs execution role, PassRole, secrets injection, GuardDuty)? → **STOP. Activate `ecs-security` FIRST.**
- **Discovering/documenting** an existing ECS environment? → **STOP. Activate `ecs-recon` FIRST.**
- **Auditing** a live ECS estate (GREEN/AMBER/RED operational review)? → **STOP. Activate `ecs-operation-review` FIRST.**
- Writing **raw CloudFormation**? → **STOP. Activate `aws-cloudformation` FIRST.**
- Writing **IAM** roles/trust/least-privilege policies? → **STOP. Activate `aws-iam` FIRST.**
- Designing **logging/metrics/tracing/alarms/dashboards** (general)? → **STOP. Activate `aws-observability` FIRST.**
- Designing/wiring an **API** (REST/HTTP/WebSocket, authorizers, custom domains)? → **STOP. Activate `api-gateway` FIRST.**
- Designing **Aurora DSQL**? → **STOP. Activate `aurora-dsql` FIRST (and use the Aurora DSQL MCP).**
- Designing/querying **Aurora PostgreSQL**? → **STOP. Activate `amazon-aurora-postgresql` FIRST.**
- Designing/querying **Aurora MySQL**? → **STOP. Activate `amazon-aurora-mysql` FIRST.**
- Standing up a **new Aurora cluster + instances**? → **STOP. Activate `creating-amazon-aurora-db-cluster-with-instances` FIRST.**
- Making ANY claim about AWS limits/quotas/features? → **STOP. Search AWS docs via MCP FIRST.**
- Writing CloudFormation/CDK resource properties? → **STOP. Validate via the AWS Knowledge MCP FIRST.**


## 📚 AWS Knowledge MCP — use proactively

The most important one. Use whenever validating AWS-specific guidance — service limits, quotas, regional availability, feature behavior, current API shape, or when proposing options in decision files.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**Rule:** Don't rely on training data alone for AWS service limits, quotas, or current feature behavior. Search AWS docs first — especially when writing decision options that compare services (e.g. Fargate vs EC2 launch type, SQL Server vs Aurora, Parameter Store vs Secrets Manager).


## 🔧 .NET Modernization Skills

### dotnet-post-transform
**Triggers:** AWS Transform for .NET output, transformed project won't build/run, missing DI registrations, broken images/CSS/JS after migration, middleware pipeline ordering, `ConfigurationManager` shim, Content folder vs `wwwroot`.
**Activate:** load `dotnet-post-transform`. Use **after** running AWS Transform to get a transformed ASP.NET Core project compiling and running correctly. NOT for greenfield ASP.NET Core, EF Core migration authoring, or prod hardening.

### dotnet-aws-ecs
**Triggers:** deploy .NET to ECS Fargate, Linux containers, Dockerfile for .NET, task definition, ALB, VPC, ECS cluster, auto-scaling, health-check endpoint, generate CloudFormation/CDK for ECS.
**Activate:** load `dotnet-aws-ecs`. Produces IaC (CloudFormation or CDK) + a deployment guide. NOT for Windows containers, EC2 launch type, or EKS.

### dotnet-adot-sidecar
**Triggers:** OpenTelemetry for .NET, ADOT collector sidecar, distributed tracing on a containerized .NET app, add telemetry to an ECS task.
**Activate:** load `dotnet-adot-sidecar`. Adds OTel instrumentation + ADOT sidecar to the task definition with IAM permissions. Requires existing ECS infrastructure (pairs with `dotnet-aws-ecs`).

### dotnet-aspnet-sessionstate-aws
**Triggers:** ASP.NET session state, distributed session, `Session[...]`, sticky sessions, externalize session, ElastiCache Valkey/Redis for sessions.
**Activate:** load `dotnet-aspnet-sessionstate-aws`. Moves session state to ElastiCache so the app scales horizontally in containers. NOT for output/response caching.

### dotnet-aws-parameterstore
**Triggers:** externalize configuration, hardcoded connection strings/API URLs/feature flags, `appsettings.json`/`web.config` values, SSM Parameter Store, Secrets Manager, runtime config resolution.
**Activate:** load `dotnet-aws-parameterstore`. Migrates config/secrets out of the app and wires runtime resolution. NOT for AppConfig feature-flag rollouts or Lambda-only apps.


## 🐳 ECS Platform Skills

### ecs-architect
**Triggers:** which ECS launch type, Fargate vs EC2, Managed Instances, task sizing, capacity providers, awsvpc/ENI density, Service Connect, launch-type migration; the shared ECS best-practices corpus.
**Activate:** load `ecs-architect`. Use for **Day-0 design / launch-type selection** of the target ECS model.

### ecs-build
**Triggers:** build ECS infra with **Terraform**, apply-ready ECS clusters/services/task defs, FARGATE_SPOT strategy, blue/green/canary Terraform config, VPC endpoints for private ECS, Application Auto Scaling, Graviton.
**Activate:** load `ecs-build`. **Terraform generator** for a settled ECS design. (If the project standardizes on CloudFormation/CDK instead, use `dotnet-aws-ecs` + `aws-cloudformation` and skip this.)

### ecs-devops
**Triggers:** blue/green or canary on ECS, CI/CD for ECS, GitHub Actions deploy to Fargate, deployment circuit breaker, task sets, stuck ECS deployment, migrate off CodeDeploy blue/green.
**Activate:** load `ecs-devops`. Release strategy, lifecycle hooks, alarm rollback, and pipelines.

### ecs-observability
**Triggers:** how to monitor ECS services, Container Insights vs Prometheus, losing container logs, tracing on Fargate, FireLens, Datadog vs CloudWatch, GPU metrics, live-debug access to a task.
**Activate:** load `ecs-observability`. ECS-specific logs/metrics/traces **stack selection**. (For the app-side ADOT sidecar wiring, use `dotnet-adot-sidecar`; for general CloudWatch, `aws-observability`.)

### ecs-security
**Triggers:** "ECS unable to assume the role", task role vs execution role, `iam:PassRole`, confused-deputy `aws:SourceArn`, secrets injection gotchas, readonlyRootFilesystem/non-root, ECS Exec governance, GuardDuty ECS Runtime Monitoring, ECR Inspector, PCI/HIPAA/FedRAMP on ECS.
**Activate:** load `ecs-security`. 7-layer hardening + baseline + 30/60/90 roadmap.

### ecs-recon
**Triggers:** describe/inspect my ECS environment, document task definitions, what's running in this cluster (read-only discovery).
**Activate:** load `ecs-recon`. **Discovery only** — pairs well with Phase 0 reverse engineering when an ECS estate already exists. Does not score or design.

### ecs-operation-review
**Triggers:** audit my ECS estate, ECS health check, score my ECS posture, GREEN/AMBER/RED my clusters, operational-excellence review.
**Activate:** load `ecs-operation-review`. Structured 8-domain operational assessment of a live estate.


## 🏗️ Infrastructure as Code

### AWS CloudFormation
**Triggers:** CloudFormation, `template.yaml`/`json`, cfn-lint, cfn-guard, change set, `DeletionPolicy`, stack failure (`CREATE_FAILED`, `ROLLBACK_COMPLETE`, `UPDATE_ROLLBACK_FAILED`).
**Activate:** load `aws-cloudformation`. The pack's default raw-IaC skill; pairs with the `dotnet-*` skills' CloudFormation output.

### Validating IaC resource shapes
**Triggers:** CloudFormation/CDK resource, CFN property, resource type, L2/L3 construct.
**How:** validate against the **AWS Knowledge MCP** — `aws___search_documentation` / `aws___read_documentation` for resource properties, and `aws___get_regional_availability` for service/resource availability. Don't rely on training data for CFN/CDK resource shapes.

> An additional **AWS MCP Server** (`aws-mcp-server`, via `mcp-proxy-for-aws`) ships **disabled** in the MCP config — enable it if you want its broader AWS tooling. Terraform IaC is available via `ecs-build`. Keep the IaC-tool choice an explicit design decision.


## 🗄️ Data

> Pick the data skill that matches the migration target chosen in design. Common .NET path: **SQL Server → Aurora PostgreSQL/MySQL** (via SCT/DMS/Babelfish). Aurora DSQL suits greenfield/reimagine.

### Aurora DSQL
**Triggers:** Aurora DSQL, distributed SQL, DSQL cluster, multi-region database, DSQL IAM auth, DSQL connector.
**Activate:** load `aurora-dsql` **AND use the `aurora-dsql` MCP tools**. Different semantics from standard Aurora (no sequences, optimistic concurrency, transaction-size limits) — reflect these in schema/logic.

### Amazon Aurora PostgreSQL
**Triggers:** Aurora PostgreSQL, Aurora Postgres, express configuration, pgvector, **Babelfish** (SQL Server compatibility), ACU sizing, I/O-Optimized, PostgreSQL upgrade planning.
**Activate:** load `amazon-aurora-postgresql`. Note **Babelfish** is the common landing spot for SQL Server workloads.

### Amazon Aurora MySQL
**Triggers:** Aurora MySQL, MySQL-compatible cluster, parallel query, ACU sizing, I/O-Optimized, MySQL upgrade planning.
**Activate:** load `amazon-aurora-mysql`.

### Creating an Aurora Cluster with Instances
**Triggers:** create Aurora cluster, provision Aurora instances, managed master password, Secrets Manager for Aurora, production-ready Aurora setup.
**Activate:** load `creating-amazon-aurora-db-cluster-with-instances`.


## 🔐 Identity & Access

### AWS IAM
**Triggers:** IAM role, trust policy, least-privilege policy, service role, ECS task/execution role, bucket policy, STS session, confused deputy, `aws:SourceAccount`/`aws:SourceArn`, condition operators.
**Activate:** load `aws-iam`.

> **App-level auth note:** IAM covers AWS authorization. For end-user/app identity (Forms auth migration, Cognito, OIDC/JWT), IAM does not apply — treat the IdP integration as an explicit design decision and validate patterns via the AWS Knowledge MCP.


## 🌐 API

### Amazon API Gateway
**Triggers:** API Gateway, REST API, HTTP API, WebSocket API, custom domain, Lambda authorizer, usage plan, throttling, CORS, VPC link, private API, stage, mapping template.
**Activate:** load `api-gateway`. Use when fronting the modernized service with a managed API tier.


## 📈 Observability (general)

### AWS Observability
**Triggers:** CloudWatch, Log Insights, metrics, alarms, dashboards, EMF, X-Ray, tracing, CloudTrail, ADOT, OpenTelemetry, synthetics/canaries, Application Signals, instrument a service.
**Activate:** load `aws-observability`. For **ECS-specific** stack selection use `ecs-observability`; for the **.NET app ADOT sidecar** use `dotnet-adot-sidecar`; this skill covers the broader CloudWatch/X-Ray platform.


## Multiple Skills

A typical .NET → ECS modernization spans several skills at once — e.g.
`dotnet-post-transform` → `dotnet-aws-parameterstore` + `dotnet-aspnet-sessionstate-aws` → `dotnet-aws-ecs` (+ `aws-cloudformation` or `ecs-build`) → `dotnet-adot-sidecar` / `ecs-observability` → `ecs-security` + `aws-iam`, with a data skill for the DB target. Activate all that apply. This is expected during design decisions where you're proposing an end-to-end target architecture.
