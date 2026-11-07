/*
  casefile.js: the case file layer. Two jobs, all in the visitor’s browser, nothing stored or
  sent, no globals. (A third, the stamp the live check placed on the cover, was removed on
  November 6, 2026 at will’s request.)
  1. The seal. Eleven signals a browser gives any site it visits (its name, platform, language,
     time zone, screen, cores, touch, a canvas drawing, the graphics renderer, which of twelve
     common fonts are installed, and the color and motion preferences) are read, joined, hashed,
     and turned into the ticks, arcs, and mark of the seal. The trust page shows the same list in
     full, so the visitor sees exactly what was read and what it was used for. No address, no
     location, no outside lookup.
  3. The signals list on the trust page, filled from the same reading.
*/
(function () {
  'use strict';

  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var FONTS = ['Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia', 'Helvetica Neue',
    'Menlo', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana'];

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  function mq(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (e) {
      return false;
    }
  }

  /* 1. The signals */

  function timeZone() {
    var name = '';
    try {
      name = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {}
    var offset = -new Date().getTimezoneOffset();
    var sign = offset < 0 ? '−' : '+';
    offset = Math.abs(offset);
    var utc = 'UTC' + sign + Math.floor(offset / 60) + (offset % 60 ? ':' + ('0' + (offset % 60)).slice(-2) : '');
    return name ? name + ' (' + utc + ')' : utc;
  }

  function canvasHash() {
    try {
      var c = document.createElement('canvas');
      c.width = 240;
      c.height = 60;
      var g = c.getContext('2d');
      if (!g) return 'no canvas';
      g.fillStyle = '#f6f0e5';
      g.fillRect(0, 0, 240, 60);
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#710912';
      g.font = '16px "Work Sans", sans-serif';
      g.fillText('Case file · William Stewart', 8, 24);
      g.fillStyle = 'rgba(194, 141, 57, 0.7)';
      g.font = 'italic 14px serif';
      g.fillText('exhibit 00 ∑ ß æ', 12, 48);
      g.strokeStyle = '#0d0d0d';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(200, 30, 18, 0, Math.PI * 1.5);
      g.stroke();
      return fnvHex(c.toDataURL());
    } catch (e) {
      return 'blocked';
    }
  }

  function renderer() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return 'no WebGL';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return name ? String(name) : 'hidden';
    } catch (e) {
      return 'blocked';
    }
  }

  // A font is present when text set in it measures differently from the generic family alone.
  function fontsPresent() {
    try {
      var c = document.createElement('canvas');
      var g = c.getContext('2d');
      if (!g) return 'not probed';
      var sample = 'mmmmmmmmmmlli10WS';
      function width(family) {
        g.font = '32px ' + family;
        return g.measureText(sample).width;
      }
      var generic = ['monospace', 'serif', 'sans-serif'];
      var base = generic.map(width);
      var found = [];
      FONTS.forEach(function (name) {
        var hit = generic.some(function (fam, i) {
          return width('"' + name + '", ' + fam) !== base[i];
        });
        if (hit) found.push(name);
      });
      return found.length + ' of ' + FONTS.length + (found.length ? ': ' + found.join(', ') : '');
    } catch (e) {
      return 'not probed';
    }
  }

  function prefs() {
    var out = [mq('(prefers-color-scheme: dark)') ? 'dark scheme' : 'light scheme'];
    if (mq('(prefers-reduced-motion: reduce)')) out.push('reduced motion');
    if (mq('(prefers-contrast: more)')) out.push('more contrast');
    if (mq('(forced-colors: active)')) out.push('forced colors');
    return out.join(', ');
  }

  function readSignals() {
    var nav = navigator;
    var data = nav.userAgentData;
    var screenLine = screen.width + ' × ' + screen.height + ', ' + screen.colorDepth + ' bit color, ' +
      (window.devicePixelRatio || 1) + '× pixel ratio';
    return [
      ['Browser', nav.userAgent || 'unknown'],
      ['Platform', (data && data.platform) || nav.platform || 'unknown'],
      ['Language', (nav.languages && nav.languages.length ? nav.languages.join(', ') : nav.language) || 'unknown'],
      ['Time zone', timeZone()],
      ['Screen', screenLine],
      ['Processor cores', nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : 'hidden'],
      ['Touch', nav.maxTouchPoints > 0 ? nav.maxTouchPoints + ' touch points' : 'none'],
      ['Canvas drawing', canvasHash()],
      ['Graphics renderer', renderer()],
      ['Fonts installed', fontsPresent()],
      ['Preferences', prefs()]
    ];
  }

  /* The digest: SHA-256 where the browser offers it, a seeded FNV-1a fallback elsewhere. */

  function fnv(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hex32(n) {
    return ('00000000' + n.toString(16)).slice(-8);
  }

  function fnvHex(str) {
    return hex32(fnv(str, 2166136261));
  }

  function fallbackDigest(str) {
    return hex32(fnv(str, 2166136261)) + hex32(fnv(str, 0x9747b28c)) +
      hex32(fnv(str, 0x3c6ef372)) + hex32(fnv(str, 0x1b873593));
  }

  function digest(str) {
    return new Promise(function (resolve) {
      function fallback() {
        resolve({ hex: fallbackDigest(str), how: 'fallback' });
      }
      try {
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
          window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
            var bytes = new Uint8Array(buf);
            var out = '';
            for (var i = 0; i < 16; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
            resolve({ hex: out, how: 'sha' });
          }, fallback);
          return;
        }
      } catch (e) {}
      fallback();
    });
  }

  /* The geometry: sixteen bytes become sixteen ticks, three arcs, and an eight point mark.
     tools/seal.py draws the same figure for the copy shown with scripts off. */

  function bytesOf(hex) {
    var b = [];
    for (var i = 0; i < 32; i += 2) b.push(parseInt(hex.substr(i, 2), 16));
    return b;
  }

  function pt(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [130 + r * Math.cos(a), 130 + r * Math.sin(a)];
  }

  function f(n) {
    return String(Math.round(n * 10) / 10);
  }

  function geometry(b) {
    var ticks = [];
    var dashes = [];
    var points = [];
    var i, p, q;
    for (i = 0; i < 16; i++) {
      p = pt(88, i * 22.5);
      q = pt(88 - (5 + (b[i] % 8)), i * 22.5);
      ticks.push('M' + f(p[0]) + ' ' + f(p[1]) + 'L' + f(q[0]) + ' ' + f(q[1]));
    }
    for (i = 0; i < 8; i++) points.push(pt(22 + (b[8 + i] % 46), i * 45 + (b[i] % 40)));
    var mark = points.map(function (point, n) {
      return (n ? 'L' : 'M') + f(point[0]) + ' ' + f(point[1]);
    }).join('') + 'Z';
    for (i = 0; i < 3; i++) {
      var start = b[(i * 5) % 16] * 360 / 256;
      var span = 24 + (b[(i * 5 + 3) % 16] % 48);
      p = pt(97, start);
      q = pt(97, start + span);
      dashes.push('M' + f(p[0]) + ' ' + f(p[1]) + 'A97 97 0 0 1 ' + f(q[0]) + ' ' + f(q[1]));
    }
    return { ticks: ticks, dashes: dashes, mark: mark, dots: points };
  }

  // With scripts on each stroke draws itself once, through the Web Animations API, as the live
  // check draws its marks. A CSS transition on stroke-dashoffset is left stuck at its start value
  // by Chromium here, so none is used. Reduced motion, or no animate(), shows the seal at once.
  function paint(seal, g) {
    var svg = seal.querySelector('svg');
    if (!svg) return;
    each(svg.querySelectorAll('.seal__tick'), function (tick, i) {
      if (g.ticks[i]) tick.setAttribute('d', g.ticks[i]);
    });
    each(svg.querySelectorAll('.seal__dash'), function (dash, i) {
      if (g.dashes[i]) dash.setAttribute('d', g.dashes[i]);
    });
    each(svg.querySelectorAll('.seal__dot'), function (dot, i) {
      if (g.dots[i]) {
        dot.setAttribute('cx', f(g.dots[i][0]));
        dot.setAttribute('cy', f(g.dots[i][1]));
      }
    });
    var mark = svg.querySelector('.seal__mark');
    if (mark) mark.setAttribute('d', g.mark);
    if (mq('(prefers-reduced-motion: reduce)') || typeof svg.animate !== 'function') return;
    var tickAt = 0;
    each(svg.querySelectorAll('[pathLength]'), function (el) {
      var delay = 0;
      if (el.classList.contains('seal__ring--inner')) delay = 160;
      if (el.classList.contains('seal__tick')) delay = 160 + 28 * tickAt++;
      if (el.classList.contains('seal__mark')) delay = 560;
      try {
        el.animate([{ strokeDasharray: '1', strokeDashoffset: '1' }, { strokeDasharray: '1', strokeDashoffset: '0' }],
          { duration: 800, delay: delay, easing: EASE, fill: 'backwards' });
      } catch (e) {}
    });
    each(svg.querySelectorAll('.seal__dash, .seal__dot'), function (el) {
      try {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 520, easing: EASE, fill: 'backwards' });
      } catch (e) {}
    });
  }

  function fillLists(lists, signals) {
    each(lists, function (list) {
      while (list.firstChild) list.removeChild(list.firstChild);
      signals.forEach(function (pair) {
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = pair[0];
        dd.textContent = pair[1];
        list.appendChild(dt);
        list.appendChild(dd);
      });
    });
  }

  function drawSeals() {
    var seals = document.querySelectorAll('[data-seal]');
    var lists = document.querySelectorAll('[data-signals]');
    if (!seals.length && !lists.length) return;
    var signals = readSignals();
    fillLists(lists, signals);
    var text = signals.map(function (pair) {
      return pair[0] + ': ' + pair[1];
    }).join('\n');
    digest(text).then(function (d) {
      var g = geometry(bytesOf(d.hex));
      var id = d.hex.slice(0, 4) + ' ' + d.hex.slice(4, 8) + ' ' + d.hex.slice(8, 12);
      each(seals, function (seal) {
        paint(seal, g);
      });
      each(document.querySelectorAll('[data-seal-id]'), function (el) {
        el.textContent = 'Seal ' + id.toUpperCase();
      });
      each(document.querySelectorAll('[data-seal-caption]'), function (el) {
        el.textContent = 'Drawn just now from ' + signals.length + ' signals your browser gave this page, hashed' +
          (d.how === 'sha' ? ' with SHA 256' : '') + ' in your browser. Nothing is stored or sent.';
      });
      try {
        document.dispatchEvent(new CustomEvent('seal:drawn', { bubbles: true, detail: { signals: signals.length, id: id.toUpperCase() } }));
      } catch (e) {}
    });
  }

  /* Start */

  function start() {
    try {
      drawSeals();
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
