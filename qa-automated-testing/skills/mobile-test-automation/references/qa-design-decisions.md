# QA Design Decisions (Mobile)

When helping someone design a mobile test-automation approach, guide them through these
decisions *before* writing tests. These are the choices that define a mobile QA workflow.
Surface them as options with tradeoffs — the user chooses; do not pick for them.

Ask one category at a time; don't overwhelm with a wall of questions. Put the tradeoffs
in parentheses so the user decides with the constraints in front of them. Skip categories
that don't apply and say why.

The categories below are a **starting set, not an exhaustive checklist**. Treat them as
seeds: add decisions the project context demands (e.g. offline-first behaviour, push-
notification flows, app-store release-gating, over-the-air update testing, wearable / tablet
form factors, accessibility with VoiceOver / TalkBack, performance and battery budgets) and
ask clarifying questions wherever the requirements leave a gap. The goal is a complete set of
*informed* decisions for this specific workflow — not just answers to these seven.

## Workflow

1. Confirm the app type (native iOS, native Android, React Native, Flutter) and what's in /
   out of scope.
2. Walk each decision category below; capture the user's choice and the rationale.
3. For framework and device-cloud choices, also consult `tool-selection.md` and
   `device-farm-and-ci.md`.
4. Summarise the chosen decisions for confirmation before generating the test design.

## Decision Categories

### 1. App Type and Framework

- What is the app built with? (Native iOS, native Android, React Native, or Flutter — this
  largely *determines* the viable frameworks.)
- Which framework? (**Maestro** — simple, low-maintenance, broad coverage incl. RN/Flutter,
  great PR smoke gate; **Appium** — one API across iOS + Android + language flexibility, but
  black-box so you manage waits; **Detox** — gray-box determinism for React Native only;
  **Espresso** — native Android; **XCUITest** — native iOS. See `tool-selection.md`.)
- Cross-platform single suite, or per-platform suites? (One Appium/Maestro suite reduces
  duplication but can mask platform-specific behaviour; per-platform native suites are more
  accurate but more code to maintain.)
- Existing suite to migrate from or coexist with?

### 2. Test Scope and Coverage Philosophy

- Which layers, and what balance? (Many fast unit / component tests at the base, fewer
  integration, fewest full E2E on devices — device E2E is the slowest and most expensive
  signal, so reserve it for critical journeys.)
- Which user journeys MUST have device E2E coverage? (Onboarding, login, purchase /
  in-app payment, the core flows.)
- Which paths genuinely need a **real device** vs an emulator? (See category 4 — this
  shapes cost and CI design directly.)

### 3. Test Data Strategy

- How is test data and account state provisioned? (Seed via **API** before launch — fast
  and stable, preferred; vs **UI setup** — slow and flaky on mobile especially.)
- Test account lifecycle? (Dedicated test accounts, ephemeral per-run, or a shared pool —
  shared pools risk cross-run state collisions.)
- App state reset between tests? (Reset ladder: fast state reset vs full reinstall — full
  reinstall is the cleanest isolation but the slowest. See `flakiness-mobile.md`.)
- Deep-link test data? (Deep links to jump straight to a screen avoid slow, flaky multi-step
  navigation — decide which flows use them. See `gestures-lifecycle-and-deeplinks.md`.)

### 4. Device Strategy

- Emulator/simulator vs real device split? (Emulators / simulators for the fast dev loop +
  primary CI coverage; real devices for hardware-dependent paths — sensors, camera, GPS,
  GPU, carrier network, store install. The iOS Simulator is **not** accurate for
  performance / memory / network.)
- What is the real-device matrix? (Build it from **your own user analytics** — top OS
  versions, screen sizes, and OEMs your users actually run — not a generic list. See
  `device-strategy.md`.)
- Biometrics / payments / push notifications in scope? (These often need real devices and
  special handling.)
- Localization / regional coverage? (Multiple locales multiply the matrix; decide which
  locales are tested vs assumed.)

### 5. Flakiness Tolerance and Triage

- Reliance on framework auto-sync vs manual waits? (Espresso idle queue, Detox gray-box
  auto-wait, Maestro auto-waits for network + animations all reduce flake; **never** use
  hard sleeps. See `flakiness-mobile.md`.)
- Animation handling? (Disable system animations on test devices — a major flake source.)
- Permission dialogs? (Pre-grant permissions rather than tapping OS dialogs — decide the
  mechanism per framework.)
- Retry + quarantine policy? (Retry once to absorb transient flake; tag and quarantine
  persistently flaky device tests to keep CI green, with an owner + SLA to fix.)

### 6. Device Cloud and CI

- Run on a managed device cloud or self-hosted devices? (Device clouds give parallel scale +
  automatic teardown; self-hosting is cheaper at low volume but you own maintenance.)
- Which cloud? (**AWS Device Farm** — strong when the workload is already in AWS and the
  framework is Appium/XCUITest; **BrowserStack** / **Sauce Labs** — broadest framework +
  device coverage. ⚠️ Verify Device Farm's current framework support + pricing via the AWS
  Knowledge MCP — both change; don't quote from memory. See `device-farm-and-ci.md`.)
- CI runner shape? (Android emulators on larger Linux runners with KVM are 2–3× faster and
  cheaper than macOS; reserve macOS runners for iOS build / sign / test.)
- Parallelization? (Isolate each parallel session — unique `udid` / `wdaLocalPort` /
  `derivedDataPath` for Appium — and weigh device-minute cost against wall-clock.)

### 7. Reporting and Pipeline Gating

- Where do results, traces, and device videos live? (Built-in framework reports for a single
  run vs an aggregated dashboard for trend / flake tracking; device video is invaluable for
  debugging device-only failures.)
- What gates the pipeline? (A fast Maestro smoke subset on PRs + the full device matrix
  nightly is a common split that keeps PR feedback fast while preserving broad coverage.)
- Device-minute budget? (Device-cloud minutes are metered — an explicit budget shapes how
  much runs per-PR vs nightly.)

### 8. Anything else this project needs

The seven categories above cover the common ground. Before finalising, scan the requirements
and surroundings for decisions they *don't* cover and add them here — for example: accessibility
(VoiceOver / TalkBack) scope, offline / poor-network behaviour, push-notification and
deep-link-from-notification flows, app-store / TestFlight release gating, OTA / CodePush update
testing, wearable or tablet form factors, performance / battery / memory budgets on real
devices, or security and data-at-rest checks. When in doubt, ask rather than assume.

## Output

Summarise the answers as a **Test Design Decisions** block for the user to confirm before
you generate the test design. Each subsequent design choice should trace back to a decision
captured here. Note any decisions you added beyond the starting categories so the rationale
is preserved.

## See also

`tool-selection.md`, `device-strategy.md`, `flakiness-mobile.md`, `device-farm-and-ci.md`,
`gestures-lifecycle-and-deeplinks.md`
