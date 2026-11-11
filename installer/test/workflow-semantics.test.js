import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdapter, listAdapterIds } from '../src/adapters/index.js'
import { resolveInstructionBody } from '../src/instructions/compose.js'
import { loadManifest } from '../src/manifest.js'
import { renderCommand } from '../src/render/command.js'
import { renderInstructions } from '../src/render/instructions.js'
import { resolveWorkspace } from '../src/workspace.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const packDir = join(repoRoot, 'packs', 'qa-automated-testing')
const commonWorkflow = join(repoRoot, 'workflows', 'base', 'aidlc-workflow.md')
const commonReverseEngineering = join(
  repoRoot,
  'workflows',
  'base',
  'reverse-engineering.md',
)
const localWorkflow = join(packDir, 'instructions', 'aidlc-workflow.md')
const localReverseEngineering = join(packDir, 'instructions', 'reverse-engineering.md')
const qaReverseEngineeringOverlay = join(
  repoRoot,
  'workflows',
  'variants',
  'qa-existing-test-inventory.md',
)
const manifest = loadManifest(packDir)
const commonRePackDir = join(repoRoot, 'packs', 'agentic-ai-workflow')
const commonReManifest = loadManifest(commonRePackDir)
const legacyPackDir = join(repoRoot, 'packs', 'legacy-transformation-on-aws')
const legacyManifest = loadManifest(legacyPackDir)
const portable = (path) => path.split(sep).join('/')

const nativeReverseEngineeringPaths = {
  kiro: '.kiro/steering/reverse-engineering.md',
  'claude-code': '.claude/rules/reverse-engineering.md',
  copilot: '.github/instructions/reverse-engineering.instructions.md',
  cursor: '.cursor/rules/reverse-engineering.mdc',
  codex: '.codex/instructions/reverse-engineering.md',
}

function primaryContent(tool, workspace = resolveWorkspace(manifest, { tools: [tool] })) {
  const path = getAdapter(tool).instructions.primaryPath('aidlc-workflow.md')
  const write = renderInstructions(manifest, packDir, tool, workspace)
    .find((entry) => entry.path === path)
  expect(write, `primary instruction for ${tool}`).toBeDefined()
  return write.content
}

function reverseEngineeringContent(
  tool,
  workspace = resolveWorkspace(commonReManifest, { tools: [tool] }),
) {
  const path = getAdapter(tool).instructions.companionPath('reverse-engineering.md')
  const write = renderInstructions(commonReManifest, commonRePackDir, tool, workspace)
    .find((entry) => entry.path === path)
  expect(write, `reverse-engineering companion for ${tool}`).toBeDefined()
  return write.content
}

function qaReverseEngineeringContent(
  tool,
  workspace = resolveWorkspace(manifest, { tools: [tool] }),
) {
  const path = getAdapter(tool).instructions.companionPath('reverse-engineering.md')
  const write = renderInstructions(manifest, packDir, tool, workspace)
    .find((entry) => entry.path === path)
  expect(write, `QA reverse-engineering companion for ${tool}`).toBeDefined()
  return write.content
}

function legacyPrimaryContent(
  tool,
  workspace = resolveWorkspace(legacyManifest, { tools: [tool] }),
) {
  const path = getAdapter(tool).instructions.primaryPath('aidlc-workflow.md')
  const write = renderInstructions(legacyManifest, legacyPackDir, tool, workspace)
    .find((entry) => entry.path === path)
  expect(write, `legacy primary instruction for ${tool}`).toBeDefined()
  return write.content
}

function renderedInstructionContent(
  packManifest,
  directory,
  tool,
  file,
  workspace,
) {
  const declaration = packManifest.instructions.find(
    (instruction) => instruction.file === file,
  )
  expect(declaration, `${packManifest.name}: declared ${file}`).toBeDefined()
  const instructionPaths = getAdapter(tool).instructions
  const path = declaration.role === 'primary'
    ? instructionPaths.primaryPath(file)
    : instructionPaths.companionPath(file)
  const write = renderInstructions(
    packManifest,
    directory,
    tool,
    workspace,
  ).find((entry) => entry.path === path)
  expect(write, `${packManifest.name}/${tool}: rendered ${path}`).toBeDefined()
  return write.content
}

function expectOrdered(content, earlier, later) {
  const earlierIndex = content.indexOf(earlier)
  const laterIndex = content.indexOf(later)
  expect(earlierIndex, `missing earlier marker: ${earlier}`).toBeGreaterThanOrEqual(0)
  expect(laterIndex, `missing later marker: ${later}`).toBeGreaterThanOrEqual(0)
  expect(earlierIndex, `${earlier} must precede ${later}`).toBeLessThan(laterIndex)
}

function expectBoundedPhaseGate(
  content,
  artifact,
  nextStage,
  stateRoot = 'aidlc-docs',
) {
  const start = content.indexOf(artifact)
  const end = content.indexOf(nextStage, start)
  expect(start, `missing phase artifact: ${artifact}`).toBeGreaterThanOrEqual(0)
  expect(end, `missing next stage after ${artifact}: ${nextStage}`).toBeGreaterThan(start)

  const phase = content.slice(start, end + nextStage.length)
  const auditPath = `\`${stateRoot}/audit.md\``
  const statePath = `update \`${stateRoot}/aidlc-state.md\``
  expectOrdered(phase, artifact, '### Approval Gate')
  expectOrdered(phase, '### Approval Gate', 'Wait for explicit user approval.')
  expectOrdered(
    phase,
    'Wait for explicit user approval.',
    'Append the complete raw approval response',
  )
  expectOrdered(
    phase,
    'Append the complete raw approval response',
    auditPath,
  )
  expectOrdered(
    phase,
    auditPath,
    statePath,
  )
  expectOrdered(phase, statePath, nextStage)
}

describe('canonical RAMP workflow source', () => {
  it('is inherited from common and exposes exactly the nine intended overlay slots', () => {
    expect(existsSync(commonWorkflow)).toBe(true)
    expect(existsSync(localWorkflow)).toBe(false)

    const source = readFileSync(commonWorkflow, 'utf8')
    const expectedSlots = [
      'workflow-identity',
      'first-actions',
      'workflow-overview',
      'state-project-fields',
      'reverse-engineering-stage',
      'requirements-domain-decisions',
      'design-domain-decisions',
      'tasks-domain-decisions',
      'execution-guidance',
    ]
    const starts = [...source.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) START -->/g)]
      .map((match) => match[1])
    const ends = [...source.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) END -->/g)]
      .map((match) => match[1])

    expect(starts).toEqual(expectedSlots)
    expect(ends).toEqual(expectedSlots)
  })
})

describe.each(manifest.distribution.targets)('QA workflow semantics for %s', (tool) => {
  it('uses only the adapter-native reverse-engineering instruction path', () => {
    const content = primaryContent(tool)
    const nativePath = nativeReverseEngineeringPaths[tool]

    expect(content).toContain(nativePath)
    for (const [otherTool, otherPath] of Object.entries(nativeReverseEngineeringPaths)) {
      if (otherTool !== tool) expect(content).not.toContain(otherPath)
    }
    expectOrdered(
      content,
      nativePath,
      "Wait for the user's explicit approval before moving to Phase 1.",
    )
    expectOrdered(
      content,
      "Wait for the user's explicit approval before moving to Phase 1.",
      '# PHASE 1: Requirements',
    )
    expectOrdered(content, nativePath, '# PHASE 1: Requirements')
  })

  it('delegates the exact Phase 0 artifact set to the active companion', () => {
    const content = primaryContent(tool)
    const phaseStart = content.indexOf('# PHASE 0: Reverse Engineering')
    const phaseEnd = content.indexOf('# PHASE 1: Requirements', phaseStart)
    expect(phaseStart).toBeGreaterThanOrEqual(0)
    expect(phaseEnd).toBeGreaterThan(phaseStart)

    const phase = content.slice(phaseStart, phaseEnd)
    expect(phase).toMatch(
      /Generate the artifact set required by the active reverse-engineering[\s\S]*companion under `aidlc-docs\/analysis\/`/i,
    )
    expect(phase).toMatch(/companion is authoritative for the exact set/i)

    const oldFixedOutputs = [
      'business-overview.md',
      'architecture.md',
      'code-structure.md',
      'api-documentation.md',
      'component-inventory.md',
      'technology-stack.md',
      'dependencies.md',
      'bounded-contexts.md',
      'modernization-readiness.md',
    ]
    for (const artifact of oldFixedOutputs) expect(phase).not.toContain(artifact)
  })

  it('resumes state before new work and keeps raw approvals append-only', () => {
    const content = primaryContent(tool)

    expectOrdered(
      content,
      'Check if `aidlc-docs/aidlc-state.md` exists',
      'If no state file exists',
    )
    expect(content).toMatch(/append-only/i)
    expect(content).toMatch(/complete raw (?:text|approval response)/i)
    expect(content).toMatch(
      /complete raw approval response[\s\S]*aidlc-docs\/audit\.md[\s\S]*(?:before entering|before proceeding)/i,
    )
  })

  it('enforces decision files, separate interactions, and ordered approval gates', () => {
    const content = primaryContent(tool)

    expect(content).not.toMatch(/Exception.*skip the decision file/is)
    expect(content).toMatch(
      /decision file and (?:the |its )?corresponding final (?:phase |spec )?document[\s\S]*same interaction[\s\S]*forbidden/i,
    )
    expectOrdered(content, 'Create `_decisions-requirements.md`', 'Generate `requirements.md`')
    expectOrdered(content, 'Create `_decisions-design.md`', 'Generate `design.md`')
    expectOrdered(content, 'Create `_decisions-tasks.md`', 'Generate `tasks.md`')
    expectOrdered(content, '# PHASE 1: Requirements', '# PHASE 2: Design')
    expectOrdered(content, '# PHASE 2: Design', '# PHASE 3: Tasks')
    expectOrdered(content, '# PHASE 3: Tasks', '# Task Execution')
  })

  it('keeps partial answers and proposed defaults in the decision file', () => {
    const content = primaryContent(tool)

    expect(content).toMatch(
      /unanswered item[\s\S]*proposed (?:default|recommendation)[\s\S]*decision file/i,
    )
    expect(content).toMatch(
      /user must[\s\S]*(?:complete|explicitly confirm)[\s\S]*in (?:that|the) (?:same )?file/i,
    )
    expect(content).toMatch(/silence is never acceptance/i)
    expect(content).not.toMatch(/prompt for the rest/i)
    expect(content).not.toMatch(
      /if the user does not respond[\s\S]*ask whether[\s\S]*defaults/i,
    )
  })

  it('bounds each artifact approval, raw audit, and state update before the next stage', () => {
    const content = primaryContent(tool)

    expectBoundedPhaseGate(
      content,
      '### Step 1.3 — Generate `requirements.md`',
      '# PHASE 2: Design',
    )
    expectBoundedPhaseGate(
      content,
      '### Step 2.3 — Generate `design.md`',
      '# PHASE 3: Tasks',
    )
    expectBoundedPhaseGate(
      content,
      '### Step 3.3 — Generate `tasks.md`',
      '# Task Execution',
    )
  })

  it('limits chat clarification to an explicitly declared Phase 0 Orientation exception', () => {
    const content = primaryContent(tool)

    expect(content).toMatch(
      /active reverse-engineering companion instruction[\s\S]*explicitly declares[\s\S]*Orientation clarification/i,
    )
    expect(content).toMatch(
      /exception[\s\S]*Phase 0 Orientation[\s\S]*(?:does not apply|never applies)[\s\S]*(?:phase decisions|approval gates)/i,
    )
    expect(content).toMatch(/phase decisions[\s\S]*decision files/i)
    expect(content).toMatch(/approval gates[\s\S]*explicit approval/i)
  })

  it('does not expose composition markers or unresolved RAMP tokens', () => {
    const content = primaryContent(tool)

    expect(content).not.toContain('RAMP:SLOT')
    expect(content).not.toMatch(/\{\{(?:INSTRUCTION:|SPEC_DIR|STATE_DIR)/)
  })
})

describe('QA workflow workspace portability', () => {
  it('propagates custom spec and state roots through the canonical workflow', () => {
    const workspace = resolveWorkspace(manifest, {
      tools: ['claude-code'],
      specRoot: 'customer-specs',
      stateRoot: 'customer-state',
    })
    const content = primaryContent('claude-code', workspace)

    expect(content).toContain('customer-specs/<spec-name>/')
    expect(content).toContain('customer-state/aidlc-state.md')
    expect(content).toContain('customer-state/audit.md')
    expect(content).toContain('customer-state/analysis/')
    expect(content).not.toContain('aidlc-docs/')
  })
})

describe('canonical reverse-engineering lifecycle', () => {
  it('exposes exactly the six non-nested composition boundaries', () => {
    const source = readFileSync(commonReverseEngineering, 'utf8')
    const expectedSlots = [
      'reverse-engineering-policy',
      'reverse-engineering-analysis-body',
      'full-existing-test-inventory',
      'reverse-engineering-artifact-checklist',
      'full-artifact-checklist-extra',
      'reverse-engineering-review-options',
    ]
    const starts = [...source.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) START -->/g)]
      .map((match) => match[1])
    const ends = [...source.matchAll(/<!-- RAMP:SLOT ([A-Za-z0-9-]+) END -->/g)]
      .map((match) => match[1])

    expect(starts).toEqual(expectedSlots)
    expect(ends).toEqual(expectedSlots)
  })

  it('keeps policy-neutral lifecycle outside slots and uses portable state paths', () => {
    const source = readFileSync(commonReverseEngineering, 'utf8')
    const content = resolveInstructionBody(
      commonReManifest,
      commonRePackDir,
      'reverse-engineering.md',
    )

    expect(source).not.toContain('aidlc-docs/')
    expect(content).not.toContain('RAMP:SLOT')
    expect(content).toContain('{{STATE_DIR}}/analysis/business-overview.md')
    expect(content).toContain('{{STATE_DIR}}/aidlc-state.md')
    expect(content).toContain('{{STATE_DIR}}/audit.md')
  })

  it('holds evidence at Awaiting Approval until the single Phase 0 gate completes', () => {
    const content = resolveInstructionBody(
      commonReManifest,
      commonRePackDir,
      'reverse-engineering.md',
    )
    const evidenceStart = content.indexOf('## Record Evidence-Ready State')
    const approvalStart = content.indexOf('## Approval Transition', evidenceStart)
    expect(evidenceStart).toBeGreaterThanOrEqual(0)
    expect(approvalStart).toBeGreaterThan(evidenceStart)

    const preApproval = content.slice(evidenceStart, approvalStart)
    expect(preApproval).toMatch(/status to `Awaiting Approval`/i)
    expect(preApproval).toMatch(/reverse-engineering analysis evidence is ready for review/i)
    expect(preApproval).not.toMatch(/\[x\].*Reverse Engineering.*Complete/i)
    expect(preApproval).not.toMatch(/Reverse Engineering Complete/i)

    const approval = content.slice(approvalStart)
    expect(approval).toMatch(/same single Phase 0 approval gate/i)
    expect((approval.match(/complete raw approval response/gi) ?? [])).toHaveLength(1)
    expectOrdered(approval, 'explicit approval', 'complete raw approval response')
    expectOrdered(
      approval,
      'complete raw approval response',
      '{{STATE_DIR}}/audit.md',
    )
    expectOrdered(
      approval,
      '{{STATE_DIR}}/audit.md',
      '`Awaiting Approval` to `Complete`',
    )
    expectOrdered(approval, '`Awaiting Approval` to `Complete`', 'Requirements')
  })

  it('preserves the generic full-analysis artifact contract', () => {
    const content = resolveInstructionBody(
      commonReManifest,
      commonRePackDir,
      'reverse-engineering.md',
    )
    const artifacts = [
      'business-overview.md',
      'architecture.md',
      'code-structure.md',
      'api-documentation.md',
      'component-inventory.md',
      'technology-stack.md',
      'dependencies.md',
      'code-quality-assessment.md',
      'bounded-contexts.md',
      'modernization-readiness.md',
      'reverse-engineering-timestamp.md',
    ]

    for (const artifact of artifacts) expect(content).toContain(artifact)
    expect(content).not.toContain('Existing Test Inventory')
    expect(content).not.toContain('existing-test-inventory.md')
  })
})

describe.each(listAdapterIds())('common reverse-engineering rendering for %s', (tool) => {
  it('resolves custom state roots without leaking slots or tokens', () => {
    const workspace = resolveWorkspace(commonReManifest, {
      tools: [tool],
      stateRoot: 'customer-state',
    })
    const content = reverseEngineeringContent(tool, workspace)

    expect(content).toContain('customer-state/analysis/business-overview.md')
    expect(content).toContain('customer-state/aidlc-state.md')
    expect(content).toContain('customer-state/audit.md')
    expect(content).not.toContain('aidlc-docs/')
    expect(content).not.toContain('RAMP:SLOT')
    expect(content).not.toMatch(/\{\{(?:INSTRUCTION:|SPEC_DIR|STATE_DIR)/)
    expect(content).toMatch(/same single Phase 0 approval gate/i)
    expectOrdered(content, 'explicit approval', 'complete raw approval response')
    expectOrdered(content, 'complete raw approval response', 'customer-state/audit.md')
    expectOrdered(
      content,
      'customer-state/audit.md',
      '`Awaiting Approval` to `Complete`',
    )
    expectOrdered(content, '`Awaiting Approval` to `Complete`', 'Requirements')
  })
})

describe('QA reverse-engineering overlay', () => {
  it('owns only the named overlay while inheriting the common companion', () => {
    expect(existsSync(localReverseEngineering)).toBe(false)
    expect(existsSync(qaReverseEngineeringOverlay)).toBe(true)
    expect(
      manifest.workflow.overlays.filter(
        (name) => name === 'qa-existing-test-inventory.md',
      ),
    ).toHaveLength(1)
  })

  it('adds the complete QA inventory once to the composed reverse-engineering flow', () => {
    const content = resolveInstructionBody(
      manifest,
      packDir,
      'reverse-engineering.md',
    )
    const evidenceFields = [
      'Test Suites Found',
      'Coverage Signal',
      'CI Test Gates',
      'Test Data Approach',
      'Reliability Signals',
      'Migration / Survivability',
      'Summary',
    ]

    for (const field of evidenceFields) expect(content).toContain(field)
    expect(content.match(/^## Existing Test Inventory$/gm) ?? []).toHaveLength(1)
    expect(
      content.match(
        /Create `\{\{STATE_DIR\}\}\/analysis\/existing-test-inventory\.md`:/g,
      ) ?? [],
    ).toHaveLength(1)
    expect(
      content.match(/^- \[x\] existing-test-inventory\.md$/gm) ?? [],
    ).toHaveLength(1)
    expect(content).toMatch(/additional (?:comprehensive|full)-analysis module/i)
    expect(content).toMatch(
      /not\s+a qualified combination with adaptive Targeted mode/i,
    )
    expect(content).not.toContain('RAMP:SLOT')
  })

  it('does not leak QA evidence or legacy adaptive behavior into other policies', () => {
    const qaContent = resolveInstructionBody(
      manifest,
      packDir,
      'reverse-engineering.md',
    )
    const commonContent = resolveInstructionBody(
      commonReManifest,
      commonRePackDir,
      'reverse-engineering.md',
    )

    expect(commonContent).not.toContain('Existing Test Inventory')
    expect(commonContent).not.toContain('existing-test-inventory.md')
    expect(commonContent).not.toContain('Migration / Survivability')
    expect(qaContent).not.toMatch(
      /## Targeted Analysis|## Full Analysis|Orientation pass|decomposition-plan/i,
    )
  })
})

describe.each(manifest.distribution.targets)('QA reverse-engineering rendering for %s', (tool) => {
  it('resolves the inventory path under a custom state root', () => {
    const workspace = resolveWorkspace(manifest, {
      tools: [tool],
      stateRoot: 'customer-state',
    })
    const content = qaReverseEngineeringContent(tool, workspace)

    expect(content).toContain(
      'customer-state/analysis/existing-test-inventory.md',
    )
    expect(content).not.toContain('aidlc-docs/')
    expect(content).not.toContain('RAMP:SLOT')
    expect(content).not.toMatch(/\{\{(?:INSTRUCTION:|SPEC_DIR|STATE_DIR)/)
  })
})

describe('legacy primary workflow composition', () => {
  it('preserves adaptive modernization semantics without stale lifecycle stages', () => {
    const content = resolveInstructionBody(
      legacyManifest,
      legacyPackDir,
      'aidlc-workflow.md',
    )

    expect(content).toContain('# Legacy Transformation on AWS Modernization Workflow')
    expect(content).toContain('{{SPEC_DIR}}/decomposition-plan/')
    expect(content).toContain('# PHASE 0: Adaptive Reverse Engineering')
    expect(content).toContain('# PHASE 1: Requirements')
    expect(content).toContain('# PHASE 2: Design')
    expect(content).toContain('# PHASE 3: Tasks')
    expect(content).not.toMatch(/\bSTAGE [123]\b/i)
    expect(content).not.toContain('Detect: brownfield?')
    expect(content).toMatch(/Targeted[\s\S]*bounded default/i)
    expect(content).toMatch(/Full[\s\S]*(?:explicit|approved)/i)
    expect(content).toMatch(/Orientation[\s\S]*(?:temporary|cheap)/i)
    expect(content).toContain('Cutover dependencies')
    expect(content).not.toContain('RAMP:SLOT')
  })

  it('orders the single Phase 0 approval transition before Requirements', () => {
    const content = resolveInstructionBody(
      legacyManifest,
      legacyPackDir,
      'aidlc-workflow.md',
    )
    const phaseStart = content.indexOf('# PHASE 0:')
    const phaseEnd = content.indexOf('# PHASE 1:', phaseStart)
    expect(phaseStart).toBeGreaterThanOrEqual(0)
    expect(phaseEnd).toBeGreaterThan(phaseStart)
    const phase = content.slice(phaseStart, phaseEnd)
    const evidenceReady = phase.slice(phase.indexOf('`Awaiting Approval`'))

    expectOrdered(evidenceReady, '`Awaiting Approval`', 'explicit approval')
    expectOrdered(evidenceReady, 'explicit approval', 'same single Phase 0')
    expectOrdered(evidenceReady, 'same single Phase 0', 'complete raw approval response')
    expectOrdered(
      evidenceReady,
      'complete raw approval response',
      '{{STATE_DIR}}/audit.md',
    )
    expectOrdered(
      evidenceReady,
      '{{STATE_DIR}}/audit.md',
      '`Awaiting Approval` to `Complete`',
    )
    expect(content.indexOf('`Awaiting Approval` to `Complete`')).toBeLessThan(phaseEnd)
  })
})

describe.each(legacyManifest.distribution.targets)('legacy primary workflow rendering for %s', (tool) => {
  it('uses native companion paths and resolves custom workspace roots', () => {
    const workspace = resolveWorkspace(legacyManifest, {
      tools: [tool],
      specRoot: 'customer-specs',
      stateRoot: 'customer-state',
    })
    const content = legacyPrimaryContent(tool, workspace)
    const nativePath = nativeReverseEngineeringPaths[tool]

    expect(content).toContain(nativePath)
    for (const [otherTool, otherPath] of Object.entries(nativeReverseEngineeringPaths)) {
      if (otherTool !== tool) expect(content).not.toContain(otherPath)
    }
    expect(content).toContain('customer-specs/decomposition-plan/')
    expect(content).toContain('customer-state/aidlc-state.md')
    expect(content).toContain('customer-state/audit.md')
    expect(content).toContain('customer-state/analysis/reverse-engineering-scope.md')
    expect(content).not.toContain('aidlc-docs/')
    expect(content).not.toContain('RAMP:SLOT')
    expect(content).not.toMatch(/\{\{(?:INSTRUCTION:|SPEC_DIR|STATE_DIR)/)
  })
})

describe.each(['claude-code', 'copilot'])('legacy launcher portability for %s', (tool) => {
  it('defers path selection to the resolved primary instructions', () => {
    const content = renderCommand(legacyManifest, tool)?.content ?? ''

    expect(content).toMatch(/resolved state[\s\S]*primary instructions/i)
    expect(content).toMatch(/resolved analysis path[\s\S]*primary instructions/i)
    expect(content).not.toContain('aidlc-docs/')
    expect(content).not.toMatch(/\{\{(?:STATE_DIR|SPEC_DIR)/)
  })
})

const pilotCases = [
  {
    pack: 'qa-automated-testing',
    directory: packDir,
    manifest,
    decisionMarkers: [
      '### Step 1.2 — Wait for User Input',
      '### Step 2.2 — Wait for User Input',
      '### Step 3.2 — Wait for User Input',
    ],
  },
  {
    pack: 'legacy-transformation-on-aws',
    directory: legacyPackDir,
    manifest: legacyManifest,
    decisionMarkers: [
      '### Step 1.2 — Approve Requirements Decisions',
      '### Step 2.2 — Approve Design Decisions',
      '### Step 3.2 — Approve Task Decisions',
    ],
  },
].flatMap((pilot) =>
  pilot.manifest.distribution.targets.map((tool) => ({ ...pilot, tool })),
)

describe.each(pilotCases)(
  'cross-pilot lifecycle: $pack / $tool',
  ({ pack, directory, manifest: packManifest, decisionMarkers, tool }) => {
    const workspace = resolveWorkspace(packManifest, {
      tools: [tool],
      specRoot: 'customer-specs',
      stateRoot: 'customer-state',
    })
    const primary = renderedInstructionContent(
      packManifest,
      directory,
      tool,
      'aidlc-workflow.md',
      workspace,
    )
    const reverseEngineering = renderedInstructionContent(
      packManifest,
      directory,
      tool,
      'reverse-engineering.md',
      workspace,
    )
    const nativeReverseEngineering = getAdapter(tool)
      .instructions.companionPath('reverse-engineering.md')

    it('resumes first and keeps Phase 0 on one auditable approval lifecycle', () => {
      const phaseStart = primary.indexOf('# PHASE 0:')
      const phaseEnd = primary.indexOf('# PHASE 1:', phaseStart)
      expect(phaseStart, `${pack}/${tool}: Phase 0`).toBeGreaterThanOrEqual(0)
      expect(phaseEnd, `${pack}/${tool}: Phase 1`).toBeGreaterThan(phaseStart)

      const beforePhaseZero = primary.slice(0, phaseStart)
      expect(beforePhaseZero).toContain('customer-state/aidlc-state.md')
      expect(beforePhaseZero).toMatch(/resume/i)
      expect(primary).toMatch(/append-only/i)
      expect(primary).toMatch(/complete raw approval response/i)

      const phaseZero = primary.slice(phaseStart, phaseEnd)
      const approvalMarker = pack === 'legacy-transformation-on-aws'
        ? 'After explicit approval, execute the **same single Phase 0 approval gate**'
        : "Wait for the user's explicit approval before moving to Phase 1."
      expectOrdered(phaseZero, nativeReverseEngineering, approvalMarker)
      expectOrdered(
        phaseZero,
        approvalMarker,
        'complete raw approval response',
      )
      expectOrdered(
        phaseZero,
        'complete raw approval response',
        'customer-state/audit.md',
      )
      expectOrdered(
        phaseZero,
        'customer-state/audit.md',
        'customer-state/aidlc-state.md',
      )

      const evidenceStart = reverseEngineering.indexOf(
        '## Record Evidence-Ready State',
      )
      const approvalStart = reverseEngineering.indexOf(
        '## Approval Transition',
        evidenceStart,
      )
      expect(evidenceStart, `${pack}/${tool}: evidence state`)
        .toBeGreaterThanOrEqual(0)
      expect(approvalStart, `${pack}/${tool}: approval transition`)
        .toBeGreaterThan(evidenceStart)
      expect(reverseEngineering.slice(evidenceStart, approvalStart))
        .toMatch(/Awaiting Approval/)

      const approval = reverseEngineering.slice(approvalStart)
      expectOrdered(approval, 'explicit approval', 'complete raw approval response')
      expectOrdered(
        approval,
        'complete raw approval response',
        'customer-state/audit.md',
      )
      expectOrdered(
        approval,
        'customer-state/audit.md',
        '`Awaiting Approval` to `Complete`',
      )
      expectOrdered(
        approval,
        '`Awaiting Approval` to `Complete`',
        'Phase 1: Requirements',
      )
    })

    it('keeps each decision and artifact gate bounded before the next stage', () => {
      const phases = [
        {
          start: '# PHASE 1:',
          next: '# PHASE 2:',
          create: '### Step 1.1 — Create `_decisions-requirements.md`',
          decision: decisionMarkers[0],
          generate: '### Step 1.3 — Generate `requirements.md`',
        },
        {
          start: '# PHASE 2:',
          next: '# PHASE 3:',
          create: '### Step 2.1 — Create `_decisions-design.md`',
          decision: decisionMarkers[1],
          generate: '### Step 2.3 — Generate `design.md`',
        },
        {
          start: '# PHASE 3:',
          next: '# Task Execution',
          create: '### Step 3.1 — Create `_decisions-tasks.md`',
          decision: decisionMarkers[2],
          generate: '### Step 3.3 — Generate `tasks.md`',
        },
      ]

      for (const phase of phases) {
        const start = primary.indexOf(phase.start)
        const end = primary.indexOf(phase.next, start)
        expect(start, `${pack}/${tool}: ${phase.start}`)
          .toBeGreaterThanOrEqual(0)
        expect(end, `${pack}/${tool}: ${phase.next}`).toBeGreaterThan(start)
        const bounded = primary.slice(start, end)

        expectOrdered(bounded, phase.create, phase.decision)
        expectOrdered(bounded, phase.decision, phase.generate)
        if (pack === 'legacy-transformation-on-aws') {
          const decisionStart = bounded.indexOf(phase.decision)
          const generationStart = bounded.indexOf(phase.generate, decisionStart)
          const decisionGate = bounded.slice(decisionStart, generationStart)
          expect(decisionGate).toMatch(/explicitly approve/i)
          expectOrdered(
            decisionGate,
            'complete raw approval response',
            'customer-state/audit.md',
          )
          expectOrdered(
            decisionGate,
            'customer-state/audit.md',
            'customer-state/aidlc-state.md',
          )
        }
        expectBoundedPhaseGate(
          primary,
          phase.generate,
          phase.next,
          'customer-state',
        )
      }
    })

    it('renders only custom roots, native paths, and resolved content', () => {
      for (const content of [primary, reverseEngineering]) {
        expect(content).toContain('customer-state')
        expect(content).not.toMatch(/aidlc-docs|aidlc-specs/)
        expect(content).not.toContain('RAMP:SLOT')
        expect(content).not.toMatch(
          /\{\{(?:SPEC_DIR|STATE_DIR|INSTRUCTION:[^}]+)\}\}/,
        )

        for (const otherTool of listAdapterIds()) {
          if (otherTool === tool) continue
          const foreignRoot = dirname(
            getAdapter(otherTool).instructions.companionPath('__ramp__.md'),
          )
          expect(content).not.toContain(`${portable(foreignRoot)}/`)
        }
      }

      expect(primary).toContain('customer-specs')
      expect(primary).toContain(nativeReverseEngineering)
    })
  },
)
