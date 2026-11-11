#Requires -Version 5.1
<#
.SYNOPSIS
Copies this pack's Agent Skills into a project without requiring Node.

.DESCRIPTION
Sources are selected in this order: pack override, RAMP-owned, compatibility
library. Every source and destination is preflighted before target mutation.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('kiro', 'claude-code', 'copilot', 'cursor', 'codex')]
  [string]$Tool,

  [string]$Target = '.',

  [string]$RepoRoot,

  [string]$SkillsSrc
)

$ErrorActionPreference = 'Stop'
$PackName = 'api-platform-migration-n-modernization'
$Skills = @(
  'api-gateway'
)
$SourceKinds = @('pack', 'ramp', 'compatibility')
$null = $SourceKinds

$DestinationByTool = @{
  'kiro' = '.kiro/skills'
  'claude-code' = '.claude/skills'
  'copilot' = '.github/skills'
  'cursor' = '.cursor/skills'
  'codex' = '.agents/skills'
}

$script:Errors = New-Object 'System.Collections.Generic.List[string]'
$SelectedSources = New-Object 'System.Collections.Generic.List[string]'
$SelectedKinds = New-Object 'System.Collections.Generic.List[string]'
$NameValidity = New-Object 'System.Collections.Generic.List[bool]'
$RunningOnWindows = (
  [Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
)

function Add-ErrorMessage {
  param([string]$Message)
  $script:Errors.Add($Message) | Out-Null
}

function Get-LexicalItem {
  param([string]$LiteralPath)
  try {
    return Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
  }
  catch [System.Management.Automation.ItemNotFoundException] {
    return $null
  }
  catch {
    if ($_.Exception -is [System.IO.FileNotFoundException] -or
        $_.Exception -is [System.IO.DirectoryNotFoundException]) {
      return $null
    }
    throw
  }
}

function Test-IsReparsePoint {
  param($Item)
  return [bool]($Item.Attributes -band [IO.FileAttributes]::ReparsePoint)
}

function Get-LexicalNormalizedPath {
  param([string]$LiteralPath)
  $fullPath = [IO.Path]::GetFullPath($LiteralPath)
  $pathRoot = [IO.Path]::GetPathRoot($fullPath)
  $trimCharacters = [char[]]@(
    [char][IO.Path]::DirectorySeparatorChar,
    [char][IO.Path]::AltDirectorySeparatorChar
  )
  $trimmedPath = $fullPath.TrimEnd($trimCharacters)
  $trimmedRoot = $pathRoot.TrimEnd($trimCharacters)
  if ($trimmedPath.Equals(
      $trimmedRoot,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
    return $pathRoot
  }
  return $trimmedPath
}

function Test-OrdinaryDirectoryItem {
  param(
    $Item,
    [string]$Label
  )
  if ($null -eq $Item) {
    Add-ErrorMessage "$Label does not exist"
    return $false
  }
  if (Test-IsReparsePoint $Item) {
    Add-ErrorMessage "$Label must not be a reparse point: $($Item.FullName)"
    return $false
  }
  if (-not $Item.PSIsContainer) {
    Add-ErrorMessage "$Label must be an ordinary directory: $($Item.FullName)"
    return $false
  }
  return $true
}

function Test-OrdinaryFileItem {
  param(
    $Item,
    [string]$Label
  )
  if ($null -eq $Item) {
    Add-ErrorMessage "$Label does not exist"
    return $false
  }
  if (Test-IsReparsePoint $Item) {
    Add-ErrorMessage "$Label must not be a reparse point: $($Item.FullName)"
    return $false
  }
  if ($Item.PSIsContainer -or -not ($Item -is [System.IO.FileInfo])) {
    Add-ErrorMessage "$Label must be an ordinary regular file: $($Item.FullName)"
    return $false
  }
  if (-not $script:RunningOnWindows) {
    $unixStat = $Item.PSObject.Properties['UnixStat']
    if ($null -eq $unixStat -or $null -eq $unixStat.Value) {
      Add-ErrorMessage "$Label has no inspectable Unix file type: $($Item.FullName)"
      return $false
    }
    if ([string]$unixStat.Value.ItemType -ne 'File') {
      Add-ErrorMessage "$Label must be an ordinary regular file: $($Item.FullName)"
      return $false
    }
  }
  return $true
}

function Resolve-OrdinaryDirectoryRoot {
  param(
    [string]$LiteralPath,
    [string]$Label
  )
  $lexicalPath = Get-LexicalNormalizedPath $LiteralPath
  $item = Get-LexicalItem $lexicalPath
  if (-not (Test-OrdinaryDirectoryItem $item $Label)) {
    return $null
  }
  return (Resolve-Path -LiteralPath $item.FullName -ErrorAction Stop).ProviderPath
}

function Test-PortableSegment {
  param(
    [string]$Segment,
    [string]$Label
  )
  if ([string]::IsNullOrEmpty($Segment) -or
      $Segment -eq '.' -or
      $Segment -eq '..') {
    Add-ErrorMessage "$Label contains an unsafe path segment '$Segment'"
    return $false
  }
  foreach ($character in $Segment.ToCharArray()) {
    $codePoint = [int][char]$character
    if ($codePoint -lt 0x20 -or $codePoint -gt 0x7E) {
      Add-ErrorMessage "$Label contains a non-ASCII character: $Segment"
      return $false
    }
  }
  if ($Segment -match '[\x00-\x1F<>:"\\|?*]') {
    Add-ErrorMessage "$Label contains a non-portable character: $Segment"
    return $false
  }
  if ($Segment -match '[. ]$') {
    Add-ErrorMessage "$Label has a trailing dot or space: $Segment"
    return $false
  }
  $baseName = $Segment.Split('.')[0]
  if ($baseName -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
    Add-ErrorMessage "$Label uses a Windows reserved device name: $Segment"
    return $false
  }
  return $true
}

function Test-PortableRelativePath {
  param(
    [string]$RelativePath,
    [string]$Label
  )
  $valid = $true
  foreach ($segment in ($RelativePath -split '[\\/]')) {
    if (-not (Test-PortableSegment $segment $Label)) {
      $valid = $false
    }
  }
  return $valid
}

function Test-DirectoryPath {
  param(
    [string]$LiteralPath,
    [string]$Label
  )
  return Test-OrdinaryDirectoryItem (Get-LexicalItem $LiteralPath) $Label
}

function Test-RegularFilePath {
  param(
    [string]$LiteralPath,
    [string]$Label
  )
  return Test-OrdinaryFileItem (Get-LexicalItem $LiteralPath) $Label
}

function Test-DirectoryChain {
  param(
    [string]$Root,
    [string]$RelativePath,
    [string]$Label
  )
  $current = $Root
  foreach ($segment in ($RelativePath -split '/')) {
    $current = Join-Path $current $segment
    $item = Get-LexicalItem $current
    if ($null -eq $item) {
      return $true
    }
    if (-not (Test-OrdinaryDirectoryItem $item "$Label component '$segment'")) {
      return $false
    }
  }
  return $true
}

function Test-Repository {
  param(
    [string]$Root,
    [bool]$RequireCompatibility
  )
  $valid = $true
  if (-not (Test-DirectoryPath (Join-Path $Root 'packs') 'repository packs directory')) {
    $valid = $false
  }
  $packDirectory = Join-Path (Join-Path $Root 'packs') $PackName
  if (-not (Test-DirectoryPath $packDirectory "pack directory for '$PackName'")) {
    $valid = $false
  }
  if (-not (Test-RegularFilePath (Join-Path $packDirectory 'pack.yaml') "pack marker for '$PackName'")) {
    $valid = $false
  }
  $skillsDirectory = Join-Path $Root 'skills'
  if (-not (Test-DirectoryPath $skillsDirectory 'repository skills directory')) {
    $valid = $false
  }
  if (-not (Test-DirectoryPath (Join-Path $skillsDirectory 'ramp') 'RAMP skills directory')) {
    $valid = $false
  }
  if ($RequireCompatibility -and
      -not (Test-DirectoryPath (Join-Path $Root 'skills-library') 'compatibility skills directory')) {
    $valid = $false
  }
  return $valid
}

function Test-RepositoryCandidate {
  param(
    [string]$Root,
    [bool]$RequireCompatibility
  )
  $rootItem = Get-LexicalItem $Root
  if ($null -eq $rootItem -or
      (Test-IsReparsePoint $rootItem) -or
      -not $rootItem.PSIsContainer) {
    return $false
  }
  $checks = @(
    @{ Path = (Join-Path $Root 'packs'); Directory = $true },
    @{ Path = (Join-Path (Join-Path $Root 'packs') $PackName); Directory = $true },
    @{ Path = (Join-Path (Join-Path (Join-Path $Root 'packs') $PackName) 'pack.yaml'); Directory = $false },
    @{ Path = (Join-Path $Root 'skills'); Directory = $true },
    @{ Path = (Join-Path (Join-Path $Root 'skills') 'ramp'); Directory = $true }
  )
  if ($RequireCompatibility) {
    $checks += @{ Path = (Join-Path $Root 'skills-library'); Directory = $true }
  }
  foreach ($check in $checks) {
    $item = Get-LexicalItem $check.Path
    if ($null -eq $item -or (Test-IsReparsePoint $item)) {
      return $false
    }
    if ($check.Directory -ne [bool]$item.PSIsContainer) {
      return $false
    }
    if (-not $check.Directory -and -not ($item -is [System.IO.FileInfo])) {
      return $false
    }
  }
  return $true
}

function Test-SkillTree {
  param(
    [string]$Source,
    [string]$Name,
    [string]$Kind
  )
  $valid = $true
  $sourceItem = Get-LexicalItem $Source
  if (-not (Test-OrdinaryDirectoryItem $sourceItem "$Kind source for '$Name'")) {
    return $false
  }
  if (-not (Test-RegularFilePath (Join-Path $Source 'SKILL.md') "SKILL.md for '$Name'")) {
    $valid = $false
  }

  $seen = @{}
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($Source)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in (Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)) {
      $relative = $entry.FullName.Substring($Source.Length).TrimStart(
        [char[]]@(
          [char][IO.Path]::DirectorySeparatorChar,
          [char][IO.Path]::AltDirectorySeparatorChar
        )
      )
      if (-not (Test-PortableRelativePath $relative "path in skill '$Name'")) {
        $valid = $false
      }
      $caseKey = ($relative -replace '\\', '/').ToLowerInvariant()
      if ($seen.ContainsKey($caseKey)) {
        Add-ErrorMessage "skill '$Name' has a case-insensitive path collision at '$relative'"
        $valid = $false
      }
      else {
        $seen[$caseKey] = $true
      }

      if (Test-IsReparsePoint $entry) {
        Add-ErrorMessage "skill '$Name' contains a reparse point: $relative"
        $valid = $false
      }
      elseif ($entry.PSIsContainer) {
        $pending.Push($entry.FullName)
      }
      elseif (-not (Test-OrdinaryFileItem $entry "path in skill '$Name'")) {
        $valid = $false
      }
    }
  }
  return $valid
}

$scriptItem = Get-LexicalItem $PSCommandPath
if ($null -eq $scriptItem -or -not (Test-OrdinaryFileItem $scriptItem 'helper')) {
  if ($null -eq $scriptItem) {
    Add-ErrorMessage "helper does not exist: $PSCommandPath"
  }
}
$scriptDirectoryPath = Split-Path -Parent $PSCommandPath
$scriptDirectoryItem = Get-LexicalItem $scriptDirectoryPath
$null = Test-OrdinaryDirectoryItem $scriptDirectoryItem 'helper directory'

$helperDirectory = $null
if ($null -ne $scriptDirectoryItem -and
    -not (Test-IsReparsePoint $scriptDirectoryItem) -and
    $scriptDirectoryItem.PSIsContainer) {
  $helperDirectory = (Resolve-Path -LiteralPath $scriptDirectoryPath).ProviderPath
}

$canonicalRepoRoot = $null
$repoWasExplicit = -not [string]::IsNullOrEmpty($RepoRoot)
$skillsSrcWasExplicit = -not [string]::IsNullOrEmpty($SkillsSrc)
if ($repoWasExplicit) {
  $canonicalRepoRoot = Resolve-OrdinaryDirectoryRoot $RepoRoot 'repository root'
  if ($null -ne $canonicalRepoRoot) {
    $null = Test-Repository $canonicalRepoRoot (-not $skillsSrcWasExplicit)
  }
}
elseif ($null -ne $helperDirectory) {
  $candidate = $helperDirectory
  while ($true) {
    if (Test-RepositoryCandidate $candidate (-not $skillsSrcWasExplicit)) {
      $canonicalRepoRoot = $candidate
      $null = Test-Repository $canonicalRepoRoot (-not $skillsSrcWasExplicit)
      break
    }
    $parent = [IO.Directory]::GetParent($candidate)
    if ($null -eq $parent) {
      break
    }
    $candidate = $parent.FullName
  }
}

$canonicalSkillsSrc = $null
if ($skillsSrcWasExplicit) {
  $canonicalSkillsSrc = Resolve-OrdinaryDirectoryRoot $SkillsSrc 'compatibility root'
}
elseif ($null -ne $canonicalRepoRoot) {
  $canonicalSkillsSrc = Join-Path $canonicalRepoRoot 'skills-library'
}

$namePattern = '^[a-z0-9]+(-[a-z0-9]+)*$'
$seenNames = @{}
foreach ($skill in $Skills) {
  $validName = $true
  if ($skill -notmatch $namePattern) {
    Add-ErrorMessage "invalid skill name '$skill': expected lower-kebab case"
    $validName = $false
  }
  if ($seenNames.ContainsKey($skill)) {
    Add-ErrorMessage "duplicate skill name: $skill"
    $validName = $false
  }
  else {
    $seenNames[$skill] = $true
  }
  $NameValidity.Add($validName) | Out-Null
}

for ($skillIndex = 0; $skillIndex -lt $Skills.Count; $skillIndex++) {
  $skill = $Skills[$skillIndex]
  $selectedSource = $null
  $selectedKind = $null

  if (-not $NameValidity[$skillIndex]) {
    $SelectedSources.Add('') | Out-Null
    $SelectedKinds.Add('') | Out-Null
    continue
  }

  if ($null -ne $canonicalRepoRoot) {
    $packRelative = "packs/$PackName/skills/$skill"
    $null = Test-DirectoryChain $canonicalRepoRoot $packRelative 'pack source'
    $packCandidate = Join-Path $canonicalRepoRoot ($packRelative -replace '/', [IO.Path]::DirectorySeparatorChar)
    if ($null -ne (Get-LexicalItem $packCandidate)) {
      $selectedSource = $packCandidate
      $selectedKind = 'pack'
    }
    else {
      $rampRelative = "skills/ramp/$skill"
      $null = Test-DirectoryChain $canonicalRepoRoot $rampRelative 'RAMP source'
      $rampCandidate = Join-Path $canonicalRepoRoot ($rampRelative -replace '/', [IO.Path]::DirectorySeparatorChar)
      if ($null -ne (Get-LexicalItem $rampCandidate)) {
        $selectedSource = $rampCandidate
        $selectedKind = 'ramp'
      }
    }
  }

  if ($null -eq $selectedSource -and $null -ne $canonicalSkillsSrc) {
    $null = Test-DirectoryChain $canonicalSkillsSrc $skill 'compatibility source'
    $compatibilityCandidate = Join-Path $canonicalSkillsSrc $skill
    if ($null -ne (Get-LexicalItem $compatibilityCandidate)) {
      $selectedSource = $compatibilityCandidate
      $selectedKind = 'compatibility'
    }
  }

  if ($null -eq $selectedSource) {
    $availableRoots = @()
    if ($null -ne $canonicalRepoRoot) {
      $availableRoots += "repository=$canonicalRepoRoot"
    }
    if ($null -ne $canonicalSkillsSrc) {
      $availableRoots += "compatibility=$canonicalSkillsSrc"
    }
    if ($null -eq $canonicalRepoRoot) {
      Add-ErrorMessage "skill '$skill' was not found. $($availableRoots -join ' ') Pass -RepoRoot <ramp-repository-root> for pack or RAMP skills."
    }
    else {
      Add-ErrorMessage "skill '$skill' was not found in available roots: $($availableRoots -join ' ')"
    }
    $SelectedSources.Add('') | Out-Null
    $SelectedKinds.Add('') | Out-Null
  }
  else {
    $null = Test-SkillTree $selectedSource $skill $selectedKind
    $SelectedSources.Add($selectedSource) | Out-Null
    $SelectedKinds.Add($selectedKind) | Out-Null
  }
}

function Test-ContainedPath {
  param(
    [string]$Root,
    [string]$Candidate
  )
  $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd(
    [char[]]@(
      [char][IO.Path]::DirectorySeparatorChar,
      [char][IO.Path]::AltDirectorySeparatorChar
    )
  )
  $candidateFull = [IO.Path]::GetFullPath($Candidate)
  $boundary = $rootFull + [IO.Path]::DirectorySeparatorChar
  return $candidateFull.StartsWith(
    $boundary,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

$canonicalTarget = $null
$targetWasMissing = $false
$targetLexicalPath = Get-LexicalNormalizedPath $Target
$targetItem = Get-LexicalItem $targetLexicalPath
if ($null -ne $targetItem) {
  if (Test-OrdinaryDirectoryItem $targetItem 'target') {
    $canonicalTarget = (Resolve-Path -LiteralPath $targetItem.FullName).ProviderPath
  }
}
else {
  $targetWasMissing = $true
  $absoluteTarget = $targetLexicalPath
  $probe = $absoluteTarget.TrimEnd(
    [char[]]@(
      [char][IO.Path]::DirectorySeparatorChar,
      [char][IO.Path]::AltDirectorySeparatorChar
    )
  )
  $missingSegments = New-Object 'System.Collections.Generic.List[string]'
  $probeItem = Get-LexicalItem $probe
  while ($null -eq $probeItem) {
    $segment = [IO.Path]::GetFileName($probe)
    $null = Test-PortableSegment $segment 'target path'
    $missingSegments.Add($segment) | Out-Null
    $parent = [IO.Path]::GetDirectoryName($probe)
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $probe) {
      Add-ErrorMessage "cannot find an existing parent for target: $Target"
      break
    }
    $probe = $parent
    $probeItem = Get-LexicalItem $probe
  }
  if ($null -ne $probeItem) {
    if (Test-OrdinaryDirectoryItem $probeItem 'nearest existing target parent') {
      $canonicalTarget = (Resolve-Path -LiteralPath $probeItem.FullName).ProviderPath
      for ($index = $missingSegments.Count - 1; $index -ge 0; $index--) {
        $canonicalTarget = Join-Path $canonicalTarget $missingSegments[$index]
      }
    }
  }
}

function Test-DestinationPath {
  param(
    [string]$TargetRoot,
    [string]$RelativePath,
    [string]$Label
  )
  $valid = $true
  $current = $TargetRoot
  foreach ($segment in ($RelativePath -split '/')) {
    $current = Join-Path $current $segment
    if (-not (Test-ContainedPath $TargetRoot $current)) {
      Add-ErrorMessage "$Label escapes the target root: $current"
      return $false
    }
    $item = Get-LexicalItem $current
    if ($null -ne $item -and
        -not (Test-OrdinaryDirectoryItem $item "$Label component '$segment'")) {
      $valid = $false
      break
    }
  }
  return $valid
}

function Test-ExistingDestinationTree {
  param(
    [string]$Root,
    [string]$Name
  )
  $rootItem = Get-LexicalItem $Root
  if ($null -eq $rootItem -or (Test-IsReparsePoint $rootItem) -or -not $rootItem.PSIsContainer) {
    return
  }
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($Root)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in (Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)) {
      $relative = $entry.FullName.Substring($Root.Length).TrimStart(
        [char[]]@(
          [char][IO.Path]::DirectorySeparatorChar,
          [char][IO.Path]::AltDirectorySeparatorChar
        )
      )
      if (Test-IsReparsePoint $entry) {
        Add-ErrorMessage "destination for '$Name' contains a reparse point: $relative"
      }
      elseif ($entry.PSIsContainer) {
        $pending.Push($entry.FullName)
      }
      else {
        $null = Test-OrdinaryFileItem $entry "destination for '$Name' entry '$relative'"
      }
    }
  }
}

$destinationRoot = $null
if ($null -ne $canonicalTarget) {
  $destinationRelative = $DestinationByTool[$Tool]
  $destinationRoot = Join-Path $canonicalTarget ($destinationRelative -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-ContainedPath $canonicalTarget $destinationRoot)) {
    Add-ErrorMessage "destination escapes the target root: $destinationRoot"
  }
  $null = Test-DestinationPath $canonicalTarget $destinationRelative 'tool skills destination'
  foreach ($skill in $Skills) {
    $skillDestinationRelative = "$destinationRelative/$skill"
    $null = Test-DestinationPath $canonicalTarget $skillDestinationRelative "destination for '$skill'"
    Test-ExistingDestinationTree (Join-Path $destinationRoot $skill) $skill
  }
}

if ($script:Errors.Count -gt 0) {
  [Console]::Error.WriteLine('error: add-skills preflight failed:')
  foreach ($message in $script:Errors) {
    [Console]::Error.WriteLine("  - $message")
  }
  exit 1
}

# PRE-FLIGHT COMPLETE — no target mutation is allowed above this marker.
if ($targetWasMissing) {
  New-Item -ItemType Directory -Path $canonicalTarget -Force | Out-Null
}
New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null

Write-Output "Installing $($Skills.Count) skills for '$PackName' -> $destinationRoot"
for ($index = 0; $index -lt $Skills.Count; $index++) {
  $skill = $Skills[$index]
  $source = $SelectedSources[$index]
  $kind = $SelectedKinds[$index]
  $destination = Join-Path $destinationRoot $skill
  if ($null -ne (Get-LexicalItem $destination)) {
    Remove-Item -LiteralPath $destination -Recurse -Force
  }
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  # skill.yaml is RAMP source metadata; customer projects do not receive it.
  foreach ($entry in (Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -cne 'skill.yaml' })) {
    Copy-Item -LiteralPath $entry.FullName -Destination $destination -Recurse -Force
  }
  Write-Output "  + $skill [$kind]"
}
Write-Output "Done. $($Skills.Count) copied -> $destinationRoot"
