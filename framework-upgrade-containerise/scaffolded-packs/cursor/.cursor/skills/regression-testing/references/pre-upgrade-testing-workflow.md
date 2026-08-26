# Pre-Upgrade Regression Testing — Staged Workflow

This reference drives a focused, decision-gated procedure for one goal: implement comprehensive tests on
an existing codebase **before** a major upgrade, so those tests become the regression safety net that
validates the upgrade. It complements the tier strategy in the parent `regression-testing` skill and runs
inside the pack's AI-DLC workflow (it does not replace it) — reuse the same `aidlc-docs/aidlc-state.md`
and `aidlc-docs/audit.md` for state and audit.

When the user's task is specifically "add a regression test suite before the upgrade", follow the seven
stages below in order, with an explicit user-approval gate at each completion gate. Track progress in the
existing state file and keep questions in dedicated `.md` files (multiple-choice with an `[Answer]:` tag
and an "Other" option), never in chat.

```
User Request
     |
     v
  PHASE 1: ANALYSIS
   1. Workspace Detection
   2. Reverse Engineering (incl. API documentation)
     |
     v
  PHASE 2: TEST PLANNING
   3. Testing Decisions
   4. Test Requirements
   5. Test Units Decomposition
     |
     v
  PHASE 3: TEST GENERATION
   6. Per-Unit Test Generation
   7. Build and Verify
```

## State & audit

Track stage progress in `aidlc-docs/aidlc-state.md` (resume from it if it exists). Append every raw user
input and every approval/decision to `aidlc-docs/audit.md` with ISO-8601 timestamps. Suggested stage
checklist:

```markdown
## Testing Stage Progress
- [ ] 1. Workspace Detection
- [ ] 2. Reverse Engineering (includes API Documentation)
- [ ] 3. Testing Decisions
- [ ] 4. Test Requirements
- [ ] 5. Test Units Decomposition
- [ ] 6. Per-Unit Test Generation
- [ ] 7. Build and Verify
```

---

# PHASE 1: ANALYSIS

## Stage 1: Workspace Detection

1. Scan the workspace for existing code.
2. Identify project type (this is always brownfield for testing).
3. Identify programming languages, frameworks, build tools.
4. Ensure `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md` exist.
5. Present findings and proceed to Reverse Engineering.

## Stage 2: Reverse Engineering (includes API Documentation)

Analyse the existing codebase to understand what needs testing. API documentation is generated as part of
this stage with contract-testing-ready detail — endpoint paths, methods, request/response bodies, status
codes, error responses, and data-model contracts. This feeds API contract test generation later.

**Load and follow** the pack's `reverse-engineering.md`. Output artifacts to `aidlc-docs/analysis/`
(business overview, architecture, code structure, technology stack, API documentation, component
inventory, dependencies).

**Completion gate:** present a summary and wait for explicit approval; update the state file.

---

# PHASE 2: TEST PLANNING

## Stage 3: Testing Decisions

Apply the tier strategy from the parent `regression-testing` skill (Tier 1: API contracts / E2E, Tier 2:
pure logic, Tier 3: integration) to inform every recommendation. Before generating any test requirements,
create a decision file so no assumptions are made about testing preferences.

1. Analyse the reverse-engineering artifacts to understand the codebase.
2. Generate context-appropriate questions covering areas where assumptions would be risky: test scope and
   priorities, approved test frameworks/libraries, coverage targets, existing test state, naming
   conventions, the planned upgrade path and what must survive it, and any codebase-specific concerns.
3. Use multiple-choice format with `[Answer]:` tags.
4. Annotate the recommended option per question with a brief rationale.
5. Only ask relevant questions (don't ask about frontend E2E for a backend-only repo, etc.).

Create `aidlc-docs/testing/testing-decisions.md`. **Completion gate:** wait for answers; validate
completeness and check for contradictions; update state.

## Stage 4: Test Requirements

Apply the tier prioritisation — Tier 1 (API contracts, E2E) first and marked required; Tier 2 (pure
logic) should-have; Tier 3 (integration) nice-to-have. Based on the reverse-engineering artifacts AND the
user's testing decisions, generate `aidlc-docs/testing/test-requirements.md` defining: context
(application summary, upgrade path, chosen frameworks, coverage target); for each testable area what to
test, which scenarios (happy path, edge cases, errors), and what to mock; frontend E2E requirements (if
applicable); and explicit test exclusions with rationale.

**Completion gate:** present a summary and wait for approval; update state.

## Stage 5: Test Units Decomposition

Break the test work into manageable units so each can be generated, tracked, and resumed independently
(this prevents token exhaustion on large codebases).

**Part 1 — Planning:** propose logical test units (grouped by domain/feature area); for each define scope
(classes/endpoints/flows), test types, and estimated test count; ask decomposition questions where the
answer isn't obvious. Create `aidlc-docs/testing/test-units-plan.md` with `[Answer]:` tags; wait for
answers and resolve contradictions.

**Part 2 — Generation:** produce `test-units.md` (execution order, per-unit scope/dependencies/files and
a status checkbox) and `test-units-dependency.md` (dependency matrix). Add a per-unit checkbox to the
state file.

**Completion gate:** present the unit breakdown and wait for approval; update state.

---

# PHASE 3: TEST GENERATION

## Stage 6: Per-Unit Test Generation

Follow the tier execution order from the parent skill — Tier 1 test units first (API contracts, E2E),
then Tier 2 (pure logic), then Tier 3 (integration) — so the highest-value tests exist even if a session
is interrupted. Execute one unit at a time; each unit follows its own plan → generate → checkpoint cycle.

Generate the appropriate test types for whatever is present: backend → business-logic unit tests and API
contract tests using the approved frameworks; frontend → framework-agnostic E2E browser tests (do NOT
generate framework-specific component tests if a frontend framework migration is planned). Test code goes
in the project's existing test directories, following established conventions — never in `aidlc-docs/`.

**Per-unit cycle:**
1. Create `aidlc-docs/testing/plans/{unit-name}-test-plan.md` (scope + numbered steps with checkboxes); wait for approval.
2. Execute the unit plan; generate test code; mark each step `[x]` on completion; reference API docs and code-structure artifacts.
3. Unit checkpoint: present a summary of tests generated and coverage; wait for approval; mark the unit `[x]` in `test-units.md` and update the state file.
4. Move to the next unit in execution order.

On resume: read the state file for the current unit, `test-units.md` for completed units, and the current
unit's plan for the next incomplete step.

## Stage 7: Build and Verify

Generate build/test execution instructions based on what exists in the repo, in `aidlc-docs/testing/`:

- **build-instructions.md** — how to build with the new test dependencies (prerequisites, install commands, environment setup, common-failure troubleshooting).
- **backend-test-instructions.md** (if backend) — how to run backend tests (commands, expected count/results, coverage report location, troubleshooting).
- **e2e-test-instructions.md** (if frontend) — how to run E2E tests (prerequisites like a running backend, browser requirements, commands, expected results).
- **test-summary.md** — total test count per unit, test-type breakdown, coverage targets, green-baseline status.
- **coverage-report.md** — coverage using an appropriate tool (JaCoCo for Java/Gradle, Istanbul/nyc for Node.js, coverage.py for Python): overall line/branch/method/class percentages; per-class breakdown; explanation of intentionally low-coverage areas; regeneration instructions; HTML report location. **Recommended:** configure and run a coverage tool as part of this stage (add the plugin during Stage 6, Unit 1).
- **post-upgrade-verification.md** — how to run the same tests after the upgrade, with guidance on triaging failures (real regression vs expected change), tailored to the identified upgrade path.

**Completion gate:** present a final summary (total tests generated, instruction-file locations, next
steps: establish green baseline → do the upgrade → run tests again to verify); update state.

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

Test code goes in source directories. Only documentation goes in `aidlc-docs/`.

## Key Principles

- **Testing focus only** — no feature design, no infrastructure, no user stories.
- **Decision-driven** — the user makes explicit choices before any generation.
- **Upgrade-aware** — tests are designed to survive the planned upgrade.
- **Trackable** — state file and audit log enable session continuity.
- **Per-unit generation** — large codebases are decomposed into manageable units.
- **Approval gates** — every stage requires explicit user approval before proceeding.
- **Questions in files** — never ask questions in chat; always in dedicated `.md` files.
