'use strict';
// Local adapter for the source-built HomeBack inputhookpp IPC protocol.
// Native module provenance and licenses are bundled in native/.
var fs = require('fs');
var net = require('net');
var child = require('child_process');
var directory = '/tmp/homeback-remote-ipc';
var lease = directory + '/lease';
var socket = directory + '/events.sock';
var enabled = '/var/lib/lg-c5-home/native-enabled';
var disabled = '/var/lib/lg-c5-home/disabled';
module.exports.start = function (onKey, log) {
  if (!fs.existsSync(enabled)) return;
  fs.mkdirSync(directory, { recursive: true, mode: 448 });
  fs.chmodSync(directory, 448);
  var healthy = false, ownsSocket = false;
  function clearLease() { try { fs.unlinkSync(lease); } catch (error) {} }
  var server = net.createServer(function (connection) {
    var frame = '';
    connection.setTimeout(1000, function () { connection.destroy(); });
    connection.on('error', function () {});
    connection.on('data', function (chunk) {
      frame += chunk.toString('ascii');
      if (frame.length > 64) { connection.destroy(); return; }
      if (frame.indexOf('\n') < 0) return;
      var match = /^773 ([012])\n$/.exec(frame);
      if (match && !fs.existsSync(disabled)) onKey(773, Number(match[1]), 'native');
      connection.end();
    });
  });
  server.on('error', function (error) { healthy = false; if (ownsSocket) clearLease(); log('native socket error: ' + error.message); });
  function listen() { server.listen(socket, onListening); }
  function onListening() {
    ownsSocket = true;
    clearLease();
    fs.chmodSync(socket, 384);
    var target;
    fs.readdirSync('/proc').some(function (pid) {
      if (!/^\d+$/.test(pid)) return false;
      try {
        if (fs.readFileSync('/proc/' + pid + '/comm', 'utf8').trim() !== 'lginput2') return false;
        var status = fs.readFileSync('/proc/' + pid + '/status', 'utf8');
        if (!/^Uid:\s+0\s+0\s+0\s+0$/m.test(status)) { log('native: lginput2 not root; passing through'); return true; }
        target = pid; return true;
      } catch (error) { return false; }
    });
    if (!target) { log('native: no eligible lginput2'); return; }
    var library = __dirname + '/native/libinputhookpp.so';
    function verify() {
      healthy = fs.readFileSync('/proc/' + target + '/maps', 'utf8').indexOf(library) >= 0;
      log('native hook mapped=' + healthy + ' pid=' + target);
    }
    var maps = fs.readFileSync('/proc/' + target + '/maps', 'utf8');
    if (maps.indexOf('libinputhookpp.so') >= 0) {
      if (maps.indexOf(library) < 0) { log('native: another hook already mapped; refusing duplicate'); return; }
      verify(); return;
    }
    child.execFile(__dirname + '/native/ezinject', ['-l', '/tmp/lg-c5-native-input.log', target, library], { timeout: 15000 }, function (error, stdout, stderr) {
      log('native injection: ' + (error ? error.message : 'ok') + ' ' + String(stderr).slice(-500));
      try { verify(); } catch (error) { log('native verify: ' + error.message); }
    });
  }
  if (!fs.existsSync(socket)) listen();
  else {
    var previous = fs.lstatSync(socket);
    var probe = net.createConnection(socket);
    probe.setTimeout(1000, function () { probe.destroy(); log('native IPC owner probe timed out; leaving socket'); });
    probe.on('connect', function () { probe.destroy(); log('native IPC has a live owner; refusing duplicate'); });
    probe.on('error', function (error) {
      probe.destroy();
      if (error.code !== 'ECONNREFUSED' && error.code !== 'ENOENT') { log('native IPC probe: ' + error.code); return; }
      try {
        if (fs.existsSync(socket)) {
          var current = fs.lstatSync(socket);
          if (!current.isSocket() || current.ino !== previous.ino || current.dev !== previous.dev) return;
          fs.unlinkSync(socket);
        }
        listen();
      } catch (error) { log('native IPC recovery: ' + error.message); }
    });
  }
  setInterval(function () {
    if (!ownsSocket) return;
    if (healthy && !fs.existsSync(disabled) && fs.existsSync(enabled)) {
      try { fs.writeFileSync(lease, '', { mode: 384 }); } catch (error) { clearLease(); }
    } else clearLease();
  }, 400);
  function cleanup() {
    if (!ownsSocket) return;
    clearLease();
    try { fs.unlinkSync(socket); } catch (error) {}
  }
  process.on('exit', cleanup);
  process.on('SIGTERM', function () { cleanup(); process.exit(0); });
};
