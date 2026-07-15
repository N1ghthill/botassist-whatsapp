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
    loadSharedLoggingModule,
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
    loadApprovalFlowModule,
    loadToolHelpersModule,
    loadAppProtocolModule,
    flushMicrotasks,
    withPatchedFetch,
  } = context;

  test('shared logging redacts common secrets and normalizes levels', () => {
    const { createStructuredLog, normalizeLogLevel, sanitizeLogText } = loadSharedLoggingModule();
    const text = sanitizeLogText(
      'apiKey=gsk_1234567890abcdef imapPassword="mail-secret" !owner 123456 Bearer abc.def.ghi'
    );

    assert.ok(!text.includes('gsk_1234567890abcdef'));
    assert.ok(!text.includes('mail-secret'));
    assert.ok(!text.includes('123456'));
    assert.ok(!text.includes('abc.def.ghi'));
    assert.strictEqual(normalizeLogLevel('warn'), 'warning');
    assert.deepStrictEqual(createStructuredLog('senha=abc', 'warn'), {
      level: 'warning',
      message: 'senha=[REDACTED]',
    });
  });

  test('repository keeps a single pull request template path', () => {
    const githubDir = path.join(process.cwd(), '.github');
    const entries = fs.readdirSync(githubDir);
    const prTemplates = entries.filter(
      (entry) => entry.toLowerCase() === 'pull_request_template.md'
    );

    assert.deepStrictEqual(prTemplates, ['PULL_REQUEST_TEMPLATE.md']);
  });

  test('security audit gate accepts a clean audit report', () => {
    const { validateAudit } = loadSecurityAuditModule();
    const summary = validateAudit({
      vulnerabilities: {},
      metadata: {
        vulnerabilities: {
          total: 0,
        },
      },
    });

    assert.deepStrictEqual(summary, { total: 0 });
  });

  test('security audit gate fails when any vulnerability appears', () => {
    const { validateAudit } = loadSecurityAuditModule();

    assert.throws(() => {
      validateAudit({
        vulnerabilities: {
          'example-package': {
            name: 'example-package',
            severity: 'moderate',
            via: ['GHSA-example'],
          },
        },
        metadata: {
          vulnerabilities: {
            moderate: 1,
            total: 1,
          },
        },
      });
    }, /example-package/);
  });
}

module.exports = { register };
