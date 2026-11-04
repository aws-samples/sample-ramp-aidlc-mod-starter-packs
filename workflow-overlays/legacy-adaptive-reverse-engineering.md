---
id: legacy-adaptive-reverse-engineering
target: reverse-engineering.md
purpose: Specialize shared reverse engineering for Targeted-by-default legacy transformation with an explicit or approved Full mode.
replaces:
  - reverse-engineering-policy
  - reverse-engineering-analysis-body
  - reverse-engineering-artifact-checklist
  - reverse-engineering-review-options
---
<!-- RAMP:SLOT reverse-engineering-policy START -->
# Adaptive Reverse Engineering

**Purpose**: Analyze an existing brownfield system at a depth proportional to
the modernization objective and produce evidence for decomposition and legacy
transformation.

**Execute when**: Existing source is present, or the user asks to modernize,
migrate, decompose, extend, or reverse engineer an existing system.

**Skip when**: The work is genuinely greenfield with no existing
implementation.

**Rerun when**: Relevant code or reused evidence has materially changed. Reuse
current evidence where possible and disclose what remains unverified.

## Modes

### Targeted mode (default)

Use Targeted mode when the objective names a feature, journey, module,
endpoint, data area, bounded context, modernization surface, or another
bounded objective. Trace the objective end-to-end, perform the mandatory
sentinel sweep, and follow direct evidence edges as needed. A Targeted run
must not claim whole-system completeness.

### Full mode

Use Full mode only when the user explicitly requests system-wide analysis or
explicitly approves a major expansion to Full. Full mode is never an
automatic consequence of Targeted discovery.

### Orientation

Run a cheap **Orientation** pass before deep scanning: inspect prior analysis,
repository manifests, module topology, entry points, and build files to locate
defensible anchors.

Orientation is temporary, not a completed analysis mode. Final evidence
artifacts record Targeted or Full.

If cheap evidence still cannot identify a defensible anchor, multiple
disjoint targets match, or materially different capabilities share
terminology, ask at most one informed scope clarification in chat. Append the
exact question and answer to `{{STATE_DIR}}/audit.md`. Generic questions that
repository evidence can answer are forbidden.

## Prior analysis (ATX / assessments)

Before scanning, inspect current evidence such as:

- `ATXDocumentation/`;
- `ATXModAnalysis/`;
- AWS Transform or other migration and portability assessments;
- architecture, API, or data documentation; and
- prior `{{STATE_DIR}}/analysis/` artifacts.

When prior analysis is current and relevant to the objective:

- use it as primary input;
- record the exact reused sources;
- spot-verify high-risk claims;
- scan gaps it does not cover; and
- prefer current source or runtime evidence when evidence conflicts.

When prior analysis is absent, stale, or irrelevant, scan source directly at
the selected mode's depth.

Whole-codebase ATX evidence may provide broad system context for Targeted
mode, but it does not replace the granular Targeted trace and sentinel sweep.

Every artifact must identify its mode, objective, scope boundary, evidence
basis, and what was not analyzed. Distinguish inference from observed
evidence.
<!-- RAMP:SLOT reverse-engineering-policy END -->

<!-- RAMP:SLOT reverse-engineering-analysis-body START -->
## Step 1: Objective and scope

Before deep analysis, create or update
`{{STATE_DIR}}/analysis/reverse-engineering-scope.md`:

```markdown
# Reverse Engineering Scope
- **Mode**: [Targeted / Full]
- **Objective**: [question to answer and downstream outcome]
- **Target Type / Anchors**: [feature, journey, module, endpoint, data area,
  bounded context, or system-wide; routes, symbols, modules, schemas, files]
- **In-Scope**: [behavior and surfaces to trace]
- **Not-In-Scope**: [explicit exclusions]
- **Prior Analysis**: [reused sources, or none]
- **Not Analyzed / Open Questions**: [areas not examined and why]
- **Status**: [In Progress / Awaiting Approval / Complete]
```

Use the same lifecycle status in the scope artifact, shared metadata, and
`{{STATE_DIR}}/aidlc-state.md`.

### Scope lifecycle synchronization

This extends the record updates in the common lifecycle; it does not create a
second approval gate or audit action.

- When the common `Record Evidence-Ready State` step runs, update
  `{{STATE_DIR}}/analysis/reverse-engineering-scope.md` in the same transition
  and set its status to `Awaiting Approval`.
- After the common `Approval Transition` has received explicit approval and
  completed its raw approval audit append, update
  `{{STATE_DIR}}/analysis/reverse-engineering-scope.md`,
  `{{STATE_DIR}}/analysis/reverse-engineering-timestamp.md`, and
  `{{STATE_DIR}}/aidlc-state.md` together to `Complete`, recording the approved
  scope and completion timestamp.

## Step 2: Targeted path — Orient, Trace, Sentinel Sweep

### Orient

Map only the repository structure needed to locate the objective: manifests,
build files, modules, entry points, likely implementation, data, test, and
deployment assets, and relevant prior evidence. This is a locating pass, not
a whole-repository scan.

### Trace the target end-to-end

1. Entry point and externally visible behavior.
2. Orchestration, application logic, and business rules.
3. Data access, storage ownership, and transaction boundaries.
4. Side effects and downstream consumers.
5. Success, failure, validation, and error contracts.
6. Direct callers and dependencies.
7. Existing unit, integration, contract, and end-to-end tests.
8. Runtime, deployment, and build configuration that changes behavior.

Record meaningful source paths and symbols.

### Mandatory cross-cutting sentinel sweep

Check the target's interaction with all eleven categories:

1. authentication and authorization;
2. session state, static state, and shared memory;
3. global configuration and secrets;
4. shared databases, schemas, and transactions;
5. high-fan-in libraries and shared kernels;
6. filesystem and object storage;
7. events, queues, jobs, schedulers, and callbacks;
8. errors, audit, compliance, and data-handling obligations;
9. logging, metrics, tracing, and alerting;
10. deployment, infrastructure as code, networking, and runtime topology; and
11. tests, CI, release gates, and rollback behavior.

For every sentinel, record the evidence examined, finding, and unresolved
edge.

### Expansion

Follow direct dependencies, callers, data edges, and configuration edges
automatically when needed to answer the objective. Before crossing into
another business capability or bounded context, deeply analyzing a
high-fan-in shared kernel, or switching to Full, ask for approval first.
Never silently turn a Targeted run into a Full one.

Stop only when objective questions have cited evidence, the end-to-end path
is traced, no critical sentinel edge remains undisclosed, and remaining
unknowns are explicit. If critical evidence is inaccessible, record what is
missing and what would unblock it; do not claim completeness.

## Step 2 artifacts (Targeted)

Create under `{{STATE_DIR}}/analysis/`:

Create `{{STATE_DIR}}/analysis/target-analysis.md` and
`{{STATE_DIR}}/analysis/target-coupling-assessment.md`.

### `target-analysis.md`

```markdown
# Target Analysis
- **Mode**: Targeted
- **Objective**: [objective]
- **Scope Boundary**: [scope]
- **Not Analyzed**: [explicit gaps]

## Externally Visible Behavior
[entry points, inputs, outputs, actors, success and error contracts]

## End-to-End Trace
[entry → orchestration/business rules → data/transactions → side effects/consumers]

## Runtime and Deployment Behavior
[configuration, infrastructure, build, and operational behavior]

## Test Evidence
[tests found, gaps, and parity risks]
```

### `target-coupling-assessment.md`

```markdown
# Target Coupling Assessment
- **Mode / Objective / Scope Boundary / Not Analyzed**: [summary]

## Direct Callers and Dependencies
[code, API, event, data, and runtime dependencies]

## Data and Transaction Coupling
[shared tables, ownership, transactions, consistency risks]

## Cross-Cutting Sentinel Results
| Sentinel | Evidence | Finding | Unresolved Edge |
|----------|----------|---------|-----------------|

## Modernization Implications
[decomposition difficulty, blockers, seams, and safe next steps]
```

The selected Targeted bundle is exactly:

- `reverse-engineering-scope.md`;
- `target-analysis.md`;
- `target-coupling-assessment.md`; and
- shared `reverse-engineering-timestamp.md`.

## Step 3: Full path — explicit or approved whole-system analysis

Run this branch only in Full mode. Apply the same prior-analysis and explicit
scope rules.

Discovery covers all in-scope packages and solutions, relevant package types,
languages and frameworks, business purpose and transactions, infrastructure,
build systems and dependencies, services, APIs, functions, workers, queues,
schedulers, data stores, tests, CI, observability, and release gates.

### Full artifact bundle

Create exactly these nine comprehensive artifacts under
`{{STATE_DIR}}/analysis/`, each with mode, objective, scope, and not-analyzed
context:

- `{{STATE_DIR}}/analysis/business-overview.md` — business context diagram,
  transactions, dictionary, and component purpose.
- `{{STATE_DIR}}/analysis/architecture.md` — system architecture, components,
  data flow, integrations, and infrastructure.
- `{{STATE_DIR}}/analysis/code-structure.md` — build, modules and classes, file
  inventory, patterns, and dependency risks.
- `{{STATE_DIR}}/analysis/api-documentation.md` — endpoints, handlers, auth,
  request and response contracts, status, side effects, summary, and data
  models.
- `{{STATE_DIR}}/analysis/component-inventory.md` — application,
  infrastructure, shared, and test components with totals.
- `{{STATE_DIR}}/analysis/technology-stack.md` — languages, frameworks, data,
  cloud infrastructure, front end, DevOps, observability, and testing.
- `{{STATE_DIR}}/analysis/dependencies.md` — internal dependency diagram,
  external migration concerns, and cross-cutting concerns.
- `{{STATE_DIR}}/analysis/bounded-contexts.md` — contexts, capability, entry
  points, logic, data, models, storage, events, context map, shared kernel, and
  dependencies.
- `{{STATE_DIR}}/analysis/coupling-assessment.md` — coupling matrix, data
  coupling, extraction difficulty, strangler readiness, and modernization
  risks.

Use Mermaid where the artifact contract calls for business context,
architecture and data flow, class or module, dependency, or context maps.
Full mode must retain all nine artifacts; do not substitute the Targeted bundle.

The selected Full bundle is the nine artifacts above plus:

- `reverse-engineering-scope.md`; and
- shared `reverse-engineering-timestamp.md`.
<!-- RAMP:SLOT reverse-engineering-analysis-body END -->

<!-- RAMP:SLOT reverse-engineering-artifact-checklist START -->
Retain only the selected mode's checklist in the produced metadata.

For Targeted mode, record exactly:
- [x] reverse-engineering-scope.md
- [x] target-analysis.md
- [x] target-coupling-assessment.md
- [x] reverse-engineering-timestamp.md

For Full mode, record exactly:
- [x] reverse-engineering-scope.md
- [x] business-overview.md
- [x] architecture.md
- [x] code-structure.md
- [x] api-documentation.md
- [x] component-inventory.md
- [x] technology-stack.md
- [x] dependencies.md
- [x] bounded-contexts.md
- [x] coupling-assessment.md
- [x] reverse-engineering-timestamp.md
<!-- RAMP:SLOT reverse-engineering-artifact-checklist END -->

<!-- RAMP:SLOT reverse-engineering-review-options START -->
> **For Targeted evidence**
> 1. **Accept and continue** — approve the Targeted evidence and continue to
>    Phase 1 Requirements.
> 2. **Fill evidence gaps** — remain within the current scope and keep the
>    gate at `Awaiting Approval`.
> 3. **Expand selected areas** — approve a named major scope expansion before
>    it is scanned.
> 4. **Run Full reverse engineering** — approve whole-system expansion.
>
> **For Full evidence**
> 1. **Accept and continue** — approve the Full evidence and continue to
>    Phase 1 Requirements.
> 2. **Fill evidence gaps or rescan selected areas** — keep the gate at
>    `Awaiting Approval`.
<!-- RAMP:SLOT reverse-engineering-review-options END -->
