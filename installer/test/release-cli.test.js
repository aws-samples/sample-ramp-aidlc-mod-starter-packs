import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import yauzl from 'yauzl'
import { hashSkillTree } from '../src/dependencies/checksum.js'
import { writeSkillLock } from '../src/dependencies/manifests.js'
import { releasePack } from '../src/release/index.js'

const roots = []
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BUILD_TIME = '2026-11-05T04:00:00.000Z'
const SOURCE_REPOSITORY = 'https://github.com/aws/agent-toolkit-for-aws.git'
const gitEnvironment = {
  ...process.env,
  GIT_AUTHOR_NAME: 'RAMP Tests',
  GIT_AUTHOR_EMAIL: 'ramp@example.invalid',
  GIT_COMMITTER_NAME: 'RAMP Tests',
  GIT_COMMITTER_EMAIL: 'ramp@example.invalid',
  GIT_TERMINAL_PROMPT: '0',
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC',
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRoot(prefix = 'ramp-release-cli-') {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function write(root, path, bytes, mode = 0o644) {
  const absolute = join(root, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, bytes)
  chmodSync(absolute, mode)
  return absolute
}

function git(repository, args, env = gitEnvironment) {
  return execFileSync('git', ['-C', repository, ...args], { env, encoding: 'utf8' }).trim()
}

function commitAll(repository, message = 'fixture', date = '2026-11-01T10:00:00Z') {
  git(repository, ['add', '-A'])
  git(repository, ['commit', '-q', '-m', message], {
    ...gitEnvironment,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  })
  return git(repository, ['rev-parse', 'HEAD'])
}

const PINNED_MCP = [
  'mcp:',
  '  - id: remote',
  '    transport: http',
  '    url: https://knowledge-mcp.global.api.aws',
  '  - id: python-tool',
  '    command: uvx',
  '    args: ["example-server@1.0.0"]',
]

function packYaml({
  schemaVersion = 2,
  qualifiedTargets = ['kiro', 'claude-code'],
  mcp = PINNED_MCP,
  skills = ['demo-skill'],
} = {}) {
  if (schemaVersion === 1) {
    return [
      'name: demo-pack',
      'title: Demo Pack',
      'description: Legacy fixture',
      'instructions:',
      '  - file: aidlc-workflow.md',
      '    role: primary',
      'skills: [demo-skill]',
      '',
    ].join('\n')
  }
  return [
    'schemaVersion: 2',
    'kind: ramp-pack',
    'name: demo-pack',
    'title: Demo Pack',
    'description: Release CLI fixture',
    'version: 1.2.3',
    'catalog:',
    '  outcome: automate',
    '  domain: quality-engineering',
    '  executionModel: assisted-builder',
    '  maturity: preview',
    'workflow:',
    '  provider: local-instructions-v1',
    '  overlays: []',
    'instructions:',
    '  - file: aidlc-workflow.md',
    '    role: primary',
    'command:',
    '  name: aidlc',
    '  description: Start the workflow',
    ...mcp,
    'skills:',
    ...skills.map((skill) => `  - ${skill}`),
    'distribution:',
    '  targets: [kiro, claude-code, cursor]',
    `  qualifiedTargets: [${qualifiedTargets.join(', ')}]`,
    '  profiles:',
    '    - name: shared-kiro-claude',
    '      targets: [kiro, claude-code]',
    '      workspaceMode: shared',
    '      specRoot: .kiro/specs',
    '      stateRoot: aidlc-docs',
    '    - name: kiro-only',
    '      targets: [kiro]',
    '',
  ].join('\n')
}

function makeRepository({ gitRepository = true, ...packOptions } = {}) {
  const repository = tempRoot('ramp-release-cli-repository-')
  for (const path of ['installer/bin', 'installer/src']) {
    cpSync(join(projectRoot, path), join(repository, path), { recursive: true })
  }
  for (const path of ['installer/package.json', 'installer/package-lock.json']) {
    write(repository, path, readFileSync(join(projectRoot, path)))
  }
  chmodSync(join(repository, 'installer/bin/ramp-pack.js'), 0o755)
  symlinkSync(
    join(projectRoot, 'installer', 'node_modules'),
    join(repository, 'installer', 'node_modules'),
    'dir',
  )
  write(repository, '.gitignore', 'dist/\nnode_modules\n.ramp-cache/\n')
  write(repository, 'LICENSE', 'MIT-0 fixture license\n')
  write(repository, 'dependencies/skills.sources.yaml', [
    'schemaVersion: 1',
    'sources:',
    '  - id: agent-toolkit-for-aws',
    `    repository: ${SOURCE_REPOSITORY}`,
    '    priority: 10',
    '    license: Apache-2.0',
    '    licensePath: LICENSE',
    '    noticePath: NOTICE',
    '',
  ].join('\n'))
  write(repository, 'dependencies/skills.lock.yaml', 'schemaVersion: 1\nskills: []\n')
  write(repository, 'packs/demo-pack/pack.yaml', packYaml(packOptions))
  write(
    repository,
    'common/instructions/aidlc-workflow.md',
    '# Workflow\nSpec {{SPEC_DIR}} state {{STATE_DIR}}\n',
  )
  write(repository, 'skills/ramp/demo-skill/SKILL.md', '# Demo skill\n')
  write(repository, 'skills/ramp/demo-skill/scripts/check.sh', '#!/bin/sh\nexit 0\n', 0o755)
  write(repository, 'skills/ramp/demo-skill/skill.yaml', [
    'schemaVersion: 1',
    'kind: ramp-skill',
    'name: demo-skill',
    'version: 1.0.0',
    'license: MIT-0',
    '',
  ].join('\n'))
  let sourceCommit = 'a'.repeat(40)
  if (gitRepository) {
    git(repository, ['init', '-q'])
    git(repository, ['config', 'core.autocrlf', 'false'])
    sourceCommit = commitAll(repository)
  }
  return {
    repository,
    packDir: join(repository, 'packs', 'demo-pack'),
    cacheDir: join(repository, '.ramp-cache', 'skills'),
    sourceCommit,
  }
}

function rewritePack(state, options) {
  write(state.repository, 'packs/demo-pack/pack.yaml', packYaml(options))
  state.sourceCommit = commitAll(state.repository, 'pack change')
}

function addUpstreamSkill(state, name = 'upstream-skill') {
  const commit = 'b'.repeat(40)
  const sourcePath = `skills/core-skills/${name}`
  const groupRoot = join(state.cacheDir, 'sources', 'agent-toolkit-for-aws', commit)
  const skillRoot = join(groupRoot, ...sourcePath.split('/'))
  write(skillRoot, 'SKILL.md', '# Upstream skill\n')
  write(groupRoot, 'LICENSE', 'Apache license\n')
  write(groupRoot, 'NOTICE', 'AWS notice\n')
  const hashed = hashSkillTree(skillRoot)
  const legal = (path, text) => ({
    path,
    sha256: sha256(Buffer.from(text)),
    size: Buffer.byteLength(text),
    executable: false,
  })
  writeSkillLock(state.repository, {
    schemaVersion: 1,
    skills: new Map([[name, {
      name,
      source: 'agent-toolkit-for-aws',
      repository: SOURCE_REPOSITORY,
      commit,
      path: sourcePath,
      treeSha256: hashed.treeSha256,
      files: hashed.files,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      licenseFile: legal('LICENSE', 'Apache license\n'),
      noticePath: 'NOTICE',
      noticeFile: legal('NOTICE', 'AWS notice\n'),
    }]]),
  })
  rewritePack(state, { skills: ['demo-skill', name] })
  return { skillRoot }
}

function options(state, overrides = {}) {
  return {
    target: 'kiro',
    repoRoot: state.repository,
    cacheDir: state.cacheDir,
    outDir: join(state.repository, 'dist'),
    env: {},
    ...overrides,
  }
}

function runCli(state, args, { env = {}, cwd = state.repository } = {}) {
  return spawnSync(
    process.execPath,
    [join(state.repository, 'installer', 'bin', 'ramp-pack.js'), 'release', ...args],
    {
      cwd,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LC_ALL: 'C',
        TZ: 'UTC',
        ...env,
      },
    },
  )
}

function zipEntries(file) {
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

describe('releasePack', () => {
  it('writes one safe archive under ignored dist with repository-verified provenance', async () => {
    const state = makeRepository()
    const result = await releasePack(state.packDir, options(state))

    expect(result.archivePath).toBe(join(state.repository, 'dist', 'demo-pack--kiro--v1.2.3.zip'))
    expect(result.sha256).toBe(sha256(readFileSync(result.archivePath)))
    expect(result.warnings).toEqual([])
    expect(result.manifest.source).toEqual({
      attribution: 'repository-verified',
      sourceCommit: state.sourceCommit,
      buildTime: '2026-11-01T10:00:00.000Z',
    })
    expect(git(state.repository, ['status', '--porcelain'])).toBe('')
    expect(readdirSync(join(state.repository, 'dist'))).toEqual(['demo-pack--kiro--v1.2.3.zip'])

    const entries = await zipEntries(result.archivePath)
    const root = 'demo-pack--kiro--v1.2.3/'
    expect(entries.every((entry) => entry.path.startsWith(root))).toBe(true)
    const byPath = new Map(entries.map((entry) => [entry.path.slice(root.length), entry]))
    expect(byPath.get('install.sh').mode).toBe(0o100755)
    expect(byPath.get('install.ps1').mode).toBe(0o100644)
    expect(byPath.get('overlay/.kiro/skills/demo-skill/scripts/check.sh').mode).toBe(0o100755)
    expect(byPath.get('overlay/.kiro/skills/demo-skill/SKILL.md').bytes.toString())
      .toBe('# Demo skill\n')
    const manifest = JSON.parse(byPath.get('bundle-manifest.json').bytes.toString())
    expect(manifest).toEqual(result.manifest)
  })

  it('rebuilds byte-identical archives into a different output directory', async () => {
    const state = makeRepository()
    const first = await releasePack(state.packDir, options(state))
    const otherOut = join(state.repository, 'dist', 'second')
    const second = await releasePack(state.packDir, options(state, { outDir: otherOut }))

    expect(second.sha256).toBe(first.sha256)
    expect(readFileSync(second.archivePath).equals(readFileSync(first.archivePath))).toBe(true)
  })

  it('changes bundle and archive checksums when one skill byte changes', async () => {
    const state = makeRepository()
    const before = await releasePack(state.packDir, options(state, { buildTime: BUILD_TIME }))
    write(state.repository, 'skills/ramp/demo-skill/SKILL.md', '# Demo skilL\n')
    state.sourceCommit = commitAll(state.repository, 'skill change')
    const after = await releasePack(state.packDir, options(state, { buildTime: BUILD_TIME }))

    expect(after.sha256).not.toBe(before.sha256)
    const skillRecord = (manifest) =>
      manifest.files.find((file) => file.path === 'overlay/.kiro/skills/demo-skill/SKILL.md')
    expect(skillRecord(after.manifest).sha256).not.toBe(skillRecord(before.manifest).sha256)
  })

  it('names profile artifacts and records the shared roots', async () => {
    const state = makeRepository()
    const result = await releasePack(state.packDir, options(state, {
      target: 'claude-code',
      profile: 'shared-kiro-claude',
    }))

    expect(result.archivePath.endsWith('demo-pack--claude-code--shared-kiro-claude--v1.2.3.zip'))
      .toBe(true)
    expect(result.manifest.workspace).toMatchObject({ specRoot: '.kiro/specs', stateRoot: 'aidlc-docs' })
  })

  it('uses SOURCE_DATE_EPOCH for build time only and an explicit build time over both', async () => {
    const state = makeRepository()
    const fromEpoch = await releasePack(state.packDir, options(state, {
      env: { SOURCE_DATE_EPOCH: '1767225600' },
    }))
    expect(fromEpoch.manifest.source).toEqual({
      attribution: 'repository-verified',
      sourceCommit: state.sourceCommit,
      buildTime: '2026-01-01T00:00:00.000Z',
    })

    const explicit = await releasePack(state.packDir, options(state, {
      env: { SOURCE_DATE_EPOCH: '1767225600' },
      buildTime: '2026-11-05T05:00:00+01:00',
    }))
    expect(explicit.manifest.source.buildTime).toBe(BUILD_TIME)
  })

  it.each([
    ['not-a-number'],
    ['12.5'],
    ['-1'],
    ['100'],
  ])('rejects an invalid SOURCE_DATE_EPOCH %s', async (value) => {
    const state = makeRepository()
    await expect(releasePack(state.packDir, options(state, {
      env: { SOURCE_DATE_EPOCH: value },
    }))).rejects.toThrow(/SOURCE_DATE_EPOCH/)
  })

  it.each([
    ['2026-11-05'],
    ['Nov 5 2026'],
    ['2026-11-05T04:00:00'],
    ['2026-13-05T04:00:00Z'],
  ])('rejects a non-ISO or zone-less build time %s', async (buildTime) => {
    const state = makeRepository()
    await expect(releasePack(state.packDir, options(state, { buildTime })))
      .rejects.toThrow(/buildTime/)
  })

  it('records caller-supplied provenance outside Git and requires both values', async () => {
    const state = makeRepository({ gitRepository: false })
    await expect(releasePack(state.packDir, options(state)))
      .rejects.toThrow(/outside Git.*--source-commit.*--build-time/)
    await expect(releasePack(state.packDir, options(state, { sourceCommit: state.sourceCommit })))
      .rejects.toThrow(/--build-time/)
    await expect(releasePack(state.packDir, options(state, {
      buildTime: BUILD_TIME,
      env: { SOURCE_DATE_EPOCH: '1767225600' },
    }))).rejects.toThrow(/--source-commit/)

    const result = await releasePack(state.packDir, options(state, {
      sourceCommit: state.sourceCommit,
      buildTime: BUILD_TIME,
    }))
    expect(result.manifest.source).toEqual({
      attribution: 'caller-supplied',
      callerSuppliedSourceCommit: state.sourceCommit,
      buildTime: BUILD_TIME,
    })
  })

  it('rejects a dirty consumed input even when SOURCE_DATE_EPOCH is set', async () => {
    const state = makeRepository()
    write(state.repository, 'skills/ramp/demo-skill/SKILL.md', '# Dirty skill\n')
    // An explicit commit skips the derivation check, so buildBundle's own gate must catch it.
    await expect(releasePack(state.packDir, options(state, {
      sourceCommit: state.sourceCommit,
      env: { SOURCE_DATE_EPOCH: '1767225600' },
    }))).rejects.toThrow(/mismatch commit/)
    expect(existsSync(join(state.repository, 'dist'))).toBe(false)
  })

  it('rejects an untracked file materialized from a consumed skill tree', async () => {
    const state = makeRepository()
    write(state.repository, 'skills/ramp/demo-skill/references/new.md', 'untracked\n')
    await expect(releasePack(state.packDir, options(state))).rejects.toThrow()
  })

  it('refuses to derive provenance while a tracked release input is modified', async () => {
    const state = makeRepository()
    write(
      state.repository,
      'installer/src/release/zip.js',
      `${readFileSync(join(state.repository, 'installer/src/release/zip.js'), 'utf8')}// local edit\n`,
    )
    await expect(releasePack(state.packDir, options(state, {
      env: { SOURCE_DATE_EPOCH: '1767225600' },
    }))).rejects.toThrow(/tracked changes under release inputs: installer\/src\/release\/zip\.js/)
    expect(existsSync(join(state.repository, 'dist'))).toBe(false)
  })

  it('allows untracked planning files outside the consumed inputs', async () => {
    const state = makeRepository()
    write(state.repository, 'docs/research/notes.md', 'draft\n')
    write(state.repository, 'plans/next.md', 'draft\n')
    const result = await releasePack(state.packDir, options(state))
    expect(result.manifest.source.attribution).toBe('repository-verified')
  })

  it('rejects a v1 pack', async () => {
    const state = makeRepository({ schemaVersion: 1 })
    await expect(releasePack(state.packDir, options(state))).rejects.toThrow(/schemaVersion 2/)
  })

  it('rejects undeclared and unqualified targets', async () => {
    const state = makeRepository({ qualifiedTargets: ['kiro'] })
    await expect(releasePack(state.packDir, options(state, { target: 'copilot' })))
      .rejects.toThrow(/not declared/)
    await expect(releasePack(state.packDir, options(state, { target: 'cursor' })))
      .rejects.toThrow(/not qualified/)
    await expect(releasePack(state.packDir, options(state, { target: 'claude-code' })))
      .rejects.toThrow(/not qualified/)
  })

  it('rejects unknown profiles and targets outside the selected profile', async () => {
    const state = makeRepository()
    await expect(releasePack(state.packDir, options(state, { profile: 'missing' })))
      .rejects.toThrow(/unknown workspace profile/)
    await expect(releasePack(state.packDir, options(state, {
      target: 'claude-code',
      profile: 'kiro-only',
    }))).rejects.toThrow(/does not include tool/)
  })

  it('rejects a missing and a drifted locked upstream skill', async () => {
    const state = makeRepository()
    const { skillRoot } = addUpstreamSkill(state)
    const built = await releasePack(state.packDir, options(state))
    expect(built.manifest.skills.map((skill) => skill.name)).toContain('upstream-skill')

    writeFileSync(join(skillRoot, 'SKILL.md'), '# Drifted\n')
    await expect(releasePack(state.packDir, options(state))).rejects.toThrow()

    rmSync(state.cacheDir, { recursive: true, force: true })
    await expect(releasePack(state.packDir, options(state))).rejects.toThrow()
  })

  it.each([
    [['    command: uvx', '    args: ["mcp-proxy-for-aws@latest", "https://example.invalid"]']],
    [['    command: npx', '    args: ["-y", "@scope/server@next"]']],
    [['    command: npx', '    args: ["server@^1.2.0"]']],
    [['    command: uvx', '    args: ["--from", "server>=1.0", "server"]']],
    [['    command: docker', '    args: ["run", "tool@latest"]']],
  ])('rejects floating runtime selectors %#', async (server) => {
    const state = makeRepository({
      mcp: ['mcp:', '  - id: floating', ...server],
    })
    await expect(releasePack(state.packDir, options(state)))
      .rejects.toThrow(/floating runtime selector/)
  })

  it('warns on unversioned npx and uvx packages and blocks profile qualification', async () => {
    const state = makeRepository({
      mcp: [
        'mcp:',
        '  - id: node-tool',
        '    command: npx',
        '    args: ["-y", "mcp-remote", "https://example.invalid"]',
        '  - id: python-tool',
        '    command: uvx',
        '    args: ["awslabs.example-server"]',
        '  - id: pinned-node',
        '    command: npx',
        '    args: ["@scope/server@1.2.3"]',
        '  - id: pinned-python',
        '    command: uvx',
        '    args: ["awslabs.other-server==2.0.1"]',
      ],
    })
    const result = await releasePack(state.packDir, options(state))
    expect(result.warnings).toEqual([
      'MCP server node-tool runs unversioned npx package mcp-remote; pin an exact version',
      'MCP server python-tool runs unversioned uvx package awslabs.example-server; pin an exact version',
    ])

    await expect(releasePack(state.packDir, options(state, { profile: 'shared-kiro-claude' })))
      .rejects.toThrow(/profile shared-kiro-claude cannot be qualified.*mcp-remote/)
  })

  it('refuses to write a release into a tracked repository path', async () => {
    const state = makeRepository()
    await expect(releasePack(state.packDir, options(state, {
      outDir: join(state.repository, 'packs', 'demo-pack', 'out'),
    }))).rejects.toThrow(/git-ignored/)
    expect(existsSync(join(state.packDir, 'out'))).toBe(false)
  })
})

describe('ramp-pack release CLI', () => {
  it('builds one target into ignored dist and prints the checksum', () => {
    const state = makeRepository()
    const run = runCli(state, ['demo-pack', '--target', 'kiro'])

    expect(run.status, run.stderr).toBe(0)
    const archive = join(state.repository, 'dist', 'demo-pack--kiro--v1.2.3.zip')
    expect(run.stdout).toContain(`${sha256(readFileSync(archive))}  ${archive}`)
    expect(git(state.repository, ['status', '--porcelain'])).toBe('')
    expect(git(state.repository, ['check-ignore', archive])).toBe(archive)
  })

  it('builds every qualified target with --all-targets and nothing else', () => {
    const state = makeRepository()
    const run = runCli(state, ['demo-pack', '--all-targets'])

    expect(run.status, run.stderr).toBe(0)
    expect(readdirSync(join(state.repository, 'dist')).sort()).toEqual([
      'demo-pack--claude-code--v1.2.3.zip',
      'demo-pack--kiro--v1.2.3.zip',
    ])
  })

  it('is byte-identical across TZ, locale, cwd, and output directory', () => {
    const state = makeRepository()
    const firstOut = tempRoot('ramp-release-cli-out-a-')
    const secondOut = tempRoot('ramp-release-cli-out-b-')
    const first = runCli(state, ['demo-pack', '--target', 'kiro', '--out', firstOut], {
      env: { TZ: 'Pacific/Chatham', LC_ALL: 'tr_TR.UTF-8', LANG: 'tr_TR.UTF-8' },
      cwd: firstOut,
    })
    const second = runCli(state, ['demo-pack', '--target', 'kiro', '--out', 'nested'], {
      env: { TZ: 'America/Los_Angeles', LC_ALL: 'C' },
      cwd: secondOut,
    })

    expect(first.status, first.stderr).toBe(0)
    expect(second.status, second.stderr).toBe(0)
    const name = 'demo-pack--kiro--v1.2.3.zip'
    expect(readFileSync(join(secondOut, 'nested', name)).equals(readFileSync(join(firstOut, name))))
      .toBe(true)
  })

  it('accepts explicit provenance options and SOURCE_DATE_EPOCH', () => {
    const state = makeRepository({ gitRepository: false })
    const run = runCli(state, [
      'demo-pack',
      '--target', 'kiro',
      '--source-commit', state.sourceCommit,
    ], { env: { SOURCE_DATE_EPOCH: '1767225600' } })

    expect(run.status, run.stderr).toBe(0)
    const archive = join(state.repository, 'dist', 'demo-pack--kiro--v1.2.3.zip')
    expect(existsSync(archive)).toBe(true)
  })

  it('prints warnings to stderr', () => {
    const state = makeRepository({
      mcp: ['mcp:', '  - id: node-tool', '    command: npx', '    args: ["mcp-remote"]'],
    })
    const run = runCli(state, ['demo-pack', '--target', 'kiro'])

    expect(run.status, run.stderr).toBe(0)
    expect(run.stderr).toContain('warning: MCP server node-tool runs unversioned npx package mcp-remote')
  })

  it.each([
    [['demo-pack'], /exactly one of --target or --all-targets/],
    [['demo-pack', '--target', 'kiro', '--all-targets'], /exactly one of --target or --all-targets/],
    [['missing-pack', '--target', 'kiro'], /Pack not found: missing-pack/],
    [['demo-pack', '--target', 'cursor'], /not qualified/],
  ])('fails closed for %j', (args, message) => {
    const state = makeRepository()
    const run = runCli(state, args)

    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(message)
    expect(existsSync(join(state.repository, 'dist'))).toBe(false)
  })

  it('fails --all-targets when the pack has no qualified targets', () => {
    const state = makeRepository({ qualifiedTargets: [] })
    const run = runCli(state, ['demo-pack', '--all-targets'])

    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/no qualified targets/)
  })
})
