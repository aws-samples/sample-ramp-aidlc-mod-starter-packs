# Design: one skills namespace, workflow variants, and customer navigation

**Status:** Approved design. No implementation in this change.
**Date:** 2026-11-11
**Scope:** Second revamp of the source repository on `revamp-starter-packs`:
one physical `skills/<slug>/` namespace classified by customer use case and
AWS service, clearer workflow variant naming, a compatibility and migration
plan, and customer-facing root navigation.
**Non-scope:** Docusaurus or GitHub Pages (deferred), pack slug renames, skill
slug renames, converting v1 pack manifests to v2, new packs, tags, releases,
and any change to `main`.

## Executive decision

1. Every skill lives once, at `skills/<slug>/`. The folder no longer says who
   owns the skill or where it came from; `skills/<slug>/skill.yaml` does.
2. Every skill carries classification metadata: customer use cases, AWS
   services and other technologies, all drawn from one controlled vocabulary
   in `schemas/taxonomy.yaml`.
3. "Workflow overlay" becomes **workflow variant**. Variants live in
   `workflows/variants/`, next to the base workflow in `workflows/base/`, and
   are named after the situation they serve rather than the pack that first
   needed them.
4. The root README becomes a customer start page: choose by use case, install,
   then browse skills and workflows. Its tables, `skills/README.md` and
   `workflows/README.md` are generated from the metadata and checked for drift
   in CI.
5. The migration is staged so that no customer-visible path changes. Every
   phase is proved by a customer-layout equivalence test against a baseline
   captured before the first move, and every phase can be reverted with one
   `git revert`.

## Problem

The repository has three skill trees and two names for the same idea:

| Tree | Skills | What the README says | What the code does |
|---|---:|---|---|
| `skills-library/` | 46 (15 locked upstream mirrors, 31 unlocked) | "Single canonical home for every Agent Skill" (`README.md`, Repository layout) | Third or fourth resolver tier: a verified mirror for locked skills, otherwise `legacy-local`, which release bundles reject (`installer/src/dependencies/resolver.js`, `createSkillResolver`) |
| `skills/ramp/` | 9 RAMP-owned | Not mentioned | Second resolver tier, `skill.yaml` mandatory |
| `packs/<pack>/skills/` | 0 | "OPTIONAL, only when a pack overrides a library skill" | First resolver tier |

Consequences a newcomer meets today:

- The README calls `skills-library/` canonical, but the release resolver treats
  it as a compatibility fallback, and `skills/ramp/README.md` already defers
  moving the remaining skills.
- To find "the skill for Step Functions" an author must know which of three
  trees it sits in. Nothing records which use case or AWS service a skill
  serves; only `api-gateway` has tags.
- The Node resolver verifies locked mirrors against the lock. The no-Node
  helpers (`add-skills.sh`, `add-skills.ps1`) copy `skills-library/<slug>`
  without verification, and 5 of the 15 locked mirrors differ from the lock
  (`installer/test/pilot-skill-provenance.test.js`,
  `EXPECTED_UNSYNCHRONIZED_FAILURES`).
- The README pack table omits `dotnet-app-modernization-on-aws`,
  `framework-upgrade-containerise` and `serverless-event-driven-on-aws`, and
  the layout tree predates `skills/ramp/`, `dependencies/`, `schemas/`, `atx/`
  and release ZIPs. A hand-maintained catalogue drifts.
- "Target" means a tool (`distribution.targets`) and also the instruction an
  overlay changes (overlay frontmatter `target`). Overlay ids name packs
  (`legacy-transformation-workflow`, `qa-existing-test-inventory`) rather than
  what they change.

## Design principles

- **The slug is the customer contract.** Customers see
  `.<tool>/skills/<slug>/`, never the source tree. Slugs do not change in this
  migration, so customer paths do not change.
- **Location carries no meaning.** Origin, owner, version, licence and
  classification are metadata, validated by schema, not implied by a folder.
- **One vocabulary.** Use cases, AWS services and technologies come from one
  file. Free-text tags are not used for navigation.
- **Generated, not hand-written.** Every catalogue a customer reads is
  generated from the same inputs and fails CI when stale.
- **Never choose silently.** When a slug exists in two places the resolver
  stops with an error instead of applying a precedence rule.

## Target tree

```text
README.md                    customer start page; tables generated between markers
CONTRIBUTING.md              unchanged; links to the authoring guide
CODE_OF_CONDUCT.md  LICENSE  unchanged
add-skills.sh  add-skills.ps1  unchanged no-Node entry points
packs/<pack>/                unchanged: the unit a customer chooses
  pack.yaml                  + catalog.useCases; workflow.variants (ids)
  README.md  instructions/  scaffolded-packs/  add-skills.sh  add-skills.ps1
skills/
  README.md                  generated: skills by use case, by AWS service, A-Z
  <slug>/                    one directory per skill, every origin
    SKILL.md                 unchanged content
    skill.yaml               RAMP metadata, schemaVersion 2 (sidecar for upstream)
    references/ scripts/ assets/ ...   unchanged content
workflows/
  README.md                  generated: base workflow, variants, packs using each
  base/                      was common/instructions/
    aidlc-workflow.md
    reverse-engineering.md
  variants/                  was workflow-overlays/
    brownfield-modernization.md
    targeted-reverse-engineering.md
    existing-test-inventory.md
dependencies/                unchanged: skills.sources.yaml, skills.lock.yaml
schemas/
  pack-v2.schema.json        + catalog.useCases, workflow.variants
  skill-v2.schema.json       new: replaces ramp-skill-v1 for new metadata
  taxonomy-v1.schema.json    new
  taxonomy.yaml              new: the controlled vocabulary
  ramp-skill-v1.schema.json  kept through the compatibility window
  skill-lock-v1.schema.json  skill-sources-v1.schema.json   unchanged
installer/  scripts/  atx/   unchanged layout
docs/
  design/                    this document and later designs
  maintainers/agent-handoff.md   was AGENT_HANDOFF.md at the root
```

Removed at the end of the compatibility window: `skills-library/`,
`skills/ramp/`, `workflow-overlays/`, `common/`, and support for
`packs/<pack>/skills/`.

`skills/` holds only skill directories plus `README.md`. The slugs `ramp`,
`README.md` and `taxonomy` are reserved and rejected as skill names, so a
leftover `skills/ramp/` can never be read as a skill.

### Pack-owned skills

`packs/<pack>/skills/<slug>/` is replaced by a metadata field. A skill that only
one pack may use lives at `skills/<slug>/` with `ownerPack: <pack>` in its
`skill.yaml`. Release and lint refuse any other pack that references it. No
pack uses an override today, so nothing moves.

## Skill metadata: `skill.yaml` schemaVersion 2

```yaml
schemaVersion: 2
kind: ramp-skill
name: aws-step-functions          # equals the directory name and SKILL.md name
origin: upstream                  # ramp | upstream | local
version: 1.0.0                    # required for ramp and local; upstream uses the lock commit
license: Apache-2.0               # required for ramp and local; upstream uses the lock licence
maturity: stable                  # experimental | preview | stable | deprecated
ownerPack: legacy-transformation-on-aws   # optional, ramp or local only
basedOn:                          # optional, ramp only (unchanged from v1)
  source: agent-plugins
  commit: <40-hex>
  path: plugins/<plugin>/skills/<skill>
classification:
  useCases: [cloud-native-development]
  awsServices: [step-functions]
  technologies: []                # non-AWS: terraform, dotnet, java, kotlin, gitlab ...
```

Rules, enforced by `schemas/skill-v2.schema.json` and the loader:

- `origin: ramp` replaces "lives in `skills/ramp/`". It requires `version` and
  `license`, as v1 does.
- `origin: upstream` requires a lock entry with the same name. `version` and
  `license` are forbidden because the lock is the single source for them.
- `origin: local` is today's `legacy-local`: an unlocked skill RAMP has not yet
  adopted. Builds and the helpers accept it with a warning; release bundles
  reject it, exactly as today.
- Every classification value must exist in `schemas/taxonomy.yaml` from P1.
  From P5, when every skill has been classified, `classification.useCases`
  also needs at least one value. `awsServices` may stay empty for a skill such
  as `kotlin-coding-standards`.
- v1 `skill.yaml` (the 9 current RAMP skills) is read as
  `origin: ramp, classification: {}` during the window, and the lint reports
  the missing classification.

### Upstream skills keep their bytes

Upstream skills are verified file by file against the lock, and the file
count must match exactly (`resolver.js`, `compareFileRecords`). A `skill.yaml`
placed beside an upstream mirror is therefore a **sidecar**: the verifier
ignores exactly one file, `skill.yaml` at the skill root, and only when
`origin: upstream`. This exclusion must land in the same change that adds the
sidecars (P1); otherwise every build without a synced cache fails.

The in-tree directory of an upstream skill always holds the full mirror plus
the sidecar, because the no-Node helpers have no cache and copy from it. A
directory holding only `skill.yaml` is rejected by the lint. No locked skill ships a
root `skill.yaml` today (`dependencies/skills.lock.yaml`), and a test keeps it
that way: if an upstream skill ever ships its own, the lock update fails with a
clear message instead of overwriting RAMP metadata.

### `skill.yaml` is source metadata

Today the 9 RAMP skills ship `skill.yaml` into customer projects (release
bundle overlay, e.g. `overlay/.kiro/skills/<slug>/skill.yaml`, and the
`ramp-pack init` and helper copies). Agent tools do not read it. This design
stops copying `skill.yaml` to customers for every origin (decision D1), with
two consequences the implementation must handle:

- **Provenance.** Today `skill.yaml` enters the release input closure only
  because it is copied (`release/entries.js`). Once it is no longer copied,
  the bundle records it explicitly as a metadata input in `consumedInputs`,
  so the version and licence it supplies stay traceable. Note that
  `bundle-manifest.json` sits at the ZIP root and `install.sh` does not
  install it; provenance lives with the ZIP, not in the customer project.
- **Stale files.** ZIP installs remove the old `skill.yaml` on upgrade through
  the owned-file manifest, as for any file a new bundle drops. `ramp-pack init
  --force` and the helpers overwrite but never delete (`installer/src/apply.js`),
  so their earlier installs keep a harmless stale `skill.yaml` until the
  customer deletes it. The README upgrade note says so.

## Taxonomy: `schemas/taxonomy.yaml`

One file defines three lists. Each entry has an id, a customer-facing label, a
one-line description and a display order. Use cases also map to the pack
outcome (`catalog.outcome` in `pack-v2.schema.json`), so pack and skill
navigation agree.

### Use cases (draft, decision D6)

| Id | Label | Outcome | Covers |
|---|---|---|---|
| `application-modernization` | Modernize an existing application | transform | legacy decomposition, framework upgrade, .NET, API platform, COTS rewrite |
| `cloud-native-development` | Build a cloud-native application | reimagine | serverless, containers, event-driven, web and mobile back ends |
| `generative-ai-and-agents` | Build generative AI and agents | reimagine | Bedrock, voice agents, agentic workflows |
| `quality-engineering` | Automate testing | automate | web, mobile, regression and property-based testing |
| `security-remediation` | Remediate vulnerabilities | automate | triage, dependency fixes, merge-request delivery |
| `operations-and-incident-response` | Operate and respond to incidents | automate | observability, incident triage, operational review |
| `infrastructure-as-code` | Define infrastructure as code | foundation | Terraform, CDK, CloudFormation, SAM |
| `cloud-foundations` | Set up AWS access and foundations | foundation | IAM, sign-in, general AWS development |

### AWS services (draft)

Ids follow the service name without the `amazon-` or `aws-` prefix:
`lambda`, `step-functions`, `api-gateway`, `ecs`, `fargate`, `ecr`, `ec2`,
`aurora`, `aurora-dsql`, `dynamodb`, `elasticache`, `s3`, `eventbridge`,
`sqs`, `sns`, `kinesis`, `bedrock`, `iam`, `cognito`, `cloudwatch`, `x-ray`,
`cloudformation`, `cdk`, `sam`, `systems-manager`, `secrets-manager`,
`device-farm`, `transform`.

Features stay under their service: Lambda durable functions and Lambda
MicroVMs are `lambda`, and Nova Sonic is `bedrock` with the technology
`nova-sonic`.

### Technologies (draft)

`terraform`, `opentofu`, `ansible`, `pulumi`, `dotnet`, `java`, `kotlin`,
`android`, `ios`, `nodejs`, `mysql`, `postgresql`, `opentelemetry`,
`gitlab`, `nova-sonic`, `strands-agents`.

Adding a value is a one-line change to `taxonomy.yaml` reviewed like code. The
lint rejects unknown values, so a misspelling cannot create a new category.

## Resolver precedence

### Target (after the window)

1. `skills/<slug>/` with a valid `skill.yaml`:
   - `origin: ramp` uses the directory.
   - `origin: upstream` uses the verified cache
     (`<cache>/sources/<source>/<commit>/<path>`). Without a cache it uses the
     in-tree mirror, verified against the lock with the sidecar ignored. A
     mirror that fails verification fails resolution with
     `upstream skill <slug> differs from the lock; run ramp-pack skills sync --locked`,
     replacing today's `locked compatibility mirror <slug> failed verification`.
   - `origin: local` is allowed with a warning in `build-all` and the helpers,
     and rejected by release (strict provenance).
2. Otherwise: `skill <slug> not found in skills/`.

### During the compatibility window

When `skills/<slug>/` exists, the target rules above apply in full, including
cache-first resolution for `origin: upstream`. Only when it does not exist does
resolution try the current tiers in their current order: `packs/<pack>/skills/`,
`skills/ramp/`, the locked cache, then `skills-library/`. Each compatibility
hit from a source-tree root prints
`skill <slug> resolved from <old path>; move it to skills/<slug>/`.

**Ambiguity guard:** if a slug exists as a directory in `skills/` and in any
source-tree compatibility root (`packs/<pack>/skills/`, `skills/ramp/`,
`skills-library/`), resolution fails and names both paths. The locked cache is
not a source-tree root and never trips the guard. A half-finished move or a
fork that adds a skill to an old root cannot silently pick one copy.

The Bash and PowerShell helper templates
(`installer/src/render/add-skills.template.{sh,ps1}`) have no cache, so their
order is: `skills/<slug>/`, then during the window `packs/<pack>/skills/`,
`skills/ramp/` and `skills-library/`. `--skills-src` / `-SkillsSrc` keeps its
meaning, "a directory of `<slug>/` skill folders": when given, it replaces both
`skills/` and `skills-library/`, while the pack and `skills/ramp/` tiers still
apply during the window, as today. The ambiguity guard covers every root the
helper consults. Their repository check, which today requires `skills/ramp/`
and `skills-library/` to exist, changes to require `skills/` and accept the
old roots as optional. Lock verification in the helpers stays out of scope;
see Follow-on work.

### Places that encode the old roots

The implementation must change all of these, and a grep guard in the last
phase proves none remain outside the compatibility module:

- `resolver.js`: `libraryDir`, `rampDir`, the pack-override tier.
- `skills.js`: repo-root detection falls back to a directory named
  `skills-library`.
- `release/bundle.js`: `rampDir` and `libraryDir` hardcoded for release.
- `release/index.js`: the clean-input list
  `[pack, 'common', 'workflow-overlays', 'skills/ramp', 'dependencies', 'installer']`.
  Today it omits `skills-library` even though locked mirrors can be read from
  it. From P2 to P6 it is the union of old and new roots,
  `[pack, 'common', 'workflow-overlays', 'workflows', 'skills', 'skills-library', 'dependencies', 'installer']`;
  P6 narrows it to `[pack, 'workflows', 'skills', 'dependencies', 'installer']`.
- `release/bundle.js`: `bundle-manifest.json` records
  `workflow.overlays` file names; it becomes `workflow.variants` ids in P4b.
- `manifest.js`: `WORKFLOW_FIELDS` accepts only `provider` and `overlays`.
- `compose.js`: `OVERLAY_FIELDS` is a strict key list; the filename must equal
  the id.
- `instructions/compose.js`: `common/instructions/` fallback and the
  `workflow-overlays/` lookup.
- Both helper templates and the 14 generated pack helpers (regenerated, never
  hand-edited).
- About 80 test lines across 14 test files, led by `release-bundle`,
  `add-skills-helpers`, `release-cli`, `render-instructions`,
  `checkpoint3a-contract`, `skill-resolver`, `skills` and
  `pilot-skill-provenance`.
- `README.md` and 14 pack READMEs (about 60 lines naming `skills-library/`).

## Workflow variants

### Terms

| Term | Meaning | Replaces |
|---|---|---|
| **Pack** | The unit a customer chooses: instructions, skills, MCP servers and a command for one outcome | unchanged |
| **Target tool** | An agent tool a pack renders for: `kiro`, `claude-code`, `copilot`, `cursor` | "target" when it meant a tool |
| **Workspace profile** | A distribution profile: `standalone` or `shared` workspace, with spec and state roots | "profile" without qualifier |
| **Workflow** | The base AI-DLC lifecycle instructions in `workflows/base/` | "canonical lifecycle", `common/instructions` |
| **Workflow variant** | A named, declared replacement of slots in one base instruction | "workflow overlay", "overlay" |
| **Instruction** | One steering file a pack loads, `primary` or `companion` | unchanged |
| **Skill origin** | `ramp`, `upstream` or `local` | "RAMP-owned", "compatibility library", "legacy-local", "shadow" |
| **Use case** | A customer goal from the taxonomy | free-text `catalog.domain` for navigation |
| **Mode** | Reserved for reverse-engineering depth (Targeted, Full) | unchanged |

The generated catalogues and the README use only the left column. The lint
warns when new prose under `packs/` or `docs/` uses a replaced term.

### Variant file

```markdown
---
id: brownfield-modernization
title: Brownfield modernization
instruction: aidlc-workflow.md     # was "target"
whenToUse: Adaptive transformation and decomposition of an existing system.   # was "purpose"
replaces:
  - workflow-identity
  - first-actions
aliases: [legacy-transformation-workflow]   # old ids, accepted during the window
---
<!-- RAMP:SLOT workflow-identity START -->
...
```

Slot semantics do not change: the variant body contains only declared slot
blocks; each replaced slot must exist in the base instruction; two variants
may not replace the same slot (`compose.js`, `resolveInstructionBody`).

### Naming rule

A variant id names the situation it serves, in kebab-case, unique across all
instructions. It does not name a pack and does not contain `workflow`,
`overlay` or `legacy`. Renames:

| Current id | Instruction | New id |
|---|---|---|
| `legacy-transformation-workflow` | `aidlc-workflow.md` | `brownfield-modernization` |
| `legacy-adaptive-reverse-engineering` | `reverse-engineering.md` | `targeted-reverse-engineering` |
| `qa-existing-test-inventory` | `reverse-engineering.md` | `existing-test-inventory` |

`brownfield-modernization` matches the name proposed in
`docs/RAMP_STARTER_PACKS_MASTER_PLAN_V2.md` ("Reconcile the workflow
variations"). That plan's other proposed variants (`multi-repository`,
`autonomous-pipeline`, `workshop-fast-path`) follow the same rule when written.

### Pack manifest

`workflow.overlays: [legacy-transformation-workflow.md, ...]` (file names)
becomes `workflow.variants: [brownfield-modernization, ...]` (ids). During
the window the loader accepts either key, maps old file names and aliases to
ids, and fails when both keys are present. This lands in P4b. Variant ids do not appear in
generated customer files today (checked against `packs/*/scaffolded-packs`),
so the rename changes no customer bytes.

## Generated catalogue

A `ramp-pack catalog` command, built on the existing but unwired
`installer/src/catalog.js`, writes three outputs. `--check` exits non-zero
when any output differs from what the inputs produce.

**Inputs**

| Input | Fields used |
|---|---|
| `packs/*/pack.yaml` | name, title, description, `catalog.outcome`, `catalog.useCases`, `catalog.maturity`, skills, `workflow.variants`, `distribution.targets` and `qualifiedTargets` |
| `skills/*/skill.yaml` | origin, maturity, ownerPack, classification |
| `skills/*/SKILL.md` frontmatter | name, first sentence of description |
| `dependencies/skills.lock.yaml` and `skills.sources.yaml` | upstream repository and commit for `origin: upstream` |
| `workflows/variants/*.md` frontmatter | id, title, instruction, whenToUse |
| `schemas/taxonomy.yaml` | labels, descriptions and order of every facet |

**Outputs**

- `README.md`, between `<!-- RAMP:CATALOG packs START -->` and `END` markers:
  packs grouped by use case, with columns pack, what it helps you build,
  target tools, and AWS services. The services are derived as the union of
  the pack's skills' `awsServices`, so nobody maintains them by hand.
- `skills/README.md`: skills by use case, by AWS service, and A-Z, each row
  showing origin, maturity and the packs that include it.
- `workflows/README.md`: the base workflow, every variant with its
  instruction, `whenToUse` and the packs that select it.

Output is sorted by taxonomy order, then by id, so it is deterministic. CI
runs `ramp-pack catalog --check` next to the existing `regenerate.sh` drift
check in `build-packs.yml`. The catalogue is not part of release ZIPs, so the
generator does not join the release generator closure.

`catalog.useCases` is added to `pack-v2.schema.json` and accepted as an
additive key in v1 manifests, so all 15 packs can be classified without
converting them to v2. v1 manifests have no `catalog` or `distribution`
block, so the generator falls back: outcome comes from the taxonomy mapping of
the pack's first use case, maturity shows as "not declared", and target tools
list the four scaffolded tools with no release-qualified mark. `regression-software-testing` has no `pack.yaml`. P5
decides how it is listed: a `pack.yaml` (which also gives it generated
scaffolds and helpers, an allowlisted change) or a catalogue-only entry.

Deferred: a JSON export for a future documentation site reuses the same
in-memory model. It is a later addition and is not built now.

## Customer root navigation

### README outline

1. **What this is.** Two sentences, then "Part of RAMP" and "What is AI-DLC?"
   cut to one paragraph each.
2. **Start here: choose by use case.** The generated pack table.
3. **Install a pack.** Three short paths in this order: release ZIP with
   `install.sh` or `install.ps1`; `ramp-pack init` with Node; the no-Node
   `add-skills` helpers for a cloned repository.
4. **Browse skills.** One line and a link to `skills/README.md`.
5. **Workflows and variants.** One line and a link to `workflows/README.md`.
6. **Repository map.** A ten-line tree matching the target tree above.
7. **For pack authors.** Link to `CONTRIBUTING.md` and an authoring section:
   adding a skill, classifying it, adding a variant, regenerating.
8. **Requirements, Security, License.** Unchanged.

### Root contents

The root keeps only customer and contributor entry points: `README.md`,
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `add-skills.sh`,
`add-skills.ps1`, and the directories `packs/`, `skills/`, `workflows/`,
`installer/`, `dependencies/`, `schemas/`, `scripts/`, `atx/` and `docs/`.
`AGENT_HANDOFF.md` is maintainer state and moves to
`docs/maintainers/agent-handoff.md`.

## Compatibility window

**Opens** with the resolver phase (P2) and **closes** in P6, which needs its
own approval (decision D5).

During the window, these keep working:

- A fork or branch that adds a skill under `skills-library/<slug>/`,
  `skills/ramp/<slug>/` or `packs/<pack>/skills/<slug>/` resolves, with a
  warning.
- `workflow.overlays` with file names, and old variant ids through `aliases`.
- Pack instructions that fall back to `common/instructions/<file>`.
- `--skills-src` / `-SkillsSrc` pointing at any directory of `<slug>/` folders,
  including an old `skills-library/` copy.
- v1 `skill.yaml`.
- Customer projects installed from earlier ZIPs. The owner key
  (`<pack>--<target>--<profile|standalone>`), `.ramp/` state, the
  `install-files.tsv` format and every customer path are unchanged, so upgrade
  and rollback between old and new bundles work in both directions.

What stops working at once: the same slug in `skills/` and in an old root
(ambiguity guard).

Stubs: `skills-library/README.md` and `workflow-overlays/README.md` stay
through the window, each one line pointing to the new location.

## Migration sequence

Each phase lands as one reviewed merge on `revamp-starter-packs`, fast-forwarded
with green CI. No phase tags, releases or touches `main`.

| Phase | Change | Moves files | Customer bytes |
|---|---|---|---|
| **P0 Baseline** | Add `scripts/capture-customer-layout.mjs`. It records the sorted list of customer path, sha256 and mode for: the release bundle of every v2 pack and qualified target (today 2 packs × 2 targets, standalone, at a fixed `SOURCE_DATE_EPOCH`); `ramp-pack init` for every pack and target tool; and both helpers for every pack. Release covers only v2 packs, so the other packs are proved through `init` and the helpers. Commit the result as `installer/test/fixtures/customer-layout-baseline.json` with an equivalence test. Settle D2 for the 5 drifted mirrors first; a re-sync lands before the baseline is captured. | no | re-synced mirrors only, before the baseline |
| **P1 Metadata** | Add `skill-v2` and `taxonomy` schemas, `taxonomy.yaml`, and the loader for v1 and v2. Add a `skill.yaml` to every skill in its current location (sidecar for upstream). Teach lock verification to ignore the upstream sidecar in the same change. Release, `ramp-pack init` and both helpers stop copying `skill.yaml` (D1); release records it as a metadata input. | no | `skill.yaml` removed from the 9 RAMP skills only (allowlisted in the equivalence test) |
| **P2 Resolver** | New precedence with `skills/` first, the ambiguity guard, deprecation warnings, both helper templates, the union clean-input list, the reserved slugs, and `resolver.js`, `skills.js` and `compose.js` added to the release generator list. | no | none |
| **P3 Skills move** | `git mv skills/ramp/<slug> skills/<slug>` and `git mv skills-library/<slug> skills/<slug>` in one commit of pure renames; regenerate helpers; update path-bearing tests; add the stub. | yes | none |
| **P4a Workflows move** | Pure renames, file names unchanged: `git mv common/instructions workflows/base` and `git mv workflow-overlays/<id>.md workflows/variants/<id>.md`; `compose.js` looks in the new locations first. | yes | none |
| **P4b Variant names** | Content edits only: new ids and file names with `aliases`, frontmatter `target` to `instruction` and `purpose` to `whenToUse` (old keys accepted in the window), packs switch to `workflow.variants`, `bundle-manifest.json` records variant ids. | renames with edits | none |
| **P5 Catalogue** | Classify all 55 skills (Appendix A after review) and all 15 packs; add `ramp-pack catalog` and the CI check; rewrite the README; move `AGENT_HANDOFF.md`. | one doc | none |
| **P6 Close window** | Remove the old roots, `workflow.overlays`, aliases, stubs, the pack-override tier and the v1 `skill.yaml` reader; add the grep guard. | stubs only | none |

P3, P4a and P4b are separate so that each revert stays small, and the two
moves stay pure renames. P5 can run before P4 if review prefers, because the
catalogue reads metadata, not paths.

### Effect on release ZIP bytes

Customer files inside a ZIP (`overlay/...`), `install-files.tsv`,
`install.sh` and `install.ps1` do not depend on source paths.
`bundle-manifest.json` does, in two fields: `consumedInputs` records
repo-relative paths such as `skills/ramp/<slug>/...` and
`workflow-overlays/<file>`, and `workflow.overlays` records overlay file
names. Its recorded generator hashes cover only `installer/src/release/*.js`
and the install templates (`RELEASE_GENERATOR_FILES` in `bundle.js`), so
changes to `resolver.js`, `skills.js` or `compose.js` are not recorded today.
P2 adds those three files to the list, since they decide what a bundle
contains. Every new commit also changes `sourceCommit` and `buildTime`.
Release ZIPs are therefore identical when rebuilt at the same commit, not
across commits; that guarantee is unchanged.

The P3 and P4a tests assert that `consumedInputs` differs from the previous
phase only by the documented prefix rewrite (`skills/ramp/` and
`skills-library/` to `skills/`, `common/instructions/` to `workflows/base/`,
`workflow-overlays/` to `workflows/variants/`) with unchanged sha256 values.
P4b allows changed sha256 values for the three variant files and the edited
`pack.yaml` files only, plus the `workflow.overlays` to `workflow.variants`
field change. Locked skills are recorded by their upstream lock `path` and do
not change.

## Rollback

- Every phase is one merge commit. Rollback is `git revert -m 1 <merge>` as a
  new commit, fast-forwarded like any change. There is no force-push and no
  history rewrite.
- P3 and P4a are pure renames (`git diff -M100% --name-status` shows only
  `R100` entries, plus regenerated helpers and updated test paths in P3), so
  reverting restores the old tree byte for byte. The P2 resolver still reads
  the old roots, so reverting P3 or P4a leaves a working repository.
- Revert in reverse order of landing. Once P5 has landed, the catalogue names
  current locations and ids, so reverting P3, P4a or P4b first requires
  reverting P5 or regenerating the catalogue in the same revert commit, or
  `ramp-pack catalog --check` fails. P4b is reverted before P4a.
- P1 is reverted by removing the sidecars. The `skill.yaml` shipping change
  reverts with it, and customer upgrades restore the file.
- Customers need no rollback action: paths and the install contract do not
  change, and ZIPs published before the migration stay installable and
  upgradable.

## Verification matrix

New checks are marked **new**. Every new check states the broken state that
must turn it red, so it cannot pass either way.

| Check | P0 | P1 | P2 | P3 | P4a | P4b | P5 | P6 |
|---|---|---|---|---|---|---|---|---|
| Full `npm test` in `installer/` | x | x | x | x | x | x | x | x |
| `pilot-skill-provenance` with `RAMP_PILOT_CACHE_EXPECTATION=unsynchronized` | x | x | x | x | x | x | x | x |
| `skills sync --locked` then `skills verify` | x | x | x | x | x | x | x | x |
| `scripts/regenerate.sh` drift check | x | x | x | x | x | x | x | x |
| Helper matrix: Bash on Linux, PowerShell 7 and Windows PowerShell 5.1 | | x | x | x | x | x | | x |
| `scripts/verify-release-determinism.mjs`, every qualified target | x | x | x | x | x | x | | x |
| **new** Customer-layout equivalence against the P0 baseline. Red if any customer file is added, dropped or changed outside the allowlist. | x | x | x | x | x | x | x | x |
| **new** Lock unchanged: `git diff --exit-code dependencies/`. Red if the move touches the lock. | | | | x | x | x | | x |
| **new** Pure rename: only `R100` entries plus listed edits. Red on any content change hidden in a move. | | | | x | x | | | |
| **new** Ambiguity guard: a fixture with one slug in `skills/` and `skills-library/` must fail in Node and both helpers. | | | x | x | x | x | x | x |
| **new** Sidecar rule: an upstream mirror with an extra non-sidecar file fails verification; `skill.yaml` alone does not. | | x | x | x | x | x | x | x |
| **new** Taxonomy lint: every skill has schema-valid metadata, every value is in the vocabulary, every `ownerPack` is respected; from P5 every skill has at least one use case. Red on an unknown value, and from P5 on a missing use case. | | x | x | x | x | x | x | x |
| **new** `ramp-pack catalog --check`. Red after hand-editing a generated table. | | | | | | | x | x |
| **new** Grep guard: no `skills-library`, `skills/ramp`, `workflow-overlays` or `common/instructions` outside the compatibility module, `docs/` history and changelogs. | | | | | | | | x |
| Updated contract tests: `checkpoint3a-contract` (RAMP skills under `skills/`, absent elsewhere), `release-bundle` `consumedInputs` | | | | x | x | x | | |

The four focused suites (install-manifest, install-bash, install-powershell,
release-bundle) run before every commit in every phase, under `umask 022`.

## Decisions for review

| Id | Decision | Recommendation |
|---|---|---|
| D1 | Stop copying `skill.yaml` into customer projects for every skill, or keep shipping it for RAMP-owned skills only | Stop for all. It is source metadata, and one rule is easier than two. |
| D2 | The 5 locked mirrors that differ from the lock (`amazon-bedrock`, `aws-cloudformation`, `aws-lambda-durable-functions`, `aws-lambda-microvms`, `aws-observability`): re-sync to the lock, or adopt the local edits as `origin: ramp` with `basedOn` | Review each diff in P0. Re-sync by default, in P0. Adoption needs the v2 metadata and origin-based resolution, so an adopted skill keeps its drifted mirror and the pilot test expectation until P3, then drops its lock entry and becomes `origin: ramp`. |
| D3 | Move `common/instructions/` to `workflows/base/`, or leave it in place | Move. The root then reads as packs, skills and workflows. |
| D4 | The 31 `origin: local` skills stay unreleasable, as today | Accept for this migration. Adopt or lock each one in a later track. |
| D5 | When the compatibility window closes | After the first published release built from the new layout, by separate approval. |
| D6 | The draft use-case, AWS-service and technology lists | Approve as drafted, with edits from review. |

## Follow-on work (not in this design)

- The no-Node helpers copy upstream skills without lock verification. After
  P3 they should verify sha256 against the lock, or refuse upstream skills
  without a synced cache.
- Converting the 12 v1 pack manifests to v2.
- The pack renames proposed in
  `docs/RAMP_BLUEPRINT_REPOSITORY_REVAMP_MASTER_PLAN.md`.
- A documentation site built from the catalogue model.

## Appendix A: draft classification

`L` marks the 15 skills with a lock entry; `R` marks RAMP-owned skills. Values
are drafts for review in P5. Rows marked `?` need confirmation from the skill
content.

| Skill | Origin | Use cases | AWS services | Technologies |
|---|---|---|---|---|
| agentic-optimizer | local | generative-ai-and-agents | bedrock ? | |
| amazon-aurora-mysql | upstream L | application-modernization, cloud-native-development | aurora | mysql |
| amazon-aurora-postgresql | upstream L | application-modernization, cloud-native-development | aurora | postgresql |
| amazon-bedrock | upstream L | generative-ai-and-agents | bedrock | |
| amazon-dynamodb | local | cloud-native-development | dynamodb | |
| android-design-best-practices | local | cloud-native-development | | android |
| api-gateway | upstream L | cloud-native-development, application-modernization | api-gateway | |
| aurora-dsql | upstream L | cloud-native-development, application-modernization | aurora-dsql | postgresql |
| aws-cdk | local | infrastructure-as-code | cdk, cloudformation | |
| aws-cloudformation | upstream L | infrastructure-as-code | cloudformation | |
| aws-containers | local | cloud-native-development, application-modernization | ecs, fargate, ecr | |
| aws-event-driven-patterns | local | cloud-native-development | eventbridge, sqs, sns, kinesis | |
| aws-iam | upstream L | cloud-foundations | iam | |
| aws-lambda | upstream L | cloud-native-development | lambda | |
| aws-lambda-durable-functions | upstream L | cloud-native-development | lambda | |
| aws-lambda-microvms | upstream L | cloud-native-development, quality-engineering | lambda | |
| aws-messaging-and-streaming | local | cloud-native-development | sqs, sns, kinesis ? | |
| aws-observability | upstream L | operations-and-incident-response | cloudwatch, x-ray | opentelemetry |
| aws-serverless-best-practices | local | cloud-native-development | lambda, step-functions, api-gateway, s3, dynamodb, cognito | |
| aws-serverless-deployment | local | cloud-native-development, infrastructure-as-code | sam, cdk, lambda | |
| aws-skills | local | cloud-foundations, infrastructure-as-code | cdk ? | |
| aws-step-functions | upstream L | cloud-native-development | step-functions | |
| connecting-lambda-to-api-gateway | upstream L | cloud-native-development | lambda, api-gateway | |
| creating-amazon-aurora-db-cluster-with-instances | upstream L | application-modernization, cloud-native-development | aurora | |
| dependency-remediation | local | security-remediation | | nodejs |
| dotnet-adot-sidecar | local | application-modernization, operations-and-incident-response | ecs, cloudwatch, x-ray | dotnet, opentelemetry |
| dotnet-aspnet-sessionstate-aws | local | application-modernization | elasticache | dotnet |
| dotnet-aws-ecs | local | application-modernization | ecs, fargate, cloudformation, cdk | dotnet |
| dotnet-aws-parameterstore | local | application-modernization | systems-manager, secrets-manager | dotnet |
| dotnet-post-transform | local | application-modernization | transform | dotnet |
| dotnet-testing | local | quality-engineering | | dotnet |
| ecs-architect | ramp R | cloud-native-development, application-modernization | ecs, fargate, ec2 | |
| ecs-build | ramp R | cloud-native-development, infrastructure-as-code | ecs | terraform |
| ecs-devops | ramp R | cloud-native-development, operations-and-incident-response | ecs | |
| ecs-observability | ramp R | operations-and-incident-response | ecs, cloudwatch, x-ray | |
| ecs-operation-review | ramp R | operations-and-incident-response | ecs | |
| ecs-recon | ramp R | application-modernization, operations-and-incident-response | ecs | |
| ecs-security | ramp R | cloud-native-development, cloud-foundations | ecs, iam | |
| gitlab-mr | local | security-remediation | | gitlab |
| iac | local | infrastructure-as-code | cloudformation | terraform, ansible, pulumi |
| incident-triage | local | operations-and-incident-response | cloudwatch ? | |
| java-upgrade | local | application-modernization | | java |
| kotlin-coding-standards | local | cloud-native-development | | kotlin, android |
| mobile-test-automation | ramp R | quality-engineering | device-farm | android, ios |
| nova-sonic-best-practices | local | generative-ai-and-agents | bedrock | nova-sonic |
| nova-sonic-optimization | local | generative-ai-and-agents | bedrock | nova-sonic |
| property-based-testing-guide | local | quality-engineering | | |
| regression-testing | local | quality-engineering, application-modernization | | java |
| signing-in-to-aws | upstream L | cloud-foundations | iam | |
| terraform-aws | local | infrastructure-as-code | | terraform |
| terraform-best-practices | local | infrastructure-as-code | | terraform |
| terraform-skill | local | infrastructure-as-code | | terraform, opentofu |
| text-agent-to-nova-sonic-voice | local | generative-ai-and-agents | bedrock | nova-sonic, strands-agents |
| vulnerability-triage | local | security-remediation | | gitlab |
| web-test-automation | ramp R | quality-engineering | | |

The four nested `agentic-optimizer/subagents/*/SKILL.md` files belong to their
parent skill and move with it. They are not separate entries in `skills/`.

## Appendix B: draft pack use cases

| Pack | `catalog.useCases` |
|---|---|
| legacy-transformation-on-aws | application-modernization |
| cots-rewrite-on-cloudnative | application-modernization, cloud-native-development |
| framework-upgrade-containerise | application-modernization |
| dotnet-app-modernization-on-aws | application-modernization |
| api-platform-migration-n-modernization | application-modernization |
| web-app-on-cloudnative | cloud-native-development |
| serverless-event-driven-on-aws | cloud-native-development |
| ocr-mobile-app-on-serverless | cloud-native-development, generative-ai-and-agents |
| genai-on-serverless | generative-ai-and-agents |
| voice-ai-agent-on-aws | generative-ai-and-agents |
| agentic-ai-workflow | generative-ai-and-agents, infrastructure-as-code |
| qa-automated-testing | quality-engineering |
| regression-software-testing | quality-engineering, application-modernization |
| vulnerability-remediation-pipeline | security-remediation |
| agentic-incident-response | operations-and-incident-response |
