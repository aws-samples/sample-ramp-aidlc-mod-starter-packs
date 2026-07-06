---
inclusion: auto
name: multi-repo-projects
description: Repo-model decision gate (monorepo → monorepo-with-workspaces → domain-grouped repos → polyrepo) and the contract-first multi-repo spec-splitting flow — System/Platform spec, shared-contract publishing (Wave 0), per-repo fan-out, contract tiers, and directory conventions. Use when the project spans multiple repositories, when deciding how to organize repos, when splitting specs across SPA/BFF/engine repos, or for a monorepo spanning multiple contract-sharing domains.
---

# Multi-Repo Projects & Repo Model

**Purpose**: Choose how the system's code is organized (the repo model) and, when it spans more than one repo (or a multi-domain monorepo), split the AI-DLC specs safely across those boundaries without contract drift.

**Execute when**: At project start, always run the **repo-model decision gate** below. Then follow the **Multi-Repo Projects flow** when the chosen model is domain-grouped repos, repo-per-component (polyrepo), or a monorepo that spans multiple contract-sharing domains.

**Skip the multi-repo flow when**: A single simple app in one repo with no shared contracts across domains — use the standard single-repo workflow in `aidlc-decisions-workflow.md`.

> This doc is loaded and followed from `aidlc-decisions-workflow.md` (see its MANDATORY FIRST ACTIONS). The **contract-first, decide-once** principle here applies to *every* model; only the mechanics of how contracts are shared differ.

---

# REPO MODEL — DECIDE THIS FIRST

You do **not** need to know the repo model before starting — this is a decision gate. Present the options, let the user choose (or confirm), then adapt the workflow.

## Decision gate: repo model

**Question:** How is the system's code organized across repositories?

**Why this matters:** It drives how specs are split, how shared contracts are published/consumed, and how much CI/coordination overhead the team carries.

**Options (a spectrum, not just "one vs many"):**
1. **Monorepo (single repo, one build)** — all apps/services in one repo. *Kiro Recommended for small teams (≈<15 devs) with tightly-coupled components sharing contracts,* because cross-cutting changes (contract + all consumers) happen atomically in one commit and there's one CI/toolchain.
2. **Monorepo with workspaces** (Nx / Turborepo / Gradle multi-module / Maven reactor) — one repo, but independently buildable/deployable targets. Same atomic-contract benefit, with per-target build/deploy.
3. **Domain-grouped repos (few)** — one repo per bounded context (e.g. `consumer` = SPA+BFF, `cashier`, `backoffice`), plus an `engine` repo and a `contracts` repo/package. Balances domain ownership and independent deploys against coordination overhead. A strong middle ground.
4. **Repo-per-component (polyrepo)** — each SPA, each BFF, the engine, and each integration endpoint in its own repo. Maximum autonomy; justified by many independent teams, strict per-repo access control / compliance, or genuinely independent release cadences — less so by team size alone.
5. Other (please specify): _______________________

**Choosing heuristic:** small team + tight coupling + lean DevOps → lean toward 1–3. Many autonomous teams, or repo-level access/compliance separation, or independent release cadences → 3–4. "We're doing microservices" is **not** by itself a reason for 4 — microservices deploy independently from a monorepo too.

**Answer:**

## How the workflow adapts to the chosen model

- **Monorepo / monorepo-with-workspaces (options 1–2):** run the **standard single-repo workflow** (Phase 1 → 2 → 3 in `aidlc-decisions-workflow.md`). If the repo contains **multiple domains that share contracts**, first run a **light System / Platform spec** (below) to fix the domain model + contract catalog once — but here the contracts live as an **in-repo shared package/module**, changed atomically alongside consumers. No cross-repo publishing or versioning ceremony. Per-domain specs live under `.kiro/specs/<domain>/` in the same repo.
- **Domain-grouped or polyrepo (options 3–4):** run the full **MULTI-REPO PROJECTS** flow below — System / Platform spec → publish **versioned** shared contracts (wave 0) → fan out to per-repo component specs that pin a contract version.

> 🔑 **The only real difference across models is the contract mechanism:** an **in-repo shared package** (monorepo — changes are atomic) vs a **versioned, published artifact** (multi-repo — changes are coordinated and version-bumped). Everything else — decision gates, approval gates, state/audit tracking, parallel task waves — is identical.

**Coarse choice early, detailed topology later.** Two things are decided at different times: (1) **spec placement** + a *provisional* **mono-vs-multi lean** can be set up front (largely an org/Conway call); (2) the **detailed topology** — the exact repos and where the boundaries sit — is finalized **after the overall (system-level) requirements + domain model** (and Phase 0 for brownfield), because it must follow the bounded contexts, capability set, NFRs, and ownership those reveal. In the multi-repo flow the detailed topology is answered inside `_decisions-system.md`, *after* its requirements-level questions.

**Brownfield: reverse-engineer before you fix the topology.** For an existing system, run a **system-level Phase 0 (Reverse Engineering) BEFORE committing the repo model/topology** — the bounded contexts, coupling, and existing API contracts it surfaces are the primary input to *where the repo boundaries go* and to the contract catalog. You can discuss the mono-vs-multi *preference* early (it's partly an org/Conway decision), but confirm the *topology* after RE. Greenfield has no code to RE, so topology follows the domain design directly.

**If the model is undecided at project start:** proceed with requirements-level work (which is model-independent), and treat the repo-model gate as a hard prerequisite before the **design** phase — the design (component boundaries, contract packaging) depends on it. Do not generate `design.md` until the repo model is chosen.

---

# MULTI-REPO PROJECTS

**When this applies:** the system is split across **multiple repositories** — e.g. each SPA and each BFF is its own repo, plus a shared domain/engine repo and any integration endpoints. Confirm the repo model at project start (see MANDATORY FIRST ACTIONS in `aidlc-decisions-workflow.md`).

**The core risk is contract drift.** When independent repos each run their own spec, their APIs, data shapes, and event schemas drift out of sync and integration fails late. The workflow prevents this with one rule:

> 🔒 **CONTRACT-FIRST, DECIDE-ONCE.** Shared decisions — the domain model, the API/event contracts between tiers, the auth model, and the repo topology — are made **once** in a System / Platform spec and then **frozen**. Per-repo component specs **consume** those contracts as the source of truth and **never redefine** them. A contract change goes back to the System spec, bumps a version, and notifies dependent repos — it is never made locally in a component spec.

## Flow overview

```
        ┌───────────────────────────────────────────────┐
        │  SYSTEM / PLATFORM SPEC  (run once, up front)  │
        │  _decisions-system.md → system spec            │
        │  • domain model & bounded contexts             │
        │  • API/event CONTRACT CATALOG (the seams)      │
        │  • auth model (IdP), cross-cutting NFRs        │
        │  • repo topology + spec placement decision     │
        │  • publish shared contracts  ── WAVE 0 ──▶     │
        └───────────────┬───────────────────────────────┘
                        │  fan-out (one per repo/component)
     ┌──────────────────┼──────────────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
 consumer-bff       cashier-bff       consumer-spa       backoffice-*
 R → D → T          R → D → T          R → D → T          R → D → T
 (consumes          (consumes          (consumes          ...
  engine API)        engine API)        bff API)
     └──────────────────┴──────────────────┴──────────────────┘
                        ▼
              INTEGRATION WAVE (end-to-end across repos)
```

## Step M0 — Decision gate: `_decisions-system.md`

Before writing any spec, create `_decisions-system.md`. **Answer the requirements-level questions first** (scope, capabilities/personas, cross-cutting NFRs, integration map, compliance) — the topology decision below **follows from them** (and from Phase 0 for brownfield), so don't fix repos/boundaries until the overall requirements are understood. It MUST then cover these multi-repo decision points:

- **Repo topology** — how many repos, and the boundary of each (e.g. one repo per SPA, one per BFF, one for the domain engine, one per integration endpoint). List them explicitly. **For brownfield systems, base these boundaries on the bounded contexts and coupling surfaced by the system-level Phase 0 reverse engineering — run that first; don't guess the seams.**
- **Spec placement** — where the spec files live:
  1. **Central specs repo (Kiro Recommended for workshops)** — all specs in ONE repo (`aidlc-docs/` + `.kiro/specs/`), code in separate repos. Single source of truth for contracts, one audit trail, agent can read the umbrella when generating each component spec. Best when teams must stay aligned on a short timeline.
  2. **Co-located** — each repo carries its own `.kiro/specs/<component>/` and `aidlc-docs/`; a shared **contracts repo** (or published package) holds the OpenAPI/types/event schemas as the authority. Specs travel with code; each team owns its repo. Higher drift risk unless the contracts repo is strictly authoritative.
  3. **Hybrid** — System spec + shared contracts in one repo; per-repo component specs co-located, each pinned to a contract version.
- **Contract ownership & versioning** — who owns each contract, how it is versioned (e.g. semver on an OpenAPI/schema package), and how changes propagate to consumers.
- **Shared types strategy** — generated from the contract (recommended) vs hand-written per repo; published as a package vs vendored.
- **Contract test strategy** — consumer-driven contract tests (recommended) so each repo verifies against the frozen contract independently.

## Step M1 — Generate the System / Platform spec

After the decisions are completed, generate the system spec (in the central specs repo, or a dedicated contracts repo). It MUST include:

- **Domain model & bounded contexts** — the shared vocabulary and which context owns what.
- **Contract catalog** — for every seam (engine ↔ BFF, BFF ↔ SPA, external integration), the API/event contract: paths/methods/payloads/status codes or event schemas, and auth. Freeze contracts at **two confidence tiers**, because they are not equally knowable up front:
  - **Hard-frozen** — contracts extracted from an existing/reverse-engineered component (e.g. a built domain engine's API). These are real and immutable for the engagement; confirm with the team which endpoints are actually stable (a component "still under integration testing" may not be).
  - **Stable-but-amendable (v0)** — greenfield contracts (e.g. new BFF↔SPA seams). Derive them from the known end-to-end flow, publish a v0 to unblock parallel work, and allow controlled revision through the amendment path (below) during early fan-out, then harden to v1. Do NOT pretend a greenfield contract is fully known on day one — that just moves drift earlier.
- **Auth model** — IdP (e.g. Keycloak/Cognito), token flow, where tokens are validated.
- **Cross-cutting NFRs** — throughput/latency targets, availability, data residency, observability baseline.
- **Repo topology** — the definitive list of repos and their responsibilities, with a dependency map (who consumes whose contract).
- **Publish the shared contracts** — the concrete artifacts (OpenAPI files, type packages, event schemas). This is **Wave 0** — a hard dependency every component repo builds against.

Include a **Mermaid** system context diagram (repos as components + contract edges) and at least one cross-repo sequence diagram for the primary happy path.

**Approval gate.** Wait for explicit approval. Update `aidlc-state.md` (Multi-Repo Progress) and `audit.md`.

## Step M2 — Fan out to per-repo component specs

For each repo, run the normal **Phase 1 → 2 → 3** — with these multi-repo overrides:

- **Import, don't redefine.** Each component's `_decisions-*.md` and specs reference the System spec's contract catalog by name/version. The component design consumes its upstream contracts and (for a BFF/engine) states which contract it *publishes* — but the contract itself was fixed at system level.
- **Local-only decisions.** Component specs decide repo-local concerns only: framework details, internal module structure, local compute choice (Fargate vs Lambda for this tier), local testing. They MUST NOT change a shared contract, auth model, or another repo's responsibility.
- **Contract evolution is expected — route it by blast radius.** Discovering a needed contract change while speccing a component is normal, not a failure. Handle it by *who is affected*:
  - **Domain-internal contract** (a BFF↔SPA seam owned by one squad): the squad may evolve it directly and update the published contract — only they consume it. Low ceremony.
  - **Shared contract** (the engine API, or anything multiple components consume): STOP, record it in `audit.md`, and amend it in the System spec — bump the version and notify every consumer. Never fork or redefine a shared contract locally in a component spec.
  - **Prefer additive, backward-compatible changes** (add optional fields) over breaking ones (rename/remove/retype). A single **contract owner** (e.g. the architect) approves shared-contract amendments. Batch and re-freeze shared contracts at a defined checkpoint rather than letting them churn continuously.
- **Brownfield components** (e.g. an already-built domain engine) run a deeper **component-level** Phase 0 reverse engineering in their own repo, feeding the component spec. This is distinct from — and comes after — the **system-level** RE that ran up front to inform the topology and contract catalog.

## Step M3 — Contract-driven parallel construction

Extend the standard task waves across repos:

- **Wave 0 (system):** shared contracts published and versioned. Every repo depends on this.
- **Waves 1..n (per repo, parallel):** each repo executes its own `tasks.md` against the frozen contract. Repos with no cross-dependency run fully in parallel (one squad/Kiro instance per repo). Use consumer-driven contract tests to verify against the contract without needing the other repos live.
- **Final wave (integration):** end-to-end flows exercised across the real repos; verify against the System spec's sequence diagrams.

## Multi-repo directory conventions

**Central specs repo model** (all specs in one repo):

```
<central-specs-repo>/
├── aidlc-docs/                     # single shared state + audit for the whole system
│   ├── aidlc-state.md
│   └── audit.md
└── .kiro/specs/
    ├── _platform/                  # the System / Platform spec (umbrella)
    │   ├── _decisions-system.md
    │   ├── system.md
    │   └── contracts/              # published OpenAPI / types / event schemas (Wave 0)
    ├── consumer-bff/               # component specs (Requirements → Design → Tasks)
    ├── cashier-bff/
    ├── consumer-spa/
    └── ...
```

**Co-located / hybrid model** (specs travel with code):

```
<contracts-repo>/                   # authority for shared contracts + System spec
├── .kiro/specs/_platform/
│   ├── _decisions-system.md
│   ├── system.md
│   └── contracts/
<consumer-bff-repo>/
├── aidlc-docs/                     # this repo's own state + audit
└── .kiro/specs/consumer-bff/       # component spec; pins contracts@<version>
<consumer-spa-repo>/
└── .kiro/specs/consumer-spa/
```
