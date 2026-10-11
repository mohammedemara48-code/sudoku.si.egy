import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name } = req.body || {};
  const key = `user:${(email || '').toLowerCase()}`;

  try {
    if (action === 'register') {
      const exists = await kv.exists(key);
      if (exists) return res.status(400).json({ error: 'الحساب موجود' });
      const user = { email: email.toLowerCase(), pass: password, name: name || email.split('@')[0], points: 0 };
      await kv.set(key, user);
      await kv.sadd('users:list', email.toLowerCase());
      return res.json({ ok: true, user: { email: user.email, name: user.name, points: 0 } });
    }

    if (action === 'login') {
      const user = await kv.get(key);
      if (!user || user.pass !== password) return res.status(401).json({ error: 'بيانات خاطئة' });
      return res.json({ ok: true, user: { email: user.email, name: user.name, points: user.points || 0 } });
    }

    if (action === 'addPoints') {
      const user = await kv.get(key);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      user.points = (user.points || 0) + (req.body.points || 0);
      await kv.set(key, user);
      return res.json({ ok: true, points: user.points });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في السيرفر', detail: e.message });
  }
}
