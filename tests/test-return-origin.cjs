const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/../service/return-origin.js', 'utf8');
function scenario(isSystemHome) {
  let notify, powerReply, pending, isActive = true;
  const module = {}, launches = [];
  vm.runInNewContext(source, { exports: module,
    setTimeout(fn) { pending = fn; return 1; }, clearTimeout() { pending = null; }
  });
  const service = {
    subscribe() { return { on(event, fn) { notify = fn; } }; },
    call(uri, args, fn) { powerReply = fn; }
  };
  const control = module.start(service, reason => launches.push(reason), () => true, () => isActive, () => {}, isSystemHome);
  return { launches, control,
    show(appId) { notify({ payload: { returnValue: true, appId } }); },
    power(state = 'Active') { if (powerReply) powerReply({ payload: { returnValue: true, state } }); },
    expire() { if (pending) pending(); }, sleep() { isActive = false; }
  };
}
const desktop = 'com.gathin.tvhome', home = 'com.webos.app.home', bili = 'com.biliwebos.app';
test('exit target follows launcher origin; explicit Home, sleep and stale replies are respected', () => {
  const custom = scenario(); custom.show(desktop); custom.show(bili); custom.show(home); custom.power();
  assert.deepEqual(custom.launches, ['return-from-app']);
  const native = scenario(); native.show(home); native.show(bili); native.show(home); native.power();
  assert.equal(native.launches.length, 0);
  const heldHome = scenario(); heldHome.show(desktop); heldHome.show(bili); heldHome.control.cancel(); heldHome.show(home); heldHome.power();
  assert.equal(heldHome.launches.length, 0);
  const sleeping = scenario(); sleeping.show(desktop); sleeping.show(bili); sleeping.show(home); sleeping.sleep(); sleeping.power('Suspend');
  assert.equal(sleeping.launches.length, 0);
  const stale = scenario(); stale.show(desktop); stale.show(bili); stale.show(home); stale.expire(); stale.power();
  assert.equal(stale.launches.length, 0);
  const input = scenario(); input.show(desktop); input.show('com.webos.app.hdmi4'); input.show(home); input.power();
  assert.equal(input.launches.length, 0);
});

test('system-home mode returns to mounted home after content app exit to input or home', () => {
  const fromHomeToInput = scenario(() => true);
  fromHomeToInput.show(home); fromHomeToInput.show(bili); fromHomeToInput.show('com.webos.app.hdmi4'); fromHomeToInput.power();
  assert.deepEqual(fromHomeToInput.launches, ['return-from-app']);

  const fromHomeToHome = scenario(() => true);
  fromHomeToHome.show(home); fromHomeToHome.show(bili); fromHomeToHome.show(home); fromHomeToHome.power();
  assert.deepEqual(fromHomeToHome.launches, ['return-from-app']);

  const fromHdmi = scenario(() => true);
  fromHdmi.show('com.webos.app.hdmi4'); fromHdmi.show(bili); fromHdmi.show('com.webos.app.hdmi4'); fromHdmi.power();
  assert.equal(fromHdmi.launches.length, 0);

  const switchApp = scenario(() => true);
  switchApp.show(home); switchApp.show(bili); switchApp.show('youtube.leanback.v4');
  assert.equal(switchApp.launches.length, 0);
});
