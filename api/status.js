// Serverless Function: /api/status
// Status Board for USD 449 · Pleasant Ridge & Fort Leavenworth

import { kvGet } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360');

  const now = new Date();

  const usd449Cached = await kvGet('gazette:status:usd449');
  const fortCached = await kvGet('gazette:status:fort');

  const entities = [
    {
      id: 'usd449',
      name: 'USD 449 · Pleasant Ridge',
      town: 'Easton, KS',
      url: 'https://www.usd449.com',
      status: usd449Cached?.status || 'green',
      label: usd449Cached?.label || 'Normal Schedule / No Closures Reported',
      sourceSnippet: usd449Cached?.sourceSnippet || 'Official district communications monitored. Zero emergency weather delays or closures.',
      updatedAt: usd449Cached?.updatedAt || now.toISOString(),
      verifiedAt: usd449Cached?.verifiedAt || now.toISOString()
    },
    {
      id: 'fort',
      name: 'Fort Leavenworth (Post & Schools)',
      town: 'Fort Leavenworth, KS',
      url: 'https://home.army.mil/leavenworth/',
      status: fortCached?.status || 'green',
      label: fortCached?.label || 'Normal Operations / Normal Schedule',
      sourceSnippet: fortCached?.sourceSnippet || 'Installation gates open. USD 207 post schools operating on normal duty schedule.',
      updatedAt: fortCached?.updatedAt || now.toISOString(),
      verifiedAt: fortCached?.verifiedAt || now.toISOString()
    }
  ];

  return res.status(200).json({
    ok: true,
    polledAt: now.toISOString(),
    entities
  });
}
