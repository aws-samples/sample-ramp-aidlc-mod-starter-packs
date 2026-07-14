# 🚨 MANDATORY: Skill & MCP Activation

## CRITICAL ENFORCEMENT — READ BEFORE EVERY RESPONSE

**You MUST activate the relevant skill or MCP when relevant BEFORE generating `_decisions-*.md`, `design.md`, or any test code.**

> Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

**RULES:**
1. **NEVER write test code, test architecture, or a test-strategy decision file without first activating the matching skill**
2. **NEVER rely on training data for tool/framework behavior** — test frameworks (Playwright, Appium, Maestro, Detox) move fast; check current docs first
3. **If in doubt whether a skill applies — activate it anyway.** False activation is harmless; missing activation produces wrong output.
4. **Activate ONCE per session, at FIRST encounter of a trigger keyword**

---

## 🔴 ACTIVATION CHECKLIST (run mentally on EVERY response)

Before responding, ask yourself:
- Am I about to design or write **web browser tests** (E2E, UI, visual, web accessibility)? → **STOP. Activate `web-test-automation` skill FIRST.**
- Am I about to design or write **mobile app tests** (iOS, Android, React Native, Flutter)? → **STOP. Activate `mobile-test-automation` skill FIRST.**
- Am I choosing a **test framework or tooling** in a decision file? → **STOP. Activate the matching skill so the options reflect current best practice.**
- Am I writing a **test-strategy decision file or designing the test approach** (`_decisions-design.md` for a testing spec)? → **STOP. Activate the matching skill and load its `references/qa-design-decisions.md` so the decision file surfaces the right QA choices (scope, test data, flakiness policy, device strategy, CI/reporting). Treat those categories as a starting set and expand them for this project.**
- Am I designing **CI integration, sharding, or a device-farm strategy**? → **STOP. Activate the relevant skill (both have CI reference docs).**
- Am I making ANY claim about **AWS Device Farm** limits, supported frameworks, or pricing? → **STOP. Search AWS docs via MCP FIRST.**

---

## 📚 AWS Knowledge MCP — use proactively

Use whenever validating AWS-specific guidance — especially **AWS Device Farm** supported test frameworks, pricing, regional availability, or CodePipeline/CodeBuild integration shape. These change over time, so look them up rather than quoting from memory.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**Rule:** Don't rely on training data alone for AWS Device Farm capabilities or limits. Search AWS docs first — especially when a decision file compares device-cloud options (AWS Device Farm vs BrowserStack vs Sauce Labs).

---

## 🌐 Web Test Automation

**Triggers:** web testing, browser test, E2E, end-to-end, Playwright, Cypress, Selenium, WebDriver, page object, POM, locator, flaky test, visual regression, screenshot test, accessibility / a11y testing, axe-core, API testing within E2E, network mocking, CI sharding, headless browser.

**Activate:** load the `web-test-automation` skill.

Activate during design and decision phases too — e.g., when proposing a web test framework, comparing Playwright vs Cypress vs Selenium, or designing a CI strategy for web tests.

---

## 📱 Mobile Test Automation

**Triggers:** mobile testing, app test, iOS test, Android test, Appium, Maestro, Detox, Espresso, XCUITest, React Native test, Flutter test, emulator, simulator, real device, device farm, AWS Device Farm, BrowserStack, Sauce Labs, gestures, deep link, app permissions, app lifecycle, mobile flakiness.

**Activate:** load the `mobile-test-automation` skill.

Activate during design and decision phases too — e.g., when choosing between Appium / Maestro / Detox / Espresso / XCUITest, deciding emulator vs real device, or comparing device clouds.

---

## Multiple Skills

When a system spans **both web and mobile** (e.g., a responsive web app plus native iOS/Android apps), activate **both** `web-test-automation` and `mobile-test-automation`. This is common when designing a unified QA strategy across surfaces.
