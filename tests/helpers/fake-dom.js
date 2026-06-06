class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  add(name) {
    this.names.add(name);
  }

  remove(name) {
    this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.classList = new FakeClassList();
    this.parentNode = null;
    this.textContent = '';
    this.id = '';
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }

    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) {
      this.parentNode.children.splice(index, 1);
    }

    this.parentNode = null;
  }
}

function findById(node, id) {
  if (node.id === id) {
    return node;
  }

  for (const child of node.children) {
    const match = findById(child, id);
    if (match) {
      return match;
    }
  }

  return null;
}

export function createFakeDocument() {
  const documentElement = new FakeElement('html');
  const head = new FakeElement('head');
  const body = new FakeElement('body');

  documentElement.appendChild(head);
  documentElement.appendChild(body);

  return {
    body,
    documentElement,
    head,
    defaultView: {},
    addEventListener() {},
    removeEventListener() {},
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return findById(documentElement, id);
    },
    querySelectorAll(selector) {
      if (!selector.startsWith('#')) {
        return [];
      }

      const match = findById(documentElement, selector.slice(1));
      return match ? [match] : [];
    },
  };
}
