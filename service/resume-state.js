'use strict';
exports.start = function (service, fs, launch, log, enabled) {
  var file = '/var/lib/lg-c5-home/last-screen.json';
  var desktop = 'com.gathin.tvhome';
  var saved = null, committed = null, foreground = null, writes = 0;
  var phase = 'boot', powerRequest = null, operation = null, attempts = 0;
  try { saved = committed = JSON.parse(fs.readFileSync(file, 'utf8')).appId; } catch (error) {}
  function persist() {
    if (!saved || saved === committed || writes >= 3) return;
    writes++;
    try {
      fs.writeFileSync(file + '.tmp', JSON.stringify({ appId: saved }), { mode: 384 });
      fs.renameSync(file + '.tmp', file);
      committed = saved;
      log('remember screen: ' + saved);
    } catch (error) { log('remember screen failed: ' + error.message); }
  }
  function remember(id) {
    if (!id) return;
    if (id !== saved) { saved = id; writes = 0; }
    persist();
  }
  function invalidate() {
    if (operation) clearTimeout(operation.timer);
    operation = null;
  }
  function restore() {
    if (attempts >= 3) { phase = 'failed'; return; }
    attempts++;
    phase = 'restoring';
    var current = {};
    operation = current;
    function valid() { return operation === current && enabled(); }
    function finish(ok) {
      if (!valid()) return;
      invalidate();
      phase = ok ? 'active' : 'sleep';
    }
    current.timer = setTimeout(function () {
      if (!valid()) return;
      log('restore operation timed out'); finish(false);
    }, 6000);
    service.call('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (result) {
      if (!valid()) return;
      var data = result && result.payload;
      if (!data || data.returnValue !== true) { finish(false); return; }
      foreground = data.appId;
      var safe = !foreground || foreground === desktop || foreground === 'com.webos.app.home' || /^com\.webos\.app\.hdmi[1-4]$/.test(foreground) || foreground === 'com.webos.app.livetv';
      if (saved === desktop && safe) {
        launch('restore-last-desktop', function (ok) {
          if (!valid()) return;
          if (ok) foreground = desktop;
          finish(ok);
        });
      } else { remember(foreground); finish(true); }
    });
  }
  service._resumeForeground = service.subscribe('luna://com.webos.applicationManager/getForegroundAppInfo', { subscribe: true });
  service._resumeForeground.on('response', function (response) {
    var data = response && response.payload;
    if (!data || data.returnValue !== true || !data.appId) return;
    foreground = data.appId;
    if (phase === 'active') remember(foreground);
  });
  function poll() {
    if (!enabled()) { invalidate(); return; }
    persist();
    if (powerRequest) return;
    var request = {};
    powerRequest = request;
    request.timer = setTimeout(function () { if (powerRequest === request) powerRequest = null; }, 4000);
    service.call('luna://com.webos.service.tvpower/power/getPowerState', {}, function (response) {
      if (powerRequest !== request) return;
      clearTimeout(request.timer); powerRequest = null;
      if (!enabled()) { invalidate(); return; }
      var power = response && response.payload;
      if (!power || power.returnValue !== true) return;
      if (power.state !== 'Active' || /power off|suspend/i.test(power.processing || '')) {
        if (phase !== 'sleep') log('freeze screen: ' + saved + ' power=' + power.state);
        invalidate(); phase = 'sleep'; attempts = 0; return;
      }
      if (phase === 'active' || phase === 'restoring' || phase === 'failed') return;
      restore();
    });
  }
  poll(); setInterval(poll, 1000);
  return function () { return { phase: phase, lastScreen: saved, persistedScreen: committed, persistencePending: saved !== committed }; };
};
