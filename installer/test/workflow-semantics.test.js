import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdapter, listAdapterIds } from '../src/adapters/index.js'
import { loadManifest } from '../src/manifest.js'
import { renderInstructions } from '../src/render/instructions.js'
import { resolveWorkspace } from '../src/workspace.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const packDir = join(repoRoot, 'packs', 'qa-automated-testing')
const commonWorkflow = join(repoRoot, 'common', 'instructions', 'aidlc-workflow.md')
const localWorkflow = join(packDir, 'instructions', 'aidlc-workflow.md')
const manifest = loadManifest(packDir)

const nativeReverseEngineeringPaths = {
  kiro: '.kiro/steering/reverse-engineering.md',
  'claude-code': '.claude/rules/reverse-engineering.md',
  copilot: '.github/instructions/reverse-engineering.instructions.md',
  cursor: '.cursor/rules/reverse-engineering.mdc',
}

function primaryContent(tool, workspace = resolveWorkspace(manifest, { tools: [tool] })) {
  const path = getAdapter(tool).instructions.primaryPath('aidlc-workflow.md')
  const write = renderInstructions(manifest, packDir, tool, workspace)
    .find((entry) => entry.path === path)
  expect(write, `primary instruction for ${tool}`).toBeDefined()
  return write.content
}

function expectOrdered(content, earlier, later) {
  const earlierIndex = content.indexOf(earlier)
  const laterIndex = content.indexOf(later)
  expect(earlierIndex, `missing earlier marker: ${earlier}`).toBeGreaterThanOrEqual(0)
  expect(laterIndex, `missing later marker: ${later}`).toBeGreaterThanOrEqual(0)
  expect(earlierIndex, `${earlier} must precede ${later}`).toBeLessThan(laterIndex)
}

function expectBoundedPhaseGate(content, artifact, nextStage) {
  const start = content.indexOf(artifact)
  const end = content.indexOf(nextStage, start)
  expect(start, `missing phase artifact: ${artifact}`).toBeGreaterThanOrEqual(0)
  expect(end, `missing next stage after ${artifact}: ${nextStage}`).toBeGreaterThan(start)

  const phase = content.slice(start, end + nextStage.length)
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
    '`aidlc-docs/audit.md`',
  )
  expectOrdered(
    phase,
    '`aidlc-docs/audit.md`',
    'update `aidlc-docs/aidlc-state.md`',
  )
  expectOrdered(phase, 'update `aidlc-docs/aidlc-state.md`', nextStage)
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

describe.each(listAdapterIds())('QA workflow semantics for %s', (tool) => {
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
