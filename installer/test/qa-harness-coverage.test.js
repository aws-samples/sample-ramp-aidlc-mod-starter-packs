// QA Automated Testing on every harness. For each harness of the adapter
// registry, except the approved incompatibilities, the pack declares and
// qualifies it, its release ZIP holds that harness's layout, and the bundle
// installers (install.sh, and install.ps1 on each PowerShell engine) install
// it into a temporary project, reinstall without a change, refuse an unowned
// primary instruction file, and uninstall to an empty project.
//
// The ZIPs need a synchronized skill cache (RAMP_SKILLS_CACHE) and skip
// without one. The CI helper job names its PowerShell engines in
// RAMP_REQUIRE_POWERSHELL; there a missing engine or cache fails instead.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import yauzl from 'yauzl'
import { listAdapterIds } from '../src/adapters/index.js'
import { loadManifest } from '../src/manifest.js'
import { releasePack } from '../src/release/index.js'
import { createLayoutContext, repoRoot, treeLayout } from './support/customer-layout.js'
import { harnessIncompatibilities } from './support/harness-incompatibilities.js'
import { expectSuccess, snapshot, write } from './support/install-oracle.js'

// A pwsh parent (the GitHub Windows runner's default shell) leaves PowerShell 7
// module paths in PSModulePath, and Windows PowerShell 5.1 then cannot load
// Get-FileHash. Every engine builds its own default path, as from a customer shell.
if (process.platform === 'win32') delete process.env.PSModulePath

const PACK = 'qa-automated-testing'
const manifest = loadManifest(join(repoRoot, 'packs', PACK))
const SOURCE_COMMIT = '0'.repeat(40)
const BUILD_TIME = '2026-01-01T00:00:00.000Z'

const harnesses = listAdapterIds().filter((id) => !Object.hasOwn(harnessIncompatibilities, id))
const cacheDir = process.env.RAMP_SKILLS_CACHE?.trim() || undefined
const requiredPowerShells = (process.env.RAMP_REQUIRE_POWERSHELL ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

const [server] = manifest.mcp
const reverseEngineering = manifest.instructions
  .find((entry) => entry.file === 'reverse-engineering.md').description
const workflowTitle = '# Decision-Driven Document Generation Workflow\n'
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

// What each harness reads. `frontmatter` maps every instruction and command
// file to its exact frontmatter, or null for none; the primary opens with
// `opening` after its frontmatter. `mcp` is the parsed configuration and its
// exact bytes. Every overlay path lies under `roots` or is one of `rootFiles`.
const HARNESSES = {
  kiro: {
    roots: ['.kiro/'],
    rootFiles: [],
    skillsRoot: '.kiro/skills',
    frontmatter: {
      '.kiro/steering/aidlc-workflow.md': 'inclusion: always',
      '.kiro/steering/skill-activation.md': 'inclusion: always',
      '.kiro/steering/reverse-engineering.md': 'inclusion: auto',
    },
    primary: { path: '.kiro/steering/aidlc-workflow.md', opening: workflowTitle },
    mcp: jsonMcp('.kiro/settings/mcp.json', { mcpServers: { [server.id]: { url: server.url, type: 'http' } } }),
  },
  'claude-code': {
    roots: ['.claude/'],
    rootFiles: ['CLAUDE.md', '.mcp.json'],
    skillsRoot: '.claude/skills',
    frontmatter: {
      'CLAUDE.md': null,
      '.claude/rules/skill-activation.md': null,
      '.claude/rules/reverse-engineering.md': null,
      '.claude/commands/aidlc.md': `description: ${manifest.command.description}`,
    },
    primary: {
      path: 'CLAUDE.md',
      opening: [
        'Companion rules files load automatically and MUST be followed:',
        '- `.claude/rules/skill-activation.md`',
        '- `.claude/rules/reverse-engineering.md`',
        '',
        workflowTitle,
      ].join('\n'),
    },
    mcp: jsonMcp('.mcp.json', { mcpServers: { [server.id]: { url: server.url, type: 'http' } } }),
  },
  copilot: {
    roots: ['.github/', '.vscode/'],
    rootFiles: [],
    skillsRoot: '.github/skills',
    frontmatter: {
      '.github/copilot-instructions.md': null,
      '.github/instructions/skill-activation.instructions.md': "applyTo: '**'",
      '.github/instructions/reverse-engineering.instructions.md': `description: ${reverseEngineering}`,
      '.github/prompts/aidlc.prompt.md': [
        `description: ${manifest.command.description}`,
        'argument-hint: "describe what you\'re building"',
      ].join('\n'),
    },
    primary: { path: '.github/copilot-instructions.md', opening: workflowTitle },
    mcp: jsonMcp('.vscode/mcp.json', { servers: { [server.id]: { type: 'http', url: server.url } } }),
  },
  cursor: {
    roots: ['.cursor/'],
    rootFiles: [],
    skillsRoot: '.cursor/skills',
    frontmatter: {
      '.cursor/rules/aidlc-workflow.mdc': 'alwaysApply: true',
      '.cursor/rules/skill-activation.mdc': 'alwaysApply: true',
      '.cursor/rules/reverse-engineering.mdc': [
        `description: ${JSON.stringify(reverseEngineering)}`,
        'alwaysApply: false',
      ].join('\n'),
    },
    primary: { path: '.cursor/rules/aidlc-workflow.mdc', opening: workflowTitle },
    mcp: jsonMcp('.cursor/mcp.json', { mcpServers: { [server.id]: { url: server.url, type: 'http' } } }),
  },
  codex: {
    roots: ['.codex/', '.agents/'],
    rootFiles: ['AGENTS.md'],
    skillsRoot: '.agents/skills',
    frontmatter: {
      'AGENTS.md': null,
      '.codex/instructions/skill-activation.md': null,
      '.codex/instructions/reverse-engineering.md': null,
    },
    primary: {
      path: 'AGENTS.md',
      opening: [
        'Codex loads only this file. Read each instruction file below and follow it:',
        '- `.codex/instructions/skill-activation.md`: read at session start.',
        `- \`.codex/instructions/reverse-engineering.md\`: read when this applies: ${reverseEngineering}`,
        '',
        workflowTitle,
      ].join('\n'),
      // Codex reads at most project_doc_max_bytes (32 KiB by default) of AGENTS.md.
      maxBytes: 32 * 1024,
    },
    mcp: {
      path: '.codex/config.toml',
      parse: parseToml,
      value: { mcp_servers: { [server.id]: { url: server.url } } },
      text: `[mcp_servers.${server.id}]\nurl = "${server.url}"\n`,
    },
  },
}

function jsonMcp(path, value) {
  return { path, parse: JSON.parse, value, text: json(value) }
}

function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: null, body: text }
  const end = text.indexOf('\n---\n', 4)
  return { frontmatter: text.slice(4, end), body: text.slice(end + '\n---\n'.length) }
}

function readZip(file) {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(file, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(error)
      const entries = []
      zip.on('error', reject)
      zip.on('end', () => resolvePromise(entries))
      zip.on('entry', (entry) => {
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError)
          const chunks = []
          stream.on('data', (chunk) => chunks.push(chunk))
          stream.on('error', reject)
          stream.on('end', () => {
            entries.push({
              path: entry.fileName,
              bytes: Buffer.concat(chunks),
              mode: entry.externalFileAttributes >>> 16,
            })
            zip.readEntry()
          })
        })
      })
      zip.readEntry()
    })
  })
}

function probePowerShell(command) {
  const result = spawnSync(command, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'exit 0'], {
    encoding: 'utf8',
    shell: false,
  })
  return !result.error && result.status === 0
}

// install.sh on POSIX, and install.ps1 on each required PowerShell engine, or
// on pwsh when it is present and none is required.
const powerShells = requiredPowerShells.length > 0
  ? requiredPowerShells
  : ['pwsh'].filter((command) => probePowerShell(command))
const engines = [
  ...(process.platform === 'win32' ? [] : [{
    label: 'install.sh',
    run: (bundleDir, target, ...flags) => ['bash', [join(bundleDir, 'install.sh'), '--target', target, ...flags]],
  }]),
  ...powerShells.map((command) => ({
    label: `install.ps1 on ${command}`,
    run: (bundleDir, target, ...flags) => [command, [
      '-NoLogo', '-NoProfile', '-NonInteractive',
      ...(process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : []),
      '-File', join(bundleDir, 'install.ps1'),
      '-Target', target,
      ...flags.map((flag) => (flag === '--uninstall' ? '-Uninstall' : flag)),
    ]],
  })),
]

// Asynchronous, so the install scenarios of the harnesses run concurrently.
function install(engine, bundleDir, target, ...flags) {
  const [command, args] = engine.run(bundleDir, target, ...flags)
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd: bundleDir, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stdout.resume()
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => resolvePromise({ error, status: null, stderr }))
    child.on('close', (status) => resolvePromise({ status, stderr }))
  })
}

// The customer files of a project: everything outside the installer state.
function projectFiles(root) {
  return treeLayout(root)
    .filter((record) => !record.path.startsWith('.ramp/'))
    .map(({ path, sha256 }) => ({ path, sha256 }))
}

describe('QA Automated Testing harness coverage', () => {
  it('declares and qualifies every registered harness, in registry order', () => {
    expect(manifest.distribution.targets).toEqual(harnesses)
    expect(manifest.distribution.qualifiedTargets).toEqual(harnesses)
  })

  it('states the expected layout of every registered harness', () => {
    expect(harnesses.filter((id) => !Object.hasOwn(HARNESSES, id))).toEqual([])
  })

  if (requiredPowerShells.length > 0) {
    it('has a synchronized skill cache for the release ZIPs', () => {
      expect(cacheDir, 'RAMP_SKILLS_CACHE must name the synchronized cache').toBeDefined()
    })
    for (const command of requiredPowerShells) {
      it(`${command} runs install.ps1`, () => {
        expect(probePowerShell(command), `${command} must run on this runner`).toBe(true)
      })
    }
  } else if (powerShells.length === 0) {
    it.skip('pwsh not found: install.ps1 skipped (RAMP_REQUIRE_POWERSHELL=pwsh requires it)', () => {})
  }
  if (cacheDir === undefined) {
    it.skip('set RAMP_SKILLS_CACHE to build and install the release ZIPs', () => {})
  }
})

describe.skipIf(cacheDir === undefined)('QA Automated Testing release ZIP on each harness', () => {
  // harness -> { artifactName, entries, overlay: Map(path -> bytes) }
  const zips = new Map()
  let scratch

  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'ramp-qa-harness-'))
    const context = createLayoutContext({ cacheDir })
    try {
      const releaseRoot = context.releaseRoot()
      for (const harness of harnesses) {
        const artifactName = `${PACK}--${harness}--v${manifest.version}`
        const { archivePath } = await releasePack(join(releaseRoot, 'packs', PACK), {
          target: harness,
          repoRoot: releaseRoot,
          cacheDir,
          sourceCommit: SOURCE_COMMIT,
          buildTime: BUILD_TIME,
          outDir: join(scratch, 'zips'),
        })
        expect(archivePath).toBe(join(scratch, 'zips', `${artifactName}.zip`))
        const entries = await readZip(archivePath)
        const prefix = `${artifactName}/overlay/`
        const overlay = new Map(entries
          .filter((entry) => entry.path.startsWith(prefix))
          .map((entry) => [entry.path.slice(prefix.length), entry.bytes]))
        zips.set(harness, { artifactName, entries, overlay })
      }
    } finally {
      context.dispose()
    }
  }, 300_000)
  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true })
  })

  describe.each(harnesses)('%s', (harness) => {
    const expected = HARNESSES[harness]
    const skillPrefix = `${expected.skillsRoot}/`

    it('places every file under the harness roots or its root files', () => {
      const { artifactName, entries, overlay } = zips.get(harness)
      expect(entries.every((entry) => entry.path.startsWith(`${artifactName}/`))).toBe(true)
      const outside = [...overlay.keys()].filter((path) =>
        !expected.roots.some((root) => path.startsWith(root)) && !expected.rootFiles.includes(path))
      expect(outside).toEqual([])
    })

    it('holds exactly the instruction, command, MCP and skill files', () => {
      const files = [...zips.get(harness).overlay.keys()]
        .filter((path) => !path.startsWith(skillPrefix))
        .sort()
      expect(files).toEqual([...Object.keys(expected.frontmatter), expected.mcp.path].sort())
    })

    it('renders each instruction and command file with its frontmatter', () => {
      const { overlay } = zips.get(harness)
      for (const [path, frontmatter] of Object.entries(expected.frontmatter)) {
        expect(splitFrontmatter(overlay.get(path).toString('utf8')).frontmatter, path).toBe(frontmatter)
      }
      const primary = overlay.get(expected.primary.path)
      expect(splitFrontmatter(primary.toString('utf8')).body.startsWith(expected.primary.opening))
        .toBe(true)
      if (expected.primary.maxBytes !== undefined) {
        expect(primary.length).toBeLessThanOrEqual(expected.primary.maxBytes)
      }
    })

    it('writes the MCP servers to the harness configuration file and format', () => {
      const text = zips.get(harness).overlay.get(expected.mcp.path).toString('utf8')
      expect(expected.mcp.parse(text)).toEqual(expected.mcp.value)
      expect(text).toBe(expected.mcp.text)
    })

    it('ships the 8 pack skills under the harness skills root', () => {
      const { overlay } = zips.get(harness)
      const skills = new Set([...overlay.keys()]
        .filter((path) => path.startsWith(skillPrefix))
        .map((path) => path.slice(skillPrefix.length).split('/')[0]))
      expect(manifest.skills).toHaveLength(8)
      expect([...skills].sort()).toEqual([...manifest.skills].sort())
      for (const skill of manifest.skills) {
        expect(overlay.has(`${skillPrefix}${skill}/SKILL.md`), skill).toBe(true)
      }
    })
  })

  describe('bundle installers', () => {
    // Each scenario owns its folders: a shared afterEach cleanup would remove
    // them while concurrent scenarios still run.
    async function withFolders(harness, scenario) {
      const root = mkdtempSync(join(scratch, 'case-'))
      try {
        const { artifactName, entries } = zips.get(harness)
        for (const entry of entries) write(join(root, 'bundle'), entry.path, entry.bytes, entry.mode & 0o777)
        const target = join(root, 'project')
        mkdirSync(target)
        await scenario(join(root, 'bundle', artifactName), target)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }

    const cases = harnesses.flatMap((harness) => engines.map((engine) => [harness, engine.label, engine]))
    if (cases.length === 0) it.skip('no bundle installer engine on this runner', () => {})

    it.concurrent.each(cases)(
      '%s, %s: installs, reinstalls without a change, and uninstalls to an empty project',
      (harness, _label, engine) => withFolders(harness, async (bundleDir, target) => {
        expectSuccess(await install(engine, bundleDir, target))
        expect(projectFiles(target)).toEqual(projectFiles(join(bundleDir, 'overlay')))

        const installed = snapshot(target)
        expectSuccess(await install(engine, bundleDir, target))
        expect(snapshot(target)).toEqual(installed)

        // Uninstall removes every file; only the empty installer state folder stays.
        expectSuccess(await install(engine, bundleDir, target, '--uninstall'))
        expect(snapshot(target).map(([path]) => path)).toEqual(['.ramp', '.ramp/installed'])
      }),
      600_000,
    )

    it.concurrent.each(cases)(
      '%s, %s: refuses an unowned primary instruction file',
      (harness, _label, engine) => withFolders(harness, async (bundleDir, target) => {
        const { path } = HARNESSES[harness].primary
        write(target, path, 'customer instructions\n')
        const before = snapshot(target)
        const result = await install(engine, bundleDir, target)
        expect(result.error).toBeUndefined()
        expect(result.status).not.toBe(0)
        expect(snapshot(target)).toEqual(before)
        expect(readFileSync(join(bundleDir, 'install-conflicts.txt'), 'utf8')).toContain(path)
      }),
      600_000,
    )
  })
})
