import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { parse } from 'yaml'
import { readOrdinaryFile } from '../release/entries.js'

const OVERLAY_FIELDS = new Set(['id', 'target', 'purpose', 'replaces'])
const SLOT_MARKER =
  /^<!-- RAMP:SLOT ([A-Za-z0-9][A-Za-z0-9-]*) (START|END) -->[ \t]*(?:\r?\n|$)/gm

function findAssetDirectory(packDir, name) {
  let current = resolve(packDir, '..')
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(current, name)
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return join(resolve(packDir, '..'), name)
}

// Shared workflow files live in workflows/; during the compatibility window
// the old roots are read when a file is absent from the new one.
const BASE_WORKFLOW_ROOTS = [['workflows', 'base'], ['common', 'instructions']]
const VARIANT_ROOTS = [['workflows', 'variants'], ['workflow-overlays']]

function findWorkflowFile(packDir, roots, file) {
  for (const [name, ...rest] of roots) {
    const path = join(findAssetDirectory(packDir, name), ...rest, file)
    if (existsSync(path)) return path
  }
  return undefined
}

function assertSafeRelativePath(value, label) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.trim() !== value ||
    value.includes('\0') ||
    value.includes('\\') ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`${label} must be a safe relative path`)
  }
  const segments = value.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return value
}

function assertSafeIdentifier(value, label) {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.trim() !== value ||
    value === '.' ||
    value === '..' ||
    !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(value)
  ) {
    throw new Error(`${label} must be a safe identifier`)
  }
  return value
}

function resolveInstructionPath(packDir, file) {
  assertSafeRelativePath(file, 'instruction file')
  const local = join(packDir, 'instructions', file)
  if (existsSync(local)) return local

  const shared = findWorkflowFile(packDir, BASE_WORKFLOW_ROOTS, file)
  if (shared !== undefined) return shared
  throw new Error(`instruction not found in pack, workflows/base/ or common/instructions/: ${file}`)
}

function parseSlots(content, label) {
  const matches = [...content.matchAll(SLOT_MARKER)]
  const markerless = matches.reduceRight(
    (text, match) => text.slice(0, match.index) + text.slice(match.index + match[0].length),
    content,
  )
  if (markerless.includes('<!-- RAMP:SLOT')) {
    throw new Error(`${label} contains a malformed slot marker`)
  }

  const blocks = []
  const byName = new Map()
  let open = null

  for (const match of matches) {
    const [, name, kind] = match
    if (kind === 'START') {
      if (open) {
        throw new Error(`${label} contains nested slot ${name} inside ${open.name}`)
      }
      open = {
        name,
        start: match.index,
        contentStart: match.index + match[0].length,
      }
      continue
    }

    if (!open) throw new Error(`${label} contains an unmatched slot end: ${name}`)
    if (open.name !== name) {
      throw new Error(`${label} closes slot ${open.name} with mismatched slot ${name}`)
    }
    if (byName.has(name)) throw new Error(`${label} contains duplicate slot: ${name}`)

    const block = {
      name,
      start: open.start,
      end: match.index + match[0].length,
      content: content.slice(open.contentStart, match.index),
    }
    blocks.push(block)
    byName.set(name, block)
    open = null
  }

  if (open) throw new Error(`${label} contains an unterminated slot: ${open.name}`)
  return { blocks, byName }
}

function parseOverlay(name, raw) {
  assertSafeRelativePath(name, 'overlay path')
  if (name.includes('/')) throw new Error(`overlay path must be a safe filename: ${name}`)
  if (!name.endsWith('.md')) throw new Error(`overlay filename must end in .md: ${name}`)

  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatter) throw new Error(`overlay ${name} must begin with YAML frontmatter`)

  let metadata
  try {
    metadata = parse(frontmatter[1])
  } catch (error) {
    throw new Error(`overlay ${name} has invalid YAML frontmatter: ${error.message}`)
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`overlay ${name} frontmatter must be an object`)
  }
  for (const key of Object.keys(metadata)) {
    if (!OVERLAY_FIELDS.has(key)) {
      throw new Error(`overlay ${name} frontmatter has unknown field: ${key}`)
    }
  }

  const id = assertSafeIdentifier(metadata.id, `overlay ${name} id`)
  const expectedId = basename(name, '.md')
  if (id !== expectedId) {
    throw new Error(`overlay filename ${expectedId} does not match id ${id}`)
  }
  const target = assertSafeRelativePath(metadata.target, `overlay ${name} target`)
  if (typeof metadata.purpose !== 'string' || metadata.purpose.trim() === '') {
    throw new Error(`overlay ${name} purpose must be a non-empty string`)
  }
  if (!Array.isArray(metadata.replaces) || metadata.replaces.length === 0) {
    throw new Error(`overlay ${name} replaces must be a non-empty array`)
  }

  const replaces = []
  const replacementNames = new Set()
  for (const value of metadata.replaces) {
    const slot = assertSafeIdentifier(value, `overlay ${name} replacement slot`)
    if (replacementNames.has(slot)) {
      throw new Error(`overlay ${name} has duplicate replacement slot: ${slot}`)
    }
    replacementNames.add(slot)
    replaces.push(slot)
  }

  const body = raw.slice(frontmatter[0].length)
  const slots = parseSlots(body, `overlay ${name}`)
  let cursor = 0
  for (const block of slots.blocks) {
    if (body.slice(cursor, block.start).trim() !== '') {
      throw new Error(`overlay ${name} contains stray text outside declared slot blocks`)
    }
    cursor = block.end
  }
  if (body.slice(cursor).trim() !== '') {
    throw new Error(`overlay ${name} contains stray text outside declared slot blocks`)
  }

  for (const slot of replaces) {
    if (!slots.byName.has(slot)) {
      throw new Error(`overlay ${name} is missing declared slot: ${slot}`)
    }
  }
  for (const slot of slots.byName.keys()) {
    if (!replacementNames.has(slot)) {
      throw new Error(`overlay ${name} contains undeclared slot block: ${slot}`)
    }
  }

  return { id, target, purpose: metadata.purpose, replaces, slots }
}

function readInputFile(path, role, onInput) {
  const bytes = onInput === undefined
    ? readFileSync(path)
    : readOrdinaryFile(path, {
        label: `${role} input`,
      }).bytes
  return {
    bytes,
    text: bytes.toString('utf8'),
    record() {
      onInput?.({
        absolutePath: path,
        role,
        bytes: Buffer.from(bytes),
      })
    },
  }
}

function loadOverlays(manifest, packDir, file, onInput) {
  const names = manifest.workflow?.overlays ?? []
  if (!Array.isArray(names)) throw new Error('manifest workflow.overlays must be an array')

  return names.map((name) => {
    assertSafeRelativePath(name, 'overlay path')
    if (name.includes('/')) throw new Error(`overlay path must be a safe filename: ${name}`)
    const path = findWorkflowFile(packDir, VARIANT_ROOTS, name)
    if (path === undefined) throw new Error(`workflow overlay not found: ${name}`)
    const input = readInputFile(path, 'workflow-overlay', onInput)
    const overlay = parseOverlay(name, input.text)
    if (overlay.target === file) input.record()
    return overlay
  })
}

function renderSlots(content, slots, replacements) {
  if (slots.blocks.length === 0) return content
  let rendered = ''
  let cursor = 0
  for (const block of slots.blocks) {
    rendered += content.slice(cursor, block.start)
    rendered += replacements.get(block.name) ?? block.content
    cursor = block.end
  }
  return rendered + content.slice(cursor)
}

export function resolveInstructionBody(
  manifest,
  packDir,
  file,
  { onInput } = {},
) {
  if (onInput !== undefined && typeof onInput !== 'function') {
    throw new Error('resolveInstructionBody onInput must be a function')
  }
  const instruction = readInputFile(
    resolveInstructionPath(packDir, file),
    'instruction',
    onInput,
  )
  instruction.record()
  const raw = instruction.text.trim() + '\n'
  const baseSlots = parseSlots(raw, `instruction ${file}`)
  const declaredFiles = new Set((manifest.instructions ?? []).map((instruction) => instruction.file))
  const replacements = new Map()

  for (const overlay of loadOverlays(manifest, packDir, file, onInput)) {
    if (!declaredFiles.has(overlay.target)) {
      throw new Error(`overlay ${overlay.id} target is not a declared instruction: ${overlay.target}`)
    }
    if (overlay.target !== file) continue

    for (const slot of overlay.replaces) {
      const key = `${overlay.target}\0${slot}`
      if (replacements.has(key)) {
        throw new Error(`duplicate overlay replacement for ${overlay.target} slot ${slot}`)
      }
      if (!baseSlots.byName.has(slot)) {
        throw new Error(`overlay ${overlay.id} slot ${slot} does not exist in base ${file}`)
      }
      replacements.set(key, overlay.slots.byName.get(slot).content)
    }
  }

  const replacementsBySlot = new Map()
  for (const [key, value] of replacements) {
    replacementsBySlot.set(key.slice(key.indexOf('\0') + 1), value)
  }
  return renderSlots(raw, baseSlots, replacementsBySlot).trim() + '\n'
}
