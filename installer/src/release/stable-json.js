import { createHash } from 'node:crypto'

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeJson(value, ancestors, label) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} JSON number must be finite`)
    }
    return value
  }
  if (typeof value !== 'object') {
    throw new Error(`${label} contains an unsupported JSON value`)
  }
  if (ancestors.has(value)) throw new Error(`${label} contains a JSON cycle`)
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new Error(`${label} contains a sparse JSON array`)
        }
      }
      return value.map((item, index) =>
        normalizeJson(item, ancestors, `${label}[${index}]`))
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${label} JSON value must be a plain object`)
    }
    const normalized = Object.create(null)
    for (const key of Object.keys(value).sort(compareText)) {
      if (DANGEROUS_KEYS.has(key)) {
        throw new Error(`${label} contains dangerous JSON key: ${key}`)
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new Error(`${label} JSON properties must not use accessors`)
      }
      normalized[key] = normalizeJson(
        descriptor.value,
        ancestors,
        `${label}.${key}`,
      )
    }
    return normalized
  } finally {
    ancestors.delete(value)
  }
}

export function stableJson(value) {
  return `${JSON.stringify(normalizeJson(value, new Set(), 'value'), null, 2)}\n`
}

export function sha256Hex(bytes) {
  if (
    typeof bytes !== 'string' &&
    !Buffer.isBuffer(bytes) &&
    !(bytes instanceof Uint8Array)
  ) {
    throw new Error('sha256 input must be a string, Buffer, or Uint8Array')
  }
  return createHash('sha256').update(bytes).digest('hex')
}

export function renderSha256Sums(entries) {
  if (!Array.isArray(entries)) throw new Error('entries must be an array')
  return entries
    .filter((entry) => entry?.path !== 'SHA256SUMS')
    .map((entry) => {
      if (typeof entry?.path !== 'string' || !Buffer.isBuffer(entry.bytes)) {
        throw new Error('checksum entries require a path and Buffer bytes')
      }
      return { path: entry.path, sha256: sha256Hex(entry.bytes) }
    })
    .sort((left, right) => compareText(left.path, right.path))
    .map((entry) => `${entry.sha256}  ${entry.path}\n`)
    .join('')
}
