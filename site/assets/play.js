/*
  play.js: the play layer. Two buttons in the bottom left corner: a UV light that darkens the page
  to a beam around the pointer and reveals notes written in invisible ink (the .ink elements), and
  a console for the case file (type help). The console also checks the six flags hidden around the
  site, by hashing what you type with SHA 256 and comparing the digest. Nothing is stored or sent;
  a reload forgets the flags you found. With reduced motion on, the beam still works (it is light,
  not motion). Hyphens in the output are code, as in any shell.
*/
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var EMAIL = 'wstewart.w06@gmail.com';

  function el(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function emit(name, detail) {
    try {
      doc.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail || {} }));
    } catch (e) {}
  }

  function note(text, rule, sev) {
    emit('visit:note', { text: text, rule: rule || 'curious', sev: sev || 'info' });
  }

  function typing(target) {
    return !!(target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function page() {
    var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return file === '' ? 'index.html' : file;
  }

  /* The buttons */

  var tabs = el('div', 'play-tabs');
  var uvTab = el('button', 'play-tab uv-tab');
  uvTab.type = 'button';
  uvTab.setAttribute('aria-pressed', 'false');
  uvTab.setAttribute('data-cursor', 'UV');
  uvTab.title = 'UV light. Shortcut: U';
  uvTab.innerHTML = '<svg class="play-tab__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 2h6l1 5-4 11-4-11z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 11v7M4 9l-2 1M16 9l2 1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>UV light</span>';
  var conTab = el('button', 'play-tab console-tab');
  conTab.type = 'button';
  conTab.setAttribute('aria-expanded', 'false');
  conTab.setAttribute('aria-controls', 'console');
  conTab.setAttribute('data-cursor', 'Console');
  conTab.title = 'Console. Shortcut: the ` key';
  conTab.innerHTML = '<svg class="play-tab__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 6l4 4-4 4M10 14h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Console</span><span class="play-tab__count" data-flag-count hidden>0/6</span>';
  tabs.appendChild(uvTab);
  tabs.appendChild(conTab);
  body.appendChild(tabs);

  /* UV light */

  var veil = el('div', 'uv-veil');
  veil.setAttribute('aria-hidden', 'true');
  body.appendChild(veil);
  // The ink notes sit inside the page, under the veil, so while the light is on each one gets a
  // twin in a layer above the veil, placed over it every frame. The twins are what glows.
  var layer = el('div', 'uv-ink');
  layer.setAttribute('aria-hidden', 'true');
  body.appendChild(layer);
  var uv = false, ux = -1000, uy = -1000, uvRaf = 0, twins = [];
  var inks = doc.querySelectorAll('.ink');

  function beam() {
    uvRaf = 0;
    veil.style.setProperty('--ux', ux + 'px');
    veil.style.setProperty('--uy', uy + 'px');
    twins.forEach(function (pair) {
      var r = pair.ink.getBoundingClientRect();
      var w = pair.ink.offsetWidth, h = pair.ink.offsetHeight;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      pair.twin.style.left = (cx - w / 2) + 'px';
      pair.twin.style.top = (cy - h / 2) + 'px';
      pair.twin.style.width = (w + 1) + 'px';
      var d = Math.sqrt((cx - ux) * (cx - ux) + (cy - uy) * (cy - uy));
      var glow = Math.max(0, Math.min(1, 1 - (d - 70) / 110));
      pair.twin.style.setProperty('--glow', glow.toFixed(2));
    });
  }

  function queueBeam() {
    if (!uv || uvRaf) return;
    uvRaf = requestAnimationFrame(beam);
  }

  function uvOn() {
    if (uv) return;
    uv = true;
    root.classList.add('uv');
    uvTab.setAttribute('aria-pressed', 'true');
    if (ux < 0) {
      ux = window.innerWidth / 2;
      uy = window.innerHeight / 2;
    }
    twins = [];
    Array.prototype.forEach.call(inks, function (ink) {
      var twin = el('span', 'ink ink--twin', ink.textContent);
      twin.style.transform = getComputedStyle(ink).transform;
      twin.style.whiteSpace = getComputedStyle(ink).whiteSpace;
      layer.appendChild(twin);
      twins.push({ ink: ink, twin: twin });
    });
    queueBeam();
    note('Turned on the UV light', 'curious', 'info');
  }

  function uvOff() {
    if (!uv) return;
    uv = false;
    root.classList.remove('uv');
    uvTab.setAttribute('aria-pressed', 'false');
    twins = [];
    while (layer.firstChild) layer.removeChild(layer.firstChild);
  }

  uvTab.addEventListener('click', function () {
    if (uv) uvOff();
    else uvOn();
  });
  doc.addEventListener('pointermove', function (event) {
    ux = event.clientX;
    uy = event.clientY;
    queueBeam();
  }, { passive: true });
  doc.addEventListener('scroll', queueBeam, { passive: true });
  window.addEventListener('resize', queueBeam, { passive: true });
  doc.addEventListener('focusin', function (event) {
    if (!uv || !event.target.getBoundingClientRect) return;
    var r = event.target.getBoundingClientRect();
    if (!r.width && !r.height) return;
    ux = r.left + r.width / 2;
    uy = r.top + r.height / 2;
    queueBeam();
  });

  /* Flags */

  var FLAGS = [
    { hash: 'ca137ac3779366bb4db9d0861cb294328ae072261c07097e55eb1f9c167a494f', hint: 'Flag 1 is in the source of the cover. View source, or save the page and read it.' },
    { hash: 'd254dfda0ce2937d9b7b5024e30c10303adfa032574aea2507d85900df146972', hint: 'Flag 2 is written in invisible ink. Turn on the UV light and sweep the cover.' },
    { hash: '725a1be0e6c02c1620fdf1655a3c3dad5a90a61fc558f039697e122c9abab594', hint: 'Flag 3 is a hidden file in this console. Shells have a way to list those.' },
    { hash: 'a5c666ac1c7c9165902e65e09f40d660805df9d195904223d92342d9550b72df', hint: 'Flag 4: Inspect mode explains every part of the cover, and one note says more than it should.' },
    { hash: '672d1bf4449aa43da7e5cc4422ccd2bda2fae23dd18645a7024a9442b909cb8f', hint: 'Flag 5: every well kept site has a security.txt. Read the whole file.' },
    { hash: 'd483040522f7915a2509fbdd78283cc93bc2e491ddfc10391bea01d5b31e887d', hint: 'Flag 6: open your browser’s developer tools and read its console.' }
  ];
  var found = [];
  var flagCount = conTab.querySelector('[data-flag-count]');

  function hex(buffer) {
    var bytes = new Uint8Array(buffer), out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }

  function sha(text) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.reject(new Error('no subtle crypto'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex);
  }

  function progress() {
    return found.length + ' of 6 found';
  }

  try {
    console.log('%cCase file console%c  Flag 6 of 6: FLAG{devtools_open}  Submit it in the site console, bottom left corner, with: flag FLAG{devtools_open}', 'font-weight:bold;color:#c28d39', '');
    console.log('Nothing on this site is stored or sent. The Network tab shows no request leaving after the page loads.');
  } catch (e) {}

  /* The console */

  var panel = el('aside', 'console');
  panel.id = 'console';
  panel.setAttribute('aria-label', 'Case file console');
  var bar = el('div', 'console__bar');
  bar.appendChild(el('span', 'console__name', 'case file console'));
  bar.appendChild(el('span', 'console__sub', 'type help · Esc closes'));
  var close = el('button', 'console__close', 'Close');
  close.type = 'button';
  bar.appendChild(close);
  var out = el('div', 'console__out');
  out.setAttribute('role', 'log');
  out.setAttribute('aria-live', 'polite');
  var form = el('form', 'console__form');
  var prompt = el('label', 'console__prompt', 'visitor@casefile:~$');
  prompt.htmlFor = 'console-in';
  var input = el('input', 'console__in');
  input.id = 'console-in';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('aria-label', 'Command');
  form.appendChild(prompt);
  form.appendChild(input);
  panel.appendChild(bar);
  panel.appendChild(out);
  panel.appendChild(form);
  panel.inert = true;
  body.appendChild(panel);

  var open = false, history = [], cursor = -1, greeted = false, openedOnce = false;

  function line(text, cls) {
    var p = el('p', 'console__line' + (cls ? ' console__line--' + cls : ''));
    p.textContent = text;
    out.appendChild(p);
    while (out.children.length > 300) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    return p;
  }

  function linkLine(text, href, label) {
    var p = line(text + ' ');
    var a = el('a', 'console__link', label);
    a.href = href;
    p.appendChild(a);
    out.scrollTop = out.scrollHeight;
  }

  function show() {
    open = true;
    panel.inert = false;
    panel.classList.add('is-open');
    conTab.setAttribute('aria-expanded', 'true');
    if (!greeted) {
      greeted = true;
      line('William Stewart · case file console', 'head');
      line('Type help to see what it can do. The six flags hidden on this site are checked here.');
      line('Flags: ' + progress(), 'muted');
    }
    input.focus();
    if (!openedOnce) {
      openedOnce = true;
      note('Opened the console', 'curious', 'info');
    }
  }

  function hide() {
    open = false;
    panel.classList.remove('is-open');
    panel.inert = true;
    conTab.setAttribute('aria-expanded', 'false');
    conTab.focus();
  }

  conTab.addEventListener('click', function () {
    if (open) hide();
    else show();
  });
  close.addEventListener('click', hide);

  var EXHIBITS = [
    ['00', 'This site', 'index.html#ex-00'],
    ['01', 'Click Bond internship', 'clickbond.html'],
    ['02', 'Chapter website', 'index.html#ex-02'],
    ['03', 'Healthcare breach dashboard', 'index.html#ex-03'],
    ['04', 'Network design scenarios', 'index.html#ex-04'],
    ['05', 'Relational database', 'index.html#ex-05'],
    ['06', 'How I use AI', 'ai.html']
  ];
  var PAGES = { cover: 'index.html', home: 'index.html', index: 'index.html', trust: 'trust.html', plain: 'plain.html', resume: 'plain.html', ai: 'ai.html', clickbond: 'clickbond.html', console: '' };

  function pad(text, width) {
    while (text.length < width) text += ' ';
    return text;
  }

  var COMMANDS = {
    help: function () {
      line('Commands:', 'head');
      [
        ['help', 'this list'],
        ['ls', 'list the exhibits and pages (ls -a shows hidden files)'],
        ['open <n|page>', 'open an exhibit or a page: open 01, open trust, open plain'],
        ['cat <file>', 'read a file: cat resume, cat security.txt'],
        ['scan', 'run the live security check and print the tally'],
        ['seal', 'what the seal on the cover is and where it comes from'],
        ['whoami', 'how the Your visit panel reads your session'],
        ['uv', 'switch the UV light on or off'],
        ['flag FLAG{...}', 'submit a flag'],
        ['flags', 'what you have found so far'],
        ['hint', 'a hint for the next flag'],
        ['clear', 'clear this screen'],
        ['exit', 'close the console']
      ].forEach(function (row) {
        line('  ' + pad(row[0], 16) + row[1]);
      });
    },
    ls: function (args) {
      line('exhibits/', 'head');
      EXHIBITS.forEach(function (ex) {
        line('  ' + ex[0] + '  ' + pad(ex[1], 30) + ex[2], 'muted');
      });
      line('pages/', 'head');
      line('  cover  trust  ai  plain  resume.txt  .well-known/security.txt', 'muted');
      if (args[0] === '-a' || args[0] === '-la' || args[0] === '-al') {
        line('hidden/', 'head');
        line('  .flag', 'muted');
      }
    },
    cat: function (args) {
      var name = (args[0] || '').toLowerCase().replace(/^\.\//, '');
      if (!name) return line('cat: name a file. Try cat resume, cat security.txt, or ls -a.', 'err');
      if (name === '.flag') {
        line('Flag 3 of 6: FLAG{shell_access}', 'ok');
        line('Submit it with: flag FLAG{shell_access}', 'muted');
        return;
      }
      if (name === 'resume' || name === 'resume.txt' || name === 'plain') {
        line('William Stewart · Cincinnati, Ohio · ' + EMAIL, 'head');
        line('Cybersecurity student at the University of Cincinnati (class of 2029), looking for an IT internship.');
        line('IT intern at Click Bond, summer 2026: information security, networking, and infrastructure.');
        line('Available full time from December 14, 2026 through spring 2027, and summer 2027.');
        linkLine('The whole thing:', 'plain.html', 'plain.html');
        return;
      }
      if (name === 'security.txt' || name === '.well-known/security.txt') {
        line('The site’s policy forbids requests, even to itself, so this console cannot read files. Open it:', 'muted');
        linkLine('', '.well-known/security.txt', '.well-known/security.txt');
        return;
      }
      line('cat: ' + args[0] + ': no such file. ls shows what is here.', 'err');
    },
    open: function (args) {
      var what = (args[0] || '').toLowerCase().replace(/^#?ex-/, '');
      if (!what) return line('open: say what to open. Try open 01, open trust, or open plain.', 'err');
      var href = '';
      EXHIBITS.forEach(function (ex) {
        if (ex[0] === what || ex[0] === '0' + what) href = ex[2];
      });
      if (!href && PAGES[what] !== undefined) href = PAGES[what];
      if (!href) return line('open: nothing called ' + args[0] + '. ls lists what there is.', 'err');
      line('Opening ' + href, 'muted');
      note('Opened ' + href + ' from the console', 'reader', 'info');
      setTimeout(function () {
        location.href = href;
      }, 200);
    },
    scan: function () {
      var card = doc.querySelector('.check');
      if (!card) return line('No check card on this page. The cover and the trust center run one; try open trust.', 'err');
      var again = card.querySelector('[data-check-again]');
      if (again) again.click();
      var pass = card.getAttribute('data-pass'), fail = card.getAttribute('data-fail'), info = card.getAttribute('data-info');
      if (pass === null) return line('The check has not finished yet. Try again in a moment.', 'err');
      line('Security check: ' + pass + ' passed, ' + fail + ' failed, ' + info + ' not checked here', 'head');
      Array.prototype.forEach.call(card.querySelectorAll('.check__item'), function (item) {
        var name = item.querySelector('.check__name'), result = item.querySelector('.check__result');
        line('  ' + pad((item.getAttribute('data-state') || '').toUpperCase(), 6) + pad(name ? name.textContent.trim() : '', 18) + (result ? result.textContent.trim() : ''), item.getAttribute('data-state') === 'fail' ? 'err' : 'muted');
      });
    },
    seal: function () {
      var id = doc.querySelector('[data-seal-id]');
      if (!id) return line('No seal on this page. The cover and the trust center carry one.', 'err');
      line(id.textContent.trim(), 'head');
      line('Drawn in your browser from eleven signals it gives every site, hashed with SHA 256. Nothing is stored or sent.');
      linkLine('The signals, live:', 'trust.html#seal', 'trust.html#seal');
    },
    whoami: function () {
      var verdict = doc.querySelector('.visit__line');
      line('visitor', 'head');
      if (verdict) line('The visit panel reads your session as: ' + verdict.textContent.trim());
      line('Known: nothing. No cookie, no storage, no request to anyone. Close the tab and this session is gone.', 'muted');
    },
    uv: function () {
      if (uv) {
        uvOff();
        line('UV light off.', 'muted');
      } else {
        uvOn();
        line('UV light on. Sweep the page; the notes in invisible ink glow near the beam. Esc turns it off.', 'ok');
      }
    },
    flag: function (args) {
      var text = args.join(' ').trim();
      var m = /flag\{([^}]*)\}/i.exec(text);
      if (!m) return line('A flag looks like FLAG{something}. Submit one with: flag FLAG{something}', 'err');
      var flag = 'FLAG{' + m[1].toLowerCase() + '}';
      sha(flag).then(function (digest) {
        var index = -1;
        FLAGS.forEach(function (f, i) {
          if (f.hash === digest) index = i;
        });
        if (index < 0) return line('Not a flag of this file: ' + flag, 'err');
        if (found.indexOf(index) >= 0) return line('Flag ' + (index + 1) + ' of 6 is already in. ' + progress() + '.', 'muted');
        found.push(index);
        flagCount.textContent = found.length + '/6';
        flagCount.hidden = false;
        line('Flag ' + (index + 1) + ' of 6 accepted. ' + progress() + '.', 'ok');
        note('Found flag ' + (index + 1) + ' of 6', 'curious', 'low');
        if (found.length === FLAGS.length) cleared();
      }, function () {
        line('This browser cannot hash the flag here (SHA 256 needs a secure connection). Open the site over HTTPS.', 'err');
      });
    },
    flags: function () {
      line('Flags: ' + progress(), 'head');
      FLAGS.forEach(function (f, i) {
        line('  ' + (i + 1) + '  ' + (found.indexOf(i) >= 0 ? 'found' : 'not yet'), found.indexOf(i) >= 0 ? 'ok' : 'muted');
      });
      if (found.length < FLAGS.length) line('hint gives you a lead on the next one.', 'muted');
    },
    hint: function () {
      for (var i = 0; i < FLAGS.length; i++) {
        if (found.indexOf(i) < 0) return line(FLAGS[i].hint, 'ok');
      }
      line('All six are in. Nothing left to hint.', 'ok');
    },
    clear: function () {
      while (out.firstChild) out.removeChild(out.firstChild);
    },
    exit: function () {
      hide();
    },
    pwd: function () {
      line('/case-file/' + page());
    },
    echo: function (args) {
      line(args.join(' '));
    },
    date: function () {
      line(new Date().toString());
    },
    whois: function () {
      line('William Stewart', 'head');
      line('Cybersecurity student, University of Cincinnati. IT intern at Click Bond, summer 2026. Cincinnati, Ohio.');
      linkLine('Email:', 'mailto:' + EMAIL, EMAIL);
    },
    sudo: function () {
      line('Nothing here needs root. The whole site is static files, and this shell is a page script.', 'muted');
    },
    rm: function () {
      line('This site is read only, and so is this shell. Nothing to delete, and no way to.', 'muted');
    },
    ping: function () {
      line('pong. No request left your browser: the site’s policy forbids it, and the Network tab will show it.', 'muted');
    },
    man: function () {
      line('No manual pages. help is the whole manual.', 'muted');
    },
    nmap: function () {
      line('One host, one port, 443, serving static files. The interesting ports are on the cover: the seal, the check, the board.', 'muted');
    }
  };
  COMMANDS.close = COMMANDS.exit;
  COMMANDS.quit = COMMANDS.exit;
  COMMANDS.dir = COMMANDS.ls;
  COMMANDS.cls = COMMANDS.clear;
  COMMANDS['?'] = COMMANDS.help;

  function run(text) {
    var parts = text.trim().split(/\s+/);
    var cmd = (parts.shift() || '').toLowerCase();
    if (!cmd) return;
    line('visitor@casefile:~$ ' + text, 'in');
    if (COMMANDS[cmd]) {
      try {
        COMMANDS[cmd](parts);
      } catch (e) {
        line('That command failed in this browser.', 'err');
      }
    } else {
      line('command not found: ' + cmd + '. Type help.', 'err');
    }
  }

  function cleared() {
    line('CLEARED · all six flags found', 'cleared');
    line('The hall of fame on the trust center lists the first people to find something real. Tell me what you found:');
    linkLine('', 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Case file: all six flags'), 'email me the six flags');
    note('Found all six flags', 'intent', 'low');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value;
    if (!text.trim()) return;
    history.push(text);
    if (history.length > 50) history.shift();
    cursor = history.length;
    input.value = '';
    run(text);
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowUp') {
      if (!history.length) return;
      cursor = Math.max(0, cursor - 1);
      input.value = history[cursor] || '';
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      cursor = Math.min(history.length, cursor + 1);
      input.value = history[cursor] || '';
      event.preventDefault();
    } else if (event.key === 'Tab') {
      var text = input.value.toLowerCase();
      if (!text || /\s/.test(text)) return;
      var names = Object.keys(COMMANDS).filter(function (name) {
        return name.indexOf(text) === 0;
      });
      if (names.length === 1) {
        input.value = names[0] + ' ';
        event.preventDefault();
      } else if (names.length > 1) {
        line(names.sort().join('  '), 'muted');
        event.preventDefault();
      }
    }
  });

  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (uv) {
        uvOff();
        return;
      }
      if (open && panel.contains(doc.activeElement)) hide();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
    if (event.key === '`' || event.key === '~') {
      event.preventDefault();
      if (open) hide();
      else show();
    } else if (event.key === 'u' || event.key === 'U') {
      if (uv) uvOff();
      else uvOn();
    }
  });

  root.classList.add('has-play');
})();
