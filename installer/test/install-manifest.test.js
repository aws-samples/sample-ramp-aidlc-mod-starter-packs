import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { renderInstallManifest } from '../src/release/install-manifest.js'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function entry(path, bytes, mode = 0o100644, extra = {}) {
  return { path, bytes: Buffer.from(bytes), mode, ...extra }
}

describe('install ownership manifest', () => {
  it('renders the exact deterministic sorted format without mutating inputs', () => {
    const script = Buffer.from('#!/bin/sh\n')
    const settings = Buffer.from('{"enabled":true}\n')
    const files = [
      entry('overlay/.kiro/skills/demo/scripts/check.sh', script, 0o100755),
      entry('overlay/.kiro/settings/mcp.json', settings),
    ]
    const before = files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }))
    const rendered = renderInstallManifest({
      bundleId: 'demo--kiro--v1.2.3',
      ownershipKey: 'demo--kiro--standalone',
      version: '1.2.3',
      files,
    })
    expect(rendered).toBe([
      'RAMP-INSTALL-MANIFEST\t1',
      'bundle\tdemo--kiro--v1.2.3',
      'owner\tdemo--kiro--standalone',
      'version\t1.2.3',
      `file\t${sha256(settings)}\t0644\t.kiro/settings/mcp.json`,
      `file\t${sha256(script)}\t0755\t.kiro/skills/demo/scripts/check.sh`,
      '',
    ].join('\n'))
    expect(files).toEqual(before)
    expect(renderInstallManifest({
      bundleId: 'demo--kiro--v1.2.3',
      ownershipKey: 'demo--kiro--standalone',
      version: '1.2.3',
      files: [...files].reverse(),
    })).toBe(rendered)
  })

  it.each([
    ['empty files', []],
    ['non-overlay path', [entry('README.md', 'x')]],
    ['duplicate path', [entry('overlay/a', 'x'), entry('overlay/a', 'x')]],
    ['case collision', [entry('overlay/A', 'x'), entry('overlay/a', 'x')]],
    ['prefix collision', [entry('overlay/a', 'x'), entry('overlay/a/b', 'x')]],
    [
      'non-adjacent folded prefix collision',
      [
        entry('overlay/A', 'x'),
        entry('overlay/a-b', 'x'),
        entry('overlay/a/x', 'x'),
      ],
    ],
    ['traversal', [entry('overlay/../a', 'x')]],
    ['backslash', [entry('overlay/a\\b', 'x')]],
    ['reserved name', [entry('overlay/con', 'x')]],
    ['unsupported mode', [entry('overlay/a', 'x', 0o100600)]],
    ['non-buffer bytes', [{ path: 'overlay/a', bytes: 'x', mode: 0o100644 }]],
    ['hash disagreement', [entry('overlay/a', 'x', 0o100644, { sha256: '0'.repeat(64) })]],
  ])('rejects %s', (_label, files) => {
    expect(() => renderInstallManifest({
      bundleId: 'demo--kiro--v1.2.3',
      ownershipKey: 'demo--kiro--standalone',
      version: '1.2.3',
      files,
    })).toThrow()
  })

  it.each([
    ['bundleId', 'demo\tforged'],
    ['bundleId', '/absolute'],
    ['ownershipKey', 'nested/owner'],
    ['ownershipKey', 'owner\nforged'],
    ['ownershipKey', '.hidden'],
    ['version', '1.0.0\rforged'],
    ['version', 'release'],
  ])('rejects unsafe %s', (field, value) => {
    const model = {
      bundleId: 'demo--kiro--v1.2.3',
      ownershipKey: 'demo--kiro--standalone',
      version: '1.2.3',
      files: [entry('overlay/a', 'x')],
      [field]: value,
    }
    expect(() => renderInstallManifest(model)).toThrow()
  })
})
