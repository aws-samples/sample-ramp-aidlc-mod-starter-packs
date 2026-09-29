# Canonicalization Report — `aws-iam`

Generated: 2026-09-30 · Skill: **aws-iam** · Role: canon-aws-iam

## Decision

**Canonical source = Source of Truth (agent-toolkit-for-aws), `version: "2"`.**
Copied full dir into `skills-library/aws-iam/` (5 files). SKILL.md verified present, md5 `97b4b151545cc6cc9f3c3f64af2dcd4f`.

## A vs B comparison (source-of-truth candidates)

| Candidate | Path | SKILL.md md5 |
|---|---|---|
| A | `agent-toolkit-for-aws/plugins/aws-core/skills/aws-iam` | `97b4b151545cc6cc9f3c3f64af2dcd4f` |
| B | `agent-toolkit-for-aws/skills/core-skills/aws-iam` | `97b4b151545cc6cc9f3c3f64af2dcd4f` |

**A and B are byte-identical** (SKILL.md + all 4 references match). Used **A** (arbitrary; either is equivalent). Both are `version: "2"`.

## In-repo variants (grouped by SKILL.md hash)

Enumerated via `find … -path '*/skills/aws-iam/SKILL.md' | grep -v scaffolded-packs` (9 variants, 2 distinct hashes). All in-repo variants are `version: 1`.

| Hash | Lines | Packs |
|---|---|---|
| `168d4b034c122a60b0190453ec6d6b4d` | 108 | web-app-on-cloudnative, legacy-transformation-on-aws, vulnerability-remediation-pipeline, framework-upgrade-containerise, dotnet-app-modernization-on-aws, qa-automated-testing, cots-rewrite-on-cloudnative, serverless-event-driven-on-aws (**8 packs**) |
| `33d889a5d400eb0767b65d837cebe8be` | 118 | agentic-incident-response (**1 pack**) |

References across BOTH in-repo variants are identical to each other; `aws-iam-role-management.md`, `common-pitfalls.md`, `service-authorization.md` also match source. Only `aws-iam-policy-generation.md` differs (in-repo `2e574b78…` 446 lines vs source `b8485e93…` 508 lines).

## Why source wins (source vs in-repo)

Despite the in-repo files carrying a fresher **Sep 30 bulk mtime** (source mtime Sep 22), the source is **substantively newer and richer**:

- **Version bump:** source frontmatter is `version: "2"`; every in-repo variant is `version: 1`.
- **Richer policy-generation reference:** source `aws-iam-policy-generation.md` is **508 lines vs 446** in-repo. Source adds first-class **Terraform plan JSON** support (`terraform show -json`), a generalized **"Input Gate"** (vs in-repo's narrower "Language Gate"), a new **Task 2b (generate policies from a Terraform plan)**, language-support-is-not-exhaustive guidance (`generate-policies --help` as source of truth), and an added secrets-handling MUST-NOT.
- **Refined description/trigger:** source expands the covered service-role list (adds VPC Flow Logs, Firehose, DataSync, S3 replication, Step Functions) and generalizes source-code language matching ("in any language" + Terraform plan JSON) vs the in-repo enumerated list.

The Sep 29/30 bulk modification did **not** make the in-repo copies newer in content — it is the older `version: 1` base. No in-repo variant is demonstrably newer than source.

## ⚠️ FLAGS

- **Pack-specific enrichment NOT in canonical (potential loss):** the `agentic-incident-response` variant (`33d889a5…`, +10 lines over the majority) adds a **"Bedrock cross-Region / global inference profiles"** section to the Common Pitfalls area — the three-resource-statement grant pattern for `global.*`/`<geo>.*` inference profiles, the empty `::` FM-ARN segments, and the `InvokeModel` + `InvokeModelWithResponseStream` requirement. This content is **absent from the source-of-truth v2** and was NOT merged into the canonical copy (out of scope: task restricts edits to `skills-library/aws-iam`). **Recommend** a follow-up to upstream this Bedrock guidance into the source-of-truth skill so it is not lost, or to retain it as pack-local steering for incident-response.
- All 8 majority packs + incident-response are `version: 1` and will be replaced by the `version: 2` canonical during restructure — expect a real content diff (Terraform plan JSON path) for consumers.

## Files written

`skills-library/aws-iam/` (5 files, copied from candidate A):

```
SKILL.md                                  (110 lines, md5 97b4b151545cc6cc9f3c3f64af2dcd4f)
references/aws-iam-policy-generation.md   (508 lines)
references/aws-iam-role-management.md
references/common-pitfalls.md
references/service-authorization.md
```

Verification: `SKILL.md` exists; dest md5 == source md5. Nothing outside `skills-library/aws-iam/` and this report was modified.
