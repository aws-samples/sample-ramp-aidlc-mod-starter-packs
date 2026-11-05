# Wave 3 Checkpoint 5 — live Bash review

## Status

Review is complete against the current implementation. Product files were
not edited by this reviewer.

Initial execution:

```text
bash -n installer/src/release/templates/install.sh
# passed

npm test --prefix installer -- test/install-bash.test.js
# 5 passed, 3 failed
```

The three failures were adopted-file uninstall, upgrade/rollback, and the
modified-file matrix. The first implementation already passed clean install,
dry-run/conflict isolation, source-tamper rejection, two-owner install order,
and argument/target rejection.

After the first functional fixes:

```text
bash -n installer/src/release/templates/install.sh
# passed

npm test --prefix installer -- test/install-bash.test.js
# 8 passed, 0 failed
```

That closes the originally encoded happy-path failures, but does not close the
security findings below because the eight tests do not yet exercise the full
brief.

Second independent re-review:

```text
bash -n installer/src/release/templates/install.sh
# passed

npm test --prefix installer -- test/install-bash.test.js
# 11 passed, 0 failed
```

The expanded suite now covers empty TSV fields, one cross-owner case collision,
external adopt-only behavior, extra/linked rollback content, and successful
owned-directory cleanup. Exact backup metadata/file/checksum closure and
target-wide origin reconciliation were materially improved.

Third independent re-review:

```text
bash -n installer/src/release/templates/install.sh
# passed

npm test --prefix installer -- test/install-bash.test.js
# 15 passed, 0 failed
```

The current version closes the prior NUL/LF/path-bound checks, hidden and
dangling state scans, exact backup metadata and checksum closure, rollback
origin merge, normal state-path rechecks, and transaction-directory cleanup.

Final independent re-review:

```text
bash -n installer/src/release/templates/install.sh
# passed

npm test --prefix installer -- test/install-bash.test.js
# 16 passed, 0 failed
# test runtime 89274 ms; command runtime 89.87 s
```

The two blockers from the third re-review are closed:

- `validate_state_union()` now checks every ancestor in a folded-path map, and
  the `A`, `a-b`, `a/x` installed-owner regression fails closed with the
  required diagnostic.
- The transaction journal now records absent parent directories, restoration
  removes only those newly created empty directories, mutation flags precede
  publication, and active customer/state temporary names are cleaned. The
  recovery regression writes `nested/new.txt`, compares a snapshot that
  includes files, directories, modes, and links, and proves no transaction
  directory remains.

One separate strict-manifest blocker was found during this final pass. It is
not exercised by the 16-case Bash suite.

## Material findings sent during implementation

1. **Fixed in the second version:** upgrade constructed its predecessor backup after customer mutations. Changed
   files therefore captured new bytes, while removed files were already absent.
   The predecessor must be staged from the transaction's authenticated old
   bytes before any customer mutation.
2. **Fixed in the second version:** rollback removed the owner backup before copying its manifest back into
   current state. All rollback inputs must be staged before consuming the
   snapshot.
3. **Fixed in the second version:** an externally originated adopted path could be changed, and an external path
   dropped by an upgrade was scheduled for deletion. External paths are
   adopt-only: preserve them when dropped and conflict on content/mode change.
4. Backup validation checked only listed hashes. It did not parse
   `backup-meta.tsv`, prove an exact sorted checksum/file closure, reject extra
   hidden content, or verify recorded modes.
5. The existing backup and state trees were not fully type/ancestry validated.
   Recursive copies of an untrusted backup tree or unknown state entry could
   copy links or block on special files.
6. Manifest/origin parsing used tab as shell whitespace `IFS`; repeated tabs
   can collapse empty fields and shift records. The parser must enforce exact
   field counts without whitespace collapsing.
7. State directories created solely for locking could remain after a failed
   locked re-preflight when `.ramp/` itself pre-existed.
8. The target-wide origin snapshot was restored wholesale on rollback. That can
   erase legitimate origin rows added by another owner after the upgrade.
   Rollback must reconcile the affected owner's paths while preserving valid
   unaffected current claims.
9. Cross-owner case-fold and file/directory-prefix collisions were not checked
   over the union of installed owner manifests.
10. Temporary destination and owner-state paths used `-e` rather than lexical
    existence checks. A dangling symlink could pass the test and become a
    write-through target. State/destination ancestry also needs an immediate
    pre-mutation recheck.
11. An existing owner backup was removed without first proving that it was one
    ordinary, contained, strictly valid generation.
12. Empty customer directories created along managed paths were not cleaned
    after removal.

## Positive observations from the initial version

- The script parses arguments without `eval`, locates bundle inputs relative to
  its physical directory, and uses a fixed generated layout rather than a tool
  list.
- It runs under macOS Bash 3.2 syntax and selects `sha256sum`, then
  `shasum -a 256`.
- It performs a no-write preflight before creating `.ramp/`, takes a
  target-wide directory lock, and repeats preflight under that lock.
- It rejects ordinary visible source/destination symlinks and special files in
  the principal tested paths.
- It stages desired bytes and re-hashes them before publishing.
- The target-wide origin model is the correct basis for order-independent
  co-ownership cleanup once the upgrade/rollback reconciliation gaps are
  closed.

## Final verdict

**BLOCKED in the current live version.** The earlier installed-state and
transaction findings are fixed and the full Bash suite is green, but the
bundle manifest parser still accepts inputs that the authoritative contract
requires it to reject:

1. `parse_manifest()` checks an exact-case file/directory prefix only against
   the immediately preceding original path, and its folded-path file checks
   exact duplicates only. A forged manifest containing `A`, `a-b`, and `a/x`
   is therefore accepted even though `A` is a folded ancestor of `a/x`.
   A direct generated-installer probe reached `error: installer preflight
   failed` during missing-source verification rather than the earlier
   `error: invalid install manifest`, proving parsing succeeded. The
   JavaScript renderer's `assertNoCollisions()` currently emits the same
   invalid three-row manifest, so the renderer and helper share the gap.
2. The `version` record is validated only with `portable_segment`; it does not
   enforce the renderer's semantic-version grammar. A direct probe with
   `version<TAB>release` likewise passed parsing and reached source preflight.
3. The parser rejects only the exact owner `.origins`; it accepts other
   dot-prefixed owners even though the renderer rejects every ownership key
   beginning with `.`. A direct probe with `owner<TAB>.hidden` passed parsing.
   Such an owner maps to a hidden installed-state filename that `load_state()`
   subsequently rejects as an unknown hidden entry.

This conflicts with the brief's requirement that case-fold and
file/directory-prefix collisions be rejected and that the helper parser not
accept a looser format than the JavaScript renderer emits. Close the gate by
using a folded ancestor map for each manifest, enforcing the same semantic
version grammar and reserved dot-owner rule in Bash, fixing the renderer's
folded-prefix check, and adding forged-current-bundle regressions for all
three cases.
