// ==UserScript==
// @name         Blobio Web Script Loader
// @namespace    https://github.com/SkyViewBlobio/Blobgame.io-Web-Script
// @version      0.1.37
// @description  Loads the Blobio modular extension bundle from GitHub.
// @match        *://blobgame.io/*
// @match        *://custom.client.blobgame.io/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/loader/blobio-loader.user.js
// @updateURL    https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/loader/blobio-loader.user.js
// ==/UserScript==

(() => {
  'use strict';

  const LOG_PREFIX = '[Blobio]';
  const VERSION = '0.1.37';
  const CUSTOM_CLIENT_HOST = 'custom.client.blobgame.io';
  const STORAGE_BRIDGE_SOURCE = 'BlobioExtensionStorageBridge';
  const CUSTOM_SKIN_ENABLED_KEY = 'blobio.customSkin.enabled';
  const CUSTOM_SKIN_ACTIVE_KEY = 'blobio.customSkin.activeUrl';
  const CUSTOM_SKIN_SELECTED_KEY = 'blobio.customSkin.selectedUrl';
  const CUSTOM_SKIN_LOCAL_NAME_KEY = 'blobio.customSkin.localName';
  const CUSTOM_SKIN_PREVIOUS_KEY = 'blobio.customSkin.previousSkin';
  const CUSTOM_SKIN_BASE_KEY = 'blobio.customSkin.baseSkin';
  const CUSTOM_SKIN_COOKIE_KEY = 'blobioCustomSkinUrl';
  const DIRECT_IMGUR_IMAGE_MATCH = /^https:\/\/i\.imgur\.com\/[a-z0-9]+\.(?:png|jpe?g|webp)(?:\?.*)?$/i;
  const BUNDLE_URLS = [
    `https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/dist/blobio-extension.bundle.js?v=${VERSION}`,
    `https://cdn.jsdelivr.net/gh/SkyViewBlobio/Blobgame.io-Web-Script@main/dist/blobio-extension.bundle.js?v=${VERSION}`,
  ];

  function logError(message, detail) {
    if (detail) {
      console.error(LOG_PREFIX, message, detail);
      return;
    }

    console.error(LOG_PREFIX, message);
  }

  function getLocalValue(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setLocalValue(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Some browser modes block localStorage.
    }
  }

  function removeLocalValue(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Some browser modes block localStorage.
    }
  }

  function getSharedValue(key) {
    try {
      if (typeof GM_getValue === 'function') {
        const value = GM_getValue(key, undefined);
        if (value !== undefined && value !== null) {
          setLocalValue(key, value);
          return String(value);
        }
      }
    } catch {
      // Fall through to the page-local copy.
    }

    return getLocalValue(key);
  }

  function setSharedValue(key, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, String(value));
      }
    } catch {
      // Keep the local fallback even if GM storage is unavailable.
    }

    setLocalValue(key, value);
  }

  function removeSharedValue(key) {
    try {
      if (typeof GM_deleteValue === 'function') {
        GM_deleteValue(key);
      }
    } catch {
      // Keep the local fallback even if GM storage is unavailable.
    }

    removeLocalValue(key);
  }

  function readCookieValue(name) {
    try {
      const prefix = `${name}=`;
      const row = String(document.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
      return row ? decodeURIComponent(row.slice(prefix.length)) : '';
    } catch {
      return '';
    }
  }

  function isValidImgurSkinUrl(url) {
    return DIRECT_IMGUR_IMAGE_MATCH.test(String(url || '').trim());
  }

  function isCustomSkinStorageKey(key) {
    return String(key || '').startsWith('blobio.customSkin.');
  }

  function installSharedStorageBridge() {
    if (globalThis.__blobioSharedStorageBridgeInstalled) {
      return;
    }

    globalThis.__blobioSharedStorageBridge = {
      getItem(key) {
        return isCustomSkinStorageKey(key) ? getSharedValue(key) : getLocalValue(key);
      },
      setItem(key, value) {
        if (isCustomSkinStorageKey(key)) {
          setSharedValue(key, value);
        } else {
          setLocalValue(key, value);
        }
      },
      removeItem(key) {
        if (isCustomSkinStorageKey(key)) {
          removeSharedValue(key);
        } else {
          removeLocalValue(key);
        }
      },
    };

    window.addEventListener?.('message', (event) => {
      const message = event.data;
      if (!message || message.source !== STORAGE_BRIDGE_SOURCE || !isCustomSkinStorageKey(message.key)) {
        return;
      }

      if (message.type === 'set') {
        setSharedValue(message.key, message.value ?? '');
      } else if (message.type === 'remove') {
        removeSharedValue(message.key);
      }
    });

    globalThis.__blobioSharedStorageBridgeInstalled = true;
  }

  function getOrCreateLocalSkinName() {
    const existing = getSharedValue(CUSTOM_SKIN_LOCAL_NAME_KEY) || '';
    if (/^BlobioCustomSkin_[a-z0-9]{8,}$/i.test(existing)) {
      return existing;
    }

    const random = Math.random().toString(36).slice(2, 12) || Date.now().toString(36);
    const localName = `BlobioCustomSkin_${random}`;
    setSharedValue(CUSTOM_SKIN_LOCAL_NAME_KEY, localName);
    return localName;
  }

  function getCustomSkinState() {
    if (getSharedValue(CUSTOM_SKIN_ENABLED_KEY) !== '1') {
      return null;
    }

    const activeUrl = getSharedValue(CUSTOM_SKIN_ACTIVE_KEY)
      || getSharedValue(CUSTOM_SKIN_SELECTED_KEY)
      || readCookieValue(CUSTOM_SKIN_COOKIE_KEY)
      || '';

    if (!isValidImgurSkinUrl(activeUrl)) {
      return null;
    }

    const state = {
      activeUrl: String(activeUrl).trim(),
      localName: getOrCreateLocalSkinName(),
      debug: getSharedValue('blobio.customSkin.debug') === '1',
    };

    setLocalValue(CUSTOM_SKIN_ENABLED_KEY, '1');
    setLocalValue(CUSTOM_SKIN_ACTIVE_KEY, state.activeUrl);
    setLocalValue(CUSTOM_SKIN_LOCAL_NAME_KEY, state.localName);
    return state;
  }

  function readStoredSkinConfig(key) {
    try {
      const raw = getSharedValue(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.name === 'string') {
        return {
          name: parsed.name,
          type: typeof parsed.type === 'string' && parsed.type ? parsed.type : 'free',
        };
      }
    } catch {
      // Old malformed state is discarded below.
    }

    return null;
  }

  function cleanUpLegacySkinReplacement() {
    if (location.host !== CUSTOM_CLIENT_HOST) {
      return;
    }

    const localName = getSharedValue(CUSTOM_SKIN_LOCAL_NAME_KEY) || '';
    const previous = readStoredSkinConfig(CUSTOM_SKIN_PREVIOUS_KEY);
    const base = readStoredSkinConfig(CUSTOM_SKIN_BASE_KEY);
    const currentSkin = getLocalValue('config-skin') || '';
    const wasLegacyReplacement = (localName && currentSkin === localName) || (base?.name && currentSkin === base.name);

    if (wasLegacyReplacement) {
      if (previous?.name) {
        setLocalValue('config-skin', previous.name);
        setLocalValue('config-skin-type', previous.type);
      } else {
        removeLocalValue('config-skin');
        removeLocalValue('config-skin-type');
      }
    }

    removeSharedValue(CUSTOM_SKIN_PREVIOUS_KEY);
    removeSharedValue(CUSTOM_SKIN_BASE_KEY);
  }

  function pageCustomSkinBootstrap(initialState) {
    'use strict';

    const LOG_PREFIX = '[Blobio]';
    const ENABLED_KEY = 'blobio.customSkin.enabled';
    const ACTIVE_URL_KEY = 'blobio.customSkin.activeUrl';
    const LOCAL_NAME_KEY = 'blobio.customSkin.localName';
    const PATCH_MARKER = '__blobioNativeCustomSkinPatch';
    const IMGUR_MATCH = /^https:\/\/i\.imgur\.com\/[a-z0-9]+\.(?:png|jpe?g|webp)(?:\?.*)?$/i;
    const LOCAL_NAME_MATCH = /^BlobioCustomSkin_[a-z0-9]{8,}$/i;
    const originalSkinNames = new WeakMap();
    const localCells = new Set();

    if (window.__blobioNativeCustomSkinInstalled) {
      window.__blobioNativeCustomSkinRefresh?.(initialState);
      return;
    }

    function getLocalValue(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function getState() {
      const enabled = getLocalValue(ENABLED_KEY);
      const activeUrl = getLocalValue(ACTIVE_URL_KEY) || initialState.activeUrl || '';
      const localName = getLocalValue(LOCAL_NAME_KEY) || initialState.localName || '';

      if ((enabled !== null && enabled !== '1') || !IMGUR_MATCH.test(activeUrl) || !LOCAL_NAME_MATCH.test(localName)) {
        return null;
      }

      return { activeUrl, localName };
    }

    function debug(message, detail) {
      if (!initialState.debug && getLocalValue('blobio.customSkin.debug') !== '1') {
        return;
      }

      console.debug(LOG_PREFIX, message, detail ?? '');
    }

    function restoreCell(cell) {
      if (!cell || !originalSkinNames.has(cell)) {
        return;
      }

      cell.L = originalSkinNames.get(cell);
      originalSkinNames.delete(cell);
      localCells.delete(cell);
    }

    function applyCell(cell, isOwnCell = true) {
      const state = getState();
      if (!state || !cell || isOwnCell !== true) {
        return false;
      }

      if (!originalSkinNames.has(cell)) {
        originalSkinNames.set(cell, cell.L);
      }

      cell.L = state.localName;
      localCells.add(cell);
      return true;
    }

    function observeCell(cell) {
      if (!cell) {
        return;
      }

      const checkOwnership = () => {
        const ownFlag = cell.p === true || cell.isMine === true || cell.own === true || cell.local === true;
        if (ownFlag) {
          applyCell(cell, true);
        }
      };

      if (typeof queueMicrotask === 'function') {
        queueMicrotask(checkOwnership);
      } else {
        Promise.resolve().then(checkOwnership);
      }
    }

    function resolveCustomSkinUrl(rawUrl) {
      const state = getState();
      if (!state || !rawUrl) {
        return rawUrl;
      }

      try {
        const url = new URL(String(rawUrl), location.href);
        const segments = url.pathname.split('/');
        const filename = decodeURIComponent(segments.at(-1) || '');
        const parent = segments.at(-2) || '';
        const skinsDirectory = segments.at(-3) || '';

        if (
          skinsDirectory.toLowerCase() === 'skins'
          && /^(?:free|premium)$/i.test(parent)
          && filename === `${state.localName}.png`
        ) {
          return state.activeUrl;
        }
      } catch {
        // Non-URL values are left unchanged.
      }

      return rawUrl;
    }

    function findPropertyDescriptor(prototype, propertyName) {
      let current = prototype;
      while (current) {
        const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
        if (descriptor) {
          return descriptor;
        }
        current = Object.getPrototypeOf(current);
      }
      return null;
    }

    function patchImageLoading() {
      const imagePrototype = window.HTMLImageElement?.prototype;
      const srcDescriptor = imagePrototype && findPropertyDescriptor(imagePrototype, 'src');

      if (srcDescriptor?.get && srcDescriptor?.set && !imagePrototype.__blobioNativeSkinSrcPatched) {
        Object.defineProperty(imagePrototype, 'src', {
          configurable: true,
          enumerable: srcDescriptor.enumerable,
          get: srcDescriptor.get,
          set(value) {
            const resolved = resolveCustomSkinUrl(value);
            if (resolved !== value) {
              this.crossOrigin = 'anonymous';
            }
            srcDescriptor.set.call(this, resolved);
          },
        });
        imagePrototype.__blobioNativeSkinSrcPatched = true;
      }

      const originalSetAttribute = imagePrototype?.setAttribute;
      if (typeof originalSetAttribute === 'function' && !imagePrototype.__blobioNativeSkinAttributePatched) {
        imagePrototype.setAttribute = function setBlobioNativeSkinAttribute(name, value) {
          if (String(name).toLowerCase() !== 'src') {
            return originalSetAttribute.call(this, name, value);
          }

          const resolved = resolveCustomSkinUrl(value);
          if (resolved !== value) {
            this.crossOrigin = 'anonymous';
          }
          return originalSetAttribute.call(this, name, resolved);
        };
        imagePrototype.__blobioNativeSkinAttributePatched = true;
      }
    }

    function patchNetworkLoading() {
      const xhrPrototype = window.XMLHttpRequest?.prototype;
      if (xhrPrototype && !xhrPrototype.__blobioNativeSkinOpenPatched) {
        const originalOpen = xhrPrototype.open;
        if (typeof originalOpen === 'function') {
          xhrPrototype.open = function openBlobioNativeSkinRequest(method, url, ...rest) {
            return originalOpen.call(this, method, resolveCustomSkinUrl(url), ...rest);
          };
          xhrPrototype.__blobioNativeSkinOpenPatched = true;
        }
      }

      if (typeof window.fetch === 'function' && !window.__blobioNativeSkinFetchPatched) {
        const originalFetch = window.fetch;
        window.fetch = function fetchBlobioNativeSkin(input, init) {
          const originalUrl = typeof input === 'string' || input instanceof String ? String(input) : input?.url;
          const resolvedUrl = resolveCustomSkinUrl(originalUrl);
          return originalFetch.call(this, resolvedUrl && resolvedUrl !== originalUrl ? resolvedUrl : input, init);
        };
        window.__blobioNativeSkinFetchPatched = true;
      }
    }

    function escapeRegExp(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function patchGwtCacheSource(source, sourceUrl = '') {
      const originalSource = String(source || '');
      if (!getState() || originalSource.includes(PATCH_MARKER)) {
        return originalSource;
      }

      const constructorPattern = /function ([$A-Za-z_][0-9A-Za-z_$]*)\(a,b,c,d,e,f,g,h,i,j\)\{var k,l,m,n,o,p;([\s\S]{0,3200}?h!=null&&\(this\.B=h\);this\.L=i;)/;
      const constructorMatch = constructorPattern.exec(originalSource);
      if (!constructorMatch) {
        console.error(LOG_PREFIX, 'Custom Skin could not find the Blobgame cell constructor. The game client may have changed.', sourceUrl);
        return originalSource;
      }

      const constructorName = constructorMatch[1];
      let patched = originalSource.replace(
        constructorPattern,
        'function $1(a,b,c,d,e,f,g,h,i,j){var k,l,m,n,o,p;$2try{$wnd.__blobioCustomSkinObserveCell&&$wnd.__blobioCustomSkinObserveCell(this)}catch(_blobioSkinError){}',
      );

      const escapedConstructorName = escapeRegExp(constructorName);
      const ownFlagPattern = new RegExp(
        `(([$A-Za-z_][0-9A-Za-z_$]*)=new ${escapedConstructorName}\\([^;]{1,500}\\);[\\s\\S]{0,700}?\\2\\.p=([$A-Za-z_][0-9A-Za-z_$]*))`,
      );
      const ownFlagMatch = ownFlagPattern.test(patched);

      if (ownFlagMatch) {
        patched = patched.replace(
          ownFlagPattern,
          '$1;try{$wnd.__blobioCustomSkinApplyCell&&$wnd.__blobioCustomSkinApplyCell($2,$3===true)}catch(_blobioSkinError){}',
        );
      }

      debug('Installed native Custom Skin GWT hook.', {
        sourceUrl,
        constructorName,
        ownFlagMatched: ownFlagMatch,
      });

      return `/*${PATCH_MARKER}*/\n${patched}`;
    }

    function getUrlPath(url) {
      try {
        return new URL(String(url || ''), location.href).pathname;
      } catch {
        return String(url || '');
      }
    }

    function isPatchableGwtScriptUrl(url) {
      const path = getUrlPath(url);
      return (
        /(?:^|\/)html\/[a-f0-9]{32}\.cache\.js$/i.test(path)
        || /(?:^|\/)html-\d+\.js$/i.test(path)
        || /(?:^|\/)html\/html-\d+\.js$/i.test(path)
      );
    }

    function fetchTextSync(url) {
      const xhr = new window.XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
        throw new Error(`HTTP ${xhr.status}`);
      }
      return xhr.responseText || xhr.response || '';
    }

    function copyScriptAttributes(source, target) {
      for (const attribute of source.attributes || []) {
        if (attribute.name !== 'src') {
          target.setAttribute(attribute.name, attribute.value);
        }
      }
      if (source.nonce) {
        target.nonce = source.nonce;
      }
    }

    function dispatchScriptEvent(node, type) {
      try {
        const event = new Event(type);
        node.dispatchEvent?.(event);
        const handler = node[`on${type}`];
        if (typeof handler === 'function') {
          handler.call(node, event);
        }
      } catch {
        // Synthetic callbacks are best effort only.
      }
    }

    function installGwtScriptPatch() {
      const nodePrototype = window.Node?.prototype;
      if (!nodePrototype || nodePrototype.__blobioNativeSkinScriptPatched) {
        return;
      }

      const originalAppendChild = nodePrototype.appendChild;
      const originalInsertBefore = nodePrototype.insertBefore;

      function tryInsertPatchedScript(parent, node, beforeNode) {
        const sourceUrl = node?.src || node?.getAttribute?.('src') || '';
        if (!sourceUrl || node.__blobioNativeSkinPatchedScript || !isPatchableGwtScriptUrl(sourceUrl)) {
          return false;
        }

        try {
          const source = fetchTextSync(sourceUrl);
          const patchedSource = patchGwtCacheSource(source, sourceUrl);
          const replacement = document.createElement('script');
          replacement.__blobioNativeSkinPatchedScript = true;
          copyScriptAttributes(node, replacement);
          replacement.textContent = `${patchedSource}\n//# sourceURL=${sourceUrl}`;

          if (beforeNode && typeof originalInsertBefore === 'function') {
            originalInsertBefore.call(parent, replacement, beforeNode);
          } else {
            originalAppendChild.call(parent, replacement);
          }

          dispatchScriptEvent(node, 'load');
          return true;
        } catch (error) {
          console.error(LOG_PREFIX, 'Custom Skin could not patch the Blobgame client. Loading the original client.', error);
          return false;
        }
      }

      if (typeof originalAppendChild === 'function') {
        nodePrototype.appendChild = function appendBlobioNativeSkinScript(node) {
          return tryInsertPatchedScript(this, node, null) ? node : originalAppendChild.call(this, node);
        };
      }

      if (typeof originalInsertBefore === 'function') {
        nodePrototype.insertBefore = function insertBlobioNativeSkinScript(node, beforeNode) {
          return tryInsertPatchedScript(this, node, beforeNode) ? node : originalInsertBefore.call(this, node, beforeNode);
        };
      }

      nodePrototype.__blobioNativeSkinScriptPatched = true;
    }

    function refresh(nextState = null) {
      if (nextState && typeof nextState === 'object') {
        initialState = { ...initialState, ...nextState };
      }

      const state = getState();
      for (const cell of [...localCells]) {
        if (state) {
          cell.L = state.localName;
        } else {
          restoreCell(cell);
        }
      }
    }

    window.__blobioCustomSkinApplyCell = applyCell;
    window.__blobioCustomSkinObserveCell = observeCell;
    window.__blobioCustomSkinResolveUrl = resolveCustomSkinUrl;
    window.__blobioCustomSkinPatchGwtCacheSource = patchGwtCacheSource;
    window.__blobioNativeCustomSkinRefresh = refresh;
    window.__blobioNativeCustomSkinInstalled = true;

    window.addEventListener?.('blobio-custom-skin-state', (event) => refresh(event.detail));
    window.addEventListener?.('message', (event) => {
      const message = event.data;
      if (message?.source === 'BlobioExtensionStorageBridge' && String(message.key || '').startsWith('blobio.customSkin.')) {
        refresh();
      }
    });

    patchImageLoading();
    patchNetworkLoading();
    installGwtScriptPatch();
    debug('Native Custom Skin runtime installed.', initialState);
  }

  function injectPageCustomSkinBootstrap() {
    if (location.host !== CUSTOM_CLIENT_HOST) {
      return;
    }

    const state = getCustomSkinState();
    if (!state) {
      return;
    }

    try {
      const script = document.createElement('script');
      script.dataset.blobioNativeCustomSkin = 'true';
      script.textContent = `;(${pageCustomSkinBootstrap.toString()})(${JSON.stringify(state)});`;
      (document.documentElement || document.head).appendChild(script);
      script.remove();
    } catch (error) {
      logError('Failed to install the native Custom Skin runtime.', error);
    }
  }

  function runBundle(source) {
    try {
      const run = new Function(`${source}\n//# sourceURL=blobio-extension.bundle.js`);
      run();
    } catch (error) {
      logError('Failed to run extension bundle.', error);
    }
  }

  function fetchBundle(index = 0, failures = []) {
    if (typeof GM_xmlhttpRequest !== 'function') {
      logError('GM_xmlhttpRequest is unavailable. Check the userscript grants.');
      return;
    }

    const url = BUNDLE_URLS[index];
    if (!url) {
      logError('Failed to fetch extension bundle from all configured URLs.', failures);
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url,
      timeout: 15000,
      onload(response) {
        if (response.status < 200 || response.status >= 300 || !response.responseText) {
          fetchBundle(index + 1, failures.concat(`Invalid response from ${url}`));
          return;
        }
        runBundle(response.responseText);
      },
      onerror(error) {
        fetchBundle(index + 1, failures.concat(error || `Network error from ${url}`));
      },
      ontimeout() {
        fetchBundle(index + 1, failures.concat(`Timed out while fetching ${url}`));
      },
    });
  }

  installSharedStorageBridge();
  cleanUpLegacySkinReplacement();
  injectPageCustomSkinBootstrap();
  fetchBundle();
})();
