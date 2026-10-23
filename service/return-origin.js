'use strict';
exports.start = function (service, launch, enabled, active, log, isSystemHome) {
  // The system-home copy already owns the exit destination; relaunching here would duplicate it.
  if (typeof isSystemHome === 'function' && isSystemHome()) {
    return { cancel: function () {}, status: function () { return { app: null }; } };
  }
  var desktop = 'com.gathin.tvhome', nativeHome = 'com.webos.app.home';
  var foreground = null, session = null;
  function cancel() {
    if (session && session.timer) clearTimeout(session.timer);
    session = null;
  }
  function contentApp(id) {
    return id !== desktop && id !== nativeHome && id !== 'com.palm.app.settings' &&
      id !== 'com.webos.app.settings' && id !== 'com.webos.app.livetv' && !/^com\.webos\.app\.hdmi[1-4]$/.test(id);
  }
  service._returnForeground = service.subscribe('luna://com.webos.applicationManager/getForegroundAppInfo', { subscribe: true });
  service._returnForeground.on('response', function (response) {
    var data = response && response.payload;
    if (!data || data.returnValue !== true || !data.appId || data.appId === foreground) return;
    var previous = foreground;
    foreground = data.appId;
    if (!enabled() || !active()) { cancel(); return; }
    if (foreground === desktop) { cancel(); return; }
    if (previous === desktop && contentApp(foreground)) {
      cancel(); session = { app: foreground };
      log('return origin: desktop -> ' + foreground); return;
    }
    if (session && previous === session.app && foreground === nativeHome) {
      var owner = session;
      owner.timer = setTimeout(function () { if (session === owner) cancel(); }, 1500);
      service.call('luna://com.webos.service.tvpower/power/getPowerState', {}, function (result) {
        if (session !== owner) return;
        cancel();
        var power = result && result.payload;
        if (!enabled() || !active() || foreground !== nativeHome || !power || power.returnValue !== true ||
            power.state !== 'Active' || /power off|suspend/i.test(power.processing || '')) return;
        launch('return-from-app');
      });
      return;
    }
    cancel();
  });
  return { cancel: cancel, status: function () { return { app: session ? session.app : null }; } };
};
