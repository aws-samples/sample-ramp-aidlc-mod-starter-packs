---
inclusion: always
---
# Legacy Transformation on AWS Modernization Workflow

An evidence-driven, decision-gated brownfield workflow for decomposing and
modernizing legacy applications on AWS.

For this pack, the concrete specification is
`.kiro/specs/decomposition-plan/`.

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING

Use this workflow when the user asks about legacy modernization,
decomposition, microservices extraction, strangler migration, replatforming,
refactoring, re-architecture, or reimagination.

**Forbidden until the matching gate is cleared:**

- Do not bypass brownfield reverse engineering.
- Do not silently run a whole-system scan for a bounded objective.
- Do not silently expand into another business capability or bounded context,
  a high-fan-in shared kernel, or Full mode.
- Do not extract services before decomposition decisions are approved.
- Do not generate final `requirements.md`, `design.md`, or `tasks.md` before
  the matching `_decisions-*.md` is completed and explicitly approved.
- Do not generate code or infrastructure as code before the applicable gate.
- Do not create a decision file and its corresponding final artifact in the
  same interaction.

**Mandatory first actions, in order:**

1. Read `aidlc-docs/aidlc-state.md`; if it exists, resume from the next
   incomplete step.
2. If it does not exist, initialize `aidlc-docs/aidlc-state.md` and
   `aidlc-docs/audit.md`.
3. Perform cheap Orientation inside Phase 0.
4. Run Targeted analysis by default, or Full analysis only when explicit or
   approved.
5. Clear the same single Phase 0 approval gate.
6. Proceed through Phase 1 Requirements, Phase 2 Design, Phase 3 Tasks, and
   then execution.

### Scope clarification exception

**One informed scope clarification is the only chat exception** during Phase 0
Orientation. Use it only after cheap repository evidence cannot resolve a
defensible anchor, multiple disjoint targets match, or materially different
business capabilities share terminology.

Log the exact question and complete raw response to
`aidlc-docs/audit.md`. Do not ask a generic question that repository
evidence can answer. Requirements, Design, Tasks, and approval questions remain
decision-file or explicit-gate interactions.

---

## Workflow Overview

```text
User modernization objective
  -> PHASE 0: cheap Orientation + adaptive Reverse Engineering
       Targeted (bounded default) / Full (explicit or approved)
       reuse and spot-verify current prior evidence
  -> explicit Phase 0 approval
  -> PHASE 1: decomposition Requirements
  -> PHASE 2: target Design
  -> PHASE 3: dependency-aware Tasks
  -> execution, integration, cutover, rollback verification
```

Approved Targeted or Full evidence feeds
`.kiro/specs/decomposition-plan/`. Orientation is a cheap, temporary pass,
not a completed analysis mode. Targeted evidence never represents
whole-system completeness.

---

## Core Principles

### 🚨 MANDATORY DECISION FILE FIRST
Before creating ANY spec document (`requirements.md`, `design.md`, `tasks.md`), you MUST:

1. **Create the decision file first**: `_decisions-requirements.md`, `_decisions-design.md`, or `_decisions-tasks.md`
2. **Wait for user input**: Get explicit user decisions before proceeding
3. **Read completed decisions**: Use user choices to generate the final document

**🔒 ABSOLUTE RULE**: NEVER generate `requirements.md`, `design.md`, or `tasks.md` without first creating and completing the corresponding `_decisions-*.md` file.

Creating a decision file and the corresponding final phase document in the
same interaction is forbidden. Stop after creating the decision file and wait
for the user's explicit decisions.

### 🌐 LANGUAGE MATCHING
Generate decision files and spec documents in the same language as the user's input prompt. Default to English only if language cannot be determined.

### 💬 NATURAL MESSAGING
**NEVER say**: "According to the rules…", "The steering file indicates…", "Per the guidelines…", "Following the process, I need to…"

**DO say**:
- "To make sure we capture this correctly, let's clarify some key decisions…"
- "Before we lock the design, I'd like to understand your preferences…"
- "I've prepared some decisions to ensure we build exactly what you need."

Present decision files as a natural part of the planning conversation, not as procedural overhead.

### 💬 QUESTION CHANNEL
Put phase decisions in decision files, never in chat. The only permitted chat
exception is when the active reverse-engineering companion instruction
explicitly declares an Orientation clarification during Phase 0.

This exception is limited to Phase 0 Orientation; it does not apply to phase
decisions or approval gates. Phase decisions remain in their decision files,
and approval gates always require the user's explicit approval.

### 🔒 DECISION ISOLATION
Each decision file is independent:
- Requirements decisions apply ONLY to `_decisions-requirements.md`
- Design decisions apply ONLY to `_decisions-design.md`
- Tasks decisions apply ONLY to `_decisions-tasks.md`
- **NEVER carry over** preferences between phases without explicit confirmation
- Each phase requires NEW explicit user input

---

## MANDATORY: State Tracking

Maintain `aidlc-docs/aidlc-state.md` for session continuity. If it exists at
session start, **resume** from the recorded state.

```markdown
# AI-DLC Workflow State

## Project Info
- **Project Type**: Legacy Transformation on AWS
- **Legacy Stack**: [languages, frameworks, build, data, runtime]
- **Target Architecture**: [unknown until approved / approved summary]
- **Migration Pattern**: [unknown until approved / approved summary]
- **Active Spec**: .kiro/specs/decomposition-plan/

## Reverse Engineering Plan
- **Mode**: [Pending during Orientation / Targeted / Full]
- **Objective**: [user objective and expected downstream outcome]
- **Target Type**: [feature / journey / module / endpoint / data area / bounded context / system-wide]
- **Anchors**: [symbols, routes, modules, schemas, files]
- **In-Scope**: [explicit behavior and surfaces]
- **Not-In-Scope**: [planned exclusions]
- **Prior Analysis**: [reused sources, or none]
- **Not Analyzed / Open Questions**: [areas not examined and why]
- **Reverse Engineering Status**: [In Progress / Awaiting Approval / Complete]
- **Scope Expansions**: [none / approved major expansions with timestamp]

## Phase Progress
- [ ] Phase 0: Reverse Engineering (skip if greenfield)
- [ ] Phase 1: Requirements
  - [ ] 1a. _decisions-requirements.md created
  - [ ] 1b. _decisions-requirements.md completed by user
  - [ ] 1c. requirements.md generated and approved
- [ ] Phase 2: Design
  - [ ] 2a. _decisions-design.md created
  - [ ] 2b. _decisions-design.md completed by user
  - [ ] 2c. design.md generated and approved
- [ ] Phase 3: Tasks
  - [ ] 3a. _decisions-tasks.md created
  - [ ] 3b. _decisions-tasks.md completed by user
  - [ ] 3c. tasks.md generated and approved
  - [ ] 3d. Task execution

## Current Status
**Phase**: [current phase]
**Status**: [In Progress / Awaiting Approval / Complete]
**Last Updated**: [ISO timestamp]
```

### Checkpoint Rules
- Update `aidlc-docs/aidlc-state.md` immediately after completing each phase step
- Mark checkboxes `[x]` in the SAME interaction where work is completed
- Record current status so a fresh session can resume correctly

---

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

---
```

---

## MANDATORY: Decision File Format

```markdown
# Decisions: [Phase Name]

> **Instructions:** Review each decision point below. agent recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

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

---
```

**Rules:**
- 3–4 concrete options per decision point
- Mark one option as "Recommended" with rationale
- Briefly explain why each decision matters
- For Design and Tasks phases, **reference the previous phase's decisions** explicitly
- **Customize** decision points to the actual project — never use generic boilerplate
- Keep every unanswered item and every proposed default or recommendation in
  the decision file
- The user must complete each unanswered item or explicitly confirm a proposed
  default in that same file
- Silence is never acceptance; never infer or apply a default from non-response
  or a chat fallback
- Validate that all critical decisions have user input before generating the document

---

## Session Continuity

When `aidlc-docs/aidlc-state.md` exists at session start:

1. Read the state file to determine current progress
2. Identify the active spec and phase
3. Load all artifacts from completed phases
4. Present a concise resumption message: last completed step, next step
5. Resume from the next incomplete step

---

# PHASE 0: Adaptive Reverse Engineering (Brownfield Only)

**MANDATORY:** Load and follow
`.kiro/steering/reverse-engineering.md`.

## Mode selection

- **Targeted mode** is the default for a bounded feature, journey, module,
  endpoint, data area, bounded context, modernization surface, or other
  bounded objective.
- **Full mode** runs only when the user explicitly asks for whole-system
  analysis or approves a major expansion to Full.
- **Orientation** is a cheap, temporary locating pass. It is not a third
  completed analysis mode.
- **Prior analysis** from current ATX/AWS Transform output, assessments,
  architecture documents, or earlier analysis may be primary input only when
  relevant and current for the objective. Spot-verify high-risk claims and
  prefer current source or runtime evidence when sources conflict. Otherwise,
  scan the source directly.

## Required scope contract

Before deep scanning in both Targeted and Full modes, record the objective,
target type, anchors, in-scope behavior, not-in-scope areas, prior analysis
reused, and not-analyzed areas or open questions in
`aidlc-docs/analysis/reverse-engineering-scope.md` and state.

## Proportional artifacts

Targeted mode produces:

- `reverse-engineering-scope.md`
- `target-analysis.md`
- `target-coupling-assessment.md`
- `reverse-engineering-timestamp.md`

Full mode produces the complete legacy comprehensive bundle:

- `business-overview.md`
- `architecture.md`
- `code-structure.md`
- `api-documentation.md`
- `component-inventory.md`
- `technology-stack.md`
- `dependencies.md`
- `bounded-contexts.md`
- `coupling-assessment.md`
- plus `reverse-engineering-scope.md` and
  `reverse-engineering-timestamp.md`.

The active reverse-engineering companion is authoritative for artifact
contents. Do not invent an unsupported coverage artifact.

## Expansion and approval gate

Direct-dependency expansion may occur automatically. A **major expansion**
into another business capability/bounded context, deep analysis of a
high-fan-in shared kernel, or a switch to Full mode requires explicit approval before scanning.

When evidence is ready, keep the scope, timestamp, and state at
`Awaiting Approval`. Present the evidence, coverage boundaries, key risks, and
recommended decomposition order, then stop for explicit approval.

After explicit approval, execute the **same single Phase 0 approval gate**
detailed by the companion exactly once:

1. Append the complete raw approval response with timestamp to
   `aidlc-docs/audit.md`.
2. Update `aidlc-docs/analysis/reverse-engineering-scope.md`,
   `aidlc-docs/analysis/reverse-engineering-timestamp.md`, and
   `aidlc-docs/aidlc-state.md` from `Awaiting Approval` to `Complete`.
3. Mark the inherited Phase 0 progress and current status complete.
4. Only then enter Phase 1 Requirements.

---

# PHASE 1: Requirements

**Focus:** WHAT to build — business and non-functional requirements.

### Step 1.1 — Create `_decisions-requirements.md`

Create `.kiro/specs/decomposition-plan/_decisions-requirements.md` and cover:

- modernization goal, strategy, definition of done, and measurable success;
- replatform, refactor, re-architect, reimagine, or a deliberate combination;
- included and excluded capabilities, slices, and analyzed evidence;
- strangler, big-bang, parallel-run, or bounded modernization strategy;
- coexistence, cutover, rollback, downtime, and functional parity;
- non-functional, security, compliance, and data-residency requirements;
- named integrations and dependencies;
- data ownership and transaction boundaries; and
- timeline, team, budget, platform, and operational constraints.

### Step 1.2 — Approve Requirements Decisions

Wait for the user to complete and explicitly approve
`_decisions-requirements.md`. Append the complete raw approval response to
`aidlc-docs/audit.md`, then update
`aidlc-docs/aidlc-state.md`. Do not generate the final artifact before this
decision gate is complete.

### Step 1.3 — Generate `requirements.md`

Generate `.kiro/specs/decomposition-plan/requirements.md` with:

- numbered functional and measurable non-functional requirements;
- user stories and testable acceptance criteria, using EARS where applicable;
- per-slice scope and explicit out-of-scope items;
- integrations, data ownership, and transaction boundaries;
- coexistence, migration, cutover, rollback, and downtime constraints; and
- evidence assumptions, open gaps, and named risks from Phase 0.

### Approval Gate
Wait for explicit user approval. Append the complete raw approval response to
`aidlc-docs/audit.md`, then update `aidlc-docs/aidlc-state.md` before
entering Phase 2.

---

# PHASE 2: Design

**Focus:** HOW to build it — technical architecture for the spec.

### Step 2.1 — Create `_decisions-design.md`

Create `.kiro/specs/decomposition-plan/_decisions-design.md`, reference the
approved Requirements, and cover:

- target compute/runtime, framework transformation, packaging, health checks,
  and non-root runtime;
- statelessness and externalization of sessions, caches, and shared state;
- APIs, routing, authentication, authorization, and communication patterns;
- data decomposition, ownership, target stores, synchronization, and migration;
- configuration and secrets externalization;
- accounts, networking, environments, infrastructure as code, observability,
  security, CI/CD, deployment, rollback, testing, and per-slice variation.

Choose one infrastructure-as-code tool for the project. Do not blend
Terraform, CloudFormation, and CDK ownership.

### Step 2.2 — Approve Design Decisions

Wait for the user to complete and explicitly approve
`_decisions-design.md`. Append the complete raw approval response to
`aidlc-docs/audit.md`, then update
`aidlc-docs/aidlc-state.md`. Do not generate the final artifact before this
decision gate is complete.

### Step 2.3 — Generate `design.md`

Generate `.kiro/specs/decomposition-plan/design.md` with:

- target architecture and per-slice component design;
- strangler routing, coexistence, cutover, and rollback phases;
- data ownership, synchronization, and migration flows;
- API contracts and primary sequence flows;
- authentication, observability, configuration, secrets, errors, deployment,
  testing, and rollback;
- risks tied to Phase 0 evidence boundaries; and
- a decision log referencing `_decisions-design.md`.

Include a target architecture/context diagram, a primary sequence diagram, a
persistent data/ER diagram when relevant, and a before/after legacy-to-target
diagram.

### Approval Gate
Wait for explicit user approval. Append the complete raw approval response to
`aidlc-docs/audit.md`, then update `aidlc-docs/aidlc-state.md` before
entering Phase 3.

---

# PHASE 3: Tasks

**Focus:** Ordered, executable plan to build and verify the spec.

### Step 3.1 — Create `_decisions-tasks.md`

Create `.kiro/specs/decomposition-plan/_decisions-tasks.md`, reference the
approved Design, and cover:

- extraction and modernization order;
- task granularity, slice ownership, and independent parallel groups;
- transformation versus refactoring sequence;
- tests, parity, smoke checks, and validation evidence;
- deployment, coexistence, cutover, and rollback granularity; and
- definition of done.

### Step 3.2 — Approve Task Decisions

Wait for the user to complete and explicitly approve `_decisions-tasks.md`.
Append the complete raw approval response to `aidlc-docs/audit.md`, then
update `aidlc-docs/aidlc-state.md`. Do not generate the final artifact
before this decision gate is complete.

### Step 3.3 — Generate `tasks.md`

Generate `.kiro/specs/decomposition-plan/tasks.md` as dependency-aware waves
of independent groups. Before grouping, classify every task against:

1. **File/module dependencies** — files or modules produced or changed.
2. **API/contract dependencies** — services, events, or endpoints consumed.
3. **Infrastructure dependencies** — network, runtime, pipeline, or platform
   prerequisites.
4. **Data dependencies** — schemas, seed data, synchronization, or migrated
   stores.
5. **Cutover dependencies** — strangler routing, coexistence, traffic shift,
   or rollback wiring.

Groups in the same wave must touch distinct files and share no mutable state.
Move consumers of another group's output to a later wave.

Each task must name its inputs, files/modules, validation, and rollback
implication. The final wave must include cross-slice integration, parity and
end-to-end smoke tests, deployment/cutover, rollback verification, and
documentation.

**Execution rules:**

- Mark a task complete only after its validation passes.
- Do not pull a later wave forward.
- Stop if two workers would touch the same files.
- Do not silently change an approved Design decision.

### Approval Gate
Wait for explicit user approval. Append the complete raw approval response to
`aidlc-docs/audit.md`, then update `aidlc-docs/aidlc-state.md` before
starting task execution.

---

# Task Execution

Read approved work from
`.kiro/specs/decomposition-plan/tasks.md`. For each task:

1. Execute within its approved slice and file boundary.
2. Run the relevant tests and validation.
3. Mark it complete only after validation succeeds.
4. Update `aidlc-docs/aidlc-state.md`.
5. Append a concise entry to `aidlc-docs/audit.md`.
6. Do not pull a later wave forward.
7. Stop on conflicting file ownership or a major scope or architecture change.

The final wave owns cross-slice integration, parity and smoke tests, strangler
traffic shift or cutover, rollback verification, and documentation.

When all tasks complete, summarize the produced artifacts,
modernized/extracted components, deployed resources, and verification
evidence. Then update state and audit and offer to start another specification.

---

## Spec Directory Convention

```
.kiro/specs/<spec-name>/
├── _decisions-requirements.md
├── requirements.md
├── _decisions-design.md
├── design.md
├── _decisions-tasks.md
└── tasks.md
```

---

## Key Principles

- **Phase 0 only when brownfield** — don't invent analysis for greenfield work
- **Decision-driven** — every phase starts with a `_decisions-*.md`
- **Questions in decision files** — except an explicitly declared Phase 0
  Orientation clarification from the active reverse-engineering companion
- **Approval gates are real** — never proceed without explicit user approval
- **Trackable** — state file + audit log + checkboxes enable session continuity

---

## 🚨 FINAL REMINDER: WORKFLOW ENFORCEMENT

Every new interaction:

1. CHECK for `aidlc-docs/aidlc-state.md`
2. If it exists, READ it and RESUME
3. If it doesn't exist, decide brownfield vs greenfield, then start at the right phase
4. NEVER skip a `_decisions-*.md` before the corresponding spec doc
5. NEVER skip approval gates
6. Put phase questions in decision files; only an explicitly declared Phase 0
   Orientation clarification may occur in chat

This workflow is the only workflow.
