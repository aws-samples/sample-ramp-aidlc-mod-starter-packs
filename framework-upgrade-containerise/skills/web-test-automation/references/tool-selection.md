# Tool Selection: Playwright vs Cypress vs Selenium

**Default: Playwright (TypeScript).** Reach for it unless a hard constraint below forces an alternative. Playwright gives the best blend of cross-browser support, auto-waiting, parallelism, and debugging out of the box.

## Decision tree

```
Need browser test automation?
│
├─ Stuck on a language other than JS/TS/Python/.NET/Java?  ─────────────► Selenium
│     (Selenium has the widest language bindings: Ruby, PHP, etc.)
│
├─ Need real WebKit/Safari engine coverage?  ──────────────────────────► Playwright
│     (Cypress runs "experimental" WebKit; Selenium needs SafariDriver/macOS)
│
├─ Need multi-tab, multiple origins, or iframe-heavy flows?  ──────────► Playwright
│     (Cypress runs inside the app's frame — multi-tab/origin is painful)
│
├─ Team already deep in Cypress with a working suite?  ─────────────────► Cypress (keep it)
│     (don't migrate a healthy suite for marginal gains)
│
├─ Legacy enterprise grid / existing Selenium Grid investment?  ───────► Selenium
│
└─ Anything else (new project, greenfield)  ────────────────────────────► Playwright ✅
```

## Comparison table

| Capability            | Playwright (default)                       | Cypress                                  | Selenium                              |
|-----------------------|--------------------------------------------|------------------------------------------|---------------------------------------|
| Cross-browser         | Chromium, Firefox, WebKit (real engines)   | Chrome/Edge/Firefox; WebKit experimental | All major + via WebDriver             |
| Languages             | TS/JS, Python, .NET, Java                   | JS/TS only                               | Java, Python, C#, Ruby, JS, Kotlin... |
| Auto-waiting          | Yes (built-in, web-first assertions)       | Yes (retry-ability on commands)          | No (manual explicit waits required)   |
| Parallelism           | Free, built-in (workers + sharding)        | Paid Cloud, or community plugins         | Via Grid / external orchestration     |
| Component testing     | Yes (React/Vue/Svelte, experimental)       | Yes (mature, first-class)                | No                                    |
| Multi-tab / multi-origin | Native (`context.newPage()`, any origin) | Limited / awkward                        | Native (window handles)               |
| Network interception  | `page.route` (full request control)        | `cy.intercept` (good)                    | Limited (needs CDP/proxy)             |
| Debugging DX          | Trace Viewer, UI mode, codegen, inspector  | Time-travel runner, excellent UI         | Minimal; relies on logs/IDE           |
| Test runner           | Built-in (`@playwright/test`)              | Built-in                                 | Bring your own (JUnit, pytest, etc.)  |
| Speed                 | Fast (parallel by default)                 | Fast single-thread; serial by default    | Slower (WebDriver protocol overhead)  |
| Ecosystem / maturity  | Young but Microsoft-backed, fast-moving    | Large, mature, strong community          | Oldest, largest, W3C WebDriver standard |

## Recommendations

- **Recommend Playwright** for virtually all new web E2E work. Auto-waiting + free parallelism + Trace Viewer dramatically cut flakiness and debugging time.
- **Choose Cypress** when: the team already has a healthy Cypress suite, you want its best-in-class component testing + time-travel runner, and you don't need real Safari/WebKit or heavy multi-tab/multi-origin flows.
- **Choose Selenium** when: you must use a language Playwright/Cypress don't support, you have a significant existing Selenium Grid, or you're integrating with legacy enterprise tooling standardized on WebDriver.

## Component testing nuance

If the primary need is *component-level* testing in a React/Vue/Svelte app, Cypress Component Testing is the most mature option. Playwright's component testing is capable but still labeled experimental. For full-stack E2E, Playwright wins.

## Quick start (Playwright)

```bash
npm init playwright@latest
npx playwright test
npx playwright test --ui          # interactive UI mode
npx playwright codegen <url>      # record actions into a test
```
