# Adaptive Reverse Engineering

**Purpose**: Analyze an existing brownfield system at a depth proportional to the modernization objective, producing evidence-backed artifacts for decomposition and legacy transformation decisions.

**Execute when**: Existing source code is present, or the user asks to modernize, migrate, decompose, extend, or reverse engineer an existing system.

**Skip when**: The work is genuinely greenfield with no existing implementation.

**Rerun when**: The relevant code or prior analysis has materially changed. Reuse current evidence where possible, and note anything left unverified.

## Modes

### Targeted mode (default)

Use Targeted mode when the prompt names a feature, journey, module, endpoint, data area, bounded context, modernization surface, or other bounded objective. Trace the target end-to-end, run the cross-cutting sentinel sweep, and expand only as evidence requires. A Targeted run must not claim whole-system completeness.

### Full mode

Use Full mode only when the user explicitly requests system-wide analysis or approves an expansion to Full. Full mode produces the comprehensive whole-codebase artifact bundle.

### Orientation

When the objective or anchors are ambiguous, run a cheap **Orientation** pass first: inspect prior analysis, repository manifests, module topology, entry points, and build files to resolve a defensible target. If that cannot resolve one, ask **one informed scope clarification** in chat and log the exact question and answer in `aidlc-docs/audit.md`. Ask only when no defensible anchor resolves, multiple disjoint targets match, or materially different capabilities share terminology. Do not ask generic questions that repository evidence can answer.

## Prior analysis (ATX / assessments)

Before scanning, check for pre-existing evidence: `ATXDocumentation/`, `ATXModAnalysis/`, migration/portability assessments, architecture/API/data documentation, and prior `aidlc-docs/analysis/` output.

- **If suitable prior analysis exists and is current for the objective**, ingest it as the primary input, spot-verify its high-risk claims, scan the gaps it does not cover, and note which findings came from prior analysis versus your own scan.
- **Otherwise**, scan the source directly at the depth the selected mode requires.

**Whole-codebase ATX and Targeted mode compose.** When ATX (or an equivalent assessment) spans the entire codebase, use it as broad **whole-system context** — the architecture, component inventory, and dependency map that situate the objective. It does not replace Targeted mode: for the specific feature, slice, or bounded context the user named, still run **Targeted reverse engineering** to reach the granular, code-level depth (end-to-end trace + sentinel sweep) that decomposition decisions require. Prior analysis gives the whole-system map; Targeted RE provides the granular depth on the objective.

Treat prior analysis as input, not final truth — prefer current source/runtime evidence when they conflict.

## Step 1: Objective and scope

Before deep scanning, create or update `aidlc-docs/analysis/reverse-engineering-scope.md`:

```markdown
# Reverse Engineering Scope
- **Mode**: [Targeted / Full]
- **Objective**: [question to answer + downstream outcome]
- **Target Type / Anchors**: [feature/journey/module/endpoint/data area/bounded context/system-wide; routes, symbols, modules, schemas, files]
- **In-Scope**: [behavior and surfaces to trace]
- **Not-In-Scope**: [explicit exclusions]
- **Prior Analysis**: [reused sources, or "none"]
- **Not Analyzed / Open Questions**: [areas not examined and why]
- **Status**: [In Progress / Awaiting Approval / Complete]
```

Use one status field across the scope artifact and `aidlc-state.md`: `In Progress` while gathering evidence, `Awaiting Approval` when evidence is ready for review, and `Complete` only after explicit user approval. Every artifact states its mode, objective, and what was not analyzed.

## Step 2: Targeted path — Orient → Trace → Sentinel Sweep

### Orient

Map the minimum repository structure needed to locate the target: manifests, build files, modules, entry points, likely implementation/data/test/deployment assets, and any relevant prior analysis. This is a locating pass, not a whole-repository scan.

### Trace the target end-to-end

1. Entry point and externally visible behavior.
2. Orchestration, application logic, and business rules.
3. Data access, storage ownership, and transaction boundaries.
4. Side effects and downstream consumers.
5. Success, failure, validation, and error contracts.
6. Direct callers and dependencies.
7. Existing unit, integration, contract, and end-to-end tests.
8. Runtime, deployment, and build configuration that changes the target's behavior.

Record meaningful source paths and symbols. Distinguish observed evidence from inference.

### Mandatory cross-cutting sentinel sweep

To prevent keyhole analysis, check the target's interaction with:
- authentication and authorization;
- session state, static state, and shared memory;
- global configuration and secrets;
- shared databases, schemas, and transactions;
- high-fan-in libraries and shared kernels;
- filesystem and object storage;
- events, queues, jobs, schedulers, and callbacks;
- errors, audit, compliance, and data-handling obligations;
- logging, metrics, tracing, and alerting;
- deployment, infrastructure as code, networking, and runtime topology; and
- tests, CI, release gates, and rollback behavior.

For each sentinel, record the evidence examined, the finding, and any unresolved edge.

### Expansion

Follow direct dependencies, callers, data edges, and configuration edges automatically as the objective requires. If analysis would cross into another business capability or bounded context, deeply analyze a high-fan-in shared kernel, or switch to Full mode, **ask for approval first** — never silently turn a Targeted run into a Full one.

### Stop when

Objective questions are answered with cited evidence, the end-to-end path is traced, the sentinel sweep has no unresolved critical edge, and remaining unknowns are explicit. If critical evidence is inaccessible, say so and note what would unblock it rather than claiming completeness.

## Step 2 artifacts (Targeted)

Create under `aidlc-docs/analysis/`:

### `target-analysis.md`

```markdown
# Target Analysis
- **Mode**: Targeted | **Objective**: [...] | **Scope Boundary**: [...] | **Not Analyzed**: [...]

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

## Step 3: Full path — whole-codebase discovery

Run this path only in Full mode; still apply the prior-analysis strategy and the Step 1 scope.

### Discovery

- Scan all in-scope packages/solutions and package types: Application, Infrastructure, Models, Clients, Tests, Workers, and front ends.
- Identify languages, frameworks, business purpose, and business transactions.
- Discover infrastructure (CDK/Terraform/CloudFormation/containers/runtime hosting), build systems and dependencies, services/APIs/functions/workers/queues/schedulers/data stores, and tests/CI/observability/release gates.

### Full artifact bundle

Create these under `aidlc-docs/analysis/`, each with a one-line mode/objective/scope/not-analyzed header:

- `business-overview.md` — business context diagram, description, transactions, dictionary, and component-level business purposes.
- `architecture.md` — system overview, architecture diagram, component descriptions, data flow, integration points, and infrastructure.
- `code-structure.md` — build system, key classes/modules, file inventory, design patterns, and critical dependencies with migration concerns.
- `api-documentation.md` — endpoints (method/path/handler/auth/request/response/status/side effects), contract summary table, and data models.
- `component-inventory.md` — application/infrastructure/shared/test components with totals.
- `technology-stack.md` — languages/frameworks, data layer, infrastructure/cloud, front end, DevOps/observability, and test tooling.
- `dependencies.md` — internal dependency diagram, external dependencies with migration concerns, and cross-cutting concerns.
- `bounded-contexts.md` — identified contexts (capability, entry points, logic, data access, models, storage, events), context map, shared kernel, and cross-context dependencies.
- `coupling-assessment.md` — coupling matrix, data coupling, extraction difficulty per context, strangler-fig readiness, and modernization risks.

Use Mermaid diagrams where a bundle item calls for one (business context, architecture, data flow, class/module, dependency, and context maps). Full mode must retain all nine artifacts; do not substitute the Targeted bundle.

## Step 4: Metadata and state

Create `aidlc-docs/analysis/reverse-engineering-timestamp.md`:

```markdown
# Reverse Engineering Metadata
- **Analysis Date**: [ISO timestamp] | **Analyzer**: AI-DLC | **Workspace**: [path]
- **Mode**: [Targeted / Full] | **Objective**: [...] | **Scope Boundary**: [...]
- **Prior Analysis**: [reused sources, or none] | **Not Analyzed**: [areas]
- **Status**: [In Progress / Awaiting Approval / Complete]

## Artifacts Generated
[list the Targeted or Full bundle actually generated]
```

Update `aidlc-docs/aidlc-state.md` in the same interaction with mode, objective, scope boundary, status, and any approved expansion. Append the mode selection, scope, expansions, discrepancies, and user approvals to `aidlc-docs/audit.md`. Do not set `Complete` during evidence collection.

## Step 5: Evidence review and approval gate

When mode-specific evidence is ready, set status to `Awaiting Approval` and present a summary covering evidence, findings, coupling/blockers, modernization implications, and what was not analyzed. Say **"reverse-engineering analysis evidence is ready for review"**, not that the run is complete.

For Targeted evidence, offer exactly these choices:
1. **Accept and continue** to Stage 3 using the Targeted bundle.
2. **Fill evidence gaps** within the current scope.
3. **Expand selected areas** (approval required before any major expansion).
4. **Run Full RE** across the system.

For Full evidence, offer:
1. **Accept and continue** to Stage 3 using the Full bundle.
2. **Fill evidence gaps or rescan selected areas**.

**Approval transition**: wait for explicit user approval, append the complete raw approval response to `aidlc-docs/audit.md` with its timestamp, then update the scope artifact, timestamp, and `aidlc-state.md` from `Awaiting Approval` to `Complete`, mark the Stage 2 approval checkbox, and proceed to Stage 3. Without explicit approval plus the raw audit entry, the run stays `Awaiting Approval` and must not be called complete.
