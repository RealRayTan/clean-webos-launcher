'use strict';
exports.start = function (service, launch, enabled, active, log, isSystemHome) {
  var desktop = 'com.gathin.tvhome', nativeHome = 'com.webos.app.home';
  var foreground = null, session = null;
  function systemHomeActive() {
    return typeof isSystemHome === 'function' && isSystemHome();
  }
  function isDesktop(id) {
    if (systemHomeActive()) return id === desktop || id === nativeHome || id === '';
    return id === desktop;
  }
  function cancel() {
    if (session && session.timer) clearTimeout(session.timer);
    session = null;
  }
  function contentApp(id) {
    return !!id && !isDesktop(id) && id !== nativeHome && id !== 'com.webos.app.screensaver' &&
      id !== 'com.palm.app.settings' && id !== 'com.webos.app.settings' &&
      id !== 'com.webos.app.livetv' && !/^com\.webos\.app\.hdmi[1-4]$/.test(id);
  }
  var subTimer = null;
  function handleForeground(response) {
    var data = response && response.payload;
    log('fg-event: ' + JSON.stringify(data));
    if (!data || data.returnValue !== true) {
      if (!subTimer) subTimer = setTimeout(connect, 2000);
      return;
    }
    var nextApp = typeof data.appId === 'string' ? data.appId : '';
    if (nextApp === foreground) return;
    var previous = foreground;
    foreground = nextApp;
    if (!enabled() || !active()) { cancel(); return; }
    if (isDesktop(previous) && contentApp(foreground)) {
      cancel(); session = { app: foreground };
      log('return origin: desktop -> ' + foreground); return;
    }
    var shouldReturn = false;
    if (session && previous === session.app) {
      shouldReturn = !contentApp(foreground);
    }
    if (shouldReturn) {
      var owner = session;
      owner.timer = setTimeout(function () { if (session === owner) cancel(); }, 1500);
      service.call('luna://com.webos.service.tvpower/power/getPowerState', {}, function (result) {
        if (session !== owner) return;
        cancel();
        var power = result && result.payload;
        var sleeping = !power || power.returnValue !== true ||
          /suspend|standby|power off/i.test(power.state || '') ||
          /power off|suspend/i.test(power.processing || '');
        if (!enabled() || !active() || sleeping) return;
        launch('return-from-app');
      });
      return;
    }
    if (isDesktop(foreground)) { cancel(); return; }
    cancel();
  }
  function connect() {
    if (subTimer) { clearTimeout(subTimer); subTimer = null; }
    service._returnForeground = service.subscribe('luna://com.webos.applicationManager/getForegroundAppInfo', { subscribe: true });
    service._returnForeground.on('response', handleForeground);
  }
  connect();
  return { cancel: cancel, status: function () { return { app: session ? session.app : null }; } };
};
