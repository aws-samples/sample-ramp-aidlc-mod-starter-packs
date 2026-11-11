// Approved incompatibilities: harnesses of the adapter registry that QA
// Automated Testing may leave undeclared, keyed by harness id, each with the
// reason it was approved, for example
//   'some-harness': 'reads no project-level MCP configuration',
// qa-harness-coverage.test.js skips every harness listed here. The harness
// registry drift test enforces the rules for an entry; adding one is a
// reviewed change to this module, and that review is the approval.
export const harnessIncompatibilities = Object.freeze({})
