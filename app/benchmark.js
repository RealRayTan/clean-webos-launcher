(function () {
  'use strict';

  function runScrollBenchmark(count, intervalMs, callback) {
    count = count || 16;
    intervalMs = intervalMs || 150;
    var frameTimes = [];
    var lastTime = performance.now();
    var measuring = true;

    function recordFrame(now) {
      if (!measuring) return;
      var delta = now - lastTime;
      lastTime = now;
      if (delta > 0) frameTimes.push(delta);
      requestAnimationFrame(recordFrame);
    }
    requestAnimationFrame(recordFrame);

    var step = 0;
    var timer = setInterval(function () {
      step++;
      var event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event);
      if (step >= count) {
        clearInterval(timer);
        setTimeout(function () {
          measuring = false;
          var totalDuration = frameTimes.reduce(function (a, b) { return a + b; }, 0);
          var totalFrames = frameTimes.length;
          var avgFps = totalFrames / (totalDuration / 1000);
          var sorted = frameTimes.slice().sort(function (a, b) { return a - b; });
          var slowFrames = frameTimes.filter(function (t) { return t > 20; }).length;
          var frozenFrames = frameTimes.filter(function (t) { return t > 50; }).length;
          var maxFrameMs = sorted.length ? sorted[sorted.length - 1] : 0;
          var p99Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
          var p99Duration = sorted[p99Index] || 16.6;
          var onePercentLowFps = 1000 / p99Duration;

          var report = {
            totalFrames: totalFrames,
            durationMs: Math.round(totalDuration),
            avgFps: Math.round(avgFps * 10) / 10,
            onePercentLowFps: Math.round(onePercentLowFps * 10) / 10,
            slowFrames: slowFrames,
            frozenFrames: frozenFrames,
            maxFrameMs: Math.round(maxFrameMs * 10) / 10
          };
          window.lastBenchmarkReport = report;
          console.log('[Benchmark Report]', JSON.stringify(report));
          if (typeof callback === 'function') callback(report);
        }, 500);
      }
    }, intervalMs);
  }

  window.runScrollBenchmark = runScrollBenchmark;

  if (typeof location !== 'undefined' && location.search && location.search.indexOf('benchmark=1') >= 0) {
    window.addEventListener('load', function () {
      setTimeout(function () { runScrollBenchmark(16, 160); }, 1500);
    });
  }
})();
