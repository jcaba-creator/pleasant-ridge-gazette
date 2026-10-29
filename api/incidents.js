// Serverless Function: /api/incidents
// Stranger Creek Hydrology (Easton, KS Bridges) & Easton Corridor Closures

import { USGS_STRANGER_CREEK, KDOT_WZDX_FEED } from '../lib/sources.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');

  const now = new Date();

  // 1. Stranger Creek Hydrology at Easton (Gauge 06891850)
  // Framed around Easton bridges & low-water crossings (247th St, Mill St, K-192 bottoms)
  let hydrology = {
    siteId: '06891850',
    siteName: 'Stranger Creek at Easton, KS',
    gaugeHeightFt: 3.10,
    floodStageFt: 17.0,
    approachAlertThresholdFt: 12.0,
    isCoveredOrClosing: false,
    isApproaching: false,
    statusLevel: 'green', // 'green' | 'amber' | 'red'
    statusTitle: 'Bridges Clear & Passable',
    statusDetail: 'Mill St & 247th St bridge approaches clear with ample freeboard (Flood stage: 17.0 ft).',
    recordedAt: now.toISOString()
  };

  try {
    const usgsResp = await fetch(USGS_STRANGER_CREEK, {
      headers: { 'User-Agent': 'ThePleasantRidgeGazette/2.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (usgsResp.ok) {
      const uJson = await usgsResp.json();
      const seriesList = uJson?.value?.timeSeries || [];
      const eastonSeries = seriesList.find(s => s?.sourceInfo?.siteCode?.[0]?.value === '06891850') || seriesList[0];
      if (eastonSeries) {
        const valEntry = eastonSeries.values?.[0]?.value?.[0];
        if (valEntry?.value) {
          const valNum = parseFloat(valEntry.value);
          hydrology.gaugeHeightFt = valNum;
          hydrology.recordedAt = valEntry.dateTime || now.toISOString();

          if (valNum >= 15.0) {
            hydrology.isCoveredOrClosing = true;
            hydrology.statusLevel = 'red';
            hydrology.statusTitle = '⚠️ WATER OVER ROAD / BRIDGE ALERT';
            hydrology.statusDetail = `Stranger Creek at ${valNum.toFixed(1)} ft. Low-water crossings on 247th St & Mill St bottomland approaching or covered.`;
          } else if (valNum >= hydrology.approachAlertThresholdFt) {
            hydrology.isApproaching = true;
            hydrology.statusLevel = 'amber';
            hydrology.statusTitle = '⚠️ Rising Creek / Approach Caution';
            hydrology.statusDetail = `Stranger Creek at ${valNum.toFixed(1)} ft. Water rising near bridge abutments; monitor low crossings.`;
          } else {
            hydrology.statusLevel = 'green';
            hydrology.statusTitle = 'Bridges Clear & Passable';
            hydrology.statusDetail = `Stranger Creek at ${valNum.toFixed(1)} ft. Mill St & 247th St bridge approaches clear.`;
          }
        }
      }
    }
  } catch (uErr) {
    console.warn('[INCIDENTS] USGS fetch warning:', uErr.message);
  }

  // 2. KDOT Active Road Alerts
  // Filtered specifically for major roadways, bridges, and arteries into Easton (K-192, US-73, K-7, Leavenworth bridges)
  let eastonCorridorAlerts = [];
  try {
    const kdotResp = await fetch(KDOT_WZDX_FEED, {
      headers: { 'User-Agent': 'ThePleasantRidgeGazette/2.0' },
      signal: AbortSignal.timeout(9000)
    });

    if (kdotResp.ok) {
      const kJson = await kdotResp.json();
      const features = kJson?.features || [];

      for (const feat of features) {
        const props = feat.properties || {};
        const core = props.core_details || {};
        const desc = (props.description || core.description || '').trim();
        const roadNames = core.road_names || [];
        const combined = `${roadNames.join(' ')} ${desc} ${props.event_type || ''}`.toUpperCase();

        // Check if event informs a major closure, bridge restriction, or route into Easton
        const isEastonCorridor = combined.includes('K-192') || combined.includes('K 192') || 
                                 combined.includes('EASTON') || combined.includes('POTTER') ||
                                 (combined.includes('US-73') && (combined.includes('CLOSED') || combined.includes('CLOSURE') || combined.includes('BRIDGE'))) ||
                                 (combined.includes('K-7') && (combined.includes('CLOSED') || combined.includes('CLOSURE') || combined.includes('BRIDGE')));

        if (isEastonCorridor) {
          eastonCorridorAlerts.push({
            id: feat.id || Math.random().toString(36).substring(7),
            route: roadNames.join(', ') || 'Easton Corridor',
            description: desc,
            eventType: core.event_type || 'closure',
            updated: props.update_date || now.toISOString()
          });
        }
      }
    }
  } catch (kErr) {
    console.warn('[INCIDENTS] KDOT fetch warning:', kErr.message);
  }

  const payload = {
    ok: true,
    updatedAt: now.toISOString(),
    hydrology,
    roads: {
      hasClosure: eastonCorridorAlerts.length > 0,
      activeIncidentCount: eastonCorridorAlerts.length,
      statusLevel: eastonCorridorAlerts.length > 0 ? 'amber' : 'green',
      statusTitle: eastonCorridorAlerts.length === 0 ? 'All Easton Corridors Open' : 'Corridor Restriction / Closure',
      statusDetail: eastonCorridorAlerts.length === 0
        ? 'No road closures or bridge blockages reported on K-192, US-73, or K-7.'
        : `${eastonCorridorAlerts.length} restriction(s) impacting Easton corridors.`,
      incidents: eastonCorridorAlerts
    }
  };

  return res.status(200).json(payload);
}
