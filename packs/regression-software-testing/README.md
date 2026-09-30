# Regression Software Testing — AI-DLC Starter Pack

A pre-configured set of Kiro steering files for building a **pre-upgrade regression testing** safety net on an existing codebase, driven by the **AI-Driven Development Lifecycle (AI-DLC)** workflow. The goal: implement comprehensive tests *before* a major upgrade so those tests validate the upgrade itself.

## Use case

You are about to perform a major change — a language/runtime version bump (e.g., Java 8 → 17), a framework major upgrade (e.g., Spring Boot 1.x → 3.x), a frontend framework migration (e.g., AngularJS → React), or an SDK upgrade (e.g., AWS SDK v1 → v2). Before touching the code, this workflow analyzes the codebase and builds a prioritized regression suite that survives the change boundary by testing **observable external behavior**, not implementation details.

## What's in this pack

```
regression-software-testing/
├── aidlc-testing-workflow.md       # The 7-stage AI-DLC testing workflow (steering)
├── regression-testing-strategy.md  # Test prioritization tiers and decision rules (steering)
└── reverse-engineering.md          # Phase 1 codebase-analysis playbook (steering)
```

This is a **steering-only** pack. Copy these files into your project's `.kiro/steering/` directory (all three use `inclusion: always`, so Kiro loads them into every session).

| File | What it does |
|---|---|
| `aidlc-testing-workflow.md` | The mandatory 7-stage workflow: Analysis (workspace detection, reverse engineering) → Test Planning (testing decisions, test requirements, decomposition) → execution, each with approval gates. |
| `regression-testing-strategy.md` | The strategy: Tier 1 upgrade-critical (API contracts, E2E), Tier 2 durable logic (pure unit tests), Tier 3 integration. Includes decision rules, anti-patterns, and upgrade-path-specific guidance. |
| `reverse-engineering.md` | The codebase-analysis recipe used in Phase 1. |

## Getting started

1. Copy the three Markdown files into your project's `.kiro/steering/` directory:

    ```bash
    mkdir -p /path/to/your/project/.kiro/steering
    cp *.md /path/to/your/project/.kiro/steering/
    ```

2. Open your project in Kiro and start a conversation. Try:
   - *"I'm about to upgrade this app from Java 8 to Java 17. Help me build the regression tests first."*
   - *"Start the AI-DLC pre-upgrade testing workflow."*

The workflow detects the stack, reverse-engineers the codebase (including the API surface), then walks you through testing decisions and a prioritized test plan before any test code is written — with approval gates at each stage.

## Prerequisites

- [Kiro](https://kiro.dev) installed and signed in
- An existing codebase you intend to upgrade
