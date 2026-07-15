function register(context) {
  const {
    test,
    assert,
    loadMessageCommandsModule,
    loadAccessFailuresModule,
    loadMessageUtilsModule,
  } = context;

  function createCommandDeps(overrides = {}) {
    const sent = [];
    const updates = [];
    const deps = {
      sent,
      updates,
      sendMessage: async (jid, content, options) => sent.push({ jid, content, options }),
      normalizeOwnerClaimToken: (value) => String(value || '').trim(),
      verifyOwnerClaimToken: () => ({ ok: false, reason: 'invalid' }),
      requestSettingsUpdate: (action, payload = {}) => updates.push({ action, payload }),
      getPairingEntry: () => null,
      ensurePairingEntry: () => null,
      clearPairingEntry: () => {},
      isAccessAttemptLimited: () => false,
      recordAccessAttemptFailure: () => {},
      clearAccessAttemptFailures: () => {},
      ...overrides,
    };
    return deps;
  }

  test('message utils parse Baileys-like message text, sender and mentions', () => {
    const {
      extractMentionedJids,
      extractTextMessage,
      getSenderJid,
      isMentioningSelf,
      normalizeJid,
      parseCommand,
      stripLeadingMentions,
    } = loadMessageUtilsModule();

    const message = {
      key: {
        remoteJid: '120363000000000000@g.us',
        participant: '5511999999999@s.whatsapp.net:17',
      },
      message: {
        extendedTextMessage: {
          text: '@Bot !status',
          contextInfo: {
            mentionedJid: ['5511888888888@s.whatsapp.net'],
          },
        },
      },
    };

    assert.strictEqual(extractTextMessage(message), '@Bot !status');
    assert.strictEqual(getSenderJid(message), '5511999999999@s.whatsapp.net');
    assert.deepStrictEqual(extractMentionedJids(message), ['5511888888888@s.whatsapp.net']);
    assert.strictEqual(
      normalizeJid('5511888888888@s.whatsapp.net:42'),
      '5511888888888@s.whatsapp.net'
    );
    assert.strictEqual(
      isMentioningSelf(extractMentionedJids(message), '5511888888888@s.whatsapp.net:1'),
      true
    );
    assert.strictEqual(stripLeadingMentions('@Bot   !status'), '!status');
    assert.deepStrictEqual(parseCommand('!status online', '!'), {
      isCommand: true,
      command: 'status',
      args: ['online'],
      rawArgs: 'online',
    });
  });

  test('message policy blocks untrusted DM but lets owner bypass user allowlist', () => {
    const { shouldProcessMessage } = loadMessageUtilsModule();
    const base = {
      settings: {
        allowedUsers: ['5500000000000'],
        groupOnlyMention: true,
      },
      dmPolicy: 'open',
      groupPolicy: 'disabled',
      remoteJid: '5511999999999@s.whatsapp.net',
      senderJid: '5511999999999@s.whatsapp.net',
      senderPhone: '5511999999999',
      isGroup: false,
      mentionedJids: [],
      botJid: '5511888888888@s.whatsapp.net',
    };

    assert.strictEqual(shouldProcessMessage({ ...base, isOwner: false }), false);
    assert.strictEqual(shouldProcessMessage({ ...base, isOwner: true }), true);
  });

  test('message policy requires group allowlist and bot mention', () => {
    const { shouldProcessMessage } = loadMessageUtilsModule();
    const base = {
      settings: {
        allowedUsers: [],
        allowedGroups: ['120363000000000000@g.us'],
        groupOnlyMention: true,
      },
      dmPolicy: 'open',
      groupPolicy: 'allowlist',
      remoteJid: '120363000000000000@g.us',
      senderJid: '5511999999999@s.whatsapp.net',
      senderPhone: '5511999999999',
      isGroup: true,
      isOwner: false,
      botJid: '5511888888888@s.whatsapp.net',
    };

    assert.strictEqual(
      shouldProcessMessage({
        ...base,
        mentionedJids: [],
      }),
      false
    );
    assert.strictEqual(
      shouldProcessMessage({
        ...base,
        mentionedJids: ['5511888888888@s.whatsapp.net'],
      }),
      true
    );
    assert.strictEqual(
      shouldProcessMessage({
        ...base,
        remoteJid: '120363999999999999@g.us',
        mentionedJids: ['5511888888888@s.whatsapp.net'],
      }),
      false
    );
  });

  test('access failure tracker limits attempts and expires by window', () => {
    const { createAccessFailureTracker } = loadAccessFailuresModule();
    let timestamp = 1000;
    const tracker = createAccessFailureTracker({
      limit: 2,
      windowMs: 500,
      now: () => timestamp,
    });

    assert.strictEqual(tracker.isLimited('owner', '5511'), false);
    tracker.recordFailure('owner', '5511');
    assert.strictEqual(tracker.isLimited('owner', '5511'), false);
    tracker.recordFailure('owner', '5511');
    assert.strictEqual(tracker.isLimited('owner', '5511'), true);
    timestamp = 1600;
    assert.strictEqual(tracker.isLimited('owner', '5511'), false);
  });

  test('owner command with valid token requests owner update and clears attempts', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const cleared = [];
    const deps = createCommandDeps({
      verifyOwnerClaimToken: () => ({ ok: true }),
      clearAccessAttemptFailures: (kind, key) => cleared.push({ kind, key }),
    });

    const handled = await handleAccessCommand(
      {
        command: { isCommand: true, command: 'owner', rawArgs: '123456' },
        prefix: '!',
        remoteJid: '5511999999999@s.whatsapp.net',
        isGroup: false,
        isOwner: false,
        botTag: '[Bot]',
        message: { key: { id: 'msg1' } },
        settings: {},
        senderJid: '5511999999999@s.whatsapp.net',
        senderPhone: '5511999999999',
        pairingId: '5511999999999',
      },
      deps
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(
      deps.updates.map((entry) => entry.action),
      ['set-owner', 'clear-owner-token']
    );
    assert.deepStrictEqual(deps.updates[0].payload, {
      ownerNumber: '5511999999999',
      ownerJid: '5511999999999@s.whatsapp.net',
    });
    assert.deepStrictEqual(cleared, [{ kind: 'owner', key: '5511999999999' }]);
    assert.match(deps.sent[0].content.text, /Owner configurado com sucesso/);
  });

  test('pairing command with valid code allowlists user and clears pairing state', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const clearedPairings = [];
    const clearedAttempts = [];
    const deps = createCommandDeps({
      getPairingEntry: () => ({ code: '654321', expiresAt: Date.now() + 1000 }),
      clearPairingEntry: (id) => clearedPairings.push(id),
      clearAccessAttemptFailures: (kind, key) => clearedAttempts.push({ kind, key }),
    });

    const handled = await handleAccessCommand(
      {
        command: { isCommand: false },
        text: 'pair 654321',
        prefix: '!',
        remoteJid: '5511999999999@s.whatsapp.net',
        isGroup: false,
        isOwner: false,
        botTag: '',
        message: { key: { id: 'msg1' } },
        settings: { allowedUsers: ['5500000000000'] },
        dmPolicy: 'pairing',
        senderJid: '5511999999999@s.whatsapp.net',
        senderPhone: '5511999999999',
        pairingId: '5511999999999',
      },
      deps
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(deps.updates, [
      {
        action: 'allowlist-user',
        payload: { userRef: '5511999999999' },
      },
    ]);
    assert.deepStrictEqual(clearedPairings, ['5511999999999']);
    assert.deepStrictEqual(clearedAttempts, [{ kind: 'pairing', key: '5511999999999' }]);
    assert.match(deps.sent[0].content.text, /Pareamento conclu/);
  });

  test('group authorization command only allows owner with valid group key', async () => {
    const { handleAccessCommand } = loadMessageCommandsModule();
    const deps = createCommandDeps();

    const handled = await handleAccessCommand(
      {
        command: { isCommand: true, command: 'autorizar', rawArgs: 'segredo' },
        prefix: '!',
        remoteJid: '120363000000000000@g.us',
        isGroup: true,
        mentionSelf: true,
        isOwner: true,
        botTag: '[Bot]',
        message: { key: { id: 'msg1' } },
        settings: {},
        groupPolicy: 'allowlist',
        groupAccessKey: 'segredo',
      },
      deps
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(deps.updates, [
      {
        action: 'allowlist-group',
        payload: { groupJid: '120363000000000000@g.us' },
      },
    ]);
    assert.match(deps.sent[0].content.text, /Grupo autorizado/);
  });

  test('memory reset command clears active profile session only', async () => {
    const { handleUtilityCommand } = loadMessageCommandsModule();
    const cleared = [];
    const deps = createCommandDeps({
      clearSessionState: (sessionId) => {
        cleared.push(sessionId);
        return true;
      },
    });

    const handled = await handleUtilityCommand(
      {
        command: { isCommand: true, command: 'limparmemoria', rawArgs: '' },
        remoteJid: 'chat@s.whatsapp.net',
        isOwner: true,
        botTag: '[Bot]',
        message: { key: { id: 'msg1' } },
        sessionId: 'profile:p1|chat:chat@s.whatsapp.net',
      },
      deps
    );

    assert.strictEqual(handled, true);
    assert.deepStrictEqual(cleared, ['profile:p1|chat:chat@s.whatsapp.net']);
    assert.match(deps.sent[0].content.text, /neste perfil/);
  });
}

module.exports = { register };
