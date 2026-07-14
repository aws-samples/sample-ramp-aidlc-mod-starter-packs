# Appium Setup & Patterns

Appium is the cross-platform, language-flexible, black-box option. It drives the real app through W3C WebDriver. Higher maintenance than Maestro/Detox — budget for explicit waits and driver upkeep — but it is the one framework AWS Device Farm runs service-side in any language binding.

## Install

```bash
# Appium 2.x server (Node 16+)
npm i -g appium

# Install platform drivers (Appium 2 ships no drivers by default)
appium driver install xcuitest      # iOS
appium driver install uiautomator2  # Android
appium driver list --installed

# Verify environment (Xcode, Android SDK, JDK, etc.)
npm i -g appium-doctor && appium-doctor

appium   # start the server on :4723 (base path /)
```

Client libs: `webdriverio` (JS), `Appium-Python-Client` (Python), `appium/java-client` (Java).

## Capabilities (W3C, `appium:` prefix)

```python
from appium import webdriver
from appium.options.android import UiAutomator2Options

opts = UiAutomator2Options().load_capabilities({
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:deviceName": "Pixel_7_API_34",
    "appium:app": "/abs/path/app-debug.apk",
    "appium:autoGrantPermissions": True,   # pre-grant runtime perms (no dialog flake)
    "appium:disableWindowAnimation": True, # kill animations for determinism
    "appium:noReset": False,               # keep app data between sessions if True
    "appium:fullReset": False,             # uninstall+reinstall if True (slow, clean)
    "appium:newCommandTimeout": 120,
})
driver = webdriver.Remote("http://127.0.0.1:4723", options=opts)
```

iOS equivalents: `automationName: "XCUITest"`, `autoAcceptAlerts: true` (auto-dismiss system alerts), `autoGrantPermissions` is Android-only.

**Reset ladder** (fastest → cleanest): `noReset:true` (reuse state) → default (clear app data) → `fullReset:true` (uninstall/reinstall). Prefer the fastest level that still gives a clean, hermetic start.

## Locator strategies

Prefer stable, app-assigned IDs. **Avoid XPath** — roughly 10x slower, and on iOS each XPath query forces a full page-source snapshot.

```python
from appium.webdriver.common.appiumby import AppiumBy

# BEST: accessibility id → iOS accessibilityIdentifier / Android content-description
driver.find_element(AppiumBy.ACCESSIBILITY_ID, "login_button")

# Android resource-id
driver.find_element(AppiumBy.ID, "com.example:id/login_button")

# iOS class chain / Android UiAutomator (fast, native engines)
driver.find_element(AppiumBy.IOS_CLASS_CHAIN, '**/XCUIElementTypeButton[`label == "Login"`]')
driver.find_element(AppiumBy.ANDROID_UIAUTOMATOR, 'new UiSelector().resourceId("com.example:id/login_button")')

# AVOID
driver.find_element(AppiumBy.XPATH, '//android.widget.Button[@text="Login"]')
```

Set `accessibilityIdentifier` (iOS), `resource-id`/`contentDescription` (Android), or `testID` (RN) in app code so locators are stable.

## Appium Inspector

GUI to attach to a live session and read the element tree, attributes, and suggested locators. Download the standalone Appium Inspector app, point it at `http://127.0.0.1:4723` with your caps, and click elements to harvest `accessibility id` / `resource-id`. Use it to author locators, not XPath.

## Gestures (use mobile: commands, not raw coordinates)

```python
# Swipe within an element (W3C-backed, resolution-independent)
driver.execute_script("mobile: swipeGesture", {
    "elementId": el.id, "direction": "up", "percent": 0.8
})
# Scroll a container until criteria met
driver.execute_script("mobile: scrollGesture", {
    "elementId": container.id, "direction": "down", "percent": 1.0
})
# Other useful: mobile: pinchOpenGesture, mobile: dragGesture, mobile: longClickGesture
```

Raw `W3C Actions` with pixel coordinates break across screen sizes — reach for them only when no gesture command fits.

## Parallel session isolation

Each concurrent device needs unique identifiers, or sessions collide:

```json
// device A
{ "appium:udid": "EMULATOR-5554", "appium:systemPort": 8201,
  "appium:wdaLocalPort": 8101, "appium:derivedDataPath": "/tmp/wda_A" }
// device B
{ "appium:udid": "EMULATOR-5556", "appium:systemPort": 8202,
  "appium:wdaLocalPort": 8102, "appium:derivedDataPath": "/tmp/wda_B" }
```

- Android: unique `udid` + `systemPort` (UiAutomator2 server port).
- iOS: unique `udid` + `wdaLocalPort` (WebDriverAgent) + `derivedDataPath` (avoid WDA build clashes).

## Minimal end-to-end test (Python + pytest)

```python
def test_login(driver):
    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "username").send_keys("demo")
    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "password").send_keys("secret")
    driver.find_element(AppiumBy.ACCESSIBILITY_ID, "login_button").click()

    # Explicit wait — never time.sleep()
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    el = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, "home_title"))
    )
    assert el.text == "Welcome"
```

See `flakiness-mobile.md` for waits, stubbing, and permission handling.
