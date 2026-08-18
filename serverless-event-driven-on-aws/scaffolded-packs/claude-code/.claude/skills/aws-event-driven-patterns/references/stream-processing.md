# Real-Time Stream Processing

MSK topic/partition design, the Flink-vs-Lambda-vs-ECS decision, the subscription-matching engine, and how the design scales.

## MSK Topic Design for Market Data

```
Topics:
  market.prices.raw         — Raw exchange feed (high volume, all instruments)
  market.prices.normalized  — Normalized, schema-validated prices
  alerts.subscriptions      — Subscription change events (create/update/delete)
  alerts.triggered          — Matched alerts ready for delivery
  orders.placed             — Order placement events
  orders.status             — Order status updates (filled, rejected, cancelled)
```

**Partition strategy** (Kafka guarantees ordering only within a partition, so partition by the entity whose order matters):

- `market.prices.*` — partition by instrument symbol (ordering per instrument)
- `alerts.*` — partition by user ID (ordering per user)
- `orders.*` — partition by order ID (ordering per order lifecycle)

Size partition count for peak throughput and target consumer parallelism — a Lambda MSK event source scales consumer instances up to the number of partitions, so partition count is the ceiling on parallel Lambda processing.

## Stream Processing: Flink vs Lambda vs ECS Consumer

| Approach | Best for… | Trade-offs |
|----------|-----------|-------------|
| **Amazon Managed Service for Apache Flink** | Stateful stream processing — windowed aggregations, complex event processing, subscription matching against millions of rules. Handles backpressure natively. | Learning curve; cost at low volumes; scaling a running application triggers a **checkpoint-restore restart with brief downtime** (state is restored from the latest checkpoint/snapshot). |
| **Lambda (MSK event source)** | Stateless per-record processing — normalization, enrichment, simple routing. Scales to zero, pay-per-invocation. | 15-minute (900 s) max timeout; no native windowing; batching semantics differ from pure streaming. |
| **ECS/Fargate (Kafka consumer)** | Long-running consumers that maintain local state, need persistent connections, or have specific JVM/CLR tuning requirements. | Requires capacity planning; **Fargate does not scale to zero on demand via native auto scaling (unlike Lambda)** — you scale task count, with a practical floor; more operational overhead. |

**Recommendation for subscription matching:**

- Simple threshold checks (price > X): **Lambda + DynamoDB lookup** is sufficient.
- Windowed logic (price crosses X within 5 min, VWAP triggers): **Flink** is the strategic choice.
- Sub-second latency with complex in-memory state: **ECS consumer** with in-memory state + periodic DynamoDB checkpoint.

## Subscription Matching Engine

### Data Model (DynamoDB)

```
Table: AlertSubscriptions
  PK: USER#{userId}
  SK: ALERT#{alertId}
  Attributes:
    instrumentSymbol: string
    condition: enum(ABOVE, BELOW, CROSSES)
    threshold: decimal
    channels: set(PUSH, EMAIL, SMS)
    status: enum(ACTIVE, PAUSED, TRIGGERED, EXPIRED)
    createdAt: ISO timestamp
    expiresAt: ISO timestamp (TTL — cleanup only; see idempotency.md)

GSI: InstrumentIndex
  PK: INSTRUMENT#{symbol}
  SK: ALERT#{alertId}
  (enables: "find all active alerts for AAPL" for subscription matching)
```

### Matching Flow

```
1. Price tick arrives (market.prices.normalized)
2. Extract instrument symbol from tick
3. Query InstrumentIndex: all ACTIVE alerts for this symbol
4. For each alert:
   a. Evaluate condition (price vs threshold)
   b. If matched → publish to alerts.triggered
   c. Update alert status → TRIGGERED
   d. Idempotency: guard against re-triggering in this window (see idempotency.md)
```

### Scale Tiers

- **< 100K active subscriptions:** Lambda + DynamoDB query per tick is sufficient.
- **100K–1M subscriptions:** pre-load hot subscriptions into Flink operator state.
- **> 1M subscriptions:** Flink with the **RocksDB state backend** + periodic DynamoDB sync. RocksDB keeps state on local disk so it can exceed in-memory limits.

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Alert delivery latency (price trigger → user notification) | < 60 seconds | CloudWatch custom metric `alert.delivery.latency.p95` |
| Market data normalization latency | < 5 seconds | Trace span: raw → normalized topic |
| Subscription match throughput | 10,000 matches/second | CloudWatch `subscription.matches.per.second` |

## Sources

- [Amazon MSK topic as a source in EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-msk.html)
- [Configuring an Amazon MSK event source for Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-msk-configure.html)
- [Lambda function timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html)
- [Managed Service for Apache Flink — RocksDB state backend and Flink settings](https://docs.aws.amazon.com/managed-flink/latest/java/reference-flink-settings.html)
