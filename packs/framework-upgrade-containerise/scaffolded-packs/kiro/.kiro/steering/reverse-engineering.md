---
inclusion: auto
---
# Assessment (Reverse Engineering) — Upgrade-focused

> **⚠️ FALLBACK PATH:** This manual reverse-engineering flow is the fallback when **AWS Transform Custom is not available or not permitted**. If AWS Transform Custom was chosen in Stage 0, its comprehensive analysis output feeds directly into the assessment artifacts instead — skip this file and proceed to artifact generation from the Transform Custom report.

**Purpose**: Analyze the existing Java service to ground a **runtime/framework upgrade to the latest Java LTS + containerisation** decision. **This is NOT a microservices-decomposition analysis** for the primary objective — do not produce bounded-context/coupling/strangler-fig artifacts unless the separately-gated decomposition stretch phase is entered.

**This phase is entered ONLY after Stage 0 (environment/tooling decisions) has been completed** — meaning `_decisions-environment.md` is approved — and the user has indicated that AWS Transform Custom cannot be used, or after AWS Transform Custom analysis is done and deeper manual analysis is required.

**Execute when**: Brownfield project detected (existing code found) AND Stage 0 decisions are approved.
**Skip when**: Greenfield (no existing code), OR AWS Transform Custom analysis is sufficient.
**Rerun behavior**: Always rerun when brownfield detected, so artifacts reflect current code state.

## Step 1: Discovery

### 1.1 Stack & build
- Programming language(s), frameworks, and **current JDK target**.
- Build system: **Maven** vs **Gradle** (config files, wrapper versions), plugin versions.
- Module/package layout (single vs multi-module — still upgraded as one deployable unit for the primary objective).

### 1.2 Framework & dependency inventory
- Framework and major-library versions (Spring / Spring Boot, Jackson, Hibernate, logging, etc.).
- For each, the **highest Java LTS it supports** → determines the target (newest LTS preferred; earlier as fallback).
- Known-vulnerable/outdated dependencies to bump during the upgrade.

### 1.3 Deployment & container status
- Current deployment model: WAR/JAR, VM/on-prem, app server (Tomcat/JBoss), existing cloud, etc.
- **Is it already containerised?** (Dockerfile / image present?) — decides whether containerisation work is in scope.
- Externalised config/secrets today (properties files, env vars, vault, parameter store?).

### 1.4 Test & quality posture
- Test frameworks and **current coverage**.
- CI/CD touchpoints and how the build is triggered today (observed, not gated — CI/CD platform choice is deferred to the Tasks phase).

### 1.5 Environment / region / tooling
- Environment/region/tooling was already discovered in Stage 0 — refer to the approved `_decisions-environment.md` and `audit.md`.

### 1.6 Codebase scale & complexity (drives the upgrade execution strategy)
> Size and coupling — not just "what breaks" — determine **how** the upgrade must be sequenced. A large codebase cannot be upgraded in one shot.
- **Lines of code**: total, plus app vs test split. Count with a real tool (e.g. `cloc`, `tokei`, or `git ls-files` + `wc -l`), not estimates.
- **Module / package count** and **per-module LOC** — identify the largest modules and the long tail.
- **Dependency shape** (from `jdeps` / build config): which modules are **foundational/shared** (high fan-in) vs **leaf** (high fan-out, depend on many) — this sets the upgrade order.
- **Risk concentration**: which modules carry the heaviest version-risk surface (most `javax.*`, reflection, JDK-internal, serialization usage) — these need the most care and their own waves.
- **Rough effort signal**: LOC + module count + risk concentration → a first-cut sizing tier (see the strategy artifact in Step 9).

## Step 2–7: Baseline documentation
Create under `aidlc-docs/analysis/`:
- `business-overview.md` — what the service does and behaviour that must be preserved exactly.
- `architecture.md` — current architecture (Mermaid), integration points, deployment/runtime topology.
- `code-structure.md` — build system detail, key modules/classes, notable patterns, critical deps + versions, **and codebase-scale metrics** (total/app/test LOC, module count, per-module LOC, dependency fan-in/out).
- `api-documentation.md` — endpoints/contracts and data models (to assert behaviour parity after upgrade).
- `technology-stack.md` — full runtime/framework/library/tooling inventory with versions.
- `dependencies.md` — internal + external deps (version, purpose, Java-LTS compatibility, CVE status).

## Step 8: java-version-risk-surface.md  (the key upgrade artifact)

```markdown
# Java Version Risk Surface (8 → 25, via 17/21)

## Removed / relocated APIs
- javax.* Java EE / JAXB / JAX-WS — [where used] → [jakarta.* or explicit dep]
## JDK internals / strong encapsulation (JEP 396/403)
- sun.misc.Unsafe / jdk.internal.* / reflection — [where] → [--add-opens/--add-exports or library upgrade]
## Removed features
- Nashorn (JEP 372); CMS GC flags; Security Manager (JEP 411) — [where] → [remediation]
## Security / TLS
- TLS defaults, cipher suites, truststore/mutual-TLS usage — [where]
## Serialization / reflection-heavy libraries
- Jackson / Hibernate / others — [version] → [compatible version]
## Framework upgrade impact
- Spring Boot 2→3 / javax→jakarta scope — [affected areas]
## Summary
- Target LTS recommendation: [25 | 21 | 17] with rationale
- Estimated risk: [Low/Med/High] and top blockers
```

## Step 9: upgrade-strategy.md  (scale-driven execution plan)

> Turns the scale/complexity findings (Step 1.6) into a concrete plan for **how** to tackle the upgrade. This is the deliverable that prevents a doomed one-shot attempt on a large codebase and feeds directly into the Tasks phase.

```markdown
# Upgrade Execution Strategy (scale-driven)

## Codebase scale (measured)
- Total LOC: [n]  (app [n] / test [n]) · Files: [n] · Modules/packages: [n]
- Largest modules (LOC): [module → loc, …]
- Dependency shape: foundational/shared (high fan-in) [modules]; leaf (high fan-out) [modules]
- Risk concentration (heaviest javax→jakarta / reflection / JDK-internal): [modules]

## Sizing tier & approach  (heuristic — adjust to real coupling, not LOC alone)
- **Small (< ~50k LOC, few modules):** one-shot — run the full group sequence across the whole codebase; single PR.
- **Medium (~50k–200k LOC):** batched — run the group sequence but build/test and commit per group; split the PR by group/layer.
- **Large (> ~200k LOC / many modules):** **incremental, wave-based — do NOT one-shot.** Upgrade module-by-module in dependency order.

> A one-shot upgrade of a large codebase (e.g. 500k LOC) reliably fails: hundreds of simultaneous breakages, an unreviewable diff, and no clean commit to bisect a regression against.

## Recommended plan for THIS codebase
- **Selected tier:** [Small | Medium | Large] — rationale: [LOC + coupling + risk concentration]
- **Wave order (dependency-first):** foundational/shared modules first, then their dependents, leaf apps last.
  1. Wave 1 — [modules]  (foundational libs; lowest fan-out)
  2. Wave 2 — [modules]
  3. …
- **Per-wave loop:** apply the group sequence (Build-system → Jakarta → DB/ORM → core deps → Spring → integration) to the wave → build + full test → regression parity → local-runtime checkpoint → PR/MR → merge before starting the next wave.
- **Keep the system building throughout (bridging):** e.g. compile foundational modules at the target LTS while dependents still target the old baseline where the toolchain allows, or hold a javax↔jakarta shim at module seams until all waves land.
- **Parallelisation:** independent modules that share no changes can be upgraded on parallel branches; serialise anything touching shared modules.
- **Rough effort & top blockers:** [per-wave sizing]; [blocking dependencies / unsupported libs].
```

## Step 10: deployment-and-container-status.md
Current deploy model, whether already containerised, config/secrets handling, and what containerisation work (if any) is needed for the target platform.

## Step 11: behaviour-baseline.md
The behaviours/endpoints/flows the regression net must lock down before the upgrade (feeds the `regression-testing` skill).

## Step 12: Timestamp & state
Create `aidlc-docs/analysis/reverse-engineering-timestamp.md` listing generated artifacts; update `aidlc-docs/aidlc-state.md` (mark Assessment complete).

## Step 13: Present completion message

```markdown
# 🔍 Assessment Complete

[Summary — current stack & JDK, recommended target LTS (25, or 21/17 if constrained) with rationale, top version-risk items, container status, discovered environment/region/tooling, behaviour-parity scope, **codebase scale (LOC/modules) and the recommended execution strategy (one-shot vs batched vs wave-based) with the wave order for large codebases**. NO decomposition recommendations for the primary objective.]

> **📋 REVIEW REQUIRED:** examine artifacts at `aidlc-docs/analysis/`
> **🚀 NEXT:** Approve to proceed to the Upgrade + Containerisation requirements decisions.
```

## Step 14: Wait for approval
- **MANDATORY**: Do not proceed until the user explicitly approves.
- **MANDATORY**: Log the user's raw response in `audit.md`.
