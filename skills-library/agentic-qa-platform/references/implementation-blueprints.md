# Implementation Blueprints

Use this reference when the task must move beyond target principles into a build-ready platform design. Keep the organization's current delivery system, security standards, and operating model as inputs; the patterns below are comparison points, not a mandatory topology.

## Table of contents

- [Architecture depth modes](#architecture-depth-modes)
- [Illustrative hybrid architecture](#illustrative-hybrid-architecture)
- [End-to-end interaction sequences](#end-to-end-interaction-sequences)
- [Logical component interfaces](#logical-component-interfaces)
- [Independently enforced workflow model](#independently-enforced-workflow-model)
- [Execution topology variants](#execution-topology-variants)
- [Agent invocation boundaries](#agent-invocation-boundaries)
- [Non-AWS capability equivalents](#non-aws-capability-equivalents)
- [Failure and recovery routes](#failure-and-recovery-routes)
- [Build-ready design artifacts](#build-ready-design-artifacts)
- [Readiness checklist](#readiness-checklist)

## Architecture depth modes

Select the smallest depth that satisfies the requested outcome. Do not produce a deployment blueprint before authority, ownership, and platform shape are understood.

| Mode | Use when | Required output | Stop condition |
|---|---|---|---|
| Discovery | Scope and current-state evidence are incomplete | Inventory, authority map, fit-gap, unknowns | Material topology or ownership questions remain |
| Target architecture | Platform shape and major boundaries need agreement | Logical planes, integration flow, responsibility map, key decisions | Human decisions have named owners |
| Build-ready design | A pilot implementation is approved | Component interfaces, contracts, state model, identities, failure routes, NFRs, rollout | Each component has an owner and acceptance test |
| Pilot implementation | One or more repositories are selected | Environment-specific mapping, onboarding records, policies, dashboards, runbooks | Pilot entry criteria are demonstrably satisfied |

Use target-architecture depth while major choices remain open, then produce build-ready detail only for an approved implementation or pilot path.

## Illustrative hybrid architecture

Use this as one worked pattern when existing CI/CD should retain build and deployment ownership while selected QA capabilities are shared. Compare it with repository-local, federated-kit, and shared-service options in `architecture-options.md`.

```text
Requirement / work-management source
        |
        v
Approved test oracle ---- Human approval and policy authority
        |                              |
        v                              v
Versioned test bundle ---------- Approval decision records
        |
        |                            Existing application CI/CD
        |                                      |
        |                              build + deploy preview
        |                                      |
        +------------------------ deployment-ready event
                                               |
                                               v
                                  Authenticated event ingress
                                               |
                                               v
                           Independently enforced QA workflow controller
                             |       |        |         |
                             |       |        |         +--> Evidence / status adapter
                             |       |        +------------> Policy and approval service
                             |       +---------------------> Registry / contract store
                             +-----------------------------> Bounded reasoning capabilities
                                               |
                                               v
                               Isolated execution launcher
                                               |
                              +----------------+----------------+
                              |                                 |
                              v                                 v
                 Application account/network          Central isolated runner
                              |                                 |
                              +---------------+-----------------+
                                              |
                                              v
                                 Normalized results + artifacts
                                              |
                                              v
                           Authorized classification/conclusion
                                              |
                                              v
                         Existing CI/CD check, status, or release control
```

The existing pipeline remains responsible for application build and deployment unless the fit-gap analysis supports a different decision. The QA platform owns only the capabilities explicitly assigned to it.

### Trust boundaries to draw

The build-ready diagram must show:

- source-control and work-management boundary;
- central platform tenancy boundary;
- application account, network, namespace, or subscription boundary;
- agent runtime and tool boundary;
- untrusted execution sandbox boundary;
- evidence storage and reader boundary;
- human approval boundary;
- cross-boundary identity, callback, and artifact-transfer paths.

## End-to-end interaction sequences

These sequences are implementation examples for a high-control shared service. They are not the default architecture and should not be copied wholesale into repository-local or federated designs. Replace deterministic rules with governed evaluators or review where the evidence is inherently subjective.

### Approved test-intent publication

1. An authenticated source event identifies a candidate requirement or test-case change.
2. Requirements Analysis records `authoritative`, `derived`, `assumed`, and `conflicting` items with protected, versioned provenance.
3. The Test Plan Agent may draft cases, gaps, negative paths, and risk priority.
4. Independently enforced validation checks schema, source references, identifiers, and supported profiles.
5. An accountable human approves or rejects the test-intent change.
6. The publication service creates a versioned, tamper-evident approved test bundle or equivalent provenance record.
7. The registry records the active bundle and compatibility scope.

An agent may open or update a draft. It cannot approve, merge, publish as authoritative, or silently resolve conflicting intent.

### Successful application-change run

1. Existing CI/CD builds the exact application revision and deploys an allowlisted preview or test target.
2. CI or the delivery platform emits a signed or otherwise authenticated deployment-ready event.
3. Event ingress validates authenticity, replay protection, repository, revision, target, and correlation identifiers.
4. The controller resolves the authoritative registry, approved suite, runner profile, policy, environment, and autonomy tier.
5. Policy-controlled preflight validates compatible contract versions, provenance, target health, budgets, approvals, and supersession state.
6. The Test Author/Binding Agent is invoked only when an approved case lacks a valid executable binding for the exact source/profile combination.
7. Validation compiles or interprets the candidate artifact and applies an intent-integrity check appropriate to its representation.
8. Fixture preparation uses ordinary schema-driven generation when sufficient; an approved reasoning step may assist complex recipe design.
9. The launcher creates or resets an isolated runner with run-scoped identity, network, time, and storage limits.
10. The executor runs the approved suite and emits normalized results plus native evidence references.
11. Fixed rules classify mechanically decidable outcomes. Governed probabilistic evaluators or human review may handle subjective and residual cases with explicit thresholds, abstention, and authority.
12. A repair proposal is considered only for a policy-eligible test-implementation failure.
13. Any accepted repair is validated and independently verified in a fresh run with isolation proportionate to risk.
14. Versioned policy maps the evidence and evaluator decisions to the authorized platform outcome.
15. The evidence service redacts, signs or attests where required, stores artifacts, and produces a manifest.
16. The integration adapter publishes an idempotent check/status against the exact source revision.
17. The controller completes cleanup and records the terminal state.

### Error path

At every step:

1. Preserve the originating event, exact input digests, failed state, and correlation ID.
2. Map the error to a typed platform result; do not turn it into a product failure.
3. Retry only errors declared transient and only within controller-enforced budgets.
4. Compensate or clean up resources already created.
5. Publish a non-success conclusion or visible pending state according to the declared integration contract.
6. Route to the named application, QA, platform, security, or product owner.

### Cancellation and supersession

When a pull request closes, a newer deployment replaces the target, policy revokes access, or a human cancels:

1. The controller records the cancellation or superseding event idempotently.
2. New agent/tool invocations and runner launches stop.
3. Active execution receives a bounded cancellation request, then forced termination if policy permits.
4. Evidence already produced is retained or deleted according to the run's policy; it is never relabeled as complete.
5. Cleanup executes independently of the cancelled business path.
6. The repository check maps to canonical `cancelled` or `superseded`, never `passed`.

## Logical component interfaces

| Component | Consumes | Produces | Independently enforced obligations | Accountable owner |
|---|---|---|---|---|
| Test authority adapter | Approved requirements/cases and decisions | Protected authority and suite references | Preserve provenance and version history | Product/QA authority |
| Project registry | Repository, owner, environment, profile, policy mappings | Versioned project configuration | Validate ownership, compatibility, and protected fields | Platform governance |
| Event ingress | Forge, CI, work-item, schedule, or API event | Authenticated normalized trigger | Verify source, replay, scope, revision, target, deduplication | Integration owner |
| Workflow controller | Trigger plus protected version/configuration refs | State transitions and terminal outcome | Own idempotency, retries, callbacks, budgets, cancellation, cleanup | Platform operations |
| Policy/approval service | Principal, action, resource, subject digests, context | Permit/deny plus decision record | Default deny, bind decision to exact subjects, prevent replay | Security/governance |
| Reasoning capability gateway | Validated role request and scoped evidence | Typed proposal/advice | Enforce role, tool, data, output, and budget boundary | Agent capability owner |
| Artifact/contract store | Versioned contracts and run artifacts | Protected references, integrity evidence, metadata | Integrity, access, retention, encryption, residency | Data/evidence owner |
| Runner launcher | Controller-issued execution request | Runner identity, endpoint/callback, lifecycle state | Enforce topology, isolation, quotas/budgets, termination | Execution platform owner |
| Test executor | Approved artifact, fixtures, runner profile, target | Normalized results and native evidence | Execute without redefining expectations; always clean up | QA execution owner |
| Failure classifier | Results, target health, setup state, intent-integrity evidence | Typed classification and next-route eligibility | Apply rules where mechanically decidable; route subjective cases to governed evaluation or review | QA platform owner |
| Evidence publisher | Results, classifications, approvals, artifacts | Sanitized evidence manifest and report | Redact, retain, attest, prevent partial result from appearing complete | Evidence owner |
| Delivery adapter | Canonical outcome and exact revision | Forge-native check/status | Idempotent mapping; only `passed` may satisfy success | Delivery-platform owner |
| Observability service | Events, states, policy decisions, agent/tool calls | Metrics, logs, traces, audit views, alerts | Correlation, access control, retention, signal integrity | Platform operations |

Each interface must have an explicit schema owner, version policy, error model, identity, idempotency behavior, timeout, and audit requirement.

## Independently enforced workflow model

### Recommended state groups

| State group | Example states | Permitted outputs |
|---|---|---|
| Intake | `RECEIVED`, `AUTHENTICATED`, `DEDUPLICATED` | Normalized trigger or typed rejection |
| Resolution | `REGISTRY_RESOLVED`, `CONTRACTS_PINNED`, `POLICY_CHECKED` | Protected, versioned input set or policy/compatibility failure |
| Preparation | `TARGET_HEALTHY`, `ARTIFACT_VALIDATED`, `FIXTURES_READY` | Execution-ready request or typed setup failure |
| Execution | `RUNNER_LAUNCHED`, `RUNNING`, `RESULTS_CAPTURED`, `CLEANUP_PENDING` | Normalized results, timeout, cancellation, or platform error |
| Analysis | `CLASSIFIED`, `TRIAGE_REQUESTED`, `REPAIR_PROPOSED`, `REPAIR_VERIFIED` | Classification and an authorized next action |
| Publication | `EVIDENCE_FINALIZED`, `CHECK_PUBLISHED` | Protected manifest and external reference |
| Terminal | `PASSED`, `FAILED`, `INCONCLUSIVE`, `POLICY_DENIED`, `PLATFORM_ERROR`, `CANCELLED`, `SUPERSEDED` | One canonical terminal outcome |

State names are illustrative. The implementation may use a state machine, durable workflow engine, queue-backed controller, or equivalent, provided authorization, budgets, state transitions, and terminal semantics remain independently enforced and inspectable.

### Transition rules

- Every transition consumes versioned, authenticated, or otherwise integrity-protected inputs/state appropriate to the risk.
- Every write uses an idempotency key derived from the run and action.
- Agent output is a proposal payload, never a workflow transition command.
- Callback tokens or continuation handles are scoped, expiring, and single-use.
- Retry policy is keyed to typed errors, not free-text model analysis.
- Cleanup is reachable from every state that allocates a resource.
- Publication waits for required evidence finalization, but evidence-publication failure remains distinguishable from the underlying test result.
- A terminal state cannot be rewritten; corrections create a new linked run or decision.

### Workflow definition acceptance tests

Test at minimum:

- duplicate and reordered events;
- stale source revision or target;
- unsupported contract/profile version;
- approval expiry or subject-digest change;
- callback replay;
- agent timeout, malformed output, or policy denial;
- runner launch failure and execution timeout;
- cancellation during every resource-owning state;
- evidence upload and check-publication failure;
- controller restart during each durable wait;
- cleanup failure and later reconciliation.

## Execution topology variants

| Variant | Recommended when | Minimum guards | Main tradeoff |
|---|---|---|---|
| Existing CI runner | Approved suites are trusted and current CI isolation/credentials satisfy the runner contract | Pinned environment, scoped identity, clean workspace, evidence contract | Fast adoption but may inherit broad CI privilege |
| Central isolated runner | Targets are safely reachable and central operations are mature | Tenant isolation, target allowlist, egress control, disposable lifecycle | Simple operations but harder private-network/data access |
| Application-boundary runner | Target is private or application ownership/data locality must remain local | Cross-boundary launch role, callback authentication, local egress and cleanup ownership | Strong locality but distributed operations |
| Dual-path hybrid | Trusted approved suites run in CI; generated/repaired artifacts run in isolation | Identical result/evidence schemas, explicit trust classification, no silent path fallback | Optimizes cost/adoption but creates two execution paths |
| Organization-managed execution adapter | Existing internal platform already provides compliant isolated jobs | Conformance tests for identity, isolation, contracts, cancellation, evidence | Maximizes reuse but platform capability may vary |

**HUMAN DECISION:** select topology per repository/profile, not necessarily once for the entire organization.

## Agent invocation boundaries

### Invocation envelope

Every agent request should identify:

- role and capability version;
- project, repository, source, environment, and run identifiers;
- protected input artifact references and integrity evidence;
- requirement authority status;
- active policy and autonomy tier;
- permitted tools, resources, paths, and data classes;
- attempts, time, token/cost, output-size, and side-effect budgets;
- required response schema;
- redaction and evidence requirements;
- escalation owner.

### Agent response

Require a typed response containing:

- proposal or advice type;
- exact input references used;
- structured output artifact and digest;
- confidence as non-authoritative telemetry;
- assumptions, conflicts, and missing evidence;
- requested validation mechanisms;
- prohibited-action attestations where policy uses them;
- tool-call and policy-decision references.

### Control rules

- The controller selects whether an agent is invoked; an agent does not invoke itself.
- Tools enforce authorization and business invariants independently of the prompt.
- The model never receives raw long-lived credentials.
- An output that fails schema, policy, provenance, or invariant validation is rejected, not repaired by silent coercion.
- Agent retries receive typed validation errors and remain within the original action scope.
- Different data/tool permissions or accountable owners justify separate deployed agents; labels on a diagram do not.

## Non-AWS capability equivalents

If AWS is not selected, preserve these capability categories:

| Required capability | Examples of implementation category |
|---|---|
| Authenticated integration | Forge application, webhook gateway, CI plugin, event bus |
| Durable controller | Durable workflow engine, queue-backed state machine, orchestrator |
| Registry and policy state | Transactional database, protected configuration service |
| Protected artifact store | Object storage or artifact registry with retention and integrity controls |
| Reasoning runtime | Approved managed model runtime or isolated internal inference service |
| Tool gateway | Typed internal APIs with credential mediation and independent validation |
| Authorization | Policy-as-code engine plus human approval system |
| Isolated execution | Disposable VM/microVM, container job, sandbox service, hardened CI runner |
| Observability | Central logs, metrics, traces, audit and evidence views |
| Delivery integration | Source-control check/status adapter and release-control API |

Conformance to contracts and safety invariants matters more than product parity.

## Failure and recovery routes

| Condition | Canonical outcome/class | Automatic action | Human route |
|---|---|---|---|
| Invalid signature, replay, or unregistered source | `policy_denied` or rejected intake | No run; retain security audit | Integration/security owner |
| Unsupported contract or runner profile | `platform_error` or compatibility failure | No execution; identify required upgrade | Platform and repository owner |
| Target missing, unhealthy, or superseded | `infrastructure_error` or `superseded` | Bounded health retry or cancel | Application/CI owner |
| Fixture validation/setup failure | Data/fixture failure | Independently controlled cleanup; retry only declared transient path | QA data owner |
| Approved assertion fails | `failed_product_expectation` | No repair of expectation | Application/product owner |
| Known binding/test-implementation defect | Repair-eligible classification | Propose allowlisted repair if autonomy permits | QA approver initially |
| Ambiguous semantic failure | `inconclusive` | No automatic repair or gate success | Product/requirement authority |
| Unknown technical failure | Unknown classification | Read-only triage advice if enabled | QA/platform owner |
| Agent malformed output or timeout | `platform_error` or agent-capability failure | Bounded retry with typed error; no scope expansion | Agent capability owner |
| Runner timeout/crash | `infrastructure_error` or execution-platform failure | Terminate, collect partial evidence, clean up | Execution-platform owner |
| Evidence finalization failure | `platform_error` | Preserve test result separately; retry evidence publication | Evidence/platform owner |
| Check/status publication failure | Integration failure | Idempotent retry; do not claim external gate completion | Delivery-platform owner |
| Cancellation or newer deployment | `cancelled` or `superseded` | Stop work and reconcile resources | Usually no approval; notify owner |
| Cleanup failure | Cleanup/reconciliation incident | Enqueue controlled reconciliation and alert | Platform/application owner |

Only an authorized success outcome may satisfy a success gate. A separately approved emergency bypass must remain visible and must not rewrite the QA outcome.

## Build-ready design artifacts

Before implementation begins, produce:

1. context and trust-boundary diagram;
2. success, error, cancellation, and approval sequence diagrams;
3. component/interface catalogue with owners;
4. workflow state, authorization, and typed-error model;
5. identity and authorization matrix;
6. network and execution-topology design;
7. contract schemas and compatibility rules;
8. agent role, tool, data, and budget definitions;
9. evidence, retention, redaction, and access model;
10. observability, SLO, capacity, cost, incident, and recovery design;
11. repository-onboarding and conformance tests;
12. pilot rollout, rollback, and decision gates.

The implementation plan must trace each component and interface to an approved decision, acceptance test, operating owner, and rollback path.

## Readiness checklist

### Authority and governance

- [ ] Authoritative requirements and test oracle are named.
- [ ] Assumed/conflicting items cannot become gates.
- [ ] Proposal, authorization, approval, merge, and deployment identities are separate.
- [ ] Every autonomy decision has an owner and protected policy version.

### Integration and workflow

- [ ] Trigger authentication, replay, deduplication, cancellation, and supersession are designed.
- [ ] Existing CI/CD and QA-platform responsibilities do not overlap ambiguously.
- [ ] State transitions, typed errors, retries, callbacks, budgets, and cleanup are independently enforced and inspectable.
- [ ] External check/status mapping preserves canonical outcomes.

### Execution

- [ ] Runner placement is selected per profile/repository with evidence.
- [ ] Generated or repaired artifacts execute in fresh isolation.
- [ ] Identity, network, egress, secrets, target and data boundaries are explicit.
- [ ] Setup, execution, evidence, cancellation, and cleanup conformance tests exist.

### Agent capabilities

- [ ] Each role has typed inputs/outputs, narrow tools, prohibitions, budgets, and escalation.
- [ ] Agent output cannot directly transition workflow, publish authority, or determine pass/fail.
- [ ] Model/prompt/tool versions and evaluations are represented in evidence.
- [ ] Repair preserves intent under a representation-appropriate integrity check.

### Operations

- [ ] SLOs, capacity, backpressure, cost, dashboards, alerts, runbooks, recovery, and support ownership are defined.
- [ ] Evidence access, redaction, encryption, residency, retention, and legal-hold needs are defined.
- [ ] Platform, integration, application, and product failures remain distinguishable.
- [ ] Pilot entry criteria and rollback have been tested.
