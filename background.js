const ACTIVE_ICON = {
  16: 'icons/icon-active-16.png',
  48: 'icons/icon-active-48.png',
  128: 'icons/icon-active-128.png'
};

const INACTIVE_ICON = {
  16: 'icons/icon-inactive-16.png',
  48: 'icons/icon-inactive-48.png',
  128: 'icons/icon-inactive-128.png'
};

const DEFAULT_SETTINGS = {
  enabled: true,
  perHost: {}
};

async function ensureDefaults() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await chrome.action.setIcon({ path: ACTIVE_ICON });
    return DEFAULT_SETTINGS;
  }
  await chrome.action.setIcon({ path: (settings.enabled === false ? INACTIVE_ICON : ACTIVE_ICON) });
  return settings;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) => console.error('Failed to initialise settings', error));
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults().catch((error) => console.error('Failed to initialise settings on startup', error));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) {
    return;
  }
  const settings = changes.settings.newValue || DEFAULT_SETTINGS;
  const iconPath = settings.enabled === false ? INACTIVE_ICON : ACTIVE_ICON;
  chrome.action.setIcon({ path: iconPath }).catch((error) => {
    console.error('Failed to update icon', error);
  });
});
