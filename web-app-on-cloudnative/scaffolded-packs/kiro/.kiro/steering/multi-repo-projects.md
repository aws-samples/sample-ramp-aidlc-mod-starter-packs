---
inclusion: auto
---
# Multi-Repo Projects & Repo Model

**Purpose**: Choose how the system's code is organized (the repo model) and, when it spans more than one repo (or a multi-domain monorepo), capture the whole system's intent once and split the AI-DLC specs safely across repo boundaries without contract drift.

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

- **Monorepo / monorepo-with-workspaces (options 1–2):** run the **standard single-repo workflow** (Phase 1 → 2 → 3 in `aidlc-decisions-workflow.md`) — its Phase 1/2 already capture overall requirements + design in one place, and Phase 3 decomposes into parallel task groups. If the repo spans **multiple contract-sharing domains**, run the two system-level passes below (System Requirements → System High-Level Design) so the contracts are fixed once — but here contracts live as an **in-repo shared package/module**, changed atomically alongside consumers. No cross-repo publishing or versioning ceremony.
- **Domain-grouped or polyrepo (options 3–4):** run the full **MULTI-REPO PROJECTS** flow below — System Requirements → System High-Level Design (publish **versioned** shared contracts = Wave 0) → **split** into per-repo slices → fan out to per-repo detailed specs that pin a contract version.

> 🔑 **The only real difference across models is the contract mechanism:** an **in-repo shared package** (monorepo — changes are atomic) vs a **versioned, published artifact** (multi-repo — changes are coordinated and version-bumped). Everything else — decision gates, approval gates, state/audit tracking, parallel task waves — is identical.

**Coarse choice early, detailed topology later.** Two things are decided at different times: (1) **spec placement** + a *provisional* **mono-vs-multi lean** can be set up front (largely an org/Conway call); (2) the **detailed topology** — the exact repos and where the boundaries sit — is finalized in the **System High-Level Design (S2)**, *after* the **System Requirements (S1)** and domain model (and Phase 0 for brownfield), because it must follow the bounded contexts, capability set, NFRs, and ownership those reveal.

**Brownfield: reverse-engineer before you fix the topology.** For an existing system, run a **system-level Phase 0 (Reverse Engineering) BEFORE committing the repo model/topology** — the bounded contexts, coupling, and existing API contracts it surfaces are the primary input to *where the repo boundaries go* and to the contract catalog. You can discuss the mono-vs-multi *preference* early (it's partly an org/Conway decision), but confirm the *topology* after RE. Greenfield has no code to RE, so topology follows the domain design directly.

---

# MULTI-REPO PROJECTS

**When this applies:** the system is split across **multiple repositories** — e.g. each SPA and each BFF is its own repo, plus a shared domain/engine repo and any integration endpoints. Confirm the repo model at project start (see MANDATORY FIRST ACTIONS in `aidlc-decisions-workflow.md`).

**The core risk is contract drift.** When independent repos each run their own spec from scratch, their product intent AND their APIs/data shapes drift out of sync — integration fails late and per-repo specs come out thin. The workflow prevents this by **capturing the whole system once, then splitting it**, under one rule:

> 🔒 **CONTRACT-FIRST, DECIDE-ONCE.** Shared decisions — the system's requirements/intent, the API/event contracts between tiers, the auth model, and the repo topology — are made **once** at the system level (S1 + S2) and then **frozen**. Per-repo specs are **derived slices** of that system spec; they consume the contracts as the source of truth and **never redefine** them. A contract change goes back to the system design, bumps a version, and notifies dependent repos — it is never made locally in a component spec.

## Flow overview — two levels: capture the whole, then split

```
   ┌────────────────────────────────────────────────────────────┐
   │  LEVEL 1 — SYSTEM (once, up front)                          │
   │                                                            │
   │  S1. System Requirements    (= Phase 1, whole system)      │
   │      intent · personas · user stories + acceptance         │
   │      criteria · units of work · cross-cutting NFRs         │
   │                          │                                 │
   │                          ▼                                 │
   │  S2. System High-Level Design  (= Phase 2, whole system)   │
   │      architecture · CONTRACT CATALOG (seams) ·             │
   │      repo topology (unit → repo) · auth ·                  │
   │      publish shared contracts  ── WAVE 0 ──▶               │
   └────────────────────────────┬───────────────────────────────┘
                                │  S3. SPLIT — Kiro decomposes
                                │      system reqs + HLD → per-repo slices
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   consumer-bff            cashier-bff             backoffice-spa   ...
   S4. R → D → T           S4. R → D → T           S4. R → D → T
   (derived story slice     (derived story slice    (derived story slice
    + consumed contracts)    + consumed contracts)   + consumed contracts)
        └───────────────────────┼───────────────────────┘
                                ▼
                  S5. INTEGRATION WAVE (end-to-end across repos)
```

## Step S1 — System Requirements (Phase 1, whole system)

Run the **normal Requirements phase (Phase 1)** — scoped to the WHOLE system, before any split. Create `_decisions-requirements.md` then generate `requirements.md` at the system level. It captures overall intent and product scope:

- **Personas & scope** — who the users are; what's in / out of scope.
- **End-to-end user stories with acceptance criteria** (EARS where useful) spanning the whole system — the primary flows, not per-repo fragments. Give stories stable IDs so slices can trace back.
- **Units of work** — the coarse capabilities/features that will become components/repos (the candidate decomposition).
- **Cross-cutting NFRs** — throughput/latency, availability, data residency; and compliance/security constraints.
- **Integration map** — external systems the platform must interoperate with.
- (Brownfield) reference the Phase 0 analysis in `aidlc-docs/analysis/`.

This is the *same* decision-gated Phase 1 you'd run for a single-repo project — just at system scope. **Approval gate.** Update `aidlc-state.md` and `audit.md`.

## Step S2 — System High-Level Design (Phase 2, whole system)

Run the **normal Design phase (Phase 2)** at system scope, *derived from* S1. Create `_decisions-design.md` then generate `design.md` at the system level. This is where architecture, contracts, and topology are decided:

- **Architecture & component responsibilities** — the components/services and what each owns.
- **Contract catalog** — for every seam (engine ↔ BFF, BFF ↔ SPA, external integration): paths/methods/payloads/status codes or event schemas, and auth. Freeze at **two confidence tiers**:
  - **Hard-frozen** — contracts extracted from an existing/reverse-engineered component (e.g. a built domain engine's API). Real and immutable for the engagement; confirm which endpoints are actually stable (a component "still under integration testing" may not be).
  - **Stable-but-amendable (v0)** — greenfield contracts (e.g. new BFF↔SPA seams). Derive from the end-to-end flow, publish v0 to unblock parallel work, allow controlled revision through the amendment path during early fan-out, then harden to v1. Don't pretend a greenfield contract is fully known on day one.
- **Repo topology (unit → repo mapping)** — the definitive repo list, which units of work / stories each owns, and a dependency map (who consumes whose contract). For brownfield, base boundaries on the bounded contexts from Phase 0 — don't guess the seams.
- **Auth model** — IdP (e.g. Keycloak/Cognito), token flow, where tokens are validated, roles per surface.
- **Multi-repo mechanics:**
  - **Spec placement** — 1) **Central specs repo (Kiro Recommended for workshops)**: all specs in ONE repo, code in separate repos — single source of truth, one audit trail, agent can read the whole system when slicing. 2) **Co-located**: each repo carries its own specs + a shared contracts repo/package as authority. 3) **Hybrid**: system specs + contracts central, per-repo specs co-located, each pinned to a contract version.
  - **Contract ownership & versioning** — who owns each contract, how it's versioned (semver on an OpenAPI/schema package), how changes propagate.
  - **Shared types strategy** — generated from the contract (recommended) vs hand-written; package vs vendored.
  - **Contract test strategy** — consumer-driven contract tests (recommended) so each repo verifies against the frozen contract independently.
- **Publish the shared contracts** — the concrete artifacts (OpenAPI files, type packages, event schemas). This is **Wave 0** — a hard dependency every repo builds against.

Include a **Mermaid** system context diagram (repos as components + contract edges) and at least one cross-repo sequence diagram for the primary happy path. **Approval gate.** Update `aidlc-state.md` and `audit.md`.

## Step S3 — Split the system into per-repo slices (Kiro decomposes)

With S1 + S2 approved, **Kiro decomposes** the system into per-repo work. This is the step that makes per-repo specs substantive instead of thin. Produce a `split.md` (in `_platform/`) and, for each repo/unit, a **derived requirements slice**:

- The subset of **user stories + acceptance criteria** that repo owns — traceable back to the S1 story IDs (not re-authored from scratch).
- Its **contract obligations** — which shared contracts it *consumes*, and (for a BFF/engine) which it *publishes*.
- The **local NFRs** that apply to it.

Each repo's `requirements.md` **begins as this slice**. **Confirm the split with the user** (which stories → which repo, any gaps/overlaps) before detailed fan-out. Update `aidlc-state.md` and `audit.md`.

## Step S4 — Per-repo detailed specs (fan-out)

For each repo, run detailed **Requirements → Design → Tasks** on top of its slice — in parallel across repos:

- **Requirements** — refine the inherited slice into detailed, testable per-repo requirements. Because it starts from real stories + ACs + contract obligations, this is rich, not brief. The per-repo `_decisions-requirements.md` covers only genuinely local requirement choices — the shared intent already lives in S1, so keep it lean here on purpose.
- **Design** — detailed component design *within* the frozen contracts. **Import, don't redefine**: reference the S2 contract catalog by name/version; state which contract this repo publishes, but the contract itself was fixed at system level.
- **Local-only decisions** — framework details, module structure, local compute (Fargate vs Lambda for this tier), caching, pagination, error handling, local testing.
- **Contract evolution is expected — route it by blast radius:**
  - **Domain-internal contract** (a BFF↔SPA seam owned by one squad): the squad may evolve it directly and update the published contract — only they consume it. Low ceremony.
  - **Shared contract** (the engine API, or anything multiple components consume): STOP, record in `audit.md`, amend it in the system design — bump the version and notify every consumer. Never fork a shared contract locally.
  - Prefer **additive, backward-compatible** changes over breaking ones. A single **contract owner** (e.g. the architect) approves shared-contract amendments; batch and re-freeze at a checkpoint rather than churning continuously.
- **Brownfield components** (e.g. the already-built engine) run a deeper **component-level** Phase 0 RE in their own repo, feeding the component spec — distinct from, and after, the up-front **system-level** RE.
- **Tasks** — generate per-repo task waves (see S5).

## Step S5 — Contract-driven parallel construction

- **Wave 0 (system):** shared contracts published and versioned. Every repo depends on this.
- **Waves 1..n (per repo, parallel):** each repo executes its own `tasks.md` against the frozen contract. Repos with no cross-dependency run fully in parallel (one squad/Kiro instance per repo). Use consumer-driven contract tests to verify against the contract without needing the other repos live.
- **Final wave (integration):** end-to-end flows exercised across the real repos; verify against the system design's sequence diagrams.

## State, audit & repo hand-off

Track progress at **both levels, in separate files**, so parallel squads on separate branches never contend on one tracker:

- **System level** — `aidlc-docs/_platform/{aidlc-state.md, audit.md}` covers **S0–S3** (RE, System Requirements, System High-Level Design, Split) plus a high-level per-repo rollup.
- **Per sub** — each sub keeps its **own** `aidlc-docs/<repo>/{aidlc-state.md, audit.md}` covering its **S4** Requirements → Design → Tasks and execution.

**Why per-sub:** once you split, squads work on separate branches (and eventually separate repos). Disjoint per-sub state/audit paths mean branches don't collide on a shared tracker.

**Hand-off to code repos:** when a squad moves from the central specs repo to its own code repo, it copies its `.kiro/specs/<repo>/` bundle (decisions + requirements + design + tasks) **and** its `aidlc-docs/<repo>/` (state + audit) into the code repo — where they become that repo's **root** `aidlc-docs/` + `.kiro/specs/<repo>/`. Shared contracts are consumed by pinned version. From that point the code repo owns its own AI-DLC lifecycle. (This is effectively transitioning that sub from the central-specs-repo placement to co-located.)

## Multi-repo directory conventions

**Central specs repo model** (all specs authored in one repo, per-level tracking):

```
<central-specs-repo>/
├── aidlc-docs/
│   ├── _platform/                    # system-level state + audit (S0–S3 + repo rollup)
│   │   ├── aidlc-state.md
│   │   └── audit.md
│   ├── consumer-bff/                 # per-sub state + audit (S4 R→D→T + execution)
│   │   ├── aidlc-state.md
│   │   └── audit.md
│   └── ...                           # one folder per sub
└── .kiro/specs/
    ├── _platform/                    # LEVEL 1 — system specs (whole system)
    │   ├── _decisions-requirements.md · requirements.md   # S1
    │   ├── _decisions-design.md · design.md               # S2 (architecture, topology)
    │   ├── contracts/                                     # published contracts (Wave 0)
    │   └── split.md                                       # S3 — unit→repo mapping + slices
    ├── consumer-bff/                 # LEVEL 2 — per-repo detailed specs (R → D → T)
    ├── cashier-bff/
    ├── consumer-spa/
    └── ...

     ── hand-off ──▶  copy .kiro/specs/<repo>/ + aidlc-docs/<repo>/ into the <repo> code repo
```

**Co-located / hybrid model** (specs already travel with each code repo):

```
<contracts-repo>/                     # authority for shared contracts + system specs
├── aidlc-docs/_platform/             # system-level state + audit (S0–S3)
└── .kiro/specs/_platform/            # requirements.md · design.md · contracts/ · split.md
<consumer-bff-repo>/
├── aidlc-docs/                       # this repo's OWN state + audit (S4 + execution)
└── .kiro/specs/consumer-bff/         # per-repo detailed spec; pins contracts@<version>
<consumer-spa-repo>/
├── aidlc-docs/
└── .kiro/specs/consumer-spa/
```
