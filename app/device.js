(function () {
  'use strict';
  var bridges = [];
  var available = typeof window.PalmServiceBridge === 'function';
  function call(uri, params, callback) {
    if (!available) return callback({ returnValue: false, errorText: '请在电视上使用此功能' });
    var bridge = new PalmServiceBridge(), finished = false;
    var timer = setTimeout(function () { finish({ returnValue: false, errorText: '电视未响应，请重试' }); }, 9000);
    function finish(result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      var index = bridges.indexOf(bridge);
      if (index >= 0) bridges.splice(index, 1);
      callback(result);
    }
    bridge.onservicecallback = function (message) {
      var result;
      try { result = JSON.parse(message); }
      catch (error) { return finish({ returnValue: false, errorText: '电视返回了无效数据' }); }
      finish(result && typeof result === 'object' ? result : { returnValue: false, errorText: '电视返回了无效数据' });
    };
    bridges.push(bridge);
    try { bridge.call(uri, JSON.stringify(params || {})); }
    catch (error) { finish({ returnValue: false, errorText: '无法连接电视服务' }); }
  }
  window.TVDevice = {
    available: available,
    publicContent: function (refresh, apps, done) { call('luna://com.gathin.tvhome.service/publicContent', { refresh: refresh, apps: apps }, done); },
    listApps: function (done) { call('luna://com.gathin.tvhome.service/listApps', {}, done); },
    vpnStatus: function (done) { call('luna://com.gathin.tvhome.service/vpnStatus', {}, done); },
    loadState: function (done) { call('luna://com.gathin.tvhome.service/loadState', {}, done); },
    saveState: function (state, done) { call('luna://com.gathin.tvhome.service/saveState', { state: state }, done || function () {}); },
    launch: function (id, params, done) { call('luna://com.webos.applicationManager/launch', { id: id, params: params || {} }, done); }
  };
}());
