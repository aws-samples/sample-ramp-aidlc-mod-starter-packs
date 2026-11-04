import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertPortableRelativePath,
  comparePortablePaths,
  hashFileRecords,
  hashSkillTree,
} from '../src/dependencies/checksum.js'

function withTempDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), 'ramp-skill-checksum-'))
  try {
    return run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function writeTree(root, files) {
  for (const [path, content] of files) {
    const absolute = join(root, ...path.split('/'))
    mkdirSync(join(absolute, '..'), { recursive: true })
    writeFileSync(absolute, content)
  }
}

describe('assertPortableRelativePath', () => {
  it.each([
    '',
    '/absolute',
    'C:/absolute',
    'c:/absolute',
    'C:\\absolute',
    'a\\b',
    '.',
    '..',
    '../escape',
    'a/../b',
    'a/..',
    './a',
    'a/./b',
    'a/.',
    '//',
    'a//b',
    'a/',
    'a\tb',
    'a\nb',
    'a\rb',
    `a\0b`,
  ])('rejects %j', (value) => {
    expect(() => assertPortableRelativePath(value, 'fixture path'))
      .toThrow(/fixture path/)
  })

  it.each(['SKILL.md', '.hidden', 'references/guide.md'])(
    'accepts %s unchanged',
    (value) => {
      expect(assertPortableRelativePath(value)).toBe(value)
    },
  )

  it('rejects non-string inputs', () => {
    expect(() => assertPortableRelativePath(42, 'fixture path'))
      .toThrow(/fixture path/)
  })
})

describe('comparePortablePaths', () => {
  it('uses direct stable string ordering', () => {
    expect(comparePortablePaths('Z', 'a')).toBe(-1)
    expect(comparePortablePaths('a', 'Z')).toBe(1)
    expect(comparePortablePaths('same', 'same')).toBe(0)
  })
})

describe('hashFileRecords', () => {
  it('matches independent known vectors for each exact NUL frame', () => {
    const nonExecutable = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('abc'), executable: false },
    ])
    const executable = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('abc'), executable: true },
    ])

    expect(nonExecutable.files[0].sha256).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(nonExecutable.treeSha256).toBe(
      '00fe83b3c6d4171efe0ded75a7c637ac3fdc9a900faaa6ea53afb919e4996195',
    )
    expect(executable.treeSha256).toBe(
      '9484817cb1a39558d135b48c3f7f121008aed9b518076891ac0dd2d7326263c2',
    )
  })

  it('sorts records and hashes the exact NUL-framed raw bytes', () => {
    const result = hashFileRecords([
      {
        path: 'references/guide.md',
        bytes: new Uint8Array([0, 255, 10]),
        executable: false,
      },
      {
        path: 'SKILL.md',
        bytes: Buffer.from('skill\n'),
        executable: true,
      },
    ])
    expect(result.files.map(({ path }) => path)).toEqual([
      'SKILL.md',
      'references/guide.md',
    ])
    expect(result.files[0]).toEqual({
      path: 'SKILL.md',
      sha256: createHash('sha256').update('skill\n').digest('hex'),
      size: 6,
      executable: true,
    })
    expect(result.files[1]).toEqual({
      path: 'references/guide.md',
      sha256: createHash('sha256')
        .update(Buffer.from([0, 255, 10]))
        .digest('hex'),
      size: 3,
      executable: false,
    })
    expect(result.treeSha256).toBe(
      'c594dd8af55264786c559c4f878a08846cdac86cb3844edb12ec55f86febbaa4',
    )
    expect(result).not.toHaveProperty('bytes')
    expect(result.files.every((file) => !('bytes' in file))).toBe(true)
  })

  it('changes file and tree checksums when raw bytes change', () => {
    const before = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('before'), executable: false },
    ])
    const after = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('after'), executable: false },
    ])

    expect(after.files[0].sha256).not.toBe(before.files[0].sha256)
    expect(after.treeSha256).not.toBe(before.treeSha256)
  })

  it('changes the tree checksum when a file is renamed', () => {
    const before = hashFileRecords([
      { path: 'a.md', bytes: Buffer.from('same'), executable: false },
    ])
    const after = hashFileRecords([
      { path: 'b.md', bytes: Buffer.from('same'), executable: false },
    ])

    expect(after.files[0].sha256).toBe(before.files[0].sha256)
    expect(after.treeSha256).not.toBe(before.treeSha256)
  })

  it('changes the tree checksum when only executable mode changes', () => {
    const regular = hashFileRecords([
      { path: 'run.sh', bytes: Buffer.from('same'), executable: false },
    ])
    const executable = hashFileRecords([
      { path: 'run.sh', bytes: Buffer.from('same'), executable: true },
    ])

    expect(executable.files[0].sha256).toBe(regular.files[0].sha256)
    expect(executable.treeSha256).not.toBe(regular.treeSha256)
  })

  it('distinguishes CRLF from LF without text normalization', () => {
    const lf = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('a\nb\n'), executable: false },
    ])
    const crlf = hashFileRecords([
      { path: 'SKILL.md', bytes: Buffer.from('a\r\nb\r\n'), executable: false },
    ])

    expect(lf.files[0].sha256).not.toBe(crlf.files[0].sha256)
    expect(lf.treeSha256).not.toBe(crlf.treeSha256)
  })

  it('copies only the selected Uint8Array subview bytes', () => {
    const backing = new Uint8Array([99, 1, 2, 3, 88])
    const subview = backing.subarray(1, 4)
    const result = hashFileRecords([
      { path: 'binary', bytes: subview, executable: false },
    ])

    expect(result.files[0]).toMatchObject({
      size: 3,
      sha256: createHash('sha256').update(Buffer.from([1, 2, 3])).digest('hex'),
    })
  })

  it('rejects malformed record collections', () => {
    expect(() => hashFileRecords('not records')).toThrow(/array/i)
    expect(() =>
      hashFileRecords([
        { path: 'same', bytes: Buffer.from('a'), executable: false },
        { path: 'same', bytes: Buffer.from('b'), executable: false },
      ]),
    ).toThrow(/duplicate/i)
    expect(() =>
      hashFileRecords([
        { path: 'SKILL.md', bytes: 'text', executable: false },
      ]),
    ).toThrow(/bytes/i)
    expect(() =>
      hashFileRecords([
        { path: 'SKILL.md', bytes: Buffer.from('x'), executable: 1 },
      ]),
    ).toThrow(/executable/i)
  })

  it('does not mutate the caller record array while sorting', () => {
    const records = [
      { path: 'z', bytes: Buffer.from('z'), executable: false },
      { path: 'a', bytes: Buffer.from('a'), executable: false },
    ]

    hashFileRecords(records)

    expect(records.map(({ path }) => path)).toEqual(['z', 'a'])
  })
})

describe('hashSkillTree', () => {
  it('is stable across filesystem creation order', () => {
    withTempDirectory((root) => {
      const first = join(root, 'first')
      const second = join(root, 'second')
      mkdirSync(first)
      mkdirSync(second)
      writeTree(first, [
        ['z.md', 'z'],
        ['references/a.md', 'a'],
        ['SKILL.md', 'skill'],
      ])
      writeTree(second, [
        ['SKILL.md', 'skill'],
        ['references/a.md', 'a'],
        ['z.md', 'z'],
      ])

      expect(hashSkillTree(first)).toEqual(hashSkillTree(second))
    })
  })

  it('includes hidden files and .DS_Store in the full tree', () => {
    withTempDirectory((root) => {
      writeFileSync(join(root, 'SKILL.md'), 'skill')
      const before = hashSkillTree(root)
      writeFileSync(join(root, '.DS_Store'), 'metadata')
      writeFileSync(join(root, '.hidden'), 'hidden')
      const after = hashSkillTree(root)

      expect(after.treeSha256).not.toBe(before.treeSha256)
      expect(after.files.map(({ path }) => path)).toEqual([
        '.DS_Store',
        '.hidden',
        'SKILL.md',
      ])
    })
  })

  it.runIf(process.platform !== 'win32')(
    'uses filesystem executable bits unless an exact override is supplied',
    () => {
      withTempDirectory((root) => {
        const script = join(root, 'run.sh')
        const skill = join(root, 'SKILL.md')
        writeFileSync(script, '#!/bin/sh\n')
        writeFileSync(skill, 'skill\n')
        chmodSync(script, 0o755)
        chmodSync(skill, 0o644)

        const fromFilesystem = hashSkillTree(root)
        const overridden = hashSkillTree(root, {
          executableByPath: new Map([
            ['SKILL.md', true],
            ['run.sh', false],
          ]),
        })

        expect(fromFilesystem.files).toMatchObject([
          { path: 'SKILL.md', executable: false },
          { path: 'run.sh', executable: true },
        ])
        expect(overridden.files).toMatchObject([
          { path: 'SKILL.md', executable: true },
          { path: 'run.sh', executable: false },
        ])
        expect(overridden.treeSha256).not.toBe(fromFilesystem.treeSha256)

        expect(() =>
          hashSkillTree(root, {
            executableByPath: new Map([['SKILL.md', false]]),
          }),
        ).toThrow(/missing|path set/i)
        expect(() =>
          hashSkillTree(root, {
            executableByPath: new Map([
              ['SKILL.md', false],
              ['run.sh', true],
              ['extra', false],
            ]),
          }),
        ).toThrow(/extra|path set/i)
        expect(() =>
          hashSkillTree(root, { executableByPath: { 'SKILL.md': false } }),
        ).toThrow(/Map/i)
        expect(() =>
          hashSkillTree(root, {
            executableByPath: new Map([
              ['../SKILL.md', false],
              ['run.sh', true],
            ]),
          }),
        ).toThrow(/portable|traversal/i)
        expect(() =>
          hashSkillTree(root, {
            executableByPath: new Map([
              ['SKILL.md', 0],
              ['run.sh', true],
            ]),
          }),
        ).toThrow(/boolean/i)
      })
    },
  )

  it('keeps authoritative buffers independent of unrelated working-tree EOL', () => {
    withTempDirectory((root) => {
      writeFileSync(join(root, 'SKILL.md'), 'line\r\n')
      const authoritative = Buffer.from('line\n')
      const first = hashFileRecords([
        { path: 'SKILL.md', bytes: authoritative, executable: false },
      ])

      writeFileSync(join(root, 'SKILL.md'), 'changed\r\n')
      const second = hashFileRecords([
        { path: 'SKILL.md', bytes: authoritative, executable: false },
      ])

      expect(readFileSync(join(root, 'SKILL.md'))).not.toEqual(authoritative)
      expect(second).toEqual(first)
    })
  })

  it('rejects a non-directory or symlinked root', () => {
    withTempDirectory((root) => {
      const file = join(root, 'file')
      writeFileSync(file, 'x')
      expect(() => hashSkillTree(file)).toThrow(/directory/i)

      if (process.platform !== 'win32') {
        const directory = join(root, 'actual')
        const linked = join(root, 'linked')
        mkdirSync(directory)
        symlinkSync(directory, linked)
        expect(() => hashSkillTree(linked)).toThrow(/symbolic link/i)
      }
    })
  })

  it.runIf(process.platform !== 'win32')(
    'rejects file and directory symlinks before hashing',
    () => {
      withTempDirectory((root) => {
        const skill = join(root, 'SKILL.md')
        writeFileSync(skill, 'skill')
        symlinkSync(skill, join(root, 'linked.md'))
        expect(() => hashSkillTree(root)).toThrow(/symbolic link/i)
        rmSync(join(root, 'linked.md'))

        const target = join(root, 'references')
        mkdirSync(target)
        symlinkSync(target, join(root, 'linked-directory'))
        expect(() => hashSkillTree(root)).toThrow(/symbolic link/i)
      })
    },
  )
})
