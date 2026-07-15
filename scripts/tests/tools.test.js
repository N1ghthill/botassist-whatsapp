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
    loadUpdatesModule,
    loadShellExecutorModule,
    loadFsExecutorModule,
    loadWebExecutorModule,
    loadToolsDiagnosticsModule,
    loadToolsAuditModule,
    loadApprovalFlowModule,
    loadToolHelpersModule,
    loadAppProtocolModule,
    flushMicrotasks,
    withPatchedFetch,
  } = context;

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
      context.audit({
        tool: 'web.open',
        status: 'error',
        preview: 'url=https://example.com?token=secret',
        error: 'apiKey=gsk_1234567890abcdef',
      });
      const auditPath = path.join(dir, 'logs', 'tools_audit.log');
      assert.ok(fs.existsSync(auditPath));
      const content = fs.readFileSync(auditPath, 'utf8');
      assert.ok(content.includes('tool=fs.list'));
      assert.ok(!content.includes('secret'));
      assert.ok(!content.includes('gsk_1234567890abcdef'));
    });
  });

  test('tools audit reader parses, filters and limits recent entries', () => {
    withTempDir((dir) => {
      const { readToolsAuditLog } = loadToolsAuditModule();
      const logsDir = path.join(dir, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(
        path.join(logsDir, 'tools_audit.log'),
        [
          '2026-07-14T10:00:00.000Z | requester=5511 | chat=grupo@g.us | scope=group | role=owner | tool=fs.list | status=ok | detail=path="."',
          '2026-07-14T10:01:00.000Z | requester=5522 | chat=dm@s.whatsapp.net | scope=dm | role=user | tool=web.open | status=error | error=dominio bloqueado',
          '2026-07-14T10:02:00.000Z | requester=5511 | chat=grupo@g.us | scope=group | role=owner | tool=shell.exec | status=pending | detail=node --version',
        ].join('\n'),
        'utf8'
      );

      const result = readToolsAuditLog(dir, {
        filters: { chat: 'grupo', from: '2026-07-14T10:01:30.000Z' },
        limit: 5,
      });

      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.filtered, 1);
      assert.strictEqual(result.entries.length, 1);
      assert.strictEqual(result.entries[0].tool, 'shell.exec');
      assert.strictEqual(result.entries[0].status, 'pending');
      assert.strictEqual(result.entries[0].detail, 'node --version');
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
    const { createApprovalId, createToolApprovalEntry } = loadApprovalFlowModule();
    assert.match(createApprovalId(), /^auth_[a-z0-9]+_[0-9a-f]{12}$/);

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

  test('tool helper creates opaque tool call ids with crypto entropy', () => {
    const { createToolCallId } = loadToolHelpersModule();
    assert.match(createToolCallId(), /^call_[a-z0-9]+_[0-9a-f]{12}$/);
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

  test('tools diagnostics reports actionable safety warnings', () => {
    withTempDir((dir) => {
      const { runToolsDiagnostics } = loadToolsDiagnosticsModule();
      const allowedDir = path.join(dir, 'allowed');
      fs.mkdirSync(allowedDir, { recursive: true });

      const result = runToolsDiagnostics({
        tools: {
          enabled: true,
          requireOwner: false,
          allowInGroups: true,
          allowedPaths: [allowedDir],
          allowedWritePaths: [],
          allowedDomains: [],
          autoAllow: ['fs.write', 'email.read'],
        },
      });

      assert.strictEqual(result.ok, true);
      assert.ok(result.warnings.some((warning) => warning.includes('sem restricao de owner')));
      assert.ok(result.warnings.some((warning) => warning.includes('liberadas em grupos')));
      assert.ok(result.warnings.some((warning) => warning.includes('fs.write')));
      assert.ok(result.warnings.some((warning) => warning.includes('allowedWritePaths')));
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

  test('web open blocks local and private network hosts before fetch', async () => {
    const { toolWebOpen } = loadWebExecutorModule();
    let fetched = false;

    await withPatchedFetch(
      async () => {
        fetched = true;
        throw new Error('fetch should not be called for blocked hosts');
      },
      async () => {
        await assert.rejects(
          () =>
            toolWebOpen({ url: 'http://127.0.0.1/status' }, { tools: { maxOutputChars: 6000 } }),
          /Host bloqueado/
        );
        await assert.rejects(
          () =>
            toolWebOpen(
              { url: 'http://169.254.169.254/latest' },
              { tools: { maxOutputChars: 6000 } }
            ),
          /Host bloqueado/
        );
        await assert.rejects(
          () =>
            toolWebOpen(
              { url: 'http://localhost:3000/admin' },
              { tools: { maxOutputChars: 6000 } }
            ),
          /Host bloqueado/
        );
      }
    );

    assert.strictEqual(fetched, false);
  });

  test('web open blocks redirects to domains outside policy', async () => {
    const { toolWebOpen } = loadWebExecutorModule();

    await withPatchedFetch(
      async (url, options) => {
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
      },
      async () => {
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
      }
    );
  });

  test('web open blocks redirects to local network hosts', async () => {
    const { toolWebOpen } = loadWebExecutorModule();

    await withPatchedFetch(
      async (url, options) => {
        assert.strictEqual(options?.redirect, 'manual');

        if (url === 'https://allowed.example/inicio') {
          return new Response('', {
            status: 302,
            headers: {
              location: 'http://169.254.169.254/latest/meta-data',
            },
          });
        }

        throw new Error(`unexpected fetch url: ${url}`);
      },
      async () => {
        await assert.rejects(
          () =>
            toolWebOpen(
              { url: 'https://allowed.example/inicio' },
              {
                allowedDomains: ['allowed.example'],
                blockedDomains: [],
                tools: { maxOutputChars: 6000 },
              }
            ),
          /Host bloqueado apos redirecionamento/
        );
      }
    );
  });

  test('web open rejects oversized bodies before loading everything into output', async () => {
    const { toolWebOpen } = loadWebExecutorModule();
    const largeBody = 'x'.repeat(200000);

    await withPatchedFetch(
      async () => new Response(largeBody, { status: 200 }),
      async () => {
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
      }
    );
  });
}

module.exports = { register };
