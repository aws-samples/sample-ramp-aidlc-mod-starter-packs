# RAMP Starter Packs Master Plan v2

**Status:** Proposed implementation plan for owner review
**Date:** 2026-11-04
**Scope:** Immediate repository simplification, RAMP catalog model, reusable
workflow and skill composition, customer ZIP distribution, and a future
integration path to official AI-DLC v2

## Executive decision

Keep the immediate customer experience simple:

1. The customer chooses a RAMP starter pack that matches the outcome they want.
2. They choose the agent tool or tools used in their repository.
3. They download a generated, self-contained ZIP or use the CLI.
4. The agent uses the pack to help build the customer-specific solution.

Do not introduce an intake agent, force customers to navigate RAMP program
phases, or make official AI-DLC v2 a prerequisite for the first revamp.

The immediate architecture should retain the good part of the current
repository: author each pack once as tool-neutral source, then render it into
each supported agent tool. The revamp should fix the current duplication,
catalog ambiguity, skill drift, and distribution experience around that model.

The future architecture should preserve the same pack and catalog experience,
but allow official AI-DLC v2 to replace the locally maintained instruction
workflow after it proves simpler and better for representative RAMP
engagements.

The core product statement is:

> RAMP starter packs are agent-assisted accelerators for producing the right
> modernization solution for a customer. They are not fixed prebuilt systems.

## What changes from the earlier master plan

This plan deliberately separates two horizons.

### Immediate: simplified RAMP v1

- Keep direct pack selection.
- Keep the current tool-neutral pack compiler.
- Keep `packs/` during the first migration to avoid a disruptive folder move.
- Add clear RAMP outcome classification.
- Extract one canonical local workflow plus intentional overlays.
- Resolve external skills from pinned upstream sources.
- Generate downloadable, self-contained ZIP releases.
- Prove the model with quality engineering and one transformation pack.

### Future: RAMP with official AI-DLC v2

- Keep RAMP as the product, catalog, and modernization layer.
- Introduce AI-DLC v2 behind an explicit workflow-provider adapter.
- Use its workflow, state, gates, audit, resume, and harness support only after
  the integration passes defined go/no-go criteria.
- Express RAMP differentiation as blueprints, plugins, rules, knowledge,
  skills, patterns, and templates rather than changes to upstream core.

The future model is an evolution of the immediate model, not a second
repository rewrite.

## Product boundaries

### RAMP owns

- the customer-facing modernization outcome taxonomy;
- starter-pack and blueprint selection;
- modernization-specific instructions and overlays;
- reference architectures, templates, and examples;
- RAMP-owned skills and agents;
- curated external skill dependencies;
- validation and release qualification;
- customer-friendly downloads and catalog experience;
- the learning loop from field delivery back into reusable assets.

### The local instruction workflow provides for now

- the decision-gated delivery sequence;
- the current state and audit conventions;
- requirements, design, task, build, and validation behavior;
- tool-neutral instruction source rendered into each supported tool.

This is an instruction-driven workflow, not a deterministic workflow engine.
Its state, gate, and audit behavior depends on agents following the rendered
instructions consistently.

### Official AI-DLC v2 may own in the future

- deterministic workflow orchestration;
- workflow profiles and stage routing;
- state, audit, approval, resume, and rollback semantics;
- upstream lifecycle updates;
- native harness integration and installation lifecycle.

RAMP should never fork or patch official AI-DLC v2 core. Integration must use
supported extension points and a pinned, tested release.

## Customer-facing RAMP organization

Customers do not need to select a RAMP engagement phase before using this
repository. RAMP phases remain useful for program governance, but should not be
the primary repository navigation.

The catalog should use three simple outcome paths:

| Outcome path | Customer intent | Examples |
|---|---|---|
| **Transform** | Change or modernize an existing system | Legacy decomposition, framework upgrade, COTS rewrite, API platform modernization |
| **Reimagine** | Build a new cloud-native or agentic-ready system | Web application, event-driven platform, GenAI application, voice agent |
| **Automate** | Improve a recurring engineering or operations loop | QA automation, autonomous QA pipeline, vulnerability remediation, incident response |

Scale is expressed through reusable foundations rather than as a fourth pack
category:

- `patterns/` for generalized reference architectures and golden paths;
- `skills/` for reusable agent expertise;
- `templates/` for reusable implementation starting points;
- `atx/` for AWS Transform custom-agent assets where applicable;
- `tooling/` or `installer/` for composition, rendering, validation, and release.

For the immediate migration, keep physical pack paths stable and add
classification metadata to `pack.yaml`. A later cleanup may move them under
`blueprints/transform`, `blueprints/reimagine`, and `blueprints/automate` once
the catalog and redirect strategy are proven.

## Asset vocabulary

Every asset type must have one clear responsibility.

| Asset | Responsibility |
|---|---|
| `README.md` | Human explanation, prerequisites, kickoff, expected outputs, and limits |
| Instructions | Mandatory or conditionally loaded agent behavior |
| Workflow | Shared delivery sequence, state, gates, audit, and completion rules |
| Workflow overlay | Intentional variation to the shared workflow |
| Domain instruction | Pack-specific behavior such as building a QA pipeline |
| Skill | Reusable expertise the agent activates for a task |
| Reference | Optional decision support, trade-offs, and deeper technical guidance |
| Template | Editable starting material for an artifact or implementation |
| Example | Sample input, output, or completed usage |
| Pattern | Generalized, versioned reference architecture reusable by multiple packs |

Guidance that the agent must always obey belongs in instructions. Material it
consults when making a decision belongs in references or skills.

## The pack remains the unit customers choose

A pack is a versioned recipe that composes reusable assets into a customer
outcome. It should not contain independent copies of every asset.

A v2 manifest should evolve toward this shape:

```yaml
schemaVersion: 2
kind: ramp-pack

name: agentic-qa-pipeline
title: Agentic QA Pipeline Builder
version: 0.1.0

catalog:
  outcome: automate
  domain: quality-engineering
  executionModel: autonomous-pipeline
  maturity: preview

workflow:
  provider: local-instructions-v1
  primary: aidlc-workflow.md
  overlays:
    - agentic-pipeline-delivery.md

instructions:
  - qa-pipeline-builder.md
  - reverse-engineering-qa.md

capabilities:
  skills:
    - aws-step-functions
    - aws-lambda
    - aws-lambda-microvms
    - amazon-bedrock
    - web-test-automation
    - mobile-test-automation
  patterns:
    - agentic-qa-pipeline

distribution:
  targets:
    - kiro
    - claude-code
    - copilot
    - cursor
  profiles:
    - name: shared-kiro-claude
      targets: [kiro, claude-code]
      workspaceMode: shared
      specRoot: .kiro/specs
      stateRoot: aidlc-docs
```

This schema is illustrative and provisional. Overlay precedence, target
qualification, and compatibility semantics must be proven in the pilots before
the schema is frozen. The final schema should remain small and describe
composition and catalog behavior without duplicating information already owned
by an instruction, skill, or pattern.

## Reconcile the workflow variations

The current repository contains many different `aidlc-workflow.md` and
reverse-engineering files. They should not be treated as equally independent
products.

### Target source model

```text
common/
└── instructions/
    ├── aidlc-workflow.md
    └── reverse-engineering.md

workflow-overlays/
├── brownfield-modernization.md
├── multi-repository.md
├── autonomous-pipeline.md
└── workshop-fast-path.md

packs/<pack>/
├── pack.yaml
├── README.md
└── instructions/
    ├── <domain-instruction>.md
    └── <true-pack-specific-overlay>.md
```

### Reconciliation method

1. Freeze and tag the current pack behavior before normalization.
2. Compare the existing workflow files by behavior, not only by text.
3. Put universal gates, state, audit, requirements, design, construction, and
   completion behavior in the shared workflow.
4. Convert real variants into named overlays with an explicit purpose.
5. Delete pack-local workflow copies that add no behavior.
6. Keep pack-specific domain behavior separate from lifecycle behavior.
7. Add semantic parity tests before migrating the remaining packs.

The same rule applies to reverse engineering:

- one shared baseline;
- named overlays for genuinely different evidence, technology, or analysis
  needs;
- no full copy merely to change a few paragraphs.

Generated tool projections may still be named `aidlc-workflow.md`. The
important point is that they are compiled from one canonical source and the
selected overlays.

## Quality-engineering blueprint model

Quality engineering needs two separate packs.

### QA Test Suite Builder

Purpose: generate and maintain tests for an existing application.

Typical outputs:

- test strategy;
- web, mobile, API, or integration test suites;
- test data and fixtures;
- CI execution configuration;
- test coverage and maintenance guidance.

This is the evolved role of the current `qa-automated-testing` pack.

### Agentic QA Pipeline Builder

Purpose: build a persistent QA system that plans, reviews, generates, executes,
triages, reports, and gates tests continuously.

Typical outputs:

- customer-specific QA-pipeline architecture;
- infrastructure and agent implementation;
- test-plan and script-generation workflows;
- human-review gates;
- sandboxed test execution;
- evidence storage and reports;
- defect triage and ticket integration;
- deployment and operations guidance.

This is not a prebuilt fixed QA system. The pack helps the customer's agent
build the right pipeline for their environment.

### Use of the existing customer architecture

The existing QA pipeline diagram should become a generalized pattern, not be
copied into the public pack as a customer artifact.

Recommended target:

```text
patterns/agentic-qa-pipeline/
├── pattern.yaml
├── README.md
├── architecture.drawio
├── decisions.md
├── assumptions.md
└── variants/
```

Before publishing:

- remove customer names, environment identifiers, and proprietary details;
- express service choices as decisions and variants where appropriate;
- validate evolving AWS service assumptions against current documentation;
- record provenance and review status.

## Skills and custom ATX assets

### RAMP-owned skills

Store skills authored and maintained by the RAMP team as source:

```text
skills/
└── ramp/
    └── <skill-name>/
        ├── SKILL.md
        ├── references/
        ├── scripts/
        └── tests/
```

### External skills

Do not periodically copy the latest files by hand from:

- `aws/agent-toolkit-for-aws`;
- `awslabs/agent-plugins`.

Use two machine-readable files:

```text
dependencies/
├── skills.sources.yaml
└── skills.lock.yaml
```

The source file declares the repository and path. The lock file records the
exact commit, content checksum, license, and resolved skill version. Release
builds fetch the pinned content into a temporary build cache and bundle it into
customer artifacts.

Policy:

1. Prefer `aws/agent-toolkit-for-aws` when the required maintained skill exists.
2. Use `awslabs/agent-plugins` only for capabilities not yet available in the
   preferred source or where the legacy version is intentionally pinned.
3. Never resolve from live `main` during a customer release.
4. Run a scheduled workflow that proposes lock-file updates as pull requests.
5. Validate changed skills before accepting an update.
6. Preserve upstream licenses, notices, source URLs, commits, and checksums.

This removes manual drift while keeping builds reproducible.

### “ATX custom skill” support

The repository should support both meanings explicitly:

- a normal portable `SKILL.md` capability bundled into supported agent tools;
- an AWS Transform custom agent or related deployable extension.

AWS Transform custom-agent source should live separately, for example:

```text
atx/
└── agents/
    └── <agent-name>/
        ├── agent.yaml
        ├── instructions/
        ├── skills/
        ├── deployment/
        └── README.md
```

A pack may reference that asset, but the normal pack ZIP must not imply that a
customer-side unzip registers or deploys an AWS Transform agent. Deployment
and registration remain an explicit, documented action.

## Tool adapters: preserve and generalize the current model

The checked-in generator currently supports:

- Kiro;
- Claude Code;
- GitHub Copilot;
- Cursor.

Codex is referenced by some skills and by the future AI-DLC research, but the
current local installer does not have a Codex renderer. Codex is therefore
future adapter work, not part of the current four-tool baseline. If added, it
should be a fifth adapter rather than a replacement for Copilot.

The supported tools must be declared in one adapter registry. The current
duplicated hard-coded arrays in `installer/src/build-all.js` and
`installer/bin/ramp-pack.js` should be removed.

Each adapter owns:

- instruction locations and frontmatter;
- skill destination;
- MCP configuration;
- command or prompt format;
- spec and state path substitutions;
- validation rules;
- merge-sensitive root files.

Adding a new tool should require a new adapter and its contract tests, not
changes throughout the compiler.

## ZIP distribution model

### Do not hard-code three artifacts

The release matrix is derived from:

1. the pack's supported `targets`;
2. the registered tool adapters;
3. optional named workspace profiles.

For every tool that is both declared by the pack and qualified for that pack,
the release workflow can generate an individual self-contained artifact:

```text
<pack>--kiro--v<version>.zip
<pack>--claude-code--v<version>.zip
<pack>--copilot--v<version>.zip
<pack>--cursor--v<version>.zip
<pack>--codex--v<version>.zip        # after a Codex adapter exists
```

A profile is a saved set of compatible generation settings, not necessarily a
combined ZIP. For example, `shared-kiro-claude` records that both tools use the
same pack version, shared workspace mode, spec root, and state root.

The profile can produce two separate downloads:

```text
<pack>--kiro--shared-kiro-claude--v<version>.zip
<pack>--claude-code--shared-kiro-claude--v<version>.zip
```

The customer may download and install both. An additional combined ZIP may be
offered as a convenience, but it is not required and is not the immediate
default. Do not generate every possible combination of tools.

### Same repository: half Kiro, half Claude Code

The customer can download the Kiro and Claude Code artifacts generated from
the same shared workspace profile and pack version:

```text
customer-project/
├── .kiro/
│   ├── steering/
│   ├── settings/mcp.json
│   └── skills/
├── CLAUDE.md
├── .claude/
│   ├── rules/
│   ├── commands/
│   └── skills/
├── .mcp.json
└── <provider-owned shared workflow state and artifacts>
```

The Kiro and Claude Code projections coexist because they use different native
paths. They are not separate copies of the pack source: both are generated
from the same manifest, workflow, overlays, skill locks, and version.

Skills may be duplicated into tool-native directories inside the generated
artifacts and resulting customer workspace. That duplication is acceptable
because canonical source remains singular and it avoids non-portable symlinks.

MCP declarations are also rendered into each tool's expected location from one
manifest.

### Spec-layout rule

One unit of work must have one canonical specification, even when different
people use different agent tools. Different features or intents may have their
own spec subdirectories, but there should not be a Kiro copy and a Claude copy
of the same requirements, design, and tasks.

Use these defaults:

| Selected tools | Canonical spec root |
|---|---|
| Kiro only | `.kiro/specs` |
| Multiple tools including Kiro | `.kiro/specs` |
| One or more tools without Kiro | `specs/` |

When Kiro is present, retaining `.kiro/specs` preserves its native
Requirements → Design → Tasks experience. Claude Code, Copilot, Cursor, and
future adapters can read and update the same files there.

Allow an explicit `--spec-root <path>` override for customers with an existing
repository convention.

The current renderer substitutes `.kiro/specs` for Kiro and root `specs/` for
the other tools. Shared workspace generation must resolve that token once for
the profile, rather than independently per adapter. Adapter-specific paths
should be limited to harness instructions, skills, MCP configuration, and
commands.

### Separate repositories

If the Kiro users and Claude Code users work in different repositories, each
repository should use its standalone individual tool ZIP and native spec
layout. Shared workspace settings are only needed when multiple tools operate
on the same repository and specifications.

### Shared-workspace rule for v1

Installing multiple tool ZIPs does not automatically make concurrent agents
safe.

Before the Kiro/Claude profile is released:

- both tools must be configured to use the same canonical workflow state and
  generated project artifacts;
- when Kiro is included, both tools use `.kiro/specs` unless explicitly
  overridden;
- one owner or agent session controls a given active intent at a time;
- parallel work uses separate Git branches or worktrees;
- users must not let two tools edit the same state file concurrently;
- cross-tool resume is marked experimental and included in release tests.

Official AI-DLC v2 may later provide the stronger intent, state, and audit
model, but immediate ZIP usability must not depend on that future migration.

### ZIP contents

Unlike the current committed lean scaffolds, customer release ZIPs should be
self-contained:

```text
<pack>-<target>-v<version>/
├── README-FIRST.md
├── overlay/
│   └── <tool-native instructions, skills, MCP, commands, and templates>
├── bundle-manifest.json
├── THIRD_PARTY_NOTICES.md
├── SHA256SUMS
├── install.sh
└── install.ps1
```

The ZIP expands into its own staging directory. It must not silently overwrite
the customer's repository during extraction.

For a clean project, the customer can copy the contents of `overlay/` into the
repository. For an existing project, the optional installer scripts perform a
preflight and report conflicts.

The immediate safe default is preflight-and-abort: if a conflicting file
exists, the helper stops and produces a report. Format-aware merging of
Markdown instructions, JSON MCP configurations, and tool directories is a
later enhancement. The manual merge guide remains available for customers who
choose to resolve conflicts themselves.

Installing a release ZIP should not require Node.js. Runtime integrations may
still require prerequisites such as `npx`, `uvx`, an AWS profile, or another
tool declared by the selected MCP server; those prerequisites must be listed
separately in `README-FIRST.md`.

### Conflict handling

The release must never silently replace existing files such as:

- `CLAUDE.md`;
- `.mcp.json`;
- `.claude/**`;
- `.kiro/**`;
- `.github/copilot-instructions.md`;
- `.vscode/mcp.json`;
- `.cursor/**`;
- future `AGENTS.md` or `.codex/**` files.

The installer should:

1. identify files owned by the bundle;
2. compare existing content and hashes;
3. distinguish identical, new, modified, and conflicting files;
4. write a conflict report;
5. abort by default when a conflict exists;
6. record installed ownership for upgrade and uninstall.

Explicit semantic merge, skip, or overwrite behavior may be added later for
file formats with tested merge rules.

### Release provenance

`bundle-manifest.json` should record:

- pack ID and version;
- RAMP catalog/schema version;
- workflow provider and version;
- selected overlays;
- target tool or tools;
- generator version;
- external skill source commits and checksums;
- RAMP-owned skill versions;
- MCP and template versions;
- file hashes;
- licenses and notices;
- build time and source commit.

Build the same input twice and compare outputs before publishing.

## Git clone, GitHub Releases, and GitHub Pages

Generated ZIP files should not be committed to the main branch.

Recommended model:

- canonical source lives in Git;
- local `dist/` remains ignored;
- CI builds and validates release artifacts;
- GitHub Releases stores versioned ZIP files and checksums;
- GitHub Pages provides a friendly catalog and links to Release assets;
- committed `scaffolded-packs/` remain temporarily for compatibility, then are
  removed after the release path has proven reliable.

GitHub Release assets are not downloaded by a normal `git clone`, so adding
many generated ZIPs does not increase clone size. A source clone grows only if
generated artifacts are committed into Git history.

Pages is a discovery interface, not the artifact store. It can later offer:

- filters for Transform, Reimagine, and Automate;
- pack maturity and supported tools;
- a “choose your tool” download action;
- named shared-workspace profiles that group compatible downloads;
- release notes, checksums, and installation guidance.

## Immediate implementation roadmap

### Work package 0 — Protect the baseline

Goal: make the revamp reversible.

Actions:

- tag or otherwise record the current working baseline;
- inventory the 14 manifest packs and the steering-only exception;
- preserve current installer tests as regression coverage;
- select two pilots:
  - `qa-automated-testing`;
  - one representative transformation pack such as
    `legacy-transformation-on-aws`.

Exit criteria:

- current source and generated behavior can be reproduced;
- pilot expected outputs are documented;
- no customer-facing behavior changes accidentally.

### Work package 1 — Introduce v2 metadata without moving folders

Proposed files:

- `schemas/pack-v2.schema.json`;
- updates to `installer/src/manifest.js`;
- metadata updates to the two pilot `pack.yaml` files;
- catalog validation tests under `installer/test/`.

Add:

- outcome classification;
- domain;
- execution model;
- maturity;
- workflow provider and overlays;
- supported distribution targets;
- optional multi-tool bundle profiles;
- capability and pattern references;
- ownership and compatibility metadata.

Exit criteria:

- old manifests still load during migration;
- v2 manifests validate with useful errors;
- a catalog can be generated from manifests rather than a hand-maintained
  README table.

### Work package 2 — Centralize adapters

Proposed files:

- `installer/src/adapters/index.js`;
- one module per supported tool;
- updates to `installer/src/build-all.js`;
- updates to `installer/bin/ramp-pack.js`;
- adapter contract tests.

Actions:

- move the current Kiro, Claude Code, Copilot, and Cursor behavior behind the
  adapter registry;
- make `build-all` enumerate registered adapters;
- allow `init` and future release commands to accept one or more targets;
- retain Codex as a separately scoped future adapter.

Exit criteria:

- all current 60 installer tests still pass;
- each adapter has path, instruction, skill, MCP, and command tests;
- no duplicated hard-coded tool list remains.

### Work package 3 — Normalize workflow and reverse engineering

Proposed files:

- `common/instructions/aidlc-workflow.md`;
- `common/instructions/reverse-engineering.md`;
- `workflow-overlays/*.md`;
- pack-specific domain instructions for the two pilots;
- semantic fixture tests for expected gates and outputs.

Actions:

- derive a canonical local instruction workflow from observed common behavior;
- extract intentional variations into overlays;
- remove redundant pilot-local workflow copies;
- remove hard-coded Kiro paths from neutral source and use adapter tokens;
- prove equivalent behavior across all current adapters.

Exit criteria:

- both pilots use the same workflow source;
- every remaining difference is named and justified;
- generated Claude, Kiro, Copilot, and Cursor outputs contain no foreign
  tool-specific paths;
- expected decisions, artifacts, gates, and resume behavior remain intact.

### Work package 4 — Add locked skill resolution

Proposed files:

- `dependencies/skills.sources.yaml`;
- `dependencies/skills.lock.yaml`;
- `installer/src/dependencies/`;
- `.github/workflows/update-skill-locks.yml`;
- license and provenance tests.

Actions:

- separate RAMP-owned skills from upstream dependencies;
- resolve exact upstream paths and commits;
- add checksum and license verification;
- generate scheduled update pull requests;
- retain a compatibility bridge for the current `skills-library/` during
  migration.

Exit criteria:

- a release can be rebuilt using only committed source plus pinned upstream
  dependencies;
- no release depends on live `main`;
- all third-party content is attributable.

### Work package 5 — Build the release packager

Proposed files:

- `installer/src/release.js`;
- `installer/src/bundle.js`;
- `installer/src/provenance.js`;
- `installer/test/release.test.js`;
- `installer/test/shared-workspace.test.js`;
- `.github/workflows/release-packs.yml`.

CLI direction:

```text
ramp-pack release <pack> --target kiro
ramp-pack release <pack> --target claude-code
ramp-pack release <pack> --targets kiro,claude-code --workspace-mode shared
ramp-pack release <pack> --profile shared-kiro-claude
ramp-pack release <pack> --targets kiro,claude-code --spec-root .kiro/specs
ramp-pack release <pack> --all-targets
```

Actions:

- compose self-contained overlays with skills;
- support one or more registered targets;
- resolve `specRoot` and `stateRoot` once per workspace profile;
- preserve `.kiro/specs` whenever Kiro participates unless the user overrides
  it;
- detect cross-target and customer-file conflicts;
- generate manifests, notices, hashes, and installer helpers;
- generate Bash and PowerShell helpers from one source and test their parity;
- create deterministic ZIP files in ignored `dist/`;
- publish approved assets to GitHub Releases.

Exit criteria:

- the release builder can produce an artifact for every declared and qualified
  target;
- the first customer gate qualifies two compatible individual Kiro and Claude
  Code artifacts from one shared workspace profile;
- existing Kiro, Claude Code, Copilot, and Cursor renderer regressions continue
  to pass while wider per-pack release qualification follows;
- release assets require no Node installation and no second skill-download
  step;
- Bash and PowerShell outputs are generated from the same inputs and pass
  Linux/macOS and Windows tests;
- ZIPs are absent from source Git history.

### Work package 6 — Establish the quality-engineering family

Actions:

- refine `qa-automated-testing` as the QA Test Suite Builder;
- create `agentic-qa-pipeline` as a distinct preview pack;
- generalize the customer-derived architecture into
  `patterns/agentic-qa-pipeline`;
- add pack-specific instructions, templates, references, and examples;
- preserve renderer regression coverage for all four current adapters;
- qualify Kiro and Claude Code first for the immediate mixed-tool customer;
- qualify additional declared targets before publishing their pack artifacts.

First customer-oriented release candidate:

```text
agentic-qa-pipeline--kiro--shared-kiro-claude--v0.1.0-preview.zip
agentic-qa-pipeline--claude-code--shared-kiro-claude--v0.1.0-preview.zip
```

These are two compatible downloads generated from one profile. A combined
archive may be added later as a convenience.

Exit criteria:

- the two QA packs have clearly different outcomes;
- the architecture contains no customer-identifying material;
- the two shared-profile artifacts work together in a repository used by both
  Kiro and Claude Code;
- individual artifacts publish only for declared and qualified targets.

### Work package 7 — Publish the catalog

Actions:

- generate catalog data from manifests;
- update the main README to show Transform, Reimagine, and Automate;
- publish a simple GitHub Pages catalog;
- link downloads to GitHub Release assets;
- retain CLI documentation for advanced users.

Exit criteria:

- a non-CLI customer can find a pack, choose a tool, download it, and follow
  `README-FIRST.md`;
- authors update metadata once rather than editing multiple catalog tables;
- release version and maturity are visible before download.

### Work package 8 — Migrate remaining packs

Migrate in small batches:

1. transformation packs;
2. reimagine/build packs;
3. engineering and operations automation packs;
4. exceptions such as `regression-software-testing`;
5. generic `agentic-ai-workflow`, which should become a foundation/profile
   rather than remain a peer customer outcome.

Do not move the folder taxonomy until manifests, redirects, release downloads,
and catalog navigation are stable.

## Future official AI-DLC v2 integration

### Integration seam

Add a workflow-provider abstraction to the pack manifest:

```yaml
workflow:
  provider: local-instructions-v1
```

An experimental pack can later declare:

```yaml
workflow:
  provider: aidlc-v2
  version: <pinned-version>
  profile: <tested-profile>
  extensions:
    - <ramp-plugin-or-overlay>
```

The pack continues to declare its RAMP outcome, domain skills, patterns,
templates, and release targets. The provider adapter decides how workflow,
state, gates, and harness integration are installed.

### Migration path

1. Stabilize the immediate local-instruction pack, adapter, and release
   contracts.
2. Pin one official AI-DLC v2 release for evaluation.
3. Build an adapter without modifying upstream core.
4. Map one transformation pack and the Agentic QA Pipeline Builder.
5. Dual-run representative scenarios through the local instruction provider
   and AI-DLC v2.
6. Compare usability, artifacts, gates, state, resume, audit, performance, and
   upgrade behavior.
7. Offer AI-DLC v2 as an opt-in preview provider.
8. Make it the default only after the go/no-go criteria pass.
9. Keep a time-boxed local-instruction compatibility path for existing
   engagements.

### Go/no-go criteria

Official AI-DLC v2 becomes the default only when:

- two contrasting packs achieve functional and customer-experience parity;
- RAMP extensions require no upstream-core patches;
- every required agent tool is supported or has an approved compatibility
  path;
- installation and release generation are deterministic and provenance
  recorded;
- state, gates, audit, resume, concurrency, rollback, upgrade, and uninstall
  behavior pass automated tests;
- offline and restricted customer environments are supported where required;
- the workflow is materially easier to operate than the local instruction
  provider;
- a tested rollback to the local instruction provider exists.

The official workflow should not be adopted merely because it is official. It
should be adopted when it removes RAMP maintenance burden and improves field
delivery without making the customer experience clunky.

## Validation and release gates

Every supported adapter:

- renders expected instructions and load semantics;
- writes skills to the correct native location;
- writes valid MCP configuration;
- emits supported commands or prompts;
- contains no references to another tool's private paths.

Every individual ZIP:

- installs into a clean project;
- reports conflicts in an existing project;
- is idempotent when reinstalled;
- supports an upgrade and rollback test;
- verifies checksums and notices;
- contains no secret, credential, PII, or customer identifier.

Every declared shared workspace profile:

- produces compatible individual artifacts from one pack version;
- installs cleanly in any supported tool-install order;
- contains equivalent workflow gates and artifact expectations;
- uses canonical provider-owned state and artifact paths;
- preserves `.kiro/specs` when Kiro participates unless explicitly overridden;
- documents concurrency limits;
- passes sequential cross-tool resume tests;
- does not overwrite an existing agent configuration silently.

Any optional combined ZIP must contain the exact outputs already validated by
its workspace profile; it must not introduce different behavior.

Every release:

- is built twice and compared for determinism;
- records source, dependency, and generator provenance;
- publishes checksums;
- passes the pack's validation commands;
- is attached to a versioned GitHub Release.

Release-helper acceptance must cover both Bash and PowerShell. The current
PowerShell skill installers are not generated or protected by the same stale
output check as Bash, so this gap must be closed before calling the ZIP
distribution cross-platform.

## Explicitly not in the immediate scope

- an agent-driven intake questionnaire;
- dynamic pack composition from free-form customer answers;
- exposing RAMP Phase 1–4 as customer pack categories;
- moving every pack into a new hierarchy immediately;
- adopting official AI-DLC v2 as the default;
- generating every possible combination of agent tools;
- committing ZIP files or release `dist/` into Git;
- silently tracking latest upstream skills;
- publishing customer-derived artifacts without generalization and review.

## Key decisions still needed

1. Which two packs should be the official migration pilots?
2. Which multi-tool profiles deserve standard public releases beyond the
   immediate Kiro/Claude customer profile?
3. Which current local skills are RAMP-owned, upstream-derived, or candidates
   for replacement by pinned external skills?
4. Is the generalized QA pipeline architecture safe for public release or
   limited initially to an internal/customer-specific distribution?
5. Which AI-DLC v2 profiles and harnesses are mandatory before an integration
   can be considered viable?

## Recommended first outcome

The first practical milestone is not the complete repository restructure. It
is a thin vertical slice proving the target model:

1. one v2 pack manifest;
2. one canonical local workflow plus overlays;
3. pinned skill resolution;
4. regression coverage for all four current renderers;
5. qualified Kiro and Claude Code individual artifacts;
6. one qualified Kiro/Claude shared-workspace profile that makes those
   individual artifacts compatible;
7. a generalized Agentic QA Pipeline pattern;
8. self-contained preview ZIPs published outside Git history;
9. automated parity, provenance, conflict, and cross-platform helper tests.

Once this works for the QA pipeline and one transformation pack, migrate the
remaining catalog in controlled batches and begin the optional AI-DLC v2
evaluation.

## Supporting analysis

- [Current repository assessment](revamp-research/current-repo-assessment.md)
- [RAMP source analysis](revamp-research/ramp-source-analysis.md)
- [AI-DLC v2 gap analysis](revamp-research/aidlc-v2-gap-analysis.md)
- [Earlier long-horizon master plan](RAMP_BLUEPRINT_REPOSITORY_REVAMP_MASTER_PLAN.md)
