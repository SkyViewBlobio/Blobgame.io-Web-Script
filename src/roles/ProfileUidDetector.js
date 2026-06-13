import { createBlobioStorage } from '../storage/BlobioStorage.js';
import { normalizeUid, ROLE_STORAGE_KEYS } from './RoleRegistry.js';

const PROFILE_UID_SELECTOR = '#profile-modal .profile-records-title-userid';

export function parseProfileUid(value) {
  const match = String(value ?? '').match(/\bID\s*:\s*([\d\s]+)/i);
  return normalizeUid(match?.[1] || '');
}

export class ProfileUidDetector {
  constructor({
    document = globalThis.document,
    storage = createBlobioStorage(document),
    logger = console,
  } = {}) {
    this.document = document;
    this.storage = storage;
    this.logger = logger;
    this.uid = normalizeUid(storage.getItem(ROLE_STORAGE_KEYS.ownUid));
    this.listeners = new Set();
    this.observer = null;
    this.clickHandler = null;
    this.started = false;
  }

  start() {
    if (this.started) {
      return true;
    }

    this.started = true;
    this.captureFromProfile();
    this.observeProfile();
    this.installSignOutHandler();
    return true;
  }

  getUid() {
    return this.uid;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);
    listener(this.uid);
    return () => this.listeners.delete(listener);
  }

  captureFromProfile(root = this.document) {
    const isUidNode = root?.classList?.contains?.('profile-records-title-userid')
      && root?.parentElement?.parentElement?.id === 'profile-modal';
    const node = isUidNode
      ? root
      : root?.querySelector?.(PROFILE_UID_SELECTOR) || this.document.querySelector?.(PROFILE_UID_SELECTOR);
    const uid = parseProfileUid(node?.textContent);
    if (!uid || uid === this.uid) {
      return false;
    }

    this.uid = uid;
    this.storage.setItem(ROLE_STORAGE_KEYS.ownUid, uid);
    this.notify();
    return true;
  }

  observeProfile() {
    const MutationObserver = this.document.defaultView?.MutationObserver || globalThis.MutationObserver;
    const root = this.document.documentElement;
    if (!MutationObserver || !root) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (this.captureFromProfile(node)) {
            return;
          }
        }
      }

      this.captureFromProfile();
    });
    this.observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  installSignOutHandler() {
    this.clickHandler = (event) => {
      const target = event.target;
      if (!target?.classList?.contains?.('sign-out-link')) {
        return;
      }

      this.uid = '';
      this.storage.removeItem(ROLE_STORAGE_KEYS.ownUid);
      this.notify();
    };

    this.document.addEventListener?.('click', this.clickHandler);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.uid);
      } catch (error) {
        this.logger.warn?.('[Blobio] UID listener failed.', error);
      }
    }
  }

  destroy() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.clickHandler) {
      this.document.removeEventListener?.('click', this.clickHandler);
      this.clickHandler = null;
    }
    this.listeners.clear();
    this.started = false;
  }
}
