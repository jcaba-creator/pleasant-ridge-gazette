// Serverless Live Grocery Procurement Refresh Worker: /api/refresh-groceries
// Pulls real-time shelf prices across Leavenworth / Easton corridor feeds:
// 1. Fort Leavenworth Commissary (DeCA Click2Go / NCR Freshop REST API - Store 5878)
// 2. Price Chopper Leavenworth (Balls Foods Store #61 Circular API & Flipp 66048)
// 3. ALDI, Walmart & Dillons (Flipp 66048 & Corridor Spec-Validated Feed)
// Returns updated currentBasket prices and exact per-store scrape timestamps.

const COMMISSARY_BASE = 'https://api.prd.freshop.retail.ncrgov.com/1/products';
const COMMISSARY_UPCS = {
  ground_beef: '20165900000',
  eggs_dozen: '2862112398',
  whole_milk: '7206000117',
  russet_potatoes: '470930000',
  sandwich_bread: '84279811084'
};

const FLIPP_SEARCH = 'https://backflipp.wishabi.com/flipp/items/search?postal_code=66048';

function isValidStapleMatch(itemKey, itemName, price) {
  const name = String(itemName || '').toLowerCase();
  if (itemKey === 'ground_beef') {
    if (['patties', 'patty', 'organic', 'grass-fed', 'grass fed', '2 lb', '3 lb', '5 lb', 'slider'].some(w => name.includes(w))) return false;
    return (name.includes('ground beef') || name.includes('80%') || name.includes('80/20')) && price >= 3.0 && price <= 7.0;
  }
  if (itemKey === 'eggs_dozen') {
    if (['18 ct', '18-ct', '24 ct', '30 ct', '60 ct', 'organic', 'pasture', 'cage-free', 'cage free', 'liquid'].some(w => name.includes(w))) return false;
    return name.includes('egg') && price >= 1.0 && price <= 4.5;
  }
  if (itemKey === 'whole_milk') {
    if (['half gallon', '1/2 gal', 'chocolate', 'fairlife', 'organic', 'almond', 'oat', 'soy', 'lactose', 'pint', 'quart'].some(w => name.includes(w))) return false;
    return name.includes('milk') && price >= 2.0 && price <= 5.5;
  }
  if (itemKey === 'russet_potatoes') {
    if (['yellow', 'red', 'gold', 'bite', 'sweet', '10 lb', '15 lb', 'mashed'].some(w => name.includes(w))) return false;
    return name.includes('russet') && name.includes('potato') && price >= 1.2 && price <= 5.0;
  }
  if (itemKey === 'sandwich_bread') {
    if (['garlic', 'knot', 'oroweat', 'artisan', 'keto', 'gluten', 'sourdough', 'cinnamon', 'raisin', 'french', 'italian', 'bun', 'roll'].some(w => name.includes(w))) return false;
    return name.includes('bread') && (name.includes('white') || name.includes('sandwich') || name.includes('enriched')) && price >= 1.0 && price <= 3.5;
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const storeTimestamps = {};
  const livePrices = {
    commissary: {},
    price_chopper: {},
    dillons: {},
    aldi: {},
    walmart: {}
  };

  try {
    // 1. Pull Fort Leavenworth Commissary (Store 5878)
    await Promise.all(
      Object.entries(COMMISSARY_UPCS).map(async ([itemKey, upc]) => {
        try {
          const url = `${COMMISSARY_BASE}?app_key=deca&store_id=5878&q=${upc}`;
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(6000)
          });
          if (r.ok) {
            const d = await r.json();
            const first = (d.items || [])[0];
            if (first && first.price) {
              const p = parseFloat(String(first.price).replace('$', '').trim());
              if (!isNaN(p) && p > 0) {
                livePrices.commissary[itemKey] = Number(p.toFixed(2));
              }
            }
          }
        } catch (err) {
          // fallback handled client-side
        }
      })
    );
    storeTimestamps.commissary = new Date().toISOString();

    // 2. Pull Flipp 66048 Corridor Feeds (Price Chopper, ALDI, Walmart, Dillons)
    const stapleTerms = {
      ground_beef: 'ground beef',
      eggs_dozen: 'large eggs',
      whole_milk: 'whole milk gallon',
      russet_potatoes: 'russet potatoes',
      sandwich_bread: 'white bread'
    };

    await Promise.all(
      Object.entries(stapleTerms).map(async ([itemKey, q]) => {
        try {
          const r = await fetch(`${FLIPP_SEARCH}&q=${encodeURIComponent(q)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(6000)
          });
          if (r.ok) {
            const fData = await r.json();
            for (const it of fData.items || []) {
              const merchant = String(it.merchant_name || it.merchant || '').toLowerCase();
              const itemName = String(it.name || '');
              const rawPrice = it.current_price ?? it.price;
              if (rawPrice === null || rawPrice === undefined) continue;
              const p = Number(parseFloat(rawPrice).toFixed(2));
              if (!isValidStapleMatch(itemKey, itemName, p)) continue;

              if (merchant.includes('price chopper') && !livePrices.price_chopper[itemKey]) {
                livePrices.price_chopper[itemKey] = p;
              } else if (merchant.includes('aldi') && !livePrices.aldi[itemKey]) {
                livePrices.aldi[itemKey] = p;
              } else if (merchant.includes('walmart') && !livePrices.walmart[itemKey]) {
                livePrices.walmart[itemKey] = p;
              } else if ((merchant.includes('dillons') || merchant.includes('kroger')) && !livePrices.dillons[itemKey]) {
                livePrices.dillons[itemKey] = p;
              }
            }
          }
        } catch (err) {
          // ignore individual term timeout
        }
      })
    );

    const nowIso = new Date().toISOString();
    storeTimestamps.price_chopper = nowIso;
    storeTimestamps.dillons = nowIso;
    storeTimestamps.aldi = nowIso;
    storeTimestamps.walmart = nowIso;

    return res.status(200).json({
      ok: true,
      publishedAt: nowIso,
      storeTimestamps,
      livePrices
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
