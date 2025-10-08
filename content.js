(() => {
  'use strict';

  const SHORTS_LINK_RE = /\/shorts(?:\/|$)/i;
  const TEXT_HINTS = [
    'shorts',
    '\u0448\u043e\u0440\u0442',
    '\u0448\u043e\u0440\u0442\u0441',
    '\u0448\u043e\u0440\u0442\u044b',
    '\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0432\u0438\u0434\u0435\u043e',
    '\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0440\u043e\u043b\u0438\u043a\u0438',
    '\u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0432\u0456\u0434\u0435\u043e',
    '\u043a\u043e\u0440\u043e\u0442\u043a\u0435 \u0432\u0456\u0434\u0435\u043e'
  ];
  const HIDDEN_ATTR = 'data-hide-youtube-shorts';

  const SECTION_SELECTORS = [
    'ytd-reel-shelf-renderer',
    'ytd-rich-section-renderer',
    'ytd-rich-shelf-renderer'
  ];

  const CONTAINER_SELECTORS = [
    'ytd-guide-entry-renderer',
    'ytd-mini-guide-entry-renderer',
    'yt-chip-cloud-chip-renderer',
    'ytd-button-renderer',
    'tp-yt-paper-item',
    'ytm-chip-cloud-chip-renderer'
  ];

  const REMOVAL_PRIORITY = [
    'ytd-rich-section-renderer[section-identifier="shorts_shelf"]',
    'ytd-rich-shelf-renderer',
    'ytd-reel-shelf-renderer',
    'ytd-rich-item-renderer',
    'ytd-guide-entry-renderer',
    'ytd-mini-guide-entry-renderer',
    'yt-chip-cloud-chip-renderer',
    'ytd-button-renderer',
    'tp-yt-paper-item',
    'ytm-chip-cloud-chip-renderer'
  ];

  let settings = { enabled: true, perHost: {} };
  let shouldHide = true;

  function safeQueryAll(root, selector) {
    const results = [];
    if (!root) {
      return results;
    }

    if (root instanceof Element) {
      try {
        if (root.matches(selector)) {
          results.push(root);
        }
      } catch (_) {
        // Unsupported selector (e.g., :has) — skip matches on root.
      }
    }

    if (root instanceof Document || root instanceof DocumentFragment || root instanceof Element) {
      try {
        const nodes = root.querySelectorAll(selector);
        for (const node of nodes) {
          results.push(node);
        }
      } catch (_) {
        // Unsupported selector syntax. Ignore.
      }
    }

    return results;
  }

  function hasShortsLink(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      return SHORTS_LINK_RE.test(href);
    }
    const anchors = element.querySelectorAll('a[href]');
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href');
      if (href && SHORTS_LINK_RE.test(href)) {
        return true;
      }
    }
    return false;
  }

  function textSuggestsShorts(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const text = element.textContent;
    if (text) {
      const normalized = text.toLowerCase();
      if (TEXT_HINTS.some((hint) => normalized.includes(hint))) {
        return true;
      }
    }
    if (element.hasAttribute && element.hasAttribute('title')) {
      const title = element.getAttribute('title');
      if (title) {
        const normalizedTitle = title.toLowerCase();
        if (TEXT_HINTS.some((hint) => normalizedTitle.includes(hint))) {
          return true;
        }
      }
    }
    return false;
  }

  function findHideTarget(element) {
    if (!(element instanceof Element)) {
      return null;
    }
    for (const selector of REMOVAL_PRIORITY) {
      try {
        const candidate = element.closest(selector);
        if (candidate) {
          return candidate;
        }
      } catch (_) {
        // Unsupported selector in closest.
      }
    }
    return element;
  }

  function hideElement(element) {
    const target = findHideTarget(element);
    if (!target || target.dataset.hideYoutubeShorts === '1') {
      return;
    }
    target.dataset.hideYoutubeShorts = '1';
    target.setAttribute('aria-hidden', 'true');
    if (target.style) {
      target.style.setProperty('display', 'none', 'important');
    }
  }

  function restoreHiddenElements(root = document) {
    const elements = root.querySelectorAll(`[${HIDDEN_ATTR}="1"]`);
    for (const el of elements) {
      el.removeAttribute(HIDDEN_ATTR);
      delete el.dataset.hideYoutubeShorts;
      if (el.getAttribute('aria-hidden') === 'true') {
        el.removeAttribute('aria-hidden');
      }
      if (el.style) {
        el.style.removeProperty('display');
        if (!el.getAttribute('style')) {
          el.removeAttribute('style');
        }
      }
    }
  }

  function containsShortsComponents(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (hasShortsLink(element)) {
      return true;
    }
    if (element.querySelector('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytd-reel-video-renderer')) {
      return true;
    }
    const titleCandidate = element.querySelector('#title, #title-text, h2, yt-formatted-string.title, yt-formatted-string#title, yt-formatted-string[title]');
    if (titleCandidate && textSuggestsShorts(titleCandidate)) {
      return true;
    }
    return textSuggestsShorts(element);
  }

  function isShortsShelf(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.matches && element.matches('ytd-reel-shelf-renderer')) {
      return true;
    }
    if (element.matches && element.matches('ytd-rich-section-renderer') && element.getAttribute('section-identifier') === 'shorts_shelf') {
      return true;
    }
    if (element.matches && element.matches('ytd-rich-section-renderer, ytd-rich-shelf-renderer')) {
      return containsShortsComponents(element);
    }
    return false;
  }

  function processShortsShelves(root) {
    for (const selector of SECTION_SELECTORS) {
      for (const element of safeQueryAll(root, selector)) {
        if (isShortsShelf(element)) {
          hideElement(element);
        }
      }
    }
    for (const item of safeQueryAll(root, 'ytd-rich-item-renderer')) {
      if (item.querySelector('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2')) {
        hideElement(item);
      }
    }
  }

  function processContainers(root) {
    for (const selector of CONTAINER_SELECTORS) {
      for (const element of safeQueryAll(root, selector)) {
        if (hasShortsLink(element) || textSuggestsShorts(element)) {
          hideElement(element);
        }
      }
    }
  }

  function removeLooseAnchors(root) {
    for (const anchor of safeQueryAll(root, 'a[href]')) {
      const href = anchor.getAttribute('href');
      if (!href || !SHORTS_LINK_RE.test(href)) {
        continue;
      }
      const container = anchor.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, yt-chip-cloud-chip-renderer, ytd-button-renderer, tp-yt-paper-item, ytm-chip-cloud-chip-renderer, ytd-rich-shelf-renderer, ytd-rich-item-renderer');
      if (container) {
        hideElement(container);
      } else {
        hideElement(anchor);
      }
    }
  }

  function kill(root = document) {
    if (!shouldHide || !root) {
      return;
    }
    processShortsShelves(root);
    processContainers(root);
    removeLooseAnchors(root);
  }

  function handleMutations(mutations) {
    if (!shouldHide) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          kill(node);
        }
      }
    }
  }

  const observer = new MutationObserver(handleMutations);

  function computeShouldHide() {
    if (settings.enabled === false) {
      return false;
    }
    const host = location.hostname;
    const map = settings.perHost || {};
    if (Object.prototype.hasOwnProperty.call(map, host)) {
      return map[host];
    }
    if (host.startsWith('www.') && Object.prototype.hasOwnProperty.call(map, host.slice(4))) {
      return map[host.slice(4)];
    }
    return true;
  }

  function applyDocumentFlag(active) {
    if (active) {
      document.documentElement.removeAttribute('data-hide-youtube-shorts');
    } else {
      document.documentElement.setAttribute('data-hide-youtube-shorts', 'off');
    }
  }

  function updateShouldHide() {
    const next = computeShouldHide();
    if (next === shouldHide) {
      applyDocumentFlag(next);
      return;
    }
    shouldHide = next;
    applyDocumentFlag(shouldHide);
    if (shouldHide) {
      kill(document);
    } else {
      restoreHiddenElements(document);
    }
  }

  function startObserver() {
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      document.addEventListener(
        'readystatechange',
        function onReady() {
          if (document.documentElement) {
            document.removeEventListener('readystatechange', onReady);
            observer.observe(document.documentElement, { childList: true, subtree: true });
          }
        },
        { once: true }
      );
    }
  }

  function loadSettings() {
    chrome.storage.local.get('settings', (result) => {
      if (chrome.runtime.lastError) {
        console.error('Hide YouTube Shorts: settings read failed', chrome.runtime.lastError);
        return;
      }
      if (result && result.settings) {
        const raw = result.settings;
        settings = {
          enabled: raw.enabled !== false,
          perHost: { ...(raw.perHost || {}) }
        };
      }
      updateShouldHide();
      if (shouldHide) {
        kill(document);
      }
    });
  }

  function handleStorageChange(changes, area) {
    if (area !== 'local' || !changes.settings) {
      return;
    }
    const raw = changes.settings.newValue;
    settings = {
      enabled: raw?.enabled !== false,
      perHost: { ...(raw?.perHost || {}) }
    };
    updateShouldHide();
  }

  function handleRuntimeMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }
    if (message.type === 'force-kill') {
      if (shouldHide) {
        kill(document);
      }
    }
  }

  kill(document);
  startObserver();
  loadSettings();

  const SOFT_NAV_EVENTS = ['yt-page-data-updated', 'yt-navigate-finish', 'yt-navigate-start'];
  for (const name of SOFT_NAV_EVENTS) {
    document.addEventListener(name, () => kill(document), { passive: true });
  }
  window.addEventListener('popstate', () => kill(document), { passive: true });

  chrome.storage.onChanged.addListener(handleStorageChange);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
})();
