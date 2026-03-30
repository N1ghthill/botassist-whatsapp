#!/usr/bin/env node

const fs = require('fs');
const os = require('os');

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function firstAvailable(env, primaryKey, fallbackKey) {
  if (hasValue(env[primaryKey])) {
    return { key: primaryKey, value: String(env[primaryKey]) };
  }
  if (hasValue(env[fallbackKey])) {
    return { key: fallbackKey, value: String(env[fallbackKey]) };
  }
  return { key: '', value: '' };
}

function normalizeRunnerOs(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'darwin' || normalized === 'macos' || normalized === 'mac') return 'macOS';
  if (normalized === 'win32' || normalized === 'windows') return 'Windows';
  if (normalized === 'linux') return 'Linux';
  return String(value).trim();
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseArgs(argv) {
  const args = {
    format: 'text',
    requireSignedReleases: parseBoolean(process.env.REQUIRE_SIGNED_RELEASES, false),
    runnerOs: normalizeRunnerOs(process.env.RUNNER_OS || os.platform()),
    writeGithubEnv: true,
    writeSummary: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '');
    const next = String(argv[index + 1] || '');

    if (current === '--format' && next) {
      args.format = next === 'json' ? 'json' : 'text';
      index += 1;
      continue;
    }

    if (current === '--runner-os' && next) {
      args.runnerOs = normalizeRunnerOs(next);
      index += 1;
      continue;
    }

    if (current === '--require-signed-releases' && next) {
      args.requireSignedReleases = parseBoolean(next, args.requireSignedReleases);
      index += 1;
      continue;
    }

    if (current === '--no-write-github-env') {
      args.writeGithubEnv = false;
      continue;
    }

    if (current === '--no-write-summary') {
      args.writeSummary = false;
    }
  }

  return args;
}

function resolveSigningReadiness(env = process.env) {
  const windowsLink = firstAvailable(env, 'WIN_CSC_LINK', 'CSC_LINK');
  const windowsPassword = firstAvailable(env, 'WIN_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD');
  const macLink = firstAvailable(env, 'MAC_CSC_LINK', 'CSC_LINK');
  const macPassword = firstAvailable(env, 'MAC_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD');
  const macName = firstAvailable(env, 'MAC_CSC_NAME', 'CSC_NAME');

  const windowsReady = hasValue(windowsLink.value) && hasValue(windowsPassword.value);
  const macSigningReady = hasValue(macLink.value) && hasValue(macPassword.value);
  const macIdentitySelectorOnly = hasValue(macName.value) && !macSigningReady;

  const appleApiKeyReady =
    hasValue(env.APPLE_API_KEY) &&
    hasValue(env.APPLE_API_KEY_ID) &&
    hasValue(env.APPLE_API_ISSUER);
  const appleIdReady =
    hasValue(env.APPLE_ID) &&
    hasValue(env.APPLE_APP_SPECIFIC_PASSWORD) &&
    hasValue(env.APPLE_TEAM_ID);
  const macNotarizationReady = appleApiKeyReady || appleIdReady;

  return {
    windows: {
      ready: windowsReady,
      linkKey: windowsLink.key,
      passwordKey: windowsPassword.key,
    },
    macSigning: {
      ready: macSigningReady,
      linkKey: macLink.key,
      passwordKey: macPassword.key,
      nameKey: macName.key,
      identitySelectorOnly: macIdentitySelectorOnly,
    },
    macNotarization: {
      ready: macNotarizationReady,
      mode: appleApiKeyReady ? 'app-store-connect-api-key' : appleIdReady ? 'apple-id' : '',
    },
    readyForSignedRelease: windowsReady && macSigningReady && macNotarizationReady,
  };
}

function buildGithubEnvEntries(runnerOs, readiness, env = process.env) {
  const entries = [];

  if (runnerOs === 'Windows' && readiness.windows.ready) {
    entries.push(['CSC_LINK', env[readiness.windows.linkKey]]);
    entries.push(['CSC_KEY_PASSWORD', env[readiness.windows.passwordKey]]);
  }

  if (runnerOs === 'macOS') {
    if (!readiness.macSigning.ready) {
      entries.push(['CSC_IDENTITY_AUTO_DISCOVERY', 'false']);
    }

    if (readiness.macSigning.ready) {
      entries.push(['CSC_LINK', env[readiness.macSigning.linkKey]]);
      entries.push(['CSC_KEY_PASSWORD', env[readiness.macSigning.passwordKey]]);
      if (hasValue(env[readiness.macSigning.nameKey])) {
        entries.push(['CSC_NAME', env[readiness.macSigning.nameKey]]);
      }
    }

    const notarizationKeys = [
      'APPLE_API_KEY',
      'APPLE_API_KEY_ID',
      'APPLE_API_ISSUER',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'APPLE_TEAM_ID',
    ];
    for (const key of notarizationKeys) {
      if (hasValue(env[key])) {
        entries.push([key, env[key]]);
      }
    }
  }

  return entries.filter(([, value]) => hasValue(value));
}

function buildSummary(readiness, options = {}) {
  const lines = ['## Signing readiness', ''];
  lines.push(`- Runner target: ${options.runnerOs || 'Unknown'}`);
  lines.push(
    `- Windows signing: ${readiness.windows.ready ? 'true' : 'false'}${
      readiness.windows.ready
        ? ` (${readiness.windows.linkKey} + ${readiness.windows.passwordKey})`
        : ' (faltando WIN_CSC_LINK/CSC_LINK e WIN_CSC_KEY_PASSWORD/CSC_KEY_PASSWORD)'
    }`
  );
  lines.push(
    `- macOS signing: ${readiness.macSigning.ready ? 'true' : 'false'}${
      readiness.macSigning.ready
        ? ` (${readiness.macSigning.linkKey} + ${readiness.macSigning.passwordKey})`
        : ' (faltando MAC_CSC_LINK/CSC_LINK e MAC_CSC_KEY_PASSWORD/CSC_KEY_PASSWORD)'
    }`
  );
  if (readiness.macSigning.identitySelectorOnly) {
    lines.push(
      '- macOS identity selector: MAC_CSC_NAME/CSC_NAME configurado sem certificado importavel; em runner hospedado isso nao substitui CSC_LINK + CSC_KEY_PASSWORD'
    );
  } else if (hasValue(readiness.macSigning.nameKey)) {
    lines.push(`- macOS identity selector: ${readiness.macSigning.nameKey}`);
  }
  lines.push(
    `- macOS notarization: ${readiness.macNotarization.ready ? 'true' : 'false'}${
      readiness.macNotarization.ready
        ? ` (${readiness.macNotarization.mode})`
        : ' (faltando APPLE_API_* ou APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID)'
    }`
  );
  lines.push(`- Require signed releases: ${options.requireSignedReleases ? 'true' : 'false'}`);
  lines.push(
    `- Ready for signed release: ${readiness.readyForSignedRelease ? 'true' : 'false'}`
  );
  return lines.join('\n');
}

function buildFailureMessages(readiness) {
  const failures = [];
  if (!readiness.windows.ready) {
    failures.push('Windows signing nao esta configurado.');
  }
  if (!readiness.macSigning.ready) {
    failures.push('macOS signing nao esta configurado.');
  }
  if (!readiness.macNotarization.ready) {
    failures.push('macOS notarization nao esta configurada.');
  }
  return failures;
}

function appendMultilineEnv(filePath, key, value) {
  fs.appendFileSync(filePath, `${key}<<EOF\n${String(value)}\nEOF\n`, 'utf8');
}

function writeGithubEnv(filePath, entries) {
  if (!filePath) return;
  for (const [key, value] of entries) {
    appendMultilineEnv(filePath, key, value);
  }
}

function writeSummary(filePath, content) {
  if (!filePath) return;
  fs.appendFileSync(filePath, `${content}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const readiness = resolveSigningReadiness(process.env);
  const summary = buildSummary(readiness, args);
  const githubEnvEntries = buildGithubEnvEntries(args.runnerOs, readiness, process.env);

  if (args.writeGithubEnv && process.env.GITHUB_ENV) {
    writeGithubEnv(process.env.GITHUB_ENV, githubEnvEntries);
  }

  if (args.writeSummary && process.env.GITHUB_STEP_SUMMARY) {
    writeSummary(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  if (args.format === 'json') {
    process.stdout.write(
      `${JSON.stringify(
        {
          runnerOs: args.runnerOs,
          requireSignedReleases: args.requireSignedReleases,
          ...readiness,
        },
        null,
        2
      )}\n`
    );
  } else {
    process.stdout.write(`${summary}\n`);
  }

  if (args.requireSignedReleases) {
    const failures = buildFailureMessages(readiness);
    if (failures.length > 0) {
      throw new Error(failures.join(' '));
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildFailureMessages,
  buildGithubEnvEntries,
  buildSummary,
  normalizeRunnerOs,
  parseArgs,
  parseBoolean,
  resolveSigningReadiness,
};
