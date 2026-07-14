# QA Automated Testing — AI-DLC Starter Pack

A **tool-agnostic** starter pack for designing and building **automated test suites for web and mobile applications**, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-gated workflow. It ships two curated testing skills — one for **web** (Playwright-first) and one for **mobile** (Maestro/Appium-first, with AWS Device Farm guidance) — so the agent proposes current best-practice options instead of guessing.

The pack is authored once as tool-neutral source and works with **Kiro, Claude Code, GitHub Copilot, and Cursor**. Whichever agent you use gains deep testing expertise and follows structured, decision-gated workflows — no manual setup needed.

## Use case

You need a production-grade automated test strategy and suite for a web app, a mobile app (iOS / Android / React Native / Flutter), or both. Works **greenfield** (new test suite for a system you're building) and **brownfield** (adding automated tests to an existing app — the agent reverse-engineers the codebase first). The decision-gated workflow walks you through requirements, test architecture/tooling, and an executable task plan — with approval gates — before any test code is written.

Typical kickoffs:
- *"Help me design an end-to-end Playwright test suite for our web app."*
- *"We have a React Native app — set up automated mobile tests and a device-farm CI strategy."*
- *"Build a cross-surface QA automation plan covering our web app and native iOS/Android apps."*

## Getting started

Pick **one** of the two ways to add this pack to your project.

### Option A — copy a pre-built folder (no tooling)

Pre-generated, tool-correct configs live under [`scaffolded-packs/`](scaffolded-packs/). Copy the folder for your tool into your project root:

| Your tool | Copy from | Into your project |
|---|---|---|
| **Kiro** | `scaffolded-packs/kiro/` | `.kiro/` |
| **Claude Code** | `scaffolded-packs/claude-code/` | `CLAUDE.md`, `.claude/`, `.mcp.json` |
| **GitHub Copilot** | `scaffolded-packs/copilot/` | `.github/`, `.vscode/mcp.json` |
| **Cursor** | `scaffolded-packs/cursor/` | `.cursor/` |

### Option B — generate it (installer)

Run the `ramp-pack` installer from the repo root; it reads the neutral source and writes the correct layout into your target project:

```bash
node installer/bin/ramp-pack.js init qa-automated-testing --tool <kiro|claude-code|copilot|cursor> --target /path/to/your/project
```

Add `--dry-run` to preview, `--force` to overwrite existing files. Option B always works even if `scaffolded-packs/` is missing or out of date — the neutral source is the single source of truth.

### Then

1. **(Brownfield only)** Put the app you're testing in the workspace (or a `existing-codebase/` subfolder). The workflow detects existing code and runs **Phase 0 Reverse Engineering** first.

2. Open the project in your tool and start a conversation. Try:
   - *"Start the AI-DLC workflow to build our automated test suite."*
   - *"Help me design an end-to-end Playwright test suite for our web app."*
   - *"We have a React Native app — set up automated mobile tests and a device-farm CI strategy."*
   - On Claude Code / Copilot you can also run the **`/aidlc`** command to kick off the workflow.

The workflow guides the agent to ask for your decisions first (writing a `_decisions-*.md` before each spec document), and the matching testing skill provides expert-level guidance throughout.

## What's in this pack

```
qa-automated-testing/
├── pack.yaml                 # Manifest: instruction roles, MCP servers, /aidlc command
├── instructions/             # Tool-neutral steering (source of truth)
│   ├── aidlc-workflow.md         # Decision-gated Requirements → Design → Tasks (primary)
│   ├── skill-activation.md       # When to activate the testing skills + MCP (companion, always)
│   └── reverse-engineering.md    # Phase 0 playbook (companion, brownfield-only)
├── skills/
│   ├── web-test-automation/      # Playwright-first web testing expertise (SKILL.md + 10 reference topics)
│   └── mobile-test-automation/   # Maestro/Appium mobile testing expertise (SKILL.md + 10 reference topics)
└── scaffolded-packs/         # Pre-generated per-tool configs (Option A above)
    ├── kiro/         # .kiro/{steering,settings,skills}
    ├── claude-code/  # CLAUDE.md, .claude/{rules,commands,skills}, .mcp.json
    ├── copilot/      # .github/{copilot-instructions.md,instructions,prompts,skills}, .vscode/mcp.json
    └── cursor/       # .cursor/{rules,skills}, .cursor/mcp.json
```

> `instructions/`, `skills/`, and `pack.yaml` are the **neutral source** you edit. `scaffolded-packs/` is **generated** from them by the installer — regenerate it after editing the source; don't hand-edit the scaffolded output.

### How each instruction maps per tool

The neutral instructions declare a **role** (`primary` / `companion`) and a **load** rule (`always` / `auto`); the installer renders each into the target tool's native mechanism:

| Neutral role | Kiro | Claude Code | Copilot | Cursor |
|---|---|---|---|---|
| `aidlc-workflow` (primary) | `.kiro/steering/*` `inclusion: always` | `CLAUDE.md` | `.github/copilot-instructions.md` | `.cursor/rules/*.mdc` `alwaysApply: true` |
| `skill-activation` (always) | `inclusion: always` | `.claude/rules/*` | `.github/instructions/*` `applyTo: '**'` | `.mdc` `alwaysApply: false` |
| `reverse-engineering` (auto) | `inclusion: auto` | `.claude/rules/*` | `.github/instructions/*` (conditional) | `.mdc` `alwaysApply: false` |
| `/aidlc` command | — | `.claude/commands/aidlc.md` | `.github/prompts/aidlc.prompt.md` | — |

### Skills — Web & Mobile Test Automation

The pack includes two testing skills that activate based on conversation triggers (web, mobile, Playwright, Appium, etc.). Each skill bundles `SKILL.md` plus a `references/` library with deep-dive guides. Both follow the [Agent Skills open standard](https://agentskills.io/), so they copy verbatim into every supported tool.

| Skill | Activates on | Covers |
|---|---|---|
| `web-test-automation` | web testing, browser/E2E test, Playwright, Cypress, Selenium, page object, locator, flaky test, visual regression, accessibility testing, network mocking, CI sharding | Playwright-first guidance: locators, web-first assertions & flakiness, POM vs fixtures, isolation & auth reuse, API testing & network mocking, accessibility (axe-core), visual regression, CI/parallelization, and Cypress/Selenium → Playwright migration. |
| `mobile-test-automation` | mobile/app test, iOS/Android, Appium, Maestro, Detox, Espresso, XCUITest, emulator, real device, device farm, AWS Device Farm, deep link, app permissions | Tool selection (Maestro/Appium/Detox/Espresso/XCUITest), per-framework setup, mobile flakiness, gestures/deep links/lifecycle, emulator-vs-real-device strategy, and device-farm CI with an **AWS Device Farm** centerpiece (incl. the no-native-Espresso/Detox/Flutter caveat) plus BrowserStack/Sauce comparison. |

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validating AWS specifics — especially **AWS Device Farm** supported test frameworks, device-minute pricing, regional availability, and CodePipeline/CodeBuild integration — before putting them in a decision file. |

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- Test runtimes as chosen during the Design phase (e.g., Node.js + `npx playwright install` for web; Maestro / Appium / Xcode / Android SDK for mobile).
- *(Optional)* An AWS account/profile if you adopt **AWS Device Farm** for device-cloud test runs.

## License

Sample code, licensed under MIT-0. See the repository [`LICENSE`](../LICENSE). Skill content is distilled from the official Playwright, Cypress, Appium, Maestro, Detox, Espresso, XCUITest, and AWS Device Farm documentation; see each `SKILL.md` for attribution. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
