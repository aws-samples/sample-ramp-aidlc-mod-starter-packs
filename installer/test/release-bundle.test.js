import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { comparePortablePaths, hashSkillTree } from '../src/dependencies/checksum.js'
import { writeSkillLock } from '../src/dependencies/manifests.js'
import {
  collectPlanEntries,
  readOrdinaryFile,
} from '../src/release/entries.js'
import {
  renderSha256Sums,
  sha256Hex,
  stableJson,
} from '../src/release/stable-json.js'
import { createInputClosure } from '../src/release/input-closure.js'
import {
  collectLegalPayloads,
  renderThirdPartyNotices,
} from '../src/release/notices.js'
import {
  containsLocalAbsolutePath,
  renderReadmeFirst,
} from '../src/release/readme-first.js'
import { buildBundle } from '../src/release/bundle.js'
import { renderInstallers } from '../src/release/installers.js'

const roots = []
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMMIT = 'a'.repeat(40)
const SOURCE_REPOSITORY =
  'https://github.com/aws/agent-toolkit-for-aws.git'
const BUILD_TIME = '2026-11-05T04:00:00.000Z'
const GENERATOR_FILES = [
  'installer/package.json',
  'installer/package-lock.json',
  'installer/src/plan.js',
  'installer/src/manifest.js',
  'installer/src/workspace.js',
  'installer/src/skills.js',
  'installer/src/adapters/index.js',
  'installer/src/render/instructions.js',
  'installer/src/render/mcp.js',
  'installer/src/render/command.js',
  'installer/src/instructions/compose.js',
  'installer/src/instructions/tokens.js',
  'installer/src/dependencies/checksum.js',
  'installer/src/dependencies/manifests.js',
  'installer/src/dependencies/resolver.js',
  'installer/src/dependencies/git-snapshot.js',
  'installer/src/release/entries.js',
  'installer/src/release/stable-json.js',
  'installer/src/release/input-closure.js',
  'installer/src/release/provenance.js',
  'installer/src/release/notices.js',
  'installer/src/release/readme-first.js',
  'installer/src/release/bundle.js',
  'installer/src/release/install-manifest.js',
  'installer/src/release/installers.js',
  'installer/src/release/templates/install.sh',
  'installer/src/release/templates/install.ps1',
]
const INSTALLER_LAYOUT = {
  manifestName: 'install-files.tsv',
  overlayRoot: 'overlay',
  conflictName: 'install-conflicts.txt',
  stateRoot: '.ramp',
}
const ADAPTER_FILES = [
  'installer/src/adapters/kiro.js',
  'installer/src/adapters/claude-code.js',
]
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
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempRoot(prefix = 'ramp-release-') {
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

function git(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], {
    env: gitEnvironment,
    encoding: 'utf8',
  }).trim()
}

function initializeGit(repository) {
  git(repository, ['init', '-q'])
  git(repository, ['config', 'core.autocrlf', 'false'])
}

function commitAll(repository, message = 'fixture', { allowEmpty = false } = {}) {
  git(repository, ['add', '-A'])
  git(repository, ['commit', ...(allowEmpty ? ['--allow-empty'] : []), '-m', message])
  return git(repository, ['rev-parse', 'HEAD'])
}

function fileRecord(path, bytes, executable = false) {
  const value = Buffer.from(bytes)
  return {
    path,
    sha256: sha256(value),
    size: value.length,
    executable,
  }
}

function declaredProvenance(
  files,
  {
    kind = 'ramp',
    name = 'demo-skill',
    ownerPack,
    version = '1.0.0',
    license = 'MIT-0',
    treeSha256,
  } = {},
) {
  return {
    kind,
    attribution: 'declared',
    name,
    ...(ownerPack ? { ownerPack } : {}),
    version,
    license,
    treeSha256: treeSha256 ?? files.treeSha256,
    files,
  }
}

function copyPlan(directory, files, options = {}) {
  return [{
    path: options.path ?? '.kiro/skills/demo-skill',
    content: directory,
    kind: 'copy',
    provenance:
      options.provenance ?? declaredProvenance(files, options),
  }]
}

function makeCopyFixture(records) {
  const root = tempRoot('ramp-release-copy-')
  for (const record of records) {
    write(
      root,
      record.path,
      record.bytes,
      record.executable ? 0o755 : 0o644,
    )
  }
  return {
    root,
    files: Object.assign(
      records.map((record) =>
        fileRecord(record.path, record.bytes, record.executable)),
      { treeSha256: hashSkillTree(root).treeSha256 },
    ),
  }
}

function withEnvironment(overrides, operation) {
  const previous = new Map()
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    return operation()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

function writeGeneratorClosure(repository) {
  for (const path of [...GENERATOR_FILES, ...ADAPTER_FILES]) {
    const bytes = readFileSync(join(projectRoot, ...path.split('/')))
    write(repository, path, bytes)
  }
}

function writeSourceContracts(repository) {
  write(
    repository,
    'dependencies/skills.sources.yaml',
    [
      'schemaVersion: 1',
      'sources:',
      '  - id: agent-toolkit-for-aws',
      `    repository: ${SOURCE_REPOSITORY}`,
      '    priority: 10',
      '    license: Apache-2.0',
      '    licensePath: LICENSE',
      '    noticePath: NOTICE',
      '',
    ].join('\n'),
  )
  write(
    repository,
    'dependencies/skills.lock.yaml',
    'schemaVersion: 1\nskills: []\n',
  )
}

function packYaml({ skills = ['demo-skill'], profiles = true } = {}) {
  return [
    'schemaVersion: 2',
    'kind: ramp-pack',
    'name: demo-pack',
    'title: Demo Pack',
    'description: Release bundle fixture',
    'version: 1.2.3',
    'catalog:',
    '  outcome: automate',
    '  domain: quality-engineering',
    '  executionModel: assisted-builder',
    '  maturity: preview',
    'workflow:',
    '  provider: local-instructions-v1',
    '  overlays:',
    '    - demo-overlay.md',
    'instructions:',
    '  - file: aidlc-workflow.md',
    '    role: primary',
    '  - file: skill-activation.md',
    '    role: companion',
    '    load: always',
    'command:',
    '  name: aidlc',
    '  description: Start the workflow',
    'mcp:',
    '  - id: remote',
    '    transport: http',
    '    url: https://knowledge-mcp.global.api.aws',
    '  - id: node-tool',
    '    command: npx',
    '    args: ["mcp-remote", "https://example.invalid"]',
    '  - id: python-tool',
    '    command: uvx',
    '    args: ["example@1.0.0"]',
    '    env:',
    '      AWS_PROFILE: example-placeholder',
    'skills:',
    ...skills.map((skill) => `  - ${skill}`),
    'distribution:',
    '  targets: [kiro, claude-code]',
    '  qualifiedTargets: []',
    ...(profiles
      ? [
          '  profiles:',
          '    - name: shared-kiro-claude',
          '      targets: [kiro, claude-code]',
          '      workspaceMode: shared',
          '      specRoot: .kiro/specs',
          '      stateRoot: aidlc-docs',
        ]
      : ['  profiles: []']),
    '',
  ].join('\n')
}

function writePack(repository, options = {}) {
  const packDir = join(repository, 'packs', 'demo-pack')
  write(repository, 'packs/demo-pack/pack.yaml', packYaml(options))
  write(
    repository,
    'common/instructions/aidlc-workflow.md',
    [
      '# Workflow',
      '<!-- RAMP:SLOT demo-slot START -->',
      'base',
      '<!-- RAMP:SLOT demo-slot END -->',
      'Spec {{SPEC_DIR}} state {{STATE_DIR}}',
      '',
    ].join('\n'),
  )
  write(
    repository,
    'packs/demo-pack/instructions/skill-activation.md',
    '# Skill activation\n',
  )
  write(
    repository,
    'workflow-overlays/demo-overlay.md',
    [
      '---',
      'id: demo-overlay',
      'target: aidlc-workflow.md',
      'purpose: fixture',
      'replaces:',
      '  - demo-slot',
      '---',
      '<!-- RAMP:SLOT demo-slot START -->',
      'overlaid',
      '<!-- RAMP:SLOT demo-slot END -->',
      '',
    ].join('\n'),
  )
  return packDir
}

function writeRampSkill(repository) {
  write(
    repository,
    'skills/ramp/demo-skill/SKILL.md',
    '# Demo skill\n',
  )
  write(
    repository,
    'skills/ramp/demo-skill/references/guide.md',
    'guide\n',
  )
  write(
    repository,
    'skills/ramp/demo-skill/scripts/check.sh',
    '#!/bin/sh\nexit 0\n',
    0o755,
  )
  write(
    repository,
    'skills/ramp/demo-skill/skill.yaml',
    [
      'schemaVersion: 1',
      'kind: ramp-skill',
      'name: demo-skill',
      'version: 1.0.0',
      'license: MIT-0',
      '',
    ].join('\n'),
  )
}

function makeBundleRepository({
  gitRepository = true,
  skills = ['demo-skill'],
  rampSkill = true,
  profiles = true,
} = {}) {
  const repository = tempRoot('ramp-release-repository-')
  if (gitRepository) initializeGit(repository)
  write(repository, 'LICENSE', 'MIT-0 fixture license\n')
  write(repository, '.gitignore', '.DS_Store\n')
  writeGeneratorClosure(repository)
  writeSourceContracts(repository)
  const packDir = writePack(repository, { skills, profiles })
  if (rampSkill) writeRampSkill(repository)
  const sourceCommit = gitRepository
    ? commitAll(repository)
    : COMMIT
  return {
    repository,
    packDir,
    sourceCommit,
    cacheDir: join(repository, 'cache'),
  }
}

function makeRealPilotRepository() {
  const root = tempRoot('ramp-release-real-pilot-')
  const repository = join(root, 'repository')
  execFileSync(
    'git',
    ['clone', '--quiet', '--no-hardlinks', projectRoot, repository],
    { env: gitEnvironment },
  )
  for (const path of [...GENERATOR_FILES, ...ADAPTER_FILES]) {
    write(repository, path, readFileSync(join(projectRoot, ...path.split('/'))))
  }
  return {
    repository,
    packDir: join(repository, 'packs', 'qa-automated-testing'),
    // A clean checkout (CI) leaves nothing to commit; uncommitted generator edits still land.
    sourceCommit: commitAll(repository, 'executing release generator', { allowEmpty: true }),
  }
}

function bundleOptions(state, overrides = {}) {
  return {
    target: 'kiro',
    repoRoot: state.repository,
    cacheDir: state.cacheDir,
    sourceCommit: state.sourceCommit,
    buildTime: BUILD_TIME,
    ...overrides,
  }
}

function addUpstreamSkill(state, {
  name = 'upstream-skill',
  source = 'agent-toolkit-for-aws',
  commit = 'b'.repeat(40),
  sourcePath = 'skills/core-skills/upstream-skill',
  licenseBytes = 'Apache license\n',
  noticeBytes = 'AWS notice\n',
  updatePack = true,
} = {}) {
  const groupRoot = join(state.cacheDir, 'sources', source, commit)
  const skillRoot = join(groupRoot, ...sourcePath.split('/'))
  write(skillRoot, 'SKILL.md', '# Upstream skill\n')
  write(skillRoot, 'scripts/check.sh', '#!/bin/sh\nexit 0\n', 0o755)
  write(groupRoot, 'LICENSE', licenseBytes)
  write(groupRoot, 'NOTICE', noticeBytes)
  const hashed = hashSkillTree(skillRoot)
  const entry = {
    name,
    source,
    repository: SOURCE_REPOSITORY,
    commit,
    path: sourcePath,
    treeSha256: hashed.treeSha256,
    files: hashed.files,
    license: 'Apache-2.0',
    licensePath: 'LICENSE',
    licenseFile: fileRecord('LICENSE', licenseBytes),
    noticePath: 'NOTICE',
    noticeFile: fileRecord('NOTICE', noticeBytes),
  }
  writeSkillLock(state.repository, {
    schemaVersion: 1,
    skills: new Map([[name, entry]]),
  })
  if (updatePack) {
    writeFileSync(join(state.packDir, 'pack.yaml'), packYaml({
      skills: [name],
    }))
  }
  state.sourceCommit = commitAll(state.repository, 'upstream fixture')
  return { entry, groupRoot, skillRoot }
}

function writeDeclaredSkillMetadata(state, {
  directory = 'skills/ramp/demo-skill',
  kind = 'ramp-skill',
  name = 'demo-skill',
  license = 'MIT-0',
  ownerPack,
  basedOn,
} = {}) {
  write(
    state.repository,
    `${directory}/skill.yaml`,
    [
      'schemaVersion: 1',
      `kind: ${kind}`,
      `name: ${name}`,
      'version: 1.0.0',
      `license: ${license}`,
      ...(ownerPack ? [`ownerPack: ${ownerPack}`] : []),
      ...(basedOn
        ? [
            'basedOn:',
            `  source: ${basedOn.source}`,
            `  commit: ${basedOn.commit}`,
            `  path: ${basedOn.path}`,
          ]
        : []),
      '',
    ].join('\n'),
  )
}

function paths(entries) {
  return entries.map((entry) => entry.path)
}

describe('stable release metadata', () => {
  it('sorts object keys recursively, preserves array order, and emits one LF', () => {
    expect(stableJson({
      z: 1,
      a: {
        z: true,
        a: ['second', 'first'],
      },
    })).toBe(
      '{\n' +
      '  "a": {\n' +
      '    "a": [\n' +
      '      "second",\n' +
      '      "first"\n' +
      '    ],\n' +
      '    "z": true\n' +
      '  },\n' +
      '  "z": 1\n' +
      '}\n',
    )
  })

  it('is independent of insertion order, locale, and timezone', () => {
    const left = { zebra: 1, alpha: { two: 2, one: 1 } }
    const right = { alpha: { one: 1, two: 2 }, zebra: 1 }

    const first = withEnvironment(
      { LC_ALL: 'tr_TR.UTF-8', TZ: 'Pacific/Honolulu' },
      () => stableJson(left),
    )
    const second = withEnvironment(
      { LC_ALL: 'C', TZ: 'Asia/Singapore' },
      () => stableJson(right),
    )
    expect(first).toBe(second)
  })

  it.each([
    ['undefined', { value: undefined }],
    ['function', { value() {} }],
    ['symbol', { value: Symbol('x') }],
    ['bigint', { value: 1n }],
    ['NaN', { value: Number.NaN }],
    ['Infinity', { value: Number.POSITIVE_INFINITY }],
    ['buffer', { value: Buffer.from('x') }],
    ['date', { value: new Date(BUILD_TIME) }],
    ['map', { value: new Map() }],
    ['sparse array', { value: new Array(1) }],
    ['dangerous __proto__ key', JSON.parse('{"__proto__":1}')],
    ['dangerous prototype key', { prototype: 1 }],
    ['dangerous constructor key', { constructor: 1 }],
  ])('rejects unsupported JSON value: %s', (_label, value) => {
    expect(() => stableJson(value)).toThrow(
      /JSON|unsupported|plain object|dangerous|sparse|finite/i,
    )
  })

  it('rejects cyclic values without mutating the source object', () => {
    const value = { z: 1, a: 2 }
    value.self = value
    expect(() => stableJson(value)).toThrow(/cycle/i)
    expect(Object.keys(value)).toEqual(['z', 'a', 'self'])
  })

  it('hashes exact bytes and renders sorted non-recursive SHA256SUMS', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(renderSha256Sums([
      { path: 'z.txt', bytes: Buffer.from('z') },
      { path: 'SHA256SUMS', bytes: Buffer.from('ignored') },
      { path: 'a.txt', bytes: Buffer.from('a') },
    ])).toBe(
      `${sha256('a')}  a.txt\n${sha256('z')}  z.txt\n`,
    )
  })
})

describe('release plan entry collection', () => {
  it('converts text to a defensive UTF-8 regular-file entry', () => {
    const plan = [{ path: 'CLAUDE.md', content: 'hello\n', kind: 'text' }]
    const result = collectPlanEntries(plan)

    expect(result).toEqual([{
      path: 'CLAUDE.md',
      bytes: Buffer.from('hello\n'),
      mode: 0o100644,
      provenance: null,
    }])
    result[0].bytes[0] = 0
    expect(collectPlanEntries(plan)[0].bytes).toEqual(Buffer.from('hello\n'))
  })

  it('expands the exact authoritative tree including hidden and executable files', () => {
    const state = makeCopyFixture([
      { path: '.hidden', bytes: 'hidden\n', executable: false },
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
      { path: 'scripts/check.sh', bytes: '#!/bin/sh\n', executable: true },
    ])
    const provenance = declaredProvenance(state.files)
    const result = collectPlanEntries(copyPlan(state.root, state.files, {
      provenance,
    }))

    expect(result.map(({ path, mode }) => ({ path, mode }))).toEqual([
      { path: '.kiro/skills/demo-skill/.hidden', mode: 0o100644 },
      { path: '.kiro/skills/demo-skill/SKILL.md', mode: 0o100644 },
      { path: '.kiro/skills/demo-skill/scripts/check.sh', mode: 0o100755 },
    ])
    expect(result.every((entry) => entry.provenance === provenance)).toBe(false)
    expect(result).toEqual(result.map((entry) => ({
      ...entry,
      provenance: expect.objectContaining({
        kind: 'ramp',
        name: 'demo-skill',
      }),
    })))
  })

  it('leaves the root skill.yaml out of the overlay and records it as a metadata input', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
      { path: 'nested/skill.yaml', bytes: 'nested\n', executable: false },
      { path: 'skill.yaml', bytes: 'schemaVersion: 1\n', executable: false },
    ])
    const recorded = []
    const result = collectPlanEntries(copyPlan(state.root, state.files), {
      recordInput: (value) => recorded.push(value),
    })

    expect(paths(result)).toEqual([
      '.kiro/skills/demo-skill/SKILL.md',
      '.kiro/skills/demo-skill/nested/skill.yaml',
    ])
    const skill = { kind: 'ramp', name: 'demo-skill' }
    expect(recorded.map(({ absolutePath, role, provenance }) =>
      ({ absolutePath, role, provenance }))).toEqual([
      { absolutePath: join(state.root, 'SKILL.md'), role: 'ramp-skill', provenance: skill },
      { absolutePath: join(state.root, 'nested', 'skill.yaml'), role: 'ramp-skill', provenance: skill },
      { absolutePath: join(state.root, 'skill.yaml'), role: 'skill-metadata', provenance: skill },
    ])
    expect(recorded[2].bytes).toEqual(Buffer.from('schemaVersion: 1\n'))
  })

  it('still verifies the root skill.yaml against the skill provenance', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
      { path: 'skill.yaml', bytes: 'schemaVersion: 1\n', executable: false },
    ])
    writeFileSync(join(state.root, 'skill.yaml'), 'schemaVersion: 9\n')
    expect(() => collectPlanEntries(copyPlan(state.root, state.files))).toThrow(
      'copy source hash or size mismatch: skill.yaml',
    )
  })

  it('accepts an upstream sidecar outside the locked tree and records it as a metadata input', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Upstream\n', executable: false },
    ])
    write(state.root, 'skill.yaml', 'schemaVersion: 2\n')
    const provenance = {
      kind: 'upstream',
      attribution: 'locked',
      name: 'upstream-skill',
      source: 'agent-toolkit-for-aws',
      repository: SOURCE_REPOSITORY,
      commit: 'b'.repeat(40),
      path: 'skills/upstream-skill',
      treeSha256: state.files.treeSha256,
      files: state.files,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      licenseFile: fileRecord('LICENSE', 'Apache license\n'),
      noticePath: 'NOTICE',
      noticeFile: fileRecord('NOTICE', 'AWS notice\n'),
    }
    const recorded = []
    const result = collectPlanEntries(copyPlan(state.root, state.files, {
      path: '.kiro/skills/upstream-skill',
      provenance,
    }), { recordInput: (value) => recorded.push(value) })

    expect(paths(result)).toEqual(['.kiro/skills/upstream-skill/SKILL.md'])
    expect(recorded.map(({ kind, role, sourceKind, provenance: source }) =>
      ({ kind, role, sourceKind, provenance: source }))).toEqual([
      {
        kind: 'external',
        role: undefined,
        sourceKind: 'upstream-skill',
        provenance: {
          attribution: 'locked',
          source: 'agent-toolkit-for-aws',
          repository: SOURCE_REPOSITORY,
          commit: 'b'.repeat(40),
        },
      },
      { kind: 'repository', role: 'skill-metadata', sourceKind: undefined, provenance: undefined },
    ])
    expect(recorded[1].absolutePath).toBe(join(state.root, 'skill.yaml'))
  })

  it('is byte-order deterministic across source creation and plan order', () => {
    const left = makeCopyFixture([
      { path: 'z.md', bytes: 'z', executable: false },
      { path: 'a.md', bytes: 'a', executable: false },
    ])
    const right = makeCopyFixture([
      { path: 'a.md', bytes: 'a', executable: false },
      { path: 'z.md', bytes: 'z', executable: false },
    ])

    const first = collectPlanEntries([
      { path: 'z.txt', content: 'z', kind: 'text' },
      ...copyPlan(left.root, left.files),
      { path: 'a.txt', content: 'a', kind: 'text' },
    ])
    const second = collectPlanEntries([
      { path: 'a.txt', content: 'a', kind: 'text' },
      ...copyPlan(right.root, right.files),
      { path: 'z.txt', content: 'z', kind: 'text' },
    ])
    expect(first).toEqual(second)
  })

  it('accepts a tree whose directory order differs from full-path order', () => {
    // Per directory, cloudwatch/ sorts before cloudwatch-omni/; by full path
    // cloudwatch-omni/... comes first because '-' sorts before '/'.
    const state = makeCopyFixture([
      { path: 'a/x.md', bytes: 'x', executable: false },
      { path: 'a-b/y.md', bytes: 'y', executable: false },
      { path: 'cloudwatch/alarms.md', bytes: 'alarms', executable: false },
      { path: 'cloudwatch-omni/agent-evaluation.md', bytes: 'eval', executable: false },
    ])
    const result = collectPlanEntries(copyPlan(state.root, state.files, {
      path: 'skill',
    }))

    expect(paths(result)).toEqual([
      'skill/a-b/y.md',
      'skill/a/x.md',
      'skill/cloudwatch-omni/agent-evaluation.md',
      'skill/cloudwatch/alarms.md',
    ])
    expect(paths(result)).toEqual([...paths(result)].sort(comparePortablePaths))
  })

  it.each([
    ['traversal', '../escape'],
    ['absolute', '/escape'],
    ['drive path', 'C:/escape'],
    ['UNC path', '\\\\server\\share'],
    ['backslash', 'dir\\file'],
    ['tab', 'bad\tfile'],
    ['newline', 'bad\nfile'],
    ['NUL', 'bad\0file'],
    ['non-ASCII', 'café.md'],
    ['Windows reserved name', 'CON.txt'],
    ['Windows reserved nested name', 'safe/aux.md'],
    ['alternate data stream', 'safe/file:stream'],
    ['trailing dot', 'safe/file.'],
    ['trailing space', 'safe/file '],
  ])('rejects unsafe artifact path: %s', (_label, path) => {
    expect(() => collectPlanEntries([
      { path, content: 'x', kind: 'text' },
    ])).toThrow(/path|portable|reserved|ASCII|Windows|unsafe/i)
  })

  it.each([
    [
      'exact duplicate',
      [
        { path: 'A', content: 'one', kind: 'text' },
        { path: 'A', content: 'two', kind: 'text' },
      ],
    ],
    [
      'ASCII case-fold collision',
      [
        { path: 'A', content: 'one', kind: 'text' },
        { path: 'a', content: 'two', kind: 'text' },
      ],
    ],
    [
      'file-directory prefix collision',
      [
        { path: 'foo', content: 'one', kind: 'text' },
        { path: 'foo/bar', content: 'two', kind: 'text' },
      ],
    ],
  ])('rejects %s before returning entries', (_label, plan) => {
    expect(() => collectPlanEntries(plan)).toThrow(
      /duplicate|collision|prefix/i,
    )
  })

  it.each([
    ['missing file', (state) => rmSync(join(state.root, 'SKILL.md'))],
    ['changed bytes', (state) => writeFileSync(join(state.root, 'SKILL.md'), '# changed\n')],
    ['extra file', (state) => write(state.root, 'EXTRA.md', 'extra\n')],
  ])('rejects copy-tree provenance drift: %s', (_label, mutate) => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    mutate(state)
    expect(() => collectPlanEntries(copyPlan(state.root, state.files))).toThrow(
      /missing|extra|hash|size|mode|drift|mismatch/i,
    )
  })

  it.skipIf(process.platform === 'win32')(
    'rejects POSIX copy-tree executable mode drift',
    () => {
      const state = makeCopyFixture([
        { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
      ])
      chmodSync(join(state.root, 'SKILL.md'), 0o755)
      expect(() =>
        collectPlanEntries(copyPlan(state.root, state.files)),
      ).toThrow(/mode|drift|mismatch/i)
    },
  )

  it.skipIf(
    process.platform === 'win32' ||
    typeof process.getuid === 'function' && process.getuid() === 0,
  )('rejects a file made unreadable between inspection and open', () => {
    const root = tempRoot('ramp-release-race-unreadable-')
    const path = write(root, 'selected', 'safe')
    expect(() => readOrdinaryFile(path, {
      trustedRoot: root,
      onPhase({ phase }) {
        if (phase === 'afterInspect') chmodSync(path, 0o000)
      },
    })).toThrow(/open|permission|ordinary|access/i)
  })

  it('rejects a tree checksum that disagrees with the authoritative file closure', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    const provenance = declaredProvenance(state.files, {
      treeSha256: 'f'.repeat(64),
    })

    expect(() =>
      collectPlanEntries(copyPlan(state.root, state.files, { provenance })),
    ).toThrow(/tree|checksum|provenance|mismatch/i)
  })

  it.each(['.git', 'node_modules', '.DS_Store'])(
    'rejects prohibited selected copy content: %s',
    (name) => {
      const state = makeCopyFixture([
        { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
        { path: name, bytes: 'prohibited\n', executable: false },
      ])
      expect(() =>
        collectPlanEntries(copyPlan(state.root, state.files)),
      ).toThrow(/prohibited|release|excluded|unsafe/i)
    },
  )

  it('rejects a symlinked copy root and descendant', () => {
    const target = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    const linkedRoot = tempRoot('ramp-release-link-')
    rmSync(linkedRoot, { recursive: true, force: true })
    symlinkSync(target.root, linkedRoot, 'dir')
    roots.push(linkedRoot)
    expect(() =>
      collectPlanEntries(copyPlan(linkedRoot, target.files)),
    ).toThrow(/symbolic|symlink|link/i)

    const nested = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    symlinkSync(join(nested.root, 'SKILL.md'), join(nested.root, 'linked.md'))
    const files = Object.assign([
      ...nested.files,
      fileRecord('linked.md', '# Demo\n'),
    ], { treeSha256: nested.files.treeSha256 })
    expect(() =>
      collectPlanEntries(copyPlan(nested.root, files)),
    ).toThrow(/symbolic|symlink|link/i)
  })

  it.skipIf(process.platform === 'win32')('rejects a FIFO in a selected copy tree', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    execFileSync('mkfifo', [join(state.root, 'pipe')])
    const files = [...state.files, fileRecord('pipe', '')]
    expect(() =>
      collectPlanEntries(copyPlan(state.root, files)),
    ).toThrow(/regular|special|FIFO|file/i)
  })

  it('rejects unattributed and legacy provenance even with valid bytes', () => {
    const state = makeCopyFixture([
      { path: 'SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    for (const provenance of [
      {
        kind: 'legacy-local',
        attribution: 'legacy-unattributed',
        name: 'demo-skill',
        files: state.files,
      },
      {
        kind: 'pack-override',
        attribution: 'legacy-unattributed',
        name: 'demo-skill',
        files: state.files,
      },
    ]) {
      expect(() =>
        collectPlanEntries(copyPlan(state.root, state.files, { provenance })),
      ).toThrow(/provenance|legacy|attributed|release/i)
    }
  })

  it('rejects unsupported operations and files above the release bound', () => {
    expect(() => collectPlanEntries([
      { path: 'x', content: 'x', kind: 'mystery' },
    ])).toThrow(/unsupported|kind/i)

    const state = makeCopyFixture([{
      path: 'SKILL.md',
      bytes: Buffer.alloc((16 * 1024 * 1024) + 1),
      executable: false,
    }])
    expect(() =>
      collectPlanEntries(copyPlan(state.root, state.files)),
    ).toThrow(/limit|large|size|16/i)
  })

  it('counts directories and enforces exact tree and bundle boundaries', () => {
    const tree = makeCopyFixture([
      { path: 'nested/a', bytes: 'aa', executable: false },
    ])
    const plan = copyPlan(tree.root, tree.files)
    expect(collectPlanEntries(plan, {
      limits: { treeEntries: 2, treeBytes: 2 },
    })).toHaveLength(1)
    expect(() => collectPlanEntries(plan, {
      limits: { treeEntries: 1 },
    })).toThrow(/tree|entry|limit/i)
    expect(() => collectPlanEntries(plan, {
      limits: { treeBytes: 1 },
    })).toThrow(/tree|byte|limit/i)

    const text = [
      { path: 'a', content: 'a', kind: 'text' },
      { path: 'b', content: 'b', kind: 'text' },
    ]
    expect(collectPlanEntries(text, {
      limits: { bundleEntries: 2, bundleBytes: 2 },
    })).toHaveLength(2)
    expect(() => collectPlanEntries(text, {
      limits: { bundleEntries: 1 },
    })).toThrow(/plan|entry|limit/i)
    expect(() => collectPlanEntries(text, {
      limits: { bundleBytes: 1 },
    })).toThrow(/plan|byte|limit/i)
  })

  it.skipIf(process.platform === 'win32')(
    'rejects symlink, same-size, short-read, and directory replacement races',
    () => {
      const symlinkRoot = tempRoot('ramp-release-race-link-')
      const symlinkPath = write(symlinkRoot, 'selected', 'safe')
      const symlinkTarget = write(symlinkRoot, 'target', 'evil')
      expect(() => readOrdinaryFile(symlinkPath, {
        trustedRoot: symlinkRoot,
        onPhase({ phase }) {
          if (phase !== 'afterInspect') return
          renameSync(symlinkPath, `${symlinkPath}.old`)
          symlinkSync(symlinkTarget, symlinkPath)
        },
      })).toThrow(/link|changed|ordinary|open/i)

      const replaceRoot = tempRoot('ramp-release-race-replace-')
      const replacePath = write(replaceRoot, 'selected', 'safe')
      expect(() => readOrdinaryFile(replacePath, {
        trustedRoot: replaceRoot,
        onPhase({ phase }) {
          if (phase !== 'afterOpen') return
          renameSync(replacePath, `${replacePath}.old`)
          writeFileSync(replacePath, 'evil')
        },
      })).toThrow(/changed|opened|path|identity/i)

      const shortRoot = tempRoot('ramp-release-race-short-')
      const shortPath = write(shortRoot, 'selected', 'safe')
      expect(() => readOrdinaryFile(shortPath, {
        trustedRoot: shortRoot,
        onPhase({ phase }) {
          if (phase === 'afterOpen') truncateSync(shortPath, 1)
        },
      })).toThrow(/ended|changed|size|read/i)

      const directoryRoot = tempRoot('ramp-release-race-directory-')
      const directoryPath = write(directoryRoot, 'nested/selected', 'safe')
      let replaced = false
      expect(() => readOrdinaryFile(directoryPath, {
        trustedRoot: directoryRoot,
        onPhase({ phase }) {
          if (phase !== 'beforePathCheck' || replaced) return
          replaced = true
          renameSync(
            join(directoryRoot, 'nested'),
            join(directoryRoot, 'nested-old'),
          )
          write(directoryRoot, 'nested/selected', 'safe')
        },
      })).toThrow(/ancestry|path|changed/i)
    },
  )

  it('rejects a copied directory replaced during traversal', () => {
    const state = makeCopyFixture([
      { path: 'nested/SKILL.md', bytes: '# Demo\n', executable: false },
    ])
    let replaced = false
    expect(() => collectPlanEntries(copyPlan(state.root, state.files), {
      onFilesystemPhase({ phase, path }) {
        if (
          phase !== 'afterDirectoryRead' ||
          path !== join(state.root, 'nested') ||
          replaced
        ) return
        replaced = true
        renameSync(path, `${path}-old`)
        write(state.root, 'nested/SKILL.md', '# Demo\n')
      },
    })).toThrow(/directory|ancestry|path|changed/i)
  })
})

describe('consumed input closure', () => {
  it('verifies clean repository bytes and Git modes at one fixed commit', () => {
    const repository = tempRoot('ramp-release-inputs-')
    initializeGit(repository)
    const path = write(repository, 'pack.yaml', 'name: demo\n')
    const executable = write(repository, 'scripts/check.sh', '#!/bin/sh\n', 0o755)
    const sourceCommit = commitAll(repository)
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit,
      repositoryVerified: true,
    })
    closure.recordRepositoryFile({
      absolutePath: path,
      role: 'pack-manifest',
      bytes: Buffer.from('name: demo\n'),
    })
    closure.recordRepositoryFile({
      absolutePath: executable,
      role: 'generator',
      bytes: Buffer.from('#!/bin/sh\n'),
    })

    expect(closure.finalize()).toEqual([
      {
        path: 'pack.yaml',
        sourceKind: 'pack-manifest',
        sha256: sha256('name: demo\n'),
        size: 11,
        executable: false,
        provenance: {
          attribution: 'repository-verified',
          sourceCommit,
        },
      },
      {
        path: 'scripts/check.sh',
        sourceKind: 'generator',
        sha256: sha256('#!/bin/sh\n'),
        size: 10,
        executable: true,
        provenance: {
          attribution: 'repository-verified',
          sourceCommit,
        },
      },
    ])
  })

  it.each([
    ['modified', (repository) => writeFileSync(join(repository, 'selected.txt'), 'changed\n')],
    ['staged', (repository) => {
      writeFileSync(join(repository, 'selected.txt'), 'changed\n')
      git(repository, ['add', 'selected.txt'])
    }],
    ['deleted', (repository) => rmSync(join(repository, 'selected.txt'))],
    ['mode-changed', (repository) => chmodSync(join(repository, 'selected.txt'), 0o755)],
  ])('rejects %s selected repository input', (label, mutate) => {
    const repository = tempRoot('ramp-release-input-drift-')
    initializeGit(repository)
    const path = write(repository, 'selected.txt', 'selected\n')
    const sourceCommit = commitAll(repository)
    mutate(repository)
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit,
      repositoryVerified: true,
    })
    expect(() => {
      closure.recordRepositoryFile({
        absolutePath: path,
        role: 'instruction',
        bytes: label === 'deleted'
          ? Buffer.from('selected\n')
          : readFileSync(path),
      })
      closure.finalize()
    }).toThrow(/commit|drift|mismatch|missing|mode|ordinary/i)
  })

  it('records non-Git inputs as caller-supplied without claiming verification', () => {
    const repository = tempRoot('ramp-release-non-git-')
    const path = write(repository, 'pack.yaml', 'name: demo\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    closure.recordRepositoryFile({
      absolutePath: path,
      role: 'pack-manifest',
      bytes: Buffer.from('name: demo\n'),
    })
    expect(closure.finalize()[0]).toEqual({
      path: 'pack.yaml',
      sourceKind: 'pack-manifest',
      sha256: sha256('name: demo\n'),
      size: 11,
      executable: false,
      provenance: {
        attribution: 'caller-supplied',
        callerSuppliedSourceCommit: COMMIT,
      },
    })
  })

  it('deduplicates identical events and rejects conflicting duplicate identity', () => {
    const repository = tempRoot('ramp-release-input-dedup-')
    const path = write(repository, 'same.txt', 'same\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    const event = {
      absolutePath: path,
      role: 'generator',
      bytes: Buffer.from('same\n'),
    }
    closure.recordRepositoryFile(event)
    closure.recordRepositoryFile(event)
    expect(closure.finalize()).toHaveLength(1)

    const conflict = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    conflict.recordRepositoryFile(event)
    expect(() =>
      conflict.recordRepositoryFile({
        absolutePath: path,
        role: 'instruction',
        bytes: Buffer.from('same\n'),
      }),
    ).toThrow(/duplicate|conflict|identity/i)
  })

  it('keeps same-path upstream inputs distinct by locked source provenance', () => {
    const repository = tempRoot('ramp-release-external-input-')
    const first = write(repository, 'first-license', 'one\n')
    const second = write(repository, 'second-license', 'two\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    closure.recordExternalFile({
      absolutePath: first,
      path: 'LICENSE',
      sourceKind: 'upstream-license',
      executable: false,
      provenance: {
        attribution: 'locked',
        source: 'source-one',
        repository: 'https://github.com/aws/source-one.git',
        commit: '1'.repeat(40),
      },
      expectedRecord: fileRecord('LICENSE', 'one\n'),
      bytes: Buffer.from('one\n'),
      trustedRoot: repository,
    })
    closure.recordExternalFile({
      absolutePath: second,
      path: 'LICENSE',
      sourceKind: 'upstream-license',
      executable: false,
      provenance: {
        attribution: 'locked',
        source: 'source-two',
        repository: 'https://github.com/aws/source-two.git',
        commit: '2'.repeat(40),
      },
      expectedRecord: fileRecord('LICENSE', 'two\n'),
      bytes: Buffer.from('two\n'),
      trustedRoot: repository,
    })
    expect(closure.finalize()).toHaveLength(2)
  })

  it.each([
    ['absolute injected field', { absolutePath: '/private/customer' }],
    ['unknown path field', { extraPath: '/tmp/customer' }],
    ['path-like source', { source: 'nested/source-one' }],
    ['control-bearing source', { source: 'source\none' }],
    ['non-ASCII source', { source: 'sourcé-one' }],
    ['uppercase source', { source: 'Source-one' }],
    ['local repository path', { repository: '/private/customer/repository' }],
    ['non-GitHub repository', { repository: 'https://example.com/aws/source-one.git' }],
    ['non-clone GitHub URL', { repository: 'https://github.com/aws/source-one' }],
    ['control-bearing repository', {
      repository: 'https://github.com/aws/source-one.git\n/private/customer',
    }],
    ['non-ASCII repository', {
      repository: 'https://github.com/aws/sourcé-one.git',
    }],
    ['uppercase commit', { commit: 'A'.repeat(40) }],
  ])('rejects untrusted external provenance: %s', (_label, override) => {
    const repository = tempRoot('ramp-release-external-provenance-')
    const path = write(repository, 'LICENSE', 'license\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })

    expect(() => closure.recordExternalFile({
      absolutePath: path,
      path: 'LICENSE',
      sourceKind: 'upstream-license',
      executable: false,
      provenance: {
        attribution: 'locked',
        source: 'source-one',
        repository: 'https://github.com/aws/source-one.git',
        commit: '1'.repeat(40),
        ...override,
      },
      expectedRecord: fileRecord('LICENSE', 'license\n'),
      bytes: Buffer.from('license\n'),
      trustedRoot: repository,
    })).toThrow(/external|provenance|source|repository|commit|unsupported|field/i)
  })

  it('rejects invalid Git metadata instead of downgrading to caller-supplied', () => {
    const repository = tempRoot('ramp-release-bad-git-')
    mkdirSync(join(repository, '.git'))
    const path = write(repository, 'selected.txt', 'selected\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: true,
    })
    expect(() =>
      closure.recordRepositoryFile({
        absolutePath: path,
        role: 'generator',
        bytes: Buffer.from('selected\n'),
      }),
    ).toThrow(/git|repository|commit/i)
  })

  it('binds verification to the bytes captured at the read boundary', () => {
    const repository = tempRoot('ramp-release-input-capture-')
    initializeGit(repository)
    const path = write(repository, 'selected.txt', 'selected\n')
    const sourceCommit = commitAll(repository)
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit,
      repositoryVerified: true,
    })
    closure.recordRepositoryFile({
      absolutePath: path,
      role: 'instruction',
      bytes: Buffer.from('selected\n'),
    })
    writeFileSync(path, 'changed after read\n')

    expect(() => closure.finalize()).toThrow(/changed|capture|input/i)
  })

  it('rejects working bytes changed after capture but before recording', () => {
    const repository = tempRoot('ramp-release-input-capture-drift-')
    initializeGit(repository)
    const path = write(repository, 'selected.txt', 'selected\n')
    const sourceCommit = commitAll(repository)
    const captured = readFileSync(path)
    writeFileSync(path, 'changed before record\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit,
      repositoryVerified: true,
    })

    expect(() =>
      closure.recordRepositoryFile({
        absolutePath: path,
        role: 'instruction',
        bytes: captured,
      }),
    ).toThrow(/working|capture|changed|drift|mismatch/i)
  })

  it('rejects external bytes that do not match the expected locked record', () => {
    const repository = tempRoot('ramp-release-external-drift-')
    const path = write(repository, 'LICENSE', 'changed\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })

    expect(() => closure.recordExternalFile({
      absolutePath: path,
      path: 'LICENSE',
      sourceKind: 'upstream-license',
      executable: false,
      provenance: {
        attribution: 'locked',
        source: 'source-one',
        repository: 'https://github.com/aws/source-one.git',
        commit: '1'.repeat(40),
      },
      expectedRecord: fileRecord('LICENSE', 'expected\n'),
      bytes: Buffer.from('changed\n'),
      trustedRoot: repository,
    })).toThrow(/locked|hash|size|mismatch/i)
  })

  it('rejects repository provenance fields that could override authority', () => {
    const repository = tempRoot('ramp-release-input-provenance-')
    const path = write(repository, 'selected', 'selected\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    expect(() => closure.recordRepositoryFile({
      absolutePath: path,
      role: 'ramp-skill',
      bytes: Buffer.from('selected\n'),
      provenance: {
        kind: 'ramp',
        name: 'demo-skill',
        attribution: 'locked',
        absolutePath: '/private/customer',
      },
    })).toThrow(/provenance|unsupported|field|authority/i)
  })

  it.each([
    ['path separator', 'nested/demo-skill'],
    ['control character', 'demo\nskill'],
    ['non-ASCII character', 'démoskill'],
    ['uppercase character', 'Demo-skill'],
  ])('rejects repository skill annotations with a non-canonical %s', (_label, name) => {
    const repository = tempRoot('ramp-release-input-skill-name-')
    const path = write(repository, 'selected', 'selected\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })

    expect(() => closure.recordRepositoryFile({
      absolutePath: path,
      role: 'ramp-skill',
      bytes: Buffer.from('selected\n'),
      provenance: {
        kind: 'ramp',
        name,
      },
    })).toThrow(/provenance|skill|name|lower-kebab|identifier/i)
  })

  it('rejects accessor-backed repository skill annotations', () => {
    const repository = tempRoot('ramp-release-input-skill-accessor-')
    const path = write(repository, 'selected', 'selected\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    let kindReads = 0
    let nameReads = 0
    const provenance = {
      get kind() {
        kindReads += 1
        return kindReads < 3 ? 'ramp' : 'pack-override'
      },
      get name() {
        nameReads += 1
        return nameReads < 3 ? 'demo-skill' : 'nested/customer-secret'
      },
    }

    expect(() => closure.recordRepositoryFile({
      absolutePath: path,
      role: 'ramp-skill',
      bytes: Buffer.from('selected\n'),
      provenance,
    })).toThrow(/provenance|accessor|data|plain|descriptor/i)
  })

  it('rejects accessor-backed external provenance', () => {
    const repository = tempRoot('ramp-release-external-accessor-')
    const path = write(repository, 'LICENSE', 'license\n')
    const closure = createInputClosure({
      repoRoot: repository,
      sourceCommit: COMMIT,
      repositoryVerified: false,
    })
    let sourceReads = 0
    const provenance = {
      attribution: 'locked',
      get source() {
        sourceReads += 1
        return sourceReads < 3
          ? 'source-one'
          : 'nested/customer-secret'
      },
      repository: 'https://github.com/aws/source-one.git',
      commit: '1'.repeat(40),
    }

    expect(() => closure.recordExternalFile({
      absolutePath: path,
      path: 'LICENSE',
      sourceKind: 'upstream-license',
      executable: false,
      provenance,
      expectedRecord: fileRecord('LICENSE', 'license\n'),
      bytes: Buffer.from('license\n'),
      trustedRoot: repository,
    })).toThrow(/external|provenance|accessor|data|plain|descriptor/i)
  })
})

describe('legal payloads and customer guidance', () => {
  function lockedSkillProvenance({
    source = 'agent-toolkit-for-aws',
    commit = 'b'.repeat(40),
    name = 'upstream-skill',
    licenseBytes = 'Apache license\n',
    noticeBytes = 'AWS notice\n',
  } = {}) {
    return {
      kind: 'upstream',
      attribution: 'locked',
      name,
      source,
      repository: SOURCE_REPOSITORY,
      commit,
      path: `skills/${name}`,
      treeSha256: 'd'.repeat(64),
      files: [fileRecord('SKILL.md', '# skill\n')],
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      licenseFile: fileRecord('LICENSE', licenseBytes),
      noticePath: 'NOTICE',
      noticeFile: fileRecord('NOTICE', noticeBytes),
    }
  }

  it('deduplicates one verified source legal payload across multiple skills', () => {
    const repoRoot = tempRoot('ramp-release-legal-repo-')
    const cacheDir = tempRoot('ramp-release-legal-cache-')
    write(repoRoot, 'LICENSE', 'MIT-0 license\n')
    const provenance = lockedSkillProvenance()
    const sourceRoot = join(
      cacheDir,
      'sources',
      provenance.source,
      provenance.commit,
    )
    write(sourceRoot, 'LICENSE', 'Apache license\n')
    write(sourceRoot, 'NOTICE', 'AWS notice\n')
    const recorded = []
    const result = collectLegalPayloads({
      repoRoot,
      cacheDir,
      usedSkills: [
        provenance,
        { ...provenance, name: 'another-skill' },
      ],
      recordInput: (value) => recorded.push(value),
    })
    expect(result.repositoryLicense).toEqual(Buffer.from('MIT-0 license\n'))
    expect(result.sources).toEqual([{
      id: 'agent-toolkit-for-aws',
      repository: SOURCE_REPOSITORY,
      commit: 'b'.repeat(40),
      license: 'Apache-2.0',
      licenseBytes: Buffer.from('Apache license\n'),
      noticeBytes: Buffer.from('AWS notice\n'),
      licensePath: 'LICENSE',
      noticePath: 'NOTICE',
      skills: ['another-skill', 'upstream-skill'],
    }])
    expect(recorded).toHaveLength(3)
  })

  it.each([
    ['missing LICENSE', (root) => rmSync(join(root, 'LICENSE'))],
    ['drifted LICENSE', (root) => writeFileSync(join(root, 'LICENSE'), 'changed\n')],
    ['missing NOTICE', (root) => rmSync(join(root, 'NOTICE'))],
    ['drifted NOTICE', (root) => writeFileSync(join(root, 'NOTICE'), 'changed\n')],
  ])('rejects %s', (_label, mutate) => {
    const repoRoot = tempRoot('ramp-release-legal-repo-')
    const cacheDir = tempRoot('ramp-release-legal-cache-')
    write(repoRoot, 'LICENSE', 'MIT-0 license\n')
    const provenance = lockedSkillProvenance()
    const sourceRoot = join(
      cacheDir,
      'sources',
      provenance.source,
      provenance.commit,
    )
    write(sourceRoot, 'LICENSE', 'Apache license\n')
    write(sourceRoot, 'NOTICE', 'AWS notice\n')
    mutate(sourceRoot)
    expect(() => collectLegalPayloads({
      repoRoot,
      cacheDir,
      usedSkills: [provenance],
      recordInput() {},
    })).toThrow(/LICENSE|NOTICE|missing|hash|size|drift/i)
  })

  it('rejects two commits for one source ID before output paths collide', () => {
    const repoRoot = tempRoot('ramp-release-legal-repo-')
    const cacheDir = tempRoot('ramp-release-legal-cache-')
    write(repoRoot, 'LICENSE', 'MIT-0 license\n')
    expect(() => collectLegalPayloads({
      repoRoot,
      cacheDir,
      usedSkills: [
        lockedSkillProvenance({ commit: '1'.repeat(40), name: 'one' }),
        lockedSkillProvenance({ commit: '2'.repeat(40), name: 'two' }),
      ],
      recordInput() {},
    })).toThrow(/source|commit|multiple|collision/i)
  })

  it.skipIf(process.platform === 'win32')(
    'rejects a symlinked intermediate legal-cache component',
    () => {
      const repoRoot = tempRoot('ramp-release-legal-repo-')
      const cacheDir = tempRoot('ramp-release-legal-cache-')
      const outside = tempRoot('ramp-release-legal-outside-')
      write(repoRoot, 'LICENSE', 'MIT-0 license\n')
      const provenance = lockedSkillProvenance()
      write(outside, 'LICENSE', 'Apache license\n')
      write(outside, 'NOTICE', 'AWS notice\n')
      mkdirSync(join(cacheDir, 'sources', provenance.source), {
        recursive: true,
      })
      symlinkSync(
        outside,
        join(cacheDir, 'sources', provenance.source, provenance.commit),
        'dir',
      )
      expect(() => collectLegalPayloads({
        repoRoot,
        cacheDir,
        usedSkills: [provenance],
        recordInput() {},
      })).toThrow(/symbolic|symlink|link|trusted root/i)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'rejects a symlinked final legal file',
    () => {
      const repoRoot = tempRoot('ramp-release-legal-repo-')
      const cacheDir = tempRoot('ramp-release-legal-cache-')
      const provenance = lockedSkillProvenance()
      const sourceRoot = join(
        cacheDir,
        'sources',
        provenance.source,
        provenance.commit,
      )
      write(repoRoot, 'LICENSE', 'MIT-0 license\n')
      write(sourceRoot, 'actual-license', 'Apache license\n')
      write(sourceRoot, 'NOTICE', 'AWS notice\n')
      symlinkSync('actual-license', join(sourceRoot, 'LICENSE'))
      expect(() => collectLegalPayloads({
        repoRoot,
        cacheDir,
        usedSkills: [provenance],
        recordInput() {},
      })).toThrow(/symbolic|symlink|link|ordinary/i)
    },
  )

  it('rejects inconsistent legal records for one source and commit', () => {
    const repoRoot = tempRoot('ramp-release-legal-repo-')
    const cacheDir = tempRoot('ramp-release-legal-cache-')
    write(repoRoot, 'LICENSE', 'MIT-0 license\n')
    const first = lockedSkillProvenance({ name: 'one' })
    const second = lockedSkillProvenance({ name: 'two' })
    second.licenseFile = { ...second.licenseFile, sha256: 'f'.repeat(64) }
    expect(() => collectLegalPayloads({
      repoRoot,
      cacheDir,
      usedSkills: [first, second],
      recordInput() {},
    })).toThrow(/inconsistent|legal|metadata/i)
  })

  it('sorts used sources and excludes unused cache legal files', () => {
    const repoRoot = tempRoot('ramp-release-legal-repo-')
    const cacheDir = tempRoot('ramp-release-legal-cache-')
    write(repoRoot, 'LICENSE', 'MIT-0 license\n')
    const used = [
      lockedSkillProvenance({ source: 'source-z', name: 'z' }),
      lockedSkillProvenance({ source: 'source-a', name: 'a' }),
    ]
    for (const skill of used) {
      const root = join(cacheDir, 'sources', skill.source, skill.commit)
      write(root, 'LICENSE', 'Apache license\n')
      write(root, 'NOTICE', 'AWS notice\n')
    }
    write(
      cacheDir,
      `sources/unused/${'d'.repeat(40)}/LICENSE`,
      'unused license\n',
    )
    write(
      cacheDir,
      `sources/unused/${'d'.repeat(40)}/NOTICE`,
      'unused notice\n',
    )
    const result = collectLegalPayloads({
      repoRoot,
      cacheDir,
      usedSkills: used,
      recordInput() {},
    })
    expect(result.sources.map(({ id }) => id)).toEqual([
      'source-a',
      'source-z',
    ])
    expect(JSON.stringify(result)).not.toContain('unused')
  })

  it('renders deterministic attribution without absolute cache paths', () => {
    const rendered = renderThirdPartyNotices([
      {
        id: 'agent-toolkit-for-aws',
        repository: SOURCE_REPOSITORY,
        commit: 'b'.repeat(40),
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
        skills: ['aws-iam', 'aws-lambda'],
      },
    ])
    expect(rendered).toContain('agent-toolkit-for-aws')
    expect(rendered).toContain('Apache-2.0')
    expect(rendered).toContain('aws-iam')
    expect(rendered).toContain('licenses/agent-toolkit-for-aws/LICENSE')
    expect(rendered).not.toContain('/tmp/')
    expect(rendered.endsWith('\n')).toBe(true)
  })

  it('separates installation and inferred runtime prerequisites', () => {
    const readme = renderReadmeFirst({
      manifest: {
        name: 'demo-pack',
        title: 'Demo Pack',
        mcp: [
          { id: 'remote', transport: 'http', url: 'https://example.invalid' },
          { id: 'node', command: 'npx', args: ['example'] },
          {
            id: 'python',
            command: 'uvx',
            args: ['example'],
            env: { AWS_PROFILE: 'do-not-copy-this-value' },
          },
        ],
      },
      target: 'claude-code',
      profile: 'shared-kiro-claude',
      workspace: {
        workspaceMode: 'shared',
        specRoot: '.kiro/specs',
        stateRoot: 'aidlc-docs',
      },
      artifactName:
        'demo-pack--claude-code--shared-kiro-claude--v1.2.3',
    })
    expect(readme).toMatch(/Use this bundle/i)
    expect(readme).toMatch(/Installation prerequisites/i)
    expect(readme).toMatch(/Runtime prerequisites/i)
    expect(readme).toMatch(/Node\.js|npx/i)
    expect(readme).toMatch(/uv|uvx/i)
    expect(readme).toMatch(/AWS (credentials|profile)/i)
    expect(readme).toContain('.kiro/specs')
    expect(readme).toContain('aidlc-docs')
    expect(readme).toContain('claude-code')
    expect(readme).toMatch(/copy.*overlay|overlay.*copy/i)
    expect(readme).toMatch(/merge|conflict/i)
    expect(readme).not.toContain('do-not-copy-this-value')
    expect(readme).not.toMatch(/does not include an installer/i)
    expect(readme).toContain('bash install.sh --target <project-directory> --dry-run')
    expect(readme).toContain('bash install.sh --target <project-directory>\n')
    expect(readme).toContain('--uninstall')
    expect(readme).toContain('--rollback')
    expect(readme).toContain(
      'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <project-directory> -DryRun',
    )
    expect(readme).toMatch(/-Uninstall/)
    expect(readme).toMatch(/-Rollback/)
    expect(readme).toContain('install-files.tsv')
    expect(readme).toContain('install-conflicts.txt')
    expect(readme).toContain('.ramp/')
    expect(readme).toMatch(/nothing is written to your project/i)
    expect(readme).toMatch(/one step/i)
    expect(readme).toMatch(/Windows PowerShell 5\.1/)
    expect(readme).toMatch(/PowerShell 7\.3/)
    expect(readme).toContain('sha256sum -c SHA256SUMS')
    expect(readme).toContain('shasum -a 256 -c SHA256SUMS')
    expect(readme).toMatch(/not.*authentic|authenticity/i)
    expect(readme).toMatch(/copied manually.*not recorded|not recorded.*manual/i)
    expect(readme).not.toMatch(/Set-ExecutionPolicy|\.\/install\.sh/)
    expect(containsLocalAbsolutePath(readme)).toBe(false)
  })

  it.each([
    ['newline', 'Demo\n/private/customer'],
    ['carriage return', 'Demo\rInjected'],
    ['tab', 'Demo\tInjected'],
    ['backtick', 'Demo `injected`'],
    ['Markdown control', 'Demo [injected]'],
    ['absolute local path', 'Demo /Users/private/customer-secret'],
    ['generic POSIX path', 'Demo /opt/customer-secret'],
    ['punctuation-adjacent user path', 'Demo (/Users/private/customer-secret)'],
    ['punctuation-adjacent temporary path', 'Demo(/tmp/customer-secret)'],
    ['POSIX root path', 'Demo /'],
    ['forward-slash network path', 'Demo //server/share'],
    ['punctuation-adjacent Windows path', 'Demo (C:\\customer\\secret)'],
  ])('rejects unsafe README pack title: %s', (_label, title) => {
    expect(() => renderReadmeFirst({
      manifest: { name: 'demo-pack', title, mcp: [] },
      target: 'kiro',
      profile: null,
      workspace: {
        workspaceMode: 'standalone',
        specRoot: '.kiro/specs',
        stateRoot: 'aidlc-docs',
      },
      artifactName: 'demo-pack--kiro--v1.2.3',
    })).toThrow(/README|safe|single-line|path|portable/i)
  })

  it('allows template-root paths from the real QA pack overlay', () => {
    const qaPack = readFileSync(
      join(projectRoot, 'packs/qa-automated-testing/pack.yaml'),
      'utf8',
    )
    const qaOverlay = readFileSync(
      join(projectRoot, 'workflow-overlays/qa-existing-test-inventory.md'),
      'utf8',
    )
    expect(qaPack).toContain('qa-existing-test-inventory.md')
    expect(qaOverlay).toContain(
      '{{STATE_DIR}}/analysis/existing-test-inventory.md',
    )
    expect(containsLocalAbsolutePath(qaOverlay)).toBe(false)
  })

  it('allows authenticated copied QA skill documentation path examples', () => {
    const state = makeBundleRepository()
    const qaReference = readFileSync(
      join(
        projectRoot,
        'skills/ramp/mobile-test-automation/references/appium-setup.md',
      ),
    )
    expect(qaReference.toString('utf8')).toContain(
      '"appium:app": "/abs/path/app-debug.apk"',
    )
    expect(qaReference.toString('utf8')).toContain(
      '"appium:derivedDataPath": "/tmp/wda_A"',
    )
    write(
      state.repository,
      'skills/ramp/demo-skill/references/appium-setup.md',
      qaReference,
    )
    state.sourceCommit = commitAll(
      state.repository,
      'authenticated QA skill documentation',
    )

    const result = buildBundle(state.packDir, bundleOptions(state))
    const copiedReference = result.entries.find(
      (entry) =>
        entry.path ===
        'overlay/.kiro/skills/demo-skill/references/appium-setup.md',
    )
    expect(copiedReference?.provenance).toMatchObject({
      kind: 'ramp',
      name: 'demo-skill',
    })
    expect(copiedReference?.bytes).toEqual(qaReference)
  })

  it.skipIf(!process.env.RAMP_SKILLS_CACHE)(
    'builds the real QA Kiro bundle from an explicit synchronized cache',
    () => {
      const state = makeRealPilotRepository()
      const qaReference = readFileSync(
        join(
          projectRoot,
          'skills/ramp/mobile-test-automation/references/appium-setup.md',
        ),
      )
      const result = buildBundle(state.packDir, {
        target: 'kiro',
        repoRoot: state.repository,
        sourceCommit: state.sourceCommit,
        buildTime: BUILD_TIME,
      })

      expect(result.artifactName).toBe(
        'qa-automated-testing--kiro--v0.1.0',
      )
      expect(result.entries.find(
        (entry) =>
          entry.path ===
          'overlay/.kiro/skills/mobile-test-automation/references/appium-setup.md',
      )?.bytes).toEqual(qaReference)
      expect(result.manifest.skills.map((skill) => skill.name)).toEqual([
        'amazon-bedrock',
        'aws-iam',
        'aws-lambda',
        'aws-lambda-microvms',
        'aws-step-functions',
        'connecting-lambda-to-api-gateway',
        'mobile-test-automation',
        'web-test-automation',
      ])
    },
    120_000,
  )
})

describe('deterministic unpacked bundle', () => {
  it('returns the exact layout, manifest, input closure, and non-recursive sums', () => {
    const state = makeBundleRepository()
    const result = buildBundle(state.packDir, bundleOptions(state))

    expect(result.artifactName).toBe('demo-pack--kiro--v1.2.3')
    expect(result.ownershipKey).toBe('demo-pack--kiro--standalone')
    expect(paths(result.entries)).toEqual([...paths(result.entries)].sort())
    expect(paths(result.entries)).toEqual([
      'LICENSE',
      'README-FIRST.md',
      'SHA256SUMS',
      'THIRD_PARTY_NOTICES.md',
      'bundle-manifest.json',
      'install-files.tsv',
      'install.ps1',
      'install.sh',
      'overlay/.kiro/settings/mcp.json',
      'overlay/.kiro/skills/demo-skill/SKILL.md',
      'overlay/.kiro/skills/demo-skill/references/guide.md',
      'overlay/.kiro/skills/demo-skill/scripts/check.sh',
      'overlay/.kiro/steering/aidlc-workflow.md',
      'overlay/.kiro/steering/skill-activation.md',
    ])
    expect(paths(result.entries).some((path) =>
      path.endsWith('.zip') || path.startsWith('atx/'))).toBe(false)

    expect(result.manifest).toMatchObject({
      schemaVersion: 1,
      bundle: {
        artifactName: 'demo-pack--kiro--v1.2.3',
        ownershipKey: 'demo-pack--kiro--standalone',
      },
      pack: {
        id: 'demo-pack',
        title: 'Demo Pack',
        version: '1.2.3',
        schemaVersion: 2,
        catalog: {
          outcome: 'automate',
          domain: 'quality-engineering',
          executionModel: 'assisted-builder',
          maturity: 'preview',
        },
      },
      target: 'kiro',
      profile: null,
      workspace: {
        workspaceMode: 'standalone',
        specRoot: '.kiro/specs',
        stateRoot: 'aidlc-docs',
      },
      workflow: {
        provider: 'local-instructions-v1',
        providerVersion: 1,
        overlays: ['demo-overlay.md'],
      },
      generator: {
        name: 'ramp-pack',
        version: '0.1.0',
      },
      source: {
        attribution: 'repository-verified',
        sourceCommit: state.sourceCommit,
        buildTime: BUILD_TIME,
      },
      relatedAssets: [],
    })
    expect(result.manifest.files.every(({ path }) =>
      path.startsWith('overlay/'))).toBe(true)
    expect(result.manifest.files.some(({ path }) =>
      path === 'bundle-manifest.json')).toBe(false)
    expect(result.manifest.licenses).toEqual([])
    expect(result.manifest.skills).toHaveLength(1)
    expect(result.manifest.skills[0]).toMatchObject({
      kind: 'ramp',
      attribution: 'declared',
      name: 'demo-skill',
      version: '1.0.0',
      license: 'MIT-0',
    })
    expect(result.manifest.mcp).toEqual([
      {
        id: 'remote',
        transport: 'http',
        url: 'https://knowledge-mcp.global.api.aws',
      },
      {
        id: 'node-tool',
        command: 'npx',
        args: ['mcp-remote', 'https://example.invalid'],
      },
      {
        id: 'python-tool',
        command: 'uvx',
        args: ['example@1.0.0'],
        env: { AWS_PROFILE: 'example-placeholder' },
      },
    ])
    expect(result.manifest.consumedInputs).toEqual(result.consumedInputs)
    expect(result.consumedInputs).toEqual(
      [...result.consumedInputs].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    )
    expect(result.consumedInputs.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'LICENSE',
        'dependencies/skills.lock.yaml',
        'dependencies/skills.sources.yaml',
        'packs/demo-pack/pack.yaml',
        'common/instructions/aidlc-workflow.md',
        'packs/demo-pack/instructions/skill-activation.md',
        'workflow-overlays/demo-overlay.md',
        'skills/ramp/demo-skill/SKILL.md',
        ...GENERATOR_FILES,
        'installer/src/adapters/kiro.js',
      ]),
    )
    expect(result.consumedInputs.find(({ path }) =>
      path === 'skills/ramp/demo-skill/skill.yaml')).toMatchObject({
      sourceKind: 'skill-metadata',
      provenance: {
        kind: 'ramp',
        name: 'demo-skill',
        attribution: 'repository-verified',
      },
    })
    expect(JSON.stringify(result)).not.toContain(state.repository)
    expect(JSON.stringify(result)).not.toContain(state.cacheDir)

    const byPath = new Map(result.entries.map((entry) => [entry.path, entry]))
    const sums = byPath.get('SHA256SUMS').bytes.toString('utf8')
    const expectedSums = result.entries
      .filter((entry) => entry.path !== 'SHA256SUMS')
      .map((entry) => ({
        path: entry.path,
        line: `${sha256(entry.bytes)}  ${entry.path}\n`,
      }))
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
      .map(({ line }) => line)
      .join('')
    expect(sums).toBe(expectedSums)
    expect(sums.endsWith('\n')).toBe(true)
    expect(sums.endsWith('\n\n')).toBe(false)
    expect(
      JSON.parse(byPath.get('bundle-manifest.json').bytes.toString('utf8')),
    ).toEqual(result.manifest)
    for (const entry of result.entries) {
      const text = entry.bytes.toString('utf8')
      expect(text).not.toContain(state.repository)
      expect(text).not.toContain(state.cacheDir)
      expect(text).not.toMatch(/\/(?:Users|home)\/[^/\s]+\/(?:Documents|Desktop)\//)
      expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|aws_secret_access_key/i)
    }
  })

  it('builds a skill whose directory order differs from full-path order', () => {
    const state = makeBundleRepository()
    write(state.repository, 'skills/ramp/demo-skill/references/cloudwatch/alarms.md', 'alarms\n')
    write(
      state.repository,
      'skills/ramp/demo-skill/references/cloudwatch-omni/agent-evaluation.md',
      'eval\n',
    )
    state.sourceCommit = commitAll(state.repository, 'sibling folder names')

    const result = buildBundle(state.packDir, bundleOptions(state))
    const references = paths(result.entries).filter((path) =>
      path.startsWith('overlay/.kiro/skills/demo-skill/references/'))
    expect(references).toEqual([
      'overlay/.kiro/skills/demo-skill/references/cloudwatch-omni/agent-evaluation.md',
      'overlay/.kiro/skills/demo-skill/references/cloudwatch/alarms.md',
      'overlay/.kiro/skills/demo-skill/references/guide.md',
    ])
  })

  it('ships standalone installers derived from the authenticated overlay', () => {
    for (const profile of [undefined, 'shared-kiro-claude']) {
      const state = makeBundleRepository()
      const result = buildBundle(state.packDir, bundleOptions(state, profile ? { profile } : {}))
      const byPath = new Map(result.entries.map((entry) => [entry.path, entry]))
      for (const [path, mode] of [
        ['install-files.tsv', 0o100644],
        ['install.ps1', 0o100644],
        ['install.sh', 0o100755],
      ]) {
        expect(byPath.get(path), path).toMatchObject({ mode, provenance: { kind: 'generated' } })
      }

      // Derived independently of renderInstallManifest from the bundle manifest.
      const expectedTsv = [
        'RAMP-INSTALL-MANIFEST\t1',
        `bundle\t${result.artifactName}`,
        `owner\t${result.ownershipKey}`,
        'version\t1.2.3',
        ...result.manifest.files.map((file) =>
          `file\t${file.sha256}\t${file.executable ? '0755' : '0644'}\t${file.path.slice('overlay/'.length)}`),
        '',
      ].join('\n')
      expect(byPath.get('install-files.tsv').bytes.toString('utf8')).toBe(expectedTsv)
      expect(expectedTsv).toContain('\t0755\t.kiro/skills/demo-skill/scripts/check.sh\n')
      expect(result.ownershipKey).toBe(
        profile ? 'demo-pack--kiro--shared-kiro-claude' : 'demo-pack--kiro--standalone',
      )

      const templates = {
        bash: readFileSync(join(projectRoot, 'installer/src/release/templates/install.sh')),
        powershell: readFileSync(join(projectRoot, 'installer/src/release/templates/install.ps1')),
      }
      const helpers = renderInstallers({ ...INSTALLER_LAYOUT, templates })
      expect(byPath.get('install.sh').bytes.toString('utf8')).toBe(helpers.bash)
      expect(byPath.get('install.ps1').bytes.toString('utf8')).toBe(helpers.powershell)
      expect(helpers.bash).toContain('MANIFEST_NAME="install-files.tsv"')
      for (const [name, bytes] of Object.entries(templates)) {
        const path = `installer/src/release/templates/install.${name === 'bash' ? 'sh' : 'ps1'}`
        expect(result.consumedInputs.find((input) => input.path === path)).toMatchObject({
          sourceKind: 'generator',
          sha256: sha256(bytes),
        })
      }

      const sums = byPath.get('SHA256SUMS').bytes.toString('utf8')
      for (const path of ['install-files.tsv', 'install.ps1', 'install.sh']) {
        expect(sums).toContain(`${sha256(byPath.get(path).bytes)}  ${path}\n`)
      }
    }
  })

  it.skipIf(process.platform === 'win32')('installs the unpacked bundle with its own helper', () => {
    const state = makeBundleRepository()
    const result = buildBundle(state.packDir, bundleOptions(state))
    const unpacked = tempRoot('ramp-release-unpacked-')
    for (const entry of result.entries) write(unpacked, entry.path, entry.bytes, entry.mode & 0o777)
    const target = tempRoot('ramp-release-target-')
    const helper = (args) => spawnSync('bash', ['install.sh', '--target', target, ...args], {
      cwd: unpacked,
      encoding: 'utf8',
      shell: false,
      timeout: 60_000,
    })

    const dryRun = helper(['--dry-run'])
    expect(dryRun.status, dryRun.stderr).toBe(0)
    expect(readdirSync(target)).toEqual([])
    const installed = helper([])
    expect(installed.status, installed.stderr).toBe(0)
    for (const entry of result.entries.filter(({ path }) => path.startsWith('overlay/'))) {
      const destination = join(target, entry.path.slice('overlay/'.length))
      expect(readFileSync(destination)).toEqual(entry.bytes)
      expect(lstatSync(destination).mode & 0o777).toBe(entry.mode & 0o777)
    }
    expect(readFileSync(join(target, '.ramp/installed/demo-pack--kiro--standalone.tsv')))
      .toEqual(result.entries.find(({ path }) => path === 'install-files.tsv').bytes)
    const checker = ['sha256sum', 'shasum'].find((command) =>
      !spawnSync(command, ['--version']).error)
    if (checker) {
      const verified = spawnSync(checker, [
        ...(checker === 'shasum' ? ['-a', '256'] : []),
        '-c',
        'SHA256SUMS',
      ], { cwd: unpacked, encoding: 'utf8' })
      expect(verified.status, verified.stdout + verified.stderr).toBe(0)
    }
    const uninstalled = helper(['--uninstall'])
    expect(uninstalled.status, uninstalled.stderr).toBe(0)
    expect(existsSync(join(target, '.kiro'))).toBe(false)
  }, 120_000)

  it('rejects an installer template changed after it was captured', () => {
    const state = makeBundleRepository()
    expect(() => buildBundle(state.packDir, bundleOptions(state, {
      onReleasePhase({ phase }) {
        if (phase === 'afterDependencyInputsCaptured') {
          write(state.repository, 'installer/src/release/templates/install.sh', '#!/bin/sh\n')
        }
      },
    }))).toThrow(/changed|capture|drift|mismatch/i)
  })

  it('returns defensive entry, manifest, and consumed-input copies', () => {
    const state = makeBundleRepository()
    const first = buildBundle(state.packDir, bundleOptions(state))
    const original = buildBundle(state.packDir, bundleOptions(state))
    first.entries[0].bytes.fill(0)
    first.manifest.pack.catalog.domain = 'mutated'
    first.manifest.consumedInputs[0].provenance.attribution = 'mutated'
    first.consumedInputs[0].path = 'mutated'
    expect(buildBundle(state.packDir, bundleOptions(state))).toEqual(original)
  })

  it.each([
    ['generator package metadata', 'installer/package.json', '{"name":"forged","version":"9.9.9"}\n'],
    ['dependency lock metadata', 'dependencies/skills.lock.yaml', 'schemaVersion: 1\nskills: invalid\n'],
  ])('rejects %s changed after the captured plan inputs', (_label, path, bytes) => {
    const state = makeBundleRepository()
    expect(() => buildBundle(state.packDir, bundleOptions(state, {
      onReleasePhase({ phase }) {
        if (phase === 'afterPlanInputsCaptured') {
          write(state.repository, path, bytes)
        }
      },
    }))).toThrow(/changed|capture|input|manifest|lock/i)
  })

  it('rejects an invalid captured lock despite a live-file ABA swap for resolver reads', () => {
    const state = makeBundleRepository()
    const lockPath = 'dependencies/skills.lock.yaml'
    const invalidCapturedLock = [
      'schemaVersion: 1',
      'skills:',
      '  - name: unused-skill',
      '    source: agent-toolkit-for-aws',
      '',
    ].join('\n')
    const validResolverLock = 'schemaVersion: 1\nskills: []\n'
    write(state.repository, lockPath, invalidCapturedLock)
    state.sourceCommit = commitAll(state.repository, 'invalid committed lock')

    expect(() => buildBundle(state.packDir, bundleOptions(state, {
      onReleasePhase({ phase }) {
        if (phase === 'afterDependencyInputsCaptured') {
          write(state.repository, lockPath, validResolverLock)
        }
        if (phase === 'afterPlanInputsCaptured') {
          write(state.repository, lockPath, invalidCapturedLock)
        }
      },
    }))).toThrow(/captured|lock|missing|required|invalid/i)
  })

  it('rejects credential-bearing MCP environment values from generated entries', () => {
    const state = makeBundleRepository()
    const packPath = join(state.packDir, 'pack.yaml')
    writeFileSync(
      packPath,
      readFileSync(packPath, 'utf8').replace(
        'AWS_PROFILE: example-placeholder',
        'AWS_SECRET_ACCESS_KEY: highly-sensitive-value',
      ),
    )
    state.sourceCommit = commitAll(state.repository, 'secret MCP value')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/credential|private|environment|release entry/i)
  })

  it('allows concrete non-secret MCP environment settings', () => {
    const state = makeBundleRepository()
    const packPath = join(state.packDir, 'pack.yaml')
    writeFileSync(
      packPath,
      readFileSync(packPath, 'utf8').replace(
        '      AWS_PROFILE: example-placeholder',
        [
          '      AWS_PROFILE: example-placeholder',
          '      FASTMCP_LOG_LEVEL: ERROR',
        ].join('\n'),
      ),
    )
    state.sourceCommit = commitAll(state.repository, 'non-secret MCP setting')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).not.toThrow()
  })

  it.each([
    [
      'POSIX MCP environment path',
      (content) => content.replace(
        '      AWS_PROFILE: example-placeholder',
        [
          '      AWS_PROFILE: example-placeholder',
          '      CONFIG_PATH: /private/customer-secret',
        ].join('\n'),
      ),
    ],
    [
      'Windows MCP environment path',
      (content) => content.replace(
        '      AWS_PROFILE: example-placeholder',
        [
          '      AWS_PROFILE: example-placeholder',
          "      CONFIG_PATH: 'C:\\customer\\secret'",
        ].join('\n'),
      ),
    ],
    [
      'POSIX MCP argument path',
      (content) => content.replace(
        '    args: ["example@1.0.0"]',
        '    args: ["example@1.0.0", "/private/customer-secret"]',
      ),
    ],
    [
      'Windows MCP argument path',
      (content) => content.replace(
        '    args: ["example@1.0.0"]',
        "    args: [\"example@1.0.0\", 'C:\\customer\\secret']",
      ),
    ],
  ])('rejects local absolute paths in %s', (_label, mutate) => {
    const state = makeBundleRepository()
    const packPath = join(state.packDir, 'pack.yaml')
    writeFileSync(
      packPath,
      mutate(readFileSync(packPath, 'utf8')),
    )
    state.sourceCommit = commitAll(state.repository, 'local MCP path')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/absolute|local|path|private|release entry/i)
  })

  it('allows URL-valued MCP metadata and arguments', () => {
    const state = makeBundleRepository()
    const packPath = join(state.packDir, 'pack.yaml')
    writeFileSync(
      packPath,
      readFileSync(packPath, 'utf8').replace(
        '      AWS_PROFILE: example-placeholder',
        [
          '      AWS_PROFILE: example-placeholder',
          '      SERVICE_URL: https://example.invalid/customer/path',
        ].join('\n'),
      ),
    )
    state.sourceCommit = commitAll(state.repository, 'URL MCP metadata')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).not.toThrow()
  })

  it.each([
    [
      'MCP URL',
      (content) => content.replace(
        '    url: https://knowledge-mcp.global.api.aws',
        '    url: https://user:password@example.invalid/customer/path',
      ),
    ],
    [
      'MCP argument',
      (content) => content.replace(
        '    args: ["mcp-remote", "https://example.invalid"]',
        '    args: ["mcp-remote", "https://user:password@example.invalid/path"]',
      ),
    ],
  ])('rejects HTTP credentials embedded in an %s', (_label, mutate) => {
    const state = makeBundleRepository()
    const packPath = join(state.packDir, 'pack.yaml')
    writeFileSync(
      packPath,
      mutate(readFileSync(packPath, 'utf8')),
    )
    state.sourceCommit = commitAll(state.repository, 'URL userinfo credentials')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/credential|userinfo|password|private|release entry/i)
  })

  it('labels explicit non-Git provenance as caller-supplied', () => {
    const state = makeBundleRepository({ gitRepository: false })
    const result = buildBundle(state.packDir, bundleOptions(state))
    expect(result.manifest.source).toEqual({
      attribution: 'caller-supplied',
      callerSuppliedSourceCommit: COMMIT,
      buildTime: BUILD_TIME,
    })
  })

  it('builds one target from a shared profile with identical shared roots', () => {
    const state = makeBundleRepository()
    const kiro = buildBundle(state.packDir, bundleOptions(state, {
      target: 'kiro',
      profile: 'shared-kiro-claude',
    }))
    const claude = buildBundle(state.packDir, bundleOptions(state, {
      target: 'claude-code',
      profile: 'shared-kiro-claude',
    }))

    expect(kiro.artifactName).toBe(
      'demo-pack--kiro--shared-kiro-claude--v1.2.3',
    )
    expect(claude.artifactName).toBe(
      'demo-pack--claude-code--shared-kiro-claude--v1.2.3',
    )
    expect(kiro.manifest.workspace).toEqual(claude.manifest.workspace)
    expect(kiro.manifest.workspace).toEqual({
      workspaceMode: 'shared',
      specRoot: '.kiro/specs',
      stateRoot: 'aidlc-docs',
    })
    expect(paths(kiro.entries).some((path) => path.includes('.claude/'))).toBe(false)
    expect(paths(claude.entries).some((path) => path.includes('.kiro/skills'))).toBe(false)
  })

  it('includes each upstream legal payload once and records locked inputs', () => {
    const state = makeBundleRepository({
      skills: ['upstream-skill'],
      rampSkill: false,
    })
    const upstream = addUpstreamSkill(state)
    const result = buildBundle(state.packDir, bundleOptions(state))

    expect(paths(result.entries)).toEqual(expect.arrayContaining([
      'licenses/agent-toolkit-for-aws/LICENSE',
      'licenses/agent-toolkit-for-aws/NOTICE',
      'overlay/.kiro/skills/upstream-skill/SKILL.md',
    ]))
    expect(result.manifest.licenses).toEqual([{
      id: 'agent-toolkit-for-aws',
      license: 'Apache-2.0',
      repository: SOURCE_REPOSITORY,
      commit: upstream.entry.commit,
      licensePath: 'LICENSE',
      noticePath: 'NOTICE',
    }])
    expect(result.consumedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'LICENSE',
        sourceKind: 'upstream-license',
        provenance: expect.objectContaining({
          source: 'agent-toolkit-for-aws',
          commit: upstream.entry.commit,
        }),
      }),
      expect.objectContaining({
        path: 'NOTICE',
        sourceKind: 'upstream-notice',
      }),
      expect.objectContaining({
        path: `${upstream.entry.path}/SKILL.md`,
        sourceKind: 'upstream-skill',
      }),
    ]))
  })

  it('builds a locked mirror with an upstream sidecar and records the sidecar as a metadata input', () => {
    const state = makeBundleRepository({
      skills: ['upstream-skill'],
      rampSkill: false,
    })
    const upstream = addUpstreamSkill(state)
    const mirror = join(state.repository, 'skills-library', 'upstream-skill')
    mkdirSync(dirname(mirror), { recursive: true })
    renameSync(upstream.skillRoot, mirror)
    write(state.repository, 'skills-library/upstream-skill/skill.yaml', [
      'schemaVersion: 2',
      'kind: ramp-skill',
      'name: upstream-skill',
      'origin: upstream',
      'classification: {}',
      '',
    ].join('\n'))
    state.sourceCommit = commitAll(state.repository, 'mirror with sidecar')
    const result = buildBundle(state.packDir, bundleOptions(state))

    expect(paths(result.entries).filter((path) =>
      path.startsWith('overlay/.kiro/skills/upstream-skill/'))).toEqual([
      'overlay/.kiro/skills/upstream-skill/SKILL.md',
      'overlay/.kiro/skills/upstream-skill/scripts/check.sh',
    ])
    expect(result.consumedInputs.find(({ path }) =>
      path === 'skills-library/upstream-skill/skill.yaml')).toMatchObject({
      sourceKind: 'skill-metadata',
      provenance: { attribution: 'repository-verified' },
    })
  })

  it.each([
    ['dirty instruction', (state) =>
      writeFileSync(
        join(state.repository, 'common/instructions/aidlc-workflow.md'),
        '# dirty but valid\n',
      )],
    ['dirty root license', (state) =>
      writeFileSync(join(state.repository, 'LICENSE'), 'dirty\n')],
    ['dirty generator', (state) =>
      writeFileSync(join(state.repository, 'installer/src/plan.js'), '// dirty\n')],
    ['dirty installer template', (state) =>
      writeFileSync(join(state.repository, 'installer/src/release/templates/install.ps1'), '# dirty\n')],
    ['untracked selected skill file', (state) =>
      write(state.repository, 'skills/ramp/demo-skill/.DS_Store', 'ignored')],
  ])('rejects repository-verified bundle with %s', (_label, mutate) => {
    const state = makeBundleRepository()
    mutate(state)
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/commit|drift|mismatch|untracked|ignored|extra|provenance|executing/i)
  })

  it('records the skill resolver, skills planner and instruction composer as generator inputs', () => {
    const state = makeBundleRepository()
    const result = buildBundle(state.packDir, bundleOptions(state))
    for (const path of [
      'installer/src/dependencies/resolver.js',
      'installer/src/skills.js',
      'installer/src/instructions/compose.js',
    ]) {
      expect(result.consumedInputs.find((input) => input.path === path)).toMatchObject({
        sourceKind: 'generator',
        sha256: sha256(readFileSync(join(projectRoot, ...path.split('/')))),
      })
    }
  })

  it.each([
    'installer/src/plan.js',
    'installer/src/adapters/kiro.js',
    'installer/src/dependencies/resolver.js',
    'installer/src/skills.js',
    'installer/src/instructions/compose.js',
    'installer/src/release/install-manifest.js',
    'installer/src/release/templates/install.sh',
  ])('rejects a clean committed generator file that did not execute: %s', (path) => {
    const state = makeBundleRepository()
    write(state.repository, path, '// committed but not executing\n')
    state.sourceCommit = commitAll(state.repository, 'different generator')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/generator|executing|does not match/i)
  })

  it('rejects a repository-authored non-MIT-0 skill', () => {
    const state = makeBundleRepository()
    writeDeclaredSkillMetadata(state, { license: 'Apache-2.0' })
    state.sourceCommit = commitAll(state.repository, 'non MIT-0 skill')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/MIT-0|license payload|explicit/i)
  })

  it('resolves a pack override basedOn to locked legal payloads', () => {
    const state = makeBundleRepository({ rampSkill: false })
    const upstream = addUpstreamSkill(state, {
      name: 'base-skill',
      sourcePath: 'skills/base-skill',
      updatePack: false,
    })
    write(
      state.repository,
      'packs/demo-pack/skills/demo-skill/SKILL.md',
      '# Pack override\n',
    )
    writeDeclaredSkillMetadata(state, {
      directory: 'packs/demo-pack/skills/demo-skill',
      ownerPack: 'demo-pack',
      basedOn: {
        source: upstream.entry.source,
        commit: upstream.entry.commit,
        path: upstream.entry.path,
      },
    })
    state.sourceCommit = commitAll(state.repository, 'pack override basedOn')

    const result = buildBundle(state.packDir, bundleOptions(state))
    expect(result.manifest.skills).toEqual([
      expect.objectContaining({
        kind: 'pack-override',
        ownerPack: 'demo-pack',
        basedOn: {
          source: upstream.entry.source,
          commit: upstream.entry.commit,
          path: upstream.entry.path,
        },
      }),
    ])
    expect(paths(result.entries)).toContain(
      'licenses/agent-toolkit-for-aws/LICENSE',
    )
    expect(
      result.entries.find((entry) =>
        entry.path === 'licenses/agent-toolkit-for-aws/LICENSE').bytes,
    ).toEqual(readFileSync(join(upstream.groupRoot, 'LICENSE')))
  })

  it('resolves a RAMP skill basedOn to locked legal payloads', () => {
    const state = makeBundleRepository()
    const upstream = addUpstreamSkill(state, {
      name: 'base-skill',
      sourcePath: 'skills/base-skill',
      updatePack: false,
    })
    writeDeclaredSkillMetadata(state, {
      basedOn: {
        source: upstream.entry.source,
        commit: upstream.entry.commit,
        path: upstream.entry.path,
      },
    })
    state.sourceCommit = commitAll(state.repository, 'RAMP basedOn')
    const result = buildBundle(state.packDir, bundleOptions(state))
    expect(result.manifest.licenses).toHaveLength(1)
    expect(paths(result.entries)).toContain(
      'licenses/agent-toolkit-for-aws/NOTICE',
    )
  })

  it.each([
    ['RAMP', true],
    ['pack override', false],
  ])('rejects unresolved basedOn for a %s skill', (_label, rampSkill) => {
    const state = makeBundleRepository({ rampSkill })
    const directory = rampSkill
      ? 'skills/ramp/demo-skill'
      : 'packs/demo-pack/skills/demo-skill'
    if (!rampSkill) {
      write(state.repository, `${directory}/SKILL.md`, '# Override\n')
    }
    writeDeclaredSkillMetadata(state, {
      directory,
      ...(rampSkill ? {} : { ownerPack: 'demo-pack' }),
      basedOn: {
        source: 'agent-toolkit-for-aws',
        commit: 'c'.repeat(40),
        path: 'skills/missing',
      },
    })
    state.sourceCommit = commitAll(state.repository, 'unresolved basedOn')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).toThrow(/basedOn|unresolved|source|commit/i)
  })

  it('allows unrelated dirty and ignored files outside the consumed closure', () => {
    const state = makeBundleRepository()
    write(state.repository, 'docs/draft.md', 'dirty planning\n')
    write(state.repository, '.DS_Store', 'ignored')
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state)),
    ).not.toThrow()
  })

  it.each([
    ['implicit build time', { buildTime: undefined }, /buildTime/i],
    ['non-canonical time', { buildTime: '2026-11-05T04:00:00Z' }, /buildTime|canonical/i],
    ['short commit', { sourceCommit: 'abc123' }, /sourceCommit|commit/i],
    ['undeclared target', { target: 'cursor' }, /target|declared/i],
    ['unknown profile', { profile: 'missing' }, /profile/i],
  ])('rejects invalid bundle options: %s', (_label, override, message) => {
    const state = makeBundleRepository()
    expect(() =>
      buildBundle(state.packDir, bundleOptions(state, override)),
    ).toThrow(message)
  })

  it('rejects legacy-local and unattributed pack overrides in release mode', () => {
    const legacy = makeBundleRepository({
      skills: ['legacy-skill'],
      rampSkill: false,
    })
    write(
      legacy.repository,
      'skills-library/legacy-skill/SKILL.md',
      '# Legacy\n',
    )
    legacy.sourceCommit = commitAll(legacy.repository, 'legacy skill')
    expect(() =>
      buildBundle(legacy.packDir, bundleOptions(legacy)),
    ).toThrow(/legacy|strict provenance/i)

    const override = makeBundleRepository({
      skills: ['override-skill'],
      rampSkill: false,
    })
    write(
      override.repository,
      'packs/demo-pack/skills/override-skill/SKILL.md',
      '# Override\n',
    )
    override.sourceCommit = commitAll(override.repository, 'override skill')
    expect(() =>
      buildBundle(override.packDir, bundleOptions(override)),
    ).toThrow(/skill.yaml|strict provenance|ownerPack/i)
  })

  it('is deterministic across locale, timezone, cwd, and absolute fixture root', () => {
    const firstState = makeBundleRepository({ gitRepository: false })
    const secondState = makeBundleRepository({ gitRepository: false })
    const first = withEnvironment(
      { LC_ALL: 'tr_TR.UTF-8', TZ: 'Pacific/Honolulu' },
      () => buildBundle(firstState.packDir, bundleOptions(firstState)),
    )
    const second = withEnvironment(
      { LC_ALL: 'C', TZ: 'Asia/Singapore' },
      () => buildBundle(secondState.packDir, bundleOptions(secondState)),
    )
    expect(first).toEqual(second)
  })
})
