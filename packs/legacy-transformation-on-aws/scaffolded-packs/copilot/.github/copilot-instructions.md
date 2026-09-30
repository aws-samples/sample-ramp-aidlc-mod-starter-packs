# Legacy Transformation on AWS Modernization Workflow

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING

When the user asks about modernization, decomposition, microservices extraction, strangler fig, or legacy transformation, follow this workflow.

**Forbidden until the matching gate is cleared:**
- Do not skip brownfield reverse engineering.
- Do not silently run a whole-system scan when the objective is bounded.
- Do not silently expand into another business capability, a high-fan-in shared kernel, or Full mode.
- Do not extract services before decomposition decisions are approved.
- Do not generate `requirements.md`, `design.md`, or `tasks.md` before the matching `_decisions-*.md` is completed and approved.
- Do not skip ahead to code or infrastructure generation.

**Mandatory first actions, in order:**
1. Check for `aidlc-docs/aidlc-state.md`; if present, read it and resume from the next incomplete step.
2. If no state exists, create `aidlc-docs/aidlc-state.md` and append the initial entry to `aidlc-docs/audit.md`.
3. Run Stage 1 Workspace Detection as a cheap orientation, not a whole-repository deep scan.
4. Run Stage 2 Reverse Engineering in Targeted or Full mode and clear its approval gate.
5. Run Stage 3 sequentially through Requirements, Design, and Tasks, preserving every decision and document approval gate.

## Workflow Overview

```text
User Objective
     |
     v
+---------------------------------------+
| STAGE 1: Workspace Detection          |
| Cheap orientation + prior evidence    |
+-------------------+-------------------+
                    |
                    v
+---------------------------------------+
| STAGE 2: Reverse Engineering          |
| Targeted (default) OR Full (explicit) |
| Reuse prior analysis when current     |
+-------------------+-------------------+
                    |
             explicit approval
                    |
                    v
+--------------------------------------------------+
| STAGE 3: Decomposition Plan                      |
| decisions -> requirements -> approval            |
| decisions -> design -> approval                  |
| decisions -> tasks -> approval -> execution      |
+--------------------------------------------------+
```

Stage 3 uses either the approved Targeted artifact bundle or the approved Full artifact bundle. A Targeted run must never be presented as complete whole-system analysis.

## Core Principles

### Language matching

Generate workflow artifacts in the user's language unless the language cannot be determined.

### Natural messaging

Present scope and decisions as necessary modernization choices, not procedural overhead. Do not cite internal steering rules to the user.

### Scope clarification exception

Questions for Requirements, Design, and Tasks belong in their `_decisions-*.md` files. **One informed scope clarification is the only chat exception before spec phases**: after a cheap Orientation pass, Stage 2 may ask one informed question if no defensible objective/anchor can be resolved, multiple disjoint targets match, or materially different capabilities share terminology. Log the exact question and answer in `aidlc-docs/audit.md`.

Do not ask generic questions that repository evidence can answer.

### Decision isolation

Requirements, Design, and Tasks decisions are independent. Do not carry preferences into a later phase without explicit confirmation in that phase.

### Honest coverage

Every Reverse Engineering artifact states its mode, objective, scope boundary, and what was not analyzed. A Targeted run is never presented as whole-system analysis, and missing critical evidence is called out rather than hidden behind a false Complete status.

## Mandatory State Tracking

Maintain `aidlc-docs/aidlc-state.md` and update it in the same interaction whenever a step, scope expansion, gate, task section, or status changes.

```markdown
# AI-DLC Modernization Workflow State

## Project Info
- **Project Type**: Legacy Transformation on AWS
- **Legacy Stack**: [languages, frameworks, build, data, runtime]
- **Target Architecture**: [unknown until approved / approved summary]
- **Migration Pattern**: [unknown until approved / approved summary]
- **Active Spec**: [spec directory]

## Reverse Engineering Plan
- **Mode**: [Orientation / Targeted / Full]
- **Objective**: [user objective and expected downstream outcome]
- **Target Type**: [feature / journey / module / endpoint / data area / bounded context / system-wide]
- **Anchors**: [symbols, routes, modules, schemas, files]
- **In-Scope**: [explicit behavior and surfaces]
- **Not-In-Scope**: [planned exclusions]
- **Prior Analysis**: [reused sources, or none]
- **Not Analyzed / Open Questions**: [areas not examined and why]
- **Reverse Engineering Status**: [In Progress / Awaiting Approval / Complete]
- **Scope Expansions**: [none / approved major expansions with timestamp]

## Stage Progress
- [ ] 1. Workspace Detection
- [ ] 2. Reverse Engineering
  - [ ] Scope contract resolved
  - [ ] Evidence gathering complete
  - [ ] Coverage/status recorded
  - [ ] User approval received
- [ ] 3. Decomposition Plan Spec
  - [ ] 3a. `_decisions-requirements.md` created
  - [ ] 3b. Requirements decisions completed and approved by user
  - [ ] 3c. `requirements.md` generated and approved
  - [ ] 3d. `_decisions-design.md` created
  - [ ] 3e. Design decisions completed and approved by user
  - [ ] 3f. `design.md` generated and approved
  - [ ] 3g. `_decisions-tasks.md` created
  - [ ] 3h. Tasks decisions completed and approved by user
  - [ ] 3i. `tasks.md` generated and approved
  - [ ] 3j. Task execution

## Task Execution Progress
- [ ] Planning tasks
- [ ] Service or modernization slice: [name]
- [ ] Integration and verification

## Current Status
- **Stage**: [stage]
- **Spec Phase**: [phase]
- **Status**: [In Progress / Awaiting Approval / Complete]
- **Last Updated**: [ISO timestamp]
```

### Checkpoint rules

- Mark checkboxes `[x]` in the same interaction in which work completes.
- Record any approved major scope expansion.
- Use exactly `In Progress / Awaiting Approval / Complete` for Reverse Engineering status across the scope, timestamp, and state artifacts.
- When mode-specific evidence is finished, set Reverse Engineering to `Awaiting Approval`; do not call the run complete.
- Set Reverse Engineering to `Complete` only after explicit user approval is appended verbatim to audit and state is updated.
- Resume from state; do not restart completed phases unless evidence is stale or the user requests a rerun.

## Mandatory Audit Logging

Maintain `aidlc-docs/audit.md` as append-only. Never overwrite it.

Log:
- every user input with complete raw text;
- mode selection with rationale, and whether prior analysis was reused;
- scope, assumptions, and open questions;
- the Orientation clarification question/answer, if used;
- approved major scope expansions;
- status changes;
- all decision-file answers and all approval responses; and
- architectural decisions with rationale.

```markdown
## [Stage] — [Step]
**Timestamp**: [ISO timestamp]
**User Input**: "[complete raw input]"
**AI Response**: "[action taken]"
**Decision**: [decision and rationale]
```

## Mandatory Decision File Format

```markdown
# Decisions: [Phase Name]

> **Instructions:** Review each decision point. Recommendations are provided for guidance. Fill in every Answer section, then confirm when ready for approval.

## [Decision Category]

### [Specific Decision Point]

**Question:** [clear question]

**Why this matters:** [impact]

**Options:**
1. [Recommended option]: [description and rationale]
2. [Option]: [description]
3. [Option]: [description]
4. Other (please specify): _______________________

**Answer:**
```

Rules:
- Provide three or four concrete options and mark one recommendation.
- Customize choices to the approved Reverse Engineering evidence and current phase.
- Design decisions reference Requirements; Tasks decisions reference Design.
- Acknowledge partial answers and leave unanswered decisions open.
- Do not invent decisions. If the user gives no answer, ask in the decision file whether recommendations should be accepted as defaults.
- Skip a decision file only when the user explicitly says to skip it or says no decisions are needed.

## Session Continuity

When state exists:
1. Read state and audit.
2. Load completed mode-specific Reverse Engineering artifacts and approved spec artifacts.
3. Reassess prior evidence only if state says it is stale or the relevant code materially changed.
4. Present the last completed step and next incomplete step.
5. Resume without bypassing any pending approval.

# Stage 1: Workspace Detection

Perform only enough orientation to classify the workspace and support Stage 2 mode selection:
1. Locate source roots, repository manifests, build files, module topology, entry points, tests, infrastructure, and prior analysis.
2. Identify languages, frameworks, build tools, data stores, runtime/deployment model, and likely objective anchors.
3. Detect ATX/AWS Transform output, migration assessments, architecture documents, and prior `aidlc-docs/analysis/` artifacts.
4. Initialize state and audit if absent.
5. Proceed automatically to Stage 2; do not perform deep whole-codebase analysis in Stage 1.

# Stage 2: Reverse Engineering

Load and follow `reverse-engineering.md`.

## Mode selection

- **Targeted mode** is the default when the user names a feature, journey, module, endpoint, data area, bounded context, modernization surface, or other bounded objective.
- **Full mode** runs only when the user explicitly asks for whole-system analysis or approves a major expansion to Full.
- **Orientation** is a temporary pass for ambiguous prompts. Resolve anchors from cheap repository evidence; use the one informed scope clarification only if the permitted ambiguity conditions remain.
- **Prior analysis** (ATX/assessments), when found and current for the objective, is ingested as primary input and spot-verified; otherwise scan the source directly. Prefer current source/runtime evidence when they conflict. When ATX covers the whole codebase, use it as broad whole-system context, but still run Targeted RE for granular depth on the user's specific objective — the two compose.

## Required scope contract

Before deep scanning in both Targeted and Full modes, record objective, target type, anchors, in-scope behavior, not-in-scope areas, prior analysis reused, and open questions / not-analyzed areas in `aidlc-docs/analysis/reverse-engineering-scope.md` and state.

## Proportional artifacts

Targeted mode produces:
- `reverse-engineering-scope.md`
- `target-analysis.md`
- `target-coupling-assessment.md`
- `reverse-engineering-timestamp.md`

Full mode preserves the comprehensive bundle:
- `business-overview.md`
- `architecture.md`
- `code-structure.md`
- `api-documentation.md`
- `component-inventory.md`
- `technology-stack.md`
- `dependencies.md`
- `bounded-contexts.md`
- `coupling-assessment.md`
- plus `reverse-engineering-scope.md` and `reverse-engineering-timestamp.md` for scope honesty.

## Expansion and approval gate

Direct-dependency expansion may occur automatically. A **major expansion** into another business capability/bounded context, deep analysis of a high-fan-in shared kernel, or a switch to Full mode requires explicit approval before scanning.

When evidence collection is approval-ready, update the scope artifact, timestamp, and state to `Awaiting Approval`. Present a mode-aware message that the **analysis evidence is ready for review**, not that Reverse Engineering is complete:
- Targeted: accept and continue; fill evidence gaps; expand selected areas; or run Full RE.
- Full: accept and continue; or fill evidence gaps/rescan selected areas.

Only after explicit approval, append the complete raw response to `aidlc-docs/audit.md`, update the Reverse Engineering status to `Complete` in scope/timestamp/state, and mark the Stage 2 approval checkbox. Do not enter Stage 3 before that Awaiting Approval → Complete transition.

# Stage 3: Decomposition Plan Spec

Use the approved Targeted or Full bundle as evidence. Scope every proposed extraction or modernization slice to analyzed evidence, and carry explicit coverage gaps into requirements and risks.

Use one specification directory for Requirements, Design, Tasks, and execution.

## Requirements Phase

### Create `_decisions-requirements.md`

Cover WHAT the modernization must achieve, tailored to the approved evidence:
- modernization goal and definition of done: replatform (lift-and-shift to containers), refactor (framework/language upgrade), re-architect (decompose to services), or reimagine — and the success criteria that define "done";
- scope and strategy: strangler fig, big bang, parallel run, or bounded modernization;
- which analyzed capabilities/slices are included or excluded;
- coexistence, cutover, rollback, and downtime constraints;
- functional parity and expected behavior changes;
- non-functional, security, compliance, and data-residency requirements;
- named integrations and dependencies;
- data ownership and transaction boundaries; and
- timeline, team, budget, and platform constraints.

### Approval Gate 1 — Requirements decisions

Wait for the user to complete and explicitly approve `_decisions-requirements.md`. Record the raw response in audit and state before generating `requirements.md`.

### Generate `requirements.md`

Include numbered functional/non-functional requirements, user stories and acceptance criteria (EARS format where applicable), per-slice scope, integrations, data ownership, migration/cutover constraints, coverage assumptions, and explicit out-of-scope items.

### Approval Gate 2 — Requirements document

Wait for explicit approval of `requirements.md`; update audit and state.

## Design Phase

### Create `_decisions-design.md`

Reference approved Requirements and gather HOW choices for:
- target compute/runtime, packaging (container image, health checks, non-root runtime), and framework transformation;
- statelessness: session state, in-process caches, and shared/static state to externalize for horizontal scaling and safe cutover;
- API, routing, auth, and inter-service communication;
- data decomposition, target stores, synchronization, and migration;
- configuration and secrets externalization out of code and config files into a parameter/secret store;
- infrastructure as code, accounts, networking, and environments;
- observability, security (least-privilege roles and secrets injection), CI/CD, deployment, rollback, and testing (parity/regression, contract, and smoke); and
- per-slice choices where one architecture does not fit all.

Activate applicable bundled skills and validate current AWS behavior before proposing AWS-specific options.

**Pick one IaC tool per project.** The bundled skills split by tool — `ecs-build` generates Terraform while `aws-cloudformation` generates CloudFormation (and CDK where applicable). Choose a single IaC tool, activate the matching skill, and call the choice out explicitly rather than blending outputs.

### Approval Gate 3 — Design decisions

Wait for the user to complete and explicitly approve `_decisions-design.md`; update audit and state before generating `design.md`.

### Generate `design.md`

Include:
- target architecture and before/after Mermaid diagrams;
- strangler/cutover routing phases when applicable;
- per-service or per-slice component design;
- data ownership and migration flow;
- API contracts and primary sequence flows;
- auth, observability, config/secrets, errors, deployment, and rollback;
- risks and mitigations tied to Reverse Engineering coverage; and
- a decision log referencing `_decisions-design.md`.

**Mandatory diagrams:** a target architecture/context diagram; at least one sequence diagram for the primary flow; a data model / ER diagram when persistent state exists; and a before → after (legacy vs modernized) diagram when applicable.

### Approval Gate 4 — Design document

Wait for explicit approval of `design.md`; update audit and state.

## Tasks Phase

### Create `_decisions-tasks.md`

Reference approved Design and gather execution choices for:
- extraction/modernization order and sequencing (e.g. strangler-fig slice order);
- **parallel execution groups**: which extraction/modernization slices share no state and can be worked concurrently by separate workers — analyze dependencies and propose independent groups;
- task granularity and ownership;
- transformation versus refactoring sequence;
- tests, parity criteria, coverage, and smoke verification;
- deployment, cutover, and rollback granularity; and
- definition of done.

### Approval Gate 5 — Tasks decisions

Wait for the user to complete and explicitly approve `_decisions-tasks.md`; update audit and state before generating `tasks.md`.

### Generate `tasks.md`

Organize tasks into **dependency-aware waves of independent groups**. Each group is a distinct decomposition slice, bounded context, service, or cross-cutting concern with its own files; groups in the same wave share no state and can be executed by separate workers in parallel. Within a group, tasks run sequentially.

**Mandatory dependency analysis** — before writing `tasks.md`, classify every task against the approved Design for:
1. File/module dependencies — does task B read or write files task A creates?
2. API/contract dependencies — does task B call a service or endpoint task A defines?
3. Infrastructure dependencies — does task B need infra (network, cluster, pipeline) task A provisions?
4. Data dependencies — does task B need schemas, seed data, or a migrated store task A produces?
5. Cutover dependencies — does task B rely on strangler routing, coexistence, or rollback wiring task A establishes?

Tasks with no cross-dependencies form independent groups in the same wave. Tasks that consume another group's output move to a later wave.

Lead `tasks.md` with an execution plan, then the grouped waves:

```markdown
# Tasks: <Decomposition Slice / Spec Name>

## Execution Plan

| Wave | Groups (run in parallel) | Depends On |
|------|--------------------------|------------|
| 1    | Group A, Group B, Group C | —          |
| 2    | Group D, Group E          | Wave 1     |
| 3    | Group F                   | Wave 2     |

> **How to run:** Assign one worker (agent instance or developer) per group within a wave.
> Complete every group in a wave before starting the next.

## Wave 1 (no dependencies — start all in parallel)

### Group A: [Slice / Context / Concern]
- [ ] A.1 [Task — inputs, files/modules, validation, rollback implication]
- [ ] A.2 [Task]

### Group B: [Slice / Context / Concern]
- [ ] B.1 [Task]

## Wave 2 (depends on Wave 1)

### Group D: [Slice / Context / Concern]
**Requires:** Group A outputs (e.g. extracted service), Group B outputs (e.g. migrated schema)
- [ ] D.1 [Task]

## Wave 3 (integration & cutover — depends on Wave 2)

### Group F: Verification & Cutover
**Requires:** all prior waves complete
- [ ] F.1 Integration and end-to-end smoke tests across extracted slices
- [ ] F.2 Strangler cutover / traffic shift with rollback verification
- [ ] F.3 Update docs with build, deploy, and rollback instructions
```

**Task generation rules:**
- Each group targets a distinct slice/boundary/concern with its own files; groups in the same wave must not touch the same files.
- Each task is small enough for one worker request and names its inputs, files/modules, validation, and rollback implication.
- The final wave always includes integration tests, end-to-end smoke verification, deployment/cutover, rollback, and documentation.

**Task execution rules:**
- Mark each task `[x]` immediately after its validation passes.
- Follow approved Design decisions; do not silently change them.
- A wave is complete only when every group in it is `[x]`; verify this before starting the next wave.
- If a group finishes early, its worker waits — do not pull next-wave tasks forward.
- If two workers would touch the same files, stop, flag it in `audit.md`, and ask the user.

### Approval Gate 6 — Tasks document

Wait for explicit approval of `tasks.md`; update audit and state before execution.

# Task Execution

For each approved task:
1. Execute according to Design without silently changing decisions.
2. Run the most relevant tests and validation.
3. Mark the task `[x]` immediately after successful validation.
4. Update state and append a concise audit entry.
5. Stop and request approval if execution requires a major scope or architecture change.

When all tasks are complete:
- present produced artifacts, extracted/modernized components, deployed resources, and verification evidence;
- mark the workflow complete in state;
- append completion to audit; and
- ask whether to start a new specification.

## Directory Structure

```text
<WORKSPACE-ROOT>/
├── [existing legacy source]
├── services/ or [modernized components]
├── infrastructure/
├── decomposition-plan/
│   ├── _decisions-requirements.md
│   ├── requirements.md
│   ├── _decisions-design.md
│   ├── design.md
│   ├── _decisions-tasks.md
│   └── tasks.md
└── aidlc-docs/
    ├── analysis/
    │   ├── reverse-engineering-scope.md
    │   ├── reverse-engineering-timestamp.md
    │   ├── target-analysis.md                 # Targeted mode
    │   ├── target-coupling-assessment.md      # Targeted mode
    │   ├── business-overview.md               # Full mode
    │   ├── architecture.md                    # Full mode
    │   ├── code-structure.md                  # Full mode
    │   ├── api-documentation.md               # Full mode
    │   ├── component-inventory.md             # Full mode
    │   ├── technology-stack.md                # Full mode
    │   ├── dependencies.md                    # Full mode
    │   ├── bounded-contexts.md                # Full mode
    │   └── coupling-assessment.md             # Full mode
    ├── aidlc-state.md
    └── audit.md
```

## Final Enforcement Reminder

On every interaction:
1. Read state first and resume.
2. Keep Stage 2 proportional: Targeted by default for bounded objectives; Full only when explicit or approved.
3. When prior analysis is reused, ingest it as input and spot-verify high-risk claims rather than trusting it wholesale.
4. Never silently approve a major expansion or claim whole-system completeness from Targeted evidence.
5. Preserve the Stage 2 approval and all six Stage 3 decision/document gates.
6. Keep spec-phase questions in decision files; only the informed Orientation scope clarification may occur in chat.
