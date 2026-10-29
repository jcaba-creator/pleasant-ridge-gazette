// Serverless Function: /api/archive
// Manages confidential archived scratchpad entries and future sprint backlogs.

import { kvGet, kvSet } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = 'gazette:ops:archived_backlog';

  if (req.method === 'GET') {
    const list = (await kvGet(KEY)) || [];
    return res.status(200).json({ ok: true, count: list.length, items: list });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      const text = (body?.text || '').trim();
      if (!text) {
        return res.status(400).json({ ok: false, error: 'Empty note content' });
      }

      const newItem = {
        id: body?.id || ('archive-' + Date.now()),
        text,
        timestamp: body?.timestamp || new Date().toISOString(),
        author: body?.author || 'Operator'
      };

      let list = (await kvGet(KEY)) || [];
      if (!Array.isArray(list)) list = [];
      list.unshift(newItem); // Newest entries at the top

      // Keep up to 250 historical items
      if (list.length > 250) list = list.slice(0, 250);

      await kvSet(KEY, list);

      // Pipe to Google Sheets webhook if configured
      const sheetWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (sheetWebhook) {
        try {
          await fetch(sheetWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'ops_scratchpad_archive',
              data: newItem
            }),
            signal: AbortSignal.timeout(3000)
          });
        } catch (sheetErr) {
          console.warn('[SHEET_PIPE_WARN]', sheetErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        saved: newItem,
        totalCount: list.length
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
