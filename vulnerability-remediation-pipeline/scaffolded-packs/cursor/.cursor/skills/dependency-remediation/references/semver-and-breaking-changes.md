# semver & Breaking-Change Assessment

A security bump is only safe if you understand how far it moves and what that risks. This reference is the discipline for turning "upgrade to fixed version" into a change you can defend.

## semver in one screen

`MAJOR.MINOR.PATCH` (e.g. `4.17.19`):
- **PATCH** (`z`) — backwards-compatible bug fixes.
- **MINOR** (`y`) — backwards-compatible new features.
- **MAJOR** (`x`) — breaking changes allowed.

Range operators in `package.json`:
| Range | Allows | Example for `4.17.19` |
|---|---|---|
| `^4.17.19` | patches + minors (`>=4.17.19 <5.0.0`) | `4.18.0` yes, `5.0.0` no |
| `~4.17.19` | patches only (`>=4.17.19 <4.18.0`) | `4.17.21` yes, `4.18.0` no |
| `4.17.19` | exact | only that |
| `*` / `latest` | anything | avoid for remediation |

Implication: if the fixed version is within your existing `^`/`~` range, the fix may be a lockfile-only change; if it's outside, you must widen the range in `package.json`.

## Classify the jump

Compare installed → target:
```bash
npm view <package> versions --json      # what actually exists
npm outdated <package>                  # current / wanted / latest at a glance
```
- Same MAJOR (patch/minor) → low risk. Proceed, then run the suite.
- MAJOR change → **breaking-change assessment required** (below).

## Breaking-change assessment (major bumps)

Do this before applying a major bump; never rewrite call sites silently inside a "security" MR.

1. **Read the release notes / CHANGELOG** between your version and the target. Sources: the package's GitHub releases, `CHANGELOG.md`, or `npm view <pkg>@<target>`.
2. **List breaking changes** the notes call out (removed/renamed/rescoped APIs, dropped Node versions, changed defaults, ESM/CJS shifts).
3. **Check your usage** of those APIs:
   ```bash
   grep -rE "require\(['\"]<pkg>|from ['\"]<pkg>" src/
   # then grep for the specific removed/renamed symbols the changelog names
   ```
4. **Peer & engine constraints:**
   - Peer deps: does the new major demand a peer version (e.g. a plugin requiring a new host framework major)? `npm ls` / install warnings reveal conflicts.
   - Engines: does it drop your Node version? Check `engines` in the package and your runtime.
5. **Decide:**
   - Small, contained migration → include in the remediation, note what you changed.
   - Large migration → surface it as its own decision/MR. A transitive-only major that your code never calls can still be safe via an override — reassess the remediation shape.

## Transitive major bumps

A major bump of a *transitive* dependency is often safe **for your code** (you don't call it), but:
- The **direct parent** must tolerate the new version — check its declared range and peer requirements. If the parent pins the old major, an `overrides`/`resolutions` pin may violate the parent's assumptions and break it. Test.
- Prefer bumping the parent to a release that already depends on the fixed transitive version; fall back to an override only when no such parent exists.

## Deprecations and lockfile drift

- `npm install` may print `npm warn deprecated` for transitive deps — note them but they are not vulnerabilities.
- After any change, ensure `package.json` range and `package-lock.json` agree, and that `npm ci` succeeds (it fails if they're out of sync). A passing `npm ci` is the proof the lockfile is coherent.

## Red flags to stop and reassess

- The only fix is a major, and your code uses the removed API heavily → don't force it into the security MR; split it out.
- An override forces a transitive version the direct parent wasn't written for and tests fail → bump the parent instead, or accept/defer with a compensating control.
- `latest` was used "to be safe" → replace with the nearest version that clears the advisory.
