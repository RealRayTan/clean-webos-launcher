(function () {
  'use strict';
  var providers = {}, listeners = [], refreshing = false, loading = false, timer, apps = [], started = false, reloadRequested = false;

  function emit() {
    var ready = Object.keys(providers).filter(function (id) { return providers[id].items.length; });
    var hint = document.getElementById('contentHint');
    if (hint) hint.textContent = ready.length ? '已接入 ' + ready.length + ' 个公开来源 · 不连接电视' : (loading || refreshing ? '正在读取公开内容 · 不连接电视' : '公开内容暂不可用 · 保留应用图标');
    renderSources(); listeners.forEach(function (listener) { listener(); });
  }
  function accept(data) {
    if (!data || data.version !== 2 || !data.providers || typeof data.providers !== 'object') throw new Error('Invalid content feed');
    var next = {};
    Object.keys(data.providers).forEach(function (id) {
      if (!apps.some(function (app) { return app.id === id; })) return;
      var source = data.providers[id];
      if (!source || !Array.isArray(source.items) || typeof source.label !== 'string') return;
      var items = source.items.filter(function (item) {
        return item && typeof item.id === 'string' && typeof item.title === 'string' && item.title.length <= 400 &&
          /^content-cache\/[a-f0-9]{64}\.jpg$/.test(item.image) && /^https:\/\//.test(item.sourceUrl);
      }).slice(0, 8).map(function (item) {
        return { id: item.id, title: item.title, image: item.image, subtitle: item.subtitle || '',
          description: typeof item.description === 'string' ? item.description.replace(/\s+/g, ' ').trim().slice(0, 180) : '',
          sourceUrl: item.sourceUrl, sourceActionLabel: source.sourceActionLabel || '查看内容来源', providerLabel: source.label, fetchedAt: source.fetchedAt,
          sourcePeriod: source.sourcePeriod, credits: item.credits || source.credits || [], publishedAt: item.publishedAt };
      });
      next[id] = { label: source.label, items: items, fetchedAt: source.fetchedAt,
        status: source.status, error: source.error || '', sourcePeriod: source.sourcePeriod, credits: source.credits || [] };
    });
    providers = next;
    refreshing = !!data.refreshing;
  }
  function schedule() {
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(function () { load(false); }, refreshing ? 4000 : 60000);
  }
  function load(force) {
    if (loading) { reloadRequested = true; return; }
    loading = true; emit();
    TVDevice.publicContent(force, apps, function (data) {
      try { if (!data.returnValue) throw new Error('Content service unavailable'); accept(data); }
      catch (error) {
        refreshing = false;
        Object.keys(providers).forEach(function (id) { providers[id].status = 'cached'; providers[id].error = '内容服务暂不可用，保留已读取内容'; });
      }
      loading = false; emit();
      if (reloadRequested) { reloadRequested = false; load(false); } else schedule();
    });
  }

  function stamp(value) {
    if (!value) return '尚未获取';
    var date = new Date(value);
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
  }
  function renderSources() {
    var list = document.getElementById('contentSources');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(providers).forEach(function (id) {
      var source = providers[id], row = document.createElement('div'); row.className = 'content-source-line';
      var title = document.createElement('strong'); title.textContent = source.label; row.appendChild(title);
      var state = document.createElement('small');
      state.textContent = source && source.items.length ? source.items.length + ' 条 · ' + (source.status === 'cached' ? '缓存 · ' : '') + stamp(source.fetchedAt) : (source.status === 'unconfigured' ? '未配置' : refreshing || loading ? '正在获取' : '暂不可用');
      row.appendChild(state); list.appendChild(row);
      if (source && source.error) { var error = document.createElement('small'); error.className = 'content-source-error'; error.textContent = source.error; list.appendChild(error); }
    });
    var credits = document.getElementById('contentCredits');
    if (credits) {
      var previousKey = credits.contains(document.activeElement) && document.activeElement.dataset.key;
      credits.innerHTML = '';
      var unique = {};
      Object.keys(providers).forEach(function (id) {
        (Array.isArray(providers[id].credits) ? providers[id].credits : []).forEach(function (credit) { if (credit && typeof credit.name === 'string' && /^https:\/\//.test(credit.url)) unique[credit.name] = credit.url; });
      });
      Object.keys(unique).forEach(function (name) {
        var button = document.createElement('button'); button.className = 'choice content-credit'; button.dataset.key = 'credit-' + name; button.textContent = name;
        if (name === 'TMDB') { button.textContent = ''; var logo = document.createElement('img'); logo.src = 'assets/tmdb.svg'; logo.alt = 'TMDB'; logo.className = 'tmdb-logo'; button.appendChild(logo); }
        button.onclick = function () { TVDevice.launch('com.webos.app.browser', { target: unique[name] }, function () {}); }; credits.appendChild(button);
      });
      if (unique.TMDB) {
        var note = document.createElement('p'); note.className = 'source-attribution'; note.textContent = 'This product uses the TMDB API but is not endorsed or certified by TMDB.'; credits.insertBefore(note, credits.firstChild);
      }
      if (previousKey) { var restore = Array.prototype.find.call(credits.querySelectorAll('button'), function (item) { return item.dataset.key === previousKey; }); if (restore) restore.focus({ preventScroll: true }); }
    }
    var refresh = document.getElementById('refreshContent');
    if (refresh) { refresh.disabled = loading || refreshing; refresh.textContent = refreshing ? '正在更新公开内容…' : '刷新公开内容'; }
  }
  window.PublicContent = {
    setApps: function (catalog) {
      var next = catalog.map(function (app) { return { id: app.id, title: app.title }; });
      if (JSON.stringify(next) === JSON.stringify(apps)) return;
      apps = next;
      if (started) load(false);
    },
    supports: function (id) { return !!providers[id]; },
    items: function (id) { return providers[id] ? providers[id].items : []; },
    subscribe: function (listener) { listeners.push(listener); },
    start: function () {
      started = true; load(false);
      document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else load(false); });
    },
    settings: function (body) {
      var list = document.createElement('div'); list.id = 'contentSources'; list.className = 'content-sources'; body.appendChild(list);
      var refresh = document.createElement('button'); refresh.id = 'refreshContent'; refresh.className = 'choice'; refresh.dataset.key = 'refresh-content';
      refresh.onclick = function () { load(true); }; body.appendChild(refresh);
      var credits = document.createElement('div'); credits.id = 'contentCredits'; body.appendChild(credits);
      renderSources();
    }
  };
}());
