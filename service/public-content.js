'use strict';
// Public catalog cache. No account cookies, tokens or arbitrary request URLs.
var fs = require('fs'), path = require('path'), https = require('https'), crypto = require('crypto');
var net = require('net'), tls = require('tls');
var APP = 'com.gathin.tvhome';
var ALLOWED = ['com.gathin.tvhome', 'com.webos.app.home'];
var appDir = '/media/developer/apps/usr/palm/applications/' + APP;
var cacheDir = path.join(appDir, 'content-cache');
var providers = {}, active = false, retries = {}, imageJobs = new Map(), refreshTimer = null;
var nativeSources = {
  'com.biliwebos.app': ['哔哩哔哩公开热门', bili],
  'youtube.leanback.v4': ['YouTube · NASA 频道更新', youtube],
  netflix: ['Netflix 全球周榜 · 剧集', netflix],
  'com.apple.appletv': ['Apple TV 官方片单', apple]
};
var nativeActions = { 'com.biliwebos.app': '查看视频来源', 'youtube.leanback.v4': '查看视频来源', netflix: '查看榜单来源', 'com.apple.appletv': '查看官方介绍' };
var definitions = {}, tmdb;
var proxyCache = { at: 0, port: 0, agents: {} };
function proxyPort() {
  if (Date.now() - proxyCache.at < 30000) return proxyCache.port;
  var port = 0;
  try {
    var config = JSON.parse(fs.readFileSync('/var/lib/alcyone-singbox/core-config.json', 'utf8'));
    var inbound = (config.inbounds || []).find(function (value) {
      return value && value.type === 'socks' && /^127\.0\.0\.1$/.test(value.listen || '') && Number.isInteger(value.listen_port);
    });
    if (inbound) port = inbound.listen_port;
  } catch (error) {}
  proxyCache = { at: Date.now(), port: port, agents: proxyCache.agents };
  return port;
}
function shouldProxy(host) {
  return ['youtube.com', 'ytimg.com', 'netflix.com', 'themoviedb.org', 'tmdb.org', 'tvmaze.com'].some(function (suffix) {
    return host === suffix || host.endsWith('.' + suffix);
  });
}
function socksConnect(proxy, host, port) {
  return new Promise(function (resolve, reject) {
    var socket = net.connect({ host: '127.0.0.1', port: proxy });
    var buffer = Buffer.alloc(0), stage = 0, finished = false;
    var timer = setTimeout(function () { done(new Error('SOCKS timeout')); }, 10000);
    function done(error) {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (error) { socket.destroy(); reject(error); }
      else resolve(socket);
    }
    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 0) {
        if (buffer.length < 2) return;
        if (buffer[0] !== 5 || buffer[1] !== 0) return done(new Error('SOCKS authentication unavailable'));
        buffer = buffer.slice(2); stage = 1;
        var name = Buffer.from(host, 'utf8');
        var greeting = Buffer.alloc(7 + name.length);
        greeting[0] = 5; greeting[1] = 1; greeting[2] = 0; greeting[3] = 3; greeting[4] = name.length;
        name.copy(greeting, 5); greeting.writeUInt16BE(port, 5 + name.length);
        socket.write(greeting);
      }
      if (stage === 1) {
        if (buffer.length < 4) return;
        var type = buffer[3], need;
        if (type === 1) need = 10;
        else if (type === 4) need = 22;
        else if (type === 3) { if (buffer.length < 5) return; need = 7 + buffer[4]; }
        else return done(new Error('SOCKS reply invalid'));
        if (buffer.length < need) return;
        if (buffer[1] !== 0) return done(new Error('SOCKS connect failed'));
        socket.removeListener('data', onData); socket.removeListener('error', done);
        done(null);
      }
    }
    socket.on('connect', function () { socket.write(Buffer.from([5, 1, 0])); });
    socket.on('data', onData);
    socket.on('error', done);
  });
}
function proxyAgent(port) {
  if (proxyCache.agents[port]) return proxyCache.agents[port];
  var agent = new https.Agent({ keepAlive: false });
  agent.createConnection = function (options, callback) {
    var host = options.host || options.hostname;
    socksConnect(port, host, Number(options.port) || 443).then(function (socket) {
      var secure = tls.connect({ socket: socket, servername: host });
      secure.once('secureConnect', function () { callback(null, secure); });
      secure.once('error', function (error) { socket.destroy(); callback(error); });
    }, callback);
  };
  proxyCache.agents[port] = agent;
  return agent;
}
function request(url, limit, headers, redirects) {
  return new Promise(function (resolve, reject) {
    var parsed;
    try { parsed = new URL(url); } catch (error) { reject(error); return; }
    var allowed = ['bilibili.com', 'youtube.com', 'apple.com', 'netflix.com', 'tvmaze.com', 'hdslb.com', 'ytimg.com', 'api.themoviedb.org', 'image.tmdb.org'];
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !allowed.some(function (host) { return parsed.hostname === host || parsed.hostname.endsWith('.' + host); })) return reject(new Error('Source not allowed'));
    if (headers && headers.Authorization && parsed.hostname !== 'api.themoviedb.org') return reject(new Error('Authentication host not allowed'));
    var proxy = proxyPort();
    var agent = proxy && shouldProxy(parsed.hostname) ? proxyAgent(proxy) : undefined;
    var finished = false, req;
    var deadline = setTimeout(function () { done(new Error('Source timeout')); if (req) req.destroy(); }, 12000);
    function done(error, data) { if (finished) return; finished = true; clearTimeout(deadline); if (error) reject(error); else resolve(data); }
    req = https.get(url, { headers: Object.assign({ 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity', Referer: 'https://www.bilibili.com/' }, headers || {}), agent: agent }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 3) {
        var next = new URL(res.headers.location, url);
        if (headers && headers.Authorization && next.origin !== parsed.origin) { res.resume(); done(new Error('Authenticated redirect not allowed')); return; }
        res.resume(); request(next.href, limit, headers, (redirects || 0) + 1).then(function (data) { done(null, data); }, done); return;
      }
      if (res.statusCode !== 200) { res.resume(); done(new Error('Source HTTP ' + res.statusCode)); return; }
      var size = 0, chunks = [];
      res.on('data', function (chunk) { size += chunk.length; if (size > limit) { done(new Error('Source too large')); res.destroy(); } else chunks.push(chunk); });
      res.on('end', function () { done(null, Buffer.concat(chunks)); });
      res.on('error', done); res.on('aborted', function () { done(new Error('Source truncated')); });
    });
    req.on('error', done);
  });
}
async function json(url) { return JSON.parse((await request(url, 6000000)).toString('utf8')); }
function atomic(file, value) { fs.writeFileSync(file + '.tmp', JSON.stringify(value)); fs.renameSync(file + '.tmp', file); }
function image(url) {
  if (imageJobs.has(url)) return imageJobs.get(url);
  var job = downloadImage(url).finally(function () { imageJobs.delete(url); });
  imageJobs.set(url, job); return job;
}
async function downloadImage(url) {
  url = url.replace(/^http:/, 'https:');
  var host = new URL(url).hostname;
  if (!['hdslb.com', 'ytimg.com', 'apple.com', 'tvmaze.com', 'image.tmdb.org'].some(function (x) { return host === x || host.endsWith('.' + x); })) throw new Error('Image host not allowed');
  var name = crypto.createHash('sha256').update(url).digest('hex') + '.jpg', file = path.join(cacheDir, name);
  if (!fs.existsSync(file)) {
    var data = await request(url, 3000000);
    var valid = (data[0] === 255 && data[1] === 216 && data[data.length - 2] === 255 && data[data.length - 1] === 217) || (data.slice(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && data.slice(-16).includes(Buffer.from('IEND'))) || (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' && data.readUInt32LE(4) + 8 === data.length);
    if (!valid) throw new Error('Invalid image');
    fs.writeFileSync(file + '.tmp', data); fs.renameSync(file + '.tmp', file);
  }
  return 'content-cache/' + name;
}
function cleanText(value, limit) {
  if (typeof value !== 'string') return '';
  var text = xml(value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')).replace(/\s+/g, ' ').trim();
  return text.slice(0, limit || 180);
}
async function item(id, title, artwork, subtitle, sourceUrl, description) {
  if (typeof title !== 'string' || !title.trim() || title.length > 400 || !/^https:\/\//.test(sourceUrl)) throw new Error('Invalid content');
  return { id: String(id), title: title.trim(), image: await image(artwork), subtitle: subtitle, sourceUrl: sourceUrl, description: cleanText(description, 180) };
}
async function collect(rows, transform, count) {
  var output = [];
  for (var row of rows) { try { output.push(await transform(row)); } catch (error) {} if (output.length >= count) break; }
  return output;
}
async function bili() {
  var data = await json('https://api.bilibili.com/x/web-interface/popular?ps=8&pn=1');
  if (data.code !== 0) throw new Error('Bilibili unavailable');
  return { items: await collect(data.data.list, function (v) { return item(v.bvid, v.title, v.pic, '公开热门 · ' + v.owner.name, 'https://www.bilibili.com/video/' + v.bvid, v.desc || v.tname); }, 5) };
}
function xml(text) { return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(Number(n)); }).replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCodePoint(parseInt(n, 16)); }); }
async function youtube() {
  var feed = (await request('https://www.youtube.com/feeds/videos.xml?channel_id=UCLA_DiR1FfKNvjuUpBHmylQ', 1000000)).toString('utf8');
  var rows = feed.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return { items: await collect(rows, async function (row) {
    var id = row.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)[1];
    var title = xml(row.match(/<title>([\s\S]*?)<\/title>/)[1]);
    var artwork = xml(row.match(/<media:thumbnail[^>]+url="([^"]+)"/)[1]);
    var summary = row.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/);
    var line = summary ? xml(summary[1]).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || '' : '';
    try {
      return await item(id, title, 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg', 'NASA · 公开频道更新', 'https://www.youtube.com/watch?v=' + id, line);
    } catch (error) {
      return item(id, title, artwork, 'NASA · 公开频道更新', 'https://www.youtube.com/watch?v=' + id, line);
    }
  }, 5) };
}
async function apple() {
  var data = (await json('https://www.apple.com/tv-pr/originals.originals.json')).results.originals;
  var today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  var rows = data.filter(function (v) { return ['series', 'films', 'film'].includes(v.showTypeKey) && v.releaseDateISOString && v.releaseDateISOString.slice(0, 10) <= today && v.image; }).sort(function (a, b) { return b.releaseDateISOString.localeCompare(a.releaseDateISOString); });
  async function artwork(v) {
    var i = v.image;
    var fallback = 'https://www.apple.com' + i.dirpath + i.name + (i.separator || '.') + 'large_2x.' + (i.type || 'jpg');
    try {
      var page = (await request('https://www.apple.com' + v.url, 2000000)).toString('utf8');
      var match = page.match(/\/tv-pr\/shows-and-films\/[^"'\s]+?\.jpg\.video_show_home_large_2x\.jpg/);
      if (match) return 'https://www.apple.com' + match[0];
    } catch (error) {}
    return fallback;
  }
  return { items: await collect(rows.slice(0, 12), async function (v) {
    var text = (v.genres || []).join(' · ');
    if (v.releaseDateISOString) text += (text ? ' · ' : '') + v.releaseDateISOString.slice(0, 4);
    var backdrop = '';
    try { backdrop = tmdb ? await tmdb.backdrop(v.title, 'original') : ''; } catch (error) {}
    var fallback = await artwork(v);
    var subtitle = '官方片单 · ' + v.releaseDateISOString.slice(0, 10);
    var sourceUrl = 'https://www.apple.com' + v.url;
    var result;
    if (backdrop) {
      try {
        result = await item(v.url, v.title, backdrop, subtitle, sourceUrl, text);
        result.credits = [{ name: 'TMDB', url: 'https://www.themoviedb.org/' }];
      } catch (error) {
        result = await item(v.url, v.title, fallback, subtitle, sourceUrl, text);
      }
    } else {
      result = await item(v.url, v.title, fallback, subtitle, sourceUrl, text);
    }
    return result;
  }, 5) };
}
function normalize(title) { return title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
async function netflix() {
  var text = (await request('https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv', 6000000)).toString('utf8').replace(/^\uFEFF/, '');
  var lines = text.trim().split(/\r?\n/), headers = lines.shift().split('\t');
  var rows = lines.map(function (line) { var cells = line.split('\t'), row = {}; headers.forEach(function (h, i) { row[h] = cells[i]; }); return row; });
  var week = rows.reduce(function (max, row) { return row.week > max ? row.week : max; }, '');
  var seen = new Set();
  rows = rows.filter(function (r) { if (r.week !== week || r.category !== 'TV (English)' || seen.has(r.show_title)) return false; seen.add(r.show_title); return true; }).sort(function (a, b) { return Number(a.weekly_rank) - Number(b.weekly_rank); });
  var output = await collect(rows.slice(0, 8), async function (r) {
    var matches = (await json('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(r.show_title))).map(function (x) { return x.show; }).filter(function (show) { return normalize(show.name) === normalize(r.show_title) && show.image; });
    var owned = matches.filter(function (show) { return show.webChannel && show.webChannel.name === 'Netflix'; });
    var choices = owned.length ? owned : matches;
    if (choices.length !== 1) throw new Error('Ambiguous artwork');
    var show = choices[0];
    var backdrop = '';
    try { backdrop = tmdb ? await tmdb.backdrop(r.show_title, 'original') : ''; } catch (error) {}
    var credits = [{ name: 'TVmaze', url: show.url }];
    var subtitle = '全球周榜 #' + r.weekly_rank + ' · ' + week;
    var result;
    if (backdrop) {
      try {
        result = await item(show.id, r.show_title, backdrop, subtitle, 'https://www.netflix.com/tudum/top10/tv/global', show.summary);
        result.credits = credits.concat([{ name: 'TMDB', url: 'https://www.themoviedb.org/' }]);
      } catch (error) {
        result = await item(show.id, r.show_title, show.image.original, subtitle, 'https://www.netflix.com/tudum/top10/tv/global', show.summary);
        result.credits = credits;
      }
    } else {
      result = await item(show.id, r.show_title, show.image.original, subtitle, 'https://www.netflix.com/tudum/top10/tv/global', show.summary);
      result.credits = credits;
    }
    return result;
  }, 5);
  return { items: output, sourcePeriod: week };
}
function prune() {
  var keep = new Set(); Object.values(providers).forEach(function (p) { p.items.forEach(function (i) { keep.add(path.basename(i.image)); }); });
  fs.readdirSync(cacheDir).filter(function (file) { return /^[a-f0-9]{64}\.jpg$/.test(file) && !keep.has(file); }).forEach(function (file) { try { if (Date.now() - fs.statSync(path.join(cacheDir, file)).mtimeMs > 86400000) fs.unlinkSync(path.join(cacheDir, file)); } catch (error) {} });
}
function cached(def) {
  var old;
  try { old = JSON.parse(fs.readFileSync(path.join(cacheDir, def.cacheKey + '.json'), 'utf8')); } catch (error) {}
  if (!old || !Array.isArray(old.items)) old = { items: [], fetchedAt: null };
  old.items = old.items.filter(function (i) { return i && typeof i.image === 'string' && /^content-cache\/[a-f0-9]{64}\.jpg$/.test(i.image) && fs.existsSync(path.join(appDir, i.image)); });
  if (!old.items.length || !Number.isFinite(Date.parse(old.fetchedAt))) old.fetchedAt = null;
  return Object.assign(old, def.meta, { status: old.items.length ? 'cached' : 'unavailable' });
}
function syncApps(apps) {
  var config = tmdb.config(), next = {}, revision = '';
  try { var stat = fs.statSync('/var/lib/lg-c5-home/tmdb.json'); revision = stat.mtimeMs + ':' + stat.size; } catch (error) {}
  apps.forEach(function (app) {
    var def;
    if (nativeSources[app.id]) {
      def = { cacheKey: app.id, ttl: 900000, enabled: true, fetch: nativeSources[app.id][1], meta: { label: nativeSources[app.id][0], sourceActionLabel: nativeActions[app.id], credits: app.id === 'netflix' ? [{ name: 'TVmaze', url: 'https://www.tvmaze.com/' }] : [] } };
    } else {
      var platform = tmdb.resolve(app);
      if (!platform) return;
      def = { revision: revision, cacheKey: app.id + '.tmdb.' + config.region + '.' + config.language, ttl: 1800000, enabled: config.configured,
        fetch: function () { return tmdb.fetch(platform.key); },
        meta: { label: platform.label + ' · ' + (config.region === 'US' ? '美国' : config.region) + '片库精选', sourceActionLabel: '查看作品资料',
          region: config.region, language: config.language, sourceLabel: 'TMDB / JustWatch', configured: config.configured,
          credits: [{ name: 'TMDB', url: 'https://www.themoviedb.org/' }, { name: 'JustWatch', url: 'https://www.justwatch.com/' }] } };
    }
    if (definitions[app.id] && definitions[app.id].cacheKey === def.cacheKey && definitions[app.id].enabled === def.enabled && definitions[app.id].revision === def.revision) next[app.id] = definitions[app.id];
    else { next[app.id] = def; providers[app.id] = cached(def); delete retries[app.id]; }
    if (!def.enabled) { providers[app.id].status = providers[app.id].items.length ? 'cached' : 'unconfigured'; providers[app.id].error = '尚未配置影视资料源'; }
  });
  Object.keys(providers).forEach(function (id) { if (!next[id]) { delete providers[id]; delete retries[id]; } });
  definitions = next;
}
function scheduleRefresh() {
  if (refreshTimer) return;
  // Keep the public cover feeds fresh even when the launcher is not polling.
  refreshTimer = setInterval(function () {
    if (!active && Object.keys(definitions).length) refresh(false);
  }, 5 * 60 * 1000);
}
function refresh(force) {
  if (active) return;
  if (force) {
    retries = {};
    proxyCache.at = 0;
  }
  var due = Object.keys(definitions).filter(function (id) {
    var def = definitions[id];
    return def.enabled && (force || (Date.now() >= (retries[id] || 0) && (!providers[id].fetchedAt || Date.now() - Date.parse(providers[id].fetchedAt) > def.ttl)));
  });
  if (!due.length) return;
  active = true;
  Promise.all(due.map(async function (id) {
    var def = definitions[id];
    try {
      var result = await def.fetch();
      if (definitions[id] !== def) return;
      if (!result.items.length) throw new Error('No content');
      var next = Object.assign({}, def.meta, { items: result.items, sourcePeriod: result.sourcePeriod || null, fetchedAt: new Date().toISOString(), status: 'live', error: '' });
      atomic(path.join(cacheDir, def.cacheKey + '.json'), next); providers[id] = next;
    } catch (error) {
      if (definitions[id] !== def) return;
      retries[id] = Date.now() + 300000; providers[id].status = providers[id].items.length ? 'cached' : 'unavailable';
      var errors = { TMDB_NOT_CONFIGURED: '尚未配置影视资料源', TMDB_AUTH_FAILED: '影视资料源凭据无效', TMDB_PLATFORM_UNAVAILABLE: '当前地区暂无该平台片库' };
      providers[id].error = errors[error.code] || (providers[id].items.length ? '刷新失败，保留上次内容' : '暂时无法获取内容');
    }
  })).finally(function () { active = false; try { prune(); } catch (error) {} });
}
exports.register = function (service) {
  fs.mkdirSync(cacheDir, { recursive: true });
  tmdb = require('./tmdb').create({ configPath: '/var/lib/lg-c5-home/tmdb.json', request: request, image: image });
  service.register('publicContent', function (message) {
    if (ALLOWED.indexOf(message.sender) < 0) return message.respond({ returnValue: false, errorText: 'Caller not allowed' });
    var payload = message.payload || {};
    if (!Array.isArray(payload.apps) || payload.apps.length > 200) return message.respond({ returnValue: false, errorText: 'Invalid application catalog' });
    var seen = new Set();
    var apps = payload.apps.filter(function (app) {
      if (!app || typeof app.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,128}$/.test(app.id) || typeof app.title !== 'string' || app.title.length > 200 || seen.has(app.id)) return false;
      seen.add(app.id); return true;
    });
    syncApps(apps); scheduleRefresh(); refresh(payload.refresh === true);
    message.respond({ returnValue: true, version: 2, refreshing: active, providers: providers });
  });
};
