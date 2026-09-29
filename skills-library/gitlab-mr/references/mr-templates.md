# MR & Commit Templates

Templates that carry the triage rationale and verification evidence into the MR, so review is fast and the audit trail is complete. Adapt to the project's MR template if one exists.

## Commit message

```
fix(deps): bump <pkg> <from> → <to> (<CVE/GHSA>)

<one-line what & why: the weakness + remediation shape>
Verified: npm ci ✓, npm audit clears ✓, npm test ✓ (<n> passed), build ✓.
Refs: <triage id>
```

Code fix variant:
```
fix(security): <what changed> (<CVE/GHSA or rule id>, <CWE>)

<how the vulnerable flow is now closed — validate/encode/parameterize>
Verified: test asserting weakness closed ✓, npm test ✓, SAST re-scan ✓.
Refs: <triage id>
```

## Single-group MR description

```markdown
## Security remediation — <triage id>

**Finding:** <CVE/GHSA> — <title> in `<package>`
**Severity:** <Critical/High/…> · **CVSS:** <score/vector> · **EPSS:** <x> · **KEV:** <yes/no>
**Reachability:** <reachable via … / not reachable — evidence>

### Change
- `<package>` `<from>` → `<to>` (<patch|minor|major>, <direct bump | parent bump | override | code fix>)
- Affected paths fixed: <n>

### Breaking-change assessment
<None — patch/minor within range.>  |  <Major: reviewed CHANGELOG <link>; APIs used: <…>; migration: <…>>

### Verification
- `npm ci` ✓  ·  `npm ls <package>` shows only `<to>` ✓
- `npm audit --production` clears the advisory ✓  (before/after: <counts>)
- `npm test` ✓ (<n> passed)  ·  `npm run build` ✓
- Reachable-path test: <added/existing/n-a>

### References
- Triage backlog: <id> · Report: <link to CI artifact / dashboard>
- Advisory: <GHSA/OSV/NVD url>
```

## Batched MR description

```markdown
## Security remediation batch — <report id> · <tier, e.g. P1>

Fixes <n> findings (<risk class>). Each in its own commit; see per-group detail below.

| Triage id | CVE/GHSA | Package | Change | Shape | Verified |
|-----------|----------|---------|--------|-------|----------|
| V-01 | CVE-2021-23337 | lodash | 4.17.19→4.17.21 | parent bump | ✓ |
| V-03 | CVE-2022-… | minimist | 1.2.5→1.2.8 | override | ✓ |

### Batch verification
- `npm ci` ✓ · combined `npm audit` before/after: <counts> · `npm test` ✓ (<n> passed) · build ✓

### References
- Triage backlog: <ids> · Report: <link>
```

## Description hygiene

- Lead with the finding and the change — reviewers should grasp *what* and *why safe* in the first screen.
- Include the **verification evidence**; an MR that claims a fix without proof forces the reviewer to re-derive it.
- Never paste secret values, tokens, or full report dumps — link to the report instead.
- Keep one risk class per batch so a reviewer can reason about blast radius uniformly.
