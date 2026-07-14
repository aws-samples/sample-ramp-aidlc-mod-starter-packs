# Killing Mobile Test Flakiness

Flaky mobile tests almost always trace to four root causes: implicit timing, animations, uncontrolled network, and un-isolated state. Fix the cause, never paper over it with `sleep`.

## Rule #1: Never hard-sleep — use conditional waits

A `sleep(2)` is either too short (flaky) or too long (slow), and never matches real timing. Replace every sleep with a framework wait that polls until a condition holds.

| Framework  | Conditional wait                                                    |
|------------|----------------------------------------------------------------------|
| Maestro    | Built-in auto-wait on every command; `waitForAnimationToEnd`, `extendedWaitUntil` |
| Appium     | `WebDriverWait(driver, 10).until(EC.presence_of_element_located(...))` |
| Detox      | `await waitFor(el).toBeVisible().withTimeout(8000)` (+ auto idle-wait) |
| Espresso   | Auto-syncs UI thread; register `IdlingResource` for async/network    |
| XCUITest   | `element.waitForExistence(timeout:)`, `XCTWaiter`, `XCTestExpectation` |
| Flutter    | `await tester.pumpAndSettle()`                                       |

## Disable animations

Animations cause "element not yet stable / not hittable" flakes. Turn them off.

```bash
# Android emulator/device — set all three scales to 0
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

- **Appium**: capability `appium:disableWindowAnimation: true` (Android).
- **Espresso**: device scales above (CI bootstrap), or the Espresso test orchestrator.
- **iOS Simulator**: `xcrun simctl ... ` boots with reduced motion; set `UIView.setAnimationsEnabled(false)` under a UI-test launch arg, or enable Reduce Motion.
- **Maestro/Detox**: rely on the above plus their built-in idle waits.

## Stub the network (hermetic tests)

A test that hits a live backend inherits the backend's latency, downtime, and data drift. Serve responses locally.

```kotlin
// Android — MockWebServer (OkHttp) in instrumentation tests
val server = MockWebServer().apply {
  enqueue(MockResponse().setBody("""{"name":"demo"}""").setResponseCode(200))
  start()
}
// point the app's base URL at server.url("/")
```

```text
WireMock — standalone HTTP mock server; point the app at it via a test build-config base URL.
Good for shared stub fixtures across Android + iOS suites.
```

```swift
// iOS — OHHTTPStubs / HTTPStubs
HTTPStubs.stubRequests(condition: { $0.url?.path == "/profile" }) { _ in
  HTTPStubsResponse(jsonObject: ["name": "demo"], statusCode: 200, headers: nil)
}
```

For black-box tools (Maestro/Appium), stub at a proxy (mitmproxy/Charles) or run a local mock server and inject its URL via a test build flavor / launch argument.

## Pre-grant permissions

Runtime permission dialogs are out-of-process and a top flake source. Grant up front.

| Framework  | How                                                                   |
|------------|------------------------------------------------------------------------|
| Appium     | `appium:autoGrantPermissions: true` (Android), `appium:autoAcceptAlerts: true` (iOS) |
| Espresso   | `@get:Rule GrantPermissionRule.grant(Manifest.permission.CAMERA, ...)` |
| XCUITest   | `addUIInterruptionMonitor { ... allow ... }` then a follow-up `app.tap()` |
| Detox      | `device.launchApp({ permissions: { camera: 'YES', notifications: 'NO' } })` |
| Maestro    | `launchApp: { permissions: { camera: allow, location: deny } }`       |

## Test isolation & reset ladders

Each test must start from a known state. Use the cheapest reset that still guarantees cleanliness.

- **Appium**: `noReset:true` (reuse — fastest) → default (clear app data) → `fullReset:true` (uninstall+reinstall — cleanest).
- **Detox**: `launchApp({ newInstance:true })` (new process) → `resetContentAndSettings()` → delete+reinstall build.
- **Espresso/XCUITest**: relaunch the activity/app per test; clear app data/`UserDefaults`/DB in setup; pass launch args/flags to enter a clean test mode.

Reset state between tests via app launch flags (`-UITestMode`, `launchArguments`) that wipe DB/prefs and seed deterministic fixtures.

## Hermetic test checklist

- No real network — everything stubbed.
- No real time dependence — control the clock / use idle waits, not sleeps.
- Animations off.
- Permissions pre-granted.
- Fresh, seeded state per test (clear DB/prefs).
- Fixed locale/timezone (launch args) so date/number formatting is deterministic.
- Stable locators (accessibility id / resource-id / testID), not XPath or text that localizes.

## Causes → fixes

| Symptom                                   | Root cause                          | Fix                                                        |
|-------------------------------------------|-------------------------------------|------------------------------------------------------------|
| "Element not found" intermittently        | Acting before render               | Conditional wait on the element; Detox/Maestro auto-wait   |
| "Not hittable / view not stable"          | Animation in progress              | Disable animations (adb scales 0); `waitForAnimationToEnd` |
| Passes locally, fails in CI               | Slower CI device, real network     | Stub network; raise wait timeouts; disable animations      |
| First run passes, reruns fail             | Leftover state                     | Reset ladder; clear DB/prefs in setup                      |
| Random permission-dialog failures         | OS dialog steals focus             | Pre-grant permissions per framework                        |
| Flaky on dates/currency                   | Device locale/timezone varies      | Pin locale + timezone via launch args                      |
| AmbiguousViewMatcher / multiple matches   | Loose locator                      | Tighten matcher (id + parent + isDisplayed); use index last |
| Slow + flaky XPath lookups                | XPath (esp. iOS page-source)       | Switch to accessibility id / resource-id / class-chain     |
| Test hangs forever (Detox)                | Infinite animation/poll keeps app busy | `disableSynchronization()` / `setURLBlacklist` around it |
| Network-driven flake (Espresso)           | Background call not tracked        | Register `IdlingResource`                                  |

## Operational hygiene

- Quarantine, don't ignore: tag a newly-flaky test, file a ticket, fix the cause.
- Retry-on-fail (e.g. CI rerun x2) hides flakiness — use it as a signal/metric, not a cure.
- Track flake rate per test; a test failing >1% intermittently is a bug in the test.
