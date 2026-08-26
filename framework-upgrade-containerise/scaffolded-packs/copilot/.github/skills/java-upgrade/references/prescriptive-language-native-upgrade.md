# Prescriptive Java Upgrade Playbook — language-native (when a managed transformation service is NOT available)

> **When to use this reference.** The tooling decision gate (Environment, Region & Tooling section of the
> AI-DLC workflow) asks whether a managed transformation service (e.g. AWS Transform) is permitted. **If it
> is NOT available/approved, follow THIS prescriptive, constraint-based workflow** to perform the Java
> version + dependency upgrade with language-native tooling. If a managed service *is* permitted and the
> user chooses it, use that instead and treat this as the fallback.
>
> This mirrors a proven managed-service methodology: a **constraint-based, grouped, atomic, correctly-
> sequenced** upgrade where the project **must build (and tests must pass) at the end of every group**
> before proceeding. It is prescriptive on *sequencing and grouping*, not on exact per-line edits — generate
> only the operations the codebase actually needs.

## Objective

Upgrade the Java application to the target LTS (see the main `java-upgrade` skill for target selection —
newest supported LTS, e.g. 25, else 21/17) and update dependencies to compatible versions,
improving security/performance/maintainability while **keeping the app buildable at each step**.

## Entry criteria (verify before starting)

- Project **builds successfully on the current Java version** (baseline build passes).
- Maven or Gradle present with accessible config; **build-tool version compatible** with the target JDK
  (e.g. Maven 3.6.0+ for Java 17+, Maven 3.9.0+ for compiler plugin 3.13+). Verify with `mvn --version` / Gradle wrapper.
- Complete **dependency inventory** available (from the assessment in `reverse-engineering.md`).
- Test suite / validation method accessible; source in version control (rollback possible).
- Environment can run **both** current and target JDKs during transition.

## Pre-flight validation

- Check build-tool version compatibility.
- **Establish a build baseline using the SOURCE Java version** (not the target) — this is critical.
- Confirm required tool versions are available.

## Transformation groups — complete (build + validate) each before the next

> **Principle:** consolidate related dependencies into **atomic** operations while preserving critical
> sequencing. Generate only the operations the codebase needs (see complexity guidance below).

### Group 1 — Build System Readiness
Prepare the build for the target JDK. Atomic changes:
1. Establish build baseline (build with **source** JDK).
2. Update build tooling atomically — build wrapper (e.g. Gradle 8.11+), compiler plugin, **Lombok (1.18.36+) before the Java version change**.
3. Set the target Java version across **all** POMs/build files + verify compilation.
- **Success:** builds on the target JDK.
- *Keep build-tool changes separate from each other* (different failure modes) — do NOT consolidate wrapper / compiler-plugin / Java-version bumps into one step.

### Group 2 — Jakarta EE Migration (single atomic operation)
`javax` → `jakarta` in ONE coordinated change:
1. Update ALL Jakarta deps together (validation, servlet, persistence, annotation, mail, activation, xml.bind, xml.ws, jws) to compatible versions; update ALL import statements together; update `web.xml` / `persistence.xml` schemas to Jakarta namespaces.
2. Verify completeness; fix edge cases.
- **Success:** no `javax.*` imports remain (except `javax.xml`, `javax.swing`); project builds.
- **Anti-pattern:** per-dependency Jakarta operations — partial migration breaks the build.

### Group 3 — Database & ORM Modernization (coordinated group)
Update the database ecosystem together: drivers (MySQL/PostgreSQL/H2), ORM (Hibernate, MyBatis-Plus),
connection pools (HikariCP, Druid), pagination (PageHelper); update JPA repo methods (e.g. `getOne()` →
`getReferenceById()`).
- **Success:** DB connectivity + ORM operations verified.

### Group 4 — Core Dependencies (grouped by relationship)
1. Apache Commons & utilities (`commons-lang3`, `commons-io`, `commons-collections4`, `commons-fileupload`; Netty, Freemarker, Jedis; HTTP: HttpClient, OkHttp).
2. Serialization & processing (Jackson → LTS e.g. 2.15.2; FastJSON, Gson; XML: Xerces, Saxon, XMLBeans; workflow: Flowable).
- **Success:** core functionality stable; project builds; no dependency conflicts.

### Group 5 — Spring Ecosystem Modernization (maintain sequencing)
1. **Spring Security config update BEFORE the Spring Boot upgrade** (new-version API changes; auth patterns).
2. Complete Spring update: **Spring Boot to target LTS (e.g. 3.2.12)** + all Spring deps; migrate Swagger → SpringDoc OpenAPI; update `application.properties/yml`; caching (Ehcache) if present.
- **Success:** Spring Boot app starts and functions.

### Group 6 — Final Integration & Testing
1. Fix remaining target-JDK language-compatibility issues; update build plugins to JDK-compatible versions; address deprecated APIs.
2. Run the complete test suite; verify end-to-end; write a validation summary.
- **Success:** full functionality verified.

## Critical sequencing (must hold)

- Build tools → Java version change.
- Lombok compatibility → Java version change.
- Jakarta migration complete → Spring Boot upgrade.
- Spring Security config → Spring Boot upgrade.

**Atomic groupings:** Jakarta deps + imports + schemas together; DB drivers + ORM + pooling together;
Spring Security config + Spring Boot upgrade together.

## Mandatory / reference dependency versions (adjust to the chosen target LTS)

> These reflect a Java-17 + Spring-Boot-3 baseline; when targeting a newer LTS (21/25), pick the newest
> compatible versions and validate via the AWS Knowledge MCP / upstream release notes.

- Gradle wrapper: 8.11+  ·  Maven compiler plugin: 3.13.0+ (only if Maven 3.9.0+, else 3.x compatible)  ·  Lombok: 1.18.36+
- Jackson: 2.15.2 (LTS)  ·  Spring Boot: 3.2.12 (LTS)
- Jakarta: validation-api 3.0.2, servlet-api 6.0.0, persistence-api 3.1.0, annotation-api 2.1.1

## Runtime environment management

Use the JDK appropriate to the stage: **source JDK for the baseline build**, **target JDK for validation**
(e.g. `JAVA_HOME=/path/to/target/jdk mvn clean install`).

## Per-group validation & failure recovery

Each group MUST end with: successful build, app starts (where applicable), no conflicting/missing deps.
On failure: revert to the previous group's completed state, fix the specific issue, re-attempt, and
document the issue + resolution in `aidlc-docs/audit.md`.

## Complexity guidance (how many operations to generate)

- Simple (Java version only, minimal deps): ~6–10 operations.
- Medium (Jakarta + DB drivers + utilities): ~10–15.
- Complex (full Spring Boot ecosystem, multiple frameworks): ~15–25.

## Constraints & guardrails

1. Keep all tests enabled; fix failures with real code changes.
2. Upgrade the Java version consistently across all modules.
3. Maintain or upgrade dependency versions from the baseline.
4. Focus changes on target-JDK compatibility; upgrade APIs only when required.
5. Preserve import structure/API-usage patterns, comments, and licensing headers.
6. Remove any temporary debugging code before finishing.
7. **CRITICAL:** the baseline build (Group 1, step 1) uses the **source** Java version, not the target.

## Exit criteria

- Build passes on the **target** Java version.
- Tests pass at the same or better rate than baseline.
- No `javax.*` imports remain (except `javax.xml`, `javax.swing`).
- Dependency versions updated as specified; any skipped incompatible updates documented with reasons.
- Ready to hand off to the **containerisation** arc in the main `java-upgrade` skill.
