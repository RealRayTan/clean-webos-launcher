const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/../service/service.js', 'utf8');
function scenario() {
  let now = 100000, pending = [], events = [], nativeKey;
  const launched = [], methods = {}, intervals = [];
  class FakeDate extends Date { constructor() { super(now); } static now() { return now; } }
  const storage = {
    constants: { O_RDONLY: 0, O_NONBLOCK: 2048 }, appendFileSync() {}, existsSync() { return false; },
    readdirSync() { return ['event0']; }, openSync() { return 3; },
    readSync(fd, buffer) {
      if (!events.length) throw Object.assign(new Error(), { code: 'EAGAIN' });
      const [code, value] = events.shift(); buffer.fill(0);
      buffer.writeUInt16LE(1, 8); buffer.writeUInt16LE(code, 10); buffer.writeInt32LE(value, 12); return 16;
    }
  };
  function Service() {
    this.register = (name, method) => { methods[name] = method; };
    this.call = (uri, payload, callback) => {
      if (uri.endsWith('/launch')) { launched.push(payload.id); callback({ payload: { returnValue: true } }); }
    };
  }
  vm.runInNewContext(source, {
    require: name => name === 'fs' ? storage : (name === './app-catalog' || name === './public-content' || name === './app-state') ? { register() {} } : name === './return-origin' ? { start: () => ({ cancel() {}, status: () => ({}) }) } : name === './resume-state' ? { start: () => () => ({}) } : name === './native-home' ? { start: handler => { nativeKey = handler; } } : Service,
    process: { argv: ['node', 'service.js', '--boot'], arch: 'arm', pid: 42, getuid: () => 0 }, Buffer, Date: FakeDate,
    setInterval: (fn, ms) => intervals.push({ fn, ms }),
    setTimeout: (fn, ms) => { const task = { fn, ms }; pending.push(task); return task; },
    clearTimeout: task => { pending = pending.filter(item => item !== task); }
  });
  return {
    launched,
    input(code, value, elapsed = 0) { now += elapsed; events.push([code, value]); intervals.find(x => x.ms === 50).fn(); },
    advance(elapsed) { now += elapsed; intervals.forEach(timer => timer.fn()); },
    native(value, elapsed = 0) { now += elapsed; nativeKey(773, value, 'native'); },
    flush() { const tasks = pending; pending = []; tasks.forEach(task => task.fn()); }
  };
}
test('short Home tap opens the custom launcher', () => {
  const s = scenario(); s.input(773, 1); s.input(773, 0, 150); s.flush();
  assert.deepEqual(s.launched, ['com.gathin.tvhome']);
});
test('holding Home leaves the native Home available', () => {
  const s = scenario(); s.input(773, 1); s.input(773, 0, 900); s.flush(); assert.equal(s.launched.length, 0);
});
test('ordinary directional navigation does not launch anything', () => {
  const s = scenario(); s.input(103, 1); s.input(103, 0, 100); s.flush(); assert.equal(s.launched.length, 0);
});
test('starting the helper at boot does not open an app', () => {
  const s = scenario(); s.flush(); assert.equal(s.launched.length, 0);
});
test('resuming after a long standby leaves the current HDMI input alone', () => {
  const s = scenario(); s.advance(60000); s.flush(); assert.equal(s.launched.length, 0);
});
test('native short Home requests only the custom desktop', () => {
  const s = scenario(); s.native(1); s.native(0, 150); s.flush();
  assert.deepEqual(s.launched, ['com.gathin.tvhome']);
});
test('native long Home requests only the original Home', () => {
  const s = scenario(); s.native(1); s.native(0, 900); s.flush();
  assert.deepEqual(s.launched, ['com.webos.app.home']);
});
