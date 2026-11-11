import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'
import { describe, expect, it } from 'vitest'
import {
  loadRampSkillMetadata,
  loadSkillLock,
  loadSkillSources,
  writeSkillLock,
} from '../src/dependencies/manifests.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const commit = 'a'.repeat(40)
const treeSha256 = 'b'.repeat(64)
const fileSha256 = 'c'.repeat(64)
const licenseSha256 = 'd'.repeat(64)
const noticeSha256 = 'e'.repeat(64)

const sourceRegistry = {
  schemaVersion: 1,
  sources: [
    {
      id: 'agent-toolkit-for-aws',
      repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
      priority: 10,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      noticePath: 'NOTICE',
    },
    {
      id: 'agent-plugins',
      repository: 'https://github.com/awslabs/agent-plugins.git',
      priority: 20,
      license: 'Apache-2.0',
      licensePath: 'LICENSE',
      noticePath: 'NOTICE',
    },
  ],
}

function withTempRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-dependency-manifests-'))
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function writeYaml(root, path, value) {
  const absolute = join(root, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, stringify(value, { lineWidth: 0 }))
  return absolute
}

function writeSources(root, value = sourceRegistry) {
  return writeYaml(root, 'dependencies/skills.sources.yaml', value)
}

function skillEntry(overrides = {}) {
  return {
    name: 'aws-iam',
    source: 'agent-toolkit-for-aws',
    commit,
    path: 'skills/core-skills/aws-iam',
    treeSha256,
    files: [
      {
        path: 'SKILL.md',
        sha256: fileSha256,
        size: 1234,
        executable: false,
      },
    ],
    license: 'Apache-2.0',
    licensePath: 'LICENSE',
    licenseFile: {
      path: 'LICENSE',
      sha256: licenseSha256,
      size: 11357,
      executable: false,
    },
    noticePath: 'NOTICE',
    noticeFile: {
      path: 'NOTICE',
      sha256: noticeSha256,
      size: 314,
      executable: false,
    },
    ...overrides,
  }
}

function writeLock(root, skills = [skillEntry()], overrides = {}) {
  return writeYaml(root, 'dependencies/skills.lock.yaml', {
    schemaVersion: 1,
    skills,
    ...overrides,
  })
}

function writeRampSkill(root, metadata, { skill = true } = {}) {
  if (skill) writeFileSync(join(root, 'SKILL.md'), '# Skill\n')
  writeYaml(root, 'skill.yaml', metadata)
}

function rampMetadata(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'ramp-skill',
    name: 'custom-skill',
    version: '1.2.3',
    license: 'MIT-0',
    ...overrides,
  }
}

describe('loadSkillSources', () => {
  it('loads the committed registry in normalized priority order', () => {
    const result = loadSkillSources(repoRoot)

    expect(result.schemaVersion).toBe(1)
    expect(result.sources).toEqual(sourceRegistry.sources)
    expect([...result.byId.keys()]).toEqual([
      'agent-toolkit-for-aws',
      'agent-plugins',
    ])
    expect(result.byId.get('agent-plugins').repository).toBe(
      'https://github.com/awslabs/agent-plugins.git',
    )
  })

  it('commits the exact source registry bytes', () => {
    expect(
      readFileSync(
        join(repoRoot, 'dependencies', 'skills.sources.yaml'),
        'utf8',
      ),
    ).toBe([
      'schemaVersion: 1',
      'sources:',
      '  - id: agent-toolkit-for-aws',
      '    repository: https://github.com/aws/agent-toolkit-for-aws.git',
      '    priority: 10',
      '    license: Apache-2.0',
      '    licensePath: LICENSE',
      '    noticePath: NOTICE',
      '  - id: agent-plugins',
      '    repository: https://github.com/awslabs/agent-plugins.git',
      '    priority: 20',
      '    license: Apache-2.0',
      '    licensePath: LICENSE',
      '    noticePath: NOTICE',
      '',
    ].join('\n'))
  })

  it('normalizes equal-priority sources by direct ID order', () => {
    withTempRoot((root) => {
      writeSources(root, {
        schemaVersion: 1,
        sources: [
          { ...sourceRegistry.sources[1], priority: 10, id: 'z-source' },
          { ...sourceRegistry.sources[0], id: 'a-source' },
        ],
      })

      expect(loadSkillSources(root).sources.map(({ id }) => id)).toEqual([
        'a-source',
        'z-source',
      ])
    })
  })

  it.each([
    ['non-object root', [], /object/i],
    ['unsupported schema', { ...sourceRegistry, schemaVersion: 2 }, /schemaVersion/i],
    ['unknown root field', { ...sourceRegistry, extra: true }, /unknown.*extra/i],
    ['non-array sources', { ...sourceRegistry, sources: {} }, /sources.*array/i],
    [
      'duplicate IDs',
      { ...sourceRegistry, sources: [sourceRegistry.sources[0], sourceRegistry.sources[0]] },
      /duplicate.*agent-toolkit/i,
    ],
    [
      'invalid ID',
      {
        ...sourceRegistry,
        sources: [{ ...sourceRegistry.sources[0], id: 'Agent_Toolkit' }],
      },
      /id/i,
    ],
    [
      'HTTP URL',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'http://github.com/aws/agent-toolkit-for-aws.git',
        }],
      },
      /repository/i,
    ],
    [
      'non-GitHub URL',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://example.com/aws/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'URL without .git',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/aws/agent-toolkit-for-aws',
        }],
      },
      /repository/i,
    ],
    [
      'URL query',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/aws/repo.git?ref=main',
        }],
      },
      /repository/i,
    ],
    [
      'URL fragment',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/aws/repo.git#readme',
        }],
      },
      /repository/i,
    ],
    [
      'SSH-like URL',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'git@github.com:aws/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'URL credentials',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://user:secret@github.com/aws/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'URL port',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com:443/aws/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'GitHub host spoofing',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com.evil.example/aws/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'literal owner traversal',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/../repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'literal repository traversal',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/aws/...git',
        }],
      },
      /repository/i,
    ],
    [
      'encoded traversal',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com/%2e%2e/repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'empty owner component',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          repository: 'https://github.com//repo.git',
        }],
      },
      /repository/i,
    ],
    [
      'negative priority',
      {
        ...sourceRegistry,
        sources: [{ ...sourceRegistry.sources[0], priority: -1 }],
      },
      /priority/i,
    ],
    [
      'fractional priority',
      {
        ...sourceRegistry,
        sources: [{ ...sourceRegistry.sources[0], priority: 1.5 }],
      },
      /priority/i,
    ],
    [
      'unsafe priority integer',
      {
        ...sourceRegistry,
        sources: [{
          ...sourceRegistry.sources[0],
          priority: Number.MAX_SAFE_INTEGER + 1,
        }],
      },
      /priority/i,
    ],
    [
      'unsafe license path',
      {
        ...sourceRegistry,
        sources: [{ ...sourceRegistry.sources[0], licensePath: '../LICENSE' }],
      },
      /licensePath/i,
    ],
    [
      'unknown source field',
      {
        ...sourceRegistry,
        sources: [{ ...sourceRegistry.sources[0], branch: 'main' }],
      },
      /unknown.*branch/i,
    ],
  ])('rejects %s', (_name, value, message) => {
    withTempRoot((root) => {
      writeSources(root, value)
      expect(() => loadSkillSources(root)).toThrow(message)
    })
  })
})

describe('loadSkillLock', () => {
  it('returns null only when the absent lock is optional', () => {
    withTempRoot((root) => {
      expect(loadSkillLock(root)).toBeNull()
      expect(() => loadSkillLock(root, { required: true })).toThrow(/lock/i)
    })
  })

  it.runIf(process.platform !== 'win32')(
    'fails closed when the lock path is a dangling symbolic link',
    () => {
      withTempRoot((root) => {
        const lockPath = join(root, 'dependencies', 'skills.lock.yaml')
        mkdirSync(dirname(lockPath), { recursive: true })
        symlinkSync('missing-lock.yaml', lockPath)

        expect(() => loadSkillLock(root)).toThrow(/symbolic link|regular file/i)
      })
    },
  )

  it('rejects an existing lock path that is not a regular file', () => {
    withTempRoot((root) => {
      mkdirSync(join(root, 'dependencies', 'skills.lock.yaml'), {
        recursive: true,
      })

      expect(() => loadSkillLock(root)).toThrow(/regular file/i)
    })
  })

  it('validates, enriches, and preserves sorted file metadata', () => {
    withTempRoot((root) => {
      writeSources(root)
      writeLock(root)

      const lock = loadSkillLock(root, { required: true })
      expect(lock.schemaVersion).toBe(1)
      expect([...lock.skills.keys()]).toEqual(['aws-iam'])
      expect(lock.skills.get('aws-iam')).toEqual({
        ...skillEntry(),
        repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
      })
      expect(lock.skills.get('aws-iam')).not.toHaveProperty('bytes')
      expect(lock.skills.get('aws-iam').licenseFile).not.toBe(
        skillEntry().licenseFile,
      )
      expect(lock.skills.get('aws-iam').noticeFile).not.toBe(
        skillEntry().noticeFile,
      )
    })
  })

  it.each([
    ['non-object root', [], /object/i],
    ['unsupported schema', { schemaVersion: 2, skills: [] }, /schemaVersion/i],
    ['unknown root field', { schemaVersion: 1, skills: [], extra: true }, /unknown.*extra/i],
    ['non-array skills', { schemaVersion: 1, skills: {} }, /skills.*array/i],
    [
      'duplicate skill names',
      { schemaVersion: 1, skills: [skillEntry(), skillEntry()] },
      /duplicate.*aws-iam/i,
    ],
    [
      'unsorted skill names',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({ name: 'z-skill' }),
          skillEntry({ name: 'a-skill' }),
        ],
      },
      /sorted/i,
    ],
    [
      'unknown source',
      {
        schemaVersion: 1,
        skills: [skillEntry({ source: 'unknown-source' })],
      },
      /source/i,
    ],
    [
      'uppercase commit',
      { schemaVersion: 1, skills: [skillEntry({ commit: 'A'.repeat(40) })] },
      /commit/i,
    ],
    [
      'short commit',
      { schemaVersion: 1, skills: [skillEntry({ commit: 'a'.repeat(39) })] },
      /commit/i,
    ],
    [
      'unsafe skill path',
      { schemaVersion: 1, skills: [skillEntry({ path: '../skill' })] },
      /path/i,
    ],
    [
      'uppercase tree hash',
      { schemaVersion: 1, skills: [skillEntry({ treeSha256: 'B'.repeat(64) })] },
      /treeSha256/i,
    ],
    [
      'duplicate file paths',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [skillEntry().files[0], skillEntry().files[0]],
          }),
        ],
      },
      /duplicate.*file/i,
    ],
    [
      'empty skill file closure',
      {
        schemaVersion: 1,
        skills: [skillEntry({ files: [] })],
      },
      /SKILL\.md|file closure/i,
    ],
    [
      'skill file closure without root SKILL.md',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], path: 'README.md' }],
          }),
        ],
      },
      /SKILL\.md|file closure/i,
    ],
    [
      'unsorted file paths',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [
              { ...skillEntry().files[0], path: 'z' },
              { ...skillEntry().files[0], path: 'a' },
            ],
          }),
        ],
      },
      /sorted/i,
    ],
    [
      'unsafe file path',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], path: '../SKILL.md' }],
          }),
        ],
      },
      /file.*path/i,
    ],
    [
      'uppercase file hash',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], sha256: 'C'.repeat(64) }],
          }),
        ],
      },
      /sha256/i,
    ],
    [
      'negative file size',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], size: -1 }],
          }),
        ],
      },
      /size/i,
    ],
    [
      'fractional file size',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], size: 1.5 }],
          }),
        ],
      },
      /size/i,
    ],
    [
      'unsafe file size integer',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{
              ...skillEntry().files[0],
              size: Number.MAX_SAFE_INTEGER + 1,
            }],
          }),
        ],
      },
      /size/i,
    ],
    [
      'non-boolean executable',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], executable: 1 }],
          }),
        ],
      },
      /executable/i,
    ],
    [
      'source license mismatch',
      {
        schemaVersion: 1,
        skills: [skillEntry({ license: 'MIT' })],
      },
      /license.*source|source.*license/i,
    ],
    [
      'source path mismatch',
      {
        schemaVersion: 1,
        skills: [skillEntry({ noticePath: 'OTHER-NOTICE' })],
      },
      /noticePath.*source|source.*noticePath/i,
    ],
    [
      'missing license file record',
      {
        schemaVersion: 1,
        skills: [(() => {
          const entry = skillEntry()
          delete entry.licenseFile
          return entry
        })()],
      },
      /licenseFile.*missing|required/i,
    ],
    [
      'missing notice file record',
      {
        schemaVersion: 1,
        skills: [(() => {
          const entry = skillEntry()
          delete entry.noticeFile
          return entry
        })()],
      },
      /noticeFile.*missing|required/i,
    ],
    [
      'unknown license file field',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            licenseFile: { ...skillEntry().licenseFile, bytes: 'forbidden' },
          }),
        ],
      },
      /licenseFile.*unknown.*bytes|unknown.*bytes/i,
    ],
    [
      'wrong notice file type',
      {
        schemaVersion: 1,
        skills: [skillEntry({ noticeFile: 'NOTICE' })],
      },
      /noticeFile.*object/i,
    ],
    [
      'unsafe source file path',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            licensePath: '../LICENSE',
            licenseFile: { ...skillEntry().licenseFile, path: '../LICENSE' },
          }),
        ],
      },
      /licensePath|licenseFile.*path/i,
    ],
    [
      'source file hash',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            noticeFile: { ...skillEntry().noticeFile, sha256: 'E'.repeat(64) },
          }),
        ],
      },
      /noticeFile.*sha256|sha256/i,
    ],
    [
      'source file size',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            noticeFile: { ...skillEntry().noticeFile, size: -1 },
          }),
        ],
      },
      /noticeFile.*size|size/i,
    ],
    [
      'source file executable type',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            noticeFile: { ...skillEntry().noticeFile, executable: 0 },
          }),
        ],
      },
      /noticeFile.*executable|executable/i,
    ],
    [
      'license file path disagreement',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            licenseFile: { ...skillEntry().licenseFile, path: 'COPYING' },
          }),
        ],
      },
      /licenseFile.*licensePath|licensePath.*licenseFile/i,
    ],
    [
      'notice file path disagreement',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            noticeFile: { ...skillEntry().noticeFile, path: 'OTHER-NOTICE' },
          }),
        ],
      },
      /noticeFile.*noticePath|noticePath.*noticeFile/i,
    ],
    [
      'unknown skill field',
      {
        schemaVersion: 1,
        skills: [skillEntry({ repository: 'https://github.com/x/y.git' })],
      },
      /unknown.*repository/i,
    ],
    [
      'unknown file field',
      {
        schemaVersion: 1,
        skills: [
          skillEntry({
            files: [{ ...skillEntry().files[0], bytes: 'forbidden' }],
          }),
        ],
      },
      /unknown.*bytes/i,
    ],
  ])('rejects %s', (_name, lockValue, message) => {
    withTempRoot((root) => {
      writeSources(root)
      writeYaml(root, 'dependencies/skills.lock.yaml', lockValue)
      expect(() => loadSkillLock(root, { required: true })).toThrow(message)
    })
  })

  it('rejects conflicting source-file records within one source commit', () => {
    withTempRoot((root) => {
      writeSources(root)
      writeLock(root, [
        skillEntry({ name: 'a-skill', path: 'skills/a-skill' }),
        skillEntry({
          name: 'z-skill',
          path: 'skills/z-skill',
          noticeFile: { ...skillEntry().noticeFile, sha256: 'f'.repeat(64) },
        }),
      ])

      expect(() => loadSkillLock(root, { required: true })).toThrow(
        /source.*commit.*notice|notice.*source.*commit|disagree/i,
      )
    })
  })

  it('rejects duplicate source commit path claims', () => {
    withTempRoot((root) => {
      writeSources(root)
      writeLock(root, [
        skillEntry({ name: 'a-skill' }),
        skillEntry({ name: 'z-skill' }),
      ])

      expect(() => loadSkillLock(root, { required: true })).toThrow(
        /duplicate.*source.*commit.*path|claim/i,
      )
    })
  })

  it('rejects conflicting overlapping source coordinates', () => {
    withTempRoot((root) => {
      writeSources(root)
      writeLock(root, [
        skillEntry({
          name: 'a-skill',
          path: 'skills/a-skill',
          files: [{
            path: 'NOTICE',
            sha256: fileSha256,
            size: 1234,
            executable: false,
          }, {
            path: 'SKILL.md',
            sha256: fileSha256,
            size: 1234,
            executable: false,
          }],
        }),
        skillEntry({
          name: 'z-skill',
          path: 'skills',
          files: [{
            path: 'SKILL.md',
            sha256: fileSha256,
            size: 1234,
            executable: false,
          }, {
            path: 'a-skill/NOTICE',
            sha256: 'f'.repeat(64),
            size: 1234,
            executable: false,
          }],
        }),
      ])

      expect(() => loadSkillLock(root, { required: true })).toThrow(
        /coordinate.*conflict|conflicting.*coordinate/i,
      )
    })
  })
})

describe('writeSkillLock', () => {
  function normalizedEntry(name, path, filePaths) {
    const hashDigit = { 'SKILL.md': '0', a: '1', b: '2', z: '3' }
    const completePaths = filePaths.includes('SKILL.md')
      ? filePaths
      : ['SKILL.md', ...filePaths]
    return {
      ...skillEntry({
        name,
        path,
        files: completePaths.map((filePath) => ({
          path: filePath,
          sha256: hashDigit[filePath].repeat(64),
          size: filePath.charCodeAt(0),
          executable: filePath === 'a',
        })),
      }),
      repository: 'https://github.com/aws/agent-toolkit-for-aws.git',
    }
  }

  it('serializes maps deterministically across insertion order, locale, and time zone', () => {
    const oldTimezone = process.env.TZ
    const oldLanguage = process.env.LANG
    const oldLocale = process.env.LC_ALL
    try {
      const bytes = []
      for (const [timezone, language, locale, entries] of [
        ['Pacific/Honolulu', 'en_US.UTF-8', 'C', [
          ['z-skill', normalizedEntry('z-skill', 'skills/z', ['z', 'a'])],
          ['a-skill', normalizedEntry('a-skill', 'skills/a', ['b', 'a'])],
        ]],
        ['Asia/Singapore', 'de_DE.UTF-8', 'C.UTF-8', [
          ['a-skill', normalizedEntry('a-skill', 'skills/a', ['a', 'b'])],
          ['z-skill', normalizedEntry('z-skill', 'skills/z', ['a', 'z'])],
        ]],
      ]) {
        process.env.TZ = timezone
        process.env.LANG = language
        process.env.LC_ALL = locale
        withTempRoot((root) => {
          writeSources(root)
          const path = writeSkillLock(root, {
            schemaVersion: 1,
            skills: new Map(entries),
          })
          expect(path).toBe(join(root, 'dependencies', 'skills.lock.yaml'))
          bytes.push(readFileSync(path, 'utf8'))
        })
      }

      expect(bytes[1]).toBe(bytes[0])
      expect(bytes[0]).not.toContain('\r')
      expect(bytes[0].endsWith('\n')).toBe(true)
      expect(bytes[0].endsWith('\n\n')).toBe(false)
      expect(bytes[0]).not.toContain('repository:')
      expect(bytes[0]).toContain('licenseFile:')
      expect(bytes[0]).toContain('noticeFile:')
      expect(bytes[0]).not.toMatch(/[&*][A-Za-z0-9_-]+/)
      expect(bytes[0].indexOf('name: a-skill'))
        .toBeLessThan(bytes[0].indexOf('name: z-skill'))
      const parsed = parse(bytes[0])
      expect(parsed.skills[0].files.map(({ path }) => path)).toEqual([
        'SKILL.md',
        'a',
        'b',
      ])
      expect(parsed.skills[1].files.map(({ path }) => path)).toEqual([
        'SKILL.md',
        'a',
        'z',
      ])
    } finally {
      if (oldTimezone === undefined) delete process.env.TZ
      else process.env.TZ = oldTimezone
      if (oldLanguage === undefined) delete process.env.LANG
      else process.env.LANG = oldLanguage
      if (oldLocale === undefined) delete process.env.LC_ALL
      else process.env.LC_ALL = oldLocale
    }
  })

  it('does not emit YAML anchors for shared input object references', () => {
    withTempRoot((root) => {
      writeSources(root)
      const sharedFiles = skillEntry().files
      const first = normalizedEntry('a-skill', 'skills/a', [])
      const second = normalizedEntry('z-skill', 'skills/z', [])
      first.files = sharedFiles
      second.files = sharedFiles

      const path = writeSkillLock(root, {
        schemaVersion: 1,
        skills: new Map([
          ['a-skill', first],
          ['z-skill', second],
        ]),
      })
      const bytes = readFileSync(path, 'utf8')

      expect(bytes).not.toMatch(/[&*][A-Za-z0-9_-]+/)
      expect(parse(bytes).skills).toHaveLength(2)
    })
  })

  it('requires the normalized repository and rejects source spoofing', () => {
    withTempRoot((root) => {
      writeSources(root)
      const missing = normalizedEntry('a-skill', 'skills/a', ['a'])
      delete missing.repository
      expect(() =>
        writeSkillLock(root, {
          schemaVersion: 1,
          skills: new Map([['a-skill', missing]]),
        }),
      ).toThrow(/repository/i)

      const spoofed = normalizedEntry('a-skill', 'skills/a', ['a'])
      spoofed.repository = 'https://github.com/attacker/spoof.git'
      expect(() =>
        writeSkillLock(root, {
          schemaVersion: 1,
          skills: new Map([['a-skill', spoofed]]),
        }),
      ).toThrow(/repository/i)
    })
  })

  it.each([
    ['an empty file closure', []],
    ['a file closure without root SKILL.md', [{
      path: 'README.md',
      sha256: 'f'.repeat(64),
      size: 9,
      executable: false,
    }]],
  ])('rejects %s without modifying the destination', (_description, files) => {
    withTempRoot((root) => {
      writeSources(root)
      const destination = writeSkillLock(root, {
        schemaVersion: 1,
        skills: new Map([
          ['a-skill', normalizedEntry('a-skill', 'skills/a', ['a'])],
        ]),
      })
      const before = readFileSync(destination)
      const invalid = normalizedEntry('a-skill', 'skills/a', ['a'])
      invalid.files = files

      expect(() =>
        writeSkillLock(root, {
          schemaVersion: 1,
          skills: new Map([['a-skill', invalid]]),
        }),
      ).toThrow(/file closure.*SKILL\.md|SKILL\.md.*file closure/i)
      expect(readFileSync(destination)).toEqual(before)
    })
  })

  it('enforces source agreement and coordinate claims before writing', () => {
    withTempRoot((root) => {
      writeSources(root)
      const first = normalizedEntry('a-skill', 'skills/shared', ['a'])
      const second = normalizedEntry('z-skill', 'skills/shared', ['z'])
      second.noticeFile = {
        ...second.noticeFile,
        sha256: 'f'.repeat(64),
      }

      expect(() =>
        writeSkillLock(root, {
          schemaVersion: 1,
          skills: new Map([
            ['a-skill', first],
            ['z-skill', second],
          ]),
        }),
      ).toThrow(/source.*commit.*notice|notice.*source.*commit|disagree|claim/i)
    })
  })
})

describe('loadRampSkillMetadata', () => {
  it('loads a RAMP-owned skill without ownerPack', () => {
    withTempRoot((root) => {
      writeRampSkill(root, rampMetadata({
        basedOn: {
          source: 'agent-toolkit-for-aws',
          commit,
          path: 'skills/core-skills/aws-iam',
        },
      }))

      expect(
        loadRampSkillMetadata(root, { expectedName: 'custom-skill' }),
      ).toEqual(rampMetadata({
        basedOn: {
          source: 'agent-toolkit-for-aws',
          commit,
          path: 'skills/core-skills/aws-iam',
        },
      }))
    })
  })

  it('requires the exact ownerPack for pack-local overrides', () => {
    withTempRoot((root) => {
      writeRampSkill(root, rampMetadata({ ownerPack: 'qa-automated-testing' }))

      expect(
        loadRampSkillMetadata(root, {
          expectedName: 'custom-skill',
          ownerPack: 'qa-automated-testing',
        }),
      ).toMatchObject({ ownerPack: 'qa-automated-testing' })
      expect(() =>
        loadRampSkillMetadata(root, {
          expectedName: 'custom-skill',
          ownerPack: 'another-pack',
        }),
      ).toThrow(/ownerPack/i)
    })
  })

  it('requires both SKILL.md and skill.yaml', () => {
    withTempRoot((root) => {
      writeRampSkill(root, rampMetadata(), { skill: false })
      expect(() => loadRampSkillMetadata(root)).toThrow(/SKILL\.md/i)
    })
    withTempRoot((root) => {
      writeFileSync(join(root, 'SKILL.md'), '# Skill\n')
      expect(() => loadRampSkillMetadata(root)).toThrow(/skill\.yaml/i)
    })
  })

  it.each([
    ['unsupported schema', rampMetadata({ schemaVersion: 2 }), /schemaVersion/i],
    ['wrong kind', rampMetadata({ kind: 'upstream-skill' }), /kind/i],
    ['invalid name', rampMetadata({ name: 'Bad_Name' }), /name/i],
    ['invalid SemVer', rampMetadata({ version: 'latest' }), /version/i],
    ['empty license', rampMetadata({ license: '' }), /license/i],
    ['unknown field', rampMetadata({ extra: true }), /unknown.*extra/i],
    [
      'unknown basedOn field',
      rampMetadata({
        basedOn: {
          source: 'agent-toolkit-for-aws',
          commit,
          path: 'skill',
          repository: 'forbidden',
        },
      }),
      /unknown.*repository/i,
    ],
    [
      'unsafe basedOn path',
      rampMetadata({
        basedOn: {
          source: 'agent-toolkit-for-aws',
          commit,
          path: '../skill',
        },
      }),
      /path/i,
    ],
    [
      'uppercase basedOn commit',
      rampMetadata({
        basedOn: {
          source: 'agent-toolkit-for-aws',
          commit: 'A'.repeat(40),
          path: 'skill',
        },
      }),
      /commit/i,
    ],
    ['RAMP-owned ownerPack', rampMetadata({ ownerPack: 'some-pack' }), /ownerPack/i],
  ])('rejects %s', (_name, metadata, message) => {
    withTempRoot((root) => {
      writeRampSkill(root, metadata)
      expect(() =>
        loadRampSkillMetadata(root, { expectedName: 'custom-skill' }),
      ).toThrow(message)
    })
  })

  it('rejects a mismatched expected name and a missing override owner', () => {
    withTempRoot((root) => {
      writeRampSkill(root, rampMetadata())
      expect(() =>
        loadRampSkillMetadata(root, { expectedName: 'different-skill' }),
      ).toThrow(/expectedName|name/i)
      expect(() =>
        loadRampSkillMetadata(root, { ownerPack: 'some-pack' }),
      ).toThrow(/ownerPack/i)
    })
  })
})

describe('published dependency contracts', () => {
  it('publishes matching draft 2020-12 schemas with closed objects', () => {
    const sources = JSON.parse(
      readFileSync(join(repoRoot, 'schemas', 'skill-sources-v1.schema.json')),
    )
    const lock = JSON.parse(
      readFileSync(join(repoRoot, 'schemas', 'skill-lock-v1.schema.json')),
    )
    const ramp = JSON.parse(
      readFileSync(join(repoRoot, 'schemas', 'ramp-skill-v1.schema.json')),
    )

    for (const schema of [sources, lock, ramp]) {
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      )
      expect(schema.additionalProperties).toBe(false)
    }
    expect(sources.required).toEqual(['schemaVersion', 'sources'])
    expect(sources.properties.sources.items.additionalProperties).toBe(false)
    expect(lock.required).toEqual(['schemaVersion', 'skills'])
    expect(lock.properties.skills.items.required).toContain('files')
    expect(lock.properties.skills.items.required).toContain('licenseFile')
    expect(lock.properties.skills.items.required).toContain('noticeFile')
    expect(lock.properties.skills.items.additionalProperties).toBe(false)
    expect(lock.properties.skills.items.properties.files.minItems).toBe(1)
    expect(
      lock.properties.skills.items.properties.files.contains.properties.path
        .const,
    ).toBe('SKILL.md')
    expect(
      lock.$defs.fileRecord.additionalProperties,
    ).toBe(false)
    expect(lock.$defs.commit.pattern).toBe('^[0-9a-f]{40}$')
    expect(lock.$defs.sha256.pattern).toBe('^[0-9a-f]{64}$')
    expect(ramp.required).toEqual([
      'schemaVersion',
      'kind',
      'name',
      'version',
      'license',
    ])
    expect(ramp.properties.ownerPack).toBeDefined()
    expect(ramp.properties.basedOn.additionalProperties).toBe(false)
  })

  it('keeps published path and repository patterns aligned with runtime', () => {
    const sources = JSON.parse(
      readFileSync(join(repoRoot, 'schemas', 'skill-sources-v1.schema.json')),
    )
    const lock = JSON.parse(
      readFileSync(join(repoRoot, 'schemas', 'skill-lock-v1.schema.json')),
    )
    const repository = new RegExp(
      sources.properties.sources.items.properties.repository.pattern,
    )
    const sourcePath = new RegExp(sources.$defs.portablePath.pattern)
    const lockPath = new RegExp(lock.$defs.portablePath.pattern)

    expect(repository.test(
      'https://github.com/aws/agent-toolkit-for-aws.git',
    )).toBe(true)
    for (const invalid of [
      'http://github.com/aws/repo.git',
      'https://user@github.com/aws/repo.git',
      'https://github.com:443/aws/repo.git',
      'https://github.com.evil/aws/repo.git',
      'https://github.com/../repo.git',
      'https://github.com/aws/...git',
      'https://github.com/%2e%2e/repo.git',
      'https://github.com//repo.git',
      'https://github.com/aws/repo.git?ref=main',
      'https://github.com/aws/repo.git#readme',
    ]) {
      expect(repository.test(invalid), invalid).toBe(false)
    }

    for (const pattern of [sourcePath, lockPath]) {
      expect(pattern.test('references/guide.md')).toBe(true)
      for (const invalid of [
        '',
        '/absolute',
        'C:/absolute',
        'a\\b',
        '.',
        '..',
        'a/../b',
        'a//b',
        'a/',
        'a\tb',
        'a\nb',
        'a\rb',
        `a\0b`,
      ]) {
        expect(pattern.test(invalid), invalid).toBe(false)
      }
    }
  })

  it('commits the exact LF policy and cache-ignore contract', () => {
    expect(readFileSync(join(repoRoot, '.gitattributes'), 'utf8')).toBe(
      [
        '* text=auto eol=lf',
        '*.md text eol=lf',
        '*.json text eol=lf',
        '*.yaml text eol=lf',
        '*.yml text eol=lf',
        '*.js text eol=lf',
        '*.mjs text eol=lf',
        '*.sh text eol=lf',
        '*.ps1 text eol=lf',
        '',
      ].join('\n'),
    )
    const ignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(ignore.match(/^\.ramp-cache\/$/gm) ?? []).toHaveLength(1)
    expect(ignore).toMatch(/^dist\/$/m)
  })

  it('documents portable-skill and ATX deployment separation', () => {
    // The skill directory rules moved from skills/ramp/README.md into the
    // skills namespace design when the skills moved to skills/<slug>/.
    const ramp = readFileSync(
      join(repoRoot, 'docs', 'design', 'skills-namespace-and-navigation.md'),
      'utf8',
    )
    const atx = readFileSync(join(repoRoot, 'atx', 'README.md'), 'utf8')

    expect(existsSync(join(repoRoot, 'skills', 'ramp', 'README.md'))).toBe(false)
    expect(ramp).toMatch(/Each skill directory holds `SKILL\.md` and an adjacent `skill\.yaml`/)
    expect(ramp).toMatch(/upstream content[\s\S]{0,300}skills\.sources\.yaml[\s\S]{0,80}skills\.lock\.yaml/)
    expect(ramp).toMatch(/lives at `skills\/<slug>\/` with `ownerPack: <pack>`/)
    expect(ramp).toMatch(/never deploys an ATX/i)
    expect(atx).toMatch(/atx\/agents\/<name>/)
    expect(atx).toMatch(/source-only archive/i)
    expect(atx).toMatch(/explicit human review[\s\S]*deployment/i)
    expect(atx).toMatch(/never registers or deploys/i)
    expect(atx).toMatch(/relatedAssets/i)
    expect(atx).toMatch(/no AWS SDK call[\s\S]*publication/i)
  })
})
