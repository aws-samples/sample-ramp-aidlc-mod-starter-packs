# Wave 3 Checkpoint 5 — implementation brief

## Outcome

Generate self-contained Bash and PowerShell helpers that install an extracted RAMP bundle into a customer repository without Node.js. Every operation validates source bytes and performs a complete ownership/conflict preflight before changing customer files or `.ramp/` state.

This checkpoint does not create ZIP files, modify the public CLI, publish artifacts, or combine target bundles. Those remain Task 6 and later work.

## Exact product boundary

Create:

- `installer/src/release/install-manifest.js`
- `installer/src/release/installers.js`
- `installer/src/release/templates/install.sh`
- `installer/src/release/templates/install.ps1`
- `installer/test/install-manifest.test.js`
- `installer/test/install-bash.test.js`
- `installer/test/install-powershell.test.js`

Modify:

- `installer/src/release/bundle.js`
- `installer/src/release/readme-first.js`
- `installer/test/release-bundle.test.js`

These are necessary scope amendments to Task 5. The integration test proves the new helpers are actually composed into the authenticated bundle, have correct modes and hashes, and are included in the recorded generator closure. The README currently says that the bundle has no installer; it must instead explain the safe helpers while retaining manual-copy guidance. Shipping helpers with the old text would be a user-facing contradiction.

Do not modify any pack, adapter, scaffold, dependency manifest, CLI, workflow, or `docs/` file.

## Public interfaces

```js
renderInstallManifest({
  bundleId,
  ownershipKey,
  version,
  files,
})
// => deterministic UTF-8 string ending in "\n"

renderInstallers({
  manifestName,
  overlayRoot,
  conflictName,
  stateRoot,
  templates,
})
// => { bash, powershell }
```

`files` are the already authenticated, sorted bundle entries under `overlay/`, including `path`, `bytes`, and full regular-file `mode`.

`templates` contains the already captured UTF-8 bytes for `install.sh` and `install.ps1`. `bundle.js` must pass the same template bytes that were recorded in the release input closure; no late reread of mutable repository/template paths is allowed.

The bundle uses these fixed layout values:

```js
{
  manifestName: 'install-files.tsv',
  overlayRoot: 'overlay',
  conflictName: 'install-conflicts.txt',
  stateRoot: '.ramp',
}
```

The rendered scripts contain no pack-, profile-, or tool-specific path table. `install-files.tsv` is the only per-bundle authority.

Generated bundle entries:

```text
install-files.tsv       mode 100644
install.sh              mode 100755
install.ps1             mode 100644
```

They join the existing sorted bundle entries and are covered by `SHA256SUMS`. `bundle-manifest.json.files` remains the exact overlay payload inventory; it does not pretend the helpers are customer-overlay files.

## Install manifest contract

Exact format:

```text
RAMP-INSTALL-MANIFEST<TAB>1
bundle<TAB><bundle-id>
owner<TAB><ownership-key>
version<TAB><pack-version>
file<TAB><lowercase-sha256><TAB><0644-or-0755><TAB><customer-relative-path>
```

Rules:

- UTF-8, LF only, exactly one terminal LF;
- metadata records occur once in the fixed order above;
- file records sort by portable customer-relative path;
- exactly one leading `overlay/` is removed from each authenticated entry;
- scalar values reject NUL, tab, CR, and LF;
- file paths use the existing portable artifact-path rules and reject empty/traversal/absolute/drive/UNC/backslash, reserved-name, case-fold, duplicate, and file/directory-prefix collisions;
- hashes must match the provided bytes;
- source entry modes must be full regular-file modes `0o100644` or `0o100755`, encoded in TSV as canonical `0644` or `0755`;
- empty manifests and non-overlay entries are rejected;
- rendering does not mutate input.

The helper parser rejects extra/missing fields, duplicate metadata, unsupported headers/versions/modes, malformed hashes, unsorted or colliding file rows, and path/control-character ambiguity. It must not accept a looser format than the JavaScript renderer emits.

## CLI contract

```text
install.sh|install.ps1 --target <dir> [--dry-run]
install.sh|install.ps1 --target <dir> --uninstall
install.sh|install.ps1 --target <dir> --rollback
```

Rules:

- `--target` is required and must name an existing ordinary directory that is not a symlink/reparse point;
- `--dry-run`, `--uninstall`, and `--rollback` are mutually exclusive operation modes;
- duplicate/unknown flags, missing values, and positional arguments fail closed;
- paths are resolved without shell evaluation and remain correctly quoted;
- bundle inputs and `install-conflicts.txt` are resolved relative to the helper's directory, not the caller's current directory;
- Bash chooses `sha256sum`, then `shasum -a 256`, and aborts if neither exists;
- PowerShell uses `Get-FileHash -Algorithm SHA256`;
- no network, package manager, Node.js, Git, or AWS call occurs.

## Ownership model

The stable owner is:

```text
<pack-id>--<target>--<profile-or-standalone>
```

It excludes pack version. Kiro and Claude releases therefore have separate owner records even when they target the same customer repository and share some identical paths.

Current owner state:

```text
<target>/.ramp/installed/<ownership-key>.tsv
```

The state file is the exact validated install manifest for that owner's currently installed version. A state file is authoritative only when every record parses strictly.

Target-wide origin state:

```text
<target>/.ramp/installed/.origins.tsv
```

This private, strictly parsed ledger records whether the first RAMP claim for each path found it `managed` (absent and created by RAMP) or `external` (pre-existing, unowned, and byte-identical). It solves two safety cases the fixed public owner TSV cannot encode:

- uninstall must preserve an external customer file even after its last RAMP claim disappears;
- a managed file co-owned by A and B must still be deleted when the last owner disappears, regardless of uninstall order.

All owners of a shared path refer to the same origin row. New claims reuse it; the row is removed only after the last claim disappears. Reserve `.origins.tsv` so it can never be interpreted as an owner or generated from `ownershipKey`.

Its deterministic private format is:

```text
RAMP-INSTALL-ORIGINS<TAB>1
file<TAB><managed-or-external><TAB><customer-relative-path>
```

Rows are unique and portable-path sorted. Missing, extra, malformed, colliding, linked, unreadable, or special-file origin state fails closed whenever installed owner records exist.

Immediate rollback snapshot:

```text
<target>/.ramp/backups/<ownership-key>/<previous-version>/
  install-files.tsv
  origins.tsv
  backup-meta.tsv
  SHA256SUMS
  overlay/<previously-owned paths requiring restoration>
```

Only one immediate predecessor snapshot is retained per owner. A successful upgrade atomically replaces any older rollback snapshot. The snapshot contains the exact prior owner state, the prior origin ledger, from/to bundle IDs and versions, all bytes/modes needed to restore changed or removed prior paths, and a deterministic checksum manifest covering the private snapshot. Paths introduced by the newer version are derived exactly as current-owner paths absent from the predecessor manifest. Rollback consumes the immediate snapshot and restores its owner/origin state.

Other owner records in `.ramp/installed/*.tsv` are parsed strictly when deciding whether a path is shared. A malformed, symlinked, or special-file state entry fails closed; it is never ignored.

## File classification

After all bundled source hashes pass, installation classifies each requested destination:

- `new`: path is absent and no incompatible filesystem object/ancestor exists;
- `identical`: ordinary-file bytes and mode already equal the requested record, with origin inherited from an existing claimant or recorded as `external` when no claimant exists;
- `owned-update`: this owner already records the path, its current bytes/mode match that prior record, no other owner requires the old content, and the new record differs;
- `conflict`: every other case.

A second owner may claim an `identical` file. It receives its own state record without rewriting the customer file.

An `external` path is adopt-only: upgrades and rollbacks may retain an identical claim or drop the claim, but may not modify or delete that customer file. A desired change to an externally originated path is a conflict.

If another owner claims the same path:

- the other claim must match the actual current bytes/mode;
- installation is safe only when that claim also matches the desired bytes/mode;
- an update/rollback may not change bytes or mode still required by another owner;
- uninstall/removal deletes the customer file only when no remaining owner claims it;
- inconsistent owner claims are a conflict.

Before upgrade, uninstall, or rollback, every path in the current owner's state must still be an ordinary file with the recorded bytes/mode, unless its recorded removal semantics explicitly permit absence. Any user modification, missing owned file, symlink, directory, or special file blocks the entire operation.

## Operation semantics

### Install or identical reinstall

1. Parse the bundle manifest strictly.
2. Hash every overlay source and validate mode/path.
3. Inspect target ancestry, owner state, other owner states, and every destination.
4. Build the complete classification/change plan.
5. On any conflict, deterministically overwrite `install-conflicts.txt` beside the helper, exit non-zero, and make zero target/customer/`.ramp` writes.
6. `--dry-run` reports the plan and stops with zero target/customer/`.ramp` writes.
7. On success, acquire the target-wide lock, repeat the complete preflight, apply staged file writes, then atomically publish owner/origin state last.

An identical reinstall writes no backup and leaves file bytes/modes unchanged.

The same owner and same version with a different manifest is a conflict; immutable release provenance requires a version change.

### Upgrade

An upgrade is an install with the same `ownershipKey` and a different version:

1. Validate all new bundle sources.
2. Validate every current-owned path and all other owner claims.
3. Include changed, added, and removed paths in one preflight.
4. Stage the immediate predecessor manifest and required prior bytes/modes under the target filesystem.
5. Apply changed/added files; remove a no-longer-owned file only when no other owner claims it and the origin is `managed`. Preserve an `external` path.
6. Publish the new owner state last.
7. Publish the staged predecessor as the sole immediate rollback snapshot.

If another owner still claims old bytes, changing them is a conflict. If another owner claims a removed file, preserve the file and remove only this owner's claim.

### Uninstall

1. Strictly validate current owner state and actual owned paths.
2. Parse remaining owner records and preflight every removal.
3. Preserve any ordinary file still identically claimed by another owner.
4. Remove only `managed` files with no remaining claim; preserve `external` files.
5. Remove this owner state, its rollback snapshot, and origin rows whose last claim disappeared.
6. Remove newly empty directories only along paths this operation owned, never arbitrary customer directories.

No owner state means a deterministic non-zero no-op. A user-modified owned file blocks the complete uninstall.

### Rollback

1. Require one strictly valid immediate predecessor snapshot.
2. Validate current owner state, all current-owned files, the backup manifest/payload, and other owner claims.
3. Preflight restoration, deletion of files introduced by the current version, preservation of shared paths, and mode restoration.
4. Restore predecessor bytes/modes and predecessor owner state.
5. Remove the consumed snapshot.

Rollback is single-step. A second rollback without a new upgrade fails as a no-op. Any user modification or other-owner claim incompatible with the predecessor blocks the entire rollback.

## Filesystem safety and transaction boundary

Before customer writes:

- reject symlinks/reparse points in the existing target ancestry, `.ramp` ancestry, owner/backup paths, destination ancestors/files, overlay paths, and conflict-report path;
- reject directories or special files where an ordinary file is required;
- reject file/directory prefix conflicts across the complete operation;
- recheck inspected paths immediately before mutation;
- after the first no-write preflight, acquire one target-wide exclusive `.ramp/install.lock` with an atomic primitive and repeat source verification, state loading, ancestry inspection, and classification while holding it;
- never auto-delete an unknown/stale lock; fail with recovery guidance, and remove only a lock created by this process;
- if the helper created `.ramp/` solely to acquire the lock and the locked re-preflight fails, remove its lock and the newly created still-empty state directories so the target returns byte-for-byte to its pre-operation snapshot;
- create staging/backup content only after the full preflight succeeds;
- stage on the target filesystem and use atomic rename/replace where the platform permits;
- write current owner state last so it never claims an incomplete install;
- if a commit-phase operation fails, restore already changed paths from staged prior bytes before exiting and do not publish the new owner state.

The conflict report is intentionally outside the customer target. It contains sorted relative paths/reasons, no customer absolute paths or source bytes, and is overwritten rather than appended. Source tamper/parser/hash failures may fail without producing a conflict report but still make zero target writes.

Write the conflict report through a helper-adjacent temporary ordinary file followed by atomic replacement. Reject an existing symlink/reparse point or special file at that path. If the helper directory is not writable, report to stderr while preserving zero target writes.

## RED-first implementation sequence

1. Add `install-manifest.test.js`; confirm missing module/import RED.
2. Implement strict deterministic manifest rendering only; run manifest tests GREEN.
3. Add Bash argument, clean-install, dry-run, source-tamper, and all-or-nothing conflict tests; confirm RED.
4. Implement strict Bash parse/hash/preflight plus clean install; make this subset GREEN.
5. Add identical reinstall, pre-existing-identical preservation, two-owner both-order/last-owner cleanup, co-owner-blocked update, upgrade, user-modification, uninstall, rollback, lock/re-preflight, mode, symlink/special-file, path-quoting, and commit-failure recovery cases; confirm RED, then implement to GREEN.
6. Add PowerShell static contracts and the same parameterized runtime scenarios; confirm RED.
7. Implement PowerShell from the same layout/model. Run execution scenarios locally when `pwsh` is available; otherwise skip only that parameterized runtime suite.
8. Amend `release-bundle.test.js` for exact layout, entry modes, manifest derivation, hashes, determinism, generator closure, and truthful README installer guidance; confirm RED.
9. Integrate the manifest/helpers in `bundle.js`, using captured template bytes and adding all four new generator/template paths to `RELEASE_GENERATOR_FILES`; update `readme-first.js`; make integration GREEN.
10. Run focused, full, drift, and whitespace verification.

## Required runtime scenarios

The Bash and PowerShell contracts share the same filesystem oracle:

- clean install;
- dry run;
- tampered/missing source overlay;
- late destination conflict with zero target writes;
- identical reinstall;
- pre-existing unowned identical file is claimed without rewrite and preserved after last-owner uninstall;
- shared identical file installed by owner A then B and B then A;
- a RAMP-created shared file is removed after the last owner in either uninstall order;
- a differing update is blocked while another owner claims the old bytes;
- safe upgrade with changed, unchanged, added, and removed files;
- modified owned file blocks upgrade;
- uninstall preserves another owner's shared file;
- modified owned file blocks uninstall;
- rollback restores prior bytes, modes, removed paths, and ownership;
- modified owned file blocks rollback;
- unsupported/no-predecessor operations are no-op failures;
- spaces, quotes, glob/metacharacter-looking, Unicode, and leading-dash path components;
- symlink/reparse-point and special-file rejection where supported.
- a competing change between first preflight and target-wide lock is caught by the second preflight.

Expected failures compare complete before/after target snapshots, not one nominated path.

## Acceptance gates

Focused:

```bash
npm test --prefix installer -- \
  test/install-manifest.test.js \
  test/install-bash.test.js \
  test/install-powershell.test.js \
  test/release-bundle.test.js
```

Full:

```bash
npm test --prefix installer
git diff --check
git status --short
```

Acceptance requires:

- every Bash scenario executed and passed on the current non-Windows host;
- all PowerShell static contracts passed;
- if `pwsh` is unavailable, only PowerShell process-execution scenarios skipped and the Task 9 Windows gate recorded;
- exact bundle layout/modes/checksums and deterministic rebuild assertions passed;
- no product changes outside the stated boundary;
- no tracked `dist/`, ZIP, temporary, cache, or generated customer artifacts;
- `docs/` remains unmodified and unstaged;
- independent security and scope reviews approve before commit.

Checkpoint commit:

```text
feat: add safe standalone bundle installers
```
