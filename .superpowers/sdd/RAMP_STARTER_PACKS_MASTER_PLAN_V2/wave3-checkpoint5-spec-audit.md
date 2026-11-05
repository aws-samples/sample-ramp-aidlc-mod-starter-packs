# Wave 3 Checkpoint 5: interface and implementation audit

## Verdict

Task 5 fits the current release architecture, but its written file boundary omits two
necessary compatibility edits:

- `installer/test/release-bundle.test.js` must change because it asserts the exact
  bundle layout and exact generator-input closure.
- `installer/src/release/readme-first.js` and its affected test must change because
  the current README explicitly says the bundle has no installer.

Treat those as a controlled scope correction. Shipping helpers while retaining the
current README text would be a user-facing contradiction.

## Exact data flow

1. `buildBundle()` already produces sorted, collision-checked `overlay/` entries with
   immutable `Buffer` bytes and modes restricted in practice to `0o100644` or
   `0o100755`.
2. After `artifactName` and `ownershipKey` are derived, pass only the overlay entries
   to `renderInstallManifest()`:

   ```js
   renderInstallManifest({
     bundleId: artifactName,
     ownershipKey,
     version: manifest.version,
     files: overlayEntries,
   })
   ```

3. The renderer must require every input path to begin with exactly `overlay/`, strip
   that prefix for the destination/state record, compute the SHA-256 from the supplied
   captured bytes, and encode the mode canonically as `0644` or `0755`.
4. `renderInstallers(model)` should render both templates from one normalized model
   containing the shared layout constants (`overlay`, `install-files.tsv`,
   `install-conflicts.txt`, `.ramp/installed`, `.ramp/backups`) rather than embed
   pack/tool lists or duplicate independently chosen paths.
5. Add these deterministic entries before `bundle-manifest.json` and
   `SHA256SUMS`:

   | Entry | Mode |
   |---|---:|
   | `install-files.tsv` | `0o100644` |
   | `install.sh` | `0o100755` |
   | `install.ps1` | `0o100644` |

6. `bundle-manifest.json.files` should remain the installable overlay closure only.
   `SHA256SUMS` remains the complete non-recursive checksum closure and therefore
   covers the three new helper entries.
7. The returned `entries` and manifests must retain the existing defensive-copy
   behavior.

## Install-manifest contract

Emit UTF-8 with LF endings, exactly one terminal LF, the fixed header, and records in
portable-path order:

```text
RAMP-INSTALL-MANIFEST<TAB>1
bundle<TAB><artifactName>
owner<TAB><ownershipKey>
version<TAB><semantic-version>
file<TAB><sha256><TAB><0644-or-0755><TAB><overlay-relative-path>
```

Validation should be fail-closed:

- require a plain model and ordinary data properties; do not invoke accessors;
- reject empty scalars and every NUL, tab, CR, or LF;
- require `ownershipKey` to be one portable filename segment, not merely a relative
  path, because it becomes `<ownershipKey>.tsv`;
- revalidate each stripped path with `assertArtifactPath()`;
- reject unsorted input, duplicates, ASCII case-fold collisions, prefix collisions,
  unsupported modes, non-`Buffer` bytes, and malformed hashes if precomputed hashes
  are accepted;
- sort with `comparePortablePaths`, never locale-aware comparison.

The renderer should derive checksums itself from the captured entry bytes. This avoids
accepting a caller-provided checksum that disagrees with the payload.

## Generator closure and template capture

Add all four new sources/templates to `RELEASE_GENERATOR_FILES`:

```text
installer/src/release/install-manifest.js
installer/src/release/installers.js
installer/src/release/templates/install.sh
installer/src/release/templates/install.ps1
```

Do not load a template once at module import and later record different bytes from the
filesystem. The exact template bytes used to render the helpers must be the bytes
authenticated into `consumedInputs`. A safe implementation is for
`recordReleaseGeneratorInputs()` to return captured bytes and for `buildBundle()` to
pass those template bytes to `renderInstallers()`. Normalize CRLF to LF only as an
explicit rendering rule covered by tests.

Template rendering should require every placeholder exactly once and reject leftover
placeholders. Renderers and helpers must not contain absolute checkout/cache paths.

## Compatibility invariants

- Preserve all existing public `buildBundle()` arguments and return fields.
- Preserve `manifest.files` as overlay-only and preserve non-recursive `SHA256SUMS`.
- Preserve artifact and ownership naming:
  `<pack>--<target>[--<profile>]--v<version>` and
  `<pack>--<target>--<profile-or-standalone>`.
- Preserve hidden paths and executable overlay modes.
- Bash must run without Node and should target the same baseline as the existing
  helper strategy; if Bash arrays are used, state the Bash requirement rather than
  claiming POSIX `sh`.
- PowerShell should retain Windows PowerShell 5.1-compatible syntax, with `pwsh` as
  supplemental coverage.
- A generated helper must locate `overlay/` and `install-files.tsv` relative to its
  own physical bundle directory, not the caller's working directory.
- The new exact-layout expectations and `GENERATOR_FILES` fixture list in
  `release-bundle.test.js` must be updated.

## Ownership semantics that must be resolved in tests/code

The plan specifies the state location but leaves several consequential cases implicit:

1. **Pre-existing identical files.** If an unowned customer file already has the
   desired bytes, claiming it and later deleting it on uninstall loses customer data.
   Record/adopt its pre-install existence (for example, a private baseline marker in
   the owner's backup state) so sole-owner uninstall preserves it. The fixed public
   TSV format need not be extended if this is companion state.
2. **Co-owned upgrades.** An `owned-update` is safe only when no other owner still
   claims the old checksum. Otherwise upgrading one tool's bundle silently breaks the
   other owner's state and must be a conflict.
3. **Rollback selection.** The current TSV format has no predecessor pointer. Define
   one rollback generation explicitly (including the prior ownership TSV, bytes, and
   modes), or add private metadata that identifies the immediate predecessor. Do not
   choose a backup by lexical version sorting.
4. **Interrupted writes.** Preflight alone does not make a multi-file install
   transactional. Stage state/backups first and use a trap / `try`-`catch` restoration
   journal so a copy or permission failure does not leave half-installed customer
   files.
5. **Concurrent installers.** At minimum revalidate destinations immediately before
   mutation. Prefer a target-wide install lock acquired only after the initial
   no-write preflight, followed by a second preflight under the lock.
6. **Untrusted state.** Strictly parse every owner TSV before trusting paths or
   hashes. Reject symlinks/reparse points, special files, malformed records, duplicate
   owners/paths, and state that escapes `.ramp`.

These cases are more important than cosmetic output parity because they determine
whether “conflict-safe” is true for customer repositories.

## Recommended implementation sequence

1. Add RED unit tests for deterministic manifest validation and exact text.
2. Add RED Bash scenario tests, including the two missing safety cases above:
   pre-existing-identical uninstall and a co-owner-blocked upgrade.
3. Implement the shared state model and Bash helper.
4. Render PowerShell from the same normalized constants/model; add static parity
   assertions and execution scenarios when an engine is available.
5. Integrate entries into `buildBundle()`, extend generator closure capture, update
   README truthfulness and exact-layout tests.
6. Run the focused Task 5 suite, the full installer suite, `git diff --check`, and
   verify no generated bundle/output directory is tracked.
