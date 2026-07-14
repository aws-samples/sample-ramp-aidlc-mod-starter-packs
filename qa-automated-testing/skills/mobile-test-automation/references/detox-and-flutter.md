# Detox (React Native) & Flutter Testing

## Detox — React Native gray-box

Detox is the deterministic choice for React Native. It runs gray-box: it hooks into the RN runtime and **automatically waits** until the app is idle — no in-flight network requests, no pending timers, no running animations, empty JS event loop — before acting or asserting. This removes the single biggest source of mobile flakiness. Detox does **not** support Flutter (see below).

### When to disable synchronization

Detox blocks until idle, so an infinite animation, a long-poll, or an endless timer will hang the test. Selectively relax sync:

```js
await device.disableSynchronization();   // stop auto-waiting (e.g. infinite spinner)
// ... interact while busy ...
await device.enableSynchronization();
// Or per-URL: ignore a long-polling endpoint
await device.setURLBlacklist(['.*\\/poll', '.*\\/analytics']);
```

### testID → by.id

Add `testID` in RN components; match with `by.id`.

```jsx
<TextInput testID="email_field" />
<Button testID="login_button" title="Login" />
```

```js
await element(by.id('email_field')).typeText('demo@example.com');
await element(by.id('login_button')).tap();
await expect(element(by.id('home_title'))).toBeVisible();
```

### launchApp: permissions, url, newInstance

```js
await device.launchApp({
  newInstance: true,                       // fresh process (reset ladder: cheapest reset)
  permissions: { notifications: 'YES', camera: 'NO', location: 'inuse' },
  url: 'myapp://product/42',               // deep link straight to a screen
});

// Reset ladder (cheap → thorough):
await device.launchApp({ newInstance: true });   // new process
await device.resetContentAndSettings();          // simulator-level reset (iOS)
// delete + reinstall the app build for a fully clean slate (slowest)
```

### .detoxrc.js, build, test

```js
// .detoxrc.js
module.exports = {
  apps: {
    'ios.debug':   { type: 'ios.app',   binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/App.app',
                     build: 'xcodebuild -workspace ios/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build' },
    'android.debug': { type: 'android.apk', binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
                       build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug' },
  },
  devices: {
    sim:  { type: 'ios.simulator', device: { type: 'iPhone 15' } },
    emu:  { type: 'android.emulator', device: { avdName: 'Pixel_7_API_34' } },
  },
  configurations: {
    'ios.sim.debug':  { device: 'sim', app: 'ios.debug' },
    'android.emu.debug': { device: 'emu', app: 'android.debug' },
  },
};
```

```bash
detox build  --configuration ios.sim.debug
detox test   --configuration ios.sim.debug
```

### expect / waitFor

```js
// Synchronous-style assertion (auto-waited)
await expect(element(by.id('cart_badge'))).toHaveText('3');

// Explicit conditional wait when you must bound it — never a hard sleep
await waitFor(element(by.id('results_list')))
  .toBeVisible()
  .withTimeout(8000);

await waitFor(element(by.text('Load more')))
  .toBeVisible()
  .whileElement(by.id('scroll_view'))
  .scroll(300, 'down');
```

> AWS Device Farm note: Detox is **not** a service-side framework on AWS Device Farm. Run Detox on self-hosted runners, BrowserStack, or Sauce Labs. See `device-farm-and-ci.md`.

## Flutter — Detox does NOT apply

For Flutter, pick one (or both):

- **Maestro** for black-box E2E across the rendered UI (covers Flutter natively). See `maestro-flows.md`.
- **`integration_test`** (official Flutter package) for in-process integration tests with full widget-tree access.

### integration_test

```yaml
# pubspec.yaml
dev_dependencies:
  integration_test:
    sdk: flutter
  flutter_test:
    sdk: flutter
```

```dart
// integration_test/login_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:myapp/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();                 // wait for frames/animations to settle

    await tester.enterText(find.byKey(const Key('email_field')), 'demo@example.com');
    await tester.tap(find.byKey(const Key('login_button')));
    await tester.pumpAndSettle();

    expect(find.text('Welcome'), findsOneWidget);  // finder by text
    expect(find.byKey(const Key('home_title')), findsOneWidget); // finder by key
  });
}
```

```bash
# Run on a connected device/emulator (in-process, full widget access)
flutter test integration_test/login_test.dart
flutter test integration_test            # whole directory
```

Use `find.byKey` (assign `Key('...')` in widgets) for stable finders; `find.text` for visible labels. `pumpAndSettle()` is the Flutter idle-wait — never `Future.delayed` as a substitute. For real-device cloud execution, drive `integration_test` builds through `flutter drive` or run Maestro flows on the device cloud instead.
