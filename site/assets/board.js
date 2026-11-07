/*
  board.js: the evidence board on the cover. It builds one card per exhibit from the exhibit rows
  below it (the rows stay the source of truth), pins the cards to a board, runs string between
  exhibits that belong together, and lets you drag the cards with a pointer or move them with the
  arrow keys. The strings follow the pins. Nothing is stored: a reload tidies the board.
*/
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var section = doc.getElementById('exhibits');
  var grid = section && section.querySelector('.exhibits__grid');
  var rows = section ? section.querySelectorAll('.exhibit-rows > .exhibit') : [];
  if (!grid || rows.length < 3) return;

  var SVG = 'http://www.w3.org/2000/svg';
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Where each card starts: a share of the free width and height, and a tilt in degrees.
  var SPOTS = [
    [0.02, 0.06, -3], [0.27, 0.0, 2], [0.52, 0.08, -2], [0.79, 0.02, 3],
    [0.14, 0.62, -1.5], [0.44, 0.66, 2.5], [0.73, 0.6, -2.5]
  ];
  // Which exhibits the string joins, and why (the why is the string's hover title).
  var LINKS = [
    [0, 6, 'Exhibit 06 explains how Exhibit 00 was built'],
    [0, 2, 'Two websites, one hand built and one AI built'],
    [1, 4, 'Networking, at work and in class'],
    [1, 0, 'The security team there, the security check here'],
    [3, 5, 'Data: a dashboard and a database'],
    [4, 5, 'Two University of Cincinnati classes']
  ];
  var ICONS = [
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14l2.5 2.5L16 12"/>',
    '<path d="M3 20V9l5 3V9l5 3V9l5 3v8H3z"/><path d="M8 20v-3M13 20v-3"/>',
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-9"/>',
    '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><path d="M12 8v4m0 0l-5.5 4.5M12 12l5.5 4.5"/>',
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'
  ];

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

  function textOf(node) {
    if (!node) return '';
    var copy = node.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('.visually-hidden'), function (hidden) {
      hidden.parentNode.removeChild(hidden);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }

  /* Build */

  var board = el('div', 'wrap board');
  var bar = el('div', 'board__bar');
  var title = el('p', 'label board__title', 'Evidence board');
  title.id = 'board-title';
  var hint = el('p', 'board__hint', 'Drag a card and the string follows. With the keyboard, select a card and use the arrow keys.');
  var tidy = el('button', 'board__tidy', 'Tidy the board');
  tidy.type = 'button';
  bar.appendChild(title);
  bar.appendChild(hint);
  bar.appendChild(tidy);

  var field = el('div', 'board__field');
  field.setAttribute('role', 'group');
  field.setAttribute('aria-labelledby', 'board-title');
  var strings = doc.createElementNS(SVG, 'svg');
  strings.setAttribute('class', 'board__strings');
  strings.setAttribute('aria-hidden', 'true');
  field.appendChild(strings);

  var cards = [];
  Array.prototype.forEach.call(rows, function (row, i) {
    if (i >= SPOTS.length) return;
    var num = textOf(row.querySelector('.exhibit__num')) || String(i);
    var name = textOf(row.querySelector('h3'));
    var meta = textOf(row.querySelector('.meta')).split(' · ')[0];
    var card = el('article', 'card');
    card.tabIndex = 0;
    card.setAttribute('data-cursor', 'Move');
    card.setAttribute('aria-label', 'Exhibit ' + num + ', ' + name + '. Movable card.');
    var pin = el('span', 'card__pin');
    pin.setAttribute('aria-hidden', 'true');
    var head = el('div', 'card__head');
    head.appendChild(el('span', 'card__num', num));
    var icon = doc.createElementNS(SVG, 'svg');
    icon.setAttribute('class', 'card__icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.innerHTML = ICONS[i] || ICONS[0];
    head.appendChild(icon);
    var link = el('a', 'card__link');
    link.href = '#' + row.id;
    link.appendChild(el('span', 'card__title', name));
    var body = el('p', 'card__meta', meta);
    card.appendChild(pin);
    card.appendChild(head);
    card.appendChild(link);
    card.appendChild(body);
    field.appendChild(card);
    cards.push({ node: card, pin: pin, fx: SPOTS[i][0], fy: SPOTS[i][1], r: SPOTS[i][2], home: SPOTS[i] });
    card.style.setProperty('--r', SPOTS[i][2] + 'deg');
  });

  var paths = LINKS.map(function (pair) {
    if (!cards[pair[0]] || !cards[pair[1]]) return null;
    var path = doc.createElementNS(SVG, 'path');
    path.setAttribute('class', 'board__string');
    var caption = doc.createElementNS(SVG, 'title');
    caption.textContent = pair[2];
    path.appendChild(caption);
    strings.appendChild(path);
    return { a: cards[pair[0]], b: cards[pair[1]], node: path };
  }).filter(Boolean);

  board.appendChild(bar);
  board.appendChild(field);
  section.insertBefore(board, grid);

  /* Place and draw */

  function place(card) {
    var fw = field.clientWidth, fh = field.clientHeight;
    var w = card.node.offsetWidth, h = card.node.offsetHeight;
    card.x = Math.round(card.fx * Math.max(0, fw - w));
    card.y = Math.round(card.fy * Math.max(0, fh - h));
    card.node.style.setProperty('--x', card.x + 'px');
    card.node.style.setProperty('--y', card.y + 'px');
  }

  function pinAt(card) {
    var f = field.getBoundingClientRect();
    var p = card.pin.getBoundingClientRect();
    return { x: p.left + p.width / 2 - f.left, y: p.top + p.height / 2 - f.top };
  }

  function draw() {
    var w = field.clientWidth, h = field.clientHeight;
    strings.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    strings.setAttribute('width', w);
    strings.setAttribute('height', h);
    paths.forEach(function (s) {
      var a = pinAt(s.a), b = pinAt(s.b);
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + dist * 0.14 + 12;
      s.node.setAttribute('d', 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
    });
  }

  var raf = 0, until = 0;
  function animate(ms) {
    until = Math.max(until, Date.now() + (ms || 0));
    if (raf) return;
    function frame() {
      draw();
      if (Date.now() < until || held) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    raf = requestAnimationFrame(frame);
  }

  function layout() {
    cards.forEach(place);
    draw();
  }

  /* Drag */

  var held = null, moved = false, startX = 0, startY = 0, originX = 0, originY = 0, noted = false;

  function clamp(card) {
    var fw = field.clientWidth, fh = field.clientHeight;
    var w = card.node.offsetWidth, h = card.node.offsetHeight;
    card.x = Math.max(0, Math.min(fw - w, card.x));
    card.y = Math.max(0, Math.min(fh - h, card.y));
    card.fx = fw - w > 0 ? card.x / (fw - w) : 0;
    card.fy = fh - h > 0 ? card.y / (fh - h) : 0;
    card.node.style.setProperty('--x', card.x + 'px');
    card.node.style.setProperty('--y', card.y + 'px');
  }

  function lift(card) {
    cards.forEach(function (c) {
      c.node.classList.remove('is-top');
    });
    card.node.classList.add('is-top');
  }

  cards.forEach(function (card) {
    var node = card.node;
    node.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      held = card;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      originX = card.x;
      originY = card.y;
      lift(card);
      node.classList.add('is-held');
      animate(0);
    });
    node.addEventListener('pointermove', function (event) {
      if (held !== card) return;
      var dx = event.clientX - startX, dy = event.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        // Capture only once a drag has started, so a plain click still reaches the card's link.
        try {
          node.setPointerCapture(event.pointerId);
        } catch (e) {}
        if (!noted) {
          noted = true;
          emit('visit:note', { text: 'Moved a card on the evidence board', rule: 'curious', sev: 'info' });
        }
      }
      card.x = originX + dx;
      card.y = originY + dy;
      clamp(card);
    });
    function drop(event) {
      if (held !== card) return;
      held = null;
      node.classList.remove('is-held');
      try {
        node.releasePointerCapture(event.pointerId);
      } catch (e) {}
      if (!reduced) {
        node.classList.add('is-settling');
        setTimeout(function () {
          node.classList.remove('is-settling');
        }, 400);
      }
      animate(420);
    }
    node.addEventListener('pointerup', drop);
    node.addEventListener('pointercancel', drop);
    node.addEventListener('click', function (event) {
      // A drag ends with a click on the same element; that click must not open the exhibit.
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    }, true);
    node.addEventListener('keydown', function (event) {
      var step = event.shiftKey ? 72 : 24;
      var dx = 0, dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      else if (event.key === 'ArrowRight') dx = step;
      else if (event.key === 'ArrowUp') dy = -step;
      else if (event.key === 'ArrowDown') dy = step;
      else if (event.key === 'Enter' || event.key === ' ') {
        if (event.target === node) {
          event.preventDefault();
          node.querySelector('.card__link').click();
        }
        return;
      } else if (event.key === 'Home') {
        card.fx = card.home[0];
        card.fy = card.home[1];
        node.classList.add('is-tidying');
        place(card);
        animate(700);
        setTimeout(function () {
          node.classList.remove('is-tidying');
        }, 700);
        event.preventDefault();
        return;
      } else return;
      event.preventDefault();
      lift(card);
      card.x += dx;
      card.y += dy;
      clamp(card);
      draw();
    });
    node.addEventListener('focus', function () {
      lift(card);
    });
  });

  tidy.addEventListener('click', function () {
    cards.forEach(function (card) {
      card.fx = card.home[0];
      card.fy = card.home[1];
      card.node.classList.add('is-tidying');
      card.node.classList.remove('is-top');
      place(card);
    });
    animate(720);
    setTimeout(function () {
      cards.forEach(function (card) {
        card.node.classList.remove('is-tidying');
      });
    }, 720);
    emit('visit:note', { text: 'Tidied the evidence board', rule: 'curious', sev: 'info' });
  });

  window.addEventListener('resize', layout, { passive: true });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layout, layout);
  layout();
  root.classList.add('has-board');
})();
