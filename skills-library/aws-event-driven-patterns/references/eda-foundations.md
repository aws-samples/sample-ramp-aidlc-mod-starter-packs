# Event-Driven Architecture Foundations

Foundational pattern selection and event-design discipline for financial-services event-driven systems.

## Pattern Selection Guide

| Pattern | Use when… | Avoid when… |
|---------|-----------|-------------|
| **Event Notification** | Downstream systems need to know something happened, but the event carries minimal data. Consumer fetches details on demand. | Events are high-volume and consumers need the full payload — repeated back-channel lookups cause a thundering herd. |
| **Event-Carried State Transfer** | Consumers need full entity state without calling back to the source. Suits market-data feeds where every tick carries the full price. | State is large and changes infrequently — prefer notification + fetch. |
| **Event Sourcing** | Full audit trail required (regulatory), or you must reconstruct state at any point in time (order lifecycle, trade execution). | Simple CRUD with no audit requirement — event sourcing adds storage and replay complexity. |
| **CQRS** | Read and write models diverge (order placement is write-heavy; portfolio view is read-heavy with different access patterns). | Read and write patterns are nearly identical — CQRS adds indirection without benefit. |

## Event Design Principles

- **Events are immutable facts** — they describe what happened, not what should happen.
- **Events carry enough context** to be useful without back-channel lookups.
- **Event schemas are versioned** — use a Schema Registry (e.g. AWS Glue Schema Registry with MSK) or an inline version field, and evolve schemas compatibly.
- **Event ordering matters** — partition by entity ID (instrument symbol, user ID, order ID). Kafka guarantees ordering only within a partition.
- **Dead letters are first-class** — every consumer must handle poison pills gracefully and route unprocessable records to a DLQ that is alarmed on depth.

## Choosing a Pattern in Practice

Most FSI event pipelines combine patterns: a market-data feed uses event-carried state transfer (each tick is self-describing), an order-management domain uses event sourcing (the append-only order-event log is the audit record), and the read side of that domain uses CQRS (a projected portfolio/positions view). Notification is the right default whenever the event only needs to trigger a lookup, keeping payloads small and coupling loose.

## Sources

- [Event-driven architecture — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-integrating-microservices/event-driven-architecture.html)
- [Amazon MSK topic as a source in EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-msk.html)
- [AWS Glue Schema Registry with Amazon MSK](https://docs.aws.amazon.com/glue/latest/dg/schema-registry-integrations.html)
