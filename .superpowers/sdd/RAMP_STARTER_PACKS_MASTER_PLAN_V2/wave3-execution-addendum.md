# Wave 3 execution addendum — reproducible skills and release bundles

## Authority and decision

This addendum amends
`wave-3-release-plan.md` where the feasibility audit found a contradiction.
The original plan still supplies the detailed feature requirements; this file
supplies the corrected sequencing, immutable-source model, and additional
acceptance gates.

The governing rule is:

> A lock or release may describe a Git commit only when every materialized
> input byte and executable mode is derived from, or verified against, that
> exact commit. A working-tree file is never silently attributed to a commit.

No task in this wave publishes, tags, registers, deploys, or auto-merges.

## Corrected checkpoint order

| Checkpoint | Required correction |
|---|---|
| 1. Provenance contracts | Add authoritative file-record and LF/mode policy. |
| 2. Local resolver | Add one explicit cache configuration used by every caller. |
| 3. Sync and initial lock | Generate locks from immutable Git object snapshots. |
| 3A. Pilot closure | Update no-Node skill helpers and cache-aware CI in the same checkpoint. |
| 4. Bundle | Return the complete consumed-input closure and verify source provenance. |
| 5. Installers | Reject symlink/junction destination escapes before any target write. |
| 6. ZIP/CLI | Use authoritative entry modes/bytes and reject unverifiable automatic provenance. |
| 7. Qualification | Qualify QA only; keep legacy release qualification empty. |
| 8. ATX | Package source separately and add normal-bundle `relatedAssets` support. |
| 9. CI/publication | Bind publication to tag, pack, version, and source commit. |
| 10. Docs | Promote the download path only after all preceding gates pass. |

## Cross-cutting source model

### Authoritative file record

Use one normalized record throughout lock, resolver, bundle, and ZIP code:

```js
{
  path,        // portable forward-slash relative path
  sha256,      // lowercase SHA-256 of exact bytes
  size,        // exact byte length
  executable,  // from Git mode or repository-authored metadata
}
```

The tree checksum framing remains:

```text
file NUL <path> NUL <x-or-dash> NUL <size> NUL <raw-bytes> NUL
```

Lock entries must persist the sorted `files` array as well as `treeSha256`.
Bundle modes for locked upstream content come from this record, never from a
Windows checkout's `stat()` result.

### Text and executable-mode policy

Checkpoint 1 adds a root `.gitattributes` contract:

```gitattributes
* text=auto eol=lf
*.md text eol=lf
*.json text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.js text eol=lf
*.mjs text eol=lf
*.sh text eol=lf
*.ps1 text eol=lf
```

Binary formats must be explicitly marked `-text` when introduced.

- Upstream bytes and modes come from the selected Git tree.
- Repository-authored source bytes and modes come from the RAMP source commit
  when automatic provenance is used.
- Generated text is UTF-8 with LF endings.
- Generated executable modes are declared by the generator model.
- ZIP entry modes use authoritative metadata, not platform checkout modes.

Cross-OS determinism means identical bytes for the same source commit,
explicit build epoch, pack, target, profile, and lock. Add Linux and Windows
coverage; do not weaken the claim to "same operating system."

## Checkpoint 1 amendments — contracts and checksum

Add to the original file list:

- `.gitattributes`
- the `files` array in `schemas/skill-lock-v1.schema.json`

Required contracts:

1. `hashSkillTree()` continues to support normal fixture/directories, rejects
   symlinks and non-portable paths, and produces file records.
2. Lock validation requires each file record, stable byte-order sorting, no
   duplicate paths, and a `treeSha256` recomputable from the records.
3. Later Git-aware code supplies authoritative executable flags rather than
   trusting platform `stat()`.
4. `packs/<pack>/skills/<name>/skill.yaml` reuses `ramp-skill-v1` and adds:

   ```yaml
   ownerPack: <pack-id>
   ```

   `ownerPack` is required for a pack override and forbidden for a normal
   `skills/ramp/<name>` skill. Both forms require name, SemVer, license, and
   optional `basedOn`.

Additional tests:

- CRLF versus LF checkout cannot alter commit-derived source bytes;
- a file-record executable change alters the tree checksum;
- duplicate and unsorted lock file records are rejected or normalized
  deterministically;
- source and lock serialization is byte-stable under different locale/TZ.

## Checkpoint 2 amendments — resolver and cache contract

Define one cache configuration:

```js
resolveCacheDir({
  repoRoot,
  cacheDir,                         // highest precedence
  env = process.env.RAMP_SKILLS_CACHE,
})
```

Precedence is explicit API/CLI `--cache`, then `RAMP_SKILLS_CACHE`, then
`<repoRoot>/.ramp-cache/skills`.

Every resolver, sync, verify, test, init, release, and CI call must use this
same function. Do not introduce another environment variable or hidden
home-directory cache.

For a locked skill:

- reject missing, extra, changed, or symlinked files;
- recompute byte hashes and the tree checksum using locked authoritative
  executable flags;
- on POSIX, also reject a filesystem executable-bit mismatch;
- on Windows, do not derive archive modes from the checkout;
- pass the locked file records into plan/bundle provenance.

Hermetic unit tests use temporary sources/caches. Cache-consuming integration
tests receive an explicit cache directory.

## Checkpoint 3 amendments — immutable Git snapshot synchronization

`--source-root <id>=<dir>` identifies a Git object database. It is not the
tree that gets hashed.

Add a Git snapshot reader/materializer with argument-array process execution:

```js
readGitTree({ repository, commit, subpath })
// => sorted [{ path, bytes, gitMode, executable, sha256, size }]

materializeGitTree({ repository, commit, subpath, destination })
// writes only those validated records
```

Accept only objects reachable as commits. Resolve the requested ref once,
capture its 40-character commit, then read every skill, `LICENSE`, and
`NOTICE` from that commit using Git object APIs/a tool-controlled detached
snapshot. Never hash the caller's working directory.

Required tests:

- ignored/untracked files under a skill (including `.DS_Store`) do not enter
  the snapshot or checksum;
- modified/staged tracked files do not enter the snapshot;
- dirty `LICENSE`/`NOTICE` files do not enter the source metadata;
- source-root HEAD may differ from the requested commit without changing the
  result;
- a missing/wrong commit fails;
- duplicate matches for one skill within one source fail;
- cross-source collisions use priority only during explicit `update-lock`;
- an existing lock is never silently reselected by priority;
- a second sync reuses only a fully verified cache.

The known ignored
`skills/core-skills/amazon-bedrock/.DS_Store` must therefore have no effect on
the generated lock.

## Checkpoint 3A amendments — clean clone and no-Node compatibility

This checkpoint must not land until both compatibility paths are updated.

Add to the original file list:

- the shared Bash skill-helper renderer/source;
- all generated `add-skills.sh` files affected by the moved skills;
- a shared PowerShell helper renderer/template, or every affected
  `add-skills.ps1` file if a renderer cannot be introduced safely;
- Bash/PowerShell mixed-source parity tests;
- `.github/workflows/build-packs.yml`;
- the QA and legacy pack READMEs.

No-Node helper precedence becomes:

1. `packs/<pack>/skills/<name>`;
2. `skills/ramp/<name>`;
3. verified compatibility content under `skills-library/<name>`.

The helper must fail clearly when a named source is absent. Bash and
PowerShell must implement the same precedence and copy the same bytes.

Before this checkpoint's cache-consuming tests, CI must run:

```text
npm ci --prefix installer
node installer/bin/ramp-pack.js skills sync --locked --cache "$RAMP_SKILLS_CACHE"
node installer/bin/ramp-pack.js skills verify --cache "$RAMP_SKILLS_CACHE"
npm test --prefix installer
scaffold drift verification
```

Set `RAMP_SKILLS_CACHE` to one job-local directory and use it for every
subsequent command. Unit tests remain hermetic and do not depend on that
cache.

Acceptance:

- a clean clone can run the documented CI sequence;
- QA and legacy no-Node helpers work for a mix of RAMP-owned, locked mirror,
  and reviewed legacy-local skills;
- moving the nine repository-authored skills does not break helper parity;
- pilot integration tests fail before sync and pass after sync using the
  exact same configured cache.

## Checkpoint 4 amendments — exact release input closure

`buildBundle()` must return:

```js
{
  artifactName,
  ownershipKey,
  entries,
  manifest,
  consumedInputs: [{
    path,
    sourceKind,
    sha256,
    size,
    executable,
    provenance,
  }],
}
```

`consumedInputs` covers every materialized source:

- selected pack and manifest;
- common instructions and overlays actually composed;
- renderer/templates used to produce output;
- pack-local, RAMP, upstream, or compatibility skill files;
- repository `LICENSE`;
- upstream licenses/notices;
- selected related-asset metadata.

Automatic Git provenance is allowed only when:

1. every repository input is tracked at `sourceCommit`;
2. working bytes and executable modes match that tree;
3. no untracked or ignored file is recursively materialized;
4. every locked upstream input matches its immutable lock records; and
5. the manifest records the exact input closure.

Prefer reading recursive source inputs from the commit snapshot. If the
working tree is used, enumerate first and reject any selected untracked,
ignored, modified, staged, symlinked, or extra file. Outside Git, an explicit
commit value is recorded as `callerSuppliedSourceCommit`; it is not described
as repository-verified provenance.

Tests must cover a dirty/untracked pack skill, ignored nested file, dirty root
license, changed executable mode, and a dynamically selected template.

## Checkpoint 5 amendments — destination escape and rollback safety

Before creating `.ramp/`, staging files, backups, or customer paths:

1. Walk every existing component from the target root to every destination.
2. `lstat` rather than follow it.
3. Reject a symbolic link at a parent or final path.
4. On Windows reject any component with the `ReparsePoint` attribute,
   including directory junctions.
5. Resolve the nearest existing parent and prove it remains under the
   canonical target root.
6. Apply the same checks to `.ramp/installed`, `.ramp/backups`, ownership
   files, conflict reports, and backup destinations.

The preflight must finish for every source and destination before the first
target write.

Back up, beside the prior bytes:

- the previous ownership TSV;
- prior file modes;
- prior bundle/version metadata; and
- a checksum manifest for the backup.

Support one-step rollback initially and state that contract explicitly. A
successful rollback restores both bytes and ownership; reinstall/upgrade
after rollback must work.

Required scenarios in Bash and Windows PowerShell:

- symlink/reparse-point final file;
- symlink/reparse-point parent directory;
- symlinked `.ramp`, ownership directory, and backup directory;
- resolved path escaping the target;
- rollback followed by reinstall and upgrade.

## Checkpoint 6 amendments — deterministic ZIP and provenance

`releasePack()` consumes authoritative bundle entries; it never calls
filesystem `stat()` to choose ZIP modes.

Automatic `sourceCommit` derivation uses the exact `consumedInputs` gate from
Checkpoint 4, not a fixed list of directories. `SOURCE_DATE_EPOCH` changes
only the explicit build timestamp and cannot relax source verification.

Determinism tests vary:

- file creation order;
- locale;
- `TZ`;
- checkout line-ending configuration;
- platform checkout executable behavior; and
- output directory.

The resulting ZIP bytes and SHA-256 must match for identical authoritative
inputs. Windows may run the verification from a normal checkout because bytes
and modes come from verified records, not Windows `stat()`.

## Checkpoint 7 amendment — qualification vocabulary

Do not use one field to mean both renderer support and release qualification.
Retain:

```yaml
distribution:
  targets: [...]
  qualifiedTargets: [...]
  qualifiedProfiles: [...]
```

Interpret `targets` as renderer-supported and `qualifiedTargets` as
release-qualified. Set legacy `qualifiedTargets: []` until its MCP runtime
arguments are pinned/removed and a legacy shared-release test passes.

Only QA's Kiro and Claude Code targets/profile may be qualified in this
checkpoint. Test both install orders, separate ownership, identical shared
roots, idempotent reinstall, and no foreign private instruction paths.

## Checkpoint 8 amendments — ATX related assets

Add to the original file list:

- `installer/src/release/bundle.js`
- `installer/src/release/provenance.js`
- `installer/test/release-bundle.test.js`

When a pack declares `capabilities.atxAgents`, a normal bundle:

- records stable `relatedAssets` entries with agent ID and separately
  generated source-archive name;
- does not copy any `atx/agents/<name>` content into `overlay/`;
- does not claim install, registration, or deployment.

The ATX archive itself includes:

- its validated packaging manifest;
- `README-DEPLOY.md`;
- the declared license text;
- a stable source-package manifest and `SHA256SUMS`; and
- no secret, customer identifier, symlink, traversal, or deployment side
  effect.

## Checkpoint 9 amendments — CI order and publication binding

The normal build workflow must sync and verify before any cache-consuming
tests:

```text
npm ci --prefix installer
skills sync --locked --cache "$RAMP_SKILLS_CACHE"
skills verify --cache "$RAMP_SKILLS_CACHE"
npm test --prefix installer
scaffold drift check
release build twice and byte-compare
helper scenarios
artifact upload
```

The lock-update workflow reads candidate skills from immutable resolved Git
commits, commits only the lock, and opens a PR. It never publishes or
auto-merges.

Use the collision-safe tag:

```text
packs/<pack-id>/v<manifest.version>
```

The publish job must prove all of:

1. `publish == true`;
2. `github.ref == refs/tags/packs/<pack-id>/v<manifest.version>`;
3. `bundle-manifest.json.pack.id == <pack-id>`;
4. `bundle-manifest.json.pack.version == <manifest.version>`;
5. `bundle-manifest.json.sourceCommit == GITHUB_SHA`;
6. every uploaded checksum was produced and verified in the gated build job;
7. an existing release, if any, has the same tag/pack/version metadata.

Reject mismatches; do not attach assets to a generic or unrelated release.
Grant `contents: write` only to the publish job.

## Checkpoint 10 amendment — documentation release gate

The customer ZIP path becomes primary only after:

- QA qualification tests pass on Linux and Windows;
- deterministic builds match twice;
- Bash and PowerShell safety scenarios pass;
- the tag-binding workflow contract is tested;
- no normal bundle contains ATX source; and
- an owner explicitly approves publication.

Until then, docs may describe local release artifacts as preview but must not
claim a public download exists.

## Final acceptance additions

Before any public release, verify:

```text
clean clone
-> one configured cache
-> immutable lock sync and verify
-> full tests
-> scaffold parity
-> release twice on Linux and Windows
-> byte-identical archives
-> install/upgrade/uninstall/rollback/symlink scenarios
-> tag/pack/version/source-commit binding
```

Also assert that ignored or untracked files—including the observed upstream
`.DS_Store`—cannot affect a lock, bundle, notice, manifest, or archive.
