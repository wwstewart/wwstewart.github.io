/*
  map.js: the Click Bond work map traces a route (home page).

  Point at a branch, focus its node, or tap it, and the route from the internship to that branch
  lights in the accent: the spine down to the branch's arm, then the arm. A packet the size of a
  port runs at the head of the line, docks in the port, and fades. Pointing at the internship
  sends one packet down every branch at once, as one front that splits at each junction.
  A press pins the route on its branch until another branch is chosen, the same one is pressed
  again, or Esc is pressed while focus is in the map.

  The nodes become toggle buttons (aria-pressed), each described by its own text and tools.
  Geometry comes from the rendered map: the branch and node boxes plus the wires' own computed
  offsets, read once at the start of each change and again on resize and when fonts load.
  Each change is one group of Web Animations that starts from what is on screen, so a new trace
  takes over the old one without a jump. Nothing runs at rest. Under reduced motion the route and
  the node change color at once and nothing travels. While Inspect mode is on (inspect.js), the
  map stays still: its outline answers the pointer instead.
*/
(function () {
  'use strict';

  var maps = document.querySelectorAll('.map');
  if (!maps.length || typeof window.getComputedStyle !== 'function') return;

  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'; // --ease
  var X1 = 0.23; // its x control points; both y control points are 1
  var X2 = 0.32;
  var TRACE = 450; // root to port
  var FAN = 600; // the broadcast front, root to the last port
  var REST = 80; // the packet sits in the port
  var PING = 240; // then fades as it settles
  var SETTLE = 180; // back to rest, or back to the pinned route (inside the 200ms limit)
  var GHOST = 150; // an interrupted packet fades where it is
  var DWELL = 120; // the pointer stays on the internship this long before it broadcasts
  var PACKET = 7; // px, the size of a port
  var NONE = -1;
  var ALL = -2;

  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var canAnimate = typeof document.documentElement.animate === 'function';
  var canPacket = canAnimate && !!(window.CSS && CSS.supports &&
    CSS.supports('translate', '1px 1px') && CSS.supports('scale', '1'));
  var groups = 0;

  function still() {
    return !canAnimate || !!(motion && motion.matches);
  }

  function inspecting() {
    return document.documentElement.classList.contains('is-inspecting');
  }

  // The time (0 to 1) at which --ease reaches progress q. With both y control points at 1,
  // progress is 1 - (1 - u)^3 for the curve parameter u, so u comes back in closed form.
  function timeAt(q) {
    if (q >= 1) return 1;
    if (q <= 0) return 0;
    var u = 1 - Math.cbrt(1 - q);
    var v = 1 - u;
    return 3 * v * v * u * X1 + 3 * v * u * u * X2 + u * u * u;
  }

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  // Scale out of a computed matrix: index 0 for x, 3 for y.
  function scaleOf(transform, i) {
    var m = /matrix\(([^)]*)\)/.exec(transform || '');
    return m ? num(m[1].split(',')[i], 0) : 0;
  }

  function sy(v) {
    return 'scaleY(' + v + ')';
  }

  function sx(v) {
    return 'scaleX(' + v + ')';
  }

  // A packet is placed by its center.
  function at(point) {
    var r = PACKET / 2;
    return (point[0] - r) + 'px ' + (point[1] - r) + 'px';
  }

  // Keyframe offsets must run from 0 to 1 without stepping back.
  function frames(list) {
    var last = 0;
    list.forEach(function (frame, i) {
      if (i === 0) frame.offset = 0;
      else if (i === list.length - 1) frame.offset = 1;
      else frame.offset = Math.min(1, Math.max(last, frame.offset || 0));
      last = frame.offset;
    });
    return list;
  }

  function toButton(li, id) {
    var old = li.querySelector('.map__node');
    if (old.tagName === 'BUTTON') return old;
    var button = document.createElement('button');
    Array.prototype.forEach.call(old.attributes, function (attr) {
      if (attr.name !== 'style') button.setAttribute(attr.name, attr.value);
    });
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    while (old.firstChild) button.appendChild(old.firstChild);
    var described = [];
    ['text', 'tools'].forEach(function (part) {
      var p = li.querySelector('.map__' + part);
      if (!p) return;
      if (!p.id) p.id = id + '-' + part;
      described.push(p.id);
    });
    if (described.length) button.setAttribute('aria-describedby', described.join(' '));
    old.parentNode.replaceChild(button, old);
    return button;
  }

  Array.prototype.forEach.call(maps, function (map, index) {
    if (map.classList.contains('map--live')) return;
    var root = map.querySelector('.map__root');
    var items = Array.prototype.filter.call(map.querySelectorAll('.map__branch'), function (li) {
      return !!li.querySelector('.map__node');
    });
    if (!root || !items.length) return;

    var prefix = 'map-' + (index ? index + 1 + '-' : '');
    var nodes = items.map(function (li, k) {
      return toButton(li, prefix + (k + 1));
    });

    // The overlay: one lit spine, one lit arm per branch, and a few packets.
    var layer = document.createElement('div');
    layer.className = 'map__trace';
    layer.setAttribute('aria-hidden', 'true');
    function piece(name) {
      var el = document.createElement('span');
      el.className = name;
      layer.appendChild(el);
      return el;
    }
    var spine = piece('map__route map__route--spine');
    var arms = items.map(function () {
      return piece('map__route map__route--arm');
    });
    var packets = [];
    if (canPacket) {
      for (var i = 0; i < items.length + 2; i++) packets.push(piece('map__packet'));
    }
    map.appendChild(layer);
    map.classList.add('map--live');

    var pinned = NONE;
    var hovered = NONE;
    var focused = NONE;
    var shown = NONE;
    var running = [];
    var timers = [];
    var group = 0;

    function stop() {
      running.forEach(function (a) {
        a.cancel();
      });
      timers.forEach(clearTimeout);
      running = [];
      timers = [];
      group = ++groups;
    }

    function play(el, keyframes, timing) {
      var a = el.animate(keyframes, timing);
      a.id = 'map-' + group;
      running.push(a);
      return a;
    }

    function later(ms, fn) {
      timers.push(setTimeout(fn, ms));
    }

    // Where everything is now, measured from the drawn wires. Boxes paint on whole CSS pixels,
    // so geometry is kept in a frame whose corner sits on a whole pixel next to the map's, and
    // each wire is taken where it is painted. A 2px route is then centered on its 1px wire by a
    // shift of half a pixel wherever the device grid can show one (2x screens and up).
    function measure() {
      var box = map.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      var dpr = window.devicePixelRatio || 1;
      var ox = box.left + (window.pageXOffset || 0);
      var oy = box.top + (window.pageYOffset || 0);
      var fx = Math.round(ox);
      var fy = Math.round(oy);
      var X = function (v) {
        return Math.round(ox + v) - fx;
      };
      var Y = function (v) {
        return Math.round(oy + v) - fy;
      };
      var first = items[0].getBoundingClientRect();
      var wire = getComputedStyle(items[0], '::before');
      var g = {
        ex: fx - ox,
        ey: fy - oy,
        shift: Math.floor(dpr / 2) / dpr,
        wire: X(first.left - box.left + num(wire.left, 0)),
        y0: Y(first.top - box.top + num(wire.top, 0)),
        b: []
      };
      items.forEach(function (li, k) {
        var r = li.getBoundingClientRect();
        var arm = getComputedStyle(li, '::after');
        var node = nodes[k];
        var n = node.getBoundingClientRect();
        var ns = getComputedStyle(node);
        var port = getComputedStyle(node, '::before');
        var bt = num(ns.borderTopWidth, 0);
        var line = Y(r.top - box.top + num(arm.top, 0));
        g.b.push({
          line: line,
          ay: line + g.shift,
          px: X(n.left - box.left + num(ns.borderLeftWidth, 0) + num(port.left, 0)) + num(port.width, 0) / 2,
          py: Y(n.top - box.top + bt + (n.height - bt - num(ns.borderBottomWidth, 0)) / 2)
        });
      });
      g.sx = g.wire + g.shift;
      g.H = Math.max(1, g.b[g.b.length - 1].line + 1 - g.y0);
      return g;
    }

    // How much of the spine reaches branch k (into its lit arm, never past it).
    function reach(g, k) {
      return Math.min(1, (g.b[k].line + 1 - g.y0) / g.H);
    }

    function place(g) {
      var left = g.wire - 1 + g.ex;
      spine.style.left = left + 'px';
      spine.style.top = (g.y0 + g.ey) + 'px';
      spine.style.height = g.H + 'px';
      spine.style.translate = g.shift + 'px 0px';
      arms.forEach(function (a, k) {
        var b = g.b[k];
        a.style.left = left + 'px';
        a.style.top = (b.line - 1 + g.ey) + 'px';
        a.style.width = Math.max(0, b.px - g.wire + 1) + 'px';
        a.style.translate = g.shift + 'px ' + g.shift + 'px';
      });
      packets.forEach(function (p) {
        p.style.left = g.ex + 'px';
        p.style.top = g.ey + 'px';
      });
    }

    // What is on screen right now, running animations included.
    function snapshot() {
      var cs = getComputedStyle(spine);
      var s = { spine: scaleOf(cs.transform, 3), spineO: num(cs.opacity, 1), arms: [], packets: [] };
      arms.forEach(function (a) {
        var c = getComputedStyle(a);
        s.arms.push({ k: scaleOf(c.transform, 0), o: num(c.opacity, 1) });
      });
      packets.forEach(function (p) {
        var c = getComputedStyle(p);
        s.packets.push({ o: num(c.opacity, 0), at: c.translate, scale: c.scale });
      });
      return s;
    }

    function dock(next) {
      items.forEach(function (li, k) {
        li.classList.toggle('map__branch--docked', next === ALL || next === k);
      });
    }

    // The end state at once: reduced motion, resize, or a map that is not rendered.
    function show(next, g) {
      spine.style.opacity = '1';
      spine.style.transform = sy(next === ALL ? 1 : next >= 0 && g ? reach(g, next) : 0);
      arms.forEach(function (a, k) {
        a.style.opacity = '1';
        a.style.transform = sx(next === ALL || next === k ? 1 : 0);
      });
      packets.forEach(function (p) {
        p.style.opacity = '0';
      });
      dock(next);
    }

    // The spine runs to target. When it grows, its lit end waits for the packet and then rides
    // with it; when it shrinks, the extra gives way while the packet comes down to meet it.
    function spineTo(target, from, startY, g, D, end, timing) {
      var s0 = from.spineO > 0.01 ? from.spine : 0;
      var o0 = s0 > 0 ? from.spineO : 1;
      spine.style.transform = sy(target);
      spine.style.opacity = '1';
      if (Math.abs(s0 - target) < 0.001 && o0 > 0.99) return;
      var list = [{ transform: sy(s0), opacity: o0 }];
      if (s0 < target) list.push({ transform: sy(s0), offset: (g.y0 + s0 * g.H - startY) / D });
      list.push({ transform: sy(target), offset: end }, { transform: sy(target), opacity: 1 });
      play(spine, frames(list), timing);
    }

    // An arm draws behind its packet between two points of the shared progress.
    function armDraw(arm, f, from, to, timing) {
      var k0 = f.o > 0.01 ? f.k : 0;
      var o0 = k0 > 0 ? f.o : 1;
      arm.style.transform = sx(1);
      arm.style.opacity = '1';
      if (k0 > 0.999 && o0 > 0.99) return;
      play(arm, frames([
        { transform: sx(k0), opacity: o0 },
        { transform: sx(k0), offset: from + k0 * (to - from) },
        { transform: sx(1), offset: to },
        { transform: sx(1), opacity: 1 }
      ]), timing);
    }

    function armFade(arm, f) {
      arm.style.transform = sx(0);
      arm.style.opacity = '1';
      if (f.k * f.o < 0.01) return;
      play(arm, [
        { transform: sx(f.k), opacity: f.o },
        { transform: sx(f.k), opacity: 0 }
      ], { duration: SETTLE, easing: EASE });
    }

    // Packets for a new group, the ones out of sight first.
    function takePackets(from, n) {
      return packets.map(function (p, i) {
        return i;
      }).sort(function (a, b) {
        return from.packets[a].o - from.packets[b].o || a - b;
      }).slice(0, n).map(function (i) {
        return packets[i];
      });
    }

    // Packets still in sight from the last group fade where they are.
    function ghost(from, taken) {
      packets.forEach(function (p, i) {
        if (taken.indexOf(p) !== -1) return;
        var f = from.packets[i];
        p.style.opacity = '0';
        if (f.o < 0.01) return;
        var spot = !f.at || f.at === 'none' ? '0px 0px' : f.at;
        var size = !f.scale || f.scale === 'none' ? '1' : f.scale;
        play(p, [
          { translate: spot, scale: size, opacity: f.o },
          { translate: spot, scale: size, opacity: 0 }
        ], { duration: GHOST, easing: EASE });
      });
    }

    // A packet runs the route, sits in the port, then fades as it settles.
    function send(p, points, offsets, timing, arrive) {
      p.style.translate = at(points[points.length - 1]);
      p.style.scale = '1';
      p.style.opacity = '0';
      play(p, frames(points.map(function (point, i) {
        return { translate: at(point), offset: offsets[i] };
      })), timing);
      var total = arrive + REST + PING;
      play(p, [
        { opacity: 1 },
        { opacity: 1, offset: (arrive + REST) / total },
        { opacity: 0 }
      ], { duration: total });
      play(p, [{ scale: '1' }, { scale: '1.6' }], { duration: PING, delay: arrive + REST, easing: EASE });
    }

    function trace(k, g, from) {
      var b = g.b[k];
      var start = [g.sx, g.y0 - PACKET / 2];
      var d1 = b.ay - start[1];
      var D = d1 + Math.max(0, b.px - g.sx);
      var timing = { duration: TRACE, easing: EASE };
      items.forEach(function (li, j) {
        if (j !== k) li.classList.remove('map__branch--docked');
      });
      spineTo(reach(g, k), from, start[1], g, D, d1 / D, timing);
      arms.forEach(function (a, j) {
        if (j === k) armDraw(a, from.arms[j], d1 / D, 1, timing);
        else armFade(a, from.arms[j]);
      });
      var taken = takePackets(from, 1);
      ghost(from, taken);
      if (taken.length) send(taken[0], [start, [g.sx, b.ay], [b.px, b.py]], [0, d1 / D, 1], timing, TRACE);
      later(TRACE, function () {
        items[k].classList.add('map__branch--docked');
      });
    }

    // One front leaves the internship and splits at each junction, like a broadcast.
    function fan(g, from) {
      var start = [g.sx, g.y0 - PACKET / 2];
      var D = 0;
      g.b.forEach(function (b) {
        D = Math.max(D, b.ay - start[1] + Math.max(0, b.px - g.sx));
      });
      var timing = { duration: FAN, easing: EASE };
      spineTo(1, from, start[1], g, D, (g.b[g.b.length - 1].ay - start[1]) / D, timing);
      var taken = takePackets(from, items.length);
      ghost(from, taken);
      g.b.forEach(function (b, k) {
        var d1 = (b.ay - start[1]) / D;
        var q = (b.ay - start[1] + Math.max(0, b.px - g.sx)) / D;
        var arrive = Math.round(FAN * timeAt(q));
        var port = [b.px, b.py];
        armDraw(arms[k], from.arms[k], d1, q, timing);
        if (taken[k]) send(taken[k], [start, [g.sx, b.ay], port, port], [0, d1, q, 1], timing, arrive);
        later(arrive, function () {
          items[k].classList.add('map__branch--docked');
        });
      });
    }

    // Back to rest, or back to the pinned route, without a packet.
    function settle(next, g, from) {
      var timing = { duration: SETTLE, easing: EASE };
      var s0 = from.spineO > 0.01 ? from.spine : 0;
      var target = next >= 0 ? reach(g, next) : 0;
      spine.style.transform = sy(target);
      spine.style.opacity = '1';
      if (next < 0) {
        if (s0 > 0.001) {
          play(spine, [
            { transform: sy(s0), opacity: from.spineO },
            { transform: sy(s0), opacity: 0 }
          ], timing);
        }
      } else if (s0 > 0.001) {
        if (Math.abs(s0 - target) > 0.001 || from.spineO < 0.99) {
          play(spine, [
            { transform: sy(s0), opacity: from.spineO },
            { transform: sy(target), opacity: 1 }
          ], timing);
        }
      } else {
        play(spine, [
          { transform: sy(target), opacity: 0 },
          { transform: sy(target), opacity: 1 }
        ], timing);
      }
      arms.forEach(function (a, k) {
        var f = from.arms[k];
        if (k !== next) {
          armFade(a, f);
          return;
        }
        a.style.transform = sx(1);
        a.style.opacity = '1';
        if (f.k > 0.999 && f.o > 0.99) return;
        play(a, f.k * f.o > 0.01 ? [
          { transform: sx(f.k), opacity: f.o },
          { transform: sx(1), opacity: 1 }
        ] : [
          { transform: sx(1), opacity: 0 },
          { transform: sx(1), opacity: 1 }
        ], timing);
      });
      ghost(from, []);
      dock(next);
    }

    function go(next, how) {
      var g = measure();
      var from = g && !still() ? snapshot() : null;
      stop();
      shown = next;
      items.forEach(function (li, k) {
        li.classList.toggle('map__branch--lit', next === k);
      });
      if (g) place(g);
      if (!from) {
        show(next, g);
        return;
      }
      if (next === ALL) fan(g, from);
      else if (next >= 0 && how === 'point') trace(next, g, from);
      else settle(next, g, from);
    }

    // Pointing wins over keyboard focus, and both win over a pin.
    function wanted() {
      if (hovered !== NONE) return hovered;
      if (focused !== NONE) return focused;
      return pinned;
    }

    function update(how) {
      var next = wanted();
      if (next !== shown) go(next, how);
    }

    function pin(k) {
      pinned = k;
      nodes.forEach(function (node, j) {
        node.setAttribute('aria-pressed', j === k ? 'true' : 'false');
      });
    }

    function branchOf(el) {
      var li = el && el.closest ? el.closest('.map__branch') : null;
      return li ? items.indexOf(li) : NONE;
    }

    // Geometry changed under a route that is showing: put it back on the wires at once.
    function refit() {
      if (shown === NONE) return;
      var g = measure();
      stop();
      if (g) place(g);
      show(shown, g);
    }

    var dwell = 0;

    function stopDwell() {
      clearTimeout(dwell);
      dwell = 0;
    }

    // Only a pointer that moves is pointing. When the page scrolls or loads under a still
    // pointer, the browser reports it over the map without any movement, and nothing starts.
    // A branch answers at once; the internship waits a moment, so a pointer that only passes
    // over it on the way to a branch sends nothing.
    map.addEventListener('pointermove', function (e) {
      if (inspecting() || e.pointerType === 'touch' || (e.movementX === 0 && e.movementY === 0)) return;
      var k = branchOf(e.target);
      if (k === NONE && root.contains(e.target)) k = ALL;
      if (k !== ALL) stopDwell();
      if (k === NONE || k === hovered) return;
      if (k === ALL) {
        if (!dwell) {
          dwell = setTimeout(function () {
            dwell = 0;
            hovered = ALL;
            update('point');
          }, DWELL);
        }
        return;
      }
      hovered = k;
      update('point');
    }, { passive: true });

    map.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      stopDwell();
      if (hovered === NONE) return;
      hovered = NONE;
      update('leave');
    }, { passive: true });

    map.addEventListener('click', function (e) {
      var k = branchOf(e.target);
      if (k === NONE) return;
      // A drag that selected text in the branch is not a press.
      var sel = window.getSelection ? window.getSelection() : null;
      if (sel && !sel.isCollapsed && !nodes[k].contains(e.target) && items[k].contains(sel.anchorNode)) return;
      pin(pinned === k ? NONE : k);
      update(pinned === NONE ? 'leave' : 'point');
    });

    map.addEventListener('focusin', function (e) {
      var k = nodes.indexOf(e.target);
      if (k === NONE || inspecting()) return;
      var keyboard = true;
      try {
        keyboard = e.target.matches(':focus-visible');
      } catch (err) {
        keyboard = true;
      }
      if (!keyboard || focused === k) return;
      focused = k;
      update('point');
    });

    map.addEventListener('focusout', function (e) {
      if (focused === NONE) return;
      focused = NONE;
      if (nodes.indexOf(e.relatedTarget) === NONE) update('leave');
    });

    map.addEventListener('keydown', function (e) {
      if ((e.key !== 'Escape' && e.key !== 'Esc') || pinned === NONE) return;
      pin(NONE);
      update('leave');
    });

    if (window.ResizeObserver) new ResizeObserver(refit).observe(map);
    else window.addEventListener('resize', refit, { passive: true });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refit);
  });
})();
