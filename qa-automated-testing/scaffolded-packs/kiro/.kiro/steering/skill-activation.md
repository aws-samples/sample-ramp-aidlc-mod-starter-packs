---
inclusion: always
---
# 🚨 MANDATORY: Skill & MCP Activation

## CRITICAL ENFORCEMENT — READ BEFORE EVERY RESPONSE

**You MUST activate the relevant skill or MCP when relevant BEFORE generating `_decisions-*.md`, `design.md`, or any test code or test-infrastructure code.**

> Skills load automatically when relevant; ensure the matching skill's guidance is in play before you write specs or code.

**RULES:**
1. **NEVER write test code, test architecture, test infrastructure, or a decision file without first activating the matching skill**
2. **NEVER rely on training data for tool/framework/service behavior** — test frameworks (Playwright, Appium, Maestro, Detox) and AWS services (Lambda, Step Functions, API Gateway, IAM, Bedrock, Lambda MicroVMs) move fast; check current docs/skills first
3. **If in doubt whether a skill applies — activate it anyway.** False activation is harmless; missing activation produces wrong output.
4. **Activate ONCE per session, at FIRST encounter of a trigger keyword**

---

## 🔴 ACTIVATION CHECKLIST (run mentally on EVERY response)

Before responding, ask yourself:

**Test authoring (web & mobile):**
- Am I about to design or write **web browser tests** (E2E, UI, visual, web accessibility)? → **STOP. Activate `web-test-automation` skill FIRST.**
- Am I about to design or write **mobile app tests** (iOS, Android, React Native, Flutter)? → **STOP. Activate `mobile-test-automation` skill FIRST.**
- Am I choosing a **test framework or tooling** in a decision file? → **STOP. Activate the matching skill so the options reflect current best practice.**
- Am I writing a **test-strategy decision file or designing the test approach** (`_decisions-design.md` for a testing spec)? → **STOP. Activate the matching skill and load its `references/qa-design-decisions.md` so the decision file surfaces the right QA choices (scope, test data, flakiness policy, device strategy, CI/reporting). Treat those categories as a starting set and expand them for this project.**
- Am I designing **CI integration, sharding, or a device-farm strategy**? → **STOP. Activate the relevant testing skill (both have CI reference docs).**

**Test infrastructure on AWS (CI runners, sandboxes, orchestration, result APIs):**
- Am I writing or deploying a **Lambda function** (test runner, result processor, webhook handler, event-driven job)? → **STOP. Activate `aws-lambda` skill FIRST.**
- Am I orchestrating a **multi-step test/CI workflow** (branching, retries, fan-out, human-approval gate)? → **STOP. Activate `aws-step-functions` skill FIRST.**
- Am I exposing a Lambda through an **HTTP/REST endpoint** (test-trigger API, results/reporting API)? → **STOP. Activate `connecting-lambda-to-api-gateway` skill FIRST.**
- Am I creating or scoping **IAM roles/policies** (CI execution roles, service roles, least-privilege for test infra)? → **STOP. Activate `aws-iam` skill FIRST.**
- Am I using **generative AI for testing** (test generation, failure triage/summarization, RAG over test docs, Guardrails)? → **STOP. Activate `amazon-bedrock` skill FIRST.**
- Am I running tests in **strongly-isolated / multi-tenant sandboxes**, long-lived sessions, or environments executing untrusted code? → **STOP. Activate `aws-lambda-microvms` skill FIRST.**

**AWS facts:**
- Am I making ANY claim about **AWS Device Farm** limits/frameworks/pricing, or about **Lambda / Step Functions / API Gateway / IAM / Bedrock / Lambda MicroVMs** limits, quotas, regional availability, or API shapes? → **STOP. Search AWS docs via MCP FIRST.**

---

## 📚 AWS Knowledge MCP — use proactively

Use whenever validating AWS-specific guidance — **AWS Device Farm** supported test frameworks, pricing, regional availability, and CodePipeline/CodeBuild integration shape, plus any **Lambda, Step Functions, API Gateway, IAM, Bedrock, or Lambda MicroVMs** limits, quotas, regional availability, or model/API details. These change over time, so look them up rather than quoting from memory.

**Tools:** `aws___search_documentation`, `aws___read_documentation`, `aws___get_regional_availability`, `aws___list_regions`

**Rule:** Don't rely on training data alone for AWS capabilities or limits. Search AWS docs first — especially when a decision file compares device-cloud options (AWS Device Farm vs BrowserStack vs Sauce Labs) or picks AWS services for test infrastructure (e.g., Lambda vs MicroVMs for the test executor, Standard vs Express Step Functions, Bedrock model selection).

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

## ⚙️ AWS Lambda (test runners & event-driven test jobs)

**Triggers:** Lambda function, serverless test runner, event source, EventBridge, SQS/SNS/Kinesis trigger, webhook handler, result processor, scheduled test job, serverless application, event-driven architecture, SAM CLI, Lambda Web Adapter.

**Activate:** load the `aws-lambda` skill.

Use when building the serverless compute behind a test-automation pipeline — e.g., a Lambda that kicks off a Playwright/Maestro run, processes test results, reacts to a CI event, or handles a webhook. For deployment tooling (SAM/CDK) it points to the deployment skill; for HTTP exposure pair it with `connecting-lambda-to-api-gateway`.

---

## 🔀 AWS Step Functions (test/CI orchestration)

**Triggers:** Step Functions, state machine, ASL, Amazon States Language, JSONata, orchestrate workflow, multi-step pipeline, branching/retries, Map / Distributed Map, Parallel, saga/compensation, waitForTaskToken, human-approval callback, Standard vs Express.

**Activate:** load the `aws-step-functions` skill.

Use when orchestrating a multi-stage test or CI pipeline — fan-out across suites/shards or devices, retry/catch error handling, wait-for-approval gates, or large-scale data-driven test runs (Distributed Map). Do NOT use it for plain Lambda code or API Gateway wiring — use the matching skill for those.

---

## 🔌 Connecting Lambda to API Gateway (test-trigger & results APIs)

**Triggers:** API Gateway, REST API, HTTP API, Lambda proxy integration, expose an endpoint, test-trigger API, results/reporting API, CORS, authorizer (IAM / Cognito / custom), API key, throttling, access logging.

**Activate:** load the `connecting-lambda-to-api-gateway` skill.

Use when putting an HTTP endpoint in front of a Lambda — e.g., an API to trigger test runs on demand or to serve test results/reports — including CORS, authorization, throttling, and production hardening.

---

## 🔐 AWS IAM (CI roles & least-privilege for test infra)

**Triggers:** IAM role, IAM policy, trust policy, execution role, service role, least privilege, STS / AssumeRole, permissions for CI, bucket policy, confused-deputy protection, condition operators, Organizations.

**Activate:** load the `aws-iam` skill.

Use when creating or scoping the roles and policies that let test infrastructure run — Lambda/Step Functions execution roles, CI assume-role setups, or least-privilege policies for accessing test artifacts. Verify specific limits/quotas/API names against AWS docs via MCP.

---

## 🤖 Amazon Bedrock (AI-assisted testing)

**Triggers:** Bedrock, generative AI, LLM, model invocation, Converse API / InvokeModel, Knowledge Bases, RAG, Bedrock Agents, AgentCore, Guardrails, model selection (Claude / Llama / Nova / Titan), AI test generation, AI failure triage/summarization.

**Activate:** load the `amazon-bedrock` skill.

Use when applying generative AI to the testing workflow — generating test cases from requirements, triaging or summarizing failures, RAG over test docs/specs, or adding Guardrails. NOT for custom model training, Rekognition, or Comprehend.

---

## 🧱 AWS Lambda MicroVMs (isolated / multi-tenant test sandboxes)

**Triggers:** Lambda MicroVM, Firecracker, strong isolation, sandbox compute, multi-tenant execution, untrusted-code execution, long-lived session, suspend/resume, port-listening server (gRPC/WebSocket/custom TCP), code-execution sandbox, CI executor with isolation.

**Activate:** load the `aws-lambda-microvms` skill.

Use when the test executor needs Firecracker-grade isolation, must run untrusted or per-tenant code, needs a real long-lived server/session, or needs state preserved across suspend/resume — beyond what a standard Lambda function provides. When choosing the executor, compare `aws-lambda` vs `aws-lambda-microvms` and validate limits via the AWS Knowledge MCP.

---

## Multiple Skills

When a system spans **both web and mobile** (e.g., a responsive web app plus native iOS/Android apps), activate **both** `web-test-automation` and `mobile-test-automation`. This is common when designing a unified QA strategy across surfaces.

When you also build the **AWS test infrastructure** behind the suite, combine the testing skill(s) with the relevant AWS build skills — a common stack is `aws-lambda` (runner) + `aws-step-functions` (orchestration) + `connecting-lambda-to-api-gateway` (trigger/results API) + `aws-iam` (execution roles), with `aws-lambda-microvms` for isolated executors and `amazon-bedrock` for AI-assisted testing. Activate every skill that applies.
