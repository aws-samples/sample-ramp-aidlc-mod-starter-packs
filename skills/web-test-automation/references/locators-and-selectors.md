# Locators and Selectors

**Locate elements the way a user (or assistive tech) perceives them.** Prefer role/label/text locators; fall back to `getByTestId`; avoid CSS/XPath tied to DOM structure.

## Priority order (Playwright)

1. **`getByRole`** — accessible role + name. The most resilient and the recommended default.
2. **`getByLabel`** — form fields by their associated `<label>`.
3. **`getByPlaceholder`** — inputs without a label.
4. **`getByText`** — non-interactive content (paragraphs, divs).
5. **`getByAltText`** / **`getByTitle`** — images and elements with title attributes.
6. **`getByTestId`** — escape hatch when nothing user-facing is stable.

```ts
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByLabel('Email address').fill('user@example.com');
await page.getByPlaceholder('Search products').fill('keyboard');
await page.getByText('Welcome back').waitFor();
await page.getByRole('link', { name: 'Pricing', exact: true }).click();
```

`getByRole` matches ARIA roles and accessible names, so it doubles as a lightweight accessibility check: if you can't locate a button by its role and name, neither can a screen reader.

## Test IDs: `data-testid`

When content is dynamic or there is no stable user-facing handle, use a test id. Add the attribute in the app and locate by it.

```html
<button data-testid="checkout-submit">Place order</button>
```

```ts
await page.getByTestId('checkout-submit').click();
```

Configure the attribute name if your app uses a different convention (e.g. Cypress's `data-cy`):

```ts
// playwright.config.ts
export default defineConfig({ use: { testIdAttribute: 'data-cy' } });
```

## Why avoid CSS and XPath

CSS selectors (`.btn-primary > div:nth-child(3)`) and XPath (`//div[@class='x']/span`) couple tests to DOM structure and styling. They break on harmless refactors, class renames, and reordering — the leading cause of brittle suites. Use them only as a last resort, scoped as tightly as possible.

## Chaining and filtering

Narrow ambiguous locators instead of writing fragile selectors.

```ts
const row = page.getByRole('row').filter({ hasText: 'Invoice #42' });
await row.getByRole('button', { name: 'Download' }).click();

// Chain to scope within a region
const dialog = page.getByRole('dialog');
await dialog.getByLabel('Confirm').check();

// Disambiguate duplicates
await page.getByRole('listitem').filter({ hasText: 'Pro plan' })
  .getByRole('button', { name: 'Select' }).click();
```

`.first()`, `.last()`, `.nth(i)` exist but are last resorts — prefer `.filter()` by visible text.

## Centralize selectors in Page Objects

Never scatter raw locators across test files. Define them once in a page object so a UI change is a one-line fix.

```ts
export class LoginPage {
  constructor(private readonly page: Page) {}
  readonly email = () => this.page.getByLabel('Email address');
  readonly password = () => this.page.getByLabel('Password');
  readonly submit = () => this.page.getByRole('button', { name: 'Sign in' });
}
```

## Anti-patterns

| Anti-pattern                                  | Why it's bad                              | Do instead                                   |
|-----------------------------------------------|-------------------------------------------|----------------------------------------------|
| `page.locator('.btn-primary')`                | Breaks on CSS/class changes               | `getByRole('button', { name: '...' })`       |
| `page.locator('//div[2]/span')` (XPath)       | Breaks on DOM reordering                  | role/label/testid locators                   |
| `getByText('Submit')` for a button            | Matches stray text, ignores role          | `getByRole('button', { name: 'Submit' })`    |
| `.nth(3)` / `:nth-child()` positional         | Breaks when order/count changes           | `.filter({ hasText })`                        |
| Selecting by auto-generated class (`css-1a2b`)| Hash changes every build                  | `getByTestId` or role locator                |
| Raw locators copy-pasted across tests         | UI change = edit N files                  | Centralize in a Page Object                  |

## Cypress equivalent

Cypress convention is the `data-cy` attribute with `cy.get`:

```js
cy.get('[data-cy=checkout-submit]').click();
cy.contains('button', 'Sign in').click();        // role-ish: text within a tag
cy.findByRole('button', { name: 'Sign in' });     // with @testing-library/cypress
```

Install `@testing-library/cypress` to get `findByRole`/`findByLabelText` parity with Playwright's role locators.
