const IPC_INVOKE = Object.freeze({
  START_BOT: 'start-bot',
  STOP_BOT: 'stop-bot',
  RESTART_BOT: 'restart-bot',
  GET_BOT_STATUS: 'get-bot-status',
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  GENERATE_OWNER_TOKEN: 'generate-owner-token',
  CLEAR_OWNER_TOKEN: 'clear-owner-token',
  EXPORT_PROFILES: 'export-profiles',
  IMPORT_PROFILES: 'import-profiles',
  GET_USERDATA_STATS: 'get-userdata-stats',
  BACKUP_USERDATA: 'backup-userdata',
  RESET_SESSION: 'reset-session',
  CLEAR_HISTORY: 'clear-history',
  OPEN_USERDATA_DIR: 'open-userdata-dir',
  GET_APP_VERSION: 'get-app-version',
  GET_UPDATE_STATE: 'get-update-state',
  CHECK_FOR_UPDATES: 'check-for-updates',
  QR_TO_DATA_URL: 'qr-to-data-url',
  TEST_TOOLS: 'test-tools',
  QUIT_AND_INSTALL_UPDATE: 'quit-and-install-update',
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window-toggle-maximize',
  WINDOW_CLOSE: 'window-close',
  WINDOW_IS_MAXIMIZED: 'window-is-maximized',
  APP_QUIT: 'app-quit',
});

const IPC_EVENTS = Object.freeze({
  BOT_LOG: 'bot-log',
  QR_CODE: 'qr-code',
  BOT_STATUS: 'bot-status',
  BOT_ERROR: 'bot-error',
  BOT_EXIT: 'bot-exit',
  OPEN_SETTINGS: 'open-settings',
  OPEN_PRIVACY: 'open-privacy',
  UPDATE_EVENT: 'update-event',
  SETTINGS_UPDATED: 'settings-updated',
  WINDOW_STATE: 'window-state',
  PRELOAD_READY: 'preload-ready',
  PRELOAD_ERROR: 'preload-error',
});

const BOT_EVENTS = Object.freeze({
  QR: 'qr',
  STATUS: 'status',
  LOG: 'log',
  ERROR: 'error',
  SETTINGS_UPDATE: 'settings-update',
});

const SETTINGS_UPDATE_ACTIONS = Object.freeze({
  ALLOWLIST_GROUP: 'allowlist-group',
  ALLOWLIST_USER: 'allowlist-user',
  SET_OWNER: 'set-owner',
  CLEAR_OWNER_TOKEN: 'clear-owner-token',
});

module.exports = {
  BOT_EVENTS,
  IPC_EVENTS,
  IPC_INVOKE,
  SETTINGS_UPDATE_ACTIONS,
};
