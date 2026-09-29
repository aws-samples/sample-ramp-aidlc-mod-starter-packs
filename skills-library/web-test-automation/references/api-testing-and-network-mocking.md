# API Testing and Network Mocking

**Use the API for speed and stability; mock only what you don't control.** Playwright's `request` fixture drives real HTTP for API tests and precondition setup. `page.route` intercepts browser traffic for mocking. Mock third-party/unstable dependencies — not your own backend you're trying to verify.

## API testing with the `request` fixture

`APIRequestContext` lets you make HTTP calls without a browser — ideal for pure API tests and for setting up/tearing down state in E2E tests.

```ts
import { test, expect } from '@playwright/test';

test('creates and retrieves an order via API', async ({ request }) => {
  const create = await request.post('/api/orders', {
    data: { sku: 'KB-01', qty: 2 },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();

  const get = await request.get(`/api/orders/${id}`);
  expect(get.ok()).toBeTruthy();
  expect(await get.json()).toMatchObject({ sku: 'KB-01', qty: 2 });
});
```

Configure a base URL and default headers once:

```ts
// playwright.config.ts
use: {
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  extraHTTPHeaders: { Accept: 'application/json' },
}
```

## Preconditions and postconditions via API

Drive setup/cleanup through the API instead of the UI — faster and far less flaky.

```ts
test.beforeEach(async ({ request }) => {
  await request.post('/api/test/reset');                 // known state
  await request.post('/api/projects', { data: { name: 'Seed' } });
});
```

## Share storageState between API and browser

Authenticate once with the request context, persist the state, and reuse it for both API and browser contexts so they share the same session.

```ts
// In auth.setup.ts — import the `request` API object to build a context.
// (Don't call .newContext() on the { request } test fixture — that fixture
// is already an APIRequestContext and has no newContext() method.)
import { request } from '@playwright/test';

const ctx = await request.newContext();
await ctx.post('/api/login', { data: creds });
await ctx.storageState({ path: 'playwright/.auth/user.json' });
await ctx.dispose();
```

```ts
// Inside a test, get a fresh request context from the `playwright` fixture:
test('reuses the saved session', async ({ playwright }) => {
  const apiCtx = await playwright.request.newContext({
    storageState: 'playwright/.auth/user.json',
  });
  // ... apiCtx.get/post run as the authenticated user ...
  await apiCtx.dispose();
});
```

Now API precondition calls and browser actions run as the same authenticated user.

## Network mocking with page.route

`page.route` intercepts requests the *browser* makes. Fulfill, modify, or abort them.

```ts
// Stub a third-party response
await page.route('**/api.thirdparty.com/rates', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ usd: 1.0, eur: 0.92 }),
  });
});

// Block analytics / ads to speed up and de-flake
await page.route('**/*.{png,jpg,gif}', (route) => route.abort());
await page.route(/google-analytics\.com/, (route) => route.abort());

// Modify a real response
await page.route('**/api/flags', async (route) => {
  const res = await route.fetch();
  const json = await res.json();
  json.betaFeature = true;
  await route.fulfill({ response: res, json });
});
```

### HAR replay for full offline mocking

Record real traffic once, replay it deterministically.

```ts
// Record
await page.routeFromHAR('hars/checkout.har', { update: true });
// Replay (deterministic, offline)
await page.routeFromHAR('hars/checkout.har', { url: '**/api/**' });
```

## Cypress equivalent: cy.intercept

```js
// Stub
cy.intercept('GET', '/api/rates', { fixture: 'rates.json' }).as('rates');
// Spy + assert
cy.intercept('POST', '/api/orders').as('createOrder');
cy.get('[data-cy=submit]').click();
cy.wait('@createOrder').its('response.statusCode').should('eq', 201);
// Modify
cy.intercept('GET', '/api/flags', (req) => {
  req.reply((res) => { res.body.betaFeature = true; });
});
```

## Only mock what you don't control

| Mock it                                          | Don't mock it                                      |
|--------------------------------------------------|----------------------------------------------------|
| Third-party APIs (payments, maps, email, rates)  | Your own backend in an E2E test (defeats the point)|
| Flaky/slow/rate-limited external services        | The exact integration you're trying to verify      |
| Hard-to-trigger error states (500, timeout)      | Everything, by default                              |
| Analytics/ads/telemetry (abort to speed up)      | —                                                   |

**Principle:** the more you mock, the less real your test is. For true E2E, hit the real backend (seeded via API) and mock only the *external* dependencies you can't make deterministic. For component or contract tests, mocking more is acceptable — match the mocking level to the test's purpose.
