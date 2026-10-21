// Anonymous Telemetry Dispatcher for The Pleasant Ridge Gazette & 449 Arcade
// Captures anonymous engagement metrics and pipes directly to serverless logging & Google Sheet.

(function () {
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1366)) {
      return 'iPad / Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  function trackEvent(eventType, detail) {
    const payload = {
      event: eventType,
      device: getDeviceType(),
      screen: `${window.innerWidth}x${window.innerHeight}`,
      detail: detail || null,
      timestamp: new Date().toISOString()
    };

    const targetUrl = window.location.protocol === 'file:'
      ? 'https://pleasant-ridge-gazette.vercel.app/api/telemetry'
      : '/api/telemetry';

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(targetUrl, JSON.stringify(payload));
      } else {
        fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  window.GazetteTelemetry = {
    track: trackEvent
  };

  // Auto-track pageview on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    const pageName = window.location.pathname.includes('arcade') ? '449_arcade_hub' : 'gazette_broadsheet';
    trackEvent('pageview', pageName);
  });
})();
