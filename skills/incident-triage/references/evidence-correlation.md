# Evidence Collection & Correlation

The checklist and mechanics behind Step 3 of the triage pipeline. Goal: assemble the **seven evidence classes** for the affected flow, scoped to a window, joined on correlation keys, with provenance on every item.

## Time window

- Default: **first symptom timestamp −30 min / +15 min**. Widen backwards for slow-burn symptoms (memory leaks, disk fill, certificate expiry, consumer lag build-up).
- Normalize every timestamp to one zone (UTC recommended) *before* comparing. Ticket timestamps are often local time and log timestamps UTC — a classic 7-hour red herring.
- Record the window in the report; every query below uses it.

## Correlation keys (in preference order)

1. **Request / correlation ID** — propagated through the gateway, services, and message headers. The strongest join.
2. **Trace ID** — when distributed tracing (X-Ray / OpenTelemetry) is enabled on the path.
3. **User / transaction / session ID** — joins business records to technical logs.
4. **Timestamp proximity** — weakest; use only to shortlist, never to conclude.

If the platform does not propagate a correlation ID end-to-end, flag that as a finding in itself — it is usually the highest-leverage observability fix to recommend.

## The seven evidence classes

| # | Class | Typical sources | What to extract |
|---|-------|-----------------|-----------------|
| 1 | **Application logs** | CloudWatch Logs (log groups per service/container), container stdout | Error signatures, stack traces, first/last occurrence, frequency curve, affected IDs |
| 2 | **Metrics / telemetry** | CloudWatch metrics & dashboards, container/cluster metrics, custom EMF | Error rate, p95/p99 latency, throughput, saturation (CPU/memory/connections), restarts/OOM kills |
| 3 | **Traces** | X-Ray / OpenTelemetry backend | Which hop failed or slowed; fan-out anomalies; retry storms |
| 4 | **Deployment history** | CI/CD history, cluster rollout events, image tags, IaC apply log | Anything deployed inside or shortly before the window; diff vs. previous version |
| 5 | **Config & flags** | Config repos, parameter/secret stores, feature-flag system, workflow definitions | Changes inside the window; drift between environments; expiring credentials/certificates |
| 6 | **Dependency & infra status** | Queue/broker consoles and metrics (RabbitMQ depth & consumer count, Kafka consumer lag), database metrics (connections, locks, replication), cache hit/evict, external/partner status, network/VPN links | Backlog, exhaustion, unavailability, elevated latency on any dependency of the flow |
| 7 | **Known issues & history** | Prior incident reports, runbooks, support knowledge base, open bug tickets | Same signature seen before? Existing workaround? Recurring pattern? |

Collect **all seven** (or record why one is unavailable) before ranking hypotheses. Most bad triage traces to concluding after class 1 alone.

## CloudWatch Logs Insights starter patterns

Adapt log-group names and field names to the platform; always bind the time window.

Error spike overview for a service:

```
fields @timestamp, @message
| filter @message like /(?i)(error|exception|fatal|panic)/
| stats count() as errors by bin(5m)
```

Find first occurrence of a signature:

```
fields @timestamp, @message
| filter @message like "connection refused"
| sort @timestamp asc
| limit 20
```

Follow one request across services (when a correlation ID is logged):

```
fields @timestamp, @logStream, @message
| filter @message like "corr-id-12345"
| sort @timestamp asc
```

Top error signatures in the window (rough clustering):

```
fields @message
| filter @message like /(?i)error/
| parse @message /(?<sig>[A-Za-z]+(Error|Exception)[^"]{0,60})/
| stats count() as n by sig
| sort n desc
```

## Messaging-layer checks (RabbitMQ / Kafka paths)

- **RabbitMQ:** queue depth and age of oldest message; consumer count (zero consumers = classic silent failure); dead-letter queue growth; unacked message count; connection/channel churn.
- **Kafka:** consumer-group lag per partition (rising lag with flat throughput = stuck consumer); rebalance frequency; broker ISR shrink; producer error rate.
- A *processing* flow that "loses" work with no errors in logs usually died between hops — the queue metrics show which hop.

## Designed-vs-observed comparison (the SME step)

When source code / workflow definitions are available for the implicated service:

1. Locate the code path or workflow definition for the failing operation (route handler → service call chain → external calls / queue publishes).
2. Note the **intended** behavior: expected inputs, validation, timeout/retry settings, error handling, compensation logic.
3. Compare against the observed evidence: is the code doing what it was designed to do (environment/dependency problem), or is the design itself not handling this input/state (defect)?
4. Quote the specific file/function/definition examined — this makes the analysis checkable by the SME who reviews it.

## Provenance rule

Every evidence item in the report records: **source system, exact query/command, time range, and retrieval time**. If a human cannot re-run it, it is an anecdote, not evidence.
