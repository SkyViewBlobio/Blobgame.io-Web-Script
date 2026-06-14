import { normalizeUid } from '../roles/RoleRegistry.js';
import { createBlobioStorage } from '../storage/BlobioStorage.js';

export const FRIEND_HIGHLIGHT_ENABLED_KEY = 'blobio.settings.friendHighlight';
export const FRIEND_UIDS_KEY = 'blobio.settings.friendUids';

const STORAGE_BRIDGE_SOURCE = 'BlobioExtensionStorageBridge';

function normalizeUidList(values) {
  const uids = new Set();

  for (const value of values || []) {
    const uid = normalizeUid(value);
    if (uid) {
      uids.add(uid);
    }
  }

  return [...uids].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function parseUidList(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? normalizeUidList(parsed) : [];
  } catch {
    return [];
  }
}

function sameUidList(left, right) {
  return left.length === right.length && left.every((uid, index) => uid === right[index]);
}

export class FriendHighlightStore {
  constructor({
    document = globalThis.document,
    storage = createBlobioStorage(document),
    logger = console,
  } = {}) {
    this.document = document;
    this.storage = storage;
    this.logger = logger;
    this.enabled = false;
    this.uids = [];
    this.uidSet = new Set();
    this.listeners = new Set();
    this.gmListenerIds = [];
    this.storageHandler = null;
    this.messageHandler = null;
    this.started = false;
  }

  start() {
    if (this.started) {
      return true;
    }

    this.started = true;
    this.reload(false);
    this.installExternalListeners();
    return true;
  }

  installExternalListeners() {
    const win = this.document?.defaultView || globalThis;

    this.storageHandler = (event) => {
      if ([FRIEND_HIGHLIGHT_ENABLED_KEY, FRIEND_UIDS_KEY].includes(event?.key)) {
        this.reload();
      }
    };
    win.addEventListener?.('storage', this.storageHandler);

    this.messageHandler = (event) => {
      const message = event?.data;
      if (
        message?.source === STORAGE_BRIDGE_SOURCE
        && [FRIEND_HIGHLIGHT_ENABLED_KEY, FRIEND_UIDS_KEY].includes(message.key)
      ) {
        this.reload();
      }
    };
    win.addEventListener?.('message', this.messageHandler);

    const addValueListener = win.GM_addValueChangeListener || globalThis.GM_addValueChangeListener;
    if (typeof addValueListener !== 'function') {
      return;
    }

    for (const key of [FRIEND_HIGHLIGHT_ENABLED_KEY, FRIEND_UIDS_KEY]) {
      try {
        const listenerId = addValueListener(key, () => this.reload());
        if (listenerId !== undefined && listenerId !== null) {
          this.gmListenerIds.push(listenerId);
        }
      } catch (error) {
        this.logger.warn?.(`[Blobio] Could not watch ${key}.`, error);
      }
    }
  }

  reload(notify = true) {
    const enabled = this.readEnabled();
    const uids = this.readUids();
    const changed = enabled !== this.enabled || !sameUidList(uids, this.uids);

    this.enabled = enabled;
    this.uids = uids;
    this.uidSet = new Set(uids);

    if (changed && notify) {
      this.notify('storage');
    }

    return changed;
  }

  readEnabled() {
    try {
      return this.storage?.getItem?.(FRIEND_HIGHLIGHT_ENABLED_KEY) === '1';
    } catch {
      return false;
    }
  }

  readUids() {
    try {
      return parseUidList(this.storage?.getItem?.(FRIEND_UIDS_KEY));
    } catch {
      return [];
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === this.enabled) {
      return this.enabled;
    }

    try {
      this.storage?.setItem?.(FRIEND_HIGHLIGHT_ENABLED_KEY, nextEnabled ? '1' : '0');
      this.enabled = nextEnabled;
      this.notify('setting');
    } catch (error) {
      this.logger.warn?.('[Blobio] Could not save Friends-highlight setting.', error);
      this.reload(false);
    }

    return this.enabled;
  }

  getUids() {
    return [...this.uids];
  }

  has(rawUid) {
    const uid = normalizeUid(rawUid);
    return Boolean(uid && this.uidSet.has(uid));
  }

  replaceUids(values) {
    const nextUids = normalizeUidList(values);
    if (sameUidList(nextUids, this.uids)) {
      return false;
    }

    this.persistUids(nextUids, 'friends');
    return true;
  }

  addUid(rawUid) {
    const uid = normalizeUid(rawUid);
    if (!uid || this.uidSet.has(uid)) {
      return false;
    }

    this.persistUids([...this.uids, uid], 'friend-added');
    return true;
  }

  removeUid(rawUid) {
    const uid = normalizeUid(rawUid);
    if (!uid || !this.uidSet.has(uid)) {
      return false;
    }

    this.persistUids(this.uids.filter((currentUid) => currentUid !== uid), 'friend-removed');
    return true;
  }

  persistUids(values, source) {
    const nextUids = normalizeUidList(values);

    try {
      this.storage?.setItem?.(FRIEND_UIDS_KEY, JSON.stringify(nextUids));
      this.uids = nextUids;
      this.uidSet = new Set(nextUids);
      this.notify(source);
    } catch (error) {
      this.logger.warn?.('[Blobio] Could not save the accepted friend UID list.', error);
      this.reload(false);
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);
    listener(this.getSnapshot(), 'current');
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return {
      enabled: this.enabled,
      uids: this.getUids(),
    };
  }

  notify(source) {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot, source);
      } catch (error) {
        this.logger.warn?.('[Blobio] Friends-highlight listener failed.', error);
      }
    }
  }

  destroy() {
    const win = this.document?.defaultView || globalThis;
    if (this.storageHandler) {
      win.removeEventListener?.('storage', this.storageHandler);
      this.storageHandler = null;
    }
    if (this.messageHandler) {
      win.removeEventListener?.('message', this.messageHandler);
      this.messageHandler = null;
    }

    const removeValueListener = win.GM_removeValueChangeListener || globalThis.GM_removeValueChangeListener;
    if (typeof removeValueListener === 'function') {
      for (const listenerId of this.gmListenerIds) {
        try {
          removeValueListener(listenerId);
        } catch {}
      }
    }

    this.gmListenerIds = [];
    this.listeners.clear();
    this.started = false;
  }
}
