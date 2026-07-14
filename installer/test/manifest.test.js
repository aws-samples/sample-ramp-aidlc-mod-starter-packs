// installer/test/manifest.test.js
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadManifest } from '../src/manifest.js'

function packWith(yaml) {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'))
  mkdirSync(join(dir, 'instructions'), { recursive: true })
  writeFileSync(join(dir, 'pack.yaml'), yaml)
  return dir
}

describe('loadManifest', () => {
  it('parses instructions, command, mcp and defaults skills to "all"', () => {
    const dir = packWith(`
name: demo
title: Demo
description: A demo pack.
instructions:
  - file: main.md
    role: primary
  - file: helper.md
    role: companion
    load: auto
command:
  name: aidlc
  description: Start it
mcp:
  - id: aws-knowledge
    command: npx
    args: ["mcp-remote", "https://x"]
`)
    const m = loadManifest(dir)
    expect(m.name).toBe('demo')
    expect(m.instructions).toHaveLength(2)
    expect(m.instructions[0].role).toBe('primary')
    expect(m.command.name).toBe('aidlc')
    expect(m.mcp[0].id).toBe('aws-knowledge')
    expect(m.skills).toBe('all')
  })

  it('throws when there is no primary instruction', () => {
    const dir = packWith(`
name: demo
title: Demo
description: d
instructions:
  - file: a.md
    role: companion
    load: always
`)
    expect(() => loadManifest(dir)).toThrow(/exactly one .*primary/i)
  })

  it('throws when there are two primary instructions', () => {
    const dir = packWith(`
name: demo
title: Demo
description: d
instructions:
  - file: a.md
    role: primary
  - file: b.md
    role: primary
`)
    expect(() => loadManifest(dir)).toThrow(/exactly one .*primary/i)
  })
})
