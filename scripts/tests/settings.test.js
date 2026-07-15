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
    loadProviderModule,
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
        botTag: '[Teste]',
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
            profiles: [
              {
                id: 'p1',
                name: 'A',
                persona: 'custom',
                provider: 'groq',
                model: 'llama-3.3-70b-versatile',
              },
            ],
            activeProfileId: 'p1',
            profileRouting: { users: { 5511: 'p2' } },
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

  test('owner command throttles repeated invalid access attempts', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const sent = [];
    let verified = false;

    const handled = await handleAccessCommand(
      {
        command: { isCommand: true, command: 'owner', rawArgs: '123456' },
        prefix: '!',
        remoteJid: 'user@s.whatsapp.net',
        isGroup: false,
        isOwner: false,
        botTag: '[Bot]',
        message: { key: { id: 'msg1' } },
        settings: {},
        senderJid: 'user@s.whatsapp.net',
        senderPhone: '5511999999999',
        pairingId: '5511999999999',
      },
      {
        sendMessage: async (jid, content, options) => sent.push({ jid, content, options }),
        normalizeOwnerClaimToken: (value) => String(value || '').trim(),
        verifyOwnerClaimToken: () => {
          verified = true;
          return { ok: false, reason: 'invalid' };
        },
        requestSettingsUpdate: () => {},
        isAccessAttemptLimited: () => true,
        recordAccessAttemptFailure: () => {
          throw new Error('limited attempts should not record another failure');
        },
      }
    );

    assert.strictEqual(handled, true);
    assert.strictEqual(verified, false);
    assert.strictEqual(sent.length, 1);
    assert.match(sent[0].content.text, /Muitas tentativas invalidas/);
  });

  test('owner command records invalid access attempts', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const failures = [];

    const handled = await handleAccessCommand(
      {
        command: { isCommand: true, command: 'owner', rawArgs: '000000' },
        prefix: '!',
        remoteJid: 'user@s.whatsapp.net',
        isGroup: false,
        isOwner: false,
        botTag: '',
        message: { key: { id: 'msg1' } },
        settings: {},
        senderJid: 'user@s.whatsapp.net',
        senderPhone: '5511999999999',
        pairingId: '5511999999999',
      },
      {
        sendMessage: async () => {},
        normalizeOwnerClaimToken: (value) => String(value || '').trim(),
        verifyOwnerClaimToken: () => ({ ok: false, reason: 'invalid' }),
        requestSettingsUpdate: () => {},
        isAccessAttemptLimited: () => false,
        recordAccessAttemptFailure: (kind, key) => failures.push({ kind, key }),
      }
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(failures, [{ kind: 'owner', key: '5511999999999' }]);
  });

  test('pairing command records invalid access attempts', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const failures = [];

    const handled = await handleAccessCommand(
      {
        command: { isCommand: false },
        text: 'pair 111111',
        prefix: '!',
        remoteJid: 'user@s.whatsapp.net',
        isGroup: false,
        isOwner: false,
        botTag: '',
        message: { key: { id: 'msg1' } },
        settings: { allowedUsers: ['5500000000000'] },
        dmPolicy: 'pairing',
        senderJid: 'user@s.whatsapp.net',
        senderPhone: '5511999999999',
        pairingId: '5511999999999',
      },
      {
        sendMessage: async () => {},
        requestSettingsUpdate: () => {},
        getPairingEntry: () => ({ code: '222222', expiresAt: Date.now() + 1000 }),
        clearPairingEntry: () => {},
        isAccessAttemptLimited: () => false,
        recordAccessAttemptFailure: (kind, key) => failures.push({ kind, key }),
      }
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(failures, [{ kind: 'pairing', key: '5511999999999' }]);
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

  test('shared settings schema supports OpenAI-compatible provider metadata', () => {
    const schema = loadSharedSchema();
    const defaults = schema.createDefaultSettings();
    const profile = schema.normalizeProfile({
      name: 'Compat',
      provider: 'openai-compatible',
      model: 'custom-model',
    });

    assert.ok(schema.PROVIDERS.includes('openai-compatible'));
    assert.strictEqual(schema.normalizeProvider('openai-compatible'), 'openai-compatible');
    assert.strictEqual(
      schema.PROVIDER_META['openai-compatible'].baseUrlField,
      'openaiCompatibleBaseUrl'
    );
    assert.strictEqual(defaults.openaiCompatibleBaseUrl, '');
    assert.strictEqual(profile.provider, 'openai-compatible');
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
          profileRouting: { users: { 5511: 'missing-profile' } },
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
          BOTASSIST_EMAIL_IMAP_PASSWORD: 'imap-env-secret',
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
        assert.strictEqual(loaded.email.imapPassword, 'imap-env-secret');
      } finally {
        store.dispose();
      }
    });
  });

  test('runtime settings store applies OpenAI-compatible env fallback', () => {
    withTempDir((dir) => {
      const settingsPath = path.join(dir, 'settings.json');
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(
          {
            profiles: [
              {
                id: 'p1',
                name: 'Compat',
                persona: 'custom',
                provider: 'openai-compatible',
                model: 'compat-model',
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
          BOTASSIST_PROVIDER: 'openai-compatible',
          OPENAI_COMPATIBLE_API_KEY: 'compat-secret',
          OPENAI_COMPATIBLE_BASE_URL: 'https://llm.example/v1',
        },
        reloadDebounceMs: 1,
      });

      try {
        const loaded = store.readSettings();
        assert.strictEqual(loaded.provider, 'openai-compatible');
        assert.strictEqual(loaded.openaiCompatibleApiKey, 'compat-secret');
        assert.strictEqual(loaded.openaiCompatibleBaseUrl, 'https://llm.example/v1');
      } finally {
        store.dispose();
      }
    });
  });

  test('provider module calls OpenAI-compatible chat completions endpoint', async () => {
    const provider = loadProviderModule();
    let captured = null;

    await withPatchedFetch(
      async (url, options) => {
        captured = { url, options };
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () =>
            JSON.stringify({
              choices: [{ message: { role: 'assistant', content: 'ok compat' } }],
            }),
        };
      },
      async () => {
        const message = await provider.runProviderChat({
          provider: 'openai-compatible',
          apiKey: 'secret',
          baseUrl: 'https://llm.example/v1',
          model: 'compat-model',
          messages: [{ role: 'user', content: 'oi' }],
          temperature: 0.2,
          maxTokens: 64,
          tools: [{ type: 'function', function: { name: 'ping', parameters: {} } }],
          toolChoice: 'auto',
        });

        assert.strictEqual(message.content, 'ok compat');
      }
    );

    assert.strictEqual(captured.url, 'https://llm.example/v1/chat/completions');
    assert.strictEqual(captured.options.method, 'POST');
    assert.strictEqual(captured.options.headers.Authorization, 'Bearer secret');
    const body = JSON.parse(captured.options.body);
    assert.strictEqual(body.model, 'compat-model');
    assert.strictEqual(body.max_tokens, 64);
    assert.strictEqual(body.tools.length, 1);
  });

  test('email IMAP password is stored outside renderer settings payload', async () => {
    await withTempDir(async (dir) => {
      const settings = loadSettingsModule(dir);
      settings.loadSettings();

      try {
        await settings.setEmailImapPassword('imap-secret');
        const rendererSettings = await settings.getSettingsForRenderer();

        assert.strictEqual(rendererSettings.email.imapPassword, '');
        assert.strictEqual(rendererSettings.emailPasswordSet, true);
        assert.strictEqual(await settings.getEmailImapPassword(), 'imap-secret');
      } finally {
        await settings.clearEmailImapPassword();
      }
    });
  });
}

module.exports = { register };
