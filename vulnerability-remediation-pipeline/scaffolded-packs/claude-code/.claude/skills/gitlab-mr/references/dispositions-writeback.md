# Writing Dispositions Back to GitLab

Optional, decision-gated step: reflect triage dispositions onto GitLab's vulnerability records so the Security Dashboard matches reality. **Only do this if the workflow's decisions enabled write-back.** Mutating security records is higher-risk — always carry the recorded justification and log to the audit trail.

## What gets written back

| Disposition | GitLab action |
|---|---|
| FALSE POSITIVE | Dismiss the vulnerability; reason = `false_positive`; comment = the FP justification |
| ACCEPT / DEFER | Dismiss with reason `acceptable_risk` (or comment), include revisit trigger |
| FIX | No dismissal — link the MR; the finding resolves when the fix merges and the next scan confirms |

Dismissal reason enums in GitLab: `acceptable_risk`, `false_positive`, `mitigating_control`, `used_in_tests`, `not_applicable` (availability varies by version). Map the triage FP justification class to the closest reason.

## GraphQL is the primary interface

Vulnerability state changes are exposed via GraphQL, not fully via REST. Dismiss a vulnerability:

```graphql
mutation {
  vulnerabilityDismiss(input: {
    id: "gid://gitlab/Vulnerability/<vuln-id>",
    comment: "<FP justification: class + evidence, from the triage template>",
    dismissalReason: false_positive
  }) {
    vulnerability { id state }
    errors
  }
}
```

Call it:
```bash
curl --request POST --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  "$GITLAB_API_URL/../graphql" \
  --data '{ "query": "mutation { vulnerabilityDismiss(input: { id: \"gid://gitlab/Vulnerability/123\", comment: \"...\", dismissalReason: false_positive }) { vulnerability { state } errors } }" }'
```
(The GraphQL endpoint is `https://<host>/api/graphql`.)

Related mutations: `vulnerabilityConfirm`, `vulnerabilityResolve`, `vulnerabilityRevertToDetected`, and `vulnerabilityCreateExternalIssueLink` (link an issue). Use `vulnerabilityDismiss` for FP/accepted-risk.

Finding vs. Vulnerability: the report contains *findings*; GitLab promotes them to *vulnerabilities* with global ids (`gid://gitlab/Vulnerability/<n>`). You need the vulnerability id — query the project's vulnerabilities via GraphQL (`project.vulnerabilities`) matching on the identifier/CVE to resolve the id.

## Via glab / MCP

- `glab` has limited vulnerability coverage; for dismissal, GraphQL (above) is the reliable path.
- If the pack's **GitLab MCP** is enabled and exposes a vulnerability tool, prefer it — auth stays in the MCP config and there's no raw token handling.

## Permissions

Dismissing vulnerabilities requires **Developer** role or higher on the project (Maintainer for some settings). A `read_api`-only token cannot write back — you need `api` scope. Confirm before attempting, and fail gracefully (record the intended dismissal in the audit log) if the token lacks scope.

## Guardrails

- **Never dismiss without the justification.** The comment must be the evidence-backed FP justification (or the accepted-risk rationale + revisit trigger), not a bare "false positive."
- **Confirm write-back is enabled** in the workflow decisions before mutating anything. If unsure, produce the dismissals as a proposed list for a human to apply.
- **Audit everything.** Every dismissal/comment is appended to the workflow audit log with who/when/why. Do not include secret values.
- Dismissal is reversible (`vulnerabilityRevertToDetected`), but treat it as a real security-state change, not bookkeeping.
