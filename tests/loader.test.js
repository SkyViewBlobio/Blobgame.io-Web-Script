import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderPath = resolve(__dirname, '../loader/blobio-loader.user.js');

function createJwt(payload) {
  return [
    'header',
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');
}

function atobForVm(value) {
  return Buffer.from(String(value), 'base64').toString('binary');
}

test('Tampermonkey loader targets both Blobgame hosts and fetches the GitHub bundle with GM_xmlhttpRequest', () => {
  const loader = readFileSync(loaderPath, 'utf8');

  assert.match(loader, /\/\/ @match\s+\*:\/\/blobgame\.io\/\*/);
  assert.match(loader, /\/\/ @match\s+\*:\/\/custom\.client\.blobgame\.io\/\*/);
  assert.match(loader, /\/\/ @version\s+0\.1\.22/);
  assert.match(loader, /\/\/ @run-at\s+document-start/);
  assert.match(loader, /\/\/ @grant\s+GM_xmlhttpRequest/);
  assert.match(loader, /\/\/ @grant\s+GM_getValue/);
  assert.match(loader, /\/\/ @grant\s+GM_setValue/);
  assert.match(loader, /\/\/ @grant\s+GM_deleteValue/);
  assert.match(loader, /\/\/ @connect\s+cdn\.jsdelivr\.net/);
  assert.match(loader, /\/\/ @connect\s+raw\.githubusercontent\.com/);
  assert.match(loader, /\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/SkyViewBlobio\/Blobgame\.io-Web-Script\/main\/loader\/blobio-loader\.user\.js/);
  assert.match(loader, /\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/SkyViewBlobio\/Blobgame\.io-Web-Script\/main\/loader\/blobio-loader\.user\.js/);
  const rawBundleUrlIndex = loader.indexOf('https://raw.githubusercontent.com/SkyViewBlobio/Blobgame.io-Web-Script/main/dist/blobio-extension.bundle.js?v=0.1.22');
  const cdnBundleUrlIndex = loader.indexOf('https://cdn.jsdelivr.net/gh/SkyViewBlobio/Blobgame.io-Web-Script@main/dist/blobio-extension.bundle.js?v=0.1.22');
  assert.notEqual(rawBundleUrlIndex, -1);
  assert.notEqual(cdnBundleUrlIndex, -1);
  assert.equal(rawBundleUrlIndex < cdnBundleUrlIndex, true);
  assert.match(loader, /GM_xmlhttpRequest/);
  assert.match(loader, /\[Blobio\]/);
  assert.doesNotMatch(loader, /_re\(Zxe\.A,b\)/);
});

test('Tampermonkey loader bootstraps the custom skin before fetching the bundle', async () => {
  const loader = readFileSync(loaderPath, 'utf8');
  const gmValues = new Map([
    ['blobio.customSkin.enabled', '1'],
    ['blobio.customSkin.activeUrl', 'https://i.imgur.com/OZz80VZ.jpeg'],
    ['blobio.customSkin.localName', 'BlobioCustomSkin_testuser'],
    ['blobio.customSkin.baseSkin', JSON.stringify({ name: 'owned_dragon', type: 'premium' })],
  ]);
  const localValues = new Map();
  const bundleRequests = [];
  const fetchCalls = [];
  const injectedScripts = [];

  class FakeXMLHttpRequest {
    constructor() {
      this.listeners = new Map();
      this.readyState = 0;
      this.responseText = 'd:assets:0:application/unknown\n';
      this.response = this.responseText;
    }

    open(method, url, async, user, password) {
      this.openArgs = [method, url, async, user, password];
    }

    send() {
      this.readyState = 4;
      for (const listener of this.listeners.get('readystatechange') || []) {
        listener.call(this);
      }
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }
  }

  class FakeResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }

    text() {
      return Promise.resolve(this.body);
    }

    clone() {
      return new FakeResponse(this.body, this);
    }
  }

  const context = {
    console: { error() {}, warn() {}, log() {} },
    location: { host: 'custom.client.blobgame.io', href: 'http://custom.client.blobgame.io/' },
    localStorage: {
      getItem(key) {
        return localValues.has(key) ? localValues.get(key) : null;
      },
      setItem(key, value) {
        localValues.set(key, String(value));
      },
      removeItem(key) {
        localValues.delete(key);
      },
    },
    GM_getValue(key, fallbackValue) {
      return gmValues.has(key) ? gmValues.get(key) : fallbackValue;
    },
    GM_setValue(key, value) {
      gmValues.set(key, String(value));
    },
    GM_deleteValue(key) {
      gmValues.delete(key);
    },
    GM_xmlhttpRequest(request) {
      bundleRequests.push(request.url);
    },
    document: {
      documentElement: {
        appendChild(node) {
          injectedScripts.push(node.textContent || '');
          node.parentNode = this;
          return node;
        },
      },
      head: null,
      createElement(tagName) {
        return {
          tagName: String(tagName).toUpperCase(),
          textContent: '',
          remove() {
            this.removed = true;
          },
        };
      },
    },
    XMLHttpRequest: FakeXMLHttpRequest,
    HTMLImageElement: function FakeImage() {},
    Element: function FakeElement() {},
    fetch(url, init) {
      fetchCalls.push([url, init]);
      return Promise.resolve(new FakeResponse('d:assets:0:application/unknown\n'));
    },
    Response: FakeResponse,
  };
  context.globalThis = context;
  Object.defineProperty(context.HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() {
      return this.currentSrc || '';
    },
    set(value) {
      this.currentSrc = value;
    },
  });
  context.HTMLImageElement.prototype.setAttribute = function setAttribute(name, value) {
    this[name] = value;
  };
  context.Element.prototype.setAttribute = function setAttribute(name, value) {
    this[name] = value;
  };

  vm.runInNewContext(loader, context);

  assert.equal(localValues.get('config-skin'), 'owned_dragon');
  assert.equal(localValues.get('config-skin-type'), 'premium');
  assert.equal(bundleRequests.length, 1);
  assert.equal(injectedScripts.length, 1);
  assert.match(injectedScripts[0], /__blobioCustomSkinPageBootstrapInstalled/);
  assert.match(injectedScripts[0], /patchGwtCacheSource/);
  assert.doesNotMatch(injectedScripts[0], /config-username/);

  const skinRequest = new context.XMLHttpRequest();
  skinRequest.open('GET', '/skins/premium/owned_dragon.png', true);
  const fakeSkinRequest = new context.XMLHttpRequest();
  fakeSkinRequest.open('GET', '/skins/free/BlobioCustomSkin_testuser.png', true);
  const otherSkinRequest = new context.XMLHttpRequest();
  otherSkinRequest.open('GET', '/skins/premium/other_owned.png', true);

  assert.equal(skinRequest.openArgs[1], 'https://i.imgur.com/OZz80VZ.jpeg');
  assert.equal(fakeSkinRequest.openArgs[1], 'https://i.imgur.com/OZz80VZ.jpeg');
  assert.equal(otherSkinRequest.openArgs[1], '/skins/premium/other_owned.png');

  const manifestRequest = new context.XMLHttpRequest();
  manifestRequest.open('GET', '/assets/assets.txt', true);
  manifestRequest.send();

  assert.match(manifestRequest.responseText, /i:skins\/free\/BlobioCustomSkin_testuser\.png:0:image\/png/);
  assert.match(manifestRequest.responseText, /i:skins\/premium\/BlobioCustomSkin_testuser\.png:0:image\/png/);

  const response = await context.fetch('/assets/assets.txt');
  const text = await response.text();
  assert.match(text, /i:skins\/free\/BlobioCustomSkin_testuser\.png:0:image\/png/);
  assert.match(text, /i:skins\/premium\/BlobioCustomSkin_testuser\.png:0:image\/png/);

  await context.fetch('/skins/free/BlobioCustomSkin_testuser.png', { cache: 'reload' });
  await context.fetch('/skins/premium/owned_dragon.png', { cache: 'reload' });
  await context.fetch('/skins/premium/other_owned.png');

  assert.deepEqual(fetchCalls.at(-3), ['https://i.imgur.com/OZz80VZ.jpeg', { cache: 'reload' }]);
  assert.deepEqual(fetchCalls.at(-2), ['https://i.imgur.com/OZz80VZ.jpeg', { cache: 'reload' }]);
  assert.deepEqual(fetchCalls.at(-1), ['/skins/premium/other_owned.png', undefined]);
});

test('Tampermonkey loader page bootstrap patches only the local custom skin in page context', async () => {
  const loader = readFileSync(loaderPath, 'utf8');
  const gmValues = new Map([
    ['blobio.customSkin.enabled', '1'],
    ['blobio.customSkin.activeUrl', 'https://i.imgur.com/OZz80VZ.jpeg'],
    ['blobio.customSkin.localName', 'BlobioCustomSkin_testuser'],
    ['blobio.customSkin.baseSkin', JSON.stringify({ name: 'owned_dragon', type: 'premium' })],
  ]);
  const localValues = new Map();
  const injectedScripts = [];

  const context = {
    console: { error() {}, warn() {}, log() {}, debug() {} },
    location: { host: 'custom.client.blobgame.io', href: 'http://custom.client.blobgame.io/' },
    localStorage: {
      getItem(key) {
        return localValues.has(key) ? localValues.get(key) : null;
      },
      setItem(key, value) {
        localValues.set(key, String(value));
      },
      removeItem(key) {
        localValues.delete(key);
      },
    },
    GM_getValue(key, fallbackValue) {
      return gmValues.has(key) ? gmValues.get(key) : fallbackValue;
    },
    GM_setValue(key, value) {
      gmValues.set(key, String(value));
    },
    GM_deleteValue(key) {
      gmValues.delete(key);
    },
    GM_xmlhttpRequest() {},
    document: {
      documentElement: {
        appendChild(node) {
          injectedScripts.push(node.textContent || '');
          return node;
        },
      },
      createElement() {
        return {
          textContent: '',
          remove() {},
        };
      },
    },
  };
  context.globalThis = context;

  vm.runInNewContext(loader, context);

  assert.equal(injectedScripts.length, 1);

  const pageFetchCalls = [];
  class PageResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }

    text() {
      return Promise.resolve(this.body);
    }

    clone() {
      return new PageResponse(this.body, this);
    }
  }

  class PageXMLHttpRequest {
    open(method, url, async, user, password) {
      this.openArgs = [method, url, async, user, password];
    }
  }

  const pageLocalValues = new Map([
    ['access-token', createJwt({ userId: 777 })],
    ['config-username', 'SkyView'],
  ]);
  const pageContext = {
    console: { error() {}, warn() {}, log() {}, debug() {} },
    location: { host: 'custom.client.blobgame.io', href: 'http://custom.client.blobgame.io/' },
    localStorage: {
      getItem(key) {
        return pageLocalValues.has(key) ? pageLocalValues.get(key) : null;
      },
      setItem(key, value) {
        pageLocalValues.set(key, String(value));
      },
      removeItem(key) {
        pageLocalValues.delete(key);
      },
    },
    document: {
      createElement() {
        return {
          setAttribute(name, value) {
            this[name] = value;
          },
          getAttribute(name) {
            return this[name] || '';
          },
          addEventListener() {},
          remove() {},
        };
      },
      head: {
        appendChild(node) {
          return node;
        },
      },
      documentElement: {
        appendChild(node) {
          return node;
        },
      },
    },
    XMLHttpRequest: PageXMLHttpRequest,
    HTMLImageElement: function PageImage() {},
    Element: function PageElement() {},
    fetch(url, init) {
      pageFetchCalls.push([url, init]);
      return Promise.resolve(new PageResponse(String(url).endsWith('.cache.js') ? 'function keep(){}' : 'd:assets:0:application/unknown\n'));
    },
    Response: PageResponse,
    URL,
    atob: atobForVm,
  };
  pageContext.window = pageContext;
  pageContext.globalThis = pageContext;
  pageContext.Node = function PageNode() {};
  pageContext.Node.prototype = {
    appendChild(node) {
      return node;
    },
    insertBefore(node) {
      return node;
    },
  };
  Object.defineProperty(pageContext.HTMLImageElement.prototype, 'src', {
    configurable: true,
    get() {
      return this.currentSrc || '';
    },
    set(value) {
      this.currentSrc = value;
    },
  });
  pageContext.HTMLImageElement.prototype.setAttribute = function setAttribute(name, value) {
    this[name] = value;
  };
  pageContext.Element.prototype.setAttribute = function setAttribute(name, value) {
    this[name] = value;
  };

  vm.runInNewContext(injectedScripts[0], pageContext);

  assert.equal(pageLocalValues.get('config-skin'), 'owned_dragon');
  assert.equal(pageLocalValues.get('config-skin-type'), 'premium');
  assert.equal(pageLocalValues.get('config-username'), 'SkyView');
  assert.equal(pageContext.__blobioCustomSkinRuntimeState().userId, '777');
  assert.equal(
    JSON.stringify(pageContext.__blobioCustomSkinRuntimeState().baseSkin),
    JSON.stringify({ name: 'owned_dragon', type: 'premium' }),
  );
  assert.equal(pageContext.__blobioCustomSkinIsLocalCell({ J: 777, B: 'Other' }), true);
  assert.equal(pageContext.__blobioCustomSkinIsLocalCell({ J: 1, B: 'SkyView' }), false);
  pageLocalValues.delete('access-token');
  assert.equal(pageContext.__blobioCustomSkinRuntimeState().userId, '');
  assert.equal(pageContext.__blobioCustomSkinIsLocalCell({ J: 1, B: 'SkyView' }), true);
  pageLocalValues.set('access-token', createJwt({ userId: 777 }));

  const matchingRequest = new pageContext.XMLHttpRequest();
  matchingRequest.open('GET', '/skins/premium/owned_dragon.png', true);
  const fakeMatchingRequest = new pageContext.XMLHttpRequest();
  fakeMatchingRequest.open('GET', '/skins/free/BlobioCustomSkin_testuser.png', true);
  const otherRequest = new pageContext.XMLHttpRequest();
  otherRequest.open('GET', '/skins/premium/other_owned.png', true);
  assert.equal(matchingRequest.openArgs[1], 'https://i.imgur.com/OZz80VZ.jpeg');
  assert.equal(fakeMatchingRequest.openArgs[1], 'https://i.imgur.com/OZz80VZ.jpeg');
  assert.equal(otherRequest.openArgs[1], '/skins/premium/other_owned.png');

  await pageContext.fetch('/skins/free/BlobioCustomSkin_testuser.png');
  await pageContext.fetch('/skins/premium/owned_dragon.png');
  await pageContext.fetch('/skins/premium/other_owned.png');
  assert.deepEqual(pageFetchCalls.at(-3), ['https://i.imgur.com/OZz80VZ.jpeg', undefined]);
  assert.deepEqual(pageFetchCalls.at(-2), ['https://i.imgur.com/OZz80VZ.jpeg', undefined]);
  assert.deepEqual(pageFetchCalls.at(-1), ['/skins/premium/other_owned.png', undefined]);

  const gwtSource = [
    "function Xye(a,b){a.i=b}",
    "function Kg(a,b,c){var d,e,f;f=false;if(gve((Pte(),Kte),b)){for(e=(new jRe(Kte)).b.nX();nJe(e.a);){d=e.b=oJe(e.a);if(cFe(d.YX(),b)&&c>=d.XX().a){f=true;break}}}f||(f=Ig(a,b));return f}",
    "function sg(a,b,c){this.a=a;this.c=b;this.b=c}",
    "function tg(a,b){var c,d,e;c=b.currentTarget;if(c.status==200){e=_Wd(c.responseText);Xye(a.c,Kg(e,a.c.r,b.lvl?parseInt(b.lvl):-1));Cxe(a.a)}}",
    "function Rwe(a,b,c,d){var e,f,g;if(OIe(a.d,c)){g=NIe(a.d,c);e=Xvf}else if($re(a.b,c)){f=b==($Ae(),XAe)?'premium':'free';g='/skins/'+f+'/'+oFe(c,' ','')+'.png';e='image/png'}else{return}if(l8b(a.a.G.e,g)){qwe(d,Md(Xb,g));return}Og(a.c,g,e,'Anonymous',new Uwe(a,c,g,d))}",
    "function hye(a,b,c,d,e,f,g,h,i,j){var k,l,m,n,o,p;this.n=a;this.d=j;this.c=Zze(j);this.J=b;this.R=this.C=this.H=c;this.S=this.D=this.I=d;if(e<=38&&Zxe.c.a>0.13){this.F=this.M=1;this.w=e;this.G=this.O=1;this.A=e}else{this.F=this.M=this.w=e;this.G=this.O=this.A=e}!!f&&(this.q=(k=y1d(255*f.a)<<24|y1d(255*f.b)<<16|y1d(255*f.c)<<8|y1d(255*f.d),k==-10263602));this.s=g;this.t=g&&this.d==(Xze(),Rze).a;dye(this,f,j);h!=null&&(this.B=h);this.L=i;o=(!dwe&&(dwe=new kwe),dwe);if(this.s&&!this.t){Nye((sxe(),qxe).f,(Ize(),Fze))&&(Yse(),false)?Yse():fwe(o,this,Ksf,($Ae(),YAe));return}if(j!=(Xze(),Uze).a&&j!=Rze.a){this.k=true;p=Zze(j);n=p.b;n.length==0||fwe(o,this,n,($Ae(),YAe));return}if(this.B!=null||i!=null){if(Nye((sxe(),qxe).f,(Ize(),Fze))){m=this.B==null?null:this.B.toLowerCase();i!=null&&(Yse(),Vse)?fwe(o,this,i,($Ae(),XAe)):this.B.length>0&&fwe(o,this,m,($Ae(),VAe))}}}",
    "function Kxe(){Hb.call(this,'CONTEXT',0);Zxe=this}",
  ].join(' ');
  const patched = pageContext.__blobioCustomSkinPatchGwtCacheSource(gwtSource);
  const patchedAgain = pageContext.__blobioCustomSkinPatchGwtCacheSource(patched);

  assert.match(patched, /\|\|c==="BlobioCustomSkin_testuser"/);
  assert.match(patched, /__blobioCustomSkinIsLocalCell/);
  assert.match(patched, /__blobioCustomSkinPatchUsable/);
  assert.match(patched, /__blobioCustomSkinForceLocal/);
  assert.match(patched, /i=_blobioState\.baseSkin\.name\|\|_blobioState\.localName/);
  assert.match(patched, /i!=null&&\(__blobioForceSkin\|\|/);
  assert.doesNotMatch(patched, /_re\(Zxe\.A,b\)/);
  assert.match(patched, /__blobioGwtGame=this/);
  assert.equal(patchedAgain, patched);
});

test('Tampermonkey loader does not inject custom client page bootstrap on the front page host', () => {
  const loader = readFileSync(loaderPath, 'utf8');
  const injectedScripts = [];
  const context = {
    console: { error() {}, warn() {}, log() {} },
    location: { host: 'blobgame.io', href: 'https://blobgame.io/' },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    GM_getValue(_key, fallbackValue) {
      return fallbackValue;
    },
    GM_setValue() {},
    GM_deleteValue() {},
    GM_xmlhttpRequest() {},
    document: {
      documentElement: {
        appendChild(node) {
          injectedScripts.push(node.textContent || '');
          return node;
        },
      },
      createElement() {
        return {
          textContent: '',
          remove() {},
        };
      },
    },
    XMLHttpRequest: function FakeXMLHttpRequest() {},
    HTMLImageElement: function FakeImage() {},
    Element: function FakeElement() {},
  };
  context.globalThis = context;

  vm.runInNewContext(loader, context);

  assert.equal(injectedScripts.length, 0);
});
