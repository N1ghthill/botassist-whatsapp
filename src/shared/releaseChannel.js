function normalizeReleaseRef(value) {
  return String(value || '')
    .trim()
    .replace(/^refs\/tags\//, '')
    .replace(/^v/, '');
}

function getReleaseChannelInfo(value) {
  const version = normalizeReleaseRef(value);
  const prereleasePart = version.includes('-') ? version.split('-').slice(1).join('-') : '';
  const identifier = String(prereleasePart.split('.')[0] || '').trim().toLowerCase();
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

module.exports = {
  getReleaseChannelInfo,
  normalizeReleaseRef,
};
