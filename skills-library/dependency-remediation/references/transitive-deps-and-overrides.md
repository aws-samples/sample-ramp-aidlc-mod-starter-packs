# Transitive Dependencies, Lockfiles & Overrides

Most vulnerable packages in a Node.js project are **transitive** — pulled in by something you depend on, not declared in your `package.json`. Fixing them correctly is the trickiest part of remediation.

## Find who pulls it in

```bash
npm ls <package>                 # full tree of paths to the package + the requiring parent
npm ls <package> --all           # include nested
npm why <package>                # (npm 9+ alias) explains why it's installed
```
The output tells you the **direct parent(s)**. That decides your options:
1. A parent has a newer release that depends on the fixed transitive version → **bump the parent** (cleanest).
2. No such parent exists (or the maintainer is slow) → **override/pin** the transitive version.

## Lockfiles: what they are and why they matter

| Manager | Lockfile | Notes |
|---|---|---|
| npm | `package-lock.json` | `lockfileVersion: 2` (npm 7) or `3` (npm 9+). Records the exact resolved tree. |
| yarn | `yarn.lock` | classic (v1) and berry (v2+) differ in format |
| pnpm | `pnpm-lock.yaml` | content-addressed store; strict by default |

The lockfile is the source of truth for what's actually installed. A remediation that edits `package.json` but not the lockfile fixes nothing until you reinstall. `npm ci` installs strictly from the lockfile and **fails if `package.json` and the lockfile disagree** — which is exactly why it's the verification gate.

## npm `overrides` (npm ≥ 8.3)

Force a version for a transitive dependency across the whole tree. In `package.json`:

```jsonc
{
  "overrides": {
    "lodash": "4.17.21"
  }
}
```

Scoped (only when nested under a specific parent):
```jsonc
{
  "overrides": {
    "some-parent": {
      "lodash": "4.17.21"
    }
  }
}
```

Reference the parent's own dependency version to pin a grandchild:
```jsonc
{ "overrides": { "foo": { ".": "1.2.3", "bar": "$foo" } } }
```

Then:
```bash
npm install          # rewrites package-lock.json to honor the override
npm ls lodash        # confirm every path now resolves to the pinned version
```

## yarn `resolutions`

```jsonc
{ "resolutions": { "lodash": "4.17.21", "some-parent/**/lodash": "4.17.21" } }
```
```bash
yarn install
```
Berry (yarn 2+) supports the same field plus more granular selectors.

## pnpm `pnpm.overrides`

```jsonc
{ "pnpm": { "overrides": { "lodash@<4.17.21": "4.17.21" } } }
```
```bash
pnpm install
```
pnpm supports version-range keys (only override when the installed version matches the range).

## Rules for overrides

- **Prefer bumping the parent** to an override whenever a fixed parent release exists. Overrides are a blunt, global pin.
- **Document every override.** Add a comment or MR note: which CVE, why an override (no fixed parent), and a revisit trigger to remove it once the parent catches up. Undocumented overrides rot and silently hold packages back.
- **An override can break the parent** if it wasn't written for the new version. Always `npm ci` + `npm test` after adding one; if it breaks, bump the parent or accept/defer instead.
- **Overrides don't update the parent's declared deps** — they force resolution. The parent may still assume the old API. This is why reachability matters: safest when your code (and the parent's used surface) doesn't touch the changed API.

## Verifying a transitive fix

```bash
npm ci
npm ls <package>        # NO path should show the vulnerable version anymore
npm audit --production  # advisory should be gone
npm test && npm run build
```
If `npm ls` still shows the old version on some path, your override scope was too narrow (or a parent re-pins it) — widen the override or bump that parent.
