# Implementation plan: one skills namespace, workflow variants, and customer navigation

**Status:** Approved design, implementation plan
**Date:** 2026-11-11
**Design:** [`skills-namespace-and-navigation.md`](skills-namespace-and-navigation.md)
**Branch:** every task lands by pull request into `revamp-starter-packs`.
Nothing in this plan pushes to, merges into, tags or releases from `main`.
**Non-scope:** Docusaurus or GitHub Pages, pack or skill slug renames, v1 to v2
pack conversion, tags and releases.

## Decisions taken

The design was approved with the recommended answer to each open decision:

| Id | Answer |
|---|---|
| D1 | `skill.yaml` stops being copied into customer projects for every skill. Release records it as a metadata input. |
| D2 | The 5 locked mirrors that differ from the lock are re-synced to the lock in T1, unless the diff review in T1 shows a deliberate local edit. Such a skill is reported in the PR, kept drifted until T11, then adopted in T17. |
| D3 | `common/instructions/` moves to `workflows/base/`. |
| D4 | The 31 `origin: local` skills stay unreleasable; adopting or locking them is a later track. |
| D5 | The compatibility window closes only after the first published release built from the new layout, by separate approval (T16 is filed held). |
| D6 | The draft use-case, AWS-service and technology lists in the design are the initial vocabulary. |
| D7 | QA Automated Testing ships for every harness in the adapter registry. Codex becomes the fifth adapter (T18), the pack declares and qualifies all five (T19), and a drift test keeps the pack and both helpers in step with the registry (T20). |

D7 was added after approval, as an operator requirement (2026-11-11).

## Invariants every task keeps

1. **Customer layout.** From T4 on, the customer-layout equivalence test
   passes in every task. The only allowlisted changes are T18's Cursor rule
   frontmatter and T7's removal of `skill.yaml` from the 9 RAMP skills. New
   harness layouts are additions, not changes: T18 adds Codex for `init` and
   both helpers, and T19 adds the new QA release targets. Both use the
   capture script's `--add` mode, which never re-captures an existing entry.
   T7's allowlist covers every entry present when it lands. If T19 lands
   after T7, its additions are captured without `skill.yaml` and need no
   allowlist entry.
2. **Release determinism.** `scripts/verify-release-determinism.mjs` builds
   every qualified target twice with identical bytes, in every task that
   touches `installer/`, `skills*/`, `workflow*/`, `common/` or `packs/`.
   From T19 on, that is five archives for `qa-automated-testing`, one per
   registered harness.
3. **Installer contract.** `.ramp/` state, the owner key
   `<pack>--<target>--<profile|standalone>`, the `install-files.tsv` format
   and `install.sh` / `install.ps1` behaviour do not change. The install test
   suites run unmodified, apart from path fixtures.
4. **Lock.** `dependencies/skills.lock.yaml` changes in no task. T17, the
   one planned exception, was closed as not needed.
5. **Generated files.** `scripts/regenerate.sh` leaves no diff under
   `packs/*/scaffolded-packs` or `packs/*/add-skills.{sh,ps1}`. Generated
   helpers are regenerated, never hand-edited.
6. **Public repository.** No credentials, account ids, machine paths,
   internal names or customer content in any commit.

## How each task runs

1. The task is claimed. A worktree is created from the current
   `origin/revamp-starter-packs` on a feature branch for that task.
2. The task is implemented to its section below, in commits authored by
   the maintainer.
3. Before every commit: the four focused suites (`install-manifest`,
   `install-bash`, `install-powershell`, `release-bundle`) and the task's own
   tests, with `umask 022` so file-mode tests see 0644 and 0755.
4. Before the pull request: the full `npm test` in `installer/`,
   `skills sync --locked` and `skills verify`, `scripts/regenerate.sh` with a
   clean diff, and, where invariant 2 applies, the determinism script.
5. The branch is pushed and a pull request opened with base
   `revamp-starter-packs`. Automerge is never enabled.
6. An independent review compares the diff with this plan and the design.
   Findings are fixed on the branch.
7. With CI green and the branch up to date with its base (base merged in, no
   force-push), the pull request is landed as a merge commit. One merge commit
   per task keeps `git revert -m 1` a complete rollback.
8. Tasks in the same wave have disjoint touch sets, so they never edit the
   same file. When a sibling lands first, the base is merged into the
   remaining branches and CI re-runs before they land.

## Dependency graph and waves

Each line reads: every task on the left lands before any task on the right
starts.

```text
T1, T3 ────────────────────────> T4
T2 ────────────────────────────> T5
T2, T4 ────────────────────────> T6
T4 ────────────────────────────> T18
T2, T4, T18 ───────────────────> T7
T6, T18 ───────────────────────> T19
T7 ────────────────────────────> T8, T9, T10
T19 ───────────────────────────> T10, T20
T4, T8, T9, T10 ───────────────> T11
T11 ───────────────────────────> T12
T6, T12, T19 ──────────────────> T13
T5, T6, T8, T11, T13, T19 ─────> T14
T14 ───────────────────────────> T15
first release, approval ───────> [T16 held]
```

| Wave | Tasks (parallel) | Starts when |
|---|---|---|
| 1 | T1, T2, T3 | now |
| 2 | T4, T5 | T4: T1 and T3 landed. T5: T2 landed. |
| 3 | T6, T18 | T6: T2 and T4 landed. T18: T4 landed. |
| 4 | T7, T19 | T7: T2, T4 and T18 landed. T19: T6 and T18 landed. |
| 5 | T8, T9, T10, T20 | T8 and T9: T7 landed. T10: T7 and T19 landed. T20: T19 landed. |
| 6 | T11 | T4, T8, T9 and T10 landed |
| 7 | T12 | T11 landed |
| 8 | T13 | T6, T12 and T19 landed |
| 9 | T14 | T5, T6, T8, T11, T13 and T19 landed |
| 10 | T15 | T14 landed |
| held | T16 | first published release from the new layout, and approval |

T18 to T20 implement D7 and run as early as their conflicts allow:

- T18 needs T4, because it extends T4's baseline. It lands before T7: both
  edit the helper templates, the regenerated helpers and the equivalence
  allowlist, and T7's allowlist must cover the Codex entries. This moves T7
  and everything after it one wave later.
- T19 needs T6, because both edit `packs/qa-automated-testing/pack.yaml`.
  It runs beside T7: T19 edits only the baseline fixture, T7 only the
  allowlist in the test file.
- T20 needs T19, or it would be red on arrival. Its touch set is one new
  test file, so it runs beside T8, T9 and T10.
- T10 waits for T19 as well as T7: both edit the Windows entry of the
  `helpers` job in `build-packs.yml` and `release-workflows.test.js`. T19
  lands in wave 4, so T10 stays in wave 5.
- T13 waits for T19, because both edit `packs/qa-automated-testing/pack.yaml`.
- T14 waits for T19, so the generated catalogue records QA's final targets.
- T11 and T12 run after T18 and T19 (through T10), and T13 after T19
  directly. Each regenerates its scaffolds, Codex folders included, with no
  diff.

## Tasks

### T1: Re-sync the drifted upstream mirrors (design D2, phase P0)

**Goal:** the 5 locked mirrors in `skills-library/` match the lock, so every
install path delivers the locked bytes.

**Touch set:**
- `skills-library/{amazon-bedrock,aws-cloudformation,aws-lambda-durable-functions,aws-lambda-microvms,aws-observability}/**`
- `installer/test/pilot-skill-provenance.test.js`
- `.github/workflows/build-packs.yml`, only if the pilot expectation step changes

**Steps:**
1. Run `ramp-pack skills sync --locked` to fill the cache.
2. For each of the 5 skills, diff the mirror against
   `<cache>/sources/<source>/<commit>/<path>`. Summarise each diff in the PR
   body: files added, removed or changed, and whether the local change looks
   deliberate (RAMP-specific content) or stale.
3. Replace each mirror whose drift is stale with the cache copy, including
   file modes.
4. Shrink `EXPECTED_UNSYNCHRONIZED_FAILURES` to the skills kept drifted. If it
   becomes empty, check whether the `unsynchronized` CI step still proves
   anything, and keep a red-on-drift assertion.

**Tests:** the pilot test in both cache modes; `skills verify`; the full suite.
Red proof: re-introduce one stale file in a mirror, and the pilot test must
fail.

**Customer bytes:** helper and `ramp-pack init` installs of these skills now
receive the locked content. Release ZIPs already read the cache, so they are
unchanged.

**Done when:** every mirror kept in sync passes lock verification without a
cache, and the PR lists each skill's diff summary.

### T2: Skill metadata v2 and taxonomy (phase P1a)

**Goal:** the schemas, the vocabulary and a loader exist and are tested.
No skill directory changes.

**Touch set:**
- `schemas/skill-v2.schema.json` (new)
- `schemas/taxonomy-v1.schema.json` (new)
- `schemas/taxonomy.yaml` (new)
- `installer/src/dependencies/manifests.js` (the `skill.yaml` reader)
- `installer/src/taxonomy.js` (new)
- `installer/test/skill-metadata.test.js` (new)
- `installer/test/taxonomy.test.js` (new)

**Steps:**
1. Write `taxonomy.yaml` with the design's use cases (each with outcome,
   label, description and order), AWS services and technologies.
2. Write `taxonomy-v1.schema.json`, and `skill-v2.schema.json` with the
   fields and rules in the design ("Skill metadata").
3. Extend the `skill.yaml` reader to accept schemaVersion 1 (read as
   `origin: ramp`, empty classification) and 2. Keep the v1 behaviour and
   error messages byte-identical for v1 files.
4. Add `taxonomy.js`: `loadTaxonomy(repoRoot)` and
   `lintSkillMetadata(metadata, taxonomy, { requireUseCases })`, which returns
   findings. It does not throw on first error.

**Tests:** valid and invalid fixtures for each rule (origin-specific required
and forbidden fields, unknown vocabulary value, name mismatch, `ownerPack`
with `origin: upstream`). The existing `skill.yaml` tests pass unchanged.
Red proof: an unknown `awsServices` value must produce a finding.

**Customer bytes:** none.

**Done when:** both schemas, the vocabulary and the loader land with tests,
and every existing test passes.

### T3: Pin the legacy-transformation MCP runtimes

**Goal:** `legacy-transformation-on-aws` passes the release runtime check.
This is a pre-existing release blocker: `mcp-proxy-for-aws@latest` and
`awslabs.aurora-dsql-mcp-server@latest` are refused as floating selectors.

**Touch set:**
- `packs/legacy-transformation-on-aws/pack.yaml` (`mcp:` block only)
- `packs/legacy-transformation-on-aws/scaffolded-packs/**` (regenerated)
- any test that pins those arguments

**Steps:**
1. Resolve the current exact version of each package from its registry, and
   record the version and date in the PR body.
2. Pin them as `name==<version>` in `pack.yaml`, the form the release check
   accepts for `uvx`.
3. Regenerate the scaffolds.

**Tests:** `inspectRuntimeDeclarations` passes for the pack; the determinism
script builds the pack's qualified targets; the full suite passes.
Red proof: restoring `@latest` fails the release check.

**Customer bytes:** the pack's MCP configuration files carry pinned versions.

**Done when:** the determinism script builds every qualified target of the
pack twice with identical bytes.

### T4: Customer-layout baseline and equivalence test (phase P0)

**Goal:** a committed baseline and a test that fails when any customer-visible
file changes.

**Touch set:**
- `scripts/capture-customer-layout.mjs` (new)
- `installer/test/support/customer-layout.js` (new)
- `installer/test/customer-layout.test.js` (new)
- `installer/test/fixtures/customer-layout-baseline.json` (new)
- `.github/workflows/build-packs.yml` (a full-matrix step in the `verify` job)
- `installer/test/release-workflows.test.js` (asserts that step)

**Steps:**
1. Write `support/customer-layout.js`. It computes, for one input, the sorted
   list of `{path, sha256, mode}` a customer project receives. Inputs:
   - the release bundle of every v2 pack and qualified target: the `overlay/`
     entries with the prefix stripped, plus `install.sh` and `install.ps1`;
   - the `ramp-pack init` plan for every pack and target tool, in a temporary
     directory;
   - the Bash helper and the PowerShell helper (run with `pwsh`) for every
     pack and target tool, in a temporary directory. The baseline keeps one
     list per helper.
2. `capture-customer-layout.mjs` writes the baseline JSON. It is run once, in
   this task. Later allowed changes go into the test's allowlist, so the
   baseline always shows the layout before the migration.
3. `customer-layout.test.js` recomputes every layout and compares it with the
   baseline. On failure it prints the first differing paths. An allowlist
   object in the test file starts empty.

**Tests:** the new test. Red proof: deleting one file from any skill used by
a pack, or changing one byte, fails it. Runtime must stay within the CI
budget. The full matrix runs as its own step of the `verify` job in
`build-packs.yml`, with `RAMP_REQUIRE_POWERSHELL=pwsh` so a missing engine
fails instead of skipping. If the full matrix is too slow for `npm test`,
`npm test` samples one target tool per pack.

**Customer bytes:** none.

**Done when:** the baseline is captured on a base containing T1 and T3, the
test passes, and the red proof is shown in the PR.

### T5: Catalogue generator command (phase P5a)

**Goal:** `ramp-pack catalog` builds the catalogue model and writes or
checks the three outputs. Nothing generated is committed yet.

**Touch set:**
- `installer/src/catalog.js`
- `installer/bin/ramp-pack.js` (new `catalog` command only)
- `installer/test/catalog.test.js`
- `installer/test/fixtures/catalog/**` (new)

**Steps:**
1. Extend `buildCatalog` into a model: packs (with v1 fallbacks from the
   design), skills (from `skill.yaml`, `SKILL.md` frontmatter and the lock),
   variants (frontmatter) and taxonomy. Read `catalog.useCases` and variant
   ids if present; tolerate their absence until T6 and T13 land.
2. Render Markdown deterministically: sort by taxonomy order, then id. Use no
   timestamps. Each pack row links to `packs/<pack>/README.md`.
3. `ramp-pack catalog --write [--root <dir>]` always writes `skills/README.md`
   and `workflows/README.md`, creating them when absent. It writes the README
   block between `<!-- RAMP:CATALOG packs START -->` and `END` only when those
   markers exist. `--check` exits 1 and lists every stale or missing output.

**Tests:** a fixture repository rendered to expected Markdown. Two runs give
identical bytes. `--check` is red after hand-editing an output.

**Customer bytes:** none.

**Done when:** the command and its tests land. Against a copy of the real
repository, `--write` creates the two catalogue files and leaves `README.md`
untouched, because it has no markers yet. Nothing generated is committed.

### T6: Pack use cases (design Appendix B)

**Goal:** every pack manifest declares `catalog.useCases` from the vocabulary.

**Touch set:**
- `schemas/pack-v2.schema.json` (`catalog.useCases`)
- `installer/src/manifest.js` (accept and validate `catalog.useCases` in v1
  and v2)
- `packs/*/pack.yaml` (one `catalog.useCases` line each, 14 files)
- `installer/test/manifest-use-cases.test.js` (new)

**Steps:**
1. Add the field to the schema and the loader. In v1 manifests the loader
   accepts only a `catalog` block holding `useCases`.
2. Add the Appendix B values to each manifest.
3. Leave `regression-software-testing` without a manifest; T14 handles it.

**Tests:** an unknown use case is refused, and both manifest versions load.
The T4 equivalence test passes, proving no customer file changed.

**Customer bytes:** none. `bundle-manifest.json` of the v2 packs may record
the new field. That is ZIP metadata, not a customer file.

**Done when:** all 14 manifests load with use cases and the regenerated
scaffolds show no diff.

### T7: Upstream sidecar and `skill.yaml` shipping (phase P1b)

**Goal:** an upstream mirror may hold a `skill.yaml` sidecar without failing
verification. No install path copies `skill.yaml`, and release still records
it as an input.

**Touch set:**
- `installer/src/dependencies/resolver.js` (lock-verification functions only)
- `installer/src/dependencies/sync.js` (`update-lock` refuses an upstream
  `skill.yaml`)
- `installer/src/skills.js` (copy plan excludes `skill.yaml`)
- `installer/src/release/entries.js` (exclude from the overlay; record as a
  metadata input)
- `installer/src/render/add-skills.template.sh` and `.ps1` (copy excludes
  `skill.yaml`)
- `packs/*/add-skills.{sh,ps1}` (regenerated)
- `installer/test/customer-layout.test.js` (allowlist: 9 removed files)
- the resolver, skill-sync, release-bundle and add-skills-helpers tests
  touching these paths

**Steps:**
1. In lock verification, ignore exactly one root `skill.yaml` when its
   `origin` is `upstream`. Any other extra file still fails.
2. Exclude a root `skill.yaml` from the `ramp-pack init` copy, both helpers
   and the release overlay.
3. Release records the `skill.yaml` of each consumed skill as a metadata input
   in `consumedInputs`, with a distinct role.
4. Add the 9 `skills/<ramp-skill>/skill.yaml` removals, for each tool path
   and pack, to the equivalence test's allowlist. The T4 baseline is not
   re-captured.
5. `skills update-lock` fails with a clear message when an upstream skill
   ships its own root `skill.yaml`, instead of overwriting RAMP metadata.

**Tests:** an extra non-sidecar file still fails verification, and a sidecar
alone passes. The Bash and PowerShell helpers skip `skill.yaml`. Release
records the metadata input. An upstream fixture with a root `skill.yaml`
makes `update-lock` fail and leaves the lock unchanged. The determinism
script passes.

**Customer bytes:** `skill.yaml` disappears from installed RAMP skills.

**Done when:** the equivalence test passes against the T4 baseline with
exactly the allowlisted removals, and the PR lists them.

### T8: `skill.yaml` v2 for every skill (phase P1c)

**Goal:** all 55 skills carry v2 metadata with the Appendix A classification,
and a repository lint enforces it.

**Touch set:**
- `skills-library/*/skill.yaml` (46 new)
- `skills/ramp/*/skill.yaml` (9 rewritten from v1 to v2)
- `installer/test/skill-taxonomy-lint.test.js` (new)
- `installer/test/fixtures/skill-lint/**` (new)

**Steps:**
1. Write each file from Appendix A. `origin` is `upstream` for the 15 locked
   skills, `ramp` for the 9 RAMP-owned skills and `local` for the rest. Ramp
   skills keep their `version` and `license`. Local skills get `version: 0.0.0`
   and the licence declared in their `SKILL.md`, or `NOASSERTION` with a
   comment if none is declared.
2. Resolve the rows marked `?` in Appendix A by reading the skill, and note
   each resolution in the PR.
3. Add the lint test. It walks every skill directory, loads `taxonomy.yaml`,
   and requires a v2 file, vocabulary-only values and at least one use case.
   Requiring a use case here, earlier than the design's P5, is a deliberate
   deviation: this task classifies every skill at once, so the rule holds from
   the start.
4. The lint also rejects a skill directory holding only `skill.yaml`, and any
   pack whose `skills:` list names a skill another pack owns (`ownerPack`).
5. The lint warns, without failing, when Markdown under `packs/` or `docs/`
   uses a term the design's "Terms" table replaces. Generated scaffolds and
   `docs/design/` are skipped.

**Tests:** the lint test. Red proof: deleting one `skill.yaml`, or adding an
unknown value, fails it. Fixtures prove that a directory holding only
`skill.yaml` fails, that a non-owner pack naming an `ownerPack` skill fails,
and that "workflow overlay" in a fixture document produces one warning. The T4 equivalence test passes unchanged, because T7
stops the files from shipping.

**Customer bytes:** none.

**Done when:** the lint passes for all 55 skills.

### T9: Node resolver for the `skills/` root (phase P2a)

**Goal:** the Node resolver applies the design's precedence, ambiguity guard,
deprecation warnings and reserved slugs. The release generator list and the
clean-input list are updated.

**Touch set:**
- `installer/src/dependencies/resolver.js` (resolution order, not
  verification)
- `installer/src/release/bundle.js` (`RELEASE_GENERATOR_FILES`, resolver
  roots)
- `installer/src/release/index.js` (union clean-input list)
- `installer/test/skill-resolver.test.js`
- `installer/test/release-bundle.test.js` (generator list and clean inputs
  only)
- `installer/test/release-cli.test.js`, if it asserts the clean-input list

**Steps:**
1. Add the `skills/` root ahead of the compatibility tiers. Origin rules
   apply there: `ramp` uses the directory; `upstream` uses the cache, then the
   in-tree mirror; `local` warns, and strict release refuses it.
2. Add the ambiguity guard over the source-tree roots, excluding the cache.
3. Add the deprecation warning for each compatibility hit.
4. Reserve the slugs `ramp`, `README.md` and `taxonomy`.
5. A skill with `ownerPack` resolves for its owner pack only. Strict release
   refuses any other pack that references it, and names the owner.
6. Add `dependencies/resolver.js`, `skills.js` and `instructions/compose.js`
   to `RELEASE_GENERATOR_FILES`.
7. Make the clean-input list the union of old and new roots from the design.

**Tests:** guard fixtures fail with both paths named. A `skills/` hit beats
nothing, because duplicates fail instead. Origin behaviour has one fixture
per value. The warning text is asserted. Reserved slugs are refused. A
non-owner pack referencing an `ownerPack` skill fails release. The
determinism script passes. The T4 equivalence test passes. Red proof: the
duplicate-slug fixture.

**Customer bytes:** none.

**Done when:** all of the above pass with no customer-layout change.

### T10: Helper templates for the `skills/` root (phase P2b)

**Goal:** the Bash and PowerShell helpers follow the design's helper order,
ambiguity guard, `--skills-src` semantics and repository check.

**Touch set:**
- `installer/src/render/add-skills.template.sh` and `.ps1`
- `packs/*/add-skills.{sh,ps1}` (regenerated)
- `installer/test/add-skills-helpers.test.js`
- `installer/test/windows-helper-fixtures.test.js`, if fixtures need the new
  root
- `.github/workflows/build-packs.yml` (Windows entry of the `helpers` job)
- `installer/test/release-workflows.test.js` (asserts that entry)

**Steps:**
1. Add the order: `skills/<slug>/`, then the pack, `skills/ramp/` and
   `skills-library/` tiers during the window.
2. `--skills-src` replaces `skills/` and `skills-library/`; the pack and
   `skills/ramp/` tiers still apply.
3. Add the guard over every consulted root, with the same message text in
   both engines.
4. The repository check requires `skills/`, and treats `skills/ramp/` and
   `skills-library/` as optional.
5. Refuse the reserved slugs `ramp`, `README.md` and `taxonomy`, with the same
   message text in both engines.
6. Regenerate the 14 pack helpers.
7. Add `test/add-skills-helpers.test.js` to the Windows entry of the `helpers`
   job in `build-packs.yml`; today only the Linux runs execute it. The file
   honours `RAMP_REQUIRE_POWERSHELL`, so a missing engine fails instead of
   skipping. Cases that cannot run on Windows skip there with a stated reason.

**Tests:** Bash and PowerShell parity for each rule, including the PowerShell
error text matching Bash. The helper CI matrix includes Windows PowerShell
5.1. Reserved slugs are refused in both engines. Red proof: the
duplicate-slug fixture in both engines.

**Customer bytes:** none.

**Done when:** the helper matrix is green on Linux and Windows.

### T11: Move the skills (phase P3)

**Goal:** every skill lives at `skills/<slug>/`, with pure renames.

**Touch set:**
- `skills-library/**` and `skills/ramp/**` moved to `skills/**`
- `skills-library/README.md` (stub)
- `skills/ramp/README.md` (removed; its text goes into the stub or design)
- `packs/*/add-skills.{sh,ps1}` (regenerated, if they embed defaults)
- `packs/*/README.md` (path mentions only, about 60 lines)
- tests with old-root paths: `checkpoint3a-contract`, `release-bundle`,
  `release-cli`, `skills`, `skill-resolver`, `skill-sync`,
  `add-skills-helpers`, `e2e`, `dependency-manifests`,
  `pilot-skill-provenance`
- `installer/src/dependencies/resolver.js` and `installer/src/skills.js`
  (defaults only, if they still name the old roots first)

**Steps:**
1. Make one commit holding only `git mv` renames.
2. Make a second commit with the path updates, regenerated helpers, stub and
   README path text.
3. Assert that `bundle-manifest.json` `consumedInputs` changes only by the
   documented prefix rewrite with unchanged sha256 values. Add this as a test
   that builds a v2 bundle and compares it with a fixture recorded before the
   move.

**Tests:** `git diff -M100% --name-status` on the first commit shows only
`R100` entries. The lock is unchanged. The T4 equivalence test passes
unchanged. The ambiguity guard and the pilot test pass. The determinism
script, the helper matrix and the full suite pass.

**Customer bytes:** none.

**Done when:** no skill remains under `skills-library/` or `skills/ramp/`,
and every check above is green.

### T12: Move the workflows (phase P4a)

**Goal:** the base workflow and variants live under `workflows/`, with pure
renames and file names unchanged.

**Touch set:**
- `common/instructions/**` moved to `workflows/base/**`
- `workflow-overlays/*.md` moved to `workflows/variants/*.md`
- `workflow-overlays/README.md` (stub)
- `installer/src/instructions/compose.js` (lookup new location first, old
  second)
- tests: `render-instructions`, `instruction-composition`,
  `workflow-semantics`, `legacy-transformation-re`, `release-bundle`
- `packs/{qa-automated-testing,legacy-transformation-on-aws}/README.md`
  (path text)

**Steps:** a renames-only commit, then a commit for lookups, tests and text.
`consumedInputs` changes only by the prefix rewrite.

**Tests:** only `R100` entries in the first commit. Regenerated scaffolds show
no diff. The T4 equivalence test, the determinism script and the full suite
pass.

**Customer bytes:** none.

**Done when:** `common/` and the overlay files are gone from their old
locations, and every check is green.

### T13: Variant names (phase P4b)

**Goal:** variants use the new ids, `instruction` and `whenToUse` keys, and
`aliases`; packs declare `workflow.variants`.

**Touch set:**
- `workflows/variants/*.md` (renamed to the new ids, frontmatter edited)
- `installer/src/instructions/compose.js` (`OVERLAY_FIELDS`, aliases, old keys)
- `installer/src/manifest.js` (`WORKFLOW_FIELDS`, `workflow.variants`, mapping
  from the old key)
- `schemas/pack-v2.schema.json` (`workflow.variants`)
- `installer/src/release/bundle.js` (record `workflow.variants`)
- `packs/{legacy-transformation-on-aws,qa-automated-testing}/pack.yaml`
- tests: `instruction-composition`, `render-instructions`, `release-bundle`,
  `workflow-semantics`

**Steps:** follow the design's "Workflow variants" section. Both manifest keys
together is an error. Old file names and ids resolve through `aliases`.

**Tests:** old and new forms load the same composed instruction bytes. Both
keys together fail. Regenerated scaffolds show no diff. The T4 equivalence
test passes. `consumedInputs` changes only for the variant files and the two
manifests.

**Customer bytes:** none (variant ids do not appear in customer files).

**Done when:** both packs use `workflow.variants` and every check is green.

### T14: Generated catalogues and CI check (phase P5b)

**Goal:** `skills/README.md` and `workflows/README.md` are generated and
committed, and CI fails when they drift.

**Touch set:**
- `skills/README.md` (generated)
- `workflows/README.md` (generated)
- `packs/regression-software-testing/catalog-entry.yaml` (new; catalogue-only
  entry: title, description and use cases)
- `installer/src/catalog.js` (read the catalogue-only entry)
- `scripts/regenerate.sh` (also run `ramp-pack catalog --write`)
- `.github/workflows/build-packs.yml` (add a `ramp-pack catalog --check` step)
- `installer/test/release-workflows.test.js` (if it asserts the step list)

**Steps:** generate, commit, wire the check.

**Tests:** `catalog --check` is green on the branch and red after
hand-editing either output.

**Customer bytes:** none.

**Done when:** CI runs the check and it is green.

### T15: Root README and maintainer docs (phase P5c)

**Goal:** the root README follows the design's outline, with the generated
pack table. `AGENT_HANDOFF.md` moves to `docs/maintainers/`.

**Touch set:**
- `README.md`
- `AGENT_HANDOFF.md` moved to `docs/maintainers/agent-handoff.md`
- `CONTRIBUTING.md` (one authoring link)
- `installer/test/checkpoint3a-contract.test.js` (README wording rule only,
  if affected)
- `installer/test/readme-links.test.js` (new)

**Steps:**
1. Rewrite the README to the design outline. Add the catalogue markers and
   run `ramp-pack catalog --write`.
2. Add a short "For pack authors" section: add a skill, classify it, add a
   variant, regenerate.
3. Add an upgrade note: earlier `init` and helper installs keep a stale
   `skill.yaml` that the customer may delete.

**Tests:** `catalog --check` is green. `readme-links.test.js` checks that
every relative link in `README.md` resolves to an existing file, and every
`#anchor` to a heading. The full suite passes.

**Customer bytes:** none.

**Done when:** the link test proves three links from `README.md`: each row of
the pack table links to `packs/<pack>/README.md`; "Start here" links to the
`#install-a-pack` section; and "Browse skills" links to `skills/README.md`,
which names the packs that use each skill.

### T16: Close the compatibility window (phase P6), held

**Starts only after** the first published release built from the new layout,
and a separate approval.

**Scope:** remove the old roots from the resolver, helpers and `compose.js`;
the `workflow.overlays` key, the old frontmatter keys and `aliases`; the
stubs; the pack-override tier; and the v1 `skill.yaml` reader. Narrow the
clean-input list to the new roots. Add the grep guard test.

**Done when:** the grep guard passes, and the equivalence test, the
determinism script and the helper matrix are green.

### T17: Adopt the kept-drifted mirrors (design D2), conditional

**Closed as not needed:** T1 kept no mirror drifted, so T17 made no change.

**Needed only if** T1 keeps any skill drifted. Otherwise it is closed with no
change. It is the one task exempt from invariant 4.

**Goal:** each kept-drifted skill drops its lock entry and becomes
`origin: ramp`, as design D2 describes for after the skills move.

**Touch set:**
- `dependencies/skills.lock.yaml` (the adopted entries only)
- `dependencies/skills.sources.yaml`, only if a source has no locked skill left
- `skills/<slug>/skill.yaml` of each adopted skill
- `installer/test/pilot-skill-provenance.test.js`
- `.github/workflows/build-packs.yml`, only if the pilot expectation step changes
- `installer/test/customer-layout.test.js` (allowlist, if a release bundle
  changes)

**Steps:**
1. Rewrite each adopted `skill.yaml` to `origin: ramp`, with `version`, the
   lock licence as `license`, and `basedOn` taken from the lock entry.
2. Remove the lock entry.
3. Drop the skill from the pilot test and `EXPECTED_UNSYNCHRONIZED_FAILURES`,
   keeping a red-on-drift assertion for the skills still locked.

**Tests:** `skills sync --locked` and `skills verify`; the pilot test in both
cache modes; the T8 lint; the equivalence test; the determinism script; the
full suite. Red proof: the adopted skill with `origin: upstream` and no lock
entry fails resolution.

**Customer bytes:** `ramp-pack init` and helper installs are unchanged, since
they already copy the in-tree directory. Release ZIPs that include an adopted
skill now carry its in-tree bytes instead of the locked bytes. The PR lists
each such change, and the equivalence test allowlists it.

**Done when:** no adopted skill has a lock entry, each passes the lint as
`origin: ramp`, and every check above is green.

### T18: Codex target and Cursor rule loading (D7)

**Goal:** `codex` is the fifth adapter in the registry, and `ramp-pack init`,
`build-all`, both helpers and `ramp-pack release` render it. Cursor rules
honour each instruction's `load`, so Cursor can be qualified.

**Touch set:**
- `installer/src/adapters/codex.js` (new) and `installer/src/adapters/index.js`
- `installer/src/render/instructions.js` (a `codex-agents` kind; the Cursor
  branch reads `load` and `description`)
- `installer/src/render/mcp.js` (TOML output for Codex)
- `installer/src/build-all.js` (a v2 pack renders its declared targets only)
- `installer/src/render/add-skills.template.sh` and `.ps1` (tool list, usage
  line, Codex skills root)
- `packs/*/add-skills.{sh,ps1}` (regenerated)
- `packs/*/scaffolded-packs/**` (regenerated: a `codex/` folder for each v1
  pack, and the Cursor rule frontmatter)
- `installer/package.json` and its lockfile, only for a TOML parser as a dev
  dependency
- `scripts/capture-customer-layout.mjs` (an `--add` mode)
- `installer/test/fixtures/customer-layout-baseline.json` (additions only)
- `installer/test/customer-layout.test.js` (allowlist: the Cursor rule
  changes)
- `installer/test/support/customer-layout.js`, only if it lists tools itself
- tests: `adapters`, `render-instructions`, `render-mcp`, `render-command`,
  `e2e`, `add-skills-helpers`, and `instruction-portability` (tool lists only)

**Steps:**
1. Write the Codex adapter to this layout. Each point marked "verify" is
   checked against the current Codex CLI documentation and one real Codex
   run. The PR records the Codex version and each result, and adjusts the
   adapter where a point does not hold:
   - instructions, kind `codex-agents`: the primary renders to `AGENTS.md` at
     the project root, and companions to `.codex/instructions/<file>`.
     Codex loads only `AGENTS.md` (verify), so `AGENTS.md` opens with a
     header naming each companion and when to read it: at session start for
     `load: always`, when its description applies for `load: auto`;
   - skills under `.agents/skills/<slug>/` (verify; older Codex releases read
     `.codex/skills/`);
   - MCP servers in `.codex/config.toml`, one `[mcp_servers.<id>]` table each,
     with `command`, `args` and an `env` table, or `url` for an HTTP server
     (verify that Codex reads a project `.codex/config.toml` in a trusted
     project, and the `url` key);
   - command kind `none`, as for Kiro and Cursor, because Codex custom
     prompts are user-level only (verify);
   - default spec root `specs`;
   - size: Codex reads at most 32 KiB of project instructions by default
     (`project_doc_max_bytes`, verify). When the rendered `AGENTS.md` would
     exceed it, the primary moves to `.codex/instructions/<file>` like a
     companion, and `AGENTS.md` keeps only the header, which names that file
     as the one to read first. The alternative, chosen only if the real
     Codex run shows the pointer is not followed, is to raise
     `project_doc_max_bytes` in the project `.codex/config.toml`.
2. Render the TOML with a small deterministic writer for the value shapes
   `pack.yaml` allows: strings, string arrays and a string table for `env`.
   Any other shape fails with a clear error. The JSON adapters are unchanged.
3. `build-all` renders the declared targets of a v2 pack and every registered
   tool for a v1 pack. The two v2 packs keep their four folders until T19,
   and each v1 pack gains `scaffolded-packs/codex/`.
4. Cursor: a companion with `load: always` gets `alwaysApply: true`. One with
   `load: auto` gets `alwaysApply: false` and its `description`, or the file
   stem, so the Cursor agent can request it. Today both render
   `alwaysApply: false` with no description, which Cursor treats as a rule
   applied only by hand, so the always-loaded skill-activation rule never
   loads. The existing Cursor expectation in `render-instructions` changes
   with it.
5. Add `codex` to both helper templates with the same message text in both
   engines, and regenerate the helpers and scaffolds.
6. Add the Codex layouts of `init`, the Bash helper and the PowerShell helper
   for every pack to the baseline with `capture-customer-layout.mjs --add`,
   which refuses to change an existing entry. Add the Cursor rule changes to
   the allowlist, per pack and file.

**Tests:** the adapter contract row for `codex`, with `codex` last in
`listAdapterIds()`. `AGENTS.md` with its companion header. Exact TOML bytes
for a stdio server, an HTTP server and a server with `env`, parsed back by a
TOML parser. An unsupported value shape fails. `init --tool codex` and both
helpers with `--tool codex` install into a temporary project. Every pack's
rendered `AGENTS.md` is at most 32 KiB; today's largest primary is close to
it. A fixture with an oversized primary renders the short `AGENTS.md` and the
moved primary file, with the primary bytes unchanged. Red proof: the old
Cursor renderer fails the `load: always` assertion; a v2 fixture that does
not declare `codex` gets no `codex/` folder; removing `codex` from the
PowerShell template fails the helper test; the oversized fixture with the
fallback disabled fails the size assertion.

**Customer bytes:** added: Codex layouts for `init`, the scaffolds and both
helpers. Changed: the Cursor rule frontmatter of companion instructions in
every pack, allowlisted. No release ZIP changes, because no pack qualifies
Codex or Cursor yet.

**Done when:** `scripts/regenerate.sh` leaves no diff, the equivalence test
passes with only the additions and the allowlisted Cursor changes, and the PR
records each "verify" result.

### T19: QA Automated Testing on every harness (D7)

**Goal:** `qa-automated-testing` declares and qualifies every registered
harness, and ships a scaffold and a deterministic release ZIP for each, each
proved by a harness-specific structural and install test.

**Touch set:**
- `packs/qa-automated-testing/pack.yaml` (`distribution` block only)
- `packs/qa-automated-testing/scaffolded-packs/**` (regenerated; adds `codex/`)
- `packs/qa-automated-testing/README.md` (tool lists, a Codex row, MCP paths)
- `installer/test/qa-harness-coverage.test.js` (new)
- `installer/test/support/harness-incompatibilities.js` (new; the approved
  incompatibilities, empty)
- `installer/test/fixtures/customer-layout-baseline.json` (additions only)
- `.github/workflows/build-packs.yml` (both entries of the `helpers` job)
- `installer/test/release-workflows.test.js` (asserts those entries)

**Steps:**
1. Set `targets` and `qualifiedTargets` to
   `[kiro, claude-code, copilot, cursor, codex]`, in registry order.
2. Regenerate the pack's scaffolds.
3. Build the five ZIPs twice with the determinism script, and record the five
   SHA-256 values in the PR. Copilot and Cursor already build twice with
   identical bytes once declared; nothing in the release builder blocks them.
4. Write the coverage test. It iterates `listAdapterIds()`, not the manifest,
   and skips only the harnesses listed in
   `support/harness-incompatibilities.js`, a module exporting one object of
   approved incompatibilities that starts empty; T20 enforces its rules.
   For each harness it builds the ZIP and checks the structure: instruction
   paths and frontmatter, the MCP file path and format (the JSON root key, or
   the Codex TOML tables), the 8 skills under the harness skills root, the
   command file where the harness has one, and no overlay path outside that
   harness's roots apart from its root files (`AGENTS.md`, `CLAUDE.md`,
   `.mcp.json`). It then runs `install.sh`, and `install.ps1` with `pwsh`,
   into a temporary project: install, a reinstall that changes nothing, a
   refusal when an unowned primary instruction file already exists, and an
   uninstall that leaves the project empty.
5. Record in the PR, per harness, the documented behaviour each structural
   check relies on: Copilot reads a description-only instructions file and
   `.github/skills`; Cursor's rule types, `.cursor/skills` and the `type` key
   in `.cursor/mcp.json`; Codex the T18 points. Each is marked verified, or
   adjusted in this task.
6. Add the three new release layouts to the baseline with
   `capture-customer-layout.mjs --add`.
7. Update the pack README: the supported-tool sentence, the scaffold table
   with a Codex row, the `--tool` lists of both helpers and `init`, the
   instruction-mapping table with a Codex column and T18's Cursor
   frontmatter, and the MCP configuration paths.
8. Add the coverage test to both entries of the `helpers` job, so
   `RAMP_REQUIRE_POWERSHELL` makes a missing engine fail instead of skip.

**Tests:** the coverage test on Linux and Windows; the determinism script for
the pack, five archives; the equivalence test. Red proof: dropping `cursor`
from `qualifiedTargets` fails the coverage test, and one changed byte in the
rendered Codex `config.toml` fails its structural check.

**Customer bytes:** added: the Copilot, Cursor and Codex release ZIPs and the
`codex/` scaffold of this pack. The Kiro and Claude Code customer files are
unchanged; their `bundle-manifest.json` records the new manifest hash, which
is ZIP metadata.

**Done when:** five ZIPs build twice with identical bytes, the coverage test
is green on both runner families, and the equivalence test passes with only
the additions.

### T20: Harness registry drift test (D7)

**Goal:** CI fails when the adapter registry gains a harness that QA
Automated Testing or either helper does not cover, unless the maintainer has
recorded an approved incompatibility.

**Touch set:**
- `installer/test/harness-registry-drift.test.js` (new). It reads T19's
  `support/harness-incompatibilities.js` and does not edit it.

**Steps:**
1. Write the check as one function of the registry, the QA manifest, the
   tools each helper template accepts, and the approved incompatibilities.
   It returns findings.
2. Findings: QA `targets` or `qualifiedTargets` differs from the registry,
   as sets, minus the approved incompatibilities; a helper template accepts a
   tool set other than the registry, or a skills root other than the
   adapter's.
3. The approved incompatibilities are the object in
   `support/harness-incompatibilities.js`, which T19's coverage test also
   reads, so an approved harness is skipped there and allowed here. This
   test owns the list's rules: each entry names the harness and states a
   non-empty reason; an entry for a harness outside the registry, or for one
   QA qualifies, is a finding, so the list cannot go stale. Adding an entry
   is a reviewed change to that module, and that review is the maintainer's
   explicit approval.
4. The test runs the check on the repository and expects no findings.

**Tests:** the test itself. Red proofs in the same file, on injected inputs:
a registry with an extra `future-tool` gives findings naming QA and both
helpers; an approved entry for it clears the QA findings; an entry without a
reason gives a finding; a stale entry gives a finding.

**Customer bytes:** none.

**Done when:** the test is green on the branch and holds the four red proofs.

## Rollback

Each task is one merge commit on `revamp-starter-packs`. Revert in reverse
landing order with `git revert -m 1 <merge>` through a pull request. Reverting
T11, T12, T13 or T19 after T14 also regenerates the catalogue in the same revert,
so the CI check stays green. Each baseline addition reverts with the task that
made it. To withdraw Codex alone after later tasks have landed, revert T20,
T19 and T18 in one pull request, and drop the Codex entries from the
equivalence allowlist in the same change. Customers need no action at any
point (design, "Rollback").

## Follow-on work, not in this plan

- Lock verification in the no-Node helpers.
- Adopting or locking the 31 `origin: local` skills (D4).
- Converting the 12 v1 manifests to v2.
- Qualifying `legacy-transformation-on-aws` for Copilot, Cursor and Codex.
- Adding Codex to the tool lists in the other pack READMEs.
- A documentation site built from the catalogue model.
