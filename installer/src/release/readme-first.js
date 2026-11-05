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
    'Unpacking this preview bundle does not modify your project. Check the bundle first:',
    '',
    '```text',
    'sha256sum -c SHA256SUMS',
    'shasum -a 256 -c SHA256SUMS',
    '```',
    '',
    '`SHA256SUMS` detects a corrupted or incomplete copy. It does not prove authenticity, because the checksums travel inside the same bundle.',
    '',
    'Then install the files under `overlay/` with a helper from this directory, starting with a dry run:',
    '',
    '```text',
    'bash install.sh --target <project-directory> --dry-run',
    'bash install.sh --target <project-directory>',
    'bash install.sh --target <project-directory> --uninstall',
    'bash install.sh --target <project-directory> --rollback',
    '```',
    '',
    'On Windows, the same operations are:',
    '',
    '```text',
    'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <project-directory> -DryRun',
    'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <project-directory>',
    'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <project-directory> -Uninstall',
    'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <project-directory> -Rollback',
    '```',
    '',
    '`-ExecutionPolicy Bypass` applies to that one PowerShell process only; do not change your machine or user policy.',
    '',
    'Before writing anything, the helper checks every overlay file against the hashes and modes in `install-files.tsv` and checks every destination. Any conflict stops the whole operation and nothing is written to your project; the reasons go to `install-conflicts.txt` in this directory, or to the error output if this directory is read-only.',
    'On success the helper writes the overlay files and records ownership under `.ramp/` in your project. Keep `.ramp/`: uninstall and rollback depend on it. Rollback restores the previous version only, one step back.',
    '',
    'You can instead review the files under `overlay/` and copy the required files into the root of your project repository yourself. Files copied manually are not recorded in `.ramp/`, and the helper never removes them.',
    '',
    '## Installation prerequisites',
    '',
    '- No Node.js runtime, Git, network, or AWS access is required to inspect or install the bundle.',
    '- Manual copy needs only ordinary file-copy tooling.',
    '- `install.sh` needs Bash 3.2 or later, `sha256sum` or `shasum`, and standard POSIX tools.',
    '- `install.ps1` needs Windows PowerShell 5.1, or PowerShell 7.3 or later.',
    '- On Linux and macOS the helpers refuse an overlay whose file modes changed during unpacking; manual copy still works.',
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
