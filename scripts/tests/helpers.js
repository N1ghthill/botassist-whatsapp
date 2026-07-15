const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

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
        getPath: () => userDataDir,
      },
    },
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

function loadSharedLoggingModule() {
  const modulePath = path.join(process.cwd(), 'src', 'shared', 'logging.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadRuntimeSettingsModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'runtimeSettings.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadProviderModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'provider.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadMessageCommandsModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'messageCommands.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadAccessFailuresModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'accessFailures.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadMessageUtilsModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'messageUtils.js');
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

function loadReleaseManifestModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'render-release-manifest.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadPackagedSmokeModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'smoke-packaged.js');
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

function loadSecurityAuditModule() {
  const modulePath = path.join(process.cwd(), 'scripts', 'check-security-audit.js');
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

function loadUserDataModule(userDataDir, dialogMock = {}) {
  const electronPath = require.resolve('electron');
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: {
        getPath: () => userDataDir,
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true }),
        showMessageBox: async () => ({ response: 0 }),
        ...dialogMock,
      },
    },
  };

  const settingsPath = path.join(process.cwd(), 'src', 'main', 'settings.js');
  const modulePath = path.join(process.cwd(), 'src', 'main', 'userData.js');
  delete require.cache[require.resolve(settingsPath)];
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
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
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'executors', 'shell.js');
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

function loadToolsAuditModule() {
  const modulePath = path.join(process.cwd(), 'src', 'main', 'toolsAudit.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadApprovalFlowModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'approvalFlow.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadToolHelpersModule() {
  const modulePath = path.join(process.cwd(), 'src', 'core', 'tooling', 'helpers.js');
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

module.exports = {
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
  loadProviderModule,
  loadMessageCommandsModule,
  loadAccessFailuresModule,
  loadMessageUtilsModule,
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
  loadToolsAuditModule,
  loadApprovalFlowModule,
  loadToolHelpersModule,
  loadAppProtocolModule,
  flushMicrotasks,
  withPatchedFetch,
};
