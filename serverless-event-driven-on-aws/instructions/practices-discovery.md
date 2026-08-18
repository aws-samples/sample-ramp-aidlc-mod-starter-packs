
# Practices Discovery — Team Context Capture

A companion steering file that adds a lightweight **Practices Discovery**
step at the start of the workflow that captures the team's practices —
**discover → capture → the workflow honors them** for the rest of the
engagement. Kept deliberately light for a 3-day workshop. The captured file
becomes **steering the agent respects for the rest of the workflow**.

> This is a **light gate**, not a heavy approval gate. It runs once at the
> start as a quick capture exercise, then feeds every downstream artifact.
> Teams typically bring compliance and coding standards as **pre-work** — this
> step is where that pre-work lands as steering.

## 🚨 ACTIVATION: Run this BEFORE Phase 1 (Requirements) on first session.

---

## Purpose

Before the agent generates any spec or code, it captures the team's **actual**
practices so nothing generated conflicts with the real codebase. The capture
is explicit about the **manual → authored testing shift** (a common priority
goal): we record where testing is *today* and where it must move *to*.

Captured dimensions:
- **Tech stack + versions**
- **Testing posture — current vs. target** (the manual → authored-test-code shift)
- **Coding conventions**
- **Branching / trunk-based model**
- **Compliance / regulatory constraints** (FSI: audit, disclosures, data handling)
- **CI/CD maturity**

---

## The Practices Discovery Capture

On first run (no `aidlc-docs/team-practices.md` exists), generate this file and
have the team fill it in. Keep it to one screen per section.

### `aidlc-docs/team-practices.md`

```markdown
# Team Practices & Conventions

## Tech Stack (+ versions)
- **Backend:** [e.g., .NET 10 / C#]
- **Serverless / functions:** [e.g., TypeScript Lambda]
- **Frontend:** [e.g., TypeScript (React/Angular/Vue)]
- **Mobile:** [e.g., push-notification app — platform + framework]
- **Infrastructure:** [e.g., CDK TypeScript]
- **Data / messaging:** [e.g., Aurora, DynamoDB, EventBridge, SNS/SQS]

## Testing Posture — CURRENT vs. TARGET   ← the priority shift
- **Current state:** [e.g., "manual test execution, QA post-dev, thrown over the fence"]
- **Target state:** [e.g., "QA authors test code interleaved with features, same wave"]
- **Test frameworks:** [backend: xUnit + coverlet + Moq | TS: Jest | web E2E: Playwright | mobile: <tool>]
- **Coverage stance:** [meaningful-assertion gate; guide not goal]
- **Who authors tests:** [target = Dev+QA pair; QA authoring test code, not executing manual tests]
- **Test-per-requirement:** [Yes — each acceptance criterion maps to an authored test]

## Coding Conventions
- **Naming:** [e.g., PascalCase types, camelCase methods]
- **Project structure:** [e.g., Clean Architecture, Vertical Slices]
- **Error handling:** [e.g., Result pattern / exceptions]
- **Logging:** [e.g., structured JSON, correlation IDs]
- **Existing libraries/patterns:** [e.g., MediatR, FluentValidation]

## Branching / Delivery Model
- **Branching:** [e.g., Trunk-based (mandated)]
- **CI/CD maturity:** [e.g., GitHub Actions; gates: build + authored tests + coverage + SAST]
- **Merge gate:** [what must be green to merge to trunk — this is what keeps trunk safe without manual QA]
- **Deployment:** [e.g., blue/green, canary]
- **Feature flags:** [tool, if any]

## Compliance & Regulatory (FSI)
- **Regulatory regime:** [e.g., a financial-services licensing regime such as AFSL/MiFID/FINRA]
- **Audit:** [audit-trail / change-traceability requirements]
- **Disclosures:** [customer disclosure obligations that shape requirements]
- **Data handling:** [PII classification, encryption at rest/in transit, residency]
- **Approvals:** [change advisory board / security sign-off]

## Definition of Done
- [ ] Code compiles and **authored** tests pass
- [ ] Each requirement has its test authored in the same wave
- [ ] Coverage meaningful (assertion quality, not line count)
- [ ] Reviewed (PR / pair sign-off) and merges cleanly to trunk
- [ ] No critical/high security findings
- [ ] Compliance/audit obligations satisfied
- [ ] [team-specific items]

## Non-Negotiables
- [e.g., "Trunk-based — no long-lived branches", "All infra as CDK TypeScript", "Every requirement has an authored test"]
```

---

## How This Feeds Downstream (the workflow honors it)

Once `team-practices.md` is filled in, it steers all three phases:

1. **Requirements:** acceptance criteria respect the **target** testing posture and encode compliance/disclosure constraints as requirements.
2. **Design:** architecture aligns with the stated stack/patterns; the Test Architecture and CI merge-gate reflect trunk-based delivery.
3. **Tasks + Construction:** generated code follows naming/structure/error/logging conventions; every wave pairs an authored test task using the stated frameworks (xUnit/Moq, Jest, Playwright, mobile).

### Steering Rule

Once captured, `aidlc-docs/team-practices.md` is **binding for the rest of the
workflow**. The **HONOR TEAM PRACTICES** core principle in `aidlc-workflow.md`
enforces it: before generating any design or code artifact, the agent consults
this file, surfaces (never silently overrides) conflicts, and treats the
**Testing Posture (target)** and **Non-Negotiables** sections as the standard the
per-phase testability/quality decisions and the Quality Gate Check hold each
requirement against.

---

## Workshop Facilitation Guide

Run Practices Discovery as a **10-minute whole-room exercise** at the start of
Day 1:
1. Project `team-practices.md` on screen.
2. Tech lead / architect fills **Tech Stack** and **Coding Conventions**.
3. QA lead fills **Testing Posture — current vs. target** (name the manual → authored shift out loud).
4. Delivery lead fills **Branching / Delivery** and **Definition of Done**.
5. Compliance rep fills **Compliance & Regulatory**.

This yields alignment (one agreed set of conventions), AI grounding (no
standard-violating output), and ownership (the team sees their practices in the
output).

**Facilitation note (illustrative FSI example):**
- Tech Stack: .NET 10 / C# backend, TypeScript Lambda, TypeScript frontend, mobile push app.
- Branching: **trunk-based (mandated)** — the merge gate must stay green without manual QA.
- Testing Posture: **current = manual, thrown over the fence; target = QA authors test code interleaved with features**. This is often the workshop's priority goal — capture it explicitly.
- Compliance: FSI-regulated — audit trail, customer disclosures, PII/data-handling.
- Coding standards + compliance arrive as **pre-work**; drop them straight into this file.

---

## Skip Conditions

- Skip if `aidlc-docs/team-practices.md` already exists (resume scenario).
- Skip if the team says "skip practices" / "we'll fill this in later".
- Greenfield POC with no existing team: generate a minimal version with just
  tech-stack and target testing-posture decisions.
