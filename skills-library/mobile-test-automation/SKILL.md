---
name: mobile-test-automation
description: Use when designing, choosing tools for, or writing automated tests for mobile apps — native iOS, native Android, React Native, and Flutter. Covers Appium, Maestro, Detox, Espresso, XCUITest, emulator/simulator vs real device strategy, device farms (AWS Device Farm, BrowserStack, Sauce Labs), gestures, deep links, permissions, app lifecycle, mobile flakiness, and CI. Triggers on mobile testing, app test, iOS test, Android test, Appium, Maestro, Detox, Espresso, XCUITest, emulator, real device, device farm, deep link, app permissions. For web browser tests, use the web-test-automation skill instead.
license: MIT-0
metadata:
  author: RAMP AI-DLC Starter Packs
  version: 1.0.0
---

# Mobile Test Automation

Best-practice guidance for building durable, low-flakiness automated tests for mobile applications across **iOS, Android, React Native, and Flutter**. The right tool depends on the app — this skill leads with a decision tree, then encodes the cross-cutting principles that make mobile suites reliable.

This skill teaches an agent *how to do mobile test automation well* — it does not replace the official docs. When writing real test code, also consult the current Appium / Maestro / Detox / Espresso / XCUITest docs, and verify **AWS Device Farm** capabilities via the AWS Knowledge MCP, since support matrices and pricing change.

## When to Load Reference Files

Load only the reference files relevant to the current task:

| If the task involves… | Load |
|---|---|
| Designing the test approach — deciding what to test, scope, data, device strategy, flakiness policy, device-cloud/CI (a starting set you expand per project) | `references/qa-design-decisions.md` |
| Choosing a framework (Appium / Maestro / Detox / Espresso / XCUITest) | `references/tool-selection.md` |
| Appium setup, capabilities, parallel session isolation | `references/appium-setup.md` |
| Maestro YAML flows, selectors, subflows, Studio/Cloud | `references/maestro-flows.md` |
| React Native (Detox gray-box sync) or Flutter testing | `references/detox-and-flutter.md` |
| Native Android (Espresso) or native iOS (XCUITest) | `references/espresso-and-xcuitest.md` |
| Eliminating mobile flakiness (waits, animations, network, permissions, isolation) | `references/flakiness-mobile.md` |
| Gestures, deep links, network conditions, app lifecycle | `references/gestures-lifecycle-and-deeplinks.md` |
| Emulator/simulator vs real device, building the device matrix | `references/device-strategy.md` |
| Device farms + CI (AWS Device Farm, BrowserStack, Sauce, GitHub Actions) | `references/device-farm-and-ci.md` |

## Tool Selection Quick Reference

| Tool | Use when | Avoid when |
|---|---|---|
| **Appium** | One API across iOS + Android (+ web), language flexibility, no vendor lock-in, unmodified production apps | RN-only determinism needs, or zero-maintenance goal — it's black-box, so you manage waits + a layered iOS stack |
| **Maestro** | Simple, fast, low-maintenance E2E with built-in flakiness tolerance; broad coverage (Native, Compose, SwiftUI, RN, Flutter, Web); great PR smoke gate | You need white-box in-process access to app state |
| **Detox** | React Native apps wanting gray-box, zero-flakiness determinism | Non-RN apps; broad cross-stack coverage |
| **Espresso** | Native Android, tight UI-thread sync, fast dev/CI feedback | Cross-platform; iOS |
| **XCUITest** | Native iOS, first-party Xcode integration | Cross-platform; Android |

**Decision shortcuts:** RN → Detox or Maestro · Flutter → Maestro or `integration_test` (Detox doesn't cover Flutter) · Native iOS → XCUITest · Native Android → Espresso · One shared cross-platform suite → Appium (more upkeep) or Maestro (simpler) · PR smoke gate → Maestro. **Maestro is the rising modern default for E2E** — foreground it when the user has no existing investment.

See `references/tool-selection.md` for the full tree.

## Core Principles (the substance)

### 1. Locators: stable machine-facing IDs
- Prefer stable IDs over visible text/position. iOS: `accessibilityIdentifier`; Android: `resource-id` / content-description; React Native: `testID` → Detox `by.id`.
- **Avoid XPath** — ~10× slower, brittle; on iOS it forces a full page-source snapshot. Last resort only.
- Espresso: use the least-specific matcher that uniquely identifies one view; assert in `.check()`, never inside `onView()`.
- Maestro: prefer visible `text` for readability, switch to `id` for icons/localized apps; anchor with relational selectors, not indices.
- Use inspectors (Appium Inspector, Maestro Studio) to discover locators.

### 2. Synchronization & flakiness (the #1 source of pain)
- **Never use hard sleeps** — the top flakiness anti-pattern.
- Prefer explicit/conditional (poll-until) waits over implicit; never mix the two.
- Lean on auto-synchronizing frameworks: Espresso (idle queue + IdlingResource), Detox (gray-box auto-wait on RN bridge/timers/animations), Maestro (auto-waits for network + animations). iOS XCUITest: `waitForExistence(timeout:)` / `XCTWaiter`, not sleeps.
- **Disable system animations** on test devices (Android: set 3 animation scales to 0 via adb; Appium `disableWindowAnimation`).
- **Stub the network**; don't hit real backends (MockWebServer/WireMock on Android; OHHTTPStubs on iOS). Deliberately exercise slow/faulty paths.
- **Pre-grant permissions**; never tap OS dialogs (Appium `autoGrantPermissions`/`autoAcceptAlerts`; Espresso `GrantPermissionRule`; XCUITest `addUIInterruptionMonitor`; Detox `launchApp({permissions})`).
- Enforce **test isolation** with a known-clean start (prefer build-up at start over teardown). Reset ladders: Appium `noReset`→fast→`fullReset`; Detox `newInstance`→`resetAppState`→`delete`.

### 3. Device strategy
- Emulators/simulators for the fast dev loop and primary CI coverage; the iOS Simulator is **not** accurate for performance/memory/network.
- Always validate hardware-dependent paths on **real devices**: sensors, camera/mic, biometrics, GPS, GPU, carrier network, payments, store install flows.
- Build the real-device matrix from **your own user analytics**, not a generic list.

### 4. Mobile-specific concerns
- **Gestures:** use parameterized gesture APIs, not raw coordinates (Appium `mobile: swipeGesture`; Espresso `scrollTo()`/`RecyclerViewActions`; XCUITest `swipeUp()`/`pinch`).
- **Deep links** to jump straight to a screen instead of multi-step navigation (faster, less flaky): adb `am start`, Appium `mobile: deepLink`, Detox `launchApp({url})`, XCUITest `app.open(URL)`.
- **Network conditions:** simulate offline/3G/latency to catch reconnection bugs.
- **App lifecycle:** test background/foreground, process-death recovery, launch-from-notification, and app/DB upgrades.

### 5. CI & the test pyramid
- Run on every push/PR with animations off and devices reset clean; parallelize across devices/sessions (Appium: isolate each session with unique `udid`/`wdaLocalPort`/`derivedDataPath`).
- Use a managed device cloud for parallel scale and automatic teardown.
- Many small/fast tests at the base, few E2E at the tip. Push each check to the lowest layer that gives the right feedback.

## AWS Device Farm — read before recommending it

⚠️ **Critical caveat:** AWS Device Farm's managed test runner does **not** support every mobile framework — frameworks like Detox, Flutter, and Maestro are not first-class, and Espresso typically runs only when packaged as an Android Instrumentation test. If the team has committed to one of those, Device Farm may be a poor fit; BrowserStack or Sauce Labs are usually safer for the broadest framework + device coverage. **Do not quote the support matrix or pricing from memory — both change. Always verify current capabilities and cost via the AWS Knowledge MCP before putting them in a decision file.** Default to AWS Device Farm when the workload already lives in AWS (native CodePipeline test action, VPC-private test backends) and the framework is Appium/XCUITest. See `references/device-farm-and-ci.md`.

## Configuration

- **Maestro:** install via `curl -Ls "https://get.maestro.mobile.dev" | bash`; flows are YAML in `.maestro/`; `maestro test flow.yaml`; `maestro studio` to author selectors.
- **Appium:** `npm i -g appium`; install drivers (`appium driver install xcuitest`, `appium driver install uiautomator2`); use Appium Inspector for locators.
- **Detox:** `npm i -D detox`; configure `.detoxrc.js`; `detox build` then `detox test`.
- **CI runners:** Android emulators on larger Linux runners with KVM (`reactivecircus/android-emulator-runner`) — 2–3× faster and cheaper than macOS; reserve macOS runners for iOS build/sign/test.

## Platform / Framework Selection

- **Default for new cross-platform E2E:** Maestro (simplicity + flakiness tolerance), or Appium when broad language/platform reach and device-cloud parity are required.
- **React Native:** Detox (determinism) or Maestro.
- **Native Android / iOS:** Espresso / XCUITest respectively.
- **Override only when the user explicitly asks** or an existing suite dictates it. Surface the tradeoff in the decision file before overriding.

## Resources

- Maestro docs — https://docs.maestro.dev
- Appium docs — https://appium.io/docs/en/latest/
- Detox docs — https://wix.github.io/Detox/
- Espresso — https://developer.android.com/training/testing/espresso
- XCUITest (XCTest UI) — https://developer.apple.com/documentation/xctest/user-interface-tests
- AWS Device Farm — https://docs.aws.amazon.com/devicefarm/

---

*Attribution: principles distilled from the official Appium, Maestro, Detox, Espresso, XCUITest, and AWS Device Farm docs, and informed by the community skill directories [`PramodDutta/qaskills`](https://github.com/PramodDutta/qaskills) and [`LambdaTest/agent-skills`](https://github.com/LambdaTest/agent-skills).*
