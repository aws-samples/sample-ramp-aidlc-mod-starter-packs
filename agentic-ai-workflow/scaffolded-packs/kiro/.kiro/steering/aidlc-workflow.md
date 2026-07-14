---
inclusion: always
---
# Decision-Driven Document Generation

**APPLIES TO**: Creating or updating requirements.md, design.md, or tasks.md files  
**DOES NOT APPLY TO**: General coding, debugging, file editing, or conversational queries

## 🚨 CRITICAL ENFORCEMENT - READ FIRST

**BEFORE creating ANY of these files:**
- `requirements.md`
- `design.md`
- `tasks.md`

**YOU MUST:**
1. Check if corresponding decision file exists
2. If NO → Create decision file (`_decisions-requirements.md`, `_decisions-design.md`, or `_decisions-tasks.md`), then STOP EXECUTION
3. If YES but empty → Ask user to fill it in, then STOP EXECUTION
4. If YES and completed → Proceed to create final document

**NEVER EVER:**
- Create requirements.md without completed `_decisions-requirements.md`
- Create design.md without completed `_decisions-design.md`
- Create tasks.md without completed `_decisions-tasks.md`
- Create both decision file and final document in same turn

**This applies even when:**
- User clicks "Generate Requirements" button
- User clicks "Generate Design" button
- User clicks "Generate Tasks" button
- User explicitly asks to create the document

## Quick Reference
- Requirements phase → `_decisions-requirements.md` → `requirements.md`
- Design phase → `_decisions-design.md` → `design.md`
- Tasks phase → `_decisions-tasks.md` → `tasks.md`

## Core Principles

### Decision-First Workflow
Before generating requirements.md, design.md, or tasks.md:

1. Create corresponding _decisions-*.md file
2. **STOP IMMEDIATELY** - Do not proceed to next step
3. Wait for user input on all decision points
4. Read completed decisions
5. Generate final document using user choices

**🛑 ABSOLUTE RULE**: After creating ANY decision file (`_decisions-*.md`), you MUST STOP your execution and ask the user to review. DO NOT create the final document in the same turn.

**Exception**: Skip if user says "skip the decision file" or "no decisions needed"

### 🌐 LANGUAGE MATCHING
Generate decision files in the same language as user's input prompt:
- Spanish input → Spanish decision file
- French input → French decision file  
- Japanese input → Japanese decision file
- Default to English only if language cannot be determined

### 💬 NATURAL MESSAGING
Present decision files as a natural part of creating high-quality specs, not as a procedural requirement.

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

Focus on: accuracy, effectiveness, quality, alignment, clarity

### 🔒 DECISION ISOLATION
Each decision file is independent:
- Requirements decisions apply ONLY to `_decisions-requirements.md`
- Design decisions apply ONLY to `_decisions-design.md`  
- Tasks decisions apply ONLY to `_decisions-tasks.md`
- **NEVER carry over** user preferences between phases
- Each phase requires NEW explicit user input

## Workflow Steps

1. **Generate** decision file with Kiro recommendations
2. **STOP and WAIT** - Do NOT proceed to next step automatically
3. **Ask user** to review and provide decisions
4. **Wait for user response** with completed decisions
5. **Confirm** all critical decisions have user input
6. **Read** completed decision file
7. **Generate** final document based on user choices

**🛑 CRITICAL**: After creating a decision file (_decisions-*.md), you MUST STOP and explicitly ask the user to review it. DO NOT automatically proceed to create the next decision file or final document. Wait for user confirmation and input.

**Phase Order**: Requirements → Design → Tasks (each phase references previous decisions)

**⚠️ ENFORCEMENT RULES**:
1. Before creating `requirements.md` → Check if `_decisions-requirements.md` exists and is completed
2. Before creating `design.md` → Check if `_decisions-design.md` exists and is completed
3. Before creating `tasks.md` → Check if `_decisions-tasks.md` exists and is completed
4. If decision file doesn't exist → Create it, STOP, and ask user to review
5. If decision file exists but not completed → STOP and ask user to complete it
6. NEVER create a decision file and its corresponding final document in the same turn

## Decision File Format

**Location**: Same directory as spec outputs

**File naming**:
- `_decisions-requirements.md`
- `_decisions-design.md`
- `_decisions-tasks.md`

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

**🛑 CRITICAL FOR TASKS**: The tasks phase is often skipped. Before creating tasks.md, you MUST:
1. Check if `_decisions-tasks.md` exists
2. If not, create it
3. STOP and ask user to review
4. Wait for user to provide input
5. Only then create `tasks.md`

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
- After creating decision file, STOP immediately
- Present decision files as a natural part of creating high-quality specs
- Explicitly ask user to review and fill in decisions without referencing "rules" or "processes"
- DO NOT proceed to next phase until user provides input
- Handle partial responses: acknowledge completed items, prompt for remaining
- If no response: ask if user wants Kiro recommendations as defaults
- Validate all critical decisions have user input (not just Kiro recommendations)
- Get explicit confirmation before proceeding to generate final document

**🛑 STOP POINTS**:
- After creating `_decisions-requirements.md` → STOP, ask user to review
- After creating `_decisions-design.md` → STOP, ask user to review
- After creating `_decisions-tasks.md` → STOP, ask user to review

**Natural Language Examples**:
- "I've prepared some key decisions to ensure we build exactly what you need. Please review and fill in your preferences."
- "Once you've filled in your preferences, let me know and I'll generate the [requirements/design/tasks] document"
- "Let me know your thoughts on these strategic choices, then I'll proceed"

### Document Generation
**Based on user choices**:
- Read completed decision file
- Generate final document (requirements.md, design.md, tasks.md)

**For Design Documents**:
- Check correctness properties decision in `_decisions-design.md`
- "Skip correctness properties" → Skip Correctness Properties section entirely
- "Essential properties only" → Include 3-5 key properties maximum
- "Comprehensive properties" → Full property-based testing analysis

### File Management
**Lifecycle**:
- Decision files and spec documents stored in the same working directory
- Keep decision files for reference - they record why choices were made
- For updates: modify decision file first, then regenerate spec documents
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
```

### Design Example

```markdown
# Decisions: Design

> **Instructions:** Review each decision point below. Kiro recommendations are provided for guidance. Fill in your decisions in the "Answer" sections, then confirm when ready to proceed.

---

## Correctness Properties Strategy

### Property-Based Testing

**Question:** Should the design document include formal correctness properties for property-based testing?

**Options:**
1. Skip correctness properties (Kiro Recommended for MVP): Focus on architecture and implementation, defer formal testing to later phases - 60-80% faster generation
2. Essential properties only: Include basic round-trip and invariant properties for core business logic - moderate generation time
3. Comprehensive properties: Full property-based testing approach with detailed analysis - slower but thorough
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
```
