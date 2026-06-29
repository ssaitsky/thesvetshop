const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.Resend_API_Key;
const NOTIFY_EMAIL = 'svetlana.thisisit@gmail.com';

// Printful product template IDs — one per mantra+color combo
// Mantra text (lowercase) → { blue: templateId, black: templateId }
const PRODUCT_TEMPLATES = {
  'this is it':                                          { blue: '104393357', black: '104409277' },
  "i'm pretty ok":                                       { blue: '104407970', black: '104410004' },
  'when is now':                                         { blue: '104408792', black: '104409171' },
  'a no is a yes to something better':                   { blue: '104408238', black: '104409834' },
  'i am exactly perfectly on time':                      { blue: '104408137', black: '104409737' },
  'flexibility is opportunity':                          { blue: '104408441', black: '104409521' },
  'i stabilize at a magical frequency':                  { blue: '104408650', black: '104409410' },
  'the more i slow down the more time i seem to have':  { blue: '104408850', black: '104409048' },
};

function getTemplateId(mantra, color) {
  const key = mantra.toLowerCase().trim();
  const entry = PRODUCT_TEMPLATES[key];
  if (!entry) return null;
  return color === 'black' ? entry.black : entry.blue;
}

function colorKey(colorLabel) {
  return colorLabel?.toLowerCase().includes('black') ? 'black' : 'blue';
}

async function createPrintfulOrder(session) {
  const meta = session.metadata || {};
  const mantra = meta.mantra || '';
  const color = colorKey(meta.color);
  const size = meta.size || 'M';
  const templateId = getTemplateId(mantra, color);

  if (!templateId) {
    throw new Error(`No Printful template found for mantra="${mantra}" color="${color}"`);
  }

  const shipping = session.shipping_details || session.shipping || {};
  const addr = shipping.address || {};
  const name = shipping.name || session.customer_details?.name || 'Customer';
  const email = session.customer_details?.email || '';

  const body = {
    recipient: {
      name,
      email,
      address1: addr.line1 || '',
      address2: addr.line2 || '',
      city: addr.city || '',
      state_code: addr.state || '',
      country_code: addr.country || 'US',
      zip: addr.postal_code || '',
    },
    items: [
      {
        product_template_id: templateId,
        quantity: 1,
        size,
        retail_price: '44.00',
      },
    ],
  };

  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
      'X-PF-Store-Id': PRINTFUL_STORE_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sendFailureEmail(session) {
  if (!RESEND_API_KEY) return;
  const meta = session.metadata || {};
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'The Svet Shop <hello@thesvetshop.com>',
      to: NOTIFY_EMAIL,
      subject: 'Payment failed — Svet Shop',
      html: `<p>A payment failed or was not completed.</p>
             <p><strong>Mantra:</strong> ${meta.mantra || 'unknown'}<br>
             <strong>Color:</strong> ${meta.color || 'unknown'}<br>
             <strong>Size:</strong> ${meta.size || 'unknown'}<br>
             <strong>Session ID:</strong> ${session.id}</p>`,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = verifyStripeWebhook(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;

  if (event.type === 'checkout.session.completed') {
    try {
      const order = await createPrintfulOrder(session);
      console.log('Printful order created:', order?.result?.id);
    } catch (err) {
      console.error('Printful order failed:', err.message);
    }
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    try {
      await sendFailureEmail(session);
    } catch (err) {
      console.error('Failed to send failure email:', err.message);
    }
  }

  return res.status(200).json({ received: true });
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifyStripeWebhook(payload, header, secret) {
  const crypto = require('crypto');
  const parts = header.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const sig = parts['v1'];
  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');

  if (expected !== sig) throw new Error('Invalid signature');
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) throw new Error('Timestamp too old');

  return JSON.parse(payload);
}
