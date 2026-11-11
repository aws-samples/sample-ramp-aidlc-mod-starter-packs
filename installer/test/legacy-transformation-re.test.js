import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveInstructionBody } from '../src/instructions/compose.js'
import { loadManifest } from '../src/manifest.js'
import { renderInstructions } from '../src/render/instructions.js'
import { renderCommand } from '../src/render/command.js'
import { resolveWorkspace } from '../src/workspace.js'

const here = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(here, '..', '..', 'packs', 'legacy-transformation-on-aws')
const repoRoot = resolve(packDir, '..', '..')
const manifest = loadManifest(packDir)
const readInstruction = (name) => resolveInstructionBody(manifest, packDir, name)
const localWorkflow = join(packDir, 'instructions', 'aidlc-workflow.md')
const localReverseEngineering = join(packDir, 'instructions', 'reverse-engineering.md')
const workflowOverlay = join(
  repoRoot,
  'workflows',
  'variants',
  'legacy-transformation-workflow.md',
)
const adaptiveOverlay = join(
  repoRoot,
  'workflows',
  'variants',
  'legacy-adaptive-reverse-engineering.md',
)
const qaPackDir = join(repoRoot, 'packs', 'qa-automated-testing')
const qaManifest = loadManifest(qaPackDir)
const commonPackDir = join(repoRoot, 'packs', 'agentic-ai-workflow')
const commonManifest = loadManifest(commonPackDir)
const byPath = (writes, path) => writes.find((write) => write.path === path)?.content ?? ''

// Extract a Markdown section (heading line through the line before the next
// heading of equal-or-higher level), skipping fenced code blocks.
function markdownSection(content, heading) {
  const lines = content.split(/\r?\n/)
  const headingMatch = heading.match(/^(#{1,6})\s+(.+)$/)
  if (!headingMatch) throw new Error(`invalid Markdown heading: ${heading}`)

  const level = headingMatch[1].length
  const start = lines.findIndex((line) => line.trim() === heading)
  expect(start, `expected section ${heading}`).toBeGreaterThanOrEqual(0)

  let end = lines.length
  let inFence = false
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*```/.test(lines[index])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const nextHeading = lines[index].match(/^(#{1,6})\s+/)
    if (nextHeading && nextHeading[1].length <= level) {
      end = index
      break
    }
  }

  return lines.slice(start, end).join('\n')
}

// --- Adaptive RE contract, asserted against the shipped instruction content ---

function expectModeAndExpansionSemantics(re, wf, source) {
  const targeted = markdownSection(re, '### Targeted mode (default)')
  expect(targeted, `${source}: Targeted is the bounded-objective default`).toMatch(
    /Targeted mode[\s\S]*(?:feature|journey|module|endpoint)[\s\S]*bounded objective/i,
  )
  expect(targeted, `${source}: a Targeted run must not claim whole-system completeness`).toMatch(
    /must not claim whole-system completeness/i,
  )

  const full = markdownSection(re, '### Full mode')
  expect(full, `${source}: Full requires an explicit request or approved expansion`).toMatch(
    /Full mode only when[\s\S]*explicitly requests system-wide analysis[\s\S]*or\s+explicitly approves a major expansion to Full/i,
  )

  const reExpansion = markdownSection(re, '### Expansion')
  expect(reExpansion, `${source}: direct evidence edges expand automatically`).toMatch(
    /Follow direct dependencies, callers, data edges, and configuration edges\s+automatically/i,
  )
  expect(reExpansion, `${source}: crossing a capability/context boundary needs approval first`).toMatch(
    /another business capability or bounded context[\s\S]*ask for approval first[\s\S]*never silently turn a Targeted run into a Full one/i,
  )

  const wfModes = markdownSection(wf, '## Mode selection')
  expect(wfModes, `${source}: workflow preserves the Targeted default`).toMatch(
    /Targeted mode\*\* is the default[\s\S]*(?:feature|journey|module|endpoint)/i,
  )
  expect(wfModes, `${source}: workflow gates Full mode`).toMatch(
    /Full mode\*\* runs only when[\s\S]*explicitly asks[\s\S]*approves a major expansion to Full/i,
  )

  const wfExpansion = markdownSection(wf, '## Expansion and approval gate')
  expect(wfExpansion, `${source}: major expansion requires approval before scanning`).toMatch(
    /major expansion\*\*[\s\S]*another business capability\/bounded context[\s\S]*requires explicit approval before scanning/i,
  )
}

function expectScopeContract(re, wf, source) {
  // Step 1 scope template lives in a fenced block; read the whole Step 1 section.
  const scope = markdownSection(re, '## Step 1: Objective and scope')
  expect(scope, `${source}: scope artifact records the mode`).toMatch(/\*\*Mode\*\*:\s*\[Targeted \/ Full\]/)
  const fields = [...scope.matchAll(/^- \*\*(.+?)\*\*:/gm)].map((m) => m[1])
  expect(fields, `${source}: scope fields are explicit`).toEqual(
    expect.arrayContaining(['Mode', 'Objective', 'In-Scope', 'Not-In-Scope', 'Prior Analysis', 'Status']),
  )
  expect(scope, `${source}: scope records what was not analyzed`).toMatch(/\*\*Not Analyzed \/ Open Questions\*\*:/)
  expect(scope, `${source}: single status enum shared with state`).toMatch(
    /\*\*Status\*\*:\s*\[In Progress \/ Awaiting Approval \/ Complete\]/,
  )

  const wfScope = markdownSection(wf, '## Required scope contract')
  expect(wfScope, `${source}: workflow scope contract covers both modes and the honesty fields`).toMatch(
    /both Targeted and Full modes[\s\S]*prior analysis[\s\S]*not-analyzed areas/i,
  )

  const artifacts = markdownSection(wf, '## Proportional artifacts')
  const scopeRefs = artifacts.match(/`reverse-engineering-scope\.md`/g) ?? []
  expect(scopeRefs, `${source}: both mode bundles include the scope artifact`).toHaveLength(2)
  expect(artifacts, `${source}: Targeted bundle`).toMatch(
    /`target-analysis\.md`[\s\S]*`target-coupling-assessment\.md`/,
  )
}

function expectSentinelSweep(re, source) {
  const sentinel = markdownSection(re, '### Mandatory cross-cutting sentinel sweep')
  for (const category of [
    /authentication and authorization/i,
    /session state, static state, and shared memory/i,
    /global configuration and secrets/i,
    /shared databases, schemas, and transactions/i,
    /high-fan-in libraries and shared kernels/i,
    /filesystem and object storage/i,
    /events, queues, jobs, schedulers, and callbacks/i,
    /errors, audit, compliance, and data-handling obligations/i,
    /logging, metrics, tracing, and alerting/i,
    /deployment, infrastructure as code, networking, and runtime topology/i,
    /tests, CI, release gates, and rollback behavior/i,
  ]) {
    expect(sentinel, `${source}: sentinel category ${category} is mandatory`).toMatch(category)
  }
}

function expectTargetTrace(re, source) {
  const trace = markdownSection(re, '### Trace the target end-to-end')
  for (const dimension of [
    /entry point and externally visible behavior/i,
    /orchestration, application logic, and business rules/i,
    /data access, storage ownership, and transaction boundaries/i,
    /side effects and downstream consumers/i,
    /success, failure, validation, and error contracts/i,
    /direct callers and dependencies/i,
    /unit, integration, contract, and end-to-end tests/i,
    /runtime, deployment, and build configuration/i,
  ]) {
    expect(trace, `${source}: trace dimension ${dimension} is mandatory`).toMatch(dimension)
  }
}

function expectFullArtifactBundle(re, source) {
  const full = markdownSection(re, '### Full artifact bundle')
  const expectedArtifacts = [
    'business-overview.md',
    'architecture.md',
    'code-structure.md',
    'api-documentation.md',
    'component-inventory.md',
    'technology-stack.md',
    'dependencies.md',
    'bounded-contexts.md',
    'coupling-assessment.md',
  ]
  const artifactBullets = [...full.matchAll(/^- `(?:[^`]+\/)?([^/`]+\.md)` —/gm)]
    .map((match) => match[1])
  expect(artifactBullets, `${source}: Full mode has exactly the nine specified artifacts`).toEqual(
    expectedArtifacts,
  )
  for (const artifact of expectedArtifacts) {
    expect(full, `${source}: Full mode preserves ${artifact}`).toMatch(
      new RegExp(`(?:analysis/)?${artifact.replace('.', '\\.')}`),
    )
  }
  expect(full, `${source}: Full mode keeps all nine artifacts, no Targeted substitution`).toMatch(
    /all nine artifacts[\s\S]*do not substitute the Targeted bundle/i,
  )
}

function expectPriorEvidenceRules(re, source) {
  const priorEvidence = markdownSection(re, '## Prior analysis (ATX / assessments)')
  expect(priorEvidence, `${source}: current relevant evidence is reused`).toMatch(
    /prior analysis is current and relevant to the objective[\s\S]*use it as primary input/i,
  )
  expect(priorEvidence, `${source}: reused high-risk claims are spot-verified`).toMatch(
    /spot-verify high-risk claims/i,
  )
  expect(priorEvidence, `${source}: current source or runtime evidence wins conflicts`).toMatch(
    /prefer current source or runtime evidence when evidence conflicts/i,
  )
}

function checklistEntries(section, mode) {
  const nextMode = mode === 'Targeted' ? 'For Full mode' : '```'
  const match = section.match(
    new RegExp(
      `For ${mode} mode, record exactly:\\n([\\s\\S]*?)(?=\\n${nextMode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    ),
  )
  expect(match, `${mode} checklist body must exist`).not.toBeNull()
  return [...match[1].matchAll(/^- \[x\] (.+)$/gm)].map((entry) => entry[1])
}

function expectMetadataContract(re, source) {
  const metadata = markdownSection(re, '## Record Reverse Engineering Metadata')
  expect(metadata, `${source}: metadata retains only the selected checklist`).toMatch(
    /retain only the selected mode's checklist/i,
  )
  expect(checklistEntries(metadata, 'Targeted'), `${source}: exact Targeted checklist`).toEqual([
    'reverse-engineering-scope.md',
    'target-analysis.md',
    'target-coupling-assessment.md',
    'reverse-engineering-timestamp.md',
  ])
  expect(checklistEntries(metadata, 'Full'), `${source}: exact Full checklist`).toEqual([
    'reverse-engineering-scope.md',
    'business-overview.md',
    'architecture.md',
    'code-structure.md',
    'api-documentation.md',
    'component-inventory.md',
    'technology-stack.md',
    'dependencies.md',
    'bounded-contexts.md',
    'coupling-assessment.md',
    'reverse-engineering-timestamp.md',
  ])

  for (const field of [
    /\*\*Policy \/ Mode\*\*: \[[^\]]*active overlay-defined mode[^\]]*\]/i,
    /\*\*Analysis Objective\*\*:/i,
    /\*\*Scope Boundary\*\*:/i,
    /\*\*Prior Evidence Reused\*\*:/i,
    /\*\*Not Analyzed \/ Open Areas\*\*:/i,
    /\*\*Status\*\*: \[In Progress \/ Awaiting Approval \/ Complete\]/i,
  ]) {
    expect(metadata, `${source}: shared metadata field ${field}`).toMatch(field)
  }
}

function expectEvidenceLifecycle(re, wf, source) {
  const synchronization = markdownSection(re, '### Scope lifecycle synchronization')
  expect(synchronization, `${source}: evidence-ready transition synchronizes scope`).toMatch(
    /common `Record Evidence-Ready State`[\s\S]*reverse-engineering-scope\.md[\s\S]*`Awaiting Approval`/i,
  )
  expect(synchronization, `${source}: the common raw audit precedes synchronized completion`).toMatch(
    /after[\s\S]*common `Approval Transition`[\s\S]*raw approval audit append[\s\S]*reverse-engineering-scope\.md[\s\S]*reverse-engineering-timestamp\.md[\s\S]*aidlc-state\.md[\s\S]*together to `Complete`/i,
  )
  expect(synchronization, `${source}: synchronization does not execute a second gate`).not.toMatch(
    /stop and wait|append the complete raw approval response/i,
  )

  const evidenceReady = markdownSection(re, '## Record Evidence-Ready State')
  expect(evidenceReady, `${source}: finished evidence awaits approval, not completion`).toMatch(
    /set status to `Awaiting Approval`/i,
  )
  expect(evidenceReady, `${source}: pre-approval state does not claim completion`).not.toMatch(
    /Phase 0: Reverse Engineering — Complete/i,
  )

  const review = markdownSection(re, '## Present Evidence for Review')
  expect(review, `${source}: pre-approval messaging describes evidence as ready`).toMatch(
    /analysis evidence is ready for review/i,
  )
  expect(review, `${source}: request changes keeps the gate pending`).toMatch(
    /(?:fill evidence gaps|rescan selected areas)[\s\S]*Awaiting Approval/i,
  )

  const approval = markdownSection(re, '## Approval Transition')
  expect(approval, `${source}: common tail owns the same single gate once`).toMatch(
    /same single Phase 0 approval gate[\s\S]*Execute it once/i,
  )
  expect(approval, `${source}: completion needs the raw approval audit then Complete`).toMatch(
    /explicit approval[\s\S]*complete raw approval response[\s\S]*audit\.md[\s\S]*Awaiting Approval` to `Complete`[\s\S]*Phase 1: Requirements/i,
  )
  expect(review, `${source}: does not call the run complete pre-approval`).not.toMatch(/Reverse Engineering Complete/i)

  const wfGate = markdownSection(wf, '## Expansion and approval gate')
  expect(wfGate, `${source}: primary summarizes the same single gate`).toMatch(
    /same single Phase 0 approval gate[\s\S]*exactly once/i,
  )
}

function expectOrientationAndClarification(re, wf, source) {
  const orientation = markdownSection(re, '### Orientation')
  expect(orientation, `${source}: Orientation stays cheap and allows one informed clarification`).toMatch(
    /cheap \*\*Orientation\*\*[\s\S]*one informed scope clarification/i,
  )
  expect(markdownSection(wf, '### Scope clarification exception'), `${source}: single chat exception`).toMatch(
    /One informed scope clarification[\s\S]*only chat exception/i,
  )
}

// Prior-analysis-aware input strategy: detect prior analysis (ATX/AWS Transform),
// reuse it when current for the objective, else scan the source directly.
function expectConditionalInputStrategy(content, source) {
  expect(content, `${source}: detects prior analysis before choosing a strategy`).toMatch(
    /(?:detect|check for)[\s\S]*(?:prior analysis|AWS Transform|ATX)/i,
  )
  expect(content, `${source}: reuses prior analysis only when current for the objective`).toMatch(
    /(?:current for the objective|suitable prior analysis[\s\S]*current)/i,
  )
  expect(content, `${source}: otherwise scans the source directly`).toMatch(
    /[Oo]therwise[\s\S]*scan the source directly/,
  )
}

function expectAdaptiveSemantics(re, wf, source) {
  expectModeAndExpansionSemantics(re, wf, source)
  expectScopeContract(re, wf, source)
  expectTargetTrace(re, source)
  expectSentinelSweep(re, source)
  expectFullArtifactBundle(re, source)
  expectPriorEvidenceRules(re, source)
  expectMetadataContract(re, source)
  expectEvidenceLifecycle(re, wf, source)
  expectOrientationAndClarification(re, wf, source)
  // Targeted artifact section is present and named.
  expect(markdownSection(re, '## Step 2 artifacts (Targeted)')).toMatch(
    /`target-analysis\.md`[\s\S]*`target-coupling-assessment\.md`/,
  )
  expect(re, `${source}: selected checklist is mutually exclusive`).toMatch(
    /retain only the selected mode's checklist/i,
  )
  // The pre-adaptive "scan everything" phrasing must be gone.
  expect(re, `${source}: no blanket whole-repo scan phrasing`).not.toContain('All packages (not just mentioned ones)')
  expect(re, `${source}: no common generic-only artifacts`).not.toMatch(
    /code-quality-assessment\.md|modernization-readiness\.md/i,
  )
  expect(re, `${source}: no QA-only inventory`).not.toMatch(
    /Existing Test Inventory|existing-test-inventory\.md|Migration \/ Survivability/i,
  )
  expect(re, `${source}: no unsupported coverage artifact`).not.toContain(
    'reverse-engineering-coverage.md',
  )
  expect(re, `${source}: no stale lifecycle stages`).not.toMatch(/\bStage [123]\b/i)
}

describe('legacy-transformation-on-aws adaptive reverse engineering', () => {
  it('composes both instructions from ordered legacy overlays with no local copies', () => {
    expect(existsSync(localWorkflow)).toBe(false)
    expect(existsSync(localReverseEngineering)).toBe(false)
    expect(existsSync(workflowOverlay)).toBe(true)
    expect(existsSync(adaptiveOverlay)).toBe(true)
    expect(manifest.workflow.overlays).toEqual([
      'legacy-transformation-workflow.md',
      'legacy-adaptive-reverse-engineering.md',
    ])

    const overlay = readFileSync(adaptiveOverlay, 'utf8')
    const expectedSlots = [
      'reverse-engineering-policy',
      'reverse-engineering-analysis-body',
      'reverse-engineering-artifact-checklist',
      'reverse-engineering-review-options',
    ]
    const starts = [...overlay.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) START -->/g)]
      .map((match) => match[1])
    const ends = [...overlay.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) END -->/g)]
      .map((match) => match[1])

    expect(starts).toEqual(expectedSlots)
    expect(ends).toEqual(expectedSlots)
    expect(overlay).toMatch(
      /replaces:\s*\n  - reverse-engineering-policy\s*\n  - reverse-engineering-analysis-body\s*\n  - reverse-engineering-artifact-checklist\s*\n  - reverse-engineering-review-options/i,
    )
  })

  it('defines the adaptive contract in the canonical instructions', () => {
    expectAdaptiveSemantics(
      readInstruction('reverse-engineering.md'),
      readInstruction('aidlc-workflow.md'),
      'canonical instructions',
    )
  })

  it('uses canonical phases, one legacy overview, and the concrete decomposition spec', () => {
    const workflow = readInstruction('aidlc-workflow.md')

    expect(workflow.match(/User modernization objective/g) ?? []).toHaveLength(1)
    expect(workflow).not.toContain('Detect: brownfield?')
    for (const phase of [
      'PHASE 0',
      'PHASE 1',
      'PHASE 2',
      'PHASE 3',
    ]) expect(workflow).toContain(phase)
    expect(workflow).not.toMatch(/\bSTAGE [123]\b/i)
    expect(workflow).toMatch(/Orientation[\s\S]*(?:temporary|cheap pass)/i)
    expect(workflow).toMatch(/Targeted[\s\S]*Full/i)
    expect(workflow).toContain('{{SPEC_DIR}}/decomposition-plan/')
    expect(workflow).not.toMatch(/skip (?:a |the )?decision file/i)
    expect(workflow).toMatch(/same interaction[\s\S]*forbidden/i)
    expect(workflow).toMatch(/silence is never acceptance/i)
  })

  it('preserves the six ordered decision and document approval gates', () => {
    const workflow = readInstruction('aidlc-workflow.md')
    const phases = [
      {
        start: '# PHASE 1:',
        decision: '_decisions-requirements.md',
        final: 'requirements.md',
        next: '# PHASE 2:',
      },
      {
        start: '# PHASE 2:',
        decision: '_decisions-design.md',
        final: 'design.md',
        next: '# PHASE 3:',
      },
      {
        start: '# PHASE 3:',
        decision: '_decisions-tasks.md',
        final: 'tasks.md',
        next: '# Task Execution',
      },
    ]

    for (const { start, decision, final, next } of phases) {
      const startIndex = workflow.indexOf(start)
      const endIndex = workflow.indexOf(next, startIndex)
      expect(startIndex).toBeGreaterThanOrEqual(0)
      expect(endIndex).toBeGreaterThan(startIndex)
      const section = workflow.slice(startIndex, endIndex + next.length)
      const decisionIndex = section.indexOf(`Create \`${decision}\``)
      const decisionApprovalIndex = section.indexOf('explicitly approve', decisionIndex)
      const decisionAuditIndex = section.indexOf(
        'complete raw approval response',
        decisionApprovalIndex,
      )
      const decisionStateIndex = section.indexOf(
        '{{STATE_DIR}}/aidlc-state.md',
        decisionAuditIndex,
      )
      const finalIndex = section.indexOf(`Generate \`${final}\``, decisionStateIndex)
      const documentGateIndex = section.indexOf('### Approval Gate', finalIndex)
      const documentApprovalIndex = section.indexOf(
        'Wait for explicit user approval.',
        documentGateIndex,
      )
      const documentAuditIndex = section.indexOf(
        'Append the complete raw approval response',
        documentApprovalIndex,
      )
      const documentStateIndex = section.indexOf(
        '{{STATE_DIR}}/aidlc-state.md',
        documentAuditIndex,
      )
      const nextIndex = section.indexOf(next, documentStateIndex)

      expect(decisionIndex).toBeGreaterThanOrEqual(0)
      expect(decisionApprovalIndex).toBeGreaterThan(decisionIndex)
      expect(decisionAuditIndex).toBeGreaterThan(decisionApprovalIndex)
      expect(decisionStateIndex).toBeGreaterThan(decisionAuditIndex)
      expect(finalIndex).toBeGreaterThan(decisionStateIndex)
      expect(documentGateIndex).toBeGreaterThan(finalIndex)
      expect(documentApprovalIndex).toBeGreaterThan(documentGateIndex)
      expect(documentAuditIndex).toBeGreaterThan(documentApprovalIndex)
      expect(documentStateIndex).toBeGreaterThan(documentAuditIndex)
      expect(nextIndex).toBeGreaterThan(documentStateIndex)
    }
  })

  it('uses a semantic auto-load description for bounded and system-wide brownfield analysis', () => {
    const entry = manifest.instructions.find((instruction) => instruction.file === 'reverse-engineering.md')

    expect(entry?.load).toBe('auto')
    expect(entry?.description).toMatch(/brownfield/i)
    expect(entry?.description).toMatch(/Targeted[^\n]*or Full/i)
    expect(entry?.description).toMatch(/reuses existing ATX\/assessment/i)
    expect(entry?.description).toMatch(/feature[\s\S]*journey[\s\S]*module[\s\S]*system-wide/i)
  })

  it.each([
    ['kiro', '.kiro/steering/reverse-engineering.md', '.kiro/steering/aidlc-workflow.md'],
    ['claude-code', '.claude/rules/reverse-engineering.md', 'CLAUDE.md'],
    ['copilot', '.github/instructions/reverse-engineering.instructions.md', '.github/copilot-instructions.md'],
    ['cursor', '.cursor/rules/reverse-engineering.mdc', '.cursor/rules/aidlc-workflow.mdc'],
  ])('renders the adaptive contract for %s', (tool, reversePath, workflowPath) => {
    const writes = renderInstructions(manifest, packDir, tool)
    expectAdaptiveSemantics(byPath(writes, reversePath), byPath(writes, workflowPath), `${tool} rendered instructions`)

    const workspace = resolveWorkspace(manifest, {
      tools: [tool],
      stateRoot: 'customer-state',
      specRoot: 'customer-specs',
    })
    const customWrites = renderInstructions(manifest, packDir, tool, workspace)
    const customReverseEngineering = byPath(customWrites, reversePath)
    for (const path of [
      'customer-state/analysis/reverse-engineering-scope.md',
      'customer-state/analysis/target-analysis.md',
      'customer-state/analysis/target-coupling-assessment.md',
      'customer-state/analysis/business-overview.md',
      'customer-state/analysis/architecture.md',
      'customer-state/analysis/code-structure.md',
      'customer-state/analysis/api-documentation.md',
      'customer-state/analysis/component-inventory.md',
      'customer-state/analysis/technology-stack.md',
      'customer-state/analysis/dependencies.md',
      'customer-state/analysis/bounded-contexts.md',
      'customer-state/analysis/coupling-assessment.md',
      'customer-state/analysis/reverse-engineering-timestamp.md',
      'customer-state/audit.md',
      'customer-state/aidlc-state.md',
    ]) {
      expect(customReverseEngineering, `${tool}: portable path ${path}`).toContain(path)
    }
    expect(customReverseEngineering).not.toContain('aidlc-docs/')
    expect(customReverseEngineering).not.toContain('RAMP:SLOT')
    expect(customReverseEngineering).not.toMatch(
      /\{\{(?:STATE_DIR|SPEC_DIR|INSTRUCTION:)/,
    )
  })

  it('keeps QA and generic common reverse engineering isolated', () => {
    const qa = resolveInstructionBody(
      qaManifest,
      qaPackDir,
      'reverse-engineering.md',
    )
    const common = resolveInstructionBody(
      commonManifest,
      commonPackDir,
      'reverse-engineering.md',
    )

    expect(qa).toContain('Existing Test Inventory')
    expect(qa).not.toContain('### Targeted mode (default)')
    expect(common).toContain('## Step 1: Workspace Discovery')
    expect(common).not.toContain('### Targeted mode (default)')
  })

  it('encodes the prior-analysis-aware input strategy in the manifest command body', () => {
    const body = manifest.command?.body ?? ''
    expectConditionalInputStrategy(body, 'pack.yaml command.body')
    expect(body).toMatch(/resolved state[\s\S]*primary instructions/i)
    expect(body).toMatch(/resolved analysis path[\s\S]*primary instructions/i)
    expect(body).not.toContain('aidlc-docs/')
    expect(body).not.toMatch(/\{\{(?:STATE_DIR|SPEC_DIR)/)
  })

  // Assert the fresh renderer output; committed scaffolds are checked separately
  // by the regeneration/parity gates.
  it.each([['claude-code'], ['copilot']])(
    'keeps the %s launcher prior-analysis-aware in fresh render',
    (tool) => {
      const content = renderCommand(manifest, tool)?.content ?? ''
      expectConditionalInputStrategy(content, `${tool} fresh launcher`)
      expect(content).not.toContain('aidlc-docs/')
      expect(content).not.toMatch(/\{\{(?:STATE_DIR|SPEC_DIR)/)
    },
  )
})
