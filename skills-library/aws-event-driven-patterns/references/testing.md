# Testing Strategy for Event-Driven Systems

How to test an event-driven FSI pipeline across the test pyramid, from pure matching logic up to full price-tick-to-notification flows.

## Test Pyramid for This Domain

| Level | What to test | Tools |
|-------|-------------|-------|
| **Unit** | Subscription-matching logic, validation rules, price comparison, external-protocol message parsing | xUnit/NUnit (.NET), Jest (TypeScript) |
| **Integration** | Lambda → DynamoDB, ECS → MSK produce/consume, API Gateway → Lambda | Testcontainers (LocalStack, Kafka), AWS SDK mocks |
| **Contract** | API Gateway ↔ client, Order Service ↔ external-integration gateway, producer ↔ consumer schema | Pact, schema validation against the Schema Registry |
| **E2E** | Full flow: price tick → alert triggered → notification delivered | Playwright (UI), custom harness (event pipeline) |
| **Performance** | Alert delivery < 60 s under load, order placement < 3 s | k6, Artillery, custom MSK load generator |

## Emphasis for Event Pipelines

- **Push logic down to unit tests.** Matching (given price = X and threshold = Y, expect match / no-match), validation, and message parsing are deterministic and should be covered exhaustively at the unit level where they are cheapest to run.
- **Use contract tests to protect the seams** most likely to break independently: the client ↔ Order Service API, the Order Service ↔ external-integration gateway, and every producer ↔ consumer schema pair. Validate against the Schema Registry so a breaking event-schema change fails a test rather than a consumer in production.
- **Verify idempotency explicitly.** Add a test that redelivers the same event (same idempotency key) and asserts the side effect happens exactly once — this is the guard for the effectively-once behavior the system depends on.
- **E2E smoke-test the delivery path** by injecting a mock MSK message and asserting the notification arrives, so the full ingest → match → trigger → deliver chain is exercised.

## Sources

- [Testing serverless applications — AWS Serverless Application Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/testing.html)
- [DynamoDB condition expressions (idempotency test target)](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
