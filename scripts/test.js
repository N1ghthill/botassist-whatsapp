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
