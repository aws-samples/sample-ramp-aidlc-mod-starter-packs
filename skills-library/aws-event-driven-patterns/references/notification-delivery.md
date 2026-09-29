# Push Notification Delivery

Multi-channel delivery of triggered alerts with at-least-once guarantees, retry/backoff, and dead-lettering.

## Multi-Channel Delivery Architecture

```
alerts.triggered (MSK / EventBridge)
    │
    ├─► Push Notification Service (ECS)
    │       ├─ APNs (iOS)
    │       ├─ FCM (Android)
    │       └─ Web Push
    │
    ├─► Email Service (Lambda → Amazon SES / email delivery provider)
    │
    └─► SMS Service (Lambda → Amazon SNS SMS / SMS provider)
```

## Delivery Guarantees

- **At-least-once delivery** — consumers process with idempotency keys so a redelivered event does not send a duplicate notification (see [idempotency.md](idempotency.md)).
- **Device-state-aware routing** — if push fails (device offline), queue for retry; fall back to email after N retries.
- **Preference-aware** — respect user notification preferences (channel, time window, frequency cap).
- **Regulatory content injection** — append compliance disclosures to the notification body based on instrument type and jurisdiction.

## Retry and Dead Letter Strategy

```
Attempt 1 → immediate delivery
Attempt 2 → 30-second delay (exponential backoff)
Attempt 3 → 2-minute delay
Attempt 4 → 10-minute delay
After 4 attempts → Dead Letter Queue + alert ops team
```

Surface DLQ depth as an alarm (`dlq.message.count > 0`). When the consumer is a Lambda MSK event source, configure an on-failure destination so poison batches are captured rather than retried indefinitely; for SQS-fronted delivery, set `maxReceiveCount` on a redrive policy to the DLQ.

## Sources

- [Amazon SNS mobile push notifications](https://docs.aws.amazon.com/sns/latest/dg/sns-mobile-application-as-subscriber.html)
- [Amazon SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [Configuring an Amazon MSK event source for Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-msk-configure.html)
