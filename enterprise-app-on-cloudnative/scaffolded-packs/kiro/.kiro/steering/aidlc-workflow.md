---
inclusion: always
---
# Decision-Driven Document Generation Workflow

A general-purpose AI-DLC workflow with an optional **Reverse Engineering /
Input Analysis** pre-phase that runs from existing source code and/or
functional documents (FSDs). Works for greenfield builds, modernization, and
feature additions alike, and always models the domain (bounded contexts) before
technical design.

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING 🚨

**This workflow overrides default behavior** when the user asks to plan, build,
modernize, or change anything that warrants a spec.

**FORBIDDEN ACTIONS until the appropriate gate is cleared:**

- DO NOT generate `requirements.md`, `domain-model.md`, `design.md`, or `tasks.md` without first creating and completing the matching `_decisions-*.md`
- DO NOT skip the Reverse Engineering / Input Analysis phase when existing source code OR functional documents (FSDs) are present
- DO NOT proceed past an approval gate without the user's explicit approval

**MANDATORY FIRST ACTIONS (in this exact order):**

1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, **resume** from where we left off
2. If no state file exists, detect the **input mode**:
   - **Existing system with evidence** — source code in the workspace **and/or** functional/design documents (FSDs, platform exports such as OutSystems) provided by the user → run **Phase 0**.
   - **Pure greenfield** — no source and no descriptive documents → skip Phase 0, start at **Phase 1**.
3. Create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`
4. Start at **Phase 0** (evidence present) or **Phase 1** (pure greenfield).
5. Follow the workflow sequentially with approval gates. **Phase 2 (Domain Model & Bounded Contexts) always runs**, greenfield or not.


## Workflow Overview

```
                         ┌────────────────────────┐
                         │  Detect: input mode?   │
                         │  source and/or FSDs?   │
                         └──────┬─────────┬───────┘
                    evidence present     pure greenfield
                                │         │
                                ▼         │
            ╔════════════════════════════════╗
            ║  PHASE 0: Reverse Engineering / ║   (skip if pure greenfield)
            ║           Input Analysis        ║
            ║  source code AND/OR FSDs/docs   ║
            ║  → aidlc-docs/analysis/*        ║
            ╚════════════════════════════════╝
                                │         │
                                └────┬────┘
                                     ▼
            ╔════════════════════════════════╗
            ║  PHASE 1: Requirements          ║
            ║  _decisions-requirements.md     ║
            ║  → requirements.md              ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
            ╔════════════════════════════════╗
            ║  PHASE 2: Domain Model &        ║   (always runs)
            ║           Bounded Contexts      ║
            ║  _decisions-domain.md           ║
            ║  → domain-model.md              ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
            ╔════════════════════════════════╗
            ║  PHASE 3: Design                ║
            ║  _decisions-design.md           ║
            ║  → design.md                    ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
            ╔════════════════════════════════╗
            ║  PHASE 4: Tasks                 ║
            ║  _decisions-tasks.md            ║
            ║  → tasks.md                     ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
                                Execute tasks
```

Phase 0 runs **once per project** when existing source **or** FSDs/documents are
present, and informs Phases 1–4. Phase 2 (Domain Model & Bounded Contexts)
**always runs** — it consumes Phase 0's `bounded-contexts.md` when present and
builds the model fresh for pure greenfield.


## Core Principles

### 🚨 MANDATORY DECISION FILE FIRST
Before creating ANY spec document (`requirements.md`, `design.md`, `tasks.md`), you MUST:

1. **Create the decision file first**: `_decisions-requirements.md`, `_decisions-design.md`, or `_decisions-tasks.md`
2. **Wait for user input**: Get explicit user decisions before proceeding
3. **Read completed decisions**: Use user choices to generate the final document

**🔒 ABSOLUTE RULE**: NEVER generate `requirements.md`, `design.md`, or `tasks.md` without first creating and completing the corresponding `_decisions-*.md` file.

**Exception**: Skip the decision file ONLY if the user explicitly says "skip the decision file" or "no decisions needed."

### 🌐 LANGUAGE MATCHING
Generate decision files and spec documents in the same language as the user's input prompt. Default to English only if language cannot be determined.

### 💬 NATURAL MESSAGING
**NEVER say**: "According to the rules…", "The steering file indicates…", "Per the guidelines…", "Following the process, I need to…"

**DO say**:
- "To make sure we capture this correctly, let's clarify some key decisions…"
- "Before we lock the design, I'd like to understand your preferences…"
- "I've prepared some decisions to ensure we build exactly what you need."

Present decision files as a natural part of the planning conversation, not as procedural overhead.

### 🔒 DECISION ISOLATION
Each decision file is independent:
- Requirements decisions apply ONLY to `_decisions-requirements.md`
- Design decisions apply ONLY to `_decisions-design.md`
- Tasks decisions apply ONLY to `_decisions-tasks.md`
- **NEVER carry over** preferences between phases without explicit confirmation
- Each phase requires NEW explicit user input


## MANDATORY: State Tracking

Maintain `aidlc-docs/aidlc-state.md` for session continuity. If it exists at
session start, **resume** from the recorded state.

```markdown
# AI-DLC Workflow State

## Project Info
- **Project Type**: [Greenfield / Brownfield Modernization / Feature on existing system]
- **Existing Stack** (if brownfield): [e.g., language, framework, database, cloud services]
- **Target Architecture**: [e.g., target platform / runtime / deployment model]
- **Active Spec**: [name of the spec currently being worked on]

## Phase Progress
- [ ] Phase 0: Reverse Engineering / Input Analysis (skip if pure greenfield)
- [ ] Phase 1: Requirements
  - [ ] 1a. _decisions-requirements.md created
  - [ ] 1b. _decisions-requirements.md completed by user
  - [ ] 1c. requirements.md generated and approved
- [ ] Phase 2: Domain Model & Bounded Contexts
  - [ ] 2a. _decisions-domain.md created
  - [ ] 2b. _decisions-domain.md completed by user
  - [ ] 2c. domain-model.md generated and approved
- [ ] Phase 3: Design
  - [ ] 3a. _decisions-design.md created
  - [ ] 3b. _decisions-design.md completed by user
  - [ ] 3c. design.md generated and approved
- [ ] Phase 4: Tasks
  - [ ] 4a. _decisions-tasks.md created
  - [ ] 4b. _decisions-tasks.md completed by user
  - [ ] 4c. tasks.md generated and approved
  - [ ] 4d. Task execution

## Current Status
**Phase**: [current phase]
**Status**: [In Progress / Awaiting Approval / Complete]
**Last Updated**: [ISO timestamp]
```

### Checkpoint Rules
- Update `aidlc-state.md` immediately after completing each phase step
- Mark checkboxes `[x]` in the SAME interaction where work is completed
- Record current status so a fresh session can resume correctly


## MANDATORY: Audit Logging

Maintain `aidlc-docs/audit.md` as an append-only log.

- ALWAYS append, NEVER overwrite
- Log every user input with complete raw text
- Log every approval/decision with timestamp
- Log every architectural decision with rationale

```markdown
## [Phase Name] — [Step]
**Timestamp**: [ISO timestamp]
**User Input**: "[complete raw input]"
**AI Response**: "[action taken]"
**Decision**: [decision made and rationale]

```


## MANDATORY: Decision File Format

```markdown
# Decisions: [Phase Name]

> **Instructions:** Review each decision point below. agent recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.


## [Decision Category]

### [Specific Decision Point]

**Question:** [Clear question to be answered]

**Why this matters:** [One-sentence explanation of project impact]

**Options:**
1. [Option 1 — Recommended]: [Description with rationale]
2. [Option 2]: [Description]
3. [Option 3]: [Description]
4. Other (please specify): _______________________

**Answer:**

```

**Rules:**
- 3–4 concrete options per decision point
- Mark one option as "Recommended" with rationale
- Briefly explain why each decision matters
- For Design and Tasks phases, **reference the previous phase's decisions** explicitly
- **Customize** decision points to the actual project — never use generic boilerplate
- Handle partial responses: acknowledge completed items, prompt for the rest
- If the user does not respond, ask whether to use agent recommendations as defaults
- Validate that all critical decisions have user input before generating the document


## Session Continuity

When `aidlc-docs/aidlc-state.md` exists at session start:

1. Read the state file to determine current progress
2. Identify the active spec and phase
3. Load all artifacts from completed phases
4. Present a concise resumption message: last completed step, next step
5. Resume from the next incomplete step


# PHASE 0: Reverse Engineering / Input Analysis

**When to run:** Existing source code is present in the workspace, **and/or**
the user provides functional/design documents (FSDs, platform exports such as
OutSystems) about a system to modernize, migrate, or extend.

**When to skip:** Pure greenfield — no existing source and no descriptive
documents.

**Rerun behavior:** Always rerun when the inputs change materially (code
updated, or new/revised FSDs supplied). Stale analysis is worse than no
analysis.

### Activation
**MANDATORY**: Load and follow the `reverse-engineering` companion instructions.
Detect the **input mode** (Code / Document / Hybrid) first and adapt each step;
tag every fact with its evidence source and keep an Assumptions & Open Questions
list. **In Document/Hybrid mode, also load and follow the
`requirements-traceability` companion** — establish stable source anchors and
emit the screen/anchor inventory that Phase 1 traces requirements against.

### Outputs (in `aidlc-docs/analysis/`)
- `business-overview.md`
- `architecture.md`
- `code-structure.md`
- `api-documentation.md`
- `component-inventory.md`
- `technology-stack.md`
- `dependencies.md`
- `bounded-contexts.md`
- `modernization-readiness.md` *(coupling, extraction order, blockers)*

### Approval Gate
Present a summary of findings (bounded contexts, key risks, recommended modernization
order). Wait for the user's explicit approval before moving to Phase 1.

Update `aidlc-state.md`. Append to `audit.md`.


# PHASE 1: Requirements

**Focus:** WHAT to build — business and non-functional requirements.

### Step 1.1 — Create `_decisions-requirements.md`

Generate a decision file for the spec. Decision categories to consider:

- **Scope & Personas:** Which user stories / personas are in/out of scope?
- **Functional Requirements:** Which capabilities are MVP vs phase 2?
- **Non-Functional Requirements:** Latency, throughput, availability, durability targets
- **Compliance & Security Constraints:** Data residency, encryption, audit, regulatory standards
- **Integration Requirements:** Existing systems the spec must interoperate with (drawn from Phase 0 outputs when available)
- **UI/UX Fidelity** *(when screens, screenshots, wireframes, or an FSD UI are provided):* Should the frontend **adhere** to the provided screens as-is, **adhere with improvements** (keep flows/layout, modernize styling/accessibility), or **redesign**? If adhering, the Phase 0 UI/screen catalog becomes the **visual contract** that Design and Tasks trace back to.
- **Deployment Variants:** Cloud-only, hybrid, or on-prem variants the requirements must support

For brownfield or FSD-driven work, reference relevant findings in `aidlc-docs/analysis/`.

### Step 1.2 — Wait for User Input
Acknowledge partial responses. Do not invent decisions.

### Step 1.3 — Generate `requirements.md`

Read the completed decisions and generate `requirements.md` covering:
- User stories (with acceptance criteria, EARS where applicable)
- Functional requirements (numbered, testable)
- Non-functional requirements (numbered, measurable)
- Integration requirements with named systems
- Compliance constraints
- Out-of-scope (explicit)

**MANDATORY (Document/Hybrid mode):** Before generating `requirements.md`, load
and follow the `requirements-traceability` companion — trace every requirement
to a **source anchor** (or tag it `NEW` / `NEEDS-CLARIFICATION`), include a
**Traceability Matrix** with bidirectional coverage, and run its gate check at
the approval step. (Pure greenfield with no source documents: skip it.)

### Approval Gate
Wait for explicit user approval. For document/FSD-driven work, run the
`requirements-traceability` **gate check** (source/coverage/matrix) before
approving. Update `aidlc-state.md` and `audit.md`.


# PHASE 2: Domain Model & Bounded Contexts

**Focus:** the DOMAIN — the bounded contexts, their boundaries, and the
ubiquitous language the system is organized around, decided **before** technical
architecture so Design and Tasks map cleanly onto contexts.

**Always runs** — greenfield, brownfield, and FSD-driven. When Phase 0 produced
`aidlc-docs/analysis/bounded-contexts.md`, use it as the seed and refine it with
the user; for pure greenfield, derive contexts from the Phase 1 requirements.

### Step 2.1 — Create `_decisions-domain.md`

Generate a decision file. Decision categories to consider:

- **Bounded Context Boundaries:** What are the candidate contexts and where do
  the seams fall? (Confirm/adjust the Phase 0 seed when present.)
- **Context Granularity:** Coarse (fewer, larger contexts) vs fine (more,
  smaller) — the trade-off between autonomy and coordination cost.
- **Core vs Supporting vs Generic:** Which contexts are core domain (invest
  most), which are supporting, which are generic (buy/adopt)?
- **Context Relationships:** For each pair, the integration pattern —
  Partnership, Customer/Supplier, Conformist, Anti-Corruption Layer, Shared
  Kernel, Open Host Service, Published Language.
- **Aggregate & Ownership Boundaries:** Which aggregates/entities and which data
  each context owns; where consistency must be strong vs eventual.
- **Domain Events:** The key events that cross context boundaries.
- **Ubiquitous Language:** The agreed terms per context (and where the same word
  means different things in different contexts).

**Reference:** Phase 1 requirements and, when present, Phase 0
`bounded-contexts.md` and `business-overview.md`.

### Step 2.2 — Wait for User Input
Acknowledge partial responses. Do not invent boundaries the user has not confirmed.

### Step 2.3 — Generate `domain-model.md`

Read the completed decisions and generate `domain-model.md` covering:

- **Bounded contexts** — each with its business capability, responsibilities,
  owned aggregates/entities, and owned data.
- **Context map** (Mermaid) — contexts and their relationships, labeled with the
  integration pattern (ACL, Shared Kernel, Customer/Supplier, etc.).
- **Aggregates & entities** — per context, with the invariants each aggregate
  protects and the consistency boundary (strong vs eventual across contexts).
- **Domain events** — the cross-context events, with producers and consumers.
- **Ubiquitous language** — a glossary per context; note any term collisions.
- **Decision log** — short table linking each modeling choice back to
  `_decisions-domain.md` items.

**MANDATORY Mermaid diagrams:**
1. Context map (contexts + relationship types)
2. At least one aggregate / entity diagram for the core context(s)

This model is the contract that Phase 3 Design maps onto components/services and
that Phase 4 Tasks maps onto independent parallel groups.

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# PHASE 3: Design

**Focus:** HOW to build it — technical architecture for the spec.

### Step 3.1 — Create `_decisions-design.md`

Generate a decision file. Decision categories to consider:

- **Context-to-Service Mapping:** How each bounded context from Phase 2 maps to components/services (one service per context, grouped, or modular monolith)
- **Compute & Runtime:** Compute model, runtime/language, framework
- **API & Communication:** API style, sync vs async, eventing pattern, auth strategy
- **Frontend / UI Approach:** Framework and component strategy — and, when the Phase 1 UI-fidelity choice is *adhere* / *adhere with improvements*, how the design honors the Phase 0 UI/screen catalog (screen-by-screen mapping, which improvements are in scope, accessibility uplift)
- **Data Architecture:** Data store choice, ownership, migration approach if brownfield
- **Infrastructure & Operations:** IaC tool, environments, deployment strategy
- **Observability:** Logs, metrics, tracing, alarms; structured logging
- **Testing Strategy at Design Level:** Contract tests, property-based tests, simulation tests
- **Correctness Properties Strategy:** Skip / essential only / comprehensive

**Reference:** Phase 2 domain model (bounded contexts, context map, aggregates,
domain events), Phase 1 decisions, and Phase 0 analysis (when present).

### Step 3.2 — Wait for User Input

### Step 3.3 — Generate `design.md`

Generate the complete technical design covering:

- **Overview** with rationale tied to requirements
- **Architecture diagram** (Mermaid) — components mapped to bounded contexts, data flow, external systems
- **Component design** for each major piece
- **Data model** (entities, schemas, ownership, retention)
- **API contract** (paths, methods, payloads, status codes)
- **Sequence diagrams** (Mermaid) for key flows
- **Cross-cutting concerns** — auth, observability, error handling, security
- **Risks & mitigations**
- **Decision log** — short table linking design choices back to `_decisions-design.md` items

**MANDATORY Mermaid diagrams:**
1. Component / context diagram
2. At least one sequence diagram for the primary happy path
3. Data model / ER diagram (when persistent state exists)

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# PHASE 4: Tasks

**Focus:** Ordered, executable plan to build and verify the spec.

### Step 4.1 — Create `_decisions-tasks.md`

Decision categories to consider:

- **Implementation Strategy:** Vertical slice vs horizontal layer; TDD vs test-after; pair vs solo
- **Task Granularity:** Coarse (≤ 10 tasks) vs fine (≤ 30 tasks)
- **Parallel Execution Groups:** How many parallel workers will execute tasks simultaneously? Which task groups have zero shared state and can execute concurrently? Prefer aligning groups to the **bounded contexts** from Phase 2, which are natural zero-shared-state seams. (Analyze dependencies and propose independent groups)
- **Testing Strategy at Execution Level:** Test-first / parallel / post-impl; coverage targets
- **Deployment Approach:** Per-task deploy vs end-of-spec deploy; canary vs simple cutover
- **Rollback Granularity:** Per-task rollback vs full rollback
- **CI/CD Maturity Goal:** Manual gate vs automated promotion
- **Definition of Done:** Tests pass + IaC deployed + smoke verified, or stricter

**Reference:** Phase 3 design and the Phase 2 domain model (map groups to bounded contexts).

### Step 4.2 — Wait for User Input

### Step 4.3 — Generate `tasks.md`

Generate a numbered task list organized into **independent parallel groups**.
Each group has zero shared-state dependencies with other groups and can be
executed by a separate agent instance simultaneously. Within each group, tasks
are ordered sequentially.

**MANDATORY: Dependency Analysis**

Before generating `tasks.md`, analyze all tasks for:
1. File/module dependencies (does task B read/write files task A creates?)
2. API contract dependencies (does task B call an API task A defines?)
3. Infrastructure dependencies (does task B need infra task A provisions?)
4. Data dependencies (does task B need seed data or schemas from task A?)

Tasks with NO cross-dependencies form independent groups. Tasks that depend on
outputs from another group go into a later wave.

```markdown
# Tasks: <Spec Name>

## Execution Plan

| Wave | Groups (run in parallel) | Depends On |
|------|--------------------------|------------|
| 1    | Group A, Group B, Group C | —          |
| 2    | Group D, Group E          | Wave 1     |
| 3    | Group F                   | Wave 2     |

> **How to run:** Assign one worker (agent instance or developer) per group within the same wave.
> Wait for all groups in a wave to complete before starting the next wave.


## Wave 1 (no dependencies — start all in parallel)

### Group A: [Domain/Feature Name]
- [ ] A.1 [Task description]
- [ ] A.2 [Task description]

### Group B: [Domain/Feature Name]
- [ ] B.1 [Task description]
- [ ] B.2 [Task description]


## Wave 2 (depends on Wave 1 completion)

### Group D: [Domain/Feature Name]
**Requires:** Group A outputs (e.g., domain types), Group B outputs (e.g., schemas)
- [ ] D.1 [Task description]
- [ ] D.2 [Task description]


## Wave 3 (integration — depends on Wave 2)

### Group F: Verification & Integration
**Requires:** All prior waves complete
- [ ] F.1 End-to-end smoke test
- [ ] F.2 Update README with run / teardown instructions
```

**Task generation rules:**
- Each group targets a distinct module/boundary/feature with its own files
- Groups within the same wave MUST NOT touch the same files
- The final wave always includes integration testing and verification
- Each task is small enough to execute as a single agent request

**Task execution rules:**
- Mark each task `[x]` immediately on completion
- Follow design choices from Phase 3 — do not silently override
- Reference Phase 0 artifacts where relevant for brownfield or FSD-driven work
- When the Phase 1 UI-fidelity choice is *adhere* (or *adhere with improvements*), UI-building tasks MUST cite the specific screen from the Phase 0 UI/screen catalog they implement, and the Definition of Done includes visual conformance to that reference (allowing only the improvements agreed in Phase 3)
- Update `aidlc-state.md` after each group completes
- A wave is complete only when ALL groups in that wave are `[x]`

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# Task Execution

After `tasks.md` is approved, the user assigns groups to parallel workers (agent instances, developers, or a mix). For each task:

1. Execute (generate code, IaC, tests, etc.)
2. Mark the task `[x]` in `tasks.md`
3. Append progress to `aidlc-state.md`
4. Append a concise note to `audit.md`

### Parallel Execution Protocol
- Each worker (agent instance or developer) owns ONE group — only touches files within that group's boundary
- Before starting a new wave, verify all groups in the previous wave are `[x]`
- If a group finishes early, the worker waits — do NOT start next-wave tasks early
- Conflicts (two workers accidentally touching the same file) → stop, flag in audit.md, ask user

### Session Continuity During Execution
On resume:
1. Read `aidlc-state.md` for the active spec and phase
2. Read `tasks.md` for the next incomplete group/task
3. Identify which wave is active and which groups are done
4. Resume from the next incomplete task in the assigned group

### Completion
When all tasks are `[x]`:
- Present a final summary: artifacts produced, deployed resources, locations
- Mark the spec complete in `aidlc-state.md`
- Append completion entry to `audit.md`
- Ask whether to start a new spec


## Spec Directory Convention

```
.kiro/specs/<spec-name>/
├── _decisions-requirements.md
├── requirements.md
├── _decisions-domain.md
├── domain-model.md
├── _decisions-design.md
├── design.md
├── _decisions-tasks.md
└── tasks.md
```


## Key Principles

- **Phase 0 only when evidence exists** — run it when source **or** FSDs/docs are present; don't invent analysis for pure greenfield
- **Domain before design** — Phase 2 (Domain Model & Bounded Contexts) always runs and is the contract Design and Tasks map onto
- **Decision-driven** — every phase starts with a `_decisions-*.md`
- **Questions in decision files**, never in chat
- **Approval gates are real** — never proceed without explicit user approval
- **Trackable** — state file + audit log + checkboxes enable session continuity


## 🚨 FINAL REMINDER: WORKFLOW ENFORCEMENT

Every new interaction:

1. CHECK for `aidlc-docs/aidlc-state.md`
2. If it exists, READ it and RESUME
3. If it doesn't exist, detect the input mode (source and/or FSDs present → Phase 0; pure greenfield → Phase 1), then start at the right phase
4. NEVER skip a `_decisions-*.md` before the corresponding spec doc
5. NEVER skip approval gates
6. ALWAYS put questions in decision files, never in chat

This workflow is the only workflow.
