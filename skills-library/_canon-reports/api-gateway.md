# Canonicalization Report: `api-gateway`

## Source of truth
`/Users/feffendi/Documents/GitHub/agent-plugins/plugins/aws-serverless/skills/api-gateway`

**Chosen canonical:** the source-of-truth directory, copied verbatim.

## Distinct in-repo variants (SKILL.md, `scaffolded-packs` excluded)

| SKILL.md md5 | # packs | Packs |
|---|---|---|
| `8e895e03de457a29314b17c20d4323f2` | 8 | genai-on-serverless, web-app-on-cloudnative, legacy-transformation-on-aws, vulnerability-remediation-pipeline, dotnet-app-modernization-on-aws, ocr-mobile-app-on-serverless, cots-rewrite-on-cloudnative, serverless-event-driven-on-aws |
| `d14157a3ac9b15127cc187c23de1dc84` | 1 | api-platform-migration-n-modernization |
| `ccec771ad6302bd5048890c1cd7093da` | 1 | agentic-incident-response |

The source-of-truth `SKILL.md` hashes to `8e895e03de457a29314b17c20d4323f2` — **byte-identical to the 8-pack majority variant.**

### References
All three variants carry the same 18 `references/*.md` files, and every one is **byte-identical to the source** (`diff -rq` produced no differences for all variants). No reference-file drift exists.

## Rationale
- The source-of-truth `SKILL.md` exactly matches the majority variant (8 of 10 packs) and all reference files are identical across every pack. This makes the source unambiguously authoritative and low-risk.
- Per instructions, the source-of-truth content is preferred as authoritative and divergent variants were **not blended** in.

## Divergence flagged for human review

1. **`api-platform-migration-n-modernization`** (`d14157a3`) — trivial, non-content drift. Adds a single YAML front-matter line:
   ```
   source: https://github.com/awslabs/agent-plugins/tree/main/plugins/aws-serverless/skills/api-gateway
   ```
   Provenance metadata only; no guidance value. Safely dropped by canonicalization.

2. **`agentic-incident-response`** (`ccec771a`) — **intentional-looking, pack-specific additive guidance** (NOT merged; flagged). This variant expands on private/internal-only API design, aligned with the incident-response pack's "internal-only, not internet-facing" theme:
   - Endpoint-type bullet expanded: Private is "the only way to make an API non-internet-facing; HTTP API v2 has no private mode."
   - Adds pitfall **#12**: internal-only requires a **private REST API (v1)** with `endpoint_type = PRIVATE`, an `execute-api` interface VPC endpoint, and a resource policy restricting `aws:SourceVpce`; HTTP API (v2) has no private endpoint mode; authenticated ≠ off-the-internet.
   - Adds pitfall **#13**: a private API can't be smoke-tested from outside the VPC — live E2E tests need an in-VPC runner (SSM/bastion, in-VPC CI/CodeBuild) or VPN/Direct Connect.

   **Recommendation:** This content is genuinely useful and correct. Consider either (a) upstreaming pitfalls #12/#13 into the source-of-truth so all packs benefit, or (b) preserving them as a pack-local overlay/addendum for `agentic-incident-response` rather than in the shared canonical skill. Left to human decision; canonical skill intentionally does not include them.

## Files written
Copied via `cp -R` into `skills-library/api-gateway/` — **19 files total** (1 `SKILL.md` + 18 `references/*.md`):

```
SKILL.md
references/architecture-patterns.md
references/authentication.md
references/custom-domains-routing.md
references/deployment.md
references/governance.md
references/observability-analytics.md
references/observability-logging.md
references/observability-metrics-alarms.md
references/performance-scaling.md
references/pitfalls.md
references/requirements-gathering.md
references/sam-cloudformation.md
references/sam-service-integrations.md
references/security.md
references/service-integrations.md
references/service-limits.md
references/troubleshooting.md
references/websocket.md
```

Canonical `SKILL.md` md5: `8e895e03de457a29314b17c20d4323f2`
