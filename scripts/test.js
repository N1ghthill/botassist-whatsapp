#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botassist-test-'));
  try {
    return fn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
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

if (failed > 0) {
  process.exitCode = 1;
}
