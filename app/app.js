/* Local webOS launcher. Device actions use the bounded adapter in device.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var scene = $('scene'), overlay = $('overlay'), panel = overlay.querySelector('.dialog'), body = $('dialog-body');
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
    'org.webosbrew.hbchannel': { name: 'Homebrew', subtitle: 'Channel', style: 'homebrew' }
  };
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
  var state = { theme: 'auto', wallpaper: 'valley', apps: defaults.slice(), lastFocus: 'computer' };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && ['auto', 'light', 'dark'].indexOf(saved.theme) >= 0 && ['valley', 'peaks', 'plain'].indexOf(saved.wallpaper) >= 0 && Array.isArray(saved.apps)) {
      state = { theme: saved.theme, wallpaper: saved.wallpaper, apps: saved.apps.filter(function (id, i, all) { return typeof id === 'string' && /^[A-Za-z0-9_.-]+$/.test(id) && all.indexOf(id) === i; }), lastFocus: saved.lastFocus || 'computer' };
    } else {
      var hidden = JSON.parse(localStorage.getItem('tvhome.hidden'));
      if (!Array.isArray(hidden)) hidden = CONFIG.hiddenApps || [];
      var legacy = JSON.parse(localStorage.getItem('tvhome.order'));
      if (legacy && Array.isArray(legacy.ids)) state.apps = legacy.ids.filter(function (id) { return hidden.indexOf(id) < 0; });
      else state.apps = defaults.filter(function (id) { return hidden.indexOf(id) < 0; });
    }
  } catch (error) {}
  var dialogType = '', returnKey = 'computer', loadingApps = false, lastLaunch = 0, toastTimer, idleTimer;
  var okDown = false, okTarget = null, okTimer = null, orderDraft = null, movingId = null;
  var vpnRequest = 0;
  function homeIds() { return state.apps.filter(function (id) { return !!installed(id); }); }
  document.body.classList.toggle('on-tv', TVDevice.available);
  function icon(file) { var img = document.createElement('img'); img.src = 'assets/' + file; img.alt = ''; return img; }
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').classList.remove('visible'); }, 2400); }
  function commit(changes) {
    var next = { theme: state.theme, wallpaper: state.wallpaper, apps: state.apps.slice(), lastFocus: state.lastFocus };
    Object.keys(changes).forEach(function (key) { next[key] = changes[key]; });
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch (error) { toast('保存失败，已保留原来的设置'); return false; }
    state = next;
    return true;
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
    $('theme').firstElementChild.src = effective === 'dark' ? 'assets/sun.svg' : 'assets/moon.svg';
    $('theme').setAttribute('aria-label', (effective === 'dark' ? '切换浅色主题' : '切换深色主题') + (state.theme === 'auto' ? '，当前按时间自动切换' : ''));
  }
  function clock() {
    var now = new Date(), h = now.getHours();
    $('clock').textContent = ('0' + h).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    $('date').textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日，星期' + '日一二三四五六'.charAt(now.getDay());
    $('greeting').textContent = h < 5 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    appearance();
  }
  function resetIdle() {
    scene.dataset.idle = 'false'; clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { scene.dataset.idle = 'true'; }, 180000);
  }
  function focusables() {
    return Array.prototype.slice.call((overlay.hidden ? scene : overlay).querySelectorAll('button:not([disabled])')).filter(function (el) { return el.getClientRects().length && (overlay.hidden ? !overlay.contains(el) : true); });
  }
  function focusKey(key) {
    var target = focusables().filter(function (el) { return el.dataset.key === key; })[0] || (overlay.hidden ? $('computer') : body.querySelector('button')) || $('close');
    target.focus({ preventScroll: true });
  }
  function revealApp(target) {
    var shelf = $('apps');
    if (!overlay.hidden || !shelf.contains(target)) return;
    var left = shelf.scrollLeft, inset = 10;
    if (target.offsetLeft < left + inset) left = target.offsetLeft - inset;
    else if (target.offsetLeft + target.offsetWidth > left + shelf.clientWidth - inset) left = target.offsetLeft + target.offsetWidth - shelf.clientWidth + inset;
    shelf.scrollTo({ left: left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function updateShelfEdges() {
    var shelf = $('apps'), frame = shelf.parentElement;
    frame.dataset.moreBefore = String(shelf.scrollLeft > 2);
    frame.dataset.moreAfter = String(shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 2);
  }
  function keepPanelFocusVisible(target) {
    if (overlay.hidden || !body.contains(target)) return;
    var a = target.getBoundingClientRect(), b = body.getBoundingClientRect(), scale = b.width / body.offsetWidth;
    if (a.top < b.top + 20 * scale) body.scrollTop += (a.top - b.top) / scale - 20;
    else if (a.bottom > b.bottom - 20 * scale) body.scrollTop += (a.bottom - b.bottom) / scale + 20;
  }
  function renderApps() {
    PublicContent.setApps(catalog);
    var ids = homeIds();
    var scroll = $('apps').scrollLeft;
    $('apps').innerHTML = '';
    ids.forEach(function (id, index) {
      var app = appInfo(id), button = document.createElement('button');
      button.className = 'tile app-tile app-' + app.style; button.dataset.key = id;
      button.setAttribute('aria-label', '打开 ' + app.name);
      var column = index < 6 ? index % 3 : 3 + Math.floor((index - 6) / 2);
      var row = index < 6 ? Math.floor(index / 3) : (index - 6) % 2;
      button.dataset.column = column; button.dataset.row = row;
      button.style.gridColumn = String(column + 1); button.style.gridRow = String(row + 1);
      if (app.icon || app.installedIcon) {
        var image = app.icon ? icon(app.icon) : document.createElement('img');
        image.className = 'brand' + (app.icon ? '' : ' installed-icon'); image.alt = '';
        if (!app.icon) image.src = app.installedIcon;
        button.appendChild(image);
      } else { var mark = document.createElement('span'); mark.className = app.style === 'prime' ? 'prime-wordmark' : 'generic-mark'; mark.textContent = app.style === 'prime' ? 'prime video' : app.name.charAt(0); button.appendChild(mark); }
      var copy = document.createElement('span'); copy.className = 'app-copy';
      var title = document.createElement('strong'); title.textContent = app.name; copy.appendChild(title);
      if (app.subtitle) { var small = document.createElement('small'); small.textContent = app.subtitle; copy.appendChild(small); }
      button.appendChild(copy);
      TilePalette.apply(button, id, app.icon ? 'assets/' + app.icon : app.installedIcon, installed(id).iconColor);
      TileMotion.attach(button, id); button.onclick = function () { if (!showContent(id)) launch(id); }; $('apps').appendChild(button);
    });
    if (!ids.length) {
      var empty = document.createElement('button'); empty.className = 'tile app-tile empty-add'; empty.dataset.key = 'add'; empty.appendChild(icon('plus.svg'));
      var label = document.createElement('strong'); label.textContent = '添加常用应用'; empty.appendChild(label); empty.onclick = function () { openDialog('manage'); }; $('apps').appendChild(empty);
    }
    $('apps').scrollLeft = scroll;
    updateShelfEdges();
    $('all').querySelector('small').textContent = catalog.length + ' 个应用';
  }
  function refreshApps(notify) {
    if (!TVDevice.available) { if (notify) toast('浏览器使用本地应用快照，请在电视上刷新'); return; }
    if (loadingApps) return;
    loadingApps = true;
    TVDevice.listApps(function (result) {
      loadingApps = false;
      var next = result.returnValue && sanitizeApps(result.apps);
      if (!next || !next.length) { if (notify) toast('刷新失败，保留原有列表'); return; }
      var key = document.activeElement && document.activeElement.dataset.key;
      var changed = JSON.stringify(next) !== JSON.stringify(catalog);
      catalog = next;
      try { localStorage.setItem('tvhome.catalog', JSON.stringify(catalog)); } catch (error) {}
      if (changed && !document.hidden) {
        renderApps();
        if (dialogType === 'all' || dialogType === 'manage') openDialog(dialogType, key);
        else if (overlay.hidden) focusKey(key || state.lastFocus);
      }
      refreshVpn();
      if (notify) toast('已刷新应用列表');
    });
  }
  function refreshVpn() {
    if (document.hidden) return;
    if (!installed(vpnId)) { $('vpnLabel').textContent = '打开网络设置'; return; }
    if (!TVDevice.available) { $('vpnLabel').textContent = 'Alcyone VPN'; return; }
    var request = ++vpnRequest;
    TVDevice.vpnStatus(function (result) {
      if (request !== vpnRequest || document.hidden) return;
      $('vpnLabel').textContent = !result.returnValue ? 'VPN 状态暂不可用' : result.connected ? 'VPN 已连接' : 'VPN 未连接';
    });
  }
  function launch(id, params) {
    if (Date.now() - lastLaunch < 800) return;
    lastLaunch = Date.now();
    var key = document.activeElement && document.activeElement.dataset.key;
    TVDevice.launch(id, params, function (result) {
      if (!result.returnValue) { toast(result.errorText || '无法打开此应用'); return; }
      if (key && overlay.hidden) commit({ lastFocus: key });
    });
  }
  function closeDialog() { if (dialogType === 'sources') { openDialog('settings', 'sources'); return; } overlay.hidden = true; dialogType = ''; orderDraft = null; movingId = null; focusKey(returnKey); }
  function openDialog(type, key) {
    if (overlay.hidden) returnKey = document.activeElement && document.activeElement.dataset.key || 'computer';
    overlay.hidden = false; dialogType = type; body.innerHTML = ''; body.scrollTop = 0; panel.dataset.view = type;
    $('dialog-title').textContent = { all: '全部应用', manage: '编辑桌面', order: '调整首页顺序', settings: '设置', sources: '内容来源', inputs: '选择输入源', content: '内容详情' }[type];
    $('dialog-kicker').textContent = '我的空间';

    if (type === 'all' || type === 'manage') renderCatalog(type === 'manage');
    if (type === 'settings') renderSettings();
    if (type === 'sources') PublicContent.settings(body);
    if (type === 'inputs') renderInputs();
    if (type === 'order') renderOrder();
    focusKey(key || (body.querySelector('button') && body.querySelector('button').dataset.key));
  }
  function showContent(id) {
    var item = TileMotion.selected(id);
    if (!item) return false;
    openDialog('content');
    $('dialog-kicker').textContent = item.providerLabel;
    var detail = document.createElement('div'); detail.className = 'content-detail';
    var image = document.createElement('img'); image.src = item.image; image.alt = ''; detail.appendChild(image);
    var copy = document.createElement('div');
    var title = document.createElement('h3'); title.textContent = item.title; copy.appendChild(title);
    var info = document.createElement('p'); info.textContent = item.subtitle; copy.appendChild(info);
    detail.appendChild(copy); body.appendChild(detail);
    var label = item.sourceActionLabel;
    body.appendChild(button('打开应用', 'choice', 'content-open-app', function () { launch(id); }));
    body.appendChild(button(label, 'choice content-credit', 'content-source', function () { launch('com.webos.app.browser', { target: item.sourceUrl }); }));
    focusKey('content-source');
    return true;
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
      if (app.icon || app.installedIcon) { var image = app.icon ? icon(app.icon) : document.createElement('img'); if (!app.icon) { image.src = app.installedIcon; image.alt = ''; image.style.filter = 'none'; } mark.appendChild(image); }
      else mark.textContent = app.name.charAt(0);
      row.appendChild(mark);
      var name = document.createElement('span'); name.textContent = raw.title; row.appendChild(name);
      if (manage) {
        row.setAttribute('aria-pressed', String(selected));
        var box = document.createElement('span'); box.className = 'checkbox' + (selected ? ' selected' : ''); if (selected) box.appendChild(icon('check.svg')); row.appendChild(box);
      } else if (selected) { var tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '在首页'; row.appendChild(tag); }
      row.onclick = function () {
        if (!manage) return launch(app.id);
        var ids = state.apps.slice(), index = ids.indexOf(app.id);
        if (index < 0) ids.push(app.id); else ids.splice(index, 1);
        if (!commit({ apps: ids })) return;
        renderApps(); openDialog('manage', row.dataset.key);
      };
      list.appendChild(row);
    });
  }
  function renderOrder() {
    paragraph(movingId ? '正在移动：' + appInfo(movingId).name + '。上下调整位置，确认保存，返回取消。' : '选中应用按确认开始移动，再按确认保存。');
    var list = document.createElement('div'); list.className = 'order-list'; body.appendChild(list);
    (orderDraft || state.apps).forEach(function (id, index) {
      var row = button('', 'list-item order-item' + (movingId === id ? ' moving' : ''), 'order-' + id, function () {
        if (movingId) {
          if (commit({ apps: orderDraft.slice() })) { orderDraft = null; movingId = null; renderApps(); openDialog('order', 'order-' + id); }
        } else { orderDraft = state.apps.slice(); movingId = id; openDialog('order', 'order-' + id); }
      });
      var number = document.createElement('span'); number.className = 'order-number'; number.textContent = ('0' + (index + 1)).slice(-2); row.appendChild(number);
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
    function choices(title, key, values) {
      var row = document.createElement('div'); row.className = 'settings-row'; var label = document.createElement('span'); label.textContent = title; row.appendChild(label);
      var group = document.createElement('div'); group.className = 'choice-group'; row.appendChild(group);
      values.forEach(function (option) {
        var item = button(option[1], 'choice' + (state[key] === option[0] ? ' selected' : ''), key + '-' + option[0], function () {
          var changes = {}; changes[key] = option[0]; if (!commit(changes)) return; appearance(); openDialog('settings', item.dataset.key);
        }); item.setAttribute('aria-pressed', String(state[key] === option[0])); group.appendChild(item);
      }); body.appendChild(row);
    }
    choices('主题', 'theme', [['auto', '自动'], ['dark', '深色'], ['light', '浅色']]);
    choices('背景', 'wallpaper', [['valley', '山谷'], ['peaks', '雾峰'], ['plain', '纯色']]);
    TileMotion.settings(body);
    var actions = document.createElement('div'); actions.className = 'settings-actions'; body.appendChild(actions);
    actions.appendChild(button('编辑应用', 'list-item', 'edit-home', function () { openDialog('manage'); }));
    actions.appendChild(button('内容来源', 'list-item', 'sources', function () { openDialog('sources'); }));
    actions.appendChild(button('LG 系统设置', 'list-item', 'system-settings', function () { launch('com.palm.app.settings'); }));
  }

  function renderInputs() {
    var list = document.createElement('div'); list.className = 'app-list'; body.appendChild(list);
    var inputs = window.TV_APPS && Array.isArray(TV_APPS.inputs) ? TV_APPS.inputs : [];
    if (!inputs.length) inputs = [1, 2, 3, 4].map(function (n) { return { appId: 'com.webos.app.hdmi' + n, label: 'HDMI ' + n }; });
    inputs.forEach(function (input) {
      var row = button('', 'list-item', input.appId, function () { launch(input.appId); }); row.appendChild(icon('plug-connected.svg')); row.appendChild(document.createTextNode(input.label || input.appId)); list.appendChild(row);
    });
    if (CONFIG.liveTvApp) list.appendChild(button('直播电视', 'list-item', 'live-tv', function () { launch(CONFIG.liveTvApp); }));
  }
  function moveFocus(key) {
    var elements = focusables(), current = document.activeElement;
    if (elements.indexOf(current) < 0) return focusKey('computer');
    if (overlay.hidden && $('apps').contains(current)) {
      var row = Number(current.dataset.row), column = Number(current.dataset.column), target;
      var horizontal = key === 'ArrowLeft' || key === 'ArrowRight', delta = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
      var neighbors = Array.prototype.slice.call($('apps').children).filter(function (item) {
        return horizontal ? Number(item.dataset.row) === row && (Number(item.dataset.column) - column) * delta > 0 : Number(item.dataset.column) === column && Number(item.dataset.row) === row + delta;
      });
      if (horizontal) neighbors.sort(function (a, b) { return (Number(a.dataset.column) - Number(b.dataset.column)) * delta; });
      target = neighbors[0];
      if (target) { target.focus({ preventScroll: true }); return; }
      if (key === 'ArrowLeft') { focusKey('computer'); return; }
      if (key === 'ArrowRight') return;
    }
    if (overlay.hidden) {
      var bounds = $('apps').getBoundingClientRect();
      elements = elements.filter(function (item) {
        if (!$('apps').contains(item)) return true;
        var r = item.getBoundingClientRect();
        return r.right > bounds.left + 10 && r.left < bounds.right - 10;
      });
    }
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
  function resetKeys() { okDown = false; okTarget = null; clearTimeout(okTimer); okTimer = null; }
  document.addEventListener('keydown', function (event) {
    resetIdle();
    var key = event.key || { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter', 461: 'Escape' }[event.keyCode] || '';
    if (key.indexOf('Arrow') === 0) {
      event.preventDefault();
      if (dialogType === 'order' && movingId) { if (key === 'ArrowUp' || key === 'ArrowDown') moveOrder(key === 'ArrowUp' ? -1 : 1); }
      else moveFocus(key);
    } else if (key === 'Enter') {
      event.preventDefault(); if (okDown) return; okDown = true; okTarget = document.activeElement;
      if (overlay.hidden && okTarget && state.apps.indexOf(okTarget.dataset.key) >= 0) {
        okTimer = setTimeout(function () { var id = okTarget && okTarget.dataset.key; okTarget = null; okTimer = null; if (id) { orderDraft = state.apps.slice(); movingId = id; openDialog('order', 'order-' + id); } }, 600);
      }
    } else if (key === 'Escape' || event.keyCode === 461 || event.keyCode === 27) {
      event.preventDefault(); resetKeys();
      if (dialogType === 'order' && movingId) { orderDraft = null; movingId = null; openDialog('order'); }
      else if (!overlay.hidden) closeDialog();
    } else if (key.toLowerCase() === 'm' && overlay.hidden) { event.preventDefault(); openDialog('manage'); }
    else if (key === 'Tab' && !overlay.hidden) {
      var choices = focusables(), index = choices.indexOf(document.activeElement); event.preventDefault(); choices[(index + (event.shiftKey ? -1 : 1) + choices.length) % choices.length].focus();
    }
  });
  document.addEventListener('keyup', function (event) {
    if (event.key !== 'Enter' && event.keyCode !== 13) return;
    event.preventDefault(); var target = okTarget; resetKeys();
    if (target && target === document.activeElement && document.documentElement.contains(target)) target.click();
  });
  $('computer').onclick = function () { launch(computer); };
  $('edit').onclick = function () { openDialog('manage'); };
  $('all').onclick = function () { openDialog('all'); refreshApps(false); };
  $('inputs').onclick = function () { openDialog('inputs'); };
  $('network').onclick = function () { if (installed(vpnId)) launch(vpnId); else launch('com.palm.app.settings', { target: 'network' }); };
  $('settings').onclick = $('appearance').onclick = function () { openDialog('settings'); };
  $('theme').onclick = function () {
    var wasAuto = state.theme === 'auto'; if (!commit({ theme: scene.dataset.theme === 'dark' ? 'light' : 'dark' })) return; appearance();
    if (wasAuto) toast('已固定主题，可在设置中恢复自动');
  };
  $('close').onclick = closeDialog;
  overlay.addEventListener('click', function (event) { if (event.target === overlay) closeDialog(); });
  document.addEventListener('focusin', function (event) { keepPanelFocusVisible(event.target); revealApp(event.target); });
  $('apps').addEventListener('scroll', updateShelfEdges, { passive: true });
  $('apps').addEventListener('wheel', function (event) {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY || event.ctrlKey) return;
    var shelf = $('apps');
    if (shelf.scrollWidth <= shelf.clientWidth) return;
    event.preventDefault();
    var distance = event.deltaY * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? shelf.clientWidth : 1);
    shelf.scrollLeft += distance; resetIdle();
  }, { passive: false });
  ['mousedown', 'mousemove', 'wheel'].forEach(function (name) { document.addEventListener(name, resetIdle); });
  function resume() {
    resetKeys(); resetIdle(); clock();
    if (!overlay.hidden) closeDialog();
    refreshApps(false); refreshVpn();
    if (!document.activeElement || document.activeElement === document.body) focusKey(state.lastFocus);
  }
  document.addEventListener('webOSRelaunch', resume);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { resetKeys(); vpnRequest++; } else resume(); });
  window.addEventListener('blur', resetKeys); window.addEventListener('resize', fit);
  appearance(); renderApps(); fit(); clock(); resetIdle(); focusKey(state.lastFocus); refreshApps(false); refreshVpn();
  TileMotion.start();
  setInterval(clock, 10000); setInterval(refreshVpn, 20000);
}());
