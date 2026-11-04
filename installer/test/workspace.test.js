import { describe, expect, it } from 'vitest'
import { resolveWorkspace } from '../src/workspace.js'

const v1 = {}
const v2 = {
  schemaVersion: 2,
  distribution: {
    targets: ['kiro', 'claude-code', 'copilot', 'cursor'],
    qualifiedTargets: ['kiro', 'claude-code'],
    profiles: [
      {
        name: 'shared-kiro-claude',
        targets: ['kiro', 'claude-code'],
        workspaceMode: 'shared',
        specRoot: '.kiro/specs',
        stateRoot: 'aidlc-docs',
      },
      {
        name: 'shared-claude-cursor',
        targets: ['claude-code', 'cursor'],
        workspaceMode: 'shared',
      },
    ],
  },
}

describe('resolveWorkspace', () => {
  it('uses Kiro native specs for Kiro alone', () => {
    expect(resolveWorkspace(v1, { tools: ['kiro'] })).toEqual({
      tools: ['kiro'],
      profile: null,
      workspaceMode: 'standalone',
      specRoot: '.kiro/specs',
      stateRoot: 'aidlc-docs',
    })
  })

  it.each(['claude-code', 'copilot', 'cursor'])('uses root specs for standalone %s', (tool) => {
    expect(resolveWorkspace(v1, { tools: [tool] })).toMatchObject({
      tools: [tool],
      workspaceMode: 'standalone',
      specRoot: 'specs',
      stateRoot: 'aidlc-docs',
    })
  })

  it('uses root specs for a shared workspace without Kiro', () => {
    expect(resolveWorkspace(v1, { tools: ['claude-code', 'cursor'] })).toMatchObject({
      workspaceMode: 'shared',
      specRoot: 'specs',
    })
  })

  it('uses Kiro native specs for a shared workspace containing Kiro', () => {
    expect(resolveWorkspace(v1, { tools: ['kiro', 'claude-code'] })).toMatchObject({
      workspaceMode: 'shared',
      specRoot: '.kiro/specs',
    })
  })

  it('accepts safe explicit workspace roots', () => {
    expect(
      resolveWorkspace(v1, {
        tools: ['claude-code', 'cursor'],
        specRoot: 'delivery/specifications',
        stateRoot: '.ramp/state',
      }),
    ).toMatchObject({
      specRoot: 'delivery/specifications',
      stateRoot: '.ramp/state',
    })
  })

  it.each([
    [undefined, /tools.*non-empty/i],
    [[], /tools.*non-empty/i],
    [['kiro', 'kiro'], /duplicate.*kiro/i],
  ])('rejects an invalid tool selection %#', (tools, message) => {
    expect(() => resolveWorkspace(v1, { tools })).toThrow(message)
  })

  it('rejects unknown adapters through the registry', () => {
    expect(() => resolveWorkspace(v1, { tools: ['future-tool'] })).toThrow(
      'unknown tool: future-tool',
    )
  })

  it('allows every registered adapter for v1 manifests', () => {
    expect(() =>
      resolveWorkspace(v1, { tools: ['kiro', 'claude-code', 'copilot', 'cursor'] }),
    ).not.toThrow()
  })

  it('rejects tools not declared by a v2 manifest', () => {
    const restricted = {
      schemaVersion: 2,
      distribution: { targets: ['kiro'], qualifiedTargets: ['kiro'], profiles: [] },
    }
    expect(() => resolveWorkspace(restricted, { tools: ['claude-code'] })).toThrow(
      /not declared.*claude-code|claude-code.*not declared/i,
    )
  })

  it('rejects an unknown workspace profile', () => {
    expect(() =>
      resolveWorkspace(v2, { tools: ['kiro'], profile: 'missing' }),
    ).toThrow('unknown workspace profile: missing')
  })

  it('rejects requested tools outside the selected profile', () => {
    expect(() =>
      resolveWorkspace(v2, {
        tools: ['kiro', 'cursor'],
        profile: 'shared-kiro-claude',
      }),
    ).toThrow(/profile.*cursor|cursor.*profile/i)
  })

  it('derives a single projected artifact from every target in its shared profile', () => {
    expect(
      resolveWorkspace(v2, {
        tools: ['claude-code'],
        profile: 'shared-kiro-claude',
      }),
    ).toEqual({
      tools: ['claude-code'],
      profile: 'shared-kiro-claude',
      workspaceMode: 'shared',
      specRoot: '.kiro/specs',
      stateRoot: 'aidlc-docs',
    })
  })

  it('derives a no-Kiro profile from all profile participants', () => {
    expect(
      resolveWorkspace(v2, {
        tools: ['claude-code'],
        profile: 'shared-claude-cursor',
      }),
    ).toMatchObject({
      workspaceMode: 'shared',
      specRoot: 'specs',
    })
  })

  it.each([
    [{ workspaceMode: 'standalone' }, /workspaceMode.*profile|profile.*workspaceMode/i],
    [{ specRoot: 'specs' }, /specRoot.*profile|profile.*specRoot/i],
    [{ stateRoot: 'state' }, /stateRoot.*profile|profile.*stateRoot/i],
  ])('rejects an explicit setting that conflicts with a profile: %#', (override, message) => {
    expect(() =>
      resolveWorkspace(v2, {
        tools: ['claude-code'],
        profile: 'shared-kiro-claude',
        ...override,
      }),
    ).toThrow(message)
  })

  it('accepts explicit settings that agree with a selected profile', () => {
    expect(() =>
      resolveWorkspace(v2, {
        tools: ['kiro', 'claude-code'],
        profile: 'shared-kiro-claude',
        workspaceMode: 'shared',
        specRoot: '.kiro/specs',
        stateRoot: 'aidlc-docs',
      }),
    ).not.toThrow()
  })

  it('rejects standalone mode for more than one requested tool', () => {
    expect(() =>
      resolveWorkspace(v1, {
        tools: ['kiro', 'claude-code'],
        workspaceMode: 'standalone',
      }),
    ).toThrow(/standalone.*multiple|multiple.*standalone/i)
  })

  it.each([
    '/abs',
    '../x',
    'x/../../y',
    'C:\\x',
    '\\\\server\\share',
    'x\\..\\y',
    '.',
    '',
    ' ',
    'x//y',
    'x/',
    ' x/y',
    'x/y ',
    'x\0y',
  ])('rejects unsafe portable root %j', (root) => {
    expect(() =>
      resolveWorkspace(v1, { tools: ['kiro'], specRoot: root }),
    ).toThrow(/specRoot.*safe|safe.*specRoot/i)
    expect(() =>
      resolveWorkspace(v1, { tools: ['kiro'], stateRoot: root }),
    ).toThrow(/stateRoot.*safe|safe.*stateRoot/i)
  })
})
