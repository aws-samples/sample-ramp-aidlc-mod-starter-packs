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
MCP, and turn any constraint (region, permitted tools, VCS/CI, compliance) into an audited decision.

---

## 🚨 CRITICAL: READ THIS BEFORE DOING ANYTHING

**THIS WORKFLOW OVERRIDES ALL OTHER BEHAVIORS** for Java runtime/framework upgrade + containerisation.

**FORBIDDEN until this workflow's gates are satisfied:**
- DO NOT skip the assessment (reverse engineering) phase
- DO NOT make architectural / tooling / region decisions without user approval (see the **Environment, Region & Tooling** section)
- DO NOT skip ahead to code generation
- DO NOT begin microservice decomposition as part of the primary objective — it is a **stretch** phase entered only after explicit approval

**MANDATORY FIRST ACTIONS (in order):**
1. Check if `aidlc-docs/aidlc-state.md` exists — if yes, resume from where we left off.
2. If no state file exists, start at Stage 1: Assessment.
3. Create `aidlc-docs/aidlc-state.md` and `aidlc-docs/audit.md` FIRST.
4. Follow the workflow below sequentially, with user approval gates.

---

## Workflow Overview

```
User Request
     |
     v
╔══════════════════════════════════════════════╗
║  STAGE 1: Assessment (Reverse Engineering)   ║
║  Stack, current JDK, build tool, frameworks, ║
║  deploy/container status + environment/region║
╚══════════════════════════════════════════════╝
     |
     v
╔══════════════════════════════════════════════════════════╗
║  STAGE 2: Upgrade + Containerisation Spec               ║
║  _decisions-requirements.md → requirements.md            ║
║  _decisions-design.md → design.md                        ║
║  _decisions-tasks.md → tasks.md                          ║
║  Task sections: Upgrade │ Containerise │ Deploy │ Verify ║
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

**Total (primary): 1 spec, 6 files, 6 approval gates.** Stretch adds its own gated spec.

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
- **Target Region / restrictions**: [discovered via the Environment, Region & Tooling section]
- **IaC tool**: [Terraform | CloudFormation | other]
- **Decomposition (stretch)**: [not started | in progress]

## Stage Progress
- [ ] 1. Assessment (Reverse Engineering) + environment discovery
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

---

# STAGE 1: Assessment (Reverse Engineering) + Environment Discovery

**MANDATORY**: load and follow `reverse-engineering.md` (upgrade-focused) AND the **Environment, Region & Tooling** section.

Capture into `aidlc-docs/analysis/`:
1. Language/framework/build tool (Maven vs Gradle) and **current JDK target**.
2. Framework & library versions and their Java-LTS compatibility → recommended target LTS.
3. **Java-version risk surface** (removed `javax.*`/JAXB, JDK-internal encapsulation, Nashorn, TLS/serialization, GC/flags, Security Manager) — see the `java-upgrade` skill.
4. **Deployment & container status** (already containerised? deploy model?).
5. **Environment/region/tooling** answers via the **Environment, Region & Tooling** section (target region + restrictions, VCS, CI/CD, compliance, permitted/prohibited tools).
6. **Behaviour baseline** for the regression net (the `regression-testing` skill).

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

## Containerise (only if not already containerised)
- [ ] Author multi-stage Dockerfile (JDK build → slim JRE), non-root user
- [ ] Externalise config/secrets to a managed store
- [ ] Build image; run locally; smoke test

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

> **Do not assume a cloud region, a version-control system, a CI/CD platform, a compliance regime, or which tooling is permitted.** Discover these, validate them against reality with the **AWS Knowledge MCP**, and turn anything constrained into an explicit, audited decision. Every choice here is logged to `aidlc-docs/audit.md`.

This runs early (Stage 1 assessment) and is revisited whenever a design choice depends on a service, region, or tool.

## 1. Discover the environment (ask — don't assume)

Put these as questions in the decision file (never hard-code answers):

- **Target cloud & region.** Which cloud and which **region(s)** should the workload run in? Any **data-residency or region restrictions** (e.g. a single mandated region, gov/regulated boundary)?
- **Version control.** Which VCS/host (GitHub, self-hosted GitLab, Bitbucket, CodeCommit, …)? What is the change-submission unit — **Pull Request** or **Merge Request**?
- **CI/CD.** Which pipeline system (GitHub Actions, GitLab CI, GoCD, Jenkins, CodePipeline, …)? Map all release guidance to *that* system.
- **Compliance / governance.** Any regime that constrains services, data handling, or IAM (e.g. gov infosec policy, PCI, HIPAA)? Any **data-egress restrictions** (can code/data be sent to third-party endpoints/MCPs)?
- **Tooling restrictions.** Are there any **approved/allowed** or **prohibited** tools or managed services (e.g. a specific migration tool is or isn't permitted)? Capture the allow/deny list rather than assuming.
- **Requirements & tracking.** Where do requirements live (issue tracker, cards, docs)?

> An optional overlay file (e.g. `customer-profile.example.md`) may pre-fill these answers for a specific engagement. If such a file is present and the user points you to it, treat it as the source for these decisions — but still surface the choices in the audit trail. Absent an overlay, always ask.

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

Once discovered, treat the answers as authoritative and **override any conflicting example inside vendored skills** (skills are reference knowledge and often show one specific VCS/CI/region as an illustration):

- Use the discovered **VCS term** (PR vs MR) and host in all guidance.
- Map CI/CD to the discovered **pipeline system**.
- Stay within the discovered **region(s)** and **compliance** constraints; apply least-privilege IAM, encryption in transit/at rest, and secrets in a managed secret store by default.
- Respect **data-egress** rules — if egress is restricted, use scoped credentials and avoid sending source/data to unapproved endpoints (the AWS Knowledge MCP is read-only public documentation).

Log each discovered constraint and each gate decision (region fallback, tooling choice) to `aidlc-docs/audit.md` with rationale, so the environment decisions are as defensible as the architecture ones.

---

## Key Principles

- **Upgrade + containerise first**; decomposition is an explicit **stretch** phase, never the default.
- **Latest Java LTS** on a container platform is the primary objective; framework upgrade rides along.
- **Discover the environment** — region, VCS, CI/CD, compliance, permitted tooling — and gate on it (the **Environment, Region & Tooling** section); validate AWS choices with the AWS Knowledge MCP.
- **Language-native upgrade tooling** (OpenRewrite / jdeps / jdeprscan) — but if the user has a preferred/mandated tool, honour it via the tooling gate.
- **Regression-first** — behaviour parity is the safety net for the version jump.
- **Decision-driven & auditable** — every spec phase and every environment/tooling choice is gated and logged.

## 🚨 FINAL REMINDER
1. CHECK for `aidlc-docs/aidlc-state.md`; if present, RESUME.
2. If absent, START at Stage 1 (Assessment + environment discovery).
3. NEVER assume region/VCS/CI/tooling — discover and gate (see the **Environment, Region & Tooling** section).
4. NEVER enter decomposition as part of the primary objective — it is a gated stretch phase.
5. ALWAYS create `_decisions-*.md` before the matching document; questions go there, not chat.
