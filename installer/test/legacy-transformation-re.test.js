import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadManifest } from '../src/manifest.js'
import { renderInstructions } from '../src/render/instructions.js'
import { renderCommand } from '../src/render/command.js'

const here = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(here, '..', '..', 'packs', 'legacy-transformation-on-aws')
const manifest = loadManifest(packDir)
const readInstruction = (name) => readFileSync(join(packDir, 'instructions', name), 'utf8')
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
    /Full mode only when[\s\S]*explicitly requests system-wide analysis[\s\S]*or approves an expansion to Full/i,
  )

  const reExpansion = markdownSection(re, '### Expansion')
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

function expectFullArtifactBundle(re, source) {
  const full = markdownSection(re, '### Full artifact bundle')
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
    expect(full, `${source}: Full mode preserves ${artifact}`).toContain(`\`${artifact}\``)
  }
  expect(full, `${source}: Full mode keeps all nine artifacts, no Targeted substitution`).toMatch(
    /all nine artifacts[\s\S]*do not substitute the Targeted bundle/i,
  )
}

function expectEvidenceLifecycle(re, wf, source) {
  const gate = markdownSection(re, '## Step 5: Evidence review and approval gate')
  expect(gate, `${source}: finished evidence awaits approval, not completion`).toMatch(
    /set status to `Awaiting Approval`/i,
  )
  expect(gate, `${source}: pre-approval messaging describes evidence as ready`).toMatch(
    /analysis evidence is ready for review/i,
  )
  expect(gate, `${source}: completion needs the raw approval audit then Complete`).toMatch(
    /explicit user approval[\s\S]*complete raw approval response[\s\S]*audit\.md[\s\S]*`Awaiting Approval` to `Complete`/i,
  )
  expect(gate, `${source}: does not call the run complete pre-approval`).not.toMatch(/Reverse Engineering Complete/i)

  const wfGate = markdownSection(wf, '## Expansion and approval gate')
  expect(wfGate, `${source}: workflow transitions Awaiting Approval to Complete only after raw audit`).toMatch(
    /Awaiting Approval[\s\S]*explicit approval[\s\S]*raw response[\s\S]*audit\.md[\s\S]*`Complete`/i,
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
  expectSentinelSweep(re, source)
  expectFullArtifactBundle(re, source)
  expectEvidenceLifecycle(re, wf, source)
  expectOrientationAndClarification(re, wf, source)
  // Targeted artifact section is present and named.
  expect(markdownSection(re, '## Step 2 artifacts (Targeted)')).toMatch(
    /`target-analysis\.md`[\s\S]*`target-coupling-assessment\.md`/,
  )
  // The pre-adaptive "scan everything" phrasing must be gone.
  expect(re, `${source}: no blanket whole-repo scan phrasing`).not.toContain('All packages (not just mentioned ones)')
}

describe('legacy-transformation-on-aws adaptive reverse engineering', () => {
  it('defines the adaptive contract in the canonical instructions', () => {
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
  })

  it('encodes the prior-analysis-aware input strategy in the manifest command body', () => {
    expectConditionalInputStrategy(manifest.command?.body ?? '', 'pack.yaml command.body')
  })

  // Generated output is no longer committed (Model B: build-all regenerates it
  // from source and CI publishes to gh-pages), so we assert the fresh render.
  it.each([['claude-code'], ['copilot']])(
    'keeps the %s launcher prior-analysis-aware in fresh render',
    (tool) => {
      expectConditionalInputStrategy(renderCommand(manifest, tool)?.content ?? '', `${tool} fresh launcher`)
    },
  )
})
