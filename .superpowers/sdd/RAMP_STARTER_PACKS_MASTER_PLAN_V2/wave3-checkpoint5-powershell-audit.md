# Wave 3 Checkpoint 5 — PowerShell parity audit

## Current verdict

The current `install.ps1` is an intentional placeholder, not an acceptable
installer. It validates a few inputs, hashes only the manifest, then always
throws. No local PowerShell engine (`pwsh`, `powershell`, or
`powershell.exe`) is available on this macOS host, so this checkpoint can
prove static parity locally but must defer runtime execution to Task 9's
`windows-latest` gate.

The PowerShell implementation must translate the approved Bash ownership
state machine, not create a simplified second installer. Both scripts consume
the same `install-files.tsv` and must produce byte-compatible owner, origin,
backup metadata, and checksum records.

## Public and static contract

Always-active tests in `installer/test/install-powershell.test.js` must prove:

- `renderInstallers()` is deterministic and returns exactly `bash` and
  `powershell`;
- the PowerShell helper exposes `-Target`, `-DryRun`, `-Uninstall`, and
  `-Rollback`, with generated CLI examples documenting the equivalent
  `--target`, `--dry-run`, `--uninstall`, and `--rollback` invocation;
- operation switches are mutually exclusive and `Target` is mandatory;
- layout paths come only from the four renderer tokens:
  `install-files.tsv`, `overlay`, `install-conflicts.txt`, and `.ramp`;
- there is no hard-coded adapter, tool, pack, profile, or destination list;
- there is no Node.js, npm, Git, AWS, network, download, or package-manager
  dependency;
- hashes use `Get-FileHash -Algorithm SHA256`;
- every filesystem lookup that accepts customer or manifest-derived paths uses
  `-LiteralPath`, never wildcard path binding;
- reparse points are explicitly rejected via
  `FileAttributes.ReparsePoint`;
- state roots and formats match Bash exactly:
  `.ramp/install.lock`, `.ramp/installed/<owner>.tsv`,
  `.ramp/installed/.origins.tsv`, and
  `.ramp/backups/<owner>/<previous-version>/`;
- the helper contains the exact public/private record headers:
  `RAMP-INSTALL-MANIFEST`, `RAMP-INSTALL-ORIGINS`, and
  `RAMP-BACKUP-META`;
- no independent embedded file/hash/path table exists; the shared TSV is the
  only per-bundle authority;
- source stays compatible with Windows PowerShell 5.1: no ternary operator,
  null-coalescing operator, pipeline-chain operator, `ForEach-Object
  -Parallel`, `ConvertFrom-Json -AsHashtable`, or PowerShell 7-only APIs.

The placeholder's unconditional
`PowerShell bundle installation requires the Windows execution gate` failure
must be removed before Checkpoint 5 can be committed.

## Parser parity

PowerShell must read canonical bytes, not rely on permissive line helpers:

1. Open each TSV as an ordinary, non-reparse file.
2. Read bytes and decode with strict UTF-8 decoding
   (`UTF8Encoding($false, $true)`).
3. Reject NUL, CR, invalid UTF-8, an absent terminal LF, or more than one
   terminal LF.
4. Split on LF and then literal tab while preserving empty fields.
5. Require exact field counts, record order, single metadata records, lowercase
   64-character SHA-256, canonical `0644`/`0755`, semantic version, sorted
   paths, and no extra rows.
6. Apply the same printable-ASCII, Windows-reserved-name, maximum
   path/segment/depth, exact/case-fold, and ancestor-prefix collision rules as
   the JavaScript renderer and Bash parser.
7. Reserve `.origins` as an ownership key and `.origins.tsv` as state.

`Get-Content` is unsuitable for the canonical parser because it normalizes
line endings and obscures whether the terminal LF was present. `-split` must
use an overload/limit that preserves empty trailing fields, or parsing must be
performed explicitly.

## Filesystem and Windows path safety

The helper must:

- require `Target` to be an existing ordinary non-reparse directory;
- canonicalize the target once, then walk every existing descendant component
  with `Get-Item -Force -LiteralPath`;
- reject every parent or final component with the `ReparsePoint` attribute,
  including junctions, symlinks, cloud placeholders, and other reparse-backed
  paths;
- reject a container where an ordinary file is expected and a file/special
  entry where a directory is expected;
- prove every nearest existing parent remains beneath the canonical target
  using `OrdinalIgnoreCase` comparison with a separator boundary;
- apply the same walk to bundle manifest/overlay sources, destinations,
  `.ramp`, installed state, origins, backup generations, lock, transaction
  paths, temporary `.new` files, and the helper-adjacent conflict report;
- use lexical existence checks that detect dangling links/reparse entries,
  rather than treating `Test-Path` false as safely absent;
- reject hidden, extra, malformed, linked, or unreadable installed/backup
  entries instead of silently filtering them.

Do not infer safety from `Resolve-Path`: it follows links. Do not use
`Copy-Item -Recurse` on an untrusted backup or state tree. Enumerate and
validate the exact expected closure first.

On Windows, the TSV still carries `0644`/`0755` so ownership and backup bytes
remain portable. NTFS need not emulate the executable bit, but PowerShell must
not rewrite the canonical mode or disagree with an existing owner merely
because Windows cannot apply it.

## Ownership and operation parity

The PowerShell classifier and planner must match the approved Bash behavior:

- `new`, `identical`, `owned-update`, and `conflict` are computed over the
  complete union of the requested manifest, the current owner, every other
  owner, and the origin ledger;
- a target-wide folded ancestor map catches non-adjacent collisions such as
  `A`, `a-b`, and `a/x`;
- a shared claim is accepted only when all claimants, actual bytes, canonical
  mode metadata, and origin agree;
- `external` paths are adopt-only and are never modified or deleted;
- `managed` paths are removed only after the final claim disappears,
  independent of owner uninstall order;
- a same-owner/same-version different manifest is a conflict;
- upgrade includes changed, added, removed, and unchanged records in one
  preflight;
- uninstall and rollback validate the complete state union before any
  mutation, including case/prefix collisions;
- rollback merges only the affected origin rows and preserves unrelated owners
  installed after the snapshot.

No-owner uninstall, missing predecessor rollback, and a second rollback are
deterministic non-zero no-ops, matching Bash.

## Locking and transaction parity

Required order:

1. Parse and verify all bundle/state inputs.
2. Complete a no-write preflight and conflict classification.
3. For dry run or conflict, exit without creating `.ramp`.
4. Acquire the target-wide lock atomically.
5. Repeat the complete preflight under the lock.
6. Stage desired bytes, previous bytes, state, origin, and backup content on
   the target filesystem.
7. Re-hash staged bytes and immediately recheck state/destination ancestry.
8. Publish customer changes, then origin/owner state last.
9. On any exception or interruption, restore bytes, modes/state metadata, and
   newly created directories; remove partial `.new`, transaction, and staging
   paths; release only the lock created by this process.

Use `try`/`catch`/`finally` and an explicit journal. An exclusive lock can use
atomic directory creation or a `FileStream` opened with `FileMode.CreateNew`
and `FileShare.None`; it must be target-wide and must never auto-delete an
unknown lock.

The one-step backup must contain and strictly verify exactly:

- `install-files.tsv`;
- `origins.tsv`;
- `backup-meta.tsv`;
- `SHA256SUMS`;
- only the required `overlay/<path>` payloads.

Reject zero, multiple, hidden, dangling, extra, checksum-invalid, metadata-
invalid, or special/reparse backup generations. Never remove an existing
generation until its replacement is completely staged and validated.

## Conflict report parity

Write sorted relative path/reason records beside the helper. Reject an
existing report reparse point, directory, or special entry. Write a private
ordinary temporary file in the helper directory and atomically replace the
report. If the directory is not writable, emit the same safe information to
stderr and preserve zero target writes. Never include absolute customer paths
or payload bytes.

## Test structure

Create `installer/test/install-powershell.test.js` with two layers:

### Static tests — mandatory on every host

- all public/static assertions above;
- strict renderer token occurrence and no residual placeholder;
- syntactic guards against PowerShell 7-only constructs;
- matching headers/state roots/backup filenames with Bash;
- `Get-FileHash`, `-LiteralPath`, and `ReparsePoint` enforcement;
- no unconditional placeholder throw;
- no `Copy-Item -Recurse` or wildcard state enumeration that ignores hidden
  entries.

### Runtime scenarios — one shared oracle, capability gated

Probe `pwsh`, then register one parameterized runtime contract that maps:

```text
--target <dir>  -> -Target <dir>
--dry-run       -> -DryRun
--uninstall     -> -Uninstall
--rollback      -> -Rollback
```

Run the same core matrix as Bash:

- argument validation and ordinary target;
- clean install, exact bytes/state, and dry run;
- source tamper and late conflict with zero target writes;
- identical reinstall and external adoption preservation;
- two owners in both install/uninstall orders;
- co-owner differing update rejection;
- upgrade with added/changed/removed/unchanged files;
- modified-file blocking for upgrade, uninstall, and rollback;
- rollback restoration and second-rollback failure;
- exact malformed TSV, NUL, CR/LF, and missing terminal LF rejection;
- corrupt/case/prefix-colliding owner/origin state;
- hidden, extra, dangling, reparse, and checksum-invalid backup rejection;
- failure after real customer mutation restores the full target snapshot,
  including directories and absence of transaction/temp files.

Only this execution suite may be skipped when no engine exists. Static tests
must never be skipped. Task 9 must execute this same test file on
`windows-latest`; it must not substitute a reduced Windows-only fixture.

## Translation hazards

- PowerShell `-split` and `Get-Content` can discard empty/trailing fields.
- `Test-Path` can hide dangling links and follows provider semantics.
- `Resolve-Path` follows reparse points.
- `Get-ChildItem` without `-Force` omits hidden state/backup entries.
- `Copy-Item -Recurse` follows/enumerates more than the authenticated closure.
- `Move-Item -Force` replacement semantics differ when the destination exists;
  explicitly stage, validate, and replace ordinary files.
- Windows path comparison must be separator-aware and
  `OrdinalIgnoreCase`; string prefix alone confuses sibling paths.
- `$LASTEXITCODE` does not capture PowerShell cmdlet failures; use terminating
  errors with `$ErrorActionPreference = 'Stop'`.
- cleanup in `finally` must not mask the original error or delete another
  process's lock.
- Windows ACLs and antivirus can make a publish fail after preflight, so the
  transaction journal is not optional.

## Local gate status

As of 2026-11-05 on this host:

```text
pwsh:          unavailable
powershell:    unavailable
powershell.exe unavailable
```

Checkpoint 5 can therefore claim only static PowerShell parity locally. Full
PowerShell runtime acceptance remains explicitly pending Task 9's Windows CI
gate.
