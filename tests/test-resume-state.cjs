const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function scenario(saved, current = 'com.webos.app.hdmi4', isSystemHome = () => false) {
  let power = { returnValue: true, state: 'Active' }, foreground = current, tick, stored = saved;
  const subscriptions = {};
  const launches = [], module = { exports: {} };
  const disk = {
    readFileSync: () => JSON.stringify({ appId: saved }),
    writeFileSync: (file, data) => { stored = JSON.parse(data).appId; }, renameSync() {}
  };
  function notifySub(uri, payload) {
    if (subscriptions[uri]) subscriptions[uri]({ payload });
    Object.keys(subscriptions).forEach(key => {
      if (key.includes(uri)) subscriptions[key]({ payload });
    });
  }
  const service = {
    subscribe(uri) {
      return {
        on(event, callback) {
          subscriptions[uri] = callback;
          if (uri.includes('getForegroundAppInfo')) callback({ payload: { returnValue: true, appId: foreground } });
          else if (uri.includes('getPowerState')) callback({ payload: power });
        }
      };
    },
    call(uri, args, callback) {
      if (args && args.subscribe) {
        subscriptions[uri] = callback;
        if (uri.includes('getForegroundAppInfo')) callback({ payload: { returnValue: true, appId: foreground } });
        else if (uri.includes('getPowerState')) callback({ payload: power });
      } else {
        callback({ payload: uri.includes('getPowerState') ? power : { returnValue: true, appId: foreground } });
      }
    }
  };
  vm.runInNewContext(fs.readFileSync('service/resume-state.js', 'utf8'), {
    exports: module.exports, setInterval: fn => { tick = fn; }, setTimeout: () => 1, clearTimeout() {}
  });
  const status = module.exports.start(service, disk, (reason, done) => { launches.push(reason); foreground = 'com.gathin.tvhome'; done(true); }, () => {}, () => true, isSystemHome);
  return { launches, status, saved: () => stored,
    foreground(id) {
      foreground = id;
      notifySub('getForegroundAppInfo', { returnValue: true, appId: id });
    },
    power(state, processing) {
      power = { returnValue: true, state, processing };
      notifySub('getPowerState', power);
      if (tick) tick();
    }
  };
}
test('HDMI at shutdown stays on HDMI after wake', () => {
  const s = scenario('com.webos.app.hdmi4'); s.power('Active Standby'); s.power('Active');
  assert.equal(s.launches.length, 0); assert.equal(s.saved(), 'com.webos.app.hdmi4');
});
test('HDMI with transient empty foreground or screensaver during shutdown in system-home mode stays on HDMI after wake', () => {
  const s = scenario('com.webos.app.hdmi4', 'com.webos.app.hdmi4', () => true);
  s.foreground('');
  s.foreground('com.webos.app.screensaver');
  s.power('Suspend');
  s.power('Active');
  assert.equal(s.launches.length, 0);
  assert.equal(s.saved(), 'com.webos.app.hdmi4');
});
test('HDMI with transient system home during shutdown or signal drop stays on HDMI after wake', () => {
  const s = scenario('com.webos.app.hdmi4', 'com.webos.app.hdmi4', () => true);
  s.foreground('com.webos.app.home');
  s.power('Suspend');
  s.power('Active');
  assert.equal(s.launches.length, 0);
  assert.equal(s.saved(), 'com.webos.app.hdmi4');
});
test('deliberate user navigation to desktop in system-home mode updates saved state', () => {
  const s = scenario('com.webos.app.hdmi4', 'com.webos.app.hdmi4', () => true);
  s.status.setDesktop();
  s.power('Suspend');
  s.power('Active');
  assert.equal(s.launches.length, 1);
  assert.equal(s.saved(), 'com.webos.app.home');
});
test('desktop at shutdown restores once despite HDMI notifications while asleep', () => {
  const s = scenario('com.webos.app.hdmi4'); s.foreground('com.gathin.tvhome');
  s.power('Active', 'Request Power Off Logo'); s.foreground('com.webos.app.hdmi4');
  s.power('Suspend'); s.power('Active'); s.power('Active');
  assert.deepEqual(s.launches, ['restore-last-desktop']); assert.equal(s.saved(), 'com.gathin.tvhome');
});
test('persisted desktop restores on a new helper process after boot', () => {
  const s = scenario('com.gathin.tvhome'); assert.equal(s.launches.length, 1);
});
test('an already opened content app is not interrupted by desktop restoration', () => {
  const s = scenario('com.gathin.tvhome', 'com.biliwebos.app');
  assert.equal(s.launches.length, 0); assert.equal(s.saved(), 'com.biliwebos.app');
});
