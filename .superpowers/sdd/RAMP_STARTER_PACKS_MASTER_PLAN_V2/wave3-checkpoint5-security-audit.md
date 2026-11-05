# Wave 3 Checkpoint 5 Security Audit

## Verdict

Task 5 is implementable, but the short task text is not sufficient on its
own. The implementation must also carry forward the Checkpoint 5 amendments
in `wave3-execution-addendum.md`: reject destination links/junctions and
escapes before any target write, preserve the complete prior ownership state
and file metadata, and provide exactly one validated rollback generation.

The most important additional rule is that ownership is a target-wide
coordination problem, not a per-bundle problem. A global target lock and a
second preflight under that lock are required. Otherwise two Kiro/Claude or
two pack installers can both pass preflight and then invalidate each other's
ownership decisions.

## Trust boundaries

- The release generator is trusted to emit a strict, deterministic
  `install-files.tsv`, but the generated helpers must still parse it as
  hostile input because ZIP contents can be altered after release.
- `overlay/`, existing customer files, `.ramp/` state, backup state, and the
  helper-adjacent conflict report are untrusted filesystem inputs.
- Existing ownership TSV files from every owner are security inputs. An
  unreadable or malformed owner record must fail closed; silently ignoring it
  can cause one owner to delete or replace another owner's file.
- The target directory is customer-controlled. Existing symlinks, hard-to-see
  Windows junctions/reparse points, FIFOs, sockets, devices, and concurrent
  replacements must never be treated as ordinary files or directories.

## Required manifest invariants

`renderInstallManifest()` should reject before rendering:

1. non-string, blank, tab, CR, LF, or NUL-bearing scalar values;
2. any owner/bundle/version value unsafe as a filename component;
3. paths that fail the existing `assertArtifactPath()` policy;
4. paths outside `overlay/`, duplicate paths, ASCII case-fold collisions, and
   file/directory-prefix collisions;
5. invalid lowercase SHA-256 values;
6. modes other than the two supported regular-file modes (`0644`, `0755`);
7. unsorted input if the interface promises sorted overlay entries, or else
   sort a defensive copy and prove deterministic output;
8. accessors, inherited properties, mutable return aliases, or unknown record
   fields that could make the rendered model differ across reads.

The parser in both helpers must require exactly:

```text
RAMP-INSTALL-MANIFEST<TAB>1
bundle<TAB><bundle-id>
owner<TAB><ownership-key>
version<TAB><pack-version>
file<TAB><sha256><TAB><mode><TAB><relative-path>
```

It must reject missing, repeated, reordered, extra, malformed, blank, or
case-variant header/metadata records. It must reject CRLF artifacts rather
than accidentally retaining `\r` in a value unless the renderer explicitly
standardizes and both implementations parse the same canonical bytes.

`ownershipKey` is version-independent and selects:

```text
.ramp/installed/<ownership-key>.tsv
.ramp/backups/<ownership-key>/
```

It must not be accepted from CLI input. It comes only from the authenticated
bundle manifest.

## Destination and state path safety

Before creating `.ramp/`, a customer directory, a staging directory, a
backup, or an ownership file, both helpers must:

1. require the selected target to be an existing ordinary directory;
2. canonicalize the target root without accepting a symlink/reparse-point
   target;
3. walk every existing component from that root to every overlay destination,
   `.ramp`, `.ramp/installed`, `.ramp/backups`, the owner state, the selected
   backup generation, and transaction paths;
4. use `lstat`-equivalent inspection and reject a link at either a parent or
   final component;
5. on PowerShell reject every existing component carrying the
   `ReparsePoint` attribute, including directory junctions;
6. reject any existing non-directory parent or final special file;
7. resolve the nearest existing parent and prove it remains within the
   canonical target root;
8. repeat the complete destination/state walk after taking the target-wide
   lock and before mutation.

Checking only the lexical `../` form is insufficient. The generator's
portable-path validation protects archive names, but only component
inspection protects the customer filesystem.

The helper directory, `install-files.tsv`, `overlay/`, and every overlay
source component require the same no-link/no-special-file checks. Hashing
commands follow links if the path is swapped after inspection, so the
installer should copy into a private staging area and re-hash staged bytes
before publishing them. Customer destinations must receive the staged,
verified bytes, not be re-copied from a moving source.

`install-conflicts.txt` must not become a write-through primitive. Reject an
existing symlink/special-file report path, write a helper-adjacent temporary
ordinary file, and atomically replace only an ordinary report. If the helper
directory is not writable, preserve zero target writes and report conflicts
to stderr rather than weakening the destination checks.

## Preflight, locking, and transaction boundary

The required order is:

1. parse and validate the bundled manifest;
2. verify every required overlay source hash and source path;
3. strictly load all relevant installed-owner records;
4. inspect every destination and state path;
5. classify the entire operation and collect all conflicts;
6. if dry-run or any conflict, exit without creating `.ramp/` or changing a
   target file;
7. create/acquire one target-wide exclusive lock under `.ramp/`;
8. repeat source verification, owner loading, path inspection, and
   classification under the lock;
9. stage all verified new bytes and a complete transaction/backup journal;
10. publish customer files and owner state; on an operational failure restore
    from the journal; release the lock last.

Creating the lock after the first successful preflight satisfies the
zero-write-on-conflict rule, but the second preflight is mandatory because
the filesystem may have changed before lock acquisition. The lock must be
global to the target, not keyed by `ownershipKey`, because different owners
can claim the same path.

Use an atomic lock primitive (`mkdir` in Bash; exclusive create/directory
creation in PowerShell). Do not automatically delete an unknown "stale" lock;
abort with recovery guidance. Traps/finally blocks may remove only a lock
created by the current process.

All output writes should use private temporary ordinary files in the same
filesystem, set the intended mode, re-hash, then rename. A conflict guarantees
zero target writes. Mid-transaction I/O failure should be best-effort
transactional: restore already replaced/deleted files and the prior owner
state from the journal before returning non-zero.

## Exact ownership and co-ownership rules

Classification must compare content and, on POSIX, the supported executable
mode:

- `new`: no destination and no incompatible prefix exists;
- `identical`: destination is an ordinary file with desired hash/mode;
- `owned-update`: this owner already claims the ordinary destination, its
  current hash/mode exactly matches that prior claim, and no other owner would
  be invalidated;
- `conflict`: every other state, including a modified owned file.

For Windows, preserve the canonical mode in TSV and backup metadata even
though NTFS has no equivalent POSIX executable bit. Do not let the
PowerShell state format diverge.

Shared-file rules:

- A second owner may claim an existing file only when the desired bytes (and
  canonical mode metadata) equal the existing claim.
- Installing owners in either order must produce the same bytes and two
  separate valid owner records.
- Uninstalling one owner removes only its record while another valid owner
  claims the same path.
- An upgrade that changes a co-owned path is a conflict unless every remaining
  claimant already expects the new hash/mode. The ordinary case where another
  owner still claims the old bytes must never be overwritten.
- A malformed, unreadable, linked, or special ownership record blocks the
  operation rather than being ignored.
- Owner-state publication is atomic and occurs only after customer bytes are
  safely published.

Upgrade must also handle paths removed from the new version. If an old
owner-only path is unchanged, back it up and remove it. If another owner
still claims it, retain it. If customer-modified, block the entire upgrade.

An attempted reinstall with the same owner and same version but a different
file manifest should fail and require a version bump; accepting a silent
same-version replacement defeats immutable bundle provenance.

## Uninstall invariants

Uninstall is driven by the installed owner record, not merely the current
bundle's overlay list.

- Every owned destination must still be an ordinary non-link file matching
  its recorded hash/mode before any deletion or state mutation.
- One modified owned file blocks the entire uninstall.
- Remove a file only if no other strictly validated owner record claims it.
- Remove only empty directories created along the owned paths; never recurse
  through or delete an unowned directory tree.
- Delete the owner record atomically and only after file changes succeed.
- A missing owner record is either an explicit idempotent no-op or a clear
  error; choose one contract and make Bash and PowerShell identical.

## One-step backup and rollback invariants

An upgrade backup is incomplete unless it contains:

- the exact previous ownership TSV;
- every previous byte needed to restore changed or removed files;
- prior canonical modes;
- prior bundle ID and version metadata;
- a deterministic checksum manifest covering the backup payload;
- enough absence information to delete files that the newer version added.

Publish a backup through a private temporary directory and atomic rename.
Never merge into or overwrite a partially existing backup generation.

Checkpoint 5 should support exactly one predecessor:

- after an upgrade, the current owner has one complete validated backup;
- a later successful upgrade atomically replaces/prunes the older rollback
  generation only after its new backup is complete;
- rollback fails if zero, multiple, malformed, linked, special, or
  checksum-invalid backup generations are present;
- rollback preflights all current owned files and all restoration
  destinations before writing;
- a modified current owned file blocks the entire rollback;
- rollback restores old bytes, removes unchanged newer-only files when no
  other owner claims them, restores modes, and atomically restores the
  previous ownership TSV;
- after successful rollback, reinstall and upgrade must both work. Define
  whether the consumed backup is removed; do not leave it looking like a
  second valid predecessor.

Backup directories and records are untrusted after creation. Validate their
path types, checksums, ownership key, version relationship, and full path set
on every rollback.

## Required adversarial tests

In addition to Task 5's functional matrix, require the following Bash
execution cases and equivalent PowerShell cases when `pwsh` is available.
PowerShell static tests must still cover the Windows-specific branches when
`pwsh` is absent.

### Manifest/source

- tab, CR, LF, NUL, absolute, backslash, traversal, Windows-device,
  case-colliding, duplicate, and prefix-colliding paths;
- bad header/order/field count, duplicate metadata, unknown record, uppercase
  or short checksum, unsupported mode;
- source hash mismatch and a missing, symlinked, directory, FIFO/special, or
  symlink-parent overlay source;
- source swapped after first preflight; the staged/reverified byte wins or
  the install aborts.

### Destination/state escape

- symlink/reparse-point final destination;
- symlink/junction parent directory;
- symlinked/reparse-point `.ramp`, `installed`, `backups`, owner record,
  backup generation, and transaction path;
- ordinary-file parent, directory-at-final-file, FIFO/socket/device final;
- resolved nearest parent outside the canonical target;
- existing `install-conflicts.txt` symlink/special file;
- target/state component replaced between first preflight and lock; second
  preflight catches it with no customer-file mutation.

### Ownership/concurrency

- two owners install one identical file in both orders;
- uninstall either owner first preserves the shared file;
- one owner attempts a differing update while another claims the old file;
- corrupted, unreadable, linked, and special foreign owner records all block;
- upgrade drops an unchanged owner-only file;
- upgrade drops a co-owned file and preserves it;
- upgrade/drop of a customer-modified file blocks every write;
- same owner/version with changed desired manifest is rejected;
- simulated competing installer changes the destination before the lock;
- failure after the first published file restores bytes and old owner state.

### Rollback

- backup contains previous TSV, modes, metadata, and verified checksums;
- tampered bytes/checksum/metadata, missing file, extra file, symlink,
  junction, special file, and multiple backup generations block every write;
- rollback removes newer-only files and restores removed/changed files;
- co-owned newer-only file is preserved;
- modified current file blocks rollback;
- rollback followed by identical reinstall, then upgrade, succeeds.

### CLI/dry-run hygiene

- unknown/mutually exclusive/repeated flags and missing `--target` value fail;
- `--dry-run` combined with uninstall/rollback follows one explicitly tested
  contract;
- dry-run, source failure, manifest failure, destination conflict, and failed
  second preflight create neither `.ramp/` nor customer files;
- all filenames containing spaces and shell metacharacters that remain legal
  under `assertArtifactPath()` are safely quoted;
- Bash tests run under the oldest supported Bash (macOS Bash 3.2 if that is
  the compatibility target); avoid associative arrays and newer-only syntax;
- PowerShell uses `-LiteralPath`, not wildcard-expanding path operations.

## Implementation notes

- Reuse the release path validator and portable sort in JavaScript rather
  than introducing a weaker install-only validator.
- Render Bash and PowerShell from the same normalized immutable model. Do not
  embed a hard-coded adapter/tool list.
- Shell hash selection must be exact: prefer `sha256sum`, otherwise
  `shasum -a 256`, and abort if neither is available. Normalize output without
  parsing filenames from hash-tool output.
- In Bash, quote every expansion, use `--` where the utility supports it, and
  never use recursive deletion on a path derived only from manifest text.
- In PowerShell, use `Get-Item -Force -LiteralPath` and reject
  `FileAttributes.ReparsePoint`; `Resolve-Path` alone follows the escape and
  is not a safety check.
- The generic Builder Security skill adds no network/authentication
  requirements here because this checkpoint creates no listener or external
  storage. Its fail-closed principle is reflected in strict parsing and
  refusal to ignore damaged ownership state.
