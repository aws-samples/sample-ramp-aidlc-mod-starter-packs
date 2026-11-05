import {
  chmodSync,
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
import { afterEach, describe, expect, it } from 'vitest'
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
