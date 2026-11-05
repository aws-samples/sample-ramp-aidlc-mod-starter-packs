# RAMP Source Analysis for the Blueprint Repository Revamp

**Analysis date:** 2026-11-04
**Status:** Evidence and implications for design; not an approved repository architecture
**Sources reviewed:**

- `Scaling RAMP - The Rapid Agentic Modernization Program from ASEAN to APJ v2.0.docx`
- `[External] What is RAMP.pptx`, with visual and textual review of slides 1–4

## Executive finding

The repository should not present itself as a flat collection of AI-DLC starter packs. The source material defines RAMP as a program-level system that moves customers from a fast proof of value to production, portfolio-wide wave planning, platform modernisation, and sustained organisational adoption.

The code repository is one enabling product within that system. To visibly embody RAMP, it needs to expose:

1. the four-stage RAMP engagement lifecycle;
2. reusable modernisation and reimagination blueprints;
3. common workload and runtime patterns;
4. cross-cutting engineering automation and Day-2 capabilities;
5. portfolio assessment and wave-planning inputs and outputs;
6. evidence, outcome, and executive-readout artifacts;
7. a learning loop that turns delivery experience into reusable patterns.

The key structural consequence is that **RAMP phase, blueprint type, workload pattern, and cross-cutting capability are different dimensions**. They should not be forced into one flat folder taxonomy.

## 1. What RAMP is

### Direct source evidence

The DOCX and slide 2 consistently position RAMP as:

- a structured engagement model for organisation-wide application modernisation;
- an accelerator to cloud-native architectures using agentic AI tooling and production best practices;
- a path from a small proof of value to executive-sponsored portfolio transformation;
- an umbrella that connects otherwise isolated AWS programmes, mechanisms, tools, and best practices;
- a model spanning applications, databases, operations, people, and process;
- a repeatable delivery and scaling mechanism for AWS teams, customers, and Partners.

Two primary modernisation motions are explicit:

- **Transform from Legacy:** convert an existing codebase into a new form through runtime or framework upgrades, architecture redesign, migration, refactoring, or decomposition.
- **Reimagine and Build:** enhance, replace, or rebuild an application as a cloud-native and agentic-ready system, including cases where source code is unavailable.

### Repository implication

“Transform” and “Reimagine” should be first-class catalog facets and browsing paths. They are customer intents, not implementation technologies.

The repository must also avoid equating RAMP with AI-DLC. RAMP is the engagement and scale model; AI-DLC is a development workflow used inside it.

## 2. RAMP engagement lifecycle

### Direct source evidence

Slide 2 defines four RAMP phases:

| RAMP phase | Outcome | Indicative duration | Repository-relevant assets |
|---|---|---:|---|
| 1. Deliver MVP as Proof of Value | Modernise 1–3 high-impact workloads and prove materially faster delivery | 2–3 weeks, including a three-day AI-DLC workshop | Qualification, workload selection, workshop playbook, blueprint, evidence capture, deployment and validation |
| 2. Production and Executive Readout | Drive the MVP to production and quantify business outcomes | 4–8 weeks | Production hardening, operational readiness, KPI capture, outcome report, executive-readout template |
| 3. Build Org-Wide Modernisation Wave Plan | Assess the estate and create an executable portfolio roadmap | Not fixed | Assessment adapters, context-engineering artifacts, dependency maps, wave-planning model, per-workload blueprint recommendations |
| 4. Org-Wide Scale via Platform Modernisation and Change Management | Make modernisation repeatable across teams and the estate | Continuous | Platform patterns, paved roads, governance, enablement, certification, operating model, Day-2 automation |

The DOCX reinforces this progression: RAMP is successful when a single-workload proof of value creates confidence and sponsorship for a larger modernisation programme.

### Repository implication

Each user-facing blueprint should declare:

- the RAMP phases it supports;
- entry and exit criteria;
- required inputs;
- deliverables and evidence;
- expected production and business outcomes;
- what becomes reusable after the engagement.

The repository also needs program assets outside the technical blueprints. Phase 2 executive-readout and Phase 3 wave-planning artifacts are not ordinary application templates, but they are central RAMP deliverables.

### Terminology guardrail

The sources and current technical material both use “phase” for different concepts. The revamp should reserve:

- **RAMP Phase 1–4** for the customer engagement lifecycle;
- **AI-DLC stage** for development-workflow progression;
- **blueprint step** for scenario-specific activities;
- **delivery wave** for parallel or sequenced implementation units.

This naming boundary will prevent material confusion in workshops and generated artifacts.

## 3. First four slides: visual narrative

### Slide 1 — category and ambition

The cover establishes RAMP as a named programme, with the subtitle “From MVP to Modernization-at-scale.” Visually, it is programme-level and executive-facing, not a developer-tool catalogue.

**Repository implication:** the landing page should begin with the scale journey and outcomes, then show how to select a blueprint. It should not begin with filesystem instructions or a technology list.

### Slide 2 — engagement lifecycle and two ways to modernise

The slide deliberately combines three ideas:

1. an outcome statement: organisation-wide modernisation at higher speed;
2. two entry motions: Transform from Legacy and Reimagine and Build;
3. a four-phase lifecycle from MVP to organisational scale.

**Repository implication:** the catalog should let a user start from intent and RAMP phase. Technology is a later filter.

### Slide 3 — technical pillars for organisation-wide modernisation

The visual places modernisation inside a larger value stream:

`Portfolio planning → requirements → architecture → development → testing → deployment → security → approval → Day 2`

It then separates the enabling technical layers:

- portfolio assessment and roadmap;
- AI-DLC blueprints;
- integrated developer platform / thinnest viable platform;
- reusable application and data-service patterns;
- autonomous QA;
- golden infrastructure templates;
- autonomous vulnerability remediation;
- common workload patterns;
- AWS runtime environment patterns;
- developer experience, security, CI/CD, observability, cost, and capacity;
- AIOps and continuous modernisation for Day 2.

**Repository implication:** cross-cutting capabilities are not peer use cases. They are composable building blocks and engineering loops consumed by many blueprints.

The speaker notes add an important operating principle: an AI-productive application organisation needs an equally productive platform organisation. The repository therefore needs an explicit platform-foundation layer rather than treating CI/CD, guardrails, observability, and operations as optional footnotes inside every pack.

### Slide 4 — modernisation-to-agentic flywheel

The flywheel is:

`Modernise → Agentise → Prove ROI → Expand`

Customers may enter with a modernisation need or an AI ambition. Modernisation creates accessible APIs, events, and data for agents; agent workflow discovery exposes legacy data and system gaps; those gaps become future RAMP waves.

**Repository implication:** “agentic readiness” should be an outcome and assessment dimension across modernisation blueprints, not only a standalone GenAI category.

The repository should support two-way discovery:

- from a legacy workload to agentic-ready modernisation;
- from an agentic use case to prerequisite application and data modernisation.

## 4. Strategic outcomes the repository must support

### Direct source evidence

The DOCX describes success in business and delivery terms:

- substantially compressed modernisation timelines;
- executive confidence and sponsorship;
- progression from initial workload to portfolio modernisation;
- production deployment, rather than demonstration-only output;
- repeatable practices that enable Partners and local champions;
- improved transition from assessment to immediate modernisation action;
- day-two operations and platform engineering introduced early;
- reusable patterns created project by project.

The scaling strategy depends on Partners and AWS champions progressing through:

`Shadow → Reverse-shadow → Independent delivery`

The identified scaling constraints include limited specialist capacity, uneven Partner coverage, missing localised collateral, and assessment outputs that are too high-level to trigger immediate action.

### Repository implication

The repository should optimize for **independent, repeatable delivery**, not merely content reuse. A blueprint needs:

- audience and prerequisite skills;
- facilitator and participant roles;
- qualification checklist;
- input-evidence contract;
- timeboxed workshop path;
- explicit human decision gates;
- expected artifacts;
- production-readiness checks;
- measurable proof-of-value criteria;
- executive-readout inputs;
- extension path to portfolio waves;
- facilitator notes and troubleshooting;
- maturity and certification status.

This also implies a product-quality bar. “A folder with prompts” is not enough for Partner or champion certification.

## 5. Portfolio assessment and context engineering

### Direct source evidence

The DOCX proposes a unified assessment framework that combines outputs from assessment tools into actionable context-engineering artifacts, including:

- detailed codebase maps;
- dependency graphs;
- transformation specifications;
- portfolio modernisation wave plans;
- a recommended AI-DLC starter pack per workload;
- agents for repetitive workflows;
- organisation-wide practices such as platform engineering and observability that can proceed in parallel.

The stated problem is not absence of assessment tools; it is the gap between high-level assessment output and an immediately executable next step.

### Repository implication

The catalog requires machine-readable metadata so a portfolio process can recommend blueprints. At minimum, each blueprint should declare:

- accepted evidence and source types;
- workload and architecture patterns;
- source and target technologies;
- modernisation motion;
- complexity and risk signals;
- dependencies and prerequisites;
- RAMP phase coverage;
- output artifacts;
- suitable engineering loops and platform foundations;
- maturity and confidence.

The repository should define a stable “assessment-to-blueprint” interface rather than embedding bespoke assessment interpretation into each pack.

## 6. Recommended conceptual model derived from RAMP

This is an inference from the source material, not wording taken directly from it.

| Concept | Purpose | Examples from the source |
|---|---|---|
| **Program playbook** | Governs the engagement and scale journey | RAMP phases, executive readout, Partner/champion enablement |
| **Modernisation blueprint** | Produces a defined customer outcome | Transform legacy, rewrite COTS, framework upgrade |
| **Solution blueprint** | Builds or reimagines a business capability | Document processing, voice agent, agentic workflow |
| **Workload pattern** | Provides reusable architecture for a technical shape | Synchronous API, asynchronous jobs, batch, event-driven |
| **Engineering loop** | Automates recurring SDLC/SecOps/Ops work | QA, vulnerability remediation, continuous modernisation |
| **Platform foundation** | Makes delivery repeatable and production-ready | IaC templates, CI/CD, guardrails, observability, cost controls |
| **Capability component** | Reusable composable implementation knowledge or tooling | Skill, agent, MCP server, instruction module, template |
| **Evidence adapter** | Normalises input from assessment or delivery tools | Code analysis, dependency graph, portfolio assessment |

“Cross-cutting” should be represented by reusable components and metadata relationships. It should not become a miscellaneous folder.

## 7. Audiences the repository must serve

### Direct source evidence

The source material explicitly or implicitly addresses:

- customer executives and engineering leaders;
- application, data, platform, security, QA, and operations teams;
- AWS specialists and local RAMP champions;
- consulting Partners;
- portfolio managers and business analysts;
- architects and developers.

### Repository implication

The repository needs distinct navigation and artifacts for:

- **Choose:** executive, account team, programme lead, portfolio lead;
- **Scope:** architect, SA, facilitator;
- **Deliver:** engineer, QA, security, platform, operations;
- **Scale:** platform team, Partner lead, champion, transformation office;
- **Govern:** maintainer and blueprint reviewer.

A single highly technical README cannot serve all five jobs.

## 8. Suggested RAMP principles for the revamp

These principles are inferred from the reviewed sources:

1. **Outcome before technology.** Browse first by modernisation intent and required outcome.
2. **MVP is an entry point, not the destination.** Every blueprint should expose the path to production and scale.
3. **Production and Day 2 are part of the blueprint.** CI/CD, observability, security, cost, resilience, and operations cannot be deferred indefinitely.
4. **Patterns compound.** Each engagement should improve reusable patterns and golden paths.
5. **Assessment must end in action.** Evidence should resolve to recommended blueprints, dependencies, and waves.
6. **Human decisions remain explicit.** Agentic speed does not remove governance or executive accountability.
7. **Agentic readiness is cross-cutting.** Modern APIs, events, and accessible data prepare the estate for agents.
8. **Scale requires teachability.** A qualified Partner or champion should be able to deliver from repository artifacts without relying on undocumented specialist knowledge.
9. **Prove value with evidence.** Technical validation, delivery acceleration, business outcomes, and production status should be captured consistently.
10. **Keep the program, workflow, blueprint, and component layers distinct.** Their lifecycles and owners differ.

## 9. Source-backed acceptance test for the future repository

The revamp embodies RAMP when a new champion or Partner can:

1. understand the RAMP lifecycle and two modernisation motions from the landing page;
2. qualify a workload and select a suitable blueprint without knowing the internal folder layout;
3. execute a decision-gated AI-DLC workflow with appropriate reusable capabilities;
4. produce a deployed and validated proof of value;
5. harden it toward production and prepare an evidence-backed executive readout;
6. map follow-on dependencies into a portfolio wave plan;
7. add platform foundations and Day-2 engineering loops;
8. feed delivery learning back into the catalog as a governed reusable pattern.

If the repository only helps with step 3, it represents AI-DLC starter content but not RAMP.

## 10. Points requiring owner validation

- Whether this public/sample repository should include Phase 2–4 program assets directly, or link to a separate internal RAMP delivery kit.
- Whether Partner/champion enablement and certification content can be published or must remain internal.
- Which outcome and acceleration metrics can be encoded as public blueprint acceptance criteria.
- Which assessment-tool adapters can be open sourced.
- Whether AgentStorming integration belongs in this repository or through a documented interface to a separate catalog.
- Whether “Modernisation” or “Modernization” is the canonical external spelling; the reviewed sources use both.
