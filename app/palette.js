(function () {
  'use strict';
  var cache = new Map();
  function rgb(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2, h = 0;
    if (d) { h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { h: h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l: l };
  }
  function fallback(color) {
    if (/^#[a-f0-9]{6}$/i.test(color)) {
      var value = rgb(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
      if (value.s > 0.12) return value;
    }
    return { h: 75, s: 0.06, l: 0.5 };
  }
  function extract(image, base) {
    var canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    var context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 32, 32);
    var pixels = context.getImageData(0, 0, 32, 32).data, bins = [];
    for (var i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      var c = rgb(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (c.s < 0.18 || c.l < 0.10 || c.l > 0.9) continue;
      var index = Math.floor(c.h / 15), weight = c.s * c.s * pixels[i + 3] / 255;
      if (!bins[index]) bins[index] = { weight: 0, h: 0, s: 0, count: 0 };
      bins[index].weight += weight; bins[index].h += c.h * weight; bins[index].s += c.s * weight; bins[index].count++;
    }
    var best = bins.filter(Boolean).sort(function (a, b) { return b.weight - a.weight; })[0];
    return best && best.count >= 6 ? { h: best.h / best.weight, s: best.s / best.weight } : base;
  }
  function paint(button, color) {
    var h = Math.round(color.h), saturation = Math.round(Math.min(0.28, color.s * 0.30) * 100);
    button.style.setProperty('--app-bg-light', 'hsl(' + h + ',' + saturation + '%,84%)');
    button.style.setProperty('--app-bg-dark', 'hsl(' + h + ',' + saturation + '%,20%)');
    button.style.setProperty('--app-ink-light', 'hsl(' + h + ',18%,14%)');
    button.style.setProperty('--app-ink-dark', 'hsl(' + h + ',20%,94%)');
    button.classList.add('palette-auto');
    button.dataset.palette = 'ready';
  }
  window.TilePalette = {
    apply: function (button, id, source, color) {
      var key = id + ':' + (source || '') + ':' + (color || '');
      var base = fallback(color); paint(button, base);
      if (!source) return;
      var promise = cache.get(key);
      if (!promise) {
        promise = new Promise(function (resolve) {
          var image = new Image(), complete = false;
          var timer = setTimeout(function () { finish(base); }, 4000);
          function finish(value) { if (complete) return; complete = true; clearTimeout(timer); image.onload = image.onerror = null; resolve(value); }
          image.onload = function () { try { finish(extract(image, base)); } catch (error) { finish(base); } };
          image.onerror = function () { finish(base); };
          image.src = source;
        });
        cache.set(key, promise);
      }
      promise.then(function (value) { if (button.isConnected) paint(button, value); });
    }
  };
}());
