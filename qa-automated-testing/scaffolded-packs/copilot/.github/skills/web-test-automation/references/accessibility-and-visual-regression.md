# Accessibility and Visual Regression

Two automated quality gates that catch regressions humans miss. Both have important caveats: automated a11y scans catch ~30-40% of WCAG issues, and visual baselines are environment-sensitive.

## Accessibility with @axe-core/playwright

`AxeBuilder` runs the axe-core engine against the live page and reports WCAG violations.

```bash
npm i -D @axe-core/playwright
```

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home page has no detectable a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### Scope to WCAG tags

Limit to the rule sets you commit to (e.g. WCAG 2.1 AA):

```ts
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
```

### Include / exclude scoping

Test one region, or skip a known-bad third-party widget:

```ts
const results = await new AxeBuilder({ page })
  .include('#main-content')
  .exclude('#third-party-embed')   // not ours to fix
  .analyze();
```

### Disable specific rules

Temporarily suppress a rule you've triaged (with a tracking ticket — don't let it rot):

```ts
const results = await new AxeBuilder({ page })
  .disableRules(['color-contrast'])   // tracked in JIRA-1234
  .analyze();
```

### Attach results to the report

Make failures actionable by attaching the full violation JSON to the Playwright report:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('a11y with attached report', async ({ page }, testInfo) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach('accessibility-scan', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(results.violations).toEqual([]);
});
```

### The manual-testing caveat

Automated scans catch only a fraction of real accessibility barriers (roughly a third). They cannot judge whether alt text is *meaningful*, whether focus order is *logical*, whether a screen-reader flow makes *sense*, or whether keyboard-only navigation is *usable*. Automated axe checks are a floor, not a ceiling — pair them with manual keyboard and screen-reader testing.

## Visual regression with toHaveScreenshot

`toHaveScreenshot` captures a screenshot and compares it pixel-by-pixel against a committed baseline.

```ts
test('pricing page looks correct', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page).toHaveScreenshot('pricing.png');
});
```

### Generating and updating baselines

First run with no baseline fails and writes the baseline. To (re)generate intentionally:

```bash
npx playwright test --update-snapshots          # update all
npx playwright test pricing.spec.ts --update-snapshots
```

Commit baseline images to the repo. Review baseline changes in PRs like any other artifact.

### Tolerances

Anti-aliasing and minor rendering differences are normal — allow a small budget rather than demanding pixel-perfection:

```ts
await expect(page).toHaveScreenshot('pricing.png', {
  maxDiffPixels: 100,        // absolute pixel budget
  // OR
  maxDiffPixelRatio: 0.01,   // 1% of pixels
  threshold: 0.2,            // per-pixel color sensitivity (0 strict … 1 loose)
});
```

### Mask dynamic content

Avatars, timestamps, ads, and animations cause false diffs. Mask or hide them:

```ts
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [page.getByTestId('avatar'), page.getByText(/last updated/i)],
  animations: 'disabled',    // freeze CSS animations/transitions
});
```

### Platform-suffixed baselines

Font rendering differs across OSes, so Playwright suffixes baselines by platform (e.g. `pricing-chromium-linux.png`). A baseline generated on macOS will fail on Linux CI.

**Generate baselines in the same environment CI uses** — run `--update-snapshots` inside the official Playwright Docker image so they match the CI run exactly:

```bash
docker run --rm -v "$(pwd):/work" -w /work \
  mcr.microsoft.com/playwright:v1.55.0-noble \
  npx playwright test --update-snapshots
```

Otherwise visual tests will pass locally and fail in CI (or vice versa) purely due to rendering differences. Treat the Docker/CI image as the source of truth for baselines.
