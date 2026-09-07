# QA Automated Testing — AI-DLC Starter Pack

A **tool-agnostic** starter pack for designing and building **automated test suites for web and mobile applications**, driven by the **AI-Driven Development Lifecycle (AI-DLC)** decision-gated workflow. It ships two curated testing skills — one for **web** (Playwright-first) and one for **mobile** (Maestro/Appium-first, with AWS Device Farm guidance) — plus a set of **AWS build skills** for standing up the serverless test infrastructure behind the suite (Lambda test runners, Step Functions orchestration, API Gateway trigger/results APIs, IAM roles, Bedrock for AI-assisted testing, and Lambda MicroVMs for isolated executors) — so the agent proposes current best-practice options instead of guessing.

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
│   ├── mobile-test-automation/   # Maestro/Appium mobile testing expertise (SKILL.md + 10 reference topics)
│   ├── aws-lambda/               # Serverless test runners & event-driven jobs (SKILL.md + references)
│   ├── aws-step-functions/       # Test/CI orchestration in ASL/JSONata (SKILL.md + references + ASL assets)
│   ├── connecting-lambda-to-api-gateway/  # Test-trigger & results HTTP APIs (SKILL.md + reference)
│   ├── aws-iam/                  # CI/execution roles & least-privilege policies (SKILL.md + references)
│   ├── amazon-bedrock/           # AI-assisted testing (models, RAG, agents, guardrails) (SKILL.md + references)
│   └── aws-lambda-microvms/      # Isolated / multi-tenant test sandboxes (SKILL.md + references)
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

### Skills — Testing + AWS test infrastructure

The pack includes eight skills that activate based on conversation triggers. The two **testing skills** cover authoring web and mobile suites; the six **AWS build skills** cover standing up the serverless infrastructure behind those suites (runners, orchestration, APIs, roles, AI assist, and isolated executors). Each skill bundles `SKILL.md` plus a `references/` library with deep-dive guides. All follow the [Agent Skills open standard](https://agentskills.io/), so they copy verbatim into every supported tool.

**Testing skills**

| Skill | Activates on | Covers |
|---|---|---|
| `web-test-automation` | web testing, browser/E2E test, Playwright, Cypress, Selenium, page object, locator, flaky test, visual regression, accessibility testing, network mocking, CI sharding | Playwright-first guidance: locators, web-first assertions & flakiness, POM vs fixtures, isolation & auth reuse, API testing & network mocking, accessibility (axe-core), visual regression, CI/parallelization, and Cypress/Selenium → Playwright migration. |
| `mobile-test-automation` | mobile/app test, iOS/Android, Appium, Maestro, Detox, Espresso, XCUITest, emulator, real device, device farm, AWS Device Farm, deep link, app permissions | Tool selection (Maestro/Appium/Detox/Espresso/XCUITest), per-framework setup, mobile flakiness, gestures/deep links/lifecycle, emulator-vs-real-device strategy, and device-farm CI with an **AWS Device Farm** centerpiece (incl. the no-native-Espresso/Detox/Flutter caveat) plus BrowserStack/Sauce comparison. |

**AWS build skills** (for the test infrastructure behind the suite)

| Skill | Activates on | Covers |
|---|---|---|
| `aws-lambda` | Lambda function, serverless test runner, event source, EventBridge/SQS/SNS/Kinesis trigger, webhook handler, result processor, scheduled job, SAM CLI | Designing, building, deploying, and debugging serverless compute — the Lambdas that kick off runs, process results, and react to CI events; event source mappings, Web Adapter, observability, and optimization. |
| `aws-step-functions` | Step Functions, state machine, ASL, JSONata, orchestrate workflow, Map/Distributed Map, Parallel, retries, saga, waitForTaskToken, human-approval gate, Standard vs Express | Authoring ASL state machines in JSONata to orchestrate multi-stage test/CI pipelines — fan-out across suites/shards/devices, retry/catch, approval callbacks, and large-scale data-driven runs; TestState unit testing. |
| `connecting-lambda-to-api-gateway` | API Gateway, REST/HTTP API, Lambda proxy integration, expose an endpoint, test-trigger API, results API, CORS, authorizer, API key, throttling | Creating an HTTP endpoint in front of a Lambda — an API to trigger runs on demand or serve results/reports — with CORS, authorization, throttling, access logging, and production hardening. |
| `aws-iam` | IAM role/policy, trust policy, execution role, service role, least privilege, STS/AssumeRole, permissions for CI, condition operators | Creating and scoping the roles and policies that let test infrastructure run — Lambda/Step Functions execution roles, CI assume-role setups, least-privilege access to artifacts — plus common IAM pitfalls. |
| `amazon-bedrock` | Bedrock, generative AI, model invocation, Converse/InvokeModel, Knowledge Bases, RAG, Bedrock Agents, AgentCore, Guardrails, model selection | Applying generative AI to the testing workflow — generating test cases from requirements, triaging/summarizing failures, RAG over test docs, and Guardrails; model invocation and selection (Claude/Llama/Nova/Titan). |
| `aws-lambda-microvms` | Lambda MicroVM, Firecracker, strong isolation, sandbox compute, multi-tenant/untrusted-code execution, long-lived session, suspend/resume, port-listening server | Running test executors that need Firecracker-grade isolation, untrusted/per-tenant code execution, real long-lived servers/sessions, or state preserved across suspend/resume — beyond a standard Lambda function. |

### MCP servers

Declared once in `pack.yaml`; the installer writes it to each tool's MCP config (`.kiro/settings/mcp.json`, `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`).

| MCP Server | When the agent uses it |
|---|---|
| **AWS Knowledge** (`aws-knowledge-mcp-server`) | Validating AWS specifics — especially **AWS Device Farm** supported test frameworks, device-minute pricing, regional availability, and CodePipeline/CodeBuild integration — before putting them in a decision file. |

## Prerequisites

- One of: [Kiro](https://kiro.dev), [Claude Code](https://claude.com/claude-code), GitHub Copilot, or Cursor — installed and signed in.
- **Option B (installer) only:** Node.js 18+ (to run `ramp-pack`).
- Test runtimes as chosen during the Design phase (e.g., Node.js + `npx playwright install` for web; Maestro / Appium / Xcode / Android SDK for mobile).
- *(Optional)* An AWS account/profile if you adopt **AWS Device Farm** for device-cloud test runs, or if you build the serverless **test infrastructure** (Lambda, Step Functions, API Gateway, IAM, Bedrock, Lambda MicroVMs) covered by the AWS build skills.

## License

Sample code, licensed under MIT-0. See the repository [`LICENSE`](../LICENSE). Skill content is distilled from the official Playwright, Cypress, Appium, Maestro, Detox, Espresso, XCUITest, and AWS Device Farm documentation; see each `SKILL.md` for attribution. AI-DLC steering is adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (MIT-0).
