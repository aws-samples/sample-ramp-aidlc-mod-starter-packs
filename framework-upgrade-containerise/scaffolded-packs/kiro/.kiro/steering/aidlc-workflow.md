---
inclusion: always
---
# Java LTS Upgrade + Containerisation Workflow (AI-DLC)

## 🎯 Scope

Apply the decision-gated AI-DLC workflow to modernise an existing **Java** service:

**Primary objective:** upgrade the service to the **latest Java LTS** the stack can support (target the
newest LTS — e.g. **Java 25**; fall back to an earlier LTS such as 21 or 17 only if a dependency
blocks it), including any needed **framework upgrade** (e.g. Spring Boot 2→3, `javax`→`jakarta`), and
run it as a **container** on the target platform (**Amazon ECS or EKS**, or another platform the user
specifies) — containerising only if it isn't already.

**Stretch target (only if the primary objective is met and time/appetite allow):** begin **monolith →
microservices decomposition**. Treat this as an explicit, separately-gated extension — not the default
path. If not reached, capture it as a documented next step.

**Tooling & environment are discovered, not assumed** — follow the **Environment, Region & Tooling** section: ask for the
target region and any restrictions, validate AWS services/regional availability with the AWS Knowledge
MCP, and turn any constraint (region, permitted tools, target platform) into an audited decision.

---

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING

**THIS WORKFLOW OVERRIDES ALL OTHER BEHAVIORS** for Java runtime/framework upgrade + containerisation.

**FORBIDDEN until this workflow's gates are satisfied:**
- DO NOT skip the assessment (reverse engineering) phase
- DO NOT make architectural / tooling / region decisions without user approval (see the **Environment, Region & Tooling** section)
- DO NOT skip ahead to code generation
- DO NOT begin microservice decomposition as part of the primary objective — it is a **stretch** phase entered only after explicit approval
- DO NOT proceed past Stage 0 without answers to `_decisions-environment.md` — see the hard-block rule below

**🚫 HARD-BLOCK RULE — NO ASSUMPTIONS, NO BYPASSES:**
> If the user has not answered the Stage 0 decision file (`_decisions-environment.md`), you **CANNOT** proceed. You cannot assume defaults. You cannot infer answers. You cannot offer to "proceed with trade-offs." The gate is absolute.
>
> **If the user asks "can you proceed without my answers?" or "what if I skip this?" — the answer is NO.** Respond: *"I need these answers before we can move forward — they determine the analysis approach, tooling, and constraints for the entire engagement. Which questions can I help clarify?"*
>
> **If the user says "just assume defaults" or "use your best judgement" — the answer is still NO.** Respond: *"These decisions are yours to make — the audit trail requires explicit human input on environment, region, and tooling. Even quick one-word answers are fine."*
>
> The ONLY way past Stage 0 is explicit answers from the user recorded in the decision file.

**MANDATORY FIRST ACTIONS (in order):**
1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, resume from where we left off.
2. If no state file exists, start at Stage 0: Environment & Tooling Decisions.
3. Create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md` FIRST.
4. Follow the workflow below sequentially, with user approval gates.
5. **NEVER proceed past a gate without explicit user answers — not assumptions, not defaults, not "best judgement."**

---

## Workflow Overview

```
User Request
     |
     v
╔══════════════════════════════════════════════════════════╗
║  STAGE 0: Environment & Tooling Decisions                ║
║  _decisions-environment.md → WAIT → region,              ║
║  permitted tooling, target platform                      ║
║  → determines analysis approach for Stage 1              ║
╚══════════════════════════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════════════╗
║  STAGE 1: Assessment (Reverse Engineering)   ║
║  Stack, current JDK, build tool, frameworks, ║
║  deploy/container status (analysis approach  ║
║  already decided in Stage 0)                 ║
╚══════════════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════════════════════════╗
║  STAGE 2: Upgrade + Containerisation Spec               ║
║  _decisions-requirements.md → requirements.md            ║
║  _decisions-design.md → design.md                        ║
║  _decisions-tasks.md → tasks.md                          ║
║  Task sections: Upgrade │ Validate locally │ Containerise║
║                 │ Deploy │ Verify                        ║
╚══════════════════════════════════════════════════════════╝
     |
     v
  Primary objective complete
     |
     v (optional, separately gated)
╔══════════════════════════════════════════════╗
║  STAGE 3 (STRETCH): Decomposition            ║
║  Only after primary done + explicit approval ║
╚══════════════════════════════════════════════╝
```

**Total (primary): 1 spec, 7 files, 7 approval gates.** Stretch adds its own gated spec.

---

## Spec File Structure

One specification directory: `upgrade-containerisation/`.

```
upgrade-containerisation/
├── _decisions-requirements.md   # Decisions before requirements
├── requirements.md              # WHAT: upgrade targets, parity, NFRs, constraints
├── _decisions-design.md         # Decisions before design
├── design.md                    # HOW: target JDK/framework, container, compute, IaC, observability
├── _decisions-tasks.md          # Decisions before tasks
└── tasks.md                     # DO: upgrade → containerise → deploy → verify
```

### Decision-Driven Spec Workflow

Three phases, sequential. Each = a decision-gathering step, then document generation:

- **Phase 1 — Requirements:** `_decisions-requirements.md` → wait → `requirements.md` → wait for approval.
- **Phase 2 — Design:** `_decisions-design.md` → wait → `design.md` → wait for approval.
- **Phase 3 — Tasks:** `_decisions-tasks.md` → wait → `tasks.md` → wait for approval → execute.

**🔒 ABSOLUTE RULE:** NEVER generate requirements.md, design.md, or tasks.md without first creating and completing the corresponding `_decisions-*.md`.
**Exception:** skip a decision file ONLY if the user explicitly says "skip the decision file".

---

## Core Principles

### 🌐 LANGUAGE MATCHING
Generate decision files and spec documents in the same language as the user's input prompt.

### 💬 NATURAL MESSAGING
**NEVER say:** "According to the rules...", "The steering file indicates...".
**DO say:** "Before we pick the target JDK, let's align on a few decisions...".

### 🔒 DECISION ISOLATION
Each decision file is independent; never carry preferences between phases without explicit confirmation.

---

## MANDATORY: State Tracking

Track progress in `aidlc-docs/aidlc-state.md`. If it exists on start, resume. Create it at workflow start:

```markdown
# AI-DLC Upgrade + Containerisation State

## Project Info
- **Service**: [detected service name]
- **Current Stack**: [e.g., Java 8, Spring Boot 2.x, Maven, WAR on VM]
- **Target Runtime**: [e.g., latest Java LTS — Java 25]
- **Target Framework**: [e.g., Spring Boot 3.x / jakarta]
- **Already containerised?**: [yes/no]
- **Target Platform**: [ECS Fargate | EKS | other]
- **Target Region / restrictions**: [discovered via Stage 0 — Environment & Tooling Decisions]
- **IaC tool**: [Terraform | CloudFormation | other]
- **Decomposition (stretch)**: [not started | in progress]

## Stage Progress
- [ ] 0. Environment & Tooling Decisions (_decisions-environment.md → approved)
- [ ] 1. Assessment (Reverse Engineering)
- [ ] 2. Upgrade + Containerisation Spec
  - [ ] 2a–2c Requirements (decisions → requirements.md → approved)
  - [ ] 2d–2f Design (decisions → design.md → approved)
  - [ ] 2g–2i Tasks (decisions → tasks.md → approved)
  - [ ] 2j Task execution
- [ ] 3. (STRETCH) Decomposition — only if primary complete + approved

## Current Status
**Stage**: [current] · **Phase**: [current] · **Status**: [In Progress/Awaiting Approval/Complete] · **Updated**: [ISO timestamp]
```

Update `aidlc-state.md` immediately after each stage/phase; mark checkboxes in the same interaction.

---

## MANDATORY: Audit Logging

Append-only `aidlc-docs/audit.md`. Log every raw user input, every approval/decision (timestamp), and
every architectural / **environment / region / tooling** decision with rationale.

```markdown
## [Stage] — [Phase]
**Timestamp**: [ISO] · **User Input**: "[raw]" · **AI Response**: "[action]"
**Decision**: [decision + rationale]

---
```

---

## MANDATORY: Decision File Format

```markdown
# Decisions: [Phase Name]

> Review each decision point. Recommendations are provided. Fill in the "Answer" sections, then confirm.

## [Category]
### [Decision Point]
**Question:** [Clear question]
**Options:**
1. [Option 1 - Recommended]: [Description + rationale]
2. [Option 2]: [Description]
3. Other (specify): _______________________
**Answer:**

---
```

Rules: 3–4 concrete options; mark one "Recommended" with rationale; validate critical decisions are
answered before generating the document; questions go in decision files, never in chat.

**🚫 BYPASS PREVENTION:** A decision file is a HARD GATE. The workflow CANNOT advance past it until the user provides explicit answers. If the user asks to skip, asks "can you just proceed?", or says "assume defaults" — **refuse and re-present the unanswered questions.** You are not permitted to assume, infer, or default your way past a decision gate. The user must answer.

---

# STAGE 0: Environment & Tooling Decisions

**MANDATORY**: This is the VERY FIRST stage. Do NOT perform any code analysis yet.

## Actions

1. **Create `aidlc-docs/_decisions-environment.md`** as the very first action — before any code scanning or reverse engineering.

The decision file must contain the following questions (use the standard decision file format).

> **Keep it tight.** Only ask what directly affects the next workflow steps. VCS, CI/CD, and requirements tracking are discovered later (Design/Tasks phases) when they actually matter. Compliance is enforced as guardrails in subsequent phases (least-privilege IAM, encryption, secrets management) — not promised upfront.

```markdown
# Decisions: Environment & Tooling

> Review each decision point. Recommendations are provided. Fill in the "Answer" sections, then confirm.
> These decisions determine the analysis approach and target constraints — no code analysis begins until they are resolved.

## Target Region
### AWS Region & Restrictions
**Question:** Which AWS region should the workload run in? Are there any region restrictions (e.g. must stay in a single region, data-residency mandate)?
**Options:**
1. Specific region (specify): _______________________
2. Multiple regions (specify): _______________________
3. No preference — recommend based on service availability
**Answer:**

---

## Tooling Restrictions
### Analysis & Transformation Tooling
**Question:** Is **AWS Transform Custom** permitted for comprehensive automated code analysis and transformation? Are there any other tools that are explicitly prohibited?
**Options:**
1. AWS Transform Custom IS permitted - Recommended: Provides automated code analysis, dependency mapping, and transformation plans for Java upgrades
2. AWS Transform Custom is NOT permitted: Will use manual reverse engineering and language-native tooling (OpenRewrite, jdeps, jdeprscan) instead
3. Other restrictions (specify what is allowed/prohibited): _______________________
**Answer:**

---

## Target Platform
### Container Compute Target
**Question:** What is the target container platform? (This affects skill activation and IaC approach.)
**Options:**
1. Amazon ECS on Fargate - Recommended: Serverless containers, lowest operational overhead
2. Amazon ECS on EC2: Container orchestration with instance control
3. Amazon EKS: Kubernetes-native
4. Other (specify): _______________________
**Answer:**

---
```

2. **WAIT** for user answers before proceeding. Do not begin code analysis.

   **🚫 THIS IS A HARD BLOCK — NOT A SUGGESTION:**
   - You CANNOT proceed without explicit answers.
   - You CANNOT assume defaults, infer from context, or offer to "proceed with trade-offs."
   - If the user asks to skip, says "just go ahead," or asks if you can proceed without answers → **refuse politely and re-ask**.
   - The only exit from this wait state is the user providing answers to each decision category.
   - Unanswered questions remain open — re-present them until answered.

3. **After answers are received**, evaluate the tooling decision:
   - **If AWS Transform Custom IS permitted:** Record in the audit log. Recommend AWS Transform Custom as the primary analysis approach for Stage 1 — it provides comprehensive automated code analysis, dependency mapping, and transformation planning. Proceed to Stage 1 with the AWS Transform Custom analysis path.
   - **If AWS Transform Custom is NOT permitted:** Record in the audit log. Stage 1 will use the manual reverse engineering flow — language-native tooling (OpenRewrite recipes, jdeps, jdeprscan) and manual codebase analysis per the `reverse-engineering.md` instructions and the `java-upgrade` skill.

4. Log all environment decisions to `aidlc-docs/audit.md`.
5. Update `aidlc-state.md` — mark Stage 0 complete.

### Completion Gate — all environment questions answered; analysis approach for Stage 1 determined; update `aidlc-state.md`.

> **Gate validation:** Before marking Stage 0 complete, verify that EVERY decision category in `_decisions-environment.md` has an explicit user-provided answer. If any category is blank or answered only with AI-assumed defaults, the gate is NOT passed. Re-ask the unanswered questions.

---

# STAGE 1: Assessment (Reverse Engineering)

> **Pre-requisite:** Stage 0 (Environment & Tooling Decisions) must be complete. The analysis approach (AWS Transform Custom vs manual reverse engineering), target region, and target platform were already decided in Stage 0.

**MANDATORY**: load and follow `reverse-engineering.md` (upgrade-focused).

**Analysis approach** (decided in Stage 0):
- If **AWS Transform Custom** was permitted and chosen: use it for comprehensive code analysis, dependency mapping, and transformation planning. Supplement with manual inspection where needed.
- If **AWS Transform Custom** was NOT permitted: follow the manual reverse engineering flow — use language-native tooling (jdeps, jdeprscan, OpenRewrite discovery recipes) and manual codebase analysis.

Capture into `aidlc-docs/analysis/`:
1. Language/framework/build tool (Maven vs Gradle) and **current JDK target**.
2. Framework & library versions and their Java-LTS compatibility → recommended target LTS.
3. **Java-version risk surface** (removed `javax.*`/JAXB, JDK-internal encapsulation, Nashorn, TLS/serialization, GC/flags, Security Manager) — see the `java-upgrade` skill.
4. **Deployment & container status** (already containerised? deploy model?).
5. **Behaviour baseline** for the regression net (the `regression-testing` skill).

### Completion Gate — present the assessment; wait for approval; update `aidlc-state.md`.

---

# STAGE 2: Upgrade + Containerisation Spec

## Requirements Phase — `_decisions-requirements.md`
**Upgrade targets & scope:** target Java LTS (latest — e.g. 25 — vs earlier if constrained); framework upgrade scope; dependency policy (min compatible + clear known CVEs); functional-parity target. **Upgrade tooling gate:** is a **managed transformation service** (e.g. AWS Transform) permitted? If not, the upgrade follows the prescriptive language-native path (the `java-upgrade` skill (prescriptive language-native reference)). **Containerisation need:** already containerised? **Requirements source:** discovered tracker.
→ `requirements.md`: upgrade goals & target versions, parity acceptance criteria, NFRs, cutover constraints, compliance requirements. Approval gate.

## Design Phase — `_decisions-design.md`
**Runtime & framework:** confirm target JDK + base image; framework migration path.
**Compute target:** **ECS Fargate vs EKS vs other** — validate the choice's regional availability via AWS Knowledge MCP (see the **Environment, Region & Tooling** section).
**Container & config:** multi-stage build, non-root, config/secrets in a managed store.
**Local runtime validation (pre-containerisation gate):** how the upgraded app is run natively on the target JDK (build-tool run target / `java -jar`, local port), the health/readiness endpoint to probe, and the smoke/regression checks that must pass before containerisation begins.
**Infra & ops:** **IaC tool decision** (Terraform vs CloudFormation vs other permitted); observability; identity/least-privilege; **region** (respect discovered restrictions + fallback gate); CI/CD mapped to the discovered pipeline.
→ `design.md`: target-state architecture (Mermaid) for the containerised service; before/after; container/image design; config/secrets; IaC plan; observability & IAM; region/compliance notes; upgrade risk assessment. Approval gate.

## Tasks Phase — `_decisions-tasks.md` → `tasks.md`
Organised by section (users pick what to execute):

```markdown
# Tasks: Java LTS Upgrade + Containerisation

## Upgrade (runtime + framework)
> If a managed transformation service is permitted and chosen, use it. **Otherwise follow the prescriptive
> group-based sequence in the `java-upgrade` skill (prescriptive language-native reference)** — each group must build (and pass
> tests) before the next:
- [ ] Establish build baseline on the **source** JDK (before any change)
- [ ] Group 1 — Build-system readiness: build wrapper + compiler plugin + Lombok, then set target JDK; compile
- [ ] Group 2 — Jakarta migration (atomic): all `javax`→`jakarta` deps + imports + schemas together
- [ ] Group 3 — Database & ORM ecosystem (drivers + ORM + pooling + pagination) together
- [ ] Group 4 — Core dependencies (utilities; serialization/processing)
- [ ] Group 5 — Spring ecosystem: Spring Security config BEFORE Spring Boot upgrade; then Boot + deps
- [ ] Group 6 — Final integration: remaining JDK-compat fixes, deprecated APIs, full test suite
- [ ] Run jdeps / jdeprscan; resolve removed/deprecated API usage
- [ ] Confirm build + full test suite pass on the target JDK; log every group's outcome in audit.md

## Validate locally (native runtime — CHECKPOINT before containerising)
> A successful build is not proof the app **runs**. Before adding container packaging (another failure
> surface), run the upgraded app **natively on the target JDK** and prove it works at runtime — so
> genuine upgrade/runtime issues are surfaced and fixed here, isolated from container concerns.
- [ ] Run the upgraded app locally on the target JDK (e.g. `mvn spring-boot:run` / `gradle bootRun` / `java -jar target/<artifact>.jar`)
- [ ] Confirm clean startup — application context / DI initialises, no runtime errors or unexpected warnings in the startup logs
- [ ] Hit the health / readiness endpoint and exercise key runtime paths (DB connectivity, external integrations, auth, scheduled jobs)
- [ ] Run the regression net / smoke tests against the **locally running** app; confirm behaviour parity with the pre-upgrade baseline
- [ ] Resolve any runtime-only issues surfaced now (reflection, `javax`→`jakarta` runtime bindings, config/property binding, TLS/serialization, GC/flags)
- [ ] **🔒 GATE — do not containerise until this passes:** present the local run result; on approval, log the outcome in `aidlc-docs/audit.md` and update `aidlc-state.md`

## Containerise (only if not already containerised)
> Enter only after the **local runtime validation checkpoint** above has passed and been approved.
- [ ] Author multi-stage Dockerfile (JDK build → slim JRE), non-root user
- [ ] Externalise config/secrets to a managed store
- [ ] Build image; run the **container** locally; smoke test — confirm parity with the native local run from the checkpoint above

## Deploy (chosen platform + region)
- [ ] Author IaC with the chosen tool; validate service availability in the target region (AWS Knowledge MCP)
- [ ] Define compute/service, roles (least-privilege), networking, logging
- [ ] Deploy to the target region; smoke test behind the load balancer

## Verify
- [ ] Prove behaviour parity vs the pre-upgrade baseline (regression net)
- [ ] Wire tests into the discovered CI/CD pipeline; ensure it is green
- [ ] Raise the change as a PR/MR on the discovered VCS; link to the requirement/tracker item
- [ ] Final update to aidlc-state.md — primary objective complete

## (Stretch) Decomposition — only if primary complete + explicitly approved
- [ ] Note candidate service seams observed during the upgrade
- [ ] If approved & time allows: start the separately-gated decomposition spec
```

Approval gate before execution. For each task: execute → mark `[x]` → update `aidlc-state.md`.

---

# STAGE 3 (STRETCH): Decomposition

**Only enter after the primary objective is complete AND the user explicitly approves.** Then run a
separate decision-gated spec (bounded contexts → target architecture → extraction order → strangler-fig
routing). If not reached, leave a short "Decomposition — future next steps" note (candidate seams,
coupling observations) as guidance, not implementation.

---

# Environment, Region & Tooling — Discovery & Decision Gates

> **Critical decisions are asked in Stage 0** via `aidlc-docs/_decisions-environment.md` — the very first action in the workflow (region, permitted tooling, target platform). Do not assume these. VCS, CI/CD, and requirements tracking are discovered later in the Design/Tasks phases when they become directly relevant. Validate AWS choices against reality with the **AWS Knowledge MCP**. Every choice is logged to `aidlc-docs/audit.md`.

This section defines the validation and fallback logic used after Stage 0 answers are received, and revisited whenever a design choice depends on a service, region, or tool.

## 1. Discover the environment (Stage 0 — `_decisions-environment.md`)

The following are captured in Stage 0's decision file (`aidlc-docs/_decisions-environment.md`):

- **Target region.** Which AWS **region(s)** should the workload run in? Any **data-residency or region restrictions**?
- **Tooling restrictions.** Are there any **prohibited** tools or managed services (e.g. AWS Transform Custom is or isn't permitted)?
- **Target platform.** What container compute target (ECS Fargate / ECS EC2 / EKS / other)?

The following are discovered **later** (Design/Tasks phases) when they become directly relevant:
- **Version control.** Which VCS/host and change-submission unit (PR vs MR) — asked in the Tasks phase when raising the change.
- **CI/CD.** Which pipeline system — asked in the Tasks phase when wiring tests and deployments.
- **Requirements & tracking.** Where work items live — asked when linking deliverables.

**Compliance & governance** are not asked upfront (asking implies a compliance guarantee we cannot make). Instead, security best practices are enforced as guardrails throughout: least-privilege IAM, encryption in transit/at rest, secrets in managed stores, non-root containers. If specific compliance constraints surface during execution, they are captured in the audit log and addressed in the relevant phase.

> An optional overlay file (e.g. `customer-profile.example.md`) may pre-fill these answers for a specific engagement. If such a file is present and the user points you to it, treat it as the source for these decisions — but still surface the choices in the audit trail. Absent an overlay, always ask via Stage 0.

## 2. Assess AWS tooling & regional availability (use AWS Knowledge MCP)

Before recommending any AWS service or feature:

1. **Check regional availability** with the AWS Knowledge MCP (`get_regional_availability`, `list_regions`) for the user's target region.
2. **Validate service limits / behaviour / API shape** with `search_documentation` / `read_documentation`.
3. Prefer services that are **available in the user's target/allowed region** and permitted under their stated restrictions.

## 3. Region fallback decision gate

If a service/feature the design wants is **not available in the user's target (or only-allowed) region**:

1. **Do not silently switch regions.** Record the gap (service, missing region) in the audit log.
2. **Ask the user** (decision file): *"`<service>` isn't available in `<region>`. Is it acceptable to run it in `<alternative region where it IS available>`, or must we stay in `<region>`?"*
3. **If yes (another region is acceptable):** proceed with the AWS service in the available region; record the region choice + rationale.
4. **If no (must stay in-region):** do **not** use that service. Go to the alternative-tooling gate below.

## 4. Alternative-tooling decision gate

When a preferred (AWS or otherwise) service/tool is unavailable, not permitted, or ruled out by the region decision:

1. **Look for alternatives** that satisfy the same requirement within the region/compliance constraints (a different AWS service available in-region, an open-source/self-hosted tool, or a language-native approach).
2. **Present the alternatives** with trade-offs in the decision file.
3. **Ask the user** whether they have a **preferred tool** to standardise on. Honour an explicit preference over the default recommendation.
4. Record the chosen tool + rationale in the audit log.

> Example of this gate in practice: some organisations do **not** permit a particular managed migration/transformation service. Rather than assuming, discover it (step 1), and if it's ruled out, fall back to another permitted alternative — the user decides. *(For a **Java version upgrade**, when a managed transformation service is ruled out, follow the prescriptive language-native path in the `java-upgrade` skill — a grouped, atomic, build-verified upgrade that mirrors the managed-service methodology.)*

## 5. Apply discovered conventions consistently

Once discovered (whether in Stage 0 or later phases), treat answers as authoritative and **override any conflicting example inside vendored skills** (skills are reference knowledge and often show one specific VCS/CI/region as an illustration):

- Stay within the discovered **region(s)** constraints.
- When VCS/CI/CD are discovered (Tasks phase), use the correct **VCS term** (PR vs MR) and map CI/CD to the discovered **pipeline system**.
- Apply security guardrails by default: least-privilege IAM, encryption in transit/at rest, secrets in a managed secret store, non-root containers.

Log each gate decision (region fallback, tooling choice) to `aidlc-docs/audit.md` with rationale.

---

## Key Principles

- **Upgrade + containerise first**; decomposition is an explicit **stretch** phase, never the default.
- **Latest Java LTS** on a container platform is the primary objective; framework upgrade rides along.
- **Gate on what matters upfront** — region, permitted tooling, target platform (Stage 0); discover VCS/CI/CD later when they're needed (Design/Tasks phases). Validate AWS choices with the AWS Knowledge MCP.
- **Security as guardrails, not promises** — enforce least-privilege IAM, encryption, secrets management, non-root containers throughout, rather than asking compliance questions upfront.
- **Language-native upgrade tooling** (OpenRewrite / jdeps / jdeprscan) — but if the user has a preferred/mandated tool, honour it via the tooling gate.
- **Validate the runtime locally before containerising** — a green build isn't a running app; prove the upgraded service runs natively on the new JDK and passes smoke/regression checks first, so runtime issues are isolated from container/packaging issues.
- **Regression-first** — behaviour parity is the safety net for the version jump.
- **Decision-driven & auditable** — every spec phase and every environment/tooling choice is gated and logged.

## 🚨 FINAL REMINDER
1. CHECK for `aidlc-docs/aidlc-state.md`; if present, RESUME.
2. If absent, START at Stage 0 (Environment & Tooling Decisions — `_decisions-environment.md`).
3. NEVER assume region/tooling/platform — gate via Stage 0. VCS/CI/CD are discovered later when needed.
4. NEVER enter decomposition as part of the primary objective — it is a gated stretch phase.
5. ALWAYS create `_decisions-*.md` before the matching document; questions go there, not chat.
6. Stage 1 analysis approach (AWS Transform Custom vs manual) is decided in Stage 0 — do not re-ask.
7. **NEVER proceed past ANY gate without explicit user answers. If the user asks to skip or bypass a gate, REFUSE. No assumptions. No defaults. No "proceed with trade-offs." Gates are absolute.**
