# RAMP starter-packs revamp — agent handoff

Date: 2026-11-05
Branch: `revamp-starter-packs`

## Read this first

The next agent should read these files in order:

1. `AGENT_HANDOFF.md` — current state and exact continuation steps.
2. `docs/RAMP_STARTER_PACKS_MASTER_PLAN_V2.md` — authoritative product direction.
3. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/progress.md` — completed checkpoints and rulings.
4. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-3-release-plan.md` — current release wave; resume at Task 6.
5. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-execution-addendum.md` — mandatory safety amendments.
6. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-brief.md` — exact current checkpoint contract.
7. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-implementation-report.md` — RED/GREEN history.
8. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-live-bash-review.md` — security review history.
9. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-powershell-audit.md` — required PowerShell parity.
10. `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave3-checkpoint5-live-js-review.md` — JavaScript review findings.

`3dd0035` is a deliberate WIP transfer checkpoint, not a completed feature.
Task 5 was finished on top of it and closed by
`feat: add safe standalone bundle installers`.

## Completed revamp checkpoints

Eighteen reviewed checkpoints are complete through:

```text
feat: add safe standalone bundle installers
```

The earlier commits cover:

- centralized Kiro, Claude Code, Codex/Cursor-compatible adapter handling;
- RAMP pack metadata and catalog taxonomy;
- single-tool and shared multi-tool workspace behavior;
- canonical RAMP workflows and bounded pack overlays;
- workspace-neutral workflow paths and scaffold parity;
- locked upstream/RAMP skill provenance and offline resolution;
- self-contained deterministic unpacked bundle models with legal and input closure;
- safe standalone `install.sh` and `install.ps1` bundle installers (Task 5).

See `progress.md` for every commit, verification count, and design ruling.

## Last checkpoint: safe standalone bundle installers (Task 5, complete)

Every bundle now ships `install-files.tsv`, `install.sh` and `install.ps1`.

- `installer/src/release/install-manifest.js`: deterministic canonical install
  TSV with strict validation, SemVer and hidden-owner rejection, folded
  collision rejection, and a reserved installer state root (`.ramp`).
- `installer/src/release/installers.js`: captured-template rendering with
  strict layout-token validation.
- `installer/src/release/templates/install.sh`: Bash 3.2-compatible installer
  with install, dry run, co-ownership, upgrade, uninstall and one-step
  rollback; a target-wide lock with a locked re-preflight; a per-file recheck
  before every change; a journal that restores only the paths it changed.
- `installer/src/release/templates/install.ps1`: the same state machine in
  PowerShell (`67b67c8`), sharing every state literal, conflict reason and
  error message with `install.sh`.
- Bundle integration (`cdb2af7`): helpers in the authenticated generator
  closure, `SHA256SUMS` and README-FIRST guidance.
- `installer/test/support/install-oracle.js`: one shared behavioural oracle run
  against both engines, plus engine-specific suites.

Hardening after review: trailing-newline directory names, rollback snapshots
that cannot be built or no longer match, edits made during a transaction,
300-file bundle speed, interrupt exit codes, linked-target spellings,
positional PowerShell targets and state-root paths are all covered by tests.

Verification at the closing commit (pwsh 7 on Linux):

```text
npm test --prefix installer -- test/install-manifest.test.js \
  test/install-bash.test.js test/install-powershell.test.js \
  test/release-bundle.test.js
Test Files: 4 passed
Tests:      306 passed, 118 skipped

npm test --prefix installer
Test Files: 30 passed, 1 skipped
Tests:      1329 passed, 180 skipped
```

Reviews: independent PowerShell and bundle-closure reviews approved; the
security, Bash and scope reviews requested changes, all HIGH and MEDIUM
findings were fixed test-first, and a fresh re-review approved at `56eb721`.
Remaining LOW findings are tracked as follow-on work.

Still open for Task 9: run the PowerShell runtime suite on `windows-latest`
with `powershell.exe` 5.1; it has only run on pwsh 7 so far.

## Next: Task 6

Resume
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
