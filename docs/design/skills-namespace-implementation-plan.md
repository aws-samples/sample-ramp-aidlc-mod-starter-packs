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
| D2 | The 5 locked mirrors that differ from the lock are re-synced to the lock in T1, unless the diff review in T1 shows a deliberate local edit. Such a skill is reported in the PR and kept drifted until T11. |
| D3 | `common/instructions/` moves to `workflows/base/`. |
| D4 | The 31 `origin: local` skills stay unreleasable; adopting or locking them is a later track. |
| D5 | The compatibility window closes only after the first published release built from the new layout, by separate approval (T16 is filed held). |
| D6 | The draft use-case, AWS-service and technology lists in the design are the initial vocabulary. |

## Invariants every task keeps

1. **Customer layout.** From T4 on, the customer-layout equivalence test
   passes in every task. The only allowlisted change is T7's removal of
   `skill.yaml` from the 9 RAMP skills.
2. **Release determinism.** `scripts/verify-release-determinism.mjs` builds
   every qualified target twice with identical bytes, in every task that
   touches `installer/`, `skills*/`, `workflow*/`, `common/` or `packs/`.
3. **Installer contract.** `.ramp/` state, the owner key
   `<pack>--<target>--<profile|standalone>`, the `install-files.tsv` format
   and `install.sh` / `install.ps1` behaviour do not change. The install test
   suites run unmodified, apart from path fixtures.
4. **Lock.** `dependencies/skills.lock.yaml` changes in no task.
5. **Generated files.** `scripts/regenerate.sh` leaves no diff under
   `packs/*/scaffolded-packs` or `packs/*/add-skills.{sh,ps1}`. Generated
   helpers are regenerated, never hand-edited.
6. **Public repository.** No credentials, account ids, machine paths,
   internal names or customer content in any commit.

## How each task runs

1. The task's bead is claimed. A worktree is created from the current
   `origin/revamp-starter-packs` on branch `seat/<task>-<slug>`.
2. The task is implemented to its section below, in commits authored by
   Fabrianne Effendi.
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

```text
T1 ─┐
T3 ─┴─> T4 ─────────────┐
T2 ─┬─> T5 ─────────────┼──────────────────────────────> T14 ─> T15 ─> [T16 held]
    ├─> T6 (also T3) ───┼──────────────> T13 ──────────────^
    └───────────────> T7 ─┬─> T8 ──┐          ^
                          ├─> T9 ──┼─> T11 ─> T12
                          └─> T10 ─┘
```

| Wave | Tasks (parallel) | Starts when |
|---|---|---|
| 1 | T1, T2, T3 | now |
| 2 | T4, T5, T6 | T4: T1 and T3 landed. T5: T2 landed. T6: T2 and T3 landed. |
| 3 | T7 | T2 and T4 landed |
| 4 | T8, T9, T10 | T7 landed |
| 5 | T11 | T4, T8, T9 and T10 landed |
| 6 | T12 | T11 landed |
| 7 | T13 | T6 and T12 landed |
| 8 | T14 | T5, T6, T8, T11 and T13 landed |
| 9 | T15 | T14 landed |
| held | T16 | first published release from the new layout, and approval |

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

**Steps:**
1. Write `support/customer-layout.js`. It computes, for one input, the sorted
   list of `{path, sha256, mode}` a customer project receives. Inputs:
   - the release bundle of every v2 pack and qualified target: the `overlay/`
     entries with the prefix stripped, plus `install.sh` and `install.ps1`;
   - the `ramp-pack init` plan for every pack and target tool, in a temporary
     directory;
   - the Bash helper for every pack and target tool, in a temporary directory.
   The PowerShell helper is covered by the existing parity tests, which assert
   it copies the same tree as Bash.
2. `capture-customer-layout.mjs` writes the baseline JSON. It is run only when
   a task's plan allows a customer change, and that task lists the change in
   its PR.
3. `customer-layout.test.js` recomputes every layout and compares it with the
   baseline. On failure it prints the first differing paths. An allowlist
   object in the test file starts empty.

**Tests:** the new test. Red proof: deleting one file from any skill used by
a pack, or changing one byte, fails it. Runtime must stay within the CI
budget. If the full matrix is too slow for `npm test`, the test samples one
target tool per pack, and the full matrix runs in the `verify` workflow as a
separate step.

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
   timestamps.
3. `ramp-pack catalog --write [--root <dir>]` writes `skills/README.md`,
   `workflows/README.md` and the README block between
   `<!-- RAMP:CATALOG packs START -->` and `END`, when those files or markers
   exist. `--check` exits 1 and lists every stale output.

**Tests:** a fixture repository rendered to expected Markdown. Two runs give
identical bytes. `--check` is red after hand-editing an output.

**Customer bytes:** none.

**Done when:** the command and its tests land, and running it against the real
repository succeeds without writing any file (no markers or outputs exist yet).

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
- `installer/src/skills.js` (copy plan excludes `skill.yaml`)
- `installer/src/release/entries.js` (exclude from the overlay; record as a
  metadata input)
- `installer/src/render/add-skills.template.sh` and `.ps1` (copy excludes
  `skill.yaml`)
- `packs/*/add-skills.{sh,ps1}` (regenerated)
- `installer/test/customer-layout.test.js` (allowlist: 9 removed files)
- `installer/test/fixtures/customer-layout-baseline.json` (re-captured)
- the resolver, release-bundle and add-skills-helpers tests touching these
  paths

**Steps:**
1. In lock verification, ignore exactly one root `skill.yaml` when its
   `origin` is `upstream`. Any other extra file still fails.
2. Exclude a root `skill.yaml` from the `ramp-pack init` copy, both helpers
   and the release overlay.
3. Release records the `skill.yaml` of each consumed skill as a metadata input
   in `consumedInputs`, with a distinct role.
4. Re-capture the baseline. The diff must be exactly the 9
   `skills/<ramp-skill>/skill.yaml` removals for each tool path and pack.

**Tests:** an extra non-sidecar file still fails verification, and a sidecar
alone passes. The Bash and PowerShell helpers skip `skill.yaml`. Release
records the metadata input. The determinism script passes.

**Customer bytes:** `skill.yaml` disappears from installed RAMP skills.

**Done when:** the baseline diff in the PR is exactly the allowlisted
removals.

### T8: `skill.yaml` v2 for every skill (phase P1c)

**Goal:** all 55 skills carry v2 metadata with the Appendix A classification,
and a repository lint enforces it.

**Touch set:**
- `skills-library/*/skill.yaml` (46 new)
- `skills/ramp/*/skill.yaml` (9 rewritten from v1 to v2)
- `installer/test/skill-taxonomy-lint.test.js` (new)

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

**Tests:** the lint test. Red proof: deleting one `skill.yaml`, or adding an
unknown value, fails it. The T4 equivalence test passes unchanged, because T7
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
5. Add `dependencies/resolver.js`, `skills.js` and `instructions/compose.js`
   to `RELEASE_GENERATOR_FILES`.
6. Make the clean-input list the union of old and new roots from the design.

**Tests:** guard fixtures fail with both paths named. A `skills/` hit beats
nothing, because duplicates fail instead. Origin behaviour has one fixture
per value. The warning text is asserted. Reserved slugs are refused. The
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

**Steps:**
1. Add the order: `skills/<slug>/`, then the pack, `skills/ramp/` and
   `skills-library/` tiers during the window.
2. `--skills-src` replaces `skills/` and `skills-library/`; the pack and
   `skills/ramp/` tiers still apply.
3. Add the guard over every consulted root, with the same message text in
   both engines.
4. The repository check requires `skills/`, and treats `skills/ramp/` and
   `skills-library/` as optional.
5. Regenerate the 14 pack helpers.

**Tests:** Bash and PowerShell parity for each rule, including the PowerShell
error text matching Bash. The helper CI matrix includes Windows PowerShell
5.1. Red proof: the duplicate-slug fixture in both engines.

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

**Steps:**
1. Rewrite the README to the design outline. Add the catalogue markers and
   run `ramp-pack catalog --write`.
2. Add a short "For pack authors" section: add a skill, classify it, add a
   variant, regenerate.
3. Add an upgrade note: earlier `init` and helper installs keep a stale
   `skill.yaml` that the customer may delete.

**Tests:** `catalog --check` is green. Every relative link in `README.md`
resolves to an existing file (a small test or script in the PR). The full
suite passes.

**Customer bytes:** none.

**Done when:** a newcomer can go from the README to a pack, its install path
and its skills in three links, and every link resolves.

### T16: Close the compatibility window (phase P6), held

**Starts only after** the first published release built from the new layout,
and a separate approval.

**Scope:** remove the old roots from the resolver, helpers and `compose.js`;
the `workflow.overlays` key, the old frontmatter keys and `aliases`; the
stubs; the pack-override tier; and the v1 `skill.yaml` reader. Narrow the
clean-input list to the new roots. Add the grep guard test.

**Done when:** the grep guard passes, and the equivalence test, the
determinism script and the helper matrix are green.

## Rollback

Each task is one merge commit on `revamp-starter-packs`. Revert in reverse
landing order with `git revert -m 1 <merge>` through a pull request. Reverting
T11, T12 or T13 after T14 also regenerates the catalogue in the same revert,
so the CI check stays green. Customers need no action at any point (design,
"Rollback").

## Follow-on work, not in this plan

- Lock verification in the no-Node helpers.
- Adopting or locking the 31 `origin: local` skills (D4).
- Converting the 12 v1 manifests to v2.
- A documentation site built from the catalogue model.
