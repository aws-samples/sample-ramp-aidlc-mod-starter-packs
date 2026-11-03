#Requires -Version 5.1
<#
.SYNOPSIS
  add-skills.ps1 - repo-root shortcut. Port a pack's skills by name, no Node (Windows/PowerShell).

.DESCRIPTION
  PowerShell equivalent of add-skills.sh. Delegates to packs\<pack>\add-skills.ps1
  (where the editable $Skills list lives). Run with no args to list available packs.

.EXAMPLE
  .\add-skills.ps1 cots-rewrite-on-cloudnative -Tool kiro -Target C:\path\to\project

.EXAMPLE
  .\add-skills.ps1              # list available packs
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Pack,

  # Remaining args (-Tool/-Target/-SkillsSrc) are forwarded to the pack script.
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

function Show-Packs {
  Write-Host "available packs:"
  Get-ChildItem (Join-Path $here 'packs\*\add-skills.ps1') |
    ForEach-Object { Write-Host "  $($_.Directory.Name)" }
}

if (-not $Pack -or $Pack -in @('-h', '--help', '-Help') -or $Pack.StartsWith('-')) {
  Write-Host "usage: .\add-skills.ps1 <pack> -Tool <kiro|claude-code|copilot|cursor> -Target <dir>"
  Show-Packs
  exit 1
}

$script = Join-Path $here "packs\$Pack\add-skills.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
  Write-Error "no such pack '$Pack' (expected $script)"
  Show-Packs
  exit 1
}

# Parse the remaining "-Name value" tokens into a hashtable so they bind as
# NAMED parameters on the pack script. (Splatting a plain array would bind them
# positionally and break -Tool's ValidateSet.)
$params = @{}
for ($i = 0; $i -lt $Rest.Count; $i++) {
  $tok = $Rest[$i]
  if ($tok -like '-*') {
    $name = $tok.TrimStart('-')
    if (($i + 1) -lt $Rest.Count -and ($Rest[$i + 1] -notlike '-*')) {
      $params[$name] = $Rest[$i + 1]; $i++
    } else {
      $params[$name] = $true   # switch-style flag
    }
  } else {
    Write-Error "unexpected argument '$tok' (expected -Name value pairs)"
    exit 1
  }
}

& $script @params
exit $LASTEXITCODE
