import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { loadRampSkillMetadata } from '../src/dependencies/manifests.js'
import { createSkillResolver } from '../src/dependencies/resolver.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const rampRoot = join(repoRoot, 'skills', 'ramp')
const movedSkills = [
  'mobile-test-automation',
  'web-test-automation',
  'ecs-architect',
  'ecs-build',
  'ecs-devops',
  'ecs-observability',
  'ecs-operation-review',
  'ecs-recon',
  'ecs-security',
]

// Generated once from commit 04c0a75 before the filesystem moves. These
// self-contained records make the permanent regression independent of Git
// history and shallow-clone depth.
const expectedMovedFiles = [
  ["ecs-architect","SKILL.md","aee5d037e6e6c76c738c85ab9f17adee1bdc34a45a4cb803bca13f56d664a8c7",18896,false],
  ["ecs-architect","references/architecture-design.md","7c03edb4935ea44a3404e18bcb570c2600661f8e63ffde6f166242fe45a86023",17966,false],
  ["ecs-architect","references/best-practices-corpus.md","3c3033ba8d483584a3ba15bee5745ed9861eb2c2d306b7bc460d293899ca4c0c",9918,false],
  ["ecs-architect","references/capacity-and-scaling.md","19615403dcb8f09ade64396b92294404369b36c3b8de95e1c883732c11643d9a",13240,false],
  ["ecs-architect","references/launch-type-migration.md","bb1fb2945f98cc142b6bd54383c12e44a4d0cd0c178efdbce5d4661d36e88ed9",11471,false],
  ["ecs-architect","references/model-selection-framework.md","376bb0295493f585938c6e75d6c8d3b5615dc6bf0b79fbfe79ceb07042ee62e7",24530,false],
  ["ecs-architect","references/networking-and-eni-density.md","9efbd7cf551bda4227be182d1f15b37529dd6ba73295c82cd8fd28831fc8f958",15253,false],
  ["ecs-build","SKILL.md","cfa320c37fd768ae81ccbe12a2c76e84118fd9d6feebff550f9bfc809910f3df",28413,false],
  ["ecs-build","references/autoscaling.md","178d5b697b0fd6dfd33e45018b96aaa8365ffac6a668bac2c02e69fa7c77b4af",5226,false],
  ["ecs-build","references/baseline-defaults.md","7bbdb0e27be8c5973a18c5e9d665fba8854cdc6b69e82c4af146b3a411c4adb7",5389,false],
  ["ecs-build","references/capacity-provider-guide.md","98dcd0297913c2e0c0f87e5a1aa74784db5334debc8a65547007a3bb57a643ba",15045,false],
  ["ecs-build","references/networking-security.md","d469b79ffb347bfab94b858bd8987af6227cd375f64f5b1c6a203ef716eb57c3",7900,false],
  ["ecs-build","references/service-and-deployment.md","8d211a29d64a224ee5f766608246809fac04ee2093a64223d5f839d0a383ef3c",11741,false],
  ["ecs-build","references/task-definition-guide.md","a5b691c416d7379560c7679d00322f7d4d61ab7128189ec91b36e6a33436b025",12694,false],
  ["ecs-build","references/version-matrix.md","6f391650a20bf72a8ffc36a6faad8444ae5cfb1fc2f77ad321773f1ced1f6ddb",4040,false],
  ["ecs-build","scripts/validate_project.sh","adccaaf85b37bcfd2964dd5658a95bc415c75b1cfdef1772d9618e526907eed0",24232,true],
  ["ecs-devops","SKILL.md","e209ea729ece73e6532bdbd0a66a2b8fe926de47fb35b52940a07c93c529c54d",37120,false],
  ["ecs-devops","references/cicd-pipelines.md","dcc807915c8d0e406f66a4e676dfb5df7d10658b33b8db24502d494f062fe0a0",11559,false],
  ["ecs-devops","references/controllers-and-migration.md","f12977b725cab8ec9fe1e381c117f02b53ed8cadb29380692e6c349a06a36d3f",10735,false],
  ["ecs-devops","references/deployment-strategies.md","8fcc589baed34e23d823235958d23a54b3669c22f9d4851001b398639e77dbc5",19823,false],
  ["ecs-devops","references/failure-detection-and-rollback.md","89b086a6c2f8b9159e19bf7d2c845f72cc6650bf799ef757be84070bd1c28a3a",13651,false],
  ["ecs-observability","SKILL.md","def25cc59d333ebf0b6450347b6a89e45f79313ed9df42d15e457bdb54f57541",22528,false],
  ["ecs-observability","references/launch-type-matrix.md","c9b84d56e0529966fcc2deae6b89979ed7e837b9bf84f7c0515fbe735e065aa6",8043,false],
  ["ecs-observability","references/log-delivery.md","2baacfdd8935146bafa9f23e6b42932132531c8f2d185815be06cd4110b7dd65",13344,false],
  ["ecs-observability","references/metrics-stacks.md","8efa0f72ace7a934aa526ff293f7a8875e3fca17ca2712813e5ada2f3addacc0",12208,false],
  ["ecs-observability","references/native-visibility-and-exec.md","79af3ea928818160e0c0741dfa91ad05de9ac3b419cb6860510b9660a0c09451",7673,false],
  ["ecs-observability","references/tracing-and-signals.md","f3106f7405ee0b015a3a401764e494817be36a9a9906e5aceb79a28018366bf7",8842,false],
  ["ecs-operation-review","SKILL.md","035e9fd12ccb7351dfe7749b9635a0dabdf7fc3232ca8a9b926ff0c1c7ca5af4",12085,false],
  ["ecs-operation-review","references/cluster-capacity.md","6a2885de64b2459024d82872f2bf792d4f7e9119007e1e11b53d8953f7d92bbb",13169,false],
  ["ecs-operation-review","references/networking.md","035711f13cab51d5c5f2ec0c7dd4494a29dba715653de294804f4a8d100ef95a",9647,false],
  ["ecs-operation-review","references/observability.md","cade4f5a4e27150199cb13fb9eab815ccbbb8dee9ad982949ecbc68208d9b57c",9184,false],
  ["ecs-operation-review","references/operational-processes.md","4080e1a139b3cd10efe25dbbca74b6491f2fda7ec38661c4c24713824806cc66",10664,false],
  ["ecs-operation-review","references/report-generation.md","437b79502c08cea49efda95b96ed10524fb62795b14919e06460ef028fed48af",18709,false],
  ["ecs-operation-review","references/scoring-rubric.md","dc490a5b12f3741691fecc3e7d5eec1c8dcf7e36a2d829222253c9f626c45f23",7651,false],
  ["ecs-operation-review","references/security-posture.md","bb27afda0bbe176c9b49322eb6902db1a1fdb157442baee6e4a481b0b48a9c47",9742,false],
  ["ecs-operation-review","references/service-health-scaling.md","e627a2ed6ce8da21c379e171d0b13370b52429b5e1190588088a70b6963dd018",8291,false],
  ["ecs-operation-review","references/services-deployment.md","3c25848bcb49b6223e8a4814cafbd18eb0aef140b215bb347730ef8da0d70d06",10054,false],
  ["ecs-operation-review","references/task-definitions.md","14a52636501025ee321b7ddb9e522ad6ed3c7aab6762f6671b7d123bdbf18765",6104,false],
  ["ecs-operation-review","tools/report_to_html.py","e98da39b8d81c2292f51888553c5daaa18a93d66b411cd63bc610a552c79af00",11375,false],
  ["ecs-recon","SKILL.md","493314ab07f775c8248fdb378674a82d4eff7929cdc38592f6a487314597378f",18423,false],
  ["ecs-recon","references/autoscaling.md","4d56378fee945dcf4a52762a3d31a72b4690e8bcfc48b7b188641d4fb83fa60f",21861,false],
  ["ecs-recon","references/cicd.md","23fc7811cef7b3f92456b69d01f55bd7f79eadeb0f9a113581cee2e81f363010",22114,false],
  ["ecs-recon","references/compute.md","acdd042b5a8ff9fc8c5e5b9e391a19bff4d34d606463c3384c11824e0a99e294",15866,false],
  ["ecs-recon","references/deployment.md","47fe3e068fa461f207f374940d9c4d05ab26d94abb4a376219a60aaf127c771b",20859,false],
  ["ecs-recon","references/iac.md","2b079b7b103b28136d4b42852f1bc22180ec25bf9993b5f52874473be1439b8c",28225,false],
  ["ecs-recon","references/networking.md","4ae435e4ad8f51a059c6f172578cdfaa01818608451272129ff4058f470e9331",22161,false],
  ["ecs-recon","references/observability.md","25bb6a75a3f0476cd413d4118e2dbc2099ffaf08e7068c30e219325086133199",15170,false],
  ["ecs-recon","references/overview.md","844b0bad77930f7fddfb6ad9f6a1cc1d1da34ebcfb041b550117d8eef8d0b19d",14604,false],
  ["ecs-recon","references/security.md","2e059418cce30da6c6bd231b3737c1fc2db8c59ea9287b28119db5da2c7a5eda",14321,false],
  ["ecs-recon","references/task-definitions.md","c230e297b3542178b1e90adf5704f77d1ab28cb403b406165f7a601d6e9ab89b",11001,false],
  ["ecs-security","SKILL.md","3d28f0155602768e73a143bdaeb1f14868093a864aea5b190095e6edc0cb55e9",28424,false],
  ["ecs-security","references/audit-logging.md","c06b5ef333007f64e4098a4eb04f8f76a6d786373d2058f1979b7a00dc41bc07",6035,false],
  ["ecs-security","references/compliance-accelerators.md","f9a3e26431ce0e69d173008abda1fb755375925b7a4ecd13ebe3af65142b774d",3804,false],
  ["ecs-security","references/compliance-regimes.md","43984b698e095a421404d8e0d2bf2a7de23a867e9d45f72d786a0b6e657ece49",9467,false],
  ["ecs-security","references/encryption-and-secrets.md","87a9057f28116b77d29ebe9423894a60723ce544ad16afc39e17a1173dc636e1",6443,false],
  ["ecs-security","references/engagement-and-response.md","ed29b94e0265054a1a2c31a5529ec043e1bb9747bad73d5e8a3d77bbf98f2502",6937,false],
  ["ecs-security","references/identity-and-access.md","9b921b377461533ad0115ddcda926392a2ac2e0b487710112fd4f240d5ca639a",14623,false],
  ["ecs-security","references/image-supply-chain.md","45fc74e6ee571f19a6269e12a7f86585e357ca4223f8ac8086cc722d659f8e16",6378,false],
  ["ecs-security","references/incident-response-and-forensics.md","d0d401c8b1a1adf1d7bfa416edb861e0d12ecca06cc5bd53be8b8e1bdcd73c64",6506,false],
  ["ecs-security","references/network-isolation.md","6556d1a8228321081a1a7e6b64dc55720d761ec5391665c293372782d8036aa4",8441,false],
  ["ecs-security","references/runtime-security.md","41e23994e05a1bb87efa489eaa41ba14eef73646056729a607c3c55b38a204dd",6087,false],
  ["ecs-security","references/shared-responsibility.md","4c162eb0e9bae332d519d7e3d91ff45d40e15234ce65a8a568ae1184c39ffa0a",6965,false],
  ["ecs-security","references/task-container-hardening.md","0b18d7539eaa6a906b6686c86fc68919555d0a7baafe8bef015dae25536d47a0",7237,false],
  ["mobile-test-automation","SKILL.md","68fe5f5a847e8a7595ff24e1769312d510f355e45efef23806f6fbc6f3ced87e",9917,false],
  ["mobile-test-automation","references/appium-setup.md","ec4e0d355c301ba545c2ef09bd44635a3652283bda9e95ddad7ec5c3b49c316c",5167,false],
  ["mobile-test-automation","references/detox-and-flutter.md","a6d1a175027c04ee76051bb59b880879897ba88f801b5a69c702f6e0340c9443",5146,false],
  ["mobile-test-automation","references/device-farm-and-ci.md","742880ddc25e4a44601756e70c9ee7a2644baf242b1352b0790fcd8ce960d7f9",6480,false],
  ["mobile-test-automation","references/device-strategy.md","cd4e110522fd9e0562d419cd156653bd810cf921aa9bdf703c1734a2c0ea8438",5108,false],
  ["mobile-test-automation","references/espresso-and-xcuitest.md","66a856d8e0154a0ef18fa3aced55d8da9aeed184ce40b2c6275ba883096cf80d",5241,false],
  ["mobile-test-automation","references/flakiness-mobile.md","2f3054061a1a208cf12a560ff11080f37a1e1c400db705313afcd426c5bec7f7",6724,false],
  ["mobile-test-automation","references/gestures-lifecycle-and-deeplinks.md","a38ddda1665ff569d12c0b9cce157df6c543c731060b0a4fd266d7848f760d41",6252,false],
  ["mobile-test-automation","references/maestro-flows.md","2be25a3570c161c9e2e3ad08df3982dece6f5e6bacca552a0b458614c07034e8",3949,false],
  ["mobile-test-automation","references/qa-design-decisions.md","59c76735b8a97300592088e0a017644d945b6f783a2462a785c5dc9604294dd6",7396,false],
  ["mobile-test-automation","references/tool-selection.md","df857f376c8aa3937096ee663af15915939340f42e806b78f25de89e9f0517a2",5166,false],
  ["web-test-automation","SKILL.md","6a2aabd7289a1d2caf38c0209a55dddcb9dd4f3496283ea80ef81375a186d754",7299,false],
  ["web-test-automation","references/accessibility-and-visual-regression.md","435be856f86e066b1b62ec606f3ab4498a49da108506f91a8e76c89a03759aeb",4452,false],
  ["web-test-automation","references/api-testing-and-network-mocking.md","9ea550cd178070683e12c9536c18456e930fa78f64cec6f3c7ec787c5eeefb68",5056,false],
  ["web-test-automation","references/architecture-pom-fixtures.md","64fa352826d74ad8faad5aa9112c664678e3a2a3630b006557fa0a34655b8a81",4944,false],
  ["web-test-automation","references/assertions-waiting-and-flakiness.md","a1c917b6be027f4fd4991f538f72b5bc5c57292bad782d6f5251046fd5169dcf",6696,false],
  ["web-test-automation","references/ci-and-parallelization.md","1e49e4117ff4bcdb00d49bdd47688ffd5266c0b60c7958e48cf926d2400811ff",4821,false],
  ["web-test-automation","references/locators-and-selectors.md","900a2831747ed29e7a4252f1e9aa9e7be499eb3ff65db9941daca1ddffaa921a",4614,false],
  ["web-test-automation","references/migration-to-playwright.md","2916b8d3c483e256c110f9849170420dc8d7d61e2f0f2001d193685b3ba943a5",6737,false],
  ["web-test-automation","references/qa-design-decisions.md","f9e4981835899c56fcea80101df00cbebf997eda29578634bbb8d6121dfc93d4",7146,false],
  ["web-test-automation","references/test-isolation-and-auth.md","f9d051c0eafba8a3dc9df9d4f96a30e45d8b0ead417e61cc566ec27cd6cc6731",4236,false],
  ["web-test-automation","references/tool-selection.md","13508e111b1ea5cbf532a08bf1a4e2a1e1198f5d5eefdf28c7fbcc8168238c21",4506,false],
]

const helperPackNames = [
  'agentic-ai-workflow',
  'agentic-incident-response',
  'api-platform-migration-n-modernization',
  'cots-rewrite-on-cloudnative',
  'dotnet-app-modernization-on-aws',
  'framework-upgrade-containerise',
  'genai-on-serverless',
  'legacy-transformation-on-aws',
  'ocr-mobile-app-on-serverless',
  'qa-automated-testing',
  'serverless-event-driven-on-aws',
  'voice-ai-agent-on-aws',
  'vulnerability-remediation-pipeline',
  'web-app-on-cloudnative',
]

const exactRegularProductFiles = [
  'dependencies/skills.lock.yaml',
  'installer/src/render/add-skills.js',
  'installer/src/render/add-skills.template.sh',
  'installer/src/render/add-skills.template.ps1',
  'installer/src/build-all.js',
  'installer/bin/ramp-pack.js',
  'installer/test/add-skills-helpers.test.js',
  'installer/test/build-all.test.js',
  'installer/test/checkpoint3a-contract.test.js',
  'installer/test/cli-workspace.test.js',
  'installer/test/e2e.test.js',
  'installer/test/legacy-transformation-skills.test.js',
  'installer/test/pilot-skill-provenance.test.js',
  'installer/test/pilot-upstream-skill-contract.test.js',
  'installer/test/scaffold-drift.test.js',
  'installer/test/skill-sync.test.js',
  '.github/workflows/build-packs.yml',
  'scripts/regenerate.sh',
  'packs/qa-automated-testing/README.md',
  'packs/legacy-transformation-on-aws/README.md',
  ...helperPackNames.flatMap((pack) => [
    `packs/${pack}/add-skills.sh`,
    `packs/${pack}/add-skills.ps1`,
  ]),
]

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function portable(path) {
  return path.split(sep).join('/')
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function collectMovedFiles() {
  const records = []

  function visit(skill, root, directory) {
    const directoryStatus = lstatSync(directory)
    if (directoryStatus.isSymbolicLink() || !directoryStatus.isDirectory()) {
      throw new Error(`moved skill path must be an ordinary directory: ${directory}`)
    }

    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodePoints(left.name, right.name))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const status = lstatSync(path)
      const relativePath = portable(relative(root, path))
      if (status.isSymbolicLink()) {
        throw new Error(`moved skill contains a symbolic link: ${skill}/${relativePath}`)
      }
      if (status.isDirectory()) {
        visit(skill, root, path)
        continue
      }
      if (!status.isFile()) {
        throw new Error(`moved skill contains a special entry: ${skill}/${relativePath}`)
      }
      if (relativePath === 'skill.yaml') continue

      const bytes = readFileSync(path)
      records.push({
        skill,
        path: relativePath,
        sha256: sha256(bytes),
        size: bytes.length,
        executable: (status.mode & 0o111) !== 0,
      })
    }
  }

  for (const skill of movedSkills) {
    const root = join(rampRoot, skill)
    visit(skill, root, root)
  }
  return records.sort(
    (left, right) =>
      compareCodePoints(left.skill, right.skill) ||
      compareCodePoints(left.path, right.path),
  )
}

function expectedMovedFileRecords() {
  return expectedMovedFiles.map(
    ([skill, path, digest, size, executable]) => ({
      skill,
      path,
      sha256: digest,
      size,
      executable,
    }),
  )
}

function assertOrdinaryFile(relativePath) {
  assertOrdinaryPath(relativePath, 'file')
}

function assertOrdinaryPath(relativePath, finalKind) {
  const segments = portable(relativePath).split('/')
  let current = repoRoot
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index])
    const status = lstatSync(current)
    const display = segments.slice(0, index + 1).join('/')
    expect(status.isSymbolicLink(), `${display} must not be a symbolic link`).toBe(
      false,
    )
    const isFinal = index === segments.length - 1
    if (!isFinal || finalKind === 'directory') {
      expect(status.isDirectory(), `${display} must be a directory`).toBe(true)
    } else {
      expect(status.isFile(), `${display} must be a regular file`).toBe(true)
    }
  }
}

function readRepo(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

function normalizedRun(step) {
  return String(step?.run ?? '').replace(/\s+/g, ' ').trim()
}

function stepIndex(steps, predicate) {
  return steps.findIndex((step) => predicate(step, normalizedRun(step)))
}

function lastStepIndex(steps, predicate) {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (predicate(steps[index], normalizedRun(steps[index]))) return index
  }
  return -1
}

describe('Checkpoint 3A RAMP-owned skill move contract', () => {
  it('preserves the complete 85-file baseline without depending on Git history', () => {
    const expected = expectedMovedFileRecords()
    expect(expected).toHaveLength(85)
    expect(
      new Set(expected.map((record) => `${record.skill}\0${record.path}`)).size,
    ).toBe(85)

    const actual = collectMovedFiles()
    if (process.platform === 'win32') {
      const withoutExecutable = (record) => {
        const { executable: _executable, ...portableRecord } = record
        return portableRecord
      }
      expect(actual.map(withoutExecutable)).toEqual(
        expected.map(withoutExecutable),
      )
    } else {
      expect(actual).toEqual(expected)
    }
  })

  it('loads exact RAMP metadata and resolves every moved skill with declared provenance', () => {
    const sentinels = mkdtempSync(join(tmpdir(), 'ramp-checkpoint3a-'))
    const cacheSentinel = join(sentinels, 'cache-must-not-be-read')
    const librarySentinel = join(sentinels, 'library-must-not-be-read')
    writeFileSync(cacheSentinel, 'cache sentinel\n')
    writeFileSync(librarySentinel, 'library sentinel\n')

    try {
      const resolver = createSkillResolver({
        repoRoot,
        cacheDir: cacheSentinel,
        libraryDir: librarySentinel,
        strictProvenance: true,
        allowLegacyLocal: false,
      })

      for (const skill of movedSkills) {
        const directory = join(rampRoot, skill)
        const expectedMetadata = {
          schemaVersion: 1,
          kind: 'ramp-skill',
          name: skill,
          version: '1.0.0',
          license: 'MIT-0',
        }
        expect(loadRampSkillMetadata(directory, { expectedName: skill })).toEqual(
          expectedMetadata,
        )
        expect(readFileSync(join(directory, 'skill.yaml'), 'utf8')).toBe(
          [
            'schemaVersion: 1',
            'kind: ramp-skill',
            `name: ${skill}`,
            'version: 1.0.0',
            'license: MIT-0',
            '',
          ].join('\n'),
        )

        const isTestingSkill =
          skill === 'mobile-test-automation' || skill === 'web-test-automation'
        const packId = isTestingSkill
          ? 'qa-automated-testing'
          : 'legacy-transformation-on-aws'
        const resolved = resolver.resolveSkill(skill, {
          packDir: join(repoRoot, 'packs', packId),
          packId,
        })
        expect(resolved.directory).toBe(directory)
        expect(resolved.provenance).toMatchObject({
          kind: 'ramp',
          attribution: 'declared',
          name: skill,
          version: '1.0.0',
          license: 'MIT-0',
        })
        expect(resolved.provenance).not.toHaveProperty('ownerPack')
        expect(resolved.provenance).not.toHaveProperty('source')
        expect(resolved.provenance).not.toHaveProperty('repository')
        expect(resolved.provenance).not.toHaveProperty('commit')
        expect(resolved.provenance).not.toHaveProperty('path')
      }

      expect(readFileSync(cacheSentinel, 'utf8')).toBe('cache sentinel\n')
      expect(readFileSync(librarySentinel, 'utf8')).toBe('library sentinel\n')
    } finally {
      rmSync(sentinels, { recursive: true, force: true })
    }
  })

  it('removes the nine compatibility-library source trees', () => {
    for (const skill of movedSkills) {
      expect(existsSync(join(repoRoot, 'skills-library', skill)), skill).toBe(
        false,
      )
    }
  })
})

describe('Checkpoint 3A scoped product filesystem contract', () => {
  it('keeps every exact changed product file ordinary and all moved trees link-free', () => {
    expect(exactRegularProductFiles).toHaveLength(48)
    expect(new Set(exactRegularProductFiles).size).toBe(48)
    for (const relativePath of exactRegularProductFiles) {
      assertOrdinaryFile(relativePath)
    }

    for (const skill of movedSkills) {
      assertOrdinaryPath(`skills/ramp/${skill}`, 'directory')
    }

    // The collector recursively rejects symbolic links and special entries.
    expect(collectMovedFiles()).toHaveLength(85)
  })

  it('keeps generated helper working-tree and Git index modes exact', () => {
    if (process.platform !== 'win32') {
      for (const pack of helperPackNames) {
        expect(
          lstatSync(join(repoRoot, 'packs', pack, 'add-skills.sh')).mode & 0o777,
          `${pack}/add-skills.sh mode`,
        ).toBe(0o755)
        expect(
          lstatSync(join(repoRoot, 'packs', pack, 'add-skills.ps1')).mode & 0o777,
          `${pack}/add-skills.ps1 mode`,
        ).toBe(0o644)
      }
    }

    const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    if (probe.status !== 0 || probe.stdout.trim() !== 'true') return

    const helperPaths = helperPackNames.flatMap((pack) => [
      `packs/${pack}/add-skills.sh`,
      `packs/${pack}/add-skills.ps1`,
    ])
    const indexed = spawnSync('git', ['ls-files', '-s', '--', ...helperPaths], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    expect(indexed.status, indexed.stderr).toBe(0)
    const modes = new Map(
      indexed.stdout.trim().split('\n').filter(Boolean).map((line) => {
        const match = /^(\d+)\s+[0-9a-f]+\s+\d+\t(.+)$/.exec(line)
        if (!match) throw new Error(`unexpected git ls-files record: ${line}`)
        return [match[2], match[1]]
      }),
    )
    expect(modes.size).toBe(helperPaths.length)
    for (const path of helperPaths) {
      expect(modes.get(path), path).toBe(
        path.endsWith('.sh') ? '100755' : '100644',
      )
    }
  })
})

describe('Checkpoint 3A clean-clone workflow contract', () => {
  it('synchronizes and verifies one runner-local cache before positive tests and drift checks', () => {
    const workflow = parse(readRepo('.github/workflows/build-packs.yml'))
    const verify = workflow.jobs?.verify
    const steps = verify?.steps ?? []

    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(verify?.env).toEqual({
      RAMP_SKILLS_CACHE: '${{ runner.temp }}/ramp-skills',
    })
    expect(
      Object.values(workflow.jobs ?? {}).filter(
        (job) => job?.env?.RAMP_SKILLS_CACHE !== undefined,
      ),
    ).toHaveLength(1)
    expect(
      steps.some((step) => step?.env?.RAMP_SKILLS_CACHE !== undefined),
    ).toBe(false)

    const checkout = steps.find((step) => step?.uses === 'actions/checkout@v4')
    expect(checkout?.with?.['persist-credentials']).toBe(false)
    expect(steps.some((step) => String(step?.uses ?? '').startsWith('actions/cache@'))).toBe(
      false,
    )

    const installIndex = stepIndex(steps, (_step, run) => /\bnpm ci\b/.test(run))
    const initialAbsenceIndex = stepIndex(
      steps,
      (_step, run) =>
        run.includes('RAMP_SKILLS_CACHE') &&
        run.includes('.ramp-cache') &&
        /test\s+!\s+-e/.test(run),
    )
    const negativeIndex = stepIndex(
      steps,
      (step, run) =>
        step?.env?.RAMP_PILOT_CACHE_EXPECTATION === 'unsynchronized' ||
        run.includes('RAMP_PILOT_CACHE_EXPECTATION=unsynchronized'),
    )
    const syncIndex = stepIndex(
      steps,
      (_step, run) =>
        run.includes('skills sync') &&
        run.includes('--locked') &&
        run.includes('--cache "$RAMP_SKILLS_CACHE"'),
    )
    const verifyIndex = stepIndex(
      steps,
      (_step, run) =>
        run.includes('skills verify') &&
        run.includes('--cache "$RAMP_SKILLS_CACHE"'),
    )
    const positiveTestIndex = stepIndex(
      steps,
      (step, run) =>
        /\bnpm test\b/.test(run) &&
        step?.env?.RAMP_PILOT_CACHE_EXPECTATION === undefined &&
        !run.includes('RAMP_PILOT_CACHE_EXPECTATION=unsynchronized'),
    )
    const regenerateIndex = stepIndex(
      steps,
      (_step, run) =>
        run.includes('build-all --in-place') || run.includes('./scripts/regenerate.sh'),
    )
    const driftIndex = stepIndex(
      steps,
      (_step, run) =>
        run.includes('packs/*/scaffolded-packs') &&
        run.includes('packs/*/add-skills.sh') &&
        run.includes('packs/*/add-skills.ps1'),
    )
    const finalAbsenceIndex = lastStepIndex(steps, (_step, run) =>
      run.includes('test ! -e .ramp-cache'),
    )
    expect(steps[negativeIndex]?.env).toEqual({
      RAMP_PILOT_CACHE_EXPECTATION: 'unsynchronized',
    })

    const orderedIndices = [
      installIndex,
      initialAbsenceIndex,
      negativeIndex,
      syncIndex,
      verifyIndex,
      positiveTestIndex,
      regenerateIndex,
      driftIndex,
      finalAbsenceIndex,
    ]
    expect(orderedIndices.every((index) => index >= 0)).toBe(true)
    for (let index = 1; index < orderedIndices.length; index += 1) {
      expect(orderedIndices[index]).toBeGreaterThan(orderedIndices[index - 1])
    }
  })
})

describe.each([
  ['QA', 'packs/qa-automated-testing/README.md'],
  ['legacy', 'packs/legacy-transformation-on-aws/README.md'],
])('Checkpoint 3A %s pilot documentation contract', (_label, relativePath) => {
  it('documents mixed-source helpers without claiming lock verification or ZIP availability', () => {
    const readme = readRepo(relativePath)

    expect(readme).toContain('--repo-root')
    expect(readme).toContain('-RepoRoot')
    expect(readme).toContain('--skills-src')
    expect(readme).toContain('-SkillsSrc')
    expect(readme).toMatch(/cloned repository[\s\S]{0,160}(?:discover|automatic)/i)
    expect(readme).toMatch(/pack(?:-local)? override/i)
    expect(readme).toMatch(/RAMP-owned/i)
    expect(readme).toMatch(/reviewed committed compatibility/i)
    for (const destination of [
      '.kiro/',
      '.claude/',
      '.github/',
      '.cursor/',
    ]) {
      expect(readme).toContain(destination)
    }
    expect(readme).toMatch(/no-Node[\s\S]{0,500}does not[\s\S]{0,200}(?:lock|cache)/i)
    expect(readme).toMatch(
      /Node[\s\S]{0,500}synchroni[sz]ed[\s\S]{0,300}(?:lock|cache)[\s\S]{0,300}exact/i,
    )
    expect(readme).not.toMatch(/all skills (?:live|are stored) in (?:the )?skills-library/i)
    expect(readme).not.toMatch(/download(?:able)?\s+(?:pack\s+)?ZIP\s+(?:is|now)\s+available/i)
  })
})
