# Wave 3 Checkpoint 5 — implementation report

Status: transfer checkpoint; Bash/parser fixes are locally green, final
independent re-review is pending, PowerShell remains a placeholder, and bundle
integration has not started.

## Authoritative rulings

- `--target` must name an existing ordinary non-link directory for every operation. The installer never creates a missing project root.
- Target-wide origin semantics use the reserved `.ramp/installed/.origins.tsv` ledger from the reconciled implementation brief. `managed` means RAMP created an absent path and may remove it after the final claim; `external` means a pre-existing byte/mode-identical path was adopted and must be preserved after the final claim.
- External-origin paths are adopt-only across install, upgrade, removal, and rollback.
- Public manifest modes are canonical `0644`/`0755`; source entry modes remain full regular-file modes `0o100644`/`0o100755`.
- The immediate predecessor backup is the single strictly validated generation at `.ramp/backups/<owner>/<previous-version>/`.
- The reconciled Checkpoint 5 brief is authoritative where earlier audits differ, including the origin ledger and canonical mode encoding.

## RED/GREEN evidence

### JavaScript install-manifest renderer

- RED: `npm test -- --run test/install-manifest.test.js`
  - Result: import failed because `src/release/install-manifest.js` did not exist.
- GREEN: `npm test -- --run test/install-manifest.test.js`
  - Result: 17/17 passed.

The renderer now enforces exact plain-data fields, scalar/version validation, captured `Buffer` bytes, aggregate release byte/entry limits, `overlay/` membership, portable path limits, canonical modes, hash agreement, and O(n log n) sorted-adjacent collision detection.

### Bash installer

- Initial functional RED: `npm test -- --run test/install-bash.test.js`
  - Result: the new installer scenarios failed before a functional template existed.
- Functional GREEN before adversarial expansion:
  - Result: 8/8 passed, then 11/11 passed after strict empty-field parsing, backup-closure validation, external-origin handling, origin merge, and customer empty-directory cleanup.
- Expanded adversarial RED:
  - Command: `npm test -- --run test/install-bash.test.js`
  - Result: 13/15 passed; two failures.
  - Test-fixture failure: the snapshot helper followed a dangling rollback symlink.
  - Product failure: a recoverable owner-state publication failure left `.ramp/.transaction.<pid>/` behind.
- Expanded adversarial GREEN:
  - Command: `bash -n src/release/templates/install.sh && npm test -- --run test/install-bash.test.js`
  - Result: Bash syntax passed and 15/15 tests passed in 105.23 seconds.

The expanded suite includes explicit canonical NUL/missing-terminal-LF rejection, hidden/dangling rollback generations, corrupted cross-owner case collisions during uninstall, and recoverable state-publication failure cleanup.

- Final Bash re-review RED:
  - Command: `npm test -- --run test/install-bash.test.js -t "non-adjacent folded prefix|recoverable state-publish"`
  - Result: 0/2 passed as intended. The installed-owner union did not emit the required collision rejection for `A`, `a-b`, `a/x`, and transaction recovery left the newly created `nested/` directory behind.
- Focused GREEN:
  - Command: `bash -n src/release/templates/install.sh && npm test -- --run test/install-bash.test.js -t "non-adjacent folded prefix|recoverable state-publish"`
  - Result: Bash syntax passed and 2/2 focused tests passed.
- Full Bash GREEN:
  - Command: `bash -n src/release/templates/install.sh && npm test -- --run test/install-bash.test.js`
  - Result: Bash syntax passed and 16/16 tests passed in 95.81 seconds.

The final hardening uses a folded ancestor map rather than adjacent-only comparison, validates the union before inspecting impossible/colliding destinations, journals parent directories that were absent before customer mutation, removes only those empty directories during recovery, and cleans active customer/state temporary files on failure or signal.

## Review gates

- JavaScript renderer review: approved before the final folded-ancestor fix.
  The final renderer state needs a brief independent re-review.
- Bash installer review: the third review fixed the earlier transaction and
  installed-state blockers but found three parser-parity gaps. Those gaps were
  fixed test-first after that review; a final independent re-review is pending.
- PowerShell: not started beyond the initial deliberately failing placeholder.
- Bundle/README integration: not started.

### Final parser-parity transfer state

The last independent Bash review found:

- folded manifest ancestor collision `A`, `a-b`, `a/x`;
- non-SemVer `version=release`;
- hidden `owner=.hidden`.

Focused regressions were added to both the JavaScript manifest renderer and
Bash runtime suite. The implementation now uses a folded ancestor map and
enforces the same SemVer and dot-owner rules in both layers.

Latest root-owned GREEN:

```text
bash -n installer/src/release/templates/install.sh
npm test --prefix installer -- \
  test/install-manifest.test.js \
  test/install-bash.test.js

Test Files  2 passed
Tests       37 passed
```

This is not final Task 5 acceptance: PowerShell parity, bundle/README
integration, the full installer suite, and independent final reviews remain.
