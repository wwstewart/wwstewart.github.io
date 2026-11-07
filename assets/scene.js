/*
  scene.js: the network behind the cover. A few dozen nodes drift, link up when they come near,
  and pass packets along the links; the pointer pushes nodes aside and brightens the links around
  it. It is drawn on a canvas that sits behind the cover text, takes its colors from the page's
  own tokens, pauses when the cover is off screen or the tab is hidden, and draws one still frame
  under reduced motion. Nothing is stored, nothing is sent, no globals.
*/
(function () {
  'use strict';

  var hero = document.querySelector('.hero.cover');
  if (!hero || !window.requestAnimationFrame) return;

  function mq(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (e) {
      return false;
    }
  }

  var reduced = mq('(prefers-reduced-motion: reduce)');
  var canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var LINK = 150;
  var W = 0, H = 0, dpr = 1;
  var nodes = [], links = [], packets = [];
  var mouse = { x: -1e4, y: -1e4, on: false };
  var visible = true, hidden = false, raf = 0, last = 0, spawn = 0;
  var color = { wire: [133, 114, 84], gold: [194, 141, 57], accent: [113, 9, 18] };

  function hex(value, fallback) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(value).trim());
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    color.wire = hex(cs.getPropertyValue('--wire'), color.wire);
    color.gold = hex(cs.getPropertyValue('--gold'), color.gold);
    color.accent = hex(cs.getPropertyValue('--accent'), color.accent);
  }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function seed() {
    var n = Math.max(34, Math.min(84, Math.round(W * H / 26000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.3 + Math.random() * 1.5,
        sq: Math.random() < 0.3
      });
    }
    packets = [];
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    if (reduced) draw();
  }

  function step(dt) {
    var k = dt / 16.7;
    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.x += n.vx * k;
      n.y += n.vy * k;
      if (n.x < -10) n.x = W + 10;
      if (n.x > W + 10) n.x = -10;
      if (n.y < -10) n.y = H + 10;
      if (n.y > H + 10) n.y = -10;
      if (mouse.on) {
        var dx = n.x - mouse.x, dy = n.y - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 150 && d > 0.1) {
          var push = (150 - d) / 150 * 0.9 * k;
          n.x += dx / d * push;
          n.y += dy / d * push;
        }
      }
    }
    links = [];
    for (i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var ax = nodes[i].x - nodes[j].x, ay = nodes[i].y - nodes[j].y;
        var dd = ax * ax + ay * ay;
        if (dd < LINK * LINK) links.push({ a: nodes[i], b: nodes[j], d: Math.sqrt(dd) });
      }
    }
    for (i = packets.length - 1; i >= 0; i--) {
      packets[i].t += dt / packets[i].ms;
      if (packets[i].t >= 1) packets.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, l, n;
    ctx.lineWidth = 0.9;
    for (i = 0; i < links.length; i++) {
      l = links[i];
      var a = (1 - l.d / LINK) * 0.5;
      if (mouse.on) {
        var mx = (l.a.x + l.b.x) / 2 - mouse.x, my = (l.a.y + l.b.y) / 2 - mouse.y;
        var md = Math.sqrt(mx * mx + my * my);
        if (md < 180) a = Math.min(0.95, a + (180 - md) / 180 * 0.6);
      }
      ctx.strokeStyle = rgba(color.wire, a);
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.stroke();
    }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      ctx.fillStyle = rgba(color.gold, 0.9);
      if (n.sq) ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (i = 0; i < packets.length; i++) {
      var p = packets[i];
      var t = p.t < 0.5 ? 2 * p.t * p.t : -1 + (4 - 2 * p.t) * p.t;
      var px = p.a.x + (p.b.x - p.a.x) * t, py = p.a.y + (p.b.y - p.a.y) * t;
      ctx.fillStyle = rgba(color.accent, 0.18);
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(color.accent, 0.95);
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mouse.on) {
      ctx.strokeStyle = rgba(color.accent, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible || hidden) return;
    var dt = Math.min(48, now - (last || now));
    last = now;
    spawn += dt;
    if (spawn > 650 && links.length && packets.length < 14) {
      spawn = 0;
      var l = links[Math.floor(Math.random() * links.length)];
      packets.push({ a: l.a, b: l.b, t: 0, ms: 900 + Math.random() * 700 });
    }
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function run() {
    if (reduced || raf || !visible || hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  hero.addEventListener('pointermove', function (event) {
    var r = hero.getBoundingClientRect();
    mouse.x = event.clientX - r.left;
    mouse.y = event.clientY - r.top;
    mouse.on = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', function () {
    mouse.on = false;
    mouse.x = -1e4;
    mouse.y = -1e4;
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      run();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    hidden = document.hidden;
    run();
  });
  window.addEventListener('resize', resize, { passive: true });
  try {
    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    if (dark.addEventListener) dark.addEventListener('change', readColors);
  } catch (e) {}

  readColors();
  resize();
  if (reduced) {
    step(0);
    draw();
  } else {
    run();
  }
})();
