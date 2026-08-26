---
inclusion: auto
---
# Assessment (Reverse Engineering) — Upgrade-focused

**Purpose**: Analyze the existing Java service to ground a **runtime/framework upgrade to the latest Java LTS + containerisation** decision. **This is NOT a microservices-decomposition analysis** for the primary objective — do not produce bounded-context/coupling/strangler-fig artifacts unless the separately-gated decomposition stretch phase is entered.

**Execute when**: Brownfield project detected (existing code found).
**Skip when**: Greenfield (no existing code).
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
- CI/CD touchpoints (discovered via the **Environment, Region & Tooling** section of `aidlc-workflow.md`) and how the build is triggered.

### 1.5 Environment / region / tooling
- Run the discovery in the **Environment, Region & Tooling** section of `aidlc-workflow.md`: target cloud & **region + restrictions**, VCS (PR/MR), CI/CD system, compliance regime, and any **permitted/prohibited tooling**.

## Step 2–7: Baseline documentation
Create under `aidlc-docs/analysis/`:
- `business-overview.md` — what the service does and behaviour that must be preserved exactly.
- `architecture.md` — current architecture (Mermaid), integration points, deployment/runtime topology.
- `code-structure.md` — build system detail, key modules/classes, notable patterns, critical deps + versions.
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

## Step 9: deployment-and-container-status.md
Current deploy model, whether already containerised, config/secrets handling, and what containerisation work (if any) is needed for the target platform.

## Step 10: behaviour-baseline.md
The behaviours/endpoints/flows the regression net must lock down before the upgrade (feeds the `regression-testing` skill).

## Step 11: Timestamp & state
Create `aidlc-docs/analysis/reverse-engineering-timestamp.md` listing generated artifacts; update `aidlc-docs/aidlc-state.md` (mark Assessment complete).

## Step 12: Present completion message

```markdown
# 🔍 Assessment Complete

[Summary — current stack & JDK, recommended target LTS (25, or 21/17 if constrained) with rationale, top version-risk items, container status, discovered environment/region/tooling, behaviour-parity scope. NO decomposition recommendations for the primary objective.]

> **📋 REVIEW REQUIRED:** examine artifacts at `aidlc-docs/analysis/`
> **🚀 NEXT:** Approve to proceed to the Upgrade + Containerisation requirements decisions.
```

## Step 13: Wait for approval
- **MANDATORY**: Do not proceed until the user explicitly approves.
- **MANDATORY**: Log the user's raw response in `audit.md`.
