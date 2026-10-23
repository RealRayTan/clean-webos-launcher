'use strict';
// Shared launcher state for the normal app and the system-home copy.
// Both app ids may call it; state is validated before it is written.
var fs = require('fs');
var path = require('path');
var allowed = ['com.gathin.tvhome', 'com.webos.app.home'];
var stateDir = '/var/lib/lg-c5-home';
var stateFile = path.join(stateDir, 'app-state.json');

function valid(state) {
  if (!state || typeof state !== 'object') return false;
  if (['auto', 'light', 'dark', 'oled'].indexOf(state.theme) < 0) return false;
  if (['valley', 'peaks', 'plain'].indexOf(state.wallpaper) < 0) return false;
  if (!Array.isArray(state.apps) || state.apps.length > 60) return false;
  var seen = Object.create(null);
  for (var i = 0; i < state.apps.length; i++) {
    var id = state.apps[i];
    if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(id) || seen[id]) return false;
    seen[id] = true;
  }
  if (state.devices != null) {
    if (typeof state.devices !== 'object' || Array.isArray(state.devices)) return false;
    var keys = ['default', 'pc', 'ps5', 'ps4', 'xbox', 'switch', 'media'];
    var ids = Object.keys(state.devices);
    for (var j = 0; j < ids.length; j++) {
      if (!/^com\.webos\.app\.hdmi[1-4]$/.test(ids[j]) || keys.indexOf(state.devices[ids[j]]) < 0) return false;
    }
  }
  return typeof state.lastFocus === 'string' && /^[A-Za-z0-9_.-]+$/.test(state.lastFocus);
}

function read() {
  try {
    var state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return valid(state) ? state : null;
  } catch (error) { return null; }
}

exports.register = function (service) {
  service.register('loadState', function (message) {
    if (allowed.indexOf(message.sender) < 0) {
      message.respond({ returnValue: false, errorText: 'Caller not allowed' });
      return;
    }
    message.respond({ returnValue: true, state: read() });
  });
  service.register('saveState', function (message) {
    if (allowed.indexOf(message.sender) < 0) {
      message.respond({ returnValue: false, errorText: 'Caller not allowed' });
      return;
    }
    var state = message.payload && message.payload.state;
    if (!valid(state)) {
      message.respond({ returnValue: false, errorText: 'Invalid launcher state' });
      return;
    }
    try {
      fs.mkdirSync(stateDir, { recursive: true, mode: 448 });
      fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state), { mode: 384 });
      fs.renameSync(stateFile + '.tmp', stateFile);
      message.respond({ returnValue: true });
    } catch (error) {
      message.respond({ returnValue: false, errorText: 'Unable to save launcher state' });
    }
  });
};
