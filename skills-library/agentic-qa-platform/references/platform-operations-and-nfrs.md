# Platform Operations and NFRs

Use this reference to turn the target architecture into an operable service. Define measurable expectations before making the platform a required delivery dependency.

## Contents

- [Operating principle](#operating-principle)
- [NFR decision record](#nfr-decision-record)
- [SLIs, SLOs, and error budgets](#slis-slos-and-error-budgets)
- [Outage and waiver semantics](#outage-and-waiver-semantics)
- [Capacity, concurrency, and backpressure](#capacity-concurrency-and-backpressure)
- [Idempotency, cancellation, and cleanup](#idempotency-cancellation-and-cleanup)
- [Multi-tenancy and isolation](#multi-tenancy-and-isolation)
- [Observability](#observability)
- [Cost and allocation](#cost-and-allocation)
- [Retention and lifecycle](#retention-and-lifecycle)
- [Resilience and disaster recovery](#resilience-and-disaster-recovery)
- [Incidents, runbooks, and support](#incidents-runbooks-and-support)
- [Operational readiness checklist](#operational-readiness-checklist)

## Operating principle

Treat the platform as a delivery dependency only after its owners can measure, support, degrade, bypass, and recover it safely.

Do not invent universal thresholds. Record every target as a **HUMAN DECISION** based on:

- repository and environment risk;
- delivery frequency and feedback expectations;
- dependency and target reliability;
- regional, residency, and recovery constraints;
- operating-team capacity and cost;
- consequences of false pass, false block, delay, and unavailable evidence.

Product test failures are not platform unreliability. Keep product, target, fixture, executor, policy, and platform outcomes distinguishable in every SLI.

## NFR decision record

Complete one record for the shared platform and any materially different tenant, environment class, or execution profile:

| Quality attribute | Scope | Current baseline | Proposed target | Measurement | Consequence if missed | Owner | Review trigger |
|---|---|---|---|---|---|---|---|
| Availability | | | | | | | |
| Trigger-to-start latency | | | | | | | |
| Result publication latency | | | | | | | |
| Capacity and burst handling | | | | | | | |
| Cancellation and cleanup | | | | | | | |
| Evidence durability | | | | | | | |
| Security and tenant isolation | | | | | | | |
| Data retention/residency | | | | | | | |
| Recovery time and data loss | | | | | | | |
| Cost and allocation | | | | | | | |
| Support and incident response | | | | | | | |

Mark missing baselines as `UNKNOWN`. A target without a measurement source and owner is not an SLO.

## SLIs, SLOs, and error budgets

### Candidate SLIs

| SLI | Example measurement boundary | Exclude or segment |
|---|---|---|
| Trigger acceptance | Authenticated valid triggers accepted / valid triggers received | Rejected invalid, replayed, or unauthorized events |
| Queue delay | Accepted trigger to controller admission | Segment by priority, tenant, profile, and region |
| Execution start latency | Admission to isolated runner start | Target provisioning delays should remain separately visible |
| Platform completion | Runs reaching an authorized terminal platform outcome / admitted runs | Product assertion failures still count as successfully completed platform runs |
| Result publication | Terminal outcome to external check/status update | Forge or delivery-system outage should be separately attributed |
| Evidence completeness | Runs with required artifacts, provenance, redaction, and cleanup record / terminal runs | Policy-authorized omitted evidence must be explicit |
| Cancellation effectiveness | Cancelled/superseded runs that stop within the approved window | Separate non-interruptible external operations |
| Cleanup effectiveness | Runs whose ephemeral resources are removed or quarantined by deadline | Track leaked resources and forced cleanup separately |
| Classification coverage | Eligible failures classified by an authorized mechanism / eligible failures | Segment fixed-rule, governed-evaluator, human-review, and unresolved outcomes |
| Control-plane availability | Successful valid control requests / valid control requests | Segment dependencies and planned maintenance |

### SLO decision template

```text
SLI:
Scope: repository / tenant / environment / profile / region
Measurement window:
Current baseline and evidence:
Target:
Error budget:
Excluded events and why:
Burn-rate or breach detection:
Action on breach:
Owner:
Revisit trigger:
```

Use separate objectives for advisory and required-gate operation. A platform may be ready for shadow use but not ready to block merges.

### Error-budget policy

Define:

- who may consume the budget and for which changes;
- when autonomy or feature rollout freezes;
- when a required check reverts to advisory;
- when incident review or capacity work becomes mandatory;
- how dependency failures are attributed without hiding delivery impact.

An error budget does not authorize a QA error outcome to become `passed`.

## Outage and waiver semantics

**SAFETY INVARIANT:** only the authorized success outcome may satisfy the QA gate. Infrastructure errors, platform errors, missing, stale, partial, provisional, or unauthorized results remain non-pass.

**HUMAN DECISION:** the accountable release authority may define an explicit outage waiver or bypass by environment and risk class. The waiver:

- is a separate authenticated decision, never a rewritten QA result;
- binds the affected repository, change, target, failed control, reason, issuer, expiry, and compensating controls;
- is visible in the delivery record and evidence manifest;
- cannot be issued by the agent or platform component requesting it;
- cannot be silently reused after a source, target, policy, or artifact change;
- triggers follow-up review when used.

Predefine behavior for:

- event ingress unavailable;
- registry or policy store unavailable;
- runner capacity exhausted;
- target or fixture service unavailable;
- evidence storage unavailable;
- external forge/check API unavailable;
- callback lost or delayed;
- regional or dependency outage.

For each, choose retry, queue, cancel, advisory degradation, explicit waiver, or delivery stop. Do not hide outage policy inside retry settings.

## Capacity, concurrency, and backpressure

### Workload model

Estimate by evidence:

- repositories and active tenants;
- average and peak change/deployment events;
- suites, shards, devices, browsers, and profiles per event;
- average and tail duration;
- evidence volume;
- agent invocations and token/model cost;
- retry, cancellation, and supersede rates;
- scheduled and manual workloads competing with change-triggered runs.

### Admission and fairness

The independently controlled admission layer should enforce:

- global, tenant, repository, profile, environment, and target concurrency limits;
- priority classes with documented owners;
- per-tenant fairness and starvation protection;
- admission rejection or delay with explicit reason and retry guidance;
- cost, duration, evidence-size, and model-invocation budgets;
- deduplication and supersede-before-start behavior.

### Queue and overload behavior

Define:

- queue ownership, ordering, retention, visibility timeout, and redrive policy;
- maximum acceptable queue age by priority;
- poison-event quarantine and replay procedure;
- overload alarms and automated admission reduction;
- whether stale runs cancel when a newer source revision arrives;
- how partial fan-out is cancelled and cleaned up;
- capacity expansion approval and rollback.

Never let an agent change its own priority, concurrency, or budget.

## Idempotency, cancellation, and cleanup

### Idempotency

Use a stable idempotency key derived from the authoritative trigger and execution intent, such as:

```text
project + repository + source revision + target identity
+ approved suite digest + runner profile + policy version + requested action
```

Persist:

- key and request digest;
- current state and terminal outcome;
- created, last-updated, and expiry timestamps;
- external check/status identifier;
- child execution and artifact references.

Reject a reused key with different content. Retries return or resume the same logical operation rather than creating duplicate side effects.

### Cancellation

Support cancellation for:

- superseded source revision;
- closed or merged change;
- expired target;
- revoked approval or policy;
- user or operator request;
- budget exhaustion;
- platform shutdown or incident containment.

Cancellation must be authenticated, idempotent, propagated to child work, and recorded. It never deletes the audit trail.

### Cleanup

Every ephemeral resource needs:

- owner and run correlation ID;
- TTL or lease;
- normal and forced cleanup path;
- retry and quarantine behavior;
- orphan detector;
- evidence of cleanup outcome;
- escalation owner when cleanup fails.

Test cleanup after success, assertion failure, agent failure, timeout, cancellation, callback loss, and controller restart.

## Multi-tenancy and isolation

Choose an isolation tier per resource and risk:

| Concern | Shared with logical isolation | Tenant-scoped | Run-scoped disposable |
|---|---|---|---|
| Control workflow | Common for similar policies | Use when lifecycle/ownership differs | Rare |
| State and registry | Partitioned keys and authorization | Use for stronger residency or ownership | N/A |
| Agent context/session | Avoid cross-tenant memory | Prefer tenant-scoped retrieval and policy | Use for sensitive or untrusted work |
| Runner | Trusted suites may share hardened pools | Use for network/data boundary | Prefer for generated or repaired artifacts |
| Credentials | Never broadly shared | Short-lived tenant/resource scope | Short-lived run/action scope |
| Evidence | Partitioned access and encryption | Use for residency/legal boundary | Run-scoped write, tenant-scoped read |

Record:

- tenant identifier propagation and validation;
- isolation at identity, data, network, compute, cache, logs, metrics, and evidence layers;
- noisy-neighbor controls;
- encryption and key ownership;
- residency and cross-border constraints;
- deletion and legal-hold behavior;
- support access and break-glass audit.

Do not rely on prompt text for tenant isolation.

## Observability

### Correlation

Propagate stable identifiers across ingress, controller, policy, agent, tool, runner, evidence, and external status:

- project, repository, change, source revision;
- platform run and workflow execution;
- target/environment;
- suite, case, shard, attempt;
- agent, prompt/model/tool/policy versions;
- approval and evidence manifest.

### Telemetry

Capture:

- structured state transitions and reason codes;
- latency and error metrics by component and dependency;
- queue age, admission, cancellation, supersede, retry, and cleanup metrics;
- agent quality/safety and policy-denial metrics;
- cost and resource usage;
- traces across asynchronous boundaries where feasible;
- access, policy, approval, and evidence audit events.

Redact before telemetry leaves the trust boundary. Do not put raw prompts, secrets, production data, or sensitive evidence into general logs.

### Operator views

Provide:

- delivery view: current check, authorized outcome, evidence link, and next action;
- tenant view: runs, reliability, cost, exceptions, and onboarding health;
- platform view: SLOs, queues, dependencies, capacity, cleanup, policy denials, and incidents;
- governance view: authority conflicts, approvals, waivers, autonomy tier, and audit completeness.

Alarm on actionable symptoms with an owner and runbook, not on every individual test failure.

## Cost and allocation

Model costs by:

- control-plane baseline;
- runner compute and duration;
- browser/device/profile fan-out;
- storage, transfer, and evidence retention;
- model invocation and retrieval;
- observability;
- cross-account, cross-region, or vendor services;
- support and platform engineering.

Expose cost per run, repository, tenant, profile, and capability where practical. Decide whether to use central funding, showback, chargeback, quotas, or budget alerts.

**HUMAN DECISION:** choose optimization priorities. Lower cost must not remove required isolation, evidence, assertions, or policy controls.

## Retention and lifecycle

Define by artifact class:

| Artifact | Retention | Access | Residency | Encryption/key owner | Deletion/hold | Archive |
|---|---|---|---|---|---|---|
| Trigger and state | | | | | | |
| Agent input/output | | | | | | |
| Test logs/traces/media | | | | | | |
| Normalized results | | | | | | |
| Evidence manifest | | | | | | |
| Approval/waiver | | | | | | |
| Audit/policy decision | | | | | | |

Use lifecycle policies and deletion verification. Preserve stable identifiers and sufficient provenance even when an expired artifact is no longer retrievable, so historical decisions remain explainable.

## Resilience and disaster recovery

### Dependency inventory

For each dependency, record:

- service owner and support boundary;
- failure detection;
- retry/idempotency implications;
- cached or degraded behavior;
- data durability and restore method;
- regional/account/tenant blast radius;
- recovery test frequency.

### Recovery decisions

Set RTO and RPO as **HUMAN DECISION** values per capability:

| Capability | Criticality | RTO | RPO | Recovery method | Degraded behavior | Test owner |
|---|---|---|---|---|---|---|
| Registry/policy | | | | | | |
| Workflow state | | | | | | |
| Approved cases/contracts | | | | | | |
| Evidence and approvals | | | | | | |
| Runner capacity | | | | | | |
| External integration | | | | | | |

Test restore, replay protection, stale-event rejection, external-status reconciliation, and orphan cleanup. Recovery must not duplicate side effects or convert uncertain outcomes to success.

## Incidents, runbooks, and support

### Required runbooks

- event rejected, duplicated, or replayed;
- queue age or capacity exhaustion;
- stuck, timed-out, or orphaned run;
- target/fixture outage;
- runner compromise or suspicious egress;
- evidence/redaction failure;
- external check publication failure;
- policy or approval failure;
- cross-tenant access suspicion;
- cleanup leak;
- regional/dependency outage;
- rollback of prompt, model, tool, policy, profile, or platform release.

Each runbook states detection, scope, immediate containment, evidence preservation, recovery, stakeholder communication, authority for waivers, and follow-up owner.

### Support and RACI

| Activity | Platform owner | Application team | QA authority | Product/requirement authority | Security/privacy | Release authority |
|---|---|---|---|---|---|---|
| Platform incident | A/R | C | C | I | C when relevant | I |
| Target or fixture incident | C | A/R | C | I | C when relevant | I |
| Requirement conflict | I | C | C | A/R | C when relevant | I |
| Required-check waiver | C | C | C | I | C when relevant | A/R |
| Agent autonomy change | R | C | C | C | A for risk policy | I |
| Cross-tenant/security event | R | C | I | I | A | I |

Adapt roles to the organization's operating model. Every `A` and `R` must resolve to a named team or role before production gating.

## Operational readiness checklist

- [ ] Service boundary, dependencies, tenants, and owners are recorded.
- [ ] Advisory and gating SLOs have evidence-based targets and measurement sources.
- [ ] Platform reliability excludes product assertion failures without hiding user impact.
- [ ] Capacity model, admission policy, priority, fairness, and overload behavior are tested.
- [ ] Idempotency, replay, supersede, cancellation, and cleanup are tested across failure paths.
- [ ] Isolation is enforced at identity, data, network, compute, cache, telemetry, and evidence layers.
- [ ] Every required dashboard, alarm, and runbook has an owner.
- [ ] Cost allocation, budgets, and scaling approvals are defined.
- [ ] Retention, residency, deletion, legal hold, and support access are approved.
- [ ] RTO/RPO and recovery procedures are tested for critical state and evidence.
- [ ] Incident, waiver, rollback, and communication authorities are explicit.
- [ ] A platform outage cannot silently produce a successful QA result.
