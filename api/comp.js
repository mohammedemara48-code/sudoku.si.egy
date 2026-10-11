import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const KEY = 'comp:dailyBest';

  if (req.method === 'GET') {
    try {
      const best = await kv.get(KEY);
      if (best && Date.now() - best.ts < 24 * 60 * 60 * 1000) {
        return res.json({ ok: true, best });
      }
      return res.json({ ok: true, best: null });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { name, time, sec, email } = req.body || {};
    if (!name || !time) return res.status(400).json({ error: 'بيانات ناقصة' });

    try {
      const current = await kv.get(KEY);
      if (!current || sec < current.sec) {
        const best = { name, time, sec, email, ts: Date.now() };
        await kv.set(KEY, best);
        return res.json({ ok: true, updated: true, best });
      }
      return res.json({ ok: true, updated: false, best: current });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
