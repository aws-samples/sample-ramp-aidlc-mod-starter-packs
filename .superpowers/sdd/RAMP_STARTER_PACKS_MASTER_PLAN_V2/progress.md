# SDD ledger — plan: docs/RAMP_STARTER_PACKS_MASTER_PLAN_V2.md

Baseline: 86781f17ed5fe635650bff6c1b69bc464708de58
Baseline verification: `npm test --prefix installer` → 10 files, 60 tests passed.
Isolation: working in the existing dedicated `revamp-starter-packs` feature branch.
Planning documents remain untracked and are excluded from implementation commits unless promoted to product documentation.
Ruling: record the immutable baseline SHA instead of creating a tag — normal commands cannot write `.git`, while the SHA provides the required rollback reference — cost if wrong: the baseline has no friendly tag name but remains directly addressable.

Wave 1 plan: `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-1-execution-plan.md`

## Pre-flight interface scan

| Tasks | Shared interface | Finding |
|---|---|---|
| 1 → 2 | Registered tool IDs consumed by v2 manifest validation | Clean if adapter registry lands first. |
| 1 → 3 | Adapter default spec roots and renderer metadata consumed by workspace resolution | Clean if workspace resolution imports the registry rather than recreating maps. |
| 2 → 3 | Manifest targets and profiles consumed by workspace resolution | Clean; Task 3 must preserve v1 manifests with no distribution metadata. |
| 1 ↔ 3 | `plan.js`, `build-all.js`, renderer, and CLI | Sequential edits required; Task 3 builds on Task 1 rather than running in parallel. |
| 2 ↔ 3 | `manifest.js` normalized profile shape | Sequential edits required; Task 3 consumes Task 2's validated shape. |
| Task 1 internal | Refactor vs byte-identical output | Tests require current output and behavior to remain unchanged. |
| Task 2 internal | Schema example vs current role-bearing instruction contract | Resolved by retaining the current `instructions` structure and omitting `workflow.primary`. |
| Task 3 internal | Kiro native specs vs shared tool neutrality | Resolved by using `.kiro/specs` whenever Kiro participates, otherwise `specs`, with an explicit safe override. |

Ruling: execute adapter centralization before manifest metadata even though the strategic plan lists metadata first — v2 target validation needs one authoritative adapter registry — cost if wrong: the first checkpoint is an internal refactor before visible catalog value.

Task 1: Ruling: the implementer will not commit directly; the controller will verify and create the checkpoint commit because normal subagent commands cannot write the read-only `.git` mount — cost if wrong: the commit is created one step later than the implementer report, so the controller must verify the exact working-tree diff before review packaging.

Task 1 complete: `0f8e81c` (`refactor: centralize tool adapter registry`).
Verification: focused adapter/renderer suite passed 35 tests; full installer suite passed 11 files / 66 tests; all generated tool scaffolds and `add-skills.sh` files matched committed bytes; independent review approved with no material findings.

Task 2 complete: `79789ff` (`feat: add RAMP pack metadata and catalog`).
Verification: focused manifest/catalog suite passed 46 tests; full installer suite passed 12 files / 109 tests; both migrated pilot projections matched committed bytes; two review-fix cycles closed runtime/schema parity and SemVer gaps; final independent review approved.

Task 3 complete: `a8ee8a4` (`feat: support shared multi-tool workspaces`).
Verification: focused workspace/render/plan/build/e2e suite passed 65 tests; full installer suite passed 14 files / 160 tests; all default projections matched committed bytes; atomic mixed-tool conflict behavior and path/profile rules passed independent review.

Task 4 complete: `b007b8e` (`feat: compose instruction overlays safely`).
Verification: focused composition coverage passed 46 tests; full installer suite passed 15 files / 195 tests; malformed/residual owned tokens fail fast while unrelated templates remain untouched; independent review approved.

Task 5 complete: `7bfc67a` (`refactor: share the canonical RAMP workflow`).
Verification: focused workflow semantics passed 34 tests; full installer suite passed 16 files / 229 tests; only QA primary projections changed, custom roots and native companion paths render correctly, and two review-fix rounds closed decision-channel, per-phase approval, and Phase 0 artifact-contract findings.
Ruling: add the ninth `workflow-overview` slot because legacy's adaptive overview cannot safely inherit the generic brownfield diagram — cost if wrong: one additional replacement surface must remain stable across future overlays.
Ruling: the primary Phase 0 workflow delegates its exact artifact set to the active reverse-engineering companion — cost if wrong: customers must consult the companion for the complete list, but overlays no longer create contradictory artifact contracts.

Task 6 complete: `8be14a3` (`fix: gate shared reverse engineering approval`).
Verification: focused workflow semantics passed 42 tests; full installer suite passed 16 files / 237 tests; exactly 36 generated reverse-engineering companions changed across the nine common inheritors; all local overrides stayed byte-identical; independent review approved.
Ruling: use six non-nested reverse-engineering slots instead of empty adaptive insertion points so Targeted mode can replace the entire generic full scan — cost if wrong: overlays replace larger coherent regions, but incompatible policies cannot accidentally execute together.
Ruling: the reverse-engineering companion owns the detailed transition for the same single Phase 0 approval gate summarized by the primary workflow — cost if wrong: the ownership sentence must remain synchronized, but one approval cannot be audited twice.
Ruling: place the QA inventory additive slot after the generic analysis body rather than nesting it at the old exact position — cost if wrong: QA inventory ordering changes slightly, but composition remains deterministic and non-nested.
Ruling: QA inventory and legacy adaptive reverse-engineering are not a qualified overlay combination in this wave — cost if wrong: a future combined pack needs compatibility metadata or conditional full-mode behavior before release.

Task 7 complete: `41f83ab` (`refactor: extract the QA reverse-engineering overlay`).
Verification: focused composition/workflow coverage passed 80 tests; full installer suite passed 16 files / 244 tests; exact nine-path scope, only four QA reverse-engineering projections changed, custom roots rendered across all adapters, and non-QA isolation passed independent review.

Task 8 complete: `aa7174b` (`refactor: compose the legacy transformation workflow`).
Verification: focused legacy/workflow coverage passed 69 tests; full installer suite passed 16 files / 255 tests; exact 12-path scope with four primary projections and two launchers; all protected reverse-engineering, skill, MCP, and installer files stayed byte-identical; independent review approved.
Ruling: preserve the legacy six-gate contract by placing decision-file approval/audit/state gates inside the three domain slots while inheriting the canonical post-artifact gates — cost if wrong: legacy has more deliberate stops than generic packs, but no phase artifact can collapse decisions and approval into one step.
Ruling: launcher bodies use root-neutral prose instead of workspace tokens because command rendering is not workspace-aware — cost if wrong: launchers refer to paths indirectly through primary instructions, but custom workspaces cannot be sent to a conflicting default root.

Task 9 complete: `4f1fb18` (`refactor: compose adaptive legacy reverse engineering`).
Verification: focused composition/legacy/workflow coverage passed 101 tests; full installer suite passed 16 files / 256 tests; exact nine-path scope with only four reverse-engineering projections; one review-fix round synchronized the scope artifact and strengthened exact adaptive invariant tests; independent re-review approved.
Ruling: synchronize the adaptive scope artifact around the common approval lifecycle rather than adding a second approval action — cost if wrong: the overlay references common lifecycle section names, but scope, metadata, and state cannot diverge.

Task 10: Ruling: accept the renderer-derived 66-path Task 7 delta instead of forcing the 81-path estimate; fifteen regenerated projections are byte-identical because default token resolution reproduces their existing bytes — cost if wrong: the checkpoint diff is smaller than the preflight estimate, but committed scaffolds remain exact generated output and the tests must prove every source/custom/shared render path.

Task 10 complete: `4c4a45b` (`refactor: make single-repo workflows workspace-neutral`).
Verification: exact neutral-source totals are 152 state, 14 spec, and 21 instruction tokens; focused portability passed 119 tests; full installer suite passed 17 files / 375 tests; custom, standalone, and mixed-tool roots passed across ten packs and four adapters; COTS launchers are root-neutral; independent review approved the ruled 66-path renderer-derived delta.

Task 11 complete: `8c591ad` (`refactor: normalize multi-repo workflow paths`).
Verification: focused portability passed 144 tests; full installer suite passed 17 files / 400 tests; five multi-repository sources use exact resolver-owned root and role-aware instruction-token inventories; custom, standalone, Kiro + Claude Code, and Claude Code + Cursor workspaces passed across both packs and four adapters; every generated path and byte matched a fresh production plan; independent review approved after a test-first correction made destination hand-off state land directly in the resolved state root.
Ruling: accept the renderer-derived 28-path Task 8 delta instead of forcing the 29-path estimate; the web Kiro primary projection is byte-identical because Kiro's standalone defaults and native instruction paths reproduce its prior literals — cost if wrong: the checkpoint contains one fewer generated diff, but production-plan parity proves no stale scaffold was omitted.

Task 12 complete: `c7a49de` (`test: enforce workflow portability and scaffold parity`).
Verification: focused Wave 2 gates passed 486 tests; full installer suite passed 18 files / 641 tests; all 14 manifest packs and declared adapters pass custom/standalone/shared portability; QA and legacy share bounded lifecycle invariants without losing domain behavior; every committed scaffold and `add-skills.sh` path/byte equals production rendering; two independent reviews approved after a test-first root-symlink traversal guard.
Ruling: scaffold drift tests may create and remove only unique temporary fixtures to prove failure sensitivity; they never mutate committed scaffolds or invoke in-place generation — cost if wrong: the test suite carries a small temporary-filesystem dependency, but production output remains read-only and deterministic.

Wave 2 plan: `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-2-workflow-plan.md`
Wave 3 plan: `.superpowers/sdd/RAMP_STARTER_PACKS_MASTER_PLAN_V2/wave-3-release-plan.md`

Task 13 complete: `da26dee` (`feat: define locked skill provenance`).
Verification: checksum and manifest contract coverage passed 116 focused tests; the full installer suite passed 20 files / 757 tests; exactly 12 product paths were committed; all target files are LF-only; no real skill lock, cache, distribution output, scaffold, pack, CLI, or no-Node helper change landed; three independent reviews approved after a test-first correction made an existing dangling, valid-target symlink, or non-regular `skills.lock.yaml` fail closed instead of appearing absent.
Ruling: the first Wave 3 checkpoint defines only offline provenance contracts and ownership boundaries; it deliberately does not fetch upstream repositories or generate a real lock — cost if wrong: no upstream skill is yet reproducibly consumable, but the resolver and sync checkpoints now have one validated schema, hash frame, and source registry to build on.
Ruling: `loadSkillLock()` returns `null` only for a genuinely absent optional lock and rejects every existing non-regular lock path — cost if wrong: unusual symlink-based local setups must use a regular file, but provenance validation cannot be bypassed by filesystem indirection.

Task 14 complete: `ffdb23c` (`feat: resolve skills with locked provenance`).
Verification: resolver/planner/CLI coverage passed 83 focused tests; compatibility/scaffold coverage passed 365 tests; the full installer suite passed 21 files / 815 tests; all 14 packs smoke-built without touching a cache; exactly 10 product paths were committed; no real lock, cache, distribution output, pack, scaffold, helper, workflow, schema, skill tree, or package dependency change landed; three independent reviews approved after test-first fixes closed nested-library lock bypass, mandatory locked `SKILL.md` closure, path-specific drift diagnostics, fail-closed `skills: all` roots, and complete verifier error context.
Ruling: lock enforcement is per skill name, so an unlocked compatibility skill remains `legacy-local` even after other names are pinned — cost if wrong: the repository temporarily supports mixed provenance, but a partial initial lock does not break the remaining 55-skill compatibility library.
Ruling: `dependencies/skills.sources.yaml` wins repository-root inference across the complete ancestor chain before any nearer `skills-library` fallback — cost if wrong: unusual nested repositories must pass an explicit resolver/root, but a nested compatibility library cannot downgrade an authoritative higher lock.
Ruling: checkpoint 2 verifies source integrity at each resolution while `applyPlan()` remains path-copy based; immutable consumed-input closure remains a release-bundle responsibility — cost if wrong: ordinary local `init` retains a narrow time-of-check/time-of-use window, but no release artifact may rely on that weaker path-copy contract.

Task 15 complete: `04c0a75` (`feat: pin initial upstream skills`).
Verification: the full installer suite passed 23 files / 937 tests; the separate scaffold-drift gate passed 77 tests; the generated ten-entry lock verified fully offline and regenerated byte-identically with SHA-256 `73edbf0adef0db51fc7c7dc8b74ed2d34c9a7f77574fee0e77788a005cbfd9f8`; immutable Git-object review matched 180 files, five executable modes, both sources' exact LICENSE/NOTICE records, and all ten compatibility mirrors; exactly 13 product paths were committed; cache, planning, review, ATX, workflow, pack, scaffold, helper, skill-tree, package, and documentation paths were excluded. Independent Part A, snapshot-boundary, sync/CLI, provenance, and integrated reviews all approved.
Ruling: upstream updates resolve mutable refs only in the explicit `skills update-lock` operation, capture one immutable commit per source, and publish the lock with compare-and-swap and atomic replacement — cost if wrong: update operations are intentionally stricter and slower, but ordinary builds and verification remain deterministic, offline, and network-free.
Ruling: the synchronized source cache is an ignored local acceleration layer rather than a Git artifact; the committed lock plus compatibility mirrors are the clean-clone contract — cost if wrong: a user must explicitly synchronize when exact source-level legal metadata is required locally, but cloning the repository never downloads or stores upstream cache payloads.

Task 16 complete: `b3b5728` (`feat: close pilot skill provenance`).
Verification: the full offline installer suite passed 26 files with 986 tests passed and 86 capability/runtime skips; the synchronized-cache suite passed 993 tests with 79 skips; the final focused helper, contract, provenance, and end-to-end suite passed 52 tests with 89 explicit skips; all 14 Bash helpers passed syntax validation on macOS Bash 3.2; all generated helper modes, scaffold drift, lock verification for 15 skills, and `git diff --check` passed. The committed boundary contains exactly 85 byte-identical skill moves, nine new repository-authored `skill.yaml` files, and 48 non-move product paths. Independent provenance, scope, and security reviews approved after test-first fixes closed incomplete traversal handling, non-ASCII/case-fold path ambiguity, PowerShell special-file handling, and source/destination FIFO and unreadable-entry mutation risks.
Ruling: generated Bash and PowerShell helpers are dependency-free pack interfaces backed by one renderer and may install only regular files under printable-ASCII, platform-safe relative paths — cost if wrong: unusual Unicode skill paths are rejected, but Bash 3.2, Windows PowerShell, and modern PowerShell share one fail-closed security contract.
Ruling: the initial pilot lock contains the ten upstream skills plus five repository-authored RAMP skills, while the nine legacy repository-authored trees move intact from `skills-library/` to `skills/ramp/` and gain explicit ownership metadata — cost if wrong: the compatibility library becomes smaller and provenance more visible, but every moved payload remains byte-identical and drift is enforced.

Task 17 complete: `c1c543c` (`feat: compose self-contained release bundles`).
Verification: the root-owned release suite passed all 147 tests with the real QA cache enabled; the full installer suite passed 27 files with 1,138 tests passed and 90 capability/runtime skips; scaffold drift passed 77 tests; the real `qa-automated-testing` Kiro bundle built from an offline synchronized cache and included the exact locked mobile-test-automation payload. The exact 15-path product boundary passed `git diff --check`; no ZIP, `dist`, repository cache, planning document, or user-owned `docs/` path entered the commit. Independent source-closure, legal/metadata, and compatibility/scope reviews approved after adversarial test-first fixes closed lock ABA reads, legal-cache symlink escape, provenance injection/accessors, local-path and credential leakage, real documentation false positives, and untraced symlink compatibility.
Ruling: Checkpoint 4 emits a deterministic unpacked bundle model with exact bytes, stable metadata, legal payloads, `SHA256SUMS`, and a complete consumed-input closure; archive creation remains a later checkpoint — cost if wrong: customers cannot download a ZIP yet, but archive tooling cannot hide provenance or layout defects.
Ruling: copied workflow and skill documentation is trusted only through its authenticated byte closure, while customer-derived README and JSON boundaries are scanned for machine-local paths and credential material — cost if wrong: trusted documentation may contain generic absolute-path examples, but generated configuration cannot leak customer-local values.
Ruling: release resolution authenticates dependency manifests from captured bytes and constructs the strict resolver from that immutable snapshot rather than rereading the live lock — cost if wrong: each release build uses a short-lived private validation directory, but repository-verified provenance cannot be forged through transient file replacement.

Task 18 complete: `feat: add safe standalone bundle installers` (Wave 3 Task 5, built on WIP `3dd0035`).
Verification: the focused manifest, Bash, PowerShell and release-bundle suites passed 4 files with 306 tests passed and 118 Windows-only or 5.1 skips; the full installer suite passed 30 files with 1,329 tests passed and 180 capability/runtime skips; `git diff --check` was clean. PowerShell runtime cases ran on pwsh 7 on Linux; Windows PowerShell 5.1 runs only in Task 9. Independent PowerShell and bundle-closure reviews approved; security, Bash and scope reviews requested changes, every HIGH and MEDIUM finding was fixed test-first, and a fresh re-review approved at `56eb721`. Remaining LOW findings are follow-on work.
Ruling: `entries.js` adds CONIN$ and CONOUT$ to the shared reserved-name rule (`90de3f8`), which also tightens Task 4 bundles — cost if wrong: a pack file named after a console device can no longer compose, but no bundle can ship a path Windows cannot create.
Ruling: `add-skills-helpers.test.js` gets a test-only spelling fix (`56a7c8c`) so the full suite passes where pwsh exists, and `installer/test/support/install-oracle.js` is a new shared test helper implied by the brief's shared oracle — cost if wrong: two test files outside the Create list changed, with no product effect.
Ruling: the PowerShell preflight-to-lock race and mid-transaction edits are tested with a `Set-PSBreakpoint -Action` injection, since .NET file calls cannot be shimmed like Bash's PATH tools — cost if wrong: those tests depend on the debugger API, but both engines now prove the same race behaviour.
Ruling: SIGTERM or SIGHUP kills pwsh on Linux and macOS without running `finally`, which matches the accepted SIGKILL outcome (lock and transaction left, named by the leftover warning); the PowerShell lock is a file and the Bash lock a directory — cost if wrong: an interrupted PowerShell run needs the documented manual recovery.
Ruling: `c4c4dac` alone fails the PowerShell message-parity test; `ee52dc9` restores parity, and history is not rewritten — cost if wrong: bisecting across that one commit shows a spurious failure.
