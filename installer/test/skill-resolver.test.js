import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashSkillTree } from '../src/dependencies/checksum.js'
import { writeSkillLock } from '../src/dependencies/manifests.js'
import {
  createSkillResolver,
  resolveCacheDir,
  verifyLockedSkillDirectory,
} from '../src/dependencies/resolver.js'

const repository = 'https://github.com/aws/agent-toolkit-for-aws.git'
const commit = 'a'.repeat(40)
const licenseFile = {
  path: 'LICENSE',
  sha256: 'b'.repeat(64),
  size: 11357,
  executable: false,
}
const noticeFile = {
  path: 'NOTICE',
  sha256: 'c'.repeat(64),
  size: 314,
  executable: false,
}
const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function fixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'ramp-resolver-'))
  roots.push(repoRoot)
  const packDir = join(repoRoot, 'packs', 'demo-pack')
  const cacheDir = join(repoRoot, 'cache')
  const libraryDir = join(repoRoot, 'skills-library')
  const rampDir = join(repoRoot, 'skills', 'ramp')
  mkdirSync(join(repoRoot, 'dependencies'), { recursive: true })
  mkdirSync(packDir, { recursive: true })
  writeFileSync(
    join(repoRoot, 'dependencies', 'skills.sources.yaml'),
    [
      'schemaVersion: 1',
      'sources:',
      '  - id: agent-toolkit-for-aws',
      `    repository: ${repository}`,
      '    priority: 10',
      '    license: Apache-2.0',
      '    licensePath: LICENSE',
      '    noticePath: NOTICE',
      '',
    ].join('\n'),
  )
  return { repoRoot, packDir, cacheDir, libraryDir, rampDir }
}

function writeTree(
  directory,
  records = [
    { path: 'SKILL.md', bytes: '# AWS IAM\n', executable: false },
    {
      path: 'references/guide.md',
      bytes: 'least privilege\n',
      executable: false,
    },
  ],
) {
  for (const record of records) {
    const path = join(directory, record.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, record.bytes)
    chmodSync(path, record.executable ? 0o755 : 0o644)
  }
  return directory
}

function metadata(
  directory,
  {
    name = 'aws-iam',
    ownerPack,
    basedOn,
    version = '1.2.3',
    license = 'MIT-0',
  } = {},
) {
  const lines = [
    'schemaVersion: 1',
    'kind: ramp-skill',
    `name: ${name}`,
    `version: ${version}`,
    `license: ${license}`,
  ]
  if (basedOn) {
    lines.push(
      'basedOn:',
      `  source: ${basedOn.source}`,
      `  commit: ${basedOn.commit}`,
      `  path: ${basedOn.path}`,
    )
  }
  if (ownerPack !== undefined) lines.push(`ownerPack: ${ownerPack}`)
  writeFileSync(join(directory, 'skill.yaml'), `${lines.join('\n')}\n`)
}

function upstreamSidecar(directory, { name = 'aws-iam', origin = 'upstream' } = {}) {
  writeFileSync(
    join(directory, 'skill.yaml'),
    [
      'schemaVersion: 2',
      'kind: ramp-skill',
      `name: ${name}`,
      `origin: ${origin}`,
      ...(origin === 'upstream' ? [] : ['version: 1.2.3', 'license: MIT-0']),
      'classification:',
      '  useCases: []',
      '',
    ].join('\n'),
  )
}

function lockedEntry(
  directory,
  {
    name = 'aws-iam',
    path = 'skills/core-skills/aws-iam',
    treeSha256,
    files,
  } = {},
) {
  const hashed = hashSkillTree(directory)
  return {
    name,
    source: 'agent-toolkit-for-aws',
    repository,
    commit,
    path,
    treeSha256: treeSha256 ?? hashed.treeSha256,
    files: files ?? hashed.files,
    license: 'Apache-2.0',
    licensePath: 'LICENSE',
    licenseFile: { ...licenseFile },
    noticePath: 'NOTICE',
    noticeFile: { ...noticeFile },
  }
}

function writeLock(repoRoot, entries) {
  writeSkillLock(repoRoot, {
    schemaVersion: 1,
    skills: new Map(
      [...entries]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ),
  })
}

function cacheSkill(cacheDir, entry) {
  return join(cacheDir, 'sources', entry.source, entry.commit, entry.path)
}

function resolverFor(state, options = {}) {
  return createSkillResolver({
    repoRoot: state.repoRoot,
    cacheDir: state.cacheDir,
    libraryDir: state.libraryDir,
    rampDir: state.rampDir,
    ...options,
  })
}

function resolveAwsIam(resolver, state) {
  return resolver.resolveSkill('aws-iam', {
    packDir: state.packDir,
    packId: 'demo-pack',
  })
}

describe('resolveCacheDir', () => {
  it('uses explicit cache before the environment and resolves it from cwd', () => {
    const state = fixture()
    expect(
      resolveCacheDir({
        repoRoot: state.repoRoot,
        cacheDir: 'explicit-cache',
        env: 'environment-cache',
      }),
    ).toBe(resolve(process.cwd(), 'explicit-cache'))
  })

  it('uses the environment before the repository default', () => {
    const state = fixture()
    expect(
      resolveCacheDir({
        repoRoot: state.repoRoot,
        env: 'environment-cache',
      }),
    ).toBe(resolve(process.cwd(), 'environment-cache'))
  })

  it.each([undefined, null, '', '   '])(
    'uses the repository default for unset environment value %#',
    (env) => {
      const state = fixture()
      expect(resolveCacheDir({ repoRoot: state.repoRoot, env })).toBe(
        join(state.repoRoot, '.ramp-cache', 'skills'),
      )
    },
  )

  it.each([
    [{}, /repoRoot.*string/i],
    [{ repoRoot: '' }, /repoRoot.*non-empty/i],
    [{ repoRoot: '/tmp', cacheDir: '' }, /cacheDir.*non-empty/i],
    [{ repoRoot: '/tmp', cacheDir: 42 }, /cacheDir.*string/i],
    [{ repoRoot: '/tmp', env: 42 }, /env.*string/i],
    [{ repoRoot: '/tmp', env: 'bad\0cache' }, /env.*NUL/i],
  ])('rejects invalid cache input %#', (options, message) => {
    expect(() => resolveCacheDir(options)).toThrow(message)
  })

  it('does not create the selected cache directory', () => {
    const state = fixture()
    const selected = join(state.repoRoot, 'does-not-exist')
    expect(resolveCacheDir({ repoRoot: state.repoRoot, cacheDir: selected })).toBe(
      selected,
    )
    expect(existsSync(selected)).toBe(false)
  })
})

describe('verifyLockedSkillDirectory', () => {
  it('returns deep-copied locked records for an exact tree', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    const verified = verifyLockedSkillDirectory(directory, entry)

    expect(verified).toEqual({
      treeSha256: entry.treeSha256,
      files: entry.files,
    })
    expect(verified.files).not.toBe(entry.files)
    expect(verified.files[0]).not.toBe(entry.files[0])
  })

  it.each([
    [
      'an empty locked closure',
      (directory) => {
        mkdirSync(directory, { recursive: true })
      },
    ],
    [
      'a locked closure without SKILL.md',
      (directory) =>
        writeTree(directory, [
          { path: 'README.md', bytes: '# not a skill\n', executable: false },
        ]),
    ],
  ])('rejects %s', (_name, arrange) => {
    const state = fixture()
    const directory = join(state.repoRoot, 'candidate')
    arrange(directory)
    const entry = lockedEntry(directory)
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /SKILL\.md.*locked|locked.*SKILL\.md/i,
    )
  })

  it.each([
    [
      'missing',
      (directory) => unlinkSync(join(directory, 'SKILL.md')),
      /SKILL\.md does not exist/i,
    ],
    [
      'non-regular',
      (directory) => {
        unlinkSync(join(directory, 'SKILL.md'))
        mkdirSync(join(directory, 'SKILL.md'))
      },
      /SKILL\.md must be a regular file/i,
    ],
  ])(
    'reports locked skill and candidate context when SKILL.md is %s',
    (_name, mutate, cause) => {
      const state = fixture()
      const directory = writeTree(join(state.repoRoot, 'candidate'))
      const entry = lockedEntry(directory)
      mutate(directory)

      let failure
      try {
        verifyLockedSkillDirectory(directory, entry)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(failure.message).toContain(`locked skill aws-iam at ${directory}`)
      expect(failure.message).toMatch(cause)
    },
  )

  it.each([
    [
      'missing file',
      (directory) => unlinkSync(join(directory, 'references', 'guide.md')),
    ],
    [
      'extra hidden file',
      (directory) => writeFileSync(join(directory, '.DS_Store'), 'extra'),
    ],
    [
      'changed nested bytes',
      (directory) =>
        writeFileSync(join(directory, 'references', 'guide.md'), 'drift'),
    ],
  ])('rejects a %s', (_name, mutate) => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    mutate(directory)
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /aws-iam|locked|checksum|path set/i,
    )
  })

  it('names the first changed locked file before reporting aggregate tree drift', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    writeFileSync(join(directory, 'references', 'guide.md'), 'drift')
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /references\/guide\.md/i,
    )
  })

  it('rejects file-record hash or size drift even when the tree field is unchanged', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    entry.files = entry.files.map((file, index) =>
      index === 0 ? { ...file, sha256: 'b'.repeat(64), size: file.size + 1 } : file,
    )
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /aws-iam|file.*mismatch|checksum/i,
    )
  })

  it('rejects an incorrect tree checksum', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory, { treeSha256: 'b'.repeat(64) })
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /aws-iam.*tree|tree.*aws-iam|checksum/i,
    )
  })

  it.runIf(process.platform !== 'win32')(
    'rejects a symlinked root or nested entry',
    () => {
      const state = fixture()
      const directory = writeTree(join(state.repoRoot, 'candidate'))
      const entry = lockedEntry(directory)
      const rootLink = join(state.repoRoot, 'root-link')
      symlinkSync(directory, rootLink)
      expect(() => verifyLockedSkillDirectory(rootLink, entry)).toThrow(
        /symbolic link/i,
      )

      unlinkSync(join(directory, 'references', 'guide.md'))
      symlinkSync('../SKILL.md', join(directory, 'references', 'guide.md'))
      expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
        /symbolic link/i,
      )
    },
  )

  it.runIf(process.platform !== 'win32')(
    'rejects a POSIX executable-bit mismatch',
    () => {
      const state = fixture()
      const directory = writeTree(join(state.repoRoot, 'candidate'), [
        { path: 'SKILL.md', bytes: '# skill\n', executable: true },
      ])
      const entry = lockedEntry(directory)
      chmodSync(join(directory, 'SKILL.md'), 0o644)
      expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
        /executable.*SKILL\.md|SKILL\.md.*executable/i,
      )
    },
  )

  it('ignores a root skill.yaml sidecar with origin upstream', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    upstreamSidecar(directory)

    expect(verifyLockedSkillDirectory(directory, entry, { allowSidecar: true })).toEqual({
      treeSha256: entry.treeSha256,
      files: entry.files,
    })
    expect(
      verifyLockedSkillDirectory(directory, entry, {
        platform: 'win32',
        allowSidecar: true,
      }),
    ).toEqual({ treeSha256: entry.treeSha256, files: entry.files })
  })

  it('treats the sidecar as an extra file unless the caller allows it', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    upstreamSidecar(directory)
    expect(() => verifyLockedSkillDirectory(directory, entry)).toThrow(
      /aws-iam.*path set mismatch; missing: skill\.yaml;/,
    )
    expect(() => verifyLockedSkillDirectory(directory, entry, { allowSidecar: 'yes' }))
      .toThrow('allowSidecar must be boolean')
  })

  it('still rejects an extra non-sidecar file beside the sidecar', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    upstreamSidecar(directory)
    writeFileSync(join(directory, 'NOTES.md'), 'extra')
    expect(() => verifyLockedSkillDirectory(directory, entry, { allowSidecar: true })).toThrow(
      /aws-iam.*path set mismatch; missing: NOTES\.md;/,
    )
  })

  it('still verifies the locked files beside the sidecar', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    upstreamSidecar(directory)
    writeFileSync(join(directory, 'references', 'guide.md'), 'drift')
    expect(() => verifyLockedSkillDirectory(directory, entry, { allowSidecar: true })).toThrow(
      /aws-iam.*references\/guide\.md sha256 mismatch/,
    )
  })

  it.each([
    [
      'RAMP skill.yaml (schemaVersion 1)',
      (directory) => metadata(directory),
      /aws-iam.*path set mismatch; missing: skill\.yaml;/,
    ],
    [
      'skill.yaml with origin ramp',
      (directory) => upstreamSidecar(directory, { origin: 'ramp' }),
      /aws-iam.*invalid skill\.yaml sidecar.*origin ramp is not accepted/,
    ],
    [
      'sidecar naming another skill',
      (directory) => upstreamSidecar(directory, { name: 'aws-lambda' }),
      /aws-iam.*invalid skill\.yaml sidecar.*does not match/,
    ],
    [
      'nested upstream skill.yaml',
      (directory) => upstreamSidecar(join(directory, 'references')),
      /aws-iam.*path set mismatch.*references\/skill\.yaml/,
    ],
  ])('does not ignore a %s', (_name, arrange, failure) => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    const entry = lockedEntry(directory)
    arrange(directory)
    expect(() => verifyLockedSkillDirectory(directory, entry, { allowSidecar: true })).toThrow(failure)
  })

  it('verifies a locked skill.yaml as an ordinary file, not as a sidecar', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'))
    upstreamSidecar(directory)
    const entry = lockedEntry(directory)
    expect(entry.files.map((file) => file.path)).toContain('skill.yaml')
    expect(verifyLockedSkillDirectory(directory, entry, { allowSidecar: true }).files).toEqual(entry.files)
    unlinkSync(join(directory, 'skill.yaml'))
    expect(() => verifyLockedSkillDirectory(directory, entry, { allowSidecar: true })).toThrow(
      /aws-iam.*path set mismatch; missing: <none>; extra: skill\.yaml/,
    )
  })

  it('uses locked executable modes for simulated Windows verification', () => {
    const state = fixture()
    const directory = writeTree(join(state.repoRoot, 'candidate'), [
      { path: 'SKILL.md', bytes: '# skill\n', executable: true },
    ])
    const entry = lockedEntry(directory)
    chmodSync(join(directory, 'SKILL.md'), 0o644)
    const verified = verifyLockedSkillDirectory(directory, entry, {
      platform: 'win32',
    })
    expect(verified.files[0].executable).toBe(true)
  })
})

describe('createSkillResolver precedence and provenance', () => {
  it('exposes the single resolved cache path without creating it', () => {
    const state = fixture()
    const resolver = resolverFor(state)
    expect(resolver.cacheDir).toBe(state.cacheDir)
    expect(existsSync(state.cacheDir)).toBe(false)
  })

  it('selects a declared pack override before RAMP and legacy content', () => {
    const state = fixture()
    const override = writeTree(join(state.packDir, 'skills', 'aws-iam'))
    metadata(override, { ownerPack: 'demo-pack' })
    const ramp = writeTree(join(state.rampDir, 'aws-iam'))
    metadata(ramp)
    writeTree(join(state.libraryDir, 'aws-iam'))

    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(override)
    expect(resolved.provenance).toMatchObject({
      kind: 'pack-override',
      attribution: 'declared',
      name: 'aws-iam',
      ownerPack: 'demo-pack',
      version: '1.2.3',
      license: 'MIT-0',
    })
  })

  it('selects a declared RAMP skill before locked or legacy content', () => {
    const state = fixture()
    const ramp = writeTree(join(state.rampDir, 'aws-iam'))
    metadata(ramp, {
      basedOn: {
        source: 'agent-toolkit-for-aws',
        commit,
        path: 'skills/core-skills/aws-iam',
      },
    })
    writeTree(join(state.libraryDir, 'aws-iam'))

    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(ramp)
    expect(resolved.provenance).toMatchObject({
      kind: 'ramp',
      attribution: 'declared',
      name: 'aws-iam',
      basedOn: {
        source: 'agent-toolkit-for-aws',
        commit,
        path: 'skills/core-skills/aws-iam',
      },
    })
    expect(resolved.provenance).not.toHaveProperty('ownerPack')
  })

  it('selects a verified locked cache before an exact mirror', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const cached = writeTree(cacheSkill(state.cacheDir, entry))
    writeTree(join(state.libraryDir, 'aws-iam'))
    const resolver = resolverFor(state)

    const resolved = resolveAwsIam(resolver, state)
    expect(resolved.directory).toBe(cached)
    expect(resolved.provenance).toEqual({
      kind: 'upstream',
      attribution: 'locked',
      name: 'aws-iam',
      source: entry.source,
      repository,
      commit,
      path: entry.path,
      treeSha256: entry.treeSha256,
      files: entry.files,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      licenseFile,
      noticePath: 'NOTICE',
      noticeFile,
    })
    expect(resolved.provenance.licenseFile).not.toBe(entry.licenseFile)
    expect(resolved.provenance.noticeFile).not.toBe(entry.noticeFile)
    resolved.provenance.licenseFile.sha256 = '0'.repeat(64)
    resolved.provenance.noticeFile.size = 0
    const again = resolveAwsIam(resolver, state)
    expect(again.provenance.licenseFile.sha256).toBe(licenseFile.sha256)
    expect(again.provenance.noticeFile.size).toBe(noticeFile.size)
    expect(again.provenance.licenseFile).not.toBe(
      resolved.provenance.licenseFile,
    )
    expect(again.provenance.noticeFile).not.toBe(
      resolved.provenance.noticeFile,
    )
  })

  it('falls back from an absent cache to an exact locked mirror with identical provenance', () => {
    const cachedState = fixture()
    const reference = writeTree(join(cachedState.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(cachedState.repoRoot, [['aws-iam', entry]])
    writeTree(cacheSkill(cachedState.cacheDir, entry))
    const fromCache = resolveAwsIam(resolverFor(cachedState), cachedState)

    const mirrorState = fixture()
    const mirrorReference = writeTree(join(mirrorState.repoRoot, 'reference'))
    const mirrorEntry = lockedEntry(mirrorReference)
    writeLock(mirrorState.repoRoot, [['aws-iam', mirrorEntry]])
    const mirror = writeTree(join(mirrorState.libraryDir, 'aws-iam'))
    const fromMirror = resolveAwsIam(resolverFor(mirrorState), mirrorState)

    expect(fromMirror.directory).toBe(mirror)
    expect(fromMirror.provenance).toEqual(fromCache.provenance)
  })

  it('allows an unlocked legacy skill when a different name is locked', () => {
    const state = fixture()
    const lockedReference = writeTree(join(state.repoRoot, 'locked-reference'))
    writeLock(state.repoRoot, [
      ['aws-iam', lockedEntry(lockedReference)],
    ])
    const legacy = writeTree(
      join(state.libraryDir, 'api-gateway'),
      [{ path: 'SKILL.md', bytes: '# API Gateway\n', executable: false }],
    )
    const resolved = resolverFor(state).resolveSkill('api-gateway', {
      packDir: state.packDir,
      packId: 'demo-pack',
    })
    expect(resolved.directory).toBe(legacy)
    expect(resolved.provenance).toMatchObject({
      kind: 'legacy-local',
      attribution: 'legacy-unattributed',
      name: 'api-gateway',
    })
  })

  it('rejects legacy-local content when disabled or strict', () => {
    const state = fixture()
    writeTree(join(state.libraryDir, 'aws-iam'))
    expect(() =>
      resolveAwsIam(resolverFor(state, { allowLegacyLocal: false }), state),
    ).toThrow(/legacy.*not allowed|allowLegacyLocal/i)
    expect(() =>
      resolveAwsIam(resolverFor(state, { strictProvenance: true }), state),
    ).toThrow(/strict provenance|legacy/i)
  })

  it('returns unattributed override provenance only outside strict mode', () => {
    const state = fixture()
    const override = writeTree(join(state.packDir, 'skills', 'aws-iam'))
    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(override)
    expect(resolved.provenance).toMatchObject({
      kind: 'pack-override',
      attribution: 'legacy-unattributed',
      ownerPack: 'demo-pack',
    })
    expect(() =>
      resolveAwsIam(resolverFor(state, { strictProvenance: true }), state),
    ).toThrow(/skill\.yaml.*ownerPack|ownerPack.*skill\.yaml/i)
  })

  it('never labels a pack override as upstream when the name is locked', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    writeLock(state.repoRoot, [['aws-iam', lockedEntry(reference)]])
    const override = writeTree(join(state.packDir, 'skills', 'aws-iam'))
    metadata(override, { ownerPack: 'demo-pack' })
    expect(resolveAwsIam(resolverFor(state), state).provenance.kind).toBe(
      'pack-override',
    )
  })

  it.each([
    [
      'mismatched override metadata',
      (state) => {
        const directory = writeTree(join(state.packDir, 'skills', 'aws-iam'))
        metadata(directory, { ownerPack: 'another-pack' })
      },
      /ownerPack/i,
    ],
    [
      'RAMP ownerPack metadata',
      (state) => {
        const directory = writeTree(join(state.rampDir, 'aws-iam'))
        metadata(directory, { ownerPack: 'demo-pack' })
      },
      /ownerPack.*forbidden/i,
    ],
    [
      'non-directory override',
      (state) => {
        mkdirSync(join(state.packDir, 'skills'), { recursive: true })
        writeFileSync(join(state.packDir, 'skills', 'aws-iam'), 'not a dir')
      },
      /directory/i,
    ],
  ])('fails closed for present %s', (_name, arrange, message) => {
    const state = fixture()
    arrange(state)
    writeTree(join(state.libraryDir, 'aws-iam'))
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(message)
  })

  it('resolves a locked mirror with an upstream sidecar to the cache provenance', () => {
    const cachedState = fixture()
    const reference = writeTree(join(cachedState.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(cachedState.repoRoot, [['aws-iam', entry]])
    writeTree(cacheSkill(cachedState.cacheDir, entry))
    const fromCache = resolveAwsIam(resolverFor(cachedState), cachedState)

    const mirrorState = fixture()
    writeLock(mirrorState.repoRoot, [['aws-iam', entry]])
    const mirror = writeTree(join(mirrorState.libraryDir, 'aws-iam'))
    upstreamSidecar(mirror)
    const fromMirror = resolveAwsIam(resolverFor(mirrorState), mirrorState)

    expect(fromMirror.directory).toBe(mirror)
    expect(fromMirror.provenance).toEqual(fromCache.provenance)
  })

  it('rejects an upstream sidecar planted in the locked cache', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    upstreamSidecar(writeTree(cacheSkill(state.cacheDir, entry)))
    writeTree(join(state.libraryDir, 'aws-iam'))
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      /locked cache skill aws-iam failed verification.*path set mismatch; missing: skill\.yaml;/,
    )
  })

  it('fails a corrupt cache instead of falling through to a valid mirror', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const cached = writeTree(cacheSkill(state.cacheDir, entry))
    writeFileSync(join(cached, 'references', 'guide.md'), 'corrupt')
    writeTree(join(state.libraryDir, 'aws-iam'))
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      /aws-iam.*cache|cache.*aws-iam|checksum/i,
    )
  })

  it('fails a drifted locked mirror instead of reclassifying it as legacy', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const mirror = writeTree(join(state.libraryDir, 'aws-iam'))
    writeFileSync(join(mirror, 'SKILL.md'), '# drift\n')
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      /aws-iam.*mirror|mirror.*aws-iam|checksum/i,
    )
  })

  it('gives the exact sync remediation when locked content is absent', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      new RegExp(
        `aws-iam[\\s\\S]*ramp-pack skills sync --locked --cache "${state.cacheDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
        'i',
      ),
    )
  })

  it('re-verifies the complete locked tree on every resolution', () => {
    const state = fixture()
    const reference = writeTree(join(state.repoRoot, 'reference'))
    const entry = lockedEntry(reference)
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const cached = writeTree(cacheSkill(state.cacheDir, entry))
    const resolver = resolverFor(state)
    expect(() => resolveAwsIam(resolver, state)).not.toThrow()
    writeFileSync(join(cached, 'references', 'guide.md'), 'drift')
    expect(() => resolveAwsIam(resolver, state)).toThrow(
      /aws-iam|checksum|drift/i,
    )
  })

  it('rejects an unknown or unsafe skill name with all source classes named', () => {
    const state = fixture()
    expect(() =>
      resolverFor(state).resolveSkill('missing-skill', {
        packDir: state.packDir,
        packId: 'demo-pack',
      }),
    ).toThrow(/missing-skill.*pack.*RAMP.*cache.*skills-library/is)
    expect(() =>
      resolverFor(state).resolveSkill('../outside', {
        packDir: state.packDir,
        packId: 'demo-pack',
      }),
    ).toThrow(/lower-kebab|identifier/i)
  })

  it.runIf(process.platform !== 'win32')(
    'rejects symlinked pack and cache path components',
    () => {
      const packState = fixture()
      const outsidePack = writeTree(join(packState.repoRoot, 'outside-pack'))
      symlinkSync(outsidePack, join(packState.packDir, 'skills'))
      expect(() => resolveAwsIam(resolverFor(packState), packState)).toThrow(
        /symbolic link|symlink/i,
      )

      const cacheState = fixture()
      const reference = writeTree(join(cacheState.repoRoot, 'reference'))
      const entry = lockedEntry(reference)
      writeLock(cacheState.repoRoot, [['aws-iam', entry]])
      const outsideCache = join(cacheState.repoRoot, 'outside-cache')
      writeTree(
        join(
          outsideCache,
          entry.source,
          entry.commit,
          entry.path,
        ),
      )
      mkdirSync(cacheState.cacheDir, { recursive: true })
      symlinkSync(outsideCache, join(cacheState.cacheDir, 'sources'))
      expect(() => resolveAwsIam(resolverFor(cacheState), cacheState)).toThrow(
        /symbolic link|symlink/i,
      )
    },
  )

  it('does not import process, network, or Git execution primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'dependencies', 'resolver.js'),
      'utf8',
    )
    expect(source).not.toMatch(/node:child_process|from ['"]https?:|globalThis\.fetch/)
  })
})

function skillMetadataV2(
  directory,
  { name = 'aws-iam', origin = 'ramp', ownerPack } = {},
) {
  writeFileSync(
    join(directory, 'skill.yaml'),
    [
      'schemaVersion: 2',
      'kind: ramp-skill',
      `name: ${name}`,
      `origin: ${origin}`,
      ...(origin === 'upstream' ? [] : ['version: 1.2.3', 'license: MIT-0']),
      ...(ownerPack === undefined ? [] : [`ownerPack: ${ownerPack}`]),
      'classification:',
      '  useCases: []',
      '',
    ].join('\n'),
  )
}

function resolveFor(resolver, state, name, packId = 'demo-pack') {
  return resolver.resolveSkill(name, { packDir: state.packDir, packId })
}

function failureOf(action) {
  try {
    action()
  } catch (error) {
    return error.message
  }
  throw new Error('expected the action to fail')
}

describe('createSkillResolver skills/ root', () => {
  let printed

  beforeEach(() => {
    printed = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    printed.mockRestore()
  })

  function warnings() {
    return printed.mock.calls.map(([message]) => message)
  }

  function skillsSkill(state, name = 'aws-iam') {
    return writeTree(join(state.repoRoot, 'skills', name), [
      { path: 'SKILL.md', bytes: `# ${name}\n`, executable: false },
    ])
  }

  it('resolves origin ramp from skills/<slug>/ with declared provenance', () => {
    const state = fixture()
    const directory = skillsSkill(state)
    skillMetadataV2(directory)
    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(directory)
    expect(resolved.provenance).toMatchObject({
      kind: 'ramp',
      attribution: 'declared',
      name: 'aws-iam',
      version: '1.2.3',
      license: 'MIT-0',
      treeSha256: hashSkillTree(directory).treeSha256,
    })
    expect(warnings()).toEqual([])
  })

  it('reads a schemaVersion 1 skill.yaml in skills/ as origin ramp', () => {
    const state = fixture()
    const directory = skillsSkill(state)
    metadata(directory)
    const resolved = resolveAwsIam(resolverFor(state, { strictProvenance: true }), state)
    expect(resolved.directory).toBe(directory)
    expect(resolved.provenance).toMatchObject({ kind: 'ramp', attribution: 'declared' })
  })

  it('resolves origin upstream from the verified cache before the in-tree mirror', () => {
    const state = fixture()
    const mirror = writeTree(join(state.repoRoot, 'skills', 'aws-iam'))
    const entry = lockedEntry(mirror)
    skillMetadataV2(mirror, { origin: 'upstream' })
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const cached = writeTree(cacheSkill(state.cacheDir, entry))
    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(cached)
    expect(resolved.provenance).toMatchObject({ kind: 'upstream', attribution: 'locked' })
    expect(warnings()).toEqual([])
  })

  it('resolves origin upstream from the in-tree mirror without a cache, with the cache provenance', () => {
    const state = fixture()
    const mirror = writeTree(join(state.repoRoot, 'skills', 'aws-iam'))
    const entry = lockedEntry(mirror)
    skillMetadataV2(mirror, { origin: 'upstream' })
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const resolver = resolverFor(state, { strictProvenance: true, allowLegacyLocal: false })
    const fromMirror = resolveAwsIam(resolver, state)
    expect(fromMirror.directory).toBe(mirror)

    writeTree(cacheSkill(state.cacheDir, entry))
    expect(fromMirror.provenance).toEqual(resolveAwsIam(resolver, state).provenance)
    expect(warnings()).toEqual([])
  })

  it('fails an upstream mirror that differs from the lock with the sync remediation', () => {
    const state = fixture()
    const mirror = writeTree(join(state.repoRoot, 'skills', 'aws-iam'))
    const entry = lockedEntry(mirror)
    skillMetadataV2(mirror, { origin: 'upstream' })
    writeLock(state.repoRoot, [['aws-iam', entry]])
    writeFileSync(join(mirror, 'references', 'guide.md'), 'drift')
    expect(failureOf(() => resolveAwsIam(resolverFor(state), state))).toMatch(
      /^upstream skill aws-iam differs from the lock; run ramp-pack skills sync --locked \(.*references\/guide\.md sha256 mismatch\)$/,
    )
  })

  it('fails origin upstream without a lock entry', () => {
    const state = fixture()
    const mirror = skillsSkill(state)
    skillMetadataV2(mirror, { origin: 'upstream' })
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      'upstream skill aws-iam has no entry in dependencies/skills.lock.yaml',
    )
  })

  it('allows origin local with a warning and rejects it under strict provenance', () => {
    const state = fixture()
    const directory = skillsSkill(state, 'origin-local-skill')
    skillMetadataV2(directory, { name: 'origin-local-skill', origin: 'local' })
    const resolved = resolveFor(resolverFor(state), state, 'origin-local-skill')
    expect(resolved.directory).toBe(directory)
    expect(resolved.provenance).toMatchObject({
      kind: 'local',
      attribution: 'declared',
      name: 'origin-local-skill',
    })
    expect(warnings()).toEqual([
      'warning: skill origin-local-skill has origin: local and is not locked; release bundles reject it',
    ])

    expect(() => resolveFor(
      resolverFor(state, { strictProvenance: true, allowLegacyLocal: false }),
      state,
      'origin-local-skill',
    )).toThrow(`strict provenance rejects local skill origin-local-skill: ${directory}`)
    expect(() => resolveFor(
      resolverFor(state, { allowLegacyLocal: false }),
      state,
      'origin-local-skill',
    )).toThrow('local skill origin-local-skill is not allowed by allowLegacyLocal')
  })

  it('requires skill.yaml in skills/<slug>/', () => {
    const state = fixture()
    const directory = skillsSkill(state)
    expect(() => resolveAwsIam(resolverFor(state), state)).toThrow(
      `skill aws-iam in skills/ requires skill.yaml: ${join(directory, 'skill.yaml')}`,
    )
  })

  it.each([
    ['packs/demo-pack/skills/aws-iam', (state) => {
      metadata(writeTree(join(state.packDir, 'skills', 'aws-iam')), { ownerPack: 'demo-pack' })
    }],
    ['skills/ramp/aws-iam', (state) => {
      metadata(writeTree(join(state.rampDir, 'aws-iam')))
    }],
    ['skills-library/aws-iam', (state) => {
      writeTree(join(state.libraryDir, 'aws-iam'))
    }],
  ])('fails a slug in both skills/ and %s, naming both paths', (oldPath, arrange) => {
    const state = fixture()
    skillMetadataV2(skillsSkill(state))
    arrange(state)
    expect(failureOf(() => resolveAwsIam(resolverFor(state), state))).toBe(
      `skill aws-iam is ambiguous: found in skills/aws-iam and ${oldPath}; keep only one copy`,
    )
  })

  it('prints one line per old copy when a slug is in several old roots', () => {
    const state = fixture()
    skillMetadataV2(skillsSkill(state))
    metadata(writeTree(join(state.rampDir, 'aws-iam')))
    writeTree(join(state.libraryDir, 'aws-iam'))
    expect(failureOf(() => resolveAwsIam(resolverFor(state), state))).toBe(
      [
        'skill aws-iam is ambiguous: found in skills/aws-iam and skills/ramp/aws-iam; keep only one copy',
        'skill aws-iam is ambiguous: found in skills/aws-iam and skills-library/aws-iam; keep only one copy',
      ].join('\n'),
    )
  })

  it('does not let the locked cache trip the ambiguity guard', () => {
    const state = fixture()
    const mirror = writeTree(join(state.repoRoot, 'skills', 'aws-iam'))
    const entry = lockedEntry(mirror)
    skillMetadataV2(mirror, { origin: 'upstream' })
    writeLock(state.repoRoot, [['aws-iam', entry]])
    const cached = writeTree(cacheSkill(state.cacheDir, entry))
    expect(resolveAwsIam(resolverFor(state), state).directory).toBe(cached)
  })

  it.each(['ramp', 'README.md', 'taxonomy'])('refuses the reserved slug %s', (name) => {
    const state = fixture()
    metadata(writeTree(join(state.rampDir, 'ramp')), { name: 'ramp' })
    expect(() => resolveFor(resolverFor(state), state, name)).toThrow(
      `skill name ${name} is reserved: ramp, README.md and taxonomy cannot be skill names`,
    )
  })

  it('resolves an ownerPack skill for its owner pack only', () => {
    const state = fixture()
    const directory = skillsSkill(state)
    skillMetadataV2(directory, { ownerPack: 'demo-pack' })
    const resolved = resolveAwsIam(resolverFor(state), state)
    expect(resolved.directory).toBe(directory)
    expect(resolved.provenance).toMatchObject({ kind: 'ramp', ownerPack: 'demo-pack' })

    for (const options of [{}, { strictProvenance: true, allowLegacyLocal: false }]) {
      expect(() => resolveFor(resolverFor(state, options), state, 'aws-iam', 'other-pack'))
        .toThrow('skill aws-iam belongs to pack demo-pack; pack other-pack cannot use it')
    }
  })

  it.each([
    ['a pack override', 'warn-pack-skill', 'packs/demo-pack/skills/warn-pack-skill', (state, name) => {
      metadata(writeTree(join(state.packDir, 'skills', name)), { name, ownerPack: 'demo-pack' })
    }],
    ['skills/ramp/', 'warn-ramp-skill', 'skills/ramp/warn-ramp-skill', (state, name) => {
      metadata(writeTree(join(state.rampDir, name)), { name })
    }],
    ['a locked skills-library mirror', 'warn-mirror-skill', 'skills-library/warn-mirror-skill', (state, name) => {
      const mirror = writeTree(join(state.libraryDir, name))
      writeLock(state.repoRoot, [[name, lockedEntry(mirror, { name })]])
    }],
    ['a legacy skills-library skill', 'warn-legacy-skill', 'skills-library/warn-legacy-skill', (state, name) => {
      writeTree(join(state.libraryDir, name))
    }],
  ])('warns once when %s resolves a skill', (_label, name, oldPath, arrange) => {
    const state = fixture()
    arrange(state, name)
    resolveFor(resolverFor(state), state, name)
    resolveFor(resolverFor(state), state, name)
    expect(warnings()).toEqual([
      `warning: skill ${name} resolved from ${oldPath}; move it to skills/${name}/`,
    ])
  })

  it('names old-root paths relative to the source tree when the contracts live elsewhere', () => {
    const state = fixture()
    metadata(writeTree(join(state.rampDir, 'warn-release-skill')), { name: 'warn-release-skill' })
    // Release resolves against a temporary root that holds only dependencies/.
    const contractRoot = mkdtempSync(join(tmpdir(), 'ramp-resolver-contracts-'))
    roots.push(contractRoot)
    cpSync(join(state.repoRoot, 'dependencies'), join(contractRoot, 'dependencies'), {
      recursive: true,
    })
    const resolver = resolverFor(state, {
      repoRoot: contractRoot,
      skillsDir: join(state.repoRoot, 'skills'),
    })
    resolveFor(resolver, state, 'warn-release-skill')
    expect(warnings()).toEqual([
      'warning: skill warn-release-skill resolved from skills/ramp/warn-release-skill; move it to skills/warn-release-skill/',
    ])
  })

  it('prints no deprecation warning for a locked cache hit', () => {
    const state = fixture()
    const mirror = writeTree(join(state.libraryDir, 'warn-cache-skill'))
    const entry = lockedEntry(mirror, { name: 'warn-cache-skill' })
    writeLock(state.repoRoot, [['warn-cache-skill', entry]])
    writeTree(cacheSkill(state.cacheDir, entry))
    resolveFor(resolverFor(state), state, 'warn-cache-skill')
    expect(warnings()).toEqual([])
  })
})
