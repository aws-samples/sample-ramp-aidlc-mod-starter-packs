# npm audit & fix — mechanics and reconciliation

`npm audit` is useful but must be reconciled with the GitLab report, and `npm audit fix` must be used carefully. This reference covers both, plus yarn/pnpm equivalents.

## `npm audit --json` structure

```bash
npm audit --json > audit.json
```

npm v7+ output (schema `auditReportVersion: 2`):

```jsonc
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "lodash": {
      "name": "lodash",
      "severity": "high",
      "via": [ { "source": 1065, "name": "lodash", "title": "Prototype Pollution",
                 "url": "https://github.com/advisories/GHSA-…", "range": "<4.17.21" } ],
      "effects": [ "some-parent-pkg" ],          // who is affected because of this
      "range": "<4.17.21",
      "nodes": [ "node_modules/lodash" ],
      "fixAvailable": { "name": "lodash", "version": "4.17.21", "isSemVerMajor": false }
    }
  },
  "metadata": { "vulnerabilities": { "critical": 0, "high": 1, "moderate": 3, "low": 5 } }
}
```

Fields you use:
- `via` → the advisory (title, GHSA url, affected `range`). When `via` entries are strings, they name *other packages* in the chain (transitive).
- `effects` → packages impacted downstream — helps see the parent to bump.
- `fixAvailable` → `false` (no fix), an object with `isSemVerMajor: true` (needs a major bump / `--force`), or a target version.
- `metadata.vulnerabilities` → counts for a quick before/after.

Useful filters:
```bash
npm audit --production      # ignore devDependencies (matches "does it ship?")
npm audit --audit-level=high
npm audit --omit=dev
```

## Reconciling npm audit with the GitLab report

They will not always agree. Reasons:
- Different advisory databases and update cadence (GitLab Gemnasium vs. npm/GitHub advisories).
- GitLab scans the lockfile/manifest as committed; `npm audit` scans the *installed* tree — they diverge if `node_modules` is stale. Run `npm ci` first so the installed tree matches the lockfile.
- Severity labels can differ.

Rule: **the GitLab report is the system of record for what must be dispositioned** (it's what the team's dashboard tracks), but `npm audit` is the fastest local check that a fix actually cleared the advisory. Use both; when they disagree, enrich via OSV/GHSA (triage skill) and note the discrepancy.

## `npm audit fix` — when it helps, when it hurts

```bash
npm audit fix          # applies fixes that stay within your semver ranges (safe majority)
npm audit fix --dry-run --json   # preview what it would change WITHOUT touching anything
npm audit fix --force  # DANGER: installs breaking major versions to force a fix
```

- Start with `--dry-run` to see the plan. It's the safest way to learn what audit *would* do.
- `npm audit fix` (no force) only moves within allowed ranges — good for patch/minor.
- **`--force` will install semver-major upgrades and frequently breaks the build.** Do not run it unattended or on a shared branch. When audit reports `isSemVerMajor: true`, treat it as a breaking-change assessment (see semver-and-breaking-changes.md) and do an explicit, reviewed bump per triage group instead.
- Prefer targeted, per-group changes over a blanket `audit fix` so each change maps to a dispositioned finding and can be reviewed and reverted independently.

## yarn

```bash
yarn audit --json                 # classic (yarn 1)
yarn npm audit                    # berry (yarn 2+)
```
Yarn has no direct `audit fix`; remediate by editing versions / `resolutions` and reinstalling. Classic yarn audit exit codes are a bitmask of severities — don't treat nonzero as a hard failure without decoding it.

## pnpm

```bash
pnpm audit --json
pnpm audit --fix          # updates package.json ranges where possible
```
pnpm honors `pnpm.overrides` for transitive pinning (see transitive-deps-and-overrides.md).

## Before/after evidence

Capture the metadata counts before and after remediation so the MR can show the delta:
```bash
npm audit --json | jq '.metadata.vulnerabilities'   # before
# …apply fixes…
npm ci && npm audit --json | jq '.metadata.vulnerabilities'   # after
```
