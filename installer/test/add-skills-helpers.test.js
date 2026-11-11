import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  renderAddSkills,
  renderAddSkillsBash,
  renderAddSkillsPowerShell,
} from '../src/render/add-skills.js'

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
  describe(`generated helper runtime: ${label}`, () => {
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

    it.runIf(available)(
      'supports an explicit repository and compatibility override from a copied helper',
      () => {
        const fixture = createRepository()
        const copiedRoot = tempRoot('ramp-helper-copied-')
        const copied = write(
          copiedRoot,
          scriptKey === 'bash' ? 'add-skills.sh' : 'add-skills.ps1',
          readFileSync(fixture[scriptKey]),
          scriptKey === 'bash' ? 0o755 : 0o644,
        )
        const compatibility = tempRoot('ramp-helper-compat-')
        writeSkill(compatibility, 'compat-only', 81)
        writeSkill(compatibility, 'collision', 82)
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
  describe(`generated helper adversarial preflight: ${label}`, () => {
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

registerRuntimeContract({
  available: process.platform !== 'win32',
  label: 'Bash 3.2',
  run: runBash,
  scriptKey: 'bash',
})
registerAdversarialRuntimeContract({
  available: process.platform !== 'win32',
  label: 'Bash 3.2',
  run: runBash,
  scriptKey: 'bash',
})

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
