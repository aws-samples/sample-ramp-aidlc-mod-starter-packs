---
name: incident-triage
description: "Interpret production incident tickets and monitoring alerts, identify the affected application or business flow, retrieve and correlate evidence (logs, telemetry, source code context, configuration, deployment history, known issues), and produce an evidence-backed incident analysis: summary, probable root-cause hypotheses with confidence indicators, impacted components, recommended diagnostic/remediation steps, and routing or escalation guidance. Triggers on phrases like: production incident, incident ticket, triage this alert, root cause, RCA, correlate logs, what broke, error spike, latency spike, transaction failed, timeout, outage, sev1/P1, escalate, on-call, anomaly detection, alert threshold, known issue, postmortem. Use whenever a production issue, alert, or incident report is being analyzed — even if the user just pastes an error message, a stack trace, a screenshot description, or asks 'why are customers seeing this error?'"
---

# Incident Triage & Analysis

Turn a raw incident signal — a ticket, a monitoring alert, a user complaint, a chat escalation — into an **evidence-backed incident analysis** a support engineer can act on. This is the analysis brain of the incident-response pipeline: it decides *what is affected*, *what evidence to pull*, *what probably caused it*, and *who should act next* — with confidence stated honestly.

> **Where this runs:** this is the logic the pipeline's **triage and analysis** stages automate (encoded into Lambda/Bedrock steps orchestrated by Step Functions or durable functions). It is equally valid run interactively when designing or validating those stages.

## Why this skill exists

The manual process it replaces depends on the right person being available: support engineers with different levels of application knowledge must decide which logs, transaction records, or configuration to pull for a given symptom, and complex incidents wait for an SME who can read the source code and compare designed behavior with observed behavior. Each of those steps is repeatable — *if* you apply a consistent intake taxonomy, a disciplined evidence-collection checklist, and an honest hypothesis standard. That is exactly what this skill supplies, so first-response quality no longer depends on who happens to be on call at 3 a.m.

## The triage pipeline (do these in order)

1. **Interpret the signal** — normalize the ticket/alert into a uniform incident record; classify severity.
2. **Identify the affected flow** — map symptoms to the application, service(s), and business flow involved.
3. **Gather & correlate evidence** — logs, metrics, traces, recent deployments, configuration changes, dependency status, known issues — scoped to a time window and correlation keys.
4. **Hypothesize root cause** — generate ranked, evidence-backed hypotheses with explicit confidence; never a single unqualified verdict.
5. **Recommend & route** — concrete next diagnostic or remediation steps, plus routing/escalation guidance.
6. **Emit the incident analysis report** — the structured artifact the human reviewer consumes and the audit trail stores.

Do not skip straight from a symptom to a fix. An unverified guess presented confidently is worse than no analysis: it burns the on-call engineer's trust and sends the investigation down the wrong path.

## Step 1 — Interpret the signal

Incidents arrive through many channels (monitoring alerts, ticketing, user/client reports, chat, calls). Normalize every intake into one record so downstream steps are channel-agnostic:

`{ incidentKey, source, reportedAt, symptomSummary, affectedUsersOrTxns, timestamps[], errorMessages[], screenshotsOrAttachments[], environment, reporterContext, severityInitial }`

- Extract **timestamps** (and time zone!), **error text verbatim**, affected **user/transaction identifiers**, and the **channel/feature** the reporter was using.
- Distinguish *symptom* ("transfer stuck on processing") from *claim* ("the database is down") — record claims, but treat only observations as evidence.
- Assign an **initial severity** from customer impact and scope using the classification rules in [references/severity-and-escalation.md](references/severity-and-escalation.md). Severity can move up or down as evidence lands — record every change with the reason.
- If mandatory fields are missing (no timestamp, no affected user/txn, no error text), the analysis must say so and list what to request — do not fabricate.

## Step 2 — Identify the affected flow

Map the normalized symptom onto the system model:

1. **Business flow** — which user journey is failing (e.g., login, balance inquiry, intra-bank transfer, bill payment, onboarding/KYC)?
2. **Entry point** — which channel/app and which API route or gateway ingress serves that flow?
3. **Service path** — which microservices, orchestrated workflows, message queues/topics, data stores, and external/third-party dependencies sit on that path (including core-banking or partner systems reached over private links)?

Maintain (or bootstrap during design) a **flow-to-component map**: `business flow → ingress → services → queues/topics → data stores → external dependencies`. When the pipeline is built, this map is a versioned artifact the analysis stage loads; when running interactively, derive it from the architecture docs or Phase 0 reverse-engineering output and say which parts are assumed.

If the symptom maps to multiple plausible flows, keep all candidates and let the evidence in Step 3 discriminate — record the ambiguity in the report.

## Step 3 — Gather & correlate evidence

Collect evidence per the checklist in [references/evidence-correlation.md](references/evidence-correlation.md). The non-negotiables:

- **Scope a time window** around the first symptom timestamp (default: −30 min / +15 min; widen only with reason).
- **Correlate by keys, not vibes** — request/correlation IDs, trace IDs, user/transaction IDs, and only then by timestamp proximity.
- **Pull all seven evidence classes** before concluding: (1) application logs, (2) metrics/telemetry, (3) traces, (4) deployment history, (5) configuration & feature-flag changes, (6) dependency/infrastructure status (queues, data stores, external systems), (7) known issues & prior incidents.
- **Compare designed vs. observed behavior** — when source code or workflow definitions are available, read the code path for the affected flow and state explicitly where observed behavior diverges from the implementation's intent. This is the SME step the pipeline exists to de-bottleneck.
- Mark every evidence item with **provenance** (where it came from, query used, time range) so a human can re-run it.

## Step 4 — Hypothesize root cause

Produce **ranked hypotheses**, not a verdict. Each hypothesis carries: statement, supporting evidence (by reference), contradicting evidence, confidence (HIGH / MEDIUM / LOW with stated reasons), and the cheapest **discriminating test** that would confirm or kill it. Format and scoring rules live in [references/rca-hypothesis-format.md](references/rca-hypothesis-format.md).

Ordering heuristics (apply, then let evidence override):

- **What changed recently wins** — a deployment, config change, feature flag, certificate rotation, or dependency-side change inside the window is the prior to beat.
- **Shared-infrastructure symptoms** (many flows failing at once) point at platform layers: cluster capacity, message broker, database, network/connectivity, auth provider.
- **Single-flow symptoms** point at that flow's service code, its specific queue/topic, or its specific external dependency.
- A hypothesis with **no supporting evidence class** must be labeled speculation and ranked last — or dropped.

## Step 5 — Recommend & route

- **Diagnostic next steps** — the discriminating tests from Step 4, ordered by information-per-effort; each with the exact query/command where possible.
- **Remediation candidates** — only for hypotheses at MEDIUM confidence or above; state blast radius and rollback for each. The pipeline **proposes**; a human approves and executes (autonomy level is a design-gate decision, not this skill's call).
- **Routing & escalation** — which team/SME owns the implicated component, and whether severity requires escalation now (rules in [references/severity-and-escalation.md](references/severity-and-escalation.md)).
- **Communication cue** — for customer-impacting severities, note that stakeholder/client comms are due (the comms channel integration itself may be a later-phase feature).

## Step 6 — Emit the incident analysis report

The single artifact everything above feeds. Required sections:

1. **Incident summary** — one paragraph: what, when, who is affected, current severity.
2. **Affected flow & impacted components** — from Step 2, with confidence.
3. **Evidence table** — each item: class, source, time range, finding, provenance.
4. **Ranked root-cause hypotheses** — from Step 4, with confidence and discriminating tests.
5. **Recommended next actions** — diagnostics, remediation candidates, routing/escalation.
6. **Gaps & requests** — missing evidence, access not available, questions for the reporter.

The report is append-only input to the audit trail; subsequent analysis runs supersede but never overwrite it.

## Anomaly & error detection (proactive mode)

The same analysis applies when the trigger is a **monitoring signal** rather than a ticket:

- Detection rules are **configurable thresholds/conditions** over metrics and log patterns (error-rate %, p95/p99 latency, queue depth/age, consumer lag, absence-of-traffic, error-signature match). Keep rules as versioned configuration — not hard-coded — so support teams can tune them without redeploying.
- A rule firing creates a **candidate incident** that enters this pipeline at Step 1 with the alert payload as the intake record; deduplicate against open incidents by flow + signature + window before creating a new one.
- Every rule needs an owner, a rationale, and a review cadence — an unowned alert becomes noise. Alert fatigue is a failure mode of the design, not of the operator.

## Boundaries & honesty rules

- **Never assert a root cause without naming its evidence.** "Probable cause X (MEDIUM confidence): supported by E2, E4; contradicted by nothing yet; discriminator: …" is the required shape.
- **Never auto-execute remediation** from this skill. Analysis and recommendation only; execution autonomy is decided at the design gate and always keeps a human approval for production actions.
- **Say what you could not see.** If logs were unavailable, retention expired, or access was denied, the report must list it under Gaps — an analysis silent about its blind spots is misleading.
- **Respect data sensitivity.** Incident evidence in a financial system contains PII and transaction data: quote the minimum needed, mask account identifiers in reports, and never move raw production data outside approved boundaries.
