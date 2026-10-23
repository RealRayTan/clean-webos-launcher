(function (root) {
  'use strict';
  var theme = {
    resolve: function (mode, hour, weather) {
      if (mode !== 'auto') return mode;
      if (weather && weather.sunrise && weather.sunset) {
        var parseMinutes = function (timeStr) {
          if (!timeStr || typeof timeStr !== 'string') return -1;
          var parts = timeStr.split(':');
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        };
        var sunriseMin = parseMinutes(weather.sunrise);
        var sunsetMin = parseMinutes(weather.sunset);
        if (sunriseMin >= 0 && sunsetMin >= 0) {
          var nowMin = (typeof weather.nowMinutes === 'number')
            ? weather.nowMinutes
            : (new Date().getHours() * 60 + new Date().getMinutes());
          return (nowMin >= sunriseMin && nowMin < sunsetMin) ? 'light' : 'dark';
        }
      }
      return (hour >= 7 && hour < 19) ? 'light' : 'dark';
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = theme;
  else root.FrameTheme = theme;
}(this));
