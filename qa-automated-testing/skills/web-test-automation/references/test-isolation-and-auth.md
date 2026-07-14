# Test Isolation and Authentication

**Every test must be independent and own its state.** No test may depend on another's side effects or run order. Set up fresh state in `beforeEach`; do not rely on `afterEach` cleanup. Authenticate once via API and reuse the storage state.

## Independent tests

- Tests must pass in isolation, in any order, and in parallel.
- Never share mutable state between tests (no module-level `let user`).
- Each test creates the data it needs and uses unique identifiers to avoid collisions under parallelism.

```ts
test('user updates their display name', async ({ page, request }) => {
  const user = await seedUser(request);          // fresh, unique user
  await page.goto(`/login`);
  // ... act on this user only
});
```

## Prefer beforeEach setup over afterEach cleanup

Set the world up correctly *before* each test rather than cleaning up after. Reasons:

- If a test fails or crashes, `afterEach` cleanup may not run, leaving poisoned state.
- Fresh setup makes each test self-contained and debuggable in isolation.
- Parallel workers can't safely share a "clean up at the end" model.

```ts
test.beforeEach(async ({ request }) => {
  await resetTestData(request);   // ensure a known starting point
});
```

Use `afterEach`/`afterAll` only for resource disposal (closing a DB client), not for correctness of the next test.

## Seed state programmatically, not through the UI

Driving the UI to create preconditions is slow and flaky. Seed via API or DB and start the test at the screen under test.

```ts
// ✅ Fast, reliable precondition via API
const { id } = await api.post('/api/projects', { data: { name: 'Acme' } })
  .then((r) => r.json());
await page.goto(`/projects/${id}`);

// ❌ Slow: clicking through "New project" wizard just to set up another test
```

Only test the creation flow through the UI in the test that is actually *about* creation.

## Log in once, reuse with storageState (Playwright)

Logging in through the UI in every test is the most common waste in a suite. Authenticate once in a **setup project**, save the browser storage state (cookies + localStorage), and have all other tests reuse it.

```ts
// auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ request }) => {
  // Prefer API login — no UI, fast and stable.
  const res = await request.post('/api/login', {
    data: { email: process.env.TEST_USER!, password: process.env.TEST_PASS! },
  });
  expect(res.ok()).toBeTruthy();
  // Persist cookies + origin storage for reuse.
  await request.storageState({ path: authFile });
});
```

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],   // setup runs first, once
    },
  ],
});
```

Now every test in `chromium` starts already authenticated — zero login steps in the test bodies.

Notes:
- Gitignore the `.auth/` directory; never commit credentials or session state.
- For multiple roles, create one setup test + one auth file per role (`admin.json`, `user.json`) and split into projects.
- If a test needs a *different* user, override per-test: `test.use({ storageState: 'admin.json' })`.
- Tests that must start logged-out: `test.use({ storageState: { cookies: [], origins: [] } })`.

## Cypress equivalent: cy.session

`cy.session` caches and restores session state (cookies, localStorage, sessionStorage) across tests, with automatic validation.

```js
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.request('POST', '/api/login', { email, password })
      .its('status').should('eq', 200);
  }, {
    validate() {
      cy.request('/api/me').its('status').should('eq', 200);
    },
  });
});

beforeEach(() => {
  cy.login(Cypress.env('TEST_USER'), Cypress.env('TEST_PASS'));
  cy.visit('/dashboard');
});
```

`cy.session` restores the cached session instead of re-logging-in, and the `validate` callback re-authenticates automatically if the session is stale.
