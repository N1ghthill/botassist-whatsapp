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
    loadApprovalFlowModule,
    loadToolHelpersModule,
    loadAppProtocolModule,
    flushMicrotasks,
    withPatchedFetch,
  } = context;

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

  test('updates smoke mode supports install request even when app is not packaged', async () => {
    const updates = loadUpdatesModule({
      isPackaged: false,
      env: { BOTASSIST_SMOKE_MOCK_UPDATES: '1' },
    });

    await updates.checkForUpdates();
    updates.quitAndInstallUpdate();

    assert.strictEqual(updates.getUpdateState().status, 'install-requested');
  });

  test('packaged smoke resolves Windows unpacked binary from the default dist path', () => {
    withTempDir((dir) => {
      const binaryPath = path.join(dir, 'dist', 'win-unpacked', 'BotAssist WhatsApp.exe');
      fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
      fs.writeFileSync(binaryPath, '');

      const { resolvePackagedBinary } = loadPackagedSmokeModule();
      assert.strictEqual(
        resolvePackagedBinary({ platform: 'win32', cwd: dir, env: {} }),
        binaryPath
      );
    });
  });

  test('packaged smoke resolves macOS app bundle from mac-arm64 output', () => {
    withTempDir((dir) => {
      const binaryPath = path.join(
        dir,
        'dist',
        'mac-arm64',
        'BotAssist WhatsApp.app',
        'Contents',
        'MacOS',
        'BotAssist WhatsApp'
      );
      fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
      fs.writeFileSync(binaryPath, '');

      const { resolvePackagedBinary } = loadPackagedSmokeModule();
      assert.strictEqual(
        resolvePackagedBinary({ platform: 'darwin', cwd: dir, env: {} }),
        binaryPath
      );
    });
  });

  test('packaged smoke honors an explicit binary override path', () => {
    withTempDir((dir) => {
      const binaryPath = path.join(dir, 'custom', 'BotAssist WhatsApp');
      fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
      fs.writeFileSync(binaryPath, '');

      const { resolvePackagedBinary } = loadPackagedSmokeModule();
      assert.strictEqual(
        resolvePackagedBinary({
          platform: 'linux',
          cwd: dir,
          env: { BOTASSIST_SMOKE_BINARY_PATH: binaryPath },
        }),
        binaryPath
      );
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

  test('release manifest picks direct downloads from published assets', () => {
    const { pickPrimaryDownloads } = loadReleaseManifestModule();
    const downloads = pickPrimaryDownloads([
      { name: 'BotAssist-WhatsApp-4.2.4-arm64.dmg', url: 'https://example.com/app.dmg' },
      { name: 'BotAssist-WhatsApp-Setup-4.2.4.exe', url: 'https://example.com/setup.exe' },
      { name: 'BotAssist-WhatsApp-4.2.4.exe', url: 'https://example.com/portable.exe' },
      { name: 'BotAssist-WhatsApp-4.2.4.AppImage', url: 'https://example.com/appimage' },
      { name: 'botassist-whatsapp_4.2.4_amd64.deb', url: 'https://example.com/deb' },
      { name: 'botassist-whatsapp-4.2.4.x86_64.rpm', url: 'https://example.com/rpm' },
      { name: 'latest.yml', url: 'https://example.com/latest.yml' },
    ]);

    assert.deepStrictEqual(downloads, {
      windows: {
        url: 'https://example.com/setup.exe',
        path: 'BotAssist-WhatsApp-Setup-4.2.4.exe',
        asset: 'BotAssist-WhatsApp-Setup-4.2.4.exe',
      },
      mac: {
        url: 'https://example.com/app.dmg',
        path: 'BotAssist-WhatsApp-4.2.4-arm64.dmg',
        asset: 'BotAssist-WhatsApp-4.2.4-arm64.dmg',
      },
      linux: {
        url: 'https://example.com/appimage',
        path: 'BotAssist-WhatsApp-4.2.4.AppImage',
        asset: 'BotAssist-WhatsApp-4.2.4.AppImage',
        alternatives: [
          {
            url: 'https://example.com/deb',
            path: 'botassist-whatsapp_4.2.4_amd64.deb',
            asset: 'botassist-whatsapp_4.2.4_amd64.deb',
          },
          {
            url: 'https://example.com/rpm',
            path: 'botassist-whatsapp-4.2.4.x86_64.rpm',
            asset: 'botassist-whatsapp-4.2.4.x86_64.rpm',
          },
        ],
      },
    });
  });

  test('release manifest renders stable metadata from notes with fallback badge', () => {
    const { renderManifest } = loadReleaseManifestModule();
    const manifest = renderManifest({
      repo: 'N1ghthill/botassist-whatsapp',
      tag: 'v4.2.4',
      includeAssets: false,
    });

    assert.strictEqual(manifest.version, '4.2.4');
    assert.strictEqual(manifest.channel, 'latest');
    assert.strictEqual(manifest.isPrerelease, false);
    assert.strictEqual(manifest.badge, 'Release estavel');
    assert.strictEqual(
      manifest.title,
      'Saneamento de dependencias e fechamento do patch de release'
    );
    assert.ok(Array.isArray(manifest.cards));
    assert.ok(manifest.cards.length >= 1);
    assert.deepStrictEqual(manifest.requirements, {
      windows: 'Windows 10/11 64-bit',
      mac: 'macOS 12+ (Monterey)',
      linux: 'Linux x64 moderno',
    });
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

  test('release verifier validates manifest version and referenced downloads', () => {
    const { verifyManifestDownloads, verifyManifestVersion } = loadReleaseVerifyModule();
    const assetMap = new Map([
      ['BotAssist-WhatsApp-Setup-4.2.4.exe', { name: 'BotAssist-WhatsApp-Setup-4.2.4.exe' }],
      ['BotAssist-WhatsApp-4.2.4-arm64.dmg', { name: 'BotAssist-WhatsApp-4.2.4-arm64.dmg' }],
      ['BotAssist-WhatsApp-4.2.4.AppImage', { name: 'BotAssist-WhatsApp-4.2.4.AppImage' }],
      ['botassist-whatsapp_4.2.4_amd64.deb', { name: 'botassist-whatsapp_4.2.4_amd64.deb' }],
    ]);
    const manifest = {
      version: '4.2.4',
      downloads: {
        windows: {
          url: 'https://example.com/BotAssist-WhatsApp-Setup-4.2.4.exe',
          path: 'BotAssist-WhatsApp-Setup-4.2.4.exe',
        },
        mac: {
          url: 'https://example.com/BotAssist-WhatsApp-4.2.4-arm64.dmg',
          path: 'BotAssist-WhatsApp-4.2.4-arm64.dmg',
        },
        linux: {
          url: 'https://example.com/BotAssist-WhatsApp-4.2.4.AppImage',
          path: 'BotAssist-WhatsApp-4.2.4.AppImage',
          alternatives: [
            {
              url: 'https://example.com/botassist-whatsapp_4.2.4_amd64.deb',
              path: 'botassist-whatsapp_4.2.4_amd64.deb',
            },
          ],
        },
      },
    };

    verifyManifestVersion(manifest, 'v4.2.4');
    verifyManifestDownloads(manifest, assetMap);
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

  test('signing readiness accepts legacy WINDOWS_* aliases', () => {
    const { buildGithubEnvEntries, resolveSigningReadiness } = loadSigningReadinessModule();
    const env = {
      WINDOWS_CSC_LINK: 'base64-win-cert',
      WINDOWS_CSC_KEY_PASSWORD: 'win-password',
    };
    const readiness = resolveSigningReadiness(env);

    assert.strictEqual(readiness.windows.ready, true);
    assert.strictEqual(readiness.windows.linkKey, 'WINDOWS_CSC_LINK');
    assert.deepStrictEqual(buildGithubEnvEntries('Windows', readiness, env), [
      ['CSC_LINK', 'base64-win-cert'],
      ['CSC_KEY_PASSWORD', 'win-password'],
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
}

module.exports = { register };
