#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { getReleaseChannelInfo, normalizeReleaseRef } = require('../src/shared/releaseChannel')

const DEFAULT_REPO = 'N1ghthill/botassist-whatsapp'
const RELEASE_MANIFEST_FILE = 'release-manifest.json'

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    tag: process.env.RELEASE_TAG || '',
    keepTemp: false,
    retries: parsePositiveInt(process.env.RELEASE_VERIFY_RETRIES, 3),
    retryDelayMs: parsePositiveInt(process.env.RELEASE_VERIFY_RETRY_DELAY_MS, 5000),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '')
    const next = String(argv[index + 1] || '')

    if ((current === '--repo' || current === '-R') && next) {
      args.repo = next
      index += 1
      continue
    }
    if (current === '--tag' && next) {
      args.tag = next
      index += 1
      continue
    }
    if (current === '--keep-temp') {
      args.keepTemp = true
      continue
    }
    if (current === '--retries' && next) {
      args.retries = parsePositiveInt(next, args.retries)
      index += 1
      continue
    }
    if (current === '--retry-delay-ms' && next) {
      args.retryDelayMs = parsePositiveInt(next, args.retryDelayMs)
      index += 1
    }
  }

  return args
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatCommandError(error) {
  const stderr = String(error?.stderr || '').trim()
  const stdout = String(error?.stdout || '').trim()
  return stderr || stdout || error?.message || String(error)
}

function runGh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    throw new Error(formatCommandError(error))
  }
}

async function withRetries(label, fn, options) {
  let lastError = null

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      return fn()
    } catch (error) {
      lastError = error
      if (attempt >= options.retries) break
      console.warn(
        `[warn] ${label} failed (attempt ${attempt}/${options.retries}): ${error.message}. Retrying in ${options.retryDelayMs}ms.`
      )
      await sleep(options.retryDelayMs)
    }
  }

  throw new Error(`${label} failed after ${options.retries} attempts: ${lastError?.message || 'unknown error'}`)
}

function loadReleaseInfo(tag, repo) {
  return JSON.parse(
    runGh([
      'release',
      'view',
      tag,
      '--repo',
      repo,
      '--json',
      'tagName,isPrerelease,assets',
    ])
  )
}

function buildAssetMap(assets) {
  const map = new Map()
  for (const asset of Array.isArray(assets) ? assets : []) {
    map.set(asset.name, asset)
  }
  return map
}

function buildRequiredFeedNames(tag) {
  const channelInfo = getReleaseChannelInfo(tag)
  return ['latest.yml', 'latest-mac.yml', channelInfo.feedFile]
}

function parseReleaseManifest(content) {
  return JSON.parse(String(content || ''))
}

function ensureReleaseTypeMatches(tag, releaseInfo) {
  const channelInfo = getReleaseChannelInfo(tag)
  if (Boolean(releaseInfo?.isPrerelease) !== channelInfo.isPrerelease) {
    throw new Error(
      `Tipo da release diverge da tag: esperado prerelease=${channelInfo.isPrerelease}, recebido prerelease=${Boolean(releaseInfo?.isPrerelease)}.`
    )
  }
}

function ensureAssetsExist(assetNames, assetMap, label) {
  const missing = assetNames.filter((name) => !assetMap.has(name))
  if (missing.length > 0) {
    throw new Error(`${label} ausentes: ${missing.join(', ')}`)
  }
}

function downloadReleaseAssets(tag, repo, targetDir, assetNames) {
  if (!Array.isArray(assetNames) || assetNames.length === 0) return

  const args = ['release', 'download', tag, '--repo', repo, '-D', targetDir]
  for (const name of assetNames) {
    args.push('-p', name)
  }
  runGh(args)
}

function ensureFeedEntry(entryMap, url) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) return null

  if (!entryMap.has(normalizedUrl)) {
    entryMap.set(normalizedUrl, {
      url: normalizedUrl,
      sha512: '',
      size: null,
    })
  }

  return entryMap.get(normalizedUrl)
}

function parseUpdaterFeed(content) {
  const entryMap = new Map()
  const lines = String(content || '').split(/\r?\n/)
  let currentEntry = null
  let version = ''

  for (const line of lines) {
    const versionMatch = line.match(/^version:\s+(.+)$/)
    if (versionMatch) {
      version = versionMatch[1].trim()
      continue
    }

    const urlMatch = line.match(/^\s*-\s+url:\s+(.+)$/)
    if (urlMatch) {
      currentEntry = ensureFeedEntry(entryMap, urlMatch[1])
      continue
    }

    const pathMatch = line.match(/^\s*path:\s+(.+)$/)
    if (pathMatch) {
      currentEntry = ensureFeedEntry(entryMap, pathMatch[1])
      continue
    }

    const shaMatch = line.match(/^\s*sha512:\s+(.+)$/)
    if (shaMatch && currentEntry) {
      currentEntry.sha512 = shaMatch[1].trim()
      continue
    }

    const sizeMatch = line.match(/^\s*size:\s+(\d+)$/)
    if (sizeMatch && currentEntry) {
      currentEntry.size = Number.parseInt(sizeMatch[1], 10)
    }
  }

  return {
    version,
    entries: Array.from(entryMap.values()).filter((entry) => entry.url && entry.sha512),
  }
}

function sha256Hex(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64')
}

function verifyDownloadedAssetDigests(targetDir, assetMap, assetNames) {
  for (const name of assetNames) {
    const filePath = path.join(targetDir, name)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo baixado nao encontrado: ${name}`)
    }

    const asset = assetMap.get(name)
    const digest = String(asset?.digest || '').trim()
    if (digest.startsWith('sha256:')) {
      const expected = digest.replace(/^sha256:/, '')
      const actual = sha256Hex(filePath)
      if (actual !== expected) {
        throw new Error(`SHA256 divergente para ${name}`)
      }
    }
  }
}

function verifyFeedVersion(feedName, parsedFeed, tag) {
  const expectedVersion = normalizeReleaseRef(tag)
  if (parsedFeed.version !== expectedVersion) {
    throw new Error(`${feedName} aponta para versao ${parsedFeed.version}, esperado ${expectedVersion}`)
  }
}

function verifyManifestVersion(manifest, tag) {
  const expectedVersion = normalizeReleaseRef(tag)
  if (String(manifest?.version || '').trim() !== expectedVersion) {
    throw new Error(
      `release-manifest.json aponta para versao ${String(manifest?.version || '').trim()}, esperado ${expectedVersion}`
    )
  }
}

function verifyManifestDownloadEntry(entry, assetMap, label) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`release-manifest.json nao contem download primario de ${label}`)
  }

  const pathValue = String(entry.path || entry.asset || '').trim()
  const urlValue = String(entry.url || '').trim()
  if (!pathValue || !urlValue) {
    throw new Error(`release-manifest.json possui download invalido de ${label}`)
  }
  if (!assetMap.has(pathValue)) {
    throw new Error(`release-manifest.json referencia asset inexistente para ${label}: ${pathValue}`)
  }
}

function verifyManifestDownloads(manifest, assetMap) {
  const downloads = manifest?.downloads || {}

  verifyManifestDownloadEntry(downloads.windows, assetMap, 'Windows')
  verifyManifestDownloadEntry(downloads.mac, assetMap, 'macOS')
  verifyManifestDownloadEntry(downloads.linux, assetMap, 'Linux')

  const alternatives = Array.isArray(downloads?.linux?.alternatives) ? downloads.linux.alternatives : []
  for (const alternative of alternatives) {
    verifyManifestDownloadEntry(alternative, assetMap, 'Linux')
  }
}

function verifyLinuxFeedCoverage(parsedFeed, assetMap) {
  const expectedSuffixes = ['.AppImage', '.deb']
  const hasRpmAsset = Array.from(assetMap.keys()).some((name) => name.endsWith('.rpm'))
  if (hasRpmAsset) {
    expectedSuffixes.push('.rpm')
  }

  for (const suffix of expectedSuffixes) {
    const hasEntry = parsedFeed.entries.some((entry) => entry.url.endsWith(suffix))
    if (!hasEntry) {
      throw new Error(`Feed Linux nao lista artefato ${suffix}`)
    }
  }
}

function verifyFeedEntries(feedName, parsedFeed, assetMap, targetDir) {
  if (!Array.isArray(parsedFeed.entries) || parsedFeed.entries.length === 0) {
    throw new Error(`${feedName} nao contem arquivos verificaveis`)
  }

  for (const entry of parsedFeed.entries) {
    const asset = assetMap.get(entry.url)
    if (!asset) {
      throw new Error(`${feedName} referencia asset ausente: ${entry.url}`)
    }

    const filePath = path.join(targetDir, entry.url)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Asset referenciado por ${feedName} nao foi baixado: ${entry.url}`)
    }

    if (Number.isFinite(entry.size)) {
      const actualSize = fs.statSync(filePath).size
      if (actualSize !== entry.size) {
        throw new Error(`${feedName} informa size divergente para ${entry.url}`)
      }
    }

    const actualSha512 = sha512Base64(filePath)
    if (actualSha512 !== entry.sha512) {
      throw new Error(`${feedName} informa sha512 divergente para ${entry.url}`)
    }
  }
}

function cleanupTempDir(targetDir) {
  if (!targetDir) return
  try {
    fs.rmSync(targetDir, { recursive: true, force: true })
  } catch (error) {
    console.warn(`[warn] Falha ao limpar diretorio temporario ${targetDir}: ${error.message}`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!String(args.tag || '').trim()) {
    throw new Error('Informe a tag da release com --tag ou RELEASE_TAG.')
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botassist-release-verify-'))

  try {
    const releaseInfo = await withRetries(
      'Carregar metadata da release',
      () => loadReleaseInfo(args.tag, args.repo),
      args
    )

    ensureReleaseTypeMatches(args.tag, releaseInfo)

    const assetMap = buildAssetMap(releaseInfo.assets)
    const feedNames = buildRequiredFeedNames(args.tag)
    const metadataAssetNames = [...feedNames, RELEASE_MANIFEST_FILE]
    const linuxFeedName = feedNames[feedNames.length - 1]

    ensureAssetsExist(metadataAssetNames, assetMap, 'Arquivos de metadata obrigatorios')
    await withRetries(
      'Baixar metadata da release',
      () => downloadReleaseAssets(args.tag, args.repo, tempDir, metadataAssetNames),
      args
    )
    verifyDownloadedAssetDigests(tempDir, assetMap, metadataAssetNames)

    const parsedManifest = parseReleaseManifest(
      fs.readFileSync(path.join(tempDir, RELEASE_MANIFEST_FILE), 'utf8')
    )
    verifyManifestVersion(parsedManifest, args.tag)
    verifyManifestDownloads(parsedManifest, assetMap)

    const parsedFeeds = new Map()
    for (const feedName of feedNames) {
      const parsedFeed = parseUpdaterFeed(fs.readFileSync(path.join(tempDir, feedName), 'utf8'))
      verifyFeedVersion(feedName, parsedFeed, args.tag)
      if (feedName === linuxFeedName) {
        verifyLinuxFeedCoverage(parsedFeed, assetMap)
      }
      parsedFeeds.set(feedName, parsedFeed)
    }

    const referencedAssetNames = Array.from(
      new Set(
        Array.from(parsedFeeds.values()).flatMap((parsedFeed) => parsedFeed.entries.map((entry) => entry.url))
      )
    )

    ensureAssetsExist(referencedAssetNames, assetMap, 'Assets referenciados pelos feeds')
    await withRetries(
      'Baixar assets referenciados pelos feeds',
      () => downloadReleaseAssets(args.tag, args.repo, tempDir, referencedAssetNames),
      args
    )
    verifyDownloadedAssetDigests(tempDir, assetMap, referencedAssetNames)

    for (const [feedName, parsedFeed] of parsedFeeds.entries()) {
      verifyFeedEntries(feedName, parsedFeed, assetMap, tempDir)
    }

    console.log(
      `Release ${args.tag} verificada com sucesso: ${feedNames.length} feeds e ${referencedAssetNames.length} assets conferidos.`
    )
    if (args.keepTemp) {
      console.log(`Diretorio temporario preservado em ${tempDir}`)
      return
    }
  } finally {
    if (!args.keepTemp) {
      cleanupTempDir(tempDir)
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.message || String(error))
    process.exitCode = 1
  })
}

module.exports = {
  buildRequiredFeedNames,
  parseArgs,
  parseReleaseManifest,
  parseUpdaterFeed,
  verifyManifestDownloads,
  verifyManifestVersion,
  verifyLinuxFeedCoverage,
}
