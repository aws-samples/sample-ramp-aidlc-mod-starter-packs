#Requires -Version 5.1
<#
.SYNOPSIS
  add-skills.ps1 - copy this pack's Agent Skills into your project (Windows/PowerShell).

.DESCRIPTION
  PowerShell equivalent of add-skills.sh. No Node required - skills are copied
  from the shared skills-library/ in this repo into your project's per-tool
  skills directory.

  To change which skills this pack installs, EDIT the $Skills list below -
  add or remove names (each must match a directory in skills-library/).

.EXAMPLE
  .\add-skills.ps1 -Tool kiro -Target C:\path\to\your\project

.EXAMPLE
  .\add-skills.ps1 -Tool claude-code -Target .

.EXAMPLE
  .\add-skills.ps1 -Tool cursor -Target . -SkillsSrc C:\path\to\skills-library
#>
[CmdletBinding()]
param(
  [ValidateSet('kiro','claude-code','copilot','cursor')]
  [string]$Tool,
  [string]$Target = '.',
  [string]$SkillsSrc
)

$ErrorActionPreference = 'Stop'

$PackName = 'qa-automated-testing'

# --- EDIT ME: the skills installed for this use case --------------------------
$Skills = @(
  'amazon-bedrock'
  'aws-iam'
  'aws-lambda'
  'aws-lambda-microvms'
  'aws-step-functions'
  'connecting-lambda-to-api-gateway'
  'mobile-test-automation'
  'web-test-automation'
)
# -----------------------------------------------------------------------------

if (-not $Tool) {
  Write-Error "usage: .\add-skills.ps1 -Tool <kiro|claude-code|copilot|cursor> -Target <dir>"
  exit 1
}

$destSub = switch ($Tool) {
  'kiro'        { '.kiro/skills' }
  'claude-code' { '.claude/skills' }
  'copilot'     { '.github/skills' }
  'cursor'      { '.cursor/skills' }
}

# Locate skills-library: use -SkillsSrc if given, else search up from this script.
$here = $PSScriptRoot
if (-not $SkillsSrc) {
  foreach ($cand in @(
      (Join-Path $here '..\..\..\skills-library'),
      (Join-Path $here '..\..\skills-library'),
      (Join-Path $here '..\skills-library'),
      (Join-Path $here 'skills-library'))) {
    if (Test-Path -LiteralPath $cand -PathType Container) {
      $SkillsSrc = (Resolve-Path -LiteralPath $cand).Path
      break
    }
  }
}
if (-not $SkillsSrc -or -not (Test-Path -LiteralPath $SkillsSrc -PathType Container)) {
  Write-Error "skills-library not found. Pass -SkillsSrc C:\path\to\skills-library"
  exit 1
}

# Resolve/announce the target so a typo'd -Target is obvious.
if (-not (Test-Path -LiteralPath $Target -PathType Container)) {
  Write-Warning "target directory '$Target' does not exist yet - creating it."
}
$dest = Join-Path $Target $destSub
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$dest = (Resolve-Path -LiteralPath $dest).Path

Write-Host "Installing $($Skills.Count) skills for '$PackName' -> $dest"
$missing = 0
foreach ($s in $Skills) {
  $srcSkill = Join-Path $SkillsSrc $s
  if (Test-Path -LiteralPath $srcSkill -PathType Container) {
    $destSkill = Join-Path $dest $s
    if (Test-Path -LiteralPath $destSkill) { Remove-Item -LiteralPath $destSkill -Recurse -Force }
    Copy-Item -LiteralPath $srcSkill -Destination $destSkill -Recurse -Force
    Write-Host "  + $s"
  } else {
    Write-Warning "not found in skills-library: $s"
    $missing++
  }
}
$copied = $Skills.Count - $missing
Write-Host "Done. $copied copied, $missing missing -> $dest"
if ($missing -ne 0) { exit 1 }