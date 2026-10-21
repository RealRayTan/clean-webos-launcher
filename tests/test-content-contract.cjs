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
