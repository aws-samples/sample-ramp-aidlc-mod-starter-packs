# Synthetic Test Data

Use this reference when synthetic data generation is part of the QA platform scope. Treat it as a first-class QA capability with its own contracts, controls, owners, and backlog—not as an independent platform by default.

## Contents

- [Position in the QA platform](#position-in-the-qa-platform)
- [Generation maturity ladder](#generation-maturity-ladder)
- [Reference flow](#reference-flow)
- [Responsibility split](#responsibility-split)
- [When model-assisted recipe design helps](#when-model-assisted-recipe-design-helps)
- [Generation strategy](#generation-strategy)
- [Tool selection](#tool-selection)
- [Generator recipe](#generator-recipe)
- [Determinism and reproducibility](#determinism-and-reproducibility)
- [Data quality and coverage](#data-quality-and-coverage)
- [Privacy and security](#privacy-and-security)
- [Provisioning and lifecycle](#provisioning-and-lifecycle)
- [Validation pipeline](#validation-pipeline)
- [Performance and volume data](#performance-and-volume-data)
- [Production-derived synthesis](#production-derived-synthesis)
- [Human decisions](#human-decisions)
- [Optional deliverables](#optional-deliverables)
- [Anti-patterns](#anti-patterns)
- [Readiness checklist](#readiness-checklist)

## Position in the QA platform

Treat synthetic test data as a distinct QA workstream when its complexity, risk, or reuse justifies it:

```text
Approved test case
  -> data requirements
  -> versioned generator recipe
  -> ordinary generation or approved model-assisted recipe execution
  -> schema/domain/privacy validation
  -> versioned fixture or dataset manifest with integrity evidence
  -> environment provisioning
  -> test execution
  -> cleanup and evidence
```

The test case defines what state is required. The data capability creates that state without redefining test intent.

Create a separate enterprise synthetic-data platform or skill only when the capability has substantial non-QA consumers, independent ownership, production-scale statistical modelling, centralized regulatory controls, or its own product/API lifecycle.

## Generation maturity ladder

Select the lowest level that satisfies the test:

| Level | Purpose | Recommended mechanism |
|---|---|---|
| Static approved examples | Golden contracts, fixed edge cases, regression fixtures | Protected version-controlled fixture |
| Field-level fake values | Names, emails, addresses, identifiers, text | Faker-style library |
| Schema-valid objects | API payloads and entity shapes | Schema-driven generator plus Faker providers |
| Domain-valid entity graphs | Orders, accounts, subscriptions, relationships and state | Factories/builders plus explicit business constraints |
| Property and boundary exploration | Broad input spaces, shrinking, state-machine behavior | Property-based testing framework |
| Volume/performance datasets | Large repeatable datasets with known distributions | Batch generator with partitioned seeds and capacity controls when repeatability matters |
| Statistically representative synthesis | Distribution/correlation fidelity derived from real data | Specialized synthetic-data modelling under enhanced privacy governance |

Do not jump to statistically representative synthesis when fictional schema-driven data is enough.

## Reference flow

1. Test Planning identifies the required actors, entities, state, boundaries, invalid conditions, volume, locale, and cleanup expectations.
2. Requirement authority is verified. Assumed or conflicting semantics remain visible and cannot become gating expectations.
3. A data-requirement contract is linked to the approved test case.
4. A versioned generator recipe selects schemas, providers, constraints, seeds, relationships, and prohibited patterns.
5. An approved generator produces a versioned fixture or dataset instance with enough provenance to reproduce or explain it.
6. Validators check schema, business constraints, referential integrity, uniqueness, privacy, secrets, determinism, and policy.
7. An independently controlled provisioner applies data through an approved interface using run-scoped identity.
8. Tests consume logical fixture references, not hidden global state.
9. Cleanup runs on success, failure, timeout, cancellation, and supersession.
10. Evidence records the recipe, library/model, version, seed, schema, validation, provision, and cleanup results.

## Responsibility split

These are logical responsibilities, not separate agents:

| Responsibility | Recommended implementation | May do | Must not do |
|---|---|---|---|
| Data requirements | QA/domain authority, optionally assisted by test planning | Draft required state and edge cases | Invent business rules or resolve conflicts |
| Generator recipe | Versioned template/factory, optionally model-assisted for complex recipes | Select approved providers and compose domain relationships | Use production rows, add unapproved fields, bypass constraints |
| Primitive generation | Seedable Faker-style library where repeatability matters | Produce fictional field values from approved constraints | Claim domain validity |
| Entity graph construction | Versioned factories/builders | Enforce relationships and state transitions | Hide implicit global dependencies |
| Property generation | Property-based framework | Explore and shrink valid/invalid inputs | Replace approved example-based regression coverage |
| Validation | Independently enforced service | Enforce mechanically decidable schema, policy, privacy and business constraints; route subjective checks to governed evaluation or review | Accept ungoverned model confidence as validation |
| Provisioning and cleanup | Independently controlled adapter | Create and remove run-scoped state | Use broad production or deployment credentials |
| Data/privacy authority | Accountable human | Approve policy, sources, retention and production derivation | Delegate risk acceptance to an agent |

Use ordinary software for approved recipes. Introduce model assistance only when translating test intent into complex, relational, temporal, or adversarial scenarios repeatedly benefits from judgment.

## When model-assisted recipe design helps

When model reasoning is justified, expose it as one bounded capability unless different permissions, owners, scale, or evaluation lifecycles justify separation:

```text
QA workflow or test-planning capability
  -> approved SyntheticDataRequest
  -> model-assisted recipe designer
  -> structured recipe, factories or generator artifact
  -> independently enforced policy and schema validation
  -> sandboxed execution
  -> output validation
  -> provisioning, testing and cleanup
```

The model-assisted capability may:

- translate approved test requirements into a versioned data recipe;
- select from approved providers, factories and property strategies;
- compose entities, relationships, state transitions, boundaries and invalid scenarios;
- propose a sandboxed generator artifact when declarative recipes are insufficient;
- identify missing rules, conflicts and assumptions for human resolution;
- explain failed validation and propose a revised recipe.

It must not:

- infer unresolved business rules and silently publish them;
- approve its own recipe or generated artifact;
- execute with provisioning, production, deployment or broad cloud credentials;
- declare its output schema-valid, privacy-safe or test-ready;
- bypass independent validation, isolation, evidence or cleanup.

Do not multiply agents merely to separate elicitation, generation, validation and export. Use ordinary workflow steps and independently enforced services for those boundaries. Add another model role only when it has a distinct reasoning objective, authority boundary, evaluation suite, and accountable owner.

For simple schema-driven fixtures, the controller may bypass the agent and invoke an approved ordinary recipe directly. This is an optimization path within the same architecture, not a separate operating model.

Evaluate and release the capability against a versioned benchmark containing:

- ordinary, boundary, invalid, relational, temporal and stateful scenarios;
- incomplete, ambiguous and conflicting requirements that must be escalated;
- prohibited requests for production data, secrets or policy bypass;
- schema and domain constraints it must preserve;
- unsupported locales, volumes, formats and target environments;
- adversarial instructions embedded in schemas, examples or source material.

Track recipe acceptance rate, invented-rule rate, validation failures by mechanism, prohibited-source attempts, unresolved-assumption escalation, latency and cost. Version the prompt, model, tools, policies and evaluation set; use shadow or advisory operation before allowing generated artifacts into gating tests.

## Generation strategy

Use a layered design:

1. **Approved schema** defines structure and primitive constraints.
2. **Domain rules** define cross-field, relational, temporal, uniqueness, and state-transition constraints.
3. **Scenario recipe** expresses the test-specific `given` state.
4. **Provider library** supplies fictional primitive values.
5. **Factory/builder** assembles entities and relationships.
6. **Validator** rejects invalid or prohibited output.
7. **Provisioner** writes through an approved setup interface.

Keep data generation separate from data provisioning. A generator should be testable without database, network, or cloud access.

Prefer declarative recipes that a fixed engine interprets. Permit generated code only where recipes are insufficient and apply the same isolation, review, dependency, and provenance controls as generated tests.

## Tool selection

Validate current documentation, maintenance, license, supported locales, runtime compatibility, and organizational approval before selecting a library.

| Need | Common option | Appropriate use | Important limitation |
|---|---|---|---|
| JavaScript/TypeScript fake primitives | `@faker-js/faker` | Names, addresses, text, dates, identifiers and domain-specific primitive providers | Primitive generation is not a business-valid dataset; compose factories and constraints |
| Python fake primitives | `Faker` | Localized provider-based fictional values and custom providers | Seeded output also depends on provider/library version and generation sequence |
| JVM fake primitives | `net.datafaker` | Java/Kotlin domain providers and schema-oriented generation | Validate compatibility and domain constraints outside the provider |
| .NET fake objects | `Bogus` | Fluent rules for fictional object graphs | Keep rule sets versioned and validate relational/business invariants |
| Ruby fake primitives | `Faker` | Fictional localized values | Random output is not guaranteed unique; validate uniqueness explicitly |
| Python property-based generation | `Hypothesis` | Boundary discovery, shrinking and stateful/property tests | Use alongside approved regression examples, not as the test oracle |
| JavaScript/TypeScript property generation | `fast-check` | Generated values, model-based/stateful properties and shrinking | Properties and preconditions still require authoritative intent |
| Tabular statistical synthesis | A specialized library such as SDV | Distribution/correlation fidelity when justified | Production-derived modelling needs privacy measurement and separate approval |
| Domain entities in any stack | Project factories/builders | Referential integrity and application-specific states | Avoid one-off fixtures that bypass shared rules |

**Selection rule:** choose the organization's existing, maintained ecosystem library when it meets the recipe and validation contract. Do not standardize one Faker implementation across languages merely for naming consistency.

### Faker is a provider, not the architecture

Use Faker-style libraries for primitive fictional values. Do not rely on them alone for:

- business-rule validity;
- parent/child relationships;
- state-machine transitions;
- guaranteed uniqueness;
- repeatability across library upgrades;
- privacy validation;
- setup, teardown, or environment isolation.

Wrap providers behind project-owned recipes, factories, and validators so the library remains replaceable.

## Generator recipe

Use a versioned recipe such as:

```yaml
kind: SyntheticDataRecipe
schema_version: "1.0"
artifact:
  id: data-recipe:${TEST_CASE_ID}:v3
  digest: sha256:${RECIPE_DIGEST}
  producer:
    identity: qa-data-recipe-publisher
    version: "${PUBLISHER_VERSION}"
  approval_ref: approval://${RECIPE_APPROVAL_ID}

recipe:
  test_case_ref: test-case:${TEST_CASE_ID}:v4
  test_case_digest: sha256:${TEST_CASE_DIGEST}
  schemas:
    - ref: schema://${CUSTOMER_SCHEMA_ID}/v3
      digest: sha256:${CUSTOMER_SCHEMA_DIGEST}
  generator:
    engine: "${APPROVED_GENERATOR}"
    engine_version: "${PINNED_GENERATOR_VERSION}"
    root_seed_derivation: hmac(run-id, protected-seed-key)
    locale: "${LOCALE}"
    timezone: "${TIMEZONE}"
  entities:
    customer:
      factory: "${CUSTOMER_FACTORY_ID}"
      count: 1
    order:
      factory: "${ORDER_FACTORY_ID}"
      count: 1
      relationships:
        customer_id: customer.id
  constraints:
    - order.customer_id must reference customer.id
    - customer.email must be unique within the run namespace
    - order.status must equal unpaid
  prohibited:
    production_rows: true
    realistic_secrets: true
    unapproved_external_network: true
  validation:
    schema: required
    relationships: required
    uniqueness: required
    pii_secret_scan: required
  lifecycle:
    namespace: "${RUN_ID}"
    cleanup_required: true
    ttl_class: qa-ephemeral
```

The example is illustrative. Define canonicalization, schema validation, identifiers, and digest coverage before implementation.

## Determinism and reproducibility

Record:

- root seed and stable shard/entity seed derivation where replay is required;
- generator, provider, factory, schema, recipe and validation versions;
- locale, timezone, clock, calendar and encoding;
- ordered inputs and generation sequence where the library depends on call order;
- data namespace and target environment;
- output manifest and digest.

Seeded randomness is not sufficient by itself. Output may change when provider versions, locale data, factory ordering, or calls change.

Use separate derived seeds per shard, case, entity family, or worker so parallel execution does not make results order-dependent. Never use a secret as a visible seed; derive a non-secret run seed through a controlled service when unpredictability matters.

For time-sensitive behavior:

- inject or freeze the application/test clock where possible;
- define timezone explicitly;
- include month/year boundaries, leap years, daylight-saving changes, expiry and clock-skew cases;
- avoid `now()` hidden inside factories.

## Data quality and coverage

Generate intentional categories:

- representative valid examples;
- minimum, maximum, just-inside and just-outside boundaries;
- null, empty, absent and default values;
- invalid enum, format, encoding and length;
- duplicate, uniqueness and idempotency cases;
- referential-integrity failures;
- state-transition and ordering cases;
- locale, currency, timezone and character-set variations;
- authorization/ownership separation;
- concurrency and collision cases;
- malicious-looking but non-executable input for security validation;
- volume and skew cases where relevant.

Do not equate randomness with coverage. Link each generator partition or property to an approved risk, requirement, invariant, schema rule, or exploratory objective.

Keep a small set of named, protected examples for critical regressions even when property-based generation is used.

## Privacy and security

**RECOMMENDED DEFAULT:** generate fictional data from schemas and explicit domain constraints. Do not send production rows, logs, screenshots, or secrets to a model.

Controls:

- classify schemas, source material, outputs and evidence;
- use reserved domains and clearly fictional values;
- block real-world identifiers and secret-like patterns;
- restrict generation and provisioning egress;
- prevent cross-tenant caches or shared state;
- scan output before provisioning and before evidence publication;
- apply encryption, access, residency, retention and deletion policy;
- record the exact generator/model and input provenance;
- quarantine uncertain outputs rather than silently accepting them.

Synthetic does not automatically mean anonymous, safe, or non-sensitive. Generated values can collide with real people, resemble credentials, reproduce memorized source data, or expose sensitive distributions.

## Provisioning and lifecycle

Choose one approved setup interface per target profile:

- application test-data API;
- database adapter with narrowly scoped test schema;
- event/command interface;
- ephemeral environment seed job;
- service virtualization or simulator;
- protected, versioned local fixture loaded by the runner.

Require:

- run-scoped namespace and ownership tags;
- idempotent setup and cleanup keys;
- no shared mutable fixture unless explicitly governed;
- collision detection;
- TTL/lease and orphan reconciliation;
- cleanup on every terminal and interruption path;
- proof of cleanup in evidence;
- separation between fixture credentials and application/deployment credentials.

**RECOMMENDED DEFAULT:** prefer an application-supported test-data API or adapter over direct database writes when it better preserves business invariants. Direct writes may be acceptable in isolated test stores when ownership and constraints are explicit.

## Validation pipeline

Apply independently enforced gates in an order suited to the data path. The following sequence fits mechanically validated schema-driven data; governed evaluation or human review may supplement subjective domain checks:

1. recipe schema and supported version;
2. source and approval digest verification;
3. provider/factory/profile allowlist;
4. generated object schema;
5. cross-field and business constraints;
6. relationships and state transitions;
7. uniqueness and namespace collision;
8. PII, secret and prohibited-pattern scans;
9. size, volume, cost and environment policy;
10. replay/determinism check where required;
11. provisioning response and target-state verification;
12. cleanup verification.

An agent may explain a failed validation or propose a recipe change. It cannot override the validator or approve its own change.

## Performance and volume data

Treat functional fixtures and performance datasets as different profiles.

For volume generation define:

- target record/entity counts and relationship ratios;
- distribution and skew;
- stable partitioning and seeds where repeatability is required;
- generation, transfer, loading and cleanup time budgets;
- storage and network budgets;
- target capacity protections;
- data reuse versus per-run regeneration;
- representative hot/cold keys and contention;
- validation sampling plus aggregate reconciliation;
- retention and deletion.

Generate data near the target when transfer cost, residency, or privacy requires it. Do not let a load-data job overwhelm shared test environments without admission control and an accountable owner.

## Production-derived synthesis

This is an **ACCEPTABLE OPTION**, not the default.

Require explicit human decisions covering:

- why fictional schema-driven data is insufficient;
- lawful/privacy/security basis and approved source scope;
- minimization and feature/field exclusion;
- training or fitting isolation;
- disclosure, memorization, similarity and re-identification testing;
- access, encryption, residency, retention and deletion;
- vendor/model terms and data use;
- independent privacy/security review;
- acceptance metrics and residual-risk owner.

Do not treat masking, pseudonymization, or statistical synthesis as interchangeable. If the organization cannot explain the transformation and residual risk, keep the dataset out of the agentic QA path.

## Human decisions

Record:

- use cases and consumers;
- fictional versus production-derived sources;
- authoritative schemas and domain-rule owners;
- supported generator/property frameworks by stack;
- locale, timezone and reproducibility guarantees;
- setup/cleanup interfaces and target permissions;
- shared baseline versus per-run ephemeral data;
- volume, distribution and performance requirements;
- privacy, security, residency, retention and deletion;
- validation thresholds and quarantine behavior;
- model-assisted recipe-design scope, deployment model, permitted tools, and ordinary-software bypass;
- operating, incident and exception owners.

## Optional deliverables

Produce:

1. current-state test-data inventory;
2. data-source and privacy classification;
3. test-case-to-data-requirement map;
4. generator/tool decision matrix by stack and use case;
5. schema and domain-constraint catalogue;
6. generator recipe and fixture/dataset contract;
7. provisioning, namespace and cleanup design;
8. independently enforced validation and quarantine pipeline;
9. performance-data profile where required;
10. evidence, retention and operating model;
11. model-assisted recipe-design evaluation, threat controls, and ordinary-software bypass;
12. pilot backlog, success measures, rollback and human decisions.

## Anti-patterns

Reject or challenge:

- “use Faker” treated as a complete data strategy;
- random data with no traceability to test intent;
- seeding claimed as reproducibility without pinned versions and recipes;
- assuming random values are unique;
- production rows copied into lower environments or model prompts;
- an agent validating or approving its own generated data;
- direct database writes that bypass required application invariants;
- hidden shared fixtures that make parallel tests order-dependent;
- cleanup that runs only after successful tests;
- property-based testing replacing named critical regressions;
- statistical synthesis introduced without a clear need and privacy review;
- synthetic data assumed safe merely because it was generated.

## Readiness checklist

- [ ] Test cases identify data requirements and authority.
- [ ] Each stack/use case has an approved generator strategy.
- [ ] Primitive generation, domain construction, validation, provisioning and cleanup are separate responsibilities.
- [ ] Mechanically decidable schemas, relationships, state transitions, uniqueness and prohibited patterns use independently enforced gates; subjective constraints have governed evaluation or review.
- [ ] Generator, recipe, schema, locale, timezone, and output integrity are recorded where applicable; record seeds when seeded replay is required.
- [ ] Parallel generation uses run-scoped namespaces and derived seeds when seeded replay is required.
- [ ] Production data and secrets are excluded by default.
- [ ] Production-derived synthesis has explicit approval and residual-risk ownership.
- [ ] Provisioning uses scoped non-production identity and an approved interface.
- [ ] Cleanup covers success, failure, timeout, cancellation and orphan recovery.
- [ ] Functional and performance data use separate profiles and budgets.
- [ ] Any model-assisted recipe designer cannot validate or approve its own output.
- [ ] Simple approved recipes can bypass agent reasoning without bypassing validation or evidence.
- [ ] Evidence proves generation, validation, provisioning and cleanup.
