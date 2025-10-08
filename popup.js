const DEFAULT_SETTINGS = {
  enabled: true,
  perHost: {}
};

const SUPPORTED_HOSTS = new Set(['www.youtube.com', 'm.youtube.com', 'youtube.com']);

const globalToggle = document.getElementById('globalToggle');
const siteToggle = document.getElementById('siteToggle');
const siteSection = document.getElementById('siteSection');
const siteLabel = document.getElementById('siteLabel');
const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const forceScanBtn = document.getElementById('forceScan');

let currentSettings = { ...DEFAULT_SETTINGS };
let currentHost = null;
let activeTabId = null;
let suppressEvents = false;

function mergeSettings(raw) {
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    enabled: raw.enabled !== false,
    perHost: { ...DEFAULT_SETTINGS.perHost, ...(raw.perHost || {}) }
  };
}

function computeHostPreference(settings, host) {
  if (!host) {
    return true;
  }
  const map = settings.perHost || {};
  if (Object.prototype.hasOwnProperty.call(map, host)) {
    return map[host];
  }
  if (host.startsWith('www.') && Object.prototype.hasOwnProperty.call(map, host.slice(4))) {
    return map[host.slice(4)];
  }
  return true;
}

function updateStatusText() {
  const globalOn = currentSettings.enabled;
  const hostOn = computeHostPreference(currentSettings, currentHost);
  if (!globalOn) {
    statusEl.textContent = 'Shorts отображаются (расширение выключено)';
  } else if (!hostOn) {
    statusEl.textContent = `Shorts отображаются для ${currentHost}`;
  } else {
    statusEl.textContent = 'Shorts скрываются';
  }
}

function renderUI() {
  suppressEvents = true;
  const globalOn = currentSettings.enabled;
  globalToggle.checked = globalOn;
  globalToggle.setAttribute('aria-checked', String(globalOn));

  const supportedHost = currentHost && SUPPORTED_HOSTS.has(currentHost);
  if (supportedHost) {
    siteSection.hidden = false;
    const hostPref = computeHostPreference(currentSettings, currentHost);
    siteToggle.checked = globalOn && hostPref;
    siteToggle.disabled = !globalOn;
    siteToggle.setAttribute('aria-checked', String(siteToggle.checked));
    siteLabel.textContent = currentHost;
    hintEl.hidden = true;
  } else {
    siteSection.hidden = true;
    hintEl.hidden = false;
    hintEl.textContent = 'Откройте вкладку с youtube.com, чтобы управлять настройками сайта.';
  }

  forceScanBtn.hidden = !(globalOn && supportedHost);
  updateStatusText();
  suppressEvents = false;
}

async function loadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return null;
  }
  activeTabId = tab.id;
  let host = null;
  try {
    const url = new URL(tab.url || '');
    host = url.hostname;
  } catch (error) {
    host = null;
  }
  currentHost = host;
  return tab;
}

async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  currentSettings = mergeSettings(settings);
}

async function init() {
  await Promise.all([loadActiveTab(), loadSettings()]);
  renderUI();
}

async function persistSettings() {
  await chrome.storage.local.set({ settings: currentSettings });
}

globalToggle.addEventListener('change', async (event) => {
  if (suppressEvents) {
    return;
  }
  currentSettings.enabled = event.target.checked;
  await persistSettings();
  renderUI();
});

siteToggle.addEventListener('change', async (event) => {
  if (suppressEvents || !currentHost) {
    return;
  }
  const checked = event.target.checked;
  currentSettings.perHost = currentSettings.perHost || {};
  currentSettings.perHost[currentHost] = checked;
  await persistSettings();
  renderUI();
});

forceScanBtn.addEventListener('click', async () => {
  if (activeTabId == null) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(activeTabId, { type: 'force-kill' });
    statusEl.textContent = 'Повторная очистка запрошена';
  } catch (error) {
    statusEl.textContent = 'Не удалось связаться со страницей';
    console.error('Failed to ping content script', error);
  }
});

init().catch((error) => {
  console.error('Popup initialisation failed', error);
  statusEl.textContent = 'Не удалось загрузить настройки';
});
