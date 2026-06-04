---
inclusion: always
---

# AI-DLC Testing Workflow — Pre-Upgrade Regression Testing

## 🚨🚨🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING 🚨🚨🚨

**THIS WORKFLOW OVERRIDES ALL OTHER BEHAVIORS.** When the user asks about
testing, regression testing, pre-upgrade testing, or creating tests for a
Java upgrade, you MUST follow THIS workflow — not the spec creation workflow,
not the feature-requirements-first workflow, not any subagent delegation.

**FORBIDDEN ACTIONS until this workflow is complete:**
- DO NOT create `.kiro/specs/` directories or files
- DO NOT invoke `feature-requirements-first-workflow` subagent
- DO NOT invoke `spec-task-execution` subagent
- DO NOT create `requirements.md`, `design.md`, or `tasks.md` spec files
- DO NOT delegate to any subagent for spec creation
- DO NOT skip ahead to code generation or test writing

**MANDATORY FIRST ACTIONS (in this exact order):**
1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, resume from where we left off
2. If no state file exists, start at Stage 1: Workspace Detection
3. Create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md` FIRST
4. Follow the 7-stage workflow below sequentially, with user approval gates

**IF YOU FEEL THE URGE TO CREATE A SPEC:** Stop. Re-read this section.
Follow the AI-DLC workflow instead. The user explicitly chose this workflow.

---

This steering file drives a streamlined AI-DLC workflow focused on one goal: implement comprehensive tests on an existing codebase BEFORE a major upgrade, so those tests become the regression safety net that validates the upgrade.

---
🛑 MANDATORY WORKFLOW ENFORCEMENT
You MUST complete these steps IN ORDER:

```
User Request
     |
     v
╔══════════════════════════════════════╗
║  PHASE 1: ANALYSIS                  ║
║  Understand the existing codebase   ║
╠══════════════════════════════════════╣
║ 1. Workspace Detection              ║
║ 2. Reverse Engineering (incl. API)  ║
╚══════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════╗
║  PHASE 2: TEST PLANNING             ║
║  Decide what and how to test        ║
╠══════════════════════════════════════╣
║ 3. Testing Decisions                ║
║ 4. Test Requirements                ║
║ 5. Test Units Decomposition         ║
╚══════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════╗
║  PHASE 3: TEST GENERATION           ║
║  Generate and validate tests        ║
╠══════════════════════════════════════╣
║ 6. Per-Unit Test Generation         ║
║ 7. Build and Verify                 ║
╚══════════════════════════════════════╝
     |
     v
  Complete
```

All 7 stages always execute. Each stage requires explicit user approval
before proceeding to the next.


---

## MANDATORY: State Tracking

All progress is tracked in `aidlc-docs/aidlc-state.md` for session continuity.
If this file exists when starting, resume from where we left off.

Create `aidlc-docs/aidlc-state.md` at workflow start:

```markdown
# AI-DLC Testing Workflow State

## Project Info
- **Project Type**: Pre-Upgrade Regression Testing
- **Repo Type**: [Backend / Frontend / Full-stack]
- **Current Stack**: [e.g., Java 8, Spring MVC, Angular, etc.]
- **Target Stack**: [e.g., Java 21, Spring Boot 3, React, etc.]

## Stage Progress
- [ ] 1. Workspace Detection
- [ ] 2. Reverse Engineering (includes API Documentation)
- [ ] 3. Testing Decisions
- [ ] 4. Test Requirements
- [ ] 5. Test Units Decomposition
- [ ] 6. Per-Unit Test Generation
- [ ] 7. Build and Verify

## Per-Unit Progress
[Populated during Stage 5, tracked during Stage 6]

## Current Status
**Stage**: [current stage name]
**Status**: [In Progress / Awaiting Approval / Complete]
**Last Updated**: [ISO timestamp]
```

### Checkpoint Rules
- Update `aidlc-state.md` immediately after completing each stage
- Mark checkboxes [x] in the SAME interaction where work is completed
- Log current status so a new session can resume

---

## MANDATORY: Audit Logging

Maintain `aidlc-docs/audit.md` to track all interactions.

- ALWAYS append to audit.md, NEVER overwrite
- Log every user input with complete raw text
- Log every approval/decision with timestamp
- Use ISO 8601 timestamps

Format:

```markdown
## [Stage Name]
**Timestamp**: [ISO timestamp]
**User Input**: "[complete raw input]"
**AI Response**: "[action taken]"
**Context**: [stage and decision]

---
```

---

## MANDATORY: Question Format

All questions to the user MUST be placed in dedicated `.md` files, never in chat.

- Use multiple choice format (A, B, C, D...)
- ALWAYS include "Other" as the last option
- Use `[Answer]:` tags for responses
- Validate all answers before proceeding
- Check for contradictions between answers
- Create clarification questions if contradictions found

---

## MANDATORY: Session Continuity

When detecting an existing `aidlc-docs/aidlc-state.md`:

1. Read the state file to determine current progress
2. Load all artifacts from completed stages
3. Present resumption message showing last completed stage and next step
4. Resume from the next incomplete stage


---

# PHASE 1: ANALYSIS

## Stage 1: Workspace Detection

1. Scan workspace for existing code
2. Identify project type (this is always brownfield for testing)
3. Identify programming languages, frameworks, build tools
4. Create `aidlc-docs/aidlc-state.md` with initial project info
5. Create `aidlc-docs/audit.md` with initial entry
6. Present findings and automatically proceed to Reverse Engineering

---

## Stage 2: Reverse Engineering (includes API Documentation)

Analyze the existing codebase to understand what needs testing.
API documentation is generated as part of this stage (Step 4 in
reverse-engineering.md) with contract-testing-ready detail — endpoint
paths, methods, request/response bodies, status codes, error responses,
and data model contracts. This feeds directly into API contract test
generation later.

**MANDATORY**: Load and follow all steps from
`.kiro/steering/reverse-engineering.md`

This will generate comprehensive artifacts in `aidlc-docs/analysis/`
including business overview, architecture, code structure, technology stack,
API documentation (contract-testing ready), component inventory, and
dependencies.

Output artifacts go to `aidlc-docs/analysis/reverse-engineering`.

### Completion Gate
Present summary and wait for explicit approval before proceeding.
Update `aidlc-state.md` after approval.

---

# PHASE 2: TEST PLANNING

## Stage 3: Testing Decisions

**MANDATORY**: Load and follow the test prioritization strategy from
`.kiro/steering/regression-testing-strategy.md`. Use the tier system
(Tier 1: API contracts / E2E, Tier 2: pure logic, Tier 3: integration)
to inform recommendations on every question.

Before generating any test requirements, create a decision file for the user.
This ensures we don't make assumptions about their testing preferences.

1. Analyze the reverse engineering artifacts (architecture, code structure,
   technology stack, API documentation) to understand the codebase
2. Generate context-appropriate questions based on what was found — cover
   areas where assumptions would be risky:
   - Test scope and priorities (informed by codebase complexity)
   - Approved test frameworks and libraries (informed by existing tech stack)
   - Coverage targets (informed by codebase size)
   - Existing test state (informed by code structure scan)
   - Naming conventions and standards
   - The planned upgrade path and what needs to survive it
   - Any codebase-specific concerns discovered during reverse engineering
3. Use multiple choice format with [Answer]: tags per the question format rules
4. For EVERY question, include a *(Kiro recommended)* annotation on the
   option you recommend, with a brief rationale. This helps the user make
   informed decisions quickly while still leaving the choice to them.
5. Only ask questions that are relevant — don't ask about frontend E2E if
   this is a backend-only repo, don't ask about Java frameworks if this is
   a frontend repo, etc.

Create `aidlc-docs/testing/testing-decisions.md` with the generated questions.

### Completion Gate
Wait for user to fill in all answers. Validate completeness and check for
contradictions. Create clarification questions if needed. Update state after
decisions are confirmed.

---

## Stage 4: Test Requirements

**MANDATORY**: Apply the tier prioritization from
`.kiro/steering/regression-testing-strategy.md` when structuring
requirements. Tier 1 tests (API contracts, E2E) should be listed first
and marked as required. Tier 2 (pure logic) as should-have. Tier 3
(integration) as nice-to-have.

Based on reverse engineering artifacts AND user's testing decisions,
generate `aidlc-docs/testing/test-requirements.md`.

This document should define:
- Context (application summary, upgrade path, chosen frameworks, coverage target)
- For each testable area identified during reverse engineering: what to test,
  which scenarios to cover (happy path, edge cases, errors), and what to mock
- Frontend E2E test requirements (if applicable): user flows, expected outcomes,
  error scenarios
- Explicit test exclusions and rationale

The content and structure should be driven by what was discovered in the
codebase, not a fixed template.

### Completion Gate
Present summary and wait for approval. Update state.

---

## Stage 5: Test Units Decomposition

Break the test work into manageable units so each can be generated, tracked,
and resumed independently. This prevents token exhaustion on large codebases.

### Part 1: Planning

1. Based on the codebase structure (from reverse engineering) and test
   requirements, propose logical test units — group by domain area,
   feature area, or whatever makes sense for this specific codebase
2. For each proposed unit, define: scope (classes/endpoints/flows covered),
   test types, and estimated test count
3. Generate context-appropriate questions about the decomposition —
   ask about grouping preferences, priority order, and any codebase-specific
   concerns that affect how to split the work
4. Only ask questions where the answer isn't obvious from the codebase analysis

Create `aidlc-docs/testing/test-units-plan.md` with the proposed units
and questions using [Answer]: tags.

Wait for answers. Validate and resolve contradictions.

### Part 2: Generation

Based on approved plan, generate:

**test-units.md** — execution order, unit details (scope, dependencies,
test files to generate, status checkbox per unit)

**test-units-dependency.md** — dependency matrix showing which units
depend on others and why

Update the Per-Unit Progress section in `aidlc-state.md` with a checkbox
for each unit.

### Completion Gate
Present unit breakdown and wait for approval. Update state.


---

# PHASE 3: TEST GENERATION

## Stage 6: Per-Unit Test Generation

**MANDATORY**: Follow the tier execution order from
`.kiro/steering/regression-testing-strategy.md` — generate Tier 1 test
units first (API contracts, E2E), then Tier 2 (pure logic), then Tier 3
(integration). This ensures the highest-value tests exist even if the
session is interrupted.

Execute test generation one unit at a time. Each unit follows its own
plan → generate → checkpoint cycle. If tokens run out mid-unit, the
state file and unit plan tell the next session exactly where to resume.

The types of tests generated depend on what was found during workspace
detection and reverse engineering. A repo may contain backend code,
frontend code, or both. Generate the appropriate test types for whatever
is present:

- For backend code: business logic unit tests and API contract tests
  using the approved frameworks from Testing Decisions
- For frontend code: E2E browser-based tests using the approved framework
  from Testing Decisions. Do NOT generate framework-specific component
  tests (e.g., Angular unit tests) if a frontend framework migration is
  planned — these will be thrown away. Focus on framework-agnostic
  browser-based tests only.

Test code goes in the project's existing test directories. Follow the
conventions already established in the codebase.

### Per-Unit Cycle:

**Step 1: Create Unit Test Plan**

Create `aidlc-docs/testing/plans/{unit-name}-test-plan.md` with:
- Scope (what this unit covers)
- Numbered steps with checkboxes for each test file/group to generate

Wait for user approval of the unit plan.

**Step 2: Execute Unit Plan**

- Generate test code in source directories (NEVER in aidlc-docs/)
- Mark each step [x] immediately after completion
- Follow test standards from the user's decisions
- Reference API documentation and code structure artifacts

**Step 3: Unit Checkpoint**

After completing all steps in the unit:
- Present summary of tests generated and coverage
- Wait for approval or change requests
- Update `test-units.md` to mark unit as [x] complete
- Update `aidlc-state.md` with current unit progress

**Step 4: Repeat**

Move to the next unit in the execution order. Repeat Steps 1-3.

### Session Continuity for Per-Unit Generation

When resuming a session during test generation:
1. Read `aidlc-state.md` to find current unit
2. Read `test-units.md` to see which units are complete
3. Read the current unit's plan to find the next incomplete step
4. Resume from that step

---

## Stage 7: Build and Verify

Generate build and test execution instructions based on what exists in
the repo. Create separate instruction files in `aidlc-docs/testing/`
for each applicable area:

**build-instructions.md** — how to build the project with the new test
dependencies (prerequisites, install commands, environment setup,
troubleshooting for common build failures)

**backend-test-instructions.md** (if backend code exists) — how to run
backend tests (commands, expected test count, expected results, coverage
report location, troubleshooting for common test failures)

**e2e-test-instructions.md** (if frontend code exists) — how to run E2E
tests (prerequisites like running backend, browser requirements, commands,
expected results)

**test-summary.md** — total test count per unit, test types breakdown,
coverage targets, green baseline status

**coverage-report.md** — code coverage report generated using an
appropriate coverage tool for the project's language/build system (e.g.,
JaCoCo for Java/Gradle, Istanbul/nyc for Node.js, coverage.py for Python).
Include:
- Overall line, branch, method, and class coverage percentages
- Per-class/per-file line coverage breakdown
- Explanation of intentionally low-coverage areas (e.g., mocked data
  access layers, excluded infrastructure classes) vs areas that should
  be improved
- Instructions for regenerating the coverage report
- Location of the HTML coverage report for visual browsing

**RECOMMENDED**: Always configure and run a coverage tool as part of
Stage 7. Coverage reports provide concrete evidence of test effectiveness
and help identify gaps. Add the coverage tool plugin to the build
configuration during test generation (Stage 6, Unit 1) so it's available
for the final report.

**post-upgrade-verification.md** — instructions for running the same
tests after the planned upgrade. Include guidance on triaging failures
(real regression vs expected change from the upgrade). Tailor the guidance
to the specific upgrade path identified during Testing Decisions.

### Completion Gate

Present final completion message summarizing:
- Total tests generated across all units
- Location of all instruction files
- Next steps: run tests to establish green baseline, do the upgrade,
  run tests again to verify

Update state. Mark workflow complete.

---

## Directory Structure

```
<WORKSPACE-ROOT>/
├── [existing project files]
├── [generated test files in source directories]
│
├── aidlc-docs/
│   ├── analysis/
│   │   ├── business-overview.md
│   │   ├── architecture.md
│   │   ├── code-structure.md
│   │   ├── technology-stack.md
│   │   └── api-documentation.md
│   ├── testing/
│   │   ├── testing-decisions.md
│   │   ├── test-requirements.md
│   │   ├── test-units-plan.md
│   │   ├── test-units.md
│   │   ├── test-units-dependency.md
│   │   ├── plans/
│   │   │   └── {unit-name}-test-plan.md
│   │   ├── build-instructions.md
│   │   ├── backend-test-instructions.md  (if backend)
│   │   ├── e2e-test-instructions.md      (if frontend)
│   │   ├── test-summary.md
│   │   ├── coverage-report.md
│   │   └── post-upgrade-verification.md
│   ├── aidlc-state.md
│   └── audit.md
```

Test code goes in source directories. Only documentation goes in aidlc-docs/.

---

## Key Principles

- **Testing focus only** — no feature design, no infrastructure, no user stories
- **Decision-driven** — user makes explicit choices before any generation
- **Upgrade-aware** — tests are designed to survive the planned upgrade
- **Trackable** — state file and audit log enable session continuity
- **Per-unit generation** — large codebases are decomposed into manageable units
- **Approval gates** — every stage requires explicit user approval before proceeding
- **Questions in files** — never ask questions in chat, always in dedicated .md files

---

## 🚨 FINAL REMINDER: WORKFLOW ENFORCEMENT

**Every time you start a new interaction or resume a session:**

1. CHECK for `aidlc-docs/aidlc-state.md` first
2. If it exists, READ it and RESUME from the current stage
3. If it doesn't exist, START at Stage 1
4. NEVER skip stages, NEVER create specs, NEVER delegate to spec subagents
5. ALWAYS follow the 7-stage sequential workflow above
6. ALWAYS wait for user approval at each completion gate

**This workflow is the ONLY workflow. There is no alternative path.**
