# Observability for Event-Driven Systems

Metrics to instrument, alarm thresholds, and how to trace a request across an event pipeline that includes a Kafka hop.

## Key Metrics to Instrument

| Metric | Service | Alarm threshold |
|--------|---------|-----------------|
| `alert.delivery.latency.p95` | Notification Service | > 60 seconds |
| `alert.delivery.success.rate` | Notification Service | < 99% |
| `subscription.match.latency.p99` | Stream Processor | > 5 seconds |
| `order.placement.latency.p95` | Order Service | > 3 seconds |
| `gateway.session.connected` | Integration Gateway | = 0 (disconnected) |
| `gateway.sequence.gap` | Integration Gateway | > 0 (missing messages) |
| `market.data.lag.seconds` | MSK Consumer | > 10 seconds |
| `dlq.message.count` | All consumers | > 0 (requires investigation) |

Emit custom metrics using the CloudWatch Embedded Metric Format (EMF) so metrics are extracted from structured logs without a separate API call — Lambda Powertools Metrics does this natively.

## Distributed Tracing Strategy

- Inject a correlation ID at the MSK producer (the market-data gateway).
- Propagate it through all downstream consumers via **message headers**.
- Conceptual trace span chain: `ingest → normalize → match → trigger → deliver`.

### What is and isn't traced automatically

- **Lambda, ECS, and DynamoDB are natively traceable** by X-Ray (SDK/instrumentation on the compute, plus AWS SDK client instrumentation for DynamoDB). These appear as connected nodes on the service map.
- **MSK/Kafka is NOT auto-instrumented by X-Ray.** There is no automatic traced node for the Kafka hop. To trace across it you must **manually propagate the trace/correlation ID in Kafka message headers** on the producer side and **open a consumer-side segment** that continues the trace using that propagated ID. The header-propagation step above is exactly what makes this work — just don't assume MSK shows up as an automatic node in the service map.

### Forward-looking: prefer ADOT / OpenTelemetry

The X-Ray SDK enters maintenance in 2026. For new work, prefer the AWS Distro for OpenTelemetry (ADOT) / OpenTelemetry instrumentation, which has first-class Kafka context propagation and sends traces to X-Ray (or other OTLP backends). Reserve raw X-Ray SDK usage for existing instrumented code.

## Sources

- [Tracing performance of messaging applications using Kafka and AWS X-Ray](https://aws.amazon.com/blogs/opensource/tracing-performance-messaging-applications-kafka-aws-x-ray/)
- [AWS Distro for OpenTelemetry](https://aws-otel.github.io/docs/introduction)
- [CloudWatch Embedded Metric Format](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html)
