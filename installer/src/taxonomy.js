import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import {
  CLASSIFICATION_FACETS,
  skillMetadataFindings,
} from './dependencies/manifests.js'

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const OUTCOMES = new Set(['transform', 'reimagine', 'automate', 'foundation'])
const ROOT_FIELDS = new Set(['schemaVersion', ...CLASSIFICATION_FACETS])
const ENTRY_FIELDS = new Set(['id', 'label', 'description', 'order'])
const USE_CASE_FIELDS = new Set([...ENTRY_FIELDS, 'outcome'])

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field: ${key}`)
  }
}

function assertRequiredKeys(value, required, label) {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing required field: ${key}`)
    }
  }
}

function normalizeEntry(entry, facet, index) {
  const label = `taxonomy.yaml ${facet} entry ${index}`
  const fields = facet === 'useCases' ? USE_CASE_FIELDS : ENTRY_FIELDS
  requireObject(entry, label)
  assertOnlyKeys(entry, fields, label)
  assertRequiredKeys(entry, fields, label)

  requireString(entry.id, `${label} id`)
  if (!IDENTIFIER.test(entry.id)) {
    throw new Error(`${label} id must be a lower-kebab identifier`)
  }
  if (!Number.isSafeInteger(entry.order) || entry.order < 0) {
    throw new Error(`${label} order must be a non-negative safe integer`)
  }
  if (facet === 'useCases' && !OUTCOMES.has(entry.outcome)) {
    throw new Error(
      `${label} outcome must be one of: ${[...OUTCOMES].join(', ')}`,
    )
  }
  return {
    id: entry.id,
    label: requireString(entry.label, `${label} label`),
    description: requireString(entry.description, `${label} description`),
    ...(facet === 'useCases' ? { outcome: entry.outcome } : {}),
    order: entry.order,
  }
}

function normalizeFacet(entries, facet) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`taxonomy.yaml ${facet} must be a non-empty array`)
  }
  const normalized = entries.map((entry, index) =>
    normalizeEntry(entry, facet, index))
  const seen = new Set()
  for (const entry of normalized) {
    if (seen.has(entry.id)) {
      throw new Error(`taxonomy.yaml ${facet} has duplicate id: ${entry.id}`)
    }
    seen.add(entry.id)
  }
  normalized.sort((left, right) =>
    left.order - right.order ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  return new Map(normalized.map((entry) => [entry.id, entry]))
}

// Loads schemas/taxonomy.yaml. Each facet is a Map from id to entry, iterated
// in display order (order, then id).
export function loadTaxonomy(repoRoot) {
  const path = join(resolve(repoRoot), 'schemas', 'taxonomy.yaml')
  let value
  try {
    value = parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`taxonomy.yaml could not be loaded: ${error.message}`)
  }
  requireObject(value, 'taxonomy.yaml')
  assertOnlyKeys(value, ROOT_FIELDS, 'taxonomy.yaml')
  assertRequiredKeys(value, ROOT_FIELDS, 'taxonomy.yaml')
  if (value.schemaVersion !== 1) {
    throw new Error(`taxonomy.yaml has unsupported schemaVersion: ${value.schemaVersion}`)
  }

  return {
    schemaVersion: 1,
    ...Object.fromEntries(
      CLASSIFICATION_FACETS.map((facet) => [
        facet,
        normalizeFacet(value[facet], facet),
      ]),
    ),
  }
}

// Lints one parsed skill.yaml against the vocabulary and returns every finding
// as a message; an empty array means the metadata is valid. It never throws on
// a problem in the metadata.
//
// - requireUseCases: classification.useCases needs at least one value.
// - expectedName: the skill directory name the metadata must declare.
// - lock: the result of loadSkillLock; origin upstream then needs a lock entry.
export function lintSkillMetadata(
  metadata,
  taxonomy,
  { requireUseCases = false, expectedName, lock } = {},
) {
  const findings = skillMetadataFindings(metadata, { expectedName })
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return findings
  }
  if (metadata.schemaVersion === 1) {
    findings.push(
      'skill.yaml schemaVersion 1 has no classification; it is read as origin: ramp with an empty classification',
    )
    return findings
  }
  if (metadata.schemaVersion !== 2) return findings

  const classification =
    metadata.classification && typeof metadata.classification === 'object'
      ? metadata.classification
      : {}
  for (const facet of CLASSIFICATION_FACETS) {
    const values = classification[facet]
    if (!Array.isArray(values)) continue
    for (const value of values) {
      if (typeof value === 'string' && !taxonomy[facet].has(value)) {
        findings.push(`skill.yaml classification.${facet} has unknown value: ${value}`)
      }
    }
  }
  if (
    requireUseCases &&
    !(Array.isArray(classification.useCases) && classification.useCases.length > 0)
  ) {
    findings.push('skill.yaml classification.useCases needs at least one value')
  }
  if (
    lock &&
    metadata.origin === 'upstream' &&
    typeof metadata.name === 'string' &&
    !lock.skills.has(metadata.name)
  ) {
    findings.push(`skill.yaml origin upstream requires a skills.lock.yaml entry named ${metadata.name}`)
  }
  return findings
}
