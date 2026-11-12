# CI Integration and Repository Onboarding

Use this reference when an organization already has delivery pipelines or needs to onboard repositories safely.

## Contents

- [Start with ownership](#start-with-ownership)
- [Integration patterns](#integration-patterns)
- [Trigger decisions](#trigger-decisions)
- [Conclusion semantics](#conclusion-semantics)
- [Registry and manifest](#registry-and-manifest)
- [Runner placement](#runner-placement)
- [Repository onboarding contract](#repository-onboarding-contract)
- [Onboarding sequence](#onboarding-sequence)
- [Required human decisions](#required-human-decisions)

## Start with ownership

Identify:

- who builds, deploys, tests, approves, merges, releases, and operates today;
- which system is authoritative for each action;
- which events are trustworthy and replayable;
- where preview, test, staging, and production targets exist;
- what existing runners can access and which credentials they hold;
- how branch rules consume checks/statuses;
- how platform outages affect delivery.

Preserve established CI/CD as the deployment system of record unless the fit-gap analysis supports changing it. Add QA capabilities at explicit integration points rather than silently creating a second deployment pipeline.

## Integration patterns

| Pattern | Use when |
|---|---|
| Repository-local step | Existing CI can run the capability safely and shared state is unnecessary |
| Federated kit | Repositories need common adapters, contracts, and policy while retaining local execution |
| Shared service | Cross-repository coordination, specialist operations, common evidence, or scale justify it |
| Hybrid | Build/deployment or private execution remain local while selected reasoning, policy, or evidence capabilities are shared |

One common hybrid flow is:

```text
Application repository PR
  -> existing CI builds, scans, and deploys preview/test target
  -> CI or forge emits authenticated deployment-ready event
  -> QA platform validates event, repository, source and target
  -> platform executes approved suite independently
  -> platform publishes governed check/status and evidence link
  -> existing branch/release controls interpret the conclusion
```

Benefits:

- teams retain deployment ownership;
- the platform gains a stable target event;
- execution and evidence can be standardized;
- adoption can begin as advisory without changing merge rules.

Costs:

- event and conclusion semantics must be precise;
- superseded deployments and closed changes must be cancelled or ignored;
- platform and CI failure ownership must be explicit;
- cross-account/network access may be required.

## Trigger decisions

**HUMAN DECISION:** choose the authoritative trigger for each workflow:

- work item reaches an agreed state;
- approved test cases are merged;
- pull request is opened or synchronized;
- preview/test deployment succeeds;
- explicit manual or API request;
- schedule or post-deployment event.

Require authentication, replay protection, deduplication, source revision, target identity, and correlation ID. Re-read authoritative data when practical rather than trusting a mutable webhook body.

## Conclusion semantics

Define explicit, independently enforced mappings before making a check required. Preserve the canonical platform outcome even when the delivery system uses a smaller conclusion vocabulary:

| Canonical platform outcome | Typical forge-native conclusion | May satisfy required gate? |
|---|---|---|
| `passed` — approved assertions passed | success | Yes |
| `failed_product_expectation` | failure | No |
| `neutral` or `inconclusive` — no approved suite or unresolved authority | neutral | No |
| `infrastructure_error` — target unavailable | failure or neutral, according to declared mapping | No |
| `platform_error` — platform malfunction | failure or neutral, according to declared mapping | No |
| `policy_denied` | failure or action-required | No |
| `superseded` or `cancelled` | cancelled or skipped | No |

**SAFETY INVARIANT:** never map absence of a trustworthy result to success.

**HUMAN DECISION:** decide whether an accountable release authority may issue an explicit, audited waiver or bypass for an `infrastructure_error` or `platform_error`, by environment and risk class. The waiver is a separate decision record; it never changes the QA run to `passed` or maps an error check to success. Make the consequence visible and do not hide it inside retry logic.

## Registry and manifest

### Central registry

Use when governance needs an authoritative mapping of:

- project/work-item namespace;
- approved cases source;
- application repositories;
- environment and execution boundary;
- active runner profiles;
- platform owner, application owner, QA approver, and escalation;
- policy/autonomy tier;
- exception and compatibility status.

### Repository manifest

Use a lightweight manifest for discoverability and validation, such as:

- project identifier;
- application/service identifier;
- target/preview discovery method;
- requested runner profiles;
- fixture/setup hooks;
- evidence preferences;
- local owner contacts;
- supported manifest version.

When central governance exists, keep the protected registry authoritative and validate the repository manifest against it. Do not allow a pull request to grant itself broader platform access through manifest edits.

**ACCEPTABLE OPTION:** make the protected repository manifest authoritative in a federated model if ownership, review, schema evolution, and exceptions are sufficiently controlled.

## Runner placement

Compare:

| Placement | Prefer when | Watch for |
|---|---|---|
| Existing CI runner | Tests are trusted and current controls already meet the contract | Broad credentials, shared state, generated-code risk |
| Central isolated runner | Targets are reachable and central operations/isolation are strong | Network reach, tenancy, data movement |
| Application account/network runner | Private target, data locality, or application ownership requires it | Cross-account launch, artifact callbacks, local support |
| Hybrid | Trusted approved tests use CI; generated/untrusted artifacts use isolated runners | Two evidence paths and consistency |

Generated or repaired artifacts should run in fresh or reliably reset isolation appropriate to their risk. Place that isolation near the target when private connectivity or account boundaries require it.

## Repository onboarding contract

Require:

- registered repository and exact or otherwise explainable source revision;
- accountable application, QA, platform, and security owners;
- approved test oracle location;
- supported runner profile and version;
- target discovery and allowed environment classes;
- fixture/setup/cleanup interface;
- identity, network, egress, and secret boundaries;
- result and evidence contract;
- trigger and conclusion mapping;
- autonomy tier and repair allowlist;
- data classification, redaction, retention, and residency;
- concurrency, duration, cost, and evidence-size budgets;
- platform outage and rollback behavior;
- compatibility, deprecation, and exception process.

## Onboarding sequence

1. Validate registration and ownership.
2. Inventory existing test and CI behavior.
3. Select one supported runner profile; do not force migration without value.
4. Prove target reachability with a repeatable health test.
5. Prove fixture creation and cleanup without agents.
6. Execute an approved, versioned suite.
7. Publish an advisory conclusion and evidence.
8. Run in shadow long enough to measure reliability and false classifications.
9. Decide whether the check can become required.
10. Add agentic authoring, triage, or repair only through a separate approval.

## Required human decisions

- official deployment system of record;
- trigger source and event semantics;
- official merge/release gate;
- fail-open/fail-closed behavior;
- registry versus manifest authority;
- runner and account/network placement;
- supported framework profiles;
- data and environment ownership;
- platform support model and service objectives;
- repository exceptions and deprecation policy.
