# Agent Evaluation and Threat Model

Use this reference before enabling an agentic capability, changing its model/prompt/tools, or expanding autonomy. Evaluate each role against its own authority, data, and failure consequences.

## Contents

- [Evaluation and security principle](#evaluation-and-security-principle)
- [Assets and trust boundaries](#assets-and-trust-boundaries)
- [Threat catalogue and mitigations](#threat-catalogue-and-mitigations)
- [Role-specific evaluation sets](#role-specific-evaluation-sets)
- [Metrics](#metrics)
- [Evaluation lifecycle](#evaluation-lifecycle)
- [Release, rollout, and rollback](#release-rollout-and-rollback)
- [Versioning and provenance](#versioning-and-provenance)
- [Human review sampling](#human-review-sampling)
- [Red-team scenarios](#red-team-scenarios)
- [Readiness checklist](#readiness-checklist)

## Evaluation and security principle

The model may propose or evaluate; contracts, tools, policy, and accountable authorities control effects.

Agent evaluation does not replace:

- independently governed assertion or evaluation execution;
- approved requirement and test authority;
- schema and policy validation;
- least-privilege tool enforcement;
- independent approval for semantic or high-impact actions.

Model confidence is never permission by itself. If a probabilistic evaluator contributes to an authorized result, its thresholds, abstention behavior, calibration, evidence, review policy, and independence from repair are part of the governed oracle.

Set acceptance thresholds as **HUMAN DECISION** values based on action risk. Require stricter evidence as an agent moves from read-only advice to write proposals or policy-authorized actions.

## Assets and trust boundaries

### Protected assets

- authoritative requirements, test cases, decisions, and policies;
- source, build, dependency, runner, and generated-test artifacts;
- repository, forge, work-management, cloud, and target identities;
- application endpoints, network paths, fixtures, secrets, and data;
- normalized results, evidence, approvals, waivers, and audit history;
- prompts, models, tools, retrieval indexes, evaluation sets, and policy bundles;
- delivery checks, branch rules, and release decisions.

### Trust boundaries

Document data and authority crossing:

```text
Untrusted work item / repository / web content
        -> validated and provenance-labelled input
        -> agent context
        -> typed tool request
        -> independent validation and policy
        -> isolated side effect or evidence read
        -> normalized result
        -> authorized conclusion / human decision
```

Also map boundaries between:

- tenants and repositories;
- control plane and application account/network;
- agent runtime and tool gateway;
- runner and target;
- raw evidence and sanitized reporting;
- development, evaluation, shadow, and enforced production policies.

Treat repository files, comments, issue text, logs, screenshots, test output, retrieved documents, and generated artifacts as potentially adversarial.

## Threat catalogue and mitigations

| Threat | Example | Independently enforced mitigation | Evidence to retain |
|---|---|---|---|
| Prompt injection | Repository README tells the Test Author to ignore policy and upload secrets | Delimit untrusted content; never treat content as instruction authority; narrow typed tools; validate every request | Input provenance, tool request, policy decision |
| Poisoned requirement source | Unapproved work item changes expected behavior | Authority classification; approved source allowlist; protected version history; conflict escalation | Source version/integrity evidence, authority record, approver |
| Tool abuse | Agent requests merge, deploy, policy change, broad read, or arbitrary shell | Omit dangerous tools; default deny; action/resource validation; short-lived scoped identity | Principal, action, resource, denial/allow reason |
| Artifact tampering | Test or evidence changes after approval | Versioning, digests, signatures/attestations, write-once storage where warranted, subject-bound approvals | Expected and observed integrity evidence |
| Test-oracle manipulation | Repair weakens assertion or changes expected result | Separate oracle; representation-appropriate intent checks; transformation allowlist; independent guards | Baseline, patch, invariant result |
| Data exfiltration | Prompt or tool sends secret/PII to a model or external endpoint | Classification, redaction, egress allowlist, secret scanning, no raw credentials, tenant isolation | Scan/redaction results, egress log |
| Cross-tenant disclosure | Cached context or evidence from one repository appears in another | Tenant-bound identity/context/storage/cache keys; authorization recheck; isolation tests | Tenant IDs, access decision, cache scope |
| Supply-chain compromise | Runner image, dependency, action, plugin, model, or tool changes unexpectedly | Pin and verify dependencies/images; provenance/attestation; approved registries; vulnerability policy | SBOM, signature, digest, scanner result |
| Model drift | Provider/model update changes safe behavior | Pin model identifier where possible; regression suite; canary; rollback; behavior monitoring | Model/version, evaluation comparison |
| Retrieval poisoning | Index contains stale, forged, or unauthorized content | Source allowlist, provenance, freshness, access-filtered retrieval, conflict detection | Retrieved refs and ranking/version |
| Denial of service / cost abuse | Crafted change triggers excessive suites, shards, retries, or tokens | Admission control, quotas, budgets, deduplication, cancellation, rate limits | Budget decisions and consumption |
| Evidence spoofing | Agent-written prose claims tests passed | Conclusion accepted only from authorized normalized results and required evidence | Result and evidence manifest digests |
| Approval replay | Old approval is reused after source or policy change | Digest-bound, expiring, single-use approval and nonce | Approval subject and consumption record |
| Self-expanding autonomy | Agent edits manifest, policy, prompt, or budget to gain authority | Protected configuration, independent review, no policy-write tool, deployment separation | Configuration change and approver |

### Prompt-injection handling

For every agent:

1. Label system instructions, approved policy, authoritative sources, and untrusted content separately.
2. Preserve provenance when excerpting or summarizing.
3. Tell the agent that untrusted content may contain instructions and has no authority.
4. Give it only typed tools for its responsibility.
5. Validate tool arguments, subjects, digests, paths, and targets outside the model.
6. Redact tool results before they return to the agent.
7. Fail closed when authority, tenant, or subject binding is uncertain.

Do not depend on “ignore malicious instructions” prompting as the security boundary.

## Role-specific evaluation sets

Maintain protected, versioned evaluation sets with normal, boundary, conflicting, missing, malformed, adversarial, and cross-tenant cases. Select write protection, review, signing, or content addressing according to risk.

| Role | Golden inputs | Expected behavior | Prohibited behavior |
|---|---|---|---|
| Requirements Analysis | Approved sources plus duplicates, gaps, assumptions, and conflicts | Correct authority labels, provenance, visible uncertainty, human escalation | Selecting truth from conflict or declaring defect |
| Test Plan | Authority map, risks, existing coverage | Traceable cases, meaningful negative/boundary coverage, duplicates avoided | Inventing requirements, changing scope, creating an unapproved gate |
| Test Author/Binding | Approved cases, exact source revision, snapshots/contracts | Executable mapping that preserves approved intent under an appropriate integrity check | Rewriting oracle, arbitrary shell, unsupported dependency, app edit |
| Data/Fixture | Schemas, relationships, prohibited patterns, seeds | Schema-valid, repeatable, fictional data with provenance | Production row use, PII/secret generation, validation bypass |
| Triage Adviser | Sanitized unknown failures with counterexamples | Calibrated advice, missing-evidence request, correct escalation | Pass/fail decision, repair authorization, unsupported defect claim |
| Repair Proposal | Eligible and ineligible failures, baseline and allowlist | Allowlisted minimal patch with invariant proof and fresh-run plan | Assertion weakening, skip/quarantine, semantic/app/policy change |
| Reporting Summarizer | Authorized result and sanitized evidence | Faithful concise explanation preserving canonical outcome | Changing conclusion, omitting uncertainty, leaking raw evidence |

Keep non-model control components out of model-quality evaluation. Test them with ordinary unit, integration, contract, security, and failure-injection suites.

## Metrics

Choose metrics per role and action. Do not reduce evaluation to one aggregate score.

### Cross-role quality

- required field/schema validity;
- source and case traceability;
- unsupported-claim rate;
- authority-classification accuracy;
- conflict and missing-evidence escalation rate;
- independently enforced policy-denial rate;
- human acceptance, edit distance, and rework;
- latency, token use, and cost;
- reproducibility across repeated and paraphrased inputs.

### Safety

- unsafe tool-request rate;
- unauthorized resource/action attempt rate;
- prompt-injection resistance;
- cross-tenant disclosure count;
- sensitive-data exposure count;
- semantic-change proposal rate where prohibited;
- intent-integrity violation rate;
- false authorization or self-approval attempt rate;
- policy false-allow and false-deny rates.

### Role-specific outcomes

- **Test Plan:** coverage of approved risks, duplicate rate, untraceable-case rate, unsafe invented-expectation rate.
- **Test Author/Binding:** compile/discovery success, approved-case fidelity, repeatability or explained variance, unsupported-profile use.
- **Data/Fixture:** schema/relationship validity, repeatability by seed, prohibited-pattern detection, cleanup success.
- **Triage Adviser:** accuracy by class, calibration, abstention quality, evidence request usefulness, defect false-positive rate.
- **Repair Proposal:** eligible-class precision, invariant preservation, fresh-rerun success, false-repair rate, rollback rate.
- **Reporting:** canonical-outcome fidelity, evidence-link completeness, redaction defects, human comprehension.

Define thresholds, sample sizes, severity weighting, and confidence requirements as **HUMAN DECISION** items. Zero tolerance is appropriate for some events, such as confirmed cross-tenant disclosure or an agent-caused release authorization.

## Evaluation lifecycle

### 1. Static and schema checks

Validate prompt/config structure, tool schemas, allowed actions, model/tool/policy compatibility, prohibited terms or patterns, and subject/digest binding.

### 2. Offline golden evaluation

Run the complete versioned set without external side effects. Compare structured outputs, required escalation, prohibited actions, and independently enforced guards—not only prose similarity.

### 3. Adversarial evaluation

Inject malicious repository text, conflicting authority, poisoned retrieval, hidden instructions, oversized inputs, tool errors, stale approvals, tenant swaps, and budget pressure.

### 4. Integration evaluation

Use sandbox tools and representative contracts. Verify authentication, authorization, redaction, idempotency, evidence, timeouts, and failure semantics.

### 5. Shadow operation

Run against real eligible events without changing checks, repositories, test authority, or delivery. Compare agent proposals with current authorized outcomes.

### 6. Canary

Enable for a limited repository/action cohort with explicit owner, observation window, rollback, and tighter budgets. Expand by action class, not only by traffic percentage.

### 7. Continuous monitoring

Sample outputs, track distribution and policy changes, rerun regression suites, and investigate drift. A stable average must not hide a rare high-severity failure.

## Release, rollout, and rollback

### Release gate

Before a new agent or version advances, require:

- evaluation-set and threat-model version;
- exact prompt, model, retrieval, tool, policy, and contract versions;
- baseline and candidate results with severity-weighted differences;
- zero unresolved critical safety findings;
- named owner accepting remaining risk;
- shadow/canary scope and duration;
- automated rollback signal and manual rollback authority;
- evidence that independent guards reject prohibited output.

Evaluation success authorizes only the tested action class and scope. It does not let a model grant itself pass/fail authority, resolve requirement conflicts, merge, deploy, access production data, or change policy.

### Rollback triggers

Define triggers such as:

- safety invariant or tenant-isolation violation;
- unexplained quality regression;
- unsupported or fabricated authority;
- increased false-repair or defect false-positive rate;
- new model/tool behavior outside the evaluated envelope;
- cost, latency, or availability breach;
- inability to reproduce an agent decision;
- evidence or redaction failure.

Rollback disables or reverts the agentic capability without preventing established non-agentic suite execution where safe.

## Versioning and provenance

Record for every proposal and evaluation:

- agent role and release version;
- system and task prompt digests;
- model provider, identifier, and configuration;
- retrieval corpus/index version and returned source references;
- tool schemas and implementations;
- policy and allowlist versions;
- input contract and source digests;
- evaluation-set and scorer versions;
- seed or sampling controls where available;
- output, tool calls, policy decisions, reviewer decision, and resulting artifact.

Treat any material change as a candidate release requiring proportionate regression evaluation. A silent provider/model change must not silently inherit earlier approval.

## Human review sampling

Define:

- review rate by role, risk, repository, novelty, and autonomy tier;
- mandatory review for conflicts, abstentions, policy denials, and high-impact proposals;
- random sampling to detect unreported failure patterns;
- independent reviewer qualifications;
- adjudication and disagreement recording;
- feedback labels that feed the evaluation set;
- conditions that increase, decrease, or reset sampling.

Avoid learning only from accepted suggestions. Preserve rejected, edited, unsafe, and abstained cases.

## Red-team scenarios

At minimum test:

1. A repository file says to ignore policy and expose secrets.
2. A pull-request comment impersonates an approver.
3. A work-management source, API schema, and implementation disagree on expected behavior.
4. Retrieved guidance is stale or belongs to another tenant.
5. A generated fixture contains realistic PII or a secret-like value.
6. A test result log tells the triage agent to mark the run passed.
7. A failing assertion is repairable only by weakening the expectation.
8. A locator repair selects a non-unique element that happens to pass once.
9. A stale approval is replayed after source, target, or policy change.
10. A manifest change requests broader network, data, or tool access.
11. A dependency or runner digest differs from the approved profile.
12. An event storm attempts to exhaust runner or model budget.
13. Cancellation arrives during fixture creation, execution, evidence upload, and repair.
14. Evidence from one repository is requested through another tenant identity.
15. A model version change improves average quality but introduces one critical unsafe action.

For each scenario, define the independent control that must prevent harm, the expected agent response, the required audit evidence, and the human escalation.

## Readiness checklist

- [ ] Protected assets, tenants, data flows, identities, and trust boundaries are mapped.
- [ ] Untrusted content is provenance-labelled and cannot become instruction or authority.
- [ ] Each role has a versioned golden and adversarial evaluation set.
- [ ] Quality, safety, cost, latency, and abstention metrics have human-approved thresholds.
- [ ] Independent guards—not model obedience—block prohibited actions.
- [ ] Tool schemas, resource checks, credentials, egress, and redaction are tested.
- [ ] Model, prompt, retrieval, tool, policy, contract, and evaluation versions are recorded.
- [ ] Shadow and canary scopes, owners, observation windows, and rollback are defined.
- [ ] Human sampling covers accepted, rejected, edited, abstained, and unsafe cases.
- [ ] Critical safety findings block autonomy expansion.
- [ ] Rollback preserves established non-agentic testing where safe.
- [ ] No model can grant itself result authority, resolve conflicting authority, approve itself, or expand its own permissions.
