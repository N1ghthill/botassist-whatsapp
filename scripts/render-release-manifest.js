#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { getReleaseChannelInfo } = require('../src/shared/releaseChannel')

const RELEASE_NOTES_FILE = path.resolve(__dirname, '..', 'docs', 'notas-da-versao.json')
const DEFAULT_REPO = 'N1ghthill/botassist-whatsapp'
const RELEASE_MANIFEST_FILE = 'release-manifest.json'

const DEFAULT_REQUIREMENTS = {
  windows: 'Windows 10/11 64-bit',
  mac: 'macOS 12+ (Monterey)',
  linux: 'Linux x64 moderno',
}

const DEFAULT_DOWNLOAD_FORMATS = {
  windows: 'Setup.exe + build portatil',
  mac: 'DMG arm64',
  linux: 'AppImage, DEB e RPM',
}

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    tag: process.env.RELEASE_TAG || '',
    output: '',
    includeAssets: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '')
    const next = String(argv[index + 1] || '')

    if (current === '--repo' && next) {
      args.repo = next
      index += 1
      continue
    }
    if (current === '--tag' && next) {
      args.tag = next
      index += 1
      continue
    }
    if (current === '--output' && next) {
      args.output = next
      index += 1
      continue
    }
    if (current === '--include-assets') {
      args.includeAssets = true
    }
  }

  return args
}

function stripTagPrefix(value) {
  return String(value || '').trim().replace(/^v/i, '')
}

function loadNotes() {
  return JSON.parse(fs.readFileSync(RELEASE_NOTES_FILE, 'utf8'))
}

function findRelease(data, version) {
  return Array.isArray(data?.releases)
    ? data.releases.find((entry) => String(entry?.version || '').trim() === version)
    : null
}

function buildBadge(channelInfo) {
  if (channelInfo.channel === 'latest') return 'Release estavel'
  if (channelInfo.channel === 'rc') return 'Release candidate'
  if (channelInfo.channel === 'beta') return 'Beta publica'
  return `Canal ${channelInfo.channel}`
}

function buildCardsFromHighlights(highlights) {
  return (Array.isArray(highlights) ? highlights : []).slice(0, 3).map((description, index) => ({
    title: `Highlight ${index + 1}`,
    description: String(description || '').trim(),
  }))
}

function runGh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = String(error?.stderr || '').trim()
    const stdout = String(error?.stdout || '').trim()
    throw new Error(stderr || stdout || error?.message || String(error))
  }
}

function loadReleaseInfo(repo, tag) {
  return JSON.parse(
    runGh([
      'release',
      'view',
      tag,
      '--repo',
      repo,
      '--json',
      'tagName,isPrerelease,publishedAt,assets',
    ])
  )
}

function normalizeAsset(asset) {
  return {
    name: String(asset?.name || '').trim(),
    url: String(asset?.url || '').trim(),
    size: Number.isFinite(asset?.size) ? asset.size : null,
    contentType: String(asset?.contentType || '').trim(),
    digest: String(asset?.digest || '').trim(),
  }
}

function isMetadataAsset(name) {
  return (
    String(name || '').endsWith('.blockmap') ||
    String(name || '').endsWith('.yml') ||
    String(name || '') === RELEASE_MANIFEST_FILE
  )
}

function pickFirstAsset(assets, predicate) {
  return assets.find((asset) => predicate(String(asset?.name || '').trim())) || null
}

function pickPrimaryDownloads(assets) {
  const fileAssets = (Array.isArray(assets) ? assets : [])
    .map(normalizeAsset)
    .filter((asset) => asset.name && !isMetadataAsset(asset.name))

  const windowsPrimary =
    pickFirstAsset(fileAssets, (name) => /Setup-.*\.exe$/i.test(name)) ||
    pickFirstAsset(fileAssets, (name) => /\.exe$/i.test(name))
  const macPrimary = pickFirstAsset(fileAssets, (name) => /\.dmg$/i.test(name))
  const linuxPrimary =
    pickFirstAsset(fileAssets, (name) => /\.AppImage$/i.test(name)) ||
    pickFirstAsset(fileAssets, (name) => /\.deb$/i.test(name)) ||
    pickFirstAsset(fileAssets, (name) => /\.rpm$/i.test(name))

  return {
    windows: windowsPrimary
      ? {
          url: windowsPrimary.url,
          path: windowsPrimary.name,
          asset: windowsPrimary.name,
        }
      : null,
    mac: macPrimary
      ? {
          url: macPrimary.url,
          path: macPrimary.name,
          asset: macPrimary.name,
        }
      : null,
    linux: linuxPrimary
      ? {
          url: linuxPrimary.url,
          path: linuxPrimary.name,
          asset: linuxPrimary.name,
          alternatives: fileAssets
            .filter((asset) => asset.name !== linuxPrimary.name && /\.(AppImage|deb|rpm)$/i.test(asset.name))
            .map((asset) => ({
              url: asset.url,
              path: asset.name,
              asset: asset.name,
            })),
        }
      : null,
  }
}

function renderManifest({ repo, tag, includeAssets }) {
  const version = stripTagPrefix(tag)
  if (!version) {
    throw new Error('Informe a tag da release com --tag ou RELEASE_TAG.')
  }

  const notes = loadNotes()
  const release = findRelease(notes, version)
  if (!release) {
    throw new Error(`Versao ${version} nao encontrada em docs/notas-da-versao.json.`)
  }

  const channelInfo = getReleaseChannelInfo(tag)
  const releaseInfo = includeAssets ? loadReleaseInfo(repo, tag) : null
  const normalizedAssets = Array.isArray(releaseInfo?.assets)
    ? releaseInfo.assets.map(normalizeAsset)
    : []
  const cards =
    Array.isArray(release?.cards) && release.cards.length > 0
      ? release.cards.slice(0, 3)
      : buildCardsFromHighlights(release?.highlights)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repo,
    tag: String(tag || '').trim(),
    version,
    channel: channelInfo.channel,
    isPrerelease: channelInfo.isPrerelease,
    badge: String(release?.badge || '').trim() || buildBadge(channelInfo),
    date: String(release?.date || releaseInfo?.publishedAt || '').trim(),
    title: String(release?.title || version).trim(),
    summary: String(release?.summary || '').trim(),
    cards,
    highlights: Array.isArray(release?.highlights) ? release.highlights : [],
    requirements: {
      ...DEFAULT_REQUIREMENTS,
      ...(release?.requirements || {}),
    },
    downloadFormats: {
      ...DEFAULT_DOWNLOAD_FORMATS,
      ...(release?.downloadFormats || {}),
    },
    downloads: pickPrimaryDownloads(normalizedAssets),
    assets: normalizedAssets,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifest = renderManifest(args)
  const output = `${JSON.stringify(manifest, null, 2)}\n`

  if (args.output) {
    fs.writeFileSync(path.resolve(args.output), output, 'utf8')
  } else {
    process.stdout.write(output)
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error?.message || String(error))
    process.exitCode = 1
  }
}

module.exports = {
  RELEASE_MANIFEST_FILE,
  buildBadge,
  buildCardsFromHighlights,
  parseArgs,
  pickPrimaryDownloads,
  renderManifest,
}
