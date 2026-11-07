/*
  ai.js: the AI page. It upgrades four blocks that already read in full without it:
  1. the prompt breakdown: tabs, and a note for each marked phrase,
  2. the build log: a stepper through the eight messages,
  3. the job search map: pick a stage to see who does it,
  4. the tool check: tabs.
  Every word on screen comes from the HTML. This file only shows, hides, and marks state.
  It stores nothing and makes no requests.
*/
(function () {
  'use strict';

  var EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

  function query(text) {
    return typeof window.matchMedia === 'function' ? window.matchMedia(text) : null;
  }

  var motion = query('(prefers-reduced-motion: reduce)');
  var wide = query('(min-width: 1200px)');
  var phone = query('(max-width: 719px)');

  function on(q) {
    return !!(q && q.matches);
  }

  function watch(q, fn) {
    if (!q) return;
    if (typeof q.addEventListener === 'function') q.addEventListener('change', fn);
    else if (typeof q.addListener === 'function') q.addListener(fn);
  }

  function all(root, selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function byId(id) {
    return id ? document.getElementById(id) : null;
  }

  function words(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function sentence(text) {
    return /[.?!”:]$/.test(text) ? text : text + '.';
  }

  function say(region, message) {
    if (region && message) region.textContent = message;
  }

  // A quick fade for content the visitor just asked for. Nothing moves, and under reduced
  // motion nothing fades either.
  function fadeIn(el, ms) {
    if (!el || on(motion) || typeof el.animate !== 'function') return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE });
  }

  // Transitions switch on two frames after setup, so building the page animates nothing.
  function settle(section) {
    var frame = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
    frame(function () {
      frame(function () {
        section.classList.add('ai-anim');
      });
    });
  }

  // On phones the note or card that just changed can sit below the fold. Bring it up only then.
  // After a choice made from the keyboard, keep is the control that has focus: the card then comes
  // up only as far as it can while that control stays on screen.
  function reveal(el, keep) {
    if (!el || !on(phone) || typeof el.scrollIntoView !== 'function') return;
    var box = el.getBoundingClientRect();
    var height = window.innerHeight || document.documentElement.clientHeight;
    if (box.top >= 0 && box.bottom <= height) return;
    var behavior = on(motion) ? 'auto' : 'smooth';
    if (!keep) {
      el.scrollIntoView({ block: 'nearest', behavior: behavior });
      return;
    }
    var by = Math.min(box.bottom - height + 16, keep.getBoundingClientRect().top - 16);
    if (by > 0) window.scrollBy({ top: by, behavior: behavior });
  }

  // Tabs, following the WAI ARIA pattern: arrow keys, Home, and End move and select.
  function makeTabs(tablist, onSelect) {
    var tabs = all(tablist, '[role="tab"]');
    var panels = tabs.map(function (tab) {
      return byId(tab.getAttribute('aria-controls'));
    });
    if (!tabs.length || panels.indexOf(null) !== -1) return null;
    var current = -1;

    panels.forEach(function (panel, i) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabs[i].id);
    });

    function select(i, how) {
      how = how || {};
      if (i !== current) {
        tabs.forEach(function (tab, j) {
          var chosen = j === i;
          tab.setAttribute('aria-selected', chosen ? 'true' : 'false');
          tab.tabIndex = chosen ? 0 : -1;
          panels[j].hidden = !chosen;
        });
        current = i;
        if (onSelect) onSelect(i, how);
        if (how.user) fadeIn(panels[i], 180);
      }
      if (how.focus) tabs[i].focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        select(i, { user: true });
      });
    });

    tablist.addEventListener('keydown', function (event) {
      var i = tabs.indexOf(event.target);
      var last = tabs.length - 1;
      var to;
      if (i === -1) return;
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          to = i === last ? 0 : i + 1;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          to = i === 0 ? last : i - 1;
          break;
        case 'Home':
          to = 0;
          break;
        case 'End':
          to = last;
          break;
        default:
          return;
      }
      event.preventDefault();
      select(to, { user: true, focus: true });
    });

    var start = tabs.findIndex(function (tab) {
      return tab.getAttribute('aria-selected') === 'true';
    });
    tablist.hidden = false;
    select(start === -1 ? 0 : start);
    return { panels: panels };
  }

  // 1. Prompt breakdown. Each marked phrase gets its numbered pin; one note shows at a time.
  function initPrompts() {
    var section = document.querySelector('.ai-anatomy');
    var tablist = section && section.querySelector('.ai-tabs--prompts');
    if (!tablist) return;
    var status = section.querySelector('[role="status"]');
    var panels = all(tablist, '[role="tab"]').map(function (tab) {
      return byId(tab.getAttribute('aria-controls'));
    });
    if (!panels.length || panels.indexOf(null) !== -1) return;

    // The pin moves into its phrase beside the last word, so a line can never end between them.
    function glue(mark, pin) {
      var last = mark.lastChild;
      var tail = document.createElement('span');
      tail.className = 'ai-glue';
      if (last && last.nodeType === 3) {
        var cut = last.nodeValue.lastIndexOf(' ') + 1;
        tail.appendChild(document.createTextNode(last.nodeValue.slice(cut)));
        if (cut > 0) last.nodeValue = last.nodeValue.slice(0, cut);
        else mark.removeChild(last);
      }
      tail.appendChild(pin);
      mark.appendChild(tail);
    }

    var prompts = panels.map(function (panel) {
      var phrases = [];
      all(panel, '.ai-pin').forEach(function (pin) {
        var mark = pin.previousElementSibling;
        var note = byId(pin.getAttribute('aria-controls'));
        if (!mark || !mark.classList.contains('ai-mark') || !note) return;
        pin.setAttribute('aria-label', words(note.querySelector('.ai-note__count')) + ': ' + words(mark));
        glue(mark, pin);
        pin.hidden = false;
        phrases.push({ pin: pin, mark: mark, note: note });
      });
      return {
        panel: panel,
        quote: panel.querySelector('.ai-quote'),
        notes: panel.querySelector('.ai-notes'),
        back: panel.querySelector('.ai-back'),
        phrases: phrases,
        open: -1
      };
    });

    var shown = 0;

    // Desktop: the note card sits in the margin level with its phrase, like a review comment,
    // and never runs past the end of the prompt.
    function place(p) {
      var phrase = p && p.phrases[p.open];
      if (!phrase) return;
      var note = phrase.note;
      var now = parseFloat(note.style.marginTop) || 0;
      var y = 0;
      if (on(wide) && !p.panel.hidden && p.notes) {
        var rects = phrase.mark.getClientRects();
        var top = p.notes.getBoundingClientRect().top;
        var end = (p.back || p.quote).getBoundingClientRect().bottom;
        if (rects.length) y = rects[0].top - top - 10;
        y = Math.round(Math.max(0, Math.min(y, end - top - note.offsetHeight)));
      }
      if (Math.abs(now - y) >= 1) note.style.marginTop = y ? y + 'px' : '';
    }

    // One note is always open. Pressing the open phrase again keeps it open and reads its note
    // once more.
    function open(p, k, how) {
      how = how || {};
      if (!p.phrases[k]) return;
      var note = p.phrases[k].note;
      if (k !== p.open) {
        p.phrases.forEach(function (phrase, j) {
          var chosen = j === k;
          phrase.pin.setAttribute('aria-expanded', chosen ? 'true' : 'false');
          phrase.mark.classList.toggle('is-on', chosen);
          phrase.note.hidden = !chosen;
          if (!chosen) phrase.note.style.marginTop = '';
        });
        p.open = k;
        place(p);
        if (how.user) fadeIn(note, 140);
      }
      if (how.user) {
        // "Phrase 2 of 6." then the phrase and the note, so a screen reader pauses after the count.
        var parts = ['.ai-note__count', '.ai-note__phrase', '.ai-note__text'].map(function (selector) {
          return words(note.querySelector(selector));
        }).filter(Boolean);
        if (parts.length > 1) parts[0] = sentence(parts[0]);
        say(status, parts.length ? parts.join(' ') : words(note));
        reveal(note);
      }
    }

    prompts.forEach(function (p) {
      if (!p.quote || !p.phrases.length) return;
      open(p, 0);
      p.quote.addEventListener('click', function (event) {
        var mark = event.target.closest ? event.target.closest('.ai-mark') : null;
        if (!mark) return;
        var k = p.phrases.findIndex(function (phrase) {
          return phrase.mark === mark;
        });
        if (k !== -1) open(p, k, { user: true });
      });
    });

    section.classList.add('ai-on');
    if (!makeTabs(tablist, function (i) {
      shown = i;
      place(prompts[i]);
    })) {
      section.classList.remove('ai-on');
      return;
    }

    function placeShown() {
      place(prompts[shown]);
    }

    if (typeof window.ResizeObserver === 'function') {
      var observer = new window.ResizeObserver(placeShown);
      prompts.forEach(function (p) {
        if (p.quote) observer.observe(p.quote);
      });
    } else {
      window.addEventListener('resize', placeShown);
    }
    watch(wide, placeShown);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeShown);
    settle(section);
  }

  // 2. Build log (removed from the page on November 6, 2026 at will's request; the code stays
  //    harmless and runs only if a .ai-log section exists).
  function initLog() {
    var section = document.querySelector('.ai-log');
    var bar = section && section.querySelector('.ai-stepper');
    if (!bar) return;
    var row = bar.querySelector('.ai-steps');
    var steps = all(bar, '.ai-steps__btn');
    var entries = all(section, '.ai-entry');
    var prev = bar.querySelector('.ai-stepper__prev');
    var next = bar.querySelector('.ai-stepper__next');
    var status = section.querySelector('[role="status"]');
    if (!row || !prev || !next || !steps.length || steps.length !== entries.length) return;
    var last = steps.length - 1;
    var current = -1;

    function stop(button, at) {
      if (at) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    }

    function go(i, how) {
      how = how || {};
      i = Math.max(0, Math.min(last, i));
      if (i !== current) {
        steps.forEach(function (step, j) {
          if (j === i) step.setAttribute('aria-current', 'step');
          else step.removeAttribute('aria-current');
          step.tabIndex = j === i ? 0 : -1;
          step.classList.toggle('is-past', j < i);
        });
        entries.forEach(function (entry, j) {
          entry.classList.toggle('is-current', j === i);
        });
        stop(prev, i === 0);
        stop(next, i === last);
        row.style.setProperty('--ai-progress', String(last ? i / last : 0));
        current = i;
        if (how.user) {
          if (on(phone)) fadeIn(entries[i], 200);
          say(status, words(entries[i].querySelector('.ai-entry__count')));
        }
      }
      if (how.focus) steps[current].focus();
    }

    steps.forEach(function (step, i) {
      step.addEventListener('click', function () {
        go(i, { user: true });
      });
    });

    prev.addEventListener('click', function () {
      if (prev.getAttribute('aria-disabled') !== 'true') go(current - 1, { user: true });
    });

    next.addEventListener('click', function () {
      if (next.getAttribute('aria-disabled') !== 'true') go(current + 1, { user: true });
    });

    row.addEventListener('keydown', function (event) {
      var to;
      if (steps.indexOf(event.target) === -1) return;
      switch (event.key) {
        case 'ArrowRight':
          to = current + 1;
          break;
        case 'ArrowLeft':
          to = current - 1;
          break;
        case 'Home':
          to = 0;
          break;
        case 'End':
          to = last;
          break;
        default:
          return;
      }
      event.preventDefault();
      go(to, { user: true, focus: true });
    });

    section.classList.add('ai-on');
    bar.hidden = false;
    go(0);
    settle(section);
  }

  // 3. Job search map. One stage open at a time.
  function initMap() {
    var section = document.querySelector('.ai-flow');
    var map = section && section.querySelector('.ai-map');
    if (!map) return;
    var nodes = all(map, '.ai-node');
    var stages = nodes.map(function (node) {
      return byId(node.getAttribute('aria-controls'));
    });
    var status = section.querySelector('[role="status"]');
    if (!nodes.length || stages.indexOf(null) !== -1) return;
    var current = -1;

    function describe(stage) {
      var parts = [words(stage.querySelector('.ai-stage__count')) + ', ' + words(stage.querySelector('.ai-stage__name'))];
      all(stage, '.ai-facts > div').forEach(function (fact) {
        parts.push(words(fact.querySelector('dt')) + ': ' + words(fact.querySelector('dd')));
      });
      return parts.map(sentence).join(' ');
    }

    function choose(i, how) {
      how = how || {};
      if (i === current) return;
      nodes.forEach(function (node, j) {
        node.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      stages.forEach(function (stage, j) {
        stage.classList.toggle('is-current', j === i);
      });
      current = i;
      if (how.user) {
        if (on(phone)) fadeIn(stages[i], 200);
        say(status, describe(stages[i]));
        reveal(stages[i], how.pointer ? null : nodes[i]);
      }
    }

    nodes.forEach(function (node, i) {
      // Enter and Space fire a click with detail 0; a tap or a mouse click counts at least 1.
      node.addEventListener('click', function (event) {
        choose(i, { user: true, pointer: event.detail > 0 });
      });
    });

    var start = nodes.findIndex(function (node) {
      return node.getAttribute('aria-pressed') === 'true';
    });
    section.classList.add('ai-on');
    map.hidden = false;
    choose(start === -1 ? 0 : start);
    settle(section);
  }

  // 4. Tool check. Three tools as tabs; each panel is one static check card.
  function initTools() {
    var section = document.querySelector('.ai-trust');
    var tablist = section && section.querySelector('.ai-tabs--tools');
    if (!tablist) return;
    var tabs = makeTabs(tablist);
    if (!tabs) return;
    // The cards hold no controls, so each one takes focus itself after the tab list.
    tabs.panels.forEach(function (panel) {
      panel.tabIndex = 0;
    });
    section.classList.add('ai-on');
  }

  function start() {
    initPrompts();
    initLog();
    initMap();
    initTools();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
