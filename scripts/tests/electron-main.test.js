function register(context) {
  const {
    test,
    assert,
    fs,
    Module,
    os,
    path,
    EventEmitter,
    withTempDir,
    loadSettingsModule,
    loadSharedSchema,
    loadRuntimeSettingsModule,
    loadMessageCommandsModule,
    loadReleaseChannelModule,
    loadRuntimeSecurityModule,
    loadPreloadModule,
    loadToolPoliciesModule,
    loadToolRegistryModule,
    loadToolOrchestratorModule,
    loadPatchLinuxFeedModule,
    loadReleaseVerifyModule,
    loadReleaseManifestModule,
    loadPackagedSmokeModule,
    loadSigningReadinessModule,
    loadSigningProvisionModule,
    loadSecurityAuditModule,
    loadBotManagerModule,
    loadUserDataModule,
    loadUpdatesModule,
    loadShellExecutorModule,
    loadFsExecutorModule,
    loadWebExecutorModule,
    loadToolsDiagnosticsModule,
    loadApprovalFlowModule,
    loadToolHelpersModule,
    loadAppProtocolModule,
    flushMicrotasks,
    withPatchedFetch,
  } = context;

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

  test('runtime pino import supports silent logger instantiation', async () => {
    const imported = await import('pino');
    const pino = imported.default || imported;
    const logger = pino({ level: 'silent' });

    assert.ok(logger);
    assert.strictEqual(typeof logger.info, 'function');
    assert.strictEqual(typeof logger.error, 'function');
    assert.strictEqual(logger.level, 'silent');
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
      getApiKeyForProvider: async (provider) =>
        provider === 'openai-compatible' ? 'compat-secret-key' : 'secret-key',
      getGroqApiKey: async () => 'secret-key',
      getEmailImapPassword: async () => 'imap-secret',
      getSettingsSnapshot: () => ({ provider: 'openai-compatible' }),
      updateSettings: () => {},
      updateTrayStatus: () => {},
    });

    await manager.startBot();

    assert.ok(forkOptions);
    assert.strictEqual(forkOptions.options.serviceName, 'BotAssist WhatsApp Bot');
    assert.strictEqual(
      forkOptions.options.env.BOTASSIST_CONFIG_PATH,
      '/tmp/botassist-settings.json'
    );
    assert.strictEqual(forkOptions.options.env.BOTASSIST_DATA_DIR, '/tmp/botassist-userdata');
    assert.strictEqual(forkOptions.options.env.BOTASSIST_PROVIDER, 'openai-compatible');
    assert.strictEqual(forkOptions.options.env.GROQ_API_KEY, 'secret-key');
    assert.strictEqual(forkOptions.options.env.OPENAI_COMPATIBLE_API_KEY, 'compat-secret-key');
    assert.strictEqual(forkOptions.options.env.BOTASSIST_EMAIL_IMAP_PASSWORD, 'imap-secret');
    assert.strictEqual(forkOptions.options.env.ELECTRON_RUN_AS_NODE, undefined);

    fakeProc.emit('message', { event: 'status', status: 'online' });
    fakeProc.stdout.emit(
      'data',
      Buffer.from('BOTASSIST:{"event":"log","message":"teste log","level":"info"}\n')
    );
    fakeProc.stderr.emit('data', Buffer.from('erro teste'));

    assert.strictEqual(manager.getBotStatus(), 'online');
    assert.ok(
      rendererEvents.some((event) => event.channel === 'bot-status' && event.payload === 'online')
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

  test('userData restore validates backup and stops bot before replacing local data', async () => {
    await withTempDir(async (dir) => {
      const userDataDir = path.join(dir, 'userData');
      const backupDir = path.join(dir, 'backup');
      fs.mkdirSync(path.join(userDataDir, 'auth'), { recursive: true });
      fs.mkdirSync(path.join(backupDir, 'auth'), { recursive: true });
      fs.mkdirSync(path.join(backupDir, 'sessions'), { recursive: true });
      fs.mkdirSync(path.join(backupDir, 'logs'), { recursive: true });
      fs.writeFileSync(path.join(userDataDir, 'settings.json'), '{"old":true}', 'utf8');
      fs.writeFileSync(path.join(userDataDir, 'auth', 'old.creds'), 'old', 'utf8');
      fs.writeFileSync(path.join(backupDir, 'settings.json'), '{"restored":true}', 'utf8');
      fs.writeFileSync(path.join(backupDir, 'auth', 'creds.json'), 'new', 'utf8');
      fs.writeFileSync(path.join(backupDir, 'sessions', 'chat.json'), '{}', 'utf8');
      fs.writeFileSync(path.join(backupDir, 'logs', 'tools_audit.log'), 'audit', 'utf8');

      const { createUserDataManager, validateBackupPath } = loadUserDataModule(userDataDir, {
        showOpenDialog: async () => ({ canceled: false, filePaths: [backupDir] }),
        showMessageBox: async () => ({ response: 1 }),
      });

      const validation = validateBackupPath(backupDir, userDataDir);
      assert.strictEqual(validation.ok, true);
      assert.deepStrictEqual(
        validation.items.map((item) => item.name),
        ['settings.json', 'auth', 'sessions', 'logs']
      );

      let stopped = false;
      const manager = createUserDataManager({
        stopBotAndWait: async () => {
          stopped = true;
          return { ok: true };
        },
        setBotStatus: () => {},
        getMainWindow: () => null,
      });

      const result = await manager.restoreUserData();

      assert.strictEqual(result.ok, true);
      assert.strictEqual(stopped, true);
      const restoredSettings = JSON.parse(
        fs.readFileSync(path.join(userDataDir, 'settings.json'), 'utf8')
      );
      assert.strictEqual(restoredSettings.restored, true);
      assert.strictEqual(fs.existsSync(path.join(userDataDir, 'auth', 'old.creds')), false);
      assert.strictEqual(
        fs.readFileSync(path.join(userDataDir, 'auth', 'creds.json'), 'utf8'),
        'new'
      );
      assert.strictEqual(fs.existsSync(path.join(userDataDir, 'sessions', 'chat.json')), true);
      assert.strictEqual(fs.existsSync(path.join(userDataDir, 'logs', 'tools_audit.log')), true);
    });
  });
}

module.exports = { register };
