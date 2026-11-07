/*
  inspect.js: Inspect mode. The header switch turns the page into its own blueprint: every major
  part gets a dashed outline and a name tag, and a panel shows why the part is built that way,
  live measurements (size, text, font, contrast), and the part's real start tag. Everything in the
  panel is read from the page at that moment, except the note. Nothing is stored or sent, and
  turning the mode off removes every node, class, and listener it added.
*/
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var toggle = doc.querySelector('.inspect-toggle');
  if (!toggle || !doc.body || !window.matchMedia || !Element.prototype.closest) return;

  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var SCAN_MS = 560;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  var ATTRS = ['id', 'class', 'role', 'type', 'href', 'target', 'rel', 'hidden', 'aria-label',
    'aria-labelledby', 'aria-current', 'aria-pressed', 'aria-expanded', 'aria-live'];

  // The parts, in no particular order (they are shown in page order). A note is a string, or a
  // function when its facts depend on the page it is on.
  var PARTS = [
    { sel: '.site-header', name: 'Header', note: headerNote },
    { sel: '.hero h1', name: 'Headline', note: 'Names the field and the goal in a few words, so a recruiter knows what this is before reading anything else.' },
    { sel: '.cover__seal', name: 'Seal', note: 'Drawn in your browser from eleven signals it gives every site, listed in full in the trust center. Nothing is stored or sent; with scripts off it is the file’s own seal.' },
    { sel: '.cover-facts', name: 'Availability', note: 'Dates sit near the top, because timing is the first filter for an internship.' },
    { sel: '.cover-check__aside', name: 'Why the check is here', note: 'Says what the live check is for, and why it runs in front of the visitor instead of being written in advance.' },
    { sel: '.board', name: 'Evidence board', note: 'The exhibits as cards you can drag, built from the rows below them so the two never disagree. The string joins exhibits that belong together; point at one to see why. Flag 4 of 6 for the curious: FLAG{inspect_everything}.' },
    { sel: '.index', name: 'Exhibit index', note: 'Stays in view while the exhibits scroll, like the tab edge of a file. Each number jumps to its exhibit.' },
    { sel: '.exhibit-list', name: 'Exhibits', note: 'One row per entry in the file. The pill on the right says what evidence the entry has: an outlined pill opens it, a plain one says what to ask for.' },
    { sel: '.custody', name: 'Chain of custody', note: 'When the work opened and closed, when it was filed here, and what is left out on purpose.' },
    { sel: '.rail', name: 'Page rail', note: 'The parts of this exhibit, and the questions it is ready for.' },
    { sel: '.trust-grid', name: 'Trust facts', note: 'The questions a security team asks a vendor, answered for one site. Each answer can be checked against the page: the live check reads several of them.' },
    { sel: '.seal-grid', name: 'What draws the seal', note: 'The eleven signals, read live and shown in full, so you see what the seal is made of and what it is not.' },
    { sel: '.check', name: 'Live security check', note: 'Runs in your browser on every visit, and every result is measured on the spot, not written in advance. Open a row to see exactly how it was checked.' },
    { sel: '.exp__text', name: 'Internship summary', note: 'One summer, May to August 2026, stated plainly, with the line that sums up what it taught.' },
    { sel: '.map', name: 'Work map', note: 'Each branch is one part of the internship, with the tools it used, if any. Point at a branch, or tap it, to trace the route.' },
    { sel: '.jobs', name: 'Earlier jobs', note: 'Work outside IT stays, kept short, because it shows a steady work history.' },
    { sel: '.projects', name: 'Projects', note: 'Each project says where it came from, and most say what it was built with. The last one is this site.' },
    { sel: '.skills .rows', name: 'Skills', note: 'Grouped the way IT teams split the work. Only tools actually used are listed.' },
    { sel: '.edu', name: 'Education', note: 'Degree, school, dates, and GPA first, then the courses that match IT roles.' },
    { sel: '.page-hero', name: 'Internship overview', note: 'Role, dates, place, and teams sit together at the top, so the basics take one glance.' },
    { sel: '.work-rows', name: 'What I worked on', note: 'One row per kind of work, each naming the tools or the team behind it.' },
    { sel: '.lesson', name: 'What I learned', note: 'The main lesson of the summer, and proof I’ve already relocated once for an internship.' },
    { sel: '.ai-hero', name: 'Disclosure', note: 'States up front that AI built this site, so nobody has to wonder who wrote what.' },
    { sel: '.ai-anatomy', name: 'Prompt breakdown', note: 'Real prompts, word for word, with only links and company names removed. Each marked phrase explains its job.' },
    { sel: '.ai-flow', name: 'Job search system', note: 'Each stage shows who does the work and, where there is one, the prompt that set it up.' },
    { sel: '.ai-trust', name: 'Trust checks', note: 'How outside tools and AI output get checked before anything is used or sent.' },
    { sel: '.ai-value', name: 'Why it matters', note: 'What this way of working means for an IT team.' },
    { sel: '.band', name: 'Contact', note: bandNote },
    { sel: '.site-footer', name: 'Footer', note: footerNote }
  ];

  // Notes whose facts are counted on the page they are on.
  function headerNote(el) {
    var links = el.querySelectorAll('.site-nav a').length;
    var buttons = el.querySelectorAll('a.btn, button.btn').length;
    var text = 'The name, ' + count(links, 'link') + ', this switch, and ' + count(buttons, 'button') + '.';
    if (el.querySelector('.skip')) text += ' A skip link comes first, so keyboard users can jump straight to the content.';
    return text;
  }

  function bandNote(el) {
    var copy = el.querySelector('[data-copy]');
    return 'One way to reach out, shown in full. The address is written out' +
      (copy && !copy.hidden ? ' with a copy button' : '') +
      ', because mail links don’t work for everyone.';
  }

  function footerNote(el) {
    return el.querySelector('.meta a[href$="ai.html"]') ?
      'Says who built the site, with a link to how.' :
      'Says who built the site. This page explains how.';
  }

  function count(n, noun) {
    return (WORDS[n] || String(n)) + ' ' + noun + (n === 1 ? '' : 's');
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Media queries are read live, never stored.
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  var mqWide = window.matchMedia('(min-width: 720px)');

  function reduced() {
    return mqReduce.matches;
  }

  // A polite live region that exists from load, empty, so announcements are heard reliably.
  var live = doc.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  doc.body.appendChild(live);

  // State for one session of the mode. All of it is dropped on leave.
  var active = false;
  var session = 0;
  var parts = [];
  var geo = [];
  var selected = -1;
  var hovered = -1;
  var layer = null;
  var panel = null;
  var ui = null;
  var scanLine = null;
  var observer = null;
  var frame = 0;
  var announceTimer = 0;
  var bound = [];
  var running = [];
  var fit = 0;
  var rechecks = 0;
  var hadClassAttr = false;

  toggle.hidden = false;
  toggle.addEventListener('click', function () {
    if (active) leave();
    else enter();
  });

  function listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    bound.push([target, type, fn, opts]);
  }

  function unlistenAll() {
    for (var i = 0; i < bound.length; i++) bound[i][0].removeEventListener(bound[i][1], bound[i][2], bound[i][3]);
    bound = [];
  }

  function make(tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(d, cls) {
    var svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function owned(node) {
    return (layer && layer.contains(node)) || (panel && panel.contains(node)) || node === live;
  }

  // Parts on this page, in page order. Parts that take no space are left out.
  function collect() {
    var found = [];
    PARTS.forEach(function (p) {
      var el = doc.querySelector(p.sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      found.push({ el: el, name: p.name, note: typeof p.note === 'function' ? p.note(el) : p.note });
    });
    found.sort(function (a, b) {
      return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return found;
  }

  // The innermost part holding a node (parts later in page order sit inside earlier ones).
  function partIndexFor(node) {
    var hit = -1;
    for (var i = 0; i < parts.length; i++) if (parts[i].el.contains(node)) hit = i;
    return hit;
  }

  /* Turning the mode on and off */

  function enter() {
    active = true;
    session += 1;
    var mine = session;
    parts = collect();
    selected = -1;
    hovered = -1;

    hadClassAttr = root.hasAttribute('class');
    root.classList.add('is-inspecting');
    toggle.setAttribute('aria-pressed', 'true');

    buildLayer();
    buildPanel();
    layout();

    listen(window, 'click', onClick, true);
    listen(window, 'auxclick', onClick, true);
    listen(window, 'keydown', onKey, true);
    listen(window, 'resize', schedule, { passive: true });
    listen(doc, 'pointerover', onPointerOver, { passive: true });
    listen(doc, 'pointerout', onPointerOut, { passive: true });
    listen(doc, 'focusin', onFocusIn);
    if (mqDark.addEventListener) {
      listen(mqDark, 'change', refresh);
      listen(mqFine, 'change', refresh);
    }
    if (window.ResizeObserver) {
      observer = new ResizeObserver(schedule);
      observer.observe(doc.body);
      parts.forEach(function (p) { observer.observe(p.el); });
    }
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () {
        if (active && session === mine) schedule();
      });
    }

    if (!reduced()) {
      sweep();
      play(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE });
    }

    ui.next.focus({ preventScroll: true });
    announce('Inspect mode on. ' + help() + ' Press Escape to leave.');
  }

  // how: 'scroll' moves focus to the switch and into view (keyboard), 'keep' moves it there
  // without scrolling (pointer). Left out, focus moves only if it was inside the panel.
  function leave(how) {
    if (!active) return;
    var focusWasInside = !!(panel && panel.contains(doc.activeElement));
    active = false;
    session += 1;
    unlistenAll();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    clearTimeout(announceTimer);
    running.slice().forEach(function (a) { a.cancel(); });
    running = [];
    [layer, panel, scanLine].forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    layer = panel = scanLine = ui = null;
    parts = [];
    geo = [];
    selected = hovered = -1;
    fit = 0;
    live.textContent = '';
    root.classList.remove('is-inspecting');
    if (!hadClassAttr && !root.classList.length) root.removeAttribute('class');
    toggle.setAttribute('aria-pressed', 'false');
    if (how === 'scroll') toggle.focus();
    else if (how === 'keep' || focusWasInside) toggle.focus({ preventScroll: true });
  }

  function help() {
    return (mqFine.matches ? 'Point at' : 'Tap') + ' any outlined part, or use Next part to step through the page.';
  }

  function announce(text) {
    clearTimeout(announceTimer);
    live.textContent = '';
    announceTimer = setTimeout(function () {
      live.textContent = text;
    }, 60);
  }

  function play(node, keyframes, options) {
    if (!node.animate) return null;
    var a = node.animate(keyframes, options);
    running.push(a);
    a.addEventListener('finish', function () {
      var i = running.indexOf(a);
      if (i > -1) running.splice(i, 1);
    });
    return a;
  }

  /* The overlay: one box and one tag per part */

  function buildLayer() {
    layer = make('div', 'insp-layer');
    layer.setAttribute('aria-hidden', 'true');
    geo = parts.map(function (p) {
      var box = make('div', 'insp-box');
      var tag = make('div', 'insp-tag');
      tag.appendChild(make('span', 'insp-tag__name', p.name));
      var size = make('span', 'insp-tag__size');
      tag.appendChild(size);
      if (p.el.matches('.band')) {
        box.classList.add('insp-box--band');
        tag.classList.add('insp-tag--band');
      }
      layer.appendChild(box);
      layer.appendChild(tag);
      return { box: box, tag: tag, size: size };
    });
    doc.body.appendChild(layer);
  }

  function schedule() {
    if (!active || frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      layout();
    });
  }

  function layout() {
    if (!active) return;
    var sx = window.pageXOffset;
    var sy = window.pageYOffset;
    var W = root.clientWidth;
    // The page's own height: the body holds everything in flow, and the layer is out of flow,
    // so its boxes can never stretch the page.
    var H = doc.body.offsetHeight;
    var EDGE = 2;
    var OUT = 6;
    var IN = 4;
    fit = 0;

    // Read everything first.
    var reads = parts.map(function (p, i) {
      var r = p.el.getBoundingClientRect();
      var g = geo[i];
      return {
        r: { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy, width: r.width, height: r.height },
        tagW: g.tag.offsetWidth - (g.size.offsetWidth ? g.size.offsetWidth + 8 : 0),
        tagH: g.tag.offsetHeight,
        textTop: firstTextTop(p.el, sy)
      };
    });

    // Then place: a box a few px outside each part (inside, for full width parts), and its tag
    // on the box's top edge, or inside its top corner, or under its bottom edge, wherever it
    // covers no text and no other tag.
    var placed = [];
    reads.forEach(function (d, i) {
      var r = d.r;
      var bleed = r.width >= W - 1;
      var box = bleed ?
        { left: Math.max(r.left + IN, EDGE), top: Math.max(r.top + IN, EDGE), right: Math.min(r.right - IN, W - EDGE), bottom: Math.min(r.bottom - IN, H - EDGE) } :
        { left: Math.max(r.left - OUT, EDGE), top: Math.max(r.top - OUT, EDGE), right: Math.min(r.right + OUT, W - EDGE), bottom: Math.min(r.bottom + OUT, H - EDGE) };
      var w = d.tagW;
      var h = d.tagH;
      var x = Math.max(EDGE, Math.min(box.left, W - EDGE - w));
      var above = { x: x, y: box.top - h + 1, place: 'above' };
      var inside = { x: x, y: box.top, place: 'inside' };
      var below = { x: x, y: box.bottom - 1, place: 'below' };
      var roomInside = d.textTop === null || d.textTop - box.top >= h + 6;
      var spots = bleed ? [inside, below, above] : [above, inside, below];
      var pick = null;
      for (var k = 0; k < spots.length && !pick; k++) {
        var s = spots[k];
        if (s.place === 'inside' && !roomInside) continue;
        if (s.y < 0 || s.y + h > H) continue;
        var clash = clashWith({ left: s.x, top: s.y, right: s.x + w, bottom: s.y + h }, placed);
        if (!clash) {
          pick = s;
          break;
        }
        // Slide along the edge past the tag in the way, if that still fits.
        var nx = clash.right + 8;
        if (nx + w <= W - EDGE && !clashWith({ left: nx, top: s.y, right: nx + w, bottom: s.y + h }, placed)) {
          pick = { x: nx, y: s.y, place: s.place };
        }
      }
      if (!pick) pick = bleed && roomInside ? inside : above;
      placed.push({ left: pick.x, top: pick.y, right: pick.x + w, bottom: pick.y + h });
      geo[i].rect = box;
      geo[i].tagRect = { left: pick.x, top: pick.y, right: pick.x + w, bottom: pick.y + h };
      geo[i].place = pick.place;
    });

    // Then write.
    layer.style.height = H + 'px';
    geo.forEach(function (g, i) {
      var b = g.rect;
      var s = g.box.style;
      s.left = b.left + 'px';
      s.top = b.top + 'px';
      s.width = Math.max(0, b.right - b.left) + 'px';
      s.height = Math.max(0, b.bottom - b.top) + 'px';
      g.tag.style.left = g.tagRect.left + 'px';
      g.tag.style.top = g.tagRect.top + 'px';
      g.tag.setAttribute('data-place', g.place);
      g.size.textContent = Math.round(reads[i].r.width) + ' × ' + Math.round(reads[i].r.height);
    });

    if (selected > -1) {
      showPart(selected);
      dock(selected);
    }
  }

  function clashWith(rect, placed) {
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      if (rect.left < p.right + 6 && rect.right > p.left - 6 && rect.top < p.bottom + 4 && rect.bottom > p.top - 4) return p;
    }
    return null;
  }

  // Page y of the first visible text in a part, so a tag set inside never covers it.
  function firstTextTop(el, sy) {
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var range = doc.createRange();
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      var host = n.parentElement;
      if (!n.nodeValue.trim() || !host || host.closest('noscript, script, style, template')) continue;
      var hr = host.getBoundingClientRect();
      if (hr.width < 2 || hr.height < 2) continue;
      range.selectNodeContents(n);
      var r = range.getBoundingClientRect();
      if (r.width >= 2 && r.height >= 2) return r.top + sy;
    }
    return null;
  }

  /* The scan line, once, on the way in */

  function sweep() {
    var vh = window.innerHeight;
    var line = make('div', 'insp-scan');
    line.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(line);
    scanLine = line;
    play(line, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (vh - 1) + 'px)' }], { duration: SCAN_MS, easing: EASE, fill: 'forwards' });
    var fade = play(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: SCAN_MS - 180, fill: 'forwards' });
    if (fade) {
      fade.addEventListener('finish', function () {
        if (line.parentNode) line.parentNode.removeChild(line);
        if (scanLine === line) scanLine = null;
      });
    }

    // Each outline in view appears as the line reaches it.
    var sy = window.pageYOffset;
    geo.forEach(function (g) {
      var top = Math.min(g.rect.top, g.tagRect.top) - sy;
      if (g.rect.bottom - sy < 0 || top > vh) return;
      var at = Math.round(timeAt(Math.min(Math.max(top / vh, 0), 1)) * SCAN_MS);
      var opts = { duration: 140, delay: at, easing: 'linear', fill: 'backwards' };
      play(g.box, [{ opacity: 0 }, { opacity: 1 }], opts);
      play(g.tag, [{ opacity: 0 }, { opacity: 1 }], opts);
    });
  }

  // When does a line moving on --ease reach progress p? For cubic-bezier(0.23, 1, 0.32, 1),
  // y(s) = 1 - (1 - s)^3, so s comes straight from p, and the time is x(s).
  function timeAt(p) {
    var s = 1 - Math.pow(1 - p, 1 / 3);
    var u = 1 - s;
    return 3 * u * u * s * 0.23 + 3 * u * s * s * 0.32 + s * s * s;
  }

  /* The panel */

  function buildPanel() {
    panel = make('div', 'insp-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Inspect mode');

    var bar = make('div', 'insp-panel__bar');
    var countLine = make('p', 'insp-panel__count');
    var leaveBtn = make('button', 'insp-panel__leave');
    leaveBtn.type = 'button';
    leaveBtn.appendChild(icon('M4 4l8 8M12 4l-8 8', 'insp-panel__leave-icon'));
    leaveBtn.appendChild(make('span', '', 'Leave Inspect mode'));
    leaveBtn.addEventListener('click', function (e) {
      leave(e.detail === 0 ? 'scroll' : 'keep');
    });
    bar.appendChild(countLine);
    bar.appendChild(leaveBtn);

    var body = make('div', 'insp-panel__body');
    var title = make('h2', 'insp-panel__title');
    var note = make('p', 'insp-panel__note');
    var facts = make('dl', 'insp-facts');
    var codeLabel = make('p', 'insp-label', 'Start tag');
    var pre = make('pre', 'insp-code');
    var code = make('code');
    pre.appendChild(code);
    [title, note, facts, codeLabel, pre].forEach(function (n) { body.appendChild(n); });

    var steps = make('div', 'insp-panel__steps');
    var prev = make('button', 'btn btn--secondary insp-step insp-step--prev');
    prev.type = 'button';
    prev.appendChild(icon('M13.5 8h-10M7.5 4l-4 4 4 4', 'insp-arrow'));
    prev.appendChild(make('span', '', 'Previous part'));
    var next = make('button', 'btn btn--secondary insp-step insp-step--next');
    next.type = 'button';
    next.appendChild(make('span', '', 'Next part'));
    next.appendChild(icon('M2.5 8h10M8.5 4l4 4-4 4', 'insp-arrow'));
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    steps.appendChild(prev);
    steps.appendChild(next);

    panel.appendChild(bar);
    panel.appendChild(body);
    panel.appendChild(steps);

    ui = {
      count: countLine, body: body, title: title, note: note, details: [facts, codeLabel, pre],
      facts: facts, pre: pre, code: code, prev: prev, next: next, leave: leaveBtn
    };

    // Right after the header in reading order, so Shift Tab from the panel goes back up the header.
    var header = doc.querySelector('.site-header');
    if (header && header.parentNode) header.parentNode.insertBefore(panel, header.nextSibling);
    else doc.body.appendChild(panel);
    showEmpty();
  }

  function showDetails(on) {
    ui.details.forEach(function (n) { n.hidden = !on; });
  }

  function showEmpty() {
    ui.count.textContent = cap(count(parts.length, 'part'));
    ui.count.appendChild(make('span', 'insp-panel__more', ' on this page'));
    ui.title.textContent = 'Inspect mode';
    ui.note.textContent = help();
    showDetails(false);
    scrollable();
  }

  function refresh() {
    if (!active) return;
    if (selected > -1) showPart(selected);
    else showEmpty();
  }

  function step(dir) {
    var n = parts.length;
    if (!n) return;
    var i = selected < 0 ? (dir > 0 ? 0 : n - 1) : (selected + dir + n) % n;
    select(i, 'center');
  }

  function select(i, scrollMode) {
    if (i < 0 || i >= parts.length) return;
    if (selected > -1 && geo[selected]) {
      geo[selected].box.classList.remove('is-selected');
      geo[selected].tag.classList.remove('is-selected');
    }
    selected = i;
    geo[i].box.classList.add('is-selected');
    geo[i].tag.classList.add('is-selected');
    showPart(i);
    dock(i);
    reveal(i, scrollMode);
    announce(parts[i].name + '. ' + parts[i].note);
  }

  function showPart(i) {
    var p = parts[i];
    ui.count.textContent = 'Part ' + (i + 1) + ' of ' + parts.length;
    ui.title.textContent = p.name;
    ui.note.textContent = p.note;
    showDetails(true);
    renderFacts(p.el);
    renderTag(p.el);
    scrollable();
    recheck(i);
  }

  // A color read while the part is still animating (the check card settling on load, the
  // switch's own color fade in the header) is a passing value, so the facts are read again
  // once the part's animations and transitions have ended.
  function recheck(i) {
    var el = parts[i].el;
    var moving = el.getAnimations ? el.getAnimations({ subtree: true }) : [];
    if (!moving.length) return;
    var mine = ++rechecks;
    Promise.all(moving.map(function (a) {
      return a.finished.catch(function () {});
    })).then(function () {
      if (!active || mine !== rechecks || selected !== i) return;
      renderFacts(el);
      scrollable();
    });
  }

  // From 720px up, a part in the right column is inspected with the panel docked on the left,
  // so the panel doesn't cover it. The panel changes sides at once and fades in where it lands,
  // as it does when the mode turns on; nothing travels.
  function dock(i) {
    var r = geo[i] && geo[i].rect;
    var vw = root.clientWidth;
    var away = !!r && mqWide.matches && r.right - r.left < vw * 0.6 && (r.left + r.right) / 2 > vw / 2;
    if (panel.classList.contains('insp-panel--start') === away) return;
    panel.classList.toggle('insp-panel--start', away);
    if (!reduced()) play(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE });
  }

  // A scrolling panel body must be reachable by keyboard; only then is it a tab stop.
  function scrollable() {
    var b = ui.body;
    if (b.scrollHeight > b.clientHeight + 1) {
      b.setAttribute('tabindex', '0');
      b.setAttribute('role', 'region');
      b.setAttribute('aria-label', 'Part details');
    } else {
      b.removeAttribute('tabindex');
      b.removeAttribute('role');
      b.removeAttribute('aria-label');
    }
  }

  /* Live facts */

  function renderFacts(el) {
    var dl = ui.facts;
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    var r = el.getBoundingClientRect();
    var w = Math.round(r.width);
    var h = Math.round(r.height);

    var sizeValue = make('dd');
    var shown = make('span', '', w + ' × ' + h + ' px');
    shown.setAttribute('aria-hidden', 'true');
    sizeValue.appendChild(shown);
    sizeValue.appendChild(make('span', 'visually-hidden', w + ' by ' + h + ' pixels'));
    row(dl, 'Size', sizeValue);

    var groups = textGroups(el);
    if (!groups.length) {
      row(dl, 'Text', make('dd', '', 'No visible text'));
      return;
    }
    var main = groups[0];
    var low = groups[0];
    groups.forEach(function (g) {
      if (g.chars > main.chars) main = g;
      if (g.ratio < low.ratio) low = g;
    });

    row(dl, 'Text', make('dd', '', px(main.size) + ', weight ' + main.weight));
    row(dl, 'Font', make('dd', '', fontName(main.family)));

    var c = make('dd', 'insp-contrast');
    var swatch = make('span', 'insp-swatch', 'Aa');
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.color = rgb(main.fg);
    swatch.style.backgroundColor = rgb(main.bg);
    swatch.style.fontWeight = String(main.weight);
    c.appendChild(swatch);
    var words = make('span', 'insp-contrast__text');
    words.appendChild(make('span', 'insp-contrast__main', ratioText(main.ratio) + ', ' + level(main.ratio, main.large)));
    if (low !== main && ratioText(low.ratio) !== ratioText(main.ratio)) {
      words.appendChild(make('span', 'insp-contrast__low', 'Lowest: ' + ratioText(low.ratio) + ', ' + level(low.ratio, low.large)));
    }
    c.appendChild(words);
    row(dl, 'Contrast', c);
  }

  function row(dl, label, dd) {
    var wrap = make('div');
    wrap.appendChild(make('dt', '', label));
    wrap.appendChild(dd);
    dl.appendChild(wrap);
  }

  function px(n) {
    var v = Math.round(n * 10) / 10;
    return (v % 1 ? v.toFixed(1) : String(v)) + 'px';
  }

  // Never round up across a threshold: 4.49 shows as 4.4, not 4.5.
  function ratioText(r) {
    return (Math.floor(r * 10) / 10).toFixed(1) + ' to 1';
  }

  function level(r, large) {
    if (r >= 7) return 'passes AAA';
    if (large && r >= 4.5) return 'passes AAA for large text';
    if (r >= 4.5) return 'passes AA';
    if (large && r >= 3) return 'passes AA for large text';
    return 'below AA';
  }

  function fontName(family) {
    var first = (family.split(',')[0] || '').trim().replace(/^["']|["']$/g, '');
    var known = false;
    var loaded = false;
    var failed = false;
    if (doc.fonts && doc.fonts.forEach) {
      doc.fonts.forEach(function (f) {
        if (f.family.replace(/^["']|["']$/g, '') !== first) return;
        known = true;
        if (f.status === 'loaded') loaded = true;
        if (f.status === 'error') failed = true;
      });
    }
    if (loaded) return first;
    if (failed) return 'A system font, because ' + first + ' didn’t load';
    if (known) return 'A system font, until ' + first + ' loads';
    if (/mono/i.test(first)) return 'System monospace';
    return first;
  }

  // Group the part's visible text by how it looks, counting characters, so the main style and
  // the weakest contrast both come from what is really on screen.
  function textGroups(part) {
    var groups = [];
    var byKey = {};
    var hosts = new Map();
    var bgs = new Map();
    var walker = doc.createTreeWalker(part, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      var chars = n.nodeValue.replace(/\s+/g, '').length;
      var host = n.parentElement;
      if (!chars || !host) continue;
      var info = hosts.get(host);
      if (info === undefined) {
        info = textInfo(host, bgs);
        hosts.set(host, info);
      }
      if (!info) continue;
      var g = byKey[info.key];
      if (!g) {
        g = byKey[info.key] = info;
        g.chars = 0;
        groups.push(g);
      }
      g.chars += chars;
    }
    return groups;
  }

  function textInfo(host, bgs) {
    if (owned(host) || host.closest('noscript, script, style, template, svg')) return null;
    var cs = getComputedStyle(host);
    if (cs.visibility !== 'visible') return null;
    var r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    var alpha = 1;
    for (var a = host; a; a = a.parentElement) {
      alpha *= parseFloat(getComputedStyle(a).opacity);
      if (!(alpha > 0.05)) return null;
    }
    var bg = backgroundOf(host, bgs);
    var fg = parseColor(cs.color);
    if (!fg) return null;
    fg = blend(fg, bg, fg[3] * alpha);
    var size = parseFloat(cs.fontSize);
    var weight = parseInt(cs.fontWeight, 10) || 400;
    var ratio = contrast(fg, bg);
    return {
      key: [size, weight, rgb(fg), rgb(bg), cs.fontFamily].join('|'),
      size: size,
      weight: weight,
      family: cs.fontFamily,
      fg: fg,
      bg: bg,
      ratio: ratio,
      large: size >= 24 || (size >= 18.66 && weight >= 700)
    };
  }

  // The real ground under an element: every background up the tree, stacked, down to the first
  // opaque one.
  function backgroundOf(el, cache) {
    if (cache.has(el)) return cache.get(el);
    var c = parseColor(getComputedStyle(el).backgroundColor) || [0, 0, 0, 0];
    var result;
    if (c[3] >= 1) result = c;
    else {
      var under = el.parentElement ? backgroundOf(el.parentElement, cache) : [255, 255, 255, 1];
      result = c[3] > 0 ? blend(c, under, c[3]) : under;
    }
    cache.set(el, result);
    return result;
  }

  function blend(top, under, a) {
    if (a >= 1) return [top[0], top[1], top[2], 1];
    return [
      top[0] * a + under[0] * (1 - a),
      top[1] * a + under[1] * (1 - a),
      top[2] * a + under[2] * (1 - a),
      1
    ];
  }

  function rgb(c) {
    return 'rgb(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ')';
  }

  var probe = null;
  function parseColor(str) {
    if (!str) return null;
    var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(str);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : (m[5] ? m[4] / 100 : +m[4])];
    m = /^color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/i.exec(str);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : (m[5] ? m[4] / 100 : +m[4])];
    if (str === 'transparent') return [0, 0, 0, 0];
    // Any other color syntax: let the browser paint one pixel and read it back.
    try {
      if (!probe) {
        var canvas = doc.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        probe = canvas.getContext('2d', { willReadFrequently: true });
      }
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = '#000';
      probe.fillStyle = str;
      probe.fillRect(0, 0, 1, 1);
      var d = probe.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) {
      return null;
    }
  }

  function channel(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function luminance(c) {
    return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  }

  function contrast(a, b) {
    var x = luminance(a);
    var y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /* The start tag, as code */

  function renderTag(el) {
    var code = ui.code;
    while (code.firstChild) code.removeChild(code.firstChild);
    var name = el.tagName.toLowerCase();
    var attrs = [];
    // Names and values are read as strings: reading el.attributes would make the browser
    // create and keep Attr nodes on the page's own elements.
    var names = el.getAttributeNames();
    for (var i = 0; i < names.length; i++) {
      var key = names[i].toLowerCase();
      if (ATTRS.indexOf(key) === -1) continue;
      var raw = el.getAttribute(names[i]) || '';
      var v = key === 'class' ? raw.trim().split(/\s+/).join(' ') : raw;
      if (key === 'href' && !sameSite(v)) continue;
      if (v.length > 60) v = v.slice(0, 59).trimEnd() + '…';
      attrs.push([key, key === 'hidden' ? null : v]);
    }
    if (!fit) fit = fitChars();

    // Attributes fill each line up to the panel's width; the next line starts indented, the way
    // a long tag is wrapped by hand. A value longer than a line wraps inside its own line.
    var line = make('span', 'insp-line');
    var used = 1 + name.length;
    line.appendChild(tok('p', '<'));
    line.appendChild(tok('t', name));
    code.appendChild(line);
    attrs.forEach(function (x, k) {
      var len = x[0].length + (x[1] === null ? 0 : x[1].length + 3) + (k === attrs.length - 1 ? 1 : 0);
      if (used + 1 + len <= fit) {
        line.appendChild(doc.createTextNode(' '));
        used += 1;
      } else {
        line = make('span', 'insp-line insp-line--attr', '  ');
        code.appendChild(line);
        used = 2;
      }
      attr(line, x);
      used += len;
    });
    line.appendChild(tok('p', '>'));
  }

  function attr(line, x) {
    line.appendChild(tok('a', x[0]));
    if (x[1] === null) return;
    line.appendChild(tok('p', '="'));
    line.appendChild(tok('v', x[1]));
    line.appendChild(tok('p', '"'));
  }

  function tok(kind, text) {
    return make('span', 'insp-tok insp-tok--' + kind, text);
  }

  function sameSite(href) {
    try {
      var u = new URL(href, location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  // How many code characters fit on one line of the panel right now.
  function fitChars() {
    var pre = ui.pre;
    var wasHidden = pre.hidden;
    pre.hidden = false;
    var sample = make('span', '', '0000000000');
    ui.code.appendChild(sample);
    var ch = sample.getBoundingClientRect().width / 10;
    ui.code.removeChild(sample);
    var cs = getComputedStyle(pre);
    var room = pre.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    pre.hidden = wasHidden;
    return ch > 0 ? Math.max(12, Math.floor(room / ch)) : 32;
  }

  /* Scrolling a part into view, clear of the panel */

  // mode 'center' (stepping): center the part in the room above the panel, or align its top
  // when it is taller than that room. mode 'ensure' (a click or tap): scroll only as far as it
  // takes to show the whole part; a taller part gets its top aligned, unless that would show
  // less than 48px more of it.
  function reveal(i, mode) {
    var g = geo[i];
    if (!g || !g.rect) return;
    var sy = window.pageYOffset;
    var vh = window.innerHeight;
    var top = Math.min(g.rect.top, g.tagRect.top) - 12;
    var bottom = Math.max(g.rect.bottom, g.tagRect.bottom) + 12;
    var areaBottom = vh;
    var pr = panel.getBoundingClientRect();
    if (g.rect.right > pr.left && g.rect.left < pr.right) areaBottom = Math.min(vh, pr.top);
    var room = Math.max(areaBottom, 1);
    var tall = bottom - top;
    var target;

    if (mode === 'ensure') {
      var vTop = top - sy;
      var vBottom = bottom - sy;
      if (tall <= room) {
        if (vTop >= 0 && vBottom <= areaBottom) return;
        target = vTop < 0 ? top : bottom - areaBottom;
      } else {
        if (vTop >= 0 && room - (Math.min(vBottom, areaBottom) - vTop) < 48) return;
        target = top;
      }
    } else {
      target = tall <= room ? top - (room - tall) / 2 : top;
    }

    var max = Math.max(root.scrollHeight, doc.body.scrollHeight) - vh;
    target = Math.round(Math.min(Math.max(target, 0), Math.max(max, 0)));
    if (Math.abs(target - sy) < 2) return;
    window.scrollTo({ top: target, left: window.pageXOffset, behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* Input while the mode is on */

  // Clicks in the page select their part instead of acting. The switch and the panel work as usual.
  function onClick(e) {
    var t = e.target;
    if (t && t.nodeType !== 1) t = t.parentElement;
    if (!t || toggle.contains(t) || (panel && panel.contains(t))) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type !== 'click') return;
    var i = partIndexFor(t);
    if (i > -1) select(i, 'ensure');
  }

  // One Escape does one thing: it leaves the mode, and nothing else on the page hears it (so the
  // map keeps its pin). Arrow, Home, and End keys in the page's tab lists and toolbars are held
  // back too, as clicks are, so no widget changes while it is being inspected.
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      leave('scroll');
      return;
    }
    var t = e.target;
    if (t && t.nodeType === 1 && !toggle.contains(t) && !(panel && panel.contains(t)) &&
        /^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key) && t.closest('[role="tablist"], [role="toolbar"]')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onPointerOver(e) {
    if (e.pointerType === 'touch' || !mqFine.matches) return;
    var t = e.target;
    var i = !t || t.nodeType !== 1 || owned(t) || toggle.contains(t) ? -1 : partIndexFor(t);
    setHover(i);
  }

  function onPointerOut(e) {
    if (!e.relatedTarget) setHover(-1);
  }

  function setHover(i) {
    if (i === hovered) return;
    if (hovered > -1 && geo[hovered]) {
      geo[hovered].box.classList.remove('is-hover');
      geo[hovered].tag.classList.remove('is-hover');
    }
    hovered = i;
    if (i > -1) {
      geo[i].box.classList.add('is-hover');
      geo[i].tag.classList.add('is-hover');
    }
  }

  // Keep the page's own focus visible: a focused element behind the panel moves above it.
  function onFocusIn(e) {
    var t = e.target;
    if (!panel || !t || t.nodeType !== 1 || panel.contains(t) || t === toggle) return;
    var r = t.getBoundingClientRect();
    var p = panel.getBoundingClientRect();
    if (r.bottom > p.top && r.top < p.bottom && r.right > p.left && r.left < p.right) {
      window.scrollBy({ top: Math.round(r.bottom - p.top + 16), left: 0, behavior: 'auto' });
    }
  }
})();
