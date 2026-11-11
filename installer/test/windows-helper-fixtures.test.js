// Fixtures that keep the Windows helper job honest. install-powershell.test.js
// skips an engine it cannot find, so CI names the engines it requires through
// RAMP_REQUIRE_POWERSHELL and this file fails when one is missing. It also
// checks that checkout kept helper bytes LF-only and that install.ps1 copies
// bytes exactly from and into folders with spaces and non-ASCII names
// (entry paths themselves are printable ASCII by contract).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundle, expectSuccess, snapshot, tempRoot } from './support/install-oracle.js'

// A pwsh parent (the GitHub Windows runner's default shell) leaves PowerShell 7
// module paths in PSModulePath, and Windows PowerShell 5.1 then cannot load
// Get-FileHash. Every engine builds its own default path, as from a customer shell.
if (process.platform === 'win32') delete process.env.PSModulePath

const repoRoot = new URL('../../', import.meta.url)
const required = (process.env.RAMP_REQUIRE_POWERSHELL ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

// Windows PowerShell 5.1 reports the Desktop edition; pwsh reports Core.
function probe(command) {
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
  return result.error || result.status !== 0 ? null : result.stdout.trim()
}

function runInstaller(command, script, target, ...args) {
  return spawnSync(
    command,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
      '-File',
      script,
      '-Target',
      target,
      ...args,
    ],
    { cwd: tempRoot('ramp-fixture-cwd-'), encoding: 'utf8', shell: false, timeout: 60_000 },
  )
}

describe('required PowerShell engines', () => {
  if (required.length === 0) it.skip('set RAMP_REQUIRE_POWERSHELL to require engines', () => {})
  for (const command of required) {
    it(`${command} is installed for the helper job`, () => {
      const version = probe(command)
      expect(version, `${command} must run on this runner`).not.toBeNull()
      if (/^powershell(\.exe)?$/i.test(command)) expect(version).toMatch(/^Desktop:5$/i)
    })
  }
})

describe('helper bytes after checkout', () => {
  const helpers = [
    'installer/src/release/templates/install.sh',
    'installer/src/release/templates/install.ps1',
    ...readdirSync(new URL('packs/', repoRoot)).flatMap((pack) => [
      `packs/${pack}/add-skills.sh`,
      `packs/${pack}/add-skills.ps1`,
    ]).filter((path) => {
      try {
        readFileSync(new URL(path, repoRoot))
        return true
      } catch {
        return false
      }
    }),
  ]

  it('pins helper scripts to LF in .gitattributes', () => {
    const attributes = readFileSync(new URL('.gitattributes', repoRoot), 'utf8')
    expect(attributes).toMatch(/^\*\.sh text eol=lf$/m)
    expect(attributes).toMatch(/^\*\.ps1 text eol=lf$/m)
  })

  it.each(helpers)('%s holds no carriage return', (path) => {
    expect(readFileSync(new URL(path, repoRoot)).includes(0x0d)).toBe(false)
  })
})

const engines = [...new Set([...required, 'pwsh', 'powershell.exe'])]
  .map((command) => ({ command, available: probe(command) !== null }))

for (const { command, available } of engines) {
  describe.skipIf(!available)(`install.ps1 Windows-shaped paths: ${command}`, () => {
    it('installs exact bytes from and into folders with spaces and non-ASCII names', () => {
      const files = {
        'guide.md': 'guide\n',
        'docs/windows line endings.txt': 'first\r\nsecond\r\n',
        'docs/nested folder/notes.md': 'nested\n',
      }
      const state = bundle({ files })
      const bundleRoot = join(tempRoot('ramp-fixture-'), 'Release Bundles été', 'demo')
      mkdirSync(join(bundleRoot, '..'), { recursive: true })
      renameSync(state.root, bundleRoot)
      const target = join(tempRoot('ramp-fixture-'), 'Customer Repo ü')
      mkdirSync(target)

      expectSuccess(runInstaller(command, join(bundleRoot, 'install.ps1'), target))
      for (const [path, bytes] of Object.entries(files)) {
        expect(readFileSync(join(target, ...path.split('/'))).equals(Buffer.from(bytes)), path)
          .toBe(true)
      }

      const installed = snapshot(target)
      expectSuccess(runInstaller(command, join(bundleRoot, 'install.ps1'), target))
      expect(snapshot(target)).toEqual(installed)
    }, 120_000)
  })
}
