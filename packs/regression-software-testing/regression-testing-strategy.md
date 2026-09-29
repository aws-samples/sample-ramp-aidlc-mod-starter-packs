---
inclusion: always
---

# Regression Testing Strategy

**Purpose**: Define the test prioritization strategy for pre-change regression testing. This strategy applies to any major change — version upgrades, framework migrations, runtime changes, or large refactors — and is designed to maximize the survival rate of tests across the change boundary.

## Core Principle

> Tests written before an upgrade should validate **observable external behavior**, not internal implementation details. The goal is a safety net that catches regressions without being coupled to the thing being replaced.

## Test Priority Tiers

### Tier 1: Upgrade-Critical (Must Have)

These tests have the highest ROI because they validate the contracts that external consumers depend on. If these break after an upgrade, real users are affected.

**Backend → API Contract Tests**
- Validate REST endpoint paths, HTTP methods, request/response JSON shapes, status codes, and error responses
- Use framework-provided test utilities (e.g., MockMvc for Spring, supertest for Express) to test the HTTP layer without a running server
- Pin down serialization formats — field names, date formats, null handling, collection ordering
- Cover both success and error paths (404, 400, 500 responses)
- These survive framework upgrades because they test the HTTP contract, not the framework internals

**Frontend → E2E Browser Tests**
- Use framework-agnostic browser automation (Selenium, Playwright, Cypress etc.)
- Test real user flows: navigation, form submission, data display, error states
- Do NOT write framework-specific component tests (e.g., Angular TestBed, React Testing Library) if a frontend framework migration is planned — these get thrown away
- E2E tests survive any frontend framework swap because they test what the user sees

### Tier 2: Durable Logic (Should Have)

These tests are cheap to write and survive any upgrade because they test pure business logic with no framework dependency.

**Business Logic Unit Tests**
- Game engines, calculators, validators, transformers — any pure function or class
- Domain object behavior (lazy initialization, state transitions, collection management)
- Utility classes (ID generation, formatting, parsing)
- These have zero framework coupling and will pass identically before and after any upgrade

### Tier 3: Integration Verification (Nice to Have)

These tests validate internal wiring and are more likely to need adjustment after an upgrade, but still provide value.

**Factory/Service Integration Tests**
- Test orchestration logic with mocked dependencies
- Validate that business rules are applied correctly across component boundaries
- May need updates if dependency injection patterns change during upgrade

**Data Access Tests**
- Validate query construction, entity mapping, CRUD operations
- More likely to need adjustment if ORM or SDK versions change
- Consider using embedded/local versions of data stores where available

## Decision Rules

When deciding what to test for an upgrade, apply these rules:

1. **Will this test break because of the upgrade itself?** If yes, it's testing implementation, not behavior. Deprioritize or redesign it.
2. **Does this test validate something an external consumer depends on?** If yes, it's Tier 1. Write it first.
3. **Does this test have zero framework dependencies?** If yes, it's Tier 2. Write it — it's cheap and durable.
4. **Does this test require mocking framework internals?** If yes, it's Tier 3. Write it only if time permits.

## Integration Testing: When It Matters

**Worth it:** No shared API spec between repos, complex auth flows, race conditions, or service-to-service calls that only surface when both sides are live.

**Skip it:** If Tier 1 tests (API contracts + E2E) already cover the integration boundary from both sides, a separate integration suite adds complexity without proportional value.

## Anti-Patterns to Avoid

- **Testing framework internals**: Don't test that Spring wires beans correctly — test that the HTTP endpoint returns the right response
- **Framework-coupled component tests before migration**: Don't write AngularJS unit tests if you're about to migrate to React
- **Over-mocking**: If a test requires 10 mocks to run, it's testing wiring, not behavior. Consider testing at a higher level instead.
- **Testing generated code**: Don't test getters/setters or boilerplate — test behavior that could break

## Applying This to Specific Upgrade Paths

### Java Version Upgrade (e.g., 8 → 17/21)
- Focus: API contracts (serialization may change), business logic (reflection access restrictions)
- Watch for: `javax.*` → `jakarta.*` namespace changes, removed APIs, `--add-opens` requirements

### Spring Boot Major Upgrade (e.g., 1.x → 3.x)
- Focus: API contracts (annotation changes, error handling changes), request/response shapes
- Watch for: `@RequestMapping` behavior changes, Jackson defaults, CORS configuration changes

### Frontend Framework Migration (e.g., AngularJS → React)
- Focus: E2E browser tests only — everything else gets rewritten
- Watch for: URL routing changes, form behavior differences, async loading patterns

### AWS SDK Upgrade (e.g., v1 → v2)
- Focus: API contracts (external behavior unchanged), data access patterns
- Watch for: Client builder API changes, async vs sync patterns, credential provider changes
