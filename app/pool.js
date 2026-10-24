/* Bounded LRU Image Pool and Serialized Preload Queue for webOS */
(function () {
  'use strict';

  function createImagePool(capacity) {
    var cap = Math.max(1, capacity || 8);
    var items = [];

    return {
      capacity: cap,
      has: function (url) {
        if (!url) return false;
        for (var i = 0; i < items.length; i++) {
          if (items[i].url === url) return true;
        }
        return false;
      },
      acquire: function (url) {
        if (!url) return null;
        var now = Date.now();
        for (var i = 0; i < items.length; i++) {
          if (items[i].url === url) {
            items[i].accessedAt = now;
            var found = items.splice(i, 1)[0];
            items.push(found);
            return found.img;
          }
        }
        if (items.length >= cap) {
          var evicted = items.shift();
          if (evicted && evicted.img) {
            evicted.img.src = '';
          }
        }
        var img = new Image();
        img.decoding = 'async';
        img.src = url;
        items.push({ url: url, img: img, accessedAt: now });
        return img;
      },
      pruneNonVisible: function (activeUrls) {
        if (!Array.isArray(activeUrls)) return;
        var activeSet = Object.create(null);
        for (var j = 0; j < activeUrls.length; j++) {
          if (activeUrls[j]) activeSet[activeUrls[j]] = true;
        }
        var remaining = [];
        for (var k = 0; k < items.length; k++) {
          var item = items[k];
          if (activeSet[item.url]) {
            remaining.push(item);
          } else {
            if (item.img) item.img.src = '';
          }
        }
        items = remaining;
      },
      size: function () {
        return items.length;
      },
      urls: function () {
        return items.map(function (it) { return it.url; });
      }
    };
  }

  function createPreloadQueue() {
    var queue = [];
    var running = false;
    var paused = false;

    function processNext() {
      if (paused || running || queue.length === 0) return;
      var task = queue.shift();
      if (!task) return;

      running = true;
      var img = task.pool ? task.pool.acquire(task.url) : new Image();
      if (!task.pool) {
        img.decoding = 'async';
        img.src = task.url;
      }

      var finish = function () {
        running = false;
        if (task.onDone) {
          try { task.onDone(task.url); } catch (e) {}
        }
        if (!paused && queue.length > 0) {
          if (typeof window !== 'undefined' && window.requestAnimationFrame) {
            window.requestAnimationFrame(processNext);
          } else {
            setTimeout(processNext, 16);
          }
        }
      };

      if (img && img.decode) {
        img.decode().then(finish).catch(finish);
      } else {
        setTimeout(finish, 20);
      }
    }

    return {
      enqueue: function (url, pool, onDone) {
        if (!url) return;
        for (var i = 0; i < queue.length; i++) {
          if (queue[i].url === url) return;
        }
        queue.push({ url: url, pool: pool, onDone: onDone });
        if (!paused && !running) {
          processNext();
        }
      },
      pause: function () {
        paused = true;
      },
      resume: function () {
        if (!paused) return;
        paused = false;
        if (!running && queue.length > 0) {
          processNext();
        }
      },
      clear: function () {
        queue = [];
        running = false;
      },
      isBusy: function () {
        return running || queue.length > 0;
      },
      pendingCount: function () {
        return queue.length;
      }
    };
  }

  window.ImagePool = { create: createImagePool };
  window.PreloadQueue = { create: createPreloadQueue };
})();
