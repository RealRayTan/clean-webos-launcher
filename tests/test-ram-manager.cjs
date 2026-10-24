const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ramManager = require('../service/ram-manager');

test('readMemAvailable parses meminfo or calculates fallback', () => {
  const sampleMeminfo = `
MemTotal:        1971200 kB
MemFree:           51200 kB
MemAvailable:     768000 kB
Buffers:           10240 kB
Cached:           204800 kB
`;
  const origRead = fs.readFileSync;
  try {
    fs.readFileSync = (file) => (file === '/proc/meminfo' ? sampleMeminfo : origRead(file));
    const avail = ramManager.readMemAvailable();
    assert.equal(avail, 750, '768000 kB should be ~750 MiB');
  } finally {
    fs.readFileSync = origRead;
  }
});

test('ramManager start registers cleanRam and ramInfo on service', (t, done) => {
  const registered = {};
  const service = {
    register(name, fn) {
      registered[name] = fn;
    },
    call(uri, args, fn) {}
  };

  const logs = [];
  const mgr = ramManager.start(service, (msg) => logs.push(msg), () => true, {
    idleThresholdMs: 100,
    cooldownMs: 500,
    checkIntervalMs: 50
  });

  assert.equal(typeof registered.cleanRam, 'function', 'cleanRam endpoint registered');
  assert.equal(typeof registered.ramInfo, 'function', 'ramInfo endpoint registered');

  registered.ramInfo({
    respond(payload) {
      assert.equal(payload.returnValue, true);
      assert.equal(typeof payload.availableMb, 'number');
      mgr.stop();
      done();
    }
  });
});

test('idle daemon checks foreground and skips non-desktop apps', (t, done) => {
  let fgQueryCount = 0;
  let currentFg = 'com.biliwebos.app';

  const service = {
    register() {},
    call(uri, args, fn) {
      if (uri.includes('getForegroundAppInfo')) {
        fgQueryCount++;
        fn({ payload: { returnValue: true, appId: currentFg } });
      }
    }
  };

  const logs = [];
  const mgr = ramManager.start(service, (msg) => logs.push(msg), () => true, {
    idleThresholdMs: 10,
    cooldownMs: 10,
    checkIntervalMs: 20
  });

  // Advance time so idleThreshold is reached
  setTimeout(() => {
    // Should have queried foreground and skipped clean because foreground is bili
    assert.ok(logs.some(l => l.includes('skip idle clean')), 'must skip cleaning when bili is in foreground');

    // Switch foreground to screensaver
    currentFg = 'com.webos.app.screensaver';
    mgr.checkIdleAndClean();

    setTimeout(() => {
      assert.ok(logs.some(l => l.includes('triggering idle auto-clean')), 'must trigger clean on screensaver');
      mgr.stop();
      done();
    }, 50);
  }, 50);
});
