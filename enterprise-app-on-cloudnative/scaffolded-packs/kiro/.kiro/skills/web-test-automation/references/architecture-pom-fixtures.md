# Architecture: Page Objects and Fixtures

**Keep test bodies thin and declarative.** Push locators and interaction logic into Page Objects; push setup/teardown and dependency wiring into fixtures. A test should read like a scenario, not like browser plumbing.

## Page Object Model (POM)

A Page Object is a TypeScript class that encapsulates the locators and domain actions for one page or component. Tests call its methods instead of poking at the DOM.

```ts
// pages/login.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locators defined ONCE in the constructor — single source of truth.
    this.email = page.getByLabel('Email address');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  // Domain method: expresses intent, not mechanics.
  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(message: string | RegExp) {
    await expect(this.error).toContainText(message);
  }
}
```

Guidelines:
- **Locators in the constructor**, exposed as `readonly` fields (or methods). Never inline raw selectors in tests.
- **Domain methods** model user intent (`login`, `addToCart`, `checkout`) — not low-level steps.
- Page Objects *may* hold assertions for page-specific invariants, but keep scenario-level assertions in the test.
- One class per page/major component. Compose them; don't build one god-object.

## Fixtures (`test.extend`)

Playwright fixtures provide per-test dependencies with automatic setup and teardown. Use them to inject ready-to-use page objects and shared state so tests don't repeat boilerplate.

```ts
// fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));     // setup before; teardown after `use`
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from '@playwright/test';
```

```ts
// login.spec.ts — thin test body
import { test, expect } from './fixtures';

test('shows error on bad credentials', async ({ loginPage }) => {
  await loginPage.goto();
  await loginPage.login('user@example.com', 'wrong');
  await loginPage.expectError(/invalid credentials/i);
});
```

### POM vs fixtures — when to use which

| Use a **Page Object** for...                  | Use a **fixture** for...                                  |
|-----------------------------------------------|-----------------------------------------------------------|
| Locators for a page/component                 | Constructing and injecting those page objects             |
| Domain interaction methods (`login`, `pay`)   | Per-test setup/teardown (seed data, auth state, cleanup)  |
| Page-specific assertions                      | Shared resources (API clients, test data, logged-in page) |
| Reusable UI logic                             | Worker-scoped expensive setup (DB, server)                |

They are complementary: **fixtures provide POM instances** to the test. POM = "what the page can do." Fixture = "what this test needs, ready to go."

## Test data factories

Don't hard-code or copy-paste object literals. Centralize data construction so defaults live in one place and tests override only what matters.

```ts
// factories/user.ts
import { faker } from '@faker-js/faker';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    email: faker.internet.email(),
    password: 'P@ssw0rd!' + faker.string.alphanumeric(6),
    name: faker.person.fullName(),
    ...overrides,
  };
}
```

```ts
const admin = makeUser({ role: 'admin' });
```

Factories also give you **unique data per test** (faker/uuid), which prevents collisions when tests run in parallel against a shared backend.

## Keep test bodies thin

A good test reads as: arrange (data/state) → act (domain method) → assert (web-first expect). If a test body contains raw locators, multi-step DOM choreography, or sleeps, refactor it into the POM or a fixture.

```ts
test('user completes checkout', async ({ loggedInPage, cartPage, checkoutPage }) => {
  await cartPage.addItem('Mechanical keyboard');
  await checkoutPage.payWithCard(makeCard());
  await expect(checkoutPage.confirmation).toBeVisible();
});
```
