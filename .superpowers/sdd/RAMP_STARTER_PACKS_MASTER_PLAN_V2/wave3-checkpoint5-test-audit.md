# Wave 3 Checkpoint 5 — RED-first test audit

## Recommendation

Implement Task 5 through three layers of tests:

1. pure manifest/rendering contracts;
2. one shared runtime scenario contract exercised by Bash and, when available, PowerShell;
3. bundle integration proving that the generated helper inputs are derived only from the sorted `overlay/` entries and the bundle's version-independent `ownershipKey`.

Keep every static PowerShell contract active on all platforms. Skip only the PowerShell process-execution scenarios when no local engine is available; Task 9's `windows-latest` job is the release gate for full execution parity.

## Existing harness to reuse

- Reuse the cleanup, temp-root, byte-tree comparison, `spawnSync(..., { shell: false })`, capability probing, and PowerShell probing patterns from `installer/test/add-skills-helpers.test.js`.
- Reuse `sha256Hex()` and the entry conventions from the release tests. Overlay entries already carry full regular-file modes `0o100644` or `0o100755`.
- Prefer `bash` as the test command, but keep the generated script itself compatible with Bash 3.2. The test must statically reject post-3.2-only features such as associative arrays and `mapfile`.
- Probe `pwsh` as required by Task 5. It is useful to run `powershell.exe`/`powershell` too if present, but absence of those engines must not add skips beyond the single parameterized PowerShell execution suite.
- Give every `spawnSync` a timeout and assert both `error` and `status`, so a deadlocked helper cannot hang the suite.

## RED sequence

### 1. `install-manifest.test.js`

Write these first and confirm the import is RED:

- renders the exact UTF-8 format, header, metadata order, terminal newline, lowercase SHA-256, octal mode, and portable relative paths;
- sorts file records by portable path regardless of input order;
- is byte-for-byte deterministic and does not mutate its input;
- accepts only `overlay/` entries, strips exactly one `overlay/` prefix in the emitted file path, and rejects an empty result;
- rejects duplicate, ASCII case-fold-colliding, or file/directory-prefix-colliding paths;
- rejects tabs, CR, LF, NUL, empty values, traversal, absolute/drive/UNC/backslash paths, Windows-reserved segments, malformed SHA-256, unsupported modes, non-Buffer bytes, and record/hash disagreements;
- rejects tabs/newlines in all metadata scalars (`bundleId`, `ownershipKey`, `version`) and unsafe `ownershipKey` values because it becomes a state filename;
- verifies the manifest input is bounded by the existing release entry/path/byte limits.

Exact golden fixture:

```text
RAMP-INSTALL-MANIFEST\t1
bundle\tdemo--kiro--v1.2.3
owner\tdemo--kiro--standalone
version\t1.2.3
file\t<sha256>\t100644\t.kiro/settings/mcp.json
file\t<sha256>\t100755\t.kiro/skills/demo/scripts/check.sh
```

Clarify in the production contract whether `mode` is `100644`/`100755` (recommended, matching release entries) or `644`/`755`; tests must prohibit both implementations from diverging.

### 2. `install-bash.test.js`

Create a minimal extracted-bundle fixture:

```text
bundle/
  overlay/<relative customer paths>
  install-files.tsv
  install.sh
target/
```

Run from a different current working directory to prove the helper resolves `overlay/`, `install-files.tsv`, and `install-conflicts.txt` relative to its own real location. Invoke with `spawnSync('bash', [script, ...args], { shell: false })`.

First RED scenarios, in this order:

1. argument validation: missing `--target`, unknown/duplicate flags, mutually exclusive `--uninstall` and `--rollback`, missing target value;
2. clean install preserves exact bytes and executable/non-executable modes and writes the exact owner TSV;
3. dry-run reports the plan but creates neither the target nor `.ramp/`;
4. tampered or missing bundled overlay fails before all customer/state writes;
5. a conflict late in the sorted list causes zero customer-file and `.ramp/` writes, including no created parent directories;
6. conflict report is deterministic, overwritten rather than appended, and written only beside the extracted helper;
7. identical reinstall is idempotent and does not create a backup;
8. shared identical file can be claimed by owner A then B and B then A;
9. uninstall of A preserves a file still claimed by B; uninstall of the last owner removes it and removes newly empty directories only within owned paths;
10. safe upgrade creates a complete previous-version backup, changes only files whose current bytes equal A's prior record, records the new version, and handles added/removed/unchanged files;
11. a user-modified owned file blocks the entire upgrade with zero target/state/backup writes;
12. a user-modified owned file blocks the entire uninstall;
13. rollback restores the immediately previous bytes/modes and owner manifest, including deleting files that the upgraded version introduced;
14. a user-modified owned file blocks the entire rollback;
15. rollback without a predecessor and a second rollback have deterministic non-zero behavior and no writes.

The runtime assertions should compare a full snapshot of the target before and after every expected failure, not merely the nominated file. Exclude `bundle/install-conflicts.txt` from that target snapshot because it intentionally belongs beside the helper.

### 3. `install-powershell.test.js`

Static tests always run:

- `renderInstallers(model)` is deterministic, returns exactly `{ bash, powershell }`, and both embed/consume the same manifest filename and state roots;
- neither script contains a hard-coded adapter/tool list (`kiro`, `claude-code`, `codex`, `cursor`, or their directories);
- no Node/npm dependency or network/download command appears;
- PowerShell uses `Get-FileHash -Algorithm SHA256`;
- Bash uses `sha256sum` with a `shasum -a 256` fallback and fails closed when neither is found;
- both expose install, `--dry-run`, `--uninstall`, and `--rollback`, and use `.ramp/installed`, `.ramp/backups`, and `install-conflicts.txt`;
- neither template contains an independently generated path/file table. The common `install-files.tsv` is the only per-bundle source of files, hashes, modes, version, and owner.

Execution tests:

- probe `pwsh -NoLogo -NoProfile -NonInteractive`;
- define one `runtimeScenarios({ label, run, mapArgs })` function containing the same behavioral assertions used for Bash;
- register it once for Bash and once with `describe.skipIf(!pwshAvailable)` for PowerShell;
- do not skip the entire file and do not skip static tests;
- make the PowerShell runner map the CLI exactly (`--target`, `--dry-run`, `--uninstall`, `--rollback`) rather than silently using a different public interface.

Task 9 must run this same PowerShell runtime contract on `windows-latest`; a separate simplified Windows fixture suite would risk false parity.

## Common runtime oracle

Use explicit snapshots rather than console text as the primary oracle:

- regular-file relative path;
- bytes;
- executable bit where the platform exposes it;
- owner-state TSV bytes;
- backup-tree bytes;
- absence/presence of `.ramp/`;
- conflict-report bytes and stable sorted ordering.

Console tests should assert only stable machine-useful markers and no absolute fixture paths. Do not make behavior depend on localized shell error text.

For two-owner tests, generate two extracted bundle directories with different `ownershipKey` values but the same destination path and bytes. This models separate Kiro/Claude bundles without hard-coding either tool. Assert separate state files and ensure order does not change the final customer tree.

For upgrade/rollback, keep the same `ownershipKey` and use versions `1.0.0` then `1.1.0`. Use at least:

- one changed file;
- one unchanged file;
- one newly added file;
- one removed file;
- one executable-mode transition if the chosen ownership format promises to restore modes.

## Adversarial tests required before GREEN

The three Task 5 files should also cover:

- target, `.ramp`, `installed`, `backups`, destination ancestors, destination files, owner state, overlay files, and conflict report replaced by symlinks;
- FIFO/device/socket or directory where an ordinary file is expected, capability-gated like the current helper tests;
- target path containing spaces, quotes, glob characters, leading dash, Unicode, and embedded command-substitution-looking text;
- case-fold and parent/child collisions in forged TSV input;
- forged TSV with extra fields, missing fields, duplicate metadata, duplicate file records, unsupported header/version/mode, CRLF ambiguity, and checksum-like shell metacharacters;
- pre-existing `.ramp` state not owned by this bundle remains byte-identical;
- backup path/version injection cannot escape `.ramp/backups/<ownershipKey>/`;
- failure during the commit phase is either atomically rolled back or explicitly tested to leave a recoverable, deterministic state. Preflight alone does not prove transactional writes.

Race injection is difficult to make portable in shell. At minimum, tests should demonstrate fail-closed symlink/special-file behavior immediately before execution and require the implementation to stage writes in the target filesystem followed by atomic renames. If hooks are added for deterministic race tests, keep them test-only environment variables rejected/ignored in normal release output.

## Bundle integration assertions

Extend the existing `release-bundle.test.js` rather than adding another file unless the Task 5 boundary is deliberately amended:

- final entry list contains `install-files.tsv`, `install.sh`, and `install.ps1`;
- `install.sh` has `0o100755`; manifest and PowerShell have `0o100644`;
- `install-files.tsv` contains exactly `result.manifest.files`, with `overlay/` removed once, correct hashes/modes, and sorted paths;
- bundle ID, version, and ownership key come from the authenticated bundle model, not reparsed pack files;
- helper entries participate in `bundle-manifest.json`/`SHA256SUMS` consistently with the chosen non-recursive checksum contract;
- generator closure includes the four new release source/template files so reproducibility attests to their exact bytes;
- builds under different cwd/locale/timezone/root produce identical helper bytes and manifest bytes.

Task 5 currently lists only `bundle.js` as modified, but the release input closure's `RELEASE_GENERATOR_FILES` must include every new generator/template source. A test should fail if any Task 5 generator source is omitted.

## Focused verification

```bash
npm test --prefix installer -- test/install-manifest.test.js test/install-bash.test.js test/install-powershell.test.js test/release-bundle.test.js
npm test --prefix installer
git diff --check
```

Record the exact number of passed/skipped cases. A local `pwsh` absence is acceptable only when:

- all PowerShell static tests pass;
- exactly the parameterized PowerShell execution cases are skipped;
- Bash executes all common scenarios;
- the outstanding Windows execution gate is named explicitly for Task 9.
