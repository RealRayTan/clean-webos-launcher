(function () {
  'use strict';
  var scene = document.getElementById('scene');
  var overlay = document.getElementById('overlay');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var enabled = true, entries = [], cursor = 0, serial = 0, timer, moving;
  try { enabled = localStorage.getItem('frame-live.motion') !== 'off'; } catch (error) {}
  function create(tag, className, text) {
    var element = document.createElement(tag); element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function blocked(manual) {
    return document.hidden || !overlay.hidden || scene.dataset.idle === 'true' || reduced.matches || (!manual && !enabled);
  }
  function hint() {
    var note = document.getElementById('motionHint'); if (!note) return;
    note.textContent = reduced.matches ? '已按系统偏好减少动态效果' : (enabled ? '空格 暂停轮换' : '空格 继续轮换') + ' · D 切换一张';
  }
  function arm(delay) {
    clearTimeout(timer); timer = null;
    if (!blocked(false)) timer = setTimeout(function () { timer = null; step(false); arm(2900); }, delay || 2900);
  }
  function interactive(entry) {
    return entry.button.matches(':hover') || entry.button.contains(document.activeElement);
  }
  function content(entry) {
    var items = PublicContent.items(entry.id);
    if (!items.length) return false;
    var selected = items[entry.index % items.length];
    entry.current = selected; entry.image.src = selected.image;
    entry.title.textContent = selected.title;
    entry.subtitle.textContent = selected.subtitle;
    entry.source.textContent = selected.providerLabel;
    entry.button.dataset.contentId = selected.id;
    entry.button.dataset.contentFetchedAt = selected.fetchedAt || '';
    return true;
  }
  function settle(entry, animation, back) {
    if (entry.animation !== animation) return;
    entry.animation = null; entry.back = back;
    entry.inner.style.transform = 'rotate' + entry.axis + '(' + (back ? 180 : 0) + 'deg)';
    entry.button.dataset.face = back ? 'content' : 'brand'; entry.button.dataset.motion = 'rest';
    if (back) entry.shown = ++serial; else entry.index++;
    if (moving === entry) moving = null;
  }
  function flip(entry) {
    var back = !entry.back, sign = entry.direction;
    if (back && !content(entry)) return;
    var from = entry.back ? 180 : 0;
    var to = entry.back ? (sign > 0 ? 360 : 0) : sign * 180;
    entry.button.dataset.motion = 'flipping'; moving = entry;
    var animation = entry.inner.animate([
      { transform: 'rotate' + entry.axis + '(' + from + 'deg)' },
      { transform: 'rotate' + entry.axis + '(' + to + 'deg)' }
    ], { duration: 680, easing: 'cubic-bezier(.65,0,.35,1)' });
    entry.animation = animation;
    animation.onfinish = function () { settle(entry, animation, back); };
  }
  function step(manual) {
    entries = entries.filter(function (entry) { return document.documentElement.contains(entry.button); });
    if (blocked(manual) || moving || !entries.length) return;
    var eligible = entries.filter(function (entry) { return !interactive(entry) && PublicContent.items(entry.id).length; });
    var showing = entries.filter(function (entry) { return entry.back; });
    var target;
    if (showing.length >= 3) target = eligible.filter(function (entry) { return entry.back; }).sort(function (a, b) { return a.shown - b.shown; })[0];
    if (!target) {
      for (var i = 0; i < entries.length; i++) {
        var candidate = entries[cursor++ % entries.length];
        if (!interactive(candidate) && PublicContent.items(candidate.id).length) { target = candidate; break; }
      }
    }
    if (target) flip(target);
  }
  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem('frame-live.motion', value ? 'on' : 'off'); } catch (error) {}
    hint(); arm();
  }
  function pauseAll() {
    clearTimeout(timer); timer = null;
    if (moving && moving.animation) moving.animation.finish();
  }
  window.TileMotion = {
    attach: function (button, id) {
      if (!PublicContent.supports(id) || button.classList.contains('live-tile')) return;
      entries = entries.filter(function (entry) { return document.documentElement.contains(entry.button); });
      var entry = { id: id, button: button, index: 0, back: false, shown: 0, axis: entries.length % 2 ? 'Y' : 'X', direction: entries.length % 3 ? -1 : 1 };
      var inner = create('span', 'tile-turner'), front = create('span', 'tile-face tile-face--brand');
      inner.setAttribute('aria-hidden', 'true');
      while (button.firstChild) front.appendChild(button.firstChild);
      inner.appendChild(front);
      var back = create('span', 'tile-face tile-face--content');
      entry.image = create('img', 'live-art'); entry.image.alt = ''; back.appendChild(entry.image);
      back.appendChild(create('span', 'live-shade'));
      entry.source = create('span', 'live-source'); back.appendChild(entry.source);
      var copy = create('span', 'live-copy'); entry.title = create('strong', 'live-title'); entry.subtitle = create('small', 'live-subtitle');
      copy.appendChild(entry.title); copy.appendChild(entry.subtitle); back.appendChild(copy); inner.appendChild(back); button.appendChild(inner);
      button.classList.add('live-tile'); button.dataset.axis = entry.axis; button.dataset.face = 'brand'; button.dataset.motion = 'rest';
      entry.inner = inner; content(entry); entries.push(entry);
      function hold() { if (entry.animation) entry.animation.finish(); }
      button.addEventListener('focus', hold); button.addEventListener('mouseenter', hold);
    },
    settings: function (body) {
      var row = create('div', 'settings-row'); row.appendChild(create('span', '', '动态磁贴'));
      var group = create('div', 'choice-group'); row.appendChild(group);
      [true, false].forEach(function (value) {
        var control = create('button', 'choice' + (enabled === value ? ' selected' : ''), value ? '自动轮换' : '暂停轮换');
        control.dataset.key = 'motion-' + (value ? 'on' : 'off'); control.setAttribute('aria-pressed', String(enabled === value));
        control.onclick = function () {
          setEnabled(value);
          Array.prototype.forEach.call(group.children, function (item) {
            var selected = (item === control); item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected));
          });
        }; group.appendChild(control);
      }); body.appendChild(row);
    },
    selected: function (id) {
      var entry = entries.filter(function (value) { return value.id === id; })[0];
      return entry && entry.back ? entry.current : null;
    },
    start: function () {
      PublicContent.subscribe(function () {
        Array.prototype.forEach.call(document.querySelectorAll('#apps .app-tile'), function (button) { TileMotion.attach(button, button.dataset.key); });
        entries.forEach(function (entry) {
          if (!PublicContent.items(entry.id).some(function (item) { return entry.current && item.id === entry.current.id; })) {
            if (entry.animation) { entry.animation.cancel(); entry.animation = null; }
            if (moving === entry) moving = null;
            entry.back = false; entry.current = null; entry.inner.style.transform = 'none'; entry.button.dataset.face = 'brand'; entry.button.dataset.motion = 'rest';
          }
        });
        entries.forEach(function (entry) { if (!entry.back && !entry.animation) content(entry); });
      });
      PublicContent.start();
      hint(); arm(1600);
      document.addEventListener('visibilitychange', function () { if (document.hidden) pauseAll(); else arm(1800); });
      document.addEventListener('keydown', function (event) {
        if (!overlay.hidden || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
        if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); setEnabled(!enabled); }
        if ((event.key || '').toLowerCase() === 'd') { event.preventDefault(); step(true); arm(); }
      });
      new MutationObserver(function () { if (blocked(false)) pauseAll(); else arm(); }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
      new MutationObserver(function () { if (scene.dataset.idle === 'true') pauseAll(); else if (!timer) arm(); }).observe(scene, { attributes: true, attributeFilter: ['data-idle'] });
      reduced.addEventListener('change', function () {
        if (reduced.matches) {
          pauseAll();
          entries.forEach(function (entry) {
            if (entry.animation) { entry.animation.cancel(); entry.animation = null; }
            entry.back = false; entry.inner.style.transform = 'none'; entry.button.dataset.face = 'brand'; entry.button.dataset.motion = 'rest';
          });
          moving = null;
        } else arm();
        hint();
      });
    }
  };
}());
