'use strict';
var fs = require('fs');
var path = require('path');

function iconData(file) {
  if (typeof file !== 'string' || !/^\/(usr\/palm|mnt|media\/(developer|cryptofs))\//.test(file)) return '';
  var type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file).toLowerCase()];
  if (!type) return '';
  try {
    if (fs.statSync(file).size > 512 * 1024) return '';
    return 'data:' + type + ';base64,' + fs.readFileSync(file).toString('base64');
  } catch (error) { return ''; }
}

exports.register = function (service) {
  service.register('listApps', function (message) {
    var finished = false;
    var timer = setTimeout(function () { finish({ returnValue: false, errorText: '应用列表读取超时' }); }, 7000);
    function finish(result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      message.respond(result);
    }
    service.call('luna://com.webos.applicationManager/listLaunchPoints', {}, function (response) {
      if (finished) return;
      var payload = response && response.payload;
      if (!payload || payload.returnValue === false || !Array.isArray(payload.launchPoints)) {
        finish({ returnValue: false, errorText: '无法读取已安装应用' });
        return;
      }
      var seen = {};
      var apps = payload.launchPoints.filter(function (point) {
        if (!point.id || point.hidden || seen[point.id] || point.id === 'com.gathin.tvhome' || /^com\.webos\.app\.(hdmi\d+|livetv)$/.test(point.id)) return false;
        seen[point.id] = true;
        return true;
      }).map(function (point) {
        return { id: point.id, title: point.title || point.id,
          icon: iconData(point.largeIcon) || iconData(point.icon),
          iconColor: point.iconColor || point.bgColor || '' };
      });
      if (!seen['com.webos.app.home']) apps.push({ id: 'com.webos.app.home', title: 'LG 原厂首页', icon: 'icons/lg-home.svg', iconColor: '#303038' });
      finish({ returnValue: true, apps: apps });
    });
  });
};
