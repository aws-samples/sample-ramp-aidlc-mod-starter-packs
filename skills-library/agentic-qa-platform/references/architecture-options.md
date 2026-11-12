# Architecture Options

Use this reference to compare platform shapes and define capability boundaries. It is a decision framework, not a preferred topology or product list.

## Contents

- [Architectural intent](#architectural-intent)
- [Logical planes](#logical-planes)
- [Platform shape comparison](#platform-shape-comparison)
- [Reference hybrid flow](#reference-hybrid-flow)
- [Authority for test intent](#authority-for-test-intent)
- [Test artifact strategy](#test-artifact-strategy)
- [Placement decisions](#placement-decisions)
- [Technology mappings](#technology-mappings)
- [Architecture acceptance conditions](#architecture-acceptance-conditions)

## Architectural intent

A reusable QA capability should make these boundaries visible:

```text
Requirement and test authority
            |
            v
Independently enforced control ---- Human and policy authority
            |
            +---- bounded agentic reasoning
            |
            v
Isolated execution plane
            |
            v
Authorized conclusions and governed evidence
            |
            v
Existing CI/CD check, status, or release gate
```

Model-assisted capabilities operate inside independently enforced boundaries. They do not own the definition of success or their own authorization.

## Logical planes

### Authority plane

Owns approved requirements, test cases, policies, runner profiles, approval records, and exceptions.

**SAFETY INVARIANT:** the mechanism seeking to make a failed run green cannot redefine the authoritative test intent.

### Control plane

Authenticates events, captures versioned or otherwise tamper-evident inputs, resolves repository/project configuration, invokes capabilities in order, enforces budgets, waits for approvals, records state, and maps outcomes.

Workflow state, budgets, authorization, and terminal outcomes must be independently enforced and inspectable. Deterministic software is the usual implementation; a model may assist inside a bounded step but does not control its own authority or acceptance.

### Reasoning plane

May interpret requirements, draft cases, create bindings, advise on unknown failures, or propose allowlisted repairs. Each role receives narrow tools and sanitized context.

### Execution plane

Runs pinned, validated test artifacts against an allowlisted target in an isolated, disposable environment. It emits normalized results and evidence but does not decide expected behavior.

### Evidence and integration plane

Stores versioned, tamper-evident, or write-once artifacts as risk requires, applies redaction and retention, produces human-readable reports, and publishes governed checks or statuses to the delivery system.

## Platform shape comparison

| Shape | Best fit | Advantages | Costs and risks |
|---|---|---|---|
| Repository-local | Existing CI and teams can satisfy the shared contracts | Lowest adoption friction; local ownership | Duplication and uneven governance |
| Federated kit | Heterogeneous teams need common standards, adapters, and policy without shared execution | Local compatibility with reusable components | Upgrade coordination and standards drift |
| Shared service | Cross-repository state, specialist operations, scale, or strong common governance justify shared ownership | Consistent policy, evidence, observability, and upgrades | Central dependency, tenancy, network reach, and migration pressure |
| Hybrid | Some capabilities benefit from sharing while build, deployment, data, or execution remain local | Centralizes only demonstrated common needs | Requires explicit boundaries and consistent evidence across paths |

Select a shape after the fit-gap analysis. “We want a central platform” and “keep everything local” are both inputs to validate, not sufficient evidence by themselves.

## Reference hybrid flow

This is one illustrative flow, not a required topology or processing model. Replace individual steps with repository-native controls, governed probabilistic evaluation, human review, or other mechanisms when they better fit the test type and risk.

```text
Approved requirement/case change
  -> accountable approval and versioned publication

Application pull request
  -> existing CI builds and deploys preview/test target
  -> authenticated deployment-ready event
  -> QA controller resolves project, suite, source and policy versions
  -> policy-controlled preflight
  -> optional Test Author/Binding Agent
  -> fixture validation and target preparation
  -> suitably isolated executor
  -> governed result evaluation and failure classification
  -> optional read-only Triage Adviser for unknowns
  -> optional bounded Repair Agent proposal
  -> independent verification appropriate to the change
  -> authorized conclusion and sanitized evidence
  -> repository check/status returned to existing CI/CD
```

The flow may be initiated by a work item, pull request, deployment event, schedule, or explicit request. The accountable organization decides which event is authoritative for each use case.

## Authority for test intent

Common patterns:

- **Separate approved cases repository** — strong separation, cross-repository reuse, and human merge as approval; adds synchronization and ownership overhead.
- **Protected directory in the application repository** — simpler locality and versioning; requires controls that prevent the same automation from casually changing application and test intent.
- **External test-management system** — useful when already authoritative; requires versioned snapshots or equivalent provenance and stable identifiers for reproducibility.

Select an authoritative source and preserve the exact approved test intent used by each consequential run. Do not let the actor executing or repairing a test silently edit that authority.

## Test artifact strategy

Prefer approved declarative cases plus declarative bindings interpreted by a fixed runner when this is expressive enough. This reduces arbitrary code generation and makes repair boundaries easier to enforce.

**ACCEPTABLE OPTION:** generate code through a versioned framework profile when custom logic is required. The profile must define:

- pinned runner image and dependencies;
- permitted files, commands, imports, targets, and side effects;
- compile, lint, discovery, execution, cleanup, and evidence behavior;
- normalized result mapping;
- an intent-integrity mechanism appropriate to the representation, such as structured comparison, protected fields, signatures, or assertion/scenario fingerprints;
- eligible repairs and prohibitions;
- time, concurrency, network, evidence-size, and cost ceilings.

Generated shell requires the same explicit profile, isolation, policy, provenance, and review as other generated executable code; it is not a safe default contract.

## Placement decisions

The control plane and execution plane need not share an account, network, cluster, or runner.

- Run close to the application boundary when the target is private or when account ownership must remain with the application team.
- Run centrally when the target is safely reachable and central isolation/operations are demonstrably stronger.
- Use organization-managed runners when existing runner controls meet the execution contract.
- Use disposable isolated runners for untrusted generated artifacts.

Record trust boundaries, cross-boundary identity, egress, callback, artifact transfer, cleanup, and incident ownership.

## Technology mappings

Examples such as workflow orchestration, agent runtime, policy gateway, disposable microVM execution, forge applications, work-management webhooks, and object storage express capabilities.

For component interfaces, state transitions, error routes, and topology variants, read `implementation-blueprints.md` when build-ready depth is required. For AWS-specific mappings, read `aws-implementation-options.md`.

## Architecture acceptance conditions

- No model-controlled authorization or release conclusion.
- No ambiguous authority hidden inside generated tests.
- No agent path to merge, deployment, policy change, or production data by default.
- Every consequential event and write is authenticated, scoped, replay-safe or idempotent as appropriate, and auditable.
- Every test run identifies exact source, approved suite, binding/test artifact, runner, target, data, and policy versions.
- Every ephemeral resource has termination behavior, TTL, and cleanup ownership.
- Every platform failure remains distinguishable from a product failure.
