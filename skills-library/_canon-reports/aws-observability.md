# Canonicalization Report — `aws-observability`

Date: 2026-09-30
Session: canon-aws-observability

## Decision

**Canonical = source-of-truth, copied verbatim.** Candidates A and B are byte-identical, so
either serves; used A. Written to `skills-library/aws-observability/` (68 files).

## Step 1 — Source-of-truth: A vs B

| | Candidate A | Candidate B |
|---|---|---|
| Path | `agent-toolkit-for-aws/plugins/aws-core/skills/aws-observability` | `agent-toolkit-for-aws/skills/core-skills/aws-observability` |
| SKILL.md md5 | `71720a9f7752c19aaa823f38e86ec75a` | `71720a9f7752c19aaa823f38e86ec75a` |
| Version | 6 | 6 |
| File count | 68 | 68 |

**A and B are byte-identical across all 68 files** — every per-file md5 matches (SKILL.md,
`assets/cloudwatch/`, `references/cloudwatch/` incl. 16 appsignals-guides + dynamic-instrumentation,
`references/cloudwatch-omni/` incl. `query/`, and `scripts/cloudwatch/` + `scripts/cloudwatch-omni/`).
No content decision needed between them. Chose **A** (`plugins/aws-core/...`) arbitrarily since identical.

## Step 2 — In-repo variants (excluding scaffolded-packs)

8 variants, two hash groups:

| SKILL.md md5 | Version | Packs |
|---|---|---|
| `7ad7e0c7c68a3877069b4b018b79b983` | 2 | cots-rewrite-on-cloudnative, dotnet-app-modernization-on-aws, framework-upgrade-containerise, legacy-transformation-on-aws, serverless-event-driven-on-aws, vulnerability-remediation-pipeline, web-app-on-cloudnative |
| `7e0c455deaf63ef5cdca0a13469953a5` | 2 | agentic-incident-response |

Neither in-repo group matches the source (`71720a9f...`, v6) — all in-repo copies are the
older **version 2** and have **drifted behind** the source of truth.

## Step 3 — Content comparison

- **Source (v6)** is substantially more complete and current: it covers **two products** —
  classic CloudWatch **and** CloudWatch Omni — with a scope guard, a Step 0 product-routing
  decision tree, Step 0.5 service-health routing, agent-quality evaluation, context graph,
  and structured `references/cloudwatch/` + `references/cloudwatch-omni/` subtrees plus
  executable `scripts/`. Directory layout: `references/cloudwatch/...` (nested).
- **In-repo v2 (both groups)** cover only classic CloudWatch, use a **flat** `references/`
  layout (`references/application-signals-onboarding.md`, `references/alarms.md`, etc.), and
  have no Omni content, no scripts, no scope guard. Structurally divergent and older.
- The v6 source's frontmatter also cross-references the related skill
  `setting-up-cloudwatch-observability` for first-time Omni setup.

## Related skill

`agent-toolkit-for-aws/skills/core-skills/setting-up-cloudwatch-observability` — **confirmed
to exist**. Per instructions it was **NOT merged**. The canonical SKILL.md already references
it for first-time Omni setup (creating a Space/Domain, access grants, ingestion, ADOT
instrumentation), so the routing boundary is intact.

## Flags / pack-specific value

- **agentic-incident-response** (group `7e0c455d...`) is the only variant with unique
  additive content: an extra **"Logs Insights query gotchas"** section in SKILL.md covering
  Log Insights ingestion latency, the pre-creation-time window `MalformedQueryException`,
  metrics-vs-logs reliability, and collector diagnostics distinguishing failed / zero-rows /
  still-running. This content is genuinely useful and non-conflicting, **but was NOT blended**
  into the canonical version because:
  1. Instructions direct to STRONGLY PREFER source-of-truth and not blend unless clearly additive into the same structure.
  2. It was authored against the v2 flat structure; the v6 source has fully reorganized
     routing and already owns Log Insights depth in `references/cloudwatch/log-insights.md`.
  **Recommendation for a maintainer:** consider folding these gotchas into the canonical
  `references/cloudwatch/log-insights.md` (or a callout in SKILL.md) in a follow-up, verified
  against the v6 structure — do not paste verbatim.
- All 8 in-repo packs are on v2 and must be repointed at the shared v6 canonical during the
  repo restructure; their flat `references/` copies are stale.

## Files written

- Destination: `skills-library/aws-observability/`
- SKILL.md present: **yes** (`71720a9f7752c19aaa823f38e86ec75a`, matches source)
- Total files: **68** (matches source 68)
- Top-level layout: `SKILL.md`, `assets/cloudwatch/`, `references/cloudwatch/`,
  `references/cloudwatch-omni/` (+ `query/`), `scripts/cloudwatch/`, `scripts/cloudwatch-omni/`
- Nothing else in the repo was modified.
