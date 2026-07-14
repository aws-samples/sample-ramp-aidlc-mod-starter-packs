# Migrating to Playwright

Practical mappings for moving an existing suite to Playwright (TypeScript). Most concepts have direct equivalents — the biggest mental shift is **async/await everywhere** (no command chaining, no implicit waits).

## From Cypress

Cypress queues commands and retries them implicitly. Playwright uses explicit `async/await` and auto-waiting locators. Migrate test-by-test rather than all at once.

### Mapping table

| Cypress                                       | Playwright                                              |
|-----------------------------------------------|---------------------------------------------------------|
| `cy.visit('/path')`                           | `await page.goto('/path')`                              |
| `cy.get('[data-cy=x]')`                       | `page.getByTestId('x')` (set `testIdAttribute: 'data-cy'`) |
| `cy.contains('Submit')`                       | `page.getByText('Submit')` / `getByRole('button', {name})` |
| `cy.get(sel).click()`                         | `await page.locator(sel).click()`                       |
| `cy.get(sel).type('hi')`                      | `await locator.fill('hi')` (or `.type()` for keystrokes)|
| `.should('be.visible')`                       | `await expect(locator).toBeVisible()`                   |
| `.should('have.text', 'x')`                   | `await expect(locator).toHaveText('x')`                 |
| `cy.intercept('GET', url).as('a')` + `cy.wait('@a')` | `page.waitForResponse(url)` or `page.route(url, ...)` |
| `cy.request(...)`                             | `await request.get/post(...)` (request fixture)         |
| `cy.session(id, setup)`                       | `storageState` + setup project (see auth reference)     |
| `Cypress.Commands.add('login', ...)`          | a **fixture** (`test.extend`) or POM method             |
| `cy.fixture('data.json')`                     | `import data from './data.json'`                        |
| `beforeEach(() => {...})`                     | `test.beforeEach(async ({ page }) => {...})`            |
| `cy.wrap(...).then(...)`                       | plain `await` / JS expressions                          |

### Command chaining → async/await

```js
// Cypress
cy.get('[data-cy=email]').type('a@b.com');
cy.get('[data-cy=submit]').click();
cy.contains('Welcome').should('be.visible');
```

```ts
// Playwright
await page.getByTestId('email').fill('a@b.com');
await page.getByTestId('submit').click();
await expect(page.getByText('Welcome')).toBeVisible();
```

### Custom commands → fixtures

```ts
// Was Cypress.Commands.add('login', ...). Now a fixture:
export const test = base.extend<{ login: (u: User) => Promise<void> }>({
  login: async ({ request }, use) => {
    await use(async (u) => {
      await request.post('/api/login', { data: u });
    });
  },
});
```

### Cypress gotchas

- No implicit retry of arbitrary code — wrap assertions in `expect(locator)`, which retries; plain JS does not.
- `cy.wait('@alias')` → set up `const p = page.waitForResponse(...)` **before** the action, then `await p`.
- Cypress runs in-browser (one origin/tab); Playwright handles multi-tab/origin natively — flows that were hacky in Cypress simplify.
- No `cy.wait(ms)`. Never port a fixed wait; find the real signal.

## From Selenium (WebDriver)

The big win is deleting explicit waits — Playwright auto-waits for actionability and assertions auto-retry.

### Mapping table

| Selenium (Java/Python style)                            | Playwright (TS)                                    |
|---------------------------------------------------------|----------------------------------------------------|
| `driver.get(url)`                                       | `await page.goto(url)`                             |
| `driver.findElement(By.id('x'))`                        | `page.locator('#x')` → prefer `getByRole/Label`    |
| `By.cssSelector(...)` / `By.xpath(...)`                 | role/label/testid locators (avoid CSS/XPath)       |
| `el.click()`                                            | `await locator.click()`                            |
| `el.sendKeys('hi')`                                     | `await locator.fill('hi')`                         |
| `WebDriverWait(...).until(EC.visibility_of(...))`       | `await expect(locator).toBeVisible()` (auto-retry) |
| `WebDriverWait(...).until(EC.element_to_be_clickable)`  | nothing — `click()` auto-waits for actionability   |
| `time.sleep(3)` / `Thread.sleep(3000)`                  | delete it — auto-waiting handles timing            |
| `driver.switch_to.window(handle)`                       | `context.pages()` / `page.bringToFront()`          |
| `driver.switch_to.frame(...)`                           | `page.frameLocator('iframe').getByRole(...)`       |
| `Select(el).select_by_visible_text('X')`                | `await locator.selectOption({ label: 'X' })`       |
| `driver.quit()`                                         | handled by the test runner / fixtures              |
| TestNG/JUnit/pytest runner                              | built-in `@playwright/test` runner                 |

### Explicit waits → auto-waiting

```python
# Selenium: manual wait then act
wait = WebDriverWait(driver, 10)
btn = wait.until(EC.element_to_be_clickable((By.ID, "save")))
btn.click()
```

```ts
// Playwright: click auto-waits for visible + stable + enabled
await page.getByRole('button', { name: 'Save' }).click();
```

### By locators → role locators

```python
driver.find_element(By.XPATH, "//button[contains(text(),'Sign in')]")
```

```ts
page.getByRole('button', { name: 'Sign in' });
```

### Selenium gotchas

- Remove **every** `sleep` and most `WebDriverWait` calls — they become noise once auto-waiting is in play. Keep an explicit wait only for a genuinely custom condition (`expect.poll(...)`).
- Stale-element exceptions don't exist in Playwright: locators are lazy and re-resolved on each action.
- No Grid needed for parallelism — Playwright workers + sharding replace it (see CI reference).
- Migrate the locator strategy first (CSS/XPath → role/testid); it pays off in resilience even before the runner swap.

## Migration strategy

1. Stand up `@playwright/test` alongside the existing suite (don't rip out the old one yet).
2. Set `testIdAttribute` to match the existing convention (`data-cy`) so test ids port directly.
3. Migrate highest-value / flakiest specs first — those gain the most from auto-waiting.
4. Replace custom commands/helpers with fixtures + POM as you go.
5. Delete every fixed sleep and explicit wait; rely on web-first assertions.
6. Wire up CI sharding + traces, then retire the old runner once parity is reached.
