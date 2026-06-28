const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const YOUR_DOMAIN = 'https://thesvetshop.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mantra, color, size } = req.body || {};
  if (!mantra || !color || !size) return res.status(400).json({ error: 'Missing fields' });

  const colorLabel = color === 'black' ? 'Black Heather' : 'Ice Blue';

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'allow_promotion_codes': 'true',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `The Mantra Tee — ${mantra}`,
        'line_items[0][price_data][product_data][description]': `${colorLabel} · Size ${size} · "${mantra}"`,
        'line_items[0][price_data][unit_amount]': '3800',
        'line_items[0][quantity]': '1',
        'shipping_address_collection[allowed_countries][0]': 'US',
        'shipping_address_collection[allowed_countries][1]': 'CA',
        'shipping_address_collection[allowed_countries][2]': 'GB',
        'shipping_address_collection[allowed_countries][3]': 'AU',
        'shipping_address_collection[allowed_countries][4]': 'MX',
        'success_url': `${YOUR_DOMAIN}/success.html?mantra=${encodeURIComponent(mantra)}&size=${size}&color=${color}`,
        'cancel_url': `${YOUR_DOMAIN}/#product`,
        'metadata[mantra]': mantra,
        'metadata[color]': colorLabel,
        'metadata[size]': size,
      }),
    });

    const session = await response.json();
    if (!response.ok) throw new Error(session.error?.message || 'Stripe error');
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
