# RAMP Blueprint Repository Revamp — Master Plan

> **Planning note:** This document is retained as the broad long-horizon
> architecture proposal. Use
> [RAMP Starter Packs Master Plan v2](RAMP_STARTER_PACKS_MASTER_PLAN_V2.md) for
> the current immediate-to-future implementation sequence and ZIP distribution
> model.

**Status:** Proposed target architecture and migration plan for owner review
**Date:** 2026-11-04
**Scope:** Repository product model, information architecture, AI-DLC v2 integration, migration, governance, and release model
**Non-scope for this pass:** Moving existing packs, deleting content, or changing active engagement behavior

## Executive recommendation

Rebuild this repository as the **RAMP Blueprint Catalog**, not as a flat collection of AI-DLC starter-pack folders.

The recommended model has four distinct layers:

1. **RAMP program layer** — the engagement lifecycle from proof of value through production, portfolio wave planning, platform modernisation, and organisational scale.
2. **Pinned AI-DLC workflow kernel** — consume the official `awslabs/aidlc-workflows` stable release rather than maintaining a separate lifecycle in every pack.
3. **User-facing blueprint catalog** — modernisation journeys, solution blueprints, engineering loops, and platform foundations.
4. **Reusable component library** — workload/runtime patterns, skills, agents, rules, MCP registrations, templates, and evidence adapters.

The central design decision is:

> **RAMP is the modernisation operating model; AI-DLC is the delivery workflow kernel; blueprints are composable customer outcomes; cross-cutting capabilities are reusable components.**

Do not solve the current mess only by renaming or grouping folders. The repository needs a typed product model and manifest-driven catalog so assets can be discovered and composed across multiple dimensions.

## Why the current model is breaking down

The current `packs/` directory presents unlike things as peers:

- modernisation journeys, such as legacy transformation and framework upgrade;
- solution or workload archetypes, such as web applications and event-driven systems;
- SDLC and operations automations, such as QA, vulnerability remediation, and incident response;
- a generic AI-DLC workflow foundation;
- generated per-tool copies beside canonical source.

Fourteen packs also carry separate primary `aidlc-workflow.md` files ranging from 426 to 591 lines. These files repeat lifecycle, state, audit, approval, and task-routing behavior with pack-specific divergence.

The result is:

- users choose based on historical folder names rather than intent and outcome;
- “cross-cutting” content has no stable home;
- improvements to the workflow core require many manual reconciliations;
- RAMP Phase 2–4 outcomes are much less visible than the Phase 1 workshop;
- catalog metadata cannot express maturity, ownership, compatibility, evidence, or RAMP lifecycle coverage;
- generated scaffolds obscure the canonical source;
- the repository embodies an AI-DLC workshop library more strongly than the full RAMP program.

## What the first four RAMP slides require from the repository

The source narrative establishes four requirements that should shape the repository.

### 1. RAMP is a scale journey

The landing experience should start with:

`MVP proof of value → production and executive readout → portfolio wave plan → organisation-wide scale`

It should not start with a technology table or instructions for copying folders.

### 2. Customers enter through intent

The first customer-facing navigation should support:

- **Transform from Legacy**
- **Reimagine and Build**
- **Agentise an existing business workflow**, which may reveal prerequisite modernisation

Technology, runtime, and tool choice are later filters.

### 3. Org-wide modernisation has multiple technical pillars

The repository must distinguish:

- portfolio assessment and roadmap;
- AI-DLC blueprints;
- common workload and runtime patterns;
- engineering automation;
- platform foundations;
- Day-2 operations.

These are related, but they are not the same asset type.

### 4. Modernisation and agentisation form a flywheel

Every modernisation blueprint should be able to report agentic-readiness outcomes such as:

- accessible APIs;
- usable events;
- discoverable and governed data;
- decoupled business capabilities;
- identified legacy blockers for the next modernisation wave.

Agentic use cases should likewise be able to emit a list of application and data gaps that feed RAMP portfolio planning.

## Terminology guardrail

Reserve the following words consistently:

| Term | Meaning |
|---|---|
| **RAMP Phase 1–4** | Customer engagement and scale lifecycle |
| **AI-DLC phase/stage** | Software-delivery workflow controlled by the AI-DLC kernel |
| **Blueprint step** | Scenario-specific activity within a blueprint |
| **Delivery wave** | Parallel or sequenced implementation units |
| **Portfolio wave** | A group of workloads modernised together across an estate |

Do not use an unqualified “Phase 1” in technical content.

## Options considered

### Option A — Reorganise the existing packs

Move current folders into categories and retain the local workflow/renderer model.

**Advantages**

- fastest;
- low migration risk;
- preserves current commands.

**Limitations**

- leaves fourteen workflow forks;
- retains harness and lifecycle maintenance;
- does not unlock true composition;
- only makes the existing model look tidier.

This is an acceptable short-term cleanup, but not the target architecture.

### Option B — Fork AI-DLC v2 as the RAMP engine

Copy or fork upstream and customise its core for RAMP.

**Advantages**

- complete local control;
- one repository and release train.

**Limitations**

- RAMP becomes responsible for the engine, state model, harness integrations, installers, updates, concurrency, and release fixes;
- high and permanent upstream merge cost;
- engineering effort is diverted from modernisation intelligence.

This is not recommended.

### Option C — Compose RAMP on a pinned AI-DLC kernel

Use official stable AI-DLC releases for workflow orchestration and extend them with RAMP plugins, profiles, rules, knowledge, skills, templates, MCPs, and program assets.

**Advantages**

- separates responsibilities cleanly;
- gains adaptive profiles, typed stages, durable state, audit, native harness support, diagnostics, and update lifecycle;
- lets RAMP invest in modernisation, productionisation, portfolio planning, and platform foundations;
- makes blueprints smaller and more testable.

**Trade-off**

- requires a compatibility contract and deliberate upstream upgrade process;
- some RAMP program behavior belongs above, rather than inside, a per-repository AI-DLC intent.

**Recommendation:** Option C.

## Proposed product model

The catalog should distinguish primary outcomes from selectable add-ons and internal components.

### Primary products

A primary product owns the customer outcome, qualification path, and end-to-end acceptance criteria.

| Primary product type | Question it answers | Examples |
|---|---|---|
| `modernization-journey` | What transformation outcome are we pursuing? | Transform legacy, reimagine COTS, runtime/framework upgrade, API platform exit |
| `solution-blueprint` | What business or application capability are we building or reimagining? | Intelligent document processing, mobile capture, voice agent, digital web application |

### Selectable add-ons

An add-on has a useful lifecycle outcome and may run independently, but normally composes into one or more primary products.

| Add-on type | Question it answers | Examples |
|---|---|---|
| `engineering-loop` | Which recurring SDLC, SecOps, or Ops activity are we automating? | Regression safety net, autonomous QA, vulnerability remediation, incident response |
| `platform-foundation` | What paved road makes multiple products repeatable and production-ready? | Serverless foundation, ECS service foundation, secure delivery, observability baseline |

### Reusable components

Components implement primary products and add-ons. They do not own a customer outcome and are not marketed as peer use cases.

| Component type | Examples |
|---|---|
| `workload-pattern` | Synchronous API, asynchronous job, event-driven service, batch, data/ML pipeline |
| `runtime-pattern` | Lambda + Step Functions + DynamoDB, ECS + SQS + Aurora, EKS + Kafka + RDS |
| `skill` | AWS service or domain expertise |
| `agent` | Specialised execution or review role |
| `rule` | Mandatory security, delivery, or governance behavior |
| `knowledge` | Explanatory methodology and trade-off guidance |
| `template` | Golden IaC, code, pipeline, or artifact template |
| `mcp` | External tool registration and policy |
| `evidence-adapter` | Normalises source, FSD, AWS Transform, assessment, dependency, or portfolio input |

Dependency direction is one-way:

`primary product → selectable add-ons → internal components`

Add-ons may depend on components. Components must not depend on a primary product. A platform foundation is distinguished from a solution blueprint by reuse: if the asset exists to support several unrelated customer solutions and does not own their business outcome, it is a foundation.

Classification checks should be encoded in the catalog validator:

1. Does the asset own a customer/business outcome and end-to-end acceptance criteria? If yes, it is a primary product.
2. Is its main value a repeated delivery, security, quality, operations, or platform outcome reused across primary products? If yes, it is an add-on.
3. Does it provide a bounded technical capability with no standalone customer outcome? If yes, it is a component.
4. If both “solution” and “foundation” appear plausible, classify it as a solution only when it owns a user-facing application capability; otherwise classify it as a foundation.

### Cross-cutting is a relationship, not a category

“Cross-cutting” should be represented by:

- reusable components;
- manifest references;
- compatibility rules;
- recommended bundles;
- RAMP phase and lifecycle facets.

Do not create a `misc/`, `shared-use-cases/`, or generic `cross-cutting/` dumping ground.

## Required catalog facets

Folder placement is for human orientation. Discovery and composition should use metadata.

Each catalog product should declare:

- product type;
- RAMP phases supported;
- customer motion: Transform, Reimagine, Agentise, or mixed;
- entry point: source code, functional documents, assessment artifacts, greenfield brief, or existing production system;
- source and target technology;
- workload and runtime patterns;
- lifecycle capabilities: assess, design, build, test, secure, deploy, operate, optimise;
- expected artifacts and customer outcomes;
- suitable engineering loops and platform foundations;
- AI-DLC version, profile, and plugins;
- supported harness tier;
- maturity and validation status;
- owner and reviewers;
- provenance, source, and license;
- security classification and public/private eligibility;
- last validation date.

## Proposed repository structure

```text
sample-ramp-aidlc-mod-starter-packs/
├── README.md
├── ramp-catalog.yaml
│
├── program/
│   ├── phase-1-proof-of-value/
│   ├── phase-2-production-readout/
│   ├── phase-3-portfolio-waves/    # interface contracts; orchestration ownership decided at Stage 0
│   ├── phase-4-platform-and-change/
│   ├── qualification/
│   ├── outcomes/
│   └── enablement/
│
├── catalog/
│   ├── modernization-journeys/
│   ├── solution-blueprints/
│   ├── engineering-loops/
│   └── platform-foundations/
│
├── components/
│   ├── patterns/
│   │   ├── workloads/
│   │   └── runtimes/
│   ├── skills/
│   ├── agents/
│   ├── rules/
│   ├── knowledge/
│   ├── templates/
│   ├── mcp/
│   └── evidence-adapters/
│
├── aidlc/
│   ├── upstream.lock.yaml
│   ├── compatibility.yaml
│   ├── plugins/
│   │   ├── ramp-modernization/
│   │   └── ramp-production-readiness/
│   ├── profiles/
│   ├── policies/
│   └── sync-notes/
│
├── tooling/
│   ├── cli/
│   ├── composer/
│   ├── catalog-generator/
│   ├── validators/
│   └── tests/
│
├── examples/
│   ├── compositions/
│   ├── portfolio-inputs/
│   └── expected-artifacts/
│
├── docs/
│   ├── architecture/
│   ├── contribution/
│   ├── migration/
│   └── revamp-research/
│
└── dist/                       # generated, ignored; published as release artifacts
```

### Public and private boundary

Because this repository is public/sample code, it should contain only generalised, non-customer-identifying assets.

Recommended split:

| Location | Content |
|---|---|
| Public RAMP blueprint repository | Generalised blueprints, plugins, patterns, skills, generic program templates, schema, tooling |
| Internal RAMP delivery kit | Confidential GTM guidance, customer references, internal metrics, detailed Partner/champion certification, restricted assessment integrations |
| Customer-owned engagement repository | Customer evidence, decisions, overlays, code knowledge, generated artifacts, outcomes |

The public catalog should define extension interfaces for private overlays without embedding private content.

## Blueprint anatomy

Each user-facing product should be small, declarative, and independently testable.

```text
catalog/<product-type>/<blueprint>/
├── blueprint.yaml
├── README.md
├── composition.yaml
├── guidance/
│   ├── qualification.md
│   ├── facilitator.md
│   └── troubleshooting.md
├── assets/
│   ├── templates/
│   └── examples/
└── tests/
    ├── scenarios/
    └── expected/
```

`blueprint.yaml` describes the product. `composition.yaml` references AI-DLC profiles/plugins and reusable component IDs. Neither file should contain a copied AI-DLC core workflow.

Illustrative manifest:

```yaml
apiVersion: ramp.aws/v2alpha1
kind: Blueprint

metadata:
  name: legacy-application-transformation
  title: Legacy Application Transformation
  version: 2.0.0
  maturity: validated
  owner: ramp-modernization

classification:
  productType: modernization-journey
  motions: [transform]
  rampPhases: [phase-1, phase-2, phase-3]
  entryModes: [source, transform-analysis, assessment-artifacts]
  workloadPatterns: [sync-api, async-job, batch]

aidlc:
  compatibility: ">=2.11.2 <3.0.0"
  profile: workshop
  plugins:
    - ramp-modernization@1.0.0

composition:
  engineeringLoops:
    - regression-safety-net
  platformFoundations:
    - secure-delivery-baseline
    - observability-baseline
  skills:
    - modernization-strategy
  evidenceAdapters:
    - source-code
    - aws-transform-analysis

outcomes:
  - deployed-proof-of-value
  - behavior-parity-evidence
  - production-readiness-plan
  - agentic-readiness-assessment
```

Individual assets should declare a tested compatibility range. The exact resolved AI-DLC version belongs in the central release lock and generated release bundle, avoiding mass edits to every blueprint during a compatible upstream update.

## AI-DLC v2 integration strategy

At the time of this review, the official stable baseline evaluated was `awslabs/aidlc-workflows` `v2.11.2`.

### Adopt from upstream

Use upstream ownership for:

- deterministic orchestration and routing;
- typed stages and directives;
- workflow profiles and adaptive composition;
- approval gates and receipts;
- spaces, intents, state, audit shards, knowledge, and code knowledge bases;
- standard agents and execution topologies;
- supported harness integrations;
- native install, configuration, version pinning, updates, diagnostics, and ownership tracking;
- packaging, determinism, and release validation.

### Wrap with RAMP

Build a thin RAMP experience that provides:

- intent-based blueprint selection;
- RAMP Phase 1–4 language and handoffs;
- workload qualification;
- evidence preflight;
- modernisation motion selection;
- production and executive-readout outcomes;
- portfolio and wave-plan integration;
- platform-foundation recommendations;
- outcome measurement and agentic-readiness reporting.

The wrapper should invoke and inspect the upstream runtime rather than reimplement it.

### Extend through additive plugins

Initial extensions:

1. **`ramp-modernization`**
   - evidence contract for brownfield work;
   - assessment ingestion;
   - target-state and modernisation-strategy decisions;
   - behavior parity;
   - cutover, rollback, and before/after evidence.

2. **`ramp-production-readiness`**
   - Phase 2 hardening;
   - security, reliability, operations, cost, and support readiness;
   - outcome capture;
   - executive-readout evidence pack.

3. **RAMP portfolio product**
   - estate normalization;
   - dependency and complexity analysis;
   - workload scoring;
   - portfolio wave planning;
   - blueprint recommendation;
   - parallel platform-foundation plan.

The portfolio product may be a program-level orchestration tool rather than a normal plugin inside one source repository.

### Upstream lock and upgrade policy

Maintain:

```text
aidlc/
├── upstream.lock.yaml
├── compatibility.yaml
├── patches/             # normally empty
└── sync-notes/
```

Rules:

1. Pin exact stable versions for customer delivery.
2. Never track upstream `main` in an active engagement.
3. Test each proposed upstream update in a dedicated branch.
4. Run representative RAMP journeys against the candidate release.
5. Publish a compatibility matrix by RAMP catalog, plugin, and AI-DLC version.
6. Patch upstream core only through a time-bounded exception when a documented extension seam is insufficient.
7. Before accepting a patch, require an upstream issue, an exception ADR, an owner, compatibility tests, and a removal deadline no later than 90 days unless re-approved.
8. Fail release validation when an exception has expired.
9. State the AI-DLC runtime version in every RAMP release.

### What not to carry forward

- copied AI-DLC lifecycle prose in every blueprint;
- a long-lived RAMP fork of upstream;
- hand-edited per-harness generated files;
- a separate implementation of upstream install/update/doctor behavior;
- a flat `aidlc-docs/` model for new engagements;
- an assumption that every use case needs the same workflow ceremony.

## How RAMP becomes visible in the repository

### Phase 1 — proof of value

Provide:

- qualification and workload-selection contract;
- timeboxed workshop profile;
- baseline and evidence capture;
- blueprint composition;
- deployment and validation proof;
- productivity/outcome measurement without turning the 5–7x narrative into an unconditional guarantee.

### Phase 2 — production and executive readout

Provide:

- production-readiness plugin and checklist;
- operational acceptance;
- security, reliability, cost, and observability evidence;
- business outcome capture;
- generic executive-readout template;
- explicit decision: stop, improve, productionise, or expand.

### Phase 3 — portfolio wave planning

Define machine-readable contracts such as:

```text
estate.yaml
assessment-evidence/
dependency-graph.json
workload-scores.yaml
wave-plan.yaml
blueprint-recommendations.yaml
platform-foundation-plan.yaml
```

Each recommended workload composition should point to catalog IDs and pinned versions.

### Phase 4 — platform and organisational scale

Provide:

- paved-road platform foundations;
- common workload/runtime patterns;
- engineering-loop bundles;
- governance and guardrails;
- champion/Partner delivery guidance appropriate for the repository’s public classification;
- a feedback process that promotes proven engagement learning into governed reusable assets.

## Proposed migration of existing assets

| Current asset | Target classification | Recommended treatment |
|---|---|---|
| `legacy-transformation-on-aws` | Modernisation journey | First migration pilot; retain targeted/full RE and modernisation-specific evidence, replace copied core |
| `cots-rewrite-on-cloudnative` | Modernisation journey | Rename toward `reimagine-cots`; retain document/FSD traceability and bounded-context logic |
| `framework-upgrade-containerise` | Modernisation journey or journey variant | Preserve Stage 0 environment/tooling decisions and Java-specific upgrade delta; likely colleague-attempt candidate |
| `dotnet-app-modernization-on-aws` | Journey variant | Compose legacy transformation with .NET/AWS Transform/ECS components instead of owning a complete workflow |
| `api-platform-migration-n-modernization` | Modernisation journey | Rename to an outcome-oriented API platform exit/modernisation journey |
| `web-app-on-cloudnative` | Solution blueprint | Separate business/application blueprint from web and runtime patterns |
| `genai-on-serverless` | Solution blueprint | Rename to the actual capability, currently intelligent document processing |
| `ocr-mobile-app-on-serverless` | Solution blueprint | Keep mobile capture capability; reference mobile, IDP, and serverless patterns |
| `voice-ai-agent-on-aws` | Solution blueprint | Keep voice-agent outcome; compose voice, agent, API, and runtime components |
| `serverless-event-driven-on-aws` | Workload/runtime pattern plus thin example blueprint | Extract reusable event-driven and runtime patterns; avoid using a technology choice as the whole customer intent |
| `qa-automated-testing` | Engineering loop | Recast as automated quality loop with selectable web/mobile components |
| `regression-software-testing` | Engineering loop | Give it a manifest and schema; remove installer exception |
| `vulnerability-remediation-pipeline` | Engineering loop | Second migration pilot; exercise focused security workflow/profile |
| `agentic-incident-response` | Engineering loop | Position under Day-2/AIOps rather than as a peer application use case |
| `agentic-ai-workflow` | Retire as catalog product | Move unique workshop/RAMP content to `program/`; replace base workflow with pinned upstream |
| empty `outsystems-exit-on-serverless` directory | Variant or remove | If needed, model OutSystems as an evidence adapter/variant of `reimagine-cots`, not a separate empty pack |

## Colleague attempt assessment

The repository does not identify a customer-to-pack mapping, so the exact attempt cannot be proven from source.

Git history shows three high-confidence colleague-authored candidates:

- `framework-upgrade-containerise`;
- `vulnerability-remediation-pipeline`;
- `agentic-incident-response`.

The strongest first candidate is `framework-upgrade-containerise` because it contains a distinct Stage 0, a prescriptive upgrade path, and an explicit customer-profile overlay concept.

When the intended attempt is confirmed, evaluate it using this rule:

- promote genuinely reusable domain behavior into a blueprint, plugin, evidence adapter, component, or template;
- keep customer facts in a private overlay;
- discard copied upstream workflow behavior;
- convert implicit assumptions into typed manifest fields and tests.

## Catalog and installation experience

The future CLI should be a composer, not another AI-DLC engine.

Illustrative experience:

```bash
ramp catalog search \
  --motion transform \
  --source-runtime dotnet-framework \
  --ramp-phase phase-1

ramp init \
  --blueprint legacy-application-transformation \
  --variant dotnet \
  --harness codex

ramp compose \
  --add engineering-loop/regression-safety-net \
  --add platform-foundation/observability-baseline

ramp validate
```

The root README and generated catalog site should be generated from manifests. Manual tables should not be the catalog source of truth.

### Recommended landing-page order

1. RAMP outcome and four-phase lifecycle.
2. Choose an entry path: Transform, Reimagine, or Agentise.
3. Select a blueprint by intended outcome.
4. Add recommended engineering loops and platform foundations.
5. Run the guided setup for the selected harness.
6. Understand maturity, evidence, and support status.
7. Contributor and maintainer documentation.

## Maturity and promotion model

Suggested states:

| State | Meaning |
|---|---|
| `experimental` | Structure or outcome still being explored |
| `workshop-ready` | Runs through a complete facilitated proof-of-value scenario |
| `field-validated` | Generalised from at least one real engagement and revalidated without customer-specific dependencies |
| `repeatable` | Independently delivered by another qualified facilitator |
| `scale-certified` | Has production, enablement, compatibility, and support evidence for broad use |
| `deprecated` | Supported migration path exists; no new use recommended |

Promotion should require evidence, not an owner changing a label.

Every non-experimental asset should carry a machine-readable `validation/evidence.yaml` with:

- attestation owner and independent reviewer;
- evidence type and non-sensitive reference;
- test results and supported harness;
- date performed;
- expiry or revalidation date;
- known limitations;
- promotion decision.

Proposed minimum thresholds:

| State | Required threshold |
|---|---|
| `workshop-ready` | Complete clean-room workshop scenario; required artifacts and one Tier 1 harness pass |
| `field-validated` | Generalised field evidence plus a repeat clean-room validation with customer-specific dependencies removed |
| `repeatable` | Independent delivery by a second qualified facilitator with recorded feedback |
| `scale-certified` | Production/readiness evidence, two independent deliveries, supported-harness matrix, named support owner, and revalidation within the agreed window |

Minimum evidence across promoted states:

- clean-room scenario;
- expected artifact assertions;
- deployment or executable verification where applicable;
- no customer identifiers or secrets;
- owner and reviewer;
- license/provenance review;
- supported harness test;
- known limitations;
- last validation date;
- facilitator feedback.

## Governance model

### Ownership

- `program/` — RAMP program owners;
- `aidlc/` — workflow integration owners;
- `catalog/modernization-journeys/` — modernisation domain owners;
- `catalog/engineering-loops/` — SDLC/SecOps/Ops owners;
- `catalog/platform-foundations/` — platform engineering owners;
- `components/` — component maintainers;
- `tooling/` — repository product engineering owners.

Use `CODEOWNERS` at these boundaries.

### Contribution rules

Every new asset must answer:

1. Is this a program asset, catalog product, or reusable component?
2. What existing asset does it compose with?
3. What behavior is RAMP-specific rather than upstream AI-DLC?
4. What customer evidence was generalised, and has identifying data been removed?
5. Who owns future validation and version updates?
6. What test proves the advertised outcome?

### Naming

Recommended convention:

- use `modernization` in machine-readable IDs and slugs to align with AWS technical naming and existing repository conventions;
- use the approved RAMP brand spelling in display copy;
- use nouns for products and components;
- avoid implementation conjunctions such as `-n-`;
- do not put `on-aws`, `cloudnative`, or a specific runtime in every product name when those are facets or variants.

## Validation and release model

### Catalog validation

- schema validity;
- unique IDs;
- valid component references;
- no dependency cycles;
- compatible AI-DLC/plugin versions;
- required ownership, maturity, provenance, and license fields;
- no unsupported RAMP phase claims;
- no forbidden customer/private markers.

### Content validation

- no placeholder text;
- links resolve;
- declared artifacts are produced;
- mandatory decisions and evidence are covered;
- blueprint-specific instructions do not restate or contradict upstream core;
- instruction and context budgets remain within limits.

### Behavioral validation

- scenario tests for representative inputs;
- approval, resume, skip, and failure-path behavior;
- expected artifact sections;
- production-readiness and rollback paths;
- cross-component composition;
- migration from supported legacy entry points.

### Harness strategy

Use tiers:

- **Tier 1:** tools actively certified for RAMP delivery;
- **Tier 2:** supported by upstream AI-DLC and smoke-tested by RAMP;
- **Experimental:** community/contributor validation only.

Do not promise identical support merely because upstream can render a harness.

### Distribution

- canonical source remains under `program/`, `catalog/`, `components/`, and `aidlc/`;
- `dist/` is generated and ignored;
- release artifacts contain ready-to-use bundles and checksums;
- legacy committed scaffolds remain only during transition;
- PowerShell and Bash behavior must be generated or tested from the same source if retained.

## Phased execution roadmap

### Stage 0 — Freeze, baseline, and settle boundary decisions

**Goal:** prevent more structural debt while protecting existing users and resolving decisions that affect the architecture.

- freeze creation of new pack-local workflow cores;
- tag the current repository as the legacy v1 baseline;
- record representative current behavior as regression scenarios;
- confirm which pack is the colleague’s customer attempt;
- decide public/internal/customer repository boundaries;
- decide whether Phase 3 orchestration lives here or in a separate program product; this repository should own only stable interface contracts until then;
- decide whether offline/no-native-installer delivery is mandatory;
- select Tier 1 harnesses;
- publish a short contributor notice explaining the transition.

**Exit gate:** legacy obligations, portfolio ownership, distribution constraints, and support targets are documented.

### Stage 1 — AI-DLC extension feasibility and provisional model

**Goal:** prove the upstream extension seams before freezing repository contracts.

- pin the stable upstream release;
- create provisional `aidlc/upstream.lock.yaml` and compatibility metadata;
- prototype the smallest useful `ramp-modernization` contribution;
- test hard gates, additive stage contributions, artifact namespacing, rules, sensors, resume behavior, and harness installation;
- identify anything that needs deterministic RAMP tooling rather than an AI-DLC plugin;
- draft, but do not ratify, the product/component taxonomy and manifest fields against the spike.

**Exit gate:** extension limits and ownership boundaries are understood, with no assumed reliance on unenforced plugin behavior.

### Stage 2 — Ratify information architecture and schema

**Goal:** establish a catalog contract grounded in the working integration spike.

- ratify primary products, selectable add-ons, and internal components;
- define `blueprint.yaml`, add-on, component, and validation-evidence schemas;
- define dependency direction and deterministic classification checks;
- define compatibility ranges and the central resolved-version lock;
- define maturity, provenance, expiry, and revalidation rules;
- create old-name-to-new-ID aliases;
- create skeleton target directories without moving supported content.

**Exit gate:** every current asset is representable without a miscellaneous category, and all schema behavior has a feasible implementation path.

### Stage 3 — Prove one full RAMP vertical plus reference asset types

**Goal:** prove RAMP, not only AI-DLC composition, before bulk migration.

Build one end-to-end reference composition:

1. `legacy-transformation-on-aws` as the primary modernisation journey;
2. a production-readiness add-on and generic executive-readout evidence pack;
3. one platform foundation, such as secure delivery plus observability;
4. Phase 3 wave-plan output for follow-on workloads;
5. a Phase 4 reusable-pattern and feedback/promotion handoff.

In parallel, prove the remaining classification paths:

- one solution blueprint, such as intelligent document processing;
- `vulnerability-remediation-pipeline` as an engineering loop;
- `serverless-event-driven-on-aws` as a workload/runtime pattern plus thin example.

If the confirmed colleague attempt is more valuable, use it as one of these reference paths.

**Exit gate:** the repository demonstrates a credible Phase 1→4 vertical and proves primary product, add-on, and component composition.

### Stage 4 — Composer, validator, and catalog experience

- evolve `ramp-pack` into `ramp` composition commands;
- integrate upstream `aidlc config` rather than recreating harness setup;
- implement schema, classification, reference, compatibility, expiry, and content validation;
- generate root catalog documentation;
- package both connected and approved offline distribution paths;
- publish release artifacts;
- implement v1 aliases and clear migration messages.

**Exit gate:** a new user can find, compose, initialise, and validate a blueprint without browsing repository internals.

### Stage 5 — Migrate the remaining catalog

Run independent workstreams:

- modernisation journeys;
- solution blueprints;
- engineering loops;
- workload/runtime patterns;
- skill/provenance cleanup;
- platform foundations.

Do not perform mechanical copy-and-rename migrations. Every asset must be decomposed into upstream behavior, RAMP-specific behavior, primary/add-on behavior, reusable components, and obsolete duplication.

**Exit gate:** no supported product relies on a duplicated primary AI-DLC workflow, and each promoted asset has current validation evidence.

### Stage 6 — Generalise and scale RAMP Phase 2–4 assets

Use the full vertical proven in Stage 3 to expand:

- production-readiness variants;
- executive-readout evidence templates;
- portfolio input and wave-plan contracts;
- blueprint recommendation behavior;
- platform-foundation catalog;
- feedback and promotion workflow;
- public-safe enablement guidance.

**Exit gate:** Phase 2–4 capabilities cover multiple journeys rather than only the reference vertical.

### Stage 7 — Deprecate legacy delivery

- publish final v1-to-v2 mapping;
- keep active v1 engagements resumable;
- start new engagements on v2 only;
- stop committing generated per-pack harness scaffolds;
- set and communicate v1 end-of-support;
- archive obsolete folders only after usage and migration evidence are checked.

**Exit gate:** canonical source, release artifacts, and support policy all reflect the new model.

## Parallel workstreams

The revamp can be executed with six parallel owners after Stage 1 establishes shared contracts:

| Workstream | Responsibility |
|---|---|
| A. Product architecture | Taxonomy, schema, catalog, naming, migration map |
| B. AI-DLC integration | Pinning, plugins, profiles, compatibility, upstream sync |
| C. Blueprint migration | Journeys and solution blueprints |
| D. Engineering and platform | Engineering loops, foundations, runtime patterns |
| E. Tooling and quality | Composer, validators, tests, releases, generated docs |
| F. Field validation | Champion/Partner usability, facilitator feedback, promotion evidence |

Avoid parallel edits to the same old workflow file. Divide work by target product/component ownership.

## Main risks and controls

| Risk | Control |
|---|---|
| Big-bang rewrite breaks active workshops | Version v1, pilot composition first, migrate new work before active work |
| Upstream changes quickly | Exact stable pins, compatibility matrix, scheduled upgrade branches |
| Plugin model cannot express a hard requirement | Validate implemented extension semantics; use deterministic RAMP tooling for hard policy |
| Public repo leaks customer or internal information | Three-repository boundary, automated scans, provenance review |
| New taxonomy becomes too complex | Exactly one primary-product classification per product; everything else is an add-on, facet, or component |
| Folder reorganisation without behavioral improvement | Require pilot outcome and removal of copied workflow core |
| Skills remain stale or overlapping | Add owner/version/source/license/maturity and quality gates |
| Generated output remains noisy | Ignore `dist/`, publish bundles in releases, retain legacy scaffolds temporarily |
| RAMP and AI-DLC phases are confused | Enforce terminology in schema, docs, and validators |
| Portfolio planning is forced into one repo | Model estate planning as a program producing many workload intents |

## Decisions requested from the RAMP owner

These decisions affect sequencing but do not change the core recommendation:

1. Which exact folder/branch is the colleague’s customer attempt?
2. Must the delivery path work fully offline or without the upstream native installer?
3. Which tools are Tier 1 for FY27 delivery?
4. Which RAMP Phase 2–4 assets may be public?
5. Should portfolio/wave planning live here or in a separate program product that consumes this catalog?
6. How long must current `ramp-pack` and `aidlc-docs/` engagements remain supported?
7. Is the preferred public product name **RAMP Blueprint Catalog**, **RAMP Modernization Blueprints**, or another name?
8. Which spelling is authoritative in display copy: Modernisation or Modernization?

## Definition of done for the revamp

The repository visibly embodies RAMP when a newly enabled champion or Partner can:

1. understand the RAMP lifecycle and entry motions from the landing page;
2. qualify a workload and select a product by outcome;
3. see maturity, evidence, owner, and support status;
4. compose the needed journey, engineering loops, platform foundations, and components;
5. run a pinned, decision-gated AI-DLC workflow on a certified harness;
6. produce validated proof-of-value and production-readiness evidence;
7. prepare the inputs for an executive readout;
8. feed follow-on workloads into a portfolio wave plan;
9. capture delivery learning without copying customer-specific data;
10. promote proven learning into a governed reusable asset.

If the repository only helps with AI-DLC requirements, design, and tasks, it remains a useful starter-pack library but does not yet represent RAMP.

## Recommended immediate next move

Approve the conceptual model before restructuring files.

Then execute a narrow architecture spike:

1. settle offline distribution and Phase 3 ownership;
2. pin upstream AI-DLC;
3. prototype `ramp-modernization` and test extension limits;
4. ratify the v2 manifest/schema from that evidence;
5. build one Phase 1→4 legacy-transformation reference composition;
6. validate it on one Tier 1 harness;
7. compare it with the current pack before authorising bulk migration.

## Supporting analysis

- [RAMP source analysis](revamp-research/ramp-source-analysis.md)
- [Current repository assessment](revamp-research/current-repo-assessment.md)
- [AI-DLC v2 gap analysis](revamp-research/aidlc-v2-gap-analysis.md)

## Official upstream references

- <https://github.com/awslabs/aidlc-workflows>
- <https://github.com/awslabs/aidlc-workflows/releases>
- <https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/00-introduction.md>
- <https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workflow-profiles.md>
- <https://github.com/awslabs/aidlc-workflows/blob/main/docs/reference/01-architecture.md>
- <https://github.com/awslabs/aidlc-workflows/blob/main/docs/reference/15-stage-definition.md>
- <https://github.com/awslabs/aidlc-workflows/blob/main/docs/reference/17-skill-system.md>
- <https://github.com/awslabs/aidlc-workflows/blob/main/plugins/test-pro/README.md>
