#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

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

function detectAppleApiKeySource(value) {
  const normalized = String(value || '');
  if (!hasValue(normalized)) return '';
  if (normalized.includes('-----BEGIN') || normalized.includes('\n') || normalized.includes('\r')) {
    return 'content';
  }
  return 'path';
}

function sanitizeFileComponent(value) {
  const normalized = String(value || '').trim();
  const sanitized = normalized.replace(/[^0-9A-Za-z._-]+/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || 'botassist';
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
      appleApiKeySource: appleApiKeyReady ? detectAppleApiKeySource(env.APPLE_API_KEY) : '',
    },
    readyForSignedRelease: windowsReady && macSigningReady && macNotarizationReady,
  };
}

function prepareGithubRuntime(runnerOs, readiness, env = process.env) {
  const runtime = {
    appleApiKeyPath: '',
  };

  if (
    runnerOs === 'macOS' &&
    readiness.macNotarization.mode === 'app-store-connect-api-key' &&
    readiness.macNotarization.appleApiKeySource === 'content'
  ) {
    const runnerTemp = hasValue(env.RUNNER_TEMP) ? String(env.RUNNER_TEMP) : os.tmpdir();
    const keyId = sanitizeFileComponent(env.APPLE_API_KEY_ID || 'botassist');
    const filePath = path.join(runnerTemp, `AuthKey_${keyId}.p8`);
    fs.writeFileSync(filePath, String(env.APPLE_API_KEY), { encoding: 'utf8', mode: 0o600 });
    runtime.appleApiKeyPath = filePath;
  }

  return runtime;
}

function buildGithubEnvEntries(runnerOs, readiness, env = process.env, runtime = {}) {
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

    if (readiness.macNotarization.mode === 'app-store-connect-api-key') {
      const appleApiKeyValue = hasValue(runtime.appleApiKeyPath)
        ? runtime.appleApiKeyPath
        : env.APPLE_API_KEY;
      if (hasValue(appleApiKeyValue)) {
        entries.push(['APPLE_API_KEY', appleApiKeyValue]);
      }
      if (hasValue(env.APPLE_API_KEY_ID)) {
        entries.push(['APPLE_API_KEY_ID', env.APPLE_API_KEY_ID]);
      }
      if (hasValue(env.APPLE_API_ISSUER)) {
        entries.push(['APPLE_API_ISSUER', env.APPLE_API_ISSUER]);
      }
    }

    if (readiness.macNotarization.mode === 'apple-id') {
      for (const key of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
        if (hasValue(env[key])) {
          entries.push([key, env[key]]);
        }
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
  if (readiness.macNotarization.mode === 'app-store-connect-api-key') {
    lines.push(
      `- macOS API key source: ${
        readiness.macNotarization.appleApiKeySource === 'content'
          ? 'conteudo do .p8 materializado no runner'
          : 'caminho de arquivo'
      }`
    );
  }
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
  const githubRuntime = prepareGithubRuntime(args.runnerOs, readiness, process.env);
  const githubEnvEntries = buildGithubEnvEntries(
    args.runnerOs,
    readiness,
    process.env,
    githubRuntime
  );

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
  detectAppleApiKeySource,
  normalizeRunnerOs,
  parseArgs,
  parseBoolean,
  prepareGithubRuntime,
  resolveSigningReadiness,
  sanitizeFileComponent,
};
