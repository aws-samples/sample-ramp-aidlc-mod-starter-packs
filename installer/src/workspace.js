import { getAdapter } from './adapters/index.js'

const MODES = new Set(['standalone', 'shared'])

function assertSafeRoot(value, label) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.trim() !== value ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`workspace ${label} must be a safe relative directory path`)
  }

  const segments = value.split('/')
  if (
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`workspace ${label} must be a safe relative directory path`)
  }
  return value
}

function assertUniqueTools(tools) {
  const seen = new Set()
  for (const tool of tools) {
    if (seen.has(tool)) throw new Error(`duplicate workspace tool: ${tool}`)
    seen.add(tool)
  }
}

function assertProfileAgreement(profile, field, explicit) {
  if (
    explicit !== undefined &&
    profile[field] !== undefined &&
    explicit !== profile[field]
  ) {
    throw new Error(
      `workspace ${field} conflicts with profile ${profile.name}: ` +
        `${explicit} !== ${profile[field]}`,
    )
  }
}

export function resolveWorkspace(
  manifest,
  { tools, profile, workspaceMode, specRoot, stateRoot } = {},
) {
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error('workspace tools must be a non-empty array')
  }
  assertUniqueTools(tools)
  for (const tool of tools) getAdapter(tool)

  if (manifest?.schemaVersion === 2) {
    const declared = manifest.distribution?.targets ?? []
    for (const tool of tools) {
      if (!declared.includes(tool)) {
        throw new Error(`workspace tool is not declared by this pack: ${tool}`)
      }
    }
  }

  let selectedProfile = null
  if (profile !== undefined) {
    const profiles = manifest?.distribution?.profiles ?? []
    selectedProfile = profiles.find((candidate) => candidate.name === profile) ?? null
    if (!selectedProfile) throw new Error(`unknown workspace profile: ${profile}`)
    for (const tool of tools) {
      if (!selectedProfile.targets.includes(tool)) {
        throw new Error(`workspace profile ${profile} does not include tool: ${tool}`)
      }
    }
    for (const participant of selectedProfile.targets) getAdapter(participant)
    assertProfileAgreement(selectedProfile, 'workspaceMode', workspaceMode)
    assertProfileAgreement(selectedProfile, 'specRoot', specRoot)
    assertProfileAgreement(selectedProfile, 'stateRoot', stateRoot)
  }

  const participants = selectedProfile?.targets ?? tools
  const mode =
    selectedProfile?.workspaceMode ??
    workspaceMode ??
    (tools.length > 1 ? 'shared' : 'standalone')
  if (!MODES.has(mode)) throw new Error(`unsupported workspaceMode: ${mode}`)
  if (mode === 'standalone' && tools.length > 1) {
    throw new Error('standalone workspaceMode cannot contain multiple tools')
  }

  const defaultSpecRoot = participants.includes('kiro')
    ? getAdapter('kiro').defaultSpecRoot
    : getAdapter(participants[0]).defaultSpecRoot
  const resolvedSpecRoot = selectedProfile?.specRoot ?? specRoot ?? defaultSpecRoot
  const resolvedStateRoot = selectedProfile?.stateRoot ?? stateRoot ?? 'aidlc-docs'

  const resolved = {
    tools: Object.freeze([...tools]),
    profile: selectedProfile?.name ?? null,
    workspaceMode: mode,
    specRoot: assertSafeRoot(resolvedSpecRoot, 'specRoot'),
    stateRoot: assertSafeRoot(resolvedStateRoot, 'stateRoot'),
  }
  return Object.freeze(resolved)
}
