// Contract for the release CI: helper coverage on Linux and Windows, a
// twice-built byte comparison, artifact upload before any publish, a publish
// job gated on a tag plus publish=true, and least-privilege tokens.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { releaseInvocations } from '../../scripts/verify-release-determinism.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const script = join(repoRoot, 'scripts', 'verify-release-determinism.mjs')

function workflow(name) {
  return parse(readFileSync(join(repoRoot, '.github', 'workflows', name), 'utf8'))
}

function runOf(step) {
  return String(step?.run ?? '')
}

function stepIndex(steps, predicate) {
  return steps.findIndex((step) => predicate(step, runOf(step)))
}

function allSteps(definition) {
  return Object.values(definition.jobs).flatMap((job) => job.steps ?? [])
}

const WRITE_SCOPES = new Set(['write'])

function writeScopes(permissions) {
  if (permissions === undefined) return []
  if (typeof permissions === 'string') return permissions.includes('write') ? [permissions] : []
  return Object.entries(permissions)
    .filter(([, level]) => WRITE_SCOPES.has(level))
    .map(([scope]) => scope)
}

describe('build-packs workflow helper coverage', () => {
  const definition = workflow('build-packs.yml')
  const helpers = definition.jobs.helpers
  const matrix = helpers?.strategy?.matrix?.include ?? []
  const entry = (os) => matrix.find((item) => item.os === os)

  it('verifies pushes to the integration branch with a read-only token for every job', () => {
    expect(definition.on.push.branches).toEqual(['main', 'revamp-starter-packs'])
    expect(definition.permissions).toEqual({ contents: 'read' })
    for (const job of Object.values(definition.jobs)) expect(writeScopes(job.permissions)).toEqual([])
  })

  it('runs Bash helper scenarios on Linux and PowerShell scenarios on Windows', () => {
    expect(helpers['runs-on']).toBe('${{ matrix.os }}')
    expect(helpers.strategy['fail-fast']).toBe(false)
    expect(entry('ubuntu-latest').tests).toContain('test/install-bash.test.js')
    expect(entry('ubuntu-latest').tests).toContain('test/install-powershell.test.js')
    expect(entry('windows-latest').tests).toContain('test/install-powershell.test.js')
    expect(entry('windows-latest').tests).not.toContain('test/install-bash.test.js')
    for (const os of ['ubuntu-latest', 'windows-latest']) {
      expect(entry(os).tests).toContain('test/windows-helper-fixtures.test.js')
    }
  })

  it('requires Windows PowerShell 5.1 and pwsh instead of letting them skip', () => {
    expect(entry('windows-latest').powershell.split(',')).toEqual(['powershell.exe', 'pwsh'])
    expect(entry('ubuntu-latest').powershell).toBe('pwsh')
    const testStep = helpers.steps.find((step) => /\bnpm test\b/.test(runOf(step)))
    expect(testStep.env.RAMP_REQUIRE_POWERSHELL).toBe('${{ matrix.powershell }}')
    expect(runOf(testStep)).toContain('${{ matrix.tests }}')
  })

  it('installs from the lockfile on Node 20 before the helper tests', () => {
    const steps = helpers.steps
    expect(steps.find((step) => step.uses === 'actions/setup-node@v4').with['node-version']).toBe(20)
    expect(steps.find((step) => step.uses === 'actions/checkout@v4').with['persist-credentials'])
      .toBe(false)
    const install = stepIndex(steps, (_step, run) => run === 'npm ci --prefix installer')
    const test = stepIndex(steps, (_step, run) => /\bnpm test\b/.test(run))
    expect(install).toBeGreaterThanOrEqual(0)
    expect(test).toBeGreaterThan(install)
  })
})

describe('release-packs workflow contract', () => {
  const definition = workflow('release-packs.yml')
  const { build, publish } = definition.jobs
  const windows = definition.jobs['windows-helpers']

  it('runs only from a manual dispatch with a required pack and publish off by default', () => {
    expect(Object.keys(definition.on)).toEqual(['workflow_dispatch'])
    const inputs = definition.on.workflow_dispatch.inputs
    expect(inputs.pack.required).toBe(true)
    expect(inputs.publish).toMatchObject({ type: 'boolean', default: false })
  })

  it('grants contents: write only to the publish job', () => {
    expect(definition.permissions).toEqual({})
    expect(build.permissions).toEqual({ contents: 'read' })
    expect(windows.permissions).toEqual({ contents: 'read' })
    expect(publish.permissions).toEqual({ contents: 'write' })
  })

  it('uses Node 20 and a lockfile-backed npm ci in every building job', () => {
    expect(existsSync(join(repoRoot, 'installer', 'package-lock.json'))).toBe(true)
    for (const job of [build, windows]) {
      const node = job.steps.find((step) => step.uses === 'actions/setup-node@v4')
      expect(node.with['node-version']).toBe(20)
      expect(job.steps.some((step) => runOf(step) === 'npm ci --prefix installer')).toBe(true)
      expect(job.steps.some((step) => /\bnpm install\b/.test(runOf(step)))).toBe(false)
      const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4')
      expect(checkout.with['persist-credentials']).toBe(false)
    }
  })

  it('pins SOURCE_DATE_EPOCH to the source commit before the twice-built comparison', () => {
    const steps = build.steps
    const epoch = stepIndex(steps, (_step, run) =>
      run.includes('SOURCE_DATE_EPOCH=$(git show -s --format=%ct HEAD)') &&
      run.includes('$GITHUB_ENV'))
    const sync = stepIndex(steps, (_step, run) => run.includes('skills sync') && run.includes('--locked'))
    const verify = stepIndex(steps, (_step, run) => run.includes('skills verify'))
    const helpersTest = stepIndex(steps, (step, run) =>
      run.includes('test/install-bash.test.js') &&
      run.includes('test/install-powershell.test.js') &&
      step.env?.RAMP_REQUIRE_POWERSHELL === 'pwsh')
    const determinism = stepIndex(steps, (_step, run) =>
      run.includes('node scripts/verify-release-determinism.mjs') &&
      run.includes('--pack "$PACK"') &&
      run.includes('--out dist'))
    const upload = stepIndex(steps, (step) => step.uses === 'actions/upload-artifact@v4')
    const ordered = [epoch, sync, verify, helpersTest, determinism, upload]
    expect(ordered.every((index) => index >= 0)).toBe(true)
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index]).toBeGreaterThan(ordered[index - 1])
    }
    expect(build.env.PACK).toBe('${{ inputs.pack }}')
  })

  it('uploads dist/ as a workflow artifact before anything can publish', () => {
    const upload = build.steps.find((step) => step.uses === 'actions/upload-artifact@v4')
    expect(upload.with.path).toBe('dist/')
    expect(upload.with['if-no-files-found']).toBe('error')
    expect(publish.needs).toEqual(['build', 'windows-helpers'])
    const download = publish.steps.find((step) => step.uses === 'actions/download-artifact@v4')
    expect(download.with.name).toBe(upload.with.name)
  })

  it('publishes only for publish=true on a tag, to the existing Release', () => {
    expect(publish.if).toBe("inputs.publish == true && startsWith(github.ref, 'refs/tags/')")
    const steps = publish.steps
    const check = stepIndex(steps, (_step, run) => run.includes('sha256sum --check --strict SHA256SUMS'))
    const attach = stepIndex(steps, (_step, run) =>
      run.startsWith('gh release upload "$TAG"') &&
      run.includes('dist/*.zip') &&
      run.includes('dist/SHA256SUMS'))
    expect(check).toBeGreaterThanOrEqual(0)
    expect(attach).toBeGreaterThan(check)
    expect(runOf(steps[attach])).not.toContain('--clobber')
    expect(steps[attach].env.TAG).toBe('${{ github.ref_name }}')
  })

  it('never creates releases, tags, or AWS resources, and publishes from one job only', () => {
    for (const [name, job] of Object.entries(definition.jobs)) {
      for (const step of job.steps) {
        const run = runOf(step)
        expect(run).not.toMatch(/gh release (create|edit|delete)|git tag|git push|\baws\b|cdk |sam deploy/)
        if (name !== 'publish') expect(run).not.toContain('gh release')
      }
    }
  })

  it('never interpolates dispatch inputs into a shell script', () => {
    for (const step of allSteps(definition)) expect(runOf(step)).not.toContain('${{')
  })
})

describe('update-skill-locks workflow contract', () => {
  const definition = workflow('update-skill-locks.yml')
  const { update, propose } = definition.jobs

  it('runs on a schedule or manual dispatch with no publish input', () => {
    expect(Object.keys(definition.on).sort()).toEqual(['schedule', 'workflow_dispatch'])
    expect(definition.on.workflow_dispatch?.inputs?.publish).toBeUndefined()
  })

  it('keeps release permissions out and the write token away from dependency code', () => {
    expect(definition.permissions).toEqual({})
    expect(update.permissions).toEqual({ contents: 'read' })
    expect(propose.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' })
    for (const step of propose.steps) expect(runOf(step)).not.toMatch(/\bnpm\b|\bnode\b|\bnpx\b/)
    for (const step of allSteps(definition)) {
      expect(runOf(step)).not.toMatch(/gh release|gh pr merge|--auto\b|git tag/)
    }
  })

  it('refreshes from main, then verifies and tests before deciding on a PR', () => {
    const steps = update.steps
    const checkout = steps.find((step) => step.uses === 'actions/checkout@v4')
    expect(checkout.with).toEqual({ ref: 'main', 'persist-credentials': false })
    const updateLock = stepIndex(steps, (_step, run) =>
      run.includes('skills update-lock') && run.includes('--cache "$RAMP_SKILLS_CACHE"'))
    const verify = stepIndex(steps, (_step, run) => run.includes('skills verify'))
    const test = stepIndex(steps, (_step, run) => run === 'npm test --prefix installer')
    const diff = stepIndex(steps, (_step, run) =>
      run.includes('git diff --quiet -- dependencies/skills.lock.yaml'))
    const ordered = [updateLock, verify, test, diff]
    expect(ordered.every((index) => index >= 0)).toBe(true)
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index]).toBeGreaterThan(ordered[index - 1])
    }
    expect(update.outputs.changed).toBe('${{ steps.diff.outputs.changed }}')
  })

  it('opens a PR from a per-run automation branch with only the lock committed', () => {
    expect(propose.if).toBe("needs.update.outputs.changed == 'true'")
    expect(propose.env.BRANCH).toBe('automation/skill-locks-${{ github.run_id }}')
    const checkout = propose.steps.find((step) => step.uses === 'actions/checkout@v4')
    expect(checkout.with.ref).toBe('${{ needs.update.outputs.base }}')
    const commit = runOf(propose.steps.find((step) => runOf(step).includes('git commit')))
    expect(commit).toContain('git add -- dependencies/skills.lock.yaml')
    expect(commit).not.toMatch(/git add (-A|\.|--all)/)
    expect(commit).toContain('git push origin "$BRANCH"')
    const pr = runOf(propose.steps.find((step) => runOf(step).includes('gh pr create')))
    expect(pr).toContain('--head "$BRANCH"')
  })
})

describe('verify-release-determinism script', () => {
  const roots = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  function temp(prefix) {
    const root = mkdtempSync(join(tmpdir(), prefix))
    roots.push(root)
    return root
  }

  // Stands in for `ramp-pack release`: writes one archive per qualified
  // target, and adds a per-run nonce when RAMP_FAKE_DRIFT is set.
  function fakeCli() {
    const root = temp('ramp-fake-cli-')
    const log = join(root, 'calls.jsonl')
    const cli = join(root, 'ramp-pack.mjs')
    writeFileSync(cli, `
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const args = process.argv.slice(2)
const value = (flag) => args[args.indexOf(flag) + 1]
appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n')
const targets = args.includes('--all-targets') ? ['kiro', 'claude-code'] : [value('--target')]
for (const target of targets) {
  const body = [args[1], target, value('--source-commit'), value('--build-time')].join('|') +
    (process.env.RAMP_FAKE_DRIFT ? String(Math.random()) : '')
  writeFileSync(join(value('--out'), args[1] + '--' + target + '--v0.1.0.zip'), body)
}
`)
    return { cli, log }
  }

  function run(args, env = {}) {
    return spawnSync(process.execPath, [script, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, SOURCE_DATE_EPOCH: '', RAMP_FAKE_DRIFT: '', ...env },
    })
  }

  it('builds twice with identical provenance and writes archives plus SHA256SUMS', () => {
    const { cli, log } = fakeCli()
    const out = join(temp('ramp-dist-'), 'dist')
    const result = run(
      ['--pack', 'qa-automated-testing', '--out', out, '--cli', cli, '--source-commit', 'abc123'],
      { SOURCE_DATE_EPOCH: '1700000000' },
    )
    expect(result.status, result.stderr).toBe(0)

    const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.slice(0, 3)).toEqual(['release', 'qa-automated-testing', '--all-targets'])
      expect(call[call.indexOf('--source-commit') + 1]).toBe('abc123')
      expect(call[call.indexOf('--build-time') + 1]).toBe('2023-11-14T22:13:20Z')
    }
    expect(calls[0][calls[0].indexOf('--out') + 1]).not.toBe(calls[1][calls[1].indexOf('--out') + 1])

    const names = readdirSync(out).sort()
    expect(names).toEqual([
      'SHA256SUMS',
      'qa-automated-testing--claude-code--v0.1.0.zip',
      'qa-automated-testing--kiro--v0.1.0.zip',
    ])
    const expected = names
      .filter((name) => name.endsWith('.zip'))
      .map((name) => `${createHash('sha256').update(readFileSync(join(out, name))).digest('hex')}  ${name}\n`)
      .join('')
    expect(readFileSync(join(out, 'SHA256SUMS'), 'utf8')).toBe(expected)
  })

  it('fails and writes nothing when the two builds differ', () => {
    const { cli } = fakeCli()
    const out = join(temp('ramp-dist-'), 'dist')
    const result = run(
      ['--pack', 'qa-automated-testing', '--out', out, '--cli', cli, '--source-commit', 'abc123',
        '--build-time', '2024-01-01T00:00:00Z'],
      { RAMP_FAKE_DRIFT: '1' },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('release builds are not byte-identical')
    expect(result.stderr).toContain('qa-automated-testing--kiro--v0.1.0.zip: bytes differ')
    expect(existsSync(out)).toBe(false)
  })

  it('refuses a non-empty output directory and an unsafe pack name', () => {
    const { cli } = fakeCli()
    const out = temp('ramp-dist-')
    writeFileSync(join(out, 'stale.zip'), 'old')
    const stale = run(['--pack', 'qa-automated-testing', '--out', out, '--cli', cli])
    expect(stale.status).toBe(1)
    expect(stale.stderr).toContain('output directory is not empty')

    const unsafe = run(['--pack', '../qa-automated-testing', '--cli', cli])
    expect(unsafe.status).toBe(1)
    expect(unsafe.stderr).toContain('--pack must be a pack directory name')
  })

  it('plans qualified targets and each qualified target of every profile', () => {
    expect(releaseInvocations('demo', {
      qualifiedTargets: ['kiro', 'claude-code'],
      profiles: [{ name: 'shared', targets: ['kiro', 'claude-code', 'cursor'] }],
    })).toEqual([
      ['release', 'demo', '--all-targets'],
      ['release', 'demo', '--target', 'kiro', '--profile', 'shared'],
      ['release', 'demo', '--target', 'claude-code', '--profile', 'shared'],
    ])
    expect(releaseInvocations('demo', { qualifiedTargets: [], profiles: [] })).toEqual([])
  })
})
