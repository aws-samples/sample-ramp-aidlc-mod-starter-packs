# Mobile Test Automation: Tool Selection

Pick the framework from the app's tech stack and where it must run. The recommendation in one line: **default to Maestro unless a hard constraint (RN determinism, device-cloud framework support, existing native suite) forces otherwise.**

## Decision tree

```
What kind of app?
├─ React Native
│  ├─ Need bullet-proof determinism / heavy async / huge suite → Detox (gray-box, RN bridge sync)
│  └─ Want fast authoring, low maintenance, multi-platform → Maestro
├─ Flutter
│  └─ Maestro (E2E) or integration_test (in-process)   ← Detox does NOT support Flutter
├─ Native Android only
│  ├─ In-app / unit-ish UI, fastest, runs on AWS Device Farm Instrumentation → Espresso
│  └─ Cross-team / black-box / device cloud → Maestro or Appium
├─ Native iOS only
│  ├─ In-Xcode, ships with the app, runs on AWS DF XCTest/XCUITest → XCUITest
│  └─ Cross-team / black-box / device cloud → Maestro or Appium
├─ Mixed native iOS + Android, one suite, one language flexibility
│  └─ Maestro (modern default) or Appium (mature, language-flexible)
└─ Must run on AWS Device Farm service-side runner
   └─ Appium / Instrumentation / XCTest / XCUITest / Fuzz ONLY (see device-farm-and-ci.md)
```

## Comparison table

| Dimension        | Maestro                          | Appium                           | Detox                       | Espresso                  | XCUITest                  |
|------------------|----------------------------------|----------------------------------|-----------------------------|---------------------------|---------------------------|
| Platforms        | iOS, Android, RN, Flutter, Web   | iOS, Android (+ RN/Flutter)      | RN only (iOS + Android)     | Android only              | iOS only                  |
| Language         | YAML (declarative)               | Java, JS, Python, Ruby, C#, …    | JavaScript/TypeScript       | Kotlin/Java               | Swift/Obj-C               |
| Sync model       | Built-in auto-wait + retry       | Manual explicit waits            | Auto-wait on RN bridge/timers/anims | IdlingResource + auto-sync | waitForExistence/XCTWaiter |
| Box model        | Black-box                        | Black-box                        | Gray-box                    | White/gray-box (in-process) | Gray-box (in-process)   |
| Maintenance      | Low                              | High (drivers, waits, fragile)   | Medium                      | Medium                    | Medium                    |
| Flakiness        | Very tolerant                    | Operator-dependent               | Low (deterministic)         | Low                       | Medium                    |
| Device clouds    | BrowserStack, Sauce, Maestro Cloud | Everywhere incl. AWS DF        | Self-host / Sauce (limited; NOT AWS DF) | Sauce/BrowserStack; NOT AWS DF | AWS DF, BrowserStack, Sauce |
| Learning curve   | Hours                            | Days–weeks                       | Days                        | Days                      | Days                      |
| Speed to author  | Fastest                          | Slow                             | Medium                      | Medium                    | Medium                    |

## Decision shortcuts by app type

- **Greenfield, any stack, want results this week** → Maestro.
- **React Native, large regression suite, CI gating** → Detox for the deterministic core flows; Maestro for smoke/broad coverage.
- **Flutter** → Maestro for E2E; `integration_test` for in-app widget+integration. Never Detox.
- **Native Android team already on JUnit** → Espresso for in-app, layered with a Maestro smoke suite.
- **Native iOS team in Xcode** → XCUITest, layered with Maestro smoke.
- **One QA team, both platforms, mixed native** → Maestro first; Appium if you need a real programming language, complex logic, or a specific device cloud that only speaks Appium.
- **Must execute inside AWS Device Farm's managed runner** → Appium (any language binding) or the native Instrumentation/XCTest/XCUITest harness. Espresso, Detox, and Flutter test runners are NOT supported service-side — run those on BrowserStack/Sauce or self-hosted.

## Why Maestro is the modern default

- Single YAML file per flow; no compile step, no driver matrix, no WebDriver session lifecycle.
- Auto-waits on every command and tolerates transient flakiness (retries) without explicit synchronization code.
- One tool covers Native Android (View + Jetpack Compose), Native iOS (UIKit + SwiftUI), React Native, Flutter, and Web.
- `maestro studio` gives live element inspection; `maestro test` runs locally or in CI; Maestro Cloud runs the same flows on real devices.

Trade-off: Maestro is black-box (no app-internals hooks), so for tests that must reach into RN/JS state or assert on internal idle state, Detox/Espresso/XCUITest still win. Use the layered approach: Maestro broad + native/gray-box deep.

See: `appium-setup.md`, `maestro-flows.md`, `detox-and-flutter.md`, `espresso-and-xcuitest.md`, `device-strategy.md`, `device-farm-and-ci.md`.
