const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../service/public-content.js'), 'utf8');

function setup(options = {}) {
  const messages = [];
  let registeredHandler = null;
  const mockService = {
    register(name, fn) {
      if (name === 'publicContent') registeredHandler = fn;
    }
  };

  const files = {
    '/var/lib/alcyone-singbox/core-config.json': JSON.stringify({
      inbounds: [{ type: 'socks', listen: '127.0.0.1', listen_port: 10801 }]
    })
  };

  const mockFs = {
    mkdirSync() {},
    existsSync(p) { return !!files[p]; },
    readFileSync(p) {
      if (files[p]) return files[p];
      const err = new Error('ENOENT'); err.code = 'ENOENT'; throw err;
    },
    writeFileSync(p, data) { files[p] = data; },
    renameSync(from, to) { files[to] = files[from]; delete files[from]; },
    statSync(p) {
      if (!files[p]) throw new Error('ENOENT');
      return { mtimeMs: 1000, size: files[p].length };
    },
    readdirSync() { return []; },
    unlinkSync() {}
  };

  const sandbox = {
    exports: {},
    require(mod) {
      if (mod === 'fs') return mockFs;
      if (mod === 'path') return path;
      if (mod === 'crypto') return require('crypto');
      if (mod === 'net') return require('net');
      if (mod === 'tls') return require('tls');
      if (mod === 'https') return require('https');
      if (mod === './tmdb') return {
        create: () => ({
          config: () => ({ configured: false, region: 'US', language: 'zh-CN' }),
          resolve: () => null,
          fetch: async () => ({ items: [] }),
          backdrop: async () => ''
        })
      };
      throw new Error('Unknown module ' + mod);
    },
    Buffer,
    Date,
    setTimeout,
    clearTimeout,
    setInterval() {},
    clearInterval() {},
    console,
    URL
  };

  vm.runInNewContext(source, sandbox);
  sandbox.exports.register(mockService);

  return {
    handler: registeredHandler,
    sandbox,
    files
  };
}

test('shouldProxy includes tvmaze.com alongside youtube, netflix and tmdb', () => {
  const { sandbox } = setup();
  // We can test shouldProxy via vm
  const shouldProxy = vm.runInContext('shouldProxy', vm.createContext(sandbox));
  assert.equal(shouldProxy('api.tvmaze.com'), true);
  assert.equal(shouldProxy('static.tvmaze.com'), true);
  assert.equal(shouldProxy('tvmaze.com'), true);
  assert.equal(shouldProxy('youtube.com'), true);
  assert.equal(shouldProxy('i.ytimg.com'), true);
  assert.equal(shouldProxy('netflix.com'), true);
  assert.equal(shouldProxy('api.themoviedb.org'), true);
  assert.equal(shouldProxy('api.bilibili.com'), false);
  assert.equal(shouldProxy('www.apple.com'), false);
});

test('forced refresh bypasses failure retry backoff and resets retries cache', async () => {
  const { handler, sandbox } = setup();

  let fetchCount = 0;
  // Inject mock native source for testing retry behaviour
  sandbox.nativeSources['test.app'] = ['测试源', async function() {
    fetchCount++;
    if (fetchCount === 1) throw new Error('First fetch fails');
    return { items: [{ id: '1', title: 'Test Title', image: 'content-cache/' + '0'.repeat(64) + '.jpg', subtitle: 'sub', sourceUrl: 'https://example.com' }] };
  }];

  // First request with refresh: true - will fail and set retries backoff
  let response1;
  await new Promise(resolve => {
    handler({
      sender: 'com.gathin.tvhome',
      payload: { refresh: true, apps: [{ id: 'test.app', title: 'Test' }] },
      respond(res) { response1 = res; resolve(); }
    });
  });

  assert.equal(response1.returnValue, true);

  // Wait a microtask tick for async fetch to reject and record backoff
  await new Promise(resolve => setTimeout(resolve, 50));

  const retriesAfterFail = vm.runInContext('retries["test.app"]', sandbox);
  assert.ok(retriesAfterFail > Date.now());

  // Normal non-forced refresh should be skipped due to retry backoff
  let response2;
  await new Promise(resolve => {
    handler({
      sender: 'com.gathin.tvhome',
      payload: { refresh: false, apps: [{ id: 'test.app', title: 'Test' }] },
      respond(res) { response2 = res; resolve(); }
    });
  });
  assert.equal(response2.returnValue, true);
  // fetchCount should still be 1 (skipped)
  assert.equal(fetchCount, 1);

  // Forced refresh with refresh: true should bypass backoff and re-fetch immediately
  let response3;
  await new Promise(resolve => {
    handler({
      sender: 'com.gathin.tvhome',
      payload: { refresh: true, apps: [{ id: 'test.app', title: 'Test' }] },
      respond(res) { response3 = res; resolve(); }
    });
  });
  assert.equal(response3.returnValue, true);

  await new Promise(resolve => setTimeout(resolve, 50));
  // fetchCount should now have incremented to 2
  assert.equal(fetchCount, 2);
});
