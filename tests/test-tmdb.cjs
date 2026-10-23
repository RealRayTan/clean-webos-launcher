const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { create } = require('../service/tmdb');
function fixture(t, settings = {}, adjust = () => {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tmdb-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const configPath = path.join(folder, 'settings.json');
  fs.writeFileSync(configPath, JSON.stringify({ token: 'fixture-only-token', region: 'US', language: 'zh-CN', ...settings }));
  const calls = [], images = [];
  const handlers = {
    providers: [{ provider_id: 900, provider_name: 'Amazon Prime Video' }, { provider_id: 901, provider_name: 'Amazon Channel' }],
    movie: [{ id: 1, title: '电影中文名', original_title: 'Film', backdrop_path: '/film.jpg', release_date: '2020-01-01', overview: '一个电影简介。' }],
    tv: [{ id: 1, name: '', original_name: 'Series Original', backdrop_path: '/series.jpg', first_air_date: '2020-01-01', overview: 'A series overview.' }],
    search: [{ media_type: 'tv', name: 'Series Original', original_name: 'Series Original', backdrop_path: '/backdrop.jpg' }]
  };
  adjust(handlers);
  const adapter = create({ configPath, request: async (raw, limit, headers) => {
    const url = new URL(raw); calls.push({ url, limit, headers });
    if (handlers.error) throw handlers.error;
    const data = url.pathname.includes('/watch/providers/') ? handlers.providers
      : url.pathname.includes('/search/') ? handlers.search
      : url.pathname.includes('/trending/') ? (url.pathname.includes('/movie') ? (handlers.trendingMovie || handlers.movie) : (handlers.trendingTv || handlers.tv))
      : url.pathname.endsWith('/movie') ? handlers.movie : handlers.tv;
    return Buffer.from(JSON.stringify({ results: data }));
  }, image: async url => { images.push(url); return 'content-cache/' + 'a'.repeat(64) + '.jpg'; } });
  return { adapter, calls, images, configPath };
}
test('US subscription catalogs share one adapter, keep film/TV IDs distinct and prefer Chinese titles', async t => {
  const { adapter, calls, images } = fixture(t);
  const result = await adapter.fetch('prime');
  assert.deepEqual(result.items.map(x => [x.id, x.title]), [['movie:1', '电影中文名'], ['tv:1', 'Series Original']]);
  assert.deepEqual(result.items.map(x => x.description), ['一个电影简介。', 'A series overview.']);
  assert.equal(result.region, 'US'); assert.equal(result.language, 'zh-CN');
  assert.match(result.sourceLabel, /片库精选/); assert.doesNotMatch(result.sourceLabel, /热门榜|上新/);
  const discover = calls.filter(c => c.url.pathname.includes('/discover/'));
  assert.equal(discover.length, 2);
  for (const call of discover) {
    assert.equal(call.url.hostname, 'api.themoviedb.org');
    assert.equal(call.headers.Authorization, 'Bearer fixture-only-token');
    assert.equal(call.url.searchParams.get('watch_region'), 'US');
    assert.equal(call.url.searchParams.get('language'), 'zh-CN');
    assert.equal(call.url.searchParams.get('with_watch_monetization_types'), 'flatrate');
    assert.equal(call.url.searchParams.get('with_watch_providers'), '900');
  }
  assert.deepEqual(images, ['https://image.tmdb.org/t/p/original/film.jpg', 'https://image.tmdb.org/t/p/original/series.jpg']);
  assert.deepEqual(result.credits.map(x => x.name), ['TMDB', 'JustWatch']);
  assert.deepEqual(adapter.config(), { region: 'US', language: 'zh-CN', configured: true });
  assert.ok(!JSON.stringify(result).includes('fixture-only-token'));
});
test('overview descriptions are clamped at the source boundary', async t => {
  const { adapter } = fixture(t, {}, h => { h.movie[0].overview = 'x'.repeat(400); });
  const result = await adapter.fetch('prime');
  assert.equal(result.items[0].description.length, 180);
});
test('backdrops are matched by exact title and skip unmatched results', async t => {
  const { adapter } = fixture(t);
  assert.equal(await adapter.backdrop('Series Original'), 'https://image.tmdb.org/t/p/w1280/backdrop.jpg');
  assert.equal(await adapter.backdrop('Series Original', 'original'), 'https://image.tmdb.org/t/p/original/backdrop.jpg');
  assert.equal(await adapter.backdrop('Series Original', 'w999'), 'https://image.tmdb.org/t/p/w1280/backdrop.jpg');
  assert.equal(await adapter.backdrop('Series Original Deluxe'), '');
});
test('backdrops do not request without credentials', async t => {
  const { adapter, calls } = fixture(t, { token: '' });
  assert.equal(await adapter.backdrop('Series Original'), '');
  assert.equal(calls.length, 0);
});
test('missing credentials return actionable failure without network requests', async t => {
  const { adapter, calls } = fixture(t, { token: '' });
  await assert.rejects(adapter.fetch('prime'), { code: 'TMDB_NOT_CONFIGURED' });
  assert.deepEqual(calls, []); assert.equal(adapter.config().configured, false);
});
test('exact app bindings avoid guessing Max or unrelated Prime channels', t => {
  const { adapter } = fixture(t, { bindings: { 'installed.max.id': 'hbo' } });
  assert.equal(adapter.resolve({ id: 'amazon', title: 'Prime Video' }).key, 'prime');
  assert.equal(adapter.resolve({ id: 'disney.local', title: 'Disney+' }).key, 'disney');
  assert.equal(adapter.resolve({ id: 'hbo.local', title: 'HBO Max' }).key, 'hbo');
  assert.equal(adapter.resolve({ id: 'unrecognized.max', title: 'Max' }), null);
  assert.equal(adapter.resolve({ id: 'installed.max.id', title: 'Max' }).key, 'hbo');
  assert.equal(adapter.resolve({ id: 'unrelated', title: 'Prime Video Guide' }), null);
});
test('ambiguous provider names fail rather than mixing unrelated providers', async t => {
  const { adapter } = fixture(t, {}, h => { h.providers.push({ provider_id: 902, provider_name: 'Amazon Prime Video' }); });
  await assert.rejects(adapter.fetch('prime'), { code: 'TMDB_PLATFORM_AMBIGUOUS' });
});
test('authentication errors are sanitized and never contain credentials', async t => {
  const { adapter } = fixture(t, {}, h => { h.error = new Error('HTTP 401 sensitive request fixture-only-token'); });
  await assert.rejects(adapter.fetch('prime'), error => error.code === 'TMDB_AUTH_FAILED' && !error.message.includes('fixture-only-token'));
});
test('future releases, missing backdrops, adult media and duplicate rows do not become covers', async t => {
  const { adapter, images } = fixture(t, {}, h => {
    h.movie.push({ ...h.movie[0] }, { id: 2, title: 'Future', release_date: '2999-01-01', backdrop_path: '/future.jpg' }, { id: 3, title: 'Poster only', release_date: '2020-01-01', poster_path: '/poster.jpg' }, { id: 4, title: 'Adult', release_date: '2020-01-01', backdrop_path: '/adult.jpg', adult: true });
  });
  const result = await adapter.fetch('prime');
  assert.deepEqual(result.items.map(x => x.id), ['movie:1', 'tv:1']);
  assert.equal(images.length, 2);
});
test('provider lookup is region-aware, reusable, and credentials can be added without restarting', async t => {
  const { adapter, calls, configPath } = fixture(t);
  await adapter.fetch('prime'); await adapter.fetch('prime');
  assert.equal(calls.filter(x => x.url.pathname.includes('/watch/providers/')).length, 2);
  fs.writeFileSync(configPath, JSON.stringify({ token: 'replacement-fixture-token', region: 'HK', language: 'zh-TW' }));
  const result = await adapter.fetch('prime');
  assert.equal(result.region, 'HK'); assert.equal(result.language, 'zh-TW');
  assert.equal(calls.filter(x => x.url.pathname.includes('/watch/providers/')).length, 4);
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer replacement-fixture-token');
});
test('malformed credential/config values do not reach the request boundary', async t => {
  const { adapter, calls } = fixture(t, { token: 'bad\r\nAuthorization: injected' });
  await assert.rejects(adapter.fetch('prime'), { code: 'TMDB_CONFIG_INVALID' }); assert.equal(calls.length, 0);
});
test('trending fetches movies and tv with localized metadata, original title, and ratings', async t => {
  const { adapter, calls } = fixture(t, {}, h => {
    h.trendingMovie = [{
      id: 693134,
      title: '沙丘 2',
      original_title: 'Dune: Part Two',
      backdrop_path: '/dune_backdrop.jpg',
      poster_path: '/dune_poster.jpg',
      release_date: '2024-03-01',
      vote_average: 8.8,
      vote_count: 12400,
      genre_ids: [878, 12],
      overview: '保罗·厄崔迪携手契妮展开复仇。'
    }];
    h.trendingTv = [{
      id: 95557,
      name: '人生切割术',
      original_name: 'Severance',
      backdrop_path: '/sev_backdrop.jpg',
      poster_path: '/sev_poster.jpg',
      first_air_date: '2022-02-18',
      vote_average: 8.7,
      vote_count: 3200,
      genre_ids: [9648, 878],
      overview: '卢蒙公司员工通过手术将记忆彻底分割。'
    }];
  });
  const movies = await adapter.trending('movie');
  assert.equal(movies.items.length, 1);
  assert.equal(movies.items[0].id, 'movie:693134');
  assert.equal(movies.items[0].title, '沙丘 2');
  assert.equal(movies.items[0].originalTitle, 'Dune: Part Two (2024)');
  assert.equal(movies.items[0].score, '★ 8.8');
  assert.equal(movies.items[0].votes, '12.4k人评');
  assert.equal(movies.items[0].genre, '科幻 · 冒险');
  assert.match(movies.items[0].backdrop, /^content-cache\/[a-f0-9]{64}\.jpg$/);
  assert.match(movies.items[0].poster, /^content-cache\/[a-f0-9]{64}\.jpg$/);

  const shows = await adapter.trending('tv');
  assert.equal(shows.items.length, 1);
  assert.equal(shows.items[0].id, 'tv:95557');
  assert.equal(shows.items[0].title, '人生切割术');
  assert.equal(shows.items[0].originalTitle, 'Severance (2022)');
  assert.equal(shows.items[0].genre, '悬疑 · 科幻');

  await assert.rejects(adapter.trending('invalid'), { code: 'TMDB_INVALID_TYPE' });
});
test('trending respects missing token configuration', async t => {
  const { adapter } = fixture(t, { token: '' });
  await assert.rejects(adapter.trending('movie'), { code: 'TMDB_NOT_CONFIGURED' });
});
