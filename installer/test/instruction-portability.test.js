import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getAdapter, listAdapterIds } from '../src/adapters/index.js'
import { listPacks } from '../src/build-all.js'
import { resolveInstructionBody } from '../src/instructions/compose.js'
import { loadManifest } from '../src/manifest.js'
import { buildPlan } from '../src/plan.js'
import { renderInstructions } from '../src/render/instructions.js'
import { resolveWorkspace } from '../src/workspace.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const packsRoot = join(repoRoot, 'packs')
const tools = listAdapterIds()

const sources = [
  {
    pack: 'agentic-ai-workflow',
    file: 'aidlc-workflow.md',
    state: 15,
    spec: 5,
    instructions: { 'reverse-engineering.md': 2 },
  },
  {
    pack: 'agentic-incident-response',
    file: 'aidlc-workflow.md',
    state: 11,
    spec: 1,
    instructions: { 'reverse-engineering.md': 1 },
  },
  {
    pack: 'api-platform-migration-n-modernization',
    file: 'aidlc-workflow.md',
    state: 12,
    spec: 0,
    instructions: { 'reverse-engineering.md': 2 },
  },
  {
    pack: 'cots-rewrite-on-cloudnative',
    file: 'aidlc-workflow.md',
    state: 11,
    spec: 1,
    instructions: {
      'reverse-engineering.md': 1,
      'requirements-traceability.md': 3,
    },
  },
  {
    pack: 'cots-rewrite-on-cloudnative',
    file: 'reverse-engineering.md',
    state: 15,
    spec: 0,
    instructions: { 'requirements-traceability.md': 1 },
  },
  {
    pack: 'dotnet-app-modernization-on-aws',
    file: 'aidlc-workflow.md',
    state: 12,
    spec: 1,
    instructions: {
      'reverse-engineering.md': 4,
      'skill-activation.md': 1,
    },
  },
  {
    pack: 'dotnet-app-modernization-on-aws',
    file: 'reverse-engineering.md',
    state: 17,
    spec: 0,
    instructions: {},
  },
  {
    pack: 'framework-upgrade-containerise',
    file: 'aidlc-workflow.md',
    state: 14,
    spec: 2,
    instructions: { 'reverse-engineering.md': 3 },
  },
  {
    pack: 'framework-upgrade-containerise',
    file: 'reverse-engineering.md',
    state: 4,
    spec: 0,
    instructions: {},
  },
  {
    pack: 'framework-upgrade-containerise',
    file: 'skill-activation.md',
    state: 1,
    spec: 0,
    instructions: {},
  },
  {
    pack: 'genai-on-serverless',
    file: 'aidlc-workflow.md',
    state: 10,
    spec: 1,
    instructions: { 'reverse-engineering.md': 1 },
  },
  {
    pack: 'ocr-mobile-app-on-serverless',
    file: 'aidlc-workflow.md',
    state: 10,
    spec: 1,
    instructions: {},
  },
  {
    pack: 'voice-ai-agent-on-aws',
    file: 'aidlc-workflow.md',
    state: 10,
    spec: 1,
    instructions: { 'reverse-engineering.md': 1 },
  },
  {
    pack: 'vulnerability-remediation-pipeline',
    file: 'aidlc-workflow.md',
    state: 10,
    spec: 1,
    instructions: { 'reverse-engineering.md': 1 },
  },
]

const multiRepoSources = [
  {
    pack: 'web-app-on-cloudnative',
    file: 'aidlc-workflow.md',
    state: 14,
    spec: 1,
    instructions: {
      'multi-repo-projects.md': 3,
      'reverse-engineering.md': 1,
    },
  },
  {
    pack: 'web-app-on-cloudnative',
    file: 'multi-repo-projects.md',
    state: 10,
    spec: 7,
    instructions: { 'aidlc-workflow.md': 4 },
  },
  {
    pack: 'serverless-event-driven-on-aws',
    file: 'aidlc-workflow.md',
    state: 16,
    spec: 1,
    instructions: {
      'practices-discovery.md': 4,
      'multi-repo-projects.md': 2,
      'reverse-engineering.md': 1,
    },
  },
  {
    pack: 'serverless-event-driven-on-aws',
    file: 'multi-repo-projects.md',
    state: 10,
    spec: 8,
    instructions: { 'aidlc-workflow.md': 2 },
  },
  {
    pack: 'serverless-event-driven-on-aws',
    file: 'practices-discovery.md',
    state: 4,
    spec: 0,
    instructions: { 'aidlc-workflow.md': 1 },
  },
]

const packNames = [...new Set(sources.map(({ pack }) => pack))]
const multiRepoPackNames = [
  ...new Set(multiRepoSources.map(({ pack }) => pack)),
]
const allPackNames = listPacks(packsRoot)
const packDir = (pack) => join(repoRoot, 'packs', pack)
const manifestFor = (pack) => loadManifest(packDir(pack))
const declaredTools = (manifest) =>
  manifest.schemaVersion === 2 ? manifest.distribution.targets : tools
const allPackToolCases = allPackNames.flatMap((pack) => {
  const manifest = manifestFor(pack)
  return declaredTools(manifest).map((tool) => ({ pack, tool }))
})
const count = (text, needle) => text.split(needle).length - 1
const portable = (path) => path.split(sep).join('/')
const ownedToken = /\{\{(?:SPEC_DIR|STATE_DIR|INSTRUCTION:[^}]+)\}\}/
const fixedWorkflowRoot =
  /aidlc-docs|aidlc-specs|\.kiro\/specs|\.kiro\/steering|\.claude\/specs|\.cursor\/specs|\.github\/specs|\.codex\/specs|aidlc-decisions-workflow\.md/

function nativeInstructionPath(manifest, tool, file) {
  const instruction = manifest.instructions.find((item) => item.file === file)
  expect(instruction, `${manifest.name}: declared instruction ${file}`).toBeDefined()
  const paths = getAdapter(tool).instructions
  return instruction.role === 'primary'
    ? paths.primaryPath(file)
    : paths.companionPath(file)
}

function privateInstructionRoot(tool) {
  return portable(
    dirname(getAdapter(tool).instructions.companionPath('__ramp__.md')),
  )
}

function instructionTokenCounts(content) {
  const result = new Map()
  for (const match of content.matchAll(/\{\{INSTRUCTION:([^}]+)\}\}/g)) {
    result.set(match[1], (result.get(match[1]) ?? 0) + 1)
  }
  return result
}

function renderedSource(expectation, tool, workspace) {
  const manifest = manifestFor(expectation.pack)
  const writes = renderInstructions(
    manifest,
    packDir(expectation.pack),
    tool,
    workspace,
  )
  const path = nativeInstructionPath(manifest, tool, expectation.file)
  const write = writes.find((candidate) => candidate.path === path)
  expect(write, `${expectation.pack}/${expectation.file} for ${tool}`).toBeDefined()
  return write.content
}

function expectNativeReferences(content, expectation, manifest, tool) {
  for (const [file, expected] of Object.entries(expectation.instructions)) {
    const native = nativeInstructionPath(manifest, tool, file)
    expect(
      count(content, native),
      `${expectation.pack}/${expectation.file}: ${tool} native ${file}`,
    ).toBeGreaterThanOrEqual(expected)

    for (const otherTool of tools) {
      if (otherTool === tool) continue
      const other = nativeInstructionPath(manifest, otherTool, file)
      if (other === native) continue
      expect(
        content,
        `${expectation.pack}/${expectation.file}: no ${otherTool} ${file}`,
      ).not.toContain(other)
    }
  }
}

describe('single-repository neutral instruction portability', () => {
  it('owns the complete 152 state, 14 spec, and 21 companion migrations', () => {
    let state = 0
    let spec = 0
    let instructions = 0

    for (const expectation of sources) {
      const manifest = manifestFor(expectation.pack)
      const content = resolveInstructionBody(
        manifest,
        packDir(expectation.pack),
        expectation.file,
      )

      state += count(content, '{{STATE_DIR}}')
      spec += count(content, '{{SPEC_DIR}}')
      instructions += count(content, '{{INSTRUCTION:')
    }

    expect({ state, spec, instructions }).toEqual({
      state: 152,
      spec: 14,
      instructions: 21,
    })
  })

  it.each(sources)(
    '$pack/$file has the complete owned-token migration',
    (expectation) => {
      const manifest = manifestFor(expectation.pack)
      const content = resolveInstructionBody(
        manifest,
        packDir(expectation.pack),
        expectation.file,
      )

      expect(count(content, '{{STATE_DIR}}')).toBe(expectation.state)
      expect(count(content, '{{SPEC_DIR}}')).toBe(expectation.spec)
      expect(content).not.toMatch(/aidlc-docs|aidlc-specs/)

      for (const [file, expected] of Object.entries(expectation.instructions)) {
        const token = `{{INSTRUCTION:${file}}}`
        expect(count(content, token)).toBe(expected)
        expect(content.split(token).join('')).not.toContain(file)
      }
    },
  )

  it('uses only tokenized logical companions in COTS sources', () => {
    const manifest = manifestFor('cots-rewrite-on-cloudnative')
    const content = [
      resolveInstructionBody(
        manifest,
        packDir('cots-rewrite-on-cloudnative'),
        'aidlc-workflow.md',
      ),
      resolveInstructionBody(
        manifest,
        packDir('cots-rewrite-on-cloudnative'),
        'reverse-engineering.md',
      ),
    ].join('\n')

    expect(content).not.toMatch(/`reverse-engineering`/)
    expect(content).not.toMatch(/`requirements-traceability`/)
  })

  it('uses the selected spec root for both framework-upgrade references', () => {
    const manifest = manifestFor('framework-upgrade-containerise')
    const content = resolveInstructionBody(
      manifest,
      packDir('framework-upgrade-containerise'),
      'aidlc-workflow.md',
    )

    expect(count(content, '{{SPEC_DIR}}/upgrade-containerisation/')).toBe(2)
    expect(content.split('{{SPEC_DIR}}/upgrade-containerisation/').join(''))
      .not.toContain('upgrade-containerisation/')
  })
})

describe.each(packNames)('custom workspace portability: %s', (pack) => {
  const expectations = sources.filter((candidate) => candidate.pack === pack)
  const manifest = manifestFor(pack)
  const directory = packDir(pack)

  it.each(tools)('renders all instructions for %s without fixed roots', (tool) => {
    const workspace = resolveWorkspace(manifest, {
      tools: [tool],
      specRoot: 'shared-specs',
      stateRoot: 'shared-aidlc-state',
    })
    const writes = renderInstructions(manifest, directory, tool, workspace)

    for (const write of writes) {
      expect(write.content).not.toMatch(ownedToken)
      expect(write.content).not.toMatch(/aidlc-docs|aidlc-specs/)
      expect(write.content).not.toContain('.kiro/specs/')

      const withoutCustomSpecRoot = write.content
        .split('shared-specs/<spec-name>/')
        .join('')
      expect(withoutCustomSpecRoot).not.toContain('specs/<spec-name>/')

      const withoutCustomUpgrade = write.content
        .split('shared-specs/upgrade-containerisation/')
        .join('')
      expect(withoutCustomUpgrade).not.toContain('upgrade-containerisation/')

      for (const otherTool of tools) {
        if (otherTool === tool) continue
        expect(write.content).not.toContain(`${privateInstructionRoot(otherTool)}/`)
      }
    }

    for (const expectation of expectations) {
      const content = renderedSource(expectation, tool, workspace)
      expect(count(content, 'shared-aidlc-state')).toBe(expectation.state)
      expect(count(content, 'shared-specs')).toBe(expectation.spec)
      expectNativeReferences(content, expectation, manifest, tool)
    }
  })
})

describe.each(packNames)('standalone workspace defaults: %s', (pack) => {
  const expectations = sources.filter((candidate) => candidate.pack === pack)
  const manifest = manifestFor(pack)

  it.each(tools)('uses the %s standalone roots', (tool) => {
    const workspace = resolveWorkspace(manifest, { tools: [tool] })

    for (const expectation of expectations) {
      const content = renderedSource(expectation, tool, workspace)
      expect(count(content, 'aidlc-docs')).toBe(expectation.state)
      const specRoot = tool === 'kiro' ? '.kiro/specs' : 'specs'
      expect(count(content, `${specRoot}/`)).toBe(expectation.spec)
      if (tool !== 'kiro') expect(content).not.toContain('.kiro/specs')
      expectNativeReferences(content, expectation, manifest, tool)
    }
  })
})

describe.each(packNames)('shared workspace defaults: %s', (pack) => {
  const expectations = sources.filter((candidate) => candidate.pack === pack)
  const manifest = manifestFor(pack)

  it.each([
    [['kiro', 'claude-code'], '.kiro/specs'],
    [['claude-code', 'cursor'], 'specs'],
  ])('shares %s roots at %s', (participants, specRoot) => {
    const workspace = resolveWorkspace(manifest, { tools: participants })

    for (const tool of participants) {
      for (const expectation of expectations) {
        const content = renderedSource(expectation, tool, workspace)
        expect(count(content, 'aidlc-docs')).toBe(expectation.state)
        expect(count(content, `${specRoot}/`)).toBe(expectation.spec)
        expectNativeReferences(content, expectation, manifest, tool)
      }
    }
  })
})

describe('multi-repository neutral instruction portability', () => {
  it.each(multiRepoSources)(
    '$pack/$file owns every workflow path and native instruction reference',
    (expectation) => {
      const manifest = manifestFor(expectation.pack)
      const content = resolveInstructionBody(
        manifest,
        packDir(expectation.pack),
        expectation.file,
      )

      expect(count(content, '{{STATE_DIR}}')).toBe(expectation.state)
      expect(count(content, '{{SPEC_DIR}}')).toBe(expectation.spec)
      expect(content).not.toMatch(fixedWorkflowRoot)

      for (const [file, expected] of Object.entries(expectation.instructions)) {
        const token = `{{INSTRUCTION:${file}}}`
        expect(count(content, token)).toBe(expected)
        expect(content.split(token).join('')).not.toContain(file)
      }
    },
  )
})

describe.each(multiRepoPackNames)(
  'multi-repository custom workspace portability: %s',
  (pack) => {
    const expectations = multiRepoSources.filter(
      (candidate) => candidate.pack === pack,
    )
    const manifest = manifestFor(pack)
    const directory = packDir(pack)

    it.each(tools)(
      'renders all %s instructions into custom roots and native paths',
      (tool) => {
        const workspace = resolveWorkspace(manifest, {
          tools: [tool],
          specRoot: 'company-specs',
          stateRoot: 'delivery-state',
        })
        const writes = renderInstructions(manifest, directory, tool, workspace)

        for (const write of writes) {
          expect(write.content).not.toMatch(ownedToken)
          expect(write.content).not.toMatch(
            /aidlc-docs|aidlc-specs|\.kiro\/specs|\.claude\/specs|\.cursor\/specs|\.github\/specs|\.codex\/specs/,
          )

          for (const otherTool of tools) {
            if (otherTool === tool) continue
            expect(write.content).not.toContain(
              `${privateInstructionRoot(otherTool)}/`,
            )
          }
        }

        for (const expectation of expectations) {
          const content = renderedSource(expectation, tool, workspace)
          expect(count(content, 'company-specs')).toBe(expectation.spec)
          expect(count(content, 'delivery-state')).toBe(expectation.state)
          expectNativeReferences(content, expectation, manifest, tool)
        }

        const multiRepo = renderedSource(
          expectations.find(
            (expectation) => expectation.file === 'multi-repo-projects.md',
          ),
          tool,
          workspace,
        )
        expect(multiRepo).toContain('company-specs/_platform/')
        expect(multiRepo).toContain('company-specs/<repo>/')
        expect(multiRepo).toContain('delivery-state/_platform/')
        expect(multiRepo).toContain('delivery-state/<repo>/')
        expect(multiRepo).toMatch(
          /resolved specification root \(`company-specs\/`\) and\s+state root \(`delivery-state\/`\)/,
        )
        expect(multiRepo).not.toMatch(
          /resolved `?company-specs\/<repo>\/`? specification/,
        )

        if (pack === 'serverless-event-driven-on-aws' && tool === 'copilot') {
          const practices = renderedSource(
            expectations.find(
              (expectation) => expectation.file === 'practices-discovery.md',
            ),
            tool,
            workspace,
          )
          expect(practices).toContain(
            "in the resolved team-practices state file.",
          )
        }
      },
    )
  },
)

describe.each(multiRepoPackNames)(
  'multi-repository standalone workspace defaults: %s',
  (pack) => {
    const expectation = multiRepoSources.find(
      (candidate) =>
        candidate.pack === pack &&
        candidate.file === 'multi-repo-projects.md',
    )
    const manifest = manifestFor(pack)

    it.each(tools)(
      'uses the %s standalone roots with native references',
      (tool) => {
        const workspace = resolveWorkspace(manifest, { tools: [tool] })
        const content = renderedSource(expectation, tool, workspace)
        const specRoot = tool === 'kiro' ? '.kiro/specs' : 'specs'

        expect(content).toContain(`${specRoot}/_platform/`)
        expect(content).toContain(`${specRoot}/<repo>/`)
        expect(content).toContain('aidlc-docs/_platform/')
        expect(content).toContain('aidlc-docs/<repo>/')
        if (tool !== 'kiro') expect(content).not.toContain('.kiro/specs')
        expectNativeReferences(content, expectation, manifest, tool)
      },
    )
  },
)

describe.each(multiRepoPackNames)(
  'multi-repository shared workspace defaults: %s',
  (pack) => {
    const expectation = multiRepoSources.find(
      (candidate) =>
        candidate.pack === pack &&
        candidate.file === 'multi-repo-projects.md',
    )
    const manifest = manifestFor(pack)

    it.each([
      [['kiro', 'claude-code'], '.kiro/specs'],
      [['claude-code', 'cursor'], 'specs'],
    ])('shares %s roots at %s while keeping native references', (
      participants,
      specRoot,
    ) => {
      const workspace = resolveWorkspace(manifest, { tools: participants })

      for (const tool of participants) {
        const content = renderedSource(expectation, tool, workspace)
        expect(content).toContain(`${specRoot}/_platform/`)
        expect(content).toContain(`${specRoot}/<repo>/`)
        expect(content).toContain('aidlc-docs/_platform/')
        expect(content).toContain('aidlc-docs/<repo>/')
        if (!participants.includes('kiro')) {
          expect(content).not.toContain('.kiro/specs')
        }
        expect(content).not.toMatch(
          /\.claude\/specs|\.cursor\/specs|\.github\/specs|\.codex\/specs/,
        )
        expectNativeReferences(content, expectation, manifest, tool)
      }
    })
  },
)

describe.each(allPackToolCases)(
  'all-pack custom portability: $pack / $tool',
  ({ pack, tool }) => {
    const manifest = manifestFor(pack)
    const directory = packDir(pack)

    it('renders every declared instruction with owned roots and native references', () => {
      const workspace = resolveWorkspace(manifest, {
        tools: [tool],
        specRoot: 'portable-specs',
        stateRoot: 'portable-state',
      })
      const writes = renderInstructions(manifest, directory, tool, workspace)

      for (const instruction of manifest.instructions) {
        const source = resolveInstructionBody(
          manifest,
          directory,
          instruction.file,
        )
        const renderedPath = nativeInstructionPath(
          manifest,
          tool,
          instruction.file,
        )
        const write = writes.find((candidate) => candidate.path === renderedPath)
        expect(write, `${pack}/${tool}: rendered ${renderedPath}`).toBeDefined()
        const content = write.content

        expect(content, `${pack}/${tool}/${renderedPath}: owned token`).not.toMatch(
          ownedToken,
        )
        expect(
          content,
          `${pack}/${tool}/${renderedPath}: fixed workflow root`,
        ).not.toMatch(/aidlc-docs|aidlc-specs/)

        for (const otherTool of tools) {
          if (otherTool === tool) continue
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: no ${otherTool} private root`,
          ).not.toContain(`${privateInstructionRoot(otherTool)}/`)
        }

        if (source.includes('{{SPEC_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: custom spec root`,
          ).toContain('portable-specs')
        }
        if (source.includes('{{STATE_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: custom state root`,
          ).toContain('portable-state')
        }

        for (const [file, expected] of instructionTokenCounts(source)) {
          const native = nativeInstructionPath(manifest, tool, file)
          expect(
            count(content, native),
            `${pack}/${tool}/${renderedPath}: native ${file}`,
          ).toBeGreaterThanOrEqual(expected)

          for (const otherTool of tools) {
            if (otherTool === tool) continue
            const other = nativeInstructionPath(manifest, otherTool, file)
            if (other === native) continue
            expect(
              content,
              `${pack}/${tool}/${renderedPath}: no ${otherTool} ${file}`,
            ).not.toContain(other)
          }
        }

        expect(
          content.split('portable-specs/decomposition-plan/').join(''),
          `${pack}/${tool}/${renderedPath}: decomposition plan root`,
        ).not.toContain('decomposition-plan/')
        expect(
          content.split('portable-specs/upgrade-containerisation/').join(''),
          `${pack}/${tool}/${renderedPath}: upgrade spec root`,
        ).not.toContain('upgrade-containerisation/')
      }
    })
  },
)

describe.each(allPackToolCases)(
  'all-pack standalone defaults: $pack / $tool',
  ({ pack, tool }) => {
    const manifest = manifestFor(pack)
    const directory = packDir(pack)

    it('uses the adapter standalone root for every source-owned path', () => {
      const workspace = resolveWorkspace(manifest, { tools: [tool] })
      const writes = renderInstructions(manifest, directory, tool, workspace)
      const specRoot = tool === 'kiro' ? '.kiro/specs' : 'specs'

      for (const instruction of manifest.instructions) {
        const source = resolveInstructionBody(
          manifest,
          directory,
          instruction.file,
        )
        const renderedPath = nativeInstructionPath(
          manifest,
          tool,
          instruction.file,
        )
        const content = writes.find(
          (candidate) => candidate.path === renderedPath,
        )?.content
        expect(content, `${pack}/${tool}: rendered ${renderedPath}`).toBeDefined()

        if (source.includes('{{SPEC_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: standalone spec root`,
          ).toContain(`${specRoot}/`)
        }
        if (source.includes('{{STATE_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: standalone state root`,
          ).toContain('aidlc-docs')
        }
        if (tool !== 'kiro') {
          expect(content, `${pack}/${tool}/${renderedPath}: no Kiro root`)
            .not.toContain('.kiro/specs')
        }
      }
    })
  },
)

describe.each(allPackNames)('all-pack shared defaults: %s', (pack) => {
  const manifest = manifestFor(pack)
  const directory = packDir(pack)

  it.each([
    [['kiro', 'claude-code'], '.kiro/specs'],
    [['claude-code', 'cursor'], 'specs'],
  ])('shares %s at %s for every source-owned path', (participants, specRoot) => {
    if (!participants.every((tool) => declaredTools(manifest).includes(tool))) {
      return
    }
    const workspace = resolveWorkspace(manifest, { tools: participants })

    for (const tool of participants) {
      const writes = renderInstructions(manifest, directory, tool, workspace)
      for (const instruction of manifest.instructions) {
        const source = resolveInstructionBody(
          manifest,
          directory,
          instruction.file,
        )
        const renderedPath = nativeInstructionPath(
          manifest,
          tool,
          instruction.file,
        )
        const content = writes.find(
          (candidate) => candidate.path === renderedPath,
        )?.content
        expect(content, `${pack}/${tool}: rendered ${renderedPath}`).toBeDefined()

        if (source.includes('{{SPEC_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: shared spec root`,
          ).toContain(`${specRoot}/`)
        }
        if (source.includes('{{STATE_DIR}}')) {
          expect(
            content,
            `${pack}/${tool}/${renderedPath}: shared state root`,
          ).toContain('aidlc-docs')
        }
        if (!participants.includes('kiro')) {
          expect(content, `${pack}/${tool}/${renderedPath}: no Kiro root`)
            .not.toContain('.kiro/specs')
        }
      }
    }
  })
})

describe('COTS root-neutral launchers', () => {
  const pack = 'cots-rewrite-on-cloudnative'
  const manifest = manifestFor(pack)
  const directory = packDir(pack)

  it.each(['claude-code', 'copilot'])(
    'defers %s paths to the primary instructions',
    (tool) => {
      const workspace = resolveWorkspace(manifest, {
        tools: [tool],
        specRoot: 'shared-specs',
        stateRoot: 'shared-aidlc-state',
      })
      const plan = buildPlan(directory, tool, {
        includeSkills: false,
        workspace,
      })
      const launcherPath = getAdapter(tool).command.path(manifest.command.name)
      const launcher = plan.find((entry) => entry.path === launcherPath)

      expect(launcher).toBeDefined()
      expect(launcher.content).toContain(
        'resolved state and audit paths defined by the primary instructions',
      )
      expect(launcher.content).not.toContain('aidlc-docs')
      expect(launcher.content).not.toMatch(ownedToken)
    },
  )
})
