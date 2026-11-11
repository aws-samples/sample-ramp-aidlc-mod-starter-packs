import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildCatalog,
  checkCatalog,
  firstSentence,
  renderCatalog,
  replacePacksBlock,
  writeCatalog,
} from '../src/catalog.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const fixtureRepo = join(here, 'fixtures', 'catalog', 'repo')
const expectedDir = join(here, 'fixtures', 'catalog', 'expected')
const cli = join(here, '..', 'bin', 'ramp-pack.js')
const roots = []

// Until T6 lands, loadManifest returns no catalog.useCases. Tests that need pack
// use cases set them here, and the wrapped loader adds them, as T6 will.
const simulatedUseCases = new Map()
vi.mock('../src/manifest.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadManifest(packDir, options) {
      const manifest = actual.loadManifest(packDir, options)
      const useCases = simulatedUseCases.get(basename(packDir))
      if (!useCases) return manifest
      return { ...manifest, catalog: { ...(manifest.catalog ?? {}), useCases } }
    },
  }
})

// A later adapter (codex lands in T18) must not appear for v1 packs, which
// fall back to the four scaffolded tools.
vi.mock('../src/adapters/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, listAdapterIds: () => [...actual.listAdapterIds(), 'later-tool'] }
})

afterEach(() => {
  simulatedUseCases.clear()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function copyFixture() {
  const root = mkdtempSync(join(tmpdir(), 'ramp-catalog-'))
  roots.push(root)
  cpSync(fixtureRepo, root, { recursive: true })
  return root
}

function expected(name) {
  return readFileSync(join(expectedDir, name), 'utf8')
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, 'catalog', ...args], { encoding: 'utf8' })
}

describe('buildCatalog', () => {
  it('models packs, skills, variants and taxonomy of the fixture repository', () => {
    const model = buildCatalog(fixtureRepo)

    expect(model.taxonomy.useCases.map((entry) => entry.id)).toEqual([
      'modernize',
      'build-things',
      'automate-checks',
    ])
    expect(model.packs.map((pack) => pack.name)).toEqual(['alpha-pack', 'zeta-pack'])
    expect(model.packs[0]).toMatchObject({
      schemaVersion: 2,
      readme: 'packs/alpha-pack/README.md',
      summary: 'Builds the alpha service on AWS, e.g. a small API behind a load balancer.',
      outcome: 'reimagine',
      maturity: 'preview',
      useCases: [],
      targets: ['kiro', 'claude-code', 'cursor'],
      qualifiedTargets: ['kiro'],
      skills: ['gamma-ramp', 'beta-upstream'],
      variants: ['shared-variant', 'new-style'],
      baseInstructions: ['aidlc-workflow.md', 'reverse-engineering.md'],
      awsServices: ['ecs', 'lambda'],
    })
    // v1 fallbacks: every scaffolded tool, none qualified, nothing declared.
    expect(model.packs[1]).toMatchObject({
      schemaVersion: 1,
      title: 'Zeta | Pack',
      outcome: null,
      maturity: null,
      targets: ['kiro', 'claude-code', 'copilot', 'cursor'],
      qualifiedTargets: [],
      variants: [],
      baseInstructions: ['reverse-engineering.md'],
      awsServices: [],
    })

    expect(model.skills.map((skill) => [skill.name, skill.path, skill.origin])).toEqual([
      ['beta-upstream', 'skills-library/beta-upstream', 'upstream'],
      ['delta-local', 'skills-library/delta-local', 'local'],
      ['epsilon-unused', 'skills-library/epsilon-unused', 'local'],
      ['eta-ramp', 'skills/ramp/eta-ramp', 'ramp'],
      ['gamma-ramp', 'skills/ramp/gamma-ramp', 'ramp'],
      // Unused skills in the resolver's shared roots, including one no pack
      // resolves from, are listed too.
      ['iota-target', 'skills/iota-target', 'local'],
      ['theta-ramp', 'skills/ramp/theta-ramp', 'ramp'],
    ])
    const byName = new Map(model.skills.map((skill) => [skill.name, skill]))
    expect(byName.get('beta-upstream')).toMatchObject({
      packs: ['alpha-pack', 'zeta-pack'],
      maturity: null,
      upstream: {
        source: 'fixture-source',
        repository: 'https://github.com/example/fixture-skills.git',
        commit: '1234567890abcdef1234567890abcdef12345678',
        path: 'skills/beta-upstream',
      },
    })
    // A v1 skill.yaml reads as origin ramp with an empty classification. No
    // pack uses theta-ramp, so only skillMetadataView supplies its origin.
    for (const name of ['eta-ramp', 'theta-ramp']) {
      expect(byName.get(name)).toMatchObject({
        origin: 'ramp',
        classification: { useCases: [], awsServices: [], technologies: [] },
      })
    }
    expect(byName.get('theta-ramp').packs).toEqual([])
    // Values come back in taxonomy order, not declaration order.
    expect(byName.get('gamma-ramp').classification).toEqual({
      useCases: ['modernize', 'build-things'],
      awsServices: ['ecs', 'lambda'],
      technologies: ['terraform'],
    })
    expect(byName.get('epsilon-unused')).toMatchObject({ packs: [], maturity: 'experimental' })

    expect(model.workflows.base).toEqual([
      { file: 'aidlc-workflow.md', path: 'common/instructions/aidlc-workflow.md', packs: ['alpha-pack'] },
      {
        file: 'reverse-engineering.md',
        path: 'common/instructions/reverse-engineering.md',
        packs: ['alpha-pack', 'zeta-pack'],
      },
    ])
    expect(model.workflows.variants).toEqual([
      {
        id: 'new-style',
        title: 'New style',
        instruction: 'aidlc-workflow.md',
        whenToUse: 'A variant in the new layout, selected through its old alias.',
        aliases: ['older-style'],
        path: 'workflows/variants/new-style.md',
        packs: ['alpha-pack'],
      },
      {
        id: 'shared-variant',
        title: 'shared-variant',
        instruction: 'reverse-engineering.md',
        whenToUse: 'Adds fixture evidence to reverse engineering.',
        aliases: [],
        path: 'workflow-overlays/shared-variant.md',
        packs: ['alpha-pack'],
      },
    ])
  })

  it('reads catalog.useCases when the manifest loader provides them', () => {
    simulatedUseCases.set('alpha-pack', ['build-things', 'modernize'])
    simulatedUseCases.set('zeta-pack', ['modernize'])

    const model = buildCatalog(fixtureRepo)

    expect(model.packs[0]).toMatchObject({ useCases: ['modernize', 'build-things'], outcome: 'reimagine' })
    // A v1 pack takes its outcome from the taxonomy mapping of its first use case.
    expect(model.packs[1]).toMatchObject({ useCases: ['modernize'], outcome: 'transform' })
    expect(renderCatalog(model).packsBlock).toBe(expected('packs-block.use-cases.md'))
  })

  it('refuses a use case that is not in the taxonomy', () => {
    simulatedUseCases.set('zeta-pack', ['not-a-use-case'])
    expect(() => buildCatalog(fixtureRepo)).toThrow(
      'pack zeta-pack useCases value is not in schemas/taxonomy.yaml: not-a-use-case',
    )
  })

  it('refuses a pack that selects an unknown workflow variant', () => {
    const root = copyFixture()
    const path = join(root, 'packs', 'alpha-pack', 'pack.yaml')
    writeFileSync(path, readFileSync(path, 'utf8').replace('older-style.md', 'missing-variant.md'))
    expect(() => buildCatalog(root)).toThrow(
      'pack alpha-pack selects unknown workflow variant: missing-variant.md',
    )
  })

  it('names a locked skill without an in-tree mirror instead of the temporary cache', () => {
    const root = copyFixture()
    rmSync(join(root, 'skills-library', 'beta-upstream'), { recursive: true })
    expect(() => buildCatalog(root)).toThrow(
      'locked skill beta-upstream (pack alpha-pack) has no in-tree mirror; the catalogue reads the in-tree mirror, never the skill cache',
    )
  })

  it('classifies the two migrated pilot packs of the real repository', () => {
    const model = buildCatalog(repoRoot)
    const qa = model.packs.find((pack) => pack.name === 'qa-automated-testing')
    const legacy = model.packs.find((pack) => pack.name === 'legacy-transformation-on-aws')
    const unmigrated = model.packs.find((pack) => pack.name === 'agentic-ai-workflow')

    expect(qa).toMatchObject({
      schemaVersion: 2,
      outcome: 'automate',
      maturity: 'preview',
      targets: ['kiro', 'claude-code', 'copilot', 'cursor'],
      qualifiedTargets: ['kiro', 'claude-code'],
    })
    expect(legacy).toMatchObject({ schemaVersion: 2, outcome: 'transform', maturity: 'preview' })
    expect(unmigrated).toMatchObject({ schemaVersion: 1, maturity: null, qualifiedTargets: [] })

    const skills = new Map(model.skills.map((skill) => [skill.name, skill]))
    for (const pack of model.packs) {
      for (const name of pack.skills) {
        expect(skills.get(name)?.packs).toContain(pack.name)
        expect(existsSync(join(repoRoot, skills.get(name).path, 'SKILL.md'))).toBe(true)
      }
    }
  })
})

describe('renderCatalog', () => {
  it('renders the fixture repository to the expected Markdown', () => {
    const rendered = renderCatalog(buildCatalog(fixtureRepo))
    const readme = replacePacksBlock(readFileSync(join(fixtureRepo, 'README.md'), 'utf8'), rendered.packsBlock)

    expect(rendered['skills/README.md']).toBe(expected('skills-README.md'))
    expect(rendered['workflows/README.md']).toBe(expected('workflows-README.md'))
    expect(readme).toBe(expected('README.md'))
    for (const text of [rendered['skills/README.md'], rendered['workflows/README.md'], readme]) {
      expect(text).not.toMatch(/\r/)
      expect(text.endsWith('\n')).toBe(true)
    }
  })

  it('links every pack row to packs/<pack>/README.md', () => {
    const { packsBlock } = renderCatalog(buildCatalog(fixtureRepo))
    const rows = packsBlock.split('\n').filter((line) => line.startsWith('| ['))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatch(/^\| \[Alpha Pack\]\(packs\/alpha-pack\/README\.md\) \|/)
    expect(rows[1]).toMatch(/^\| \[Zeta \\\| Pack\]\(packs\/zeta-pack\/README\.md\) \|/)
  })
})

describe('firstSentence', () => {
  it('stops at the first sentence end and skips abbreviations', () => {
    expect(firstSentence('One. Two.')).toBe('One.')
    expect(firstSentence('Picks keys vs. indexes, e.g. GSIs. Then more.')).toBe(
      'Picks keys vs. indexes, e.g. GSIs.',
    )
    expect(firstSentence('Uses v1.2 of the API.\nNext line.')).toBe('Uses v1.2 of the API.')
    expect(firstSentence('No full stop')).toBe('No full stop')
    expect(firstSentence(undefined)).toBe('')
  })
})

describe('replacePacksBlock', () => {
  it('keeps the line ending style of the README', () => {
    const start = '<!-- RAMP:CATALOG packs START -->'
    const end = '<!-- RAMP:CATALOG packs END -->'
    const crlf = `# Title\r\n\r\n${start}\r\nold\r\n${end}\r\nAfter.\r\n`
    expect(replacePacksBlock(crlf, 'one\ntwo\n')).toBe(
      `# Title\r\n\r\n${start}\r\none\r\ntwo\r\n${end}\r\nAfter.\r\n`,
    )
    const lf = `# Title\n${start}\nold\n${end}\n`
    expect(replacePacksBlock(lf, 'one\ntwo\n')).toBe(`# Title\n${start}\none\ntwo\n${end}\n`)
  })


  it('returns null without markers and refuses malformed markers', () => {
    expect(replacePacksBlock('# No markers\n', 'x\n')).toBeNull()
    expect(() => replacePacksBlock('<!-- RAMP:CATALOG packs START -->\n', 'x\n')).toThrow(
      'README.md must hold exactly one',
    )
    expect(() =>
      replacePacksBlock(
        '<!-- RAMP:CATALOG packs END -->\n<!-- RAMP:CATALOG packs START -->\n',
        'x\n',
      ),
    ).toThrow('README.md must hold exactly one')
  })
})

describe('writeCatalog and checkCatalog', () => {
  it('creates both catalogues, fills the README block, and is byte-stable', () => {
    const root = copyFixture()
    expect(checkCatalog(root).problems).toEqual([
      { path: 'skills/README.md', status: 'missing' },
      { path: 'workflows/README.md', status: 'missing' },
      { path: 'README.md', status: 'stale' },
    ])

    expect(writeCatalog(root)).toEqual([
      { path: 'skills/README.md', status: 'created' },
      { path: 'workflows/README.md', status: 'created' },
      { path: 'README.md', status: 'updated' },
    ])
    const first = ['skills/README.md', 'workflows/README.md', 'README.md'].map((path) =>
      readFileSync(join(root, path)))
    expect(first[0].toString('utf8')).toBe(expected('skills-README.md'))
    expect(first[1].toString('utf8')).toBe(expected('workflows-README.md'))
    expect(first[2].toString('utf8')).toBe(expected('README.md'))

    expect(writeCatalog(root).map((output) => output.status)).toEqual([
      'unchanged',
      'unchanged',
      'unchanged',
    ])
    const second = ['skills/README.md', 'workflows/README.md', 'README.md'].map((path) =>
      readFileSync(join(root, path)))
    second.forEach((bytes, index) => expect(bytes.equals(first[index])).toBe(true))
    expect(checkCatalog(root).problems).toEqual([])
  })

  it('writes the catalogues but leaves a README without markers untouched', () => {
    const root = copyFixture()
    const readme = '# No catalogue markers here\n'
    writeFileSync(join(root, 'README.md'), readme)

    expect(writeCatalog(root)).toEqual([
      { path: 'skills/README.md', status: 'created' },
      { path: 'workflows/README.md', status: 'created' },
      { path: 'README.md', status: 'skipped' },
    ])
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe(readme)
    expect(checkCatalog(root).problems).toEqual([])
  })
})

describe('writeCatalog symbolic links', () => {
  function outside() {
    const root = mkdtempSync(join(tmpdir(), 'ramp-catalog-outside-'))
    roots.push(root)
    return root
  }

  it('refuses an output that is a symbolic link and leaves its target untouched', () => {
    const root = copyFixture()
    const target = join(outside(), 'victim.md')
    writeFileSync(target, 'keep me\n')
    mkdirSync(join(root, 'skills'), { recursive: true })
    symlinkSync(target, join(root, 'skills', 'README.md'))

    expect(() => writeCatalog(root)).toThrow(
      'catalog output skills/README.md must not pass through a symbolic link',
    )
    expect(() => checkCatalog(root)).toThrow('must not pass through a symbolic link')
    expect(readFileSync(target, 'utf8')).toBe('keep me\n')
  })

  it('refuses an output whose parent directory is a symbolic link', () => {
    const root = copyFixture()
    const target = outside()
    // Move the real workflows/ out and link it back, so its variants still load.
    cpSync(join(root, 'workflows'), target, { recursive: true })
    rmSync(join(root, 'workflows'), { recursive: true })
    symlinkSync(target, join(root, 'workflows'), 'dir')

    expect(() => writeCatalog(root)).toThrow(
      'catalog output workflows/README.md must not pass through a symbolic link',
    )
    expect(readdirSync(target)).toEqual(['variants'])
    expect(existsSync(join(root, 'skills', 'README.md'))).toBe(false)
  })
})

describe('ramp-pack catalog', () => {
  it('requires exactly one of --write or --check', () => {
    const result = runCli(['--root', fixtureRepo])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('select exactly one of --write or --check')
  })

  it('--check is green after --write and red after a hand edit of any output', () => {
    const root = copyFixture()
    const written = runCli(['--write', '--root', root])
    expect(written.status).toBe(0)
    expect(written.stdout).toBe(
      'created: skills/README.md\ncreated: workflows/README.md\nupdated: README.md\n',
    )
    expect(runCli(['--check', '--root', root]).status).toBe(0)

    for (const path of ['skills/README.md', 'workflows/README.md', 'README.md']) {
      const target = join(root, path)
      const original = readFileSync(target, 'utf8')
      writeFileSync(target, original.replace('| [', '| [hand-edited '))
      const result = runCli(['--check', '--root', root])
      expect(result.status).toBe(1)
      expect(result.stderr).toBe(
        `stale: ${path}\nThe catalogue is out of date; run ramp-pack catalog --write\n`,
      )
      writeFileSync(target, original)
    }
  })

  it('--check lists every missing and stale output', () => {
    const root = copyFixture()
    mkdirSync(join(root, 'skills'), { recursive: true })
    const result = runCli(['--check', '--root', root])
    expect(result.status).toBe(1)
    expect(result.stderr).toBe(
      [
        'missing: skills/README.md',
        'missing: workflows/README.md',
        'stale: README.md',
        'The catalogue is out of date; run ramp-pack catalog --write',
        '',
      ].join('\n'),
    )
  })
})
