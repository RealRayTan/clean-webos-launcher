'use strict';
var fs = require('fs');
var Service = require('webos-service');
if (process.argv.indexOf('--disable-timeouts') < 0) process.argv.push('--disable-timeouts');
var service = new Service('com.gathin.tvhome.service');
var APP = 'com.gathin.tvhome';
var LOG = '/tmp/lg-c5-home.log';
var disabled = '/var/lib/lg-c5-home/disabled';
var systemHome = '/var/lib/lg-c5-home/system-home';
var lastLaunch = 0;
var keyDown = 0, backDown = 0, backTimer = 0;
var inputFiles = [];
function isSystemHome() { return fs.existsSync(systemHome); }
function target() { return APP; }
function handleHome(code, value, source) {
  if (code !== 773 && code !== 102) return;
  if (isSystemHome()) {
    if (keyDown && Date.now() - keyDown > 6000) keyDown = 0;
    if (value === 1 && !keyDown) keyDown = Date.now();
    if (value === 0 && keyDown) {
      var homeDuration = Date.now() - keyDown; keyDown = 0;
      if (homeDuration < 650) setTimeout(function () {
        if (!enabled()) return;
        launch('home-tap-' + source);
      }, source === 'native' ? 0 : 40);
    }
    return;
  }
  log('home event ' + source + ' code=' + code + ' value=' + value);
  if (keyDown && Date.now() - keyDown > 6000) keyDown = 0;
  if (value === 1 && !keyDown) keyDown = Date.now();
  if (value === 0 && keyDown) {
    var duration = Date.now() - keyDown; keyDown = 0;
    if (duration < 650) setTimeout(function () { launch('home-tap-' + source); }, source === 'native' ? 0 : 40);
    else if (source === 'native') {
      if (returnOrigin) returnOrigin.cancel();
      service.call('luna://com.webos.applicationManager/launch', { id:'com.webos.app.home' }, function (result) { log('home-hold native: ' + JSON.stringify(result && result.payload)); });
    } else log('home-hold: leave native Home');
  }
}
function handleBack(value, source) {
  if (value === 1 && !backDown) {
    backDown = Date.now();
    clearTimeout(backTimer);
    backTimer = setTimeout(function () {
      if (!backDown || Date.now() - backDown < 650) return;
      backDown = 0;
      service.call('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (response) {
        var payload = response && response.payload;
        if (!enabled()) return;
        var id = payload && payload.returnValue === true ? payload.appId : '';
        if (id === target()) return;
        log('back-hold escape: ' + (id || 'empty'));
        launch('back-hold');
      });
    }, 650);
  } else if (value === 0 && backDown) {
    var shortDuration = Date.now() - backDown;
    clearTimeout(backTimer); backTimer = 0; backDown = 0;
    if (shortDuration < 650 && isSystemHome()) {
      service.call('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (response) {
        var payload = response && response.payload;
        if (!enabled() || !payload || payload.returnValue !== true) return;
        var id = payload.appId;
        if (!id || !/^com\.webos\.app\.(hdmi[1-4]|livetv)$/.test(id)) return;
        log('back-tap input: ' + id);
        launch('back-tap');
      });
    }
  }
}
function handleKey(code, value, source) {
  if (code === 158) { handleBack(value, source); return; }
  handleHome(code, value, source);
}
function log(message) { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + message + '\n'); }
function enabled() { return !fs.existsSync(disabled); }
function launch(reason, done) {
  if (!enabled() || (reason !== 'return-from-app' && Date.now() - lastLaunch < 800)) { if (done) done(false); return; }
  lastLaunch = Date.now();
  var finished = false;
  var timeout = setTimeout(function () { if (!finished) { finished = true; log(reason + ': timeout'); if (done) done(false); } }, 4000);
  service.call('luna://com.webos.applicationManager/launch', { id: target() }, function (response) {
    if (finished) return;
    finished = true; clearTimeout(timeout);
    var result = response && response.payload;
    log(reason + ': ' + JSON.stringify(result));
    if (done) done(!!result && result.returnValue === true);
  });
}
service.register('status', function (message) {
  message.respond({ returnValue: true, pid: process.pid, root: process.getuid() === 0, enabled: enabled(), mode: isSystemHome() ? 'system-home' : 'helper-home', target: target(), inputDevices: inputFiles.length, startupMode: 'remember-desktop-or-input', resume: resumeStatus(), returnOrigin: returnOrigin.status() });
});
service.register('open', function (message) { launch('requested'); message.respond({ returnValue: true }); });
service.register('closeApp', function (message) {
  var allowed = ['com.webos.app.screensaver', 'com.gathin.tvhome', 'com.webos.app.home'];
  if (message.sender && allowed.indexOf(message.sender) < 0) return message.respond({ returnValue: false, errorText: 'Caller not allowed' });
  var id = message.payload && message.payload.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(id)) return message.respond({ returnValue: false, errorText: 'Invalid app id' });
  service.call('luna://com.webos.applicationManager/closeByAppId', { id: id }, function (response) {
    var payload = response && response.payload;
    if (payload && payload.returnValue) return message.respond({ returnValue: true, response: payload });
    service.call('luna://com.webos.applicationManager/close', { id: id }, function (resp2) {
      var p2 = resp2 && resp2.payload;
      message.respond({ returnValue: !!(p2 && p2.returnValue), response: p2 });
    });
  });
});
require('./app-catalog').register(service);
require('./app-state').register(service);
try { require('./public-content').register(service); } catch (error) { log('content unavailable: ' + error.message); }

// Read events without grabbing them: every native button remains available.
// HOME release opens our app; a hold leaves LG's original Home available.
function readInputs() {
  fs.readdirSync('/dev/input').filter(function (name) { return /^event\d+$/.test(name); }).forEach(function (name) {
    try { inputFiles.push({ name: name, fd: fs.openSync('/dev/input/' + name, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK) }); }
    catch (error) { log('skip ' + name + ': ' + error.code); }
  });
  var eventSize = process.arch === 'arm64' || process.arch === 'x64' ? 24 : 16;
  var typeOffset = eventSize - 8;
  var buffer = Buffer.alloc(eventSize * 64);
  setInterval(function () {
    inputFiles.forEach(function (device) {
      var length;
      try { length = fs.readSync(device.fd, buffer, 0, buffer.length, null); }
      catch (error) { return; }
      for (var offset = 0; offset + eventSize <= length; offset += eventSize) {
        if (buffer.readUInt16LE(offset + typeOffset) !== 1) continue;
        var code = buffer.readUInt16LE(offset + typeOffset + 2);
        var value = buffer.readInt32LE(offset + typeOffset + 4);
        handleKey(code, value, device.name);
      }
    });
  }, 50);
}

log('start pid=' + process.pid + ' root=' + (process.getuid() === 0));
readInputs();
try { require('./native-home').start(handleHome, log); } catch (error) { log('native fallback: ' + error.message); }

var resumeStatus = require('./resume-state').start(service, fs, launch, log, enabled, isSystemHome);

var returnOrigin = require('./return-origin').start(service, launch, enabled, function () { return resumeStatus().phase === 'active'; }, log, isSystemHome);
