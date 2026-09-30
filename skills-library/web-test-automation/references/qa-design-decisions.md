# QA Design Decisions (Web)

When helping someone design a web test-automation approach, guide them through these
decisions *before* writing tests. These are the choices that define a web QA workflow.
Surface them as options with tradeoffs — the user chooses; do not pick for them.

Ask one category at a time; don't overwhelm with a wall of questions. Put the tradeoffs
in parentheses so the user decides with the constraints in front of them. Skip categories
that don't apply and say why.

The categories below are a **starting set, not an exhaustive checklist**. Treat them as
seeds: add decisions the project context demands (e.g. mobile-web/responsive concerns,
authentication providers, multi-tenant test isolation, performance budgets, internationalisation,
compliance gates, contract-testing tooling) and ask clarifying questions wherever the
requirements leave a gap. The goal is a complete set of *informed* decisions for this
specific workflow — not just answers to these seven.

## Workflow

1. Confirm what's under test and what's in / out of scope.
2. Walk each decision category below; capture the user's choice and the rationale.
3. For framework and tooling choices, also consult `tool-selection.md`.
4. Summarise the chosen decisions for confirmation before generating the test design.

## Decision Categories

### 1. Test Framework and Language

- Which framework? (**Playwright** — auto-waiting, cross-browser, built-in API + a11y + trace
  viewer, native sharding; **Cypress** — strong time-travel DX, single-tab, harder
  multi-origin, weaker WebKit; **Selenium / WebDriver** — broadest language/browser reach,
  fits an existing estate but you manage waits yourself. See `tool-selection.md`.)
- Language binding? (TypeScript keeps test and app types aligned and is the Playwright
  default; Java / Python / C# are usually chosen to match team skills or an existing
  Selenium investment.)
- Existing suite to migrate from or coexist with? (Migrating mid-stream vs greenfield
  changes effort and risk. See `migration-to-playwright.md`.)

### 2. Test Scope and Coverage Philosophy

- Which layers, and what balance? (Many fast unit / component tests at the base, fewer
  integration, fewest E2E — push each check to the lowest layer that gives the signal.
  E2E is for critical journeys, not every code path.)
- Which user journeys MUST have E2E coverage? (The revenue / critical paths — login,
  checkout, core flows. Derive these from the requirements, not from the code.)
- Coverage expectation per layer? (An explicit *philosophy* — "E2E covers happy paths +
  top defects; unit covers logic" — is more useful than a percentage target, which can be
  gamed by low-value tests.)
- Cross-browser scope? (Chromium-only for speed, or + Firefox / WebKit for parity — each
  added engine multiplies CI time and surfaces engine-specific flakes.)

### 3. Test Data Strategy

- How is test data provisioned? (Seed via **API** — fast, stable, preferred; **DB fixtures**
  — couples tests to schema; or **UI setup** — slow and brittle. Use factories for
  generated/randomised data.)
- Isolation model? (Unique data per test vs shared fixtures — unique avoids cross-test
  coupling but costs setup time; shared is faster but risks order dependence.)
- Run environment? (Dedicated test env, ephemeral per-PR, or shared staging — shared
  environments risk state bleed between concurrent runs.)
- Sensitive / PII data in tests? (Synthetic data vs a masked production extract — the latter
  carries compliance obligations.)

### 4. Flakiness Tolerance and Triage

- Retry policy in CI? (Retry a failed test once or twice to absorb transient flake — but
  retries *mask* real instability, so pair them with reporting on the retry rate.)
- Quarantine process? (Tag intermittently-failing tests, e.g. `@flaky`, to keep the suite
  green while they're fixed, vs block-the-pipeline on any failure. Decide who triages and
  the SLA for fixing quarantined tests.)
- Trace / artifact capture on failure? (Trace + video + screenshot on first retry is
  essential for debugging failures that only reproduce in CI; always-on is expensive. See
  `assertions-waiting-and-flakiness.md`.)
- Flake threshold that triggers investigation? (e.g. any test flaking on >1% of runs gets
  a ticket.)

### 5. Test Architecture

- Page Object Model, fixtures, or both? (POM centralises selectors + exposes domain-level
  methods; fixtures handle setup / teardown + dependency injection. In Playwright, commonly
  both. See `architecture-pom-fixtures.md`.)
- Auth handling? (Reuse stored auth state to skip per-test login vs log in each time —
  stored state is much faster but needs refresh / expiry handling. See
  `test-isolation-and-auth.md`.)
- Network strategy? (Hit real backends, mock at the network layer, or a hybrid — mocking
  isolates the UI but can drift from the real contract. See
  `api-testing-and-network-mocking.md`.)

### 6. Cross-Cutting Test Types

- Accessibility testing? (Integrate axe-core into E2E with a WCAG level target, or declare
  it out of scope — be explicit either way. See `accessibility-and-visual-regression.md`.)
- Visual regression? (Snapshot comparisons + an agreed re-baselining workflow, or skip —
  visual tests add real maintenance and need a consistent rendering env.)
- API / contract testing in-suite? (Use request fixtures for API-level checks alongside
  browser flows, or keep API testing in a separate contract-test layer.)

### 7. CI Integration and Reporting

- CI platform and runner type? (GitHub Actions / GitLab CI / other — informs the sharding
  setup. See `ci-and-parallelization.md`.)
- Parallelization / sharding? (Shard count trades cost against wall-clock — more shards
  finish faster but burn more runner minutes.)
- Where do results and trends live? (The framework's built-in HTML report for a single run,
  or an aggregated dashboard for flake / trend tracking over time.)
- What gates the pipeline? (All-green to merge, or a smoke subset on PRs + the full suite
  nightly — the latter keeps PR feedback fast on large suites.)

### 8. Anything else this project needs

The seven categories above cover the common ground. Before finalising, scan the requirements
and surroundings for decisions they *don't* cover and add them here — for example: SSO /
identity-provider test handling, feature-flag combinations, payment / third-party sandbox
strategy, performance / Core Web Vitals budgets in E2E, security test gates, data-residency
or compliance constraints, monorepo vs multi-repo test layout, or how tests version alongside
the app. When in doubt, ask rather than assume.

## Output

Summarise the answers as a **Test Design Decisions** block for the user to confirm before
you generate the test design. Each subsequent design choice should trace back to a decision
captured here. Note any decisions you added beyond the starting categories so the rationale
is preserved.

## See also

`tool-selection.md`, `architecture-pom-fixtures.md`, `assertions-waiting-and-flakiness.md`,
`test-isolation-and-auth.md`, `ci-and-parallelization.md`
