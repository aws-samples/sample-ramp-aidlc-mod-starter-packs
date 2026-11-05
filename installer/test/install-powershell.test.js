import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, parse, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderInstallers } from '../src/release/installers.js'
import {
  bundle,
  expectSuccess,
  registerInstallerContract,
  snapshot,
  tempRoot,
  templates,
} from './support/install-oracle.js'

const bashTemplate = templates.bash.toString('utf8')
const template = templates.powershell.toString('utf8')
const rendered = renderInstallers({
  manifestName: 'install-files.tsv',
  overlayRoot: 'overlay',
  conflictName: 'install-conflicts.txt',
  stateRoot: '.ramp',
  templates,
}).powershell

// Script text without comments or string literals, for construct checks.
function codeOnly(text) {
  return text
    .replace(/<#[\s\S]*?#>/g, '')
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"[^"\n]*"/g, '""')
    .replace(/#.*$/gm, '')
}

// install.sh messages that only its own argument parser or tool lookup prints.
const BASH_ONLY_MESSAGES = new Set([
  'error: --target requires one value',
  'error: unknown argument: ',
  'error: sha256sum or shasum is required',
])

describe('generated PowerShell bundle installer: static contract', () => {
  it('renders the layout into single-quoted values as canonical ASCII LF text', () => {
    expect(rendered).toContain("$ManifestName = 'install-files.tsv'")
    expect(rendered).toContain("$OverlayRoot = 'overlay'")
    expect(rendered).toContain("$ConflictName = 'install-conflicts.txt'")
    expect(rendered).toContain("$StateRoot = '.ramp'")
    expect(rendered).not.toMatch(/__[A-Z][A-Z0-9_]+__/)
    expect(rendered.endsWith('\n') && !rendered.endsWith('\n\n')).toBe(true)
    // Windows PowerShell 5.1 reads a BOM-less script as ANSI.
    expect([...templates.powershell].every((byte) => byte === 0x0a || (byte >= 0x20 && byte <= 0x7e)))
      .toBe(true)
  })

  it('declares the Bash operations as parameters with help examples', () => {
    expect(template).toMatch(/\[Parameter\(Mandatory = \$true\)\]\s*\[string\]\$Target,/)
    for (const name of ['DryRun', 'Uninstall', 'Rollback']) {
      expect(template).toContain(`[switch]$${name}`)
    }
    for (const flag of ['--dry-run', '--uninstall', '--rollback', 'install.sh --target']) {
      expect(template).toContain(flag)
    }
    expect(template.match(/^\.EXAMPLE$/gm)).toHaveLength(4)
  })

  it('is a real installer rather than the execution-gate placeholder', () => {
    expect(template).not.toContain('Windows execution gate')
    expect(template).toContain('Restore-Transaction')
    expect(template).toContain('Invoke-Preflight')
  })

  it('fails closed with strict mode, Stop errors, and a FullLanguage guard', () => {
    expect(template).toMatch(/^Set-StrictMode -Version 2\.0$/m)
    expect(template).toMatch(/^\$ErrorActionPreference = 'Stop'$/m)
    expect(template).toContain('$ExecutionContext.SessionState.LanguageMode')
  })

  it('avoids path cmdlets that follow links, drop fields, or rewrite encodings', () => {
    const code = codeOnly(template)
    for (const banned of [
      'Test-Path', 'Resolve-Path', 'Get-Content', 'Set-Content', 'Out-File',
      'Copy-Item', 'Move-Item', 'Remove-Item', 'Get-ChildItem', 'New-Item',
      '-split', 'Sort-Object',
    ]) {
      expect(code, banned).not.toContain(banned)
    }
    expect(code).not.toMatch(/Get-Item(?! -Force -LiteralPath)/)
  })

  it('uses no network, external tools, dynamic code, or PowerShell 7-only syntax', () => {
    const code = codeOnly(template)
    for (const banned of [
      'Invoke-WebRequest', 'Invoke-RestMethod', 'WebClient', 'HttpClient', 'BitsTransfer',
      'Install-Module', 'Install-Package', 'Invoke-Expression', 'Add-Type', 'Start-Process',
      'curl', 'wget', 'winget', 'choco', 'node', 'npm', 'git ',
      '??', '?.', '&&', '||', '-Parallel', '-AsHashtable', '$IsWindows', '$IsLinux', '$IsMacOS',
    ]) {
      expect(code, banned).not.toContain(banned)
    }
    expect(code).not.toMatch(/\biex\b/)
  })

  it('hashes with lowercase SHA-256 only', () => {
    expect(template).toContain(
      '(Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()',
    )
    expect(template).not.toMatch(/MD5|SHA1\b|SHA384|SHA512/)
    expect(template.match(/Get-FileHash/g)).toHaveLength(1)
  })

  it('checks reparse points lexically and compares paths ordinally', () => {
    expect(template).toContain('[System.IO.File]::GetAttributes($Path)')
    expect(template).toContain('[System.IO.FileAttributes]::ReparsePoint')
    expect(template).toContain('[System.StringComparer]::Ordinal')
    expect(template).toContain('[string]::CompareOrdinal')
    expect(template).toContain('[System.StringComparison]::OrdinalIgnoreCase')
  })

  it('takes the target lock with an atomic exclusive create', () => {
    expect(template).toContain("'install.lock'")
    expect(template).toContain('[System.IO.FileMode]::CreateNew')
    expect(template).toContain('[System.IO.FileShare]::None')
  })

  it('shares every state literal, conflict reason, and error message with install.sh', () => {
    for (const literal of [
      'RAMP-INSTALL-MANIFEST', 'RAMP-INSTALL-ORIGINS', 'RAMP-INSTALL-BACKUP',
      "'installed'", "'.origins.tsv'", "'backups'", "'.transaction.'",
      "'install-files.tsv'", "'origins.tsv'", "'backup-meta.tsv'", "'SHA256SUMS'",
      "'owner'", "'from-bundle'", "'from-version'", "'to-bundle'", "'to-version'",
      "'managed'", "'external'",
    ]) {
      expect(template, literal).toContain(literal)
    }
    const reasons = [...bashTemplate.matchAll(/add_conflict "[^"]*" "([^"]+)"/g)].map((match) => match[1])
    expect(reasons.length).toBeGreaterThan(10)
    for (const reason of reasons) expect(template, reason).toContain(`'${reason}'`)
    const messages = [...bashTemplate.matchAll(/echo "(error: [^"$]*)/g)]
      .map((match) => match[1])
      .filter((message) => !BASH_ONLY_MESSAGES.has(message))
    expect(messages.length).toBeGreaterThan(10)
    for (const message of messages) expect(template, message).toContain(message)
  })

  it('copies files only through the helper that clears the Windows ReadOnly attribute', () => {
    const code = codeOnly(template)
    expect(code.match(/\[System\.IO\.File\]::Copy\(/g)).toHaveLength(1)
    const helper = code.slice(code.indexOf('function Copy-OrdinaryFile'))
    expect(helper.indexOf('[System.IO.File]::Copy(')).toBeLessThan(helper.indexOf('\n}\n'))
    expect(helper.slice(0, helper.indexOf('\n}\n'))).toContain('SetAttributes')
  })

  it('marks a commit final before removing transaction staging', () => {
    const tail = template.slice(template.lastIndexOf('# The commit is final'))
    const finished = tail.indexOf('$script:MutationStarted = $false')
    const removed = tail.indexOf('[System.IO.Directory]::Delete($script:Txn, $true)')
    expect(finished).toBeGreaterThan(0)
    expect(removed).toBeGreaterThan(finished)
  })
})

function probePowerShell(command, requireDesktop) {
  const result = spawnSync(
    command,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$edition = $PSVersionTable.PSEdition; if (-not $edition) { $edition = "Desktop" }; Write-Output ($edition + ":" + $PSVersionTable.PSVersion.Major)',
    ],
    { encoding: 'utf8', shell: false },
  )
  const available = !result.error &&
    result.status === 0 &&
    (!requireDesktop || /^Desktop:5\s*$/i.test(result.stdout))
  return { command, available }
}

const engines = [
  { ...probePowerShell('powershell.exe', true), label: 'powershell.exe 5.1' },
  { ...probePowerShell('powershell', true), label: 'powershell 5.1' },
  { ...probePowerShell('pwsh', false), label: 'pwsh' },
]

// install.sh flags map to PowerShell parameters: --dry-run becomes -DryRun.
function powerShellArguments(command, state, target, args) {
  const mapped = args.map((arg) => (arg.startsWith('--')
    ? `-${arg.slice(2).split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('')}`
    : arg))
  return [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
    '-File',
    state.powershell,
    '-Target',
    target,
    ...mapped,
  ]
}

function powerShellEngine(command) {
  return {
    timeout: 120_000,
    run(state, target, ...args) {
      return spawnSync(command, powerShellArguments(command, state, target, args), {
        cwd: tempRoot('ramp-install-cwd-'),
        encoding: 'utf8',
        shell: false,
        timeout: 60_000,
      })
    },
    runBounded(state, target, args, ms = 30_000) {
      return new Promise((resolve) => {
        const child = spawn(command, powerShellArguments(command, state, target, args), {
          cwd: tempRoot('ramp-install-cwd-'),
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stderr = ''
        let timedOut = false
        child.stdout.resume()
        child.stderr.on('data', (chunk) => { stderr += chunk })
        const timer = setTimeout(() => {
          timedOut = true
          if (process.platform === 'win32') child.kill('SIGKILL')
          else process.kill(-child.pid, 'SIGKILL')
        }, ms)
        child.on('close', (status) => {
          clearTimeout(timer)
          resolve({ status, stderr, timedOut })
        })
      })
    },
  }
}

function runBash(state, target, ...args) {
  return spawnSync('bash', [state.script, '--target', target, ...args], {
    cwd: tempRoot('ramp-install-cwd-'),
    encoding: 'utf8',
    shell: false,
    timeout: 20_000,
  })
}

const bashAvailable = process.platform !== 'win32' &&
  !spawnSync('bash', ['-c', 'true']).error

for (const { command, available, label } of engines) {
  describe.skipIf(!available)(`generated PowerShell bundle installer: ${label}`, () => {
    const engine = powerShellEngine(command)
    const run = engine.run

    // Runs the helper with a line breakpoint on the one line that reads
    // marker; the action runs in the helper's scope and does not stop it.
    function runAtLine(state, target, marker, action) {
      const lines = readFileSync(state.powershell, 'utf8').split('\n')
      expect(lines.filter((text) => text.trim() === marker), marker).toHaveLength(1)
      const line = lines.findIndex((text) => text.trim() === marker) + 1
      return spawnSync(command, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
        '-Command',
        [
          `[void](Set-PSBreakpoint -Script $env:RAMP_SCRIPT -Line ${line} -Action { ${action} })`,
          '& $env:RAMP_SCRIPT -Target $env:RAMP_TARGET',
          'exit $LASTEXITCODE',
        ].join('\n'),
      ], {
        cwd: tempRoot('ramp-install-cwd-'),
        encoding: 'utf8',
        env: { ...process.env, RAMP_SCRIPT: state.powershell, RAMP_TARGET: target },
        shell: false,
        timeout: 60_000,
      })
    }

    it('parses without errors', () => {
      const script = bundle().powershell
      const result = spawnSync(command, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${script.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors); $errors | ForEach-Object { $_.Message }; exit @($errors).Count`,
      ], { encoding: 'utf8', shell: false })
      expect(result.status, result.stdout).toBe(0)
    }, engine.timeout)

    registerInstallerContract(engine)

    it('rejects two operation flags as a usage error', () => {
      const result = run(bundle(), tempRoot('ramp-install-target-'), '--dry-run', '--uninstall')
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('operation flags are mutually exclusive')
    }, engine.timeout)

    it('rejects a positional target', () => {
      const state = bundle()
      const target = tempRoot('ramp-install-target-')
      const result = spawnSync(command, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
        '-File',
        state.powershell,
        target,
        '-DryRun',
      ], { cwd: tempRoot('ramp-install-cwd-'), encoding: 'utf8', shell: false, timeout: 60_000 })
      expect(result.status).not.toBe(0)
      expect(result.stdout).not.toContain('RAMP dry run')
    }, engine.timeout)

    it('catches a change made between the first preflight and the lock', () => {
      const state = bundle({ files: { 'early.txt': 'early\n', 'late.txt': 'bundle\n' } })
      const target = tempRoot('ramp-install-target-')
      const late = join(target, 'late.txt')
      const result = runAtLine(state, target, '$script:LockCreated = $true',
        `[System.IO.File]::WriteAllText('${late}', "customer\`n")`)
      expect(result.status).not.toBe(0)
      expect(readFileSync(join(state.root, 'install-conflicts.txt'), 'utf8'))
        .toBe('late.txt\tcustomer file differs\n')
      expect(snapshot(target)).toEqual([['late.txt', Buffer.from('customer\n'), expect.any(Number)]])
    }, engine.timeout)

    it('fails without touching an existing target lock', () => {
      const state = bundle()
      const target = tempRoot('ramp-install-target-')
      mkdirSync(join(target, '.ramp/install.lock'), { recursive: true })
      const before = snapshot(target)
      const result = run(state, target)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('another RAMP installer holds the target lock')
      expect(snapshot(target)).toEqual(before)
    }, engine.timeout)

    // A line breakpoint whose action edits the target stands in for an editor
    // or agent writing during the transaction; the action runs without
    // stopping the script. The edit must survive and the upgrade must not commit.
    it.each([
      ['while staging the old bytes', 'Copy-OrdinaryFile $destination $old', 'guide.md', 'guide.md'],
      ['after an earlier file was committed', '$script:ActiveCustomerTemp = $temporary', 'a.txt', 'guide.md'],
      ['as a new file the upgrade would add', '$script:ActiveCustomerTemp = $temporary', 'a.txt', 'new.txt'],
    ])('keeps an edit made %s', (_, marker, when, edited) => {
      const v1 = bundle({ files: { 'a.txt': 'a 1\n', 'guide.md': 'guide 1\n' } })
      const v2 = bundle({
        version: '1.1.0',
        bundleId: 'demo--kiro--v1.1.0',
        files: { 'a.txt': 'a 2\n', 'guide.md': 'guide 2\n', 'new.txt': 'new\n' },
      })
      const target = tempRoot('ramp-install-target-')
      expectSuccess(run(v1, target))
      const result = runAtLine(v2, target, marker,
        `if ($entry.Path -ceq '${when}') { [System.IO.File]::WriteAllText('${join(target, edited)}', "customer\`n") }`)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`${edited} changed while the installer ran`)
      expect(readFileSync(join(target, edited), 'utf8')).toBe('customer\n')
      expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('a 1\n')
      expect(readFileSync(join(target, '.ramp/installed/demo--kiro--standalone.tsv'), 'utf8'))
        .toContain('1.0.0')
    }, engine.timeout)

    // The breakpoint edits each snapshot copy before its hash check, as a
    // failed or torn copy would leave it.
    it('refuses an upgrade whose rollback snapshot does not match its records', () => {
      const v1 = bundle({ files: { 'guide.md': 'guide 1\n' } })
      const v2 = bundle({
        version: '1.1.0',
        bundleId: 'demo--kiro--v1.1.0',
        files: { 'guide.md': 'guide 2\n' },
      })
      const target = tempRoot('ramp-install-target-')
      expectSuccess(run(v1, target))
      const result = runAtLine(v2, target,
        "if ((Get-Sha256 $copy) -cne $record.Hash) { throw 'backup copy differs from its record' }",
        '[System.IO.File]::WriteAllText($copy, "torn`n")')
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('could not build the rollback snapshot')
      expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1\n')
      expect(existsSync(join(target, '.ramp/backups/demo--kiro--standalone/1.0.0'))).toBe(false)
      expectSuccess(run(v2, target))
      expectSuccess(run(v2, target, '--rollback'))
      expect(readFileSync(join(target, 'guide.md'), 'utf8')).toBe('guide 1\n')
    }, engine.timeout)

    // C:\ trimmed to C: would name the current directory of drive C.
    it('plans against a drive or file-system root target', () => {
      const temporary = realpathSync(tmpdir())
      const root = parse(temporary).root
      const probe = `${relative(root, temporary).split(sep)[0]}/${basename(tempRoot('ramp-root-probe-'))}.txt`
      const result = run(bundle({ files: { [probe]: 'probe\n' } }), root, '--dry-run')
      expectSuccess(result)
      expect(result.stdout).toContain('RAMP dry run: 1 planned paths')
      expect(existsSync(join(root, ...probe.split('/')))).toBe(false)
    }, engine.timeout)

    // Node's chmod sets the Windows ReadOnly attribute when the write bit is
    // cleared; Perforce and TFVC workspaces leave files that way.
    describe.skipIf(process.platform !== 'win32')('treats the ReadOnly attribute as a mode change', () => {
      const versions = () => ({
        v1: bundle(),
        v2: bundle({ version: '1.1.0', bundleId: 'demo--kiro--v1.1.0', files: { 'guide.md': 'new\n' } }),
      })

      it('refuses to replace or remove a read-only destination', () => {
        const { v1, v2 } = versions()
        const target = tempRoot('ramp-install-target-')
        expectSuccess(run(v1, target))
        chmodSync(join(target, 'guide.md'), 0o444)
        const before = snapshot(target)
        expect(run(v2, target).status).not.toBe(0)
        expect(run(v1, target, '--uninstall').status).not.toBe(0)
        expect(snapshot(target)).toEqual(before)
      }, engine.timeout)

      it('refuses read-only installed state before any write', () => {
        const { v1, v2 } = versions()
        const target = tempRoot('ramp-install-target-')
        expectSuccess(run(v1, target))
        chmodSync(join(target, '.ramp/installed/.origins.tsv'), 0o444)
        const before = snapshot(target)
        const result = run(v2, target)
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain('installer preflight failed')
        expect(snapshot(target)).toEqual(before)
      }, engine.timeout)

      // A bundle on read-only media or in a Perforce workspace is only read.
      it('installs from a read-only bundle without leaving read-only copies', () => {
        const { v1, v2 } = versions()
        for (const state of [v1, v2]) {
          for (const path of ['install-files.tsv', 'overlay/guide.md']) chmodSync(join(state.root, path), 0o444)
        }
        const target = tempRoot('ramp-install-target-')
        expectSuccess(run(v1, target))
        expectSuccess(run(v2, target))
        for (const [path, , mode] of snapshot(target)) {
          expect(mode & 0o200, path).not.toBe(0)
        }
        expectSuccess(run(v2, target, '--rollback'))
        expectSuccess(run(v1, target, '--uninstall'))
      }, engine.timeout)
    })

    describe.skipIf(!bashAvailable)('interoperates with install.sh', () => {
      const versions = () => ({
        v1: bundle({
          files: {
            'docs/guide.md': 'guide\n',
            'scripts/run.sh': { bytes: '#!/bin/sh\n', mode: 0o100755 },
            'removed.txt': 'remove\n',
          },
        }),
        v2: bundle({
          version: '1.1.0',
          bundleId: 'demo--kiro--v1.1.0',
          files: {
            'added/new.txt': 'add\n',
            'docs/guide.md': 'guide v2\n',
            'scripts/run.sh': { bytes: '#!/bin/sh\n', mode: 0o100755 },
          },
        }),
      })

      it('writes the same target bytes and modes as install.sh', () => {
        const { v1, v2 } = versions()
        const viaBash = tempRoot('ramp-install-target-')
        const viaPowerShell = tempRoot('ramp-install-target-')
        for (const [state, args] of [[v1, []], [v2, []], [v2, ['--rollback']]]) {
          expectSuccess(runBash(state, viaBash, ...args))
          expectSuccess(run(state, viaPowerShell, ...args))
          expect(snapshot(viaPowerShell)).toEqual(snapshot(viaBash))
        }
        expect(readFileSync(join(v1.root, 'install-files.tsv'), 'utf8'))
          .toBe(readFileSync(join(viaPowerShell, '.ramp/installed/demo--kiro--standalone.tsv'), 'utf8'))
      }, engine.timeout)

      it('continues an install.sh lifecycle and hands it back', () => {
        const { v1, v2 } = versions()
        const target = tempRoot('ramp-install-target-')
        expectSuccess(runBash(v1, target))
        expectSuccess(run(v2, target))
        expectSuccess(runBash(v2, target, '--rollback'))
        expect(readFileSync(join(target, 'docs/guide.md'), 'utf8')).toBe('guide\n')
        expectSuccess(run(v1, target, '--uninstall'))
        expect(existsSync(join(target, 'docs'))).toBe(false)
        expect(snapshot(target)).toEqual([
          ['.ramp', Buffer.from('directory'), expect.any(Number)],
          ['.ramp/backups', Buffer.from('directory'), expect.any(Number)],
          ['.ramp/installed', Buffer.from('directory'), expect.any(Number)],
        ])
      }, engine.timeout)
    })
  })
}
