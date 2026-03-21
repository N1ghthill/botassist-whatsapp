const RELEASE_REF_RE = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/;

function normalizeReleaseRef(value) {
  return String(value || '')
    .trim()
    .replace(/^refs\/tags\//, '')
    .replace(/^v/, '');
}

function parseReleaseVersion(value) {
  const version = normalizeReleaseRef(value);
  const match = version.match(RELEASE_REF_RE);

  if (!match) {
    throw new Error(`Invalid release version: "${value}"`);
  }

  const coreVersion = match[1];
  const prereleasePart = String(match[2] || '').trim();
  const identifier = String(prereleasePart.split(/[.-]/)[0] || '')
    .trim()
    .toLowerCase();

  return {
    version,
    coreVersion,
    prereleasePart,
    identifier,
  };
}

function sanitizeRpmSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^0-9A-Za-z.]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function getReleaseChannelInfo(value) {
  const { version, identifier } = parseReleaseVersion(value);
  const channel = identifier || 'latest';
  const isPrerelease = channel !== 'latest';

  return {
    version,
    channel,
    isPrerelease,
    releaseType: isPrerelease ? channel : 'stable',
    feedFile: `${channel}-linux.yml`,
  };
}

function getRpmVersionInfo(value) {
  const { version, coreVersion, prereleasePart } = parseReleaseVersion(value);

  if (!prereleasePart) {
    return {
      appVersion: version,
      version: coreVersion,
      release: '1',
      isPrerelease: false,
    };
  }

  const sanitizedPrerelease = sanitizeRpmSegment(prereleasePart.replace(/-/g, '.')) || '1';

  return {
    appVersion: version,
    version: coreVersion,
    release: `0.${sanitizedPrerelease}`,
    isPrerelease: true,
  };
}

module.exports = {
  getReleaseChannelInfo,
  getRpmVersionInfo,
  normalizeReleaseRef,
  parseReleaseVersion,
};
