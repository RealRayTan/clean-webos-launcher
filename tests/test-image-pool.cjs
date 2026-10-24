const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function createSandbox() {
  const imagesCreated = [];
  class FakeImage {
    constructor() {
      this._src = '';
      this.decoding = 'auto';
      imagesCreated.push(this);
    }
    get src() { return this._src; }
    set src(val) { this._src = val; }
    async decode() {
      if (this._src.includes('error')) throw new Error('Decode failed');
      return undefined;
    }
  }

  const context = {
    window: {},
    Image: FakeImage,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    Date: global.Date,
    console: { log: () => {}, error: () => {} }
  };
  context.window = context;

  const code = fs.readFileSync(path.join(rootDir, 'app', 'pool.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context);

  return { context, imagesCreated, FakeImage };
}

test('ImagePool enforces capacity with LRU eviction and detaches evicted textures', () => {
  const { context, imagesCreated } = createSandbox();
  const pool = context.ImagePool.create(3);

  const img1 = pool.acquire('cover1.jpg');
  const img2 = pool.acquire('cover2.jpg');
  const img3 = pool.acquire('cover3.jpg');

  assert.equal(pool.size(), 3);
  assert.equal(pool.has('cover1.jpg'), true);
  assert.equal(pool.has('cover2.jpg'), true);
  assert.equal(pool.has('cover3.jpg'), true);

  // Access cover1 to make it most recently used (order now: cover2, cover3, cover1)
  const img1Again = pool.acquire('cover1.jpg');
  assert.equal(img1, img1Again);

  // Acquire 4th item: cover2 should be evicted (oldest)
  const img4 = pool.acquire('cover4.jpg');
  assert.equal(pool.size(), 3);
  assert.equal(pool.has('cover2.jpg'), false, 'cover2 must be evicted');
  assert.equal(img2.src, '', 'evicted image texture must be cleared with src=""');
  assert.equal(pool.has('cover1.jpg'), true);
  assert.equal(pool.has('cover3.jpg'), true);
  assert.equal(pool.has('cover4.jpg'), true);
});

test('ImagePool pruneNonVisible detaches unreferenced textures', () => {
  const { context } = createSandbox();
  const pool = context.ImagePool.create(4);

  const imgA = pool.acquire('a.jpg');
  const imgB = pool.acquire('b.jpg');
  const imgC = pool.acquire('c.jpg');

  assert.equal(pool.size(), 3);

  // Keep only a.jpg and c.jpg visible
  pool.pruneNonVisible(['a.jpg', 'c.jpg']);

  assert.equal(pool.size(), 2);
  assert.equal(pool.has('a.jpg'), true);
  assert.equal(pool.has('b.jpg'), false);
  assert.equal(imgB.src, '', 'unreferenced image src must be cleared');
  assert.equal(pool.has('c.jpg'), true);
});

test('PreloadQueue processes items sequentially and respects pause and resume', async () => {
  const { context } = createSandbox();
  const pool = context.ImagePool.create(5);
  const queue = context.PreloadQueue.create();

  const completed = [];
  queue.enqueue('item1.jpg', pool, url => completed.push(url));
  queue.enqueue('item2.jpg', pool, url => completed.push(url));
  queue.enqueue('item3.jpg', pool, url => completed.push(url));

  // Wait a small tick for async decode to progress
  await new Promise(r => setTimeout(r, 60));

  assert.deepEqual(completed, ['item1.jpg', 'item2.jpg', 'item3.jpg']);
  assert.equal(pool.has('item1.jpg'), true);
  assert.equal(pool.has('item2.jpg'), true);
  assert.equal(pool.has('item3.jpg'), true);
  assert.equal(queue.isBusy(), false);
});

test('PreloadQueue pause halts processing until resume is called', async () => {
  const { context } = createSandbox();
  const pool = context.ImagePool.create(5);
  const queue = context.PreloadQueue.create();

  const completed = [];
  queue.pause();
  queue.enqueue('p1.jpg', pool, url => completed.push(url));
  queue.enqueue('p2.jpg', pool, url => completed.push(url));

  await new Promise(r => setTimeout(r, 30));
  assert.equal(completed.length, 0, 'no items should complete while paused');
  assert.equal(queue.isBusy(), true);

  queue.resume();
  await new Promise(r => setTimeout(r, 60));
  assert.deepEqual(completed, ['p1.jpg', 'p2.jpg']);
  assert.equal(queue.isBusy(), false);
});
