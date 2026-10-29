// Serverless Function: /api/weather-forecast
// Evaluates NWS Hourly Grid (EAX/34,68) & NWS Alerts (KSZ103) for Easton & corridor.
// Triggers Hard Freeze & Winter Weather conditional banners.

import { NWS_EASTON_GRID, NWS_ALERTS_ZONE } from '../lib/sources.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Edge caching: 15 min cache, 30 min stale
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');

  const now = new Date();
  const currentHour = now.getHours(); // 0-23 in local server time

  try {
    const headers = {
      'User-Agent': 'ThePleasantRidgeGazette/2.0 (contact@farmops.local)',
      'Accept': 'application/geo+json, application/json'
    };

    // 1. Fetch NWS Hourly Forecast
    let periods = [];
    try {
      const forecastResp = await fetch(NWS_EASTON_GRID, { headers, signal: AbortSignal.timeout(9000) });
      if (forecastResp.ok) {
        const fJson = await forecastResp.json();
        periods = fJson?.properties?.periods || [];
      }
    } catch (fErr) {
      console.warn('[WEATHER_FORECAST] NWS Grid warning:', fErr.message);
    }

    // 2. Fetch Active NWS Alerts for Leavenworth County (KSZ103)
    let activeAlerts = [];
    try {
      const alertResp = await fetch(NWS_ALERTS_ZONE, { headers, signal: AbortSignal.timeout(8000) });
      if (alertResp.ok) {
        const aJson = await alertResp.json();
        activeAlerts = (aJson?.features || []).map(feat => ({
          event: feat.properties.event,
          headline: feat.properties.headline,
          severity: feat.properties.severity,
          urgency: feat.properties.urgency,
          effective: feat.properties.effective,
          expires: feat.properties.expires,
          description: feat.properties.description
        }));
      }
    } catch (aErr) {
      console.warn('[WEATHER_FORECAST] NWS Alerts warning:', aErr.message);
    }

    // Evaluate next 24 hours
    const scan24 = periods.slice(0, 24);
    let minTemp = 999;
    let minTempPeriod = null;
    let winterPrecipFound = false;
    let winterPrecipProb = 0;
    let winterPrecipTime = null;

    for (const p of scan24) {
      const temp = Number(p.temperature);
      if (!isNaN(temp) && temp < minTemp) {
        minTemp = temp;
        minTempPeriod = p;
      }

      const shortF = (p.shortForecast || '').toLowerCase();
      const pop = Number(p.probabilityOfPrecipitation?.value || 0);

      const hasWinterKeywords = ['freezing rain', 'ice', 'sleet', 'snow', 'blizzard', 'wintry'].some(k => shortF.includes(k));
      if (hasWinterKeywords && pop >= 30) {
        winterPrecipFound = true;
        if (pop > winterPrecipProb) {
          winterPrecipProb = pop;
          winterPrecipTime = p.startTime;
        }
      }
    }

    // Formatting min temp time
    let minTempTimeFormatted = 'Overnight';
    if (minTempPeriod?.startTime) {
      const dt = new Date(minTempPeriod.startTime);
      minTempTimeFormatted = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    let winterTimeFormatted = 'overnight';
    if (winterPrecipTime) {
      const wdt = new Date(winterPrecipTime);
      winterTimeFormatted = wdt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // MODULE A Trigger 2: Hard Freeze (temp <= 32°F within next 24h)
    // Display Window: Injected if current time is between 14:00 (2 PM) and 20:00 (8 PM), or currently <= 32
    const hardFreezeCondition = minTemp <= 32;
    const freezeTimeWindow = (currentHour >= 14 && currentHour <= 22) || (minTemp <= 32 && currentHour < 10);
    const freezeBannerActive = hardFreezeCondition && freezeTimeWindow;

    // MODULE A Trigger 3: Winter Weather / Slick Commute
    // Display Window: Active from 15:00 day-prior through 09:00 morning-of
    const winterCondition = winterPrecipFound || activeAlerts.some(a => a.event.toLowerCase().includes('winter') || a.event.toLowerCase().includes('ice'));
    const winterTimeWindow = (currentHour >= 15 || currentHour <= 9);
    const winterBannerActive = winterCondition && winterTimeWindow;

    const payload = {
      ok: true,
      updatedAt: now.toISOString(),
      currentTemp: periods[0]?.temperature ?? 50,
      currentForecast: periods[0]?.shortForecast ?? 'Fair',
      minTemp: minTemp === 999 ? 48 : minTemp,
      minTempTime: minTempTimeFormatted,
      hardFreeze: hardFreezeCondition,
      freezeBannerActive,
      winterWeather: winterCondition,
      winterBannerActive,
      winterPrecipProb,
      winterTime: winterTimeFormatted,
      activeAlerts,
      banner: freezeBannerActive
        ? {
            type: 'freeze',
            bgColor: '#1e3a8a',
            headline: '⚠️ EVENING PREP ALERT: HARD FREEZE TONIGHT',
            subtext: `Temps drop to ${minTemp}°F at ${minTempTimeFormatted}. Disconnect outdoor hoses, prep windshields, and check livestock water lines tonight.`
          }
        : winterBannerActive
        ? {
            type: 'winter',
            bgColor: '#b45309',
            headline: '⚠️ EVENING PREP ALERT: OVERNIGHT WINTER CONDITIONS',
            subtext: `Freezing precipitation projected starting ~${winterTimeFormatted}. Anticipate probable USD 449 / Fort Leavenworth delays tomorrow morning.`
          }
        : null
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[WEATHER_FORECAST_ERROR]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
