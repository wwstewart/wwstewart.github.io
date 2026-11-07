/*
  visit.js: your visit, as a security operations center would see it. A tab in the corner counts
  events as they happen; the panel shows the verdict, then the log: page load, the seal, the live
  check, where you scrolled, tab switches, copies, prints, keyboard use, opened drawers, and so
  on, each with the rule that noticed it and a severity that never rises above low. The log lives
  in memory in this tab and nowhere else: nothing is stored, nothing is sent, and Wipe clears it.
  Other scripts report through visit:note events; this file never reaches into them.
*/
(function () {
  'use strict';

  var doc = document;
  if (!doc.body || !doc.createElement || !('querySelector' in doc)) return;

  var start = Date.now();
  var events = [];
  var seen = Object.create(null);
  var open = false;
  var toastTimer = 0;
  var hiddenAt = 0;
  var idleTimer = 0;

  function el(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clock(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /* The tab and the panel */

  var tab = el('button', 'visit-tab');
  tab.type = 'button';
  tab.setAttribute('aria-expanded', 'false');
  tab.setAttribute('aria-controls', 'visit-panel');
  tab.appendChild(el('span', 'visit-tab__dot'));
  tab.appendChild(el('span', null, 'Your visit'));
  var count = el('span', 'visit-tab__count', '0');
  tab.appendChild(count);
  var last = el('span', 'visit-tab__last');
  last.setAttribute('aria-hidden', 'true');
  tab.appendChild(last);

  var panel = el('aside', 'visit');
  panel.id = 'visit-panel';
  panel.setAttribute('aria-labelledby', 'visit-title');
  var head = el('div', 'visit__head');
  var title = el('h2', null, 'Your visit, as a SOC sees it');
  title.id = 'visit-title';
  var close = el('button', 'btn btn--secondary visit__close', 'Close');
  close.type = 'button';
  head.appendChild(title);
  head.appendChild(close);
  panel.appendChild(head);
  panel.appendChild(el('p', 'visit__note', 'Logged in your browser only, in memory, by the page itself. Nothing is sent anywhere, and Wipe clears it. The Network tab of your developer tools shows that no request leaves.'));
  var verdict = el('div', 'visit__verdict');
  verdict.appendChild(el('span', 'label', 'Verdict'));
  var line = el('strong', 'visit__line', 'New visitor · 0 events · 0 alerts');
  var since = el('span', 'meta visit__since', 'Session started just now');
  verdict.appendChild(line);
  verdict.appendChild(since);
  panel.appendChild(verdict);
  var table = el('table', 'visit__log');
  var thead = el('thead');
  var hr = el('tr');
  ['Time', 'Event', 'Rule', 'Severity'].forEach(function (h) {
    hr.appendChild(el('th', null, h));
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = el('tbody');
  table.appendChild(tbody);
  panel.appendChild(table);
  panel.appendChild(el('p', 'visit__note', 'Severity never goes above low on this site. The scale is here to show how triage reads a session: baseline is the page doing its job, reader is you reading, curious is you looking under the hood, intent is a step toward getting in touch.'));
  var foot = el('div', 'visit__foot');
  var wipe = el('button', 'btn btn--secondary visit__wipe', 'Wipe this log');
  wipe.type = 'button';
  foot.appendChild(wipe);
  var how = el('a', 'link');
  how.href = 'trust.html#visit';
  var howText = el('span', 'u', 'How this works');
  how.appendChild(howText);
  foot.appendChild(how);
  panel.appendChild(foot);
  panel.inert = true;

  doc.body.appendChild(tab);
  doc.body.appendChild(panel);

  function empty() {
    var row = el('tr', 'visit__empty');
    var cell = el('td', null, 'Nothing yet. The log fills as you read.');
    cell.colSpan = 4;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function render(entry) {
    var placeholder = tbody.querySelector('.visit__empty');
    if (placeholder) tbody.removeChild(placeholder);
    var row = el('tr', 'is-new');
    row.appendChild(el('td', null, clock(entry.t)));
    row.appendChild(el('td', null, entry.text));
    row.appendChild(el('td', null, entry.rule + (entry.heuristic ? ' (heuristic)' : '')));
    var sev = el('td');
    sev.appendChild(el('span', 'visit__sev' + (entry.sev === 'low' ? ' visit__sev--low' : ''), entry.sev));
    row.appendChild(sev);
    tbody.insertBefore(row, tbody.firstChild);
    while (tbody.children.length > 80) tbody.removeChild(tbody.lastChild);
  }

  function label() {
    var rules = Object.create(null);
    events.forEach(function (e) {
      rules[e.rule] = (rules[e.rule] || 0) + 1;
    });
    if (rules.intent) return 'Likely to reach out';
    if ((rules.curious || 0) >= 2) return 'Curious reader';
    if (rules.reader) return 'Reader';
    return 'New visitor';
  }

  function tally() {
    var n = events.length;
    count.textContent = String(n);
    line.textContent = label() + ' · ' + n + (n === 1 ? ' event' : ' events') + ' · 0 alerts';
    since.textContent = 'Session started ' + clock(Date.now() - start) + ' ago';
  }

  function log(text, rule, sev, heuristic) {
    var entry = { t: Date.now() - start, text: text, rule: rule || 'curious', sev: sev || 'info', heuristic: !!heuristic };
    events.push(entry);
    render(entry);
    tally();
    last.textContent = text;
    // The first seconds belong to the opening, so early rows go in quietly.
    if (Date.now() - start < 2800) return;
    tab.classList.remove('is-bump');
    void tab.offsetWidth;
    tab.classList.add('is-bump', 'is-toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      tab.classList.remove('is-toast');
    }, 2600);
  }

  function once(key, text, rule, sev, heuristic) {
    if (seen[key]) return;
    seen[key] = true;
    log(text, rule, sev, heuristic);
  }

  function show() {
    open = true;
    panel.inert = false;
    panel.classList.add('is-open');
    tab.setAttribute('aria-expanded', 'true');
    tally();
    once('panel', 'Opened this panel', 'curious', 'info');
    close.focus();
  }

  function hide() {
    open = false;
    panel.classList.remove('is-open');
    panel.inert = true;
    tab.setAttribute('aria-expanded', 'false');
    tab.focus();
  }

  tab.addEventListener('click', function () {
    if (open) hide();
    else show();
  });
  close.addEventListener('click', hide);
  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && open) hide();
  });
  wipe.addEventListener('click', function () {
    events = [];
    seen = Object.create(null);
    seen.panel = true;
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    empty();
    tally();
    last.textContent = 'Log wiped';
    tab.classList.add('is-toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      tab.classList.remove('is-toast');
    }, 2000);
  });

  setInterval(function () {
    if (open) since.textContent = 'Session started ' + clock(Date.now() - start) + ' ago';
  }, 5000);

  /* What gets logged */

  empty();
  log('Page loaded over ' + (location.protocol === 'https:' ? 'HTTPS' : 'plain http, not encrypted'), 'baseline', 'info');

  var card = doc.querySelector('.check[data-pass]');
  if (card) {
    once('check', 'Security check ran: ' + card.getAttribute('data-pass') + ' of ' +
      (+card.getAttribute('data-pass') + +card.getAttribute('data-fail')) + ' passed', 'baseline', 'info');
  }
  var checkLine = card ? card.getAttribute('data-pass') + ' of ' +
    (+card.getAttribute('data-pass') + +card.getAttribute('data-fail')) + ' passed' : '';
  doc.addEventListener('check:done', function (event) {
    var d = event.detail || {};
    // check.js renders twice on load (once at once, once after the last file lands), so the same
    // result is one row; a changed result gets its own row.
    if (!seen.check) once('check', 'Security check ran: ' + d.line, 'baseline', 'info');
    else if (d.line && d.line !== checkLine) log('Security check updated: ' + d.line, 'baseline', 'info');
    checkLine = d.line || checkLine;
  });
  doc.addEventListener('seal:drawn', function (event) {
    var d = event.detail || {};
    once('seal', 'Seal drawn from ' + (d.signals || 11) + ' signals, ' + (d.id || ''), 'baseline', 'info');
  });
  doc.addEventListener('visit:note', function (event) {
    var d = event.detail || {};
    if (d.text) log(d.text, d.rule, d.sev, d.heuristic);
  });

  if ('IntersectionObserver' in window) {
    var sections = doc.querySelectorAll('main section[id]');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var sec = entry.target;
        var h = sec.querySelector('h2, h1');
        var name = h ? h.textContent.replace(/\s+/g, ' ').trim() : sec.id;
        once('sec:' + sec.id, 'Scrolled to ' + name, 'reader', 'info');
        io.unobserve(sec);
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(sections, function (sec) {
      if (sec.classList.contains('hero') || sec.classList.contains('cover')) return;
      io.observe(sec);
    });
  }

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) hiddenAt = Date.now();
    else if (hiddenAt) {
      var s = Math.round((Date.now() - hiddenAt) / 1000);
      hiddenAt = 0;
      log('Tab hidden for ' + s + ' s, then back', 'reader', 'info');
    }
  });

  doc.addEventListener('copy', function () {
    var text = '';
    try {
      text = String(window.getSelection());
    } catch (e) {}
    if (/@/.test(text)) log('Copied the email address', 'intent', 'low');
    else log('Copied text from the page', 'reader', 'info');
  });

  window.addEventListener('beforeprint', function () {
    log('Printed or previewed the page', 'intent', 'low');
  });

  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Tab') once('kbd', 'Navigated by keyboard', 'reader', 'info');
  });

  doc.addEventListener('contextmenu', function () {
    once('ctx', 'Opened the context menu', 'curious', 'info');
  });

  var selTimer = 0;
  doc.addEventListener('selectionchange', function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var text = '';
      try {
        text = String(window.getSelection());
      } catch (e) {}
      if (text.length > 24) once('sel', 'Selected a passage of text', 'reader', 'info');
    }, 600);
  });

  function devtools() {
    var wide = (window.outerWidth - window.innerWidth) > 180;
    var tall = (window.outerHeight - window.innerHeight) > 220;
    if (wide || tall) once('devtools', 'Developer tools possibly open', 'curious', 'low', true);
  }
  setTimeout(devtools, 1200);
  var rsTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(devtools, 400);
  }, { passive: true });

  function awake() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      once('idle', 'Went quiet for 45 s', 'reader', 'info');
    }, 45000);
  }
  ['pointermove', 'keydown', 'scroll', 'pointerdown'].forEach(function (name) {
    doc.addEventListener(name, awake, { passive: true });
  });
  awake();
})();
