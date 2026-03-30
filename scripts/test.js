#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botassist-test-'));
  const cleanup = () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  };
  try {
    const result = fn(tempDir);
    if (result && typeof result.then === 'function') {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function loadSettingsModule(userDataDir) {
  const electronPath = require.resolve('electron');
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: {
        getPath: () => userDataDir
      }
    }
  };

  const settingsPath = path.join(process.cwd(), 'src', 'main', 'settings.js');
  delete require.cache[require.resolve(settingsPath)];
  return require(settingsPath);
}

function loadSharedSchema() {
  const schemaPath = path.join(process.cwd(), 'src', 'shared', 'settingsSchema.js');
  delete require.cache[require.resolve(schemaPath)];
  return require(schemaPath);
}

function loadRuntimeSettingsModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'runtimeSettings.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadReleaseChannelModule() {
  const modulePath = path.join(process.cwd(), 'src', 'shared', 'releaseChannel.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadRuntimeSecurityModule() {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'runtimeSecurity.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadPreloadModule() {
  const modulePath = path.join(process.cwd(), 'src', 'preload.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadToolPoliciesModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'policies.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadToolRegistryModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'registry.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadToolOrchestratorModule(mockProviderChat) {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'orchestrator.js');
  delete require.cache[require.resolve(modulePath)];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../provider') {
      return { runProviderChat: mockProviderChat };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function loadPatchLinuxFeedModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'patch-linux-feed-with-rpm.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadReleaseVerifyModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'verify-release-assets.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadSigningReadinessModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'check-signing-readiness.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadSigningProvisionModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'provision-signing-secrets.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadBotManagerModule(mockFork) {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'botManager.js');
  delete require.cache[require.resolve(modulePath)];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return { utilityProcess: { fork: mockFork } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function loadUpdatesModule({ isPackaged = false, env = {}, autoUpdaterMock = {} } = {}) {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'updates.js');
  delete require.cache[require.resolve(modulePath)];

  const previousEnv = { ...process.env };
  Object.assign(process.env, env);

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          isPackaged,
          getVersion: () => '4.2.4',
        },
      };
    }
    if (request === 'electron-updater') {
      return {
        autoUpdater: {
          autoDownload: false,
          autoInstallOnAppQuit: false,
          allowPrerelease: false,
          channel: 'latest',
          on: () => {},
          checkForUpdates: async () => {},
          quitAndInstall: () => {},
          ...autoUpdaterMock,
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
    process.env = previousEnv;
  }
}

function loadShellExecutorModule() {
  const modulePath = path.join(
    process.cwd(),
    'src',
    'core',
    'tooling',
    'executors',
    'shell.js'
  );
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadFsExecutorModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'executors', 'fs.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadWebExecutorModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'executors', 'web.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadToolsDiagnosticsModule() {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'toolsDiagnostics.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadApprovalFlowModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'approvalFlow.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadAppProtocolModule() {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'appProtocol.js');
  delete require.cache[require.resolve(modulePath)];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        protocol: {
          registerSchemesAsPrivileged: () => {},
          handle: () => {},
        },
        net: {
          fetch: (url) => url,
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function withPatchedFetch(fetchImpl, fn) {
  const originalFetch = global.fetch;
  global.fetch = fetchImpl;

  const cleanup = () => {
    global.fetch = originalFetch;
  };

  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

test('loadSettings seeds at least one profile', () => {
  withTempDir((dir) => {
    const settings = loadSettingsModule(dir);
    const loaded = settings.loadSettings();
    assert.ok(Array.isArray(loaded.profiles));
    assert.ok(loaded.profiles.length >= 1);
  });
});

test('saveSettings preserves profiles on partial updates', () => {
  withTempDir((dir) => {
    const settings = loadSettingsModule(dir);
    settings.loadSettings();

    const profile = {
      id: 'profile_test',
      name: 'Teste',
      persona: 'custom',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'Teste de perfil',
      botTag: '[Teste]'
    };

    settings.saveSettings({ profiles: [profile], activeProfileId: profile.id });
    const before = settings.getSettingsSnapshot();
    settings.saveSettings({ apiKeyRef: 'settings.json' });
    const after = settings.getSettingsSnapshot();

    assert.strictEqual(after.activeProfileId, profile.id);
    assert.strictEqual(after.profiles.length, before.profiles.length);
    assert.ok(after.profiles.some((p) => p.id === profile.id));
  });
});

test('loadSettings derives dmPolicy from legacy restrictToOwner', () => {
  withTempDir((dir) => {
    const settingsPath = path.join(dir, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ restrictToOwner: true }, null, 2), 'utf8');

    const settings = loadSettingsModule(dir);
    const loaded = settings.loadSettings();
    assert.strictEqual(loaded.dmPolicy, 'owner');
  });
});

test('loadSettings derives groupPolicy from legacy group flags', () => {
  withTempDir((dir) => {
    const settingsPath = path.join(dir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ respondToGroups: true, requireGroupAllowlist: true }, null, 2),
      'utf8'
    );

    const settings = loadSettingsModule(dir);
    const loaded = settings.loadSettings();
    assert.strictEqual(loaded.groupPolicy, 'allowlist');
  });
});

test('normalize profileRouting drops unknown profile ids', () => {
  withTempDir((dir) => {
    const settingsPath = path.join(dir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          profiles: [{ id: 'p1', name: 'A', persona: 'custom', provider: 'groq', model: 'llama-3.3-70b-versatile' }],
          activeProfileId: 'p1',
          profileRouting: { users: { '5511': 'p2' } }
        },
        null,
        2
      ),
      'utf8'
    );

    const settings = loadSettingsModule(dir);
    const loaded = settings.loadSettings();
    const users = loaded.profileRouting?.users || {};
    assert.strictEqual(users['5511'], undefined);
  });
});

test('generateOwnerClaimToken stores active token state', () => {
  withTempDir((dir) => {
    const settings = loadSettingsModule(dir);
    settings.loadSettings();

    const generated = settings.generateOwnerClaimToken();
    assert.ok(/^\d{6}$/.test(generated.token));

    const snapshot = settings.getSettingsSnapshot();
    assert.ok(String(snapshot.ownerClaimTokenHash || '').trim().length > 0);
    assert.ok(String(snapshot.ownerClaimTokenExpiresAt || '').trim().length > 0);

    const status = settings.getOwnerClaimTokenStatus(snapshot);
    assert.strictEqual(status.active, true);
  });
});

test('saving owner clears pending owner claim token', () => {
  withTempDir((dir) => {
    const settings = loadSettingsModule(dir);
    settings.loadSettings();
    settings.generateOwnerClaimToken();

    settings.saveSettings({ ownerNumber: '5511999999999' });
    const snapshot = settings.getSettingsSnapshot();
    assert.strictEqual(String(snapshot.ownerClaimTokenHash || '').trim(), '');
    assert.strictEqual(String(snapshot.ownerClaimTokenExpiresAt || '').trim(), '');
  });
});

test('shared settings schema returns isolated default objects', () => {
  const schema = loadSharedSchema();
  const first = schema.createDefaultSettings();
  const second = schema.createDefaultSettings();

  first.tools.autoAllow.push('shell.exec');
  first.profileRouting.users['5511'] = 'profile_x';

  assert.strictEqual(second.tools.autoAllow.includes('shell.exec'), false);
  assert.strictEqual(second.profileRouting.users['5511'], undefined);
});

test('shared settings schema seeds home dir for enabled tools when no paths are configured', () => {
  const schema = loadSharedSchema();
  const normalized = schema.normalizeToolsSettings(
    { enabled: true, allowedPaths: [] },
    schema.DEFAULT_SETTINGS.tools,
    { homeDir: '/tmp/botassist-home' }
  );

  assert.deepStrictEqual(normalized.allowedPaths, ['/tmp/botassist-home']);
});

test('shared settings schema centralizes profile, history, and interaction normalization', () => {
  const schema = loadSharedSchema();
  const normalized = schema.normalizeInteractionSettings(
    schema.normalizeHistoryState(
      schema.normalizeProfileState({
        profiles: [],
        profileRouting: { users: { '5511': 'missing-profile' } },
        historyEnabled: 1,
        historySummaryEnabled: undefined,
        historyMaxMessages: '999',
        groupCommandPrefix: '   ',
        cooldownSecondsDm: -5,
        cooldownSecondsGroup: 999999,
        maxResponseChars: '50',
      })
    )
  );

  assert.ok(Array.isArray(normalized.profiles));
  assert.ok(normalized.profiles.length >= 1);
  assert.deepStrictEqual(normalized.profileRouting, { users: {}, groups: {} });
  assert.strictEqual(normalized.historyEnabled, true);
  assert.strictEqual(normalized.historySummaryEnabled, true);
  assert.strictEqual(normalized.historyMaxMessages, 200);
  assert.strictEqual(normalized.groupCommandPrefix, '!');
  assert.strictEqual(normalized.cooldownSecondsDm, 0);
  assert.strictEqual(normalized.cooldownSecondsGroup, 86400);
  assert.strictEqual(normalized.maxResponseChars, 200);
});

test('runtime settings store applies active profile and env fallback', () => {
  withTempDir((dir) => {
    const settingsPath = path.join(dir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          profiles: [
            {
              id: 'p1',
              name: 'Perfil 1',
              persona: 'custom',
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              systemPrompt: 'Prompt do perfil 1',
              botTag: '[P1]',
            },
          ],
          activeProfileId: 'p1',
        },
        null,
        2
      ),
      'utf8'
    );

    const { createRuntimeSettingsStore } = loadRuntimeSettingsModule();
    const store = createRuntimeSettingsStore({
      settingsPath,
      env: {
        GROQ_API_KEY: 'env-secret',
        BOTASSIST_PROVIDER: 'groq',
      },
      reloadDebounceMs: 1,
    });

    try {
      const loaded = store.readSettings();
      assert.strictEqual(loaded.apiKey, 'env-secret');
      assert.strictEqual(loaded.model, 'llama-3.3-70b-versatile');
      assert.strictEqual(loaded.profilePrompt, 'Prompt do perfil 1');
      assert.strictEqual(loaded.botTag, '[P1]');
      assert.strictEqual(loaded.groupOnlyMention, true);
    } finally {
      store.dispose();
    }
  });
});

test('release channel utility resolves stable releases to latest feed', () => {
  const { getReleaseChannelInfo } = loadReleaseChannelModule();
  const info = getReleaseChannelInfo('v4.2.0');

  assert.strictEqual(info.channel, 'latest');
  assert.strictEqual(info.isPrerelease, false);
  assert.strictEqual(info.feedFile, 'latest-linux.yml');
});

test('release channel utility resolves beta and rc feeds', () => {
  const { getReleaseChannelInfo } = loadReleaseChannelModule();
  const beta = getReleaseChannelInfo('v4.2.0-beta.4');
  const rc = getReleaseChannelInfo('4.2.0-rc.1');

  assert.strictEqual(beta.channel, 'beta');
  assert.strictEqual(beta.isPrerelease, true);
  assert.strictEqual(beta.feedFile, 'beta-linux.yml');
  assert.strictEqual(rc.channel, 'rc');
  assert.strictEqual(rc.isPrerelease, true);
  assert.strictEqual(rc.feedFile, 'rc-linux.yml');
});

test('release channel utility maps prerelease semver to RPM-safe version metadata', () => {
  const { getRpmVersionInfo } = loadReleaseChannelModule();
  const stable = getRpmVersionInfo('v4.2.0');
  const beta = getRpmVersionInfo('4.2.0-beta.4');

  assert.deepStrictEqual(stable, {
    appVersion: '4.2.0',
    version: '4.2.0',
    release: '1',
    isPrerelease: false,
  });
  assert.deepStrictEqual(beta, {
    appVersion: '4.2.0-beta.4',
    version: '4.2.0',
    release: '0.beta.4',
    isPrerelease: true,
  });
});

test('runtime security enables Electron sandbox by default and accepts explicit opt-out', () => {
  const { resolveElectronSandboxEnabled } = loadRuntimeSecurityModule();

  assert.strictEqual(resolveElectronSandboxEnabled({}), true);
  assert.strictEqual(resolveElectronSandboxEnabled({ ELECTRON_SANDBOX: '1' }), true);
  assert.strictEqual(resolveElectronSandboxEnabled({ ELECTRON_SANDBOX: 'true' }), true);
  assert.strictEqual(resolveElectronSandboxEnabled({ ELECTRON_SANDBOX: '0' }), false);
  assert.strictEqual(resolveElectronSandboxEnabled({ ELECTRON_SANDBOX: 'false' }), false);
  assert.strictEqual(resolveElectronSandboxEnabled({ ELECTRON_SANDBOX: 'off' }), false);
});

test('runtime security renders QR code data URLs via main-safe helper', async () => {
  const { renderQrCodeDataUrl } = loadRuntimeSecurityModule();
  const dataUrl = await renderQrCodeDataUrl('conteudo-qr', { width: 128, margin: 1 });

  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});

test('updates smoke mode supports install request even when app is not packaged', async () => {
  const updates = loadUpdatesModule({
    isPackaged: false,
    env: { BOTASSIST_SMOKE_MOCK_UPDATES: '1' },
  });

  await updates.checkForUpdates();
  updates.quitAndInstallUpdate();

  assert.strictEqual(updates.getUpdateState().status, 'install-requested');
});

test('preload IPC contract stays aligned with shared IPC contract', () => {
  const preloadContracts = loadPreloadModule();
  const sharedContracts = require(path.join(process.cwd(), 'src', 'shared', 'ipcContracts.js'));

  ['QR_TO_DATA_URL', 'GET_SETTINGS', 'SET_SETTINGS', 'CHECK_FOR_UPDATES'].forEach((key) => {
    assert.strictEqual(preloadContracts.IPC_INVOKE[key], sharedContracts.IPC_INVOKE[key]);
  });

  ['BOT_LOG', 'QR_CODE', 'PRELOAD_READY', 'PRELOAD_ERROR'].forEach((key) => {
    assert.strictEqual(preloadContracts.IPC_EVENTS[key], sharedContracts.IPC_EVENTS[key]);
  });
});

test('release verifier targets channel-specific linux feed while keeping shared desktop feeds', () => {
  const { buildRequiredFeedNames } = loadReleaseVerifyModule();

  assert.deepStrictEqual(buildRequiredFeedNames('v4.2.3'), [
    'latest.yml',
    'latest-mac.yml',
    'latest-linux.yml',
  ]);
  assert.deepStrictEqual(buildRequiredFeedNames('v4.2.0-beta.4'), [
    'latest.yml',
    'latest-mac.yml',
    'beta-linux.yml',
  ]);
});

test('release verifier parses updater feeds without duplicating primary path entry', () => {
  const { parseUpdaterFeed } = loadReleaseVerifyModule();
  const parsed = parseUpdaterFeed(
    [
      'version: 4.2.3',
      'files:',
      '  - url: BotAssist-WhatsApp-4.2.3.AppImage',
      '    sha512: appimage-hash',
      '    size: 123',
      '  - url: botassist-whatsapp_4.2.3_amd64.deb',
      '    sha512: deb-hash',
      '    size: 456',
      'path: BotAssist-WhatsApp-4.2.3.AppImage',
      'sha512: appimage-hash',
      'releaseDate: 2026-03-22T09:00:00.000Z',
      '',
    ].join('\n')
  );

  assert.strictEqual(parsed.version, '4.2.3');
  assert.deepStrictEqual(parsed.entries, [
    {
      url: 'BotAssist-WhatsApp-4.2.3.AppImage',
      sha512: 'appimage-hash',
      size: 123,
    },
    {
      url: 'botassist-whatsapp_4.2.3_amd64.deb',
      sha512: 'deb-hash',
      size: 456,
    },
  ]);
});

test('release verifier requires rpm in linux feed when release publishes rpm asset', () => {
  const { verifyLinuxFeedCoverage } = loadReleaseVerifyModule();
  const assetMap = new Map([
    ['BotAssist-WhatsApp-4.2.3.AppImage', { name: 'BotAssist-WhatsApp-4.2.3.AppImage' }],
    ['botassist-whatsapp_4.2.3_amd64.deb', { name: 'botassist-whatsapp_4.2.3_amd64.deb' }],
    ['botassist-whatsapp-4.2.3.x86_64.rpm', { name: 'botassist-whatsapp-4.2.3.x86_64.rpm' }],
  ]);

  assert.throws(() => {
    verifyLinuxFeedCoverage(
      {
        entries: [
          { url: 'BotAssist-WhatsApp-4.2.3.AppImage' },
          { url: 'botassist-whatsapp_4.2.3_amd64.deb' },
        ],
      },
      assetMap
    );
  }, /Feed Linux nao lista artefato \.rpm/);
});

test('signing readiness accepts imported certificates and notarization API credentials', () => {
  const { buildGithubEnvEntries, resolveSigningReadiness } = loadSigningReadinessModule();
  const env = {
    WIN_CSC_LINK: 'base64-win-cert',
    WIN_CSC_KEY_PASSWORD: 'win-password',
    MAC_CSC_LINK: 'base64-mac-cert',
    MAC_CSC_KEY_PASSWORD: 'mac-password',
    MAC_CSC_NAME: 'Developer ID Application: BotAssist',
    APPLE_API_KEY: 'api-key',
    APPLE_API_KEY_ID: 'ABC123',
    APPLE_API_ISSUER: 'issuer-id',
  };

  const readiness = resolveSigningReadiness(env);

  assert.strictEqual(readiness.windows.ready, true);
  assert.strictEqual(readiness.macSigning.ready, true);
  assert.strictEqual(readiness.macNotarization.ready, true);
  assert.strictEqual(readiness.readyForSignedRelease, true);
  assert.deepStrictEqual(buildGithubEnvEntries('Windows', readiness, env), [
    ['CSC_LINK', 'base64-win-cert'],
    ['CSC_KEY_PASSWORD', 'win-password'],
  ]);
  assert.deepStrictEqual(buildGithubEnvEntries('macOS', readiness, env), [
    ['CSC_LINK', 'base64-mac-cert'],
    ['CSC_KEY_PASSWORD', 'mac-password'],
    ['CSC_NAME', 'Developer ID Application: BotAssist'],
    ['APPLE_API_KEY', 'api-key'],
    ['APPLE_API_KEY_ID', 'ABC123'],
    ['APPLE_API_ISSUER', 'issuer-id'],
  ]);
});

test('signing readiness does not treat CSC_NAME alone as macOS-ready', () => {
  const { buildFailureMessages, buildSummary, resolveSigningReadiness } =
    loadSigningReadinessModule();
  const readiness = resolveSigningReadiness({
    MAC_CSC_NAME: 'Developer ID Application: BotAssist',
  });

  assert.strictEqual(readiness.windows.ready, false);
  assert.strictEqual(readiness.macSigning.ready, false);
  assert.strictEqual(readiness.macSigning.identitySelectorOnly, true);
  assert.strictEqual(readiness.macNotarization.ready, false);
  assert.deepStrictEqual(buildFailureMessages(readiness), [
    'Windows signing nao esta configurado.',
    'macOS signing nao esta configurado.',
    'macOS notarization nao esta configurada.',
  ]);
  assert.match(
    buildSummary(readiness, { runnerOs: 'macOS', requireSignedReleases: true }),
    /identity selector/
  );
});

test('signing readiness materializes APPLE_API_KEY content into a temp file on macOS', () => {
  withTempDir((dir) => {
    const { buildGithubEnvEntries, prepareGithubRuntime, resolveSigningReadiness } =
      loadSigningReadinessModule();
    const env = {
      RUNNER_TEMP: dir,
      APPLE_API_KEY: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n',
      APPLE_API_KEY_ID: 'ABC123',
      APPLE_API_ISSUER: 'issuer-id',
    };

    const readiness = resolveSigningReadiness(env);
    const runtime = prepareGithubRuntime('macOS', readiness, env);

    assert.ok(runtime.appleApiKeyPath.endsWith(path.join('', 'AuthKey_ABC123.p8')));
    assert.strictEqual(fs.readFileSync(runtime.appleApiKeyPath, 'utf8'), env.APPLE_API_KEY);
    assert.deepStrictEqual(buildGithubEnvEntries('macOS', readiness, env, runtime), [
      ['CSC_IDENTITY_AUTO_DISCOVERY', 'false'],
      ['APPLE_API_KEY', runtime.appleApiKeyPath],
      ['APPLE_API_KEY_ID', 'ABC123'],
      ['APPLE_API_ISSUER', 'issuer-id'],
    ]);
  });
});

test('signing provision plan encodes cert files and reads passwords from environment variables', () => {
  withTempDir((dir) => {
    const { buildProvisionPlan } = loadSigningProvisionModule();
    const winCert = path.join(dir, 'windows.p12');
    const macCert = path.join(dir, 'macos.p12');
    const apiKey = path.join(dir, 'AuthKey_ABC123.p8');

    fs.writeFileSync(winCert, 'win-cert-binary');
    fs.writeFileSync(macCert, 'mac-cert-binary');
    fs.writeFileSync(apiKey, '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n');

    const plan = buildProvisionPlan(
      {
        repo: 'N1ghthill/botassist-whatsapp',
        dryRun: true,
        runReadinessWorkflow: false,
        requireSignedReleases: 'keep',
        windowsCertFile: winCert,
        windowsCertPasswordEnv: 'WIN_CERT_PASSWORD',
        macCertFile: macCert,
        macCertPasswordEnv: 'MAC_CERT_PASSWORD',
        macCertName: 'Developer ID Application: BotAssist',
        appleApiKeyFile: apiKey,
        appleApiKeyId: 'ABC123',
        appleApiIssuer: 'issuer-id',
        appleId: '',
        appleAppSpecificPasswordEnv: '',
        appleTeamId: '',
      },
      {
        WIN_CERT_PASSWORD: 'win-password',
        MAC_CERT_PASSWORD: 'mac-password',
      },
      { secretNames: new Set() }
    );

    assert.strictEqual(plan.operations.length, 8);
    assert.strictEqual(
      plan.operations.find((operation) => operation.name === 'WIN_CSC_LINK').value,
      Buffer.from('win-cert-binary').toString('base64')
    );
    assert.strictEqual(
      plan.operations.find((operation) => operation.name === 'MAC_CSC_LINK').value,
      Buffer.from('mac-cert-binary').toString('base64')
    );
    assert.strictEqual(
      plan.operations.find((operation) => operation.name === 'APPLE_API_KEY').value,
      '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n'
    );
    assert.strictEqual(plan.projectedReadiness.readyForSignedRelease, true);
  });
});

test('signing provision blocks enabling required releases when projected readiness is incomplete', () => {
  withTempDir((dir) => {
    const { buildProvisionPlan } = loadSigningProvisionModule();
    const winCert = path.join(dir, 'windows.p12');

    fs.writeFileSync(winCert, 'win-cert-binary');

    assert.throws(
      () =>
        buildProvisionPlan(
          {
            repo: 'N1ghthill/botassist-whatsapp',
            dryRun: true,
            runReadinessWorkflow: false,
            requireSignedReleases: 'true',
            windowsCertFile: winCert,
            windowsCertPasswordEnv: 'WIN_CERT_PASSWORD',
            macCertFile: '',
            macCertPasswordEnv: '',
            macCertName: '',
            appleApiKeyFile: '',
            appleApiKeyId: '',
            appleApiIssuer: '',
            appleId: '',
            appleAppSpecificPasswordEnv: '',
            appleTeamId: '',
          },
          {
            WIN_CERT_PASSWORD: 'win-password',
          },
          { secretNames: new Set() }
        ),
      /Nao e seguro ativar REQUIRE_SIGNED_RELEASES=true/
    );
  });
});

test('linux feed patch can derive beta feed from latest-linux.yml', () => {
  withTempDir((dir) => {
    const { patchLinuxFeedWithRpm } = loadPatchLinuxFeedModule();
    const latestFeedPath = path.join(dir, 'latest-linux.yml');
    const betaFeedPath = path.join(dir, 'beta-linux.yml');
    const rpmPath = path.join(dir, 'botassist-whatsapp-4.2.0-beta.4.x86_64.rpm');

    fs.writeFileSync(
      latestFeedPath,
      [
        'version: 4.2.0-beta.4',
        'files:',
        'path: BotAssist WhatsApp-4.2.0-beta.4.AppImage',
        'sha512: fake',
        'releaseDate: 2026-03-21T00:00:00.000Z',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(rpmPath, 'rpm-binary', 'utf8');

    patchLinuxFeedWithRpm(dir, 'beta-linux.yml');

    assert.ok(fs.existsSync(betaFeedPath));
    const patched = fs.readFileSync(betaFeedPath, 'utf8');
    assert.ok(patched.includes('url: botassist-whatsapp-4.2.0-beta.4.x86_64.rpm'));
    assert.ok(patched.includes('size: 10'));
  });
});

test('tool registry keeps a single source of truth for canonical and internal names', () => {
  const { TOOL_DEFINITIONS, TOOL_REGISTRY, getToolByName } = loadToolRegistryModule();
  const keys = new Set();
  const internalNames = new Set();

  for (const tool of TOOL_REGISTRY) {
    assert.ok(tool.key);
    assert.ok(tool.internalName);
    assert.ok(typeof tool.handler === 'function');
    assert.strictEqual(keys.has(tool.key), false);
    assert.strictEqual(internalNames.has(tool.internalName), false);
    keys.add(tool.key);
    internalNames.add(tool.internalName);
    assert.strictEqual(getToolByName(tool.key)?.internalName, tool.internalName);
    assert.strictEqual(getToolByName(tool.internalName)?.key, tool.key);
  }

  assert.strictEqual(TOOL_DEFINITIONS.length, TOOL_REGISTRY.length);
});

test('tool policies normalize context and write audit log', () => {
  withTempDir((dir) => {
    const { buildToolContext } = loadToolPoliciesModule();
    const allowedPath = path.join(dir, 'allowed');
    fs.mkdirSync(allowedPath, { recursive: true });

    const context = buildToolContext(
      {
        tools: {
          enabled: true,
          allowedPaths: [allowedPath],
          allowedWritePaths: [allowedPath],
          autoAllow: ['fs.list'],
        },
      },
      dir,
      { requesterPhone: '5511999999999', log: () => {} }
    );

    assert.ok(context.allowedReadPaths.includes(allowedPath));
    assert.ok(context.allowedWritePaths.includes(allowedPath));
    assert.ok(typeof context.audit === 'function');

    context.audit({ tool: 'fs.list', status: 'ok', preview: 'path="."' });
    const auditPath = path.join(dir, 'logs', 'tools_audit.log');
    assert.ok(fs.existsSync(auditPath));
    const content = fs.readFileSync(auditPath, 'utf8');
    assert.ok(content.includes('tool=fs.list'));
  });
});

test('tool access blocks non-owner and group usage according to policy', () => {
  const { getToolAccess } = loadToolPoliciesModule();
  const ownerOnly = getToolAccess(
    { tools: { enabled: true, requireOwner: true } },
    { isGroup: false, isOwner: false }
  );
  const noGroups = getToolAccess(
    { tools: { enabled: true, requireOwner: false, allowInGroups: false } },
    { isGroup: true, isOwner: true }
  );

  assert.strictEqual(ownerOnly.enabled, false);
  assert.strictEqual(ownerOnly.reason, 'owner');
  assert.strictEqual(noGroups.enabled, false);
  assert.strictEqual(noGroups.reason, 'groups');
});

test('tool policies do not inherit write paths from read paths', () => {
  withTempDir((dir) => {
    const { buildToolContext } = loadToolPoliciesModule();
    const allowedPath = path.join(dir, 'allowed');
    fs.mkdirSync(allowedPath, { recursive: true });

    const context = buildToolContext(
      {
        tools: {
          enabled: true,
          allowedPaths: [allowedPath],
        },
      },
      dir,
      {}
    );

    assert.deepStrictEqual(context.allowedReadPaths, [allowedPath]);
    assert.deepStrictEqual(context.allowedWritePaths, []);
  });
});

test('tool loop returns pending approvals in manual mode', async () => {
  const { runToolLoop } = loadToolOrchestratorModule(async () => ({
    content: '',
    tool_calls: [
      {
        id: 'call_manual',
        function: {
          name: 'fs_list',
          arguments: JSON.stringify({ path: '/tmp' }),
        },
      },
    ],
  }));

  const result = await runToolLoop({
    provider: 'groq',
    apiKey: 'secret',
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Liste a pasta' }],
    toolContext: {
      tools: { mode: 'manual', autoAllow: ['fs.list'], maxOutputChars: 6000 },
      audit: null,
    },
  });

  assert.ok(result.pending);
  assert.strictEqual(result.pending.pendingCalls.length, 1);
  assert.strictEqual(result.pending.pendingCalls[0].canonicalName, 'fs.list');
});

test('approval flow creates entry metadata with deterministic ttl', () => {
  const { createToolApprovalEntry } = loadApprovalFlowModule();
  const entry = createToolApprovalEntry(
    {
      remoteJid: '5511999999999@s.whatsapp.net',
      pendingCalls: [],
    },
    { now: 1234, ttlMs: 5000 }
  );

  assert.ok(/^auth_/.test(entry.id));
  assert.strictEqual(entry.createdAt, 1234);
  assert.strictEqual(entry.expiresAt, 6234);
  assert.strictEqual(entry.remoteJid, '5511999999999@s.whatsapp.net');
});

test('approval flow executes approved tools and persists follow-up answer', async () => {
  const { handleToolApprovalCommand } = loadApprovalFlowModule();
  const sent = [];
  const removed = [];
  const persisted = [];
  const entry = {
    id: 'auth_test',
    remoteJid: 'chat@s.whatsapp.net',
    requesterJid: 'user@s.whatsapp.net',
    requesterPhone: '5511999999999',
    messages: [{ role: 'user', content: 'Liste a pasta' }],
    assistantMessage: { role: 'assistant', content: 'Vou usar ferramentas.' },
    autoToolMessages: [{ role: 'tool', content: 'Ferramenta sugerida.' }],
    pendingCalls: [{ call: { name: 'fs_list' } }],
    toolContext: { tools: { mode: 'manual' } },
    provider: 'groq',
    apiKey: 'secret',
    baseUrl: '',
    model: 'llama-3.3-70b-versatile',
    botTag: '[Bot]',
    prefix: '!',
    quotedMessage: { key: { id: 'msg1' } },
    sessionId: 'chat@s.whatsapp.net',
    userInput: 'Liste a pasta',
    historyEnabled: true,
    historySummaryEnabled: true,
    historyMaxMessages: 12,
    maxResponseChars: 500,
  };

  const handled = await handleToolApprovalCommand({
    command: { command: 'aprovar', rawArgs: 'auth_test' },
    remoteJid: 'owner@s.whatsapp.net',
    isOwner: true,
    message: { key: { id: 'owner-msg' } },
    prefix: '!',
    botTag: '[Owner]',
    getPendingToolApproval: (id) => (id === 'auth_test' ? entry : null),
    removePendingToolApproval: (id) => removed.push(id),
    addPendingToolApproval: () => {
      throw new Error('should not enqueue new approval for answer path');
    },
    sendMessage: async (jid, content, options) => {
      sent.push({ jid, content, options });
    },
    summarizeToolCallForApproval: () => 'fs.list /tmp',
    runApprovedToolCalls: async () => [{ role: 'tool', content: 'saida da ferramenta' }],
    runToolLoop: async () => ({ answer: 'Resposta final ao usuario' }),
    persistHistory: async (payload) => {
      persisted.push(payload);
    },
  });

  assert.strictEqual(handled, true);
  assert.deepStrictEqual(removed, ['auth_test']);
  assert.strictEqual(sent.length, 2);
  assert.strictEqual(sent[0].jid, 'owner@s.whatsapp.net');
  assert.match(sent[0].content.text, /Aprovado\. Executando ferramentas/);
  assert.strictEqual(sent[1].jid, 'chat@s.whatsapp.net');
  assert.match(sent[1].content.text, /Resposta final ao usuario/);
  assert.strictEqual(persisted.length, 1);
  assert.strictEqual(persisted[0].sessionId, 'chat@s.whatsapp.net');
});

test('tool loop auto-executes allowed read-only tools and resumes provider reply', async () => {
  await withTempDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'arquivo.txt'), 'conteudo', 'utf8');
    const { buildToolContext } = loadToolPoliciesModule();
    let calls = 0;
    const { runToolLoop } = loadToolOrchestratorModule(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          content: '',
          tool_calls: [
            {
              id: 'call_auto',
              function: {
                name: 'fs_list',
                arguments: JSON.stringify({ path: dir }),
              },
            },
          ],
        };
      }
      return { content: 'Ferramenta executada com sucesso.' };
    });

    const toolContext = buildToolContext(
      {
        tools: {
          enabled: true,
          mode: 'auto',
          autoAllow: ['fs.list'],
          allowedPaths: [dir],
        },
      },
      dir,
      {}
    );

    const result = await runToolLoop({
      provider: 'groq',
      apiKey: 'secret',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Liste a pasta' }],
      toolContext,
    });

    assert.strictEqual(result.answer, 'Ferramenta executada com sucesso.');
    assert.strictEqual(calls, 2);
  });
});

test('fs read blocks symlink escape from allowed path', async () => {
  await withTempDir(async (dir) => {
    const { toolFsRead } = loadFsExecutorModule();
    const allowedDir = path.join(dir, 'allowed');
    const outsideFile = path.join(dir, 'segredo.txt');
    const linkPath = path.join(allowedDir, 'atalho.txt');

    fs.mkdirSync(allowedDir, { recursive: true });
    fs.writeFileSync(outsideFile, 'segredo', 'utf8');
    fs.symlinkSync(outsideFile, linkPath);

    await assert.rejects(
      () =>
        toolFsRead(
          { path: linkPath },
          {
            baseDir: process.cwd(),
            allowedReadPaths: [allowedDir],
            blockedExtensions: [],
            maxFileSizeMb: 10,
            tools: { maxOutputChars: 1000 },
          }
        ),
      /Caminho nao permitido/
    );
  });
});

test('fs write blocks destination through symlinked parent', async () => {
  await withTempDir(async (dir) => {
    const { toolFsWrite } = loadFsExecutorModule();
    const allowedDir = path.join(dir, 'allowed');
    const outsideDir = path.join(dir, 'outside');
    const linkDir = path.join(allowedDir, 'link-dir');
    const targetFile = path.join(linkDir, 'novo.txt');

    fs.mkdirSync(allowedDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.symlinkSync(outsideDir, linkDir, 'dir');

    await assert.rejects(
      () =>
        toolFsWrite(
          { path: targetFile, content: 'teste' },
          {
            baseDir: process.cwd(),
            allowedWritePaths: [allowedDir],
          }
        ),
      /Caminho nao permitido/
    );

    assert.strictEqual(fs.existsSync(path.join(outsideDir, 'novo.txt')), false);
  });
});

test('fs write is blocked when no write paths are configured', async () => {
  await withTempDir(async (dir) => {
    const { toolFsWrite } = loadFsExecutorModule();
    const allowedDir = path.join(dir, 'allowed');
    const targetFile = path.join(allowedDir, 'novo.txt');

    fs.mkdirSync(allowedDir, { recursive: true });

    await assert.rejects(
      () =>
        toolFsWrite(
          { path: targetFile, content: 'teste' },
          {
            baseDir: process.cwd(),
            allowedWritePaths: [],
          }
        ),
      /Caminho nao permitido/
    );
  });
});

test('shell executor blocks cwd through symlink escape', async () => {
  await withTempDir(async (dir) => {
    const { toolShellExec } = loadShellExecutorModule();
    const allowedDir = path.join(dir, 'allowed');
    const outsideDir = path.join(dir, 'outside');
    const linkDir = path.join(allowedDir, 'link-dir');

    fs.mkdirSync(allowedDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.symlinkSync(outsideDir, linkDir, 'dir');

    await assert.rejects(
      () =>
        toolShellExec(
          {
            command: 'node -e "process.stdout.write(\'ok\')"',
            cwd: linkDir,
          },
          {
            baseDir: process.cwd(),
            allowedReadPaths: [allowedDir],
            tools: { commandAllowlist: ['node'], commandDenylist: [] },
          }
        ),
      /Diretorio de trabalho nao permitido/
    );
  });
});

test('tools diagnostics keeps allowlist checks aligned with tooling helpers', () => {
  withTempDir((dir) => {
    const { runToolsDiagnostics } = loadToolsDiagnosticsModule();
    const allowedDir = path.join(dir, 'allowed');
    const outsideDir = path.join(dir, 'outside');
    const linkDir = path.join(allowedDir, 'link-dir');

    fs.mkdirSync(allowedDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.symlinkSync(outsideDir, linkDir, 'dir');

    const result = runToolsDiagnostics({
      tools: {
        enabled: true,
        allowedPaths: [allowedDir],
      },
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.path, allowedDir);
  });
});

test('shell executor enforces allowlist by command base', async () => {
  const { toolShellExec } = loadShellExecutorModule();
  const result = await toolShellExec(
    {
      command: 'node -e "process.stdout.write(\'ok\')"',
      timeoutMs: 5000,
    },
    {
      baseDir: process.cwd(),
      allowedReadPaths: [process.cwd()],
      tools: {
        commandAllowlist: ['node'],
        commandDenylist: [],
      },
    }
  );

  assert.strictEqual(result.commandBase, 'node');
  assert.strictEqual(result.stdout, 'ok');
  assert.strictEqual(result.error, undefined);
});

test('shell executor rejects environment assignments', async () => {
  const { toolShellExec } = loadShellExecutorModule();
  await assert.rejects(
    () =>
      toolShellExec(
        { command: 'PATH=/tmp node -e "process.stdout.write(\'ok\')"' },
        {
          baseDir: process.cwd(),
          allowedReadPaths: [process.cwd()],
          tools: { commandAllowlist: ['node'], commandDenylist: [] },
        }
      ),
    /Atribuicoes de ambiente/
  );
});

test('shell executor rejects explicit executable paths when allowlist is active', async () => {
  const { toolShellExec } = loadShellExecutorModule();
  await assert.rejects(
    () =>
      toolShellExec(
        { command: './node -e "process.stdout.write(\'ok\')"' },
        {
          baseDir: process.cwd(),
          allowedReadPaths: [process.cwd()],
          tools: { commandAllowlist: ['node'], commandDenylist: [] },
        }
      ),
    /nome base do executavel/
  );
});

test('shell executor rejects compound shell syntax', async () => {
  const { toolShellExec } = loadShellExecutorModule();
  await assert.rejects(
    () =>
      toolShellExec(
        { command: 'node -e "process.stdout.write(\'ok\')" && echo fail' },
        {
          baseDir: process.cwd(),
          allowedReadPaths: [process.cwd()],
          tools: { commandAllowlist: ['node'], commandDenylist: [] },
        }
      ),
    /Comandos compostos/
  );
});

test('shell executor denylist uses command base', async () => {
  const { toolShellExec } = loadShellExecutorModule();
  await assert.rejects(
    () =>
      toolShellExec(
        { command: 'node -e "process.stdout.write(\'ok\')"' },
        {
          baseDir: process.cwd(),
          allowedReadPaths: [process.cwd()],
          tools: { commandAllowlist: [], commandDenylist: ['node'] },
        }
      ),
    /denylist/
  );
});

test('web open blocks redirects to domains outside policy', async () => {
  const { toolWebOpen } = loadWebExecutorModule();

  await withPatchedFetch(async (url, options) => {
    assert.strictEqual(options?.redirect, 'manual');

    if (url === 'https://allowed.example/inicio') {
      return new Response('', {
        status: 302,
        headers: {
          location: 'https://blocked.example/segredo',
        },
      });
    }

    throw new Error(`unexpected fetch url: ${url}`);
  }, async () => {
    await assert.rejects(
      () =>
        toolWebOpen(
          { url: 'https://allowed.example/inicio' },
          {
            allowedDomains: ['allowed.example'],
            blockedDomains: ['blocked.example'],
            tools: { maxOutputChars: 6000 },
          }
        ),
      /Dominio nao permitido apos redirecionamento/
    );
  });
});

test('web open rejects oversized bodies before loading everything into output', async () => {
  const { toolWebOpen } = loadWebExecutorModule();
  const largeBody = 'x'.repeat(200000);

  await withPatchedFetch(async () => new Response(largeBody, { status: 200 }), async () => {
    await assert.rejects(
      () =>
        toolWebOpen(
          { url: 'https://allowed.example/conteudo', maxChars: 200 },
          {
            allowedDomains: ['allowed.example'],
            blockedDomains: [],
            tools: { maxOutputChars: 200 },
          }
        ),
      /Resposta excedeu o limite/
    );
  });
});

test('app protocol resolves renderer path and blocks traversal', () => {
  const { buildAppUrl, normalizeAppPath, resolveAppFilePath } = loadAppProtocolModule();
  const appUrl = buildAppUrl('/src/renderer/index.html');

  assert.strictEqual(normalizeAppPath('/src/renderer/index.html'), 'src/renderer/index.html');
  assert.ok(resolveAppFilePath(appUrl).endsWith(path.join('src', 'renderer', 'index.html')));
  assert.strictEqual(resolveAppFilePath('app://botassist/../../etc/passwd'), '');
});

test('botManager starts bot process with expected env and forwards status/log events', async () => {
  class FakeChildProcess extends EventEmitter {
    constructor() {
      super();
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
      this.pid = 12345;
      this.kills = [];
    }

    kill(signal) {
      this.kills.push(signal);
      this.__botassistExitCode = 0;
      setImmediate(() => this.emit('exit', 0, signal));
      return true;
    }
  }

  let forkOptions = null;
  const fakeProc = new FakeChildProcess();
  const { createBotManager } = loadBotManagerModule((filePath, args, options) => {
    forkOptions = { filePath, args, options };
    return fakeProc;
  });

  const rendererEvents = [];
  const manager = createBotManager({
    sendToRenderer: (channel, payload) => rendererEvents.push({ channel, payload }),
    getSettingsPath: () => '/tmp/botassist-settings.json',
    getUserDataDir: () => '/tmp/botassist-userdata',
    getGroqApiKey: async () => 'secret-key',
    getSettingsSnapshot: () => ({}),
    updateSettings: () => {},
    updateTrayStatus: () => {},
  });

  await manager.startBot();

  assert.ok(forkOptions);
  assert.strictEqual(forkOptions.options.serviceName, 'BotAssist WhatsApp Bot');
  assert.strictEqual(forkOptions.options.env.BOTASSIST_CONFIG_PATH, '/tmp/botassist-settings.json');
  assert.strictEqual(forkOptions.options.env.BOTASSIST_DATA_DIR, '/tmp/botassist-userdata');
  assert.strictEqual(forkOptions.options.env.GROQ_API_KEY, 'secret-key');
  assert.strictEqual(forkOptions.options.env.ELECTRON_RUN_AS_NODE, undefined);

  fakeProc.emit('message', { event: 'status', status: 'online' });
  fakeProc.stdout.emit(
    'data',
    Buffer.from('BOTASSIST:{"event":"log","message":"teste log","level":"info"}\n')
  );
  fakeProc.stderr.emit('data', Buffer.from('erro teste'));

  assert.strictEqual(manager.getBotStatus(), 'online');
  assert.ok(
    rendererEvents.some(
      (event) => event.channel === 'bot-status' && event.payload === 'online'
    )
  );
  assert.ok(
    rendererEvents.some(
      (event) =>
        event.channel === 'bot-log' &&
        event.payload?.message === 'teste log' &&
        event.payload?.level === 'info'
    )
  );
  assert.ok(
    rendererEvents.some(
      (event) => event.channel === 'bot-error' && String(event.payload).includes('erro teste')
    )
  );

  manager.stopBot();
  await flushMicrotasks();
  assert.ok(fakeProc.kills.includes(undefined));
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(err && err.stack ? err.stack : err);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  process.exitCode = 1;
  console.error(err && err.stack ? err.stack : err);
});
