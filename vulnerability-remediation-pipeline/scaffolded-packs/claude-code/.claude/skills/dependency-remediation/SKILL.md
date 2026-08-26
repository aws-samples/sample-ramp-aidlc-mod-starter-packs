---
name: dependency-remediation
description: "Remediate security vulnerabilities in Node.js/npm projects — map a CVE to the offending package and fixed version, choose between a direct bump, a transitive-dependency override, or a code change, assess semver/breaking-change risk, update the lockfile, and verify the fix didn't break anything. Triggers on phrases like: fix vulnerability, upgrade dependency, npm audit, npm audit fix, package-lock.json, transitive dependency, overrides, resolutions, semver, breaking change, bump version, remediate CVE, patch dependency, yarn/pnpm audit, node_modules. Use whenever remediating a triaged Node.js dependency or code-level finding, even if the user just says 'fix these vulnerable packages' or 'bump lodash'."
---

# Dependency Remediation (Node.js / npm)

Take a **FIX-dispositioned** triage group and turn it into a correct, verified change to a Node.js project. The hard parts are not "run npm audit fix" — they are choosing the *right* remediation shape (direct vs. transitive vs. code), containing semver blast radius, and proving you didn't break the build.

> **Where this runs:** this is the logic the pipeline's **remediate** stage automates. It is equally valid run interactively when designing or validating that stage.

**Input:** a triage group from `vulnerability-triage` (package, installed version, affected paths, direct/transitive, reachability, fixed version). **Output:** an applied, tested change plus a per-group remediation note for the MR.

## Decide the remediation shape first

The single most important decision. Get it wrong and you either fail to fix the vuln or break the app.

```
Is the finding a code-level issue (SAST/secret), not a package version?
  ├─ yes → CODE CHANGE (see references/code-level-fixes.md) — a bump won't help
  └─ no  → it's a dependency version issue:
        Is the vulnerable package a DIRECT dependency?
          ├─ yes → DIRECT BUMP: raise the version in package.json to the fixed release
          └─ no  → it's TRANSITIVE:
                Does bumping the direct parent pull in the fixed version?
                  ├─ yes → BUMP THE PARENT (cleanest — stays within supported ranges)
                  └─ no  → PIN via overrides/resolutions (see references/transitive-deps-and-overrides.md)
```

Always confirm the actual dependency shape from the tree, not the report:
```bash
npm ls <package>            # every path that pulls it in, and who requires it
npm ls <package> --omit=dev # is it in the production tree at all?
```

## Find the safe target version

Don't bump blindly to `latest`. Bump to the **nearest version that clears the advisory** with the least semver disruption.

1. Get the first fixed version from the advisory (OSV/GHSA — see the triage skill's advisory-sources reference).
2. List real published versions: `npm view <package> versions --json`.
3. Choose the lowest version ≥ the fixed version that your other constraints allow.
4. Classify the jump against your installed version: **patch** (x.y.**z**), **minor** (x.**y**.z), or **major** (**x**.y.z).

Patch/minor within the same major are usually safe. A **major** bump is a breaking-change assessment, not a version edit — see below.

## Assess semver & breaking-change risk

semver contract: `MAJOR.MINOR.PATCH` — major = breaking, minor = additive, patch = fixes. But you must verify, not trust:

- **Patch/minor:** low risk. Still run the test suite; minor bumps occasionally regress.
- **Major:** read the CHANGELOG / release notes and migration guide between your version and the target. Identify removed/renamed APIs your code uses. If the fix is only in a major and the migration is large, that becomes its own decision (and possibly its own MR) — surface it, don't silently rewrite call sites in a "security" MR.
- **Transitive-only bump:** even a major bump of a transitive dep can be safe if your code never calls it directly — but the *direct* parent still needs to tolerate the new version. Check peer/engine constraints.

Full mechanics (reading changelogs, `npm outdated`, peer-dependency and engine conflicts, deprecations) → [references/semver-and-breaking-changes.md](references/semver-and-breaking-changes.md).

## Apply the change

Match the tool the project uses (detect from the lockfile: `package-lock.json`→npm, `yarn.lock`→yarn, `pnpm-lock.yaml`→pnpm).

**Direct bump (npm):**
```bash
npm install <package>@<target>       # updates package.json + package-lock.json
```

**Transitive pin (npm ≥ 8.3):** add to `package.json`, then reinstall:
```jsonc
{ "overrides": { "<vulnerable-transitive>": "<fixed-version>" } }
```
```bash
npm install
```

- Yarn uses `resolutions`; pnpm uses `pnpm.overrides`. Exact syntax and nested-override forms → [references/transitive-deps-and-overrides.md](references/transitive-deps-and-overrides.md).
- Prefer bumping the direct parent over an override when possible; overrides are a targeted pin that can mask future updates, so document why each one exists.

### On `npm audit fix`

`npm audit fix` is fine for the easy majority (patch/minor within range). But:
- It **won't** fix issues that require a major bump unless you pass `--force`.
- **`npm audit fix --force` installs breaking major versions** and routinely breaks builds — never run it unattended on a shared branch. Prefer explicit, reviewed bumps per triage group.
- `npm audit` only sees the npm advisory DB; reconcile with the GitLab report (they can differ) rather than treating audit as ground truth.

`npm audit --json` mechanics and reconciliation → [references/npm-audit-and-fix.md](references/npm-audit-and-fix.md).

## Verify the fix (mandatory)

A remediation is not done until you've shown (a) the vuln is gone and (b) nothing broke. Never claim success without running these.

```bash
npm ci                 # clean, lockfile-exact install — proves the lockfile is valid & reproducible
npm ls <package>       # confirm the vulnerable version is gone from ALL paths
npm audit --production # confirm the advisory no longer fires (reconcile with the GitLab report)
npm test               # the project's suite must still pass
npm run build          # if a build exists
```

If the package was assessed **reachable**, add or run a focused test exercising the code path that uses it, so a behavior regression from the bump is caught. Regression-safety details → [references/verification.md](references/verification.md).

If tests fail after a bump: that is signal, not noise. Diagnose whether it's a genuine breaking change (revisit the shape decision — maybe pin instead, or split the major upgrade into its own effort) rather than forcing the change through.

## Per-group remediation note (hand to gitlab-mr)

For each fixed group, record:
```markdown
- **<ID> <CVE/GHSA> in <package>**: <installed> → <target> (<patch|minor|major>, <direct bump|parent bump|override|code change>)
  - Paths fixed: <n> · Reachable: <yes/no>
  - Breaking-change assessment: <none | summary + what was checked>
  - Verification: `npm ci` ✓ · `npm audit` clears ✓ · `npm test` ✓ (<n passed>) · build ✓
```

## Quick reference

| Situation | Remediation |
|---|---|
| Direct dep, fixed in patch/minor | `npm install <pkg>@<target>` |
| Transitive, parent bump fixes it | bump the direct parent |
| Transitive, parent can't move | `overrides` (npm) / `resolutions` (yarn) / `pnpm.overrides` |
| Only a major release fixes it | breaking-change assessment; possibly a separate MR |
| SAST / code finding | code change, not a bump (references/code-level-fixes.md) |
| No fix published yet | back to triage → ACCEPT/DEFER or code workaround |
| Verify | `npm ci` + `npm ls` + `npm audit` + `npm test` + build |

## Common mistakes

- **`npm audit fix --force` on autopilot.** Installs breaking majors; breaks builds. Explicit reviewed bumps only.
- **Bumping to `latest`.** Overshoots the fix and maximizes breakage. Target the nearest safe version.
- **Editing `package.json` without reinstalling.** The lockfile and `node_modules` stay vulnerable. Always reinstall and `npm ci`.
- **Ignoring the direct/transitive distinction.** Trying to `npm install` a transitive dep as if direct, instead of bumping the parent or using an override.
- **Declaring success without `npm ls`/`npm audit`.** The version can persist on another path; confirm it's gone everywhere.
- **Silent major upgrades in a security MR.** Large migrations deserve their own reviewed change — surface, don't smuggle.
