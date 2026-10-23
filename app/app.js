/* Local webOS launcher. D13 poster home plus the existing settings and dialogs. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var scene = $('scene'), overlay = $('overlay'), panel = overlay.querySelector('.dialog'), body = $('dialog-body');
  var track = $('track'), menuEl = $('menu'), panelEl = $('menuPanel');
  var panelButtons = Array.prototype.slice.call(panelEl.querySelectorAll('.menu-item'));
  var layers = [$('layerA'), $('layerB')], backgrounds = [$('bgA'), $('bgB')], cards = [$('cardA'), $('cardB')];
  var clockEl = $('clock'), dateEl = $('date'), captionTitle = $('captionTitle'), captionText = $('captionText');
  var screensaver = $('screensaver'), screensaverClockWrap = $('screensaverClockWrap');
  var screensaverClock = $('screensaverClock'), screensaverDate = $('screensaverDate');
  var focusLine = null;
  var KEY = 'tvhome.tiles.v1';
  var computer = CONFIG.computerInput || 'com.webos.app.hdmi4';
  var vpnId = 'com.alcyone.vpn.singbox';
  var defaults = ['com.biliwebos.app', 'youtube.leanback.v4', 'netflix', 'com.beb.plxnative', 'com.apple.appletv'];
  var brands = {
    'com.biliwebos.app': { name: '哔哩哔哩', subtitle: '视频与番剧', icon: 'bilibili.svg', style: 'bili' },
    'youtube.leanback.v4': { name: 'YouTube', icon: 'youtube.svg', style: 'youtube' },
    netflix: { name: 'Netflix', icon: 'netflix.svg', style: 'netflix' },
    'com.beb.plxnative': { name: 'PlxNative', style: 'plx' },
    'com.apple.appletv': { name: 'Apple TV', icon: 'appletv.svg', style: 'apple' },
    amazon: { name: 'Prime Video', style: 'prime' },
    'com.alcyone.vpn.singbox': { name: 'Alcyone', subtitle: 'VPN', style: 'alcyone' },
    'org.webosbrew.hbchannel': { name: 'Homebrew', subtitle: 'Channel', style: 'homebrew' },
    'com.webos.app.home': { name: '桌面', subtitle: '主屏幕', style: 'generic' }
  };
  var contentHints = {
    'com.biliwebos.app': '正在读取公开热门',
    'youtube.leanback.v4': '正在读取 NASA 频道',
    netflix: '正在读取 Netflix 周榜',
    'com.apple.appletv': '正在读取 Apple TV 片单',
    amazon: '正在读取 Prime Video 片单'
  };
  var deviceKeys = ['default', 'pc', 'ps5', 'ps4', 'xbox', 'switch', 'media'];
  var devicePresets = {
    default: { name: '', badge: '', color: '' },
    pc: { name: '电脑', badge: 'PC', color: '#3B82F6' },
    ps5: { name: 'PS5', badge: 'PS5', color: '#123CA6' },
    ps4: { name: 'PS4', badge: 'PS4', color: '#173070' },
    xbox: { name: 'Xbox', badge: 'Xbox', color: '#107C10' },
    switch: { name: 'Switch', badge: 'Switch', color: '#C82131' },
    media: { name: '媒体中心', badge: 'MEDIA', color: '#5B6B5D' }
  };
  function cleanDevices(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    var out = {};
    Object.keys(value).forEach(function (id) {
      if (/^com\.webos\.app\.hdmi[1-4]$/.test(id) && deviceKeys.indexOf(value[id]) >= 0) out[id] = value[id];
    });
    return out;
  }
  function deviceInfo(id) {
    return devicePresets[state.devices && state.devices[id]] || devicePresets.default;
  }
  function sanitizeApps(value) {
    if (!Array.isArray(value)) return [];
    var seen = Object.create(null);
    return value.filter(function (app) {
      if (!app || typeof app.id !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(app.id) || seen[app.id] || typeof app.title !== 'string') return false;
      seen[app.id] = true;
      return true;
    }).map(function (app) { return { id: app.id, title: app.title, icon: typeof app.icon === 'string' ? app.icon : '', iconColor: app.iconColor || '' }; });
  }
  var catalog = sanitizeApps(window.TV_APPS && TV_APPS.apps);
  try { var cached = sanitizeApps(JSON.parse(localStorage.getItem('tvhome.catalog'))); if (cached.length) catalog = cached; } catch (error) {}
  var state = { theme: 'auto', wallpaper: 'valley', apps: defaults.slice(), lastFocus: 'computer', devices: {} };
  var hasLocalState = false;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && ['auto', 'light', 'dark', 'oled'].indexOf(saved.theme) >= 0 && ['valley', 'peaks', 'plain'].indexOf(saved.wallpaper) >= 0 && Array.isArray(saved.apps)) {
      hasLocalState = true;
      state = { theme: saved.theme, wallpaper: saved.wallpaper, apps: saved.apps.filter(function (id, i, all) { return typeof id === 'string' && /^[A-Za-z0-9_.-]+$/.test(id) && all.indexOf(id) === i; }), lastFocus: saved.lastFocus || 'computer', devices: cleanDevices(saved.devices) };
    } else {
      var hidden = JSON.parse(localStorage.getItem('tvhome.hidden'));
      if (!Array.isArray(hidden)) hidden = CONFIG.hiddenApps || [];
      var legacy = JSON.parse(localStorage.getItem('tvhome.order'));
      if (legacy && Array.isArray(legacy.ids)) state.apps = legacy.ids.filter(function (id) { return hidden.indexOf(id) < 0; });
      else state.apps = defaults.filter(function (id) { return hidden.indexOf(id) < 0; });
    }
  } catch (error) {}
  var items = [], index = 0, zone = 'list', menuIndex = 0, offset = 0;
  var frontIndex = 0, frontImage = '', coverKey = '', pending = null, fadeTimer = 0, requestId = 0;
  var preloads = {}, COVER_FADE_MS = 600;
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var dialogType = '', returnZone = 'list', loadingApps = false, lastLaunch = 0, toastTimer;
  var okDown = false, okTarget = null, orderDraft = null, movingId = null;
  var vpnRequest = 0;
  var screensaverOn = false, lastActivity = Date.now(), screensaverShiftTimer = 0;
  var IDLE_TIMEOUT_MS = 3 * 60 * 1000, PIXEL_SHIFT_MS = 25 * 1000;
  document.body.classList.toggle('on-tv', TVDevice.available);

  function homeIds() { return state.apps.filter(function (id) { return !!installed(id); }); }
  function icon(file) { var img = document.createElement('img'); img.src = 'assets/' + file; img.alt = ''; return img; }
  function toast(text) { var el = $('toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('visible'); }, 2400); }
  function commit(changes) {
    var next = { theme: state.theme, wallpaper: state.wallpaper, apps: state.apps.slice(), lastFocus: state.lastFocus, devices: state.devices || {} };
    Object.keys(changes).forEach(function (key) { next[key] = changes[key]; });
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch (error) { toast('保存失败，已保留原来的设置'); return false; }
    state = next;
    if (window.TVDevice && TVDevice.saveState) TVDevice.saveState(state);
    return true;
  }
  function adoptState(saved) {
    if (!saved || ['auto', 'light', 'dark', 'oled'].indexOf(saved.theme) < 0 ||
        ['valley', 'peaks', 'plain'].indexOf(saved.wallpaper) < 0 || !Array.isArray(saved.apps)) return;
    var apps = saved.apps.filter(function (id, i, all) {
      return typeof id === 'string' && /^[A-Za-z0-9_.-]+$/.test(id) && all.indexOf(id) === i;
    });
    state = { theme: saved.theme, wallpaper: saved.wallpaper, apps: apps,
      lastFocus: typeof saved.lastFocus === 'string' ? saved.lastFocus : 'computer', devices: cleanDevices(saved.devices) };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) {}
    hasLocalState = true;
    appearance(); renderList(state.lastFocus);
  }
  function installed(id) { return catalog.filter(function (app) { return app.id === id; })[0]; }
  function appInfo(id) {
    var app = installed(id), brand = brands[id] || {};
    return { id: id, name: brand.name || (app && app.title) || id, subtitle: id === 'youtube.leanback.v4' && app && /adfree/i.test(app.title) ? 'AdFree' : brand.subtitle || '', icon: brand.icon, installedIcon: app && app.icon, style: brand.style || 'generic' };
  }
  function fit() {
    var reserve = TVDevice.available ? 0 : 30;
    var scale = Math.min(window.innerWidth / 1920, (window.innerHeight - reserve) / 1080);
    scene.style.transform = 'scale(' + scale + ')';
    scene.style.left = ((window.innerWidth - 1920 * scale) / 2) + 'px';
    scene.style.top = ((window.innerHeight - reserve - 1080 * scale) / 2) + 'px';
  }
  function appearance() {
    var effective = FrameTheme.resolve(state.theme, new Date().getHours());
    scene.dataset.theme = effective; scene.dataset.wallpaper = state.wallpaper;
    var darkLike = effective === 'dark' || effective === 'oled';
    $('theme').setAttribute('aria-label', (darkLike ? '切换浅色主题' : '切换深色主题') + (state.theme === 'auto' ? '，当前按时间自动切换' : ''));
  }
  function clock() {
    var now = new Date(), h = now.getHours();
    var time = ('0' + h).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    var date = (now.getMonth() + 1) + '月' + now.getDate() + '日，星期' + '日一二三四五六'.charAt(now.getDay());
    clockEl.textContent = time;
    dateEl.textContent = date;
    if (screensaverClock) screensaverClock.textContent = time;
    if (screensaverDate) screensaverDate.textContent = date.replace('，', ' ');
    appearance();
  }
  function shiftScreensaverClock() {
    var maxX = 240, maxY = 140;
    var x = Math.round((Math.random() - .5) * 2 * maxX);
    var y = Math.round((Math.random() - .5) * 2 * maxY);
    if (screensaverClockWrap) screensaverClockWrap.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  }
  function enterScreensaver() {
    if (screensaverOn || document.hidden || !overlay.hidden || !panelEl.hidden) return;
    screensaverOn = true;
    screensaver.hidden = false;
    shiftScreensaverClock();
    clearInterval(screensaverShiftTimer);
    screensaverShiftTimer = setInterval(shiftScreensaverClock, PIXEL_SHIFT_MS);
  }
  function exitScreensaver() {
    if (!screensaverOn) return;
    screensaverOn = false;
    screensaver.hidden = true;
    clearInterval(screensaverShiftTimer);
    screensaverShiftTimer = 0;
    lastActivity = Date.now();
  }
  function markActivity() {
    lastActivity = Date.now();
    if (screensaverOn) exitScreensaver();
  }

  function wallpaperSrc() { return state.wallpaper === 'peaks' ? 'assets/peaks.jpg' : 'assets/valley.jpg'; }
  function homeItems() {
    var preset = deviceInfo(computer);
    var computerName = preset.name || '电脑';
    var list = [{
      id: computer, name: computerName, meta: 'HDMI 4',
      icon: preset.badge ? '' : 'device-desktop.svg',
      badge: preset.badge, badgeColor: preset.color,
      style: 'computer', desc: preset.name ? '切换到 ' + preset.name + ' 输入源' : '切换到电脑输入源',
      fallback: wallpaperSrc()
    }];
    homeIds().forEach(function (id) {
      var info = appInfo(id);
      list.push({ id: id, name: info.name, meta: info.subtitle, icon: info.icon, installedIcon: info.installedIcon, style: info.style, subtitle: info.subtitle, desc: '打开应用', fallback: wallpaperSrc() });
    });
    return list;
  }
  function renderList(preferredId) {
    PublicContent.setApps(catalog);
    var wanted = preferredId || (items[index] && items[index].id) || state.lastFocus || computer;
    items = homeItems();
    var next = 0, found = false;
    items.forEach(function (item, i) { if (item.id === wanted) { next = i; found = true; } });
    index = found ? next : 0;
    track.innerHTML = '';
    items.forEach(function (app, i) {
      var row = document.createElement('button');
      row.type = 'button'; row.className = 'row'; row.dataset.index = String(i); row.setAttribute('role', 'option');
      row.setAttribute('aria-label', (app.id === computer ? '电脑，切换到 HDMI 4' : '打开 ' + app.name));
      if (app.badge) {
        var deviceMark = document.createElement('span'); deviceMark.className = 'mark device-mark';
        deviceMark.textContent = app.badge;
        if (app.badgeColor) deviceMark.style.color = app.badgeColor;
        row.appendChild(deviceMark);
      } else if (app.icon) {
        var iconBox = document.createElement('span');
        iconBox.className = 'icon' + (app.style && ['bili', 'youtube', 'netflix'].indexOf(app.style) >= 0 ? ' icon--' + app.style : '');
        var image = document.createElement('img'); image.src = 'assets/' + app.icon; image.alt = ''; iconBox.appendChild(image); row.appendChild(iconBox);
      } else if (app.installedIcon) {
        var installedBox = document.createElement('span'); installedBox.className = 'icon installed';
        var installedImage = document.createElement('img'); installedImage.src = app.installedIcon; installedImage.alt = ''; installedBox.appendChild(installedImage); row.appendChild(installedBox);
      } else {
        var mark = document.createElement('span'); mark.className = 'mark';
        mark.textContent = app.style === 'prime' ? 'P' : app.name.charAt(0); row.appendChild(mark);
      }
      var name = document.createElement('span'); name.className = 'name'; name.textContent = app.name; row.appendChild(name);
      if (app.meta) { var meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = app.meta; row.appendChild(meta); }
      row.addEventListener('click', function () { if (index === i) launch(items[i].id); else setIndex(i); });
      track.appendChild(row);
    });
    focusLine = document.createElement('div'); focusLine.className = 'focus-line'; focusLine.setAttribute('aria-hidden', 'true'); track.appendChild(focusLine);
    updateList(); updateCover(); updateZones();
  }
  function rows() { return Array.prototype.slice.call(track.querySelectorAll('.row')); }
  function setIndex(next) {
    index = Math.max(0, Math.min(items.length - 1, next));
    zone = 'list';
    updateList(); updateCover(); updateZones();
  }
  function updateList() {
    offset = Math.max(0, Math.min(index - 3, items.length - 6));
    track.style.transform = 'translateY(' + (-offset * 100) + 'px)';
    if (focusLine) focusLine.style.transform = 'translateY(' + (index * 100) + 'px)';
    rows().forEach(function (row, i) {
      row.classList.toggle('focus', i === index);
      row.setAttribute('aria-selected', String(i === index));
    });
  }
  function updateZones() {
    var inMenu = zone === 'menu' || zone === 'panel';
    menuEl.classList.toggle('focus', inMenu);
    panelEl.hidden = zone !== 'panel';
    panelButtons.forEach(function (button, i) { button.classList.toggle('focus', zone === 'panel' && i === menuIndex); });
  }
  function openPanel() { zone = 'panel'; menuIndex = 0; updateZones(); }
  function closePanel() { zone = 'menu'; updateZones(); }
  function act(action) {
    zone = 'menu'; updateZones();
    if (action === 'all') { openDialog('all'); refreshApps(false); }
    else if (action === 'inputs') openDialog('inputs');
    else if (action === 'settings') openDialog('settings');
    else if (action === 'network') {
      if (installed(vpnId)) launch(vpnId); else launch('com.palm.app.settings', { target: 'network' });
      zone = 'list'; updateZones();
    }
  }

  function contentFor(app) {
    var list = window.PublicContent ? PublicContent.items(app.id) : [];
    return list && list.length ? list[0] : null;
  }
  function coverState() {
    var app = items[index] || { id: computer, name: '电脑', meta: 'HDMI 4', fallback: wallpaperSrc(), desc: '切换到电脑输入源' };
    var item = contentFor(app);
    var src = item && item.image ? item.image : (app.fallback || wallpaperSrc());
    var title = item ? item.title : app.name + (app.meta ? ' · ' + app.meta : '');
    var text;
    if (item) text = item.description || item.subtitle || '';
    else if (app.id === computer) text = '切换到电脑输入源';
    else text = contentHints[app.id] || app.subtitle || '打开应用';
    return { app: app, item: item, src: src, title: title, text: text };
  }
  function setCaption(title, text) {
    if (captionTitle.textContent === title && captionText.textContent === text) return;
    captionTitle.textContent = title; captionText.textContent = text;
  }
  function preloadCovers() {
    items.forEach(function (app) {
      var item = contentFor(app);
      if (!item || preloads[item.image]) return;
      preloads[item.image] = true;
      var image = new Image(); image.src = item.image;
      if (image.decode) image.decode().catch(function () {});
    });
    [wallpaperSrc(), 'assets/valley.jpg', 'assets/peaks.jpg'].forEach(function (src) {
      if (preloads[src]) return;
      preloads[src] = true;
      var image = new Image(); image.src = src;
      if (image.decode) image.decode().catch(function () {});
    });
  }
  function updateCover() {
    preloadCovers();
    var next = coverState();
    var key = next.app.id + '|' + next.src + '|' + next.title + '|' + next.text;
    if (key === coverKey) return;
    coverKey = key;
    goTo(next);
  }
  function finishFade() {
    if (!pending) return;
    clearTimeout(fadeTimer); fadeTimer = 0;
    var incoming = layers[pending.index], outgoing = layers[frontIndex];
    incoming.style.transition = 'none'; incoming.style.opacity = '1';
    outgoing.style.transition = 'none'; outgoing.style.opacity = '0';
    outgoing.classList.remove('is-visible');
    void incoming.offsetWidth;
    incoming.style.transition = ''; outgoing.style.transition = '';
    incoming.style.opacity = ''; outgoing.style.opacity = '';
    frontIndex = pending.index; frontImage = pending.image; pending = null;
  }
  function markMedia(layer, card) {
    var portrait = card.naturalHeight > card.naturalWidth;
    layer.classList.toggle('is-portrait', portrait);
    layer.classList.toggle('is-landscape', !portrait);
    document.body.dataset.media = portrait ? 'portrait' : 'landscape';
    card.style.setProperty('--media-aspect', card.naturalWidth + ' / ' + card.naturalHeight);
  }
  function loadMedia(layerIndex, cover, id, done) {
    var bg = backgrounds[layerIndex], card = cards[layerIndex], left = 2, failed = false, finished = false;
    function finish() { if (finished || id !== requestId) return; finished = true; done(card); }
    function settle() { if (failed || id !== requestId) return; if (--left > 0) return; finish(); }
    function fail() {
      if (failed || id !== requestId) return;
      failed = true;
      var fallback = cover.app.fallback || 'assets/valley.jpg';
      bg.onerror = null; card.onerror = null;
      if (bg.src.indexOf(fallback) >= 0 && card.src.indexOf(fallback) >= 0) {
        if (bg.complete && bg.naturalWidth && card.complete && card.naturalWidth) finish();
        return;
      }
      bg.src = fallback; card.src = fallback;
      function check() { if (id !== requestId) return; if (bg.complete && bg.naturalWidth && card.complete && card.naturalWidth) finish(); }
      bg.onload = check; card.onload = check; check();
    }
    bg.onload = settle; card.onload = settle; bg.onerror = fail; card.onerror = fail;
    bg.src = cover.src; card.src = cover.src;
    if (bg.complete && bg.naturalWidth) settle();
    if (card.complete && card.naturalWidth) settle();
  }
  function startFade(cover) {
    setCaption(cover.title, cover.text);
    var id = ++requestId, incomingIndex = 1 - frontIndex, incoming = layers[incomingIndex];
    loadMedia(incomingIndex, cover, id, function (card) {
      if (id !== requestId) return;
      markMedia(incoming, card);
      incoming.style.transition = 'none'; incoming.style.opacity = '0';
      incoming.classList.remove('is-visible'); incoming.style.zIndex = '2';
      layers[frontIndex].style.zIndex = '1';
      void incoming.offsetWidth;
      incoming.style.transition = ''; incoming.style.opacity = '';
      pending = { index: incomingIndex, image: cover.src, state: cover };
      incoming.classList.add('is-visible');
      fadeTimer = setTimeout(finishFade, motionQuery && motionQuery.matches ? 0 : COVER_FADE_MS + 40);
    });
  }
  function retargetFade(cover) {
    var incomingIndex = pending.index, incoming = layers[incomingIndex];
    setCaption(cover.title, cover.text);
    pending.image = cover.src; pending.state = cover;
    var id = ++requestId;
    loadMedia(incomingIndex, cover, id, function (card) { if (id !== requestId) return; markMedia(incoming, card); });
  }
  function goTo(cover) {
    if (pending) {
      if (cover.src === pending.image) { setCaption(cover.title, cover.text); return; }
      if (cover.src === frontImage) {
        clearTimeout(fadeTimer); fadeTimer = 0;
        layers[pending.index].classList.remove('is-visible');
        pending = null; ++requestId;
        document.body.dataset.media = layers[frontIndex].classList.contains('is-portrait') ? 'portrait' : 'landscape';
        setCaption(cover.title, cover.text); return;
      }
      retargetFade(cover); return;
    }
    if (cover.src === frontImage) {
      ++requestId;
      document.body.dataset.media = layers[frontIndex].classList.contains('is-portrait') ? 'portrait' : 'landscape';
      setCaption(cover.title, cover.text); return;
    }
    startFade(cover);
  }

  function focusables() {
    if (overlay.hidden) return [];
    return Array.prototype.slice.call(overlay.querySelectorAll('button:not([disabled])')).filter(function (el) { return el.getClientRects().length; });
  }
  function focusKey(key) {
    var target = focusables().filter(function (el) { return el.dataset.key === key; })[0] || body.querySelector('button') || $('close');
    if (target) target.focus({ preventScroll: true });
  }
  function keepPanelFocusVisible(target) {
    if (overlay.hidden || !body.contains(target)) return;
    var a = target.getBoundingClientRect(), b = body.getBoundingClientRect(), scale = b.width / body.offsetWidth;
    if (a.top < b.top + 20 * scale) body.scrollTop += (a.top - b.top) / scale - 20;
    else if (a.bottom > b.bottom - 20 * scale) body.scrollTop += (a.bottom - b.bottom) / scale + 20;
  }
  function moveFocus(key) {
    var elements = focusables(), current = document.activeElement;
    if (elements.indexOf(current) < 0) { focusKey(); return; }
    var a = current.getBoundingClientRect(), ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2, best, score = Infinity;
    elements.forEach(function (el) {
      if (el === current) return;
      var b = el.getBoundingClientRect(), dx = (b.left + b.right) / 2 - ax, dy = (b.top + b.bottom) / 2 - ay;
      var horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
      var ahead = key === 'ArrowRight' ? dx : key === 'ArrowLeft' ? -dx : key === 'ArrowDown' ? dy : -dy;
      if (ahead <= 2) return;
      var overlap = horizontal ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : Math.min(a.right, b.right) - Math.max(a.left, b.left);
      var gap = key === 'ArrowRight' ? b.left - a.right : key === 'ArrowLeft' ? a.left - b.right : key === 'ArrowDown' ? b.top - a.bottom : a.top - b.bottom;
      var value = Math.max(0, gap) + Math.abs(horizontal ? dy : dx) * 1.4 + (overlap > 0 ? 0 : 500);
      if (!best || value < score - 1) { score = value; best = el; }
    });
    if (best) { best.focus({ preventScroll: true }); keepPanelFocusVisible(best); }
  }
  function resetKeys() { okDown = false; okTarget = null; }
  function refreshApps(notify) {
    if (!TVDevice.available) { if (notify) toast('浏览器使用本地应用快照，请在电视上刷新'); return; }
    if (loadingApps) return;
    loadingApps = true;
    TVDevice.listApps(function (result) {
      loadingApps = false;
      var next = result.returnValue && sanitizeApps(result.apps);
      if (!next || !next.length) { if (notify) toast('刷新失败，保留原有列表'); return; }
      var key = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key;
      var selected = items[index] && items[index].id;
      var changed = JSON.stringify(next) !== JSON.stringify(catalog);
      catalog = next;
      try { localStorage.setItem('tvhome.catalog', JSON.stringify(catalog)); } catch (error) {}
      if (changed && !document.hidden) {
        renderList(selected || key || state.lastFocus);
        if (dialogType === 'all' || dialogType === 'manage') openDialog(dialogType, key);
      }
      refreshVpn();
      if (notify) toast('已刷新应用列表');
    });
  }
  function refreshVpn() {
    if (document.hidden) return;
    var label = $('vpnLabel'); if (!label) return;
    if (!installed(vpnId)) { label.textContent = '打开网络设置'; return; }
    if (!TVDevice.available) { label.textContent = 'Alcyone VPN'; return; }
    var request = ++vpnRequest;
    TVDevice.vpnStatus(function (result) {
      if (request !== vpnRequest || document.hidden) return;
      label.textContent = !result.returnValue ? 'VPN 状态暂不可用' : result.connected ? 'VPN 已连接' : 'VPN 未连接';
    });
  }
  function launch(id, params) {
    if (Date.now() - lastLaunch < 800) return;
    lastLaunch = Date.now();
    TVDevice.launch(id, params, function (result) {
      if (!result.returnValue) { toast(result.errorText || '无法打开此应用'); return; }
      if (overlay.hidden && (id === computer || state.apps.indexOf(id) >= 0)) commit({ lastFocus: id });
    });
  }
  function closeDialog() {
    if (dialogType === 'sources') { openDialog('settings', 'sources'); return; }
    overlay.hidden = true; dialogType = ''; orderDraft = null; movingId = null; resetKeys();
    zone = returnZone || 'list'; updateZones();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function openDialog(type, key) {
    if (overlay.hidden) returnZone = zone;
    overlay.hidden = false; dialogType = type; body.innerHTML = ''; body.scrollTop = 0; panel.dataset.view = type;
    $('dialog-title').textContent = { all: '全部应用', manage: '编辑桌面', order: '调整首页顺序', settings: '设置', sources: '内容来源', inputs: '选择输入源', devices: '输入源标签' }[type];
    if (type === 'all' || type === 'manage') renderCatalog(type === 'manage');
    if (type === 'settings') renderSettings();
    if (type === 'sources') PublicContent.settings(body);
    if (type === 'inputs') renderInputs();
    if (type === 'devices') renderDevices();
    if (type === 'order') renderOrder();
    focusKey(key || (body.querySelector('button') && body.querySelector('button').dataset.key));
  }
  function paragraph(text) { var p = document.createElement('p'); p.className = 'panel-description'; p.textContent = text; body.appendChild(p); }
  function button(text, className, key, action) {
    var item = document.createElement('button'); item.className = className; item.textContent = text; if (key) item.dataset.key = key; item.onclick = action; return item;
  }
  function renderCatalog(manage) {
    paragraph(manage ? '选择常用应用' : '选择应用打开；安装新应用后可以刷新列表。');
    var bar = document.createElement('div'); bar.className = 'choice-group'; bar.style.marginBottom = '24px'; body.appendChild(bar);
    if (manage) bar.appendChild(button('调整首页顺序', 'choice', 'reorder', function () { orderDraft = null; movingId = null; openDialog('order'); }));
    else bar.appendChild(button('编辑桌面', 'choice', 'manage', function () { openDialog('manage'); }));
    bar.appendChild(button('刷新应用', 'choice', 'refresh', function () { refreshApps(true); }));
    var list = document.createElement('div'); list.className = 'app-list'; body.appendChild(list);
    var rows = catalog.slice();
    if (manage) state.apps.forEach(function (id) { if (!installed(id)) rows.push({ id: id, title: appInfo(id).name + '（暂不可用）' }); });
    rows.forEach(function (raw) {
      var app = appInfo(raw.id), selected = state.apps.indexOf(app.id) >= 0;
      var row = document.createElement('button'); row.className = 'list-item'; row.dataset.key = 'list-' + app.id;
      var mark = document.createElement('span'); mark.className = 'mark';
      if (app.icon || app.installedIcon) {
        var image = app.icon ? icon(app.icon) : document.createElement('img');
        if (!app.icon) { image.src = app.installedIcon; image.alt = ''; image.style.filter = 'none'; }
        mark.appendChild(image);
      } else mark.textContent = app.name.charAt(0);
      row.appendChild(mark);
      var name = document.createElement('span'); name.textContent = raw.title; row.appendChild(name);
      if (manage) {
        row.setAttribute('aria-pressed', String(selected));
        var box = document.createElement('span'); box.className = 'checkbox' + (selected ? ' selected' : ''); if (selected) box.appendChild(icon('check.svg')); row.appendChild(box);
      } else if (selected) { var tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '在首页'; row.appendChild(tag); }
      row.onclick = function () {
        if (!manage) return launch(app.id);
        var ids = state.apps.slice(), at = ids.indexOf(app.id);
        if (at < 0) ids.push(app.id); else ids.splice(at, 1);
        if (!commit({ apps: ids })) return;
        renderList(app.id); openDialog('manage', row.dataset.key);
      };
      list.appendChild(row);
    });
  }
  function renderOrder() {
    paragraph(movingId ? '正在移动：' + appInfo(movingId).name + '。上下调整位置，确认保存，返回取消。' : '选中应用按确认开始移动，再按确认保存。');
    var list = document.createElement('div'); list.className = 'order-list'; body.appendChild(list);
    (orderDraft || state.apps).forEach(function (id, i) {
      var row = button('', 'list-item order-item' + (movingId === id ? ' moving' : ''), 'order-' + id, function () {
        if (movingId) {
          if (commit({ apps: orderDraft.slice() })) { orderDraft = null; movingId = null; renderList(); openDialog('order', 'order-' + id); }
        } else { orderDraft = state.apps.slice(); movingId = id; openDialog('order', 'order-' + id); }
      });
      var number = document.createElement('span'); number.className = 'order-number'; number.textContent = ('0' + (i + 1)).slice(-2); row.appendChild(number);
      var label = document.createElement('span'); label.className = 'order-label'; label.textContent = appInfo(id).name; row.appendChild(label); row.appendChild(icon('grip-vertical.svg')); list.appendChild(row);
    });
    if (!state.apps.length) paragraph('先在“编辑桌面”中添加应用。');
  }
  function moveOrder(delta) {
    var from = orderDraft.indexOf(movingId), to = Math.max(0, Math.min(orderDraft.length - 1, from + delta));
    if (from === to) return;
    orderDraft.splice(to, 0, orderDraft.splice(from, 1)[0]); openDialog('order', 'order-' + movingId);
  }
  function renderSettings() {
    var layout = document.createElement('div'); layout.className = 'settings-layout'; body.appendChild(layout);
    function section(title) {
      var node = document.createElement('section'); node.className = 'settings-section';
      var heading = document.createElement('h3'); heading.textContent = title; node.appendChild(heading);
      layout.appendChild(node); return node;
    }
    function choices(parent, title, key, values) {
      var row = document.createElement('div'); row.className = 'settings-row'; var label = document.createElement('span'); label.textContent = title; row.appendChild(label);
      var group = document.createElement('div'); group.className = 'choice-group'; row.appendChild(group);
      values.forEach(function (option) {
        var item = button(option[1], 'choice' + (state[key] === option[0] ? ' selected' : ''), key + '-' + option[0], function () {
          var changes = {}; changes[key] = option[0]; if (!commit(changes)) return;
          appearance(); if (key === 'wallpaper') updateCover();
          openDialog('settings', item.dataset.key);
        });
        item.setAttribute('aria-pressed', String(state[key] === option[0])); group.appendChild(item);
      });
      parent.appendChild(row);
    }
    function action(title, meta, file, key, onSelect) {
      var item = document.createElement('button'); item.className = 'list-item settings-action'; item.dataset.key = key; item.onclick = onSelect;
      var mark = document.createElement('span'); mark.className = 'mark'; mark.appendChild(icon(file)); item.appendChild(mark);
      var copy = document.createElement('span'); copy.className = 'settings-action-copy';
      var name = document.createElement('span'); name.className = 'settings-action-name'; name.textContent = title; copy.appendChild(name);
      var hint = document.createElement('span'); hint.className = 'settings-action-meta'; hint.textContent = meta; copy.appendChild(hint);
      item.appendChild(copy);
      var chevron = document.createElement('span'); chevron.className = 'settings-action-chevron'; chevron.appendChild(icon('arrow-up-right.svg')); item.appendChild(chevron);
      return item;
    }
    var appearanceSection = section('外观');
    choices(appearanceSection, '主题', 'theme', [['auto', '自动'], ['dark', '深色'], ['light', '浅色'], ['oled', 'OLED 纯黑']]);
    choices(appearanceSection, '背景', 'wallpaper', [['valley', '山谷'], ['peaks', '雾峰'], ['plain', '纯色']]);
    var desktopSection = section('桌面');
    var actions = document.createElement('div'); actions.className = 'settings-actions'; desktopSection.appendChild(actions);
    actions.appendChild(action('编辑应用', '首页应用与顺序', 'layout-grid.svg', 'edit-home', function () { openDialog('manage'); }));
    actions.appendChild(action('输入源标签', 'HDMI 设备与名称', 'plug-connected.svg', 'input-labels', function () { openDialog('devices'); }));
    actions.appendChild(action('内容来源', '公开内容与来源', 'tmdb.svg', 'sources', function () { openDialog('sources'); }));
    var systemSection = section('系统');
    systemSection.appendChild(action('LG 系统设置', '电视系统与网络', 'settings.svg', 'system-settings', function () { launch('com.palm.app.settings'); }));
  }
  function inputsList() {
    var inputs = window.TV_APPS && Array.isArray(TV_APPS.inputs) ? TV_APPS.inputs.slice() : [];
    if (!inputs.length) inputs = [1, 2, 3, 4].map(function (n) { return { appId: 'com.webos.app.hdmi' + n, label: 'HDMI ' + n }; });
    return inputs;
  }
  function inputDeviceMark(preset) {
    var mark = document.createElement('span');
    if (preset.badge) {
      mark.className = 'mark device-mark';
      mark.textContent = preset.badge;
      if (preset.color) mark.style.color = preset.color;
    } else {
      mark.className = 'mark';
      mark.appendChild(icon('plug-connected.svg'));
    }
    return mark;
  }
  function renderDevices() {
    paragraph('选择 HDMI 端口的设备标签。点击一行循环切换，标签会同步到输入源和首页电脑入口。');
    var list = document.createElement('div'); list.className = 'app-list'; body.appendChild(list);
    inputsList().forEach(function (input) {
      var key = 'device-' + input.appId;
      var preset = deviceInfo(input.appId);
      var row = button('', 'list-item device-row', key, function () {
        var devices = Object.assign({}, state.devices || {});
        var current = devices[input.appId] || 'default';
        devices[input.appId] = deviceKeys[(deviceKeys.indexOf(current) + 1) % deviceKeys.length];
        if (!commit({ devices: devices })) return;
        renderList();
        openDialog('devices', key);
      });
      row.appendChild(inputDeviceMark(preset));
      var copy = document.createElement('span'); copy.className = 'device-copy';
      var name = document.createElement('span'); name.textContent = (input.label || 'HDMI') + ' · ' + (preset.name || '默认');
      copy.appendChild(name);
      if (preset.badge) { var tag = document.createElement('small'); tag.className = 'device-note'; tag.textContent = '点击切换设备标签'; copy.appendChild(tag); }
      row.appendChild(copy);
      var cycle = document.createElement('span'); cycle.className = 'device-cycle';
      cycle.textContent = preset.badge ? '切换' : '添加标签';
      row.appendChild(cycle);
      list.appendChild(row);
    });
  }
  function renderInputs() {
    var list = document.createElement('div'); list.className = 'app-list'; body.appendChild(list);
    inputsList().forEach(function (input) {
      var preset = deviceInfo(input.appId);
      var row = button('', 'list-item', input.appId, function () { launch(input.appId); });
      row.appendChild(inputDeviceMark(preset));
      row.appendChild(document.createTextNode((preset.name ? preset.name + ' · ' : '') + (input.label || input.appId)));
      if (preset.badge) {
        var edit = document.createElement('span'); edit.className = 'device-cycle'; edit.textContent = '标签';
        edit.onclick = function (event) { event.stopPropagation(); openDialog('devices'); };
        row.appendChild(edit);
      }
      list.appendChild(row);
    });
    if (CONFIG.liveTvApp) list.appendChild(button('直播电视', 'list-item', 'live-tv', function () { launch(CONFIG.liveTvApp); }));
  }

  menuEl.addEventListener('click', function () {
    if (zone === 'panel') closePanel(); else { zone = 'menu'; updateZones(); openPanel(); }
  });
  panelButtons.forEach(function (item) { item.addEventListener('click', function () { act(item.dataset.action); }); });
  $('theme').onclick = function () {
    var wasAuto = state.theme === 'auto';
    var next = scene.dataset.theme === 'light' ? 'dark' : 'light';
    if (!commit({ theme: next })) return;
    appearance();
    if (wasAuto) toast('已固定主题，可在设置中恢复自动');
  };
  $('close').onclick = closeDialog;
  overlay.addEventListener('click', function (event) { if (event.target === overlay) closeDialog(); });
  document.addEventListener('focusin', function (event) { keepPanelFocusVisible(event.target); });

  document.addEventListener('keydown', function (event) {
    var key = event.key || ({ 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter', 27: 'Escape', 461: 'Escape' })[event.keyCode] || '';
    if (screensaverOn) { event.preventDefault(); exitScreensaver(); return; }
    lastActivity = Date.now();
    if (!overlay.hidden) {
      if (key.indexOf('Arrow') === 0) {
        event.preventDefault();
        if (dialogType === 'order' && movingId) { if (key === 'ArrowUp' || key === 'ArrowDown') moveOrder(key === 'ArrowUp' ? -1 : 1); }
        else moveFocus(key);
      } else if (key === 'Enter') {
        event.preventDefault(); if (okDown) return; okDown = true; okTarget = document.activeElement;
      } else if (key === 'Escape' || event.keyCode === 461 || event.keyCode === 27) {
        event.preventDefault(); resetKeys();
        if (dialogType === 'order' && movingId) { orderDraft = null; movingId = null; openDialog('order'); }
        else closeDialog();
      } else if (key === 'Tab') {
        var choices = focusables(), at = choices.indexOf(document.activeElement); event.preventDefault();
        if (choices.length) choices[(at + (event.shiftKey ? -1 : 1) + choices.length) % choices.length].focus();
      }
      return;
    }
    if (key === 'ArrowDown') {
      event.preventDefault();
      if (zone === 'list') { if (index < items.length - 1) setIndex(index + 1); else { zone = 'menu'; updateZones(); } }
      else if (zone === 'menu') openPanel();
      else if (zone === 'panel') { menuIndex = Math.min(panelButtons.length - 1, menuIndex + 1); updateZones(); }
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      if (zone === 'list') { if (index > 0) setIndex(index - 1); }
      else if (zone === 'panel') { if (menuIndex > 0) { menuIndex--; updateZones(); } else { zone = 'menu'; updateZones(); } }
      else if (zone === 'menu') { zone = 'list'; updateZones(); }
    } else if (key === 'Enter') {
      event.preventDefault(); if (okDown) return; okDown = true;
      if (zone === 'list') launch(items[index].id);
      else if (zone === 'menu') openPanel();
      else if (zone === 'panel') act(panelButtons[menuIndex].dataset.action);
    } else if (key === 'Escape' || key === 'Backspace' || event.keyCode === 461 || event.keyCode === 27) {
      if (zone === 'panel') { event.preventDefault(); closePanel(); }
      else if (zone === 'menu') { event.preventDefault(); zone = 'list'; updateZones(); }
    } else if (key.toLowerCase() === 'm') {
      event.preventDefault(); openDialog('manage');
    }
  });
  document.addEventListener('keyup', function (event) {
    if (event.key !== 'Enter' && event.keyCode !== 13) return;
    event.preventDefault(); var target = okTarget; resetKeys();
    if (target && target === document.activeElement && document.documentElement.contains(target)) target.click();
  });

  function resume() {
    resetKeys(); markActivity(); clock();
    if (!overlay.hidden) closeDialog();
    var wanted = state.lastFocus;
    items.forEach(function (item, i) { if (item.id === wanted) index = i; });
    updateList(); updateCover(); updateZones();
    refreshApps(false); refreshVpn();
  }
  document.addEventListener('webOSRelaunch', resume);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { exitScreensaver(); resetKeys(); vpnRequest++; }
    else resume();
  });
  window.addEventListener('blur', resetKeys); window.addEventListener('resize', fit);
  ['mousedown', 'mousemove', 'wheel'].forEach(function (name) {
    document.addEventListener(name, markActivity, { passive: true });
  });

  backgrounds[0].src = 'assets/valley.jpg'; cards[0].src = 'assets/valley.jpg';
  frontIndex = 0; frontImage = 'assets/valley.jpg';
  appearance(); renderList(state.lastFocus); fit(); clock(); updateZones();
  refreshApps(false); refreshVpn();
  if (window.TVDevice && TVDevice.loadState) {
    TVDevice.loadState(function (result) {
      if (!hasLocalState && result && result.returnValue && result.state) adoptState(result.state);
      else if (TVDevice.saveState) TVDevice.saveState(state);
    });
  }
  if (window.PublicContent) {
    PublicContent.subscribe(function () { preloadCovers(); updateCover(); });
    PublicContent.start();
  }
  setInterval(clock, 10000); setInterval(refreshVpn, 20000);
  setInterval(function () {
    if (!screensaverOn && overlay.hidden && panelEl.hidden && !document.hidden &&
        Date.now() - lastActivity > IDLE_TIMEOUT_MS) enterScreensaver();
  }, 10000);
}());
