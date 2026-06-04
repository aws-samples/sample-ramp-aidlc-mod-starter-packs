---
inclusion: always
---

# Decision-Driven Document Generation

## Core Principles

### 🚨 MANDATORY DECISION FILE FIRST
Before creating ANY spec document (requirements.md, design.md, tasks.md), you MUST:

1. **Create decision file first**: `_decisions-requirements.md`, `_decisions-design.md`, or `_decisions-tasks.md`
2. **Wait for user input**: Get explicit user decisions before proceeding
3. **Read completed decisions**: Use user choices to generate final document

**🔒 ABSOLUTE RULE**: NEVER generate requirements.md, design.md, or tasks.md without first creating and completing the corresponding _decisions-*.md file

**Exception**: Skip decision file ONLY if user explicitly says "skip the decision file" or "no decisions needed"

### 🌐 LANGUAGE MATCHING
Generate decision files in the same language as user's input prompt:
- Spanish input → Spanish decision file
- French input → French decision file  
- Japanese input → Japanese decision file
- Default to English only if language cannot be determined

### 💬 NATURAL MESSAGING
**NEVER say**: 
- "According to the rules..." or "The rules require..."
- "According to the workflow, I will create..."
- "Following the process, I need to..."
- "The steering file indicates..."
- "Per the guidelines..."

**DO say**:
- "To ensure we build exactly what you need, let's clarify some key decisions..."
- "For the most accurate requirements, I'd like to understand your preferences first..."
- "To create high-quality design that matches your vision, let's align on strategic decisions..."
- "Before diving into the implementation plan, let's make some strategic decisions..."
- "I'll create a quick decision file to capture your preferences..."

Focus on: accuracy, effectiveness, quality, alignment, clarity

**Seamless Integration**: Present decision files as a natural part of the spec creation process, not as a separate procedural step.

### 🔒 DECISION ISOLATION
Each decision file is independent:
- Requirements decisions apply ONLY to `_decisions-requirements.md`
- Design decisions apply ONLY to `_decisions-design.md`  
- Tasks decisions apply ONLY to `_decisions-tasks.md`
- **NEVER carry over** user preferences between phases
- Each phase requires NEW explicit user input

## Workflow Steps

1. **Generate** decision file with Kiro recommendations
2. **Wait** for user to review and provide decisions  
3. **Confirm** all critical decisions have user input
4. **Read** completed decision file
5. **Generate** final document based on user choices

**Phase Order**: Requirements → Design → Tasks (each phase references previous decisions)

**⚠️ ENFORCEMENT**: If you find yourself about to create requirements.md, design.md, or tasks.md, STOP and ask: "Have I created and completed the _decisions-*.md file first?" If no, create the decision file immediately.

**Natural Approach**: Present decision gathering as a collaborative planning step, not a procedural requirement. Make it feel like a natural part of creating high-quality specifications.

## Decision File Format

**Location**: Same directory as target documents (in spec folder)

**Template Structure**:
```markdown
# Decisions: [Phase Name]

> **Instructions:** Review each decision point below. Kiro recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## [Decision Category]

### [Specific Decision Point]

**Question:** [Clear question to be answered]

**Options:**
1. [Option 1 - Kiro Recommended]: [Description with rationale]
2. [Option 2]: [Description]  
3. [Option 3]: [Description]
4. Other (please specify): _______________________

**Answer:** 

---
```

**Important**: This is a template structure only. Create decision categories and questions that are specific and relevant to the actual project being planned. Avoid generic or irrelevant decision points.

## Phase-Specific Content

### Requirements Phase (`_decisions-requirements.md`)
**Focus**: WHAT to build (business requirements)

**Include**:
- Scope decisions (features to include/exclude)
- Non-functional requirements (performance, security, scalability)
- User personas and use cases
- Constraints (timeline, budget, team, existing systems)
- Business rules (validation, access control, data retention)

**Exclude** (save for Design phase):
- Technology choices
- Architecture decisions  
- Implementation approaches
- Specific tools/libraries

### Design Phase (`_decisions-design.md`)
**Focus**: HOW to build it (technical approach)

**Include**:
- Correctness properties strategy (property-based testing approach)
- Technical approach (technologies, frameworks, patterns)
- Architecture decisions (monolithic vs microservices, databases, APIs)
- Dependencies and integrations
- Design patterns
- Data models and relationships
- API contracts

**Reference**: Previous `_decisions-requirements.md` for alignment

### Tasks Phase (`_decisions-tasks.md`)
**Focus**: Implementation order and execution strategy

**Include**:
- Implementation strategy (feature-based vs layer-based)
- Task prioritization (which components first)
- Development phases (milestones/sprints)
- Testing strategy (unit, integration, E2E tests)
- Deployment approach (CI/CD, environments)

**Reference**: Previous `_decisions-design.md` for alignment

**Key Decision Categories**:
1. **Implementation Strategy**: How to organize development work
2. **Task Prioritization**: Which components to build first and why
3. **Development Phases**: Sprint/milestone breakdown
4. **Testing Approach**: When and how to test each component
5. **Deployment Strategy**: How to release and deploy changes

## Implementation Guidelines

### Decision File Generation
**Requirements**:
- Explain WHY each decision matters and its project impact
- Provide 3-4 concrete options per decision point
- Mark one option as "Kiro Recommended" with rationale
- For design/tasks phases: reference previous phase decisions
- **Customize decision points** to match the specific project domain and context
- **Avoid generic decisions** - make each decision relevant to the actual project needs

### User Input Handling
**Process**:
- Present decision files as a natural part of creating high-quality specs
- Ask user to review and fill in decisions without referencing "rules" or "processes"
- Handle partial responses: acknowledge completed items, prompt for remaining
- If no response: ask if user wants Kiro recommendations as defaults
- Validate all critical decisions have user input (not just Kiro recommendations)
- Get explicit confirmation before proceeding

**Natural Language Examples**:
- "I've prepared some key decisions to ensure we build exactly what you need"
- "Once you've filled in your preferences, I'll generate the [requirements/design/tasks] document"
- "Let me know your thoughts on these strategic choices"

### Document Generation
**Based on user choices**:
- Read completed decision file
- Generate final document (requirements.md, design.md, tasks.md)

**For Design Documents**:
- Check correctness properties decision
- "Skip correctness properties" → Do NOT use prework tool, skip Correctness Properties section
- "Essential properties only" → Lightweight prework analysis, 3-5 key properties maximum
- "Comprehensive properties" → Full prework analysis process

### File Management
**Lifecycle**:
- Keep decision files alongside generated documents for reference
- Decision files record why choices were made
- For updates: modify decision file first, then regenerate documents
- Maintain consistency across all decision files

**Dependencies**:
- Design decisions reference requirements decisions
- Tasks decisions reference design decisions
- Review previous decision files when generating new phases

## Examples: Completed Decision Files

**Note**: These are sample examples only. Actual decision files should be tailored to the specific project context, requirements, and domain. Use these as templates for structure and format, but create decision points that are relevant to your particular project.

### Requirements Example

```markdown
# Decisions: Requirements

> **Instructions:** Review each decision point below. Kiro recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## Scope Decisions

### Core Features

**Question:** Which features should be included in the MVP?

**Options:**
1. User authentication + basic CRUD operations (Kiro Recommended - fastest path to value)
2. Full feature set including analytics and reporting  
3. Authentication only, defer CRUD to phase 2
4. Other (please specify): _______________________

**Answer:** Option 1 - We need both auth and CRUD for MVP

---

## Non-Functional Requirements

### Performance Target

**Question:** What response time is acceptable for API calls?

**Options:**
1. < 200ms for 95th percentile (Kiro Recommended - industry standard)
2. < 500ms for 95th percentile
3. < 100ms for 95th percentile  
4. Other (please specify): _______________________

**Answer:** Other: < 1000ms is acceptable for our use case

---
```

### Design Example

```markdown
# Decisions: Design

> **Instructions:** Review each decision point below. Kiro recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## Technical Approach

### Architecture Pattern

**Question:** What architectural pattern should we use?

**Options:**
1. Monolithic architecture (Kiro Recommended for MVP): Single deployable unit, faster development
2. Microservices: Distributed services, better scalability
3. Modular monolith: Organized modules within single deployment
4. Other (please specify): _______________________

**Answer:** Option 1 - Monolithic for faster MVP delivery

---

## Correctness Properties Strategy

### Property-Based Testing

**Question:** Should the design document include formal correctness properties for property-based testing?

**Options:**
1. Skip correctness properties (Kiro Recommended for MVP): Focus on architecture and implementation, defer formal testing to later phases - 60-80% faster generation
2. Essential properties only: Include basic round-trip and invariant properties for core business logic - moderate generation time
3. Comprehensive properties: Full property-based testing approach with detailed prework analysis - slower but thorough
4. Other (please specify): _______________________

**Answer:** Option 2 - Essential properties for core business logic

---
```

### Tasks Example

```markdown
# Decisions: Tasks

> **Instructions:** Review each decision point below. Kiro recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## Implementation Strategy

### Development Approach

**Question:** How should we organize the implementation work?

**Options:**
1. Feature-based (Kiro Recommended): Build complete features end-to-end before moving to next
2. Layer-based: Build all backend APIs first, then frontend components
3. Component-based: Build individual components in isolation, integrate later
4. Other (please specify): _______________________

**Answer:** 

---

## Task Prioritization

### First Implementation Phase

**Question:** Which components should be built first?

**Options:**
1. Authentication system (Kiro Recommended): Foundation for all other features
2. Core business logic: Main functionality first, auth later
3. Database layer: Data foundation before business logic
4. Other (please specify): _______________________

**Answer:** 

---

## Testing Strategy

### Testing Approach

**Question:** When should testing be implemented?

**Options:**
1. Test-driven development (Kiro Recommended): Write tests before implementation
2. Parallel testing: Write tests alongside implementation
3. Post-implementation: Write tests after features are complete
4. Other (please specify): _______________________

**Answer:** 

---
```