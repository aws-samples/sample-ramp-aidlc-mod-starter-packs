# QA Automated Testing — AI-DLC Starter Pack

A pre-configured **Kiro** starter pack for designing and building **automated test suites for web and mobile applications**, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-gated workflow. It ships the standard AI-DLC steering plus two curated testing skills — one for **web** (Playwright-first) and one for **mobile** (Maestro/Appium-first, with AWS Device Farm guidance) — so the agent proposes current best-practice options instead of guessing.

## Use case

You need a production-grade automated test strategy and suite for a web app, a mobile app (iOS / Android / React Native / Flutter), or both. Works **greenfield** (new test suite for a system you're building) and **brownfield** (adding automated tests to an existing app — the agent reverse-engineers the codebase first). The decision-gated workflow walks you through requirements, test architecture/tooling, and an executable task plan — with approval gates — before any test code is written.

Typical kickoffs:
- *"Help me design an end-to-end Playwright test suite for our web app."*
- *"We have a React Native app — set up automated mobile tests and a device-farm CI strategy."*
- *"Build a cross-surface QA automation plan covering our web app and native iOS/Android apps."*

## What's in this pack

```
qa-automated-testing/
├── README.md
└── .kiro/
    ├── steering/
    │   ├── aidlc-decisions-workflow.md      # Requirements → Design → Tasks, decision-gated (always-on)
    │   ├── skill-power-mcp-activation.md     # When to activate the testing skills + AWS Knowledge MCP (always-on)
    │   └── reverse-engineering.md            # Phase 0 codebase-analysis playbook for brownfield (always-on)
    ├── settings/
    │   └── mcp.json                          # AWS Knowledge MCP registration
    └── skills/
        ├── web-test-automation/              # Playwright (default), Cypress, Selenium
        │   ├── SKILL.md
        │   └── references/                   # 9 topic guides (locators, flakiness, POM, a11y, CI, migration…)
        └── mobile-test-automation/           # Maestro, Appium, Detox, Espresso, XCUITest, AWS Device Farm
            ├── SKILL.md
            └── references/                   # 9 topic guides (tool selection, flakiness, device strategy, device-farm CI…)
```

### Steering (`.kiro/steering/`)

All three use `inclusion: always`, so Kiro loads them into every session.

| File | What it does |
|---|---|
| `aidlc-decisions-workflow.md` | The general AI-DLC workflow: optional **Phase 0 Reverse Engineering** (brownfield) → **Phase 1 Requirements** → **Phase 2 Design** → **Phase 3 Tasks**. Before each spec doc the agent writes a `_decisions-*.md` and waits for your input. State + audit logs enable session continuity. |
| `skill-power-mcp-activation.md` | Forces activation of the matching testing skill (and the AWS Knowledge MCP) **before** generating decision files, design, or test code — so options reflect current best practice, not stale training data. |
| `reverse-engineering.md` | The Phase 0 codebase-analysis recipe used for brownfield projects (produces architecture, API documentation, component inventory, etc.). |

### MCP servers (`.kiro/settings/mcp.json`)

| Server | When the agent uses it |
|---|---|
| **AWS Knowledge MCP** (`aws-knowledge-mcp-server`) | Validating AWS specifics — especially **AWS Device Farm** supported test frameworks, device-minute pricing, regional availability, and CodePipeline/CodeBuild integration — before putting them in a decision file. |

### Skills (`.kiro/skills/`)

| Skill | Activates on | Covers |
|---|---|---|
| `web-test-automation` | web testing, browser/E2E test, Playwright, Cypress, Selenium, page object, locator, flaky test, visual regression, accessibility testing, network mocking, CI sharding | Playwright-first guidance: locators, web-first assertions & flakiness, POM vs fixtures, isolation & auth reuse, API testing & network mocking, accessibility (axe-core), visual regression, CI/parallelization, and Cypress/Selenium → Playwright migration. |
| `mobile-test-automation` | mobile/app test, iOS/Android, Appium, Maestro, Detox, Espresso, XCUITest, emulator, real device, device farm, AWS Device Farm, deep link, app permissions | Tool selection (Maestro/Appium/Detox/Espresso/XCUITest), per-framework setup, mobile flakiness, gestures/deep links/lifecycle, emulator-vs-real-device strategy, and device-farm CI with an **AWS Device Farm** centerpiece (incl. the no-native-Espresso/Detox/Flutter caveat) plus BrowserStack/Sauce comparison. |

## Getting started

1. **Open this folder in [Kiro](https://kiro.dev)** — or copy its `.kiro/` directory into your own project's repository. Kiro loads the steering files and registers the MCP server automatically when a session starts.

   ```bash
   cp -R qa-automated-testing/.kiro /path/to/your/project/.kiro
   ```

2. **(Brownfield only)** Put the app you're testing in the workspace (or a `existing-codebase/` subfolder). The workflow detects existing code and runs **Phase 0 Reverse Engineering** first.

3. **Start a conversation.** Try one of the kickoffs above, or *"Start the AI-DLC workflow to build our automated test suite."*

The agent creates a `_decisions-*.md` file at each phase, waits for your choices (framework, device strategy, coverage targets, CI approach…), then generates requirements, a test design, and a task plan — gate by gate — before writing test code.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- [Git](https://git-scm.com/downloads)
- Test runtimes as chosen during the Design phase (e.g., Node.js + `npx playwright install` for web; Maestro / Appium / Xcode / Android SDK for mobile)
- *(Optional)* An AWS account/profile if you adopt **AWS Device Farm** for device-cloud test runs

## License

Sample code, licensed under MIT-0. See the repository [`LICENSE`](../LICENSE). Skill content is distilled from the official Playwright, Cypress, Appium, Maestro, Detox, Espresso, XCUITest, and AWS Device Farm documentation; see each `SKILL.md` for attribution. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
