# Maestro Flows

Maestro is the modern E2E default: declarative YAML flows, built-in auto-waits, and flakiness tolerance (commands retry). One tool covers Native Android (View + Compose), Native iOS (UIKit + SwiftUI), React Native, Flutter, and Web. No compile step, no driver matrix.

## Install

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro --version

# Run a flow on a connected device/emulator/simulator
maestro test flows/login.yaml
maestro test flows/                 # run a directory of flows
maestro test --include-tags=smoke flows/
```

## Flow structure

A flow is a YAML doc: a header (config) separated by `---` from an ordered list of commands.

```yaml
# flows/login.yaml
appId: com.example.app          # bundle id (iOS) / package (Android)
tags:
  - smoke
  - auth
env:
  USERNAME: demo@example.com
---
- launchApp:
    clearState: true            # hermetic start — wipe app data
    permissions: { notifications: allow, camera: deny }
- assertVisible: "Sign in"
- tapOn:
    id: "email_field"           # accessibilityIdentifier / resource-id / testID
- inputText: ${USERNAME}
- tapOn:
    id: "password_field"
- inputText: "secret123"
- tapOn: "Sign in"              # text selector (substring match)
- assertVisible:
    id: "home_title"
- scrollUntilVisible:
    element:
      text: "Settings"
    direction: DOWN
- tapOn: "Settings"
```

Every `tapOn`/`assertVisible` auto-waits for the element and retries — no explicit waits needed. Use `waitForAnimationToEnd` if a transition needs settling.

## Selectors

```yaml
- tapOn: "Login"                       # by visible text (substring, case-insensitive)
- tapOn:
    id: "login_button"                 # by accessibility id / resource-id / RN testID
- tapOn:
    text: "Submit"
    index: 1                           # nth match
- tapOn:
    below: "Email"                     # relational: element below the "Email" label
- assertVisible:
    text: "Welcome.*"                  # regex
- tapOn:
    point: "50%,90%"                   # last resort — percentage, not raw px
```

Prefer `id` (stable). Use `text` for human-visible labels. Relational selectors (`above`, `below`, `leftOf`, `rightOf`, `containsChild`) disambiguate without brittle indices.

## Subflows, tags, env

```yaml
# flows/checkout.yaml
appId: com.example.app
---
- runFlow: login.yaml                  # reuse another flow as a subflow
- runFlow:
    file: subflows/add_to_cart.yaml
    env:
      SKU: "ABC-123"
- runScript: scripts/seed.js           # JS for data setup / assertions
```

- `tags` + `--include-tags` / `--exclude-tags` partition suites (smoke vs regression).
- `env` vars come from the flow header, `runFlow` overrides, `-e KEY=VAL` on the CLI, or a `.env` file.

## Maestro Studio

```bash
maestro studio        # opens a browser UI against the connected device
```

Inspect the live view hierarchy, click elements to get suggested selectors, and interactively build commands — then paste them into a flow. This replaces manual locator hunting.

## Maestro Cloud / running in CI

```bash
# Run the same local flows on managed real devices
maestro cloud --apiKey "$MAESTRO_CLOUD_API_KEY" app.apk flows/

# CI: install Maestro, boot a device, run the suite (non-zero exit fails the build)
maestro test --format junit --output report.xml flows/
```

`--format junit` emits a JUnit report for CI dashboards. Exit code is non-zero on failure, so `maestro test` gates a pipeline directly.

## Practical guidance

- Make flows hermetic: `launchApp: { clearState: true }` plus pre-set `permissions`.
- Stub the network at the app/proxy layer (see `flakiness-mobile.md`) so flows are deterministic.
- Keep flows short and composable; factor login/setup into subflows via `runFlow`.
- Note Maestro is black-box: it cannot read app-internal state. For that depth use Detox/Espresso/XCUITest.

See `tool-selection.md` for when to choose Maestro over Appium/Detox.
