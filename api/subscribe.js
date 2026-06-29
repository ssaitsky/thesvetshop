const KIT_API_KEY = process.env.KIT_API_KEY;
const RESEND_API_KEY = process.env.Resend_API_Key;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, source, formId } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KIT_API_KEY, email, tags: [source] }),
    });

    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'The Svet Shop <hello@thesvetshop.com>',
          to: 'svetlana.thisisit@gmail.com',
          subject: 'New Svet Shop signup',
          html: `<p>New welcome popup signup: <strong>${email}</strong></p>`,
        }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
