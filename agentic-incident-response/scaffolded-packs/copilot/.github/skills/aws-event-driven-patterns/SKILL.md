---
name: aws-event-driven-patterns
description: "Domain architecture guidance for event-driven financial-services systems on AWS — real-time market-data pipelines, stream processing, alert/subscription matching, multi-channel notification delivery, idempotency, and event-driven CDK stack design. Triggers on phrases like: event-driven architecture for FSI, market data stream processing, MSK topic and partition design, Flink vs Lambda vs ECS for streaming, subscription matching engine, push notification delivery, effectively-once processing, idempotency key, event-driven observability. For generic Lambda/EventBridge how-to unrelated to FSI event pipelines, use the aws-lambda skill instead; for MSK/Kafka service mechanics use the aws-messaging-and-streaming skill instead."
argument-hint: "[what event-driven system are you designing?]"
license: MIT-0
metadata:
  author: RAMP AI-DLC Starter Packs
  version: 1.0.0
---

# Event-Driven Patterns for Financial Services on AWS

Domain-specific architectural guidance for building event-driven financial-services systems on AWS: real-time market-data pipelines, alert/subscription matching, multi-channel notification delivery, and the idempotency, observability, and infrastructure patterns that hold them together.

This skill is a router. Load the reference file that matches the aspect you are designing; each file is a self-contained deep-dive with official AWS documentation sources at the bottom.

## When to Load Reference Files

| You are working on… | Load |
|---|---|
| Event-driven pattern selection (notification / carried-state / sourcing / CQRS), event design, schema versioning, ordering | [references/eda-foundations.md](references/eda-foundations.md) |
| MSK topic & partition design, Flink vs Lambda vs ECS stream-processing choice, subscription-matching engine, scale tiers, latency targets | [references/stream-processing.md](references/stream-processing.md) |
| Multi-channel push/email/SMS delivery, delivery guarantees, retry & DLQ strategy, preference/compliance-aware routing | [references/notification-delivery.md](references/notification-delivery.md) |
| Idempotency keys, atomic conditional writes, effectively-once processing, dedup vs offset commit | [references/idempotency.md](references/idempotency.md) |
| Metrics to instrument, alarm thresholds, distributed tracing across Lambda/ECS/DynamoDB/Kafka | [references/observability.md](references/observability.md) |
| CDK stack decomposition, cross-stack references, event-driven infrastructure layout | [references/cdk-patterns.md](references/cdk-patterns.md) |
| Test strategy (unit/integration/contract/E2E/perf) for event pipelines | [references/testing.md](references/testing.md) |

## Core Principles

- **Events are immutable facts** describing what happened — carry enough context to be useful without back-channel lookups, version every schema, and partition by the entity whose ordering matters (instrument symbol, user ID, order ID).
- **Design for at-least-once transport, achieve effectively-once through idempotency.** No AWS-native stream transport in this design guarantees exactly-once end-to-end; correctness comes from idempotent, atomically-guarded consumers. Duplicate notification = annoying; duplicate trade = catastrophic.
- **Match compute to the processing shape**, not by default: stateless per-record → Lambda; stateful/windowed → Managed Service for Apache Flink; persistent-session/long-lived → ECS/Fargate.
- **Dead letters are first-class** — every consumer handles poison pills and surfaces DLQ depth as an alarm.
- **Let CDK synthesize cross-stack wiring** by passing construct references between stacks; reserve manual imports for pre-existing/cross-app resources.
