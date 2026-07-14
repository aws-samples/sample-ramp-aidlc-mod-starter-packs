# Espresso (Android) & XCUITest (iOS)

Native, in-process UI test frameworks. They ship with the app, run fastest on their own platform, and (unlike Detox/Maestro) are first-class on AWS Device Farm as Instrumentation / XCTest / XCUITest. Use them for deep, platform-specific coverage; layer a Maestro smoke suite on top for breadth.

## Espresso (Android, Kotlin/Java)

Espresso auto-syncs with the UI thread and the message queue, so basic interactions need no explicit waits. Discipline: match → perform/check.

```kotlin
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*

@RunWith(AndroidJUnit4::class)
class LoginTest {
  @get:Rule val activityRule = ActivityScenarioRule(MainActivity::class.java)

  @Test fun login_succeeds() {
    onView(withId(R.id.email)).perform(typeText("demo@example.com"), closeSoftKeyboard())
    onView(withId(R.id.password)).perform(typeText("secret"), closeSoftKeyboard())
    onView(withId(R.id.login_button)).perform(click())
    onView(withId(R.id.home_title)).check(matches(withText("Welcome")))
  }
}
```

### Matcher discipline

Combine matchers to target exactly one view; a loose matcher throws `AmbiguousViewMatcherException`.

```kotlin
onView(allOf(withId(R.id.title), withParent(withId(R.id.header)), isDisplayed()))
onView(withContentDescription("Cart"))      // content-description for icon buttons
```

### IdlingResource for async

Espresso does not know about background threads, OkHttp calls, RxJava, or coroutines. Register an `IdlingResource` so Espresso waits for them instead of you adding sleeps.

```kotlin
val idlingResource = CountingIdlingResource("network")
// app code: idlingResource.increment() before work, .decrement() in finally
@Before fun setup() { IdlingRegistry.getInstance().register(idlingResource) }
@After  fun tearDown() { IdlingRegistry.getInstance().unregister(idlingResource) }
```

### RecyclerView

```kotlin
onView(withId(R.id.recycler))
  .perform(RecyclerViewActions.actionOnItem<VH>(hasDescendant(withText("Item 42")), click()))
onView(withId(R.id.recycler))
  .perform(RecyclerViewActions.scrollTo<VH>(hasDescendant(withText("Settings"))))
```

### GrantPermissionRule (pre-grant runtime permissions)

```kotlin
@get:Rule val perms = GrantPermissionRule.grant(
  android.Manifest.permission.CAMERA,
  android.Manifest.permission.ACCESS_FINE_LOCATION,
)
```

### Disable animations

Espresso can be unreliable with animations on. Disable at the device level (see `flakiness-mobile.md`):

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

## XCUITest (iOS, Swift)

```swift
import XCTest

final class LoginUITests: XCTestCase {
  let app = XCUIApplication()

  override func setUp() {
    continueAfterFailure = false
    app.launchArguments += ["-UITestMode", "YES"]   // flag for test-only stubbing
    app.launch()
  }

  func testLogin() {
    app.textFields["email_field"].tap()             // accessibilityIdentifier
    app.textFields["email_field"].typeText("demo@example.com")
    app.secureTextFields["password_field"].typeText("secret")
    app.buttons["login_button"].tap()

    let home = app.staticTexts["home_title"]
    XCTAssertTrue(home.waitForExistence(timeout: 8)) // conditional wait, never sleep()
  }
}
```

Set `accessibilityIdentifier` in app code (`view.accessibilityIdentifier = "login_button"`) — stable and invisible to users, unlike labels.

### Conditional waits — waitForExistence / XCTWaiter / expectations

```swift
// Simple existence wait
XCTAssertTrue(app.staticTexts["done"].waitForExistence(timeout: 5))

// Wait on an arbitrary predicate
let exists = NSPredicate(format: "exists == true")
let exp = XCTNSPredicateExpectation(predicate: exists, object: app.cells["row_0"])
XCTWaiter().wait(for: [exp], timeout: 10)

// XCTestExpectation for async app events
let e = expectation(description: "loaded")
// fulfill e from a notification/callback...
wait(for: [e], timeout: 10)
```

### addUIInterruptionMonitor for permission dialogs

System alerts (notifications, location, camera, ATT) are out-of-process; tapping them directly is flaky. Register a monitor:

```swift
addUIInterruptionMonitor(withDescription: "System Dialog") { alert in
  if alert.buttons["Allow"].exists { alert.buttons["Allow"].tap(); return true }
  if alert.buttons["Allow While Using App"].exists { alert.buttons["Allow While Using App"].tap(); return true }
  return false
}
app.tap()   // a follow-up interaction triggers the monitor
```

### Gestures (no raw coordinates) & deep links

```swift
app.swipeUp(); app.swipeDown()
app.cells.element(boundBy: 0).swipeLeft()
app.images["photo"].pinch(withScale: 2.0, velocity: 1.0)
app.collectionViews.firstMatch.swipeUp()

app.open(URL(string: "myapp://product/42")!)   // deep link to a screen
```

Use semantic gestures (`swipeUp`, `pinch`, `press(forDuration:)`) — coordinate-based `coordinate(withNormalizedOffset:)` only when nothing else fits. See `gestures-lifecycle-and-deeplinks.md`.
