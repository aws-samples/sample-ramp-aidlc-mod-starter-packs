---
name: gitlab-mr
description: "Locate GitLab vulnerability reports and deliver remediations back to GitLab — branch/commit strategy, raising merge requests via glab CLI, the GitLab REST API, or a GitLab MCP, MR descriptions that carry the triage rationale, and optional write-back of dispositions (dismiss/comment findings). Triggers on phrases like: raise MR, merge request, glab, GitLab API, create branch, commit the fix, where is the vulnerability report, CI artifacts, security dashboard, dismiss finding, write back to GitLab, MR description, one MR per group vs batched. Use whenever fetching a GitLab security report or delivering a fix/disposition to GitLab, even if the user just says 'open the MR' or 'where's the report'."
---

# GitLab Merge Requests & Report Delivery

The delivery arm of the pipeline. Two jobs: (1) **get the vulnerability report** out of GitLab at intake, and (2) **deliver remediations back** — a branch, commits, a merge request carrying the triage rationale, and (optionally) writing dispositions onto the GitLab vulnerability records.

> **Where this runs:** this is the logic the pipeline's **intake** and **deliver** stages automate. It is equally valid run interactively when designing or validating those stages.

**Input:** the triage backlog (from `vulnerability-triage`) and applied, verified fixes (from `dependency-remediation`). **Output:** one or more MRs, plus optional GitLab write-back for false-positives/accepted risks.

## Choose the access method

Three ways to talk to GitLab; pick what the environment has, in this order:

1. **GitLab MCP** (if enabled in this pack) — the agent calls MCP tools directly. Cleanest when configured. It's **disabled by default** in `pack.yaml`; the user enables it with a scoped token.
2. **`glab` CLI** — if `glab` is installed and authenticated (`glab auth status`). Ergonomic for branches, MRs, and CI artifacts.
3. **REST API** via `curl` — always available with a token; the universal fallback.

Detect and confirm before acting: `glab auth status` or a token presence check. Never hardcode or echo tokens — reference them as `$GITLAB_TOKEN` / the MCP's configured credential.

## Job 1 — Locate & fetch the report (intake)

The report is a CI artifact and/or a security-dashboard entry. Find it without assuming a path:

- **CI artifact:** dependency scanning writes `gl-dependency-scanning-report.json` (and siblings for SAST/container/secret) as a job artifact. Fetch the latest via `glab` or the API.
- **Security Dashboard / Vulnerability Report:** the aggregated, deduplicated findings view (may already merge across scans).
- **Committed file:** sometimes the report is committed or attached — check the repo/MR.

Exact commands (glab artifact download, API job-artifacts endpoint, which ref to pull from) → [references/report-locations-and-ci.md](references/report-locations-and-ci.md). Hand the fetched JSON to `vulnerability-triage`.

## Job 2 — Branch & commit strategy

Decide granularity from the workflow's approved decisions (the workflow *asks*; don't assume):

- **One MR per triage group** — cleanest review, independent revert, per-CVE traceability. Best default for high/critical fixes.
- **Batched MR** (e.g. all P1s, or "all patch/minor bumps") — fewer pipelines, good for low-risk bulk bumps. Keep batches coherent (same risk class).

Branch naming (consistent, greppable):
```
security/<CVE-or-GHSA>-<package>          # per group,  e.g. security/CVE-2021-23337-lodash
security/<report-id>-batch-<tier>         # batched,     e.g. security/2024Q2-batch-p1
```

Commit messages carry the finding id so history is auditable:
```
fix(deps): bump lodash 4.17.19 → 4.17.21 (CVE-2021-23337)

Prototype pollution in _.template. Direct-parent bump; no API changes.
Verified: npm ci ✓, npm audit clears ✓, npm test ✓ (142 passed).
Refs: V-01
```

Commit **`package.json` and the lockfile together**; for code fixes, keep the diff surgical. `glab`/API command sequences for creating branches and commits → [references/glab-and-api.md](references/glab-and-api.md).

## Job 3 — Raise the merge request

The MR body is the payoff of the whole pipeline: it makes review fast because the rationale is already there. Every MR must carry, per included group: CVE/GHSA, package, version change, remediation shape, breaking-change assessment, and verification evidence.

Use the template in [references/mr-templates.md](references/mr-templates.md). Minimum viable MR description:

```markdown
## Security remediation — <group id(s)>
Fixes <CVE/GHSA> (<severity>, EPSS <x>) in `<package>`.

**Change:** `<from>` → `<to>` (<patch|minor|major>, <direct bump|parent bump|override|code fix>)
**Breaking-change assessment:** <none | summary>
**Verification:** npm ci ✓ · npm audit clears ✓ · npm test ✓ (<n> passed) · build ✓
**Triage ref:** <backlog id> · **Report:** <link>
```

Set the target branch, reviewers, and any required labels per the project. Link the MR back to the vulnerability record where the platform supports it, so the dashboard reflects the in-flight fix.

## Job 4 — Write dispositions back to GitLab (optional)

Only if the workflow's decisions enabled write-back. This closes the loop for findings that aren't code changes:

- **FALSE POSITIVE** → dismiss the vulnerability with the justification (from the triage FP template) as the dismissal reason/comment.
- **ACCEPT/DEFER** → comment the risk acceptance + revisit trigger; dismiss with the appropriate reason if your workflow uses that.
- **FIX** → link the MR to the finding; the finding resolves when the fix merges and the next scan confirms.

Dismissal is a GraphQL mutation (`vulnerabilityDismiss`) or via the MCP/UI; REST coverage is limited. Exact calls, reason enums, and cautions → [references/dispositions-writeback.md](references/dispositions-writeback.md).

**Write-back is a mutation of security records — treat it as higher-risk:** confirm the workflow enabled it, never dismiss without the recorded justification, and log every write-back to the audit trail.

## Quick reference

| Need | Do this |
|---|---|
| Get the report | glab/API job artifact `gl-*-report.json` (references/report-locations-and-ci.md) |
| Create branch + commit | `security/<CVE>-<pkg>`; commit manifest+lockfile with CVE in message |
| Per-group vs batched | Follow the workflow's approved decision; per-group for high/critical |
| Raise MR | Template with change + assessment + verification (references/mr-templates.md) |
| Dismiss a false positive | GraphQL `vulnerabilityDismiss` w/ justification (references/dispositions-writeback.md) |
| Auth | `glab auth status` / `$GITLAB_TOKEN` / MCP credential — never echo tokens |

## Common mistakes

- **Assuming the report path.** Discover it via CI artifacts / dashboard; filenames and refs vary.
- **One giant MR for everything.** Kills reviewability and revertability. Prefer per-group (or coherent risk-class batches).
- **MR body without rationale.** If the reviewer has to re-derive severity and verification, the pipeline saved nothing. Carry the triage evidence.
- **Dismissing findings without the justification** or without the workflow enabling write-back. Mutating security records needs the recorded reason and an audit entry.
- **Echoing the token** in commands or logs. Reference it by variable/credential only.
- **Committing the manifest without the lockfile** (or vice versa). They must travel together or `npm ci` breaks.
