# Multi-Repo Projects & Repo Model

A companion steering file for systems whose code spans **more than one repository**
— for example a separate **frontend repo and backend repo** for one app, or several
service repos plus a shared contracts repo. It adds a **repo-model decision gate** at
the start, and — when the system is multi-repo — a two-level flow that captures the
whole system's intent once and splits the specs across repos **without contract drift**.

## 🚨 ACTIVATION

**Always run the repo-model decision gate** (below) at project start, right after
Practices Discovery and before Phase 1. Then:

- **Single repo (monorepo)** → skip the rest of this file; run the standard
  `aidlc-workflow.md` flow (Phase 1 → 2 → 3).
- **Multi-repo** → follow the **Multi-Repo Flow** in this file (system-level
  requirements + design → split → per-repo fan-out).

The gate is **opt-in by design**: most single-app builds pick monorepo and never
touch the multi-repo machinery. It only fires when the team actually has multiple repos.

---

## Repo Model — decide this first

You do **not** need to know the repo model before starting — this is a decision gate.
Present the options, let the user choose (or confirm), then adapt the workflow.

### Decision gate: repo model

**Question:** How is this system's code organized across repositories?

**Why this matters:** it drives how specs are split, how the shared API/event
contracts between repos are published and consumed, and how much cross-repo
coordination the team carries.

**Options:**
1. **Monorepo (single repo)** — all code (and, if applicable, frontend + backend
   together) in one repository, one build. *Recommended for small, tightly-coupled
   teams* — cross-cutting changes (a contract + all its consumers) happen atomically
   in one commit. → runs the **standard single-repo workflow**; the rest of this file is skipped.
2. **Frontend + Backend split (2 repos)** — one repo for the frontend (SPA / mobile /
   web client) and one for the backend (APIs, services, event processors), sharing an
   agreed API + event contract. The common structure for a single app owned by a
   frontend team and a backend team. → runs the **Multi-Repo Flow**.
3. **Other multi-repo (3+ repos)** — e.g. a repo per service/component, or a shared
   contracts/domain repo plus several consumer repos. Maximum autonomy; justified by
   many independent teams, per-repo access/compliance separation, or independent
   release cadences. → runs the **Multi-Repo Flow** (the same flow generalizes to N repos).

4. Other (please specify): _______________________

**Choosing heuristic:** small team + tight coupling + lean DevOps → option 1. A single
app split by frontend/backend ownership → option 2. Many autonomous teams or
repo-level access/compliance separation → option 3. "We're doing microservices" is
**not** by itself a reason for many repos — services can deploy independently from a
monorepo too.

**Answer:**

> 🔑 **The only real difference between the models is the contract mechanism:** in a
> monorepo the shared contract is an **in-repo package** changed atomically alongside
> its consumers; across repos it is a **versioned, published artifact** whose changes
> are coordinated and version-bumped. Everything else — decision gates, approval gates,
> state/audit tracking, parallel task waves — is identical.

**Coarse choice early, detailed topology later.** You can set the repo model (and a
provisional spec-placement lean) up front, but finalize the **exact repo list and
boundaries** during System Design, after the system requirements (and after Phase 0 for
brownfield) — the boundaries follow the bounded contexts and requirements those reveal.

**Brownfield:** run a **system-level Phase 0 (Reverse Engineering) before committing the
topology** — the bounded contexts, coupling, and existing API/event contracts it surfaces
are the primary input to where the repo boundaries go and to the contract catalog.

---

# MULTI-REPO FLOW

**When this applies:** the system is split across multiple repositories (option 2 or 3
above). Confirm the repo model at the gate first.

**The core risk is contract drift.** When independent repos each run their own spec from
scratch, their product intent AND their APIs / event schemas drift out of sync —
integration fails late and per-repo specs come out thin. The flow prevents this by
**capturing the whole system once, then splitting it**, under one rule:

> 🔒 **CONTRACT-FIRST, DECIDE-ONCE.** Shared decisions — the system's requirements/intent,
> the **API and event contracts** between repos, the auth model, and the repo topology —
> are made **once** at the system level and then **frozen**. Per-repo specs are **derived
> slices** of that system spec; they consume the contracts as the source of truth and
> **never redefine** them. A contract change goes back to the system design, bumps a
> version, and notifies dependent repos — it is never made locally in one repo's spec.

## Flow overview — two levels: capture the whole, then split

```
   ┌─────────────────────────────────────────────────────────────┐
   │  LEVEL 1 — SYSTEM (once, up front)                          │
   │                                                             │
   │  System Requirements   (= Phase 1, WHOLE system)            │
   │      intent · personas · end-to-end user stories +         │
   │      acceptance criteria (stable IDs) · units of work ·    │
   │      cross-cutting NFRs · integration map                  │
   │                          │                                  │
   │                          ▼                                  │
   │  System Design   (= Phase 2, WHOLE system)                  │
   │      architecture · CONTRACT CATALOG (API + event seams) · │
   │      repo topology (unit → repo) · auth ·                  │
   │      publish shared contracts  ── WAVE 0 ──▶                │
   └────────────────────────────┬────────────────────────────────┘
                                │  SPLIT — the agent decomposes
                                │  system reqs + design → per-repo slices
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
     backend repo           frontend repo          (other repos…)
     Req → Design → Tasks   Req → Design → Tasks    Req → Design → Tasks
     (derived slice +       (derived slice +        (derived slice +
      publishes contract)    consumes contract)      consumes/publishes)
        └───────────────────────┼───────────────────────┘
                                ▼
                  INTEGRATION WAVE (end-to-end across repos)
```

For the common **frontend + backend** case this reads simply: capture the app's
requirements once, freeze the **frontend↔backend API contract and any event/topic
schemas**, split the stories into a backend slice and a frontend slice, then let each
repo run its own Requirements → Design → Tasks in parallel against the frozen contract.

## Step 1 — System Requirements (Phase 1, whole system)

Run the **normal Requirements phase** scoped to the WHOLE system, before any split.
Create `_decisions-requirements.md`, then `requirements.md`, at the system level:

- **Personas & scope** — who the users are; what's in / out of scope.
- **End-to-end user stories + acceptance criteria** spanning the whole system (the
  primary flows, not per-repo fragments). Give stories **stable IDs** so slices trace back.
- **Units of work** — the coarse capabilities that will map to repos (candidate decomposition).
- **Cross-cutting NFRs** — throughput/latency, availability, data residency, compliance/security.
- **Integration map** — external systems and event sources the platform interoperates with.
- (Brownfield) reference the system-level Phase 0 analysis in `aidlc-docs/analysis/`.

Same decision-gated Phase 1 as single-repo — just at system scope. **Approval gate.**
Update `aidlc-state.md` and `audit.md`.

> 🎯 **Product-complete, but boundary-agnostic.** The system requirements carry the
> **full product detail** — real personas, real end-to-end user stories with acceptance
> criteria — decided **once** so no repo can disagree about *what the app does*. What they
> do NOT contain is repo-local detail ("the frontend does X, the backend does Y") or
> implementation choices — that is deferred to each repo's own Requirements in Step 4.
> Capture *what the app is* here; capture *how each repo delivers its slice* later.

## Step 2 — System Design (Phase 2, whole system)

Run the **normal Design phase** at system scope, derived from Step 1. This is where
architecture, contracts, and topology are decided:

- **Architecture & component responsibilities** — the services/components and what each owns.
- **Contract catalog — the frozen seams.** For every boundary between repos, capture the
  contract and freeze it at a confidence tier:
  - **Sync API seams** (frontend↔backend, service↔service): paths/methods/payloads/status
    codes, auth. Publish as OpenAPI.
  - **Async event/message seams** (EventBridge / SNS / SQS / MSK topics between services):
    the event/message **schema**, topic/bus name, ordering & delivery semantics, and which
    repo **publishes** vs **consumes** each. Publish as event-schema documents (JSON Schema /
    Schema Registry entries).
  - **Confidence tiers:** *Hard-frozen* — contracts extracted from an existing/reverse-
    engineered component (real and immutable for the engagement). *Stable-but-amendable (v0)*
    — greenfield seams; publish v0 to unblock parallel work, allow controlled revision
    during early fan-out, then harden to v1. Don't pretend a greenfield contract is fully
    known on day one.
- **Repo topology (unit → repo mapping)** — the definitive repo list, which units of work /
  stories each owns, and a dependency map (who consumes/publishes which contract). For the
  frontend+backend case this is simply: backend owns the APIs + event producers; frontend
  owns the client and consumes the API (and any client-facing events).
- **Auth model** — IdP, token flow, where tokens are validated, roles per surface.
- **Multi-repo mechanics:**
  - **Spec placement** — 1) **Central specs repo (recommended for workshops):** all specs
    in ONE repo, code in the separate repos — single source of truth, one audit trail, the
    agent can read the whole system when slicing. 2) **Co-located:** each repo carries its
    own specs plus a shared contracts repo/package as authority. 3) **Hybrid:** system specs
    + contracts central, per-repo specs co-located, each pinned to a contract version.
  - **Contract ownership & versioning** — who owns each contract; semver on the OpenAPI /
    event-schema package; how changes propagate.
  - **Shared types strategy** — generated from the contract (recommended) vs hand-written.
  - **Contract test strategy** — consumer-driven contract tests (recommended) so each repo
    verifies against the frozen contract independently, without the other repos live.
- **Publish the shared contracts** — the concrete artifacts (OpenAPI files, event schemas,
  type packages). This is **Wave 0** — a hard dependency every repo builds against.

Include a **Mermaid** system context diagram (repos as components + contract edges, both
API and event) and at least one cross-repo sequence diagram for the primary happy path.
**Approval gate.** Update `aidlc-state.md` and `audit.md`.

## Step 3 — Split the system into per-repo slices (the agent decomposes)

With Steps 1 + 2 approved, **the agent decomposes** the system into per-repo work — this is
what makes per-repo specs substantive instead of thin. Produce a `split.md` (in `_platform/`)
and, for each repo, a **derived requirements slice**:

- The subset of **user stories + acceptance criteria** that repo owns — traceable back to
  the system story IDs (not re-authored from scratch).
- Its **contract obligations** — which shared contracts it *consumes*, and which it *publishes*
  (a backend repo typically publishes the API + events; a frontend repo consumes them).
- The **local NFRs** that apply to it.

Each repo's `requirements.md` **begins as this slice**. **Confirm the split with the user**
(which stories → which repo, any gaps/overlaps) before detailed fan-out. Update
`aidlc-state.md` and `audit.md`.

## Step 4 — Per-repo detailed specs (fan-out, in parallel)

For each repo, run detailed **Requirements → Design → Tasks** on top of its slice — in
parallel across repos (e.g. backend and frontend at the same time):

- **Requirements** — refine the inherited slice into detailed, testable per-repo
  requirements. This is where **repo-local detail** lives (frontend UX/interaction specifics;
  backend data shapes, processing rules, compute) — the complement to the product intent
  fixed at the system level. Because it starts from real stories + ACs + contract obligations,
  it is rich, not brief. **Do NOT re-author the product intent** — reference the system story
  IDs and add only what is genuinely local; keep the per-repo `_decisions-requirements.md`
  lean. (Rule of thumb: if a decision would change *what the app does*, it belongs at the
  system level, not here.)
- **Design** — detailed component design *within* the frozen contracts. **Import, don't
  redefine**: reference the system contract catalog by name/version; state which contract
  this repo publishes, but the contract itself was fixed at system level. Local-only
  decisions (framework, module structure, local compute — Lambda vs Fargate for this tier,
  caching, pagination, error handling, local testing) are made freely here.
- **Contract evolution is expected — route it by blast radius:**
  - **Repo-internal shape** (something only this repo uses): evolve directly, low ceremony.
  - **Shared contract** (the frontend↔backend API, or an event schema multiple repos
    consume): STOP, record in `audit.md`, amend it in the **system design** — bump the
    version and notify every consumer. Never fork a shared contract locally. Prefer
    **additive, backward-compatible** changes; a single **contract owner** (e.g. the
    architect) approves shared-contract amendments and re-freezes at a checkpoint.
  - **Brownfield components** run a deeper **component-level** Phase 0 RE in their own repo,
    after the system-level RE.
- **Tasks** — generate per-repo task waves (see Step 5).

## Step 5 — Contract-driven parallel construction

- **Wave 0 (system):** shared API + event contracts published and versioned. Every repo depends on this.
- **Waves 1..n (per repo, parallel):** each repo executes its own `tasks.md` against the
  frozen contract. Repos with no cross-dependency run fully in parallel (one squad / agent
  instance per repo). Use consumer-driven contract tests to verify against the contract
  without needing the other repos live.
- **Final wave (integration):** end-to-end flows exercised across the real repos; verify
  against the system design's sequence diagrams (both sync API calls and async event flows).

## State, audit & repo hand-off

Track progress at **both levels, in separate files**, so parallel squads on separate
branches never contend on one tracker:

- **System level** — `aidlc-docs/_platform/{aidlc-state.md, audit.md}` covers the system
  Requirements, Design, and Split, plus a high-level per-repo rollup.
- **Per repo** — each repo keeps its **own** `aidlc-docs/<repo>/{aidlc-state.md, audit.md}`
  covering its Requirements → Design → Tasks and execution.

**Hand-off to code repos:** when a squad moves from the central specs repo to its own code
repo, it copies its `.kiro/specs/<repo>/` bundle (decisions + requirements + design + tasks)
**and** its `aidlc-docs/<repo>/` (state + audit) into the code repo, where they become that
repo's root `aidlc-docs/` + `.kiro/specs/<repo>/`. Shared contracts are consumed by pinned
version. From that point the code repo owns its own AI-DLC lifecycle.

> **Spec directory per tool:** this pack follows the same spec-dir convention as
> `aidlc-workflow.md` — `.kiro/specs/<name>/` on Kiro. On other harnesses the installer
> renders the equivalent location (e.g. Claude Code `.claude/specs/`, Cursor
> `.cursor/specs/`, Copilot `.github/specs/`). The `_platform/` and per-repo `<repo>/`
> subfolders below sit under that tool's specs directory.

## Directory conventions

**Central specs repo model** (all specs authored in one repo, per-level tracking):

```
<central-specs-repo>/
├── aidlc-docs/
│   ├── _platform/                    # system-level state + audit + repo rollup
│   │   ├── aidlc-state.md
│   │   └── audit.md
│   ├── backend/                      # per-repo state + audit (Req→Design→Tasks + execution)
│   │   ├── aidlc-state.md
│   │   └── audit.md
│   └── frontend/
│       ├── aidlc-state.md
│       └── audit.md
└── .kiro/specs/                      # (tool's specs dir — .claude/.cursor/.github on other harnesses)
    ├── _platform/                    # LEVEL 1 — system specs (whole system)
    │   ├── _decisions-requirements.md · requirements.md   # Step 1
    │   ├── _decisions-design.md · design.md               # Step 2 (architecture, topology)
    │   ├── contracts/                                     # published API + event contracts (Wave 0)
    │   └── split.md                                       # Step 3 — unit→repo mapping + slices
    ├── backend/                      # LEVEL 2 — per-repo detailed specs (Req → Design → Tasks)
    └── frontend/

     ── hand-off ──▶  copy .kiro/specs/<repo>/ + aidlc-docs/<repo>/ into the <repo> code repo
```

**Co-located / hybrid model** (specs travel with each code repo):

```
<contracts-repo>/                     # authority for shared contracts + system specs
├── aidlc-docs/_platform/             # system-level state + audit
└── .kiro/specs/_platform/            # requirements.md · design.md · contracts/ · split.md
<backend-repo>/
├── aidlc-docs/                       # this repo's OWN state + audit
└── .kiro/specs/backend/              # per-repo detailed spec; pins contracts@<version>
<frontend-repo>/
├── aidlc-docs/
└── .kiro/specs/frontend/
```

## Key Principles

- **Repo model is a decision gate** — always ask; default to monorepo for small tightly-coupled teams.
- **Single repo → skip this flow** — run the standard Phase 1 → 2 → 3.
- **Multi-repo → capture whole, then split** — system Requirements → system Design (freeze
  API + event contracts) → split into derived per-repo slices → fan out in parallel.
- **Contract-first, decide-once** — per-repo specs consume the frozen contracts; they never redefine them.
- **A shared-contract change goes back to the system design** (versioned), never made locally in one repo.
