import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { comparePortablePaths } from '../dependencies/checksum.js'
import {
  assertArtifactPath,
  readOrdinaryFile,
} from './entries.js'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function sameLegalRecord(left, right) {
  return (
    left.path === right.path &&
    left.sha256 === right.sha256 &&
    left.size === right.size &&
    left.executable === right.executable
  )
}

function verifyLegalFile(path, record, label, options) {
  const { bytes, status } = readOrdinaryFile(path, {
    label,
    ...options,
  })
  if (
    bytes.length !== record.size ||
    sha256(bytes) !== record.sha256
  ) {
    throw new Error(`${label} hash or size drift`)
  }
  if (
    process.platform !== 'win32' &&
    Boolean(status.mode & 0o111n) !== record.executable
  ) {
    throw new Error(`${label} executable mode drift`)
  }
  return bytes
}

export function collectLegalPayloads({
  repoRoot,
  cacheDir,
  usedSkills,
  recordInput,
  onFilesystemPhase,
} = {}) {
  if (typeof repoRoot !== 'string' || repoRoot === '') {
    throw new Error('repoRoot must be a non-empty path')
  }
  if (typeof cacheDir !== 'string' || cacheDir === '') {
    throw new Error('cacheDir must be a non-empty path')
  }
  if (!Array.isArray(usedSkills)) throw new Error('usedSkills must be an array')
  if (recordInput !== undefined && typeof recordInput !== 'function') {
    throw new Error('recordInput must be a function')
  }

  const repositoryLicensePath = join(repoRoot, 'LICENSE')
  const repositoryLicense = readOrdinaryFile(
    repositoryLicensePath,
    {
      label: 'repository LICENSE',
      trustedRoot: repoRoot,
      onPhase: onFilesystemPhase,
    },
  ).bytes
  recordInput?.({
    kind: 'repository',
    absolutePath: repositoryLicensePath,
    role: 'repository-license',
    bytes: Buffer.from(repositoryLicense),
  })

  const groups = new Map()
  for (const skill of usedSkills) {
    if (skill?.kind !== 'upstream') continue
    if (
      skill.attribution !== 'locked' ||
      typeof skill.source !== 'string' ||
      typeof skill.commit !== 'string'
    ) {
      throw new Error(`upstream skill ${skill?.name ?? '<unknown>'} lacks locked provenance`)
    }
    const existing = groups.get(skill.source)
    if (existing && existing.commit !== skill.commit) {
      throw new Error(
        `source ${skill.source} selects multiple commits: ` +
        `${existing.commit} and ${skill.commit}`,
      )
    }
    if (existing) {
      if (
        existing.repository !== skill.repository ||
        existing.license !== skill.license ||
        existing.licensePath !== skill.licensePath ||
        existing.noticePath !== skill.noticePath ||
        !sameLegalRecord(existing.licenseFile, skill.licenseFile) ||
        !sameLegalRecord(existing.noticeFile, skill.noticeFile)
      ) {
        throw new Error(`source ${skill.source} has inconsistent locked legal metadata`)
      }
      existing.skills.add(skill.name)
      continue
    }
    groups.set(skill.source, {
      id: skill.source,
      repository: skill.repository,
      commit: skill.commit,
      license: skill.license,
      licensePath: assertArtifactPath(skill.licensePath, 'licensePath'),
      noticePath: assertArtifactPath(skill.noticePath, 'noticePath'),
      licenseFile: { ...skill.licenseFile },
      noticeFile: { ...skill.noticeFile },
      skills: new Set([skill.name]),
    })
  }

  const sources = [...groups.values()]
    .sort((left, right) => comparePortablePaths(left.id, right.id))
    .map((source) => {
      const sourceRoot = join(
        cacheDir,
        'sources',
        source.id,
        source.commit,
      )
      const licensePath = join(sourceRoot, ...source.licensePath.split('/'))
      const noticePath = join(sourceRoot, ...source.noticePath.split('/'))
      const licenseBytes = verifyLegalFile(
        licensePath,
        source.licenseFile,
        `locked LICENSE for ${source.id}@${source.commit}`,
        {
          trustedRoot: cacheDir,
          onPhase: onFilesystemPhase,
        },
      )
      const noticeBytes = verifyLegalFile(
        noticePath,
        source.noticeFile,
        `locked NOTICE for ${source.id}@${source.commit}`,
        {
          trustedRoot: cacheDir,
          onPhase: onFilesystemPhase,
        },
      )
      const lockedProvenance = {
        attribution: 'locked',
        source: source.id,
        repository: source.repository,
        commit: source.commit,
      }
      recordInput?.({
        kind: 'external',
        absolutePath: licensePath,
        path: source.licensePath,
        sourceKind: 'upstream-license',
        executable: source.licenseFile.executable,
        provenance: lockedProvenance,
        expectedRecord: {
          ...source.licenseFile,
          path: source.licensePath,
        },
        bytes: Buffer.from(licenseBytes),
        trustedRoot: cacheDir,
      })
      recordInput?.({
        kind: 'external',
        absolutePath: noticePath,
        path: source.noticePath,
        sourceKind: 'upstream-notice',
        executable: source.noticeFile.executable,
        provenance: lockedProvenance,
        expectedRecord: {
          ...source.noticeFile,
          path: source.noticePath,
        },
        bytes: Buffer.from(noticeBytes),
        trustedRoot: cacheDir,
      })
      return {
        id: source.id,
        repository: source.repository,
        commit: source.commit,
        license: source.license,
        licenseBytes: Buffer.from(licenseBytes),
        noticeBytes: Buffer.from(noticeBytes),
        licensePath: source.licensePath,
        noticePath: source.noticePath,
        skills: [...source.skills].sort(comparePortablePaths),
      }
    })

  return {
    repositoryLicense: Buffer.from(repositoryLicense),
    sources,
  }
}

export function renderThirdPartyNotices(sources) {
  if (!Array.isArray(sources)) throw new Error('notice sources must be an array')
  const lines = [
    '# Third-Party Notices',
    '',
    'This bundle includes the following locked upstream skill sources.',
  ]
  for (const source of [...sources].sort((left, right) =>
    comparePortablePaths(left.id, right.id))) {
    lines.push(
      '',
      `## ${source.id}`,
      '',
      `- Repository: ${source.repository}`,
      `- Commit: \`${source.commit}\``,
      `- License: ${source.license}`,
      `- License file: \`licenses/${source.id}/LICENSE\``,
      `- Notice file: \`licenses/${source.id}/NOTICE\``,
      `- Skills: ${[...source.skills].sort(comparePortablePaths).join(', ')}`,
    )
  }
  if (sources.length === 0) {
    lines.push('', 'No third-party upstream skill payloads are included.')
  }
  return `${lines.join('\n')}\n`
}
