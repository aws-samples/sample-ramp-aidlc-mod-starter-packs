---
id: qa-existing-test-inventory
target: reverse-engineering.md
purpose: Adds existing-test evidence to comprehensive QA reverse engineering.
replaces:
  - full-existing-test-inventory
  - full-artifact-checklist-extra
---
<!-- RAMP:SLOT full-existing-test-inventory START -->
## Existing Test Inventory

This additional comprehensive-analysis module treats existing tests as
first-class evidence for a QA automation effort. Inventory what automation
already exists before new test design so downstream work can deliberately
reuse, harden, migrate, replace, or retire it. Skip the artifact only when a
scan confirms there are genuinely no tests, and record that result.

This module runs with the common comprehensive/full-analysis policy. It is not
a qualified combination with adaptive Targeted mode.

Create `{{STATE_DIR}}/analysis/existing-test-inventory.md`:

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
<!-- RAMP:SLOT full-existing-test-inventory END -->

<!-- RAMP:SLOT full-artifact-checklist-extra START -->
- [x] existing-test-inventory.md
<!-- RAMP:SLOT full-artifact-checklist-extra END -->
