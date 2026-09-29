# Severity Classification, Routing & Escalation

The standard for assigning incident severity at intake (Step 1), moving it as evidence lands, and deciding who acts next (Step 5). Calibrate the concrete thresholds with the support organization at the Requirements gate — the *structure* below is the reusable part.

## Severity levels

Severity is a function of **customer impact × scope × availability of workaround**, biased by regulatory sensitivity for financial flows.

| Level | Definition | Examples | Response posture |
|-------|------------|----------|------------------|
| **P1 — Critical** | Core money-movement or authentication flow down or materially wrong for many/all customers; no workaround; or suspected data integrity / security breach | Transfers failing bank-wide; login outage; duplicate debits; balance display wrong | Immediate escalation + incident bridge; comms clock starts; SME paged regardless of hours |
| **P2 — High** | Core flow degraded (slow, intermittent) or fully down for a subset; workaround exists but is painful | Transfers succeeding on retry only; one channel (mobile) down, web up; payments to one partner failing | Escalate to owning team now; SME engaged within the response SLA; comms if customer-visible |
| **P3 — Medium** | Non-core flow impaired, or cosmetic/functional defect with a reasonable workaround; single-customer technical issues | Statement download failing; notification delays; one corporate client's file upload rejected | Normal support queue with target SLA; batch with related issues |
| **P4 — Low** | No current customer impact; anomaly worth tracking; hygiene | Elevated retries self-recovering; disk trending to full in 2 weeks; noisy log warning | Backlog; feed into problem management |

Modifiers (apply after the base classification):

- **Financial-integrity suspicion** (money moved wrongly, double-processing, reconciliation break) → floor at **P2**, involve the reconciliation/finance-ops owner immediately.
- **Suspected security event** (auth bypass, data exposure, anomalous access) → classify via the security incident process *in parallel*; do not sit on it while debugging.
- **Regulatory/reporting window at risk** (e.g., mandated availability or reporting deadlines) → raise one level.
- **Recurrence of a known P1/P2 signature** → intake at the prior severity, cite the prior incident.

Severity is **re-evaluated when evidence changes scope** — record every change and its reason in the audit trail. Downgrade needs the same rigor as upgrade.

## Routing

Route to the **owner of the most-implicated component**, not to whoever was easiest to reach:

1. From the analysis report: highest-confidence hypothesis → implicated component → owning squad/team from the ownership map.
2. Confidence LOW across the board, or evidence points at shared infrastructure → route to the platform/SRE function with the evidence table, not to an application squad.
3. Third-party / external dependency implicated → route to the integration owner **and** open the vendor/partner channel with the evidence extract.
4. Multiple components implicated → one **lead owner** (the component closest to the customer symptom) with named supporting teams. Never split ownership evenly; split incidents stall.

Maintain the **component-ownership map** as a versioned artifact alongside the flow-to-component map (owning team, escalation contact, SME roster, working hours per component). The pipeline loads it; humans keep it current — a stale map is a routing bug.

## Escalation triggers

Escalate (up a support tier, or laterally to an SME/manager) when **any** of:

- P1 at any time; P2 outside the owning team's working hours.
- Analysis confidence is LOW **and** severity is P2+ — an uncertain serious incident is exactly when the SME is needed.
- The discriminating tests for the top hypotheses need access or knowledge the current responder lacks.
- No progress within the severity's response SLA (define per level at the Requirements gate: e.g., P1 15 min, P2 1 h, P3 next business day).
- The same incident signature re-fires after a "resolved" — auto-reopen at one level higher.

Escalation is a **cheap, reversible act** — the pipeline should make it low-friction and blame-free. The expensive failure is the 4-hour solo struggle on a P2 at 2 a.m.

## What the pipeline may do autonomously

| Action | Autonomy |
|--------|----------|
| Classify/reclassify severity, generate analysis, recommend steps | Autonomous — always human-reviewable |
| Create/route the incident record, notify the owning team, page for P1/P2 | Autonomous per configured rules |
| Request more information from the reporter | Autonomous (templated) |
| Execute diagnostics that are strictly read-only | Design-gate decision; default allow with logging |
| Any state-changing remediation in production (restart, rollback, config change, data fix) | **Never autonomous** — human approval gate, always |

## Communication cues

- P1/P2: the analysis report flags that stakeholder/client communication is due and drafts a factual status note (what is affected, since when, workaround if any, next update time). Sending it stays with humans until the comms integration is explicitly built and approved (a later-phase feature by default).
- Never include unmasked customer identifiers, account numbers, or raw transaction payloads in outbound comms or chat channels — reference the incident record instead.
