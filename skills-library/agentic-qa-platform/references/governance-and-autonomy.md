# Governance and Autonomy

Use this reference to define requirement authority, action authority, identity separation, repair boundaries, data controls, and staged autonomy.

Before enabling or expanding an agentic capability, apply the evaluation and security gates in `agent-evaluation-and-threat-model.md`.

## Contents

- [Three authority levels](#three-authority-levels)
- [Requirement authority](#requirement-authority)
- [Identity separation](#identity-separation)
- [Tool and policy controls](#tool-and-policy-controls)
- [Execution isolation](#execution-isolation)
- [Synthetic data](#synthetic-data)
- [Failure and repair policy](#failure-and-repair-policy)
- [Budget model](#budget-model)
- [Illustrative adoption tiers](#illustrative-adoption-tiers)
- [Governance matrix template](#governance-matrix-template)

## Three authority levels

### Agent-executed

Appropriate for isolated, reversible analysis and proposals:

- read approved, scoped inputs;
- identify requirement gaps and conflicts;
- draft test plans, bindings, fixtures, diagnoses, reports, and repairs;
- execute only through independently controlled interfaces.

### Policy-authorized

Appropriate for narrowly bounded, machine-verifiable actions:

- launch disposable non-production execution;
- publish write-once artifacts;
- open a draft case/test change;
- apply a transformation whose type and invariants can be mechanically verified;
- retry within explicit budgets.

The authorization, scope checks, and acceptance conditions are enforced outside the model.

### Human-approved

Required by default for:

- resolving ambiguous or conflicting expected behavior;
- approving or merging the authoritative test oracle;
- changing assertions, expectations, scenario scope, or business meaning;
- applying application code, dependency, workflow, infrastructure, identity, network, or policy changes proposed from the QA path;
- expanding an agent's autonomy or tool access;
- making a check required or changing fail-open/fail-closed behavior;
- accessing production-derived data;
- shared staging or production impact.

The model proposes. It never grants itself authority.

## Requirement authority

Classify expected behavior as:

- `authoritative` — explicitly supported by an approved requirement, schema, invariant, accessibility rule, or governed reference result;
- `derived` — mechanically inferred from authoritative material, with derivation recorded;
- `assumed` — proposed because information is incomplete;
- `conflicting` — credible sources disagree.

`assumed` and `conflicting` items may appear in drafts with visible warnings. They cannot confirm a product defect, authorize repair, block release, or redefine expected results.

Example:

```text
Story: refunds within 30 days
API contract: refunds within 14 days
Current application: refunds within 7 days

Classification: conflicting
Allowed: draft cases preserving all sources; request accountable decision
Prohibited: select one value, repair tests to seven days, or enable a required gate
```

## Identity separation

Keep distinct identities for:

- initiator;
- reasoning agent;
- independently controlled tool/service;
- policy authorizer;
- human approver;
- merge actor;
- deployment actor.

An approval must bind to the requester, action, and the exact subjects needed to prevent reuse after a meaningful change. Depending on risk, those subjects can include source, artifact, test, policy, runner, infrastructure/target, and environment digests. It must expire and be single-use where appropriate.

## Tool and policy controls

- Default deny every agent action.
- Give each role only the tools it needs.
- Prefer omission of dangerous tools over prompt-only prohibitions.
- Use short-lived, resource-scoped credentials behind controlled tools; do not expose raw credentials to the model.
- Revalidate repository, branch, path, project, case, target, and digest inside the tool.
- Separate read and write tools and identities.
- Log policy decision, principal, action, resource, validated input digest, and outcome.
- Test permitted and forbidden calls before enforcing a new policy.

## Execution isolation

Generated, repaired, or otherwise untrusted artifacts must:

- run in a fresh or reliably reset isolated environment;
- consume checksummed input bundles or a tightly controlled source checkout;
- have no merge, deployment, policy, broad repository, or production-data credentials;
- reach only allowlisted non-production targets and dependencies;
- use capped time, compute, concurrency, network, evidence size, and cost;
- write only run-scoped evidence;
- terminate and clean up on success, failure, timeout, cancellation, callback loss, or controller failure.

## Synthetic data

**RECOMMENDED DEFAULT:** schema-first fictional data, never production rows supplied to a model.

Use:

- schemas and explicit domain constraints;
- recorded run seed and derived shard seeds where replay is required;
- allowlisted generators;
- reserved domains and clearly fictional values;
- schema, relationship, uniqueness, prohibited-pattern, PII, and secret validation;
- quarantine when validation is uncertain;
- provenance containing schema, generator/model/prompt version, seed, policy, and scan results.

Production-derived synthesis is a higher-risk option requiring explicit privacy, legal, security, retention, residency, and access decisions.

## Failure and repair policy

Classify before repair. Use rules where outcomes are mechanically decidable; governed probabilistic evaluators or human review may handle subjective or ambiguous evidence when thresholds, abstention, and authority are explicit:

1. environment/setup failure;
2. data/fixture failure;
3. known or suspected flake;
4. test binding/implementation defect;
5. application-contract defect;
6. ambiguous semantic failure;
7. policy or platform failure.

Only an explicitly repair-eligible test-implementation class may reach automatic repair.

Common allowlisted transformations:

- replace a broken locator with a unique semantic equivalent;
- replace a fixed sleep with a bounded condition-based wait;
- regenerate fixture values from the same approved schema.

Under test-repair authority, automatic repair must not:

- delete, skip, quarantine, hide, or downgrade a test to obtain green;
- weaken, remove, negate, broaden, or alter an assertion;
- change status codes, schemas, authorization behavior, accessibility expectation, or business outcome;
- conceal failure through excessive retry, wait, or warning;
- modify application code, dependencies, workflow, infrastructure, identity, network, policy, runner profile, or evidence collection;
- change its own attempts, scope, cost, tools, or permissions.

Changes outside that boundary may be proposed, but they enter a separate change workflow with their own review, tests, authorization, and rollback.

Every accepted repair requires independent validation appropriate to its representation and a fresh affected-scope verification run in an environment whose isolation matches the artifact's trust and risk. A complete affected-suite run is appropriate when narrower impact cannot be justified. Missing or ambiguous evidence remains non-success.

## Budget model

Define budgets by action class, not just retry count:

- maximum attempts;
- elapsed time;
- compute and model cost;
- files and lines changed;
- allowed transformation types;
- target/environment scope;
- data and evidence volume;
- network destinations;
- concurrent executions.

Controls outside the model enforce budgets. An agent cannot grant or consume an exception for itself.

## Illustrative adoption tiers

| Tier | Capability | Gate to advance |
|---|---|---|
| 0 Observe | Inventory, ingest, governed health/evidence | Stable correlation and no delivery impact |
| 1 Draft | Agent drafts plans/cases for human review | Measured usefulness, traceability, low unsafe suggestion rate |
| 2 Author | Candidate binding/test PRs | Stable profiles, review ownership, reproducibility |
| 3 Execute | Isolated execution, advisory conclusions | Environment/data reliability and explainable outcomes |
| 4 Gate | Approved suites become governed required checks | Accepted availability, false-block rate, outage policy |
| 5 Advise | Read-only triage on unknowns | Measured classification value |
| 6 Repair | Advisory, then policy-authorized bounded repair | Accepted false-repair rate, rollback, independent verification |

Adapt or omit tiers that do not match the use case. Autonomy is earned per repository and action class; advancing one capability does not automatically advance the platform.

## Governance matrix template

| Action | Agent may propose | Policy may authorize | Human approval | Prohibited | Evidence required |
|---|---:|---:|---:|---:|---|
| Draft test cases | Yes | Yes, to open draft | Required to merge initially | No | Requirement provenance and coverage |
| Execute approved suite in isolated test target | N/A | Yes | Optional by risk | Production by default | Exact suite, source, runner, target, policy |
| Change expected result | Yes, as a question | No | Yes | Agent self-approval | Authority decision record |
| Allowlisted binding repair | Yes | Later opt-in | Initially | Semantic change | Classification, intent-integrity proof, patch, fresh rerun |
| Application or policy change | Advisory only | No | Specialist | Agent execution | Reviewed change and approval |
