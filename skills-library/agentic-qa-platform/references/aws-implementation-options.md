# AWS Implementation Options

Use this reference only when AWS is in scope. It provides a recommended AWS starting point plus explicit alternatives; it does not authorize the final customer architecture.

Validate current AWS documentation, regional availability, quotas, pricing, organizational controls, and approved service patterns before making a build decision.

## Recommendation

Use **Amazon Bedrock AgentCore** as the agent runtime and governance layer for bounded QA agents:

- **AgentCore Runtime** for isolated agent sessions and workload identity;
- **AgentCore Gateway** for typed tool exposure and credential mediation;
- **AgentCore Identity** for outbound credentials to authorized non-AWS systems;
- **AgentCore Policy** for contextual, default-deny authorization of Gateway-mediated tool calls;
- **AgentCore Observability** for agent, tool, policy and workflow correlation.

Keep model selection replaceable behind the agent runtime. Amazon Bedrock may provide models, but the architecture should describe AgentCore—not a model endpoint—as the agent hosting, identity, tool and policy boundary.

Use an independently enforced workflow such as **AWS Step Functions Standard Workflows** for durable state, approvals, budgets, retries and terminal outcomes. Do not implement those authorities as an agent loop. Cancellation and cleanup must be cooperative: stopping a workflow does not itself run a `finally` path or guarantee termination of external work. Use explicit cancel/terminate operations plus an independent lease reconciler. If an agent or runner interaction can outlive a direct service call, use an adapter, callback or polling pattern instead of assuming synchronous completion.

For generated or repaired browser/API automation, evaluate a **fresh AWS Lambda MicroVM per execution attempt** as the first AWS sandbox option.

### Why Lambda MicroVMs fit this workload

- Firecracker microVM isolation provides a strong boundary for untrusted or newly generated executable artifacts.
- Versioned container images can pin browsers, test-framework dependencies and evidence tooling.
- Snapshot-based startup can preserve expensive image initialization without reusing an active test attempt, provided snapshots contain no run secrets or tenant state.
- Constrained VPC egress can place execution close to private non-production application targets.
- A fresh role session, filesystem and process boundary can be created for each attempt.
- The execution role can exclude merge, deployment, policy, broad repository and production-data permissions.

### Required Lambda MicroVM controls

- Validate service availability and current limits in every target Region.
- Pin the MicroVM image, browser, runtime, test framework and dependency versions.
- Separate image-build and run-execution roles. Rebuild images against supported base-image releases and scan them before activation.
- Keep snapshots free of credentials, customer data and run state; bind every launch to a unique run/attempt identity and fresh short-lived role session.
- Use one fresh MicroVM for each run attempt; never reuse suspended state across tenants, source revisions, approval subjects or test-data leases.
- Use a dedicated minimal execution role and a constrained VPC egress design. Do not assume default networking is target-only.
- Disable shell ingress by default. The token-protected HTTPS control endpoint must be governed by tightly scoped token-mint permissions, short token TTLs, restricted port scopes and complete auditing; enable diagnostic access only through a separately approved profile.
- Retrieve immutable run inputs by digest; never accept test semantics from mutable launch payloads.
- Apply CPU, memory, duration, concurrency, network and evidence budgets outside the MicroVM.
- Terminate the runner on completion, cancellation, timeout or policy revocation, and use an independent reconciler to terminate orphaned runners.
- Return normalized results, evidence references and cleanup status through an authenticated callback broker. Do not expose raw Step Functions task tokens to test code.
- Keep raw evidence within its approved boundary. Protect retained evidence with checksums, versioning/Object Lock or equivalent write-once controls, and separate publisher permissions; KMS encryption alone does not provide tamper evidence.

### Choose another runner when

| Alternative | Prefer when |
|---|---|
| CodeBuild | Existing CI batch execution already satisfies isolation, private networking, identity, evidence and lifecycle requirements with lower operating complexity |
| ECS/Fargate | The organization has a governed container execution platform, needs service-integrated scheduling, or the workload does not fit current MicroVM constraints |
| EKS jobs | Kubernetes is already the approved multi-tenant execution control plane and its admission, policy, isolation and observability controls meet the threat model |
| Organization-managed CI runner | The existing runner provides fresh or reliably reset isolation, target-only access, immutable inputs and equivalent evidence guarantees |
| EC2 or another sandbox platform | Required operating-system features, duration, hardware or software are unsupported by the managed options |

Do not silently fall back from one execution technology to another. Each runner profile must declare its trust class, compatibility, network reach, budgets, evidence behavior and approved artifact types.

## Capability mapping

| Capability | Recommended AWS option | Questions to validate |
|---|---|---|
| Authenticated event ingress | API Gateway and Lambda, EventBridge, or existing CI integration | Webhook verification, replay protection, deduplication, source restriction |
| Durable workflow control | Step Functions Standard Workflows | Callbacks, retries, cancellation, execution history, quotas and cost |
| Agent runtime and sessions | AgentCore Runtime | Workload identity, session isolation, network placement, supported frameworks and models |
| Agent tools | AgentCore Gateway | Typed schemas, credential mediation, validation, audit and tool ownership |
| Agent authorization | IAM plus AgentCore Policy for Gateway-mediated calls | Default deny, denial of direct tool paths, contextual authorization, policy tests and approval binding |
| Agent identity | AgentCore Identity plus dedicated IAM runtime roles using short-lived STS credentials | External-system scopes, AWS execution-role scope, token lifecycle, workload identity and separation of duties |
| Registry and run state | DynamoDB or an approved database/configuration service | Conditional writes, tenancy, consistency, backup and compatibility |
| Contracts and evidence | Amazon S3 with KMS plus versioning/Object Lock or equivalent integrity controls where required | Raw-versus-normalized boundary, checksums, separated publisher permissions, lifecycle, access and residency |
| Isolated execution | Lambda MicroVMs as the first candidate; alternatives above when fit criteria fail | Browser/runtime compatibility, private access, egress, duration, lifecycle, image governance and evidence callbacks |
| Secrets and encryption | Secrets Manager, KMS and short-lived STS credentials/sessions | Raw credential exclusion, scope, duration and confused-deputy controls |
| Queueing and buffering | SQS and/or EventBridge | Backpressure, ordering, retention, deduplication and dead-letter handling |
| Observability and audit | AgentCore Observability, CloudWatch, X-Ray/OpenTelemetry and CloudTrail where applicable | End-to-end correlation, redaction, tenant access, retention and alarm ownership |
| Human approval | Existing forge/work-management approval, callback API, or governed UI | Authoritative source, exact subject binding, expiry and replay protection |

## Decision statement

Record the final choices as customer decisions:

- AgentCore adoption and which capabilities are enabled;
- agent framework and model provider;
- workflow technology;
- Lambda MicroVM or alternative runner profile;
- account and network placement;
- approval, outage and fallback semantics;
- service levels, quotas, retention and support ownership.

The recommendation is a starting point for validation. It is not an implied approval to deploy, expose networks, grant identities or make the QA result release-gating.
