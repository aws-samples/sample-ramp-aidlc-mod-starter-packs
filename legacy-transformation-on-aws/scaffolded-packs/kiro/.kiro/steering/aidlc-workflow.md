---
inclusion: always
---
# Legacy Transformation on AWS Modernization Workflow

## 🚨🚨🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING 🚨🚨🚨

**THIS WORKFLOW OVERRIDES ALL OTHER BEHAVIORS.** When the user asks about
modernization, decomposition, microservices extraction, strangler fig,
or legacy transformation, you MUST follow THIS workflow.

**FORBIDDEN ACTIONS until this workflow is complete:**
- DO NOT skip the reverse engineering phase
- DO NOT extract microservices without completing decomposition decisions
- DO NOT make architectural decisions without user approval
- DO NOT skip ahead to code generation

**MANDATORY FIRST ACTIONS (in this exact order):**
1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, resume from where we left off
2. If no state file exists, start at Stage 1: Workspace Detection
3. Create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md` FIRST
4. Follow the workflow below sequentially, with user approval gates

---

## Workflow Overview

```
User Request
     |
     v
╔══════════════════════════════════════╗
║  STAGE 1: Workspace Detection       ║
║  Scan monolith, identify stack      ║
╚══════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════╗
║  STAGE 2: Reverse Engineering       ║
║  Analyze code → aidlc-docs/analysis ║
╚══════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════════════════════════╗
║  STAGE 3: Decomposition Plan                            ║
║                                                          ║
║  _decisions-requirements.md → requirements.md            ║
║  _decisions-design.md → design.md                        ║
║  _decisions-tasks.md → tasks.md                          ║
║                                                          ║
║  Tasks organized by section:                             ║
║    Planning │ Service A │ Service B │ ... │ Verification  ║
╚══════════════════════════════════════════════════════════╝
     |
     v
  Complete
```

**Total: 1 spec, 6 files, 6 approval gates.**

---

## Spec File Structure

The workflow uses a single specification directory (e.g., `decomposition-plan/`) that covers the entire modernization: planning, per-service extraction, and integration verification.

```
decomposition-plan/
├── _decisions-requirements.md   # Decision gathering before requirements
├── requirements.md              # WHAT: Scope, bounded contexts, constraints
├── _decisions-design.md         # Decision gathering before design
├── design.md                    # HOW: Target architecture, per-service design
├── _decisions-tasks.md          # Decision gathering before tasks
└── tasks.md                     # DO: All tasks — planning, extraction, verification
```

### Decision-Driven Spec Workflow

Work through three phases sequentially. Each phase has a decision-gathering step followed by document generation:

**Phase 1 — Requirements:**
1. Generate `_decisions-requirements.md` with recommended options
2. Wait for user to fill in decisions
3. Read completed decisions → generate `requirements.md`
4. Wait for user approval of requirements

**Phase 2 — Design:**
1. Generate `_decisions-design.md` with recommended options
2. Wait for user to fill in decisions
3. Read completed decisions → generate `design.md`
4. Wait for user approval of design

**Phase 3 — Tasks:**
1. Generate `_decisions-tasks.md` with recommended options
2. Wait for user to fill in decisions
3. Read completed decisions → generate `tasks.md`
4. Wait for user approval of tasks, then begin execution

**🔒 ABSOLUTE RULE**: NEVER generate requirements.md, design.md, or tasks.md without first creating and completing the corresponding `_decisions-*.md` file.

**Exception**: Skip decision file ONLY if user explicitly says "skip the decision file" or "no decisions needed"

---

## Core Principles

### 🌐 LANGUAGE MATCHING
Generate decision files and spec documents in the same language as user's input prompt.

### 💬 NATURAL MESSAGING
**NEVER say**: "According to the rules...", "The steering file indicates...", "Per the guidelines..."

**DO say**:
- "To ensure we decompose this correctly, let's clarify some key decisions..."
- "Before extracting this service, I'd like to understand your preferences..."
- "Let's align on the migration strategy before we start cutting code..."
- "I've prepared some key decisions to ensure we build exactly what you need"

### 🔒 DECISION ISOLATION
Each decision file is independent:
- Requirements decisions apply ONLY to `_decisions-requirements.md`
- Design decisions apply ONLY to `_decisions-design.md`
- Tasks decisions apply ONLY to `_decisions-tasks.md`
- **NEVER carry over** user preferences between phases without explicit confirmation
- Each phase requires NEW explicit user input

---

## MANDATORY: State Tracking

All progress is tracked in `aidlc-docs/aidlc-state.md` for session continuity.
If this file exists when starting, resume from where we left off.

Create `aidlc-docs/aidlc-state.md` at workflow start:

```markdown
# AI-DLC Modernization Workflow State

## Project Info
- **Project Type**: Legacy Transformation on AWS (e.g., Monolith-to-Microservices)
- **Monolith Stack**: [e.g., Java 17, Spring Boot 3.x, JPA/Hibernate, H2/Oracle]
- **Target Architecture**: [e.g., Serverless microservices on AWS]
- **Migration Pattern**: [e.g., Strangler Fig]

## Stage Progress
- [ ] 1. Workspace Detection
- [ ] 2. Reverse Engineering
- [ ] 3. Decomposition Plan Spec
  - [ ] 3a. _decisions-requirements.md created
  - [ ] 3b. _decisions-requirements.md completed by user
  - [ ] 3c. requirements.md generated and approved
  - [ ] 3d. _decisions-design.md created
  - [ ] 3e. _decisions-design.md completed by user
  - [ ] 3f. design.md generated and approved
  - [ ] 3g. _decisions-tasks.md created
  - [ ] 3h. _decisions-tasks.md completed by user
  - [ ] 3i. tasks.md generated and approved
  - [ ] 3j. Task execution in progress

## Task Execution Progress
[Track which task sections have been completed]
- [ ] Planning tasks
- [ ] Service: [name] extraction
- [ ] Service: [name] extraction
- [ ] Integration & Verification

## Current Status
**Stage**: [current stage name]
**Spec Phase**: [current phase]
**Status**: [In Progress / Awaiting Approval / Complete]
**Last Updated**: [ISO timestamp]
```

### Checkpoint Rules
- Update `aidlc-state.md` immediately after completing each stage and each spec phase
- Mark checkboxes [x] in the SAME interaction where work is completed
- Log current status so a new session can resume

---

## MANDATORY: Audit Logging

Maintain `aidlc-docs/audit.md` to track all interactions and architectural decisions.

- ALWAYS append to audit.md, NEVER overwrite
- Log every user input with complete raw text
- Log every approval/decision with timestamp
- Log every architectural decision with rationale

Format:

```markdown
## [Stage Name] — [Phase]
**Timestamp**: [ISO timestamp]
**User Input**: "[complete raw input]"
**AI Response**: "[action taken]"
**Decision**: [architectural decision made and rationale]

---
```

---

## MANDATORY: Decision File Format

All decision files follow this structure:

```markdown
# Decisions: [Phase Name]

> **Instructions:** Review each decision point below. recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## [Decision Category]

### [Specific Decision Point]

**Question:** [Clear question to be answered]

**Options:**
1. [Option 1 - Recommended]: [Description with rationale]
2. [Option 2]: [Description]
3. [Option 3]: [Description]
4. Other (please specify): _______________________

**Answer:**

---
```

**Rules:**
- Provide 3-4 concrete options per decision point
- Mark one option as "Recommended" with rationale
- Explain WHY each decision matters and its impact on the modernization
- For design/tasks phases: reference previous phase decisions
- Customize decision points to the specific monolith being decomposed
- Handle partial responses: acknowledge completed items, prompt for remaining
- If no response: ask if user wants recommendations as defaults
- Validate all critical decisions have user input before generating the document

---

## MANDATORY: Session Continuity

When detecting an existing `aidlc-docs/aidlc-state.md`:

1. Read the state file to determine current progress
2. Check which phase the spec is in
3. Load all artifacts from completed stages
4. Present resumption message showing last completed phase and next step
5. Resume from the next incomplete phase

---

# STAGE 1: Workspace Detection

1. Scan workspace for existing monolith code
2. Identify programming languages, frameworks, build tools, databases
3. Identify deployment model (WAR/JAR, container, EC2, etc.)
4. Create `aidlc-docs/aidlc-state.md` with initial project info
5. Create `aidlc-docs/audit.md` with initial entry
6. Present findings and automatically proceed to Reverse Engineering

---

# STAGE 2: Reverse Engineering

Analyze the existing monolith to understand what needs to be decomposed.

**MANDATORY**: Load and follow all steps from the reverse-engineering guidance

This generates comprehensive artifacts in `aidlc-docs/analysis/` including business overview, architecture, code structure, technology stack, API documentation, component inventory, dependencies, **bounded context analysis**, and **coupling assessment**.

### Completion Gate
Present summary and wait for explicit approval before proceeding.
Update `aidlc-state.md` after approval.

---

# STAGE 3: Decomposition Plan Spec

**Single specification directory** covering the entire modernization: decomposition decisions, target architecture, per-service extraction, and integration verification.

---

## Requirements Phase

### `_decisions-requirements.md`

Generate decision file covering WHAT the modernization should achieve. Decision categories specific to monolith decomposition:

**Scope & Strategy:**
- Migration strategy: Strangler Fig vs Big Bang vs Parallel Run
- Modernization scope: which bounded contexts to extract (all vs subset)
- Coexistence period: how long monolith and microservices run side-by-side
- Migration order priority: lowest coupling first vs highest business value first

**Per-Service Business Requirements:**
- For each identified bounded context: include/exclude from extraction?
- Non-functional requirements per service (latency, throughput, availability targets)
- API versioning strategy across services
- Data ownership: which service owns which tables/entities

**Constraints:**
- Timeline and team constraints
- Existing infrastructure constraints (VPC, networking, accounts)
- Compliance or regulatory requirements affecting decomposition
- Budget constraints for new infrastructure

### `requirements.md`

After user fills in decisions, generate requirements covering:
- User stories for the overall modernization
- Per-service scope: which controllers, services, repos, entities belong to each microservice
- Acceptance criteria for each service extraction being "done"
- Cross-cutting requirements: auth, observability, error handling consistency
- Non-functional requirements per service
- Data ownership map (monolith table → owning service)

### Approval Gate
Wait for user approval of requirements before proceeding to design phase.

---

## Design Phase

### `_decisions-design.md`

Generate decision file covering HOW to build the target architecture. Decision categories:

**Compute & Runtime:**
- Compute per service: Lambda vs ECS Fargate vs App Runner
- Runtime/language version: upgrade during extraction or keep current
- Framework approach: Spring Boot on Lambda (Web Adapter) vs native Lambda handlers
- Container vs serverless per service

**API & Communication:**
- API layer: API Gateway REST API vs HTTP API
- Strangler fig routing: per-endpoint vs per-bounded-context cutover
- Inter-service communication: sync (REST/gRPC) vs async (EventBridge/SQS)
- API Gateway auth: Lambda authorizer vs JWT authorizer vs Cognito

**Data Architecture:**
- Database decomposition: shared DB vs database-per-service
- Target data stores per service: keep RDS vs migrate to DynamoDB/Aurora
- Data sync during migration: CDC, dual-write, or event-driven replication
- Schema migration approach per service

**Infrastructure & Operations:**
- IaC approach: SAM vs CDK vs CloudFormation
- CI/CD: per-service pipelines vs monorepo pipeline
- Observability: CloudWatch vs third-party, distributed tracing approach
- Deployment environment: single account vs multi-account, regions

### `design.md`

After user fills in decisions, generate the complete target architecture design:

- **Architecture overview**: full target architecture diagram (Mermaid) showing all services, data stores, API Gateway, auth
- **Before/after comparison**: Mermaid diagrams showing monolith vs target state
- **Strangler fig routing plan**: phases with route tables per phase (Mermaid)
- **Per-service architecture**: compute, runtime, API, data store, auth, internal diagram for each service
- **Data architecture**: migration map (monolith table → target service → target store → strategy), schema changes
- **Cross-cutting architecture**: auth flow, inter-service communication, observability, CI/CD pipeline design
- **Decision matrix**: summary table of choices per bounded context (compute, data store, communication pattern)
- **Risk assessment**: risks for chosen approaches with mitigations

**MANDATORY Mermaid diagrams:**
1. Full target architecture (all services, data stores, API Gateway, auth)
2. Strangler fig routing phases
3. Per-service internal architecture
4. Data migration flow

### Approval Gate
Wait for user approval of design before proceeding to tasks phase.

---

## Tasks Phase

### `_decisions-tasks.md`

Generate decision file covering execution strategy. Decision categories:

**Extraction Order & Approach:**
- Extraction order: confirm or adjust the recommended order from coupling assessment
- Parallel extraction tolerance: one service at a time vs multiple in parallel
- Rollback granularity: per-service rollback vs full rollback

**Testing Strategy:**
- Testing approach per service: unit + integration + contract + e2e, or subset
- Contract testing between services: Pact vs manual vs skip
- Performance testing: load test each service or defer

**Deployment Strategy:**
- Deployment approach: automated CI/CD from day one vs manual initially
- Environment strategy: dev/staging/prod per service or shared environments
- Canary/blue-green deployment: per service or simple cutover

### `tasks.md`

After user fills in decisions, generate the complete task list organized by section. **Users can pick which tasks to execute.**

```markdown
# Tasks: Legacy Transformation on AWS

## Planning

- [ ] Finalize extraction order with rationale
- [ ] Define scope for each service extraction (controllers, services, repos, entities, tables)
- [ ] Generate extraction dependency matrix
- [ ] Define strangler fig routing changes per extraction phase
- [ ] Log all planning decisions in audit.md

## Service: [Service Name 1] (extract first)

- [ ] Create service project structure
- [ ] Extract and adapt domain models
- [ ] Extract and adapt service/business logic
- [ ] Create API layer (Lambda handlers or controllers)
- [ ] Set up data store (DynamoDB table / Aurora schema)
- [ ] Migrate data (if applicable)
- [ ] Create IaC (SAM/CDK template)
- [ ] Configure API Gateway route for strangler fig
- [ ] Add tests
- [ ] Deploy and smoke test

## Service: [Service Name 2] (extract second)

- [ ] Create service project structure
- [ ] Extract and adapt domain models
- [ ] ...
[repeat per service]

## Integration & Verification

- [ ] Generate end-to-end test plan covering cross-service workflows
- [ ] Generate deployment instructions for full architecture
- [ ] Generate rollback plan (per-service and full system)
- [ ] Generate modernization summary with before/after diagrams
- [ ] Final update to aidlc-state.md — mark workflow complete
```

**Task execution rules:**
- Generate code in the appropriate service directory
- Mark each task `[x]` immediately after completion
- Follow architectural decisions from the design phase
- Reference analysis artifacts from reverse engineering
- Update `aidlc-state.md` after completing each service section

### Approval Gate
Wait for user approval of tasks before beginning execution.

---

## Task Execution

After tasks.md is approved, the user selects which tasks to execute. For each task:

1. Execute the task (generate code, create IaC, configure routing, etc.)
2. Mark the task `[x]` in tasks.md
3. Update `aidlc-state.md` with progress

### Session Continuity During Execution

When resuming a session during task execution:
1. Read `aidlc-state.md` to find current progress
2. Read `tasks.md` to find the next incomplete task
3. Resume from that task

### Completion

When all tasks are marked complete:
- Present final summary: services extracted, architecture changes, artifact locations
- Mark workflow complete in `aidlc-state.md`
- Log completion in `audit.md`

---

## Directory Structure

```
<WORKSPACE-ROOT>/
├── [existing monolith code]
├── services/                              [extracted microservices]
│   ├── {service-name}/
│   └── ...
├── infrastructure/                        [shared IaC - API Gateway, etc.]
│
├── decomposition-plan/                    [THE single spec directory]
│   ├── _decisions-requirements.md
│   ├── requirements.md
│   ├── _decisions-design.md
│   ├── design.md
│   ├── _decisions-tasks.md
│   └── tasks.md
│
├── aidlc-docs/
│   ├── analysis/                          [reverse engineering artifacts]
│   │   ├── business-overview.md
│   │   ├── architecture.md
│   │   ├── code-structure.md
│   │   ├── technology-stack.md
│   │   ├── api-documentation.md
│   │   ├── component-inventory.md
│   │   ├── dependencies.md
│   │   ├── bounded-contexts.md
│   │   └── coupling-assessment.md
│   ├── aidlc-state.md                     [workflow state tracking]
│   └── audit.md                           [decision audit log]
```

---

## Key Principles

- **Single specification** — one spec directory covers the entire modernization lifecycle
- **Decision-driven** — every spec phase starts with a `_decisions-*.md` file; no document is generated without user decisions
- **Selective execution** — tasks.md is organized by section for phased implementation
- **Questions in decision files** — never ask questions in chat, always in `_decisions-*.md` files
- **Modernization focus** — decompose, extract, migrate, verify
- **Strangler fig aware** — monolith and microservices coexist during migration
- **Trackable** — state file, audit log, and spec task checkboxes enable session continuity
- **Approval gates** — user approves each decision file and each generated document before proceeding

---

## 🚨 FINAL REMINDER: WORKFLOW ENFORCEMENT

**Every time you start a new interaction or resume a session:**

1. CHECK for `aidlc-docs/aidlc-state.md` first
2. If it exists, READ it and RESUME from the current stage and spec phase
3. If it doesn't exist, START at Stage 1
4. NEVER skip stages, NEVER extract without decisions, NEVER skip approval gates
5. ALWAYS follow the 3-stage sequential workflow above
6. ALWAYS create `_decisions-*.md` before generating the corresponding document
7. ALWAYS wait for user decisions and approval at each phase boundary
8. ALWAYS put questions in `_decisions-*.md` files, never in chat

**This workflow is the ONLY workflow. There is no alternative path.**
