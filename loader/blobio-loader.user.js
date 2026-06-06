// ==UserScript==
// @name         Blobio Web Script Loader
// @namespace    https://github.com/SkyViewBlobio/Blobgame.io-Web-Script
// @version      0.1.0
// @description  Loads the Blobio modular extension bundle from GitHub.
// @match        *://blobgame.io/*
// @match        *://custom.client.blobgame.io/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @downloadURL  https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/loader/blobio-loader.user.js
// @updateURL    https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/loader/blobio-loader.user.js
// ==/UserScript==

(() => {
  'use strict';

  const LOG_PREFIX = '[Blobio]';
  const BUNDLE_URL = 'https://cdn.jsdelivr.net/gh/SkyViewBlobio/Blobgame.io-Web-Script@main/dist/blobio-extension.bundle.js';

  function logError(message, detail) {
    if (detail) {
      console.error(LOG_PREFIX, message, detail);
      return;
    }

    console.error(LOG_PREFIX, message);
  }

  function runBundle(source) {
    try {
      const run = new Function(`${source}\n//# sourceURL=blobio-extension.bundle.js`);
      run();
    } catch (error) {
      logError('Failed to run extension bundle.', error);
    }
  }

  function fetchBundle() {
    if (typeof GM_xmlhttpRequest !== 'function') {
      logError('GM_xmlhttpRequest is unavailable. Check the userscript grants.');
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: BUNDLE_URL,
      timeout: 15000,
      onload(response) {
        if (response.status < 200 || response.status >= 300) {
          logError(`Failed to fetch extension bundle. HTTP ${response.status}.`);
          return;
        }

        if (!response.responseText) {
          logError('Fetched extension bundle was empty.');
          return;
        }

        runBundle(response.responseText);
      },
      onerror(error) {
        logError('Network error while fetching extension bundle.', error);
      },
      ontimeout() {
        logError('Timed out while fetching extension bundle.');
      },
    });
  }

  fetchBundle();
})();
