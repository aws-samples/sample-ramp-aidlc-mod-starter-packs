# RAMP starter-packs revamp — agent handoff

Date: 2026-11-05
Branch: `revamp-starter-packs`

## Read this first

The next agent should read these files in order:

1. `AGENT_HANDOFF.md` — current state and exact continuation steps.
2. `docs/RAMP_STARTER_PACKS_MASTER_PLAN_V2.md` — authoritative product direction.
3. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/progress.md` — completed checkpoints and rulings.
4. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-3-release-plan.md` — current release wave; resume at Task 5.
5. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-execution-addendum.md` — mandatory safety amendments.
6. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-brief.md` — exact current checkpoint contract.
7. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-implementation-report.md` — RED/GREEN history.
8. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-live-bash-review.md` — security review history.
9. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-powershell-audit.md` — required PowerShell parity.
10. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-live-js-review.md` — JavaScript review findings.

Do not assume the WIP commit is a completed feature. It is a deliberate transfer
checkpoint.

## Completed revamp checkpoints

Seventeen reviewed checkpoints are complete through:

```text
c1c543c feat: compose self-contained release bundles
```

The earlier commits cover:

- centralized Kiro, Claude Code, Codex/Cursor-compatible adapter handling;
- RAMP pack metadata and catalog taxonomy;
- single-tool and shared multi-tool workspace behavior;
- canonical RAMP workflows and bounded pack overlays;
- workspace-neutral workflow paths and scaffold parity;
- locked upstream/RAMP skill provenance and offline resolution;
- self-contained deterministic unpacked bundle models with legal and input closure.

See `progress.md` for every commit, verification count, and design ruling.

## Current checkpoint: safe standalone bundle installers

Task 5 is partially implemented but not integrated into release bundles.

Implemented:

- `installer/src/release/install-manifest.js`
  - deterministic canonical install TSV;
  - strict plain-data validation;
  - aggregate limits;
  - SemVer and hidden-owner rejection;
  - exact, case-fold, and folded ancestor collision rejection.
- `installer/src/release/installers.js`
  - captured-template rendering and strict layout-token validation.
- `installer/src/release/templates/install.sh`
  - Bash 3.2-compatible no-Node installer;
  - clean install, dry run, conflict isolation, co-ownership, upgrade,
    uninstall, and one-step rollback;
  - target-wide origin ledger distinguishing RAMP-managed from adopted
    customer files;
  - strict source/state/backup parsing;
  - target-wide lock and locked re-preflight;
  - transaction restoration and customer-directory cleanup;
  - symlink/special-file and backup-closure defenses.
- Manifest and Bash test suites.

Latest root-owned verification:

```text
bash -n installer/src/release/templates/install.sh
npm test --prefix installer -- \
  test/install-manifest.test.js \
  test/install-bash.test.js

Test Files: 2 passed
Tests:      37 passed
```

The final three parser findings from the last independent Bash review were
fixed test-first:

- forged `A`, `a-b`, `a/x` folded ancestor collision;
- non-SemVer `version=release`;
- hidden `owner=.hidden`.

An independent re-review after those final fixes has **not** yet been run.

## Known incomplete work

### 1. Re-review the final Bash/parser state

Run an independent review against the latest files, not the older BLOCK verdict.
The older review is valuable history; its last three findings now have passing
regressions.

Required checks:

```bash
bash -n installer/src/release/templates/install.sh
npm test --prefix installer -- \
  test/install-manifest.test.js \
  test/install-bash.test.js
```

Audit every previously reported parser, ownership, rollback, transaction,
symlink, hidden-state, origin, and folded-path issue.

### 2. Implement real PowerShell parity

`installer/src/release/templates/install.ps1` is currently only a 41-line
placeholder and must not ship as complete.

Create `installer/test/install-powershell.test.js`. Static tests must always run.
Runtime cases may be skipped locally because this macOS host has no `pwsh`,
`powershell`, or `powershell.exe`, but Task 9 must execute the same runtime
suite on `windows-latest`.

Follow `wave3-checkpoint5-powershell-audit.md` exactly. PowerShell must translate
the approved Bash state machine; it must not implement a reduced installer.

### 3. Integrate helpers into the bundle model

Modify:

- `installer/src/release/bundle.js`
- `installer/src/release/readme-first.js`
- `installer/test/release-bundle.test.js`

Bundle entries must add:

```text
install-files.tsv  100644
install.sh         100755
install.ps1        100644
```

Also:

- add all new renderer/template sources to the authenticated generator input
  closure;
- pass the exact captured template bytes to `renderInstallers()`;
- keep `bundle-manifest.json.files` overlay-only;
- include the three helper entries in `SHA256SUMS`;
- replace the README statement that the bundle has no installer with truthful
  safe-helper and manual-copy guidance;
- preserve deterministic bytes and defensive copies.

### 4. Verify and close Task 5

Run:

```bash
npm test --prefix installer -- \
  test/install-manifest.test.js \
  test/install-bash.test.js \
  test/install-powershell.test.js \
  test/release-bundle.test.js
npm test --prefix installer
git diff --check
git status --short
```

Require independent Bash/PowerShell-static, bundle-closure, security, and scope
approval before declaring Task 5 complete.

The intended completed-feature commit message remains:

```text
feat: add safe standalone bundle installers
```

The current transfer commit should remain identifiable as WIP.

### 5. Continue with Task 6

After Task 5 is complete, resume
`.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-3-release-plan.md`
at Task 6:

- deterministic ZIP encoding;
- local `ramp-pack release` CLI;
- ignored `dist/` output;
- no publication or GitHub Release without explicit owner approval.

## Safety and repository rules

- Do not push to or merge into the default branch without explicit approval.
- Do not tag, publish, deploy, or create a GitHub Release without explicit
  approval.
- Keep generated ZIPs and `dist/` ignored.
- Do not add caches, `node_modules`, `.DS_Store`, customer artifacts, or
  credentials.
- Preserve unrelated user changes.
- Continue using test-first changes and independent reviews for security
  boundaries.
