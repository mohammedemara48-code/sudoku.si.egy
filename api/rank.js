import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const emails = await kv.smembers('users:list') || [];
    const users = [];
    for (const email of emails) {
      const u = await kv.get(`user:${email}`);
      if (u) users.push({ email, name: u.name || email.split('@')[0], points: u.points || 0 });
    }
    users.sort((a, b) => b.points - a.points);
    return res.json({ ok: true, rank: users });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الترتيب', detail: e.message });
  }
}
