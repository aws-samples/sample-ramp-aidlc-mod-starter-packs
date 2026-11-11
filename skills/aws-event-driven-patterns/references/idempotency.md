# Idempotency and Effectively-Once Processing

Why financial event systems must be idempotent, and how to get **effectively-once** processing on top of at-least-once transport.

## Why It Matters

Duplicate alert delivery is annoying. Duplicate trade execution is catastrophic. Every state-mutating operation must be idempotent.

## Effectively-Once, Not Exactly-Once

Be precise about the guarantee:

- **Transport is at-least-once.** MSK/Kafka consumers, Lambda MSK event sources, and EventBridge Pipes can all redeliver a record (e.g. after a failed batch or a rebalance). None of them provides exactly-once delivery end-to-end by default.
- **At-least-once transport + idempotent consumers = effectively-once processing.** The event may arrive more than once, but the observable side effect happens at most once. This is what this design targets, and it is sufficient for correctness.
- **True exactly-once would require Kafka transactions plus the idempotent producer** (transactional writes with read-committed consumers). This design does **not** use Kafka transactions, so do not describe or promise exactly-once semantics. Rely on consumer-side idempotency instead.

## Idempotency Keys

Every command carries an idempotency key derived deterministically from its business identity:

- Alert creation: `hash(userId + instrumentId + condition + threshold)`
- Order placement: client-generated UUID (`orderId`)
- Notification: `hash(alertId + triggeredAt + channel)`

## Implementation: Atomic Conditional Write (Not Check-Then-Write)

Do **not** use a "check-then-write" sequence (read DynamoDB → if key exists return cached, else execute and store). That has a time-of-check/time-of-use (TOCTOU) race: two concurrent redeliveries of the same event can both read "key absent" before either writes, and both then execute the side effect — exactly the duplicate you were trying to prevent.

Instead, use a **single atomic conditional `PutItem`** guarded by `attribute_not_exists(pk)`:

```
PutItem(idempotencyKey, result)
  ConditionExpression: attribute_not_exists(pk)
```

- If the key is new, the write succeeds and you proceed to perform the side effect.
- If the key already exists, DynamoDB throws `ConditionalCheckFailedException` — treat this as "already processed" and skip (or return the stored result). The condition is evaluated atomically on the single item, so concurrent duplicates cannot both win.

For a batteries-included implementation, AWS Lambda Powertools provides an Idempotency utility (backed by DynamoDB) that manages the in-progress/complete lifecycle and the conditional writes for you.

## DynamoDB TTL Is for Cleanup, Not for Bounding a Dedup Window

Do **not** rely on DynamoDB TTL to define a correctness-bearing deduplication window (e.g. "24-hour dedup via TTL"). TTL deletion is **best-effort and can lag by up to ~48 hours**, and — critically — an expired-but-not-yet-deleted item **still returns on reads and queries**. If you treated TTL as the window boundary, a duplicate arriving after the intended window but before physical deletion would still be seen, and one arriving during deletion lag behaves inconsistently.

Correct approach:

- Store an explicit timestamp on the dedup item and **compare it in application logic** to decide whether the key is still "within window", filtering expired items on read.
- Use TTL **only** for eventual cleanup and storage-cost control, not as the source of truth for the dedup boundary.

## Offset Commit vs. Dedup Key — Two Different Things

These are frequently conflated. Keep them separate:

- **Offset commit / resume is native to Kafka.** Consumer-group offsets are committed to Kafka's internal `__consumer_offsets` topic, and a restarted consumer resumes from the last committed offset. When you use a Lambda MSK event source or EventBridge Pipes, the service commits offsets **for you** after a batch is processed successfully. You do not implement an "offset watermark" yourself.
- **The dedup key is an application concern in DynamoDB.** DynamoDB holds the idempotency/dedup key described above — not an offset watermark. Its job is to make the side effect idempotent when a record is redelivered (which at-least-once transport allows), independent of where the consumer resumed from.

So: offset commit/resume = Kafka/Pipes native; dedup key = app-level in DynamoDB.

## Sources

- [Amazon MSK topic as a source in EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-msk.html)
- [DynamoDB condition expressions (atomic conditional writes)](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
- [DynamoDB Time to Live (TTL) — best-effort deletion behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [Configuring an Amazon MSK event source for Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-msk-configure.html)
