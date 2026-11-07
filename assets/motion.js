/*
  motion.js: the motion and interaction layer. It adds html.js (so motion.css applies), runs the
  opening on the cover, reveals parts as they scroll into view, marks the current exhibit in the
  index, slims the header and draws its progress line, runs the custom cursor, tilts the seal
  toward the pointer, makes buttons magnetic, animates
  the evidence drawers, turns the skill lists into chips, and sends the map a pulse. It also tells
  visit.js what the visitor did, through visit:note events. Nothing is stored or sent, no globals.
*/
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

  function mq(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (e) {
      return false;
    }
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  function all(sel, scope) {
    return (scope || doc).querySelectorAll(sel);
  }

  function emit(name, detail) {
    try {
      doc.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail || {} }));
    } catch (e) {}
  }

  function note(text, rule, sev) {
    emit('visit:note', { text: text, rule: rule || 'curious', sev: sev || 'info' });
  }

  function setVar(node, name, value) {
    node.style.setProperty(name, String(value));
  }

  root.classList.add('js');
  var reduced = mq('(prefers-reduced-motion: reduce)');
  var fine = mq('(hover: hover) and (pointer: fine)');
  if (reduced) root.classList.add('reduce');

  /* The opening (cover only) */

  function opening() {
    var cover = doc.querySelector('.hero.cover');
    if (!cover || reduced) return;
    var h1 = cover.querySelector('h1');
    if (h1 && !h1.querySelector('.w')) {
      var words = h1.textContent.trim().split(/\s+/);
      while (h1.firstChild) h1.removeChild(h1.firstChild);
      words.forEach(function (word, i) {
        var w = doc.createElement('span');
        w.className = 'w';
        var inner = doc.createElement('span');
        inner.className = 'w__in';
        inner.textContent = word;
        setVar(inner, '--i', i);
        w.appendChild(inner);
        h1.appendChild(w);
        if (i < words.length - 1) h1.appendChild(doc.createTextNode(' '));
      });
    }
    var parts = all('.cover__text > *', cover);
    each(parts, function (part, i) {
      setVar(part, '--i', i);
    });
    var seal = cover.querySelector('.cover__seal');
    if (seal) setVar(seal, '--i', 1);
    root.classList.add('is-opening');
    var started = false;
    function go() {
      if (started) return;
      started = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          root.classList.add('is-open');
        });
      });
    }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(go, go);
    setTimeout(go, 500);
  }

  /* Reveals and the declassify bars */

  var REVEAL = ['.section__head', '.exhibit', '.cover-facts .facts > div', '.cover-check__card',
    '.cover-check__aside', '.index', '.exp__text', '.map', '.jobs', '.skills .rows > div', '.edu',
    '.lesson', '.band__grid > *', '.trust-item', '.work-rows > li', '.rail', '.seal-grid__figure',
    '.seal-grid__text', '.page-hero .wrap > *', '.ai-hero__grid > *', '.ai-section'];

  function reveal() {
    var nodes = all(REVEAL.join(','));
    var counts = [];
    each(nodes, function (node) {
      if (node.closest('.cover__text, .cover__seal') || node.classList.contains('ink')) return;
      node.setAttribute('data-reveal', '');
      var parent = node.parentNode;
      var entry = null;
      for (var i = 0; i < counts.length; i++) if (counts[i].parent === parent) entry = counts[i];
      if (!entry) {
        entry = { parent: parent, n: 0 };
        counts.push(entry);
      }
      setVar(node, '--i', Math.min(entry.n, 7));
      entry.n += 1;
    });
    each(all('.exhibit .meta, .cover-facts .facts dd, .facts dd, .custody span'), function (node) {
      node.classList.add('declass');
    });
    if (!('IntersectionObserver' in window) || reduced) {
      each(nodes, function (node) {
        node.classList.add('is-in');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    each(nodes, function (node) {
      io.observe(node);
    });
  }

  /* The current exhibit in the index, and the current part in a page rail */

  function current() {
    var links = all('.index__link[href^="#"], .rail__link[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = [];
    each(links, function (link) {
      var target = doc.getElementById(link.getAttribute('href').slice(1));
      if (target) map.push({ link: link, target: target });
      link.addEventListener('click', function () {
        note('Jumped to ' + link.textContent.replace(/\s+/g, ' ').trim() + ' from the index', 'reader', 'info');
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        map.forEach(function (pair) {
          if (pair.target === entry.target) pair.link.setAttribute('aria-current', 'true');
          else pair.link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    map.forEach(function (pair) {
      io.observe(pair.target);
    });
  }

  /* The header: slims after a short scroll, and shows how far down the page you are */

  function header() {
    var head = doc.querySelector('.site-header');
    if (!head) return;
    var bar = doc.createElement('span');
    bar.className = 'progress';
    bar.setAttribute('aria-hidden', 'true');
    head.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      head.classList.toggle('is-scrolled', y > 24);
      var max = Math.max(1, (doc.documentElement.scrollHeight || 0) - window.innerHeight);
      setVar(bar, '--p', Math.min(1, Math.max(0, y / max)).toFixed(4));
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* The cursor */

  var LABELS = [
    ['a.evidence-pill', 'Open'],
    ['.evidence > summary', 'Evidence'],
    ['.map__node', 'Trace'],
    ['.index__link, .rail__link', 'Jump'],
    ['[data-copy]', 'Copy'],
    ['.inspect-toggle', 'Inspect'],
    ['.card__link', 'Open'],
    ['.board__tidy', 'Tidy'],
    ['.console__close', 'Close'],
    ['.visit-tab', 'Log'],
    ['.check__toggle', 'Detail'],
    ['[data-check-again]', 'Again']
  ];

  function cursor() {
    if (!fine || reduced || !window.requestAnimationFrame) return;
    var dot = doc.createElement('span');
    dot.className = 'cursor';
    dot.setAttribute('aria-hidden', 'true');
    var ring = doc.createElement('span');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    var label = doc.createElement('span');
    label.className = 'cursor-ring__label';
    ring.appendChild(label);
    doc.body.appendChild(dot);
    doc.body.appendChild(ring);
    var x = -100, y = -100, rx = -100, ry = -100, shown = false, raf = 0;
    function frame() {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      if (Math.abs(x - rx) > 0.2 || Math.abs(y - ry) > 0.2) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    doc.addEventListener('pointermove', function (event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      if (!shown) {
        shown = true;
        rx = x;
        ry = y;
        root.classList.add('has-cursor');
      }
      root.classList.remove('cursor-out');
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    doc.addEventListener('pointerover', function (event) {
      var target = event.target.closest('a, button, summary, label, .chip, [data-cursor]');
      if (!target) return;
      ring.classList.add('is-hover');
      var text = target.getAttribute('data-cursor');
      if (!text) {
        for (var i = 0; i < LABELS.length && !text; i++) if (target.matches(LABELS[i][0])) text = LABELS[i][1];
      }
      label.textContent = text || '';
      ring.classList.toggle('has-label', !!text);
    });
    doc.addEventListener('pointerout', function (event) {
      var target = event.target.closest('a, button, summary, label, .chip, [data-cursor]');
      if (!target) return;
      var to = event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest('a, button, summary, label, .chip, [data-cursor]');
      if (to === target) return;
      ring.classList.remove('is-hover', 'has-label');
    });
    doc.addEventListener('pointerdown', function () {
      ring.classList.add('is-press');
    });
    doc.addEventListener('pointerup', function () {
      ring.classList.remove('is-press');
    });
    root.addEventListener('mouseleave', function () {
      root.classList.add('cursor-out');
    });
    root.addEventListener('mouseenter', function () {
      root.classList.remove('cursor-out');
    });
  }

  /* The seal tilts toward the pointer and catches the light */

  function tilt() {
    var cover = doc.querySelector('.hero.cover');
    var seal = cover && cover.querySelector('.cover__seal .seal');
    if (!seal || !fine || reduced) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, inside = false;
    function frame() {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      seal.style.transform = 'perspective(900px) rotateX(' + cy.toFixed(2) + 'deg) rotateY(' + cx.toFixed(2) + 'deg)';
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    cover.addEventListener('pointermove', function (event) {
      var r = seal.getBoundingClientRect();
      var dx = (event.clientX - (r.left + r.width / 2)) / Math.max(1, r.width);
      var dy = (event.clientY - (r.top + r.height / 2)) / Math.max(1, r.height);
      var near = Math.abs(dx) < 1.6 && Math.abs(dy) < 1.6;
      cover.classList.toggle('is-near', near);
      if (near) {
        tx = Math.max(-1, Math.min(1, dx)) * 14;
        ty = -Math.max(-1, Math.min(1, dy)) * 14;
        setVar(seal, '--sx', (50 + Math.max(-1, Math.min(1, dx)) * 40).toFixed(1) + '%');
        setVar(seal, '--sy', (50 + Math.max(-1, Math.min(1, dy)) * 40).toFixed(1) + '%');
      } else {
        tx = 0;
        ty = 0;
      }
      inside = true;
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    cover.addEventListener('pointerleave', function () {
      inside = false;
      tx = 0;
      ty = 0;
      cover.classList.remove('is-near');
      if (!raf) raf = requestAnimationFrame(frame);
    });
  }

  /* Magnetic buttons: a button leans toward the pointer and springs back */

  function magnetic() {
    if (!fine || reduced) return;
    each(all('.btn'), function (btn) {
      var raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, pressed = false;
      function frame() {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        btn.style.transform = 'translate(' + cx.toFixed(2) + 'px, ' + cy.toFixed(2) + 'px)' + (pressed ? ' scale(0.97)' : '');
        if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(frame);
        else {
          raf = 0;
          if (!tx && !ty && !pressed) btn.style.transform = '';
        }
      }
      btn.addEventListener('pointermove', function (event) {
        var r = btn.getBoundingClientRect();
        tx = Math.max(-8, Math.min(8, (event.clientX - (r.left + r.width / 2)) * 0.22));
        ty = Math.max(-6, Math.min(6, (event.clientY - (r.top + r.height / 2)) * 0.22 - 1));
        if (!raf) raf = requestAnimationFrame(frame);
      }, { passive: true });
      btn.addEventListener('pointerleave', function () {
        tx = 0;
        ty = 0;
        pressed = false;
        if (!raf) raf = requestAnimationFrame(frame);
      });
      btn.addEventListener('pointerdown', function () {
        pressed = true;
        if (!raf) raf = requestAnimationFrame(frame);
      });
      btn.addEventListener('pointerup', function () {
        pressed = false;
        if (!raf) raf = requestAnimationFrame(frame);
      });
    });
  }

  /* Evidence drawers: open and close with motion, and tell the visit log */

  function drawers() {
    each(all('details.evidence'), function (details) {
      var summary = details.querySelector('summary');
      var body = details.querySelector('.evidence__body');
      var title = details.closest('li') && details.closest('li').querySelector('h3');
      var name = title ? title.firstChild.textContent.trim() : 'an entry';
      if (!summary || !body) return;
      details.addEventListener('toggle', function () {
        if (details.open) note('Opened the evidence drawer on ' + name, 'curious', 'info');
      });
      if (reduced || typeof body.animate !== 'function') return;
      var busy = false;
      summary.addEventListener('click', function (event) {
        event.preventDefault();
        if (busy) return;
        busy = true;
        if (details.open) {
          var h = body.offsetHeight;
          var out = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: EASE });
          out.onfinish = out.oncancel = function () {
            details.open = false;
            busy = false;
          };
        } else {
          details.open = true;
          var target = body.scrollHeight;
          var inAnim = body.animate([{ height: '0px', opacity: 0 }, { height: target + 'px', opacity: 1 }], { duration: 460, easing: EASE_OUT });
          inAnim.onfinish = inAnim.oncancel = function () {
            busy = false;
          };
        }
      });
    });
  }

  /* Skill chips */

  function chips() {
    each(all('.skills .rows dd'), function (dd) {
      var text = dd.textContent;
      if (!text || dd.querySelector('.chip')) return;
      var parts = text.split(/,\s*/);
      if (parts.length < 2) return;
      while (dd.firstChild) dd.removeChild(dd.firstChild);
      parts.forEach(function (part, i) {
        var chip = doc.createElement('span');
        chip.className = 'chip';
        chip.textContent = part.trim();
        setVar(chip, '--i', i);
        dd.appendChild(chip);
      });
    });
  }

  /* A pulse down the map's spine */

  function pulse() {
    var branches = doc.querySelector('.map__branches');
    if (!branches || reduced) return;
    var dot = doc.createElement('span');
    dot.className = 'map__pulse';
    dot.setAttribute('aria-hidden', 'true');
    branches.appendChild(dot);
  }

  /* Notes for the visit log about things the other scripts own */

  function notes() {
    doc.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (link) {
        var href = link.getAttribute('href') || '';
        if (href.indexOf('mailto:') === 0) note('Clicked the email address', 'intent', 'low');
        else if (link.target === '_blank') {
          var host = '';
          try {
            host = new URL(link.href).hostname;
          } catch (e) {}
          note('Opened ' + (host || 'an outside link') + ' in a new tab', 'intent', 'low');
        } else if (/plain\.html|resume\.txt|Resume\.pdf/.test(href)) note('Went for the plain version', 'intent', 'low');
      }
      var inspect = event.target.closest('.inspect-toggle');
      if (inspect) note('Inspect mode ' + (inspect.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'), 'curious', 'low');
      if (event.target.closest('[data-check-again]')) note('Ran the security checks again', 'curious', 'info');
      if (event.target.closest('[data-copy]')) note('Copied the email address with the button', 'intent', 'low');
      var nodeBtn = event.target.closest('.map__node');
      if (nodeBtn) note('Traced the ' + nodeBtn.textContent.trim() + ' branch on the work map', 'curious', 'info');
    });
  }

  /* Landing: a page opens at its top, and a link into a page lands with that part under the
     header once the fonts and the layers have settled the layout (the hero grows and the board
     appears after the browser's first jump to the fragment). Reloads and back or forward keep the
     position the browser restores. */
  function landing() {
    var entry = (window.performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
    if (entry && entry.type !== 'navigate') return;
    function settle() {
      var id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
      var target = id ? doc.getElementById(id) : null;
      var prior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      try {
        if (target) target.scrollIntoView({ block: 'start' });
        else root.scrollIntoView({ block: 'start' });
      } catch (e) {}
      root.style.scrollBehavior = prior;
    }
    function after() {
      requestAnimationFrame(function () {
        requestAnimationFrame(settle);
      });
    }
    function go() {
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(after, after);
      else after();
    }
    if (doc.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }

  /* The corner buttons step aside while the footer is in view (will, November 6, 2026) */
  function footer() {
    var foot = doc.querySelector('.site-footer');
    if (!foot || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      root.classList.toggle('at-footer', entries[0].isIntersecting);
    }, { threshold: 0 });
    io.observe(foot);
  }

  function start() {
    opening();
    reveal();
    current();
    header();
    cursor();
    tilt();
    magnetic();
    drawers();
    chips();
    pulse();
    notes();
    footer();
    landing();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
