// Serverless Function: /api/bank
// Secure Household Treasury & On-Demand Bounty System
// Operatives: L-Dog, Rainbow-4, Peacemaker 9
// Banker Authentication: SHA-256 Master PIN (23836)
// Persistent Storage: GitHub Gist (Single Global Cloud Database)

import crypto from 'crypto';

const GIST_ID = process.env.TREASURY_GIST_ID || 'dcacf6fcd08290bfde56d42ac0a306c5';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DEFAULT_PIN_HASH = '66bac5af2635c2a2ada6bba2d7fc7eeab9b372110708b48af7648a0171168eaa'; // PIN 23836

// In-memory backup cache if Gist is unreachable
let memoryBackup = null;

const INITIAL_STATE = {
  system: 'Household Treasury & Bounty OS',
  version: '1.0.0',
  bankerPinHash: DEFAULT_PIN_HASH,
  operatives: {
    op_ldog: {
      id: 'op_ldog',
      callSign: 'L-Dog',
      rank: 'Lead Ranger',
      color: '#38bdf8',
      avatar: '🤠',
      balance: 0.00
    },
    op_rainbow4: {
      id: 'op_rainbow4',
      callSign: 'Rainbow-4',
      rank: 'Tactical Scout',
      color: '#ec4899',
      avatar: '🦄',
      balance: 0.00
    },
    op_peacemaker9: {
      id: 'op_peacemaker9',
      callSign: 'Peacemaker 9',
      rank: 'Sentinel',
      color: '#a855f7',
      avatar: '⚡',
      balance: 0.00
    }
  },
  bounties: [
    {
      id: 'bounty_welcome_01',
      title: 'Field Deployment & Radio Check',
      description: 'Log into the Treasury terminal with your operative call-sign and test the alert buzzer.',
      amount: 1.00,
      targetOperative: 'ALL',
      status: 'OPEN',
      claimedBy: null,
      createdAt: '2026-10-24T12:00:00.000Z',
      completedAt: null
    }
  ],
  transactions: [],
  spendRequests: []
};

function hashPin(pin) {
  if (!pin) return '';
  return crypto.createHash('sha256').update(String(pin).trim()).digest('hex');
}

async function fetchGistState() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    return memoryBackup || JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': '449-Treasury-Engine'
      }
    });

    if (!res.ok) {
      console.error('Gist fetch failed with status:', res.status);
      return memoryBackup || JSON.parse(JSON.stringify(INITIAL_STATE));
    }

    const data = await res.json();
    const file = data.files && data.files['treasury.json'];
    if (!file || !file.content) {
      return memoryBackup || JSON.parse(JSON.stringify(INITIAL_STATE));
    }

    const raw = file.content.replace(/^\uFEFF/, '').trim();
    const parsed = JSON.parse(raw);
    memoryBackup = parsed;
    return parsed;
  } catch (err) {
    console.error('Error in fetchGistState:', err);
    return memoryBackup || JSON.parse(JSON.stringify(INITIAL_STATE));
  }
}

async function saveGistState(state) {
  memoryBackup = state;
  if (!GITHUB_TOKEN || !GIST_ID) return false;

  try {
    const payload = JSON.stringify({
      files: {
        'treasury.json': {
          content: JSON.stringify(state, null, 2)
        }
      }
    });

    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': '449-Treasury-Engine'
      },
      body: payload
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to save Gist state:', res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveGistState:', err);
    return false;
  }
}

function computeBalances(state) {
  const totals = {
    op_ldog: 0,
    op_rainbow4: 0,
    op_peacemaker9: 0
  };

  for (const tx of state.transactions || []) {
    if (!tx || !totals.hasOwnProperty(tx.operativeId)) continue;
    const amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'DEPOSIT') {
      totals[tx.operativeId] += amt;
    } else if (tx.type === 'DEBIT') {
      totals[tx.operativeId] -= amt;
    }
  }

  for (const opId in state.operatives) {
    state.operatives[opId].balance = Math.round(totals[opId] * 100) / 100;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Banker-Pin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let state = await fetchGistState();
    if (!state || typeof state !== 'object' || !state.operatives) {
      state = JSON.parse(JSON.stringify(INITIAL_STATE));
      await saveGistState(state);
    }

    computeBalances(state);

    // 1. GET: Public Read-Only State
    if (req.method === 'GET') {
      const safeState = JSON.parse(JSON.stringify(state));
      delete safeState.bankerPinHash;
      safeState.hasPin = true;
      safeState.storageType = 'GitHub Gist Cloud DB';

      return res.status(200).json({
        ok: true,
        data: safeState,
        serverTime: new Date().toISOString()
      });
    }

    // 2. POST: Actions
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      body = body || {};

      const action = body.action || '';
      const pinHeader = req.headers['x-banker-pin'] || (req.headers['authorization'] || '').replace('Bearer ', '');
      const providedPin = body.pin || pinHeader || '';
      const providedHash = hashPin(providedPin);
      const isBanker = providedHash === (state.bankerPinHash || DEFAULT_PIN_HASH);

      // Dedicated Action: VERIFY_PIN
      if (action === 'VERIFY_PIN') {
        if (isBanker) {
          return res.status(200).json({
            ok: true,
            authenticated: true,
            message: 'Master Banker PIN Authenticated.'
          });
        } else {
          return res.status(403).json({
            ok: false,
            authenticated: false,
            error: 'Invalid Master Banker Authorization PIN.'
          });
        }
      }

      // Banker restricted actions
      const BANKER_ACTIONS = [
        'CREATE_BOUNTY',
        'APPROVE_BOUNTY',
        'REJECT_BOUNTY',
        'DIRECT_DEPOSIT',
        'PROCESS_DEBIT',
        'CANCEL_BOUNTY',
        'APPROVE_SPEND',
        'CHANGE_PIN',
        'RESET_DEMO'
      ];

      if (BANKER_ACTIONS.includes(action) && !isBanker) {
        return res.status(403).json({
          ok: false,
          error: 'Access Denied: Invalid Master Banker Authorization PIN.'
        });
      }

      // Action: CREATE_BOUNTY (Banker)
      if (action === 'CREATE_BOUNTY') {
        const title = (body.title || '').trim();
        const description = (body.description || '').trim();
        const amount = Math.max(0.10, Math.round((parseFloat(body.amount) || 0) * 100) / 100);
        const targetOperative = body.targetOperative || 'ALL';

        if (!title || amount <= 0) {
          return res.status(400).json({ ok: false, error: 'Title and positive payout amount required.' });
        }

        const newBounty = {
          id: 'bounty_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title,
          description,
          amount,
          targetOperative,
          status: 'OPEN',
          claimedBy: null,
          createdAt: new Date().toISOString(),
          completedAt: null
        };

        state.bounties = state.bounties || [];
        state.bounties.unshift(newBounty);
        await saveGistState(state);
        return res.status(200).json({ ok: true, bounty: newBounty, message: 'Bounty posted to operative board.' });
      }

      // Action: CLAIM_BOUNTY (Operative - No PIN needed)
      if (action === 'CLAIM_BOUNTY') {
        const bountyId = body.bountyId;
        const operativeId = body.operativeId;

        if (!state.operatives[operativeId]) {
          return res.status(400).json({ ok: false, error: 'Unknown operative.' });
        }

        const bounty = (state.bounties || []).find(b => b.id === bountyId);
        if (!bounty) return res.status(404).json({ ok: false, error: 'Bounty not found.' });
        if (bounty.status !== 'OPEN') return res.status(400).json({ ok: false, error: 'Bounty already claimed or closed.' });

        bounty.status = 'CLAIMED';
        bounty.claimedBy = operativeId;
        bounty.claimedAt = new Date().toISOString();

        await saveGistState(state);
        return res.status(200).json({ ok: true, bounty, message: 'Bounty claimed by ' + state.operatives[operativeId].callSign });
      }

      // Action: SUBMIT_INSPECTION (Operative - No PIN needed)
      if (action === 'SUBMIT_INSPECTION') {
        const bountyId = body.bountyId;
        const operativeId = body.operativeId;

        const bounty = (state.bounties || []).find(b => b.id === bountyId);
        if (!bounty) return res.status(404).json({ ok: false, error: 'Bounty not found.' });
        if (bounty.claimedBy !== operativeId) return res.status(403).json({ ok: false, error: 'Not claimed by this operative.' });

        bounty.status = 'PENDING_INSPECTION';
        bounty.submittedAt = new Date().toISOString();

        await saveGistState(state);
        return res.status(200).json({ ok: true, bounty, message: 'Submitted for Banker inspection.' });
      }

      // Action: APPROVE_BOUNTY (Banker)
      if (action === 'APPROVE_BOUNTY') {
        const bountyId = body.bountyId;
        const bounty = (state.bounties || []).find(b => b.id === bountyId);
        if (!bounty) return res.status(404).json({ ok: false, error: 'Bounty not found.' });
        if (!bounty.claimedBy || !state.operatives[bounty.claimedBy]) {
          return res.status(400).json({ ok: false, error: 'Bounty has no valid claiming operative.' });
        }

        bounty.status = 'COMPLETED';
        bounty.completedAt = new Date().toISOString();

        const tx = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: new Date().toISOString(),
          operativeId: bounty.claimedBy,
          type: 'DEPOSIT',
          amount: bounty.amount,
          category: 'BOUNTY_PAYOUT',
          memo: 'Bounty: ' + bounty.title,
          authorizer: 'BANKER'
        };

        state.transactions = state.transactions || [];
        state.transactions.unshift(tx);
        computeBalances(state);
        await saveGistState(state);

        return res.status(200).json({
          ok: true,
          transaction: tx,
          newBalance: state.operatives[bounty.claimedBy].balance,
          message: 'Bounty approved and $' + bounty.amount.toFixed(2) + ' credited to ' + state.operatives[bounty.claimedBy].callSign
        });
      }

      // Action: REJECT_BOUNTY (Banker)
      if (action === 'REJECT_BOUNTY') {
        const bountyId = body.bountyId;
        const bounty = (state.bounties || []).find(b => b.id === bountyId);
        if (!bounty) return res.status(404).json({ ok: false, error: 'Bounty not found.' });

        bounty.status = 'CLAIMED';
        bounty.rejectReason = (body.reason || 'Needs additional polish / inspection criteria not met').trim();

        await saveGistState(state);
        return res.status(200).json({ ok: true, bounty, message: 'Bounty returned for rework.' });
      }

      // Action: DIRECT_DEPOSIT (Banker)
      if (action === 'DIRECT_DEPOSIT') {
        const operativeId = body.operativeId;
        const amount = Math.max(0.01, Math.round((parseFloat(body.amount) || 0) * 100) / 100);
        const memo = (body.memo || 'Direct Deposit Bonus').trim();

        if (!state.operatives[operativeId]) return res.status(400).json({ ok: false, error: 'Unknown operative.' });

        const tx = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: new Date().toISOString(),
          operativeId,
          type: 'DEPOSIT',
          amount,
          category: body.category || 'Direct Credit',
          memo,
          authorizer: 'BANKER'
        };

        state.transactions = state.transactions || [];
        state.transactions.unshift(tx);
        computeBalances(state);
        await saveGistState(state);

        return res.status(200).json({
          ok: true,
          transaction: tx,
          newBalance: state.operatives[operativeId].balance,
          message: 'Deposited $' + amount.toFixed(2) + ' to ' + state.operatives[operativeId].callSign
        });
      }

      // Action: PROCESS_DEBIT (Banker)
      if (action === 'PROCESS_DEBIT') {
        const operativeId = body.operativeId;
        const amount = Math.max(0.01, Math.round((parseFloat(body.amount) || 0) * 100) / 100);
        const memo = (body.memo || 'Redemption / Purchase').trim();

        if (!state.operatives[operativeId]) return res.status(400).json({ ok: false, error: 'Unknown operative.' });
        
        if (state.operatives[operativeId].balance < amount) {
          return res.status(400).json({
            ok: false,
            error: 'Insufficient funds. Operative balance is $' + state.operatives[operativeId].balance.toFixed(2)
          });
        }

        const tx = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: new Date().toISOString(),
          operativeId,
          type: 'DEBIT',
          amount,
          category: body.category || 'REDEMPTION_SPEND',
          memo,
          authorizer: 'BANKER'
        };

        state.transactions = state.transactions || [];
        state.transactions.unshift(tx);
        computeBalances(state);
        await saveGistState(state);

        return res.status(200).json({
          ok: true,
          transaction: tx,
          newBalance: state.operatives[operativeId].balance,
          message: 'Debited $' + amount.toFixed(2) + ' from ' + state.operatives[operativeId].callSign
        });
      }

      // Action: REQUEST_SPEND (Operative - No PIN needed)
      if (action === 'REQUEST_SPEND') {
        const operativeId = body.operativeId;
        const amount = Math.max(0.01, Math.round((parseFloat(body.amount) || 0) * 100) / 100);
        const item = (body.item || '').trim();

        if (!state.operatives[operativeId]) return res.status(400).json({ ok: false, error: 'Unknown operative.' });
        if (!item || amount <= 0) return res.status(400).json({ ok: false, error: 'Item and amount required.' });

        const request = {
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          operativeId,
          item,
          amount,
          status: 'PENDING',
          requestedAt: new Date().toISOString()
        };

        state.spendRequests = state.spendRequests || [];
        state.spendRequests.unshift(request);
        await saveGistState(state);

        return res.status(200).json({ ok: true, request, message: 'Spend request submitted for Banker approval.' });
      }

      // Action: APPROVE_SPEND (Banker)
      if (action === 'APPROVE_SPEND') {
        const requestId = body.requestId;
        const reqItem = (state.spendRequests || []).find(r => r.id === requestId);
        if (!reqItem) return res.status(404).json({ ok: false, error: 'Request not found.' });

        reqItem.status = 'APPROVED';
        reqItem.approvedAt = new Date().toISOString();

        const tx = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: new Date().toISOString(),
          operativeId: reqItem.operativeId,
          type: 'DEBIT',
          amount: reqItem.amount,
          category: 'APPROVED_REQUEST',
          memo: reqItem.item,
          authorizer: 'BANKER'
        };

        state.transactions = state.transactions || [];
        state.transactions.unshift(tx);
        computeBalances(state);
        await saveGistState(state);

        return res.status(200).json({ ok: true, transaction: tx, message: 'Spend approved and debited.' });
      }

      // Action: CANCEL_BOUNTY (Banker)
      if (action === 'CANCEL_BOUNTY') {
        const bountyId = body.bountyId;
        const bounty = (state.bounties || []).find(b => b.id === bountyId);
        if (!bounty) return res.status(404).json({ ok: false, error: 'Bounty not found.' });

        bounty.status = 'CANCELLED';
        await saveGistState(state);
        return res.status(200).json({ ok: true, message: 'Bounty cancelled.' });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action: ' + action });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Treasury API Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
