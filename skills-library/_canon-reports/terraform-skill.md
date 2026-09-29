# Canonicalization Report — `terraform-skill`

**Date:** 2026-09-30
**Author (skill):** Anton Babenko (Apache-2.0)
**Canonical source written to:** `skills-library/terraform-skill/`

## ⚠️ Source-of-truth gap (flagged for human)

**No external source of truth exists for this skill.** Unlike other skills in this
restructure, `terraform-skill` is not present in either designated source repo
(`agent-plugins`, `agent-toolkit-for-aws`). The closest external artifact,
`agent-toolkit-for-aws/plugins/aws-startup-advisor/skills/tf-best-practices`, is a
**different skill** and was used only as a quality reference (see below) — it was
**not** copied or renamed.

Because there is no authoritative upstream, the canonical version was selected as the
**richest, most-correct, most-current in-repo variant**. A human should confirm this
choice and, ideally, designate/establish an upstream home for `terraform-skill` so
future drift can be resolved against a real source of truth.

## In-repo variants (3 distinct versions across 6 copies)

| SKILL.md md5 | Skill version | Packs | Files | Notes |
|---|---|---|---|---|
| `9b2dbb9b2eac076bdab0d2e84b988dcc` | 1.17.1 | `cots-rewrite-on-cloudnative`, `serverless-event-driven-on-aws`, `vulnerability-remediation-pipeline`, `web-app-on-cloudnative` | 9 (SKILL + 8 refs) | Diagnose-first workflow, Response Contract, full 8-reference set. **Missing** the "Execution Gotchas" section; older `security-compliance.md` (648L). |
| `cdb24c8a95082c119387ffe08339b443` | 1.17.1 | `agentic-incident-response` | 9 (SKILL + 8 refs) | **CHOSEN.** Strict superset of the `9b2d` group (see diff). |
| `10ef97e5d479f1ffa6f4c0540cf95561` | 1.6.0 | `agentic-ai-workflow` | 7 (SKILL + 6 refs) | Oldest. Comprehensive-prose style (pre diagnose-first rewrite). **Missing** `code-intelligence-lsp.md` and `state-management.md` references entirely; different/leaner reference content throughout. |

### What each variant has

- **`cdb2` (agentic-incident-response) — CHOSEN as canonical**
  - `metadata.version: 1.17.1`, diagnose-first design: Response Contract, Workflow,
    "Diagnose Before You Generate" routing table.
  - Full 8-reference set incl. `code-intelligence-lsp.md` (terraform-ls) and
    `state-management.md`.
  - **Adds `## Execution Gotchas (shell, packaging, guards)`** to SKILL.md — not present
    in any other variant: PowerShell `=`-flag mangling, `archive_file` zips-without-build
    trap, and a wrong-account/region `check`/`precondition` guard.
  - **Richer `security-compliance.md` (664L vs 648L)** — modern credential guidance
    (IAM Identity Center / SSO, instance/task roles, CI OIDC federation, `aws-vault`),
    runtime `TF_VAR_` secret injection from a secret manager, expanded `.gitignore`
    (`*.tfvars.json`, `.env.*`), and secret-scanner warnings (incl. AWS `AKIA…EXAMPLE`
    keys) plus two added LLM-mistake-checklist rows.

- **`9b2d` (4 packs)** — identical to `cdb2` **except** it lacks the Execution Gotchas
  section and carries the older `security-compliance.md`. All other 7 reference files are
  byte-identical to `cdb2`. (This is the most *widespread* variant but not the richest.)

- **`10ef` (agentic-ai-workflow)** — a prior generation (v1.6.0) before the diagnose-first
  rewrite. No Response Contract, no routing table, no Code Intelligence section, and 2
  fewer reference files. Clearly the least current.

### SKILL.md diff — chosen (`cdb2`) vs widespread (`9b2d`)

Only difference is `cdb2` **adds** (superset, nothing removed):

```
## Execution Gotchas (shell, packaging, guards)
- PowerShell mangles `=`-style flags … quote the whole flag.
- `archive_file` / asset bundling zips a directory as-is — it does not build.
- Guard against applying to the wrong account/region (check block / precondition).
```

### `security-compliance.md` diff — chosen (`cdb2`) vs widespread (`9b2d`)

`cdb2` replaces the old "Environment Variables / export static keys" subsection with a
modern **"Credentials & secret variables"** subsection (role-based/short-lived creds,
OIDC, `aws-vault`, runtime secret injection), expands the `.gitignore` list, and adds
secret-scanner guidance + 2 extra LLM-mistake-checklist entries. Purely additive/upgraded
— no correct content was dropped.

## Chosen canonical & justification

**Chosen:** `agentic-incident-response` variant (md5 `cdb24c8a95082c119387ffe08339b443`).

**Why:** It is a **strict superset** of the most widespread `9b2d` variant (same v1.17.1
diagnose-first base + all 8 references, identical for 7 of 8 files) while additionally
carrying (a) the operationally valuable **Execution Gotchas** section and (b) a **more
current, security-hardened `security-compliance.md`**. It dominates the `9b2d` group on
content and dominates the `10ef` group on both currency (1.17.1 vs 1.6.0) and completeness
(8 refs vs 6). No content was invented — the canonical is an exact copy of an existing
in-repo variant.

## Quality comparison vs `tf-best-practices` (external reference only)

`tf-best-practices` (in `agent-toolkit-for-aws/plugins/aws-startup-advisor`) is a **different
skill with a different purpose**: a source-cloud-agnostic **read-only policy gate + posture
rules** for *generated* AWS Terraform, shipping `.tf` pass/fail **fixtures** and Python
**validation scripts** (`validate-terraform-policy.py`). It is a deterministic verdict
producer/authoring spec, whereas `terraform-skill` is a broad **authoring, diagnosis, testing,
CI/CD and state** guidance skill. Observations:

- `tf-best-practices` is stronger on *enforceable, tested* security posture (executable
  policy checks with good/bad fixtures) — a pattern `terraform-skill` could learn from
  (potential future enhancement: ship executable checks).
- `terraform-skill` is far broader and more current on general Terraform/OpenTofu practice
  (modules, state, testing, version-floor guards, code intelligence).
- They are complementary, **not** substitutes. `tf-best-practices` was **not** copied,
  merged, or renamed — used purely as a quality benchmark per instructions.

## Files written

Copied the full canonical directory (`cp -R`) into `skills-library/terraform-skill/`.
**9 files** total (verified `SKILL.md` present, 314 lines):

```
skills-library/terraform-skill/
├── SKILL.md
└── references/
    ├── ci-cd-workflows.md
    ├── code-intelligence-lsp.md
    ├── code-patterns.md
    ├── module-patterns.md
    ├── quick-reference.md
    ├── security-compliance.md
    ├── state-management.md
    └── testing-frameworks.md
```

Nothing outside `skills-library/terraform-skill/` and this report was modified.
