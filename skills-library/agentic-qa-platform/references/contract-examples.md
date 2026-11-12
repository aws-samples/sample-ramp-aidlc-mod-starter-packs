# Contract Examples

These examples make the contracts in `contracts-and-evidence.md` concrete. They are illustrative, organization-neutral starting points—not deployable schemas. They intentionally show content digests, protected references, and intent fingerprints as one high-control implementation; substitute other mechanisms that provide equivalent provenance, integrity, and intent preservation for the target risk and representation. Adapt field names, identity formats, signing, storage, delivery-system mappings, and policy integration, then validate them with schema tests and security review.

Never put real secrets, credentials, production records, real-world identifiers, or sensitive evidence into an example or workflow payload.

## Contents

- [Conventions](#conventions)
- [Central project registry](#central-project-registry)
- [Repository manifest](#repository-manifest)
- [Deployment-ready trigger](#deployment-ready-trigger)
- [Requirement authority record](#requirement-authority-record)
- [Approved test case](#approved-test-case)
- [Declarative binding](#declarative-binding)
- [Runner profile](#runner-profile)
- [Fixture manifest](#fixture-manifest)
- [Execution request](#execution-request)
- [Normalized test result](#normalized-test-result)
- [Failure classification](#failure-classification)
- [Repair proposal](#repair-proposal)
- [Digest-bound approval](#digest-bound-approval)
- [Evidence manifest](#evidence-manifest)
- [Published check](#published-check)
- [Validation checklist](#validation-checklist)

## Conventions

Examples use `${PLACEHOLDER}` for deployment-specific values. A reference such as `sha256:${DIGEST_HEX}` means the producer must calculate a real digest over an agreed canonical representation. Do not accept a placeholder at runtime.

Apply these outcome requirements to every material contract; the mechanism may vary:

- Require an explicit `kind` and supported `schema_version`.
- Validate the complete payload before acting.
- Resolve mutable names to an exact, authorized version and retain integrity evidence.
- Record producer identity and version.
- Use globally unique event/run identifiers and idempotency keys.
- Pass large artifacts by protected or content-addressed reference, not inline.
- Reject stale, expired, unsigned, unauthorized, or unsupported contracts.
- Recompute and compare digests at trust boundaries.
- Treat unknown required fields or unsupported major versions according to a documented compatibility policy.
- Never infer authority from repository location alone.

The examples show an `artifact` envelope. Define whether its digest covers the canonical document excluding `artifact.digest`, or use a detached manifest/signature. Apply one rule consistently.

## Central project registry

Use a protected registry when a central or hybrid operating model requires authoritative mappings. Repository pull requests must not be able to expand their own privileges.

```yaml
kind: QaProjectRegistration
schema_version: "1.0"
artifact:
  id: qa-project:${PROJECT_ID}:v3
  content_ref: object://${REGISTRY_BUCKET}/projects/${PROJECT_ID}/v3.yaml
  digest: sha256:${REGISTRATION_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: platform-registry-service
    version: "2.4.0"
  approval_ref: approval://${REGISTRATION_APPROVAL_ID}

project:
  id: "${PROJECT_ID}"
  display_name: "${PROJECT_DISPLAY_NAME}"
  work_item_namespace: "${WORK_ITEM_NAMESPACE}"

repositories:
  - id: "${REPOSITORY_ID}"
    forge: "${FORGE_TYPE}"
    repository_ref: forge://${ORGANIZATION}/${REPOSITORY}
    default_branch: "${DEFAULT_BRANCH}"
    manifest_path: .qa-platform.yaml
    allowed_environment_classes:
      - pull-request-preview
      - integration

authority:
  test_oracle:
    type: protected-repository
    repository_ref: forge://${QA_ORGANIZATION}/${QA_CASES_REPOSITORY}
    publication_policy: human-reviewed-versioned-bundle
  registry_precedence: authoritative
  repository_manifest_may_request: true
  repository_manifest_may_expand_access: false

profiles:
  allowed_runner_profiles:
    - ref: runner-profile://web-browser/v2
      digest: sha256:${WEB_PROFILE_DIGEST}
    - ref: runner-profile://api-contract/v1
      digest: sha256:${API_PROFILE_DIGEST}

execution:
  placement: application-boundary
  execution_tenant: "${EXECUTION_TENANT_ID}"
  network_zone: "${NON_PRODUCTION_NETWORK_ZONE}"
  target_classes:
    - pull-request-preview
  production_targets_allowed: false

governance:
  autonomy_tier: author
  policy_ref: policy://qa-platform/${POLICY_VERSION}
  policy_digest: sha256:${POLICY_DIGEST}
  repair:
    enabled: false
    allowed_transformations: []
  owners:
    application: group:${APPLICATION_OWNER_GROUP}
    qa_approval: group:${QA_APPROVER_GROUP}
    platform_operations: group:${PLATFORM_OWNER_GROUP}
    security: group:${SECURITY_OWNER_GROUP}
  exception_ref: null

evidence:
  classification: internal
  retention_class: qa-standard
  residency: "${RESIDENCY_CLASS}"
  sanitized_summary_visibility: repository-contributors
```

## Repository manifest

Keep this lightweight. In a centrally governed model, it declares repository-local facts and requests; the registry and policy remain authoritative.

```yaml
kind: QaRepositoryManifest
schema_version: "1.0"
repository:
  project_id: "${PROJECT_ID}"
  repository_id: "${REPOSITORY_ID}"
  registration_ref: qa-project:${PROJECT_ID}:v3

owners:
  application: "${APPLICATION_OWNER_ALIAS}"
  qa_contact: "${QA_CONTACT_ALIAS}"

targets:
  preview:
    discovery:
      type: deployment-environment
      environment_name_template: "pr-${CHANGE_NUMBER}"
    health_path: /health

requested_profiles:
  - runner-profile://web-browser/v2

fixtures:
  setup_contract: fixtures/setup-request.schema.json
  cleanup_contract: fixtures/cleanup-request.schema.json

evidence:
  requested_artifacts:
    - trace
    - screenshot-on-failure

# Requests never override protected registry or policy.
requested_autonomy:
  tier: author
  repair_enabled: false
```

Repository-manifest changes must receive the repository's normal review, but review alone must not grant execution, network, data, or repair authority. The platform validates requests against the protected registration and policy.

## Deployment-ready trigger

The transport authenticates and signs the event. The body binds the run to an exact source revision and deployed target. Validate signature, issuer, audience, freshness, nonce, and replay state before resolving any target.

```json
{
  "kind": "QaDeploymentReadyEvent",
  "schema_version": "1.0",
  "event": {
    "id": "${EVENT_UUID}",
    "occurred_at": "${RFC3339_TIMESTAMP}",
    "issuer": "workload://${CI_WORKLOAD_ID}",
    "audience": "qa-control-plane",
    "nonce": "${UNIQUE_NONCE}",
    "idempotency_key": "${REPOSITORY_ID}:${FULL_SOURCE_COMMIT_SHA}:${DEPLOYMENT_ID}"
  },
  "correlation": {
    "project_id": "${PROJECT_ID}",
    "repository_id": "${REPOSITORY_ID}",
    "change_id": "${CHANGE_ID}",
    "deployment_id": "${DEPLOYMENT_ID}",
    "requested_run_id": "${RUN_UUID}"
  },
  "source": {
    "repository_ref": "forge://${ORGANIZATION}/${REPOSITORY}",
    "revision": "${FULL_SOURCE_COMMIT_SHA}",
    "tree_digest": "sha256:${SOURCE_TREE_DIGEST}"
  },
  "deployment": {
    "environment_class": "pull-request-preview",
    "environment_id": "${ENVIRONMENT_INSTANCE_ID}",
    "target_ref": "target://${TARGET_ID}",
    "target_attestation_ref": "attestation://${TARGET_ATTESTATION_ID}",
    "expires_at": "${RFC3339_EXPIRY}"
  },
  "authentication": {
    "method": "${SIGNED_WEBHOOK_OR_WORKLOAD_IDENTITY}",
    "signature_ref": "transport-header",
    "certificate_or_key_id": "${KEY_ID}"
  }
}
```

The receiver should re-read repository, deployment, and target facts from their authoritative systems where practical. A valid signature proves the issuer, not that every claim is authorized.

## Requirement authority record

This example preserves a conflict. It can support visible draft planning, but it is explicitly ineligible for defect confirmation or release gating.

```yaml
kind: RequirementAuthorityRecord
schema_version: "1.0"
artifact:
  id: expectation:refund-window:v5
  content_ref: object://${AUTHORITY_BUCKET}/refund-window/v5.yaml
  digest: sha256:${AUTHORITY_RECORD_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: requirements-analysis-agent
    version: "${AGENT_PROMPT_AND_MODEL_VERSION}"

expectation:
  id: refund-window
  classification: conflicting
  statement: Refund eligibility window is unresolved.
  sources:
    - type: work-item
      versioned_ref: work-item://${WORK_ITEM_ID}@${WORK_ITEM_REVISION}
      digest: sha256:${WORK_ITEM_DIGEST}
      claim: "30 days"
    - type: api-contract
      versioned_ref: object://${CONTRACT_BUCKET}/refund-api/${CONTRACT_VERSION}.yaml
      digest: sha256:${API_CONTRACT_DIGEST}
      claim: "14 days"
    - type: observed-implementation
      versioned_ref: forge://${ORGANIZATION}/${REPOSITORY}@${FULL_SOURCE_COMMIT_SHA}
      digest: sha256:${SOURCE_TREE_DIGEST}
      claim: "7 days"

authority:
  decision_status: pending
  accountable_owner: group:${PRODUCT_API_OWNER_GROUP}
  gate_eligible: false
  defect_confirmation_allowed: false
  semantic_repair_allowed: false
  next_action: request-human-decision
```

When the conflict is resolved, publish a protected new version linked to this one. Never overwrite the conflict history.

## Approved test case

This example references an authoritative expectation and a separate human approval. The case expresses intent; bindings and generated tests remain replaceable mechanisms.

```yaml
kind: ApprovedTestCase
schema_version: "1.0"
artifact:
  id: test-case:${TEST_CASE_ID}:v4
  content_ref: object://${CASE_BUCKET}/${TEST_CASE_ID}/v4.yaml
  digest: sha256:${TEST_CASE_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: qa-case-publisher
    version: "1.8.0"
  approval_ref: approval://${CASE_APPROVAL_ID}

case:
  id: "${TEST_CASE_ID}"
  version: 4
  status: approved
  authority:
    expectation_ref: expectation:declined-card-behavior:v2
    expectation_digest: sha256:${EXPECTATION_DIGEST}
    classification: authoritative
  risk:
    priority: high
    tags:
      - "${CAPABILITY_TAG}"
      - payment
      - negative-path
  intent:
    given:
      - A fictional customer has an unpaid cart.
      - The approved payment simulator returns a declined response.
    when:
      - The customer submits payment.
    then:
      - The order is not confirmed.
      - A non-sensitive decline message is shown.
      - No successful-payment event is emitted.
  supported_profiles:
    - runner-profile://web-browser/v2
    - runner-profile://api-contract/v1
  scenario_fingerprint: sha256:${SCENARIO_FINGERPRINT}
  assertion_fingerprints:
    - sha256:${ORDER_ASSERTION_FINGERPRINT}
    - sha256:${MESSAGE_ASSERTION_FINGERPRINT}
    - sha256:${EVENT_ASSERTION_FINGERPRINT}
  gate_eligible: true
```

## Declarative binding

Prefer a fixed interpreter over arbitrary generated code when the approved intent can be represented declaratively.

```yaml
kind: DeclarativeTestBinding
schema_version: "1.0"
artifact:
  id: binding:${TEST_CASE_ID}:web:v7
  content_ref: object://${BINDING_BUCKET}/${TEST_CASE_ID}/web/v7.yaml
  digest: sha256:${BINDING_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: test-author-agent
    version: "${AGENT_PROMPT_AND_MODEL_VERSION}"

binding:
  test_case_ref: test-case:${TEST_CASE_ID}:v4
  test_case_digest: sha256:${TEST_CASE_DIGEST}
  source:
    repository_ref: forge://${ORGANIZATION}/${REPOSITORY}
    revision: "${FULL_SOURCE_COMMIT_SHA}"
    tree_digest: sha256:${SOURCE_TREE_DIGEST}
  runner_profile_ref: runner-profile://web-browser/v2
  runner_profile_digest: sha256:${WEB_PROFILE_DIGEST}
  steps:
    - action: navigate
      route: "${APPLICATION_ROUTE}"
    - action: fill
      target:
        strategy: accessible-role
        role: textbox
        name: Card number
      value_ref: fixture://declined-card/number
    - action: activate
      target:
        strategy: accessible-role
        role: button
        name: Pay now
    - assert:
        type: visible-text
        value: Payment could not be completed
        assertion_fingerprint: sha256:${MESSAGE_ASSERTION_FINGERPRINT}
    - assert:
        type: order-status
        value: payment-declined
        assertion_fingerprint: sha256:${ORDER_ASSERTION_FINGERPRINT}
    - assert:
        type: event-absent
        event_type: payment.succeeded
        assertion_fingerprint: sha256:${EVENT_ASSERTION_FINGERPRINT}
  prohibited_capabilities:
    - arbitrary-shell
    - arbitrary-network
    - dynamic-package-install
    - expectation-rewrite
  validation:
    schema_valid: true
    scenario_fingerprint: sha256:${SCENARIO_FINGERPRINT}
    assertion_set_digest: sha256:${ASSERTION_SET_DIGEST}
```

## Runner profile

The runner profile is platform policy. Pin executable content and make limits and prohibited behavior machine-verifiable.

```yaml
kind: RunnerProfile
schema_version: "1.0"
artifact:
  id: runner-profile://web-browser/v2
  content_ref: object://${PROFILE_BUCKET}/web-browser/v2.yaml
  digest: sha256:${WEB_PROFILE_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: qa-platform-release
    version: "${PLATFORM_RELEASE_VERSION}"
  approval_ref: approval://${PROFILE_APPROVAL_ID}

profile:
  interpreter:
    type: fixed-declarative-runner
    image_ref: registry://${RUNNER_IMAGE}@sha256:${RUNNER_IMAGE_DIGEST}
    entrypoint: /opt/qa-runner/execute
    dynamic_package_install: false
  supported_contracts:
    binding_major_versions: [1]
    fixture_major_versions: [1]
    result_major_versions: [1]
  targets:
    allowed_environment_classes:
      - pull-request-preview
      - integration
    production_allowed: false
  network:
    default: deny
    destinations:
      - purpose: application-under-test
        ref: target://${TARGET_ID}
      - purpose: approved-test-dependency
        ref: service://${PAYMENT_SIMULATOR_ID}
  credentials:
    merge: none
    deployment: none
    production_data: none
    policy_change: none
    evidence_write: run-scoped
  budgets:
    max_elapsed_seconds: ${MAX_ELAPSED_SECONDS}
    max_parallel_tests: ${MAX_PARALLEL_TESTS}
    max_evidence_bytes: ${MAX_EVIDENCE_BYTES}
    max_network_bytes: ${MAX_NETWORK_BYTES}
  evidence:
    required:
      - normalized-result
      - executor-log
      - cleanup-result
    on_failure:
      - trace
      - screenshot
  repair:
    permitted_transformations:
      - semantic-locator-replacement
      - bounded-condition-wait
      - same-schema-fixture-regeneration
    max_attempts: ${MAX_REPAIR_ATTEMPTS}
    assertion_change_allowed: false
    scenario_change_allowed: false
```

## Fixture manifest

Generate fictional data from approved schemas. Use recorded seeds where replay matters. Keep secrets in an independently controlled secret-resolution boundary, never in the manifest.

```yaml
kind: FixtureManifest
schema_version: "1.0"
artifact:
  id: fixture:${TEST_CASE_ID}:${FIXTURE_VERSION}
  content_ref: object://${FIXTURE_BUCKET}/${FIXTURE_ARTIFACT_KEY}
  digest: sha256:${FIXTURE_MANIFEST_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: fixture-generator
    version: "${GENERATOR_VERSION}"

fixture:
  test_case_ref: test-case:${TEST_CASE_ID}:v4
  schema_refs:
    - ref: schema://${FIXTURE_SCHEMA_ID}/v3
      digest: sha256:${CUSTOMER_SCHEMA_DIGEST}
    - ref: schema://payment-simulator/v2
      digest: sha256:${SIMULATOR_SCHEMA_DIGEST}
  generation:
    data_class: fictional-synthetic
    root_seed: "${NON_SECRET_RUN_SEED}"
    locale: "${TEST_LOCALE}"
    production_rows_used: false
  values:
    customer:
      email: qa-user-${RUN_ID}@example.invalid
      display_name: Example Test User
    declined_card:
      token_ref: simulator-token://declined-card
  setup:
    interface_ref: fixture-interface://${FIXTURE_INTERFACE_ID}/v2
    idempotency_key: "${RUN_ID}:fixture-setup"
  cleanup:
    interface_ref: fixture-interface://${FIXTURE_INTERFACE_ID}/v2
    idempotency_key: "${RUN_ID}:fixture-cleanup"
    required_on:
      - success
      - failure
      - timeout
      - cancellation
  validation:
    schema_valid: true
    relationship_valid: true
    pii_scan: passed
    secret_scan: passed
    prohibited_pattern_scan: passed
```

## Execution request

Only the independently authorized controller issues an execution request. Requested budgets must not exceed the runner profile or active policy.

```yaml
kind: QaExecutionRequest
schema_version: "1.0"
artifact:
  id: execution-request:${RUN_ID}:attempt-1
  digest: sha256:${EXECUTION_REQUEST_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: qa-workflow-controller
    version: "${CONTROLLER_VERSION}"

run:
  id: "${RUN_ID}"
  attempt: 1
  correlation:
    project_id: "${PROJECT_ID}"
    repository_id: "${REPOSITORY_ID}"
    change_id: "${CHANGE_ID}"
    deployment_id: "${DEPLOYMENT_ID}"
  source:
    revision: "${FULL_SOURCE_COMMIT_SHA}"
    tree_digest: sha256:${SOURCE_TREE_DIGEST}
  suite:
    ref: suite://${SUITE_ID}/${SUITE_VERSION}
    digest: sha256:${SUITE_DIGEST}
  bindings:
    - ref: binding:${TEST_CASE_ID}:web:v7
      digest: sha256:${BINDING_DIGEST}
  fixtures:
    ref: fixture:${TEST_CASE_ID}:${FIXTURE_VERSION}
    digest: sha256:${FIXTURE_MANIFEST_DIGEST}
  runner:
    profile_ref: runner-profile://web-browser/v2
    profile_digest: sha256:${WEB_PROFILE_DIGEST}
    image_digest: sha256:${RUNNER_IMAGE_DIGEST}
  target:
    ref: target://${TARGET_ID}
    environment_class: pull-request-preview
    attestation_ref: attestation://${TARGET_ATTESTATION_ID}
  policy:
    ref: policy://qa-platform/${POLICY_VERSION}
    digest: sha256:${POLICY_DIGEST}
    decision_ref: policy-decision://${EXECUTION_POLICY_DECISION_ID}
  budgets:
    max_elapsed_seconds: ${RUN_MAX_ELAPSED_SECONDS}
    max_parallel_tests: ${RUN_MAX_PARALLEL_TESTS}
    max_evidence_bytes: ${RUN_MAX_EVIDENCE_BYTES}
  authorization:
    action: execute-approved-suite
    principal: workload://qa-workflow-controller
    expires_at: "${RFC3339_EXPIRY}"
```

## Normalized test result

This example is `inconclusive`: the approved assertion did not execute because a binding locator failed. It cannot satisfy a release gate.

```yaml
kind: NormalizedTestResult
schema_version: "1.0"
artifact:
  id: result:${RUN_ID}:attempt-1
  content_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-1/result.yaml
  digest: sha256:${RESULT_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: web-runner
    version: "${RUNNER_VERSION}"
  attestation_ref: attestation://${EXECUTOR_ATTESTATION_ID}

result:
  run_id: "${RUN_ID}"
  execution_request_digest: sha256:${EXECUTION_REQUEST_DIGEST}
  terminal_outcome: inconclusive
  gate_satisfied: false
  counts:
    required_cases: 1
    passed: 0
    failed_product_expectation: 0
    not_executed: 1
  cases:
    - test_case_ref: test-case:${TEST_CASE_ID}:v4
      binding_ref: binding:${TEST_CASE_ID}:web:v7
      status: not_executed
      failure_code: binding_target_not_found
      scenario_fingerprint: sha256:${SCENARIO_FINGERPRINT}
      assertion_set_digest: sha256:${ASSERTION_SET_DIGEST}
      evidence_refs:
        - object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-1/trace.zip
        - object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-1/screenshot.png
  cleanup:
    status: completed
    record_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-1/cleanup.json
```

## Failure classification

Apply fixed rules to mechanically decidable evidence. Governed evaluators or human review may handle subjective or unresolved evidence; an adviser cannot authorize repair or silently become result authority.

```yaml
kind: FailureClassification
schema_version: "1.0"
artifact:
  id: classification:${RUN_ID}:attempt-1
  content_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-1/classification.yaml
  digest: sha256:${CLASSIFICATION_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: governed-failure-classifier
    version: "${CLASSIFIER_RULESET_VERSION}"

classification:
  run_id: "${RUN_ID}"
  result_digest: sha256:${RESULT_DIGEST}
  class: test-binding-implementation-defect
  rule_id: semantic-target-missing-with-valid-target-health
  confidence_basis: fixed-rule-match
  evidence:
    target_health: passed
    fixture_setup: passed
    failing_step: binding-step-3
    assertion_executed: false
  repair:
    eligible: true
    permitted_transformations:
      - semantic-locator-replacement
    authorization_required: true
  product_defect_confirmed: false
```

## Repair proposal

A proposal is not authorization. Preserve case intent using a representation-appropriate integrity check, enforce a transformation allowlist, and verify independently in a fresh run with isolation proportionate to risk. The example below uses fingerprints and digests as one implementation.

```yaml
kind: RepairProposal
schema_version: "1.0"
artifact:
  id: repair-proposal:${RUN_ID}:1
  content_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/repairs/1.yaml
  digest: sha256:${REPAIR_PROPOSAL_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: repair-agent
    version: "${AGENT_PROMPT_AND_MODEL_VERSION}"

proposal:
  run_id: "${RUN_ID}"
  classification_ref: classification:${RUN_ID}:attempt-1
  classification_digest: sha256:${CLASSIFICATION_DIGEST}
  baseline_binding_ref: binding:${TEST_CASE_ID}:web:v7
  baseline_binding_digest: sha256:${BINDING_DIGEST}
  transformation:
    type: semantic-locator-replacement
    path: binding.steps[2].target
    before:
      strategy: accessible-role
      role: button
      name: Submit payment
    after:
      strategy: accessible-role
      role: button
      name: Pay now
    evidence_ref: snapshot://${ACCESSIBILITY_SNAPSHOT_ID}
  invariant_proof:
    test_case_digest_unchanged: sha256:${TEST_CASE_DIGEST}
    scenario_fingerprint_before: sha256:${SCENARIO_FINGERPRINT}
    scenario_fingerprint_after: sha256:${SCENARIO_FINGERPRINT}
    assertion_set_digest_before: sha256:${ASSERTION_SET_DIGEST}
    assertion_set_digest_after: sha256:${ASSERTION_SET_DIGEST}
    prohibited_files_changed: []
  budgets:
    repair_attempt: 1
    files_changed: 1
    transformations_used:
      - semantic-locator-replacement
  verification:
    fresh_isolation_required: true
    affected_suite_required: true
    requested_next_attempt: 2
  authorization:
    status: pending
    agent_self_approval_allowed: false
```

## Digest-bound approval

The approver must be independent of the proposing agent. A subject change invalidates the approval.

```yaml
kind: ApprovalDecision
schema_version: "1.0"
artifact:
  id: approval:${REPAIR_APPROVAL_ID}
  content_ref: approval://${REPAIR_APPROVAL_ID}
  digest: sha256:${APPROVAL_RECORD_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: approval-service
    version: "${APPROVAL_SERVICE_VERSION}"

decision:
  action: apply-repair-and-run-verification
  status: approved
  requester:
    identity: agent://repair-agent
    request_digest: sha256:${REPAIR_PROPOSAL_DIGEST}
  approver:
    identity: human://${QA_APPROVER_ID}
    authentication_context_ref: auth-context://${AUTH_CONTEXT_ID}
  subjects:
    project_id: "${PROJECT_ID}"
    repository_id: "${REPOSITORY_ID}"
    source_digest: sha256:${SOURCE_TREE_DIGEST}
    test_case_digest: sha256:${TEST_CASE_DIGEST}
    baseline_binding_digest: sha256:${BINDING_DIGEST}
    repair_proposal_digest: sha256:${REPAIR_PROPOSAL_DIGEST}
    runner_profile_digest: sha256:${WEB_PROFILE_DIGEST}
    target_attestation_digest: sha256:${TARGET_ATTESTATION_DIGEST}
    policy_digest: sha256:${POLICY_DIGEST}
  constraints:
    environment_class: pull-request-preview
    max_consumptions: 1
    expires_at: "${RFC3339_EXPIRY}"
    nonce: "${APPROVAL_NONCE}"
    semantic_change_allowed: false
  consumption:
    status: unused
    consumed_at: null
    execution_request_digest: null
```

## Evidence manifest

Reference sanitized, access-controlled artifacts. The manifest records provenance and lifecycle rather than embedding raw logs.

```yaml
kind: EvidenceManifest
schema_version: "1.0"
artifact:
  id: evidence:${RUN_ID}:attempt-2
  content_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-2/manifest.yaml
  digest: sha256:${EVIDENCE_MANIFEST_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: evidence-publisher
    version: "${EVIDENCE_PUBLISHER_VERSION}"

evidence:
  run_id: "${RUN_ID}"
  attempt: 2
  correlation:
    project_id: "${PROJECT_ID}"
    repository_id: "${REPOSITORY_ID}"
    change_id: "${CHANGE_ID}"
    deployment_id: "${DEPLOYMENT_ID}"
  inputs:
    source_digest: sha256:${SOURCE_TREE_DIGEST}
    approved_suite_digest: sha256:${SUITE_DIGEST}
    test_case_digest: sha256:${TEST_CASE_DIGEST}
    binding_digest: sha256:${REPAIRED_BINDING_DIGEST}
    fixture_digest: sha256:${FIXTURE_MANIFEST_DIGEST}
    runner_profile_digest: sha256:${WEB_PROFILE_DIGEST}
    runner_image_digest: sha256:${RUNNER_IMAGE_DIGEST}
    target_attestation_digest: sha256:${TARGET_ATTESTATION_DIGEST}
    policy_digest: sha256:${POLICY_DIGEST}
  chain:
    prior_result_ref: result:${RUN_ID}:attempt-1
    classification_ref: classification:${RUN_ID}:attempt-1
    repair_proposal_ref: repair-proposal:${RUN_ID}:1
    approval_ref: approval://${REPAIR_APPROVAL_ID}
  outcome:
    terminal_outcome: passed
    normalized_result_ref: result:${RUN_ID}:attempt-2
    normalized_result_digest: sha256:${VERIFICATION_RESULT_DIGEST}
    all_required_assertions_executed: true
  artifacts:
    - type: sanitized-summary
      ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-2/summary.json
      digest: sha256:${SUMMARY_DIGEST}
      classification: internal
    - type: trace
      ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-2/trace.zip
      digest: sha256:${TRACE_DIGEST}
      classification: restricted
    - type: executor-log
      ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-2/executor.log
      digest: sha256:${EXECUTOR_LOG_DIGEST}
      classification: restricted
  controls:
    redaction_scan: passed
    secret_scan: passed
    pii_scan: passed
    encryption_class: "${ENCRYPTION_CLASS}"
    residency: "${RESIDENCY_CLASS}"
    retention_class: qa-standard
    access_policy_ref: policy://evidence-access/${EVIDENCE_POLICY_VERSION}
  cleanup:
    status: completed
    record_ref: object://${EVIDENCE_BUCKET}/runs/${RUN_ID}/attempt-2/cleanup.json
```

## Published check

External systems may have a smaller conclusion vocabulary. Preserve the canonical outcome and its evidence link. Only canonical `passed` may satisfy a required gate.

```yaml
kind: PublishedQaCheck
schema_version: "1.0"
artifact:
  id: published-check:${RUN_ID}
  digest: sha256:${PUBLISHED_CHECK_DIGEST}
  created_at: "${RFC3339_TIMESTAMP}"
  producer:
    identity: check-publisher
    version: "${CHECK_PUBLISHER_VERSION}"

check:
  run_id: "${RUN_ID}"
  source_revision: "${FULL_SOURCE_COMMIT_SHA}"
  evidence_manifest_ref: evidence:${RUN_ID}:attempt-2
  evidence_manifest_digest: sha256:${EVIDENCE_MANIFEST_DIGEST}
  canonical_outcome: passed
  external_mapping:
    system: "${FORGE_OR_DELIVERY_SYSTEM}"
    check_name: agentic-qa
    conclusion: success
    external_check_id: "${EXTERNAL_CHECK_ID}"
  gate:
    required: true
    satisfied: true
    only_satisfying_canonical_outcome: passed
  publication:
    idempotency_key: "${REPOSITORY_ID}:${FULL_SOURCE_COMMIT_SHA}:agentic-qa"
    sanitized_summary: All required approved assertions passed.
```

For every other canonical outcome—including `neutral`, `inconclusive`, `infrastructure_error`, and `platform_error`—set `gate.satisfied: false`. An accountable release waiver is a separate, audited approval record; it must not rewrite the QA outcome to `passed` or map the QA check to success.

If any referenced requirement remains `assumed` or `conflicting`, the suite is not eligible to satisfy the gate even if executed assertions happen to pass.

## Validation checklist

Before accepting a contract family:

- [ ] Schemas reject placeholders, missing required fields, unknown major versions, and malformed identifiers.
- [ ] Canonicalization and digest coverage are documented and tested.
- [ ] Signatures or attestations are verified at every trust boundary.
- [ ] Mutable names resolve to authorized exact versions with suitable integrity evidence.
- [ ] Registry and policy prevent repository configuration from expanding access.
- [ ] Event replay, duplicate delivery, superseded deployment, cancellation, and expiry are tested.
- [ ] Requirement authority and test-case approval are machine-checkable.
- [ ] Runner and execution-request budgets compose by taking the stricter bound.
- [ ] Generated execution has no merge, deployment, policy, broad repository, or production-data credentials.
- [ ] Result and conclusion mapping follows a versioned, independently enforced policy.
- [ ] Only `passed` can satisfy a required gate.
- [ ] Missing, stale, partial, unresolved, quarantined, or unauthorized evidence remains non-pass.
- [ ] Repair proposals preserve intent under an appropriate integrity mechanism and require separate authorization.
- [ ] Approval replay fails after expiry, consumption, or any bound-subject change.
- [ ] Evidence references enforce redaction, access, retention, encryption, and residency policy.
- [ ] Schema upgrade, backward compatibility, deprecation, and rollback paths are tested.
