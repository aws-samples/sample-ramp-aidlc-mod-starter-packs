# Root-Cause Hypothesis Format & Confidence Scoring

The standard for Step 4 of the triage pipeline. The output is a **ranked list of hypotheses**, each falsifiable, each tied to evidence, each with an honest confidence label. One hypothesis presented as certainty is the anti-pattern this format exists to prevent.

## Hypothesis record

```markdown
### H1 — <one-line causal statement>  `[MEDIUM confidence]`

**Mechanism:** <how this cause produces the observed symptoms, step by step>
**Supports:** E2 (error signature X first appears 14:02), E4 (service v2.31.0 deployed 13:58)
**Contradicts:** E3 (trace shows downstream call succeeding for some requests)
**Discriminating test:** <the cheapest check that confirms or kills this — exact query/command>
**If confirmed → next action:** <diagnostic or remediation candidate, with blast radius>
```

Rules:

- **Causal statement is specific**: "connection pool exhausted in payment-service after v2.31.0 halved the pool size" — not "database issues".
- **Every hypothesis references evidence items by ID** (E1…En from the evidence table). No reference → label it *speculation* and rank it last or drop it.
- **Contradicting evidence is mandatory to look for.** An analysis that only lists supporting evidence is advocacy, not analysis.
- **Discriminating tests are ordered by information-per-effort** — prefer a 30-second log query over a service restart that destroys the evidence.
- 2–4 hypotheses is the healthy range. One means overconfidence; six means the evidence step was skipped.

## Confidence rubric

| Level | Criteria |
|-------|----------|
| **HIGH** | Mechanism fully explains all major symptoms; ≥2 independent evidence classes support it; no unexplained contradicting evidence; timeline lines up (cause precedes effect). |
| **MEDIUM** | Mechanism explains most symptoms; ≥1 evidence class supports it; contradictions exist but are plausibly explainable; some timeline gaps. |
| **LOW** | Plausible mechanism but supported mainly by timestamp proximity or pattern-matching to past incidents; key evidence unavailable. |

Confidence modifiers:

- **Recent-change alignment** (deploy/config/flag/cert inside the window that touches the implicated component): +1 level, capped at HIGH.
- **Evidence gap on the critical path** (the one log/metric that would settle it is missing): −1 level, and list the gap in the report.
- **Prior identical incident with confirmed cause**: may justify HIGH with fewer evidence classes — cite the prior incident ID.

Never present HIGH when the discriminating test hasn't been run but *could* be. Run it or stay at MEDIUM.

## Common cause taxonomy (prompts for hypothesis generation)

Use as a checklist so the obvious families are considered — not as a menu to copy blindly:

- **Change-induced:** new deployment/rollback, config or parameter change, feature flag flip, schema migration, dependency version bump, certificate/key rotation.
- **Capacity & saturation:** connection-pool exhaustion, memory leak/OOM, disk full, thread starvation, cluster node pressure/eviction, autoscaling lag or ceiling.
- **Dependency failure:** database (locks, failover, replication lag), cache eviction/restart, message broker (down consumer, full queue, partition imbalance), external/partner API degradation, core-system maintenance windows.
- **Data-shaped:** poison message, malformed input, unexpected null/encoding, payload exceeding limits, timezone/DST edge, duplicate/out-of-order delivery.
- **Network & auth:** DNS, expiring VPN/private-link tunnels, security-group/firewall change, token/session expiry, clock skew breaking signatures.
- **Load-shaped:** traffic spike (campaign, batch window, month-end), retry storm amplifying a small failure, thundering herd after recovery.

## Impacted-components statement

Alongside hypotheses, state the impact map with its own confidence:

```markdown
**Impacted:** transfer flow (confirmed — E1, E5); payment-service (confirmed — E2);
notification-service (suspected — delayed but not failing, E6).
**Not impacted:** login, balance inquiry (verified normal — E7).
```

"Not impacted (verified)" entries matter as much as impacted ones — they bound the blast radius and often kill wrong hypotheses.

## Recommendation gating

- Remediation candidates may only attach to hypotheses at **MEDIUM or above**.
- Every remediation candidate states: action, expected effect, **blast radius**, rollback plan, and whether it destroys evidence (restarts and redeploys usually do — capture state first).
- The pipeline proposes; **a human approves anything that touches production**. This is non-negotiable regardless of the autonomy level chosen at the design gate.
