import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  renderAddSkills,
  renderAddSkillsBash,
  renderAddSkillsPowerShell,
} from '../src/render/add-skills.js'

// A pwsh parent (the GitHub Windows runner's default shell) leaves PowerShell 7
// module paths in PSModulePath, and Windows PowerShell 5.1 then cannot load its
// own modules. Every engine builds its own default path, as from a customer shell.
if (process.platform === 'win32') delete process.env.PSModulePath

// The helper CI job names the engines it requires; a missing one fails here
// instead of skipping its contract.
const requiredPowerShells = (process.env.RAMP_REQUIRE_POWERSHELL ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

const deprecationWarning = (slug, oldPath) =>
  `warning: skill ${slug} resolved from ${oldPath}; move it to skills/${slug}/`
const stderrLines = (stderr) => stderr.split(/\r?\n/).filter(Boolean)

const reservedMessage = (slug) =>
  `skill name ${slug} is reserved: ramp, README.md and taxonomy cannot be skill names`

// The ambiguity guard names both paths, relative to the repository root with
// forward slashes when they lie under it.
const guardMessage = (slug, first, second) =>
  `skill ${slug} is ambiguous: found in ${first} and ${second}; keep only one copy`

const roots = []
const portable = (path) => path.split(sep).join('/')
const destinations = {
  kiro: '.kiro/skills',
  'claude-code': '.claude/skills',
  copilot: '.github/skills',
  cursor: '.cursor/skills',
  codex: '.agents/skills',
}
const mixedManifest = {
  name: 'demo',
  skills: ['pack-only', 'ramp-only', 'compat-only', 'collision'],
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempRoot(label = 'ramp-add-skills-') {
  const root = mkdtempSync(join(tmpdir(), label))
  roots.push(root)
  return root
}

function write(root, path, bytes, mode = 0o644) {
  const absolute = join(root, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, bytes)
  chmodSync(absolute, mode)
  return absolute
}

function writeSkill(root, path, marker) {
  write(root, `${path}/SKILL.md`, `---\nname: ${path.split('/').at(-1)}\n---\n`)
  write(root, `${path}/.hidden`, Buffer.from([0, marker, 255, 10]))
  write(root, `${path}/nested/payload.bin`, Buffer.from([marker, 0, 10, 13]))
  return join(root, ...path.split('/'))
}

function createRepository(manifest = mixedManifest) {
  const repo = tempRoot('ramp-helper-repo-')
  write(repo, 'packs/demo/pack.yaml', 'name: demo\n')
  mkdirSync(join(repo, 'skills', 'ramp'), { recursive: true })
  mkdirSync(join(repo, 'skills-library'), { recursive: true })
  writeSkill(repo, 'packs/demo/skills/pack-only', 11)
  writeSkill(repo, 'packs/demo/skills/collision', 12)
  writeSkill(repo, 'skills/ramp/ramp-only', 21)
  writeSkill(repo, 'skills/ramp/collision', 22)
  writeSkill(repo, 'skills-library/compat-only', 31)
  writeSkill(repo, 'skills-library/collision', 32)
  const bash = write(
    repo,
    'packs/demo/add-skills.sh',
    renderAddSkillsBash(manifest),
    0o755,
  )
  const powerShell = write(
    repo,
    'packs/demo/add-skills.ps1',
    renderAddSkillsPowerShell(manifest),
  )
  return { repo, bash, powerShell }
}

function collectTree(root) {
  const records = []
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const status = lstatSync(absolute)
      if (status.isDirectory()) {
        visit(absolute)
      } else if (status.isFile()) {
        records.push([
          portable(relative(root, absolute)),
          readFileSync(absolute),
        ])
      }
    }
  }
  visit(root)
  return records.sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0)
}

function expectSameTree(actual, expected) {
  expect(collectTree(actual)).toEqual(collectTree(expected))
}

function runBash(script, args, options = {}) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    shell: false,
    ...options,
  })
}

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

const powerShellEngines = [
  { ...probePowerShell('powershell.exe', true), label: 'powershell.exe 5.1' },
  { ...probePowerShell('powershell', true), label: 'powershell 5.1' },
  { ...probePowerShell('pwsh', false), label: 'pwsh supplemental' },
]

function runPowerShell(command, script, args, options = {}) {
  const parameters = []
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]
    const value = args[index + 1]
    const mapped = {
      '--tool': '-Tool',
      '--target': '-Target',
      '--repo-root': '-RepoRoot',
      '--skills-src': '-SkillsSrc',
    }[name]
    if (!mapped) throw new Error(`unsupported test argument: ${name}`)
    parameters.push(mapped, value)
  }
  return spawnSync(
    command,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
      '-File',
      script,
      ...parameters,
    ],
    { encoding: 'utf8', shell: false, ...options },
  )
}

function linkDirectory(target, path) {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir')
}

function renderHelper(scriptKey, manifest) {
  return scriptKey === 'bash'
    ? renderAddSkillsBash(manifest)
    : renderAddSkillsPowerShell(manifest)
}

function writeHelper(root, scriptKey, manifest) {
  return write(
    root,
    scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
    renderHelper(scriptKey, manifest),
    scriptKey === 'bash' ? 0o755 : 0o644,
  )
}

// Replaces the generated skill list, as a customer editing the helper would.
function writeEditedHelper(root, scriptKey, names) {
  const rendered = renderHelper(scriptKey, { name: 'demo', skills: ['placeholder'] })
  const edited = scriptKey === 'bash'
    ? rendered.replace(
      /SKILLS=\(\n[\s\S]*?\n\)/,
      `SKILLS=(\n${names.map((name) => `  ${name}`).join('\n')}\n)`,
    )
    : rendered.replace(
      /\$Skills = @\(\n[\s\S]*?\n\)/,
      `$Skills = @(\n${names.map((name) => `  '${name}'`).join('\n')}\n)`,
    )
  return write(
    root,
    scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
    edited,
    scriptKey === 'bash' ? 0o755 : 0o644,
  )
}

function probeFixtureCapability(arrange) {
  const root = tempRoot('ramp-helper-capability-')
  try {
    return arrange(root) !== false
  } catch {
    return false
  }
}

const fixtureCapabilities = {
  directoryLinks: probeFixtureCapability((root) => {
    const real = join(root, 'real')
    mkdirSync(real)
    linkDirectory(real, join(root, 'linked'))
  }),
  fileLinks: probeFixtureCapability((root) => {
    const real = write(root, 'real', 'content\n')
    symlinkSync(real, join(root, 'linked'), 'file')
  }),
  fifo: process.platform !== 'win32' &&
    probeFixtureCapability((root) =>
      spawnSync('mkfifo', [join(root, 'events.pipe')], {
        shell: false,
      }).status === 0,
    ),
  caseDistinctNames: probeFixtureCapability((root) => {
    write(root, 'Guide.md', 'upper\n')
    write(root, 'guide.md', 'lower\n')
    return readdirSync(root).filter(
      (name) => name.toLowerCase() === 'guide.md',
    ).length === 2
  }),
  reservedNames: probeFixtureCapability((root) => {
    write(root, 'CON.txt', 'reserved\n')
    return existsSync(join(root, 'CON.txt'))
  }),
  unreadableDirectories: process.platform !== 'win32' &&
    probeFixtureCapability((root) => {
      const privateDirectory = join(root, 'private')
      mkdirSync(privateDirectory)
      write(privateDirectory, 'value', 'private\n')
      chmodSync(privateDirectory, 0o000)
      const result = spawnSync(
        'find',
        [root, '-mindepth', '1', '-print'],
        { encoding: 'utf8', shell: false },
      )
      chmodSync(privateDirectory, 0o700)
      return result.status !== 0
    }),
}

describe('add-skills renderers', () => {
  it('renders deterministic validated Bash and PowerShell with an alias for Bash', () => {
    const manifest = {
      name: 'demo-pack',
      skills: ['first-skill', 'second-skill'],
    }
    const bash = renderAddSkillsBash(manifest)
    const powerShell = renderAddSkillsPowerShell(manifest)

    expect(renderAddSkills).toBe(renderAddSkillsBash)
    expect(renderAddSkillsBash(manifest)).toBe(bash)
    expect(renderAddSkillsPowerShell(manifest)).toBe(powerShell)
    expect(bash).toContain('PACK_NAME="demo-pack"')
    expect(bash).toMatch(/SKILLS=\(\n  first-skill\n  second-skill\n\)/)
    expect(powerShell).toContain("$PackName = 'demo-pack'")
    expect(powerShell).toMatch(
      /\$Skills = @\(\n  'first-skill'\n  'second-skill'\n\)/,
    )
    expect(bash.endsWith('\n')).toBe(true)
    expect(powerShell.endsWith('\n')).toBe(true)
    expect(bash).not.toContain('\r')
    expect(powerShell).not.toContain('\r')
    expect(`${bash}\n${powerShell}`).not.toMatch(
      /__(?:PACK_NAME|SKILLS_BASH|SKILLS_POWERSHELL)__/,
    )
    expect(bash).toContain('ramp-add-skills.XXXXXX')
    expect(bash).not.toMatch(/done\s*<\s*<\(find/)
  })

  it.each([
    [null, /manifest.*object/i],
    [[], /manifest.*object/i],
    [{ name: 'Bad_Name', skills: [] }, /pack.*lower-kebab/i],
    [{ name: 'demo', skills: 'all' }, /skills.*array/i],
    [{ name: 'demo', skills: ['Bad_Name'] }, /skill.*lower-kebab/i],
    [{ name: 'demo', skills: ['same', 'same'] }, /duplicate.*same/i],
  ])('rejects invalid renderer input %#', (manifest, message) => {
    expect(() => renderAddSkillsBash(manifest)).toThrow(message)
    expect(() => renderAddSkillsPowerShell(manifest)).toThrow(message)
  })

  it('renders PowerShell with the unconditional Windows PowerShell 5.1 safety surface', () => {
    const script = renderAddSkillsPowerShell(mixedManifest)

    expect(script).toContain('#Requires -Version 5.1')
    expect(script).toContain('[CmdletBinding()]')
    expect(script).toMatch(/\[string\]\$RepoRoot/)
    expect(script).toMatch(/\[string\]\$SkillsSrc/)
    expect(script).toContain('Get-Item -LiteralPath')
    expect(script).toContain('Resolve-Path -LiteralPath')
    expect(script).toContain('Get-ChildItem -LiteralPath')
    expect(script).toContain('-Force')
    expect(script).toContain('[IO.FileAttributes]::ReparsePoint')
    expect(script).toContain("$Item.PSObject.Properties['UnixStat']")
    expect(script).toContain("$codePoint -lt 0x20")
    expect(script).toContain("$codePoint -gt 0x7E")
    expect(script).toContain('Copy-Item -LiteralPath')
    expect(script).toContain('PRE-FLIGHT COMPLETE')
    expect(script.indexOf("'skills'")).toBeLessThan(script.indexOf("'pack'"))
    expect(script.indexOf("'pack'")).toBeLessThan(script.indexOf("'ramp'"))
    expect(script.indexOf("'ramp'")).toBeLessThan(
      script.indexOf("'compatibility'"),
    )
    expect(script).not.toMatch(/\?\?|\?\.(?!\\)|ForEach-Object\s+-Parallel/)
  })
})

function registerRuntimeContract({
  available,
  label,
  run,
  scriptKey,
}) {
  // A cold PowerShell start on a loaded runner exceeds the default 5 s.
  describe(`generated helper runtime: ${label}`, { timeout: 60_000 }, () => {
    for (const [tool, destination] of Object.entries(destinations)) {
      it.runIf(available)(`installs to the exact ${tool} destination`, () => {
        const fixture = createRepository()
        const target = tempRoot('ramp-helper-target-')
        const result = run(fixture[scriptKey], [
          '--tool',
          tool,
          '--target',
          target,
        ])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        const installed = join(target, destination)
        expectSameTree(
          join(installed, 'pack-only'),
          join(fixture.repo, 'packs/demo/skills/pack-only'),
        )
        expectSameTree(
          join(installed, 'ramp-only'),
          join(fixture.repo, 'skills/ramp/ramp-only'),
        )
        expectSameTree(
          join(installed, 'compat-only'),
          join(fixture.repo, 'skills-library/compat-only'),
        )
        expectSameTree(
          join(installed, 'collision'),
          join(fixture.repo, 'packs/demo/skills/collision'),
        )
        expect(result.stdout).toMatch(/\+ pack-only \[pack\]/)
        expect(result.stdout).toMatch(/\+ ramp-only \[ramp\]/)
        expect(result.stdout).toMatch(/\+ compat-only \[compatibility\]/)
        expect(result.stdout).toMatch(/Done\. 4 copied/)
      })
    }

    it.runIf(available)('skips the root skill.yaml of every skill', () => {
      const fixture = createRepository()
      const sources = {
        'pack-only': 'packs/demo/skills/pack-only',
        'ramp-only': 'skills/ramp/ramp-only',
        'compat-only': 'skills-library/compat-only',
      }
      for (const source of Object.values(sources)) {
        write(fixture.repo, `${source}/skill.yaml`, 'schemaVersion: 2\n')
        write(fixture.repo, `${source}/nested/skill.yaml`, 'nested\n')
      }
      const target = tempRoot('ramp-helper-target-')
      const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      for (const [skill, source] of Object.entries(sources)) {
        const installed = collectTree(join(target, '.kiro/skills', skill))
        expect(installed.map(([path]) => path)).not.toContain('skill.yaml')
        expect(installed).toEqual(
          collectTree(join(fixture.repo, source))
            .filter(([path]) => path !== 'skill.yaml'),
        )
      }
    })

    it.runIf(available)(
      'skips skill.yaml case-sensitively and keeps Skill.yaml',
      () => {
        const fixture = createRepository()
        write(fixture.repo, 'skills/ramp/ramp-only/Skill.yaml', 'content\n')
        const target = tempRoot('ramp-helper-target-')
        const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        const installed = collectTree(join(target, '.kiro/skills/ramp-only'))
          .map(([path]) => path)
        expect(installed).toContain('Skill.yaml')
        expect(installed).not.toContain('skill.yaml')
      },
    )

    it.runIf(available)(
      'supports an explicit repository and --skills-src from a copied helper',
      () => {
        const fixture = createRepository()
        // --skills-src replaces skills/ and skills-library/, so neither
        // repository copy is consulted or trips the ambiguity guard.
        writeSkill(fixture.repo, 'skills/compat-only', 83)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const copied = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          readFileSync(fixture[scriptKey]),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 81)
        const target = tempRoot('ramp-helper-target-')

        const result = run(copied, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--repo-root',
          fixture.repo,
          '--skills-src',
          compatibility,
        ])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expectSameTree(
          join(target, '.kiro/skills/compat-only'),
          join(compatibility, 'compat-only'),
        )
        expectSameTree(
          join(target, '.kiro/skills/collision'),
          join(fixture.repo, 'packs/demo/skills/collision'),
        )
        expectSameTree(
          join(target, '.kiro/skills/ramp-only'),
          join(fixture.repo, 'skills/ramp/ramp-only'),
        )
        expect(result.stdout).toMatch(/\+ compat-only \[skills-src\]/)
        // A --skills-src hit is not a compatibility hit; the pack and RAMP tiers are.
        expect(stderrLines(result.stderr)).toEqual([
          deprecationWarning('pack-only', 'packs/demo/skills/pack-only'),
          deprecationWarning('ramp-only', 'skills/ramp/ramp-only'),
          deprecationWarning('collision', 'packs/demo/skills/collision'),
        ])
      },
    )

    it.runIf(available)(
      'warns once per compatibility hit on stderr, leaving stdout and the exit code alone',
      () => {
        const fixture = createRepository()
        const target = tempRoot('ramp-helper-target-')

        const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expect(stderrLines(result.stderr)).toEqual([
          deprecationWarning('pack-only', 'packs/demo/skills/pack-only'),
          deprecationWarning('ramp-only', 'skills/ramp/ramp-only'),
          deprecationWarning('compat-only', 'skills-library/compat-only'),
          deprecationWarning('collision', 'packs/demo/skills/collision'),
        ])
        expect(result.stdout).not.toMatch(/resolved from/)
      },
    )

    it.runIf(available)('installs skills/<slug>/ ahead of the compatibility tiers', () => {
      const fixture = createRepository({
        name: 'demo',
        skills: ['new-only', 'pack-only', 'ramp-only', 'compat-only'],
      })
      writeSkill(fixture.repo, 'skills/new-only', 41)
      const target = tempRoot('ramp-helper-target-')

      const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      expectSameTree(
        join(target, '.kiro/skills/new-only'),
        join(fixture.repo, 'skills/new-only'),
      )
      expect(result.stdout).toMatch(/\+ new-only \[skills\]/)
      expect(result.stdout).toMatch(/\+ pack-only \[pack\]/)
      expect(result.stdout).toMatch(/Done\. 4 copied/)
      expect(stderrLines(result.stderr)).toEqual([
        deprecationWarning('pack-only', 'packs/demo/skills/pack-only'),
        deprecationWarning('ramp-only', 'skills/ramp/ramp-only'),
        deprecationWarning('compat-only', 'skills-library/compat-only'),
      ])
    })

    it.runIf(available).each([
      ['skills-library'],
      ['skills/ramp'],
      ['packs/demo/skills'],
    ])(
      'fails the duplicate-slug fixture in skills/ and %s, naming both paths',
      (oldRoot) => {
        const fixture = createRepository({ name: 'demo', skills: ['duplicate'] })
        writeSkill(fixture.repo, 'skills/duplicate', 51)
        writeSkill(fixture.repo, `${oldRoot}/duplicate`, 52)
        const target = tempRoot('ramp-helper-target-')
        const sentinel = write(target, 'sentinel', 'preserve\n')

        const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

        expect(result.error).toBeUndefined()
        expect(result.status).not.toBe(0)
        expect(stderrLines(result.stderr)).toContain(
          `  - ${guardMessage('duplicate', 'skills/duplicate', `${oldRoot}/duplicate`)}`,
        )
        expect(readFileSync(sentinel, 'utf8')).toBe('preserve\n')
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'applies the ambiguity guard between --skills-src and the RAMP tier',
      () => {
        const fixture = createRepository({ name: 'demo', skills: ['ramp-only'] })
        const skillsSource = join(tempRoot('ramp-helper-skills-src-'), 'source')
        mkdirSync(skillsSource)
        writeSkill(skillsSource, 'ramp-only', 61)
        const target = tempRoot('ramp-helper-target-')

        const result = run(fixture[scriptKey], [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          skillsSource,
        ])

        expect(result.status).not.toBe(0)
        // A --skills-src directory outside the repository keeps its full path.
        const guard = stderrLines(result.stderr)
          .map((line) => /^ {2}- skill ramp-only is ambiguous: found in (.+) and skills\/ramp\/ramp-only; keep only one copy$/.exec(line))
          .find(Boolean)
        expect(guard, result.stderr).toBeDefined()
        expect(isAbsolute(guard[1])).toBe(true)
        expect(portable(guard[1])).toMatch(/\/source\/ramp-only$/)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available).each([
      ['skills/ramp', 'ramp-only'],
      ['packs/demo/skills', 'pack-only'],
    ])(
      'does not report --skills-src at the old root %s as ambiguous with itself',
      (oldRoot, skill) => {
        const fixture = createRepository({ name: 'demo', skills: [skill] })
        const target = tempRoot('ramp-helper-target-')

        const result = run(fixture[scriptKey], [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          join(fixture.repo, ...oldRoot.split('/')),
        ])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expect(result.stderr).not.toMatch(/ambiguous/)
        expect(result.stdout).toContain(`+ ${skill} [skills-src]`)
        expectSameTree(
          join(target, '.kiro/skills', skill),
          join(fixture.repo, oldRoot, skill),
        )
      },
    )

    it.runIf(available)(
      'finds a repository with skills/ alone, treating the old roots as optional',
      () => {
        const fixture = createRepository({
          name: 'demo',
          skills: ['new-only', 'pack-only'],
        })
        rmSync(join(fixture.repo, 'skills/ramp'), { recursive: true })
        rmSync(join(fixture.repo, 'skills-library'), { recursive: true })
        writeSkill(fixture.repo, 'skills/new-only', 71)
        const target = tempRoot('ramp-helper-target-')

        const result = run(fixture[scriptKey], ['--tool', 'kiro', '--target', target])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expectSameTree(
          join(target, '.kiro/skills/new-only'),
          join(fixture.repo, 'skills/new-only'),
        )
        expectSameTree(
          join(target, '.kiro/skills/pack-only'),
          join(fixture.repo, 'packs/demo/skills/pack-only'),
        )
      },
    )

    it.runIf(available)('requires skills/ in an explicit repository', () => {
      const fixture = createRepository({ name: 'demo', skills: ['pack-only'] })
      rmSync(join(fixture.repo, 'skills'), { recursive: true })
      const target = tempRoot('ramp-helper-target-')

      const result = run(fixture[scriptKey], [
        '--tool',
        'kiro',
        '--target',
        target,
        '--repo-root',
        fixture.repo,
      ])

      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/repository skills directory does not exist/)
      expect(existsSync(join(target, '.kiro'))).toBe(false)
    })

    it.runIf(available).each([['ramp'], ['README.md'], ['taxonomy']])(
      'refuses the reserved slug %s before source traversal or target mutation',
      (slug) => {
        const skillsSource = tempRoot('ramp-helper-skills-src-')
        writeSkill(skillsSource, slug, 75)
        const script = writeEditedHelper(
          tempRoot('ramp-helper-copied-'),
          scriptKey,
          [slug],
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          skillsSource,
        ])

        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain(reservedMessage(slug))
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'retains compatibility-only --skills-src usage without a repository',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 91)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const manifest = { name: 'demo', skills: ['compat-only'] }
        const script = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          scriptKey === 'bash'
            ? renderAddSkillsBash(manifest)
            : renderAddSkillsPowerShell(manifest),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(script, [
          '--tool',
          'cursor',
          '--target',
          target,
          '--skills-src',
          `${compatibility}${sep}`,
        ])

        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expectSameTree(
          join(target, '.cursor/skills/compat-only'),
          join(compatibility, 'compat-only'),
        )
      },
    )

    it.runIf(available)(
      'aggregates missing skills and performs zero target mutation',
      () => {
        const fixture = createRepository({
          name: 'demo',
          skills: ['pack-only', 'missing-one', 'missing-two'],
        })
        const target = tempRoot('ramp-helper-target-')
        const sentinel = write(target, 'sentinel.bin', Buffer.from([9, 8, 7]))

        const result = run(fixture[scriptKey], [
          '--tool',
          'kiro',
          '--target',
          target,
        ])

        expect(result.status).not.toBe(0)
        expect(result.stderr).toMatch(/missing-one/)
        expect(result.stderr).toMatch(/missing-two/)
        expect(readFileSync(sentinel)).toEqual(Buffer.from([9, 8, 7]))
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'fails a mixed-source copied helper with actionable repository guidance',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 101)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const manifest = {
          name: 'demo',
          skills: ['compat-only', 'ramp-only'],
        }
        const script = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          scriptKey === 'bash'
            ? renderAddSkillsBash(manifest)
            : renderAddSkillsPowerShell(manifest),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          `${compatibility}${sep}`,
        ])

        expect(result.status).not.toBe(0)
        expect(result.stderr).toMatch(/ramp-only/)
        // Each helper names its own spelling of the repository-root option.
        expect(result.stderr).toMatch(scriptKey === 'bash' ? /--repo-root </ : /-RepoRoot </)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'fails closed on an invalid linked higher-precedence winner',
      () => {
        const fixture = createRepository({
          name: 'demo',
          skills: ['collision'],
        })
        rmSync(join(fixture.repo, 'packs/demo/skills/collision'), {
          recursive: true,
        })
        linkDirectory(
          join(fixture.repo, 'skills/ramp/collision'),
          join(fixture.repo, 'packs/demo/skills/collision'),
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(fixture[scriptKey], [
          '--tool',
          'kiro',
          '--target',
          target,
        ])

        expect(result.status).not.toBe(0)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'rejects a linked explicit compatibility root before target mutation',
      () => {
        const real = tempRoot('ramp-helper-real-compat-')
        writeSkill(real, 'compat-only', 107)
        const parent = tempRoot('ramp-helper-compat-parent-')
        const compatibility = join(parent, 'compat')
        linkDirectory(real, compatibility)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const manifest = { name: 'demo', skills: ['compat-only'] }
        const script = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          scriptKey === 'bash'
            ? renderAddSkillsBash(manifest)
            : renderAddSkillsPowerShell(manifest),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          `${compatibility}${sep}`,
        ])

        expect(result.status).not.toBe(0)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )

    it.runIf(available)(
      'rejects a linked tool destination without escaping the target',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 108)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const manifest = { name: 'demo', skills: ['compat-only'] }
        const script = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          scriptKey === 'bash'
            ? renderAddSkillsBash(manifest)
            : renderAddSkillsPowerShell(manifest),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const target = tempRoot('ramp-helper-target-')
        const outside = tempRoot('ramp-helper-outside-')
        const marker = write(outside, 'marker', 'preserve\n')
        linkDirectory(outside, join(target, '.kiro'))

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          compatibility,
        ])

        expect(result.status).not.toBe(0)
        expect(readFileSync(marker, 'utf8')).toBe('preserve\n')
        expect(readdirSync(outside)).toEqual(['marker'])
      },
    )

    it.runIf(available).each([
      ['a traversal-shaped name', ['../escape']],
      ['a duplicate name', ['compat-only', 'compat-only']],
    ])(
      'rejects %s in an edited skill list before source traversal or target mutation',
      (_label, editedNames) => {
        const compatibilityParent = tempRoot('ramp-helper-compat-parent-')
        const compatibility = join(compatibilityParent, 'compat')
        mkdirSync(compatibility)
        writeSkill(compatibility, 'compat-only', 105)
        writeSkill(compatibilityParent, 'escape', 106)
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const validManifest = {
          name: 'demo',
          skills: ['compat-only'],
        }
        const rendered = scriptKey === 'bash'
          ? renderAddSkillsBash(validManifest)
          : renderAddSkillsPowerShell(validManifest)
        const editedList = scriptKey === 'bash'
          ? `SKILLS=(\n${editedNames.map((name) => `  ${name}`).join('\n')}\n)`
          : `$Skills = @(\n${editedNames.map((name) => `  '${name}'`).join('\n')}\n)`
        const edited = scriptKey === 'bash'
          ? rendered.replace(/SKILLS=\(\n[\s\S]*?\n\)/, editedList)
          : rendered.replace(/\$Skills = @\(\n[\s\S]*?\n\)/, editedList)
        const script = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          edited,
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const target = tempRoot('ramp-helper-target-')

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          compatibility,
        ])

        expect(result.status).not.toBe(0)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )
  })
}

function registerAdversarialRuntimeContract({
  available,
  label,
  run,
  scriptKey,
}) {
  describe(`generated helper adversarial preflight: ${label}`, { timeout: 60_000 }, () => {
    const sourceScenarios = [
      {
        label: 'linked SKILL.md',
        supported: fixtureCapabilities.fileLinks,
        arrange({ skill }) {
          rmSync(join(skill, 'SKILL.md'))
          symlinkSync('.hidden', join(skill, 'SKILL.md'), 'file')
        },
      },
      {
        label: 'linked intermediate directory',
        supported: fixtureCapabilities.directoryLinks,
        arrange({ skill }) {
          const nested = join(skill, 'nested')
          const real = join(skill, 'real-nested')
          rmSync(nested, { recursive: true })
          mkdirSync(real)
          writeFileSync(join(real, 'payload.bin'), 'payload')
          linkDirectory(real, nested)
        },
      },
      {
        label: 'FIFO source entry',
        supported: fixtureCapabilities.fifo,
        arrange({ skill }) {
          const result = spawnSync('mkfifo', [join(skill, 'events.pipe')], {
            shell: false,
          })
          expect(result.status).toBe(0)
        },
      },
      {
        label: 'case-fold path collision',
        supported: fixtureCapabilities.caseDistinctNames,
        arrange({ skill }) {
          writeFileSync(join(skill, 'Guide.md'), 'upper')
          writeFileSync(join(skill, 'guide.md'), 'lower')
        },
      },
      {
        label: 'Windows reserved path segment',
        supported: fixtureCapabilities.reservedNames,
        arrange({ skill }) {
          writeFileSync(join(skill, 'CON.txt'), 'reserved')
        },
      },
      {
        label: 'non-ASCII path segment',
        supported: true,
        arrange({ skill }) {
          writeFileSync(join(skill, 'café.md'), 'non-ascii')
        },
      },
      {
        label: 'unreadable nested source directory',
        supported: fixtureCapabilities.unreadableDirectories,
        arrange({ skill }) {
          const privateDirectory = join(skill, 'private')
          mkdirSync(privateDirectory)
          writeFileSync(join(privateDirectory, 'value'), 'private')
          chmodSync(privateDirectory, 0o000)
          return () => chmodSync(privateDirectory, 0o700)
        },
      },
    ]

    for (const scenario of sourceScenarios) {
      it.runIf(available && scenario.supported)(
        `rejects a ${scenario.label} before target mutation`,
        () => {
          const copiedRoot = tempRoot('ramp-helper-copied-')
          const script = writeHelper(copiedRoot, scriptKey, {
            name: 'demo',
            skills: ['compat-only'],
          })
          const compatibility = join(
            tempRoot('ramp-helper-compat-parent-'),
            'compat',
          )
          mkdirSync(compatibility)
          const skill = writeSkill(compatibility, 'compat-only', 111)
          const target = tempRoot('ramp-helper-target-')
          const sentinel = write(target, 'sentinel', 'preserve\n')
          const cleanup = scenario.arrange({
            compatibility,
            skill,
            target,
          })

          let result
          try {
            result = run(script, [
              '--tool',
              'kiro',
              '--target',
              target,
              '--skills-src',
              compatibility,
            ])
          } finally {
            if (cleanup) cleanup()
          }

          expect(result.status).not.toBe(0)
          expect(readFileSync(sentinel, 'utf8')).toBe('preserve\n')
          expect(existsSync(join(target, '.kiro'))).toBe(false)
        },
      )
    }

    const destinationLinkScenarios = [
      {
        label: 'target root',
        arrange(state) {
          state.outside = tempRoot('ramp-helper-real-target-')
          rmSync(state.target, { recursive: true })
          linkDirectory(state.outside, state.target)
        },
      },
      {
        label: 'tool directory',
        arrange(state) {
          state.outside = tempRoot('ramp-helper-outside-')
          linkDirectory(state.outside, join(state.target, '.kiro'))
        },
      },
      {
        label: 'skills directory',
        arrange(state) {
          state.outside = tempRoot('ramp-helper-outside-')
          mkdirSync(join(state.target, '.kiro'))
          linkDirectory(state.outside, join(state.target, '.kiro/skills'))
        },
      },
      {
        label: 'final skill directory',
        arrange(state) {
          state.outside = tempRoot('ramp-helper-outside-')
          mkdirSync(join(state.target, '.kiro/skills'), { recursive: true })
          linkDirectory(
            state.outside,
            join(state.target, '.kiro/skills/compat-only'),
          )
        },
      },
    ]

    for (const scenario of destinationLinkScenarios) {
      it.runIf(available && fixtureCapabilities.directoryLinks)(
        `rejects a linked ${scenario.label} without destination escape`,
        () => {
          const compatibility = tempRoot('ramp-helper-compat-')
          writeSkill(compatibility, 'compat-only', 121)
          const script = writeHelper(
            tempRoot('ramp-helper-copied-'),
            scriptKey,
            { name: 'demo', skills: ['compat-only'] },
          )
          const state = {
            target: join(tempRoot('ramp-helper-target-parent-'), 'target'),
            outside: null,
          }
          mkdirSync(state.target)
          scenario.arrange(state)
          const outsideMarker = write(
            state.outside,
            'outside-marker',
            'outside\n',
          )

          const result = run(script, [
            '--tool',
            'kiro',
            '--target',
            state.target,
            '--skills-src',
            compatibility,
          ])

          expect(result.status).not.toBe(0)
          expect(readFileSync(outsideMarker, 'utf8')).toBe('outside\n')
          expect(readdirSync(state.outside)).toEqual(['outside-marker'])
        },
      )
    }

    it.runIf(available && fixtureCapabilities.unreadableDirectories)(
      'rejects an unreadable existing destination before replacing it',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 131)
        const script = writeHelper(
          tempRoot('ramp-helper-copied-'),
          scriptKey,
          { name: 'demo', skills: ['compat-only'] },
        )
        const target = tempRoot('ramp-helper-target-')
        const destination = join(target, '.kiro/skills/compat-only')
        const privateDirectory = join(destination, 'private')
        mkdirSync(privateDirectory, { recursive: true })
        const marker = write(privateDirectory, 'marker', 'preserve\n')
        const sibling = write(destination, 'sibling', 'preserve\n')
        chmodSync(privateDirectory, 0o000)

        let result
        try {
          result = run(script, [
            '--tool',
            'kiro',
            '--target',
            target,
            '--skills-src',
            compatibility,
          ])
        } finally {
          chmodSync(privateDirectory, 0o700)
        }

        expect(result.status).not.toBe(0)
        expect(readFileSync(marker, 'utf8')).toBe('preserve\n')
        expect(readFileSync(sibling, 'utf8')).toBe('preserve\n')
      },
    )

    it.runIf(available && fixtureCapabilities.fifo)(
      'rejects a FIFO in an existing destination before replacing it',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 136)
        const script = writeHelper(
          tempRoot('ramp-helper-copied-'),
          scriptKey,
          { name: 'demo', skills: ['compat-only'] },
        )
        const target = tempRoot('ramp-helper-target-')
        const destination = join(target, '.kiro/skills/compat-only')
        mkdirSync(destination, { recursive: true })
        const sibling = write(destination, 'sibling', 'preserve\n')
        const fifo = join(destination, 'events.pipe')
        const fifoResult = spawnSync('mkfifo', [fifo], { shell: false })
        expect(fifoResult.status).toBe(0)

        const result = run(script, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          compatibility,
        ])

        expect(result.status).not.toBe(0)
        expect(readFileSync(sibling, 'utf8')).toBe('preserve\n')
        expect(lstatSync(fifo).isFIFO()).toBe(true)
      },
    )

    it.runIf(available && fixtureCapabilities.fileLinks)(
      'rejects a link-invoked helper before target mutation',
      () => {
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 141)
        const helperRoot = tempRoot('ramp-helper-script-')
        const real = writeHelper(helperRoot, scriptKey, {
          name: 'demo',
          skills: ['compat-only'],
        })
        const linked = join(
          helperRoot,
          scriptKey === 'bash' ? 'linked.sh' : 'linked.ps1',
        )
        symlinkSync(real, linked, 'file')
        const target = tempRoot('ramp-helper-target-')

        const result = run(linked, [
          '--tool',
          'kiro',
          '--target',
          target,
          '--skills-src',
          compatibility,
        ])

        expect(result.status).not.toBe(0)
        expect(result.stderr).toMatch(/symbolic link|reparse point/i)
        expect(existsSync(join(target, '.kiro'))).toBe(false)
      },
    )
  })
}

describe('required PowerShell engines', () => {
  if (requiredPowerShells.length === 0) {
    it.skip('set RAMP_REQUIRE_POWERSHELL to require engines', () => {})
  }
  for (const command of requiredPowerShells) {
    it(`${command} runs the PowerShell helper contract`, () => {
      const engine = powerShellEngines.find((candidate) => candidate.command === command)
      expect(engine?.available, `${command} must run on this runner`).toBe(true)
    })
  }
})

if (process.platform === 'win32') {
  describe('generated helper runtime: Bash 3.2', () => {
    it.skip('Bash helpers run on the Linux entry; Windows runners have no supported Bash', () => {})
  })
} else {
  registerRuntimeContract({
    available: true,
    label: 'Bash 3.2',
    run: runBash,
    scriptKey: 'bash',
  })
  registerAdversarialRuntimeContract({
    available: true,
    label: 'Bash 3.2',
    run: runBash,
    scriptKey: 'bash',
  })
}

for (const engine of powerShellEngines) {
  registerRuntimeContract({
    available: engine.available,
    label: engine.label,
    run: (script, args, options) =>
      runPowerShell(engine.command, script, args, options),
    scriptKey: 'powerShell',
  })
  registerAdversarialRuntimeContract({
    available: engine.available,
    label: engine.label,
    run: (script, args, options) =>
      runPowerShell(engine.command, script, args, options),
    scriptKey: 'powerShell',
  })
}

// Both engines must print the same error text for the same fixture, so the
// whole stderr is compared once paths and each engine's own spelling of the
// repository-root option are normalized.
const parityEngine = powerShellEngines.find((engine) => engine.available)
describe('Bash and PowerShell helper error parity', { timeout: 60_000 }, () => {
  if (process.platform === 'win32') {
    it.skip('parity needs Bash, which runs on the Linux entry only', () => {})
  }
  const scenarios = [
    {
      label: 'the deprecation warnings of a successful install',
      succeeds: true,
      arrange() {
        return { skills: ['pack-only', 'ramp-only', 'compat-only', 'collision'], extra: [] }
      },
    },
    {
      label: 'the duplicate-slug fixture',
      arrange(repo) {
        writeSkill(repo, 'skills/duplicate', 51)
        writeSkill(repo, 'skills-library/duplicate', 52)
        return { skills: ['duplicate'], extra: [] }
      },
    },
    {
      label: 'the ambiguity guard over --skills-src',
      arrange(repo) {
        const source = tempRoot('ramp-helper-skills-src-')
        writeSkill(source, 'ramp-only', 61)
        writeSkill(source, 'pack-only', 62)
        return { skills: ['ramp-only', 'pack-only'], extra: ['--skills-src', source], source }
      },
    },
    {
      label: 'the reserved slugs',
      arrange() {
        return { skills: ['ramp', 'README.md', 'taxonomy'], extra: [] }
      },
    },
    {
      label: 'an explicit repository without skills/',
      arrange(repo) {
        rmSync(join(repo, 'skills'), { recursive: true })
        return { skills: ['pack-only'], extra: ['--repo-root', repo] }
      },
    },
    {
      label: 'a missing --skills-src',
      arrange(repo) {
        return { skills: ['ramp-only'], extra: ['--skills-src', join(repo, 'missing-source')] }
      },
    },
    {
      label: 'a case-distinct --skills-src beside skills/ramp',
      supported: fixtureCapabilities.caseDistinctNames,
      arrange(repo) {
        writeSkill(repo, 'Skills/Ramp/ramp-only', 63)
        return {
          skills: ['ramp-only'],
          extra: ['--skills-src', join(repo, 'Skills', 'Ramp')],
        }
      },
    },
    {
      label: 'an upper-case skill name',
      arrange() {
        return { skills: ['Upper-Case'], extra: [] }
      },
    },
    {
      label: 'a missing skill',
      arrange() {
        return { skills: ['missing-one'], extra: [] }
      },
    },
    {
      label: 'a missing skill without any root',
      arrange() {
        return { skills: ['missing-one'], extra: [], helperRoot: tempRoot('ramp-helper-copied-') }
      },
    },
  ]

  for (const scenario of scenarios) {
    it.runIf(
      process.platform !== 'win32' &&
        Boolean(parityEngine) &&
        scenario.supported !== false,
    )(
      `prints the same errors for ${scenario.label}`,
      () => {
        const fixture = createRepository()
        const {
          skills,
          extra,
          source,
          helperRoot = join(fixture.repo, 'packs/demo'),
        } = scenario.arrange(fixture.repo)
        const bash = writeEditedHelper(helperRoot, 'bash', skills)
        const powerShell = writeEditedHelper(helperRoot, 'powerShell', skills)
        const target = tempRoot('ramp-helper-target-')
        const args = ['--tool', 'kiro', '--target', target, ...extra]
        const normalize = (text) => {
          let normalized = text
          for (const [path, label] of [[fixture.repo, '<repo>'], [source, '<src>']]) {
            if (!path) continue
            normalized = normalized
              .split(realpathSync(path)).join(label)
              .split(path).join(label)
          }
          return normalized
        }

        const bashResult = runBash(bash, args)
        const powerShellResult = runPowerShell(parityEngine.command, powerShell, args)

        if (scenario.succeeds) {
          expect(bashResult.status, bashResult.stderr).toBe(0)
          expect(powerShellResult.status, powerShellResult.stderr).toBe(0)
          expect(bashResult.stderr).toMatch(/resolved from/)
        } else {
          expect(bashResult.status).not.toBe(0)
          expect(powerShellResult.status).not.toBe(0)
          // Deprecation warnings may precede the error header.
          expect(normalize(bashResult.stderr)).toMatch(/^error: add-skills preflight failed:$/m)
        }
        expect(normalize(powerShellResult.stderr).split('-RepoRoot <').join('--repo-root <'))
          .toBe(normalize(bashResult.stderr))
      },
    )
  }
})
