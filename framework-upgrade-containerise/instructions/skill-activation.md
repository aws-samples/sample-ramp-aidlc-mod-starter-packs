# Mandatory Skill, Tooling & MCP Activation — Java LTS Upgrade + Containerisation

Activate the relevant skill or tooling **BEFORE** generating any decision file, spec document, or code. Re-activate at the start of every new session when the topic is relevant.

> This pack upgrades a Java service to the **latest Java LTS** (+ framework upgrade) and runs it as a **container** on the target platform. Decomposition is a separately-gated **stretch** phase. Region, platform, VCS/CI, compliance, and permitted tooling are **discovered** — see the **Environment, Region & Tooling** section of `aidlc-workflow.md`. **If a managed transformation service (e.g. AWS Transform) is not permitted, the upgrade follows the prescriptive group-based path in the `java-upgrade` skill.**

## 🧠 Java Upgrade Skill (core)

**Trigger keywords:** Java upgrade, JDK upgrade, LTS upgrade, Java 8/11/17/21/25, Spring Boot upgrade, javax→jakarta, jakarta migration, OpenRewrite, jdeps, jdeprscan, Maven/Gradle toolchain, framework upgrade, AWS Transform, managed transformation service

**Action:** Activate `java-upgrade` for any Java runtime/framework upgrade or containerisation-of-Java work. It carries the upgrade tooling (OpenRewrite / jdeps / jdeprscan), the common Java 8→17/21/25 breakages, the containerisation arc, and — in `references/prescriptive-language-native-upgrade.md` — the prescriptive, group-by-group, build-verified language-native upgrade path used when a managed transformation service is NOT permitted.

**🔒 RULE:** NEVER produce the upgrade plan, target-LTS/framework decisions, or upgrade code without activating `java-upgrade` first. Resolve the managed-transformation-vs-language-native tooling gate (Environment, Region & Tooling section of `aidlc-workflow.md`) before generating upgrade steps.

## 🧠 Container / ECS / EKS Skills

**Trigger keywords:** containerise, Docker, Dockerfile, image, ECS, Fargate, EKS, Kubernetes, task definition, service, ALB, cluster, capacity provider, blue/green, canary, rolling deploy, autoscaling

**Action:** Activate the container skill family as relevant (applies to ECS and EKS targets):
- `aws-containers` — container fundamentals, Dockerfile authoring, ECS troubleshooting, `ecs exec` debugging.
- `ecs-architect` — choose the compute model (ECS Fargate / EKS / other), task/pod sizing, networking.
- `ecs-build` — apply-ready **Terraform** for ECS clusters/services/task definitions (Terraform IaC path).
- `ecs-devops` — release strategy & CI/CD (map to the **discovered** CI/CD system — see the **Environment, Region & Tooling** section of `aidlc-workflow.md`).
- `ecs-observability` — logs/metrics/traces (Container Insights, X-Ray, ADOT, FireLens).
- `ecs-security` — task/execution roles, PassRole, secrets injection, hardening.

**🔒 RULE:** NEVER design the compute target, write a task definition / Kubernetes manifest, or containerise without activating the matching skill(s). Do not begin microservice decomposition as part of the primary objective.

## 🧠 IaC Skills — CloudFormation OR Terraform (decision gate)

**Trigger keywords:** IaC, CloudFormation, CFN template, Terraform, `.tf`, provision, stack

**Action:** IaC tool is a decision gate. Activate the matching skill once decided:
- `aws-cloudformation` — author/validate/troubleshoot CloudFormation.
- `ecs-build` — Terraform for ECS.

**🔒 RULE:** Record the IaC-tool choice in `aidlc-docs/audit.md` before generating IaC.

## 🧠 IAM & Observability Skills

**Trigger keywords:** IAM, role, trust policy, least privilege, task role, execution role; CloudWatch, metrics, logs, alarms, X-Ray, ADOT

**Action:** Activate `aws-iam` for identity/roles (least-privilege) and `aws-observability` for the observability design.

## 🧠 Regression Testing & Web Test Automation Skills

**Trigger keywords:** regression test, pre-upgrade test, test strategy, safety net, behaviour parity, API contract test, test prioritisation; Playwright, end-to-end, UI test, smoke test

**Action:**
- Activate `regression-testing` when planning or writing the behaviour-first safety net that must survive the version/framework jump — it provides the test-priority tiers (API contracts / E2E → pure logic → integration) and, in `references/pre-upgrade-testing-workflow.md`, the staged, decision-gated, per-unit test-generation workflow.
- Additionally activate `web-test-automation` **only if** the service has a web/UI surface to regression-test (Playwright/Cypress/Selenium mechanics). For non-web services, rely on the `regression-testing` strategy plus the project's existing tests.

---

## 📚 AWS Knowledge MCP

**Trigger:** Validate AWS guidance, service limits, and **regional availability** — especially when choosing a compute platform, container/observability options, or any AWS service.

**Available tools:** `search_documentation`, `read_documentation`, `get_regional_availability`, `list_regions`.

**🔒 RULE:** When uncertain about AWS specifics, ALWAYS search AWS docs first. Confirm features are available in the user's **target/allowed region** before recommending them, and apply the region-fallback gate in the **Environment, Region & Tooling** section of `aidlc-workflow.md` if not.

---

## Activation Checklist

1. Match keywords in the user's message / spec context.
2. Activate ALL matching skills before proceeding.
3. Run environment/region/tooling discovery (the **Environment, Region & Tooling** section of `aidlc-workflow.md`) and record decisions in the audit log before generating IaC/code.
4. When unsure about AWS specifics or regional availability, use the AWS Knowledge MCP.
5. Treat the **Environment, Region & Tooling** section of `aidlc-workflow.md` as authoritative for region, VCS (PR/MR), CI/CD, compliance, and permitted tooling — override any conflicting examples inside vendored skills.
