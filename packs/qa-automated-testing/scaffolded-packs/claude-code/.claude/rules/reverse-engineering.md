# Reverse Engineering

**Purpose**: Analyze an existing codebase and generate comprehensive design
artifacts that inform downstream modernization, feature, or migration work.

**Execute when**: Brownfield project detected (existing source code found in
the workspace).

**Skip when**: Greenfield project (no existing source code).

**Rerun behavior**: Always rerun when the brownfield codebase has changed
materially. Stale analysis is worse than no analysis.

## Step 1: Workspace Discovery

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

## Step 10: Existing Test Inventory

The codebase being analyzed is the **subject of a QA automation effort** — so the
*existing tests* are first-class signal, not a footnote. Inventory what test
automation already exists before any new test design, so the downstream work can
build on, replace, or migrate it deliberately rather than duplicating or ignoring
it. Skip only if a scan confirms there are genuinely no tests (and say so).

Create `aidlc-docs/analysis/existing-test-inventory.md`:

```markdown
# Existing Test Inventory

## Test Suites Found
### [Suite / package name]
- **Location**: [path]
- **Type**: [Unit / Integration / Contract / E2E / Visual / Accessibility / Load / Other]
- **Framework + version**: [e.g. Cypress 9.7 (outdated), JUnit 5, Playwright 1.4x, Appium 2.x]
- **Language**: [language + binding]
- **Count**: [approx number of tests / specs]
- **What it covers**: [features / journeys / modules under test]
- **Health**: [Passing / Some failing / Unknown — not runnable in analysis env]

## Coverage Signal
- **Overall**: [Percentage if a coverage report exists, else Good / Fair / Poor / None]
- **By layer**: [Unit / Integration / E2E — which exist, rough strength]
- **Notable gaps**: [Critical journeys or modules with NO automated coverage]

## CI Test Gates
- **Do tests run in CI?**: [Yes / No / Partially]
- **Where**: [GitHub Actions / GitLab CI / Jenkins / other — workflow file path]
- **Gating**: [Required to merge / advisory only / not wired]
- **Parallelization**: [Sharding, matrix, device cloud — or none]
- **Reporting**: [HTML report / dashboard / none]

## Test Data Approach
- **Provisioning**: [API seeding / DB fixtures / UI setup / hardcoded / unclear]
- **Isolation**: [Per-test / shared fixtures / order-dependent]
- **Environment**: [Dedicated test env / shared staging / local only]

## Reliability Signals
- **Known flaky tests / quarantined / skipped**: [List with locations if visible —
  look for `.skip`, `.only`, `@flaky`, `@Disabled`, `xit`, retry config]
- **Hard sleeps / timing hacks**: [Presence of `sleep`, `waitForTimeout`, `Thread.sleep`]
- **Selector fragility**: [CSS/XPath tied to structure vs role/test-id]

## Migration / Survivability (if an upgrade or framework migration is planned)
- **Tests likely to survive**: [Behaviour / contract / E2E tests decoupled from framework internals]
- **Tests likely to break**: [Framework-coupled component/internal tests — e.g. Angular TestBed,
  RTL internals — that a planned migration would invalidate]
- **Recommendation**: [Reuse as-is / harden / migrate / replace / drop]

## Summary
- **Total existing automated tests**: [Number]
- **Overall maturity**: [None / Nascent / Partial / Mature]
- **Biggest opportunity**: [Where new automation adds the most value given what exists]
```

## Step 11: Bounded Context Analysis

Identify natural service boundaries in the codebase. Critical input for any
decomposition, modernization, or feature-slice planning that follows.

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

## Step 12: Modernization Readiness Assessment

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

## Step 13: Create Timestamp File

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
- [x] existing-test-inventory.md
- [x] bounded-contexts.md
- [x] modernization-readiness.md
```

## Step 14: Update State Tracking

Update `aidlc-docs/aidlc-state.md`:

```markdown
## Reverse Engineering Status
- [x] Reverse Engineering — Completed on [timestamp]
- **Artifacts Location**: aidlc-docs/analysis/
```

## Step 15: Present Completion Message to User

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

## Step 16: Wait for User Approval

- **MANDATORY**: Do not proceed until the user explicitly approves
- **MANDATORY**: Log the user's response verbatim in `aidlc-docs/audit.md`
