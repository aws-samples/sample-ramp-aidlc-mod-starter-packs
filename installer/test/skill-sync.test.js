import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hashFileRecords } from '../src/dependencies/checksum.js'
import {
  readGitFile,
  readGitTree,
} from '../src/dependencies/git-snapshot.js'
import {
  loadSkillLock,
  writeSkillLock,
} from '../src/dependencies/manifests.js'
import {
  verifyLockedSkillDirectory,
} from '../src/dependencies/resolver.js'
import {
  syncLockedSkills,
  updateSkillLocks,
  verifyLockedSkills,
} from '../src/dependencies/sync.js'

const roots = []
const repositoryUrl = 'https://github.com/aws/test-skills.git'
const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..', '..')
const cli = join(here, '..', 'bin', 'ramp-pack.js')
const realGit = process.env.PATH
  .split(delimiter)
  .map((directory) => join(directory, 'git'))
  .find((candidate) => existsSync(candidate))
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

function tempRoot(label = 'ramp-skill-sync-') {
  const root = mkdtempSync(join(tmpdir(), label))
  roots.push(root)
  return root
}

function git(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], {
    env: gitEnv,
    encoding: 'utf8',
  }).trim()
}

function write(root, path, bytes, mode = 0o644) {
  const absolute = join(root, ...path.split('/'))
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, bytes)
  chmodSync(absolute, mode)
}

function commit(repository, message) {
  git(repository, ['add', '-A'])
  git(repository, ['commit', '-m', message])
  return git(repository, ['rev-parse', 'HEAD'])
}

function sourceRepository() {
  const repository = tempRoot('ramp-sync-source-')
  git(repository, ['init', '-q'])
  write(repository, '.gitignore', '.DS_Store\n')
  write(repository, 'LICENSE', 'license committed\n')
  write(repository, 'NOTICE', 'notice committed\n')
  write(repository, 'skills/aws-iam/SKILL.md', '# AWS IAM\n')
  write(repository, 'skills/aws-iam/scripts/check.sh', '#!/bin/sh\n', 0o755)
  write(repository, 'skills/api-gateway/SKILL.md', '# API Gateway\n')
  const first = commit(repository, 'initial')
  write(repository, 'skills/aws-iam/SKILL.md', '# newer HEAD\n')
  const second = commit(repository, 'later')
  return { repository, first, second }
}

function raceSourceRepository() {
  const source = sourceRepository()
  write(
    source.repository,
    'skills/aws-iam/zz-race-payload.bin',
    Buffer.alloc(16 * 1024 * 1024, 0x61),
  )
  return {
    ...source,
    race: commit(source.repository, 'race payload'),
  }
}

function addSkill(repository, path, body = '# Skill\n') {
  write(repository, `${path}/SKILL.md`, body)
}

function writeSources(repoRoot, sources = [{
  id: 'test-source',
  repository: repositoryUrl,
  priority: 10,
  license: 'Apache-2.0',
  licensePath: 'LICENSE',
  noticePath: 'NOTICE',
}]) {
  const lines = ['schemaVersion: 1', 'sources:']
  for (const source of sources) {
    lines.push(
      `  - id: ${source.id}`,
      `    repository: ${source.repository}`,
      `    priority: ${source.priority}`,
      `    license: ${source.license}`,
      `    licensePath: ${source.licensePath}`,
      `    noticePath: ${source.noticePath}`,
    )
  }
  write(repoRoot, 'dependencies/skills.sources.yaml', `${lines.join('\n')}\n`)
}

function lockedEntry(source, {
  name = 'aws-iam',
  path = 'skills/aws-iam',
  commitId = source.first,
  sourceId = 'test-source',
  repository = repositoryUrl,
} = {}) {
  const records = readGitTree({
    repository: source.repository,
    commit: commitId,
    subpath: path,
  })
  const hashed = hashFileRecords(records)
  const license = readGitFile({
    repository: source.repository,
    commit: commitId,
    path: 'LICENSE',
  })
  const notice = readGitFile({
    repository: source.repository,
    commit: commitId,
    path: 'NOTICE',
  })
  const fileRecord = ({ path: recordPath, sha256, size, executable }) => ({
    path: recordPath,
    sha256,
    size,
    executable,
  })
  return {
    name,
    source: sourceId,
    repository,
    commit: commitId,
    path,
    treeSha256: hashed.treeSha256,
    files: hashed.files,
    license: 'Apache-2.0',
    licensePath: 'LICENSE',
    licenseFile: fileRecord(license),
    noticePath: 'NOTICE',
    noticeFile: fileRecord(notice),
  }
}

function rampRoot(source, entries = [lockedEntry(source)]) {
  const repoRoot = tempRoot('ramp-sync-root-')
  writeSources(repoRoot)
  writeSkillLock(repoRoot, {
    schemaVersion: 1,
    skills: new Map(entries.map((entry) => [entry.name, entry])),
  })
  return repoRoot
}

function cachePaths(cacheDir, entry) {
  const snapshot = join(
    cacheDir,
    'sources',
    entry.source,
    entry.commit,
  )
  return {
    snapshot,
    skill: join(snapshot, ...entry.path.split('/')),
    license: join(snapshot, entry.licenseFile.path),
    notice: join(snapshot, entry.noticeFile.path),
  }
}

function installLocalGitProxy(sourceRepository, logPath) {
  const proxyRoot = tempRoot('ramp-git-proxy-')
  const body = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const original = process.argv.slice(2)
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(original) + '\\n')
const isClone = original.includes('clone')
const isFetch = original.includes('fetch')
const args = original.map((value) => {
  if (isClone && value === ${JSON.stringify(repositoryUrl)}) {
    return ${JSON.stringify(sourceRepository)}
  }
  if (isFetch && value === 'origin') {
    return ${JSON.stringify(sourceRepository)}
  }
  return value
})
const result = spawnSync(${JSON.stringify(realGit)}, args, {
  env: process.env,
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function installAcquisitionWinnerProxy({
  sourceRepository,
  destination,
  winnerTemplate,
  logPath,
}) {
  const proxyRoot = tempRoot('ramp-git-winner-proxy-')
  const marker = join(proxyRoot, 'winner-installed')
  const body = `#!/usr/bin/env node
const {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} = require('node:fs')
const { dirname } = require('node:path')
const { spawnSync } = require('node:child_process')
const original = process.argv.slice(2)
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(original) + '\\n')
const isFetch = original.includes('fetch')
if (isFetch && !existsSync(${JSON.stringify(marker)})) {
  mkdirSync(dirname(${JSON.stringify(destination)}), { recursive: true })
  ${
    winnerTemplate === null
      ? `mkdirSync(${JSON.stringify(destination)})
  writeFileSync(${JSON.stringify(join(destination, 'attacker-marker'))}, 'do not replace\\n')`
      : `cpSync(${JSON.stringify(winnerTemplate)}, ${JSON.stringify(destination)}, {
    recursive: true,
    errorOnExist: true,
    force: false,
  })`
  }
  writeFileSync(${JSON.stringify(marker)}, 'done\\n')
}
const args = original.map((value) => {
  if (isFetch && value === 'origin') {
    return ${JSON.stringify(sourceRepository)}
  }
  return value
})
const result = spawnSync(${JSON.stringify(realGit)}, args, {
  env: process.env,
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function installFailingGitSentinel(logPath) {
  const proxyRoot = tempRoot('ramp-git-sentinel-')
  const body = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs')
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + '\\n')
process.stderr.write('poisoned Git sentinel invoked\\n')
process.exit(91)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function installRefMovingGitProxy({ logPath, moves }) {
  const proxyRoot = tempRoot('ramp-git-ref-mover-')
  const body = `#!/usr/bin/env node
const { appendFileSync, existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + '\\n')
const result = spawnSync(${JSON.stringify(realGit)}, args, {
  env: process.env,
  encoding: null,
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status === 0) {
  const moves = ${JSON.stringify(moves)}
  for (const move of moves) {
    const marker = join(${JSON.stringify(proxyRoot)}, move.id)
    if (args.includes(move.ref + '^{commit}') && !existsSync(marker)) {
      const updated = spawnSync(
        ${JSON.stringify(realGit)},
        ['-C', move.repository, 'update-ref', move.ref, move.commit],
        { env: process.env, stdio: 'inherit' },
      )
      if (updated.error) throw updated.error
      if (updated.status !== 0) process.exit(updated.status ?? 1)
      writeFileSync(marker, 'moved\\n')
    }
  }
}
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function installMovingUpdateWinnerProxy({
  sourceRepository,
  destination,
  winnerTemplate,
  ref,
  newCommit,
  logPath,
}) {
  const proxyRoot = tempRoot('ramp-git-update-winner-')
  const marker = join(proxyRoot, 'winner-installed')
  const body = `#!/usr/bin/env node
const {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} = require('node:fs')
const { dirname } = require('node:path')
const { spawnSync } = require('node:child_process')
const original = process.argv.slice(2)
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(original) + '\\n')
const isFetch = original.includes('fetch')
const args = original.map((value) =>
  isFetch && value === 'origin' ? ${JSON.stringify(sourceRepository)} : value)
const result = spawnSync(${JSON.stringify(realGit)}, args, {
  env: process.env,
  encoding: null,
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.status === 0 && isFetch && !existsSync(${JSON.stringify(marker)})) {
  mkdirSync(dirname(${JSON.stringify(destination)}), { recursive: true })
  cpSync(${JSON.stringify(winnerTemplate)}, ${JSON.stringify(destination)}, {
    recursive: true,
    errorOnExist: true,
    force: false,
  })
  const moved = spawnSync(
    ${JSON.stringify(realGit)},
    [
      '-C',
      ${JSON.stringify(sourceRepository)},
      'update-ref',
      ${JSON.stringify(ref)},
      ${JSON.stringify(newCommit)},
    ],
    { env: process.env, stdio: 'inherit' },
  )
  if (moved.error) throw moved.error
  if (moved.status !== 0) process.exit(moved.status ?? 1)
  writeFileSync(${JSON.stringify(marker)}, 'done\\n')
}
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function installMutatingGitProxy(lockPath, replacement) {
  const proxyRoot = tempRoot('ramp-git-mutator-')
  const marker = join(proxyRoot, 'mutated')
  const body = `#!/usr/bin/env node
const { existsSync, writeFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
if (args.includes('cat-file') && !existsSync(${JSON.stringify(marker)})) {
  writeFileSync(${JSON.stringify(lockPath)}, ${JSON.stringify(replacement)})
  writeFileSync(${JSON.stringify(marker)}, 'done')
}
const result = spawnSync(${JSON.stringify(realGit)}, args, {
  env: process.env,
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)
`
  write(proxyRoot, 'git', body, 0o755)
  return proxyRoot
}

function startCacheRace({
  cacheDir,
  entry,
  action,
  destination,
  source,
}) {
  const marker = join(dirname(cacheDir), `race-${action}-${Date.now()}`)
  const script = `
const {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs')
const { join } = require('node:path')
const cacheDir = ${JSON.stringify(cacheDir)}
const marker = ${JSON.stringify(marker)}
const action = ${JSON.stringify(action)}
const commit = ${JSON.stringify(entry.commit)}
const finalDestination = ${JSON.stringify(destination ?? null)}
const source = ${JSON.stringify(source ?? null)}
const wait = new Int32Array(new SharedArrayBuffer(4))
const deadline = Date.now() + 30000
while (Date.now() < deadline) {
  const temporary = join(cacheDir, '.tmp')
  if (existsSync(temporary)) {
    for (const operation of readdirSync(temporary)) {
      const stagedSkill = join(
        temporary,
        operation,
        'snapshot-cache',
        'sources',
        'test-source',
        commit,
        'skills',
        'aws-iam',
        'SKILL.md',
      )
      if (!existsSync(stagedSkill)) continue
      if (action === 'corrupt-stage') {
        writeFileSync(stagedSkill, 'concurrent staged corruption\\n')
      } else if (action === 'valid-winner') {
        mkdirSync(require('node:path').dirname(finalDestination), { recursive: true })
        cpSync(source, finalDestination, {
          recursive: true,
          errorOnExist: true,
          force: false,
        })
      } else if (action === 'corrupt-winner') {
        mkdirSync(finalDestination, { recursive: true })
        writeFileSync(join(finalDestination, 'attacker-marker'), 'do not replace\\n')
      } else if (action === 'symlink-ancestor') {
        mkdirSync(require('node:path').dirname(finalDestination), { recursive: true })
        symlinkSync(source, finalDestination, 'dir')
      } else {
        throw new Error('unknown cache race action: ' + action)
      }
      writeFileSync(marker, 'done\\n')
      process.exit(0)
    }
  }
  Atomics.wait(wait, 0, 0, 1)
}
process.exit(2)
`
  const child = spawn(process.execPath, ['-e', script], {
    stdio: 'ignore',
  })
  return { child, marker }
}

function isolatedCliProject() {
  const repoRoot = tempRoot('ramp-isolated-cli-')
  const installerRoot = join(repoRoot, 'installer')
  const sourceInstaller = join(here, '..')
  mkdirSync(installerRoot, { recursive: true })
  cpSync(join(sourceInstaller, 'bin'), join(installerRoot, 'bin'), {
    recursive: true,
  })
  cpSync(join(sourceInstaller, 'src'), join(installerRoot, 'src'), {
    recursive: true,
  })
  cpSync(
    join(sourceInstaller, 'package.json'),
    join(installerRoot, 'package.json'),
  )
  symlinkSync(
    join(sourceInstaller, 'node_modules'),
    join(installerRoot, 'node_modules'),
    'dir',
  )
  return {
    repoRoot,
    cli: join(installerRoot, 'bin', 'ramp-pack.js'),
  }
}

describe('locked skill verification and synchronization', () => {
  it.each([
    [
      'verify',
      (repoRoot, cacheDir) => verifyLockedSkills({
        repoRoot,
        cacheDir,
        unexpected: true,
      }),
    ],
    [
      'sync',
      (repoRoot, cacheDir) => syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map(),
        allowNetwork: false,
        unexpected: true,
      }),
    ],
    [
      'update',
      (repoRoot, cacheDir) => updateSkillLocks({
        repoRoot,
        cacheDir,
        names: ['aws-iam'],
        sourceRoots: new Map(),
        sourceRefs: new Map(),
        allowNetwork: false,
        unexpected: true,
      }),
    ],
  ])('rejects an unknown public %s option before filesystem writes', (_name, call) => {
    const repoRoot = tempRoot('ramp-invalid-options-')
    const cacheDir = join(repoRoot, 'cache')
    expect(() => call(repoRoot, cacheDir)).toThrow(/unknown.*option|unexpected/i)
    expect(existsSync(cacheDir)).toBe(false)
  })

  it('requires the lock before inspecting or creating cache/source paths', () => {
    const repoRoot = tempRoot()
    writeSources(repoRoot)
    const cacheDir = join(repoRoot, 'cache')
    expect(() => syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', join(repoRoot, 'missing-source')]]),
      allowNetwork: false,
    })).toThrow(/required.*lock|lock.*does not exist/i)
    expect(existsSync(cacheDir)).toBe(false)
  })

  it('materializes and verifies exact commit objects despite dirty source state', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')

    write(source.repository, 'LICENSE', 'dirty license\n')
    write(source.repository, 'NOTICE', 'dirty notice\n')
    write(source.repository, 'skills/aws-iam/SKILL.md', 'dirty skill\n')
    git(source.repository, ['add', 'NOTICE'])
    write(source.repository, '.DS_Store', 'ignored')
    write(source.repository, 'untracked.txt', 'untracked')

    const synced = syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })
    expect(synced).toEqual({
      cacheDir,
      sources: [{
        source: 'test-source',
        commit: entry.commit,
        status: 'materialized',
        licenseFile: entry.licenseFile,
        noticeFile: entry.noticeFile,
      }],
      skills: [{
        name: entry.name,
        source: entry.source,
        commit: entry.commit,
        path: entry.path,
        treeSha256: entry.treeSha256,
        status: 'materialized',
      }],
    })

    const paths = cachePaths(cacheDir, entry)
    expect(readFileSync(join(paths.skill, 'SKILL.md'), 'utf8')).toBe('# AWS IAM\n')
    expect(readFileSync(paths.license, 'utf8')).toBe('license committed\n')
    expect(readFileSync(paths.notice, 'utf8')).toBe('notice committed\n')
    expect(verifyLockedSkills({ repoRoot, cacheDir })).toEqual({
      cacheDir,
      sources: [{
        source: 'test-source',
        commit: entry.commit,
        licenseFile: entry.licenseFile,
        noticeFile: entry.noticeFile,
      }],
      skills: [{
        name: entry.name,
        source: entry.source,
        commit: entry.commit,
        path: entry.path,
        treeSha256: entry.treeSha256,
      }],
    })
  })

  it('reuses a complete cache without opening unavailable source roots', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })
    rmSync(source.repository, { recursive: true, force: true })

    expect(syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })).toMatchObject({
      sources: [{ status: 'reused' }],
      skills: [{ status: 'reused' }],
    })
  })

  it('uses no Git process for verify or a second complete-cache sync', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })
    rmSync(source.repository, { recursive: true, force: true })

    const logPath = join(repoRoot, 'git-sentinel.log')
    const proxyRoot = installFailingGitSentinel(logPath)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(verifyLockedSkills({ repoRoot, cacheDir }).skills).toHaveLength(1)
      expect(syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })).toMatchObject({
        sources: [{ status: 'reused' }],
        skills: [{ status: 'reused' }],
      })
    } finally {
      process.env.PATH = priorPath
    }
    expect(existsSync(logPath)).toBe(false)
  })

  it.each([
    ['missing NOTICE', (paths) => unlinkSync(paths.notice), /NOTICE|notice/i],
    ['changed LICENSE', (paths) => writeFileSync(paths.license, 'changed'), /LICENSE|license/i],
    ['extra snapshot file', (paths) => write(paths.snapshot, 'unexpected.txt', 'extra'), /unexpected|closure/i],
    ['missing skill file', (paths) => unlinkSync(join(paths.skill, 'SKILL.md')), /SKILL\.md|missing/i],
    ['changed skill bytes', (paths) => writeFileSync(join(paths.skill, 'SKILL.md'), 'changed'), /skill|checksum|sha/i],
  ])('fails closed for %s', (_name, mutate, message) => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })
    const paths = cachePaths(cacheDir, entry)
    mutate(paths)

    expect(() => verifyLockedSkills({ repoRoot, cacheDir })).toThrow(message)
    expect(() => syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })).toThrow(message)
  })

  it.runIf(process.platform !== 'win32')(
    'rejects symlinked legal files and executable-bit drift',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const repoRoot = rampRoot(source, [entry])
      const cacheDir = join(repoRoot, 'cache')
      syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })
      const paths = cachePaths(cacheDir, entry)
      unlinkSync(paths.notice)
      symlinkSync(paths.license, paths.notice)
      expect(() => verifyLockedSkills({ repoRoot, cacheDir })).toThrow(
        /NOTICE|symbolic|symlink/i,
      )

      unlinkSync(paths.notice)
      writeFileSync(paths.notice, 'notice committed\n')
      chmodSync(join(paths.skill, 'scripts', 'check.sh'), 0o644)
      expect(() => verifyLockedSkills({ repoRoot, cacheDir })).toThrow(
        /executable|mode/i,
      )
      expect(() => verifyLockedSkills({
        repoRoot,
        cacheDir,
        platform: 'win32',
      })).not.toThrow()
    },
  )

  it('fails an offline miss with source, commit, object cache, and remediation', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    expect(() => syncLockedSkills({
      repoRoot,
      cacheDir,
      allowNetwork: false,
    })).toThrow(
      new RegExp(`test-source[\\s\\S]*${entry.commit}[\\s\\S]*repositories[\\s\\S]*source-root|network`, 'i'),
    )
  })

  it('fails an offline miss before Git, fetch, or credential helpers can run', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    const logPath = join(repoRoot, 'git-sentinel.log')
    const proxyRoot = installFailingGitSentinel(logPath)
    const priorPath = process.env.PATH
    const priorAskPass = process.env.GIT_ASKPASS
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    process.env.GIT_ASKPASS = join(repoRoot, 'credential-helper-must-not-run')
    try {
      expect(() => syncLockedSkills({
        repoRoot,
        cacheDir,
        allowNetwork: false,
      })).toThrow(/offline|source-root|network/i)
    } finally {
      process.env.PATH = priorPath
      if (priorAskPass === undefined) delete process.env.GIT_ASKPASS
      else process.env.GIT_ASKPASS = priorAskPass
    }
    expect(existsSync(logPath)).toBe(false)
  })

  it('acquires a bare repository through staged init/fetch with the exact registry origin', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const canonicalRepoRoot = realpathSync(repoRoot)
    const cacheDir = join(canonicalRepoRoot, 'cache')
    const logPath = join(canonicalRepoRoot, 'git-proxy.log')
    const proxyRoot = installLocalGitProxy(source.repository, logPath)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      syncLockedSkills({
        repoRoot: canonicalRepoRoot,
        cacheDir,
        allowNetwork: true,
      })
    } finally {
      process.env.PATH = priorPath
    }

    const repositoryCache = join(cacheDir, 'repositories', 'test-source.git')
    expect(git(repositoryCache, [
      `--git-dir=${repositoryCache}`,
      'config',
      '--get',
      'remote.origin.url',
    ])).toBe(repositoryUrl)
    const calls = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(calls.some((args) => args.includes('init') && args.includes('--bare'))).toBe(true)
    expect(calls.some((args) => args.includes('fetch'))).toBe(true)
    expect(calls.some((args) => args.includes('clone'))).toBe(false)
  })

  it('revalidates and reuses a valid concurrent repository-cache winner', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = realpathSync(rampRoot(source, [entry]))
    const cacheDir = join(repoRoot, 'cache')
    const destination = join(cacheDir, 'repositories', 'test-source.git')
    const winnerTemplate = join(tempRoot('ramp-valid-winner-'), 'winner.git')
    execFileSync(realGit, [
      'clone',
      '--bare',
      '--quiet',
      source.repository,
      winnerTemplate,
    ], { env: gitEnv })
    execFileSync(realGit, [
      `--git-dir=${winnerTemplate}`,
      'config',
      'remote.origin.url',
      repositoryUrl,
    ], { env: gitEnv })
    const logPath = join(repoRoot, 'git-winner.log')
    const proxyRoot = installAcquisitionWinnerProxy({
      sourceRepository: source.repository,
      destination,
      winnerTemplate,
      logPath,
    })
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(syncLockedSkills({
        repoRoot,
        cacheDir,
        allowNetwork: true,
      })).toMatchObject({
        sources: [{ status: 'materialized' }],
        skills: [{ name: 'aws-iam', status: 'materialized' }],
      })
    } finally {
      process.env.PATH = priorPath
    }

    expect(verifyLockedSkills({ repoRoot, cacheDir }).skills).toHaveLength(1)
    expect(git(destination, [
      `--git-dir=${destination}`,
      'config',
      '--get',
      'remote.origin.url',
    ])).toBe(repositoryUrl)
  })

  it('rejects a corrupt concurrent repository-cache winner without replacing it', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = realpathSync(rampRoot(source, [entry]))
    const cacheDir = join(repoRoot, 'cache')
    const destination = join(cacheDir, 'repositories', 'test-source.git')
    const marker = join(destination, 'attacker-marker')
    const logPath = join(repoRoot, 'git-winner.log')
    const proxyRoot = installAcquisitionWinnerProxy({
      sourceRepository: source.repository,
      destination,
      winnerTemplate: null,
      logPath,
    })
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(() => syncLockedSkills({
        repoRoot,
        cacheDir,
        allowNetwork: true,
      })).toThrow(/repository cache|bare|invalid/i)
    } finally {
      process.env.PATH = priorPath
    }

    expect(readFileSync(marker, 'utf8')).toBe('do not replace\n')
    expect(existsSync(cachePaths(cacheDir, entry).snapshot)).toBe(false)
  })

  it('does not publish a valid LICENSE when a later NOTICE check fails', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    entry.noticeFile.sha256 = '0'.repeat(64)
    const repoRoot = rampRoot(source, [entry])
    const canonicalRepoRoot = realpathSync(repoRoot)
    const cacheDir = join(canonicalRepoRoot, 'cache')
    const paths = cachePaths(cacheDir, entry)

    expect(() => syncLockedSkills({
      repoRoot: canonicalRepoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })).toThrow(/NOTICE|notice|lock/i)
    expect(existsSync(paths.snapshot)).toBe(false)
    expect(existsSync(paths.license)).toBe(false)
  })

  it('leaves no final snapshot when complete staging is corrupted before verification', () => {
    const source = raceSourceRepository()
    const entry = lockedEntry(source, { commitId: source.race })
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    const otherStaging = join(cacheDir, '.tmp', 'other-operation')
    write(otherStaging, 'marker', 'other operation\n')
    const race = startCacheRace({
      cacheDir,
      entry,
      action: 'corrupt-stage',
    })
    try {
      expect(() => syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })).toThrow(/checksum|sha|skill|corrupt/i)
    } finally {
      race.child.kill()
    }

    expect(readFileSync(race.marker, 'utf8')).toBe('done\n')
    expect(existsSync(cachePaths(cacheDir, entry).snapshot)).toBe(false)
    expect(readFileSync(join(otherStaging, 'marker'), 'utf8'))
      .toBe('other operation\n')
    expect(readdirSync(join(cacheDir, '.tmp'))).toEqual(['other-operation'])
  })

  it.runIf(process.platform !== 'win32')(
    'cleans only owned staging when the atomic snapshot rename fails',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const repoRoot = rampRoot(source, [entry])
      const cacheDir = join(repoRoot, 'cache')
      const sourceParent = join(cacheDir, 'sources', 'test-source')
      const otherStaging = join(cacheDir, '.tmp', 'other-operation')
      write(otherStaging, 'marker', 'other operation\n')
      mkdirSync(sourceParent, { recursive: true })
      chmodSync(sourceParent, 0o555)
      try {
        expect(() => syncLockedSkills({
          repoRoot,
          cacheDir,
          sourceRoots: new Map([['test-source', source.repository]]),
          allowNetwork: false,
        })).toThrow()
      } finally {
        chmodSync(sourceParent, 0o755)
      }

      expect(existsSync(cachePaths(cacheDir, entry).snapshot)).toBe(false)
      expect(readFileSync(join(otherStaging, 'marker'), 'utf8'))
        .toBe('other operation\n')
      expect(readdirSync(join(cacheDir, '.tmp'))).toEqual(['other-operation'])
    },
  )

  it('verifies and reuses a valid concurrent snapshot winner', () => {
    const source = raceSourceRepository()
    const entry = lockedEntry(source, { commitId: source.race })
    const repoRoot = rampRoot(source, [entry])
    const sourceCache = join(repoRoot, 'source-cache')
    syncLockedSkills({
      repoRoot,
      cacheDir: sourceCache,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })
    const cacheDir = join(repoRoot, 'cache')
    const destination = cachePaths(cacheDir, entry).snapshot
    const race = startCacheRace({
      cacheDir,
      entry,
      action: 'valid-winner',
      destination,
      source: cachePaths(sourceCache, entry).snapshot,
    })
    let result
    try {
      result = syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })
    } finally {
      race.child.kill()
    }

    expect(readFileSync(race.marker, 'utf8')).toBe('done\n')
    expect(result).toMatchObject({
      sources: [{ status: 'materialized' }],
      skills: [{ status: 'materialized' }],
    })
    expect(verifyLockedSkills({ repoRoot, cacheDir }).skills).toHaveLength(1)
  })

  it('rejects a corrupt concurrent snapshot winner without replacing it', () => {
    const source = raceSourceRepository()
    const entry = lockedEntry(source, { commitId: source.race })
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    const destination = cachePaths(cacheDir, entry).snapshot
    const race = startCacheRace({
      cacheDir,
      entry,
      action: 'corrupt-winner',
      destination,
    })
    try {
      expect(() => syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })).toThrow(/closure|unexpected|corrupt|skill|LICENSE|NOTICE/i)
    } finally {
      race.child.kill()
    }

    expect(readFileSync(race.marker, 'utf8')).toBe('done\n')
    expect(readFileSync(join(destination, 'attacker-marker'), 'utf8'))
      .toBe('do not replace\n')
  })

  it.runIf(process.platform !== 'win32')(
    'rejects a snapshot ancestor replaced by a symlink before publication',
    () => {
      const source = raceSourceRepository()
      const entry = lockedEntry(source, { commitId: source.race })
      const repoRoot = rampRoot(source, [entry])
      const cacheDir = join(repoRoot, 'cache')
      const outside = tempRoot('ramp-race-outside-')
      const destination = join(cacheDir, 'sources', 'test-source')
      const race = startCacheRace({
        cacheDir,
        entry,
        action: 'symlink-ancestor',
        destination,
        source: outside,
      })
      try {
        expect(() => syncLockedSkills({
          repoRoot,
          cacheDir,
          sourceRoots: new Map([['test-source', source.repository]]),
          allowNetwork: false,
        })).toThrow(/symbolic|symlink|cache/i)
      } finally {
        race.child.kill()
      }

      expect(readFileSync(race.marker, 'utf8')).toBe('done\n')
      expect(readdirSync(outside)).toEqual([])
    },
  )

  it('uses resolveCacheDir precedence and verify never creates cache', () => {
    const source = sourceRepository()
    const repoRoot = rampRoot(source)
    const explicit = join(repoRoot, 'explicit')
    const environment = join(repoRoot, 'environment')
    expect(() => verifyLockedSkills({
      repoRoot,
      cacheDir: explicit,
      env: environment,
    })).toThrow(/cache|missing|source/i)
    expect(existsSync(explicit)).toBe(false)
    expect(existsSync(environment)).toBe(false)
  })

  it('leaves present corrupt cache content in place without fallback', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    const paths = cachePaths(cacheDir, entry)
    write(paths.skill, 'SKILL.md', 'corrupt')

    expect(() => syncLockedSkills({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      allowNetwork: false,
    })).toThrow(/corrupt|skill|checksum|count/i)
    expect(readFileSync(join(paths.skill, 'SKILL.md'), 'utf8')).toBe('corrupt')
    expect(existsSync(paths.license)).toBe(false)
  })

  it.runIf(process.platform !== 'win32')(
    'rejects a symlinked cache ancestor without writing through it',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const repoRoot = rampRoot(source, [entry])
      const outside = tempRoot('ramp-sync-outside-')
      const linked = join(repoRoot, 'linked')
      symlinkSync(outside, linked)
      const cacheDir = join(linked, 'cache')

      expect(() => syncLockedSkills({
        repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })).toThrow(/cache|symbolic|symlink/i)
      expect(existsSync(join(outside, 'cache'))).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'rejects a complete cache reached through a symlink during verify or reuse',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const repoRoot = rampRoot(source, [entry])
      const canonicalRepoRoot = realpathSync(repoRoot)
      const outside = tempRoot('ramp-sync-complete-outside-')
      const realCache = join(realpathSync(outside), 'cache')
      syncLockedSkills({
        repoRoot: canonicalRepoRoot,
        cacheDir: realCache,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })
      const linkedCache = join(canonicalRepoRoot, 'linked-cache')
      symlinkSync(realCache, linkedCache)

      expect(() => verifyLockedSkills({
        repoRoot: canonicalRepoRoot,
        cacheDir: linkedCache,
      })).toThrow(/cache|symbolic|symlink/i)
      expect(() => syncLockedSkills({
        repoRoot: canonicalRepoRoot,
        cacheDir: linkedCache,
        sourceRoots: new Map([['test-source', join(canonicalRepoRoot, 'unavailable')]]),
        allowNetwork: false,
      })).toThrow(/cache|symbolic|symlink/i)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'creates cache directories with stable modes under a restrictive umask',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const repoRoot = rampRoot(source, [entry])
      const cacheDir = join(repoRoot, 'cache')
      const priorUmask = process.umask(0o077)
      try {
        syncLockedSkills({
          repoRoot,
          cacheDir,
          sourceRoots: new Map([['test-source', source.repository]]),
          allowNetwork: false,
        })
      } finally {
        process.umask(priorUmask)
      }

      const paths = cachePaths(cacheDir, entry)
      for (const directory of [
        cacheDir,
        join(cacheDir, 'sources'),
        join(cacheDir, 'sources', entry.source),
        paths.snapshot,
        paths.skill,
      ]) {
        expect(statSync(directory).mode & 0o777, directory).toBe(0o755)
      }
    },
  )
})

describe('deterministic lock updates', () => {
  it('uses an exact selector to resolve same-source name ambiguity', () => {
    const source = sourceRepository()
    addSkill(source.repository, 'alternate/aws-iam', '# Alternate\n')
    const selectedCommit = commit(source.repository, 'ambiguous name')
    const repoRoot = tempRoot('ramp-update-root-')
    writeSources(repoRoot)
    const cacheDir = join(repoRoot, 'cache')

    expect(() => updateSkillLocks({
      repoRoot,
      names: ['aws-iam'],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', selectedCommit]]),
      allowNetwork: false,
    })).toThrow(/multiple|ambiguous|alternate.*skills\/aws-iam/is)
    expect(existsSync(join(repoRoot, 'dependencies', 'skills.lock.yaml'))).toBe(false)

    const result = updateSkillLocks({
      repoRoot,
      selections: [{
        name: 'aws-iam',
        source: 'test-source',
        path: 'skills/aws-iam',
      }],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', selectedCommit]]),
      allowNetwork: false,
    })
    expect(result.updated).toEqual(['aws-iam'])
    expect(result.preserved).toEqual([])
    expect(result.commits).toEqual([{
      source: 'test-source',
      ref: selectedCommit,
      commit: selectedCommit,
    }])
    expect(loadSkillLock(repoRoot, { required: true }).skills.get('aws-iam'))
      .toMatchObject({
        source: 'test-source',
        commit: selectedCommit,
        path: 'skills/aws-iam',
      })
    expect(verifyLockedSkills({ repoRoot, cacheDir }).skills).toHaveLength(1)
  })

  it('uses priority only for a new cross-source name', () => {
    const high = sourceRepository()
    const low = sourceRepository()
    const highUrl = 'https://github.com/aws/high-skills.git'
    const lowUrl = 'https://github.com/awslabs/low-skills.git'
    const repoRoot = tempRoot('ramp-update-priority-')
    writeSources(repoRoot, [
      {
        id: 'high-source',
        repository: highUrl,
        priority: 10,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
      {
        id: 'low-source',
        repository: lowUrl,
        priority: 20,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
    ])

    updateSkillLocks({
      repoRoot,
      names: ['api-gateway'],
      cacheDir: join(repoRoot, 'cache'),
      sourceRoots: new Map([
        ['high-source', high.repository],
        ['low-source', low.repository],
      ]),
      sourceRefs: new Map([
        ['high-source', high.first],
        ['low-source', low.second],
      ]),
      allowNetwork: false,
    })
    expect(loadSkillLock(repoRoot, { required: true }).skills.get('api-gateway'))
      .toMatchObject({
        source: 'high-source',
        commit: high.first,
        path: 'skills/api-gateway',
      })
  })

  it('preserves an existing name-only source/path and relocates only by selector', () => {
    const high = sourceRepository()
    const low = sourceRepository()
    addSkill(high.repository, 'preferred/aws-iam', '# Preferred\n')
    const highCommit = commit(high.repository, 'preferred path')
    const highUrl = 'https://github.com/aws/high-skills.git'
    const lowUrl = 'https://github.com/awslabs/low-skills.git'
    const repoRoot = tempRoot('ramp-update-existing-')
    writeSources(repoRoot, [
      {
        id: 'high-source',
        repository: highUrl,
        priority: 10,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
      {
        id: 'low-source',
        repository: lowUrl,
        priority: 20,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
    ])
    const existing = lockedEntry(low, {
      sourceId: 'low-source',
      repository: lowUrl,
    })
    writeSkillLock(repoRoot, {
      schemaVersion: 1,
      skills: new Map([['aws-iam', existing]]),
    })

    updateSkillLocks({
      repoRoot,
      names: ['aws-iam'],
      cacheDir: join(repoRoot, 'cache'),
      sourceRoots: new Map([['low-source', low.repository]]),
      sourceRefs: new Map([['low-source', low.first]]),
      allowNetwork: false,
    })
    expect(loadSkillLock(repoRoot, { required: true }).skills.get('aws-iam'))
      .toMatchObject({
        source: 'low-source',
        path: 'skills/aws-iam',
      })

    updateSkillLocks({
      repoRoot,
      selections: [{
        name: 'aws-iam',
        source: 'high-source',
        path: 'preferred/aws-iam',
      }],
      cacheDir: join(repoRoot, 'cache'),
      sourceRoots: new Map([['high-source', high.repository]]),
      sourceRefs: new Map([['high-source', highCommit]]),
      allowNetwork: false,
    })
    expect(loadSkillLock(repoRoot, { required: true }).skills.get('aws-iam'))
      .toMatchObject({
        source: 'high-source',
        commit: highCommit,
        path: 'preferred/aws-iam',
      })
  })

  it('captures distinct per-source refs once and preserves unrequested entries', () => {
    const first = sourceRepository()
    const second = sourceRepository()
    const firstRef = 'refs/heads/reviewed-first'
    const secondRef = 'refs/heads/reviewed-second'
    git(first.repository, ['update-ref', firstRef, first.first])
    git(second.repository, ['update-ref', secondRef, second.second])
    const firstUrl = 'https://github.com/aws/first-skills.git'
    const secondUrl = 'https://github.com/awslabs/second-skills.git'
    const repoRoot = tempRoot('ramp-update-refs-')
    writeSources(repoRoot, [
      {
        id: 'first-source',
        repository: firstUrl,
        priority: 10,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
      {
        id: 'second-source',
        repository: secondUrl,
        priority: 20,
        license: 'Apache-2.0',
        licensePath: 'LICENSE',
        noticePath: 'NOTICE',
      },
    ])
    const preserved = lockedEntry(first, {
      name: 'preserved-skill',
      path: 'skills/api-gateway',
      sourceId: 'first-source',
      repository: firstUrl,
    })
    writeSkillLock(repoRoot, {
      schemaVersion: 1,
      skills: new Map([['preserved-skill', preserved]]),
    })

    const logPath = join(repoRoot, 'ref-resolution.log')
    const proxyRoot = installRefMovingGitProxy({
      logPath,
      moves: [
        {
          id: 'first-moved',
          repository: first.repository,
          ref: firstRef,
          commit: first.second,
        },
        {
          id: 'second-moved',
          repository: second.repository,
          ref: secondRef,
          commit: second.first,
        },
      ],
    })
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    let result
    try {
      result = updateSkillLocks({
        repoRoot,
        selections: [
          {
            name: 'aws-iam',
            source: 'first-source',
            path: 'skills/aws-iam',
          },
          {
            name: 'api-gateway',
            source: 'second-source',
            path: 'skills/api-gateway',
          },
        ],
        cacheDir: join(repoRoot, 'cache'),
        sourceRoots: new Map([
          ['first-source', first.repository],
          ['second-source', second.repository],
        ]),
        sourceRefs: new Map([
          ['first-source', firstRef],
          ['second-source', secondRef],
        ]),
        allowNetwork: false,
      })
    } finally {
      process.env.PATH = priorPath
    }
    expect(result.commits).toEqual([
      { source: 'first-source', ref: firstRef, commit: first.first },
      { source: 'second-source', ref: secondRef, commit: second.second },
    ])
    expect(result.preserved).toEqual(['preserved-skill'])
    const lock = loadSkillLock(repoRoot, { required: true })
    expect(lock.skills.get('aws-iam').commit).toBe(first.first)
    expect(lock.skills.get('api-gateway').commit).toBe(second.second)
    expect(lock.skills.get('preserved-skill')).toMatchObject({
      source: 'first-source',
      commit: first.first,
      path: 'skills/api-gateway',
    })
    expect(git(first.repository, ['rev-parse', firstRef])).toBe(first.second)
    expect(git(second.repository, ['rev-parse', secondRef])).toBe(second.first)
    const calls = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(
      calls.filter((args) => args.includes(`${firstRef}^{commit}`)),
    ).toHaveLength(1)
    expect(
      calls.filter((args) => args.includes(`${secondRef}^{commit}`)),
    ).toHaveLength(1)
  })

  it('keeps one captured online ref when a concurrent repository winner appears', () => {
    const source = sourceRepository()
    const sourceRef = 'refs/heads/reviewed-online'
    git(source.repository, ['update-ref', sourceRef, source.first])
    const repoRoot = tempRoot('ramp-update-online-winner-')
    writeSources(repoRoot)
    const cacheDir = join(repoRoot, 'cache')
    const destination = join(cacheDir, 'repositories', 'test-source.git')
    const winnerTemplate = join(tempRoot('ramp-update-winner-template-'), 'winner.git')
    execFileSync(realGit, [
      'clone',
      '--bare',
      '--quiet',
      source.repository,
      winnerTemplate,
    ], { env: gitEnv })
    execFileSync(realGit, [
      `--git-dir=${winnerTemplate}`,
      'config',
      'remote.origin.url',
      repositoryUrl,
    ], { env: gitEnv })
    const logPath = join(repoRoot, 'online-winner.log')
    const proxyRoot = installMovingUpdateWinnerProxy({
      sourceRepository: source.repository,
      destination,
      winnerTemplate,
      ref: sourceRef,
      newCommit: source.second,
      logPath,
    })
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    let result
    try {
      result = updateSkillLocks({
        repoRoot,
        selections: [{
          name: 'aws-iam',
          source: 'test-source',
          path: 'skills/aws-iam',
        }],
        cacheDir,
        sourceRefs: new Map([['test-source', sourceRef]]),
        allowNetwork: true,
      })
    } finally {
      process.env.PATH = priorPath
    }

    expect(result.commits).toEqual([{
      source: 'test-source',
      ref: sourceRef,
      commit: source.first,
    }])
    expect(loadSkillLock(repoRoot, { required: true }).skills.get('aws-iam'))
      .toMatchObject({ commit: source.first })
    const calls = readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(
      calls.filter((args) =>
        args.includes('fetch') && args.includes(sourceRef)),
    ).toHaveLength(1)
  })

  it('leaves the existing lock byte-identical on selection failure and regenerates deterministically', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const cacheDir = join(repoRoot, 'cache')
    const lockPath = join(repoRoot, 'dependencies', 'skills.lock.yaml')
    const before = readFileSync(lockPath)
    expect(() => updateSkillLocks({
      repoRoot,
      selections: [{
        name: 'aws-iam',
        source: 'test-source',
        path: 'missing/aws-iam',
      }],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', source.first]]),
      allowNetwork: false,
    })).toThrow(/missing|tree|aws-iam/i)
    expect(readFileSync(lockPath)).toEqual(before)

    updateSkillLocks({
      repoRoot,
      names: ['aws-iam'],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', source.first]]),
      allowNetwork: false,
    })
    const once = readFileSync(lockPath)
    updateSkillLocks({
      repoRoot,
      names: ['aws-iam'],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', source.first]]),
      allowNetwork: false,
    })
    expect(readFileSync(lockPath)).toEqual(once)
  })

  it('scrubs hostile ambient Git variables during name discovery', () => {
    const source = sourceRepository()
    const repoRoot = tempRoot('ramp-update-git-env-')
    writeSources(repoRoot)
    const cacheDir = join(repoRoot, 'cache')
    const hostileGitDir = join(repoRoot, 'hostile.git')
    git(repoRoot, ['init', '--bare', hostileGitDir])
    const priorGitDir = process.env.GIT_DIR
    const priorNoLazyFetch = process.env.GIT_NO_LAZY_FETCH
    process.env.GIT_DIR = hostileGitDir
    process.env.GIT_NO_LAZY_FETCH = '0'
    try {
      updateSkillLocks({
        repoRoot,
        names: ['aws-iam'],
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })
    } finally {
      if (priorGitDir === undefined) delete process.env.GIT_DIR
      else process.env.GIT_DIR = priorGitDir
      if (priorNoLazyFetch === undefined) delete process.env.GIT_NO_LAZY_FETCH
      else process.env.GIT_NO_LAZY_FETCH = priorNoLazyFetch
    }

    expect(loadSkillLock(repoRoot, { required: true }).skills.get('aws-iam'))
      .toMatchObject({
        source: 'test-source',
        commit: source.first,
        path: 'skills/aws-iam',
      })
  })

  it('detects a concurrent raw lock change before atomic publication', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const canonicalRepoRoot = realpathSync(repoRoot)
    const lockPath = join(canonicalRepoRoot, 'dependencies', 'skills.lock.yaml')
    const replacement = 'concurrent writer content\n'
    const proxyRoot = installMutatingGitProxy(lockPath, replacement)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(() => updateSkillLocks({
        repoRoot: canonicalRepoRoot,
        names: ['aws-iam'],
        cacheDir: join(canonicalRepoRoot, 'cache'),
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })).toThrow(/concurrent|changed|compare-and-swap|CAS/i)
    } finally {
      process.env.PATH = priorPath
    }
    expect(readFileSync(lockPath, 'utf8')).toBe(replacement)
    expect(readdirSync(dirname(lockPath))).not.toContain('.skills.lock.yaml.update-lock')
    expect(
      readdirSync(dirname(lockPath))
        .filter((name) => name.startsWith('.skills.lock.yaml.') && name.endsWith('.tmp')),
    ).toEqual([])
  })

  it('detects a concurrent initial lock creation and preserves the winner', () => {
    const source = sourceRepository()
    const repoRoot = tempRoot('ramp-update-absent-cas-')
    writeSources(repoRoot)
    const canonicalRepoRoot = realpathSync(repoRoot)
    const lockPath = join(canonicalRepoRoot, 'dependencies', 'skills.lock.yaml')
    const replacement = 'concurrent initial creator\n'
    const proxyRoot = installMutatingGitProxy(lockPath, replacement)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(() => updateSkillLocks({
        repoRoot: canonicalRepoRoot,
        selections: [{
          name: 'aws-iam',
          source: 'test-source',
          path: 'skills/aws-iam',
        }],
        cacheDir: join(canonicalRepoRoot, 'cache'),
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })).toThrow(/concurrent|changed|compare-and-swap|CAS/i)
    } finally {
      process.env.PATH = priorPath
    }
    expect(readFileSync(lockPath, 'utf8')).toBe(replacement)
    expect(readdirSync(dirname(lockPath))).not.toContain('.skills.lock.yaml.update-lock')
  })

  it('detects a concurrent raw source-registry change before lock publication', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const canonicalRepoRoot = realpathSync(repoRoot)
    const lockPath = join(canonicalRepoRoot, 'dependencies', 'skills.lock.yaml')
    const sourcePath = join(
      canonicalRepoRoot,
      'dependencies',
      'skills.sources.yaml',
    )
    const beforeLock = readFileSync(lockPath)
    const replacement = `${readFileSync(sourcePath, 'utf8')}# concurrent writer\n`
    const proxyRoot = installMutatingGitProxy(sourcePath, replacement)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(() => updateSkillLocks({
        repoRoot: canonicalRepoRoot,
        names: ['aws-iam'],
        cacheDir: join(canonicalRepoRoot, 'cache'),
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })).toThrow(/source registry|concurrent|changed|compare-and-swap|CAS/i)
    } finally {
      process.env.PATH = priorPath
    }
    expect(readFileSync(lockPath)).toEqual(beforeLock)
    expect(readFileSync(sourcePath, 'utf8')).toBe(replacement)
    expect(readdirSync(dirname(lockPath))).not.toContain('.skills.lock.yaml.update-lock')
  })

  it('does not remove another update operation guard', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const guardPath = join(repoRoot, 'dependencies', '.skills.lock.yaml.update-lock')
    const cacheDir = join(repoRoot, 'cache')
    writeFileSync(guardPath, 'other operation\n')

    expect(() => updateSkillLocks({
      repoRoot,
      names: ['aws-iam'],
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', source.first]]),
      allowNetwork: false,
    })).toThrow(/exclusive guard|another update/i)
    expect(readFileSync(guardPath, 'utf8')).toBe('other operation\n')
    expect(existsSync(cacheDir)).toBe(false)
  })

  it('refuses a replaced update guard and never deletes the replacement', () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const lockPath = join(repoRoot, 'dependencies', 'skills.lock.yaml')
    const beforeLock = readFileSync(lockPath)
    const guardPath = join(
      repoRoot,
      'dependencies',
      '.skills.lock.yaml.update-lock',
    )
    const replacement = 'replacement guard owned by another operation\n'
    const proxyRoot = installMutatingGitProxy(guardPath, replacement)
    const priorPath = process.env.PATH
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      expect(() => updateSkillLocks({
        repoRoot,
        names: ['aws-iam'],
        cacheDir: join(repoRoot, 'cache'),
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })).toThrow()
    } finally {
      process.env.PATH = priorPath
    }
    expect(readFileSync(lockPath)).toEqual(beforeLock)
    expect(readFileSync(guardPath, 'utf8')).toBe(replacement)
  })

  it('keeps the lock byte-identical and cleans owned files when atomic rename fails', async () => {
    const source = sourceRepository()
    const entry = lockedEntry(source)
    const repoRoot = rampRoot(source, [entry])
    const lockPath = join(repoRoot, 'dependencies', 'skills.lock.yaml')
    const beforeLock = readFileSync(lockPath)
    const actualFs = await vi.importActual('node:fs')
    vi.resetModules()
    vi.doMock('node:fs', () => ({
      ...actualFs,
      renameSync(from, to) {
        if (
          String(from).includes('.skills.lock.yaml.') &&
          String(from).endsWith('.tmp') &&
          String(to).endsWith('skills.lock.yaml')
        ) {
          const error = new Error('injected atomic lock rename failure')
          error.code = 'EIO'
          throw error
        }
        return actualFs.renameSync(from, to)
      },
    }))
    try {
      const isolated = await import('../src/dependencies/sync.js')
      expect(() => isolated.updateSkillLocks({
        repoRoot,
        names: ['aws-iam'],
        cacheDir: join(repoRoot, 'cache'),
        sourceRoots: new Map([['test-source', source.repository]]),
        sourceRefs: new Map([['test-source', source.first]]),
        allowNetwork: false,
      })).toThrow(/injected atomic lock rename failure/i)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
    }

    expect(readFileSync(lockPath)).toEqual(beforeLock)
    const dependencies = readdirSync(dirname(lockPath))
    expect(dependencies).not.toContain('.skills.lock.yaml.update-lock')
    expect(
      dependencies.filter((name) =>
        name.startsWith('.skills.lock.yaml.') && name.endsWith('.tmp')),
    ).toEqual([])
  })

  it.each([
    [{ names: [] }, /at least one|requested/i],
    [{ names: ['aws-iam', 'aws-iam'] }, /duplicate.*aws-iam/i],
    [{
      names: ['aws-iam'],
      selections: [{
        name: 'aws-iam',
        source: 'test-source',
        path: 'skills/aws-iam',
      }],
    }, /duplicate.*aws-iam/i],
    [{
      selections: [{
        name: 'aws-iam',
        source: 'unknown-source',
        path: 'skills/aws-iam',
      }],
    }, /unknown-source|not declared/i],
    [{
      selections: [{
        name: 'aws-iam',
        source: 'test-source',
        path: 'skills/not-the-name',
      }],
    }, /final.*segment|aws-iam/i],
  ])('rejects invalid update input before cache/lock writes %#', (request, message) => {
    const source = sourceRepository()
    const repoRoot = tempRoot('ramp-update-invalid-')
    writeSources(repoRoot)
    const cacheDir = join(repoRoot, 'cache')
    expect(() => updateSkillLocks({
      repoRoot,
      cacheDir,
      sourceRoots: new Map([['test-source', source.repository]]),
      sourceRefs: new Map([['test-source', source.first]]),
      allowNetwork: false,
      ...request,
    })).toThrow(message)
    expect(existsSync(cacheDir)).toBe(false)
    expect(existsSync(join(repoRoot, 'dependencies', 'skills.lock.yaml'))).toBe(false)
  })
})

describe('skills CLI', () => {
  function runCli(args, executable = cli, env = process.env) {
    return spawnSync(process.execPath, [executable, ...args], {
      encoding: 'utf8',
      env,
    })
  }

  it('lists nested verify, sync, and update-lock commands', () => {
    const result = runCli(['skills', '--help'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/\bverify\b/)
    expect(result.stdout).toMatch(/\bsync\b/)
    expect(result.stdout).toMatch(/\bupdate-lock\b/)
  })

  it.each([
    [['skills', 'verify', '--offline'], /unknown option.*offline/i],
    [['skills', 'sync', '--offline'], /locked|required/i],
    [['skills', 'update-lock', '--offline'], /skill|select|requested/i],
    [[
      'skills',
      'update-lock',
      '--skill',
      'aws-iam',
      '--select',
      'aws-iam=test-source:skills/aws-iam',
      '--offline',
    ], /duplicate.*aws-iam/i],
    [[
      'skills',
      'sync',
      '--locked',
      '--source-root',
      'malformed',
      '--offline',
    ], /source-root|=/i],
    [[
      'skills',
      'sync',
      '--locked',
      '--source-root',
      'test-source=/first',
      '--source-root',
      'test-source=/second',
      '--offline',
    ], /duplicate.*source-root.*test-source/i],
    [[
      'skills',
      'update-lock',
      '--skill',
      'aws-iam',
      '--ref',
      'test-source=main',
      '--ref',
      'test-source=other',
      '--offline',
    ], /duplicate.*ref.*test-source/i],
  ])('fails actionable CLI validation for %#', (args, message) => {
    const result = runCli(args)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(message)
  })

  it.runIf(process.platform !== 'win32')(
    'parses repeated roots, refs, and selectors with deterministic success output',
    () => {
      const first = sourceRepository()
      const second = sourceRepository()
      const project = isolatedCliProject()
      const firstUrl = 'https://github.com/aws/first-skills.git'
      const secondUrl = 'https://github.com/awslabs/second-skills.git'
      writeSources(project.repoRoot, [
        {
          id: 'first-source',
          repository: firstUrl,
          priority: 10,
          license: 'Apache-2.0',
          licensePath: 'LICENSE',
          noticePath: 'NOTICE',
        },
        {
          id: 'second-source',
          repository: secondUrl,
          priority: 20,
          license: 'Apache-2.0',
          licensePath: 'LICENSE',
          noticePath: 'NOTICE',
        },
      ])
      const cacheDir = join(project.repoRoot, 'cache')
      const args = [
        'skills',
        'update-lock',
        '--select',
        'aws-iam=first-source:skills/aws-iam',
        '--select',
        'api-gateway=second-source:skills/api-gateway',
        '--ref',
        `first-source=${first.first}`,
        '--ref',
        `second-source=${second.second}`,
        '--source-root',
        `first-source=${first.repository}`,
        '--source-root',
        `second-source=${second.repository}`,
        '--cache',
        cacheDir,
        '--offline',
      ]

      const firstRun = runCli(args, project.cli)
      expect(firstRun.status, firstRun.stderr).toBe(0)
      const secondRun = runCli(args, project.cli)
      expect(secondRun.status, secondRun.stderr).toBe(0)
      expect(secondRun.stdout).toBe(firstRun.stdout)
      expect(firstRun.stdout).toMatch(
        /first-source: [^\n]+ -> [0-9a-f]{40}\nsecond-source: [^\n]+ -> [0-9a-f]{40}/,
      )
      expect(firstRun.stdout).toMatch(/Updated: api-gateway, aws-iam/)
      const lock = loadSkillLock(project.repoRoot, { required: true })
      expect([...lock.skills]).toHaveLength(2)
      expect(lock.skills.get('aws-iam')).toMatchObject({
        source: 'first-source',
        commit: first.first,
      })
      expect(lock.skills.get('api-gateway')).toMatchObject({
        source: 'second-source',
        commit: second.second,
      })
    },
  )

  it.runIf(process.platform !== 'win32')(
    'uses no Git process for CLI verify or complete-cache offline sync',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const project = isolatedCliProject()
      writeSources(project.repoRoot)
      writeSkillLock(project.repoRoot, {
        schemaVersion: 1,
        skills: new Map([[entry.name, entry]]),
      })
      const cacheDir = join(project.repoRoot, 'cache')
      syncLockedSkills({
        repoRoot: project.repoRoot,
        cacheDir,
        sourceRoots: new Map([['test-source', source.repository]]),
        allowNetwork: false,
      })
      const logPath = join(project.repoRoot, 'git-sentinel.log')
      const proxyRoot = installFailingGitSentinel(logPath)
      const env = {
        ...process.env,
        PATH: `${proxyRoot}${delimiter}${process.env.PATH}`,
      }

      const verified = runCli(
        ['skills', 'verify', '--cache', cacheDir],
        project.cli,
        env,
      )
      expect(verified.status, verified.stderr).toBe(0)
      expect(verified.stdout).toMatch(/Verified 1 locked skill/)
      const synced = runCli([
        'skills',
        'sync',
        '--locked',
        '--cache',
        cacheDir,
        '--source-root',
        `test-source=${join(project.repoRoot, 'unavailable-source')}`,
        '--offline',
      ], project.cli, env)
      expect(synced.status, synced.stderr).toBe(0)
      expect(synced.stdout).toMatch(/test-source@[0-9a-f]{40} reused/)
      expect(existsSync(logPath)).toBe(false)
    },
  )

  it.runIf(process.platform !== 'win32')(
    'keeps CLI offline cache misses away from Git and credential helpers',
    () => {
      const source = sourceRepository()
      const entry = lockedEntry(source)
      const project = isolatedCliProject()
      writeSources(project.repoRoot)
      writeSkillLock(project.repoRoot, {
        schemaVersion: 1,
        skills: new Map([[entry.name, entry]]),
      })
      const cacheDir = join(project.repoRoot, 'missing-cache')
      const logPath = join(project.repoRoot, 'git-sentinel.log')
      const proxyRoot = installFailingGitSentinel(logPath)
      const env = {
        ...process.env,
        PATH: `${proxyRoot}${delimiter}${process.env.PATH}`,
        GIT_ASKPASS: join(project.repoRoot, 'credential-helper-must-not-run'),
      }

      const result = runCli([
        'skills',
        'sync',
        '--locked',
        '--cache',
        cacheDir,
        '--offline',
      ], project.cli, env)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/offline|source-root|network/i)
      expect(existsSync(logPath)).toBe(false)
    },
  )
})

describe('committed immutable skill lock', () => {
  const compatibilityMirrors = [
    ['amazon-aurora-mysql', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/database-skills/amazon-aurora-mysql'],
    ['amazon-aurora-postgresql', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/database-skills/amazon-aurora-postgresql'],
    ['api-gateway', 'agent-plugins', '097fe8ad56d8a1d5e2c81d7880adf145553cf244', 'plugins/aws-serverless/skills/api-gateway'],
    ['aurora-dsql', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/database-skills/aurora-dsql'],
    ['aws-iam', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/core-skills/aws-iam'],
    ['aws-lambda', 'agent-plugins', '097fe8ad56d8a1d5e2c81d7880adf145553cf244', 'plugins/aws-serverless/skills/aws-lambda'],
    ['aws-step-functions', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/serverless-skills/aws-step-functions'],
    ['connecting-lambda-to-api-gateway', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/serverless-skills/connecting-lambda-to-api-gateway'],
    ['creating-amazon-aurora-db-cluster-with-instances', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/specialized-skills/database-skills/creating-amazon-aurora-db-cluster-with-instances'],
    ['signing-in-to-aws', 'agent-toolkit-for-aws', 'b6d5b7894cc8ae875307f232830acdad683164dc', 'skills/core-skills/signing-in-to-aws'],
  ]

  const expectedLockNames = [
    'amazon-aurora-mysql',
    'amazon-aurora-postgresql',
    'amazon-bedrock',
    'api-gateway',
    'aurora-dsql',
    'aws-cloudformation',
    'aws-iam',
    'aws-lambda',
    'aws-lambda-durable-functions',
    'aws-lambda-microvms',
    'aws-observability',
    'aws-step-functions',
    'connecting-lambda-to-api-gateway',
    'creating-amazon-aurora-db-cluster-with-instances',
    'signing-in-to-aws',
  ]

  it('pins all 15 locks and verifies the ten compatibility mirrors without cache or upstream checkouts', () => {
    const lock = loadSkillLock(projectRoot, { required: true })
    expect([...lock.skills.keys()]).toEqual(expectedLockNames)

    const legalBySourceCommit = new Map()
    for (const [name, source, commit, path] of compatibilityMirrors) {
      const skill = lock.skills.get(name)
      expect(skill).toMatchObject({ name, source, commit, path })

      const legal = {
        licenseFile: skill.licenseFile,
        noticeFile: skill.noticeFile,
      }
      const group = `${source}\0${commit}`
      if (legalBySourceCommit.has(group)) {
        expect(legal).toEqual(legalBySourceCommit.get(group))
      } else {
        legalBySourceCommit.set(group, legal)
      }

      expect(() => verifyLockedSkillDirectory(
        join(projectRoot, 'skills-library', name),
        skill,
      )).not.toThrow()
    }
    expect(legalBySourceCommit.size).toBe(2)
  })
})

// Git for Windows opens the literal '/dev/null' as NUL but cannot open
// os.devNull's '\\.\nul' as a config file, so `skills sync` failed on Windows.
describe('Git environment', () => {
  it('points GIT_CONFIG_GLOBAL at the literal /dev/null, never os.devNull', async () => {
    const source = sourceRepository()
    const repoRoot = realpathSync(rampRoot(source))
    const cacheDir = join(repoRoot, 'cache')
    const proxyRoot = installLocalGitProxy(source.repository, join(repoRoot, 'git-proxy.log'))
    const priorPath = process.env.PATH
    const require = createRequire(import.meta.url)
    const os = require('node:os')
    const childProcess = require('node:child_process')
    const devNull = Object.getOwnPropertyDescriptor(os, 'devNull')
    const spawnGit = childProcess.spawnSync
    // module name -> GIT_CONFIG_GLOBAL values of its Git processes
    const seen = new Map()
    childProcess.spawnSync = function recordingSpawn(command, args, options) {
      if (command === 'git') {
        const caller = new Error().stack.match(/src\/dependencies\/([a-z-]+)\.js/)?.[1]
        seen.set(caller, [...new Set([...(seen.get(caller) ?? []), options?.env?.GIT_CONFIG_GLOBAL])])
      }
      return spawnGit.call(this, command, args, options)
    }
    // Load both modules afresh with the Windows value of os.devNull.
    Object.defineProperty(os, 'devNull', { ...devNull, value: '\\\\.\\nul' })
    syncBuiltinESMExports()
    vi.resetModules()
    // The proxy serves the registry URL from the local source, so sync runs
    // the network acquisition (init --bare, fetch) that failed on Windows.
    process.env.PATH = `${proxyRoot}${delimiter}${priorPath}`
    try {
      const fresh = await import('../src/dependencies/sync.js')
      fresh.syncLockedSkills({ repoRoot, cacheDir, allowNetwork: true })
    } finally {
      process.env.PATH = priorPath
      Object.defineProperty(os, 'devNull', devNull)
      childProcess.spawnSync = spawnGit
      syncBuiltinESMExports()
      vi.resetModules()
    }
    expect(Object.fromEntries(seen)).toEqual({
      'git-snapshot': ['/dev/null'],
      sync: ['/dev/null'],
    })
  })
})
