# Device Strategy: Emulators, Simulators & Real Devices

The right mix: **emulators/simulators for the fast inner loop and the bulk of CI; real devices for what virtual devices can't fake.** Don't run everything on real devices (slow, expensive) and don't ship having only tested on virtual ones (you'll miss hardware/perf bugs).

## Tradeoffs

| Dimension          | Emulator / Simulator                     | Real device                                  |
|--------------------|------------------------------------------|----------------------------------------------|
| Speed              | Fast boot, snapshots, parallel on cheap CI | Slower, limited parallelism                  |
| Cost               | Free / cheap compute                     | Hardware or device-cloud per-minute fees     |
| Scale in CI        | Easy fan-out (matrix sharding)           | Constrained by device count                  |
| Sensors/camera/GPS | Faked/limited                            | Real                                         |
| Biometrics         | Simulated enroll only                    | Real Touch ID / Face ID / fingerprint        |
| Performance/memory | **Unrepresentative**                     | Accurate                                     |
| GPU/graphics       | Host GPU, not device GPU                 | Real GPU behavior                            |
| Carrier/SIM        | None                                     | Real SMS/calls/eSIM/carrier flows            |
| Payments           | No real Apple Pay/Google Pay/NFC         | Real wallet/NFC                              |
| Store install      | Sideloaded only                          | Real Play/App Store install path             |

## What MUST be tested on real devices

- **Biometrics** — Face ID / Touch ID / fingerprint enroll and auth.
- **Camera & sensors** — real capture, accelerometer, gyroscope, barometer, ambient light.
- **GPS / location** — real fix acquisition, accuracy, background location.
- **GPU / graphics & games** — rendering, frame pacing, thermal throttling.
- **Performance & memory** — startup time, jank, OOM, battery — virtual devices lie here.
- **Carrier / SIM** — SMS OTP autofill, call interruptions, eSIM, roaming.
- **Payments / NFC** — Apple Pay, Google Pay, tap-to-pay.
- **Push notifications** — real APNs/FCM delivery and tap-through.
- **Store install path** — fresh install/upgrade from the actual store package.

## iOS Simulator: specific inaccuracies

The iOS Simulator runs x86/ARM macOS code, not the device OS, so it is **unreliable for**:

- **Performance & memory** — different CPU/memory model; timing and footprint don't match hardware.
- **Network** — uses the Mac's stack; not representative of cellular/device radio behavior.
- **Graphics/Metal** — host GPU, different drivers.
- No camera, real Face ID, sensors, push (APNs), or App Store install.

Use the Simulator for functional/logic flows; validate perf, memory, network, and hardware on real iPhones.

## Building the device matrix from user analytics

Don't guess — pull the real distribution from your analytics (Firebase / App Store Connect / Play Console / mobile analytics) and weight coverage accordingly.

Dimensions to cover:

1. **OS version** — top N versions covering ~90–95% of your users (e.g. last 3 Android API levels, last 2–3 iOS majors). Always include the **oldest still-supported** version and the **newest/beta** version.
2. **Screen size / density** — smallest and largest active form factors (small phone, large phone, tablet/foldable if present). Layout bugs cluster at the extremes.
3. **Manufacturer / chipset (Android)** — Samsung dominates; include the top OEMs in your data (Samsung, Xiaomi, Google Pixel, etc.) because OEM skins/permissions/back-gesture behavior differ.
4. **Hardware tier** — at least one low-end device (the "1% battery, 2GB RAM" reality) plus a flagship.

Example tiered matrix:

```text
Tier 1 (every CI run, emulators/simulators):
  Android: Pixel API 34 (newest), Pixel API 31 (oldest supported)   small + large screen
  iOS:     iPhone 15 (iOS 17), iPhone SE (small)                     newest + smallest

Tier 2 (nightly, real device cloud):
  Samsung Galaxy S24 (One UI), Xiaomi (MIUI), low-end Android (Go/2GB)
  iPhone 13 (one major back), iPad (tablet layout)

Tier 3 (pre-release, real devices):
  Biometrics / camera / payments / push on physical flagship + low-end
```

## Cost / speed strategy

- **Inner loop & PR gate**: emulators/simulators only — fast, free, parallel. Disable animations, stub network (see `flakiness-mobile.md`).
- **Nightly / merge to main**: add a real-device cloud run across Tier 2 (BrowserStack/Sauce/AWS Device Farm — see `device-farm-and-ci.md`).
- **Pre-release**: full real-device matrix including hardware-only scenarios (Tier 3).
- Re-derive the matrix every quarter — user OS/device distribution shifts, and so should coverage.

Rule of thumb: maximize functional coverage on cheap virtual devices; spend real-device minutes only on what virtual devices physically cannot validate.
