import { assertArtifactPath } from './entries.js'

const decoder = new TextDecoder('utf-8', { fatal: true })
const MODEL_FIELDS = new Set([
  'manifestName',
  'overlayRoot',
  'conflictName',
  'stateRoot',
  'templates',
])
const TEMPLATE_FIELDS = new Set(['bash', 'powershell'])
const TOKEN_NAMES = {
  manifestName: '__MANIFEST_NAME__',
  overlayRoot: '__OVERLAY_ROOT__',
  conflictName: '__CONFLICT_NAME__',
  stateRoot: '__STATE_ROOT__',
}

function plainObject(value, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(`${label} must be a plain object`)
  }
  return value
}

function data(value, name, label) {
  const descriptor = Object.getOwnPropertyDescriptor(value, name)
  if (!descriptor || descriptor.get || descriptor.set) {
    throw new Error(`${label}.${name} must be an own data property`)
  }
  return descriptor.value
}

function exactFields(value, allowed, label) {
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) throw new Error(`${label} has unknown field: ${name}`)
  }
}

function layoutValue(value, label) {
  assertArtifactPath(value, label)
  if (value.includes('/') || /['"$`]/.test(value)) {
    throw new Error(`${label} must be a safe portable filename`)
  }
  return value
}

function templateText(value, label) {
  if (!Buffer.isBuffer(value)) {
    throw new Error(`${label} must be captured UTF-8 bytes`)
  }
  let text
  try {
    text = decoder.decode(value)
  } catch {
    throw new Error(`${label} must contain valid UTF-8`)
  }
  if (/\r/.test(text)) {
    throw new Error(`${label} must be canonical UTF-8 LF text`)
  }
  return text
}

function render(template, replacements, label) {
  let result = template
  for (const [name, token] of Object.entries(TOKEN_NAMES)) {
    const count = result.split(token).length - 1
    if (count !== 1) {
      throw new Error(`${label} must contain exactly one ${token}`)
    }
    result = result.replace(token, replacements[name])
  }
  if (/__[A-Z][A-Z0-9_]+__/.test(result)) {
    throw new Error(`${label} contains an unreplaced template token`)
  }
  return result.replace(/\n*$/, '\n')
}

export function renderInstallers(model) {
  plainObject(model, 'model')
  exactFields(model, MODEL_FIELDS, 'model')
  const replacements = Object.fromEntries(
    Object.keys(TOKEN_NAMES).map((name) => [
      name,
      layoutValue(data(model, name, 'model'), name),
    ]),
  )
  const templates = plainObject(data(model, 'templates', 'model'), 'templates')
  exactFields(templates, TEMPLATE_FIELDS, 'templates')
  const bash = templateText(data(templates, 'bash', 'templates'), 'templates.bash')
  const powershell = templateText(
    data(templates, 'powershell', 'templates'),
    'templates.powershell',
  )
  return {
    bash: render(bash, replacements, 'Bash installer template'),
    powershell: render(
      powershell,
      replacements,
      'PowerShell installer template',
    ),
  }
}
