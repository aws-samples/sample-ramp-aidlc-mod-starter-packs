---
name: agentic-qa-platform
description: ALWAYS use when the user says "agentic QA", "agentic QA pipeline", "agentic QA platform", "agentic QA workflow", "build an agentic QA pipeline", "QA platform", "multi-repo QA", or "agentic testing architecture", or asks to assess, design, build, review, govern, or evolve a reusable AI-assisted QA capability across repositories, applications, or teams. Also triggers on shared QA contracts, test generation, synthetic-data lifecycle, isolated execution, failure triage, bounded repair, evidence, autonomy, pilots, or adoption. Do NOT use only for writing or debugging an individual test, basic fake-data generation, or a conventional single-repository test strategy; use qa-test-strategy or a stack-specific testing skill instead.
license: MIT-0
metadata:
  version: 1.1.0
---

# Agentic QA Platform

An agentic QA platform is a reusable capability that converts approved requirements into traceable test intent, executable automation, governed synthetic data, isolated test execution, and actionable evidence across applications.

The platform combines bounded agents with deterministic workflow, policy, validation, and execution controls:

- agents interpret requirements, draft test cases and scripts, review changes, analyse uncertain failures, and propose eligible repairs;
- deterministic controls authorize actions, validate artifacts, manage state, execute tests, classify known outcomes, and preserve evidence;
- humans approve expected behaviour, resolve ambiguity, govern autonomy, and make engineering and release decisions.

> Approved test intent defines what correct means. Automation may implement or repair the test mechanism, but it must not rewrite the expected outcome.

## Best-practice baseline

Design every agentic QA platform around these boundaries:

- Approved requirements and test intent define expected behaviour; generated scripts never become the oracle.
- Agents produce bounded, typed proposals. Deterministic workflow and policy controls own state transitions, budgets, retries, approvals and verdict publication.
- Application teams retain ownership of application code, CI/CD, deployment, environments and application-specific test contracts.
- Generated or repaired executable artifacts are independently validated and run in isolated, least-privilege execution environments.
- Synthetic data follows a governed lifecycle: blueprint, deterministic materialization, validation, application-owned seeding, readiness, run-scoped leasing, cleanup and reconciliation.
- Known outcomes are classified deterministically before agent-assisted triage.
- Repair preserves approved intent, is limited to eligible mechanical changes, passes an independent application gate and is verified through fresh execution.
- Evidence is traceable from requirement and approval through application, test, data, runner, result and human decision.
- Missing, stale, unauthorized, incomplete or inconclusive evidence never becomes a pass.
- Humans retain semantic approval, ambiguity resolution, exception and release-waiver authority.

## Load references by need

Read only the references needed for the requested outcome:

| Task | Reference |
|---|---|
| Comparing repository-local, federated, shared-service, or hybrid architecture | `references/architecture-options.md` |
| Integrating with existing CI/CD or onboarding repositories | `references/ci-integration-and-onboarding.md` |
| Allocating responsibilities among models, software controls, policies, and humans | `references/responsibility-allocation.md` |
| Requirement authority, autonomy, approvals, isolation, or repair policy | `references/governance-and-autonomy.md` |
| Contracts, conclusions, approvals, provenance, or evidence | `references/contracts-and-evidence.md` |
| Illustrative contract payloads | `references/contract-examples.md` |
| Component interfaces, workflow/error paths, or execution topology | `references/implementation-blueprints.md` |
| AWS implementation, AgentCore, or Lambda MicroVM execution options | `references/aws-implementation-options.md` |
| SLOs, scale, tenancy, cost, recovery, support, or production readiness | `references/platform-operations-and-nfrs.md` |
| Agent evaluation, prompt injection, tool abuse, or autonomy expansion | `references/agent-evaluation-and-threat-model.md` |
| Shared synthetic-data generation, validation, provisioning, or privacy | `references/synthetic-test-data.md` |

## Architecture inputs that must be resolved

Apply the best-practice baseline first. Resolve these inputs before finalizing a build-ready architecture:

- the outcome sought: standards, evidence, authoring, execution, triage, repair, or release gating;
- the number and diversity of repositories, stacks, teams, pipelines, and environments;
- which systems currently own requirements, test intent, CI/CD, approval, merge, and release;
- existing test frameworks, runners, data setup, evidence, and failure modes;
- network, identity, privacy, compliance, availability, cost, and support constraints;
- whether model-produced artifacts will be advisory, executable, or release-affecting.

Repository topology, deployment units and the number of agents follow from these inputs. They are not predefined by the term “agentic QA”.

## Core design model

Separate six concerns before choosing products or agents:

1. **Authority** — what defines expected behavior, who approves it, and how conflicts are resolved.
2. **Integration** — trustworthy triggers, source and target identity, and existing delivery-system ownership.
3. **Execution** — runner profiles, isolation, data setup, cleanup, budgets, and reproducibility.
4. **Evidence** — results, provenance, redaction, retention, and external check/report semantics.
5. **Reasoning** — where model judgment adds value and what typed proposals it may produce.
6. **Governance** — tools, policy, approval, evaluation, rollout, exceptions, and operations.

For each responsibility, choose among:

- ordinary repository or platform code;
- an independently enforced policy or workflow control;
- a bounded model-assisted capability;
- an accountable human decision.

An “agent” is justified by a reasoning need, not by a box in a workflow diagram.

## Trustworthy QA rules

Apply these to any design that can influence delivery:

- Identify the authoritative test oracle. Generated tests derived only from current code can preserve defects.
- Separate semantic intent from executable mechanics. Cases, generated tests, bindings, selectors, fixtures, and runners do not have equal authority.
- A model may help evaluate subjective evidence, but the actor that repairs toward green must not control the governing oracle, acceptance policy, or its own authorization.
- Verify agent completion from tool receipts, stored artifacts, or independently observed effects—not from the model's narrative.
- Keep product failures, test defects, data/setup failures, infrastructure failures, platform failures, policy denials, and inconclusive results distinguishable.
- Missing, stale, partial, provisional, quarantined, or unauthorized evidence never silently becomes a pass.
- Bind approvals and evidence to the exact source, test intent, generated artifact, runner, target, policy, and environment needed to explain the result.
- Run generated or repaired artifacts with least privilege, bounded resources, controlled network access, and no implicit merge, deployment, production-data, or policy authority.
- Before a generated or repaired executable artifact becomes trusted, validate it against its runner profile and route it through the organization's normal code-review and activation control. Pre-review execution remains isolated and non-gating.
- Classify before repair. Repair mechanics may be automated only within an explicit policy that preserves intent and requires independent verification.
- A release waiver is a separate accountable decision; it does not rewrite the QA result.

## Compare platform shapes without anchoring

| Shape | Prefer when | Main caution |
|---|---|---|
| Repository-local | Existing CI and teams can meet the contracts consistently | Duplication and uneven governance |
| Federated kit | Teams need shared standards, adapters, and versioned policy while retaining local execution | Compatibility and upgrade coordination |
| Shared service | Cross-repository state, specialist operation, strong common governance, or economies of scale justify it | Central dependency, tenancy, network reach, and ownership |
| Hybrid | Some capabilities benefit from sharing while build, deployment, or execution must remain local | Explicit boundaries and consistent evidence across paths |

Preserve existing CI/CD as the deployment system of record unless evidence supports changing it. Centralize only the capabilities whose measured gaps justify shared ownership.

## Bound autonomy by action

Use increasing authority only when evidence supports it:

1. read and advise;
2. draft a reviewable artifact;
3. execute in isolation without gating;
4. publish an advisory result;
5. policy-authorize a narrowly defined, machine-verifiable action;
6. affect a required gate only under approved outcome and outage semantics.

Evaluate autonomy per action, repository, environment, and risk class. Do not promote a whole platform because one capability performed well.

For repair, distinguish:

- **Advisory:** propose a patch and verification plan.
- **Human-approved:** an independently controlled workflow applies the exact change after an accountable reviewer approves it.
- **Policy-authorized:** an independently controlled workflow applies only an allowlisted, mechanically verifiable transformation with fresh independent validation.
- **Separate change workflow:** application, dependency, infrastructure, workflow, security, or semantic changes leave the test-repair authority boundary.

## Common mistakes

- Treating “agentic QA” as generated browser scripts plus a retry loop.
- Selecting a central platform before defining the shared problem.
- Letting the same authority generate, repair, approve, and judge a test.
- Treating selectors, bindings, or current implementation behavior as the test oracle.
- Mapping no result, stale approval, or platform failure to success.
- Using prompts as the only security or approval boundary.
- Making every workflow stage a separately deployed agent.
- Replacing working CI/CD, runners, frameworks, or test data without measured benefit.
- Calling random fake values a synthetic-data strategy.
- Measuring green-pipeline rate while ignoring false repairs, false passes, inconclusive runs, operational toil, and escaped defects.
