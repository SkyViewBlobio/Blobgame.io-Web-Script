import { extractUidFromElement, findAngularUid } from '../roles/UidReader.js';

const FRIEND_ROW_CLASS = 'friend-row';
const ACCEPTED_ACTION_CLASS = 'btn-unfriend';
const SCAN_DELAY_MS = 120;
const RETRY_DELAY_MS = 520;

function hasClass(node, className) {
  return Boolean(node?.classList?.contains?.(className));
}

function findClassAncestor(node, className) {
  let current = node;

  while (current) {
    if (hasClass(current, className)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

export function extractAcceptedFriendUid(row) {
  if (!row?.querySelector?.(`.${ACCEPTED_ACTION_CLASS}`)) {
    return '';
  }

  const directUid = extractUidFromElement(row);
  if (directUid) {
    return directUid;
  }

  const name = row.querySelector?.('.friend-name .name-text')?.textContent
    || row.querySelector?.('.name-text')?.textContent
    || '';
  return findAngularUid(row, { preferredName: name }).uid;
}

export class FriendListFeature {
  constructor({
    document = globalThis.document,
    friendHighlightStore,
    logger = console,
  } = {}) {
    this.document = document;
    this.friendHighlightStore = friendHighlightStore;
    this.logger = logger;
    this.pageObserver = null;
    this.clickHandler = null;
    this.scanTimer = null;
    this.retryTimer = null;
    this.removalTimers = new Set();
    this.lastFailureSignature = '';
    this.started = false;
  }

  start() {
    if (this.started || !this.document?.documentElement) {
      return Boolean(this.started);
    }

    this.started = true;
    this.clickHandler = (event) => this.handleClick(event);
    this.document.addEventListener?.('click', this.clickHandler, true);
    this.observeFriendList();
    this.scheduleScan(0);
    return true;
  }

  observeFriendList() {
    const MutationObserver = this.document.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (!MutationObserver) {
      return;
    }

    this.pageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const touchedNodes = [
          ...Array.from(mutation.addedNodes || []),
          ...Array.from(mutation.removedNodes || []),
        ];

        if (touchedNodes.some((node) => this.containsFriendListContent(node))) {
          this.scheduleScan();
          return;
        }
      }
    });

    this.pageObserver.observe(this.document.documentElement, { childList: true, subtree: true });
  }

  containsFriendListContent(node) {
    if (node?.nodeType !== 1) {
      return false;
    }

    if (hasClass(node, FRIEND_ROW_CLASS) || hasClass(node, ACCEPTED_ACTION_CLASS)) {
      return true;
    }

    return Boolean(node.querySelector?.(`.${FRIEND_ROW_CLASS}, .${ACCEPTED_ACTION_CLASS}`));
  }

  scheduleScan(delay = SCAN_DELAY_MS) {
    const win = this.document.defaultView || globalThis;
    if (this.scanTimer !== null) {
      win.clearTimeout?.(this.scanTimer);
    }

    this.scanTimer = win.setTimeout?.(() => {
      this.scanTimer = null;
      const complete = this.scanAcceptedFriends();
      if (!complete) {
        this.scheduleRetry();
      }
    }, delay) ?? null;
  }

  scheduleRetry() {
    if (this.retryTimer !== null) {
      return;
    }

    const win = this.document.defaultView || globalThis;
    this.retryTimer = win.setTimeout?.(() => {
      this.retryTimer = null;
      this.scanAcceptedFriends();
    }, RETRY_DELAY_MS) ?? null;
  }

  scanAcceptedFriends() {
    const rows = Array.from(this.document.querySelectorAll?.(`.${FRIEND_ROW_CLASS}`) || [])
      .filter((row) => row.querySelector?.(`.${ACCEPTED_ACTION_CLASS}`));

    if (rows.length === 0) {
      return true;
    }

    const uids = [];
    const unresolvedNames = [];

    for (const row of rows) {
      const uid = extractAcceptedFriendUid(row);
      if (uid) {
        uids.push(uid);
        continue;
      }

      unresolvedNames.push(String(row.querySelector?.('.name-text')?.textContent || '').trim() || '?');
    }

    if (unresolvedNames.length > 0) {
      for (const uid of uids) {
        this.friendHighlightStore?.addUid?.(uid);
      }

      const signature = unresolvedNames.join('|');
      if (signature !== this.lastFailureSignature) {
        this.lastFailureSignature = signature;
        this.logger.warn?.(
          `[Blobio] Friends-highlight could not read ${unresolvedNames.length} accepted friend UID(s).`,
          unresolvedNames,
        );
      }
      return false;
    }

    this.lastFailureSignature = '';
    this.friendHighlightStore?.replaceUids?.(uids);
    return true;
  }

  handleClick(event) {
    const unfriendButton = findClassAncestor(event?.target, ACCEPTED_ACTION_CLASS);
    if (!unfriendButton) {
      return;
    }

    const row = findClassAncestor(unfriendButton, FRIEND_ROW_CLASS);
    const uid = extractAcceptedFriendUid(row);
    if (!uid) {
      return;
    }

    this.scheduleRemovalCheck(uid, row, 350);
    this.scheduleRemovalCheck(uid, row, 1200);
  }

  scheduleRemovalCheck(uid, row, delay) {
    const win = this.document.defaultView || globalThis;
    const timer = win.setTimeout?.(() => {
      this.removalTimers.delete(timer);
      if (!this.isConnected(row) || !row.querySelector?.(`.${ACCEPTED_ACTION_CLASS}`)) {
        this.friendHighlightStore?.removeUid?.(uid);
      }
    }, delay);

    if (timer !== undefined && timer !== null) {
      this.removalTimers.add(timer);
    }
  }

  isConnected(node) {
    if (!node) {
      return false;
    }

    if (typeof node.isConnected === 'boolean') {
      return node.isConnected;
    }

    return Boolean(this.document.documentElement?.contains?.(node));
  }

  destroy() {
    this.pageObserver?.disconnect();
    this.pageObserver = null;

    if (this.clickHandler) {
      this.document.removeEventListener?.('click', this.clickHandler, true);
      this.clickHandler = null;
    }

    const win = this.document.defaultView || globalThis;
    if (this.scanTimer !== null) {
      win.clearTimeout?.(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.retryTimer !== null) {
      win.clearTimeout?.(this.retryTimer);
      this.retryTimer = null;
    }
    for (const timer of this.removalTimers) {
      win.clearTimeout?.(timer);
    }
    this.removalTimers.clear();

    this.lastFailureSignature = '';
    this.started = false;
  }
}
