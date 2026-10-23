(function (root) {
  'use strict';

  var WMO_CODES = {
    0: ['☀️', '晴朗', '🌙'],
    1: ['🌤️', '大部晴朗', '🌤️'],
    2: ['⛅', '多云', '⛅'],
    3: ['☁️', '阴天', '☁️'],
    45: ['🌫️', '有雾', '🌫️'],
    48: ['🌫️', '冻雾', '🌫️'],
    51: ['🌦️', '小毛毛雨', '🌦️'],
    53: ['🌦️', '中毛毛雨', '🌦️'],
    55: ['🌦️', '密毛毛雨', '🌦️'],
    61: ['🌧️', '小雨', '🌧️'],
    63: ['🌧️', '中雨', '🌧️'],
    65: ['🌧️', '大雨', '🌧️'],
    71: ['❄️', '小雪', '❄️'],
    73: ['❄️', '中雪', '❄️'],
    75: ['❄️', '大雪', '❄️'],
    77: ['🌨️', '雪粒', '🌨️'],
    80: ['🌦️', '阵雨', '🌦️'],
    81: ['🌧️', '强阵雨', '🌧️'],
    82: ['🌧️', '特大阵雨', '🌧️'],
    85: ['🌨️', '小阵雪', '🌨️'],
    86: ['🌨️', '强阵雪', '🌨️'],
    95: ['⛈️', '雷暴', '⛈️'],
    96: ['⛈️', '雷暴伴冰雹', '⛈️'],
    99: ['⛈️', '严重雷暴', '⛈️']
  };

  var CACHE_KEY = 'tvhome.weather.cache';
  var CITY_KEY = 'tvhome.city';

  var WeatherModule = {
    WMO_CODES: WMO_CODES,

    getCache: function () {
      try {
        var raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setCache: function (data) {
      try {
        if (typeof localStorage !== 'undefined' && data) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
      } catch (e) {}
    },

    getCity: function () {
      try {
        return typeof localStorage !== 'undefined' ? (localStorage.getItem(CITY_KEY) || '') : '';
      } catch (e) {
        return '';
      }
    },

    setCity: function (city) {
      try {
        if (typeof localStorage !== 'undefined') {
          if (city) localStorage.setItem(CITY_KEY, city);
          else localStorage.removeItem(CITY_KEY);
        }
      } catch (e) {}
    },

    parseForecast: function (data, cityLabel) {
      if (!data || !data.current) return null;

      var temp = Math.round(data.current.temperature_2m);
      var code = data.current.weather_code;
      var isDay = data.current.is_day === 1;
      var mapping = WMO_CODES[code] || ['⛅', '局部多云', '⛅'];
      var icon = isDay ? mapping[0] : mapping[2];
      var text = mapping[1];

      var localNow = (typeof data.utc_offset_seconds === 'number')
        ? new Date(Date.now() + data.utc_offset_seconds * 1000)
        : new Date();

      var sunriseStr = '';
      var sunsetStr = '';
      var isSunset = false;

      if (data.daily) {
        if (data.daily.sunrise && data.daily.sunrise[0]) {
          sunriseStr = data.daily.sunrise[0].split('T')[1] || '';
        }
        if (data.daily.sunset && data.daily.sunset[0]) {
          sunsetStr = data.daily.sunset[0].split('T')[1] || '';
          var sunsetHour = parseInt(sunsetStr.split(':')[0], 10);
          if (!isNaN(sunsetHour)) {
            isSunset = Math.abs(localNow.getUTCHours() - sunsetHour) <= 1;
          }
        }
      }

      var parsed = {
        temp: temp,
        code: code,
        text: text,
        icon: icon,
        isDay: isDay,
        isSunset: isSunset,
        city: cityLabel || '本地',
        sunrise: sunriseStr,
        sunset: sunsetStr,
        updatedAt: Date.now()
      };

      return parsed;
    },

    fetchWeather: function (options, callback) {
      var cb = typeof options === 'function' ? options : callback;
      var opts = (typeof options === 'object' && options !== null) ? options : {};
      var cached = WeatherModule.getCache();

      if (typeof fetch !== 'function') {
        if (cb) cb(null, cached || { temp: 22, text: '晴朗', icon: '☀️', isDay: true, city: '本地' });
        return;
      }

      var cityLabel = opts.city || WeatherModule.getCity();
      var lat = opts.lat;
      var lon = opts.lon;

      var geoPromise = cityLabel
        ? fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(cityLabel) + '&count=1')
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data && data.results && data.results.length > 0) {
                lat = data.results[0].latitude;
                lon = data.results[0].longitude;
                cityLabel = data.results[0].name;
              }
            })
            .catch(function () {})
        : Promise.resolve();

      geoPromise
        .then(function () {
          if (!lat && !lon) {
            return fetch('https://ipapi.co/json/')
              .then(function (res) { return res.json(); })
              .then(function (ipData) {
                if (ipData && ipData.latitude && ipData.longitude) {
                  lat = ipData.latitude;
                  lon = ipData.longitude;
                  cityLabel = ipData.city || '本地';
                }
              })
              .catch(function () {});
          }
        })
        .then(function () {
          if (!lat && !lon) {
            lat = 39.90;
            lon = 116.40;
            cityLabel = cityLabel || '北京';
          }

          var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
            '&current=temperature_2m,weather_code,is_day' +
            '&daily=sunrise,sunset&timezone=auto&forecast_days=1';

          return fetch(url).then(function (res) { return res.json(); });
        })
        .then(function (data) {
          var weather = WeatherModule.parseForecast(data, cityLabel);
          if (weather) {
            WeatherModule.setCache(weather);
            if (cb) cb(null, weather);
          } else {
            if (cb) cb(null, cached);
          }
        })
        .catch(function (err) {
          if (cb) cb(err, cached);
        });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = WeatherModule;
  else root.TVWeather = WeatherModule;
}(typeof window !== 'undefined' ? window : this));
