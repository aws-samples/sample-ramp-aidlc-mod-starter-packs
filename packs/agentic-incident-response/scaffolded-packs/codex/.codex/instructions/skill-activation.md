# Skill & MCP Activation

Activate the relevant skill or MCP **before** generating any decision file, spec document, or code.
Activate once per session, when the matching work begins. Skills load automatically when relevant; ensure
the matching skill's guidance is in play before you design, build, or deploy.

This pack builds a **deployed AWS capability** whose job is AI-assisted production support and incident
analysis. Two families of skills: the **domain logic** the capability automates, and the **AWS building
blocks** used to construct and deploy it.

---

## Domain logic — what the capability does

These carry the reusable incident-analysis knowledge. Use them at design/build time to shape the pipeline's
stages (and the same logic can be run interactively when validating the approach against a real incident).

### 🚨 `incident-triage`
**Triggers:** production incident, incident ticket, monitoring alert, triage, root cause / RCA, correlate
logs, error spike, latency spike, outage, sev1/P1, escalate, anomaly detection, alert threshold, known issue.
Interpret intake signals, identify the affected business flow, gather and correlate the seven evidence
classes, produce ranked evidence-backed root-cause hypotheses with confidence indicators, and recommend
diagnostics, remediation candidates, and routing/escalation. This defines the pipeline's **triage** and
**analysis** stages, plus the proactive **anomaly-detection** mode.

---

## AWS building blocks — how the capability is built & deployed

Activate the relevant one when designing/authoring that part of the architecture. Trigger model,
orchestration, reasoning model, and IaC are **design-gate decisions** — don't assume; let the workflow ask.

- **`aws-event-driven-patterns`** — **load first for the event-driven design work**: composition guidance for
  the intake/alerting side (event patterns, fan-out, idempotency, effectively-once processing,
  event-driven observability).
- **`aws-messaging-and-streaming`** — the messaging authority: EventBridge (rules/thresholds → alerts or
  incident creation), SNS/SQS (notification and work queues, DLQs), and Kafka/MSK + RabbitMQ concepts —
  relevant both for the pipeline itself and for reading the monitored platform's RabbitMQ/Kafka signals.
- **`aws-lambda`** — authoring the Lambda functions for each pipeline stage (intake, evidence retrieval,
  analysis, report/routing).
- **`aws-lambda-durable-functions`** — durable, checkpointed **Lambda** execution for long-running/stateful
  stages. This is a **Lambda execution model** — distinct from Step Functions below; choose per the design.
- **`aws-step-functions`** — **Step Functions** state-machine orchestration across pipeline stages, with
  retries, branching, and a manual-approval (task-token) state that implements the human-review gate before
  any production action.
- **`api-gateway`** — HTTP ingress when the trigger is a ticketing/chat webhook; skip if intake is purely
  event-driven (EventBridge/queue).
- **`aws-serverless-deployment`** — SAM/CDK project scaffolding and deployment (default IaC path).
- **`terraform-skill`** — Terraform IaC (alternative path; pick one per the IaC design gate).
- **`aws-iam`** — least-privilege roles for the Lambdas/Step Functions, cross-account **read-only** access to
  the monitored platform's CloudWatch/logs, and secrets for ticketing/chat integrations.
- **`aws-observability`** — CloudWatch/X-Ray logs, metrics, traces, and alarms — both to instrument the
  pipeline itself and to design the Logs Insights queries / metric alarms the evidence-retrieval and
  anomaly-detection stages depend on.

---

## 📚 AWS Knowledge MCP — use proactively

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

Use **whenever** validating AWS specifics — service limits, quotas, regional availability, current feature
behavior, or the shape of a Bedrock/Lambda/Step Functions/CloudWatch API. **NEVER** rely on training data
alone for AWS limits or current behavior; search the docs first.

**Verify these classes of detail against docs before committing to a design or IaC — they are commonly
gotten wrong from memory and fail only at deploy/invoke time:**

- **IAM for Bedrock cross-Region / `global.*` inference profiles** — needs a multi-statement policy (profile
  ARN + in-Region FM ARN + global FM ARN) and both `InvokeModel` and `InvokeModelWithResponseStream`; a
  single-ARN grant fails silently at invoke. (See the `aws-iam` skill.)
- **API network exposure** — "internal / not internet-facing" requires a **private REST API + interface VPC
  endpoint + resource policy**; HTTP API v2 has no private mode. Decide at design time. (See `api-gateway`.)
- **Model/inference request-parameter constraints** — e.g. newer Bedrock Converse models rejecting
  `temperature` + `topP` together. Mocks won't catch it; confirm and run a live smoke test.
- **Cross-account/public Lambda layer permissions** — the deploying identity needs `lambda:GetLayerVersion`;
  in locked-down envs, vendor deps instead. (See `aws-lambda` / `aws-serverless-deployment`.)
- **CloudWatch Logs Insights timing** — query window must overlap log-group creation time; ingestion lag
  means just-written events aren't immediately queryable. Metrics have no such lag. (See `aws-observability`.)
