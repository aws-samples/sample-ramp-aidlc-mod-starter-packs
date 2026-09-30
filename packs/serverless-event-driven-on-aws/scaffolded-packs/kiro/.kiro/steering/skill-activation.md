---
inclusion: always
---
# Skill Activation — When to Load Each Skill

This companion steering file defines **when** the agent should activate each
vendored skill. Skills provide deep, service-specific guidance that the agent
loads on demand — not all at once — to keep context focused and relevant.

## 🚨 ACTIVATION: This file applies whenever the AI-DLC workflow is active.

---

## Activation Rules

Load a skill **before** generating design or code that touches that skill's
domain. Skills are cumulative within a session — once loaded, they stay active.

---

## Skill Activation Table

| Skill | Activate when… |
|-------|----------------|
| **aws-event-driven-patterns** | **Load first for any event-driven design work.** Composition and decision guidance for event-driven systems — event-pattern selection (notification / state-transfer / sourcing / CQRS), MSK topic & partition strategy, the **stream-processing decision (Flink vs Lambda vs ECS consumer)**, subscription-matching engine design and scale tiers, multi-channel notification delivery, idempotency & effectively-once processing, event-driven observability, and CDK stack decomposition. This is the *how-to-compose* skill; the service skills below are the *how-each-service-works* depth. |
| **dotnet-testing** | Authoring automated **.NET / C#** tests — xUnit (default; NUnit/MSTest alternatives), Moq for isolation, coverlet for coverage, WebApplicationFactory / Testcontainers for integration, test-pyramid strategy, and CI gating (`dotnet test`) to keep trunk green. Activate for QA/devs authoring backend test code. For web/browser E2E use **web-test-automation**; for mobile apps use **mobile-test-automation**. |
| **aws-lambda** | Designing or authoring Lambda handlers, event source mappings (MSK, SQS, Kinesis), serverless APIs, event-driven compute, stream consumer functions, or any compute that runs as Lambda. Use for Lambda runtime behavior, event sources, and SAM-based build/test. |
| **aws-lambda-durable-functions** | Long-running, multi-step, stateful Lambda orchestration — order sagas, settlement tracking, and long-running transaction lifecycles. Covers the replay model, step operations, wait/callback (human-in-the-loop) patterns, saga-style compensation, retry/checkpoint, and testing with LocalDurableTestRunner. |
| **aws-messaging-and-streaming** | Any messaging or streaming topology — this pack's authority for **MSK/Apache Kafka** (topic design, consumer groups, partitioning, market-data pricing streams), **EventBridge** (buses, rules, Pipes for MSK→EventBridge, fan-out), **SNS/SQS** (order dispatch, DLQs, queue decoupling), **Kinesis**, and **Managed Service for Apache Flink**. There is no separate MSK, EventBridge, or Flink skill — route all of those here. |
| **amazon-dynamodb** | Designing data stores for subscription state, alert config, order/settlement tracking, user preferences, or any access-pattern-driven single- vs. multi-table design. Covers partition/sort key and GSI choice, DynamoDB Streams, transactional outbox, TTL, Global Tables, capacity/cost estimation, and debugging hot partitions/throttling. |
| **aws-containers** | Long-running services on ECS/Fargate/ECR — notification delivery services, persistent-protocol gateway services, WebSocket servers, or any workload needing persistent connections or stateful processing that cannot fit Lambda's execution model. Covers task definitions, Fargate services, ECR lifecycle, ECS Exec debugging, scaling, and load-balancer integration. |
| **api-gateway** | REST, HTTP, or WebSocket APIs for client-facing endpoints (alert management, order placement, holdings queries, real-time price feeds), Lambda authorizers, throttling, usage plans, CORS, VPC links, or custom domains — plus troubleshooting 4xx/5xx/timeout/CORS failures. |
| **aws-cdk** | The default IaC tool for this pack — authoring CDK (TypeScript/Python) stacks, construct patterns, stack composition, cross-stack references, `cdk deploy/synth/diff`, resource import, drift, and safe refactoring. Also handles CDK-generated CloudFormation errors. |
| **aws-cloudformation** | Situational — authoring, validating (cfn-lint/cfn-guard/change sets), or root-cause-diagnosing raw CloudFormation (YAML/JSON) stacks when not going through CDK. Prefer **aws-cdk** unless a task explicitly works with plain CloudFormation templates. |
| **terraform-skill** | Situational — writing, reviewing, or debugging Terraform/OpenTofu modules, tests, CI, scans, or state operations. Use only when the workload is Terraform-based; **aws-cdk** remains the default IaC path for this pack. |
| **aws-serverless-deployment** | SAM packaging, serverless CDK patterns and constructs (NodejsFunction/PythonFunction), Lambda deployment config (aliases, traffic shifting), SAM/CDK coexistence, or CI/CD pipeline design for serverless workloads. |
| **aws-iam** | Defining execution roles, trust policies, least-privilege and resource-based policies for Lambda/ECS/EventBridge/MSK, condition-operator edge cases, STS, or cross-account access. |
| **aws-observability** | CloudWatch metrics/Log Insights/EMF, structured logging, custom metrics (alert latency, delivery success rate), alarms (p95 latency, error rate), dashboards, X-Ray tracing, CloudTrail, ADOT, or Application Signals enablement across Lambda/ECS. |
| **signing-in-to-aws** | Getting local CLI/SDK credentials via `aws login`, or troubleshooting expired/missing credentials and `AccessDeniedException` with no configured creds. |
| **web-test-automation** | Designing or writing automated **web** tests — Playwright (default, TypeScript) E2E/UI, page object model, fixtures, in-browser API testing, visual regression, accessibility (axe-core), network mocking, and CI sharding. Activate for QA participants authoring web test suites alongside feature code. |
| **mobile-test-automation** | Designing or writing automated **mobile** tests — native iOS/Android, React Native, or Flutter — via Appium, Maestro, Detox, Espresso, or XCUITest. Covers device-farm strategy (AWS Device Farm), gestures, deep links, permissions, app lifecycle, and mobile flakiness. Activate for QA authoring mobile-app test suites. |

---

## MCP Server Usage

| MCP Server | Use when… |
|------------|-----------|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validating any AWS service behavior — limits, quotas, regional availability, API semantics, pricing model, or current best practices. Use before making architectural claims about service capabilities. |
| **AWS IaC** (`awslabs.aws-iac-mcp-server`) | Validating CDK construct properties, CloudFormation resource attributes, or IaC patterns before generating infrastructure code. Ensures generated code uses valid property names and types. |

---

## Commonly Cross-Cutting Skills

Regardless of the specific system, these tend to apply throughout:

- **Design/composition:** `aws-event-driven-patterns` — load first for any event-driven design.
- **Foundation:** `aws-cdk`, `aws-iam`, `aws-observability`, `signing-in-to-aws`.
- **Testing (activate for whatever is being built):** `dotnet-testing` (.NET/C#), `web-test-automation` (web E2E), `mobile-test-automation` (mobile apps).
- **Situational IaC:** `aws-cloudformation` and `terraform-skill` — only when not using CDK.

Load the domain/service skills (messaging-and-streaming, dynamodb, lambda, durable-functions, api-gateway, containers) as the design touches each service.

---

## Activation Timing

- **Before Phase 2 (Design):** Load skills relevant to the architectural decisions being made
- **Before Phase 3 (Tasks) / Code Generation:** Load all skills touched by the implementation
- **When user mentions a specific service:** Load the corresponding skill immediately
- **When the design includes a service boundary:** Load skills for both sides of the boundary

**Anti-pattern:** Do NOT load all skills at the start. Load progressively as the design unfolds.
