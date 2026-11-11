// The skills move (phase P3 of the skills namespace design) changes no input
// bytes: bundle-manifest.json consumedInputs may differ from the fixture only
// by the documented prefix rewrite, with every sha256, size, mode and
// provenance unchanged.
//
// fixtures/consumed-inputs-before-skills-move.json holds the consumedInputs of
// the Kiro bundle of each v2 pack, recorded on the tree before the move with
// the release identity below. Generator inputs are left out: they hash the
// installer code, which the move does not touch and later work edits.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildBundle } from '../src/release/bundle.js'
import { createLayoutContext } from './support/customer-layout.js'

const fixturePath = fileURLToPath(
  new URL('./fixtures/consumed-inputs-before-skills-move.json', import.meta.url),
)
const PREFIX_REWRITES = [
  ['skills/ramp/', 'skills/'],
  ['skills-library/', 'skills/'],
]
const SOURCE_COMMIT = '0'.repeat(40)
const BUILD_TIME = '2026-01-01T00:00:00.000Z'
const cacheDir = process.env.RAMP_SKILLS_CACHE?.trim() || undefined
const before = JSON.parse(readFileSync(fixturePath, 'utf8'))

function rewritePath(path) {
  for (const [from, to] of PREFIX_REWRITES) {
    if (path.startsWith(from)) return `${to}${path.slice(from.length)}`
  }
  return path
}

function withoutGenerators(inputs) {
  return inputs.filter((input) => input.sourceKind !== 'generator')
}

// The rewrite can move a path past others, so both sides are compared in one
// code-point order over the fields that tell inputs apart.
function sortKey({ path, sourceKind, provenance }) {
  return `${path}\0${sourceKind}\0${provenance?.source ?? ''}\0${provenance?.commit ?? ''}`
}

function sorted(inputs) {
  return [...inputs].sort((left, right) => {
    const a = sortKey(left)
    const b = sortKey(right)
    return a < b ? -1 : a > b ? 1 : 0
  })
}

function startsWithOldRoot(path) {
  return PREFIX_REWRITES.some(([from]) => path.startsWith(from))
}

describe('consumed-inputs fixture', () => {
  it('records both v2 packs and inputs under an old skill root', () => {
    expect(Object.keys(before)).toEqual(['legacy-transformation-on-aws', 'qa-automated-testing'])
    for (const inputs of Object.values(before)) {
      expect(inputs.some(({ path }) => startsWithOldRoot(path))).toBe(true)
      expect(inputs.some(({ sourceKind }) => sourceKind === 'generator')).toBe(false)
    }
  })
})

describe.skipIf(cacheDir === undefined)('consumed inputs across the skills move', () => {
  let context

  beforeAll(() => {
    context = createLayoutContext({ cacheDir })
  })

  afterAll(() => {
    context?.dispose()
  })

  it.each(Object.keys(before))('%s changes only by the prefix rewrite', (pack) => {
    const root = context.releaseRoot()
    const bundle = buildBundle(join(root, 'packs', pack), {
      target: 'kiro',
      repoRoot: root,
      cacheDir,
      sourceCommit: SOURCE_COMMIT,
      buildTime: BUILD_TIME,
    })
    const actual = withoutGenerators(bundle.manifest.consumedInputs)

    expect(actual.filter(({ path }) => startsWithOldRoot(path))).toEqual([])
    expect(sorted(actual)).toEqual(
      sorted(before[pack].map((input) => ({ ...input, path: rewritePath(input.path) }))),
    )
  })
})
