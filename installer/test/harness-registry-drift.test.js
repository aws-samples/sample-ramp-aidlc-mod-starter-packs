// Harness registry drift. CI fails when the adapter registry gains a harness
// that QA Automated Testing or either add-skills helper does not cover. QA may
// leave a harness out only when support/harness-incompatibilities.js records
// it as an approved incompatibility; the helpers serve every pack, so they
// must accept every harness. This test owns the rules for that list, which
// qa-harness-coverage.test.js also reads: each entry names a registered
// harness that QA does not qualify and states a non-empty reason, so the list
// cannot go stale.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAdapter, listAdapterIds } from '../src/adapters/index.js'
import { loadManifest } from '../src/manifest.js'
import { repoRoot } from './support/customer-layout.js'
import { harnessIncompatibilities } from './support/harness-incompatibilities.js'

const PACK = 'qa-automated-testing'
const TEMPLATES = join(repoRoot, 'installer', 'src', 'render')
const BASH_TEMPLATE = readTemplate('add-skills.template.sh')
const POWERSHELL_TEMPLATE = readTemplate('add-skills.template.ps1')

function readTemplate(name) {
  return readFileSync(join(TEMPLATES, name), 'utf8').replace(/\r\n?/g, '\n')
}

// What a helper template accepts: each place it lists the --tool values, and
// the skills root it copies into for each tool.
function bashHelperTools(text) {
  const usage = text.match(/--tool <([^>]+)>/)
  const cases = text.match(/^case "\$tool" in\n([\s\S]*?)^esac$/m)
  if (!usage || !cases) throw new Error('add-skills.sh: no --tool usage line or case block')
  const arms = [...cases[1].matchAll(/^ {2}([a-z0-9-]+)\) dest_sub="([^"]*)" ;;$/gm)]
  return {
    lists: {
      'usage line': usage[1].split('|'),
      '--tool cases': arms.map(([, id]) => id),
    },
    skillsRoots: Object.fromEntries(arms.map(([, id, root]) => [id, root])),
  }
}

function powerShellHelperTools(text) {
  const validateSet = text.match(/\[ValidateSet\(([^)]*)\)\]\s*\[string\]\$Tool\b/)
  const table = text.match(/^\$DestinationByTool = @\{\n([\s\S]*?)^\}$/m)
  if (!validateSet || !table) throw new Error('add-skills.ps1: no $Tool ValidateSet or $DestinationByTool table')
  const rows = [...table[1].matchAll(/^ {2}'([^']*)' = '([^']*)'$/gm)]
  return {
    lists: {
      ValidateSet: [...validateSet[1].matchAll(/'([^']*)'/g)].map(([, id]) => id),
      'DestinationByTool keys': rows.map(([, id]) => id),
    },
    skillsRoots: Object.fromEntries(rows.map(([, id, root]) => [id, root])),
  }
}

function setDrift(label, actual, expected) {
  return [
    ...expected.filter((id) => !actual.includes(id)).map((id) => `${label} lacks ${id}`),
    ...actual.filter((id) => !expected.includes(id)).map((id) => `${label} has unexpected ${id}`),
  ]
}

// The check: a list of findings, empty when nothing has drifted.
function registryDriftFindings({ adapters, qa, helpers, incompatibilities }) {
  const registry = adapters.map((adapter) => adapter.id)
  const findings = []
  for (const [id, reason] of Object.entries(incompatibilities)) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      findings.push(`approved incompatibility ${id} states no reason`)
    }
    if (!registry.includes(id)) {
      findings.push(`approved incompatibility ${id} is not a registered harness`)
    }
    if (qa.qualifiedTargets.includes(id)) {
      findings.push(`approved incompatibility ${id} is qualified by ${qa.name}`)
    }
  }
  const covered = registry.filter((id) => !Object.hasOwn(incompatibilities, id))
  findings.push(...setDrift(`${qa.name} targets`, qa.targets, covered))
  findings.push(...setDrift(`${qa.name} qualifiedTargets`, qa.qualifiedTargets, covered))
  for (const [helper, { lists, skillsRoots }] of Object.entries(helpers)) {
    for (const [where, ids] of Object.entries(lists)) {
      findings.push(...setDrift(`${helper} ${where}`, ids, registry))
    }
    for (const { id, skillsRoot } of adapters) {
      if (Object.hasOwn(skillsRoots, id) && skillsRoots[id] !== skillsRoot) {
        findings.push(`${helper} copies ${id} skills into ${skillsRoots[id]}, not ${skillsRoot}`)
      }
    }
  }
  return findings
}

function repositoryInputs({ bash = BASH_TEMPLATE, powerShell = POWERSHELL_TEMPLATE } = {}) {
  const { distribution } = loadManifest(join(repoRoot, 'packs', PACK))
  return {
    adapters: listAdapterIds().map(getAdapter),
    qa: { name: PACK, ...distribution },
    helpers: {
      'add-skills.sh': bashHelperTools(bash),
      'add-skills.ps1': powerShellHelperTools(powerShell),
    },
    incompatibilities: harnessIncompatibilities,
  }
}

const FUTURE_TOOL = { id: 'future-tool', skillsRoot: '.future-tool/skills' }
const FUTURE_TOOL_HELPER_FINDINGS = [
  'add-skills.sh usage line lacks future-tool',
  'add-skills.sh --tool cases lacks future-tool',
  'add-skills.ps1 ValidateSet lacks future-tool',
  'add-skills.ps1 DestinationByTool keys lacks future-tool',
]

function withFutureTool(incompatibilities = {}) {
  const inputs = repositoryInputs()
  return { ...inputs, adapters: [...inputs.adapters, FUTURE_TOOL], incompatibilities }
}

describe('harness registry drift', () => {
  it('finds no drift in the repository', () => {
    expect(registryDriftFindings(repositoryInputs())).toEqual([])
  })

  it('names QA and both helpers when the registry gains a harness', () => {
    expect(registryDriftFindings(withFutureTool())).toEqual([
      `${PACK} targets lacks future-tool`,
      `${PACK} qualifiedTargets lacks future-tool`,
      ...FUTURE_TOOL_HELPER_FINDINGS,
    ])
  })

  it('lets an approved incompatibility clear the QA findings, not the helper findings', () => {
    const approved = { 'future-tool': 'reads no project-level MCP configuration' }
    expect(registryDriftFindings(withFutureTool(approved))).toEqual(FUTURE_TOOL_HELPER_FINDINGS)
  })

  it.each([
    ['an empty', ''],
    ['a blank', '  '],
    ['a non-string', true],
  ])('rejects an approved incompatibility with %s reason', (_, reason) => {
    expect(registryDriftFindings(withFutureTool({ 'future-tool': reason }))).toEqual([
      'approved incompatibility future-tool states no reason',
      ...FUTURE_TOOL_HELPER_FINDINGS,
    ])
  })

  it('rejects an approved incompatibility for a harness outside the registry', () => {
    const inputs = { ...repositoryInputs(), incompatibilities: { 'retired-tool': 'was removed' } }
    expect(registryDriftFindings(inputs)).toEqual([
      'approved incompatibility retired-tool is not a registered harness',
    ])
  })

  it('rejects an approved incompatibility for a harness QA qualifies', () => {
    const inputs = { ...repositoryInputs(), incompatibilities: { cursor: 'no reason left' } }
    expect(registryDriftFindings(inputs)).toEqual([
      `approved incompatibility cursor is qualified by ${PACK}`,
      `${PACK} targets has unexpected cursor`,
      `${PACK} qualifiedTargets has unexpected cursor`,
    ])
  })

  it('reads the tool lists from the bash helper template', () => {
    const bash = BASH_TEMPLATE
      .replace('<kiro|claude-code|copilot|cursor|codex>', '<kiro|claude-code|copilot|cursor>')
      .replace('codex) dest_sub=".agents/skills" ;;', 'codex) dest_sub=".codex/skills" ;;')
      .replace('  cursor) dest_sub=".cursor/skills" ;;\n', '')
    expect(registryDriftFindings(repositoryInputs({ bash }))).toEqual([
      'add-skills.sh usage line lacks codex',
      'add-skills.sh --tool cases lacks cursor',
      'add-skills.sh copies codex skills into .codex/skills, not .agents/skills',
    ])
  })

  it('reads the tool lists from the PowerShell helper template', () => {
    const powerShell = POWERSHELL_TEMPLATE
      .replace("'cursor', 'codex')]", "'cursor', 'codex', 'zed')]")
      .replace("  'kiro' = '.kiro/skills'\n", '')
      .replace("'copilot' = '.github/skills'", "'copilot' = '.copilot/skills'")
    expect(registryDriftFindings(repositoryInputs({ powerShell }))).toEqual([
      'add-skills.ps1 ValidateSet has unexpected zed',
      'add-skills.ps1 DestinationByTool keys lacks kiro',
      'add-skills.ps1 copies copilot skills into .copilot/skills, not .github/skills',
    ])
  })
})
