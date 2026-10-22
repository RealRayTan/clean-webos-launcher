'use strict';
var fs = require('fs');
var platforms = require('./streaming-platforms.json');
var API = 'https://api.themoviedb.org/3';
var TTL = 6 * 3600000;
var BACKDROP_SIZES = ['w300', 'w780', 'w1280', 'original'];
var CREDITS = [
  { name: 'TMDB', url: 'https://www.themoviedb.org/' },
  { name: 'JustWatch', url: 'https://www.justwatch.com/' }
];
function failure(code, message) { var error = new Error(message); error.code = code; return error; }
function normalize(value) { return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '); }
function clean(value) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 180) : ''; }
function readConfig(file) {
  var saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw failure('TMDB_CONFIG_INVALID', '影视资料源配置无效'); }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw failure('TMDB_CONFIG_INVALID', '影视资料源配置无效');
  var region = saved.region === undefined ? 'US' : saved.region;
  var language = saved.language === undefined ? 'zh-CN' : saved.language;
  var token = saved.token === undefined ? '' : saved.token;
  if (!/^[A-Z]{2}$/.test(region) || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language) || typeof token !== 'string' || /\s/.test(token) || token.length > 8192) throw failure('TMDB_CONFIG_INVALID', '影视资料源配置无效');
  var bindings = saved.bindings || {};
  if (typeof bindings !== 'object' || Array.isArray(bindings)) throw failure('TMDB_CONFIG_INVALID', '影视平台绑定无效');
  Object.keys(bindings).forEach(function (id) {
    if (!/^[A-Za-z0-9_.-]+$/.test(id) || !platforms.some(function (p) { return p.key === bindings[id]; })) throw failure('TMDB_CONFIG_INVALID', '影视平台绑定无效');
  });
  return { region: region, language: language, token: token, bindings: bindings };
}
exports.create = function (options) {
  options = options || {};
  var configPath = options.configPath || '/var/lib/lg-c5-home/tmdb.json';
  var providerCache = new Map();
  function config() {
    try { var value = readConfig(configPath); return { region: value.region, language: value.language, configured: !!value.token }; }
    catch (error) { return { region: 'US', language: 'zh-CN', configured: false }; }
  }
  function resolve(app) {
    if (!app || typeof app.id !== 'string') return null;
    var binding;
    try { binding = readConfig(configPath).bindings[app.id]; } catch (error) {}
    if (binding) return platforms.find(function (p) { return p.key === binding; });
    return platforms.find(function (p) { return p.appIds.includes(app.id); }) || platforms.find(function (p) { return p.titleAliases.some(function (title) { return normalize(title) === normalize(app.title); }); }) || null;
  }
  async function query(route, parameters, settings) {
    var url = new URL(API + route);
    Object.keys(parameters).forEach(function (key) { url.searchParams.set(key, parameters[key]); });
    try {
      var raw = await options.request(url.href, 3000000, { Authorization: 'Bearer ' + settings.token, Accept: 'application/json' });
      var data = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : raw);
      if (data.success === false) {
        if ([3, 7, 10, 14, 16, 17, 30, 31, 32, 33, 35].includes(data.status_code)) throw failure('TMDB_AUTH_FAILED', '影视资料源凭据无效');
        throw failure('TMDB_SOURCE_UNAVAILABLE', '影视资料源暂不可用');
      }
      return data;
    } catch (error) {
      if (error.code && /^TMDB_/.test(error.code)) throw error;
      if ([401, 403].includes(Number(error.statusCode || error.status)) || /\b(?:401|403)\b/.test(String(error.message))) throw failure('TMDB_AUTH_FAILED', '影视资料源凭据无效');
      throw failure('TMDB_SOURCE_UNAVAILABLE', '影视资料源暂不可用');
    }
  }
  async function provider(platform, type, settings) {
    var key = settings.region + ':' + type;
    var cached = providerCache.get(key);
    if (!cached || Date.now() - cached.at >= TTL) {
      var data = await query('/watch/providers/' + type, { watch_region: settings.region, language: 'en-US' }, settings);
      if (!Array.isArray(data.results)) throw failure('TMDB_SOURCE_UNAVAILABLE', '影视平台列表暂不可用');
      cached = { at: Date.now(), rows: data.results }; providerCache.set(key, cached);
    }
    for (var name of platform.providerNames) {
      var exact = cached.rows.filter(function (row) { return Number.isSafeInteger(row.provider_id) && normalize(row.provider_name) === normalize(name); });
      var unique = Array.from(new Set(exact.map(function (row) { return row.provider_id; })));
      if (unique.length > 1) throw failure('TMDB_PLATFORM_AMBIGUOUS', '影视平台匹配不明确');
      if (unique.length === 1) return unique[0];
    }
    throw failure('TMDB_PLATFORM_UNAVAILABLE', '所选地区暂无该平台片库');
  }
  async function candidates(platform, type, settings) {
    var id = await provider(platform, type, settings);
    var today = new Date().toISOString().slice(0, 10);
    var params = { watch_region: settings.region, with_watch_providers: id, with_watch_monetization_types: 'flatrate', language: settings.language, include_adult: false, sort_by: 'popularity.desc', page: 1 };
    params[type === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = today;
    var data = await query('/discover/' + type, params, settings);
    if (!Array.isArray(data.results)) throw failure('TMDB_SOURCE_UNAVAILABLE', '影视片单暂不可用');
    return data.results.slice(0, 20).filter(function (row) {
      var date = row[type === 'tv' ? 'first_air_date' : 'release_date'];
      return Number.isSafeInteger(row.id) && row.id > 0 && row.adult !== true && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && /^\/[A-Za-z0-9_-]+\.(?:jpg|png)$/.test(row.backdrop_path || '');
    }).map(function (row) { return { type: type, value: row }; });
  }
  async function catalogArtwork(path) {
    var sizes = ['original', 'w1280', 'w780'];
    for (var i = 0; i < sizes.length; i++) {
      try {
        return await options.image('https://image.tmdb.org/t/p/' + sizes[i] + path);
      } catch (error) {}
    }
    throw failure('TMDB_IMAGE_UNAVAILABLE', '影视图片暂不可用');
  }

  async function fetchCatalog(key) {
    var settings = readConfig(configPath);
    if (!settings.token) throw failure('TMDB_NOT_CONFIGURED', '尚未配置影视资料源');
    var platform = platforms.find(function (p) { return p.key === key; });
    if (!platform) throw failure('TMDB_PLATFORM_UNAVAILABLE', '未识别的影视平台');
    var lists = await Promise.allSettled(['movie', 'tv'].map(function (type) { return candidates(platform, type, settings); }));
    var denied = lists.find(function (result) { return result.status === 'rejected' && ['TMDB_AUTH_FAILED', 'TMDB_PLATFORM_AMBIGUOUS'].includes(result.reason.code); });
    if (denied) throw denied.reason;
    var rows = lists.map(function (result) { return result.status === 'fulfilled' ? result.value : []; });
    if (lists.every(function (result) { return result.status === 'rejected'; })) throw lists[0].reason;
    var mixed = [];
    for (var i = 0; i < Math.max(rows[0].length, rows[1].length); i++) { if (rows[0][i]) mixed.push(rows[0][i]); if (rows[1][i]) mixed.push(rows[1][i]); }
    var seen = new Set(), items = [];
    for (var entry of mixed) {
      var row = entry.value, id = entry.type + ':' + row.id;
      if (seen.has(id)) continue;
      seen.add(id);
      var title = row[entry.type === 'tv' ? 'name' : 'title'] || row[entry.type === 'tv' ? 'original_name' : 'original_title'];
      if (typeof title !== 'string' || !title.trim() || title.length > 400) continue;
      try {
        var artwork = await catalogArtwork(row.backdrop_path);
        items.push({ id: id, title: title.trim(), image: artwork, subtitle: platform.label + ' · ' + settings.region + '片库精选', sourceUrl: 'https://www.themoviedb.org/' + entry.type + '/' + row.id, description: clean(row.overview), credits: CREDITS });
      } catch (error) {}
      if (items.length === 8) break;
    }
    if (!items.length) throw failure('TMDB_NO_CONTENT', '所选地区暂无可用封面');
    return { items: items, sourcePeriod: null, credits: CREDITS, sourceLabel: platform.label + ' · 片库精选', region: settings.region, language: settings.language };
  }
  async function backdrop(title, size) {
    if (typeof title !== 'string' || !title.trim()) return '';
    var settings;
    try { settings = readConfig(configPath); } catch (error) { return ''; }
    if (!settings.token) return '';
    var chosen = BACKDROP_SIZES.indexOf(size) >= 0 ? size : 'w1280';
    try {
      var data = await query('/search/multi', { query: title.trim(), language: settings.language, include_adult: false }, settings);
      var rows = Array.isArray(data.results) ? data.results : [];
      var wanted = normalize(title);
      var match = rows.filter(function (row) {
        if (row.media_type !== 'tv' && row.media_type !== 'movie') return false;
        if (typeof row.backdrop_path !== 'string' || !/^\/[A-Za-z0-9_-]+\.(?:jpg|png)$/.test(row.backdrop_path)) return false;
        return [row.name, row.original_name, row.title, row.original_title].some(function (name) {
          return typeof name === 'string' && normalize(name) === wanted;
        });
      })[0];
      return match ? 'https://image.tmdb.org/t/p/' + chosen + match.backdrop_path : '';
    } catch (error) { return ''; }
  }
  return { config: config, platforms: platforms, resolve: resolve, fetch: fetchCatalog, backdrop: backdrop };
};
