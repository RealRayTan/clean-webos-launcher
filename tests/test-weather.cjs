const test = require('node:test');
const assert = require('node:assert/strict');
const Weather = require('../app/weather.js');
const FrameTheme = require('../app/theme.js');

test('WMO code mapping covers common weather situations', () => {
  assert.equal(Weather.WMO_CODES[0][1], '晴朗');
  assert.equal(Weather.WMO_CODES[2][1], '多云');
  assert.equal(Weather.WMO_CODES[61][1], '小雨');
  assert.equal(Weather.WMO_CODES[95][1], '雷暴');
});

test('parseForecast extracts temperatures, night icons and sunset times', () => {
  const mockData = {
    utc_offset_seconds: 28800,
    current: {
      temperature_2m: 23.4,
      weather_code: 0,
      is_day: 0
    },
    daily: {
      sunrise: ['2026-10-23T06:15'],
      sunset: ['2026-10-23T18:05']
    }
  };

  const parsed = Weather.parseForecast(mockData, '上海');
  assert.equal(parsed.temp, 23);
  assert.equal(parsed.text, '晴朗');
  assert.equal(parsed.icon, '🌙'); // is_day: 0
  assert.equal(parsed.city, '上海');
  assert.equal(parsed.sunrise, '06:15');
  assert.equal(parsed.sunset, '18:05');
});

test('FrameTheme resolve uses sunset/sunrise data when provided', () => {
  const weather = {
    sunrise: '06:30',
    sunset: '18:15',
    nowMinutes: 12 * 60 // 中午 12:00
  };

  assert.equal(FrameTheme.resolve('auto', 12, weather), 'light');

  const nightWeather = {
    sunrise: '06:30',
    sunset: '18:15',
    nowMinutes: 20 * 60 // 晚上 20:00
  };
  assert.equal(FrameTheme.resolve('auto', 20, nightWeather), 'dark');

  // 手动模式不受天气影响
  assert.equal(FrameTheme.resolve('oled', 12, weather), 'oled');
  assert.equal(FrameTheme.resolve('dark', 12, weather), 'dark');
  assert.equal(FrameTheme.resolve('light', 20, nightWeather), 'light');
});

test('FrameTheme falls back to hour comparison when weather is omitted', () => {
  assert.equal(FrameTheme.resolve('auto', 8), 'light');
  assert.equal(FrameTheme.resolve('auto', 6), 'dark');
  assert.equal(FrameTheme.resolve('auto', 19), 'dark');
});
