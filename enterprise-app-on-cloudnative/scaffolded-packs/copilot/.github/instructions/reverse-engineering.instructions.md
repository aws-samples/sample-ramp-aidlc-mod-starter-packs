---
description: Phase 0 Reverse Engineering / Input Analysis playbook — use when existing source code is present, or when the user provides functional/design documents (FSDs, platform exports such as OutSystems), or when modernizing, migrating, extending, or reverse-engineering an existing system.
---
# Reverse Engineering

**Purpose**: Analyze an existing system — from **source code**, from
**functional/design documents (FSDs)**, or both — and generate comprehensive
analysis artifacts that inform downstream modernization, feature, or migration
work.

**Execute when**: An existing system is in scope and evidence is available —
i.e. existing **source code** is present in the workspace, **and/or** the user
provides **functional specification documents, design docs, or platform
exports** (e.g. an OutSystems application described by FSDs rather than
buildable source).

**Skip when**: Pure greenfield — no existing source **and** no descriptive
documents about a prior system.

**Rerun behavior**: Always rerun when the inputs change materially (code
updated, or new/revised FSDs supplied). Stale analysis is worse than no
analysis.

## Inputs and Evidence

This playbook works from whatever evidence exists. Detect the **input mode**
first and adapt every step accordingly.

- **Code mode** — buildable source is in the workspace. Run all steps against
  the code (the traditional path).
- **Document mode** — no buildable source, but the user supplies **FSDs** and
  context: functional specification documents, business/process descriptions,
  screen flows and wireframes, data dictionaries / ER diagrams, integration or
  API specs, and platform exports (e.g. **OutSystems** module/entity exports,
  screenshots, or a solution description). Derive the analysis from these
  documents plus any narrative context the user gives.
- **Hybrid mode** — both source and documents are present. Prefer **current
  source/runtime evidence** when a document and the code disagree, and note the
  discrepancy.

> **OutSystems / low-code example.** For an OutSystems app you often receive
> FSDs, entity/module exports, and screen descriptions rather than a normal
> source tree. Treat those as the corpus: derive the business overview, the
> data model (from entities/aggregates), the process/screen inventory (as the
> "API/interaction" surface), and the bounded contexts from the documents. Do
> not fabricate a code structure that was never provided.

**Evidence tagging (mandatory).** In every generated artifact, tag each
non-trivial fact with its source: `Evidence: Code (<path>)`,
`Evidence: Doc (<file/section>)`, or `Evidence: Assumption`. Maintain an
explicit **Assumptions & Open Questions** list per artifact so document-derived
inferences (which drift from reality) are visible and can be confirmed with the
user.

**Adaptive steps.** When a step below depends on artifacts that only exist in
code (build system, code structure, dependency graphs, test coverage) and the
input is Document mode, mark that section **"N/A — no source provided"** and,
where the documents imply the information (e.g. an FSD naming an integration),
capture it as a document-sourced fact instead.

## Step 1: Workspace & Input Discovery

### 1.0 Inventory the Provided Inputs
- List every input in scope: source packages/modules **and** each supplied
  document (FSD, export, diagram, spec) with a one-line description.
- Record the **input mode** (Code / Document / Hybrid) and a coverage/confidence
  note (what the inputs do and do not cover).

### 1.1 Scan the Workspace
- All packages and modules (not just the ones the user mentioned)
- Package relationships via configuration files
- Package types: Application, Infrastructure, Models, Clients, Tests, Front-end, Back-end, Workers, Libraries

### 1.2 Understand the Business Context
- The core business the system serves overall
- The business purpose of every package or module
- The list of business transactions the system implements

### 1.3 Infrastructure Discovery
- IaC: CDK, Terraform, CloudFormation, Pulumi, Ansible, Docker Compose, Helm
- Deployment scripts (shell, Make, language-specific tooling)
- Runtime hosting (EC2, ECS, EKS, Lambda, on-prem servers, Kubernetes, Docker)

### 1.4 Build System Discovery
- Build systems: Maven, Gradle, npm, yarn, pnpm, Composer, pip/Poetry, Go modules, Cargo, Bazel, Brazil
- Configuration files declaring builds and dependencies
- Build dependencies between packages

### 1.5 Service & Component Discovery
- API definitions (OpenAPI, Smithy, GraphQL schema, gRPC proto, route files)
- Worker / job definitions (queues, schedulers, background processors)
- Function / handler definitions (Lambda handlers, controllers, services)
- Data stores (relational DBs, document DBs, key-value, object storage, caches, search/vector indexes)
- Front-end applications and their build/runtime configuration

### 1.6 Code Quality Analysis
- Programming languages and framework versions
- Test frameworks and observed coverage
- Linting, formatting, static analysis configurations
- CI/CD pipeline definitions and what gates exist today

## Step 2: Generate Business Overview Documentation

Create `aidlc-docs/analysis/business-overview.md`:

```markdown
# Business Overview

## Business Context Diagram
[Mermaid diagram showing the business context — actors, system, external systems]

## Business Description
- **Business Description**: [Overall description of what the system does in business terms]
- **Business Transactions**: [List of business transactions the system implements with descriptions]
- **Business Dictionary**: [Domain terms the system uses and their meaning]

## Component-Level Business Descriptions
### [Package / Module / Component Name]
- **Purpose**: [What it does from the business perspective]
- **Responsibilities**: [Key responsibilities]
```

## Step 3: Generate Architecture Documentation

Create `aidlc-docs/analysis/architecture.md`:

```markdown
# System Architecture

## System Overview
[High-level description of the system]

## Architecture Diagram
[Mermaid diagram showing all packages, services, data stores, and their relationships]

## Component Descriptions
### [Component Name]
- **Purpose**: [What it does]
- **Responsibilities**: [Key responsibilities]
- **Dependencies**: [What it depends on]
- **Type**: [Application / Infrastructure / Model / Client / Test / Front-end / Worker]

## Data Flow
[Mermaid sequence diagram of key workflows]

## Integration Points
- **External APIs**: [List with purposes]
- **Databases**: [List with purposes]
- **Third-party Services**: [List with purposes]

## Infrastructure Components
- **Deployment Model**: [Description of how the system is deployed today]
- **Networking**: [VPC, subnets, security groups, public/private boundaries]
- **Observability**: [Logging, metrics, tracing solutions in place — or absence of]
```

## Step 4: Generate Code Structure Documentation

> **Document mode:** if no source was provided, mark this artifact
> **"N/A — no source provided"** and rely on the business, architecture, data,
> and bounded-context artifacts derived from the FSDs instead.

Create `aidlc-docs/analysis/code-structure.md`:

```markdown
# Code Structure

## Build System
- **Type**: [Maven / Gradle / npm / Composer / Poetry / etc.]
- **Configuration**: [Key build files and settings]

## Key Modules / Classes
[Mermaid class diagram or module hierarchy]

### Existing Files Inventory
[List meaningful source files with their purposes]

**Format example**:
- `[path/to/file]` — [Purpose / responsibility]

## Design Patterns
### [Pattern Name]
- **Location**: [Where used]
- **Purpose**: [Why used]
- **Implementation**: [How implemented]

## Critical Dependencies
### [Dependency Name]
- **Version**: [Version number]
- **Usage**: [How and where used]
- **Purpose**: [Why needed]
```

## Step 5: Generate API Documentation

> **Document mode:** when there is no code to read endpoints from, capture the
> **interaction surface the FSDs describe** — screens/pages, actions, exposed
> service actions, integrations, and scheduled processes — using the same
> fields where they apply, and tag each as `Evidence: Doc`. For OutSystems,
> service actions and exposed REST/SOAP endpoints named in the FSDs are the API
> surface.
>
> When **screenshots or wireframes** are provided, also record a **UI/screen
> catalog**: one entry per screen with its purpose and the exact source file it
> came from (e.g. `Evidence: Doc (screens/checkout.png)`). This catalog is the
> reference the UI-fidelity decision (Phase 1) points at and that Design and
> Tasks trace back to when the choice is to adhere.

Create `aidlc-docs/analysis/api-documentation.md`:

```markdown
# API Documentation

## Endpoints

### [Controller / Route Group Name]

#### [Endpoint Name]
- **Method**: [GET / POST / PUT / DELETE / etc.]
- **Path**: [/api/path]
- **Purpose**: [What it does]
- **Handler**: [Class / function and method signature]
- **Auth**: [Auth mechanism required]
- **Request Body**: [JSON / form structure with field types, or "none"]
- **Response Body**: [JSON structure with field types]
- **Success Status**: [HTTP status code]
- **Error Responses**: [Status codes and conditions]
- **Side Effects**: [DB writes, queue publishes, third-party calls]
- **Dependencies**: [Service classes / functions invoked]

## API Contract Summary Table

| Method | Path | Request Body | Response Body | Success | Error Codes |
|--------|------|--------------|---------------|---------|-------------|

## Data Models

### [Model Name]
- **Storage**: [Database table / collection / index name]
- **Fields**: [field name] — [type] — [storage column / attribute name] — [required / optional]
- **Relationships**: [Related models]
```

## Step 6: Generate Component Inventory

Create `aidlc-docs/analysis/component-inventory.md`:

```markdown
# Component Inventory

## Application Packages
- [Package name] — [Purpose]

## Infrastructure Packages
- [Package name] — [CDK / Terraform / CloudFormation / other] — [Purpose]

## Shared Packages
- [Package name] — [Models / Utilities / Clients] — [Purpose]

## Test Packages
- [Package name] — [Integration / Load / Unit] — [Purpose]

## Total Count
- **Total Packages**: [Number]
- **Application**: [Number]
- **Infrastructure**: [Number]
- **Shared**: [Number]
- **Test**: [Number]
```

## Step 7: Generate Technology Stack Documentation

Create `aidlc-docs/analysis/technology-stack.md`:

```markdown
# Technology Stack

## Languages & Frameworks
- [Language version] + [Framework version]

## Data Layer
- [Database type and version, extensions, schemas]
- [Caches]
- [Search / vector indexes]

## Infrastructure & Cloud Services
- [Cloud provider services in use, with role of each]

## Front-end (if any)
- [Framework, build tool, UI library]

## DevOps
- [VCS, CI/CD, IaC, monitoring, secrets management]

## Test Tooling
- [Frameworks for unit, integration, end-to-end]
- [Observed automated test coverage if reported]
```

## Step 8: Generate Dependencies Documentation

> **Document mode:** derive dependencies from the FSDs where stated (named
> integrations, external systems, shared modules); mark build-derived internal
> dependency graphs **"N/A — no source provided"** and tag document-sourced
> integrations as `Evidence: Doc`.

Create `aidlc-docs/analysis/dependencies.md`:

```markdown
# Dependencies

## Internal Dependencies
[Mermaid diagram showing package / module dependencies]

### [Package A] depends on [Package B]
- **Type**: [Compile / Runtime / Test]
- **Reason**: [Why the dependency exists]

## External Dependencies
### [Dependency Name]
- **Version**: [Version]
- **Purpose**: [Why used]
- **Risk / Migration concern**: [Notes]

## Cross-Cutting Concerns
- Authentication library / pattern
- Authorization library / pattern
- Logging
- Error handling
- Observability instrumentation (or absence)
- Configuration / secrets management
```

## Step 9: Generate Code Quality Assessment

> **Document mode:** mark this artifact **"N/A — no source provided"**. If the
> FSDs describe known pain points, tech debt, or quality concerns, capture them
> as document-sourced observations instead.

Create `aidlc-docs/analysis/code-quality-assessment.md`:

```markdown
# Code Quality Assessment

## Test Coverage
- **Overall**: [Percentage or Good / Fair / Poor / None]
- **Unit Tests**: [Status]
- **Integration Tests**: [Status]
- **End-to-End Tests**: [Status]

## Code Quality Indicators
- **Linting**: [Configured / Not configured]
- **Code Style**: [Consistent / Inconsistent]
- **Static Analysis**: [In place / absent]
- **Documentation**: [Good / Fair / Poor]

## Technical Debt
- [Issue description and location]

## Patterns and Anti-patterns
- **Good Patterns**: [List]
- **Anti-patterns**: [List with locations]
```

## Step 10: Bounded Context Analysis

Identify natural service boundaries from the evidence. In **Code mode** derive
them from packages, routes, services, and storage; in **Document mode** derive
them from the business capabilities, entities, and processes the FSDs describe.
This is critical input for any decomposition or modernization that follows, and
it is the **primary seed for Phase 2 (Domain Model & Bounded Contexts)** — the
domain phase refines and confirms these boundaries with the user.

Create `aidlc-docs/analysis/bounded-contexts.md`:

```markdown
# Bounded Context Analysis

## Identified Bounded Contexts

### [Context Name]
- **Business Capability**: [What business function this context serves]
- **Controllers / Routes**: [Which entry points belong here]
- **Services / Application Logic**: [Which service classes belong here]
- **Repositories / Data Access**: [Which data access components belong here]
- **Models / Entities**: [Which domain models belong here]
- **Storage**: [Which tables / collections / buckets / indexes this context owns]
- **Events**: [Which domain events / queue messages / topics belong here]

## Context Map
[Mermaid diagram showing bounded contexts and their relationships]

## Shared Kernel
- **Shared Models**: [Models used across multiple contexts]
- **Shared Utilities**: [Config, security, common infrastructure]
- **Shared Storage**: [Tables / data accessed by multiple contexts]

## Cross-Context Dependencies
### [Context A] → [Context B]
- **Type**: [Data dependency / API call / Shared storage / Event]
- **Direction**: [Upstream / Downstream / Bidirectional]
- **Coupling Level**: [High / Medium / Low]
- **Description**: [How they interact]
```

## Step 11: Modernization Readiness Assessment

Create `aidlc-docs/analysis/modernization-readiness.md`:

```markdown
# Modernization Readiness

## Coupling Matrix
| Component | Afferent (incoming) | Efferent (outgoing) | Coupling Score |
|-----------|---------------------|---------------------|----------------|
| [class / module / package] | [count] | [count] | [High / Med / Low] |

## Data Coupling Analysis
- **Shared Storage Across Contexts**: [Tables / indexes accessed by multiple bounded contexts]
- **Foreign Key / Reference Dependencies**: [Cross-context relationships]
- **Transaction Boundaries**: [Operations spanning multiple contexts]
- **Data Ownership Conflicts**: [Storage with unclear ownership]

## Statelessness Audit
- Endpoints relying on server-side session
- State cached in process memory
- File system writes outside request scope
- Other implicit shared state

## Modernization Difficulty per Bounded Context

### [Context Name]
- **Modernization Difficulty**: [Easy / Medium / Hard]
- **Rationale**: [Why this rating]
- **Blockers**: [What makes it hard — shared state, transactions, third-party SDKs, regulatory constraints]
- **Recommended Order**: [1st, 2nd, 3rd, etc. with rationale]

## Migration / Cutover Readiness
- **Routing Feasibility**: [Can traffic be redirected per endpoint or per context?]
- **Stateless Endpoints**: [Which endpoints are stateless and easy to redirect?]
- **Session / State Dependencies**: [Anything that complicates routing]
- **Auth Migration Complexity**: [How hard is it to decouple auth from the monolith?]

## Risk Assessment
- **Storage Decomposition Risk**: [Shared schema complexity]
- **Data Consistency Risk**: [Cross-context transactions]
- **Auth / Security Risk**: [Centralized security coupling]
- **Third-Party / SDK Risk**: [Vendor SDKs, deprecated APIs, version constraints]
- **Compliance Risk**: [Regulatory or contractual constraints affecting modernization]
```

## Step 12: Create Timestamp File

Create `aidlc-docs/analysis/reverse-engineering-timestamp.md`:

```markdown
# Reverse Engineering Metadata

**Analysis Date**: [ISO timestamp]
**Analyzer**: AI-DLC
**Workspace**: [Workspace path]
**Total Files Analyzed**: [Number]

## Artifacts Generated
- [x] business-overview.md
- [x] architecture.md
- [x] code-structure.md
- [x] api-documentation.md
- [x] component-inventory.md
- [x] technology-stack.md
- [x] dependencies.md
- [x] code-quality-assessment.md
- [x] bounded-contexts.md
- [x] modernization-readiness.md
```

## Step 13: Update State Tracking

Update `aidlc-docs/aidlc-state.md`:

```markdown
## Reverse Engineering Status
- [x] Reverse Engineering — Completed on [timestamp]
- **Artifacts Location**: aidlc-docs/analysis/
```

## Step 14: Present Completion Message to User

```markdown
# 🔍 Reverse Engineering Complete

[AI-generated summary of key findings — bounded contexts identified, coupling hotspots, recommended modernization order, major risks]

> **📋 REVIEW REQUIRED**
> Please examine the reverse engineering artifacts at: `aidlc-docs/analysis/`

> **🚀 WHAT'S NEXT?**
>
> 🔧 **Request Changes** — ask for modifications to the analysis
> ✅ **Approve & Continue** — proceed to **Phase 1: Requirements**
```

## Step 15: Wait for User Approval

- **MANDATORY**: Do not proceed until the user explicitly approves
- **MANDATORY**: Log the user's response verbatim in `aidlc-docs/audit.md`
