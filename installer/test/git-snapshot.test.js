import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  materializeGitTree,
  readGitFile,
  readGitTree,
  resolveGitCommit,
} from '../src/dependencies/git-snapshot.js'

const roots = []
const mutableChildProcess = createRequire(import.meta.url)(
  'node:child_process',
)
const gitEnv = {
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

function tempRoot(label = 'ramp-git-snapshot-') {
  const root = mkdtempSync(join(tmpdir(), label))
  roots.push(root)
  return root
}

function git(repository, args, options = {}) {
  return execFileSync('git', ['-C', repository, ...args], {
    env: gitEnv,
    encoding: 'utf8',
    ...options,
  }).trim()
}

function write(repository, path, bytes, mode = 0o644) {
  const absolute = join(repository, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, bytes)
  chmodSync(absolute, mode)
}

function commitAll(repository, message) {
  git(repository, ['add', '-A'])
  git(repository, ['commit', '-m', message])
  return git(repository, ['rev-parse', 'HEAD'])
}

function gitRaw(repository, args, options = {}) {
  return execFileSync('git', ['-C', repository, ...args], {
    env: gitEnv,
    ...options,
  })
}

function hashBlob(repository, bytes) {
  return gitRaw(repository, ['hash-object', '-w', '--stdin'], {
    input: bytes,
    encoding: 'utf8',
  }).trim()
}

function makeTree(repository, entries) {
  const input = Buffer.concat(entries.map(({
    mode = '100644',
    type = 'blob',
    objectId,
    path,
  }) => Buffer.concat([
    Buffer.from(`${mode} ${type} ${objectId}\t`),
    Buffer.isBuffer(path) ? path : Buffer.from(path),
    Buffer.from([0]),
  ])))
  return gitRaw(repository, ['mktree', '-z'], {
    input,
    encoding: 'utf8',
  }).trim()
}

function commitTree(repository, skillEntries, message = 'plumbing tree') {
  const skillTree = makeTree(repository, skillEntries)
  const rootTree = makeTree(repository, [{
    mode: '040000',
    type: 'tree',
    objectId: skillTree,
    path: 'skill',
  }])
  return git(repository, ['commit-tree', rootTree, '-m', message])
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

function withFakeGit(source, operation) {
  const bin = tempRoot('ramp-fake-git-')
  const executable = join(bin, 'git')
  writeFileSync(executable, `#!/usr/bin/env node\n${source}\n`)
  chmodSync(executable, 0o755)
  return withEnvironment({
    PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
  }, operation)
}

function withAnchoredMutationRace({
  action,
  cwd,
  inject,
}, operation) {
  const original = mutableChildProcess.spawnSync
  mutableChildProcess.spawnSync = function raceInjectingSpawn(
    command,
    args,
    options,
  ) {
    if (
      command === process.execPath &&
      args?.[2] === 'ramp-anchored-mutation-v1' &&
      args?.[3] === action &&
      resolve(options?.cwd) === resolve(cwd)
    ) {
      inject()
    }
    return original.call(this, command, args, options)
  }
  syncBuiltinESMExports()
  try {
    return operation()
  } finally {
    mutableChildProcess.spawnSync = original
    syncBuiltinESMExports()
  }
}

function fixture() {
  const repository = tempRoot()
  git(repository, ['init', '-q'])
  git(repository, ['config', 'core.autocrlf', 'false'])
  write(repository, '.gitignore', '.DS_Store\n')
  write(repository, 'LICENSE', Buffer.from('license v1\n'))
  write(repository, 'NOTICE', Buffer.from('notice v1\n'))
  write(repository, 'skills/aws-iam/SKILL.md', Buffer.from('# AWS IAM\n'))
  write(
    repository,
    'skills/aws-iam/scripts/check.sh',
    Buffer.from('#!/bin/sh\nexit 0\n'),
    0o755,
  )
  const first = commitAll(repository, 'first')

  write(repository, 'LICENSE', Buffer.from('license v2\n'))
  write(repository, 'skills/aws-iam/SKILL.md', Buffer.from('# changed\n'))
  const second = commitAll(repository, 'second')
  return { repository, first, second }
}

describe('immutable Git snapshot reader', () => {
  it('resolves refs once and reads raw bytes and modes from the requested commit', () => {
    const state = fixture()
    git(state.repository, ['tag', '-a', 'release-v1', state.first, '-m', 'release'])
    const tagObject = git(state.repository, ['rev-parse', 'release-v1^{tag}'])

    expect(resolveGitCommit({
      repository: state.repository,
      ref: 'release-v1',
    })).toBe(state.first)
    expect(() => readGitFile({
      repository: state.repository,
      commit: tagObject,
      path: 'LICENSE',
    })).toThrow(/commit/i)

    write(state.repository, 'LICENSE', Buffer.from('dirty license\n'))
    write(state.repository, 'NOTICE', Buffer.from('dirty notice\n'))
    write(state.repository, 'skills/aws-iam/SKILL.md', Buffer.from('dirty\n'))
    git(state.repository, ['add', 'NOTICE'])
    write(state.repository, '.DS_Store', Buffer.from('ignored'))
    write(state.repository, 'untracked.txt', Buffer.from('untracked'))

    const license = readGitFile({
      repository: state.repository,
      commit: state.first,
      path: 'LICENSE',
    })
    expect(license).toEqual({
      path: 'LICENSE',
      bytes: Buffer.from('license v1\n'),
      gitMode: '100644',
      executable: false,
      sha256: createHash('sha256').update('license v1\n').digest('hex'),
      size: 11,
    })

    const records = readGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
    })
    expect(records.map(({ path }) => path)).toEqual([
      'SKILL.md',
      'scripts/check.sh',
    ])
    expect(records[0].bytes).toEqual(Buffer.from('# AWS IAM\n'))
    expect(records[1]).toMatchObject({
      gitMode: '100755',
      executable: true,
    })
  })

  it('returns identical committed bytes from a checkout and a bare repository', () => {
    const state = fixture()
    const bare = tempRoot('ramp-git-snapshot-bare-')
    execFileSync('git', ['clone', '--bare', '--quiet', state.repository, bare], {
      env: gitEnv,
    })

    expect(readGitTree({
      repository: bare,
      commit: state.first,
      subpath: 'skills/aws-iam',
    })).toEqual(readGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
    }))
  })

  it('returns identical committed bytes from a linked worktree', () => {
    const state = fixture()
    const worktree = join(tempRoot('ramp-git-worktree-'), 'linked')
    git(state.repository, ['worktree', 'add', '--detach', worktree, state.first])

    expect(readGitTree({
      repository: worktree,
      commit: state.first,
      subpath: 'skills/aws-iam',
    })).toEqual(readGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
    }))
  })

  it.runIf(process.platform !== 'win32')(
    'does not lazy-fetch a missing promised blob',
    () => {
      const source = tempRoot('ramp-git-promisor-source-')
      git(source, ['init', '-q'])
      git(source, ['config', 'uploadpack.allowFilter', 'true'])
      write(source, 'LICENSE', Buffer.from('license\n'))
      const commit = commitAll(source, 'promisor source')

      const cloneParent = tempRoot('ramp-git-promisor-clone-')
      const repository = join(cloneParent, 'partial.git')
      execFileSync('git', [
        'clone',
        '--bare',
        '--quiet',
        '--filter=blob:none',
        `file://${source}`,
        repository,
      ], { env: gitEnv })

      const marker = join(cloneParent, 'lazy-fetch-invoked')
      const uploadPack = join(cloneParent, 'upload-pack')
      writeFileSync(
        uploadPack,
        `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'invoked')
process.exit(99)
`,
      )
      chmodSync(uploadPack, 0o755)
      git(repository, ['config', 'remote.origin.uploadpack', uploadPack])

      expect(() => readGitFile({
        repository,
        commit,
        path: 'LICENSE',
      })).toThrow(/blob|file|object/i)
      expect(existsSync(marker)).toBe(false)
    },
  )

  it('ignores Git replacement refs for commits and blobs', () => {
    const state = fixture()

    git(state.repository, ['replace', state.first, state.second])
    expect(readGitFile({
      repository: state.repository,
      commit: state.first,
      path: 'LICENSE',
    }).bytes).toEqual(Buffer.from('license v1\n'))
    git(state.repository, ['replace', '-d', state.first])

    const originalBlob = git(state.repository, [
      'rev-parse',
      `${state.first}:LICENSE`,
    ])
    const replacementBlob = git(state.repository, ['hash-object', '-w', '--stdin'], {
      input: 'replacement license\n',
    })
    git(state.repository, ['replace', originalBlob, replacementBlob])

    expect(readGitFile({
      repository: state.repository,
      commit: state.first,
      path: 'LICENSE',
    })).toMatchObject({
      bytes: Buffer.from('license v1\n'),
      size: 11,
      sha256: createHash('sha256').update('license v1\n').digest('hex'),
    })
  })

  it('isolates Git object reads from hostile inherited Git environment', () => {
    const state = fixture()
    const poison = join(tempRoot('ramp-git-environment-'), 'missing')

    withEnvironment({
      GIT_DIR: poison,
      GIT_WORK_TREE: poison,
      GIT_INDEX_FILE: poison,
      GIT_OBJECT_DIRECTORY: poison,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: poison,
      GIT_COMMON_DIR: poison,
      GIT_NAMESPACE: 'hostile',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.repositoryformatversion',
      GIT_CONFIG_VALUE_0: '99',
      GIT_NO_REPLACE_OBJECTS: '0',
      GIT_NO_LAZY_FETCH: '0',
      GIT_OPTIONAL_LOCKS: '1',
      GIT_TERMINAL_PROMPT: '1',
    }, () => {
      expect(resolveGitCommit({
        repository: state.repository,
        ref: state.first,
      })).toBe(state.first)
      expect(readGitFile({
        repository: state.repository,
        commit: state.first,
        path: 'LICENSE',
      }).bytes).toEqual(Buffer.from('license v1\n'))
    })
  })

  it.runIf(process.platform !== 'win32')(
    'passes a prompt-free no-lazy-fetch environment to every Git process',
    () => {
      const state = fixture()
      const realGit = execFileSync('which', ['git'], {
        encoding: 'utf8',
      }).trim()
      const source = `
const { spawnSync } = require('node:child_process')
const required = {
  GCM_INTERACTIVE: 'Never',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0',
  LANG: 'C',
  LC_ALL: 'C',
  TZ: 'UTC',
}
for (const [name, value] of Object.entries(required)) {
  if (process.env[name] !== value) {
    process.stderr.write('missing controlled Git environment: ' + name)
    process.exit(91)
  }
}
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_OBJECT_DIRECTORY']) {
  if (process.env[name] !== undefined) {
    process.stderr.write('inherited hostile Git environment: ' + name)
    process.exit(92)
  }
}
const result = spawnSync(${JSON.stringify(realGit)}, process.argv.slice(2), {
  env: process.env,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
`
      withEnvironment({
        GIT_DIR: join(tempRoot(), 'poison'),
        GIT_WORK_TREE: join(tempRoot(), 'poison'),
        GIT_OBJECT_DIRECTORY: join(tempRoot(), 'poison'),
      }, () => withFakeGit(source, () => {
        expect(resolveGitCommit({
          repository: state.repository,
          ref: state.first,
        })).toBe(state.first)
      }))
    },
  )

  it.each([
    'https://user:S3NT1NEL@example.invalid/repo.git',
    'https://user%3AS3NT1NEL@example.invalid/repo.git',
    'https://example.invalid/repo.git?access_token=S3NT1NEL',
  ])('never includes repository credentials in errors for %s', (repository) => {
    let message = ''
    try {
      resolveGitCommit({ repository, ref: 'main' })
    } catch (error) {
      message = error.message
    }
    expect(message).not.toBe('')
    expect(message).not.toContain('S3NT1NEL')
  })

  it('materializes exact bytes and authoritative executable modes', () => {
    const state = fixture()
    const destination = join(tempRoot(), 'materialized')
    const records = materializeGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
      destination,
    })

    expect(readFileSync(join(destination, 'SKILL.md'))).toEqual(
      Buffer.from('# AWS IAM\n'),
    )
    expect(readFileSync(join(destination, 'scripts', 'check.sh'))).toEqual(
      Buffer.from('#!/bin/sh\nexit 0\n'),
    )
    if (process.platform !== 'win32') {
      expect(lstatSync(join(destination, 'SKILL.md')).mode & 0o111).toBe(0)
      expect(lstatSync(join(destination, 'scripts', 'check.sh')).mode & 0o111)
        .not.toBe(0)
    }
    expect(records.map(({ path }) => path)).toEqual([
      'SKILL.md',
      'scripts/check.sh',
    ])
    expect(() => materializeGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
      destination,
    })).toThrow(/exist/i)
  })

  it.runIf(process.platform !== 'win32')(
    'materializes every directory with stable 0755 permissions',
    () => {
      const state = fixture()
      const destination = join(tempRoot(), 'materialized')
      const previous = process.umask(0o077)
      try {
        materializeGitTree({
          repository: state.repository,
          commit: state.first,
          subpath: 'skills/aws-iam',
          destination,
        })
      } finally {
        process.umask(previous)
      }

      expect(lstatSync(destination).mode & 0o777).toBe(0o755)
      expect(lstatSync(join(destination, 'scripts')).mode & 0o777).toBe(0o755)
    },
  )

  it('rejects case-fold path collisions before creating a destination', () => {
    const repository = tempRoot()
    git(repository, ['init', '-q'])
    const skillBlob = hashBlob(repository, Buffer.from('# skill\n'))
    const contentBlob = hashBlob(repository, Buffer.from('content\n'))
    const commit = commitTree(repository, [
      { objectId: skillBlob, path: 'SKILL.md' },
      { objectId: contentBlob, path: 'A.md' },
      { objectId: contentBlob, path: 'a.md' },
    ])
    const destination = join(tempRoot(), 'materialized')

    expect(() => materializeGitTree({
      repository,
      commit,
      subpath: 'skill',
      destination,
    })).toThrow(/case|collision/i)
    expect(existsSync(destination)).toBe(false)
  })

  it.runIf(process.platform !== 'win32')(
    'rejects existing and dangling symbolic-link destinations',
    () => {
      const state = fixture()
      const parent = tempRoot()
      const existing = join(parent, 'existing-link')
      const dangling = join(parent, 'dangling-link')
      symlinkSync(parent, existing)
      symlinkSync(join(parent, 'missing'), dangling)

      for (const destination of [existing, dangling]) {
        expect(() => materializeGitTree({
          repository: state.repository,
          commit: state.first,
          subpath: 'skills/aws-iam',
          destination,
        })).toThrow(/symbolic|exist/i)
        expect(lstatSync(destination).isSymbolicLink()).toBe(true)
      }
    },
  )

  it('rejects a blob larger than the per-file safety bound', () => {
    const repository = tempRoot()
    git(repository, ['init', '-q'])
    write(repository, 'skill/SKILL.md', Buffer.from('# skill\n'))
    write(
      repository,
      'skill/oversized.bin',
      Buffer.alloc((16 * 1024 * 1024) + 1, 0x61),
    )
    const commit = commitAll(repository, 'oversized blob')

    expect(() => readGitTree({
      repository,
      commit,
      subpath: 'skill',
    })).toThrow(/bound|limit|large/i)
  })

  it('rejects a tree whose cumulative raw bytes exceed the safety bound', () => {
    const repository = tempRoot()
    git(repository, ['init', '-q'])
    write(repository, 'skill/SKILL.md', Buffer.from('# skill\n'))
    for (let index = 0; index < 5; index += 1) {
      write(
        repository,
        `skill/references/large-${index}.bin`,
        Buffer.alloc(13 * 1024 * 1024, 0x61 + index),
      )
    }
    const commit = commitAll(repository, 'oversized tree')

    expect(() => readGitTree({
      repository,
      commit,
      subpath: 'skill',
    })).toThrow(/cumulative|tree.*bound|tree.*limit|large/i)
  })

  it('returns raw binary bytes and directly sorted skill-relative paths', () => {
    const repository = tempRoot()
    git(repository, ['init', '-q'])
    const binary = Buffer.from([0x00, 0xff, 0x0a, 0x00, 0x7f])
    const commit = commitTree(repository, [
      { objectId: hashBlob(repository, Buffer.from('z\n')), path: 'z.md' },
      {
        objectId: hashBlob(repository, Buffer.from('# skill\n')),
        path: 'SKILL.md',
      },
      { objectId: hashBlob(repository, Buffer.from('a\n')), path: 'a.md' },
      { objectId: hashBlob(repository, Buffer.from('A\n')), path: 'A.md' },
      { objectId: hashBlob(repository, binary), path: 'binary.bin' },
    ], 'binary and sorting')

    const records = readGitTree({ repository, commit, subpath: 'skill' })
    expect(records.map(({ path }) => path)).toEqual([
      'A.md',
      'SKILL.md',
      'a.md',
      'binary.bin',
      'z.md',
    ])
    expect(records.find(({ path }) => path === 'binary.bin')).toMatchObject({
      bytes: binary,
      size: 5,
      sha256: createHash('sha256').update(binary).digest('hex'),
    })
  })

  it.each([
    ['invalid UTF-8', Buffer.from([0xff]), /UTF-8/i],
    ['backslash', Buffer.from('bad\\name.md'), /portable|backslash/i],
    ['newline', Buffer.from('bad\nname.md'), /portable|control/i],
  ])('rejects a Git tree path containing %s bytes', (_name, unsafePath, error) => {
    const repository = tempRoot()
    git(repository, ['init', '-q'])
    const skillBlob = hashBlob(repository, Buffer.from('# skill\n'))
    const contentBlob = hashBlob(repository, Buffer.from('content\n'))
    const commit = commitTree(repository, [
      { objectId: skillBlob, path: 'SKILL.md' },
      { objectId: contentBlob, path: unsafePath },
    ])

    expect(() => readGitTree({
      repository,
      commit,
      subpath: 'skill',
    })).toThrow(error)
  })

  it('rejects malformed empty records in NUL-delimited tree output', () => {
    const repository = tempRoot()
    const gitDirectory = join(repository, 'objects')
    mkdirSync(gitDirectory)
    const commit = '1'.repeat(40)
    const tree = '2'.repeat(40)
    const blob = '3'.repeat(40)
    const source = `
const args = process.argv.slice(2)
if (args.includes('--absolute-git-dir')) {
  process.stdout.write(${JSON.stringify(gitDirectory)} + '\\n')
} else if (args.includes('rev-parse')) {
  process.stdout.write(${JSON.stringify(commit)} + '\\n')
} else if (args.includes('ls-tree') && args.includes('-r')) {
  process.stdout.write(Buffer.concat([
    Buffer.from('100644 blob ${blob}\\tskill/SKILL.md'),
    Buffer.from([0, 0]),
  ]))
} else if (args.includes('ls-tree')) {
  process.stdout.write(Buffer.concat([
    Buffer.from('040000 tree ${tree}\\tskill'),
    Buffer.from([0]),
  ]))
} else if (args.includes('cat-file')) {
  process.stdout.write('# skill\\n')
} else {
  process.stderr.write('unexpected fake Git arguments: ' + args.join(' '))
  process.exit(93)
}
`
    withFakeGit(source, () => {
      expect(() => readGitTree({
        repository,
        commit,
        subpath: 'skill',
      })).toThrow(/empty|NUL|invalid/i)
    })
  })

  it('reports metadata output that exceeds its subprocess bound', () => {
    const repository = tempRoot()
    const gitDirectory = join(repository, 'objects')
    mkdirSync(gitDirectory)
    const commit = '1'.repeat(40)
    const source = `
const args = process.argv.slice(2)
if (args.includes('--absolute-git-dir')) {
  process.stdout.write(${JSON.stringify(gitDirectory)} + '\\n')
} else if (args.includes('rev-parse')) {
  process.stdout.write(${JSON.stringify(commit)} + '\\n')
} else if (args.includes('ls-tree')) {
  process.stdout.write(Buffer.alloc((32 * 1024 * 1024) + 1, 0x61))
} else {
  process.stderr.write('unexpected fake Git arguments: ' + args.join(' '))
  process.exit(93)
}
`
    withFakeGit(source, () => {
      expect(() => readGitTree({
        repository,
        commit,
        subpath: 'skill',
      })).toThrow(/output bound/i)
    })
  })

  it('rejects a tree whose entry count exceeds the safety limit', () => {
    const repository = tempRoot()
    const gitDirectory = join(repository, 'objects')
    mkdirSync(gitDirectory)
    const commit = '1'.repeat(40)
    const tree = '2'.repeat(40)
    const blob = '3'.repeat(40)
    const source = `
const args = process.argv.slice(2)
if (args.includes('--absolute-git-dir')) {
  process.stdout.write(${JSON.stringify(gitDirectory)} + '\\n')
} else if (args.includes('rev-parse')) {
  process.stdout.write(${JSON.stringify(commit)} + '\\n')
} else if (args.includes('ls-tree') && args.includes('-r')) {
  const records = []
  for (let index = 0; index < 4097; index += 1) {
    records.push(Buffer.from(
      '100644 blob ${blob}\\tskill/file-' +
      String(index).padStart(4, '0') +
      '.md\\0',
    ))
  }
  process.stdout.write(Buffer.concat(records))
} else if (args.includes('ls-tree')) {
  process.stdout.write(Buffer.concat([
    Buffer.from('040000 tree ${tree}\\tskill'),
    Buffer.from([0]),
  ]))
} else {
  process.stderr.write('unexpected fake Git arguments: ' + args.join(' '))
  process.exit(93)
}
`
    withFakeGit(source, () => {
      expect(() => readGitTree({
        repository,
        commit,
        subpath: 'skill',
      })).toThrow(/4096|entry.*limit|safety limit/i)
    })
  })

  it('rejects multi-line ref resolution output', () => {
    const repository = tempRoot()
    const gitDirectory = join(repository, 'objects')
    mkdirSync(gitDirectory)
    const source = `
const args = process.argv.slice(2)
if (args.includes('--absolute-git-dir')) {
  process.stdout.write(${JSON.stringify(gitDirectory)} + '\\n')
} else {
  process.stdout.write('${'1'.repeat(40)}\\n${'2'.repeat(40)}\\n')
}
`
    withFakeGit(source, () => {
      expect(() => resolveGitCommit({
        repository,
        ref: 'main',
      })).toThrow(/invalid|one.*commit/i)
    })
  })

  it('rejects blob and tree refs as update commits', () => {
    const state = fixture()
    const blob = git(state.repository, ['rev-parse', `${state.first}:LICENSE`])
    const tree = git(state.repository, [
      'rev-parse',
      `${state.first}:skills/aws-iam`,
    ])
    git(state.repository, ['update-ref', 'refs/tags/blob-ref', blob])
    git(state.repository, ['update-ref', 'refs/tags/tree-ref', tree])

    expect(() => resolveGitCommit({
      repository: state.repository,
      ref: 'blob-ref',
    })).toThrow(/commit|resolve/i)
    expect(() => resolveGitCommit({
      repository: state.repository,
      ref: 'tree-ref',
    })).toThrow(/commit|resolve/i)
  })

  it('rejects SHA-256-format commit IDs', () => {
    const repository = tempRoot()
    git(repository, ['init', '--object-format=sha256', '-q'])
    write(repository, 'LICENSE', Buffer.from('license\n'))
    commitAll(repository, 'sha256 commit')

    expect(() => resolveGitCommit({
      repository,
      ref: 'HEAD',
    })).toThrow(/40-character|commit/i)
  })

  it('reads committed LF bytes despite a CRLF checkout', () => {
    const state = fixture()
    git(state.repository, ['config', 'core.autocrlf', 'true'])
    unlinkSync(join(state.repository, 'LICENSE'))
    git(state.repository, ['checkout', '--', 'LICENSE'])
    expect(readFileSync(join(state.repository, 'LICENSE'))).toContainEqual(0x0d)

    expect(readGitFile({
      repository: state.repository,
      commit: state.first,
      path: 'LICENSE',
    }).bytes).toEqual(Buffer.from('license v1\n'))
  })

  it.runIf(process.platform !== 'win32')(
    'ignores deleted and symbolic-link working-tree source files',
    () => {
      const state = fixture()
      unlinkSync(join(state.repository, 'LICENSE'))
      expect(readGitFile({
        repository: state.repository,
        commit: state.first,
        path: 'LICENSE',
      }).bytes).toEqual(Buffer.from('license v1\n'))

      symlinkSync('NOTICE', join(state.repository, 'LICENSE'))
      expect(readGitFile({
        repository: state.repository,
        commit: state.first,
        path: 'LICENSE',
      }).bytes).toEqual(Buffer.from('license v1\n'))
    },
  )

  it.each([
    ['malformed commit', 'abc', /commit/i],
    ['uppercase commit', 'A'.repeat(40), /commit/i],
    ['missing commit', '0'.repeat(40), /commit|object/i],
  ])('rejects %s before reading paths', (_name, commit, message) => {
    const state = fixture()
    expect(() => readGitTree({
      repository: state.repository,
      commit,
      subpath: 'skills/aws-iam',
    })).toThrow(message)
  })

  it.each([
    ['leading dash ref', '-main', /ref/i],
    ['newline ref', 'main\nHEAD', /ref/i],
    ['missing ref', 'not-a-ref', /ref|resolve/i],
  ])('rejects %s', (_name, ref, message) => {
    const state = fixture()
    expect(() => resolveGitCommit({
      repository: state.repository,
      ref,
    })).toThrow(message)
  })

  it('rejects blobs as trees and trees as files', () => {
    const state = fixture()
    expect(() => readGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'LICENSE',
    })).toThrow(/tree/i)
    expect(() => readGitFile({
      repository: state.repository,
      commit: state.first,
      path: 'skills/aws-iam',
    })).toThrow(/file|blob|tree/i)
  })

  it.runIf(process.platform !== 'win32')(
    'rejects symlinks and submodules anywhere in a selected tree',
    () => {
      const repository = tempRoot()
      git(repository, ['init', '-q'])
      write(repository, 'skill/SKILL.md', Buffer.from('# skill\n'))
      symlinkSync('SKILL.md', join(repository, 'skill', 'alias.md'))
      const symlinkCommit = commitAll(repository, 'symlink')
      expect(() => readGitTree({
        repository,
        commit: symlinkCommit,
        subpath: 'skill',
      })).toThrow(/symlink|120000/i)

      unlinkAndReplaceWithSubmoduleIndex(repository, symlinkCommit)
      const submoduleCommit = git(repository, ['rev-parse', 'HEAD'])
      expect(() => readGitTree({
        repository,
        commit: submoduleCommit,
        subpath: 'skill',
      })).toThrow(/submodule|160000/i)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'rejects source-file symlink and gitlink modes',
    () => {
      const symlinkRepository = tempRoot()
      git(symlinkRepository, ['init', '-q'])
      write(symlinkRepository, 'NOTICE', Buffer.from('notice\n'))
      symlinkSync('NOTICE', join(symlinkRepository, 'LICENSE'))
      const symlinkCommit = commitAll(symlinkRepository, 'source symlink')
      expect(() => readGitFile({
        repository: symlinkRepository,
        commit: symlinkCommit,
        path: 'LICENSE',
      })).toThrow(/symlink|120000/i)

      const gitlinkRepository = tempRoot()
      git(gitlinkRepository, ['init', '-q'])
      write(gitlinkRepository, 'seed', Buffer.from('seed\n'))
      const seedCommit = commitAll(gitlinkRepository, 'seed')
      unlinkSync(join(gitlinkRepository, 'seed'))
      git(gitlinkRepository, ['rm', '--cached', 'seed'])
      git(gitlinkRepository, [
        'update-index',
        '--add',
        '--cacheinfo',
        `160000,${seedCommit},LICENSE`,
      ])
      git(gitlinkRepository, ['commit', '-m', 'source gitlink'])
      const gitlinkCommit = git(gitlinkRepository, ['rev-parse', 'HEAD'])
      expect(() => readGitFile({
        repository: gitlinkRepository,
        commit: gitlinkCommit,
        path: 'LICENSE',
      })).toThrow(/submodule|160000/i)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'rejects arbitrary symlinked ancestors, linked parents, and special destinations',
    () => {
      const state = fixture()
      const parent = tempRoot()
      const realParent = join(parent, 'real')
      const linkedParent = join(parent, 'linked')
      const realAncestor = join(parent, 'real-ancestor')
      const linkedAncestor = join(parent, 'linked-ancestor')
      const special = join(parent, 'special')
      mkdirSync(realParent)
      mkdirSync(join(realAncestor, 'child'), { recursive: true })
      symlinkSync(realParent, linkedParent)
      symlinkSync(realAncestor, linkedAncestor)
      execFileSync('mkfifo', [special])

      expect(() => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination: join(linkedParent, 'materialized'),
      })).toThrow(/parent|symbolic|directory/i)
      expect(existsSync(join(realParent, 'materialized'))).toBe(false)

      const prefixedDestination = join(
        linkedAncestor,
        'child',
        'materialized',
      )
      expect(() => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination: prefixedDestination,
      })).toThrow(/ancestor|symbolic|symlink/i)
      expect(existsSync(join(
        realAncestor,
        'child',
        'materialized',
      ))).toBe(false)

      expect(() => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination: special,
      })).toThrow(/exist|destination/i)
      expect(lstatSync(special).isFIFO()).toBe(true)
    },
  )

  it.runIf(
    process.platform === 'darwin' &&
    tmpdir().startsWith('/var/') &&
    realpathSync(tmpdir()).startsWith('/private/var/'),
  )('accepts the platform-owned macOS /var canonical prefix', () => {
    const state = fixture()
    const destination = join(tempRoot(), 'materialized')

    expect(materializeGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: 'skills/aws-iam',
      destination,
    })).toHaveLength(2)
    expect(readFileSync(join(destination, 'SKILL.md'))).toEqual(
      Buffer.from('# AWS IAM\n'),
    )
  })

  it.runIf(process.platform !== 'win32')(
    'requires the caller-controlled materialization parent to be private',
    () => {
      const state = fixture()
      const parent = tempRoot()
      chmodSync(parent, 0o777)
      const destination = join(parent, 'materialized')

      expect(() => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination,
      })).toThrow(/parent|private|writable|permission/i)
      expect(existsSync(destination)).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'fails closed when the destination entry appears immediately before creation',
    () => {
      const state = fixture()
      const parent = tempRoot()
      const destination = join(parent, 'materialized')
      const outside = tempRoot('ramp-race-outside-')
      write(outside, 'sentinel', Buffer.from('unchanged\n'))

      expect(() => withAnchoredMutationRace({
        action: 'mkdir',
        cwd: realpathSync(parent),
        inject() {
          symlinkSync(outside, destination)
        },
      }, () => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination,
      }))).toThrow(/exist|symbolic|mutation|destination/i)

      expect(lstatSync(destination).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(outside, 'sentinel'))).toEqual(
        Buffer.from('unchanged\n'),
      )
      expect(existsSync(join(outside, 'SKILL.md'))).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'fails closed when the existing parent is replaced before destination creation',
    () => {
      const state = fixture()
      const base = tempRoot()
      const parent = join(base, 'parent')
      const captured = join(base, 'captured-parent')
      const destination = join(parent, 'materialized')
      const outside = tempRoot('ramp-race-outside-')
      mkdirSync(parent, { mode: 0o700 })
      write(outside, 'sentinel', Buffer.from('unchanged\n'))

      expect(() => withAnchoredMutationRace({
        action: 'mkdir',
        cwd: realpathSync(parent),
        inject() {
          renameSync(parent, captured)
          symlinkSync(outside, parent)
        },
      }, () => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination,
      }))).toThrow(/changed|identity|mutation|directory/i)

      expect(lstatSync(parent).isSymbolicLink()).toBe(true)
      expect(lstatSync(captured).isDirectory()).toBe(true)
      expect(readFileSync(join(outside, 'sentinel'))).toEqual(
        Buffer.from('unchanged\n'),
      )
      expect(existsSync(join(outside, 'materialized'))).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'fails closed when the private root is replaced before nested creation',
    () => {
      const state = fixture()
      const parent = tempRoot()
      const destination = join(parent, 'materialized')
      const captured = join(parent, 'captured-private-root')
      const outside = tempRoot('ramp-race-outside-')
      write(outside, 'sentinel', Buffer.from('unchanged\n'))

      expect(() => withAnchoredMutationRace({
        action: 'mkdir',
        cwd: join(realpathSync(parent), 'materialized'),
        inject() {
          renameSync(destination, captured)
          symlinkSync(outside, destination)
        },
      }, () => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination,
      }))).toThrow(/changed|identity|mutation|directory/i)

      expect(lstatSync(destination).isSymbolicLink()).toBe(true)
      expect(lstatSync(captured).isDirectory()).toBe(true)
      expect(readFileSync(join(outside, 'sentinel'))).toEqual(
        Buffer.from('unchanged\n'),
      )
      expect(existsSync(join(outside, 'scripts'))).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'fails closed when a file parent is replaced immediately before writing',
    () => {
      const state = fixture()
      const parent = tempRoot()
      const destination = join(parent, 'materialized')
      const captured = join(parent, 'captured-scripts')
      const outside = tempRoot('ramp-race-outside-')
      write(outside, 'sentinel', Buffer.from('unchanged\n'))

      expect(() => withAnchoredMutationRace({
        action: 'write-batch',
        cwd: join(realpathSync(parent), 'materialized', 'scripts'),
        inject() {
          renameSync(join(destination, 'scripts'), captured)
          symlinkSync(outside, join(destination, 'scripts'))
        },
      }, () => materializeGitTree({
        repository: state.repository,
        commit: state.first,
        subpath: 'skills/aws-iam',
        destination,
      }))).toThrow(/changed|identity|mutation|directory/i)

      expect(lstatSync(join(destination, 'scripts')).isSymbolicLink()).toBe(true)
      expect(lstatSync(captured).isDirectory()).toBe(true)
      expect(readFileSync(join(outside, 'sentinel'))).toEqual(
        Buffer.from('unchanged\n'),
      )
      expect(existsSync(join(outside, 'check.sh'))).toBe(false)
    },
  )

  it('rejects unsafe input paths and never creates a destination on failure', () => {
    const state = fixture()
    const destination = join(tempRoot(), 'missing')
    expect(() => readGitFile({
      repository: state.repository,
      commit: state.first,
      path: '../LICENSE',
    })).toThrow(/portable|traversal/i)
    expect(() => materializeGitTree({
      repository: state.repository,
      commit: state.first,
      subpath: '../skills',
      destination,
    })).toThrow(/portable|traversal/i)
    expect(existsSync(destination)).toBe(false)
  })
})

function unlinkAndReplaceWithSubmoduleIndex(repository, objectId) {
  unlinkSync(join(repository, 'skill', 'alias.md'))
  git(repository, ['rm', '--cached', 'skill/alias.md'])
  git(repository, [
    'update-index',
    '--add',
    '--cacheinfo',
    `160000,${objectId},skill/nested-module`,
  ])
  git(repository, ['commit', '-m', 'submodule mode'])
}
