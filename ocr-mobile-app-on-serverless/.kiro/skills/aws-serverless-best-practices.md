---
title: AWS Serverless Best Practices
inclusion: manual
---

# AWS Serverless Best Practices

Guidance for the backend extraction pipeline (Lambda, Step Functions, API Gateway, S3, DynamoDB, Cognito, Textract, Bedrock). Reference when designing or reviewing serverless infrastructure.

## Always Verify Against the AWS Knowledge MCP

**Before giving guidance, writing infrastructure code, or making a claim about any AWS service, consult the AWS Knowledge MCP server.** AWS services, limits, pricing, API shapes, and best practices change frequently — the MCP returns current, authoritative documentation rather than relying on potentially stale model knowledge.

- **Search first, then read.** Use `search_documentation` to find relevant pages, then `read_documentation` on the top results — search snippets alone are not enough to answer accurately.
- **Use it for**: service capabilities and limits, API/SDK/CLI syntax, CDK/CloudFormation patterns, regional availability, troubleshooting error messages, and current best practices.
- **Pick the right topic** (e.g. `cdk_constructs` for CDK examples, `reference_documentation` for API/SDK, `troubleshooting` for errors, `general` for architecture and best practices).
- **Check regional availability** with the MCP before assuming a service or feature (e.g. a specific Bedrock model, Textract feature) is available in your target region.
- **Prefer official AWS docs from the MCP** over blog posts or model recall. Cite the source when presenting guidance.

The static guidance below is a quick-reference starting point — when in doubt, verify against the MCP.

## General Principles

- **Infrastructure as Code.** Define everything in CDK (the reference backend uses CDK + TypeScript). No click-ops in the console for anything that must be reproducible.
- **Least privilege IAM.** Scope each Lambda's role to exactly the resources and actions it needs. No wildcards on resources for production roles.
- **Design for idempotency.** Pipeline steps may be retried; ensure re-processing the same page does not corrupt or duplicate results.
- **Everything fails, all the time.** Build retries, timeouts, and dead-letter queues in from the start.

## Lambda

- **Single responsibility per function.** The reference pipeline splits OCR, layout, mark detection, handwriting, catalog reconciliation, and math into separate Lambdas — keep it that way.
- **Keep handlers thin.** Parse input, delegate to a testable pure function, format output. This makes property-based testing of the core logic easy.
- **Right-size memory and timeout.** More memory = more CPU; profile to find the cost/latency sweet spot. Set timeouts deliberately per step.
- **Mind cold starts.** Keep deployment packages small, initialize SDK clients outside the handler, and reuse connections.
- **Externalize config** via environment variables (confidence threshold, tolerances, model IDs) — never hardcode.

## Step Functions

- **Use Step Functions to orchestrate**, not Lambdas calling Lambdas. The reference pipeline uses parallel branches (Textract + mark detection) then sequential merge → handwriting → catalog reconciliation → math.
- **Put retry/backoff in the state machine**, not in application code, for transient errors (Textract throttling, Bedrock rate limits).
- **Use `Catch` states** to route failures to a recordFailure step so partial results and error context are persisted.
- **Keep payloads small.** Pass S3 references, not large image blobs, between states.

## API Gateway

- **Authenticate at the edge** with a Cognito authorizer; don't re-implement auth in each Lambda.
- **Validate request schemas** at the gateway where possible to reject malformed input early.
- **Use presigned S3 URLs** for large image uploads instead of proxying bytes through the API (the reference design does this).
- **Return meaningful status codes** and structured error bodies.

## S3

- **Separate buckets/prefixes** for raw vs processed artifacts.
- **Enable encryption at rest** (SSE-S3 or SSE-KMS) and block public access by default.
- **Set lifecycle policies** for image retention to control cost and meet data-retention requirements.
- **Trigger pipelines via S3 events** rather than polling.

## DynamoDB

- **Design keys around access patterns.** The reference Orders table uses a composite key (`sessionId` + `recordType`) with a GSI for listing a user's records — model your queries first, then the table.
- **Use single-table design thoughtfully**; document the record types and GSIs.
- **Use on-demand capacity** for spiky/unknown workloads; switch to provisioned only when traffic is predictable.
- **Store derived/expensive data** (like pre-computed embeddings for catalog matching) to avoid recomputation.

## AI Services (Textract & Bedrock)

- **Use the right tool**: Textract for layout-aware OCR with bounding boxes; Bedrock vision models for tasks needing reasoning (variable layout inference, handwriting).
- **Handle throttling** with backoff (Step Functions wait states).
- **Set and propagate confidence scores**; route low-confidence results to human review rather than trusting them.
- **Keep prompts versioned** and externalized so they can be tuned without redeploying logic.

## Security & Production Safety

- Prefer least-privilege / read-only credentials for any operation that doesn't need write access.
- Never disable safety protections (versioning, deletion protection, backups) without explicit sign-off.
- Treat any resource you can't confirm as non-prod as production — act with caution.
- Never log secrets, tokens, or PII. Reference secrets by name, not value.

## Observability

- **Structured logging** with correlation IDs (session id, page number) across every step.
- **Emit custom metrics** (pages processed, flagged-field rate, pipeline latency, error rate).
- **Alarm on failure rates and DLQ depth.**
- **Enable X-Ray tracing** across Step Functions and Lambda to see end-to-end latency.

## Cost

- Pay-per-use is a benefit, but watch: Bedrock/Textract calls dominate cost. Cache where you can, batch where sensible, and size Lambdas to avoid paying for idle.
