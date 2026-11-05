#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Target,
  [switch]$DryRun,
  [switch]$Uninstall,
  [switch]$Rollback
)

$ErrorActionPreference = 'Stop'
$ManifestName = '__MANIFEST_NAME__'
$OverlayRoot = '__OVERLAY_ROOT__'
$ConflictName = '__CONFLICT_NAME__'
$StateRoot = '__STATE_ROOT__'

if ((@($DryRun, $Uninstall, $Rollback) | Where-Object { $_ }).Count -gt 1) {
  throw 'operation flags are mutually exclusive'
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $ScriptRoot $ManifestName
$OverlayPath = Join-Path $ScriptRoot $OverlayRoot
$ConflictPath = Join-Path $ScriptRoot $ConflictName
$null = $StateRoot
$null = $ConflictPath

if (-not (Test-Path -LiteralPath $Target -PathType Container)) {
  throw 'target must be an existing ordinary directory'
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw 'install manifest is missing'
}
if (-not (Test-Path -LiteralPath $OverlayPath -PathType Container)) {
  throw 'bundle overlay is missing'
}

# The Windows execution contract is completed and enforced by the Task 9
# windows-latest gate. Static parity remains active on every platform.
$null = Get-FileHash -Algorithm SHA256 -LiteralPath $ManifestPath
throw 'PowerShell bundle installation requires the Windows execution gate'
