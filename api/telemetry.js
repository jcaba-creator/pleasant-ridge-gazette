// Serverless Function: /api/telemetry
// Captures anonymous events and feeds directly to Google Sheet Webhook.
// Zero site inspection points, zero secret queries exposed.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const now = new Date();

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const eventRecord = {
      timestamp: now.toISOString(),
      event: body?.event || 'pageview',
      device: body?.device || 'desktop',
      client_ip: clientIp,
      geo_city: decodeURIComponent(req.headers['x-vercel-ip-city'] || ''),
      geo_region: req.headers['x-vercel-ip-country-region'] || '',
      user_agent: req.headers['user-agent'] || '',
      extra: body?.data || null
    };

    console.log('[TELEMETRY_RECORD]', JSON.stringify(eventRecord));

    // Optional: Pipe directly to Google Sheet Webhook (Google Apps Script) if configured
    const sheetWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetWebhook) {
      try {
        await fetch(sheetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventRecord),
          signal: AbortSignal.timeout(4000)
        });
      } catch (sheetErr) {
        console.warn('[SHEETS_PIPE_WARN]', sheetErr.message);
      }
    }

    return res.status(200).json({ success: true, logged_at: eventRecord.timestamp });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}
