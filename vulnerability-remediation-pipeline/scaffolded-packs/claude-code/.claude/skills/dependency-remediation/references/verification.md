# Verification & Regression Safety

A remediation is complete only when you have evidence that (1) the vulnerability is gone and (2) behavior didn't regress. This folds the "advisory research verification" and regression-safety concerns into one checklist. Never claim a fix succeeded without running these and reading the output.

## The mandatory gate

Run after every remediation (per group, or per batch before the MR):

```bash
npm ci                    # clean install strictly from the lockfile
npm ls <package>          # vulnerable version gone from ALL paths?
npm audit --production    # advisory no longer fires (reconcile w/ GitLab report)
npm test                  # existing suite still green
npm run build             # if the project builds
```

Interpretation:
- `npm ci` **failing** = `package.json` and lockfile disagree → your change is incomplete. Fix before proceeding.
- `npm ls` still showing the old version = override too narrow or a parent re-pins it → revisit the remediation shape.
- `npm audit` still firing = wrong target version, or a different path still vulnerable.
- `npm test` failing = potential breaking change → diagnose; do not force the change through.

## Prove the vulnerability is actually gone

`npm audit` clearing is good, but reconcile with the **GitLab report** (the team's system of record):
- Re-run the GitLab dependency scan in CI on the fix branch if possible, or
- Confirm the installed version (`npm ls <pkg>`) is ≥ the advisory's first fixed version (from OSV/GHSA), so the finding cannot reappear.

Capture before/after counts as MR evidence:
```bash
npm audit --json | jq '.metadata.vulnerabilities'   # before and after
```

## Regression safety for reachable packages

If triage marked the package **reachable**, a passing generic suite isn't enough — you want a test that exercises the specific code path using the bumped dependency, so a behavior change surfaces.

Priority order:
1. **Existing coverage first.** If the reachable path already has tests, running them is your regression net. Confirm they actually cover the used API (not just import the module).
2. **Add a focused test** when coverage is thin: call the function that uses the dependency with representative input and assert the observable behavior. One targeted test on the changed surface beats broad but shallow coverage.
3. **Smoke-check the running app** for integration-level bumps (framework, HTTP client, serialization): start it, hit the affected route/flow, confirm parity.

Keep added tests minimal and behavior-focused — you're guarding against upgrade regressions, not rewriting the test strategy.

## Lockfile integrity & reproducibility

- Commit the updated lockfile alongside `package.json` — they travel together.
- `npm ci` (not `npm install`) in CI guarantees the exact tree; a green `npm ci` is your reproducibility proof.
- Don't hand-edit the lockfile. Let the package manager regenerate it from the manifest + overrides.

## Batch verification

When remediating several groups in one MR (e.g. all P1s), verify the **combined** result, not just each in isolation — two bumps can interact. Run the full gate once after applying the batch, and record which triage IDs the batch covers.

## What "done" looks like (per group)

```markdown
- <ID> <CVE> <pkg> <from>→<to>: npm ci ✓ · npm ls shows only <to> ✓ · audit clears ✓ · test ✓ (<n> passed) · build ✓ · reachable-path test added ✓/n-a
```
Anything short of this is "in progress," not "fixed."
