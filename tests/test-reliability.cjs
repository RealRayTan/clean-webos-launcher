const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const root = require('node:path').resolve(__dirname, '..');
function restoreHarness(options = {}) {
  let tick, subscriber, foregroundReply, power = 'Active', disk = 'com.gathin.tvhome';
  let failRename = !!options.failRename, temporary;
  const launched = [], timers = new Map(), module = {};
  let timerId = 0;
  vm.runInNewContext(fs.readFileSync(root + '/service/resume-state.js', 'utf8'), {
    exports: module, setInterval: fn => { tick = fn; },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const service = {
    subscribe() { return { on(event, cb) { subscriber = cb; } }; },
    call(uri, args, cb) {
      if (uri.endsWith('getPowerState')) cb({ payload: { returnValue: true, state: power } });
      else foregroundReply = cb;
    }
  };
  const storage = {
    readFileSync: () => JSON.stringify({ appId: disk }),
    writeFileSync(file, data) { temporary = JSON.parse(data).appId; },
    renameSync() { if (failRename) { failRename = false; throw new Error('temporary failure'); } disk = temporary; }
  };
  const status = module.start(service, storage, (reason, done) => { launched.push(reason); done(true); }, () => {}, () => true);
  return { status, launched, disk: () => disk, tick: () => tick(),
    power(value) { power = value; tick(); },
    reply() { foregroundReply({ payload: { returnValue: true, appId: 'com.webos.app.hdmi4' } }); },
    screen(id) { subscriber({ payload: { returnValue: true, appId: id } }); },
    expire() { for (const [id, timer] of [...timers]) if (timer.ms === 6000) { timers.delete(id); timer.fn(); } }
  };
}
test('missing and late replies cannot leave recovery stuck or launch while asleep', () => {
  const s = restoreHarness(); s.expire(); assert.equal(s.status().phase, 'sleep');
  s.tick(); s.power('Suspend'); s.reply();
  assert.equal(s.status().phase, 'sleep'); assert.equal(s.launched.length, 0);
  s.power('Active'); s.reply(); assert.equal(s.status().phase, 'active'); assert.equal(s.launched.length, 1);
});
test('failed persistence retries and reports only the committed disk state', () => {
  const s = restoreHarness({ failRename: true }); s.reply();
  s.screen('com.webos.app.hdmi4');
  assert.equal(s.status().persistencePending, true); assert.equal(s.disk(), 'com.gathin.tvhome');
  s.tick(); assert.equal(s.disk(), 'com.webos.app.hdmi4'); assert.equal(s.status().persistencePending, false);
});
test('native adapter reclaims abandoned socket but leaves live owner and lease intact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-c5-fixed-'));
  const socket = path.join(dir, 'events.sock');
  let adapter;
  try {
    const child = spawn(process.execPath, ['-e', 'require("net").createServer().listen(process.argv[1],()=>process.stdout.write("ready"))', socket]);
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGKILL'); await exited;
    const storage = Object.assign({}, fs, {
      existsSync: file => file.endsWith('/native-enabled') || fs.existsSync(file),
      readdirSync: file => file === '/proc' ? [] : fs.readdirSync(file)
    });
    const source = fs.readFileSync(root + '/service/native-home.js', 'utf8').replace("'/tmp/homeback-remote-ipc'", JSON.stringify(dir));
    const mod = { exports: {} }, intervals = [];
    let listening;
    const ready = new Promise(resolve => { listening = resolve; });
    vm.runInNewContext(source, { module: mod, __dirname: root,
      require: name => name === 'fs' ? storage : name === 'net' ? Object.assign({}, net, {
        createServer(fn) { adapter = net.createServer(fn); adapter.once('listening', listening); return adapter; }
      }) : {},
      process: { on() {} }, setInterval: fn => intervals.push(fn)
    });
    mod.exports.start(() => {}, () => {});
    await Promise.race([ready, new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('no recovered listener')), 2000); t.unref(); })]);
    assert.equal(adapter.listening, true);
    fs.writeFileSync(path.join(dir, 'lease'), 'live-owner');
    const second = { exports: {} }, otherIntervals = [];
    vm.runInNewContext(source, { module: second, __dirname: root,
      require: name => name === 'fs' ? storage : name === 'net' ? net : {},
      process: { on() {} }, setInterval: fn => otherIntervals.push(fn)
    });
    second.exports.start(() => {}, () => {});
    await new Promise(resolve => setTimeout(resolve, 30)); otherIntervals.forEach(fn => fn());
    assert.equal(fs.readFileSync(path.join(dir, 'lease'), 'utf8'), 'live-owner');
  } finally {
    if (adapter) await new Promise(resolve => adapter.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('disable persists even when helper status is unavailable', () => {
  const python = `import sys,types,runpy
m=types.ModuleType('tv_control');commands=[]
def unavailable(*a,**kw): raise RuntimeError('unavailable')
def remote(cmd):
 commands.append(cmd); return types.SimpleNamespace(returncode=0,stderr=b'')
m.call=unavailable;m.remote=remote;sys.modules['tv_control']=m
sys.argv=[sys.argv[1],'off'];runpy.run_path(sys.argv[0],run_name='__main__')
assert 'touch /var/lib/lg-c5-home/disabled' in commands[0]
assert '/tmp/homeback-remote-ipc/lease' in commands[0]
`;
  const result = spawnSync('python3', ['-c', python, root + '/tools/desktop_mode.py'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
