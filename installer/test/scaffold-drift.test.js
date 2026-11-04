import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { listAdapterIds } from '../src/adapters/index.js'
import { listPacks } from '../src/build-all.js'
import { loadManifest } from '../src/manifest.js'
import { buildPlan } from '../src/plan.js'
import { renderAddSkills } from '../src/render/add-skills.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const packsRoot = join(repoRoot, 'packs')
const packNames = listPacks(packsRoot)
const toolIds = listAdapterIds()
const portable = (path) => path.split(sep).join('/')
const declaredTools = (manifest) =>
  manifest.schemaVersion === 2 ? manifest.distribution.targets : toolIds

function collectCommittedFiles(root) {
  const rootStatus = lstatSync(root)
  if (rootStatus.isSymbolicLink()) {
    throw new Error(`scaffold root is a symbolic link: ${root}`)
  }
  if (!rootStatus.isDirectory()) {
    throw new Error(`scaffold root is not a directory: ${root}`)
  }

  const files = []

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const status = lstatSync(path)
      const displayPath = portable(relative(root, path))

      if (status.isSymbolicLink()) {
        throw new Error(`unexpected symbolic link: ${displayPath}`)
      }
      if (status.isDirectory()) {
        visit(path)
        continue
      }
      if (status.isFile()) {
        if (entry.name !== '.DS_Store') files.push(displayPath)
        continue
      }
      throw new Error(`unexpected filesystem entry: ${displayPath}`)
    }
  }

  visit(root)
  return files.sort()
}

function expectScaffoldParity(entries, root, label) {
  for (const entry of entries) {
    expect(
      typeof entry.path,
      `${label}: generated path must be text`,
    ).toBe('string')
  }
  const expectedPaths = entries.map((entry) => portable(entry.path)).sort()
  expect(
    new Set(expectedPaths).size,
    `${label}: generated paths must be unique`,
  ).toBe(expectedPaths.length)

  for (const entry of entries) {
    expect(
      typeof entry.content,
      `${label}/${portable(entry.path)}: generated content must be text`,
    ).toBe('string')
  }

  const actualPaths = collectCommittedFiles(root)
  expect(actualPaths, `${label}: committed generated path set`).toEqual(
    expectedPaths,
  )

  for (const entry of entries) {
    const path = portable(entry.path)
    expect(
      readFileSync(join(root, entry.path), 'utf8'),
      `${label}/${path}: committed bytes`,
    ).toBe(entry.content)
  }
}

function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'ramp-scaffold-drift-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('scaffold parity sensitivity', () => {
  const expected = [{ path: 'nested/instruction.md', content: 'expected\n' }]

  it('rejects a non-directory scaffold root before traversal', () => {
    withFixture((root) => {
      const fileRoot = join(root, 'not-a-directory')
      writeFileSync(fileRoot, 'not a scaffold tree')

      expect(() => expectScaffoldParity(expected, fileRoot, 'file root'))
        .toThrow(/scaffold root is not a directory/)
    })
  })

  it.runIf(process.platform !== 'win32')(
    'rejects a symlinked scaffold root before traversal',
    () => {
      withFixture((root) => {
        const actualRoot = join(root, 'actual')
        const linkedRoot = join(root, 'linked')
        mkdirSync(join(actualRoot, 'nested'), { recursive: true })
        writeFileSync(
          join(actualRoot, 'nested', 'instruction.md'),
          'expected\n',
        )
        symlinkSync(actualRoot, linkedRoot)

        expect(() =>
          expectScaffoldParity(expected, linkedRoot, 'symlink root'),
        ).toThrow(/scaffold root is a symbolic link/)
      })
    },
  )

  it('detects a missing generated path', () => {
    withFixture((root) => {
      expect(() => expectScaffoldParity(expected, root, 'missing fixture'))
        .toThrow()
    })
  })

  it('detects an extra generated path', () => {
    withFixture((root) => {
      mkdirSync(join(root, 'nested'), { recursive: true })
      writeFileSync(join(root, 'nested', 'instruction.md'), 'expected\n')
      writeFileSync(join(root, 'unexpected.md'), 'extra\n')

      expect(() => expectScaffoldParity(expected, root, 'extra fixture'))
        .toThrow()
    })
  })

  it('detects byte drift without normalizing whitespace', () => {
    withFixture((root) => {
      mkdirSync(join(root, 'nested'), { recursive: true })
      writeFileSync(join(root, 'nested', 'instruction.md'), 'expected')

      expect(() => expectScaffoldParity(expected, root, 'byte fixture'))
        .toThrow()
    })
  })

  it('ignores only regular .DS_Store files', () => {
    withFixture((root) => {
      mkdirSync(join(root, 'nested'), { recursive: true })
      writeFileSync(join(root, 'nested', 'instruction.md'), 'expected\n')
      writeFileSync(join(root, '.DS_Store'), 'finder metadata')

      expectScaffoldParity(expected, root, 'DS_Store fixture')
    })
  })

  it.runIf(process.platform !== 'win32')(
    'rejects symlinks instead of following them',
    () => {
      withFixture((root) => {
        mkdirSync(join(root, 'nested'), { recursive: true })
        writeFileSync(join(root, 'nested', 'instruction.md'), 'expected\n')
        symlinkSync(
          join(root, 'nested', 'instruction.md'),
          join(root, 'linked-instruction.md'),
        )

        expect(() => expectScaffoldParity(expected, root, 'symlink fixture'))
          .toThrow(/unexpected symbolic link/)
      })
    },
  )
})

const scaffoldCases = packNames.flatMap((pack) => {
  const packDir = join(packsRoot, pack)
  const manifest = loadManifest(packDir)
  return declaredTools(manifest).map((tool) => ({
    pack,
    packDir,
    tool,
  }))
})

describe.each(scaffoldCases)('scaffold parity: $pack / $tool', ({
  pack,
  packDir,
  tool,
}) => {
  it('matches every generated path and byte', () => {
    const expected = buildPlan(packDir, tool, { includeSkills: false })
    const committedRoot = join(packDir, 'scaffolded-packs', tool)

    expectScaffoldParity(expected, committedRoot, `${pack}/${tool}`)
  })
})

describe.each(packNames)('skill installer parity: %s', (pack) => {
  it('matches the production add-skills renderer', () => {
    const packDir = join(packsRoot, pack)
    const manifest = loadManifest(packDir)

    expect(
      readFileSync(join(packDir, 'add-skills.sh'), 'utf8'),
      `${pack}/add-skills.sh: committed bytes`,
    ).toBe(renderAddSkills(manifest))
  })
})
