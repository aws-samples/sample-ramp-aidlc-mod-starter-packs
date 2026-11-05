function hasCommand(manifest, command) {
  return (manifest.mcp ?? []).some((server) => server.command === command)
}

function needsAwsCredentials(manifest) {
  return (manifest.mcp ?? []).some((server) =>
    Object.keys(server.env ?? {}).some((name) =>
      name === 'AWS_PROFILE' || name.startsWith('AWS_')) ||
    /aws/i.test(server.id ?? '') ||
    /aws/i.test(server.url ?? '') ||
    (server.args ?? []).some((argument) => /aws/i.test(String(argument))))
}

export function renderReadmeFirst({
  manifest,
  target,
  profile,
  workspace,
  artifactName,
} = {}) {
  const title = safeProse(manifest.title ?? manifest.name, 'pack title')
  const safeArtifactName = safeCodeValue(artifactName, 'artifactName')
  const safeTarget = safeCodeValue(target, 'target')
  const safeProfile = profile === null || profile === undefined
    ? null
    : safeCodeValue(profile, 'profile')
  const workspaceMode = safeCodeValue(workspace.workspaceMode, 'workspaceMode')
  const specRoot = assertArtifactPath(workspace.specRoot, 'workspace specRoot')
  const stateRoot = assertArtifactPath(workspace.stateRoot, 'workspace stateRoot')
  const runtime = []
  if (hasCommand(manifest, 'npx')) runtime.push('- Node.js with `npx`.')
  if (hasCommand(manifest, 'uvx')) runtime.push('- `uv` with `uvx`.')
  if (needsAwsCredentials(manifest)) {
    runtime.push('- AWS credentials or an AWS profile appropriate for the selected MCP servers.')
  }
  if (runtime.length === 0) {
    runtime.push('- No additional command runtime is declared by this pack.')
  }

  return [
    `# ${title}: use this bundle first`,
    '',
    `Artifact: \`${safeArtifactName}\``,
    `Target: \`${safeTarget}\``,
    ...(safeProfile ? [`Workspace profile: \`${safeProfile}\``] : []),
    '',
    '## Use this bundle',
    '',
    'Review the files under `overlay/`, then copy the required files into the root of your project repository.',
    'This preview bundle does not include an installer; unpacking it does not modify your project.',
    '',
    '## Installation prerequisites',
    '',
    '- No Node.js runtime is required to inspect the bundle or copy `overlay/` manually.',
    '- Use ordinary file-copy tooling available in your environment.',
    '',
    '## Runtime prerequisites',
    '',
    ...runtime,
    '',
    '## Shared workspace',
    '',
    `- Workspace mode: \`${workspaceMode}\``,
    `- Canonical specification root: \`${specRoot}\``,
    `- Workflow state root: \`${stateRoot}\``,
    `- This artifact contains only the \`${safeTarget}\` tool projection.`,
    '',
    '## Safety',
    '',
    'If your repository already contains tool instructions, MCP configuration, skills, or commands, merge them deliberately.',
    'Do not overwrite existing agent configuration blindly; resolve every conflict before copying.',
    '',
  ].join('\n')
}
import { assertArtifactPath } from './entries.js'

export function containsLocalAbsolutePath(value) {
  if (typeof value !== 'string' || value === '') return false
  const candidate = value.replace(
    /\{\{(?:STATE|SPEC)_DIR\}\}/g,
    'ramp-template-root',
  )
  if (/^https?:\/\/[^\s]+$/i.test(candidate)) return false
  return (
    /\bfile:\/\//i.test(candidate) ||
    /(?:^|[^A-Za-z0-9/:])\/\/[^/\s]+\/[^/\s]+/.test(candidate) ||
    /(?:^|[^A-Za-z0-9/])\/(?!\/)(?=[^\s`[\]<>\\)])[^\s`[\]<>\\)]+/.test(candidate) ||
    /(?:^|[^A-Za-z0-9/])\/(?:$|(?=[),.;:!?](?:\s|$)))/.test(candidate) ||
    /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/.test(candidate) ||
    /(?:^|[^A-Za-z0-9\\])\\\\[^\\/\s]+[\\/][^\\/\s]+/.test(candidate)
  )
}

function safeProse(value, label) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    /[\0-\x1f\x7f]/.test(value) ||
    /[`[\]<>\\]/.test(value) ||
    containsLocalAbsolutePath(value)
  ) {
    throw new Error(`${label} must be safe single-line README prose`)
  }
  return value
}

function safeCodeValue(value, label) {
  const path = assertArtifactPath(value, label)
  if (path.includes('/')) {
    throw new Error(`${label} must be a single portable identifier`)
  }
  return path
}
