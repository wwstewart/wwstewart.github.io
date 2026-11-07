/*
  check.js: the live security check of this page, in the home page hero.
  Six checks run in the visitor’s browser when the page loads, and again on request. Every result
  is read from the page at that moment: nothing is written in advance, and nothing pretends to take
  time. Each row opens to show how it was checked.
  The same file runs in the GitHub Pages copy (with its Content Security Policy) and in the preview
  copy (no policy, inlined, in a sandboxed frame on another origin), and says plainly which it is in.
  No storage, no network, no globals, no markup strings: the DOM is built with createElement only.
*/
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var ORDER = ['connection', 'policy', 'files', 'cookies', 'storage', 'links'];
  var SAY = { pass: 'passed', fail: 'failed', info: 'not checked here' };
  var FLAG = 'checkInjected';

  /* Small helpers */

  function reduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function canAnimate() {
    return typeof Element === 'function' && typeof Element.prototype.animate === 'function' && !reduced();
  }

  function isPreview() {
    return !!document.querySelector('meta[name="site-env"][content="preview"]');
  }

  function add(node, kids) {
    (Array.isArray(kids) ? kids : [kids]).forEach(function (kid) {
      if (Array.isArray(kid)) add(node, kid);
      else if (kid !== undefined && kid !== null && kid !== false && kid !== '') {
        node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
      }
    });
    return node;
  }

  function el(tag, cls, kids) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return kids === undefined ? node : add(node, kids);
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function code(text) {
    return el('code', null, String(text));
  }

  function para(kids) {
    return el('p', null, kids);
  }

  // A readout: each expression beside the value the browser returned just now.
  function readout(pairs) {
    var list = el('dl', 'check__read');
    pairs.forEach(function (pair) {
      list.appendChild(el('div', null, [el('dt', null, code(pair[0])), el('dd', null, code(pair[1]))]));
    });
    return list;
  }

  // Plain words in two columns: a term beside what it means here.
  function ledger(pairs) {
    var list = el('dl', 'check__ledger');
    pairs.forEach(function (pair) {
      list.appendChild(el('div', null, [el('dt', null, pair[0]), el('dd', null, pair[1])]));
    });
    return list;
  }

  function codes(items) {
    var list = el('ul', 'check__codes');
    items.forEach(function (item) {
      list.appendChild(el('li', null, code(item)));
    });
    return list;
  }

  function count(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function joinAnd(parts) {
    if (parts.length < 3) return parts.join(' and ');
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }

  function quote(value) {
    return JSON.stringify(String(value));
  }

  // The time as the reader’s own clock shows it, in a time element a machine can read too.
  function stamp() {
    var now = new Date();
    var text;
    try {
      text = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      text = now.toTimeString().slice(0, 8);
    }
    var node = el('time', null, text);
    node.setAttribute('datetime', now.toISOString());
    return node;
  }

  /* Icons, drawn as inline SVG in currentColor. Passed: a ring with a check. Failed: a triangle
     with a bar and a dot. Not checked here: a ring with an i. Each state has its own shape, so it
     never rests on color alone. */

  function svg(cls, size) {
    var node = document.createElementNS(SVG_NS, 'svg');
    node.setAttribute('class', cls);
    node.setAttribute('width', String(size));
    node.setAttribute('height', String(size));
    node.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    return node;
  }

  function shape(parent, tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    parent.appendChild(node);
    return node;
  }

  function icon(state) {
    var node = svg('check__icon', 20);
    if (state === 'fail') {
      shape(node, 'path', { d: 'M10 2.6 17.8 16H2.2Z' });
      shape(node, 'path', { class: 'check__mark', d: 'M10 7.3v3.7', pathLength: '1' });
      shape(node, 'circle', { class: 'check__dot', cx: '10', cy: '13.35', r: '0.95' });
      return node;
    }
    shape(node, 'circle', { cx: '10', cy: '10', r: '8.25' });
    if (state === 'pass') {
      shape(node, 'path', { class: 'check__mark', d: 'M6.5 10.25 8.85 12.6 13.5 7.65', pathLength: '1' });
    } else if (state === 'info') {
      shape(node, 'circle', { class: 'check__dot', cx: '10', cy: '6.6', r: '0.95' });
      shape(node, 'path', { class: 'check__mark', d: 'M10 9.1v4.5', pathLength: '1' });
    }
    return node;
  }

  function chevron() {
    var node = svg('check__chev', 16);
    shape(node, 'path', { d: 'M4 6.25 8 10.25 12 6.25' });
    return node;
  }

  /* 1. Connection: did this copy arrive over an encrypted connection? */

  function checkConnection() {
    var protocol = location.protocol;
    var secure = window.isSecureContext;
    var values = [['location.protocol', quote(protocol)], ['isSecureContext', String(secure)]];

    if (protocol === 'https:' && secure !== false) {
      return {
        state: 'pass',
        result: 'Encrypted with HTTPS',
        ev: [
          readout(values),
          para('This page came over an encrypted HTTPS connection, so it couldn’t be read or changed on the way to you. The encryption comes from the host, not the page.')
        ]
      };
    }
    if (protocol === 'https:') {
      return {
        state: 'fail',
        result: 'Inside an unencrypted page',
        ev: [
          readout(values),
          para('This page came over HTTPS, but a page around it didn’t, so your browser doesn’t count it as secure.')
        ]
      };
    }
    if (protocol === 'http:') {
      return {
        state: 'fail',
        result: 'Not encrypted, served over http',
        ev: [
          readout(values),
          para('This copy came over plain http, so it travels unencrypted.' +
            (secure ? ' Your browser still counts it as secure, but only because the address is on your own computer.' : '')),
          para('Encryption comes from the host, not the page. The live site is served over HTTPS.')
        ]
      };
    }
    if (protocol === 'file:') {
      return {
        state: 'info',
        result: 'Opened from a file',
        ev: [
          readout(values.slice(0, 1)),
          para('This copy was opened from a file on your computer, so there is no connection to encrypt. The live site is served over HTTPS.')
        ]
      };
    }
    // A frame with no address of its own (about:srcdoc and the like).
    if (secure) {
      return {
        state: 'pass',
        result: 'Inside a secure page',
        ev: [
          readout(values),
          para('This copy has no address of its own. Your browser still counts it as secure, which it does only when every page around it is secure.')
        ]
      };
    }
    return {
      state: 'fail',
      result: 'Not encrypted',
      ev: [readout(values), para('Your browser doesn’t count this page as secure.')]
    };
  }

  /* 2. Script policy: does the page carry a Content Security Policy that limits scripts? */

  var RISKY = ["'unsafe-inline'", "'unsafe-eval'", '*', 'http:', 'https:', 'data:', 'blob:'];

  function findPolicy() {
    var metas = document.getElementsByTagName('meta');
    for (var i = 0; i < metas.length; i++) {
      if (String(metas[i].httpEquiv || '').toLowerCase() === 'content-security-policy') return metas[i];
    }
    return null;
  }

  function parsePolicy(text) {
    var map = Object.create(null);
    text.split(';').forEach(function (part) {
      var tokens = part.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) return;
      var name = tokens[0].toLowerCase();
      if (!map[name]) map[name] = tokens.slice(1);
    });
    return map;
  }

  // One directive’s sources in plain words.
  function words(list, none, inline) {
    if (!list) return 'not limited';
    var self = false;
    var extra = [];
    list.forEach(function (token) {
      var t = token.toLowerCase();
      if (t === "'none'") return;
      if (t === "'self'") self = true;
      else if (t === 'data:') extra.push(inline || 'inline data');
      else if (t === "'unsafe-inline'") extra.push('inline code');
      else if (t === "'unsafe-eval'") extra.push('code built from text');
      else if (t === '*' || t === 'http:') extra.push('any site');
      else if (t === 'https:') extra.push('any encrypted site');
      else if (t === 'blob:') extra.push('files the page makes');
      else if (t.indexOf("'nonce") === 0 || t.indexOf("'sha") === 0) extra.push('approved inline code');
      else extra.push(token);
    });
    if (!self && !extra.length) return none;
    if (self && !extra.length) return 'this site only';
    return joinAnd((self ? ['this site'] : []).concat(extra));
  }

  function checkPolicy() {
    var meta = findPolicy();
    if (!meta) {
      if (isPreview()) {
        return {
          state: 'info',
          result: 'Not in this preview',
          ev: [
            para('This preview doesn’t carry the site’s policy. It builds the styles and scripts into the page itself, and the policy would block them, so there is nothing here to check.'),
            para('The live site carries the policy in every page, in a meta tag.')
          ]
        };
      }
      return {
        state: 'fail',
        result: 'No policy on this page',
        ev: [para('This page has no policy, so a script from anywhere could run on it.')]
      };
    }

    var text = String(meta.getAttribute('content') || '').trim().replace(/\s+/g, ' ');
    var d = parsePolicy(text);
    // As written, one directive to a line, so no rule ever breaks across two.
    var written = text.split(';').map(function (part) {
      return part.trim();
    }).filter(Boolean).join(';\n');
    var all = d['default-src'];
    var scripts = d['script-src-elem'] || d['script-src'] || all;
    var styles = d['style-src-elem'] || d['style-src'] || all;
    var safe = !!scripts && !scripts.some(function (t) {
      return RISKY.indexOf(t.toLowerCase()) !== -1;
    });
    var onlySelf = !!scripts && scripts.length === 1 && scripts[0].toLowerCase() === "'self'";

    var result = 'Scripts are not limited';
    if (safe) result = onlySelf ? 'Only this site’s scripts can run' : 'Only listed sources can run scripts';
    return {
      state: safe ? 'pass' : 'fail',
      result: result,
      ev: [
        para(safe ?
          'Read just now from the policy in this page’s head. In plain words:' :
          'Read just now from the policy in this page’s head. It still lets unsafe scripts run. In plain words:'),
        ledger([
          ['Scripts', words(scripts, 'none')],
          ['Styles', words(styles, 'none')],
          ['Fonts', words(d['font-src'] || all, 'none', 'inline fonts')],
          ['Images', words(d['img-src'] || all, 'none', 'inline images')],
          ['Network requests from scripts', words(d['connect-src'] || all, 'none')],
          ['Forms', words(d['form-action'], 'can’t send anywhere')],
          ['Any other kind of file', words(all, 'blocked')]
        ]),
        para('As written in the page:'),
        el('pre', 'check__pre', code(written)),
        para('The page carries the policy itself, in a meta tag, because GitHub Pages can’t send one as a header. A policy in a meta tag can’t stop other sites from showing the page in a frame; only a header can do that.')
      ]
    };
  }

  /* 3. Files: did every file the page loads or names come from this site? */

  var FETCHING = /(^|\s)(stylesheet|icon|preload|modulepreload|prefetch|preconnect|dns-prefetch|manifest|apple-touch-icon|mask-icon)(\s|$)/i;
  var SOURCES = 'script[src], link[href], img[src], img[srcset], iframe[src], source[src], source[srcset], ' +
    'video[src], video[poster], audio[src], track[src], embed[src], object[data], input[src]';
  var KINDS = [
    { name: 'Page', one: 'page', many: 'pages', test: /\.html?$/i },
    { name: 'Style sheets', one: 'style sheet', many: 'style sheets', test: /\.css$/i },
    { name: 'Scripts', one: 'script', many: 'scripts', test: /\.m?js$/i },
    { name: 'Fonts', one: 'font', many: 'fonts', test: /\.(woff2?|ttf|otf)$/i },
    { name: 'Images', one: 'image', many: 'images', test: /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i },
    { name: 'Other files', one: 'other file', many: 'other files', test: /./ }
  ];

  function kindOf(url) {
    for (var i = 0; i < KINDS.length - 1; i++) {
      if (KINDS[i].test.test(url.pathname)) return i;
    }
    return KINDS.length - 1;
  }

  function place(href) {
    var url;
    try {
      url = new URL(href, document.baseURI);
    } catch (e) {
      return null;
    }
    var p = url.protocol;
    if (/extension:$/.test(p)) return { kind: 'extension', url: url };
    if (p === 'data:' || p === 'blob:' || p === 'about:' || p === 'javascript:') return { kind: 'inline', url: url };
    if (location.protocol === 'file:') return { kind: p === 'file:' ? 'own' : 'other', url: url };
    return { kind: url.origin === location.origin ? 'own' : 'other', url: url };
  }

  // Every address the page’s own elements ask the browser to load.
  function referenced(scopes) {
    var found = [];
    Array.prototype.forEach.call(scopes, function (scope) {
      var nodes = scope.querySelectorAll(SOURCES);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.tagName.toLowerCase() === 'link') {
          if (FETCHING.test(node.getAttribute('rel') || '')) found.push(node.getAttribute('href'));
          continue;
        }
        ['src', 'poster', 'data'].forEach(function (name) {
          var value = node.getAttribute(name);
          if (value) found.push(value);
        });
        var set = node.getAttribute('srcset');
        if (set) {
          set.split(',').forEach(function (part) {
            var first = part.trim().split(/\s+/)[0];
            if (first) found.push(first);
          });
        }
      }
    });
    return found;
  }

  // The browser’s own record of this visit: the page itself, then every file it loaded.
  function recorded() {
    var list = [];
    try {
      performance.getEntriesByType('navigation').forEach(function (entry) {
        list.push({ href: entry.name, kind: 0 });
      });
      performance.getEntriesByType('resource').forEach(function (entry) {
        list.push({ href: entry.name });
      });
    } catch (e) {
      list = [];
    }
    if (!list.length) list.push({ href: location.href, kind: 0 });
    return list;
  }

  function shortPath(url) {
    var path = url.pathname;
    try {
      var dir = new URL('.', location.href);
      if (url.origin === dir.origin && path.indexOf(dir.pathname) === 0) path = path.slice(dir.pathname.length);
      else path = path.replace(/^\//, '');
      path = decodeURIComponent(path);
    } catch (e) {
      path = path.replace(/^\//, '');
    }
    return path || 'index.html';
  }

  function checkFiles() {
    var preview = isPreview();
    var seen = Object.create(null);
    var own = [];
    var others = [];
    var hosts = [];
    var extensions = 0;

    function note(href, kind) {
      var spot = place(href);
      if (!spot) return;
      var key = spot.url.href.split('#')[0];
      if (seen[key]) return;
      seen[key] = true;
      if (spot.kind === 'extension') extensions += 1;
      else if (spot.kind === 'other') {
        others.push(key);
        var host = spot.url.host || spot.url.protocol;
        if (hosts.indexOf(host) === -1) hosts.push(host);
      } else if (spot.kind === 'own') {
        own.push({ url: spot.url, kind: kind === undefined ? kindOf(spot.url) : kind });
      }
    }

    if (preview) {
      // The preview host loads files of its own that this page never asked for: count only what
      // the page’s own elements reference.
      referenced(document.querySelectorAll('header, main, footer')).forEach(function (href) {
        note(href);
      });
    } else {
      // The page’s own elements first (its head, then header, main, and footer), so files list in
      // the order the page names them; then the browser’s record, which adds the page itself and
      // anything no element names.
      var scopes = [document.head].concat(Array.prototype.slice.call(document.querySelectorAll('header, main, footer')));
      referenced(scopes.filter(Boolean)).forEach(function (href) {
        note(href);
      });
      recorded().forEach(function (item) {
        note(item.href, item.kind);
      });
    }

    var extensionNote = extensions ?
      para(count(extensions, 'file', 'files') + ' added by your browser extensions ' + (extensions === 1 ? 'is' : 'are') + ' not counted.') :
      null;

    if (others.length) {
      return {
        state: 'fail',
        result: count(others.length, 'file', 'files') + ' from other sites',
        ev: [
          para(count(others.length, 'file comes', 'files come') + ' from other sites:'),
          codes(hosts),
          own.length ? para('Everything else is on this site.') : null,
          extensionNote
        ]
      };
    }

    // Group this site’s files by kind, in a fixed order, each kind in the order it was found.
    var groups = KINDS.map(function () { return []; });
    own.forEach(function (item) {
      groups[item.kind].push(shortPath(item.url));
    });
    var rows = [];
    var tally = [];
    groups.forEach(function (paths, i) {
      if (!paths.length) return;
      var kind = KINDS[i];
      rows.push([paths.length === 1 && i < 5 ? kind.one.charAt(0).toUpperCase() + kind.one.slice(1) : kind.name, codes(paths)]);
      tally.push(count(paths.length, kind.one, kind.many));
    });

    if (preview) {
      return {
        state: 'pass',
        result: 'None from other sites',
        ev: own.length ? [
          para(['The page’s own elements ask for ', count(own.length, 'file', 'files'), ', all on this site: ', joinAnd(tally), '.']),
          ledger(rows),
          para('Files the preview host loads are not counted.'),
          extensionNote
        ] : [
          para('This preview builds its styles, scripts, and font into the page, so the page itself asks for no files at all.'),
          para('Files the preview host loads are not counted.'),
          extensionNote
        ]
      };
    }

    var where = location.host ? [code(location.host), ', the same site as this page'] : ['the folder this page was opened from'];
    return {
      state: 'pass',
      result: own.length === 1 ? 'The 1 file is from this site' : 'All ' + own.length + ' from this site',
      ev: [
        para([count(own.length, 'file', 'files'), ' that this page loads or names, ', own.length === 1 ? 'from ' : 'all from ', where, ': ', joinAnd(tally), '.']),
        ledger(rows),
        para('Read from your browser’s record of this visit, and from every element on the page that can load a file.'),
        extensionNote
      ]
    };
  }

  /* 4. Cookies */

  function checkCookies() {
    var jar;
    try {
      jar = document.cookie;
    } catch (e) {
      return {
        state: 'pass',
        result: 'Blocked in this frame',
        ev: [
          readout([['document.cookie', e && e.name ? e.name : 'Error']]),
          para('This frame isn’t allowed to use cookies at all, so none can be set or read.')
        ]
      };
    }
    if (!jar) {
      return {
        state: 'pass',
        result: 'None found',
        ev: [
          readout([['document.cookie', '""']]),
          para(['Read just now: empty. Scripts can’t see cookies marked ', code('HttpOnly'), ', and nothing on this site sets any.'])
        ]
      };
    }
    var names = jar.split(';').map(function (part) {
      return part.split('=')[0].trim();
    }).filter(Boolean);
    return {
      state: 'fail',
      result: count(names.length, 'cookie', 'cookies') + ' found',
      ev: [
        para(['Found ', count(names.length, 'cookie', 'cookies'), ' for this site. Their values are not shown.']),
        codes(names)
      ]
    };
  }

  /* 5. Browser storage */

  function stored(name) {
    try {
      var store = window[name];
      return { size: store ? store.length : 0 };
    } catch (e) {
      return { size: 0, blocked: e && e.name ? e.name : 'Error' };
    }
  }

  function checkStorage() {
    var local = stored('localStorage');
    var session = stored('sessionStorage');
    var values = readout([
      ['localStorage.length', local.blocked || String(local.size)],
      ['sessionStorage.length', session.blocked || String(session.size)]
    ]);
    var saved = local.size + session.size;
    if (saved > 0) {
      return {
        state: 'fail',
        result: count(saved, 'item', 'items') + ' saved',
        ev: [values, para('Something saved data for this site in your browser.')]
      };
    }
    if (local.blocked && session.blocked) {
      return {
        state: 'pass',
        result: 'Blocked in this frame',
        ev: [values, para('This frame isn’t allowed to use browser storage, so nothing can be saved.')]
      };
    }
    return {
      state: 'pass',
      result: 'Nothing saved',
      ev: [
        values,
        para(local.blocked || session.blocked ?
          'Read just now: nothing saved.' :
          'Local and session storage, read just now: both empty. The site’s scripts use no other storage either, not even to remember which rows you open here.')
      ]
    };
  }

  /* 6. New tab links: can a site opened in a new tab reach back into this one? */

  function relOf(link) {
    return String(link.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
  }

  function hostOf(link) {
    try {
      return new URL(link.href).host || link.getAttribute('href') || '';
    } catch (e) {
      return link.getAttribute('href') || '';
    }
  }

  function checkLinks() {
    var tabs = Array.prototype.filter.call(document.querySelectorAll('a[target]'), function (link) {
      return String(link.getAttribute('target')).toLowerCase() === '_blank';
    });
    if (!tabs.length) {
      return { state: 'pass', result: 'None on this page', ev: [para('No link on this page opens a new tab.')] };
    }
    var pairs = tabs.map(function (link) {
      return [hostOf(link), 'rel=' + quote(link.getAttribute('rel') || '')];
    });
    var open = tabs.filter(function (link) {
      var rel = relOf(link);
      return rel.indexOf('noopener') === -1 && rel.indexOf('noreferrer') === -1;
    });
    if (open.length) {
      return {
        state: 'fail',
        result: open.length + ' of ' + tabs.length + ' can reach back',
        ev: [
          para(count(open.length, 'link opens', 'links open') + ' a new tab that could reach back into this one:'),
          codes(open.map(hostOf))
        ]
      };
    }
    var opener = tabs.every(function (link) { return relOf(link).indexOf('noopener') !== -1; });
    var referrer = tabs.every(function (link) { return relOf(link).indexOf('noreferrer') !== -1; });
    var how;
    if (opener && referrer) {
      how = para([code('noopener'), ' keeps the new tab from controlling this one, and ', code('noreferrer'), ' keeps it from seeing which page sent you.']);
    } else if (opener) {
      how = para([code('noopener'), ' keeps the new tab from controlling this one.']);
    } else {
      how = para([code('noreferrer'), ' keeps the new tab from controlling this one or seeing which page sent you.']);
    }
    return {
      state: 'pass',
      result: tabs.length === 1 ? '1 link, isolated from this page' : tabs.length + ' links, all isolated from this page',
      ev: [
        para(tabs.length === 1 ?
          '1 link opens in a new tab, without access to this one:' :
          tabs.length + ' links open in a new tab, without access to this one:'),
        readout(pairs),
        how
      ]
    };
  }

  var CHECKS = {
    connection: checkConnection,
    policy: checkPolicy,
    files: checkFiles,
    cookies: checkCookies,
    storage: checkStorage,
    links: checkLinks
  };

  /* The card */

  function build(card) {
    var when = card.querySelector('.check__when');
    var foot = card.querySelector('.check__foot');
    var sum = card.querySelector('.check__sum');
    var again = card.querySelector('[data-check-again]');
    var rows = Object.create(null);
    var motion = [];
    var waiting = null;
    var liveTimer = 0;
    var signature = '';

    var live = el('p', 'visually-hidden');
    live.setAttribute('role', 'status');
    card.appendChild(live);

    function announce(message) {
      clearTimeout(liveTimer);
      live.textContent = '';
      liveTimer = setTimeout(function () {
        live.textContent = message;
      }, 60);
    }

    // Turn each static row into a button that opens its evidence. The static row and the button
    // share one layout, so nothing moves when the swap happens.
    ORDER.forEach(function (key) {
      var item = card.querySelector('.check__item[data-check="' + key + '"]');
      var row = item && item.querySelector('.check__row');
      var name = item && item.querySelector('.check__name');
      var result = item && item.querySelector('.check__result');
      var mark = item && item.querySelector('.check__icon');
      if (!row || !name || !result || !mark) return;

      var id = 'check-how-' + key;
      var button = el('button', 'check__toggle');
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', id);
      var status = el('span', 'visually-hidden');
      add(button, [mark, name, status, result, chevron()]);
      row.parentNode.replaceChild(button, row);

      var panel = el('div', 'check__ev');
      panel.id = id;
      panel.hidden = true;
      var body = el('div', 'check__ev-body');
      panel.appendChild(body);
      item.appendChild(panel);

      rows[key] = { item: item, button: button, icon: mark, status: status, result: result, panel: panel, body: body, state: '' };
      button.addEventListener('click', function () {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        if (open && canAnimate()) {
          panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE });
        }
      });
    });

    if (!Object.keys(rows).length) return;

    function render(results) {
      var tally = { pass: 0, fail: 0, info: 0 };
      ORDER.forEach(function (key) {
        var row = rows[key];
        var found = results[key];
        if (!row || !found) return;
        tally[found.state] += 1;
        if (row.state !== found.state) {
          var fresh = icon(found.state);
          row.button.replaceChild(fresh, row.icon);
          row.icon = fresh;
          row.state = found.state;
          row.item.setAttribute('data-state', found.state);
        }
        row.status.textContent = ', ' + SAY[found.state] + ': ';
        row.result.textContent = found.result;
        clear(row.body);
        add(row.body, found.ev);
      });
      var line = tally.pass + ' of ' + (tally.pass + tally.fail) + ' passed';
      if (tally.info) line += ', ' + tally.info + ' not checked here';
      if (sum) sum.textContent = line;
      // The case file layer reads the tally from here (casefile.js places the stamp from it), so
      // no copy can claim a result the checks did not produce.
      card.setAttribute('data-pass', tally.pass);
      card.setAttribute('data-fail', tally.fail);
      card.setAttribute('data-info', tally.info);
      try {
        card.dispatchEvent(new CustomEvent('check:done', { bubbles: true, detail: { pass: tally.pass, fail: tally.fail, info: tally.info, line: line } }));
      } catch (e) {}
      if (when) {
        clear(when);
        add(when, ['Checked in your browser at ', stamp()]);
      }
      return line;
    }

    function collect() {
      var results = Object.create(null);
      ORDER.forEach(function (key) {
        if (!rows[key]) return;
        try {
          results[key] = CHECKS[key]();
        } catch (e) {
          results[key] = {
            state: 'info',
            result: 'Couldn’t run in this browser',
            ev: [para('This browser stopped the check before it finished, so there is no result to show.')]
          };
        }
      });
      return results;
    }

    function signOf(results) {
      return ORDER.map(function (key) {
        return results[key] ? results[key].state + ':' + results[key].result : '';
      }).join('|');
    }

    function runChecks() {
      var results = collect();
      signature = signOf(results);
      return render(results);
    }

    /* Motion. The results are on the page before any of it starts, and none of it repeats. */

    function play(node, frames, options) {
      if (node && typeof node.animate === 'function') motion.push(node.animate(frames, options));
    }

    function stopMotion() {
      motion.forEach(function (animation) {
        animation.cancel();
      });
      motion = [];
    }

    // A mark draws its stroke; a dot fades in once the stroke is under way.
    function draw(mark, delay, duration) {
      var stroke = mark.querySelector('.check__mark');
      var dot = mark.querySelector('.check__dot');
      if (stroke) {
        play(stroke, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: duration,
          delay: delay,
          easing: EASE,
          fill: 'backwards'
        });
      }
      if (dot) {
        play(dot, [{ opacity: 0 }, { opacity: 1 }], {
          duration: Math.round(duration / 2),
          delay: delay + Math.round(duration * 0.45),
          easing: EASE,
          fill: 'backwards'
        });
      }
    }

    // On load, once: the rows settle into place in turn, each mark draws as its row lands, and the
    // tally fades in under them. Settled in under a second, then still.
    function settle() {
      if (!canAnimate()) return;
      stopMotion();
      var step = 70;
      var last = 0;
      if (when) play(when, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE, fill: 'backwards' });
      ORDER.forEach(function (key, i) {
        var row = rows[key];
        if (!row) return;
        var delay = i * step;
        last = delay;
        play(row.button, [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 380, delay: delay, easing: EASE, fill: 'backwards' });
        draw(row.icon, delay + 110, 340);
      });
      if (foot) {
        play(foot, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: last + 200, easing: EASE, fill: 'backwards' });
      }
    }

    // After Run the checks again: a quick redraw of the marks, under 400ms in all.
    function redraw() {
      if (!canAnimate()) return;
      stopMotion();
      ORDER.forEach(function (key, i) {
        if (rows[key]) draw(rows[key].icon, i * 30, 220);
      });
    }

    /* The script test, inside the policy row. */

    var policy = rows.policy;
    if (policy) {
      var tryIt = el('button', 'btn btn--secondary check__btn', 'Try to inject a script');
      tryIt.type = 'button';
      var outcome = el('div', 'check__outcome');
      outcome.hidden = true;
      // The tag name is kept apart from the brackets so this file can be inlined into a script
      // element (the preview copy does that) without closing it early.
      var tag = 'script';
      var payload = 'window.' + FLAG + ' = true;';
      policy.panel.appendChild(el('div', 'check__test', [
        para('This test adds an inline script to the page, then looks for the flag it sets:'),
        el('pre', 'check__pre', code('<' + tag + '>' + payload + '</' + tag + '>')),
        tryIt,
        outcome
      ]));

      document.addEventListener('securitypolicyviolation', function (event) {
        var directive = String(event.effectiveDirective || event.violatedDirective || '');
        if (!waiting || directive.indexOf('script-src') !== 0) return;
        var done = waiting;
        waiting = null;
        done(event);
      });

      tryIt.addEventListener('click', function () {
        var hasPolicy = !!findPolicy();
        var at = stamp();
        waiting = null;

        // The test itself: add an inline script, look for its flag at once, then remove both.
        var script = document.createElement(tag);
        script.textContent = payload;
        (document.head || document.documentElement).appendChild(script);
        var ran = window[FLAG] === true;
        if (script.parentNode) script.parentNode.removeChild(script);
        try {
          delete window[FLAG];
        } catch (e) {
          window[FLAG] = undefined;
        }

        var state;
        var lines;
        var message;
        if (!ran && hasPolicy) {
          state = 'pass';
          lines = [para([el('strong', null, 'Blocked by the policy'), ' at ', at, '. The script never ran, so the flag was never set.'])];
          message = 'Blocked by the policy.';
        } else if (ran && !hasPolicy) {
          state = 'info';
          lines = [
            para([el('strong', null, 'It ran'), ' at ', at, ', because this preview doesn’t carry the site’s policy. The live site blocks it.']),
            para('The test removed its script and the flag right away.')
          ];
          message = 'The script ran, because this preview doesn’t carry the site’s policy. The live site blocks it.';
        } else if (ran) {
          state = 'fail';
          lines = [
            para([el('strong', null, 'It ran'), ' at ', at, '. The policy didn’t stop it.']),
            para('The test removed its script and the flag right away.')
          ];
          message = 'The script ran. The policy didn’t stop it.';
        } else {
          state = 'info';
          lines = [para([el('strong', null, 'Blocked'), ' at ', at, ', by rules from outside this page.'])];
          message = 'Blocked, by rules from outside this page.';
        }

        clear(outcome);
        outcome.setAttribute('data-state', state);
        var mark = icon(state);
        var text = el('div', 'check__outcome-text', lines);
        add(outcome, [mark, text]);
        outcome.hidden = false;
        if (canAnimate()) {
          draw(mark, 0, 260);
          play(outcome, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE });
        }

        if (ran) {
          announce(message);
          return;
        }
        // The browser reports the refusal a moment later, as a securitypolicyviolation event.
        var mine = function (event) {
          var report = [
            ['effectiveDirective', event.effectiveDirective || event.violatedDirective],
            ['blockedURI', event.blockedURI],
            ['disposition', event.disposition]
          ].filter(function (pair) {
            return !!pair[1];
          }).map(function (pair) {
            return [pair[0], quote(pair[1])];
          });
          add(text, [
            para('Your browser reported the refusal and logged it in its console:'),
            readout(report)
          ]);
          announce(message + ' Your browser also logged the refusal in its console.');
        };
        waiting = mine;
        setTimeout(function () {
          if (waiting !== mine) return;
          waiting = null;
          announce(message);
        }, 600);
      });
    }

    if (again) {
      again.addEventListener('click', function () {
        var line = runChecks();
        redraw();
        announce('Checks finished, ' + line + '.');
      });
    }

    runChecks();
    if (foot) foot.hidden = false;
    settle();

    // A file still on its way when the checks first ran is counted once the page has loaded; the
    // card updates quietly, and only if a result changed.
    function quietly() {
      var results = collect();
      var sign = signOf(results);
      if (sign === signature) return;
      signature = sign;
      render(results);
    }

    if (document.readyState !== 'complete') {
      window.addEventListener('load', quietly, { once: true });
    }

    // Coming back to the page from the browser’s cache runs the checks again, quietly.
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) runChecks();
    });
  }

  function start() {
    var card = document.querySelector('.check');
    if (!card || card.querySelector('.check__toggle')) return;
    try {
      build(card);
    } finally {
      // With scripts on, check.css keeps the rows unseen until this moment, the same task that
      // starts their settle, so they never flash their before state first.
      card.classList.add('is-live');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
