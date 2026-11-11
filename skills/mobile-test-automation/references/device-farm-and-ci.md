# AWS Device Farm & Mobile CI

Run mobile tests on real devices in the cloud and wire them into CI/CD. AWS Device Farm is the AWS-native option; BrowserStack/Sauce win for fleet size and framework breadth. Always confirm current frameworks/pricing via the **AWS Knowledge MCP** (`aws-knowledge-mcp-server`) — Device Farm details change.

## AWS Device Farm: supported frameworks (READ THIS FIRST)

> **CRITICAL caveat:** AWS Device Farm's service-side (managed) test runner does **not** support every mobile framework. Notably, frameworks like **Detox**, **Flutter `integration_test`**, and **Maestro** are not first-class managed runners — and **Espresso** typically runs only when packaged as an Android **Instrumentation** test, not via a pure Espresso runner.
>
> **Do not hardcode the support list from memory — it changes.** Confirm the current set of supported test types for your chosen framework via the **AWS Knowledge MCP** (`aws-knowledge-mcp-server`) before committing to Device Farm in a decision file.

What this means in practice:

- If the team has committed to **Detox**, **Flutter**, or **Maestro**, treat AWS Device Farm as a likely poor fit and lean toward self-hosted runners, BrowserStack, or Sauce Labs.
- If the team uses **Appium** or **XCUITest**, Device Farm is usually a strong AWS-native fit.
- When in doubt, query the MCP for the exact supported `TestType` values rather than guessing.

## Pricing

Device Farm pricing (metered per-minute, free-trial minutes, and unmetered/private-device plans) **changes over time — do not quote figures from memory.** When a decision file needs cost guidance, look up current pricing via the **AWS Knowledge MCP** or the [AWS Device Farm pricing page](https://aws.amazon.com/device-farm/pricing/).

Rule of thumb (model, not numbers): heavy/continuous usage favors an unmetered/reserved plan; bursty/low usage favors metered per-minute.

## CodePipeline test action (native integration)

Device Farm is a first-class **Test** action provider in CodePipeline — no Lambda glue needed. Configure the action with your DF project ARN, device pool ARN, app artifact, test artifact, and `TestType`. The pipeline blocks on the run result.

```
Source (CodeCommit/GitHub) → Build (CodeBuild: build app + test pkg) → Test (AWS Device Farm action)
```

## GitHub → CodeBuild → Device Farm

There is **no first-party GitHub Actions action** for Device Farm. The supported patterns:

1. **CodeBuild bridge** (AWS-documented tutorial): GitHub webhook triggers CodeBuild, which builds artifacts and calls Device Farm. Clean for AWS-centric orgs.
2. **AWS CLI from a GitHub Actions workflow**: build in Actions, then `aws devicefarm schedule-run` directly.

```yaml
# .github/workflows/devicefarm.yml (CLI approach)
- uses: aws-actions/configure-aws-credentials@v4
  with: { role-to-assume: arn:aws:iam::123456789012:role/gha-devicefarm, aws-region: us-west-2 }
- name: Upload app + tests and schedule run
  run: |
    # create-upload → curl PUT to the presigned URL → schedule-run (abbreviated)
    aws devicefarm schedule-run \
      --project-arn "$DF_PROJECT_ARN" \
      --app-arn "$APP_ARN" \
      --device-pool-arn "$DEVICE_POOL_ARN" \
      --name "ci-$GITHUB_SHA" \
      --test type=APPIUM_NODE,testPackageArn=$TEST_PKG_ARN
```

> Note: Device Farm is a **us-west-2** service (schedule runs there regardless of where the rest of your stack lives).

A **Jenkins plugin** for Device Farm is also available for Jenkins-based pipelines.

## When AWS Device Farm vs BrowserStack vs Sauce Labs

| Need                                   | AWS Device Farm                  | BrowserStack / Sauce Labs        |
|----------------------------------------|----------------------------------|----------------------------------|
| Largest real-device fleet              | Moderate                         | **Broader**                      |
| Native Espresso runner                 | Instrumentation packaging only   | **Yes**                          |
| XCUITest / Appium                      | **Yes**                          | Yes                              |
| Maestro / Detox / Flutter              | Not first-class (verify via MCP) | Better support (varies)          |
| Biometrics / Apple Pay / SIM workflows | Limited                          | **Yes**                          |
| AWS-native CI integration (CodePipeline) | **Best**                       | Via API                          |

> Treat the per-framework cells as direction, not gospel — confirm current capabilities for your framework via the AWS Knowledge MCP (Device Farm) and the vendor docs (BrowserStack/Sauce).

**Decision**: AWS-native pipeline + Appium/XCUITest → **Device Farm**. Need the broadest device fleet, native Espresso/Maestro/Detox, or biometrics/Apple Pay/SIM scenarios → **BrowserStack** or **Sauce Labs**.

## Mobile CI notes

### Android on Linux + KVM (emulators)

Hardware-accelerated emulators need nested virtualization (KVM). On GitHub Actions Linux runners use `reactivecircus/android-emulator-runner` (enables KVM, boots an AVD, runs tests):

```yaml
- uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 34
    arch: x86_64
    profile: pixel_7
    disable-animations: true          # kill animation scales for determinism
    script: ./gradlew connectedDebugAndroidTest
```

### iOS needs macOS runners

iOS Simulator + Xcode build/test only run on **macOS runners** (`runs-on: macos-14`). They are pricier and lower in concurrency — keep iOS jobs lean, parallelize via simulator clones.

### AVD caching

Cache the AVD system image + snapshot to cut emulator cold-boot time (the emulator-runner supports an `actions/cache` step keyed on api-level/arch/profile, then `force-avd-creation: false`).

### Matrix sharding

Fan out across OS versions and device profiles with a job matrix; shard a large suite across runners (e.g. Espresso test sharding `numShards`/`shardIndex`, or split flow directories for Maestro) to keep wall-clock low.

### Signing & secrets

- iOS: store the **distribution certificate (.p12)** and **provisioning profile** as base64 CI secrets; import into a temporary keychain at job start; never commit them.
- Android: keep the **keystore** + passwords as secrets; sign release/test builds at build time.
- Device-cloud and AWS credentials: inject via OIDC role assumption (`configure-aws-credentials`) or masked secrets — never hardcode keys.
