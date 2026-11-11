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
// the skills root it copies into for each tool. The readers accept any run of
// spaces or tabs and trailing whitespace. Inside the regions they read, a
// line they cannot parse throws an error naming the file and line, so a tool
// written in an unexpected form is never dropped silently.
const BLANK_OR_COMMENT = /^[ \t]*(?:#.*)?$/
const TOOL_ID = /^[a-z0-9-]+$/
const BASH_ARM = /^[ \t]*([a-z0-9-]+)\)[ \t]*dest_sub=(?:"([^"]*)"|'([^']*)'|([^\s"';]+))[ \t]*;;[ \t]*$/
const BASH_DEFAULT_ARM = /^[ \t]*\*\)[ \t]*$/
const POWERSHELL_ROW = /^[ \t]*'([^']*)'[ \t]*=[ \t]*'([^']*)'[ \t]*$/

function unparsed(file, index, what, line) {
  return new Error(`${file} line ${index + 1}: ${what}: ${line.trim()}`)
}

function lineIndexes(lines, pattern) {
  return lines.flatMap((line, index) => (pattern.test(line) ? [index] : []))
}

function onlyLine(file, lines, pattern, what) {
  const found = lineIndexes(lines, pattern)
  if (found.length !== 1) throw new Error(`${file}: expected one ${what}, found ${found.length}`)
  return found[0]
}

function closingLine(file, lines, first, pattern, what) {
  const last = lines.findIndex((line, index) => index > first && pattern.test(line))
  if (last === -1) throw unparsed(file, first, `${what} is not closed`, lines[first])
  return last
}

function bashHelperTools(text, file = 'add-skills.template.sh') {
  const lines = text.split('\n')
  const usageLine = onlyLine(file, lines, /--tool <[^>]*>/, '--tool usage list')
  const usage = lines[usageLine].match(/--tool <([^>]*)>/)[1].split('|').map((id) => id.trim())
  if (!usage.every((id) => TOOL_ID.test(id))) {
    throw unparsed(file, usageLine, 'unparsed --tool usage list', lines[usageLine])
  }

  const first = onlyLine(file, lines, /^[ \t]*case[ \t]+"?\$(?:tool|\{tool\})"?[ \t]+in[ \t]*$/, 'case block on $tool')
  const last = closingLine(file, lines, first, /^[ \t]*esac[ \t]*$/, 'case block on $tool')
  const arms = []
  let inDefaultArm = false
  for (let index = first + 1; index < last; index++) {
    const line = lines[index]
    if (inDefaultArm) {
      if (/^[ \t]*case\b/.test(line)) throw unparsed(file, index, 'nested case in the default arm', line)
      if (/^[ \t]*;;[ \t]*$/.test(line)) inDefaultArm = false
      continue
    }
    if (BLANK_OR_COMMENT.test(line)) continue
    if (BASH_DEFAULT_ARM.test(line)) {
      inDefaultArm = true
      continue
    }
    const arm = line.match(BASH_ARM)
    if (!arm) throw unparsed(file, index, 'unparsed case arm', line)
    arms.push([arm[1], arm[2] ?? arm[3] ?? arm[4]])
  }
  for (const index of lineIndexes(lines, /(?:^|[\s;&|])dest_sub=/)) {
    if (index < first || index > last) {
      throw unparsed(file, index, 'dest_sub assigned outside the case block', lines[index])
    }
  }
  return {
    lists: {
      'usage line': usage,
      '--tool cases': arms.map(([id]) => id),
    },
    skillsRoots: arms,
  }
}

function powerShellHelperTools(text, file = 'add-skills.template.ps1') {
  const lines = text.split('\n')
  const validateSet = text.match(/\[ValidateSet\(([^)]*)\)\]\s*\[string\]\s*\$Tool\b/i)
  if (!validateSet) throw new Error(`${file}: no ValidateSet on [string]$Tool`)
  const validateSetLine = text.slice(0, validateSet.index).split('\n').length - 1
  if (!/^\s*'[^']*'(?:\s*,\s*'[^']*')*\s*$/.test(validateSet[1])) {
    throw unparsed(file, validateSetLine, 'unparsed ValidateSet', lines[validateSetLine])
  }

  const first = onlyLine(
    file,
    lines,
    /^[ \t]*\$DestinationByTool[ \t]*=[ \t]*(?:\[ordered\][ \t]*)?@\{[ \t]*$/i,
    '$DestinationByTool table',
  )
  const last = closingLine(file, lines, first, /^[ \t]*\}[ \t]*$/, '$DestinationByTool table')
  const rows = []
  for (let index = first + 1; index < last; index++) {
    const line = lines[index]
    if (BLANK_OR_COMMENT.test(line)) continue
    const row = line.match(POWERSHELL_ROW)
    if (!row) throw unparsed(file, index, 'unparsed $DestinationByTool row', line)
    rows.push([row[1], row[2]])
  }
  const otherAssignment = /\$DestinationByTool\s*(?:=(?!=)|\[[^\]]*\]\s*=(?!=)|\.\s*\w+\s*(?:=(?!=)|\())/i
  for (const index of lineIndexes(lines, otherAssignment)) {
    if (index !== first) throw unparsed(file, index, '$DestinationByTool assigned outside its table', lines[index])
  }
  return {
    lists: {
      ValidateSet: [...validateSet[1].matchAll(/'([^']*)'/g)].map(([, id]) => id),
      'DestinationByTool keys': rows.map(([id]) => id),
    },
    skillsRoots: rows,
  }
}

function setDrift(label, actual, expected) {
  const repeated = new Set(actual.filter((id, index) => actual.indexOf(id) !== index))
  return [
    ...expected.filter((id) => !actual.includes(id)).map((id) => `${label} lacks ${id}`),
    ...[...new Set(actual)].filter((id) => !expected.includes(id)).map((id) => `${label} has unexpected ${id}`),
    ...[...repeated].map((id) => `${label} lists ${id} more than once`),
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
    for (const [id, root] of skillsRoots) {
      const adapter = adapters.find((candidate) => candidate.id === id)
      if (adapter && root !== adapter.skillsRoot) {
        findings.push(`${helper} copies ${id} skills into ${root}, not ${adapter.skillsRoot}`)
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

// An edited copy of a template. Each edit must apply, so no fixture is vacuous.
function edited(text, edits) {
  return edits.reduce((result, [from, to]) => {
    if (!result.includes(from)) throw new Error(`fixture edit does not apply: ${from}`)
    return result.replace(from, to)
  }, text)
}

// 1-based line of the first line of the template that contains `fragment`.
function lineOf(text, fragment) {
  return text.split('\n').findIndex((line) => line.includes(fragment)) + 1
}

const CODEX_ARM = '  codex) dest_sub=".agents/skills" ;;\n'
const CODEX_ARM_LINE = lineOf(BASH_TEMPLATE, CODEX_ARM.trimEnd())
const CODEX_ROW = "  'codex' = '.agents/skills'\n"
const CODEX_ROW_LINE = lineOf(POWERSHELL_TEMPLATE, CODEX_ROW.trimEnd())
const VALIDATE_SET_LINE = lineOf(POWERSHELL_TEMPLATE, '[ValidateSet(')
const ERRORS_LINE = lineOf(POWERSHELL_TEMPLATE, '$script:Errors = ')

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
    const bash = edited(BASH_TEMPLATE, [
      ['<kiro|claude-code|copilot|cursor|codex>', '<kiro|claude-code|copilot|cursor>'],
      ['codex) dest_sub=".agents/skills" ;;', 'codex) dest_sub=".codex/skills" ;;'],
      ['  cursor) dest_sub=".cursor/skills" ;;\n', ''],
    ])
    expect(registryDriftFindings(repositoryInputs({ bash }))).toEqual([
      'add-skills.sh usage line lacks codex',
      'add-skills.sh --tool cases lacks cursor',
      'add-skills.sh copies codex skills into .codex/skills, not .agents/skills',
    ])
  })

  it('reads the tool lists from the PowerShell helper template', () => {
    const powerShell = edited(POWERSHELL_TEMPLATE, [
      ["'cursor', 'codex')]", "'cursor', 'codex', 'zed')]"],
      ["  'kiro' = '.kiro/skills'\n", ''],
      ["'copilot' = '.github/skills'", "'copilot' = '.copilot/skills'"],
    ])
    expect(registryDriftFindings(repositoryInputs({ powerShell }))).toEqual([
      'add-skills.ps1 ValidateSet has unexpected zed',
      'add-skills.ps1 DestinationByTool keys lacks kiro',
      'add-skills.ps1 copies copilot skills into .copilot/skills, not .github/skills',
    ])
  })

  it('finds a tool listed more than once', () => {
    const bash = edited(BASH_TEMPLATE, [
      ['|codex>', '|codex|kiro>'],
      [CODEX_ARM, `${CODEX_ARM}  kiro) dest_sub=".other/skills" ;;\n`],
    ])
    const powerShell = edited(POWERSHELL_TEMPLATE, [["'cursor', 'codex')]", "'cursor', 'codex', 'kiro')]"]])
    expect(registryDriftFindings(repositoryInputs({ bash, powerShell }))).toEqual([
      'add-skills.sh usage line lists kiro more than once',
      'add-skills.sh --tool cases lists kiro more than once',
      'add-skills.sh copies kiro skills into .other/skills, not .kiro/skills',
      'add-skills.ps1 ValidateSet lists kiro more than once',
    ])
  })

  it.each([
    ['runs of spaces and tabs, and trailing whitespace', [
      ['  kiro) dest_sub=".kiro/skills" ;;', '\tkiro)        dest_sub=".kiro/skills"  ;;  \t'],
      ['  copilot) dest_sub', '    copilot)\tdest_sub'],
    ]],
    ['unquoted and single-quoted roots', [
      ['dest_sub=".claude/skills"', 'dest_sub=.claude/skills'],
      ['dest_sub=".cursor/skills"', "dest_sub='.cursor/skills'"],
    ]],
    ['case "${tool}"', [['case "$tool" in', 'case "${tool}" in']]],
    ['a spaced usage list', [
      ['<kiro|claude-code|copilot|cursor|codex>', '<kiro | claude-code | copilot | cursor | codex>'],
    ]],
  ])('reads the bash helper template with %s', (_, edits) => {
    expect(registryDriftFindings(repositoryInputs({ bash: edited(BASH_TEMPLATE, edits) }))).toEqual([])
  })

  it.each([
    ['runs of spaces and tabs, and trailing whitespace', [
      ["  'kiro' = '.kiro/skills'", "\t'kiro'        =\t'.kiro/skills'  \t"],
      ["  'cursor' = '.cursor/skills'", "    'cursor' = '.cursor/skills' "],
    ]],
    ['[string] $Tool and a multi-line ValidateSet', [
      ["[ValidateSet('kiro', 'claude-code', ", "[ValidateSet(\n    'kiro',\n    'claude-code',\n    "],
      ['[string]$Tool', '[string] $Tool'],
    ]],
    ['an [ordered] table', [['$DestinationByTool = @{', '$DestinationByTool = [ordered]@{']]],
    ['a spaced [ordered] table', [['$DestinationByTool = @{', '$DestinationByTool  =  [ordered] @{']]],
  ])('reads the PowerShell helper template with %s', (_, edits) => {
    const powerShell = edited(POWERSHELL_TEMPLATE, edits)
    expect(registryDriftFindings(repositoryInputs({ powerShell }))).toEqual([])
  })

  it.each([
    ['a single-quoted root', "  zed) dest_sub='.zed/skills' ;;\n"],
    ['a tab-indented arm', '\tzed)\tdest_sub=".zed/skills" ;;\n'],
  ])('reads an extra bash arm with %s', (_, arm) => {
    const bash = edited(BASH_TEMPLATE, [[CODEX_ARM, `${CODEX_ARM}${arm}`]])
    expect(registryDriftFindings(repositoryInputs({ bash }))).toEqual([
      'add-skills.sh --tool cases has unexpected zed',
    ])
  })

  it('reads an extra PowerShell row with a 4-space indent', () => {
    const powerShell = edited(POWERSHELL_TEMPLATE, [[CODEX_ROW, `${CODEX_ROW}    'zed' = '.zed/skills'\n`]])
    expect(registryDriftFindings(repositoryInputs({ powerShell }))).toEqual([
      'add-skills.ps1 DestinationByTool keys has unexpected zed',
    ])
  })

  it.each([
    ['a multi-line arm', [[CODEX_ARM, `${CODEX_ARM}  zed)\n    dest_sub=".zed/skills"\n    ;;\n`]],
      `line ${CODEX_ARM_LINE + 1}: unparsed case arm: zed)`],
    ['a quoted label', [[CODEX_ARM, `${CODEX_ARM}  "zed") dest_sub=".zed/skills" ;;\n`]],
      `line ${CODEX_ARM_LINE + 1}: unparsed case arm: "zed")`],
    ['an alternation', [['  codex) dest_sub', '  codex|zed) dest_sub']],
      `line ${CODEX_ARM_LINE}: unparsed case arm: codex|zed)`],
    ['a dest_sub assignment after the case block', [['\nERRORS=()', '\n[ "$tool" = zed ] && dest_sub=".zed/skills"\nERRORS=()']],
      `line ${lineOf(BASH_TEMPLATE, 'ERRORS=()')}: dest_sub assigned outside the case block`],
    ['a usage entry it cannot read', [['|codex>', '|codex|"zed">']],
      `line ${lineOf(BASH_TEMPLATE, '--tool <')}: unparsed --tool usage list`],
  ])('refuses to read the bash helper template with %s', (_, edits, message) => {
    const bash = edited(BASH_TEMPLATE, edits)
    expect(() => repositoryInputs({ bash })).toThrow(`add-skills.template.sh ${message}`)
  })

  it.each([
    ['a double-quoted ValidateSet value', [["'cursor', 'codex')]", `'cursor', 'codex', "zed")]`]],
      `line ${VALIDATE_SET_LINE}: unparsed ValidateSet`],
    ['a double-quoted key', [[CODEX_ROW, `${CODEX_ROW}  "zed" = '.zed/skills'\n`]],
      `line ${CODEX_ROW_LINE + 1}: unparsed $DestinationByTool row: "zed" = '.zed/skills'`],
    ['a bare key', [[CODEX_ROW, `${CODEX_ROW}  zed = '.zed/skills'\n`]],
      `line ${CODEX_ROW_LINE + 1}: unparsed $DestinationByTool row: zed = '.zed/skills'`],
    ['an index assignment', [['\n$script:Errors = ', "\n$DestinationByTool['zed'] = '.zed/skills'\n$script:Errors = "]],
      `line ${ERRORS_LINE}: $DestinationByTool assigned outside its table`],
    ['an Add call', [['\n$script:Errors = ', "\n$destinationByTool.Add('zed', '.zed/skills')\n$script:Errors = "]],
      `line ${ERRORS_LINE}: $DestinationByTool assigned outside its table`],
    ['a second table', [['\n$script:Errors = ', "\n$DestinationByTool = @{ 'zed' = '.zed/skills' }\n$script:Errors = "]],
      `line ${ERRORS_LINE}: $DestinationByTool assigned outside its table`],
  ])('refuses to read the PowerShell helper template with %s', (_, edits, message) => {
    const powerShell = edited(POWERSHELL_TEMPLATE, edits)
    expect(() => repositoryInputs({ powerShell })).toThrow(`add-skills.template.ps1 ${message}`)
  })
})
