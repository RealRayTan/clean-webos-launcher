'use strict';
var fs = require('fs');
var child_process = require('child_process');

function readMemAvailable() {
  try {
    var content = fs.readFileSync('/proc/meminfo', 'utf8');
    var match = content.match(/MemAvailable:\s+(\d+)\s+kB/);
    if (match) return Math.round(parseInt(match[1], 10) / 1024);
    var freeMatch = content.match(/MemFree:\s+(\d+)\s+kB/);
    var bufMatch = content.match(/Buffers:\s+(\d+)\s+kB/);
    var cacheMatch = content.match(/Cached:\s+(\d+)\s+kB/);
    var total = 0;
    if (freeMatch) total += parseInt(freeMatch[1], 10);
    if (bufMatch) total += parseInt(bufMatch[1], 10);
    if (cacheMatch) total += parseInt(cacheMatch[1], 10);
    return Math.round(total / 1024);
  } catch (err) {
    return 0;
  }
}

function clearMemory(callback) {
  var before = readMemAvailable();
  child_process.exec('sync; echo 3 > /proc/sys/vm/drop_caches; echo 1 > /proc/sys/vm/compact_memory 2>/dev/null', function (error) {
    var after = readMemAvailable();
    var freed = Math.max(0, after - before);
    if (typeof callback === 'function') {
      callback({
        returnValue: !error,
        beforeMb: before,
        afterMb: after,
        freedMb: freed,
        error: error ? error.message : null
      });
    }
  });
}

exports.readMemAvailable = readMemAvailable;
exports.clearMemory = clearMemory;

exports.start = function (service, log, isSystemHome, customOptions) {
  var opts = customOptions || {};
  var idleThresholdMs = opts.idleThresholdMs || (5 * 60 * 1000);
  var cooldownMs = opts.cooldownMs || (15 * 60 * 1000);
  var checkIntervalMs = opts.checkIntervalMs || (60 * 1000);

  var lastInputTime = Date.now();
  var lastCleanTime = 0;
  var timer = null;

  function isSafeForeground(appId) {
    if (!appId || appId === 'com.webos.app.screensaver') return true;
    if (appId === 'com.gathin.tvhome' || appId === 'com.webos.app.home') return true;
    return false;
  }

  function checkIdleAndClean() {
    var now = Date.now();
    if (now - lastInputTime < idleThresholdMs) return;
    if (now - lastCleanTime < cooldownMs) return;

    service.call('luna://com.webos.service.applicationmanager/getForegroundAppInfo', {}, function (response) {
      var payload = response && response.payload;
      var currentApp = payload && payload.returnValue === true ? payload.appId : '';
      if (!isSafeForeground(currentApp)) {
        if (typeof log === 'function') log('ram-manager: skip idle clean (foreground: ' + (currentApp || 'unknown') + ')');
        return;
      }
      if (typeof log === 'function') log('ram-manager: triggering idle auto-clean (idle for ' + Math.round((now - lastInputTime) / 1000) + 's)');
      lastCleanTime = Date.now();
      clearMemory(function (result) {
        if (typeof log === 'function') log('ram-manager: idle clean finished -> freed ' + result.freedMb + ' MiB, avail ' + result.afterMb + ' MiB');
      });
    });
  }

  timer = setInterval(checkIdleAndClean, checkIntervalMs);

  service.register('cleanRam', function (message) {
    lastCleanTime = Date.now();
    clearMemory(function (result) {
      if (typeof log === 'function') log('ram-manager: manual clean -> freed ' + result.freedMb + ' MiB, avail ' + result.afterMb + ' MiB');
      message.respond(result);
    });
  });

  service.register('ramInfo', function (message) {
    message.respond({
      returnValue: true,
      availableMb: readMemAvailable(),
      lastCleanTime: lastCleanTime,
      lastInputTime: lastInputTime
    });
  });

  return {
    recordInput: function () {
      lastInputTime = Date.now();
    },
    clearMemory: clearMemory,
    readMemAvailable: readMemAvailable,
    checkIdleAndClean: checkIdleAndClean,
    stop: function () {
      if (timer) clearInterval(timer);
    }
  };
};
