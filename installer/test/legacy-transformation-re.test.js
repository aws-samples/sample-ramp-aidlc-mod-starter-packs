import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadManifest } from '../src/manifest.js'
import { renderInstructions } from '../src/render/instructions.js'
import { renderCommand } from '../src/render/command.js'

const here = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(here, '..', '..', 'legacy-transformation-on-aws')
const manifest = loadManifest(packDir)
const readInstruction = (name) => readFileSync(join(packDir, 'instructions', name), 'utf8')
const byPath = (writes, path) => writes.find((write) => write.path === path)?.content ?? ''

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

function expectModeAndExpansionSemantics(reverseEngineering, workflow, source) {
  const targetedMode = markdownSection(reverseEngineering, '### Targeted mode')
  expect(targetedMode, `${source}: Targeted must be the bounded-objective default`).toMatch(
    /Targeted mode by default[\s\S]*(?:feature|journey|module|endpoint)[\s\S]*bounded objective/i,
  )

  const fullMode = markdownSection(reverseEngineering, '### Full mode')
  expect(fullMode, `${source}: Full must require an explicit request or approved expansion`).toMatch(
    /Full mode[\s\S]*only when[\s\S]*explicitly requests? system-wide analysis[\s\S]*or[\s\S]*approves? a major expansion to Full mode/i,
  )

  const reverseExpansion = markdownSection(reverseEngineering, '### 2A.5 Expansion rules')
  expect(reverseExpansion, `${source}: major expansion must stop for explicit approval`).toMatch(
    /Major expansion[\s\S]*(?:another business capability|bounded context)[\s\S]*requires explicit user approval[\s\S]*stop before the expansion/i,
  )

  const workflowModes = markdownSection(workflow, '## Mode selection')
  expect(workflowModes, `${source}: workflow must preserve the Targeted default`).toMatch(
    /Targeted mode[^\n]*default[^\n]*bounded objective/i,
  )
  expect(workflowModes, `${source}: workflow must gate Full mode`).toMatch(
    /Full mode[^\n]*only when[^\n]*explicitly asks[^\n]*or approves a major expansion to Full/i,
  )

  const workflowExpansion = markdownSection(workflow, '## Expansion and approval gate')
  expect(workflowExpansion, `${source}: workflow must require approval before major expansion scanning`).toMatch(
    /major expansion[\s\S]*(?:another business capability|bounded context)[\s\S]*requires explicit approval before scanning/i,
  )
}

function expectCommonScopeContract(reverseEngineering, workflow, source) {
  const scopeTemplate = markdownSection(reverseEngineering, '### `reverse-engineering-scope.md`')
  expect(scopeTemplate, `${source}: scope artifact must be common to both modes`).toMatch(
    /common[\s\S]*Targeted[\s\S]*Full/i,
  )
  expect(scopeTemplate, `${source}: scope template must support both modes`).toMatch(
    /\*\*Mode\*\*:\s*\[Targeted \/ Full\]/,
  )

  const fieldNames = [...scopeTemplate.matchAll(/^- \*\*(.+?)\*\*:/gm)].map((match) => match[1])
  expect(fieldNames, `${source}: scope fields must be explicit and independently recorded`).toEqual(
    expect.arrayContaining([
      'In-Scope',
      'Not-In-Scope',
      'Prior Analysis',
      'Provenance',
      'Confidence',
      'Not Analyzed',
    ]),
  )
  expect(new Set(fieldNames).size, `${source}: scope fields must not be aliases or duplicates`).toBe(fieldNames.length)
  expect(scopeTemplate, `${source}: Not Analyzed must differ from planned exclusions`).toMatch(
    /\*\*Not Analyzed\*\*:[^\n]*(?:not examined|unexamined)[^\n]*Not-In-Scope/i,
  )
  expect(scopeTemplate, `${source}: Provenance must identify evidence actually used`).toMatch(
    /\*\*Provenance\*\*:[^\n]*(?:source|runtime|test)[^\n]*(?:used|examined)/i,
  )
  expect(scopeTemplate, `${source}: Confidence must include rationale`).toMatch(
    /\*\*Confidence\*\*:[^\n]*rationale/i,
  )

  const requiredScope = markdownSection(workflow, '## Required scope contract')
  expect(requiredScope, `${source}: workflow scope contract must carry the common evidence fields`).toMatch(
    /both Targeted and Full[\s\S]*provenance[\s\S]*confidence[\s\S]*not analyzed/i,
  )

  const proportionalArtifacts = markdownSection(workflow, '## Proportional artifacts')
  const occurrences = proportionalArtifacts.match(/`reverse-engineering-scope\.md`/g) ?? []
  expect(occurrences, `${source}: both mode bundles must include the common scope artifact`).toHaveLength(2)
}

function expectStateExpansionSchema(workflow, reverseEngineering, source) {
  const stateTracking = markdownSection(workflow, '## Mandatory State Tracking')
  expect(stateTracking, `${source}: state schema must separately record minor expansions`).toMatch(
    /\*\*Minor Scope Expansions\*\*:[^\n]*(?:automatic|direct-dependency)/i,
  )
  expect(stateTracking, `${source}: state schema must separately record approved major expansions`).toMatch(
    /\*\*Major Scope Expansions\*\*:[^\n]*approved/i,
  )

  const metadataAndState = markdownSection(reverseEngineering, '## Step 4: Mode-Aware Metadata and State')
  expect(metadataAndState, `${source}: RE state instructions must use the same two expansion fields`).toMatch(
    /`Minor Scope Expansions`[\s\S]*`Major Scope Expansions`/i,
  )
}

function expectConditionalInputStrategy(content, source) {
  expect(content, `${source}: must detect prior analysis before choosing an input strategy`).toMatch(
    /detect[\s\S]*(?:prior analysis|AWS Transform|ATX)[\s\S]*freshness[\s\S]*coverage/i,
  )
  expect(content, `${source}: Reuse & Verify must require suitable fresh and covering evidence`).toMatch(
    /Reuse & Verify[\s\S]*(?:only when|when)[\s\S]*(?:suitable|sufficient)[\s\S]*fresh(?:ness)?[\s\S]*cover(?:age|s)/i,
  )
  expect(content, `${source}: unsuitable or absent prior evidence must fall back to Direct Scan`).toMatch(
    /(?:otherwise|if no suitable|stale|insufficient)[\s\S]*Direct Scan/i,
  )
}

function expectEvidenceLifecycle(reverseEngineering, workflow, source) {
  const statusEnum = 'Orientation / In Progress / Partial/Awaiting Evidence / Awaiting Approval / Complete'
  const scopeTemplate = markdownSection(reverseEngineering, '### `reverse-engineering-scope.md`')
  const metadataAndState = markdownSection(reverseEngineering, '## Step 4: Mode-Aware Metadata and State')
  const stateTracking = markdownSection(workflow, '## Mandatory State Tracking')

  expect(scopeTemplate, `${source}: scope artifact must use the shared status enum`).toContain(
    `**Reverse Engineering Status**: [${statusEnum}]`,
  )
  expect(metadataAndState, `${source}: timestamp artifact must use the shared status enum`).toContain(
    `**Reverse Engineering Status**: [${statusEnum}]`,
  )
  expect(stateTracking, `${source}: workflow state must use the shared status enum`).toContain(
    `**Reverse Engineering Status**: [${statusEnum}]`,
  )

  const approvalGate = markdownSection(reverseEngineering, '## Step 5: Evidence Review and Approval Gate')
  expect(approvalGate, `${source}: finished evidence must await approval, not claim completion`).toMatch(
    /evidence[\s\S]*(?:finished|ready)[\s\S]*Awaiting Approval/i,
  )
  expect(approvalGate, `${source}: completion requires raw approval audit before state completion`).toMatch(
    /explicit[\s\S]*approval[\s\S]*complete raw[\s\S]*audit\.md[\s\S]*state[\s\S]*Complete/i,
  )
  expect(approvalGate, `${source}: pre-approval messaging must describe evidence as ready`).toMatch(
    /analysis evidence (?:is )?ready for review/i,
  )
  expect(approvalGate, `${source}: pre-approval messaging must not call the run complete`).not.toMatch(
    /Reverse Engineering Complete|completed Targeted run|completed Full run/i,
  )

  const workflowGate = markdownSection(workflow, '## Expansion and approval gate')
  expect(workflowGate, `${source}: workflow must transition Awaiting Approval to Complete only after raw audit`).toMatch(
    /Awaiting Approval[\s\S]*explicit approval[\s\S]*raw response[\s\S]*audit[\s\S]*Complete/i,
  )
}

function expectLoadBearingEvidenceSemantics(reverseEngineering, source) {
  const orientation = markdownSection(reverseEngineering, '### Orientation pass')
  expect(orientation, `${source}: Orientation must stay cheap and allow one informed clarification`).toMatch(
    /cheap[\s\S]*one informed scope clarification/i,
  )

  const reuse = markdownSection(reverseEngineering, '### Reuse & Verify')
  expect(reuse, `${source}: prior evidence must be qualified and reconciled with provenance`).toMatch(
    /freshness[\s\S]*coverage[\s\S]*reconcile[\s\S]*provenance/i,
  )
  expectConditionalInputStrategy(reuse, `${source} Reuse & Verify section`)

  const sentinel = markdownSection(reverseEngineering, '### 2A.4 Mandatory cross-cutting sentinel sweep')
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
    expect(sentinel, `${source}: sentinel category ${category} must be mandatory`).toMatch(category)
  }

  expect(reverseEngineering, `${source}: incomplete evidence must remain Partial/Awaiting Evidence`).toMatch(
    /Partial\/Awaiting Evidence[\s\S]*do not mark Reverse Engineering complete/i,
  )

  const fullContract = markdownSection(reverseEngineering, '### 3A.2 Full artifact contract')
  for (const artifact of [
    'business-overview.md',
    'architecture.md',
    'code-structure.md',
    'api-documentation.md',
    'component-inventory.md',
    'technology-stack.md',
    'dependencies.md',
    'bounded-contexts.md',
    'coupling-assessment.md',
  ]) {
    expect(fullContract, `${source}: Full mode must preserve ${artifact}`).toContain(`\`${artifact}\``)
  }
}

function expectAdaptiveSemantics(reverseEngineering, workflow, source) {
  expectModeAndExpansionSemantics(reverseEngineering, workflow, source)
  expectCommonScopeContract(reverseEngineering, workflow, source)
  expectStateExpansionSchema(workflow, reverseEngineering, source)
  expectLoadBearingEvidenceSemantics(reverseEngineering, source)
  expectEvidenceLifecycle(reverseEngineering, workflow, source)

  const targetedBundle = markdownSection(reverseEngineering, '## Step 2B: Targeted Artifact Bundle')
  expect(targetedBundle).toMatch(/`target-analysis\.md`[\s\S]*`target-coupling-assessment\.md`[\s\S]*`reverse-engineering-coverage\.md`/)

  const fullContract = markdownSection(reverseEngineering, '### 3A.2 Full artifact contract')
  expect(fullContract).toMatch(/common mode\/objective\/scope\/provenance\/confidence\/not-analyzed header required by Step 1/i)

  expect(reverseEngineering).not.toContain('All packages (not just mentioned ones)')
  expect(markdownSection(workflow, '### Scope clarification exception')).toMatch(
    /One informed scope clarification[\s\S]*only chat exception/i,
  )
}

describe('legacy-transformation-on-aws adaptive reverse engineering', () => {
  it('defines the reviewed adaptive contract in canonical instructions', () => {
    expectAdaptiveSemantics(
      readInstruction('reverse-engineering.md'),
      readInstruction('aidlc-workflow.md'),
      'canonical instructions',
    )
  })

  it('uses a semantic auto-load description for bounded and system-wide brownfield analysis', () => {
    const entry = manifest.instructions.find((instruction) => instruction.file === 'reverse-engineering.md')

    expect(entry?.load).toBe('auto')
    expect(entry?.description).toMatch(/brownfield/i)
    expect(entry?.description).toMatch(/Targeted or Full/)
    expect(entry?.description).toMatch(/Reuse & Verify[\s\S]*ATX\/assessment/i)
    expect(entry?.description).toMatch(/feature[\s\S]*journey[\s\S]*module[\s\S]*system-wide/i)
  })

  it.each([
    ['kiro', '.kiro/steering/reverse-engineering.md', '.kiro/steering/aidlc-workflow.md'],
    ['claude-code', '.claude/rules/reverse-engineering.md', 'CLAUDE.md'],
    ['copilot', '.github/instructions/reverse-engineering.instructions.md', '.github/copilot-instructions.md'],
    ['cursor', '.cursor/rules/reverse-engineering.mdc', '.cursor/rules/aidlc-workflow.mdc'],
  ])('renders the reviewed adaptive contract for %s', (tool, reversePath, workflowPath) => {
    const writes = renderInstructions(manifest, packDir, tool)

    expectAdaptiveSemantics(
      byPath(writes, reversePath),
      byPath(writes, workflowPath),
      `${tool} rendered instructions`,
    )
  })

  it('selects Direct Scan or Reuse & Verify conditionally in the manifest command body', () => {
    expectConditionalInputStrategy(manifest.command?.body ?? '', 'pack.yaml command.body')
  })

  it.each([
    ['claude-code', 'scaffolded-packs/claude-code/.claude/commands/aidlc.md'],
    ['copilot', 'scaffolded-packs/copilot/.github/prompts/aidlc.prompt.md'],
  ])('keeps the %s launcher conditional in fresh and generated output', (tool, generatedPath) => {
    const fresh = renderCommand(manifest, tool)?.content ?? ''
    const generated = readFileSync(join(packDir, generatedPath), 'utf8')

    expectConditionalInputStrategy(fresh, `${tool} fresh launcher`)
    expectConditionalInputStrategy(generated, `${tool} generated launcher`)
    expect(generated, `${tool} generated launcher must byte-match the renderer`).toBe(fresh)
  })
})
