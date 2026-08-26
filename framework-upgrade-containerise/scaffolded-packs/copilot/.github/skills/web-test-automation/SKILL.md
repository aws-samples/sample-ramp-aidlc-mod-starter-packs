---
name: web-test-automation
description: Use when designing, choosing tools for, or writing automated tests for web applications — E2E and UI tests, visual regression, web accessibility (axe-core), API testing inside browser flows, flaky-test debugging, page object model, and CI integration. Playwright-first, with Cypress and Selenium guidance and migration paths. Triggers on web testing, browser test, E2E, Playwright, Cypress, Selenium, page object, locator, flaky test, visual regression, accessibility testing, network mocking, CI sharding. For native iOS/Android/React Native/Flutter app tests, use the mobile-test-automation skill instead.
license: MIT-0
metadata:
  author: RAMP AI-DLC Starter Packs
  version: 1.0.0
---

# Web Test Automation

Best-practice guidance for building durable, low-flakiness automated tests for web applications. **Playwright (TypeScript) is the default stack**; Cypress and Selenium are covered for existing investments and migration.

This skill teaches an agent *how to do web test automation well* — it does not replace the official docs. When writing real test code, also consult the current Playwright / Cypress docs for exact API shapes, since these tools move fast.

## When to Load Reference Files

Load only the reference files relevant to the current task:

| If the task involves… | Load |
|---|---|
| Designing the test approach — deciding what to test, scope, data, flakiness policy, CI/reporting (a starting set you expand per project) | `references/qa-design-decisions.md` |
| Choosing a framework (Playwright vs Cypress vs Selenium) | `references/tool-selection.md` |
| Writing selectors / fixing brittle selectors | `references/locators-and-selectors.md` |
| Assertions, waiting, eliminating flakiness, trace debugging | `references/assertions-waiting-and-flakiness.md` |
| Structuring the suite (page objects, fixtures, test data) | `references/architecture-pom-fixtures.md` |
| Test isolation, programmatic login, reusing auth state | `references/test-isolation-and-auth.md` |
| API testing and network mocking inside web flows | `references/api-testing-and-network-mocking.md` |
| Accessibility (axe-core) and visual regression | `references/accessibility-and-visual-regression.md` |
| CI, parallelization, sharding, artifacts | `references/ci-and-parallelization.md` |
| Migrating from Cypress or Selenium to Playwright | `references/migration-to-playwright.md` |

## Core Principles (the substance)

These are the highest-value rules. Encode them into every suite you design.

### 1. Locators: user-facing first
- Prefer role/label/text locators (`getByRole`, `getByLabel`, `getByText`); fall back to test IDs (`getByTestId` → `data-testid` / `data-cy`).
- Avoid CSS/XPath tied to DOM structure or styling — they break on every refactor.
- Centralize selectors in one place (a page object) so a UI change is a one-line fix.

### 2. Waiting & flakiness (the #1 source of pain)
- Use **web-first, auto-retrying assertions**: `await expect(locator).toBeVisible()` — **never** `expect(await locator.isVisible()).toBe(true)`.
- **Never use fixed sleeps** (`page.waitForTimeout`, `cy.wait(<number>)`). Wait on conditions, events, or network responses instead.
- Lint for missing awaits (`@typescript-eslint/no-floating-promises`) and run `tsc --noEmit` in CI.
- Diagnose flakiness with the **trace viewer**; harden critical tests with `--repeat-each=N`.

### 3. Test isolation & data
- Every test runs independently with its own state. Verify by running a test alone.
- Set up / reset state in `beforeEach`, **not** `after*` (cleanup may not run on failure).
- Control state programmatically — seed via **API or DB**, not UI clicks.
- Log in once via API / `storageState` (Playwright setup project; Cypress `cy.session()`) and reuse the signed-in state.

### 4. Scope discipline
- Only test what you control. **Mock third-party/external services** via network interception (`page.route`, `cy.intercept`). Don't hit real external servers.

### 5. Architecture
- Page Object Model centralizes selectors + exposes domain-level methods.
- In Playwright, prefer **fixtures** for setup/teardown and **POM** for UI abstraction — know when to use which.
- Keep the test body thin; push reuse into fixtures/factories.

### 6. Cross-cutting test types inside web E2E
- **API testing:** validate endpoints and use the API to set up preconditions / assert postconditions.
- **Accessibility:** integrate `@axe-core/playwright`; scope scans; gate on WCAG tags.
- **Visual regression:** `toHaveScreenshot` with platform-suffixed baselines; mask dynamic content; tune `maxDiffPixels`; generate baselines in a consistent (ideally Dockerized) env.

### 7. CI integration
- Run on every PR/commit; use Linux runners; install only needed browsers (`--with-deps`).
- Shard across machines for speed; use **trace-on-first-retry** (not always-on); publish the HTML report + trace artifacts.

## Tool Selection Quick Reference

| Tool | Default for | Notes |
|---|---|---|
| **Playwright (TS)** | **Everything new** | Auto-waiting, cross-browser (Chromium/Firefox/WebKit), built-in API + a11y + visual + component testing, codegen, trace viewer, native sharding. **Recommend this in decision files.** |
| **Cypress** | Teams with deep Cypress investment | Great time-travel runner & component DX; weaker true cross-browser/WebKit, single-tab, harder multi-origin. |
| **Selenium / WebDriver** | Legacy grids, languages/browsers Playwright can't target | Otherwise migrate (`references/migration-to-playwright.md`). |

See `references/tool-selection.md` for the full decision tree.

## Configuration

- **Default project layout:** `tests/` for specs, `tests/pages/` for page objects, `tests/fixtures/` for fixtures, `playwright.config.ts` at root.
- **Recommended Playwright config:** `trace: 'on-first-retry'`, `retries: process.env.CI ? 2 : 0`, `fullyParallel: true`, projects per browser, a `setup` project for auth.
- **Install:** `npm init playwright@latest` (adds config, GitHub Actions workflow, example tests).
- **Lint gate:** enable `@typescript-eslint/no-floating-promises`; run `tsc --noEmit` in CI to catch missing awaits.

## Language / Framework Selection

- **Default:** Playwright + TypeScript.
- **Override only when the user explicitly asks** for Cypress, Selenium, or another language binding, or when an existing suite dictates it. Surface the tradeoff in the decision file before overriding.

## Resources

- Playwright Best Practices — https://playwright.dev/docs/best-practices
- Playwright Page Object Model — https://playwright.dev/docs/pom
- Playwright Accessibility Testing — https://playwright.dev/docs/accessibility-testing
- Playwright Visual Comparisons — https://playwright.dev/docs/test-snapshots
- Playwright API Testing — https://playwright.dev/docs/api-testing
- Cypress Best Practices — https://docs.cypress.io/app/core-concepts/best-practices

---

*Attribution: principles distilled from the official Playwright and Cypress best-practice docs, and informed by the MIT-licensed community skills [`currents-dev/playwright-best-practices-skill`](https://github.com/currents-dev/playwright-best-practices-skill) and [`testdino-hq/playwright-skill`](https://github.com/testdino-hq/playwright-skill).*
