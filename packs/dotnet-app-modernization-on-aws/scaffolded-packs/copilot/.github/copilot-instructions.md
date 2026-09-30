# Decision-Driven Modernization Workflow

An AI-DLC workflow for **modernizing .NET applications onto AWS**. It is
**brownfield-first**: the default assumption is that existing source code is
present (e.g. an ASP.NET Framework app to be moved to ASP.NET Core and deployed
to containers), so the **Reverse Engineering** pre-phase runs by default. It
still degrades gracefully to greenfield "reimagine" work when no prior code
exists.

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING 🚨

**This workflow overrides default behavior** when the user asks to modernize,
migrate, replatform, refactor, containerize, or otherwise change a .NET
application for AWS.

**FORBIDDEN ACTIONS until the appropriate gate is cleared:**

- DO NOT generate `requirements.md`, `design.md`, or `tasks.md` without first creating and completing the matching `_decisions-*.md`
- DO NOT skip the Reverse Engineering phase when an existing codebase is present
- DO NOT proceed past an approval gate without the user's explicit approval

**MANDATORY FIRST ACTIONS (in this exact order):**

1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, **resume** from where we left off.
2. If no state file exists, create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md`.
3. Decide if this is **brownfield** (existing .NET source present — the default for modernization) or **greenfield** (no existing code — a reimagine/rebuild).
4. **Brownfield → run Phase 0 (Reverse Engineering) FIRST** — load and follow `reverse-engineering.md` and write every analysis document under `aidlc-docs/analysis/`. **Greenfield → skip Phase 0.**
5. Then proceed through the phases sequentially — Requirements → Design → Tasks — each behind its decision-file gate.

## Workflow Overview

```
                         ┌────────────────────────┐
                         │  Detect: brownfield?   │  (default: YES for modernization)
                         └──────┬─────────┬───────┘
                       brownfield        greenfield
                                │         │
                                ▼         │
            ╔════════════════════════════════╗
            ║  PHASE 0: Reverse Engineering  ║   (skip if greenfield)
            ║  → aidlc-docs/analysis/*       ║
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
            ║  PHASE 2: Design                ║
            ║  _decisions-design.md           ║
            ║  → design.md                    ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
            ╔════════════════════════════════╗
            ║  PHASE 3: Tasks                 ║
            ║  _decisions-tasks.md            ║
            ║  → tasks.md (parallel waves)    ║
            ╚════════════════════════════════╝
                                     │
                                     ▼
                                Execute tasks
```

Phase 0 runs **once per project** when the project is brownfield, and informs
Phases 1–3. The typical .NET modernization arc it feeds is: **assess the legacy
app → (optionally) run AWS Transform for .NET to move ASP.NET Framework →
ASP.NET Core → stabilize the transformed app → externalize state/config →
containerize → deploy to ECS Fargate → instrument.**

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
- "To make sure we modernize this correctly, let's clarify some key decisions…"
- "Before we lock the target architecture, I'd like to understand your preferences…"
- "I've prepared some decisions to ensure we land exactly the modernization you need."

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
- **Project Type**: [Brownfield Modernization / Greenfield Reimagine / Feature on modernized system]
- **Legacy Stack** (if brownfield): [e.g. ASP.NET Framework 4.x MVC, IIS-hosted, SQL Server, in-proc session]
- **Target Architecture**: [e.g. ASP.NET Core on ECS Fargate/Linux, Aurora PostgreSQL, ElastiCache session, Parameter Store config]
- **Active Spec**: [name of the spec currently being worked on]

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

> **Instructions:** Review each decision point below. Agent recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.


## [Decision Category]

### [Specific Decision Point]

**Question:** [Clear question to be answered]

**Why this matters:** [One-sentence explanation of modernization impact]

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
- **Customize** decision points to the actual application under modernization — never use generic boilerplate
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


# PHASE 0: Reverse Engineering (Brownfield — the default for modernization)

**When to run:** Existing .NET source is present in the workspace OR the user
references an existing system to modernize/migrate/replatform. This is the
default for a modernization engagement.

**When to skip:** Greenfield "reimagine" work with no prior code.

**Rerun behavior:** Always rerun when the brownfield codebase has changed
materially (e.g. after running AWS Transform for .NET). Stale analysis is worse
than no analysis.

### Activation
**MANDATORY**: Load and follow `reverse-engineering.md`. Write every analysis
document it specifies under `aidlc-docs/analysis/`. Capture .NET-specific facts:
target framework(s), IIS/`web.config` dependencies, `Global.asax` startup,
in-process session state, `System.Web` coupling, authentication mode, and any
Windows-only dependencies that affect a move to Linux containers.

### Two modes — depending on pre-existing AWS Transform (ATX) analysis

First run `reverse-engineering.md` **Step 0** to detect any pre-existing AWS
Transform (ATX) analysis, then choose the mode:

- **No ATX analysis found → FULL reverse engineering (the default).** Run every
  step of `reverse-engineering.md` from scratch, scanning the codebase directly.

- **ATX analysis found → ACCELERATED "reuse & verify" mode.** Do NOT skip Phase 0
  and do NOT blindly trust the analysis. Instead:
  1. Ingest ATX output as the **primary input**.
  2. Assess its **freshness** (has the code changed since the transform run?) and
     **coverage** (does it span the whole in-scope app, and does it include what
     downstream phases need — bounded contexts, statelessness/containerization
     audit, AI-DLC modernization-readiness — which ATX may not produce?).
  3. Do **targeted code verification only** — spot-check ATX claims and scan the
     **gaps**, rather than a full from-scratch pass.
  4. Reconcile discrepancies and attribute each finding's provenance (ATX vs your
     own scan) in the `aidlc-docs/analysis/*` docs.

### Approval Gate
Present a summary of findings (framework version, containerization blockers,
state/config externalization needs, recommended modernization order). When ATX
analysis was used, also state **what ATX covered, how current it is, and what you
verified**, and offer the user three choices:

- **(a)** accept the ATX-based analysis as-is,
- **(b)** have me fill specific gaps / re-scan specific areas, or
- **(c)** run a full from-scratch reverse-engineering pass.

Wait for the user's explicit approval (and mode choice, when ATX was used) before
moving to Phase 1.

Update `aidlc-state.md`. Append to `audit.md` — including which mode was used and
the user's choice.


# PHASE 1: Requirements

**Focus:** WHAT the modernization must achieve — business outcomes and non-functional targets.

### Step 1.1 — Create `_decisions-requirements.md`

Decision categories to consider:

- **Modernization Goals:** Replatform (lift-shift to containers), refactor (framework upgrade), or reimagine? What defines "done"?
- **Scope & Cutover:** Which apps/modules/endpoints are in scope? Big-bang vs incremental cutover (e.g. strangler-fig)?
- **Functional Parity:** Which behaviors must be preserved exactly vs allowed to change?
- **Non-Functional Requirements:** Latency, throughput, availability, scaling targets after modernization
- **Compliance & Security Constraints:** Data residency, encryption, audit, regulatory standards
- **Integration Requirements:** External systems / on-prem dependencies the modernized app must still talk to
- **Migration Constraints:** Downtime tolerance, rollback expectations, data migration windows

For brownfield work, reference relevant findings in `aidlc-docs/analysis/`.

### Step 1.2 — Wait for User Input
Acknowledge partial responses. Do not invent decisions.

### Step 1.3 — Generate `requirements.md`
Cover user stories/acceptance criteria (EARS where applicable), numbered functional & non-functional requirements, named integrations, compliance constraints, and explicit out-of-scope items.

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# PHASE 2: Design

**Focus:** HOW to modernize — target architecture on AWS.

### Step 2.1 — Create `_decisions-design.md`

Decision categories to consider:

- **Transformation Path:** Use AWS Transform for .NET (Framework → Core) vs manual upgrade vs keep-as-is; post-transform stabilization scope
- **Compute Target:** ECS Fargate (Linux) is the pack default — confirm vs EC2 launch type / other; task sizing, ALB, auto-scaling
- **Containerization:** Base image, Dockerfile strategy, health-check endpoint, non-root/read-only rootfs
- **State Externalization:** ASP.NET session state → ElastiCache (Valkey/Redis)? In-proc caches to remove?
- **Configuration & Secrets:** Externalize to SSM Parameter Store / Secrets Manager; what moves out of `appsettings.json`/`web.config`?
- **Data Architecture:** Keep SQL Server vs migrate to Aurora (PostgreSQL/MySQL/DSQL); migration approach (SCT/DMS/Babelfish)
- **API & Communication:** API Gateway fronting? Auth strategy; sync vs async
- **IaC:** CloudFormation vs CDK vs Terraform — keep the IaC-tool choice an explicit decision (see the note below)
- **Observability:** CloudWatch, Container Insights, ADOT sidecar for OpenTelemetry, X-Ray, Application Signals
- **Identity & Access:** Task role vs execution role, least-privilege policies, secrets injection
- **Testing Strategy at Design Level:** Parity/regression tests, contract tests, smoke tests

**Reference:** Phase 1 decisions and Phase 0 analysis.

> **IaC note:** the .NET modernization skills (`dotnet-aws-ecs`, `dotnet-adot-sidecar`, `dotnet-aspnet-sessionstate-aws`, `dotnet-aws-parameterstore`) generate **CloudFormation or CDK**, while the ECS `ecs-build` skill generates **Terraform**. Pick one IaC tool per project and activate the matching skill; call the mix out explicitly rather than blending outputs.

### Step 2.2 — Wait for User Input

### Step 2.3 — Generate `design.md`
Cover overview (tied to requirements), architecture diagram (Mermaid), component design, data model, API contract, sequence diagrams for key flows, cross-cutting concerns (auth, observability, config/secrets, error handling), risks & mitigations, and a decision-log table linking choices back to `_decisions-design.md`.

**MANDATORY Mermaid diagrams:**
1. Target architecture / context diagram (VPC, ALB, ECS service, data store, dependencies)
2. At least one sequence diagram for the primary happy path
3. Data model / ER diagram (when persistent state exists)
4. When applicable, a before → after (legacy vs modernized) diagram

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# PHASE 3: Tasks

**Focus:** Ordered, executable plan to modernize and verify.

### Step 3.1 — Create `_decisions-tasks.md`

Decision categories to consider:

- **Implementation Strategy:** Vertical slice vs horizontal layer; TDD vs test-after; per-module vs whole-app
- **Task Granularity:** Coarse (≤ 10 tasks) vs fine (≤ 30 tasks)
- **Parallel Execution Groups:** Which task groups have zero shared state and can execute concurrently? (Analyze dependencies and propose independent groups)
- **Sequencing vs AWS Transform:** Where does the AWS Transform run sit relative to state/config externalization and containerization?
- **Testing Strategy at Execution Level:** Parity/regression first? Coverage targets; smoke tests post-deploy
- **Deployment Approach:** Per-task deploy vs end-of-spec deploy; blue/green vs rolling; canary
- **Rollback Granularity:** Per-task vs full rollback; cutover safety
- **Definition of Done:** Builds + runs on Linux container + IaC deployed + smoke verified, or stricter

**Reference:** Phase 2 decisions.

### Step 3.2 — Wait for User Input

### Step 3.3 — Generate `tasks.md`

Generate a numbered task list organized into **independent parallel groups**.
Each group has zero shared-state dependencies with other groups and can be
executed by a separate worker (agent instance or developer) simultaneously.
Within each group, tasks are ordered sequentially.

**MANDATORY: Dependency Analysis** — before generating `tasks.md`, analyze all tasks for:
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


## Wave 2 (depends on Wave 1 completion)

### Group D: [Domain/Feature Name]
**Requires:** Group A outputs (e.g. transformed project), Group B outputs (e.g. externalized config)
- [ ] D.1 [Task description]


## Wave 3 (integration — depends on Wave 2)

### Group F: Verification & Cutover
**Requires:** All prior waves complete
- [ ] F.1 End-to-end smoke test on the container
- [ ] F.2 Update README with build / deploy / rollback instructions
```

**Task generation rules:**
- Each group targets a distinct module/boundary/concern with its own files
- Groups within the same wave MUST NOT touch the same files
- The final wave always includes integration testing, smoke verification, and cutover/rollback notes
- Each task is small enough to execute as a single agent request

**Task execution rules:**
- Mark each task `[x]` immediately on completion
- Follow design choices from Phase 2 — do not silently override
- Reference Phase 0 artifacts where relevant
- Update `aidlc-state.md` after each group completes
- A wave is complete only when ALL groups in that wave are `[x]`
- Before starting a new wave, verify all groups in the previous wave are `[x]`
- If a group finishes early, the worker waits — do NOT start next-wave tasks early
- Conflicts (two workers touching the same file) → stop, flag in `audit.md`, ask user

### Approval Gate
Wait for explicit user approval. Update `aidlc-state.md` and `audit.md`.


# Task Execution

After `tasks.md` is approved, the user assigns groups to parallel workers. For each task:

1. Execute (transform, code, IaC, tests, containerize, deploy)
2. Mark the task `[x]` in `tasks.md`
3. Append progress to `aidlc-state.md`
4. Append a concise note to `audit.md`

### Completion
When all tasks are `[x]`:
- Present a final summary: artifacts produced, deployed resources, locations
- Mark the spec complete in `aidlc-state.md`
- Append a completion entry to `audit.md`
- Ask whether to start a new spec


## Spec Directory Convention

```
specs/<spec-name>/
├── _decisions-requirements.md
├── requirements.md
├── _decisions-design.md
├── design.md
├── _decisions-tasks.md
└── tasks.md
```


## Key Principles

- **Brownfield-first** — modernization assumes existing code; run Phase 0 unless it's a true greenfield reimagine
- **Decision-driven** — every phase starts with a `_decisions-*.md`
- **Questions in decision files**, never in chat
- **Approval gates are real** — never proceed without explicit user approval
- **Skills/MCP before design & code** — see `skill-activation.md`
- **Trackable** — state file + audit log + checkboxes enable session continuity


## 🚨 FINAL REMINDER: WORKFLOW ENFORCEMENT

Every new interaction:

1. CHECK for `aidlc-docs/aidlc-state.md`; if it exists, READ it and RESUME
2. If it doesn't exist, decide brownfield vs greenfield, then start at the right phase (Phase 0 by default for modernization)
3. NEVER skip a `_decisions-*.md` before the corresponding spec doc
4. NEVER skip approval gates
5. ALWAYS put questions in decision files, never in chat

This workflow is the only workflow.
