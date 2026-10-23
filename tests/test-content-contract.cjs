const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/content.js'), 'utf8');
function client() {
  const requests = [];
  const context = {
    window: {}, document: { hidden: false, getElementById: () => null, addEventListener() {} },
    TVDevice: { publicContent(refresh, apps, callback) { requests.push({ refresh, apps, callback }); } },
    setTimeout() { return 1; }, clearTimeout() {}, Date
  };
  vm.runInNewContext(source, context);
  return { content: context.window.PublicContent, requests };
}
const art = 'content-cache/' + 'a'.repeat(64) + '.jpg';
function catalog(id = 'amazon') {
  return { returnValue: true, version: 2, refreshing: false, providers: {
    [id]: { label: 'Prime Video · 美国片库精选', status: 'live', sourceActionLabel: '查看作品资料', credits: [],
      items: [{ id: 'movie:1', title: 'Fixture catalog item', image: art, sourceUrl: 'https://www.themoviedb.org/movie/1' }] }
  } };
}
test('a catalog arriving after startup makes a new installed platform available to tile subscribers', () => {
  const { content, requests } = client(); let changed = 0;
  content.setApps([{ id: 'amazon', title: 'Prime Video' }]);
  content.subscribe(() => changed++); content.start();
  assert.equal(content.supports('amazon'), false);
  requests[0].callback(catalog());
  assert.equal(content.supports('amazon'), true);
  assert.equal(content.items('amazon')[0].sourceActionLabel, '查看作品资料');
  assert.ok(changed > 0);
  content.setApps([]); requests[1].callback({ returnValue: true, version: 2, providers: {} });
  assert.equal(content.supports('amazon'), false);
});
test('optional descriptions are normalized and clamped at the feed boundary', () => {
  const { content, requests } = client();
  content.setApps([{ id: 'amazon', title: 'Prime Video' }]); content.start();
  const data = catalog();
  data.providers.amazon.items[0].description = '  A   one-line\nsummary.  ';
  data.providers.amazon.items.push({ ...data.providers.amazon.items[0], id: 'movie:2', description: 'x'.repeat(400) });
  requests[0].callback(data);
  assert.equal(content.items('amazon')[0].description, 'A one-line summary.');
  assert.equal(content.items('amazon')[1].description.length, 180);
});
test('unknown apps and unsafe artwork are rejected at the feed boundary', () => {
  const { content, requests } = client();
  content.setApps([{ id: 'amazon', title: 'Prime Video' }]); content.start();
  const data = catalog(); data.providers.amazon.items.push({ ...data.providers.amazon.items[0], id: 'movie:2', image: 'https://untrusted.example/picture.jpg' });
  data.providers.unknown = data.providers.amazon;
  requests[0].callback(data);
  assert.equal(content.items('amazon').length, 1);
  assert.equal(content.supports('unknown'), false);
});
test('a missing credential preserves the brand entry without inventing catalog items', () => {
  const { content, requests } = client();
  content.setApps([{ id: 'amazon', title: 'Prime Video' }]); content.start();
  requests[0].callback({ returnValue: true, version: 2, providers: { amazon: { label: 'Prime Video', status: 'unconfigured', error: '尚未配置影视资料源', items: [], credits: [] } } });
  assert.equal(content.supports('amazon'), true);
  assert.equal(content.items('amazon').length, 0);
});
test('trending movies and tv feeds are sanitized and exposed to subscribers', () => {
  const { content, requests } = client();
  content.start();
  const data = catalog();
  data.trending = {
    movie: {
      status: 'live',
      items: [{
        id: 'movie:101',
        title: '沙丘 2',
        originalTitle: 'Dune: Part Two (2024)',
        score: '★ 8.8',
        votes: '12.4k人评',
        releaseDate: '2024-03-01',
        genre: '科幻 · 冒险',
        overview: '保罗复仇记。',
        backdrop: art,
        poster: art,
        sourceUrl: 'https://www.themoviedb.org/movie/101'
      }]
    },
    tv: {
      status: 'live',
      items: [{
        id: 'tv:202',
        title: '人生切割术',
        originalTitle: 'Severance (2022)',
        score: '★ 8.7',
        backdrop: art,
        sourceUrl: 'https://www.themoviedb.org/tv/202'
      }, {
        id: 'tv:bad',
        title: 'Bad Artwork',
        backdrop: 'https://malicious.example/pic.jpg',
        sourceUrl: 'https://www.themoviedb.org/tv/bad'
      }]
    }
  };
  requests[0].callback(data);
  const movies = content.trending('movies');
  assert.equal(movies.status, 'live');
  assert.equal(movies.items.length, 1);
  assert.equal(movies.items[0].title, '沙丘 2');
  assert.equal(movies.items[0].originalTitle, 'Dune: Part Two (2024)');
  assert.equal(movies.items[0].score, '★ 8.8');

  const shows = content.trending('shows');
  assert.equal(shows.status, 'live');
  assert.equal(shows.items.length, 1);
  assert.equal(shows.items[0].title, '人生切割术');
});
