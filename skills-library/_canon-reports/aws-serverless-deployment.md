# Canonicalization Report: aws-serverless-deployment

## Chosen source
**Source of truth (used verbatim):** `/Users/feffendi/Documents/GitHub/agent-plugins/plugins/aws-serverless/skills/aws-serverless-deployment`

## In-repo variants (SKILL.md hash → packs)
Enumerated with `find … -path '*/skills/aws-serverless-deployment/SKILL.md' | grep -v scaffolded-packs`, then md5.

| SKILL.md md5 | Packs | Relation to source |
|---|---|---|
| `d03c171c1ec88951a49e20e3b7eecdeb` | genai-on-serverless, vulnerability-remediation-pipeline, cots-rewrite-on-cloudnative, serverless-event-driven-on-aws | **Byte-identical to source of truth** (SKILL.md + all references) |
| `f663c718222bf2d21edca13a5089030f` | agentic-incident-response | Source of truth + one appended section (see flags) |

Source-of-truth `SKILL.md` md5 = `d03c171c1ec88951a49e20e3b7eecdeb` (matches the 4-pack majority group).

`references/` (5 files) verified **identical across every variant and the source** via `diff -rq`:
- cdk-lambda-constructs.md `10390708bcc28903b725d0453f786035`
- cdk-project-setup.md `bdaa9353a7e212eb3bd13ccc0dfb0d06`
- cdk-serverless-patterns.md `5e6a6be7c968cfaace5860db838ae6c6`
- sam-cdk-coexistence.md `a85eb19c98cb05432387566567013019`
- sam-project-setup.md `51d388567a973e5274fe78282a39fe02`

## Rationale
- The source of truth is byte-identical to the SKILL.md used by 4 of 5 packs, and its `references/` are identical to all 5 variants. There is essentially zero drift to reconcile.
- Per instructions, source-of-truth is strongly preferred and taken verbatim. The single drift (agentic-incident-response) was **not blended** — see flag below.

## Flags / pack-specific value not blended
- **agentic-incident-response** (`f663…`) appends a `## Common Deployment Pitfalls` section to SKILL.md not present in source. Its content is partly generic (cross-account/public Lambda layer `lambda:GetLayerVersion` perms; run package build before `terraform apply`/`cdk deploy`; run a live post-deploy smoke test in addition to mocked unit tests) and partly pack-specific (Bedrock Converse `inferenceConfig` — newer Claude models reject `temperature`+`topP` together).
  - **Decision:** left OUT of the canonical to keep source-of-truth clean and avoid Bedrock-specific coupling in a shared deployment skill.
  - **Recommendation:** the 3 generic pitfalls (layer perms, build-before-deploy, live smoke test) are clearly additive and could be upstreamed to the source-of-truth skill in a follow-up; the Bedrock Converse item is better placed in a Bedrock/GenAI skill.
- `.DS_Store` present in the source directory was excluded from the canonical copy.

## Files written
Destination: `skills-library/aws-serverless-deployment/` — **6 files**, `SKILL.md` present (verified):

```
SKILL.md
references/cdk-lambda-constructs.md
references/cdk-project-setup.md
references/cdk-serverless-patterns.md
references/sam-cdk-coexistence.md
references/sam-project-setup.md
```
