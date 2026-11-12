# Responsibility Allocation

These are logical responsibilities. They are not a recommendation to deploy a matching set of agents or services. Allocate each responsibility to model-assisted reasoning, deterministic software, policy authorization, or an accountable human before naming deployment units.

First decide what requires independently enforced control, what benefits from model judgment, what ordinary software can do, and what remains human authority. Combine related reasoning roles until scale, security, lifecycle, or ownership requires separation.

## Contents

- [Responsibility catalogue](#responsibility-catalogue)
- [Six-agent presentation model](#six-agent-presentation-model)
- [Deciding which capabilities to introduce](#deciding-which-capabilities-to-introduce)
- [Synthetic-data responsibility split](#synthetic-data-responsibility-split)
- [When to split an agent](#when-to-split-an-agent)
- [Tool design](#tool-design)
- [Repair eligibility](#repair-eligibility)
- [Responsibility map template](#responsibility-map-template)

## Responsibility catalogue

| Responsibility | Inputs | Outputs | Allowed actions | Prohibited actions | Recommended implementation | Introduce when |
|---|---|---|---|---|---|---|
| Requirements Analysis | Approved stories, product documents, schemas, invariants, prior decisions | Expected behaviors labeled `authoritative`, `derived`, `assumed`, or `conflicting`, with provenance | Extract, cross-reference, identify gaps and conflicts | Resolve ambiguity; treat assumptions as truth; confirm defects | Usually part of Test Planning, with independent schema/contract checks | Sources require interpretation before test planning |
| Test Planning | Authority map, risks, existing coverage, supported profiles | Traceable candidate cases, priorities, negative/boundary cases, coverage gaps | Draft cases or a reviewable case change | Merge; change requirements; edit application code | Model agent with narrow case tools | An accountable test-intent owner and approval path exist |
| Test Authoring / Binding | Approved cases, exact source revision, application contracts, snapshots, runner profile | Declarative bindings or profile-constrained candidate tests | Read scoped source/evidence; map approved intent to executable artifacts | Invent semantics; arbitrary shell; rewrite oracle; edit application | Model agent behind profile validation and code review | The test oracle and runner profile are stable |
| Synthetic Data / Fixture Preparation | Approved `given` conditions, schemas, relationships, prohibited-field policy, seed | Schema-valid fixture manifest and setup actions with provenance | Generate fictional values within constraints | Use production rows, secrets, direct production access, or bypass validation | Ordinary generators first; optional Fixture Intent Agent for complex relationships | Test scenarios require repeatable non-trivial state |
| Test Execution | Approved test artifact, fixtures, runner profile, allowlisted target | Results, native evidence, cleanup record | Validate and execute in isolation; collect evidence; clean up | Decide expectations; use merge/deploy credentials; expand target/network scope | Fixed runner or independently validated execution service | Foundation before generated execution |
| Failure Classification | Structured results, target health, setup status, history, intent-integrity evidence | Known class and permitted next route | Apply fixed rules where reliable; preserve uncertainty | Modify tests; declare ambiguous failures product defects | Rules for mechanically decidable classes; governed evaluation or review for subjective and residual cases | Foundation |
| Triage Advice | Unresolved/unknown classification plus sanitized evidence | Suggested class, rationale, missing evidence, recommended human action | Read sanitized evidence and advise | Change artifacts; silently become authority; authorize repair | Read-only Triage Agent | Rule-based classification leaves a measured residual ambiguity |
| Repair Proposal | Eligible test-implementation failure, baseline artifact, evidence, allowlist and budgets | Candidate patch plus transformation classification and proof plan | Propose allowlisted locator, bounded-wait, or same-schema fixture transformations | Change assertions, expectations, or case scope under repair authority; skip/hide tests | Repair Agent behind independent pre/post guards; other change classes use separate workflows | Eligible repair classes, evaluation, rollback, and fresh-run verification exist |
| Evidence / Reporting | Normalized outcomes, artifact references, classifications, redaction policy | Sanitized evidence manifest, check/status, human report, optional defect draft | Map authorized conclusion; redact; summarize | Let ungoverned model confidence change conclusion; expose sensitive raw evidence | Independently controlled publication; optional prose summarizer | Foundation |
| Workflow Control | Authenticated events, state, policies, budgets, callbacks | Ordered steps, durable state, terminal outcome | Own retries, timeouts, concurrency, callbacks, cancellation and cleanup | Let a reasoning step expand its own authority or acceptance | Independently enforced workflow; model loops may exist inside a bounded state | Foundation |
| Policy Authorization | Exact mechanically verifiable action, subject digests, policy, environment, requester identity | Authenticated, expiring, replay-protected allow/deny decision | Authorize only the allowlisted action class encoded in policy | Resolve semantic ambiguity; waive evidence; authorize itself | Independently enforced policy service | Machine-verifiable actions need contextual authorization |
| Semantic Approval | Exact requirement, case, expected behavior, risk or exception requiring judgment | Authenticated approval, rejection or requested revision | Accountable human decides the exact semantic subject | Delegate meaning or risk acceptance to an agent; reuse approval after subject changes | Existing review system plus independently protected approval record | Meaning, risk or required human governance is involved |
| Code Review | Developer or generated test change, approved cases, requirements, engineering standards | Advisory findings, coverage mapping and policy observations | Comment on the scoped change | Approve, merge, weaken intent or silently become the QA gate | Read-only Code Review Agent plus the normal repository review control | Generated executable artifacts or story-aware review provide measurable value |

## Six-agent presentation model

For a simple stakeholder view, use six bounded reasoning roles:

1. **Test Plan Agent** — includes requirements analysis and proposes traceable cases.
2. **Test Author Agent** — converts approved intent into profile-constrained executable automation.
3. **Code Review Agent** — provides advisory quality, policy and coverage findings.
4. **Fixture Intent Agent** — proposes the canonical synthetic-data blueprint.
5. **Triage Agent** — advises only on residual failures that deterministic classification cannot resolve.
6. **Repair Agent** — proposes eligible, assertion-preserving maintenance.

Workflow control, validation, execution, policy authorization, evidence publication and human approval are not agents. They remain independently enforced controls.

## Deciding which capabilities to introduce

Start with the smallest reasoning surface that addresses a measured gap:

1. Keep an existing human or software path when it is already effective.
2. Add read-only analysis or drafting before executable or release-affecting actions.
3. Add test authoring only after the test authority and runner contract are clear.
4. Use ordinary schema-driven generation directly when it is sufficient.
5. Add model-assisted triage only for residual ambiguity that rules cannot classify reliably.
6. Add repair after repair-eligible classes, intent-preservation checks, verification, false-repair measures, and rollback exist.

Execution, workflow authority, acceptance policy, publication, and approval require independently enforced controls. They may contain model-assisted substeps, but the model does not control its own authorization or the governing result.

## Synthetic-data responsibility split

Treat synthetic test data as a coordinated capability rather than a single agent:

| Responsibility | Default owner/implementation |
|---|---|
| Define required entities, states, boundaries and invalid conditions | QA/domain authority, optionally assisted by test planning |
| Select schemas, providers and domain recipes | Versioned template or factory; optional model assistance for complex relationships |
| Generate primitive values | Pinned seedable Faker-style provider when repeatability matters |
| Assemble entity graphs and transitions | Versioned factories/builders |
| Validate schema, constraints, uniqueness, privacy and policy | Independently enforced validator |
| Provision, namespace and clean up target state | Independently controlled adapter with run-scoped identity |
| Approve production-derived inputs, retention and residual risk | Human data/privacy authority |

Read `synthetic-test-data.md` before proposing generator tools, Data Agent permissions, data contracts, or production-derived synthesis.

## When to split an agent

Split a logical responsibility into a separate deployed agent only when at least one is true:

- it needs materially different data or tool permissions;
- it has a different accountable owner or release lifecycle;
- it needs independent scaling or cost controls;
- its prompt/model/evaluation lifecycle differs substantially;
- isolation reduces meaningful security or semantic risk.

Do not split merely to mirror a diagram.

## Tool design

Each agent tool should have:

- typed input and output;
- authenticated workload identity;
- default-deny authorization;
- resource and action scope;
- independent input validation and business guards;
- replay protection or idempotency where the operation requires it;
- tamper-evident, append-only, or otherwise protected audit record appropriate to risk;
- redaction at ingress and egress;
- explicit error semantics.

Omit tools for actions an agent must never perform. “No merge tool exists” is stronger than telling a model not to merge.

## Repair eligibility

A repair proposal is eligible only when all are true:

- the authoritative test intent is unambiguous;
- an authorized classifier identifies an allowed test-implementation class;
- the proposed transformation is in the active runner profile allowlist;
- an appropriate structural or semantic check shows the governing intent remains unchanged;
- scope, attempts, time, cost, and permissions remain within budget;
- verification uses a fresh isolated run;
- evidence is complete and non-ambiguous.

Otherwise escalate to a human. Missing evidence fails closed.

## Responsibility map template

| Responsibility | Current owner/component | Target: software/control / model / human | Deploy separately? | Tools/data | Prohibitions | Approval | Phase |
|---|---|---|---|---|---|---|---|
| Example | Existing CI job | Independently controlled software | No | Preview URL | No deploy | Existing release owner | Foundation |
