import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resolveInstructionBody,
} from '../src/instructions/compose.js'
import {
  applyInstructionTokens,
} from '../src/instructions/tokens.js'

const defaultManifest = {
  instructions: [
    { file: 'aidlc-workflow.md', role: 'primary', load: 'always' },
    { file: 'reverse-engineering.md', role: 'companion', load: 'auto' },
  ],
  workflow: {
    provider: 'local-instructions-v1',
    overlays: [],
  },
}

function fixture({
  localBase,
  commonBase,
  overlays = {},
  manifest = defaultManifest,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-compose-'))
  const packDir = join(root, 'packs', 'demo')
  mkdirSync(join(packDir, 'instructions'), { recursive: true })
  mkdirSync(join(root, 'common', 'instructions'), { recursive: true })
  mkdirSync(join(root, 'workflow-overlays'), { recursive: true })

  if (localBase !== undefined) {
    writeFileSync(join(packDir, 'instructions', 'aidlc-workflow.md'), localBase)
  }
  if (commonBase !== undefined) {
    writeFileSync(join(root, 'common', 'instructions', 'aidlc-workflow.md'), commonBase)
  }
  for (const [name, content] of Object.entries(overlays)) {
    writeFileSync(join(root, 'workflow-overlays', name), content)
  }

  return { packDir, manifest }
}

function overlay({
  id = 'demo-replacement',
  target = 'aidlc-workflow.md',
  replaces = ['entry'],
  extraFrontmatter = '',
  body = `<!-- RAMP:SLOT entry START -->
replacement entry
<!-- RAMP:SLOT entry END -->
`,
} = {}) {
  return `---
id: ${id}
target: ${target}
purpose: Replace one named workflow section for this fixture.
replaces:
${replaces.map((name) => `  - ${name}`).join('\n')}
${extraFrontmatter}---

${body}`
}

describe('resolveInstructionBody', () => {
  it('applies declared overlays in named slots and removes slot markers', () => {
    const manifest = {
      ...defaultManifest,
      workflow: {
        provider: 'local-instructions-v1',
        overlays: ['demo-replacement.md'],
      },
    }
    const { packDir } = fixture({
      localBase: `Before
<!-- RAMP:SLOT entry START -->
default entry
<!-- RAMP:SLOT entry END -->
After
`,
      overlays: { 'demo-replacement.md': overlay() },
      manifest,
    })

    const content = resolveInstructionBody(manifest, packDir, 'aidlc-workflow.md')

    expect(content).toContain('replacement entry')
    expect(content).not.toContain('default entry')
    expect(content).not.toContain('RAMP:SLOT')
    expect(content).toBe('Before\nreplacement entry\nAfter\n')
  })

  it('resolves pack-local instructions before common defaults', () => {
    const { packDir, manifest } = fixture({
      localBase: 'PACK LOCAL',
      commonBase: 'COMMON DEFAULT',
    })

    expect(resolveInstructionBody(manifest, packDir, 'aidlc-workflow.md')).toBe(
      'PACK LOCAL\n',
    )
  })

  it('returns marker-free base content unchanged when no overlay matches', () => {
    const { packDir, manifest } = fixture({
      commonBase: `Before
<!-- RAMP:SLOT entry START -->
default entry
<!-- RAMP:SLOT entry END -->
After
`,
    })

    expect(resolveInstructionBody(manifest, packDir, 'aidlc-workflow.md')).toBe(
      'Before\ndefault entry\nAfter\n',
    )
  })

  it.each([
    [
      'a declared slot missing from the base',
      'No slots here',
      { 'demo-replacement.md': overlay() },
      ['demo-replacement.md'],
      /slot.*entry.*base|base.*slot.*entry/i,
    ],
    [
      'a declared replacement missing its overlay block',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay({
          body: `<!-- RAMP:SLOT another START -->
replacement
<!-- RAMP:SLOT another END -->
`,
        }),
      },
      ['demo-replacement.md'],
      /slot.*entry.*overlay|overlay.*slot.*entry/i,
    ],
    [
      'duplicate base slot blocks',
      `<!-- RAMP:SLOT entry START -->
one
<!-- RAMP:SLOT entry END -->
<!-- RAMP:SLOT entry START -->
two
<!-- RAMP:SLOT entry END -->`,
      { 'demo-replacement.md': overlay() },
      ['demo-replacement.md'],
      /duplicate.*slot.*entry/i,
    ],
    [
      'duplicate replacement across overlays',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay(),
        'second-replacement.md': overlay({ id: 'second-replacement' }),
      },
      ['demo-replacement.md', 'second-replacement.md'],
      /duplicate.*replacement.*entry|entry.*already.*replaced/i,
    ],
    [
      'an overlay target not declared by the pack',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay({ target: 'not-declared.md' }),
      },
      ['demo-replacement.md'],
      /target.*declared.*not-declared|undeclared.*target/i,
    ],
    [
      'an id that differs from the filename',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay({ id: 'different-id' }),
      },
      ['demo-replacement.md'],
      /filename.*demo-replacement.*different-id|id.*filename/i,
    ],
    [
      'an unknown frontmatter key',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay({ extraFrontmatter: 'unexpected: true\n' }),
      },
      ['demo-replacement.md'],
      /unknown.*unexpected|unexpected.*frontmatter/i,
    ],
    [
      'stray markdown outside declared blocks',
      `<!-- RAMP:SLOT entry START -->
default
<!-- RAMP:SLOT entry END -->`,
      {
        'demo-replacement.md': overlay({
          body: `Stray prose
<!-- RAMP:SLOT entry START -->
replacement
<!-- RAMP:SLOT entry END -->
`,
        }),
      },
      ['demo-replacement.md'],
      /outside.*slot|stray/i,
    ],
  ])(
    'rejects %s',
    (_name, base, overlays, overlayNames, message) => {
      const manifest = {
        ...defaultManifest,
        workflow: {
          provider: 'local-instructions-v1',
          overlays: overlayNames,
        },
      }
      const { packDir } = fixture({ localBase: base, overlays, manifest })

      expect(() =>
        resolveInstructionBody(manifest, packDir, 'aidlc-workflow.md'),
      ).toThrow(message)
    },
  )

  it('rejects an unsafe overlay path before reading outside the repository asset root', () => {
    const manifest = {
      ...defaultManifest,
      workflow: {
        provider: 'local-instructions-v1',
        overlays: ['../outside.md'],
      },
    }
    const { packDir } = fixture({ localBase: 'base', manifest })

    expect(() =>
      resolveInstructionBody(manifest, packDir, 'aidlc-workflow.md'),
    ).toThrow(/overlay.*safe|unsafe.*overlay|traversal/i)
  })
})

describe('applyInstructionTokens', () => {
  it.each([
    ['kiro', '.kiro/steering/reverse-engineering.md'],
    ['claude-code', '.claude/rules/reverse-engineering.md'],
    ['copilot', '.github/instructions/reverse-engineering.instructions.md'],
    ['cursor', '.cursor/rules/reverse-engineering.mdc'],
  ])('resolves native instruction references for %s', (tool, nativePath) => {
    const content = applyInstructionTokens(
      `Load {{INSTRUCTION:reverse-engineering.md}}.
Specs: {{SPEC_DIR}}/demo/
State: {{STATE_DIR}}/aidlc-state.md
`,
      {
        manifest: defaultManifest,
        tool,
        workspace: {
          tools: [tool],
          specRoot: 'shared-specs',
          stateRoot: 'shared-state',
        },
      },
    )

    expect(content).toBe(
      `Load ${nativePath}.
Specs: shared-specs/demo/
State: shared-state/aidlc-state.md
`,
    )
  })

  it('rejects an instruction token that is not declared by the manifest', () => {
    expect(() =>
      applyInstructionTokens('{{INSTRUCTION:missing.md}}', {
        manifest: defaultManifest,
        tool: 'kiro',
        workspace: {
          tools: ['kiro'],
          specRoot: '.kiro/specs',
          stateRoot: 'aidlc-docs',
        },
      }),
    ).toThrow('instruction token references undeclared file: missing.md')
  })

  it.each([
    '{{INSTRUCTION:reverse-engineering.md',
    '{{INSTRUCTION:}}',
    '{{SPEC_DIR}',
    '{SPEC_DIR}}',
    '{{SPEC_DI}}',
    '{{STATE_DIR}',
    '{STATE_DIR}}',
    '{{STATE_DI}}',
  ])('rejects malformed or incomplete owned token syntax: %s', (token) => {
    expect(() =>
      applyInstructionTokens(`Before ${token} after`, {
        manifest: defaultManifest,
        tool: 'kiro',
        workspace: {
          tools: ['kiro'],
          specRoot: '.kiro/specs',
          stateRoot: 'aidlc-docs',
        },
      }),
    ).toThrow(/invalid|malformed|unresolved.*token|token.*unresolved/i)
  })

  it('rejects an owned token that remains after substitution', () => {
    expect(() =>
      applyInstructionTokens('{{SPEC_DIR}}/demo', {
        manifest: defaultManifest,
        tool: 'kiro',
        workspace: {
          tools: ['kiro'],
          specRoot: '{{SPEC_DIR}}',
          stateRoot: 'aidlc-docs',
        },
      }),
    ).toThrow(/unresolved.*SPEC_DIR|SPEC_DIR.*unresolved/i)
  })

  it('preserves unrelated template syntax', () => {
    expect(
      applyInstructionTokens('Keep {{customer_variable}} untouched.', {
        manifest: defaultManifest,
        tool: 'kiro',
        workspace: {
          tools: ['kiro'],
          specRoot: '.kiro/specs',
          stateRoot: 'aidlc-docs',
        },
      }),
    ).toBe('Keep {{customer_variable}} untouched.')
  })

  it.each([
    '{{SPEC_DIFFERENCE}}',
    '{STATE_DIAGRAM}',
    '{{SPEC_DIRECTORY}}',
    '{{INSTRUCTION_SET}}',
  ])('preserves unrelated uppercase lookalike syntax: %s', (token) => {
    expect(
      applyInstructionTokens(`Keep ${token} untouched.`, {
        manifest: defaultManifest,
        tool: 'kiro',
        workspace: {
          tools: ['kiro'],
          specRoot: '.kiro/specs',
          stateRoot: 'aidlc-docs',
        },
      }),
    ).toBe(`Keep ${token} untouched.`)
  })
})
