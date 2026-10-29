// Serverless Function: /api/scratchpad
// Central Cloud Relay for Field Scratchpad & Sprint Staging
// Enables cross-site synchronization between Vercel, GitHub Pages, and Local Google Drive.

import { kvGet, kvSet } from '../lib/store.js';

const STORAGE_KEY = 'gazette:ops:field_scratchpad_v1';

export default async function handler(req, res) {
  // Universal CORS: Allows requests from both Vercel and GitHub Pages (and local file://)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let items = (await kvGet(STORAGE_KEY)) || [];
    if (!Array.isArray(items)) items = [];

    // 1. GET: Fetch all active & resolved observations
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        count: items.length,
        items: items,
        serverTime: new Date().toISOString()
      });
    }

    // 2. POST: Add or merge observation(s)
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      // Check if payload is a bulk sync array
      if (Array.isArray(body)) {
        const existingIds = new Set(items.map(i => i.id));
        let addedCount = 0;
        for (const incoming of body) {
          if (incoming && incoming.id && !existingIds.has(incoming.id)) {
            items.unshift(incoming);
            existingIds.add(incoming.id);
            addedCount++;
          }
        }
        if (items.length > 500) items = items.slice(0, 500);
        await kvSet(STORAGE_KEY, items);
        return res.status(200).json({ ok: true, merged: addedCount, total: items.length });
      }

      // Single item save
      const text = (body?.text || '').trim();
      if (!text) {
        return res.status(400).json({ ok: false, error: 'Empty observation text' });
      }

      const newItem = {
        id: body?.id || ('obs-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
        text: text,
        zone: body?.zone || 'Mobile / Vehicles',
        sprint: body?.sprint || '🌱 Spring 2027',
        operator: body?.operator || 'Operator',
        urgency: body?.urgency || 'routine',
        pageTitle: body?.pageTitle || 'Field Dispatch',
        pagePath: body?.pagePath || 'field',
        timestamp: body?.timestamp || new Date().toISOString(),
        status: body?.status || 'active',
        sourceHost: req.headers['origin'] || req.headers['host'] || 'unknown'
      };

      // Deduplicate: replace if existing, else unshift
      const existingIdx = items.findIndex(i => i.id === newItem.id);
      if (existingIdx !== -1) {
        items[existingIdx] = newItem;
      } else {
        items.unshift(newItem);
      }

      if (items.length > 500) items = items.slice(0, 500);
      await kvSet(STORAGE_KEY, items);

      // Optional: Forward to Google Sheets Webhook if configured
      const sheetWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (sheetWebhook) {
        try {
          await fetch(sheetWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'field_scratchpad_entry',
              item: newItem
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
        total: items.length
      });
    }

    // 3. PATCH: Update status (e.g. resolve/reopen)
    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const targetId = body?.id;
      if (!targetId) return res.status(400).json({ ok: false, error: 'Missing item id' });

      const item = items.find(i => i.id === targetId);
      if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });

      if (body.status) item.status = body.status;
      if (body.text) item.text = body.text;
      if (body.zone) item.zone = body.zone;
      if (body.sprint) item.sprint = body.sprint;

      await kvSet(STORAGE_KEY, items);
      return res.status(200).json({ ok: true, updated: item });
    }

    // 4. DELETE: Remove an item or clear resolved
    if (req.method === 'DELETE') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const targetId = body?.id;
      const clearResolved = body?.clearResolved === true;

      if (clearResolved) {
        const before = items.length;
        items = items.filter(i => i.status !== 'resolved');
        await kvSet(STORAGE_KEY, items);
        return res.status(200).json({ ok: true, cleared: before - items.length, total: items.length });
      }

      if (targetId) {
        items = items.filter(i => i.id !== targetId);
        await kvSet(STORAGE_KEY, items);
        return res.status(200).json({ ok: true, deleted: targetId, total: items.length });
      }

      return res.status(400).json({ ok: false, error: 'Missing targetId or clearResolved' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
