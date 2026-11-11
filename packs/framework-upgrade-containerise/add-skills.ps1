#Requires -Version 5.1
<#
.SYNOPSIS
Copies this pack's Agent Skills into a project without requiring Node.

.DESCRIPTION
Sources are selected in this order: skills/<slug>/, then during the
compatibility window the pack override, RAMP-owned and compatibility library
tiers. -SkillsSrc replaces skills/ and the compatibility library. A slug found
in skills/ (or -SkillsSrc) and in any other root is ambiguous and fails. Every
source and destination is preflighted before target mutation.
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
$PackName = 'framework-upgrade-containerise'
$Skills = @(
  'aws-cloudformation'
  'aws-containers'
  'aws-iam'
  'aws-observability'
  'ecs-architect'
  'ecs-build'
  'ecs-devops'
  'ecs-observability'
  'ecs-security'
  'java-upgrade'
  'regression-testing'
  'web-test-automation'
)
$SourceKinds = @('skills', 'skills-src', 'pack', 'ramp', 'compatibility')
$null = $SourceKinds

$DestinationByTool = @{
  'kiro' = '.kiro/skills'
  'claude-code' = '.claude/skills'
  'copilot' = '.github/skills'
  'cursor' = '.cursor/skills'
  'codex' = '.agents/skills'
}

$script:Errors = New-Object 'System.Collections.Generic.List[string]'
$Warnings = New-Object 'System.Collections.Generic.List[string]'
$SelectedSources = New-Object 'System.Collections.Generic.List[string]'
$SelectedKinds = New-Object 'System.Collections.Generic.List[string]'
$NameValidity = New-Object 'System.Collections.Generic.List[bool]'
$RunningOnWindows = (
  [Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
)
# Paths compare case-insensitively on Windows only, as the file system does.
$PathComparison = [System.StringComparison]::Ordinal
if ($RunningOnWindows) {
  $PathComparison = [System.StringComparison]::OrdinalIgnoreCase
}

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
    [string]$Label,
    [string]$MissingPath
  )
  if ($null -eq $Item) {
    if ([string]::IsNullOrEmpty($MissingPath)) {
      Add-ErrorMessage "$Label does not exist"
    }
    else {
      Add-ErrorMessage "$Label does not exist: $MissingPath"
    }
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
    [string]$Label,
    [string]$MissingPath
  )
  if ($null -eq $Item) {
    if ([string]::IsNullOrEmpty($MissingPath)) {
      Add-ErrorMessage "$Label does not exist"
    }
    else {
      Add-ErrorMessage "$Label does not exist: $MissingPath"
    }
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
  if (-not (Test-OrdinaryDirectoryItem $item $Label $LiteralPath)) {
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
  return Test-OrdinaryDirectoryItem (Get-LexicalItem $LiteralPath) $Label $LiteralPath
}

function Test-RegularFilePath {
  param(
    [string]$LiteralPath,
    [string]$Label
  )
  return Test-OrdinaryFileItem (Get-LexicalItem $LiteralPath) $Label $LiteralPath
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

# skills/ is required; skills/ramp/ and skills-library/ are optional
# compatibility roots that must be ordinary directories when present.
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
  $rampDirectory = Join-Path $skillsDirectory 'ramp'
  if ($null -ne (Get-LexicalItem $rampDirectory) -and
      -not (Test-DirectoryPath $rampDirectory 'RAMP skills directory')) {
    $valid = $false
  }
  $libraryDirectory = Join-Path $Root 'skills-library'
  if ($RequireCompatibility -and
      $null -ne (Get-LexicalItem $libraryDirectory) -and
      -not (Test-DirectoryPath $libraryDirectory 'compatibility skills directory')) {
    $valid = $false
  }
  return $valid
}

function Test-RepositoryCandidate {
  param([string]$Root)
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
    @{ Path = (Join-Path $Root 'skills'); Directory = $true }
  )
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
    if (Test-RepositoryCandidate $candidate) {
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

# -SkillsSrc replaces both skills/ and skills-library/; the pack and
# skills/ramp/ tiers still apply during the compatibility window.
$skillsRoot = $null
$skillsRootKind = $null
$canonicalSkillsSrc = $null
$compatibilityRoots = @()
if ($skillsSrcWasExplicit) {
  $canonicalSkillsSrc = Resolve-OrdinaryDirectoryRoot $SkillsSrc 'skills source root'
  if ($null -ne $canonicalSkillsSrc) {
    $skillsRoot = $canonicalSkillsSrc
    $skillsRootKind = 'skills-src'
  }
}
elseif ($null -ne $canonicalRepoRoot) {
  $skillsRoot = Join-Path $canonicalRepoRoot 'skills'
  $skillsRootKind = 'skills'
}
if ($null -ne $canonicalRepoRoot) {
  $compatibilityRoots += @{ Relative = "packs/$PackName/skills"; Kind = 'pack' }
  $compatibilityRoots += @{ Relative = 'skills/ramp'; Kind = 'ramp' }
  if (-not $skillsSrcWasExplicit) {
    $compatibilityRoots += @{ Relative = 'skills-library'; Kind = 'compatibility' }
  }
}

# Messages name a path under the repository relative to its root, with forward
# slashes, and any other path as resolved.
function Format-DisplayPath {
  param([string]$LiteralPath)
  if ($null -ne $canonicalRepoRoot) {
    $prefix = $canonicalRepoRoot.TrimEnd(
      [char[]]@(
        [char][IO.Path]::DirectorySeparatorChar,
        [char][IO.Path]::AltDirectorySeparatorChar
      )
    ) + [IO.Path]::DirectorySeparatorChar
    if ($LiteralPath.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
      return $LiteralPath.Substring($prefix.Length).Replace('\', '/')
    }
  }
  return $LiteralPath
}

$namePattern = '^[a-z0-9]+(-[a-z0-9]+)*$'
$reservedNames = @('ramp', 'README.md', 'taxonomy')
$seenNames = @{}
foreach ($skill in $Skills) {
  $validName = $true
  if ($reservedNames -ccontains $skill) {
    Add-ErrorMessage "skill name $skill is reserved: ramp, README.md and taxonomy cannot be skill names"
    $validName = $false
  }
  elseif ($skill -cnotmatch $namePattern) {
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

  $skillsRootHit = $false
  if ($null -ne $skillsRoot) {
    $null = Test-DirectoryChain $skillsRoot $skill "$skillsRootKind source"
    $skillsCandidate = Join-Path $skillsRoot $skill
    if ($null -ne (Get-LexicalItem $skillsCandidate)) {
      $selectedSource = $skillsCandidate
      $selectedKind = $skillsRootKind
      $skillsRootHit = $true
    }
  }

  # Every compatibility root is consulted so the ambiguity guard sees them all.
  foreach ($root in $compatibilityRoots) {
    $rootRelative = "$($root.Relative)/$skill"
    $rootCandidate = Join-Path $canonicalRepoRoot ($rootRelative -replace '/', [IO.Path]::DirectorySeparatorChar)
    # -SkillsSrc may name an old root itself; a directory is not ambiguous with itself.
    if ($skillsRootHit -and
        $rootCandidate.Equals($selectedSource, $PathComparison)) {
      continue
    }
    $null = Test-DirectoryChain $canonicalRepoRoot $rootRelative "$($root.Kind) source"
    if ($null -ne (Get-LexicalItem $rootCandidate)) {
      $rootDisplay = Format-DisplayPath $rootCandidate
      if ($skillsRootHit) {
        Add-ErrorMessage "skill $skill is ambiguous: found in $(Format-DisplayPath $selectedSource) and $rootDisplay; keep only one copy"
      }
      elseif ($null -eq $selectedSource) {
        $selectedSource = $rootCandidate
        $selectedKind = $root.Kind
        $Warnings.Add("skill $skill resolved from $rootDisplay; move it to skills/$skill/") | Out-Null
      }
    }
  }

  if ($null -eq $selectedSource) {
    $availableRoots = ''
    if ($null -ne $canonicalRepoRoot) {
      $availableRoots += " repository=$canonicalRepoRoot"
    }
    if ($null -ne $canonicalSkillsSrc) {
      $availableRoots += " skills-src=$canonicalSkillsSrc"
    }
    if ($null -eq $canonicalRepoRoot) {
      Add-ErrorMessage "skill '$skill' was not found.$availableRoots Pass -RepoRoot <ramp-repository-root> for pack or RAMP skills."
    }
    else {
      Add-ErrorMessage "skill '$skill' was not found in available roots:$availableRoots"
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

# Compatibility-window deprecation warnings go to stderr only.
foreach ($warning in $Warnings) {
  [Console]::Error.WriteLine("warning: $warning")
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
