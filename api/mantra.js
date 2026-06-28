// Vercel serverless function — receives mantra submissions, tags in Kit, emails Svetlana via Resend.

const KIT_API_KEY = 'dpE-uwyWSSgKcXkZQyJ-cw';
const RESEND_API_KEY = process.env.Resend_API_Key;
const NOTIFY_EMAIL = 'svetlana.thisisit@gmail.com';
const KIT_TAG = 'Svet Shop Mantra Submission';

async function findOrCreateTag(tagName) {
  const res = await fetch(`https://api.convertkit.com/v3/tags?api_key=${KIT_API_KEY}`);
  const data = await res.json();
  const existing = (data.tags || []).find(t => t.name.toLowerCase() === tagName.toLowerCase());
  if (existing) return existing.id;
  const create = await fetch('https://api.convertkit.com/v3/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KIT_API_KEY, tag: { name: tagName } }),
  });
  const createData = await create.json();
  return createData.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, mantra } = req.body || {};
  if (!email || !mantra) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Tag subscriber in Kit
    const tagId = await findOrCreateTag(KIT_TAG);
    if (tagId) {
      await fetch(`https://api.convertkit.com/v3/tags/${tagId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: KIT_API_KEY,
          email,
          fields: { mantra_submission: mantra },
        }),
      });
    }

    // Notify Svetlana via Resend
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'The Svet Shop <hello@thesvetshop.com>',
          to: NOTIFY_EMAIL,
          subject: 'New mantra submission',
          text: `Someone submitted a mantra.\n\nMantra: ${mantra}\nEmail: ${email}`,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
