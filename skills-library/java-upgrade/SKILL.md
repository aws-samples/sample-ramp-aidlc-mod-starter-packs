---
name: java-upgrade
description: Use when upgrading a Java service to the latest Java LTS (target newest — e.g. Java 25; fall back to 21/17 only if a dependency blocks it), performing the associated framework upgrade (Spring Boot 2→3, javax→jakarta), and containerising the result for ECS/EKS. Covers upgrade tooling (OpenRewrite, jdeps, jdeprscan, Maven/Gradle toolchain), the common Java 8→17/21/25 breakages, the containerisation arc, and — when a managed transformation service (e.g. AWS Transform) is NOT permitted — the prescriptive, group-by-group, build-verified language-native upgrade path (see references/prescriptive-language-native-upgrade.md). Triggers on Java upgrade, JDK upgrade, LTS upgrade, Spring Boot upgrade, jakarta migration, OpenRewrite, jdeps, jdeprscan, containerise Java, Dockerfile for Java, Corretto.
license: MIT-0
metadata:
  author: RAMP AI-DLC Starter Packs
  version: 1.0.0
---

# Java Runtime/Framework Upgrade + Containerisation

**Primary objective:** upgrade a Java service to the **latest Java LTS** the stack supports (target the newest LTS — e.g. **Java 25**; fall back to 21 or 17 only if a dependency blocks it), including any needed **framework upgrade**, and run it as a **container** on the target platform (ECS/EKS or another the user specifies), containerising only if it isn't already. Decomposition is a **stretch** target handled separately (see the AI-DLC workflow). Region, platform, and tooling are discovered/decided via the **Environment, Region & Tooling** section of the AI-DLC workflow.

## When to Load Reference Files

| If the task involves… | Load |
|---|---|
| A managed transformation service is NOT available/approved and you must upgrade with language-native tooling — the grouped, atomic, correctly-sequenced, build-verified path | `references/prescriptive-language-native-upgrade.md` |

For the behaviour-first regression safety net that de-risks the version jump, use the `regression-testing` skill; use `web-test-automation` if the service has a web/UI surface.

## Phase 0 — Assessment (brownfield, run first)

- Detect build tool (**Maven** vs **Gradle**), **current JDK target**, module layout, framework & library versions.
- Determine the **highest Java LTS** the frameworks/libraries support today (e.g. Spring Boot 3.x supports Java 17–25) → set target to the newest supported LTS (25 preferred), or 21/17 as fallback.
- Inventory the **Java-version risk surface** (below).
- Determine **container status** (already containerised or not) and current deploy model.
- **Measure codebase scale** — LOC (total/app/test), module count, per-module size, and dependency shape (`jdeps` fan-in/out). This decides the **execution strategy**: small ⇒ one-shot; large (e.g. 500k LOC) ⇒ dependency-ordered **waves**, never one-shot (see "Scaling the upgrade" below).
- Capture the **behaviour baseline** for the regression net (`regression-testing` skill).
- Discover **environment/region/tooling** (Environment, Region & Tooling section of the AI-DLC workflow) — including whether any preferred or mandated upgrade tooling exists.

## The upgrade — tooling

**First, resolve the tooling gate** (Environment, Region & Tooling section of the AI-DLC workflow): is a **managed transformation service** (e.g. AWS Transform) permitted for this engagement?

- **If a managed transformation service IS permitted** and the user chooses it — use it.
- **If it is NOT available/approved** — follow the **prescriptive language-native path** in
  `references/prescriptive-language-native-upgrade.md`: a grouped, atomic, correctly-sequenced upgrade where the
  build must pass at the end of every group (Build-system readiness → Jakarta migration → Database/ORM →
  Core deps → Spring ecosystem → Final integration). The tools below are what that path uses.

Default to **language-native** tooling; if the user has another preferred/mandated tool, honour it.

- **OpenRewrite** — apply the latest `UpgradeToJava` recipe for the target LTS (e.g. `UpgradeToJava25`, or `UpgradeToJava21`/`UpgradeToJava17` if falling back), stepping through 11/17/21 as intermediate baselines if needed, via the Maven/Gradle plugin. Also run **framework recipes** (e.g. Spring Boot 2→3 / `javax`→`jakarta`).
- **`jdeps`** — analyse dependencies on internal/removed JDK APIs and module boundaries.
- **`jdeprscan`** — scan for deprecated/removed APIs against the target LTS baseline.
- **Toolchain / build upgrades** — bump the Maven/Gradle JDK toolchain and compiler `release` to the target LTS; upgrade plugins/dependencies to compatible versions and clear known CVEs.

## Scaling the upgrade (large codebases)

Codebase size dictates **how** the upgrade is sequenced — measured in Phase 0. Treat the LOC bands as heuristics; real module coupling matters more than the raw number.

| Tier | Rough size | Approach |
|---|---|---|
| Small | < ~50k LOC, few modules | **One-shot** — run the full group sequence across the whole codebase; single PR. |
| Medium | ~50k–200k LOC | **Batched** — run the group sequence but build/test and commit per group; split the PR by group/layer. |
| Large | > ~200k LOC / many modules | **Wave-based, dependency-ordered — do NOT one-shot.** Upgrade module-by-module: foundational/shared modules (high fan-in) first, then dependents, leaf apps last. |

For **wave-based** upgrades:
- **Repeat the whole group sequence per wave** (Build-system → Jakarta → DB/ORM → core deps → Spring → integration); each wave must build + pass tests + prove regression parity + pass the local-runtime checkpoint, then merge as its own PR/MR before the next wave starts.
- **Keep the system building throughout** — compile foundational modules at the target LTS while dependents still target the old baseline where the toolchain allows, or hold a `javax`↔`jakarta` shim at module seams until all waves land.
- **Parallelise** independent modules on separate branches; serialise anything touching shared modules.
- Order the waves from the `jdeps` dependency graph; concentrate the highest-risk modules (heavy `javax`/reflection/JDK-internal usage) into their own carefully-reviewed waves.

> Why not one-shot a 500k-LOC upgrade? Hundreds of simultaneous breakages, an unreviewable diff, and no clean commit to bisect a regression against. Waves keep every step green, reviewable, and revertable.

### Common Java 8 → 17/21/25 breakages to check and plan for

- **Removed `javax.*` Java EE / JAXB / JAX-WS modules** (`java.xml.bind`, `java.activation`, `javax.annotation`) — add explicit deps (Jakarta/GlassFish JAXB) or migrate to `jakarta.*`.
- **Strong encapsulation of JDK internals (JEP 396/403)** — `sun.misc.Unsafe` / reflective access to `jdk.internal.*` fails; find `--add-opens`/`--add-exports` needs or upgrade the offending library.
- **`Nashorn` JavaScript engine removed** (JEP 372) — replace with GraalJS if used.
- **TLS / security defaults changed** — TLS 1.3 default, stricter certificate handling, changed cipher suites; re-validate mutual-TLS and truststores (critical for auth/security-sensitive services).
- **Serialization / reflection** — tightened access; verify Jackson/Hibernate/etc. are on target-LTS-compatible versions.
- **Garbage collector & flags** — CMS removed; default is G1 (ZGC/Shenandoah available on newer LTS). Re-tune JVM flags and container memory settings.
- **Security Manager** deprecated for removal (JEP 411) — check for `SecurityManager` reliance.
- **Language changes** (`record`, `sealed`, pattern matching, virtual threads on 21+) — mostly additive; re-run the full regression suite.

## Containerisation arc (after the upgrade compiles & tests green)

> Skip authoring a new Dockerfile if the service is **already containerised** — in that case update the base image to the target LTS and re-validate.

1. **Base image** — a supported JDK runtime image for the target LTS (e.g. **Amazon Corretto 25**, or a distroless Java image). Multi-stage build (JDK build → slim JRE), non-root user.
2. **Config & secrets** — externalise config; secrets via a managed secret store (e.g. SSM Parameter Store / Secrets Manager), injected at runtime, never baked into the image.
3. **Compute target — decision gate (validate regional availability via AWS Knowledge MCP):**
   - **ECS Fargate** — lowest operational overhead for a single service. Activate `ecs-architect` / `ecs-security` / `ecs-observability` / `ecs-devops`.
   - **EKS** — if the org standardises on Kubernetes; author manifests/Helm instead of ECS task defs. The container/IaC/IAM/observability skills still apply.
   - **Other platform** — if the user specifies one, adapt accordingly.
4. **IaC** — decision gate: **Terraform** (`ecs-build`) vs **CloudFormation** (`aws-cloudformation`) vs another permitted tool — record the choice.
5. **Region** — deploy in the user's target/allowed region; confirm all chosen services/features are available there (AWS Knowledge MCP), applying the region-fallback gate in the Environment, Region & Tooling section of the AI-DLC workflow if not.

## Regression safety net (de-risk the jump)

Prove behaviour parity before merging: use the `regression-testing` skill for a behaviour-first suite that survives the version jump, and `web-test-automation` if the service has a web/UI surface. Wire the suite into the discovered CI/CD pipeline so the PR/MR gate is meaningful.

## Definition of done

- Service compiles and all tests pass on the **target Java LTS** (25, or 21/17 if constrained).
- Framework upgraded as required; behaviour parity demonstrated against the pre-upgrade baseline.
- Running as a **container** on the chosen platform in the target region via the chosen IaC tool (containerisation authored only if it wasn't already).
- Change raised as a **PR/MR** on the discovered VCS, verified through the discovered CI/CD pipeline; linked to the requirement/tracker item.
- Every decision (target LTS, framework path, platform, region, IaC tool, any tooling gate) recorded in `aidlc-docs/audit.md`.
- Decomposition **not** performed as part of the primary objective — optionally noted as a stretch/next step.
