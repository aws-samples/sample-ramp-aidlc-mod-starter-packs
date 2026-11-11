# CI and Parallelization

**Run fast, parallel, and reproducible.** Playwright parallelizes within a machine (workers) and across machines (sharding). Enable retries only in CI, capture traces on first retry, and upload the HTML report + traces as artifacts so failures are debuggable.

## Config for parallel + CI

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,                       // parallelize tests within files too
  workers: process.env.CI ? '50%' : undefined, // tune per runner; default = CPU/2
  retries: process.env.CI ? 2 : 0,           // retries in CI ONLY — never mask local flakes
  forbidOnly: !!process.env.CI,              // fail CI if a stray test.only is committed
  reporter: process.env.CI
    ? [['html'], ['github'], ['blob']]       // blob reporter enables report merging
    : 'list',
  use: {
    trace: 'on-first-retry',                 // capture trace only when retrying
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

- `fullyParallel: true` runs tests inside the same file concurrently (default is file-level parallelism only).
- `workers` controls parallel processes per machine. `'50%'` of cores is a safe CI default.
- **Retries in CI only.** Locally, `retries: 0` so flakes surface immediately. A test that needs retries to pass is still broken — fix it.

## GitHub Actions: basic workflow

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps   # browsers + OS deps on Linux
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

`--with-deps` installs the OS-level libraries the browsers need on Linux runners — required, not optional.

## Sharding across machines

Split the suite across N parallel runners with `--shard`, then merge the blob reports into one HTML report.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    if: ${{ !cancelled() }}
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with: { name: html-report, path: playwright-report/, retention-days: 14 }
```

The `blob` reporter (set in config) produces shard-local results that `merge-reports` stitches into a single browsable HTML report with traces intact.

## Debugging CI failures

- Download the `playwright-report` / `html-report` artifact and open it: `npx playwright show-report <dir>`.
- Each failed test that retried carries a trace (because `trace: 'on-first-retry'`). Click it, or `npx playwright show-trace <trace.zip>`.
- Screenshots and videos are attached for failures via the config above.

## GitLab CI note

Same shape: use the official image and `parallel` keyword for sharding.

```yaml
test:
  image: mcr.microsoft.com/playwright:v1.55.0-noble
  parallel: 4
  script:
    - npm ci
    - npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
  artifacts:
    when: always
    paths: [playwright-report/, blob-report/]
```

Using the official Playwright Docker image means browsers/deps are preinstalled (skip `install --with-deps`).

## Cypress parallelization (brief)

Cypress parallelization runs through **Cypress Cloud** (paid), which load-balances specs across machines:

```bash
cypress run --record --parallel --key <record-key>
```

There is no free built-in cross-machine sharding equivalent to Playwright's `--shard`; community plugins exist but are less seamless. This is one more reason Playwright is the default for new projects.
