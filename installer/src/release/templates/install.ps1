#Requires -Version 5.1
<#
.SYNOPSIS
Installs, upgrades, uninstalls, or rolls back this RAMP bundle without Node.

.DESCRIPTION
Mirrors install.sh: the same manifest, owner state, origin ledger, backup, and
conflict report bytes. Every source, state, and destination path is checked
before the first target write, again under a target-wide lock, and once more
immediately before each change. A failed commit restores the prior bytes.

Runs on Windows PowerShell 5.1 and on PowerShell 7.3 or later. On Windows the
canonical 0644/0755 modes are kept in state but not applied to files, and a
read-only file counts as a changed mode.
-Target is mandatory; with -NonInteractive a missing value fails instead of
prompting.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Target C:\work\project
Installs or upgrades the bundle; same as: bash install.sh --target <dir>

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Target C:\work\project -DryRun
Reports the planned paths without writing; same as: --dry-run

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Target C:\work\project -Uninstall
Removes this bundle's files that no other owner claims; same as: --uninstall

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Target C:\work\project -Rollback
Restores the previous version from its verified backup; same as: --rollback
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Target,
  [switch]$DryRun,
  [switch]$Uninstall,
  [switch]$Rollback
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ManifestName = '__MANIFEST_NAME__'
$OverlayRoot = '__OVERLAY_ROOT__'
$ConflictName = '__CONFLICT_NAME__'
$StateRoot = '__STATE_ROOT__'

$Tab = [string][char]9
$Lf = [string][char]10
$Separator = [string][System.IO.Path]::DirectorySeparatorChar
$RunningOnWindows = (
  [Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
)
$ReservedNames = @('con', 'prn', 'aux', 'nul', 'clock$')
$SemanticVersionPattern = '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'

$script:ExitCode = 0
$script:Operation = 'install'
$script:ScriptDir = ''
$script:TargetDir = ''
$script:InstalledDir = ''
$script:BackupsDir = ''
$script:OwnerState = ''
$script:OriginState = ''
$script:OwnerBackup = ''
$script:RollbackDir = ''
$script:Stopping = $false
$script:LockStream = $null
$script:LockCreated = $false
$script:RampCreated = $false
$script:InstalledCreated = $false
$script:BackupsCreated = $false
$script:Txn = ''
$script:TransactionActive = $false
$script:MutationStarted = $false
$script:TransactionRestored = $false
$script:OwnerStateMutated = $false
$script:OriginStateMutated = $false
$script:BackupMutated = $false
$script:OwnerStateOld = $false
$script:OriginStateOld = $false
$script:OwnerBackupOld = $false
$script:ActiveCustomerTemp = ''
$script:ActiveStateTemp = ''
$script:Journal = New-Object 'System.Collections.Generic.List[object]'
$script:CreatedDirs = New-Object 'System.Collections.Generic.List[string]'

function Write-InstallerError {
  param([string]$Message)
  [Console]::Error.WriteLine($Message)
}

# Ends the run through the single catch/finally frame so cleanup always runs.
function Stop-Installer {
  param([string]$Message, [int]$Code = 1)
  if ($Message.Length -gt 0) { Write-InstallerError $Message }
  $script:ExitCode = $Code
  $script:Stopping = $true
  throw 'RAMP installer stopped'
}

# A target at a drive or file-system root keeps its trailing separator: C: alone
# names the current directory of drive C.
function Join-Child {
  param([string]$Parent, [string]$Name)
  if ($Parent.EndsWith($script:Separator, [System.StringComparison]::Ordinal)) {
    return $Parent + $Name
  }
  return $Parent + $script:Separator + $Name
}

function Join-Relative {
  param([string]$Root, [string]$Relative)
  return Join-Child $Root $Relative.Replace('/', $script:Separator)
}

function Get-ParentRelative {
  param([string]$Relative)
  $cut = $Relative.LastIndexOf('/')
  if ($cut -lt 0) { return '' }
  return $Relative.Substring(0, $cut)
}

# Lexical type of a path: the final component is never followed, and a
# dangling link is a link, not an absent path.
function Get-PathKind {
  param([string]$Path)
  try {
    $attributes = [System.IO.File]::GetAttributes($Path)
  }
  catch [System.IO.FileNotFoundException] {
    return 'absent'
  }
  catch [System.IO.DirectoryNotFoundException] {
    return 'absent'
  }
  if ($attributes -band [System.IO.FileAttributes]::ReparsePoint) { return 'link' }
  if ($script:RunningOnWindows) {
    if ($attributes -band [System.IO.FileAttributes]::Directory) { return 'directory' }
    if ($attributes -band [System.IO.FileAttributes]::Device) { return 'special' }
    return 'file'
  }
  $item = Get-Item -Force -LiteralPath $Path
  $unixStat = $item.PSObject.Properties['UnixStat']
  if ($null -eq $unixStat -or $null -eq $unixStat.Value) { return 'special' }
  $type = [string]$unixStat.Value.ItemType
  if ($type -ceq 'File') { return 'file' }
  if ($type -ceq 'Directory') { return 'directory' }
  return 'special'
}

function Test-Exists {
  param([string]$Path)
  return (Get-PathKind $Path) -cne 'absent'
}

# Windows can open an 8.3 short name such as GUIDE~1.MD as an alias of a
# longer existing name; an existing component must be a real directory entry.
function Test-RealEntry {
  param([string]$Parent, [string]$Name)
  if (-not $script:RunningOnWindows) { return $true }
  foreach ($entry in [System.IO.Directory]::GetFileSystemEntries($Parent)) {
    if ([System.IO.Path]::GetFileName($entry).Equals(
        $Name,
        [System.StringComparison]::OrdinalIgnoreCase
      )) {
      return $true
    }
  }
  return $false
}

# Every existing component under Root is an ordinary directory, and the final
# one an ordinary file (install.sh ordinary_ancestry).
function Test-OrdinaryAncestry {
  param([string]$Root, [string]$Relative)
  $current = $Root
  $parts = $Relative.Split([char]'/')
  for ($index = 0; $index -lt $parts.Length; $index++) {
    $parent = $current
    $current = Join-Child $current $parts[$index]
    $kind = Get-PathKind $current
    if ($kind -ceq 'absent') { continue }
    if ($kind -ceq 'link') { return $false }
    if ($index -lt $parts.Length - 1) {
      if ($kind -cne 'directory') { return $false }
    }
    elseif ($kind -cne 'file') {
      return $false
    }
    if (-not (Test-RealEntry $parent $parts[$index])) { return $false }
  }
  return $true
}

function Test-OrdinaryDirectoryAncestry {
  param([string]$Root, [string]$Relative)
  $current = $Root
  foreach ($part in $Relative.Split([char]'/')) {
    $parent = $current
    $current = Join-Child $current $part
    $kind = Get-PathKind $current
    if ($kind -ceq 'absent') { continue }
    if ($kind -cne 'directory') { return $false }
    if (-not (Test-RealEntry $parent $part)) { return $false }
  }
  return $true
}

function Test-PortableSegment {
  param([string]$Segment)
  if ($Segment.Length -eq 0 -or $Segment -ceq '.' -or $Segment -ceq '..') {
    return $false
  }
  foreach ($character in $Segment.ToCharArray()) {
    $code = [int]$character
    if ($code -lt 0x20 -or $code -gt 0x7e) { return $false }
  }
  if ($Segment.Length -gt 255) { return $false }
  if ($Segment.IndexOfAny([char[]]'<>:"\|?*') -ge 0) { return $false }
  if ($Segment.StartsWith(' ', [System.StringComparison]::Ordinal) -or
      $Segment.EndsWith(' ', [System.StringComparison]::Ordinal) -or
      $Segment.EndsWith('.', [System.StringComparison]::Ordinal)) {
    return $false
  }
  $base = $Segment
  $dot = $Segment.IndexOf('.')
  if ($dot -ge 0) { $base = $Segment.Substring(0, $dot) }
  $lower = $base.ToLowerInvariant()
  if ($script:ReservedNames -ccontains $lower) { return $false }
  if ($lower -cmatch '^(com|lpt)[1-9]$') { return $false }
  return $true
}

function Test-PortablePath {
  param([string]$Candidate)
  if ($Candidate.Length -eq 0 -or $Candidate.Length -gt 1024) { return $false }
  if ($Candidate.StartsWith('/', [System.StringComparison]::Ordinal) -or
      $Candidate.Contains('\')) {
    return $false
  }
  $parts = $Candidate.Split([char]'/')
  if ($parts.Length -gt 64) { return $false }
  foreach ($part in $parts) {
    if (-not (Test-PortableSegment $part)) { return $false }
  }
  return $true
}

# -ceq is culture-aware: it equates names that differ by an ignorable
# character such as U+00AD, so names read from a directory compare ordinally.
function Test-OrdinalBefore {
  param([string]$Left, [string]$Right)
  return [string]::CompareOrdinal($Left, $Right) -lt 0
}

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-ModeText {
  param([string]$Path)
  if ($script:RunningOnWindows) { return '-' }
  $mode = [int][System.IO.File]::GetUnixFileMode($Path)
  return '0' + [Convert]::ToString($mode, 8)
}

function Test-ReadOnly {
  param([string]$Path)
  if (-not $script:RunningOnWindows) { return $false }
  return [bool]([System.IO.File]::GetAttributes($Path) -band [System.IO.FileAttributes]::ReadOnly)
}

# NTFS has no executable bit: the canonical mode stays in state and is never
# applied to a Windows file. Both canonical modes are owner-writable, so there
# a file matches unless its ReadOnly attribute is set, as Node maps chmod.
function Test-ModeMatches {
  param([string]$Path, [string]$Mode)
  if ($script:RunningOnWindows) { return -not (Test-ReadOnly $Path) }
  return (Get-ModeText $Path) -ceq $Mode
}

# File.Copy keeps the Windows ReadOnly attribute, which would make every later
# replace or delete of the copy fail.
function Copy-OrdinaryFile {
  param([string]$Source, [string]$Destination)
  [System.IO.File]::Copy($Source, $Destination, $false)
  if ($script:RunningOnWindows) {
    [System.IO.File]::SetAttributes($Destination, [System.IO.FileAttributes]::Normal)
  }
}

function Set-ModeText {
  param([string]$Path, [string]$Mode)
  if ($script:RunningOnWindows -or $Mode -ceq '-') { return }
  [System.IO.File]::SetUnixFileMode($Path, [Convert]::ToInt32($Mode, 8))
}

function Write-TextFile {
  param([string]$Path, [string]$Text)
  [System.IO.File]::WriteAllBytes($Path, [System.Text.Encoding]::ASCII.GetBytes($Text))
}

# Replaces or creates Destination from Source on the same filesystem.
# [NullString]::Value passes a real null: $null would arrive as ''.
function Move-OrdinaryFile {
  param([string]$Source, [string]$Destination)
  if (Test-Exists $Destination) {
    [System.IO.File]::Replace($Source, $Destination, [NullString]::Value)
  }
  else {
    [System.IO.File]::Move($Source, $Destination)
  }
}

function Remove-EmptyDirectory {
  param([string]$Path)
  if ((Get-PathKind $Path) -cne 'directory') { return $false }
  if ([System.IO.Directory]::GetFileSystemEntries($Path).Length -ne 0) { return $false }
  [System.IO.Directory]::Delete($Path, $false)
  return $true
}

# Relative paths of every file below Root, ordinally sorted, or $null when the
# tree holds anything other than ordinary files and directories.
function Get-TreeFiles {
  param([string]$Root)
  $files = New-Object 'System.Collections.Generic.List[string]'
  $pending = New-Object 'System.Collections.Generic.List[string]'
  $pending.Add('')
  while ($pending.Count -gt 0) {
    $relative = $pending[$pending.Count - 1]
    $pending.RemoveAt($pending.Count - 1)
    $directory = $Root
    if ($relative.Length -gt 0) { $directory = Join-Relative $Root $relative }
    foreach ($entry in [System.IO.Directory]::GetFileSystemEntries($directory)) {
      $name = [System.IO.Path]::GetFileName($entry)
      $child = $name
      if ($relative.Length -gt 0) { $child = $relative + '/' + $name }
      $kind = Get-PathKind $entry
      if ($kind -ceq 'file') { $files.Add($child) }
      elseif ($kind -ceq 'directory') { $pending.Add($child) }
      else { return $null }
    }
  }
  $files.Sort([System.StringComparer]::Ordinal)
  return , $files
}

function Copy-Tree {
  param([string]$Source, [string]$Destination)
  [void][System.IO.Directory]::CreateDirectory($Destination)
  foreach ($entry in [System.IO.Directory]::GetFileSystemEntries($Source)) {
    $name = [System.IO.Path]::GetFileName($entry)
    $kind = Get-PathKind $entry
    $copy = $Destination + $script:Separator + $name
    if ($kind -ceq 'directory') { Copy-Tree $entry $copy }
    elseif ($kind -ceq 'file') { Copy-OrdinaryFile $entry $copy }
    else { throw 'backup tree changed during copy' }
  }
}

# Lines of a canonical TSV file: an ordinary file of tab, LF, and printable
# ASCII bytes ending in exactly one LF per line. Type is proven before reading.
function Read-CanonicalLines {
  param([string]$Path)
  if ((Get-PathKind $Path) -cne 'file') { return $null }
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -eq 0 -or $bytes[$bytes.Length - 1] -ne 10) { return $null }
  $text = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
  if ($text -cmatch '[^\t\n\x20-\x7e]') { return $null }
  return , $text.Substring(0, $text.Length - 1).Split([char]10)
}

function Read-InstallManifest {
  param([string]$Path, [string]$ExpectedOwner)
  $lines = Read-CanonicalLines $Path
  if ($null -eq $lines -or $lines.Length -lt 5) { return $null }
  $records = New-Object 'System.Collections.Generic.List[object]'
  $folded = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
  $directories = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
  $bundle = ''
  $owner = ''
  $version = ''
  $previous = ''
  for ($index = 0; $index -lt $lines.Length; $index++) {
    $fields = $lines[$index].Split([char]9)
    if ($index -lt 4) {
      if ($fields.Length -ne 2) { return $null }
    }
    elseif ($fields.Length -ne 4) {
      return $null
    }
    if ($index -eq 0) {
      if ($fields[0] -cne 'RAMP-INSTALL-MANIFEST' -or $fields[1] -cne '1') { return $null }
    }
    elseif ($index -eq 1) {
      if ($fields[0] -cne 'bundle' -or -not (Test-PortableSegment $fields[1])) { return $null }
      $bundle = $fields[1]
    }
    elseif ($index -eq 2) {
      if ($fields[0] -cne 'owner' -or
          -not (Test-PortableSegment $fields[1]) -or
          $fields[1].StartsWith('.', [System.StringComparison]::Ordinal)) {
        return $null
      }
      $owner = $fields[1]
    }
    elseif ($index -eq 3) {
      if ($fields[0] -cne 'version' -or
          -not (Test-PortableSegment $fields[1]) -or
          $fields[1] -cnotmatch $script:SemanticVersionPattern) {
        return $null
      }
      $version = $fields[1]
    }
    else {
      $path = $fields[3]
      if ($fields[0] -cne 'file' -or
          $fields[1] -cnotmatch '^[0-9a-f]{64}$' -or
          ($fields[2] -cne '0644' -and $fields[2] -cne '0755') -or
          -not (Test-PortablePath $path)) {
        return $null
      }
      if ($previous.Length -gt 0) {
        if (-not (Test-OrdinalBefore $previous $path)) { return $null }
        if ($path.StartsWith($previous + '/', [System.StringComparison]::Ordinal)) { return $null }
      }
      if (-not $folded.Add($path.ToLowerInvariant())) { return $null }
      # A case-insensitive filesystem would merge Dir/ and dir/ into one directory.
      $directory = Get-ParentRelative $path
      while ($directory.Length -gt 0) {
        $key = $directory.ToLowerInvariant()
        if ($directories.ContainsKey($key) -and $directories[$key] -cne $directory) { return $null }
        $directories[$key] = $directory
        $directory = Get-ParentRelative $directory
      }
      $records.Add([pscustomobject]@{ Hash = $fields[1]; Mode = $fields[2]; Path = $path })
      $previous = $path
    }
  }
  foreach ($path in $folded) {
    $ancestor = Get-ParentRelative $path
    while ($ancestor.Length -gt 0) {
      if ($folded.Contains($ancestor)) { return $null }
      $ancestor = Get-ParentRelative $ancestor
    }
  }
  if ($ExpectedOwner.Length -gt 0 -and $owner -cne $ExpectedOwner) { return $null }
  return [pscustomobject]@{
    Bundle = $bundle
    Owner = $owner
    Version = $version
    Records = $records
  }
}

function Read-Origins {
  param([string]$Path)
  $lines = Read-CanonicalLines $Path
  if ($null -eq $lines) { return $null }
  $origins = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
  $previous = ''
  for ($index = 0; $index -lt $lines.Length; $index++) {
    $fields = $lines[$index].Split([char]9)
    if ($index -eq 0) {
      if ($fields.Length -ne 2 -or
          $fields[0] -cne 'RAMP-INSTALL-ORIGINS' -or
          $fields[1] -cne '1') {
        return $null
      }
      continue
    }
    if ($fields.Length -ne 3 -or
        $fields[0] -cne 'file' -or
        ($fields[1] -cne 'managed' -and $fields[1] -cne 'external') -or
        -not (Test-PortablePath $fields[2])) {
      return $null
    }
    if ($previous.Length -gt 0 -and -not (Test-OrdinalBefore $previous $fields[2])) {
      return $null
    }
    $origins[$fields[2]] = $fields[1]
    $previous = $fields[2]
  }
  return , $origins
}

function Format-Origins {
  param($Origins)
  $paths = New-Object 'System.Collections.Generic.List[string]'
  foreach ($path in $Origins.Keys) { $paths.Add($path) }
  $paths.Sort([System.StringComparer]::Ordinal)
  $builder = New-Object System.Text.StringBuilder
  [void]$builder.Append('RAMP-INSTALL-ORIGINS' + $script:Tab + '1' + $script:Lf)
  foreach ($path in $paths) {
    [void]$builder.Append('file' + $script:Tab + $Origins[$path] + $script:Tab + $path + $script:Lf)
  }
  return $builder.ToString()
}

function Find-Record {
  param($Records, [string]$Path)
  foreach ($record in $Records) {
    if ($record.Path -ceq $Path) { return $record }
  }
  return $null
}

function Get-OtherClaimCount {
  param([string]$Excluded, [string]$Path)
  $count = 0
  foreach ($claim in $script:Claims) {
    if ($claim.Owner -cne $Excluded -and $claim.Path -ceq $Path) { $count++ }
  }
  return $count
}

function Test-OtherClaimsMatch {
  param([string]$Excluded, [string]$Path, [string]$Hash, [string]$Mode)
  foreach ($claim in $script:Claims) {
    if ($claim.Owner -cne $Excluded -and $claim.Path -ceq $Path -and
        ($claim.Hash -cne $Hash -or $claim.Mode -cne $Mode)) {
      return $false
    }
  }
  return $true
}

function Get-Origin {
  param([string]$Path)
  if ($script:Origins.ContainsKey($Path)) { return $script:Origins[$Path] }
  return ''
}

function Test-PortableCollisionWithStates {
  param([string]$Desired)
  $desiredFolded = $Desired.ToLowerInvariant()
  foreach ($claim in $script:Claims) {
    if ($claim.Path -ceq $Desired) { continue }
    $otherFolded = $claim.Path.ToLowerInvariant()
    if ($otherFolded -ceq $desiredFolded) { return $true }
    if ($desiredFolded.StartsWith($otherFolded + '/', [System.StringComparison]::Ordinal)) { return $true }
    if ($otherFolded.StartsWith($desiredFolded + '/', [System.StringComparison]::Ordinal)) { return $true }
  }
  return $false
}

function Set-NewOrigin {
  param([string]$Origin, [string]$Path)
  if ($script:NewOrigins.ContainsKey($Path)) {
    return $script:NewOrigins[$Path] -ceq $Origin
  }
  $script:NewOrigins[$Path] = $Origin
  return $true
}

function Remove-NewOrigin {
  param([string]$Path)
  [void]$script:NewOrigins.Remove($Path)
}

function Copy-Origins {
  $copy = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
  foreach ($path in $script:Origins.Keys) { $copy[$path] = $script:Origins[$path] }
  return , $copy
}

function Add-Conflict {
  param([string]$Path, [string]$Reason)
  $script:Conflicts.Add($Path + $script:Tab + $Reason)
}

function Add-Plan {
  param([string]$Action, [string]$Source, [string]$Mode, [string]$Hash, [string]$Path)
  $script:Plan.Add([pscustomobject]@{
      Action = $Action
      Source = $Source
      Mode = $Mode
      Hash = $Hash
      Path = $Path
    })
}

function Test-SourceRecords {
  foreach ($record in $script:BundleRecords) {
    if (-not (Test-OrdinaryAncestry $script:OverlayDir $record.Path)) { return $false }
    $source = Join-Relative $script:OverlayDir $record.Path
    if ((Get-PathKind $source) -cne 'file') { return $false }
    if ((Get-Sha256 $source) -cne $record.Hash) { return $false }
    if (-not (Test-ModeMatches $source $record.Mode)) { return $false }
  }
  return $true
}

function Test-StateUnion {
  $folded = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
  foreach ($claim in $script:Claims) {
    $key = $claim.Path.ToLowerInvariant()
    if ($folded.ContainsKey($key)) {
      if ($folded[$key] -cne $claim.Path) { return $false }
    }
    else {
      $folded[$key] = $claim.Path
    }
  }
  foreach ($key in $folded.Keys) {
    $ancestor = Get-ParentRelative $key
    while ($ancestor.Length -gt 0) {
      if ($folded.ContainsKey($ancestor)) { return $false }
      $ancestor = Get-ParentRelative $ancestor
    }
  }
  return $true
}

function Import-InstalledState {
  $script:Claims = New-Object 'System.Collections.Generic.List[object]'
  $script:Origins = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
  $stateCount = 0
  $installedKind = Get-PathKind $script:InstalledDir
  if ($installedKind -cne 'absent') {
    if ($installedKind -cne 'directory') { return $false }
    $names = New-Object 'System.Collections.Generic.List[string]'
    foreach ($entry in [System.IO.Directory]::GetFileSystemEntries($script:InstalledDir)) {
      $name = [System.IO.Path]::GetFileName($entry)
      $kind = Get-PathKind $entry
      # Every commit replaces state files, which Windows refuses when read-only.
      if ([string]::Equals($name, '.origins.tsv', [System.StringComparison]::Ordinal)) {
        if ($kind -cne 'file' -or (Test-ReadOnly $entry)) { return $false }
        continue
      }
      if ($name.StartsWith('.', [System.StringComparison]::Ordinal)) { return $false }
      if (-not $name.EndsWith('.tsv', [System.StringComparison]::Ordinal)) { return $false }
      if ($kind -cne 'file' -or (Test-ReadOnly $entry)) { return $false }
      $names.Add($name)
    }
    $names.Sort([System.StringComparer]::Ordinal)
    foreach ($name in $names) {
      $stateOwner = $name.Substring(0, $name.Length - 4)
      if (-not (Test-PortableSegment $stateOwner) -or $stateOwner -ceq '.origins') {
        return $false
      }
      $parsed = Read-InstallManifest ($script:InstalledDir + $script:Separator + $name) $stateOwner
      if ($null -eq $parsed) { return $false }
      foreach ($record in $parsed.Records) {
        $script:Claims.Add([pscustomobject]@{
            Owner = $stateOwner
            Hash = $record.Hash
            Mode = $record.Mode
            Path = $record.Path
          })
      }
      $stateCount++
    }
  }
  if ($stateCount -gt 0) {
    if (-not (Test-StateUnion)) {
      Write-InstallerError 'error: portable collision in installed owner state'
      return $false
    }
    $origins = Read-Origins $script:OriginState
    if ($null -eq $origins) { return $false }
    $script:Origins = $origins
    foreach ($claim in $script:Claims) {
      if ((Get-Origin $claim.Path).Length -eq 0) { return $false }
      if (-not (Test-OrdinaryAncestry $script:TargetDir $claim.Path)) { return $false }
      $destination = Join-Relative $script:TargetDir $claim.Path
      if ((Get-PathKind $destination) -cne 'file') { return $false }
      if ((Get-Sha256 $destination) -cne $claim.Hash) { return $false }
      if (-not (Test-ModeMatches $destination $claim.Mode)) { return $false }
    }
    foreach ($path in $script:Origins.Keys) {
      $claimed = $false
      foreach ($claim in $script:Claims) {
        if ($claim.Path -ceq $path) { $claimed = $true; break }
      }
      if (-not $claimed) { return $false }
    }
  }
  elseif (Test-Exists $script:OriginState) {
    return $false
  }
  return $true
}

function Initialize-Plan {
  $script:Plan = New-Object 'System.Collections.Generic.List[object]'
  $script:Conflicts = New-Object 'System.Collections.Generic.List[string]'
  $script:NewOrigins = Copy-Origins
}

function New-InstallPlan {
  Initialize-Plan
  $current = $null
  if (Test-Exists $script:OwnerState) {
    $current = Read-InstallManifest $script:OwnerState $script:Owner
    if ($null -eq $current) { return $false }
    if ($current.Version -ceq $script:BundleVersion -and
        (Get-Sha256 $script:OwnerState) -cne (Get-Sha256 $script:ManifestPath)) {
      Add-Conflict $script:Owner 'same version has different manifest'
    }
  }
  foreach ($record in $script:BundleRecords) {
    $path = $record.Path
    if (Test-PortableCollisionWithStates $path) {
      Add-Conflict $path 'portable path collides with another owner'
      continue
    }
    if (-not (Test-OrdinaryAncestry $script:TargetDir $path)) {
      Add-Conflict $path 'unsafe destination'
      continue
    }
    $destination = Join-Relative $script:TargetDir $path
    $old = $null
    if ($null -ne $current) { $old = Find-Record $current.Records $path }
    $otherCount = Get-OtherClaimCount $script:Owner $path
    $kind = Get-PathKind $destination
    if ($kind -cne 'absent') {
      if ($kind -cne 'file') {
        Add-Conflict $path 'destination is not an ordinary file'
        continue
      }
      $actualHash = Get-Sha256 $destination
      if ($null -ne $old) {
        if ($actualHash -cne $old.Hash -or -not (Test-ModeMatches $destination $old.Mode)) {
          Add-Conflict $path 'owned file was modified'
        }
        elseif ($record.Hash -ceq $old.Hash -and $record.Mode -ceq $old.Mode) {
          Add-Plan 'keep' 'bundle' $record.Mode $record.Hash $path
        }
        elseif ((Get-Origin $path) -ceq 'external') {
          Add-Conflict $path 'external-origin file is adopt-only'
        }
        elseif (-not (Test-OtherClaimsMatch $script:Owner $path $record.Hash $record.Mode)) {
          Add-Conflict $path 'another owner requires different content'
        }
        else {
          Add-Plan 'write' 'bundle' $record.Mode $record.Hash $path
        }
      }
      elseif ($actualHash -ceq $record.Hash -and (Test-ModeMatches $destination $record.Mode)) {
        if (-not (Test-OtherClaimsMatch $script:Owner $path $record.Hash $record.Mode)) {
          Add-Conflict $path 'another owner claim is inconsistent'
        }
        else {
          Add-Plan 'keep' 'bundle' $record.Mode $record.Hash $path
        }
      }
      else {
        Add-Conflict $path 'customer file differs'
      }
      if ($otherCount -gt 0) {
        $inherited = Get-Origin $path
        if ($inherited.Length -eq 0) { Add-Conflict $path 'shared path has no origin' }
        if (-not (Set-NewOrigin $inherited $path)) { Add-Conflict $path 'origin mismatch' }
      }
      elseif ($null -ne $old) {
        if (-not (Set-NewOrigin (Get-Origin $path) $path)) { Add-Conflict $path 'origin mismatch' }
      }
      elseif (-not (Set-NewOrigin 'external' $path)) {
        Add-Conflict $path 'origin mismatch'
      }
    }
    elseif ($otherCount -gt 0 -or $null -ne $old) {
      Add-Conflict $path 'claimed destination is missing'
    }
    else {
      Add-Plan 'write' 'bundle' $record.Mode $record.Hash $path
      if (-not (Set-NewOrigin 'managed' $path)) { Add-Conflict $path 'origin mismatch' }
    }
  }

  if ($null -ne $current) {
    foreach ($record in $current.Records) {
      if ($null -ne (Find-Record $script:BundleRecords $record.Path)) { continue }
      if ((Get-OtherClaimCount $script:Owner $record.Path) -gt 0) {
        Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
      }
      elseif ((Get-Origin $record.Path) -ceq 'external') {
        Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
        Remove-NewOrigin $record.Path
      }
      else {
        Add-Plan 'remove' 'current' $record.Mode $record.Hash $record.Path
        Remove-NewOrigin $record.Path
      }
    }
  }
  return $true
}

function New-UninstallPlan {
  Initialize-Plan
  $current = Read-InstallManifest $script:OwnerState $script:Owner
  if ($null -eq $current) { return $false }
  foreach ($record in $current.Records) {
    if ((Get-OtherClaimCount $script:Owner $record.Path) -gt 0) {
      Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
    }
    elseif ((Get-Origin $record.Path) -ceq 'managed') {
      Add-Plan 'remove' 'current' $record.Mode $record.Hash $record.Path
      Remove-NewOrigin $record.Path
    }
    else {
      Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
      Remove-NewOrigin $record.Path
    }
  }
  return $true
}

function Write-ConflictReport {
  if ($script:Conflicts.Count -eq 0) { return }
  $kind = Get-PathKind $script:ConflictPath
  if ($kind -cne 'absent' -and $kind -cne 'file') {
    Stop-Installer 'error: conflict report path is unsafe'
  }
  $lines = New-Object 'System.Collections.Generic.List[string]'
  foreach ($line in $script:Conflicts) { $lines.Add($line) }
  $lines.Sort([System.StringComparer]::Ordinal)
  $text = ($lines -join $script:Lf) + $script:Lf
  $report = $script:ScriptDir + $script:Separator + '.ramp-conflicts.' + $PID
  try {
    $stream = [System.IO.File]::Open(
      $report,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    try {
      $bytes = [System.Text.Encoding]::ASCII.GetBytes($text)
      $stream.Write($bytes, 0, $bytes.Length)
    }
    finally {
      $stream.Dispose()
    }
    Move-OrdinaryFile $report $script:ConflictPath
  }
  catch {
    if ((Get-PathKind $report) -ceq 'file') { [System.IO.File]::Delete($report) }
    foreach ($line in $lines) { Write-InstallerError ('conflict: ' + $line) }
    Stop-Installer 'error: installation conflicts; the report could not be written'
  }
  Stop-Installer "error: installation conflicts; see $script:ConflictName"
}

function New-Backup {
  param(
    [string]$Stage,
    $OldRecords,
    [string]$OldBundle,
    [string]$OldVersion,
    [string]$NewVersion,
    [string]$SourceRoot
  )
  [void][System.IO.Directory]::CreateDirectory($Stage + $script:Separator + 'overlay')
  Copy-OrdinaryFile $script:OwnerState (Join-Relative $Stage 'install-files.tsv')
  Copy-OrdinaryFile $script:OriginState (Join-Relative $Stage 'origins.tsv')
  Write-TextFile (Join-Relative $Stage 'backup-meta.tsv') (
    'RAMP-INSTALL-BACKUP' + $script:Tab + '1' + $script:Lf +
    'owner' + $script:Tab + $script:Owner + $script:Lf +
    'from-bundle' + $script:Tab + $OldBundle + $script:Lf +
    'from-version' + $script:Tab + $OldVersion + $script:Lf +
    'to-bundle' + $script:Tab + $script:BundleId + $script:Lf +
    'to-version' + $script:Tab + $NewVersion + $script:Lf
  )
  foreach ($name in @('install-files.tsv', 'origins.tsv', 'backup-meta.tsv')) {
    Set-ModeText (Join-Relative $Stage $name) '0644'
  }
  foreach ($record in $OldRecords) {
    $copy = Join-Relative $Stage ('overlay/' + $record.Path)
    [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($copy))
    Copy-OrdinaryFile (Join-Relative $SourceRoot $record.Path) $copy
    Set-ModeText $copy $record.Mode
  }
  $files = Get-TreeFiles $Stage
  if ($null -eq $files) { throw 'backup stage holds an unexpected entry' }
  $builder = New-Object System.Text.StringBuilder
  foreach ($file in $files) {
    [void]$builder.Append((Get-Sha256 (Join-Relative $Stage $file)) + '  ' + $file + $script:Lf)
  }
  $sums = Join-Relative $Stage 'SHA256SUMS'
  Write-TextFile $sums $builder.ToString()
  Set-ModeText $sums '0644'
}

function Find-Backup {
  $script:RollbackDir = ''
  $count = 0
  $kind = Get-PathKind $script:OwnerBackup
  if ($kind -cne 'absent') {
    if ($kind -cne 'directory') { return $false }
    foreach ($candidate in [System.IO.Directory]::GetFileSystemEntries($script:OwnerBackup)) {
      if ((Get-PathKind $candidate) -cne 'directory') { return $false }
      $generation = [System.IO.Path]::GetFileName($candidate)
      if (-not (Test-PortableSegment $generation)) { return $false }
      if ($generation.StartsWith('.', [System.StringComparison]::Ordinal)) { return $false }
      $script:RollbackDir = $candidate
      $count++
    }
  }
  return $count -eq 1
}

function Test-SameList {
  param($Left, $Right)
  if ($Left.Count -ne $Right.Count) { return $false }
  for ($index = 0; $index -lt $Left.Count; $index++) {
    if (-not [string]::Equals($Left[$index], $Right[$index], [System.StringComparison]::Ordinal)) {
      return $false
    }
  }
  return $true
}

function Test-Backup {
  param(
    $Previous,
    [string]$CurrentBundle,
    [string]$CurrentVersion
  )
  $root = $script:RollbackDir
  foreach ($required in @('SHA256SUMS', 'install-files.tsv', 'origins.tsv', 'backup-meta.tsv')) {
    $path = Join-Relative $root $required
    if ((Get-PathKind $path) -cne 'file') { return $false }
    if (-not (Test-ModeMatches $path '0644')) { return $false }
  }
  $actual = Get-TreeFiles $root
  if ($null -eq $actual) { return $false }
  [void]$actual.Remove('SHA256SUMS')
  $meta = Read-CanonicalLines (Join-Relative $root 'backup-meta.tsv')
  if ($null -eq $meta -or $meta.Length -ne 6) { return $false }
  $expectedMeta = @(
    @('RAMP-INSTALL-BACKUP', '1'),
    @('owner', $script:Owner),
    @('from-bundle', $Previous.Bundle),
    @('from-version', $Previous.Version),
    @('to-bundle', $CurrentBundle),
    @('to-version', $CurrentVersion)
  )
  for ($index = 0; $index -lt 6; $index++) {
    $fields = $meta[$index].Split([char]9)
    if ($fields.Length -ne 2 -or
        $fields[0] -cne $expectedMeta[$index][0] -or
        $fields[1] -cne $expectedMeta[$index][1]) {
      return $false
    }
  }
  $expected = New-Object 'System.Collections.Generic.List[string]'
  foreach ($name in @('backup-meta.tsv', 'install-files.tsv', 'origins.tsv')) { $expected.Add($name) }
  foreach ($record in $Previous.Records) { $expected.Add('overlay/' + $record.Path) }
  $expected.Sort([System.StringComparer]::Ordinal)
  if (-not (Test-SameList $actual $expected)) { return $false }
  $sums = Read-CanonicalLines (Join-Relative $root 'SHA256SUMS')
  if ($null -eq $sums) { return $false }
  $listed = New-Object 'System.Collections.Generic.List[string]'
  $prior = ''
  foreach ($line in $sums) {
    if ($line.Length -lt 67) { return $false }
    $hash = $line.Substring(0, 64)
    if ($hash -cnotmatch '^[0-9a-f]{64}$') { return $false }
    if ($line.Substring(64, 2) -cne '  ') { return $false }
    $path = $line.Substring(66)
    if (-not (Test-PortablePath $path) -or $path -ceq 'SHA256SUMS') { return $false }
    if ($prior.Length -gt 0 -and -not (Test-OrdinalBefore $prior $path)) { return $false }
    $prior = $path
    if (-not (Test-OrdinaryAncestry $root $path)) { return $false }
    $file = Join-Relative $root $path
    if ((Get-PathKind $file) -cne 'file') { return $false }
    if ((Get-Sha256 $file) -cne $hash) { return $false }
    $listed.Add($path)
  }
  if (-not (Test-SameList $listed $expected)) { return $false }
  if (-not [string]::Equals(
      [System.IO.Path]::GetFileName($root),
      $Previous.Version,
      [System.StringComparison]::Ordinal
    )) {
    return $false
  }
  foreach ($record in $Previous.Records) {
    if (-not (Test-ModeMatches (Join-Relative $root ('overlay/' + $record.Path)) $record.Mode)) {
      return $false
    }
  }
  return $true
}

function New-RollbackPlan {
  Initialize-Plan
  $current = Read-InstallManifest $script:OwnerState $script:Owner
  if ($null -eq $current) { return $false }
  if (-not (Find-Backup)) { return $false }
  $previous = Read-InstallManifest (Join-Relative $script:RollbackDir 'install-files.tsv') $script:Owner
  if ($null -eq $previous) { return $false }
  if (-not (Test-Backup $previous $current.Bundle $current.Version)) { return $false }
  $backupOrigins = Read-Origins (Join-Relative $script:RollbackDir 'origins.tsv')
  if ($null -eq $backupOrigins) { return $false }
  foreach ($record in $current.Records) {
    if ($null -eq (Find-Record $previous.Records $record.Path) -and
        (Get-OtherClaimCount $script:Owner $record.Path) -eq 0) {
      Remove-NewOrigin $record.Path
    }
  }
  foreach ($record in $previous.Records) {
    if (-not $backupOrigins.ContainsKey($record.Path)) { return $false }
    $backupOrigin = $backupOrigins[$record.Path]
    $liveOrigin = Get-Origin $record.Path
    if ($liveOrigin.Length -gt 0 -and $liveOrigin -cne $backupOrigin) {
      Add-Conflict $record.Path 'rollback origin disagrees with live owners'
    }
    elseif (-not (Set-NewOrigin $backupOrigin $record.Path)) {
      Add-Conflict $record.Path 'rollback origin mismatch'
    }
  }
  $overlay = Join-Relative $script:RollbackDir 'overlay'
  foreach ($record in $previous.Records) {
    $path = $record.Path
    if (-not (Test-OrdinaryAncestry $overlay $path)) { return $false }
    $source = Join-Relative $overlay $path
    if ((Get-PathKind $source) -cne 'file') { return $false }
    if ((Get-Sha256 $source) -cne $record.Hash) { return $false }
    $currentRecord = Find-Record $current.Records $path
    $destination = Join-Relative $script:TargetDir $path
    if ($null -ne $currentRecord) {
      if ($currentRecord.Hash -ceq $record.Hash -and $currentRecord.Mode -ceq $record.Mode) {
        Add-Plan 'keep' 'backup' $record.Mode $record.Hash $path
      }
      elseif (-not (Test-OtherClaimsMatch $script:Owner $path $record.Hash $record.Mode)) {
        Add-Conflict $path 'another owner blocks rollback'
      }
      else {
        Add-Plan 'write' 'backup' $record.Mode $record.Hash $path
      }
    }
    elseif (Test-PortableCollisionWithStates $path) {
      Add-Conflict $path 'portable path collides with another owner'
    }
    elseif (-not (Test-OrdinaryAncestry $script:TargetDir $path)) {
      Add-Conflict $path 'unsafe destination'
    }
    elseif (Test-Exists $destination) {
      if ((Get-Sha256 $destination) -ceq $record.Hash -and
          (Test-ModeMatches $destination $record.Mode) -and
          (Test-OtherClaimsMatch $script:Owner $path $record.Hash $record.Mode)) {
        Add-Plan 'keep' 'backup' $record.Mode $record.Hash $path
      }
      else {
        Add-Conflict $path 'rollback destination differs'
      }
    }
    else {
      Add-Plan 'write' 'backup' $record.Mode $record.Hash $path
    }
  }
  foreach ($record in $current.Records) {
    if ($null -ne (Find-Record $previous.Records $record.Path)) { continue }
    if ((Get-OtherClaimCount $script:Owner $record.Path) -gt 0) {
      Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
    }
    elseif ((Get-Origin $record.Path) -ceq 'managed') {
      Add-Plan 'remove' 'current' $record.Mode $record.Hash $record.Path
    }
    else {
      Add-Plan 'keep' 'current' $record.Mode $record.Hash $record.Path
    }
  }
  return $true
}

function Invoke-Preflight {
  if (-not (Test-SourceRecords)) { return $false }
  if (-not (Import-InstalledState)) { return $false }
  if ($script:Operation -ceq 'uninstall') { return New-UninstallPlan }
  if ($script:Operation -ceq 'rollback') { return New-RollbackPlan }
  return New-InstallPlan
}

function Add-MissingDirectories {
  param([string]$Path)
  $parent = Get-ParentRelative $Path
  if ($parent.Length -eq 0) { return }
  $current = ''
  foreach ($part in $parent.Split([char]'/')) {
    if ($current.Length -gt 0) { $current = $current + '/' + $part } else { $current = $part }
    $kind = Get-PathKind (Join-Relative $script:TargetDir $current)
    if ($kind -ceq 'absent') {
      $script:CreatedDirs.Add($current)
    }
    elseif ($kind -cne 'directory') {
      Stop-Installer 'error: unsafe destination directory'
    }
  }
}

function Test-OwnerBackupRecheck {
  if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir ($script:StateRoot + '/backups'))) {
    return $false
  }
  if ($script:OwnerBackupOld) {
    if ((Get-PathKind $script:OwnerBackup) -cne 'directory') { return $false }
    if (-not (Find-Backup)) { return $false }
    return Test-Backup $script:PreviousCheck $script:CurrentCheck.Bundle $script:CurrentCheck.Version
  }
  return -not (Test-Exists $script:OwnerBackup)
}

function Restore-Transaction {
  $restoreFailed = $false
  if ($script:ActiveCustomerTemp.Length -gt 0) {
    try {
      if (Test-OrdinaryAncestry $script:TargetDir $script:ActiveCustomerTemp) {
        [System.IO.File]::Delete((Join-Relative $script:TargetDir $script:ActiveCustomerTemp))
      }
      else {
        $restoreFailed = $true
      }
    }
    catch { $restoreFailed = $true }
    $script:ActiveCustomerTemp = ''
  }
  if ($script:ActiveStateTemp.Length -gt 0) {
    try {
      if (Test-OrdinaryDirectoryAncestry $script:TargetDir ($script:StateRoot + '/installed')) {
        [System.IO.File]::Delete($script:ActiveStateTemp)
      }
      else {
        $restoreFailed = $true
      }
    }
    catch { $restoreFailed = $true }
    $script:ActiveStateTemp = ''
  }
  foreach ($entry in $script:Journal) {
    $destination = Join-Relative $script:TargetDir $entry.Path
    try {
      if (-not (Test-OrdinaryAncestry $script:TargetDir $entry.Path)) {
        $restoreFailed = $true
        continue
      }
      if ($entry.Prior -ceq 'present') {
        [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination))
        $temporary = $destination + '.ramp-restore.' + $PID
        if (Test-Exists $temporary) {
          $restoreFailed = $true
          continue
        }
        try {
          Copy-OrdinaryFile (Join-Relative ($script:Txn + $script:Separator + 'old') $entry.Path) $temporary
          Set-ModeText $temporary $entry.Mode
          if (-not (Test-OrdinaryAncestry $script:TargetDir $entry.Path)) { throw 'unsafe restore destination' }
          Move-OrdinaryFile $temporary $destination
        }
        catch {
          if ((Get-PathKind $temporary) -ceq 'file') { [System.IO.File]::Delete($temporary) }
          $restoreFailed = $true
        }
      }
      else {
        # A planned file may sit in a folder the commit never created.
        $kind = Get-PathKind $destination
        if ($kind -ceq 'file') { [System.IO.File]::Delete($destination) }
        elseif ($kind -cne 'absent') { $restoreFailed = $true }
      }
    }
    catch { $restoreFailed = $true }
  }
  $directories = New-Object 'System.Collections.Generic.List[string]'
  foreach ($directory in $script:CreatedDirs) {
    if (-not $directories.Contains($directory)) { $directories.Add($directory) }
  }
  $directories.Sort([System.StringComparer]::Ordinal)
  $directories.Reverse()
  foreach ($directory in $directories) {
    try {
      if (Test-OrdinaryDirectoryAncestry $script:TargetDir $directory) {
        [void](Remove-EmptyDirectory (Join-Relative $script:TargetDir $directory))
      }
    }
    catch { }
  }

  $installedRelative = $script:StateRoot + '/installed'
  if ($script:OwnerStateMutated) {
    try {
      if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative)) { $restoreFailed = $true }
      if (-not $restoreFailed) {
        $kind = Get-PathKind $script:OwnerState
        if ($kind -cne 'absent' -and $kind -cne 'file') { $restoreFailed = $true }
      }
      if (-not $restoreFailed) {
        if ($script:OwnerStateOld) {
          $temporary = $script:InstalledDir + $script:Separator + $script:Owner + '.tsv.restore.' + $PID
          if (Test-Exists $temporary) { throw 'restore temporary exists' }
          Copy-OrdinaryFile (Join-Relative $script:Txn 'state.old/owner.tsv') $temporary
          Move-OrdinaryFile $temporary $script:OwnerState
        }
        else {
          [System.IO.File]::Delete($script:OwnerState)
        }
      }
    }
    catch { $restoreFailed = $true }
  }

  if ($script:OriginStateMutated) {
    try {
      if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative)) { $restoreFailed = $true }
      if (-not $restoreFailed) {
        $kind = Get-PathKind $script:OriginState
        if ($kind -cne 'absent' -and $kind -cne 'file') { $restoreFailed = $true }
      }
      if (-not $restoreFailed) {
        if ($script:OriginStateOld) {
          $temporary = $script:InstalledDir + $script:Separator + '.origins.tsv.restore.' + $PID
          if (Test-Exists $temporary) { throw 'restore temporary exists' }
          Copy-OrdinaryFile (Join-Relative $script:Txn 'state.old/origins.tsv') $temporary
          Move-OrdinaryFile $temporary $script:OriginState
        }
        else {
          [System.IO.File]::Delete($script:OriginState)
        }
      }
    }
    catch { $restoreFailed = $true }
  }

  if ($script:BackupMutated) {
    try {
      if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir ($script:StateRoot + '/backups'))) {
        $restoreFailed = $true
      }
      if (-not $restoreFailed) {
        $kind = Get-PathKind $script:OwnerBackup
        if ($kind -cne 'absent' -and $kind -cne 'directory') { $restoreFailed = $true }
      }
      if (-not $restoreFailed) {
        if ((Get-PathKind $script:OwnerBackup) -ceq 'directory') {
          [System.IO.Directory]::Delete($script:OwnerBackup, $true)
        }
        if ($script:OwnerBackupOld) {
          Copy-Tree (Join-Relative $script:Txn 'backup.old') $script:OwnerBackup
        }
      }
    }
    catch { $restoreFailed = $true }
  }
  if ($restoreFailed) { return $false }
  $script:TransactionRestored = $true
  return $true
}

function Invoke-Cleanup {
  if ($script:InstalledDir.Length -eq 0) { return }
  if ($script:ActiveCustomerTemp.Length -gt 0) {
    try {
      if (Test-OrdinaryAncestry $script:TargetDir $script:ActiveCustomerTemp) {
        [System.IO.File]::Delete((Join-Relative $script:TargetDir $script:ActiveCustomerTemp))
      }
    }
    catch { }
    $script:ActiveCustomerTemp = ''
  }
  if ($script:ActiveStateTemp.Length -gt 0) {
    try {
      if (Test-OrdinaryDirectoryAncestry $script:TargetDir ($script:StateRoot + '/installed')) {
        [System.IO.File]::Delete($script:ActiveStateTemp)
      }
    }
    catch { }
    $script:ActiveStateTemp = ''
  }
  if ($script:TransactionActive -and $script:Txn.Length -gt 0) {
    if ($script:MutationStarted -and -not $script:TransactionRestored) {
      try { [void](Restore-Transaction) } catch { }
    }
    try {
      if ((Get-PathKind $script:Txn) -ceq 'directory') { [System.IO.Directory]::Delete($script:Txn, $true) }
    }
    catch { }
    $script:TransactionActive = $false
  }
  $ramp = Join-Relative $script:TargetDir $script:StateRoot
  if ($script:LockCreated) {
    try {
      $script:LockStream.Dispose()
      [System.IO.File]::Delete($ramp + $script:Separator + 'install.lock')
    }
    catch { }
  }
  try {
    if ($script:RampCreated) {
      [void](Remove-EmptyDirectory $script:InstalledDir)
      [void](Remove-EmptyDirectory $script:BackupsDir)
      [void](Remove-EmptyDirectory $ramp)
    }
    else {
      if ($script:InstalledCreated) { [void](Remove-EmptyDirectory $script:InstalledDir) }
      if ($script:BackupsCreated) { [void](Remove-EmptyDirectory $script:BackupsDir) }
    }
  }
  catch { }
}

function Resolve-TargetDirectory {
  $message = 'error: target must be an existing ordinary directory'
  foreach ($part in $Target.Split([char[]]'/\')) {
    if ($part -ceq '..') { Stop-Installer $message }
  }
  $provider = $null
  $drive = $null
  $path = $PSCmdlet.SessionState.Path.GetUnresolvedProviderPathFromPSPath(
    $Target,
    [ref]$provider,
    [ref]$drive
  )
  if ($provider.Name -cne 'FileSystem' -or
      $path.StartsWith('\\?\', [System.StringComparison]::Ordinal) -or
      $path.StartsWith('\\.\', [System.StringComparison]::Ordinal)) {
    Stop-Installer $message
  }
  $path = [System.IO.Path]::GetFullPath($path)
  $root = [System.IO.Path]::GetPathRoot($path)
  if ($path.Length -gt $root.Length) {
    $path = $path.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
      ))
  }
  if ((Get-PathKind $path) -cne 'directory') { Stop-Installer $message }
  return $path
}

function Invoke-Installer {
  if ($ExecutionContext.SessionState.LanguageMode -cne 'FullLanguage') {
    Stop-Installer 'error: the installer requires PowerShell FullLanguage mode'
  }
  if (-not $script:RunningOnWindows -and
      $null -eq [System.IO.File].GetMethod('GetUnixFileMode', [type[]]@([string]))) {
    Stop-Installer 'error: PowerShell 7.3 or later is required on this platform; or use install.sh'
  }
  $selected = 0
  foreach ($flag in @($DryRun, $Uninstall, $Rollback)) {
    if ($flag) { $selected++ }
  }
  if ($selected -gt 1) { Stop-Installer 'error: operation flags are mutually exclusive' 2 }
  $script:Operation = 'install'
  if ($DryRun) { $script:Operation = 'dry-run' }
  if ($Uninstall) { $script:Operation = 'uninstall' }
  if ($Rollback) { $script:Operation = 'rollback' }

  if ((Get-PathKind $PSCommandPath) -cne 'file') {
    Stop-Installer 'error: installer script must not be a symbolic link'
  }
  $script:ScriptDir = [System.IO.Path]::GetDirectoryName($PSCommandPath)
  $script:ManifestPath = $script:ScriptDir + $script:Separator + $script:ManifestName
  $script:OverlayDir = $script:ScriptDir + $script:Separator + $script:OverlayRoot
  $script:ConflictPath = $script:ScriptDir + $script:Separator + $script:ConflictName

  $script:TargetDir = Resolve-TargetDirectory
  if ((Get-PathKind $script:OverlayDir) -cne 'directory') {
    Stop-Installer 'error: bundle overlay must be an ordinary directory'
  }
  if ((Get-PathKind $script:ManifestPath) -cne 'file') {
    Stop-Installer 'error: install manifest must be an ordinary file'
  }

  $manifest = Read-InstallManifest $script:ManifestPath ''
  if ($null -eq $manifest) { Stop-Installer 'error: invalid install manifest' }
  $script:BundleRecords = $manifest.Records
  $script:BundleId = $manifest.Bundle
  $script:Owner = $manifest.Owner
  $script:BundleVersion = $manifest.Version
  $ramp = Join-Relative $script:TargetDir $script:StateRoot
  $script:InstalledDir = $ramp + $script:Separator + 'installed'
  $script:BackupsDir = $ramp + $script:Separator + 'backups'
  $script:OwnerState = $script:InstalledDir + $script:Separator + $script:Owner + '.tsv'
  $script:OriginState = $script:InstalledDir + $script:Separator + '.origins.tsv'
  $script:OwnerBackup = $script:BackupsDir + $script:Separator + $script:Owner

  if (-not (Invoke-Preflight)) { Stop-Installer 'error: installer preflight failed' }
  Write-ConflictReport
  if ($script:Operation -ceq 'dry-run') {
    [Console]::Out.WriteLine("RAMP dry run: $($script:Plan.Count) planned paths")
    return
  }

  $rampKind = Get-PathKind $ramp
  if ($rampKind -ceq 'absent') {
    [void][System.IO.Directory]::CreateDirectory($ramp)
    $script:RampCreated = $true
  }
  elseif ($rampKind -cne 'directory') {
    Stop-Installer 'error: unsafe state root'
  }
  $installedKind = Get-PathKind $script:InstalledDir
  if ($installedKind -ceq 'absent') {
    [void][System.IO.Directory]::CreateDirectory($script:InstalledDir)
    $script:InstalledCreated = $true
  }
  elseif ($installedKind -cne 'directory') {
    Stop-Installer 'error: unsafe state root'
  }
  $backupsKind = Get-PathKind $script:BackupsDir
  if ($backupsKind -ceq 'absent') {
    [void][System.IO.Directory]::CreateDirectory($script:BackupsDir)
    $script:BackupsCreated = $true
  }
  elseif ($backupsKind -cne 'directory') {
    Stop-Installer 'error: unsafe state root'
  }
  # CreateNew is the atomic primitive; install.sh's mkdir of the same name
  # fails on this file, and CreateNew fails on its directory.
  try {
    $script:LockStream = [System.IO.File]::Open(
      ($ramp + $script:Separator + 'install.lock'),
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  }
  catch {
    Stop-Installer 'error: another RAMP installer holds the target lock'
  }
  $script:LockCreated = $true

  if (-not (Invoke-Preflight)) { Stop-Installer 'error: locked installer preflight failed' }
  Write-ConflictReport

  $staging = 'error: install transaction could not be staged'
  $script:Txn = $ramp + $script:Separator + '.transaction.' + $PID
  if (Test-Exists $script:Txn) { Stop-Installer $staging }
  foreach ($name in @('old', 'new', 'state.old')) {
    [void][System.IO.Directory]::CreateDirectory($script:Txn + $script:Separator + $name)
  }
  $script:TransactionActive = $true
  $ownerStateKind = Get-PathKind $script:OwnerState
  if ($ownerStateKind -cne 'absent') {
    if ($ownerStateKind -cne 'file') { Stop-Installer $staging }
    Copy-OrdinaryFile $script:OwnerState (Join-Relative $script:Txn 'state.old/owner.tsv')
    $script:OwnerStateOld = $true
  }
  $originStateKind = Get-PathKind $script:OriginState
  if ($originStateKind -cne 'absent') {
    if ($originStateKind -cne 'file') { Stop-Installer $staging }
    Copy-OrdinaryFile $script:OriginState (Join-Relative $script:Txn 'state.old/origins.tsv')
    $script:OriginStateOld = $true
  }
  if (Test-Exists $script:OwnerBackup) {
    $script:CurrentCheck = Read-InstallManifest $script:OwnerState $script:Owner
    if ($null -eq $script:CurrentCheck) { Stop-Installer $staging }
    if (-not (Find-Backup)) { Stop-Installer $staging }
    $script:PreviousCheck = Read-InstallManifest (Join-Relative $script:RollbackDir 'install-files.tsv') $script:Owner
    if ($null -eq $script:PreviousCheck) { Stop-Installer $staging }
    if (-not (Test-Backup $script:PreviousCheck $script:CurrentCheck.Bundle $script:CurrentCheck.Version)) {
      Stop-Installer $staging
    }
    Copy-Tree $script:RollbackDir (Join-Relative $script:Txn ('backup.old/' + $script:PreviousCheck.Version))
    $script:OwnerBackupOld = $true
  }
  foreach ($entry in $script:Plan) {
    if ($entry.Action -ceq 'write' -or $entry.Action -ceq 'remove') {
      $destination = Join-Relative $script:TargetDir $entry.Path
      if (Test-Exists $destination) {
        $old = Join-Relative ($script:Txn + $script:Separator + 'old') $entry.Path
        [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($old))
        Copy-OrdinaryFile $destination $old
        $script:Journal.Add([pscustomobject]@{ Prior = 'present'; Mode = (Get-ModeText $destination); Path = $entry.Path })
      }
      else {
        $script:Journal.Add([pscustomobject]@{ Prior = 'absent'; Mode = '-'; Path = $entry.Path })
      }
    }
    if ($entry.Action -ceq 'write') {
      Add-MissingDirectories $entry.Path
      if ($entry.Source -ceq 'bundle') {
        $source = Join-Relative $script:OverlayDir $entry.Path
      }
      elseif ($entry.Source -ceq 'backup') {
        $source = Join-Relative $script:RollbackDir ('overlay/' + $entry.Path)
      }
      else {
        Stop-Installer $staging
      }
      $new = Join-Relative ($script:Txn + $script:Separator + 'new') $entry.Path
      [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($new))
      Copy-OrdinaryFile $source $new
      Set-ModeText $new $entry.Mode
      if ((Get-Sha256 $new) -cne $entry.Hash) { Stop-Installer $staging }
    }
  }

  $upgradeStage = ''
  $upgradeOldVersion = ''
  if ($script:Operation -ceq 'install' -and (Test-Exists $script:OwnerState)) {
    $old = Read-InstallManifest $script:OwnerState $script:Owner
    if ($null -eq $old) { Stop-Installer $staging }
    if ($old.Version -cne $script:BundleVersion) {
      $upgradeOldVersion = $old.Version
      $upgradeStage = Join-Relative $script:Txn ('backup/' + $old.Version)
      New-Backup $upgradeStage $old.Records $old.Bundle $old.Version $script:BundleVersion $script:TargetDir
    }
  }
  if ($script:Operation -ceq 'rollback') {
    Copy-OrdinaryFile (Join-Relative $script:RollbackDir 'install-files.tsv') (Join-Relative $script:Txn 'rollback-install-files.tsv')
  }

  $installedRelative = $script:StateRoot + '/installed'
  $commitFailed = $false
  $script:MutationStarted = $true
  try {
    foreach ($entry in $script:Plan) {
      $destination = Join-Relative $script:TargetDir $entry.Path
      if ($entry.Action -ceq 'write') {
        if (-not (Test-OrdinaryAncestry $script:TargetDir $entry.Path)) { throw 'unsafe destination' }
        [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination))
        $temporary = $entry.Path + '.ramp-install.' + $PID
        if (Test-Exists (Join-Relative $script:TargetDir $temporary)) { throw 'temporary exists' }
        $script:ActiveCustomerTemp = $temporary
        Copy-OrdinaryFile (Join-Relative ($script:Txn + $script:Separator + 'new') $entry.Path) (Join-Relative $script:TargetDir $temporary)
        Set-ModeText (Join-Relative $script:TargetDir $temporary) $entry.Mode
        if (-not (Test-OrdinaryAncestry $script:TargetDir $entry.Path)) { throw 'unsafe destination' }
        Move-OrdinaryFile (Join-Relative $script:TargetDir $temporary) $destination
        $script:ActiveCustomerTemp = ''
      }
      elseif ($entry.Action -ceq 'remove') {
        if (-not (Test-OrdinaryAncestry $script:TargetDir $entry.Path)) { throw 'unsafe destination' }
        [System.IO.File]::Delete($destination)
      }
    }
  }
  catch {
    $commitFailed = $true
  }

  $originsText = Format-Origins $script:NewOrigins

  if (-not $commitFailed -and $upgradeStage.Length -gt 0) {
    try {
      if (-not (Test-OwnerBackupRecheck)) { throw 'backup changed' }
      $script:BackupMutated = $true
      if ((Get-PathKind $script:OwnerBackup) -ceq 'directory') {
        [System.IO.Directory]::Delete($script:OwnerBackup, $true)
      }
      if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir ($script:StateRoot + '/backups'))) {
        throw 'unsafe backups directory'
      }
      [void][System.IO.Directory]::CreateDirectory($script:OwnerBackup)
      [System.IO.Directory]::Move($upgradeStage, ($script:OwnerBackup + $script:Separator + $upgradeOldVersion))
    }
    catch {
      $commitFailed = $true
    }
  }

  if (-not $commitFailed) {
    try {
      if ($script:Operation -ceq 'uninstall') {
        if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative) -or
            (Get-PathKind $script:OwnerState) -cne 'file') {
          throw 'unsafe owner state'
        }
        $script:OwnerStateMutated = $true
        [System.IO.File]::Delete($script:OwnerState)
      }
      else {
        $source = $script:ManifestPath
        if ($script:Operation -ceq 'rollback') {
          $source = Join-Relative $script:Txn 'rollback-install-files.tsv'
        }
        $temporary = $script:OwnerState + '.new'
        $kind = Get-PathKind $script:OwnerState
        if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative) -or
            ($kind -cne 'absent' -and $kind -cne 'file') -or
            (Test-Exists $temporary)) {
          throw 'unsafe owner state'
        }
        $script:OwnerStateMutated = $true
        $script:ActiveStateTemp = $temporary
        Copy-OrdinaryFile $source $temporary
        if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative)) {
          throw 'unsafe owner state'
        }
        Move-OrdinaryFile $temporary $script:OwnerState
        $script:ActiveStateTemp = ''
      }
    }
    catch {
      $commitFailed = $true
    }
  }

  if (-not $commitFailed -and $script:Operation -cne 'install') {
    try {
      if (-not (Test-OwnerBackupRecheck)) { throw 'backup changed' }
      $script:BackupMutated = $true
      if ((Get-PathKind $script:OwnerBackup) -ceq 'directory') {
        [System.IO.Directory]::Delete($script:OwnerBackup, $true)
      }
    }
    catch {
      $commitFailed = $true
    }
  }

  if (-not $commitFailed -and
      -not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative)) {
    $commitFailed = $true
  }

  if (-not $commitFailed) {
    try {
      $kind = Get-PathKind $script:OriginState
      if ($kind -cne 'absent' -and $kind -cne 'file') { throw 'unsafe origin state' }
      if ($script:NewOrigins.Count -gt 0) {
        $temporary = $script:InstalledDir + $script:Separator + '.origins.tsv.new'
        if (Test-Exists $temporary) { throw 'temporary exists' }
        $script:OriginStateMutated = $true
        $script:ActiveStateTemp = $temporary
        Write-TextFile (Join-Relative $script:Txn 'origins.tsv') $originsText
        Copy-OrdinaryFile (Join-Relative $script:Txn 'origins.tsv') $temporary
        if (-not (Test-OrdinaryDirectoryAncestry $script:TargetDir $installedRelative)) {
          throw 'unsafe origin state'
        }
        Move-OrdinaryFile $temporary $script:OriginState
        $script:ActiveStateTemp = ''
      }
      else {
        $script:OriginStateMutated = $true
        [System.IO.File]::Delete($script:OriginState)
      }
    }
    catch {
      $commitFailed = $true
    }
  }

  if ($commitFailed) {
    if (-not (Restore-Transaction)) {
      Stop-Installer 'error: install transaction failed and restoration was incomplete'
    }
    Stop-Installer 'error: install transaction failed and was restored'
  }

  # The commit is final: mark it first so an error or interrupt from here on
  # never restores the transaction over it.
  $script:MutationStarted = $false
  try {
    [System.IO.Directory]::Delete($script:Txn, $true)
  }
  catch {
    Write-InstallerError ('warning: could not remove transaction staging ' +
      $script:StateRoot + '/.transaction.' + $PID)
  }
  $script:Txn = ''
  $script:TransactionActive = $false
  foreach ($entry in $script:Plan) {
    if ($entry.Action -cne 'remove') { continue }
    $directory = Get-ParentRelative $entry.Path
    while ($directory.Length -gt 0) {
      try {
        if (-not (Remove-EmptyDirectory (Join-Relative $script:TargetDir $directory))) { break }
      }
      catch {
        break
      }
      $directory = Get-ParentRelative $directory
    }
  }
  [Console]::Out.WriteLine("RAMP $($script:Operation) complete")
}

try {
  Invoke-Installer
}
catch {
  if (-not $script:Stopping) {
    Write-InstallerError ('error: ' + $_.Exception.Message)
    $script:ExitCode = 1
  }
}
finally {
  Invoke-Cleanup
}
exit $script:ExitCode
