# Canonicalization Report: `aws-lambda`

**Date:** 2026-09-30
**Skill:** aws-lambda
**Source of truth:** `/Users/feffendi/Documents/GitHub/agent-plugins/plugins/aws-serverless/skills/aws-lambda`
**Canonical written to:** `skills-library/aws-lambda/` (SKILL.md + 9 references = 10 files)

## In-repo variants (SKILL.md hashes → packs)

Enumerated via `find … -path '*/skills/aws-lambda/SKILL.md' | grep -v scaffolded-packs`, then `md5`.

| SKILL.md md5 | Count | Packs |
|---|---|---|
| `79b098cef23b56c2fd3a0be6a6dc645a` | 8 | cots-rewrite-on-cloudnative, genai-on-serverless, legacy-transformation-on-aws, ocr-mobile-app-on-serverless, qa-automated-testing, serverless-event-driven-on-aws, vulnerability-remediation-pipeline, web-app-on-cloudnative |
| `a60179913ccab35e75b02016d5a3ee1d` | 1 | agentic-incident-response (outlier) |
| **`f4b668b87448296f074d6c11f9cfba2e`** | — | **SOURCE OF TRUTH (agent-plugins) — chosen canonical** |

All 9 in-repo variants carry 11 reference files. The source of truth carries 9 (see divergences).

## Chosen source & rationale

**Chosen: source of truth (agent-plugins), copied verbatim. No blending.**

Per the "STRONGLY PREFER source-of-truth" directive, and because the SOT is demonstrably the more current and better-architected version:

1. **SOT is newer** — it adds *Lambda Managed Instances (LMI)* to both the key-capabilities list and the reference-loading table; none of the in-repo variants have it.
2. **SOT delegates Step Functions to a sibling skill** rather than bundling it. SOT points to a separate `aws-step-functions` skill (`../aws-step-functions/`); the in-repo variants instead inline `references/step-functions.md` and `references/step-functions-testing.md`. The shared `skills-library/` restructure is a sibling-skill model (an `aws-step-functions` skill exists in the SOT plugin and is expected to be canonicalized alongside this one), so SOT's delegation is the architecturally correct choice — the Step Functions content is not lost, it lives in the sibling skill.
3. SOT likewise delegates SAM/CDK deployment to the `aws-serverless-deployment` sibling skill and durable functions to `aws-lambda-durable-functions` — both already present as siblings in the library.

## Flagged divergences (NOT blended — noted for maintainer review)

### 1. Bundled Step Functions references dropped (all 8 majority variants + outlier)
In-repo variants ship `references/step-functions.md` and `references/step-functions-testing.md` inside the aws-lambda skill. The canonical version does **not**, delegating to the sibling `aws-step-functions` skill. **Action for maintainers:** ensure `skills-library/aws-step-functions/` is canonicalized so this content is preserved at the library level. No content should be lost, only relocated.

### 2. Additive operational knowledge in `agentic-incident-response` outlier (NOT included)
The outlier variant (`a60179…`) adds genuinely useful, clearly-additive content absent from SOT:
- A **"Packaging & Dependencies"** best-practices subsection: cross-account/public Lambda layer usage requires `lambda:GetLayerVersion` on the *deploying* identity; vendoring deps into the package for locked-down CI/sandbox roles; not vendoring `boto3`/`botocore`; runtime asset-path resolution.
- A **troubleshooting row** for `AccessDeniedException: … lambda:GetLayerVersion` on `CreateFunction`/`UpdateFunctionConfiguration`.

This was intentionally **not blended** to keep the canonical byte-identical to the maintained upstream and avoid re-introducing drift. **Recommendation:** upstream this content into the agent-plugins SOT (`Best Practices` + `Troubleshooting Quick Reference`), after which it flows into the library on the next canonicalization. It is worth preserving.

## Verification

- `skills-library/aws-lambda/SKILL.md` exists — confirmed.
- SKILL.md md5 = `f4b668b87448296f074d6c11f9cfba2e` (matches SOT) — confirmed.
- Files written: **10** (1 SKILL.md + 9 references: event-driven-architecture, event-sources, getting-started, observability, optimization, orchestration-and-workflows, powertools, troubleshooting, web-app-deployment).
- No files touched outside `skills-library/aws-lambda/` and this report.
