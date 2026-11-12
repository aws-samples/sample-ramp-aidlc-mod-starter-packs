# Contracts and Evidence

Use versioned contracts so repositories, agents, runners, and governance can evolve independently without relying on model interpretation.

When a build-ready design needs concrete payloads, adapt and validate the illustrative schemas in `contract-examples.md`.

## Contents

- [Common contract envelope](#common-contract-envelope)
- [Minimum contract catalogue](#minimum-contract-catalogue)
- [Requirement authority record](#requirement-authority-record)
- [Test-case authority](#test-case-authority)
- [Conclusion model](#conclusion-model)
- [Evidence manifest](#evidence-manifest)
- [Approval binding](#approval-binding)
- [Schema evolution](#schema-evolution)
- [Contract review checklist](#contract-review-checklist)

## Common contract envelope

Each material artifact should carry, where applicable:

- contract type and schema version;
- stable artifact identifier plus integrity or version evidence appropriate to risk;
- producer identity and producer version;
- source provenance and an exact or otherwise explainable source revision;
- project, repository, change, environment, and run correlation identifiers;
- created timestamp and expiry/retention class;
- active policy and runner-profile versions;
- parent/input artifact references;
- data classification and redaction status;
- signature or attestation reference.

Keep large artifacts and evidence out of workflow state; pass versioned, content-addressed, signed, or otherwise integrity-protected references as appropriate.

## Minimum contract catalogue

| Contract | Purpose | Required authority or controls |
|---|---|---|
| Project/repository registration | Maps projects, repos, owners, cases, environments and permitted profiles | Human-approved authoritative registry or protected manifest |
| Change/deployment trigger | Starts a run against exact source and target | Authenticated, replay-protected, idempotent |
| Requirement authority | Records expected behavior, classification, source and derivation/conflict | Human decision for unresolved semantics |
| Approved test case | Captures intent, traceability, risk, preconditions, action and expectation | Approved oracle with protected version history |
| Binding/generated test artifact | Maps approved intent to executable form | Profile-constrained; exact source and case references |
| Runner profile | Defines image, dependencies, commands, targets, evidence, budgets and repairs | Versioned platform policy |
| Synthetic data recipe | Defines schemas, providers, factories, constraints, seed derivation and prohibited sources | Approved recipe; schema/domain/privacy policy |
| Fixture/dataset manifest | Records generated instance, recipe/tool versions, seed, output integrity, setup, cleanup and scans | Reproducible or explainable generation plus governed validation |
| Execution request | Binds source, suite, artifact, data, runner, target, policy and budget | Controller-issued, run-scoped |
| Normalized test result | Records assertion or evaluation outcomes, timings, integrity checks and artifact refs | Emitted by the authorized executor/evaluator |
| Failure classification | Records class, evidence, rule/model version and confidence | Independently governed; model advice does not silently become authority |
| Repair proposal | Records eligible class, transformation, patch, invariant proof and verification plan | No semantic change; separate authorization |
| Approval decision | Grants or rejects exact action on exact subjects | Authenticated, expiring, replay-protected |
| Evidence manifest | Indexes sanitized evidence with provenance, access and retention | Governed generation and redaction |
| Published check/report | Maps terminal platform outcome to external conclusion | Versioned outcome policy; idempotent update |

## Requirement authority record

Minimum fields:

```yaml
expectation_id: refund-window
classification: conflicting # authoritative | derived | assumed | conflicting
statement: "Refund eligibility window is unresolved."
sources:
  - type: work-item
    versioned_ref: "<source reference and integrity evidence>"
    claim: "30 days"
  - type: api-contract
    versioned_ref: "<source reference and integrity evidence>"
    claim: "14 days"
derivation: null
decision:
  status: pending
  owner: product-owner
```

Do not overwrite earlier authority records. Publish a new version linked to the decision that supersedes it.

## Test-case authority

An approved case should contain:

- stable case ID and version;
- requirement/expectation references;
- authority classification;
- risk and priority;
- `given`, `when`, and `then` intent;
- negative and boundary classification where relevant;
- supported execution profiles;
- approver and approval subject;
- protected publication reference or equivalent provenance.

The approved case expresses intent. Bindings and generated code are replaceable mechanisms and cannot silently modify it.

## Conclusion model

Use explicit terminal outcomes. The following vocabulary is illustrative:

- `passed`;
- `failed_product_expectation`;
- `inconclusive`;
- `neutral`;
- `infrastructure_error`;
- `platform_error`;
- `policy_denied`;
- `approval_rejected`;
- `cancelled`;
- `superseded`.

Only the organization's authorized success outcome may satisfy a success gate, and only when all required approved checks completed under the expected contract. Treat missing, stale, partial, quarantined, provisional, or unauthorized evidence as non-pass.

Some checks—such as visual, semantic, or accessibility evaluations—may use probabilistic models. Their acceptance thresholds, abstention behavior, review policy, and independence from repair must be governed explicitly. Model confidence alone is not a release conclusion.

## Evidence manifest

Include:

- exact source, suite, binding/test, fixture, runner image, target, environment and policy digests;
- workflow execution and agent/tool/policy correlation IDs;
- assertion/scenario fingerprints or another suitable intent-integrity proof;
- normalized results;
- logs, traces, screenshots, videos, network or accessibility artifacts as permitted;
- classification and repair chain;
- approvals and external check/status references;
- redaction/scanning results;
- cleanup result;
- retention, encryption, access, residency and legal-hold class.

Do not paste raw sensitive artifacts into issues or pull requests. Publish a sanitized summary and access-controlled evidence reference.

## Approval binding

An approval record should bind:

- action and allowed side effect;
- requester and independent approver;
- source, artifact, test, policy, runner, infrastructure/target and environment digests;
- issue/repository/project scope;
- issued, expiry and consumed timestamps;
- nonce/idempotency key;
- decision rationale and conditions.

A changed bound subject invalidates the approval. Forge-native approvals may mirror the decision, but the organization must decide which control is authoritative.

## Schema evolution

- Use explicit versions and compatibility rules.
- Reject unknown required fields or unsupported major versions.
- Preserve readers for an agreed transition window.
- Record producer and consumer versions in evidence.
- Test upgrade and rollback paths with representative repositories.
- Give repository owners advance deprecation dates and an exception process.

## Contract review checklist

- Can every run be reproduced or explained from protected, versioned inputs and recorded evaluator decisions?
- Can a stale suite, runner, approval, or target be detected?
- Can an agent forge authority by editing a contract?
- Can the system distinguish product failure from platform failure?
- Are redaction and access decisions represented, not implied?
- Is each contract owner and compatibility policy named?
