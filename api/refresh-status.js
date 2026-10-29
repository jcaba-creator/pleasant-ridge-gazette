// Serverless Poller Worker: /api/refresh-status
// Scrapes live district alerts, checks NWS KSZ103 alerts,
// updates Vercel KV for institutional status board, and feeds AAR snapshots.

import { kvSet, kvGet } from '../lib/store.js';
import { INSTITUTIONS, NWS_ALERTS_ZONE } from '../lib/sources.js';
import { saveSnapshot } from '../lib/telemetry-store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const hour = now.getHours();

  try {
    // 1. Check NWS Alerts for Leavenworth County
    let severeWinterAlert = false;
    let alertHeadline = '';
    try {
      const resp = await fetch(NWS_ALERTS_ZONE, {
        headers: { 'User-Agent': 'ThePleasantRidgeGazette-Poller/2.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (resp.ok) {
        const aJson = await resp.json();
        for (const feat of (aJson?.features || [])) {
          const ev = (feat.properties?.event || '').toLowerCase();
          if (ev.includes('blizzard') || ev.includes('ice storm') || ev.includes('winter storm warning')) {
            severeWinterAlert = true;
            alertHeadline = feat.properties?.headline || ev;
            break;
          }
        }
      }
    } catch (nErr) {
      console.warn('[REFRESH_STATUS] NWS alerts warn:', nErr.message);
    }

    // 2. Poll & evaluate each institution
    const results = {};
    for (const [k, meta] of Object.entries(INSTITUTIONS)) {
      let status = 'green';
      let label = 'Normal Schedule / No Closures Reported';
      let snippet = 'Official district communications feed monitored. Zero active emergency closures.';

      if (severeWinterAlert) {
        status = 'amber';
        label = 'Modified Operations / Pre-6 AM Winter Warning';
        snippet = `NWS Alert Active: ${alertHeadline}. Monitoring for morning transit determinations.`;
      }

      // Live HTTP ping test to institution web portal
      try {
        const testResp = await fetch(meta.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(7000)
        });
        if (testResp.ok) {
          const html = await testResp.text();
          const lower = html.toLowerCase();
          if (lower.includes('school closed') || lower.includes('closed due to weather') || lower.includes('all classes canceled')) {
            status = 'red';
            label = 'Closed / No School / Severe Weather';
            snippet = 'Emergency banner detected on district homepage: Classes canceled.';
          } else if (lower.includes('2-hour delay') || lower.includes('late start') || lower.includes('liberal leave')) {
            status = 'amber';
            label = 'Delays / Modified Schedule Reported';
            snippet = 'Modified schedule / delayed start announcement detected.';
          }
        }
      } catch (siteErr) {
        console.warn(`[REFRESH_STATUS] Site check for ${k}:`, siteErr.message);
      }

      const record = {
        id: meta.id,
        name: meta.name,
        status,
        label,
        sourceSnippet: snippet,
        updatedAt: now.toISOString(),
        verifiedAt: now.toISOString()
      };

      await kvSet(meta.statusKey, record);
      results[meta.id] = record;
    }

    // 3. AAR Snapshot Hook (Snapshot 2 at 06:00 CST morning-of)
    if (hour >= 5 && hour <= 7) {
      await saveSnapshot('decision_0600', dateKey, results);
    }

    return res.status(200).json({
      ok: true,
      refreshedAt: now.toISOString(),
      entities: results
    });
  } catch (err) {
    console.error('[REFRESH_STATUS_ERROR]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
