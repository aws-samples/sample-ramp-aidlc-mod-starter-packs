# RAMP Locked Skills and Customer Release Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RAMP packs reproducible, self-contained, and downloadable as safe per-tool ZIPs while eliminating manual drift from upstream AWS skill repositories and keeping portable skills distinct from deployable AWS Transform assets.

**Architecture:** A committed source registry and lock file identify exact upstream skill trees. Resolution remains local and offline during normal installs/releases: pack-local overrides, RAMP-owned skills, verified locked cache or matching compatibility mirrors, then explicitly classified legacy-local skills. A release builder turns the existing `buildPlan()` output into a deterministic bundle model, adds provenance/notices/install metadata, and writes sorted ZIP entries with normalized timestamps and modes. Standalone Bash and PowerShell helpers preflight hashes and ownership before changing a customer repository.

**Tech Stack:** Node.js 18+ ESM, YAML, Vitest, Git CLI for explicit dependency synchronization, `yazl@3.3.1` for ZIP creation, `yauzl@3.2.0` for archive verification tests, Bash, PowerShell, GitHub Actions.

**Spec:** `docs/RAMP_STARTER_PACKS_MASTER_PLAN_V2.md`

## Global Constraints

- Normal `init` and `release` commands never resolve a live branch or silently access the network.
- Customer releases consume only committed RAMP source, exact lock entries, and content whose full-tree checksum matches the lock.
- Prefer `aws/agent-toolkit-for-aws`; use `awslabs/agent-plugins` only when intentionally selected and pinned.
- Pack-local overrides remain possible but must carry explicit provenance before a release can include them.
- RAMP-owned portable skills live under `skills/ramp/<name>/`; AWS Transform deployable assets live under `atx/agents/<name>/`.
- A normal pack ZIP never registers, deploys, or claims to deploy an AWS Transform custom agent.
- `dist/` and dependency caches remain ignored and are never committed.
- Individual artifacts are generated only for targets declared and qualified by the pack.
- A named shared profile produces compatible individual target ZIPs; a combined ZIP remains deferred.
- Kiro participation means the shared spec root defaults to `.kiro/specs`; otherwise it defaults to `specs`.
- Extraction creates a staging directory. Installation aborts before customer-file writes when any source-integrity or destination conflict exists.
- No-Node installation helpers must work from bundled files alone.
- ZIP entry order, path separators, timestamps, permissions, JSON ordering, and compression settings are deterministic.
- GitHub Release publication is tag/manual gated; implementation and tests do not publish or deploy anything.

## Review Focus

- A locked skill exists locally but its references/scripts drifted while `SKILL.md` stayed unchanged: full-tree verification must fail.
- A ZIP entry, skill file, ownership record, or manifest path contains traversal, a symlink escape, a backslash, tab, or newline: reject before materialization.
- Kiro and Claude artifacts are built separately from one shared profile: both must carry the identical `.kiro/specs` and `aidlc-docs` roots.
- A customer installs two compatible artifacts in either order, upgrades one, edits an owned file, or rolls back: identical/co-owned files are safe and modified files are never overwritten or deleted.
- The same source is built on repeated runs or a different runner OS: archive bytes and SHA-256 remain identical for the same explicit source commit and build epoch.

---

## Dependency and file map

### Committed dependency contracts

- `dependencies/skills.sources.yaml` — two allowed upstream repositories, precedence, license, and notice locations.
- `dependencies/skills.lock.yaml` — exact skill name, source, commit, path, tree checksum, and license metadata.
- `schemas/skill-sources-v1.schema.json` — published source-registry contract.
- `schemas/skill-lock-v1.schema.json` — published lock contract.
- `schemas/ramp-skill-v1.schema.json` — metadata required for a RAMP-owned skill to enter a release.

### Dependency implementation

- `installer/src/dependencies/checksum.js` — deterministic full-tree hashing.
- `installer/src/dependencies/manifests.js` — parse, validate, normalize, and deterministically write source/lock files.
- `installer/src/dependencies/resolver.js` — local override/RAMP/locked/legacy resolution with provenance.
- `installer/src/dependencies/sync.js` — explicit Git synchronization and lock-update operations.

### Release implementation

- `installer/src/release/entries.js` — flatten `buildPlan()` text/copy operations into validated byte entries.
- `installer/src/release/stable-json.js` — recursive stable JSON serialization.
- `installer/src/release/provenance.js` — bundle manifest, hashes, licenses, and source metadata.
- `installer/src/release/notices.js` — third-party notices and license payloads.
- `installer/src/release/readme-first.js` — customer-specific staging/install guidance and runtime prerequisites.
- `installer/src/release/install-manifest.js` — common standalone-helper ownership input.
- `installer/src/release/installers.js` — render Bash and PowerShell helpers from the same model.
- `installer/src/release/templates/install.sh` — no-Node POSIX implementation.
- `installer/src/release/templates/install.ps1` — no-Node PowerShell implementation.
- `installer/src/release/zip.js` — deterministic ZIP writer.
- `installer/src/release/index.js` — public `releasePack()` orchestration.

### CI and ATX boundaries

- `.github/workflows/release-packs.yml` — build/verify twice; optionally publish from an approved tag/manual run.
- `.github/workflows/update-skill-locks.yml` — propose pinned upstream updates through a PR.
- `schemas/atx-agent-v1.schema.json`, `installer/src/atx/` — package source only; never deploy/register.

---

### Task 1: Publish the skill provenance contracts and full-tree checksum

**Files:**

- Create: `dependencies/skills.sources.yaml`
- Create: `schemas/skill-sources-v1.schema.json`
- Create: `schemas/skill-lock-v1.schema.json`
- Create: `schemas/ramp-skill-v1.schema.json`
- Create: `installer/src/dependencies/checksum.js`
- Create: `installer/src/dependencies/manifests.js`
- Create: `installer/test/dependency-manifests.test.js`
- Create: `installer/test/skill-checksum.test.js`
- Create: `skills/ramp/README.md`
- Create: `atx/README.md`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: repository root and the existing `yaml` dependency.
- Produces:

```js
hashSkillTree(directory)
// => { treeSha256, files: [{ path, sha256, executable, size }] }

assertPortableRelativePath(path)
// rejects absolute, traversal, backslash, tab, newline, NUL, and empty segments

loadSkillSources(repoRoot)
// => { schemaVersion: 1, sources: [{ id, repository, priority, license, licensePath, noticePath }] }

loadSkillLock(repoRoot)
// => { schemaVersion: 1, skills: Map<string, LockedSkill> }

writeSkillLock(repoRoot, normalizedLock)
// deterministic YAML sorted by skill name
```

- [ ] **Step 1: Add failing checksum tests**

Test one fixture where identical trees hash equally regardless of creation order, then prove that changing file bytes, a relative path, or the executable bit changes `treeSha256`. Add a symlink fixture and direct `assertPortableRelativePath()` cases for `../`, backslash, tab, newline, NUL, and empty path segments; every one must be rejected.

- [ ] **Step 2: Run the checksum test and confirm RED**

Run:

```bash
npm test --prefix installer -- test/skill-checksum.test.js
```

Expected: fail because `dependencies/checksum.js` does not exist.

- [ ] **Step 3: Implement the exact tree-hash framing**

Walk regular files only, sort paths with a byte-stable comparator (`a < b ? -1 : a > b ? 1 : 0`), normalize to forward slashes, reject symlinks, and hash each file with:

```text
file NUL <relative-path> NUL <x-or-dash> NUL <decimal-byte-length> NUL <raw-bytes> NUL
```

The executable marker is `x` when any executable bit is set and `-` otherwise. Return SHA-256 for each file plus the final tree SHA-256.

- [ ] **Step 4: Add failing source/lock contract tests**

Cover duplicate source IDs, non-HTTPS/non-GitHub repositories, branch names in `commit`, commits not matching 40 lowercase hexadecimal characters, unsafe skill paths, invalid 64-character tree checksums, missing license/notice fields, duplicate skill names, and deterministic lock writing.

- [ ] **Step 5: Run manifest tests and confirm RED**

```bash
npm test --prefix installer -- test/dependency-manifests.test.js
```

Expected: fail because the loaders and schemas do not exist.

- [ ] **Step 6: Add the two-source registry**

Commit this source order:

```yaml
schemaVersion: 1
sources:
  - id: agent-toolkit-for-aws
    repository: https://github.com/aws/agent-toolkit-for-aws.git
    priority: 10
    license: Apache-2.0
    licensePath: LICENSE
    noticePath: NOTICE
  - id: agent-plugins
    repository: https://github.com/awslabs/agent-plugins.git
    priority: 20
    license: Apache-2.0
    licensePath: LICENSE
    noticePath: NOTICE
```

Lower `priority` wins during an explicit update. A release never uses priority to change an existing lock.

- [ ] **Step 7: Implement loaders, JSON schemas, and boundary READMEs**

`skills/ramp/README.md` must require `SKILL.md` plus `skill.yaml` matching `ramp-skill-v1`, including `name`, SemVer `version`, `license`, and optional `basedOn`. `atx/README.md` must state that deployable AWS Transform agents belong under `atx/agents/`, are packaged separately, and are never activated by unpacking/installing a normal pack.

Add `.ramp-cache/` to `.gitignore`; do not add a home-directory cache.

- [ ] **Step 8: Run focused and full tests**

```bash
npm test --prefix installer -- test/skill-checksum.test.js test/dependency-manifests.test.js
npm test --prefix installer
git diff --check
```

- [ ] **Step 9: Commit checkpoint**

```bash
git add .gitignore dependencies/skills.sources.yaml schemas/skill-sources-v1.schema.json schemas/skill-lock-v1.schema.json schemas/ramp-skill-v1.schema.json installer/src/dependencies/checksum.js installer/src/dependencies/manifests.js installer/test/dependency-manifests.test.js installer/test/skill-checksum.test.js skills/ramp/README.md atx/README.md
git commit -m "feat: define locked skill provenance"
```

---

### Task 2: Resolve RAMP, locked upstream, and legacy skills without network access

**Files:**

- Create: `installer/src/dependencies/resolver.js`
- Create: `installer/test/skill-resolver.test.js`
- Modify: `installer/src/skills.js`
- Modify: `installer/src/plan.js`
- Modify: `installer/test/skills.test.js`
- Modify: `installer/test/plan.test.js`

**Interfaces:**

- Consumes: `loadSkillLock()`, `hashSkillTree()`, adapter `skillsRoot`, and Task 3 workspace-aware `buildPlan()`.
- Produces:

```js
createSkillResolver({
  repoRoot,
  cacheDir = join(repoRoot, '.ramp-cache', 'skills'),
  allowLegacyLocal = true,
  strictProvenance = false,
})

resolveSkill(name, { packDir })
// => {
//   directory,
//   provenance: {
//     kind: 'pack-override' | 'ramp' | 'upstream' | 'legacy-local',
//     name, version, source, repository, commit, path, treeSha256, license
//   }
// }

planSkills(packDir, manifest, tool, { resolver })
```

- [ ] **Step 1: Write the resolver precedence tests**

Pin this order:

1. `packs/<pack>/skills/<name>` deliberate override;
2. `skills/ramp/<name>` RAMP-owned source with valid `skill.yaml`;
3. `.ramp-cache/skills/sources/<source-id>/<commit>/<locked-path>`;
4. `skills-library/<name>` when it matches a lock exactly;
5. `skills-library/<name>` as `legacy-local` only when no lock exists.

Tests must also prove:

- a drifted mirror for a locked skill fails rather than becoming legacy-local;
- a missing locked cache/mirror gives an actionable `run ramp-pack skills sync --locked` error;
- strict provenance rejects an override or legacy-local skill without release metadata;
- a pack override is never falsely attributed to upstream;
- an unknown name fails before any destination write.

- [ ] **Step 2: Run resolver tests and confirm RED**

```bash
npm test --prefix installer -- test/skill-resolver.test.js
```

- [ ] **Step 3: Implement the local-only resolver**

The resolver must perform no `fetch`, `git`, HTTP, or process execution. For a lock entry, verify the selected directory with `hashSkillTree()` on every resolution. Do not trust a directory-level mtime as proof that nested content is unchanged.

- [ ] **Step 4: Thread provenance through skill plan entries**

Each copy entry becomes:

```js
{
  path: `${adapter.skillsRoot}/${name}`,
  content: resolved.directory,
  kind: 'copy',
  provenance: resolved.provenance,
}
```

The existing `buildPlan(packDir, tool, options)` output paths and bytes must not change.

- [ ] **Step 5: Preserve the compatibility bridge**

When `dependencies/skills.lock.yaml` does not exist, current repositories and temporary tests continue to resolve pack-local and `skills-library` content exactly as today. When the lock exists, only names present in the lock become checksum-enforced.

- [ ] **Step 6: Run focused tests, scaffold parity, and full suite**

```bash
npm test --prefix installer -- test/skill-resolver.test.js test/skills.test.js test/plan.test.js
node installer/bin/ramp-pack.js build-all --out /tmp/ramp-resolver-parity
npm test --prefix installer
git diff --check
```

Compare every generated tool directory and `add-skills.sh` with committed bytes before committing.

- [ ] **Step 7: Commit checkpoint**

```bash
git add installer/src/dependencies/resolver.js installer/src/skills.js installer/src/plan.js installer/test/skill-resolver.test.js installer/test/skills.test.js installer/test/plan.test.js
git commit -m "feat: resolve skills with locked provenance"
```

---

### Task 3: Add explicit synchronization and generate the first upstream lock

**Files:**

- Create: `installer/src/dependencies/sync.js`
- Create: `installer/test/skill-sync.test.js`
- Create: `dependencies/skills.lock.yaml`
- Modify: `installer/bin/ramp-pack.js`

**Interfaces:**

- Consumes: Task 1 source/lock loaders and tree hashing.
- Produces:

```js
syncLockedSkills({ repoRoot, cacheDir, sourceRoots = new Map() })
// fetches/checks out exact committed locks and verifies every tree

updateSkillLocks({
  repoRoot,
  names,
  cacheDir,
  sourceRoots = new Map(),
  ref = 'main',
})
// explicit network-capable maintenance operation; writes deterministic lock
```

CLI:

```text
ramp-pack skills verify [--cache <dir>]
ramp-pack skills sync --locked [--cache <dir>] [--source-root <id>=<dir>...]
ramp-pack skills update-lock --skill <name>... [--cache <dir>] [--source-root <id>=<dir>...]
```

- [ ] **Step 1: Add local-Git fixture tests**

Create temporary Git repositories in tests; never call a public network. Test exact detached checkout, offline `--source-root`, wrong commit, missing path, checksum mismatch, missing license/notice, and a second sync reusing the verified cache.

- [ ] **Step 2: Run the sync test and confirm RED**

```bash
npm test --prefix installer -- test/skill-sync.test.js
```

- [ ] **Step 3: Implement safe Git process execution**

Use `execFileSync()`/`spawnSync()` argument arrays, never a shell string. A network sync checks out the exact lock commit. `update-lock` is the only operation allowed to resolve `main`; it must write the resulting 40-character commit and checksum before returning.

- [ ] **Step 4: Generate the initial ten-entry lock from the verified neighboring checkouts**

Use these commits and paths:

```text
agent-toolkit-for-aws @ b6d5b7894cc8ae875307f232830acdad683164dc
  amazon-aurora-mysql
    skills/specialized-skills/database-skills/amazon-aurora-mysql
  amazon-aurora-postgresql
    skills/specialized-skills/database-skills/amazon-aurora-postgresql
  aurora-dsql
    skills/specialized-skills/database-skills/aurora-dsql
  aws-iam
    skills/core-skills/aws-iam
  aws-step-functions
    skills/specialized-skills/serverless-skills/aws-step-functions
  connecting-lambda-to-api-gateway
    skills/specialized-skills/serverless-skills/connecting-lambda-to-api-gateway
  creating-amazon-aurora-db-cluster-with-instances
    skills/specialized-skills/database-skills/creating-amazon-aurora-db-cluster-with-instances
  signing-in-to-aws
    skills/core-skills/signing-in-to-aws

agent-plugins @ 097fe8ad56d8a1d5e2c81d7880adf145553cf244
  api-gateway
    plugins/aws-serverless/skills/api-gateway
  aws-lambda
    plugins/aws-serverless/skills/aws-lambda
```

Run the new `update-lock` command with:

```text
--source-root agent-toolkit-for-aws=../agent-toolkit-for-aws
--source-root agent-plugins=../agent-plugins
```

The command computes and writes every exact `treeSha256`; do not hand-enter checksums. All remaining `skills-library` entries stay explicitly `legacy-local` until separately reviewed.

- [ ] **Step 5: Verify the lock offline**

```bash
node installer/bin/ramp-pack.js skills verify
npm test --prefix installer -- test/skill-sync.test.js test/skill-resolver.test.js
npm test --prefix installer
git diff --check
```

- [ ] **Step 6: Commit checkpoint**

```bash
git add dependencies/skills.lock.yaml installer/src/dependencies/sync.js installer/bin/ramp-pack.js installer/test/skill-sync.test.js
git commit -m "feat: pin initial upstream skills"
```

---

### Task 3A: Close strict provenance for both release pilots

**Files:**

- Create: `installer/test/pilot-skill-provenance.test.js`
- Create: `installer/test/pilot-upstream-skill-contract.test.js`
- Modify: `dependencies/skills.lock.yaml`
- Move: `skills-library/mobile-test-automation/` to `skills/ramp/mobile-test-automation/`
- Move: `skills-library/web-test-automation/` to `skills/ramp/web-test-automation/`
- Move: `skills-library/ecs-architect/` to `skills/ramp/ecs-architect/`
- Move: `skills-library/ecs-build/` to `skills/ramp/ecs-build/`
- Move: `skills-library/ecs-devops/` to `skills/ramp/ecs-devops/`
- Move: `skills-library/ecs-observability/` to `skills/ramp/ecs-observability/`
- Move: `skills-library/ecs-operation-review/` to `skills/ramp/ecs-operation-review/`
- Move: `skills-library/ecs-recon/` to `skills/ramp/ecs-recon/`
- Move: `skills-library/ecs-security/` to `skills/ramp/ecs-security/`
- Create: one `skill.yaml` in each moved RAMP skill directory

**Interfaces:**

- Consumes: strict-provenance resolver and lock update command.
- Produces: `createSkillResolver({ strictProvenance: true })` succeeds for every skill declared by `qa-automated-testing` and `legacy-transformation-on-aws`.

- [ ] **Step 1: Add the failing two-pilot provenance test**

Load each pilot manifest and resolve every declared skill with strict provenance. Print the unresolved/mismatched names in one failure. The initial expected failures are:

```text
qa-automated-testing:
  amazon-bedrock
  aws-lambda-microvms
  mobile-test-automation
  web-test-automation

legacy-transformation-on-aws:
  aws-cloudformation
  aws-lambda-durable-functions
  aws-observability
  ecs-architect
  ecs-build
  ecs-devops
  ecs-observability
  ecs-operation-review
  ecs-recon
  ecs-security
```

- [ ] **Step 2: Run the test and confirm RED**

```bash
npm test --prefix installer -- test/pilot-skill-provenance.test.js
```

- [ ] **Step 3: Pin the five maintained upstream replacements**

At `b6d5b7894cc8ae875307f232830acdad683164dc`, add lock entries for:

```text
amazon-bedrock
  skills/core-skills/amazon-bedrock
aws-cloudformation
  skills/core-skills/aws-cloudformation
aws-lambda-durable-functions
  skills/specialized-skills/serverless-skills/aws-lambda-durable-functions
aws-observability
  skills/core-skills/aws-observability
```

At `097fe8ad56d8a1d5e2c81d7880adf145553cf244`, add:

```text
aws-lambda-microvms
  plugins/aws-serverless/skills/aws-lambda-microvms
```

These local legacy copies differ from the selected upstream trees. Before switching resolution, add `pilot-upstream-skill-contract.test.js` assertions that:

- every replacement has a parseable `SKILL.md` with the expected skill name;
- `amazon-bedrock` still covers model invocation, Guardrails, Knowledge Bases, and AgentCore;
- `aws-lambda-microvms` still covers isolation, image creation, run, suspend/resume, and IAM;
- `aws-cloudformation` still covers authoring, validation, change sets, and failed-stack diagnosis;
- `aws-lambda-durable-functions` still covers replay safety, waits/callbacks, retries, compensation, and testing;
- `aws-observability` still covers CloudWatch logs/metrics/alarms, traces, ADOT, and Application Signals.

Then resolve the pinned cache rather than falsely labeling the old copies as exact upstream content.

- [ ] **Step 4: Move the nine repository-authored skill families**

Git history shows the mobile/web testing and seven ECS skill trees were introduced and maintained in this repository. Move them without content edits to `skills/ramp/`, add:

```yaml
schemaVersion: 1
kind: ramp-skill
name: <directory-name>
version: 1.0.0
license: MIT-0
```

Use the actual directory name for `name`. Before committing, `git diff --find-renames -- skills-library skills/ramp` must show each directory as a rename with no content changes beyond its new `skill.yaml`.

- [ ] **Step 5: Verify strict provenance and pack behavior**

```bash
npm test --prefix installer -- test/pilot-skill-provenance.test.js test/pilot-upstream-skill-contract.test.js test/legacy-transformation-skills.test.js
npm test --prefix installer
git diff --check
```

Generate the two pilots using a synchronized cache and verify rendered instruction bytes remain unchanged; skill source content changes only for the five explicitly pinned upstream replacements.

- [ ] **Step 6: Commit checkpoint**

```bash
git add dependencies/skills.lock.yaml installer/test/pilot-skill-provenance.test.js installer/test/pilot-upstream-skill-contract.test.js skills/ramp skills-library
git commit -m "feat: close pilot skill provenance"
```

---

### Task 4: Build a deterministic unpacked bundle with provenance and notices

**Files:**

- Create: `installer/src/release/entries.js`
- Create: `installer/src/release/stable-json.js`
- Create: `installer/src/release/provenance.js`
- Create: `installer/src/release/notices.js`
- Create: `installer/src/release/readme-first.js`
- Create: `installer/src/release/bundle.js`
- Create: `installer/test/release-bundle.test.js`
- Modify: `installer/src/plan.js`

**Interfaces:**

- Consumes:

```js
buildPlan(packDir, target, { includeSkills: true, workspace, resolver })
```

- Produces:

```js
collectPlanEntries(plan)
// => [{ path, bytes, mode, provenance }]

buildBundle(packDir, {
  target,
  profile,
  workspace,
  repoRoot,
  cacheDir,
  sourceCommit,
  buildTime,
})
// => { artifactName, ownershipKey, entries, manifest }
```

- [ ] **Step 1: Add failing plan-expansion safety tests**

Test recursive copy expansion, hidden files, executable files, deterministic sorting, duplicate paths, symlinks, traversal, absolute paths, backslashes, tabs/newlines, and exclusion of `.git`, `node_modules`, `.DS_Store`, and local research files.

- [ ] **Step 2: Run the bundle test and confirm RED**

```bash
npm test --prefix installer -- test/release-bundle.test.js
```

- [ ] **Step 3: Implement immutable release entries**

Every entry is a forward-slash relative path, a `Buffer`, and mode `0o100644` or `0o100755`. Expand `kind: copy` recursively and carry the skill provenance from the parent plan entry to every expanded skill file.

- [ ] **Step 4: Add failing provenance/notices tests**

Assert this staging layout:

```text
<artifact-name>/
├── README-FIRST.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── licenses/<source-id>/LICENSE
├── licenses/<source-id>/NOTICE
├── overlay/<tool-native files>
├── bundle-manifest.json
└── SHA256SUMS
```

Task 5 adds `install-files.tsv`, `install.sh`, and `install.ps1` to this model. Task 4 must not emit incomplete helper files.

`bundle-manifest.json` must record pack/schema/catalog, target, selected profile, resolved workspace, workflow provider plus provider version `1`, overlays, generator version, source commit, build time, each skill provenance record, MCP declarations, licenses, and SHA-256 for every install-owned `overlay/` file.

`SHA256SUMS` covers every bundle file except itself. The manifest never hashes itself, preventing a recursive hash.

- [ ] **Step 5: Implement stable metadata generation**

`stable-json.js` recursively sorts object keys and preserves array order. `buildTime` must be an explicit ISO-8601 UTC value. `README-FIRST.md` lists tool-specific runtime prerequisites inferred from MCP commands (`npx`, `uvx`, AWS profile) separately from installation prerequisites.

Copy the complete Apache-2.0 license and NOTICE for every upstream source actually used; do not assume the repository's root MIT-0 license applies to upstream skills.

- [ ] **Step 6: Reject unattributed release inputs**

Release-mode bundle construction fails for:

- legacy-local skills;
- pack overrides without provenance metadata;
- RAMP skills without valid `skill.yaml`;
- locked trees with checksum drift;
- unresolved source license/notice files.

Normal `init` remains compatible and may still use legacy-local skills.

- [ ] **Step 7: Run focused and full tests**

```bash
npm test --prefix installer -- test/release-bundle.test.js
npm test --prefix installer
git diff --check
```

- [ ] **Step 8: Commit checkpoint**

```bash
git add installer/src/release installer/test/release-bundle.test.js installer/src/plan.js
git commit -m "feat: compose self-contained release bundles"
```

---

### Task 5: Generate conflict-safe Bash and PowerShell installers with ownership

**Files:**

- Create: `installer/src/release/install-manifest.js`
- Create: `installer/src/release/installers.js`
- Create: `installer/src/release/templates/install.sh`
- Create: `installer/src/release/templates/install.ps1`
- Create: `installer/test/install-manifest.test.js`
- Create: `installer/test/install-bash.test.js`
- Create: `installer/test/install-powershell.test.js`
- Modify: `installer/src/release/bundle.js`

**Interfaces:**

- Consumes: sorted `overlay/` entries and `ownershipKey`.
- Produces:

```js
renderInstallManifest({ bundleId, ownershipKey, version, files })
// tab-separated, path-safe, deterministic install-files.tsv

renderInstallers(model)
// => { bash, powershell }
```

CLI inside each helper:

```text
install.sh|install.ps1 --target <dir> [--dry-run]
install.sh|install.ps1 --target <dir> --uninstall
install.sh|install.ps1 --target <dir> --rollback
```

- [ ] **Step 1: Define and test the common ownership format**

Use UTF-8 tab-separated records:

```text
RAMP-INSTALL-MANIFEST<TAB>1
bundle<TAB><bundle-id>
owner<TAB><ownership-key>
version<TAB><pack-version>
file<TAB><sha256><TAB><mode><TAB><relative-path>
```

Reject tabs/newlines in every scalar. Ownership state lives at:

```text
.ramp/installed/<ownership-key>.tsv
.ramp/backups/<ownership-key>/<previous-version>/
```

`ownershipKey` excludes pack version and includes pack, target, and profile (`standalone` when absent), so an upgrade finds its predecessor while Kiro and Claude maintain separate ownership records.

- [ ] **Step 2: Add Bash scenario tests and confirm RED**

Execute the generated Bash helper against temporary directories:

- clean install;
- dry run;
- tampered source overlay;
- one destination conflict causes zero customer-file writes;
- identical reinstall;
- identical shared file installed by two owners in either order;
- safe upgrade when current bytes match prior ownership;
- modified owned file blocks upgrade/uninstall/rollback;
- uninstall preserves a file still claimed by another owner;
- rollback restores prior bytes and ownership.

- [ ] **Step 3: Implement preflight-before-write**

The helper first verifies all bundled hashes, then classifies every destination as `new`, `identical`, `owned-update`, or `conflict`. It writes `install-conflicts.txt` beside the extracted helper and exits non-zero if any conflict exists. It must not create `.ramp/` or any target file before the preflight succeeds.

On macOS use `shasum -a 256`; on Linux use `sha256sum`; abort if neither exists. Quote every path.

- [ ] **Step 4: Generate PowerShell from the same model**

PowerShell uses `Get-FileHash -Algorithm SHA256` and the identical TSV/state semantics. Static tests assert no hard-coded tool list or divergent paths. If `pwsh` is locally available, run the same fixture scenarios; otherwise mark only the execution cases skipped and require the Windows CI job in Task 9.

- [ ] **Step 5: Run focused and full tests**

```bash
npm test --prefix installer -- test/install-manifest.test.js test/install-bash.test.js test/install-powershell.test.js
npm test --prefix installer
git diff --check
```

- [ ] **Step 6: Commit checkpoint**

```bash
git add installer/src/release/install-manifest.js installer/src/release/installers.js installer/src/release/templates installer/src/release/bundle.js installer/test/install-manifest.test.js installer/test/install-bash.test.js installer/test/install-powershell.test.js
git commit -m "feat: add safe standalone bundle installers"
```

---

### Task 6: Write deterministic ZIPs and expose the local release CLI

**Files:**

- Create: `installer/src/release/zip.js`
- Create: `installer/src/release/index.js`
- Create: `installer/test/release-zip.test.js`
- Create: `installer/test/release-cli.test.js`
- Modify: `installer/bin/ramp-pack.js`
- Modify: `installer/package.json`
- Modify: `installer/package-lock.json`

**Interfaces:**

- Consumes: `buildBundle()` and Task 3 `resolveWorkspace()`.
- Produces:

```js
writeDeterministicZip(entries, outFile, { mtime })
// sorted addBuffer() entries, normalized mode, no compression

releasePack(packDir, {
  target,
  profile,
  specRoot,
  stateRoot,
  outDir,
  repoRoot,
  cacheDir,
  sourceCommit,
  buildTime,
})
// => { archivePath, sha256, manifest }
```

CLI:

```text
ramp-pack release <pack> --target <tool> [--profile <name>]
  [--spec-root <path>] [--state-root <path>]
  [--out <dir>] [--cache <dir>]
  [--source-commit <sha>] [--build-time <ISO-8601>]

ramp-pack release <pack> --all-targets [same common options]
```

- [ ] **Step 1: Add ZIP dependencies**

```bash
npm install --prefix installer yazl@3.3.1
npm install --prefix installer --save-dev yauzl@3.2.0
```

- [ ] **Step 2: Add failing deterministic/archive-safety tests**

Using `yauzl` with `lazyEntries: true`, verify hidden/native paths, executable modes, UTF-8 names, no traversal, and expected file bytes. Build the same entries twice and compare complete ZIP bytes and SHA-256. Changing one skill byte must change both bundle and archive checksum.

- [ ] **Step 3: Implement deterministic ZIP encoding**

Use `yazl.addBuffer()` for every sorted entry with:

```js
{
  mtime: explicitBuildDate,
  mode: entry.mode,
  compress: false,
  forceDosTimestamp: true,
}
```

All entries live under exactly one top-level `<artifactName>/` directory. No filesystem stat-derived timestamp, uid/gid, locale sort, or random temporary name may enter the archive.

- [ ] **Step 4: Add failing release-policy tests**

Reject v1 packs, undeclared targets, unqualified targets, unknown profiles, a target outside the selected profile, dirty/missing locked skills, missing source/build provenance, and MCP/runtime arguments containing floating selectors such as `@latest`. Record an unversioned `npx`/`uvx` package as a release warning and prevent profile qualification until the pack either pins or removes it. `--all-targets` means `distribution.qualifiedTargets`, not every adapter.

- [ ] **Step 5: Implement release orchestration and CLI**

If `--source-commit`/`--build-time` are omitted, a checkout with no tracked changes under the selected pack, `common/`, `workflow-overlays/`, `skills/ramp/`, `dependencies/`, or `installer/` may derive:

```text
sourceCommit = git rev-parse HEAD
buildTime = UTC timestamp from git show -s --format=%ct <sourceCommit>
```

Untracked planning/research files outside those release inputs do not block a build. Outside Git, require both values. `SOURCE_DATE_EPOCH` overrides only the build time. The command writes ignored `dist/` output locally and never publishes.

Artifact names:

```text
<pack>--<target>--v<version>.zip
<pack>--<target>--<profile>--v<version>.zip
```

- [ ] **Step 6: Run focused and full tests**

```bash
npm test --prefix installer -- test/release-zip.test.js test/release-cli.test.js
npm test --prefix installer
git diff --check
git status --short
```

Confirm generated ZIPs appear only under ignored `dist/`.

- [ ] **Step 7: Commit checkpoint**

```bash
git add installer/src/release/zip.js installer/src/release/index.js installer/bin/ramp-pack.js installer/test/release-zip.test.js installer/test/release-cli.test.js installer/package.json installer/package-lock.json
git commit -m "feat: generate deterministic pack releases"
```

---

### Task 7: Qualify the first Kiro/Claude shared-profile release

**Dependency:** Execute only after Wave 2 workflow/path normalization has removed foreign tool-private references from the two pilots.

**Files:**

- Modify: `schemas/pack-v2.schema.json`
- Modify: `installer/src/manifest.js`
- Modify: `installer/test/manifest.test.js`
- Modify: `packs/qa-automated-testing/pack.yaml`
- Create: `installer/test/shared-release.test.js`

**Interfaces:**

- Consumes: `releasePack()`, `resolveWorkspace()`, both standalone installers, normalized pilot workflows.
- Produces this manifest gate:

```yaml
distribution:
  targets: [kiro, claude-code, copilot, cursor]
  qualifiedTargets: [kiro, claude-code]
  profiles:
    - name: shared-kiro-claude
      targets: [kiro, claude-code]
      workspaceMode: shared
      specRoot: .kiro/specs
      stateRoot: aidlc-docs
  qualifiedProfiles: [shared-kiro-claude]
```

- [ ] **Step 1: Add failing `qualifiedProfiles` validation tests**

Require unique safe names, every qualified profile to exist, and every target within a qualified profile to be in `qualifiedTargets`. Preserve existing v2 manifests by defaulting omitted `qualifiedProfiles` to `[]`.

- [ ] **Step 2: Run manifest tests and confirm RED**

```bash
npm test --prefix installer -- test/manifest.test.js
```

- [ ] **Step 3: Implement the schema/runtime extension**

Expose `distribution.qualifiedProfiles` in catalog data. Release rejects `--profile` unless it is qualified, with an explicit development-only `allowUnqualifiedProfile` API option that the public CLI does not expose.

- [ ] **Step 4: Add cross-artifact integration tests**

For `qa-automated-testing`:

1. build Kiro and Claude individual ZIPs from `shared-kiro-claude`;
2. assert both manifests use `.kiro/specs` and `aidlc-docs`;
3. assert Claude contains no `.kiro/steering` reference and Kiro contains no `.claude/rules` reference;
4. install Kiro then Claude into one repository;
5. repeat Claude then Kiro;
6. verify both native projections coexist and ownership is separate;
7. reinstall both idempotently;
8. compare shared workflow/state/spec expectations in the two rendered outputs.

The permitted cross-tool path is the canonical `.kiro/specs`; tool-private steering/rules paths remain forbidden.

- [ ] **Step 5: Add the QA named profile declaration only after tests pass**

Keep profile maturity effectively preview through the pack's existing `catalog.maturity: preview`. Do not create a combined archive. The legacy transformation pack stays a metadata/workflow pilot but is not profile-qualified in this checkpoint; qualify it only after its floating MCP runtime declarations are removed or pinned and its own shared-release test passes.

- [ ] **Step 6: Build twice and compare the four preview artifacts**

```bash
SOURCE_DATE_EPOCH=$(git show -s --format=%ct HEAD) node installer/bin/ramp-pack.js release qa-automated-testing --target kiro --profile shared-kiro-claude
SOURCE_DATE_EPOCH=$(git show -s --format=%ct HEAD) node installer/bin/ramp-pack.js release qa-automated-testing --target claude-code --profile shared-kiro-claude
npm test --prefix installer -- test/shared-release.test.js
npm test --prefix installer
```

Run the two release commands a second time into another temporary directory and compare SHA-256.

- [ ] **Step 7: Commit checkpoint**

```bash
git add schemas/pack-v2.schema.json installer/src/manifest.js installer/test/manifest.test.js installer/test/shared-release.test.js packs/qa-automated-testing/pack.yaml
git commit -m "feat: qualify shared Kiro Claude releases"
```

---

### Task 8: Package AWS Transform custom-agent source separately

**Files:**

- Create: `schemas/atx-agent-v1.schema.json`
- Create: `installer/src/atx/manifest.js`
- Create: `installer/src/atx/release.js`
- Create: `installer/test/atx-release.test.js`
- Create: `atx/agents/README.md`
- Modify: `schemas/pack-v2.schema.json`
- Modify: `installer/src/manifest.js`
- Modify: `installer/bin/ramp-pack.js`

**Interfaces:**

- Produces:

```js
loadAtxAgent(agentDir)
packageAtxAgent(agentDir, {
  outDir,
  sourceCommit,
  buildTime,
})
// => deterministic source-only ZIP; performs no AWS/API operation
```

CLI:

```text
ramp-pack release-atx <agent-name> --out <dir> --source-commit <sha> --build-time <ISO-8601>
```

- [ ] **Step 1: Add failing ATX-boundary tests**

Define the RAMP packaging manifest—not an invented AWS service registration payload:

```yaml
schemaVersion: 1
kind: ramp-atx-agent-source
name: example-agent
title: Example Agent
version: 0.1.0
description: Source package for explicit review and deployment.
license: MIT-0
instructions: instructions
skills: skills
deploymentGuide: README-DEPLOY.md
```

Reject missing deployment guidance, secrets (`.env`, credentials, private keys), traversal, symlinks, customer identifiers listed in a configurable denylist fixture, and any manifest field that claims automatic registration/deployment.

- [ ] **Step 2: Run ATX tests and confirm RED**

```bash
npm test --prefix installer -- test/atx-release.test.js
```

- [ ] **Step 3: Implement source-only packaging**

Reuse the deterministic entry/ZIP/provenance utilities. Always include `README-DEPLOY.md` beginning with:

```text
This archive contains source only. Extraction or RAMP pack installation does not register or deploy an AWS Transform custom agent.
```

No module in `installer/src/atx/` may import AWS SDK clients or execute deployment commands.

- [ ] **Step 4: Allow optional pack references without bundling/deploying them**

Add `capabilities.atxAgents: [example-agent]` to the pack schema/runtime test fixture. A normal bundle records these IDs under `relatedAssets` and points to separately released source archives; it does not copy the ATX agent tree into `overlay/`.

Portable custom skills—including skills intended to assist AWS Transform work—remain normal `skills/ramp/<name>` assets and are bundled through Task 2.

- [ ] **Step 5: Run focused and full tests**

```bash
npm test --prefix installer -- test/atx-release.test.js test/manifest.test.js
npm test --prefix installer
git diff --check
```

- [ ] **Step 6: Commit checkpoint**

```bash
git add schemas/atx-agent-v1.schema.json schemas/pack-v2.schema.json installer/src/atx installer/src/manifest.js installer/bin/ramp-pack.js installer/test/atx-release.test.js atx/agents/README.md
git commit -m "feat: support source-only ATX agent releases"
```

---

### Task 9: Add cross-platform verification, lock-update PRs, and gated Release publication

**Files:**

- Modify: `.github/workflows/build-packs.yml`
- Create: `.github/workflows/update-skill-locks.yml`
- Create: `.github/workflows/release-packs.yml`
- Create: `scripts/verify-release-determinism.mjs`
- Create: `installer/test/windows-helper-fixtures.test.js`

**Interfaces:**

- Consumes: `skills verify/sync/update-lock`, `release`, Bash/PowerShell helpers.
- Produces CI-only verification and optional GitHub Release assets.

- [ ] **Step 1: Add workflow contract tests**

Parse workflow YAML and assert:

- build verification has Linux and Windows helper jobs;
- releases run with Node 20 and a lockfile-backed `npm ci`;
- source commit time populates `SOURCE_DATE_EPOCH`;
- release output is built twice and compared;
- `dist/` is uploaded as a workflow artifact before any publish step;
- the publish job requires both a tag and explicit `publish=true`;
- update-lock has no release permission;
- release publication has `contents: write` only on the publish job.

- [ ] **Step 2: Extend the normal verification workflow**

Run:

```text
npm ci
npm test
ramp-pack skills sync --locked --cache "$RUNNER_TEMP/ramp-skills"
ramp-pack skills verify --cache "$RUNNER_TEMP/ramp-skills"
existing scaffold drift check
Bash helper scenario tests on Ubuntu
PowerShell helper scenario tests on windows-latest
```

PowerShell execution parity is not considered complete until the Windows job passes.

- [ ] **Step 3: Add scheduled/manual lock-update PR workflow**

The workflow:

1. checks out `main`;
2. runs `skills update-lock` explicitly;
3. verifies locks, licenses, notices, and all tests;
4. exits without a PR when no lock changed;
5. creates `automation/skill-locks-<run-id>`;
6. commits only `dependencies/skills.lock.yaml`;
7. pushes the branch;
8. opens a PR with `gh pr create`.

Use `contents: write` and `pull-requests: write` only in this workflow. It proposes updates; it never auto-merges.

- [ ] **Step 4: Add gated release workflow**

Inputs:

```yaml
pack:
  required: true
publish:
  type: boolean
  default: false
```

Build every declared qualified target and qualified profile projection, run the deterministic-build script twice, verify helper installs, upload the archives/checksums as a workflow artifact, and publish only when:

```text
publish == true AND github.ref starts with refs/tags/
```

Publishing attaches ZIPs plus a top-level `SHA256SUMS` to the existing versioned GitHub Release. It does not create AWS resources or GitHub Pages.

- [ ] **Step 5: Run local validation**

```bash
npm test --prefix installer
node scripts/verify-release-determinism.mjs --pack qa-automated-testing
git diff --check
```

Do not trigger `workflow_dispatch`, push a tag, or publish an asset during implementation.

- [ ] **Step 6: Commit checkpoint**

```bash
git add .github/workflows/build-packs.yml .github/workflows/update-skill-locks.yml .github/workflows/release-packs.yml scripts/verify-release-determinism.mjs installer/test/windows-helper-fixtures.test.js
git commit -m "ci: verify and publish RAMP release bundles"
```

---

### Task 10: Replace the manual-copy customer path with the release path

**Files:**

- Modify: `README.md`
- Create: `docs/authoring-skills.md`
- Create: `docs/releasing-packs.md`
- Create: `docs/atx-assets.md`
- Modify: `packs/qa-automated-testing/README.md`
- Modify: `packs/legacy-transformation-on-aws/README.md`

**Interfaces:**

- Consumes: all prior customer and author commands.
- Produces: one consistent no-CLI download/install path and one advanced CLI path.

- [ ] **Step 1: Add documentation drift tests**

Assert that documented adapter IDs come from generated catalog data, release filenames match `releasePack()`, no page instructs a release-ZIP customer to fetch skills separately, and ATX docs never imply unzip/install performs deployment.

- [ ] **Step 2: Document the customer path**

The primary flow is:

1. choose Transform, Reimagine, or Automate;
2. choose a qualified tool artifact or shared profile;
3. download and verify SHA-256;
4. extract into a staging directory;
5. read `README-FIRST.md`;
6. run `install.sh` or `install.ps1`, or manually copy `overlay/`.

Keep `ramp-pack init` and `ramp-pack release` as advanced author/operator paths.

- [ ] **Step 3: Document skill ownership**

`docs/authoring-skills.md` must explain:

- RAMP-owned portable skill: `skills/ramp/<name>/SKILL.md` plus `skill.yaml`;
- exact upstream dependency: source + lock entry;
- pack override: exceptional and release-provenance required;
- legacy-local: compatible for now but blocked from customer release;
- update locks through a reviewed PR, never by copying live `main`.

- [ ] **Step 4: Document ATX ownership**

Explain the difference between a portable skill and a deployable custom-agent source archive. Include explicit review/deployment prerequisites and state that registration remains a separate human-approved operation.

- [ ] **Step 5: Run tests and commit**

```bash
npm test --prefix installer
git diff --check
git add README.md docs/authoring-skills.md docs/releasing-packs.md docs/atx-assets.md packs/qa-automated-testing/README.md packs/legacy-transformation-on-aws/README.md
git commit -m "docs: add RAMP download and release guidance"
```

---

## Checkpoint order and release gate

| Checkpoint | Customer-visible effect | May publish? |
|---|---|---|
| 1. Provenance contracts | None | No |
| 2. Local locked resolver | No rendered-byte change | No |
| 3. Initial upstream lock | Removes drift for ten exact skill trees | No |
| 3A. Pilot provenance closure | Both pilots become attributable | No |
| 4. Unpacked bundle | Internal preview only | No |
| 5. Safe helpers | Internal preview only | No |
| 6. Deterministic ZIP CLI | Local ignored `dist/` only | No |
| 7. Qualified pilot profiles | Release candidates exist locally | No |
| 8. ATX source packaging | Separate local source archives | No |
| 9. CI workflows | Workflow artifacts by default | Only approved tag/manual run |
| 10. Customer/author docs | Download path becomes discoverable | After release approval |

## Final verification before any public release

```bash
npm ci --prefix installer
npm test --prefix installer
node installer/bin/ramp-pack.js skills verify
node scripts/verify-release-determinism.mjs --pack qa-automated-testing
git diff --check
git status --short
```

Then require:

- independent code review approval;
- Windows PowerShell helper CI success;
- two install orders for each shared profile;
- clean-install, identical-reinstall, conflict, upgrade, rollback, and uninstall evidence;
- no customer identifier, secret, credential, `.git`, `node_modules`, local research, or unlicensed file in an archive;
- explicit owner approval before pushing a release tag or dispatching `publish=true`.

## Self-review result

- **Spec coverage:** pinned skills, RAMP-owned skills, ATX separation, deterministic per-tool/profile ZIPs, no-Node installers, ownership/conflicts, provenance/notices, GitHub Releases, update PRs, and clone-size protection are covered.
- **Intentional deferral:** combined ZIPs, semantic config merging, GitHub Pages, automatic ATX deployment/registration, and official AI-DLC v2 remain outside this wave.
- **Type consistency:** `hashSkillTree`, source/lock loaders, `createSkillResolver`, `buildBundle`, `renderInstallers`, `writeDeterministicZip`, and `releasePack` are introduced before their consumers.
- **Review focus:** every listed failure mode has an owning test task.
