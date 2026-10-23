(function () {
  'use strict';
  var providers = {}, listeners = [], refreshing = false, loading = false, timer, apps = [], started = false, reloadRequested = false;
  var sourceMeta = {
    'com.biliwebos.app': { name: '哔哩哔哩', detail: '公开热门', asset: 'bilibili.svg' },
    'youtube.leanback.v4': { name: 'YouTube', detail: 'NASA 频道精选', asset: 'youtube.svg' },
    netflix: { name: 'Netflix', detail: '全球周榜精选', asset: 'netflix.svg' },
    'com.apple.appletv': { name: 'Apple TV', detail: '官方精品片单', asset: 'appletv.svg' },
    amazon: { name: 'Prime Video', detail: 'TMDB 精选片库', mark: 'PV' }
  };

  function emit() {
    var ready = Object.keys(providers).filter(function (id) { return providers[id].items.length; });
    var hint = document.getElementById('contentHint');
    if (hint) hint.textContent = ready.length ? '已接入 ' + ready.length + ' 个公开来源 · 电视本地缓存' : (loading || refreshing ? '正在读取公开内容 · 电视本地缓存' : '公开内容暂不可用 · 保留应用图标');
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

  function timeOnly(value) {
    if (!value) return '';
    var date = new Date(value);
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
  }
  function cleanError(value) {
    return typeof value === 'string' ? value.trim().replace(/^刷新失败[，,]\s*/, '') : '';
  }
  function statusFor(source) {
    var count = source.items.length;
    if (source.status === 'unconfigured') return { key: 'unconfigured', text: '未配置', error: cleanError(source.error) || '尚未配置影视资料源' };
    if (source.error) return { key: 'error', text: '刷新失败', error: cleanError(source.error) || '保留上次内容' };
    if (refreshing || loading) return { key: 'loading', text: count ? '更新中' : '正在获取', error: '' };
    if (!count) return { key: 'error', text: '暂不可用', error: '暂时无法获取内容' };
    if (source.status === 'cached') return { key: 'cached', text: '缓存', error: '' };
    return { key: 'live', text: '已更新', error: '' };
  }
  function sourceDetails(id, source) {
    var meta = sourceMeta[id] || {};
    var name = meta.name || source.label.split(' · ')[0];
    var detail = meta.detail || source.label.replace(name, '').replace(/^[ ·]+/, '') || '公开来源';
    return { name: name, detail: detail, meta: meta };
  }
  function renderSources() {
    var list = document.getElementById('contentSources');
    if (!list) return;
    list.innerHTML = '';
    var ids = Object.keys(providers);
    var ready = ids.filter(function (id) { return providers[id].items.length; });
    var last = ids.map(function (id) { return providers[id].fetchedAt; }).filter(Boolean).sort().pop();
    var summary = document.getElementById('contentSummary');
    if (summary) {
      summary.innerHTML = '';
      var count = document.createElement('strong');
      count.textContent = ready.length + ' / ' + ids.length;
      summary.appendChild(count);
      var label = document.createElement('span');
      label.textContent = ' 个来源可用';
      summary.appendChild(label);
      if (last) {
        var time = document.createElement('span');
        time.className = 'sources-summary-time';
        time.textContent = '· 最近更新 ' + timeOnly(last);
        summary.appendChild(time);
      }
    }
    if (!ids.length) {
      var empty = document.createElement('div');
      empty.className = 'source-empty';
      var heading = document.createElement('strong');
      heading.textContent = (loading || refreshing) ? '正在读取公开来源' : '尚未接入公开来源';
      empty.appendChild(heading);
      var copy = document.createElement('span');
      copy.textContent = (loading || refreshing) ? '电视端服务正在获取内容…' : '检查电视网络连接后刷新。';
      empty.appendChild(copy);
      list.appendChild(empty);
    }
    ids.forEach(function (id) {
      var source = providers[id], info = sourceDetails(id, source), status = statusFor(source);
      var row = document.createElement('div');
      row.className = 'source-row';
      row.dataset.status = status.key;
      row.setAttribute('role', 'listitem');

      var mark = document.createElement('span');
      mark.className = 'source-mark';
      mark.setAttribute('aria-hidden', 'true');
      if (info.meta.asset) {
        var image = document.createElement('img');
        image.src = 'assets/' + info.meta.asset;
        image.alt = '';
        mark.appendChild(image);
      } else {
        mark.textContent = info.meta.mark || info.name.charAt(0);
      }
      row.appendChild(mark);

      var copy = document.createElement('div');
      copy.className = 'source-copy';
      var title = document.createElement('div');
      title.className = 'source-title';
      title.textContent = info.name;
      copy.appendChild(title);
      var detail = document.createElement('div');
      detail.className = 'source-detail';
      detail.textContent = info.detail + (source.items.length ? ' · ' + source.items.length + ' 部作品' : '');
      copy.appendChild(detail);
      if (status.error) {
        var error = document.createElement('div');
        error.className = 'source-error';
        error.textContent = status.error;
        copy.appendChild(error);
      }
      row.appendChild(copy);

      var state = document.createElement('div');
      state.className = 'source-state';
      var line = document.createElement('span');
      line.className = 'source-status';
      var dot = document.createElement('span');
      dot.className = 'source-dot';
      dot.setAttribute('aria-hidden', 'true');
      line.appendChild(dot);
      var text = document.createElement('span');
      text.textContent = status.text;
      line.appendChild(text);
      state.appendChild(line);
      if (source.fetchedAt) {
        var time = document.createElement('span');
        time.className = 'source-time';
        time.textContent = timeOnly(source.fetchedAt);
        state.appendChild(time);
      }
      row.appendChild(state);

      list.appendChild(row);
    });

    var credits = document.getElementById('contentCredits');
    if (credits) {
      var previousKey = credits.contains(document.activeElement) && document.activeElement.dataset.key;
      credits.innerHTML = '';
      var unique = {};
      ids.forEach(function (id) {
        (Array.isArray(providers[id].credits) ? providers[id].credits : []).forEach(function (credit) {
          if (credit && typeof credit.name === 'string' && /^https:\/\//.test(credit.url)) unique[credit.name] = credit.url;
        });
      });
      Object.keys(unique).forEach(function (name) {
        var button = document.createElement('button');
        button.className = 'content-credit';
        button.dataset.key = 'credit-' + name;
        button.textContent = name;
        if (name === 'TMDB') {
          button.textContent = '';
          button.setAttribute('aria-label', 'TMDB 电影资料库');
          var logo = document.createElement('img');
          logo.src = 'assets/tmdb.svg';
          logo.alt = '';
          logo.className = 'tmdb-logo';
          button.appendChild(logo);
        }
        button.onclick = function () { TVDevice.launch('com.webos.app.browser', { target: unique[name] }, function () {}); };
        credits.appendChild(button);
      });
      if (unique.TMDB) {
        var note = document.createElement('p');
        note.className = 'source-attribution';
        note.textContent = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
        credits.insertBefore(note, credits.firstChild);
      }
      if (previousKey) {
        var restore = Array.prototype.find.call(credits.querySelectorAll('button'), function (item) { return item.dataset.key === previousKey; });
        if (restore) restore.focus({ preventScroll: true });
      }
    }

    var refresh = document.getElementById('refreshContent');
    if (refresh) {
      refresh.disabled = loading || refreshing;
      var refreshLabel = refresh.querySelector('span');
      if (refreshLabel) refreshLabel.textContent = refreshing ? '正在更新' : '刷新';
    }
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
      var intro = document.createElement('p');
      intro.className = 'sources-intro';
      intro.textContent = '公开内容由电视端后台服务按来源读取并缓存；完全不读取个人账号、Cookie 或观看历史。';
      body.appendChild(intro);

      var toolbar = document.createElement('div');
      toolbar.className = 'sources-toolbar';
      var summary = document.createElement('div');
      summary.id = 'contentSummary';
      summary.className = 'sources-summary';
      summary.setAttribute('aria-live', 'polite');
      toolbar.appendChild(summary);

      var refresh = document.createElement('button');
      refresh.id = 'refreshContent';
      refresh.className = 'sources-refresh';
      refresh.dataset.key = 'refresh-content';
      refresh.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-14.6-4.6L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 14.6 4.6L20 16"/><path d="M20 20v-4h-4"/></svg><span>刷新</span>';
      refresh.onclick = function () { load(true); };
      toolbar.appendChild(refresh);
      body.appendChild(toolbar);

      var list = document.createElement('div');
      list.id = 'contentSources';
      list.className = 'content-sources';
      list.setAttribute('role', 'list');
      body.appendChild(list);

      var foot = document.createElement('div');
      foot.className = 'sources-foot';
      var creditsLabel = document.createElement('div');
      creditsLabel.className = 'sources-credits-label';
      creditsLabel.textContent = '来源与署名';
      foot.appendChild(creditsLabel);
      var credits = document.createElement('div');
      credits.id = 'contentCredits';
      credits.className = 'sources-credits';
      foot.appendChild(credits);
      var note = document.createElement('p');
      note.className = 'sources-note';
      note.textContent = '网络不可用时保留上次本地缓存；封面与内容版权归各自来源所有。';
      foot.appendChild(note);
      body.appendChild(foot);

      renderSources();
      var rfBtn = document.getElementById('refreshContent');
      if (rfBtn && !rfBtn.disabled) rfBtn.focus({ preventScroll: true });
    }
  };
}());
