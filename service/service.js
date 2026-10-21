'use strict';
var fs = require('fs');
var Service = require('webos-service');
if (process.argv.indexOf('--disable-timeouts') < 0) process.argv.push('--disable-timeouts');
var service = new Service('com.gathin.tvhome.service');
var APP = 'com.gathin.tvhome';
var LOG = '/tmp/lg-c5-home.log';
var disabled = '/var/lib/lg-c5-home/disabled';
var lastLaunch = 0;
var keyDown = 0;
var inputFiles = [];
function handleHome(code, value, source) {
  if (code !== 773 && code !== 102) return;
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
function log(message) { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + message + '\n'); }
function enabled() { return !fs.existsSync(disabled); }
function launch(reason, done) {
  if (!enabled() || (reason !== 'return-from-app' && Date.now() - lastLaunch < 800)) { if (done) done(false); return; }
  lastLaunch = Date.now();
  var finished = false;
  var timeout = setTimeout(function () { if (!finished) { finished = true; log(reason + ': timeout'); if (done) done(false); } }, 4000);
  service.call('luna://com.webos.applicationManager/launch', { id: APP }, function (response) {
    if (finished) return;
    finished = true; clearTimeout(timeout);
    var result = response && response.payload;
    log(reason + ': ' + JSON.stringify(result));
    if (done) done(!!result && result.returnValue === true);
  });
}
service.register('status', function (message) {
  message.respond({ returnValue: true, pid: process.pid, root: process.getuid() === 0, enabled: enabled(), inputDevices: inputFiles.length, startupMode: 'remember-desktop-or-input', resume: resumeStatus(), returnOrigin: returnOrigin.status() });
});
service.register('open', function (message) { launch('requested'); message.respond({ returnValue: true }); });

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
        handleHome(code, value, device.name);
      }
    });
  }, 50);
}

log('start pid=' + process.pid + ' root=' + (process.getuid() === 0));
readInputs();
try { require('./native-home').start(handleHome, log); } catch (error) { log('native fallback: ' + error.message); }

var resumeStatus = require('./resume-state').start(service, fs, launch, log, enabled);

var returnOrigin = require('./return-origin').start(service, launch, enabled, function () { return resumeStatus().phase === 'active'; }, log);
