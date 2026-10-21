(function (root) {
  'use strict';
  var theme = {
    resolve: function (mode, hour) {
      return mode === 'auto' ? (hour >= 7 && hour < 19 ? 'light' : 'dark') : mode;
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = theme;
  else root.FrameTheme = theme;
}(this));
