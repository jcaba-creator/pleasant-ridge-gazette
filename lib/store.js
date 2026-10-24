// Vercel KV Abstraction Layer with Graceful In-Memory Fallback
let localCache = new Map();

export async function kvGet(key) {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const val = await kv.get(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch (err) {}
  return localCache.get(key) || null;
}

export async function kvSet(key, value, options = {}) {
  localCache.set(key, value);
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      await kv.set(key, value, options);
      return true;
    }
  } catch (err) {}
  return false;
}
