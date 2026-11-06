const test = require('node:test');
const assert = require('node:assert/strict');
const appCatalog = require('../service/app-catalog');

test('app-catalog listApps filters out VPN apps and reports vpnInstalled', () => {
  const methods = {};
  const mockService = {
    register: (name, handler) => { methods[name] = handler; },
    call: (uri, payload, callback) => {
      if (uri === 'luna://com.webos.applicationManager/listLaunchPoints') {
        callback({
          payload: {
            returnValue: true,
            launchPoints: [
              { id: 'com.biliwebos.app', title: '哔哩哔哩' },
              { id: 'com.alcyone.vpn.singbox', title: 'Alcyone' },
              { id: 'com.webos.app.hdmi1', title: 'HDMI 1' },
              { id: 'com.gathin.tvhome', title: 'TV Home' },
              { id: 'youtube.leanback.v4', title: 'YouTube' }
            ]
          }
        });
      }
    }
  };

  appCatalog.register(mockService);
  assert.ok(methods.listApps, 'listApps should be registered');

  let responseData = null;
  methods.listApps({
    respond: res => { responseData = res; }
  });

  assert.ok(responseData, 'should respond to listApps');
  assert.equal(responseData.returnValue, true);
  assert.equal(responseData.vpnInstalled, true);
  const appIds = responseData.apps.map(a => a.id);
  assert.ok(!appIds.includes('com.alcyone.vpn.singbox'), 'Alcyone should be excluded from app list');
  assert.ok(!appIds.includes('com.webos.app.hdmi1'), 'HDMI inputs should be excluded');
  assert.ok(!appIds.includes('com.gathin.tvhome'), 'launcher self should be excluded');
  assert.ok(appIds.includes('com.biliwebos.app'), 'Bilibili should be included');
  assert.ok(appIds.includes('youtube.leanback.v4'), 'YouTube should be included');
  assert.ok(appIds.includes('com.webos.app.home'), 'System home should be included');
});
