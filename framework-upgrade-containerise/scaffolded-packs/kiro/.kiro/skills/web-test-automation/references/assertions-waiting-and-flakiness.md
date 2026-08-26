# Assertions, Waiting, and Flakiness

**The single biggest source of flaky web tests is bad waiting.** Use web-first auto-retrying assertions, never fixed sleeps, and wait on real signals (responses, events, locator state). This file is the most important in the skill — internalize it.

## Web-first, auto-retrying assertions

Playwright's `expect(locator)` assertions automatically poll and retry until the condition is met or the timeout expires. They replace manual waits entirely.

```ts
// ✅ Auto-retries until visible (or timeout). No manual wait needed.
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
await expect(page.getByTestId('cart-count')).toHaveText('3');
await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
await expect(page).toHaveURL(/\/dashboard$/);
await expect(page.getByRole('listitem')).toHaveCount(5);
```

Key auto-retrying assertions: `toBeVisible`, `toBeHidden`, `toBeEnabled`, `toBeChecked`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveCount`, `toHaveURL`, `toHaveAttribute`, `toBeFocused`.

Non-retrying assertions (plain values) do **not** poll — use them only for already-resolved data:

```ts
expect(items.length).toBe(3);          // synchronous, no retry
expect(await locator.count()).toBe(3); // ❌ snapshot — prefer toHaveCount which retries
```

Note that actions like `click()`, `fill()`, and `check()` already auto-wait for the element to be actionable (visible, stable, enabled, receives events). You rarely need an explicit wait before an action.

## NEVER use fixed sleeps

```ts
await page.waitForTimeout(3000); // ❌ NEVER. Flaky AND slow. Banned in committed tests.
```

A fixed sleep is simultaneously too short (flaky on a slow CI run) and too long (wastes time on a fast run). There is always a better signal to wait on. If you genuinely cannot find one, that's a smell in the app, not a reason to sleep.

## Wait on real signals

### Wait for a network response

```ts
// Start waiting BEFORE the action that triggers the request.
const responsePromise = page.waitForResponse(
  (r) => r.url().includes('/api/orders') && r.status() === 200
);
await page.getByRole('button', { name: 'Place order' }).click();
const response = await responsePromise;
expect(response.ok()).toBeTruthy();
```

### Wait for a specific request

```ts
const reqPromise = page.waitForRequest('**/api/checkout');
await page.getByRole('button', { name: 'Pay' }).click();
await reqPromise;
```

### Cypress equivalent: intercept aliases

```js
cy.intercept('POST', '/api/orders').as('createOrder');
cy.get('[data-cy=place-order]').click();
cy.wait('@createOrder').its('response.statusCode').should('eq', 200);
```

`cy.wait('@alias')` is the Cypress way to block on a request — never `cy.wait(3000)`.

## Catch un-awaited promises at build time

A missing `await` on a Playwright call is a top flakiness cause — the assertion/action never actually runs to completion. Enforce against it statically.

```jsonc
// .eslintrc — requires @typescript-eslint parser + type info
{
  "rules": {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error"
  }
}
```

Run type-checking in CI as a gate:

```bash
npx tsc --noEmit
npx eslint . --max-warnings=0
```

These two commands catch the overwhelming majority of "I forgot to await" bugs before they ever flake.

## Trace Viewer: debug flakiness post-mortem

Enable traces and inspect exactly what happened on a failed/retried run.

```ts
// playwright.config.ts
export default defineConfig({
  use: { trace: 'on-first-retry' },  // capture only when a test retries
});
```

```bash
npx playwright show-trace test-results/.../trace.zip
# or open the HTML report and click the trace icon on a failed test
npx playwright show-report
```

The trace gives a timeline, DOM snapshots before/after each action, network log, console, and source — usually enough to diagnose a flake without re-running.

## Harden a suspect test

Run a test many times to surface intermittent flakiness before it hits CI:

```bash
npx playwright test login.spec.ts --repeat-each=20
npx playwright test --grep @flaky --repeat-each=50 --workers=1
```

A test that passes 50/50 with `--repeat-each` is solid. If it fails even once, it's flaky — fix it, don't retry it away.

## Common flakiness causes and fixes

| Cause                                          | Symptom                                | Fix                                                       |
|------------------------------------------------|----------------------------------------|-----------------------------------------------------------|
| Fixed `waitForTimeout` / `cy.wait(ms)`         | Random timeouts on slow runs           | Wait on response/event/locator state instead              |
| Missing `await` on action/assertion            | Assertion seems to "not run"           | `no-floating-promises` lint + `tsc --noEmit`              |
| Asserting before async render completes        | Element "not found" intermittently     | Use auto-retrying `expect(locator).toBeVisible()`         |
| Reading `await locator.count()` once           | Off-by-one counts                      | Use retrying `toHaveCount(n)`                             |
| Animations / transitions                       | Click lands mid-animation              | Auto-wait handles most; else assert final state first     |
| Shared state between tests                      | Pass alone, fail in suite              | Isolate tests; seed fresh state per test                  |
| Time/locale/timezone dependence                | Fails at midnight / in CI region       | Pin clock (`page.clock`), fix `TZ`, mock dates            |
| Network variability (real backend)             | Sporadic 5xx / latency                 | Mock unstable third-party calls (`page.route`)            |
| Auto-generated CSS class selectors             | "element not found" after deploy       | Role/testid locators                                      |
| Race on navigation                              | Acts on old page                       | `await expect(page).toHaveURL(...)` before interacting    |
| Hard-coded test data collisions                | Unique-constraint failures in parallel | Generate unique data per test (timestamps/uuids)          |

## Rules of thumb

- If you typed `waitForTimeout` or `cy.wait(<number>)`, stop and find the real signal.
- Prefer `await expect(locator).toBeVisible()` over `waitForSelector`.
- Wait *before* triggering, await *after*: set up `waitForResponse` then click.
- A flaky test is a failing test. Quarantine and fix; do not paper over with retries.
