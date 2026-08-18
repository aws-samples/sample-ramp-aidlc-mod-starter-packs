# Gestures, Deep Links, Network Conditions & App Lifecycle

## Gestures — semantic APIs, never raw coordinates

Pixel coordinates break across screen sizes, densities, and notches. Use each framework's semantic gesture API.

| Action       | Appium                                      | Espresso                                  | XCUITest                       | Maestro            | Detox                       |
|--------------|---------------------------------------------|-------------------------------------------|--------------------------------|--------------------|-----------------------------|
| Swipe        | `mobile: swipeGesture {direction, percent}` | `swipeUp()` / `ViewActions`               | `swipeUp()`/`swipeLeft()`      | `swipe: {direction}` | `el.swipe('up')`          |
| Scroll to    | `mobile: scrollGesture`                     | `scrollTo()`, `RecyclerViewActions.scrollTo` | `swipeUp` until visible     | `scrollUntilVisible` | `whileElement(...).scroll()` |
| Long press   | `mobile: longClickGesture`                  | `longClick()`                             | `press(forDuration:)`          | `longPressOn`      | `el.longPress()`            |
| Pinch/zoom   | `mobile: pinchOpenGesture`                  | (GeneralSwipeAction)                      | `pinch(withScale:velocity:)`   | n/a                | `el.pinch()`                |
| Drag         | `mobile: dragGesture`                       | `GeneralSwipeAction`                      | `press(forDuration:thenDragTo:)` | n/a              | `el.longPressAndDrag(...)`  |

```python
# Appium — scroll a container down, no coordinates
driver.execute_script("mobile: scrollGesture",
    {"elementId": list_el.id, "direction": "down", "percent": 1.0})
```

```kotlin
// Espresso — scroll RecyclerView to an item then click it
onView(withId(R.id.recycler))
  .perform(RecyclerViewActions.actionOnItem<VH>(hasDescendant(withText("Profile")), click()))
```

Raw-coordinate gestures (`W3C Actions`, `coordinate(withNormalizedOffset:)`, Maestro `point:`) are a last resort.

## Deep links — jump straight to a screen

Skip multi-step navigation; launch the app directly at the target screen. Faster and less flaky.

```bash
# Android (adb) — open a deep link / URI
adb shell am start -W -a android.intent.action.VIEW -d "myapp://product/42" com.example.app
```

```python
# Appium
driver.execute_script("mobile: deepLink", {"url": "myapp://product/42", "package": "com.example.app"})
```

```js
// Detox — relaunch directly at a URL
await device.launchApp({ newInstance: true, url: 'myapp://product/42' });
// or while running:
await device.openURL({ url: 'myapp://product/42' });
```

```swift
// XCUITest
app.open(URL(string: "myapp://product/42")!)
```

```yaml
# Maestro
- openLink: "myapp://product/42"
```

Universal/App Links (https://) behave the same way; verify the OS routes them to the app (association files configured) rather than the browser.

## Network condition simulation (offline / 3G / latency)

Test the app under degraded and absent connectivity — the most common real-world failure mode.

```bash
# Android emulator — toggle data, throttle speed/latency via emulator console
adb shell svc data disable        # go offline (mobile data)
adb shell svc wifi disable
# Emulator console: set network speed/delay
telnet localhost 5554             # then: network speed gsm   /  network delay gprs
```

- **Detox**: has **no** built-in network-throttling API (`device.setStatusBar` only changes the iOS status-bar *appearance*, not real connectivity). Throttle at the platform layer instead — Network Link Conditioner on iOS, the emulator console / `adb svc` on Android, or a proxy (e.g. Charles, mitmproxy) — and assert the app's offline/retry behaviour. The most reliable approach is to **stub the network** so you control responses and can simulate slow/failed calls deterministically (see `flakiness-mobile.md`).
- **iOS**: enable the **Network Link Conditioner** (Developer settings on device; Additional Tools on macOS for the Simulator) to emulate 3G/Edge/high-latency/100% loss profiles.
- **Appium**: Android `driver.set_network_connection(...)` (airplane/wifi/data bitmask).
- **Device clouds**: BrowserStack/Sauce expose network-profile and offline toggles per session.

Assert: offline banners, retry logic, cached-content fallback, queued writes that flush on reconnect.

## App lifecycle tests

These catch defects unit tests can't: state loss, crash-on-resume, broken cold-start paths.

### Background / foreground

```python
driver.background_app(5)                       # Appium: background 5s then resume
```
```swift
XCUIDevice.shared.press(.home); app.activate() // XCUITest: home then reactivate
```
```js
await device.sendToHome(); await device.launchApp({ newInstance: false }); // Detox: resume same instance
```
Assert: in-progress form data preserved, timers/polling resumed, no duplicate network calls.

### Process death recovery (state restoration)

Android kills backgrounded apps under memory pressure; the app must restore from saved state.

```bash
# Simulate: background the app, then kill the process, then relaunch
adb shell am kill com.example.app     # kill (as if reclaimed) — distinct from force-stop
```
Detox: `await device.terminateApp(); await device.launchApp({ newInstance: false });`
Assert: navigation stack and screen state restored (savedInstanceState / state restoration), not reset to home.

### Launch from notification

```bash
# Trigger a notification intent (or push via FCM test tooling), then tap it
adb shell am start -a android.intent.action.VIEW -d "myapp://order/99" com.example.app
```
Assert: tapping the notification deep-links to the correct screen from both cold and warm start.

### App upgrade / DB migration

Install the **old** build, generate data, then install the **new** build over it (no uninstall) and verify migration.

```bash
adb install old-app.apk
# ... drive app to create data ...
adb install -r new-app.apk            # -r = reinstall keeping data; exercises DB/schema migration
```
Appium: set `noReset:true` and sequence two app versions. Assert: persisted data survives, schema migrations run, no crash on first launch of the new version.
