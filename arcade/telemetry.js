// The 449 Field Arcade - Local Telemetry & Analytics Dispatch
(function() {
  'use strict';
  window.GazetteTelemetry = {
    track: function(event, payload) {
      try {
        if (window.console && console.debug) {
          console.debug('[GazetteTelemetry]', event, payload);
        }
      } catch (err) {}
    }
  };
})();
