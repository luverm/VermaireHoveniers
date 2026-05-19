import { serviceClient } from './_lib/supabase.js';
import { createHash } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    return s.slice(0, max);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const name = clean(body.name, 200);
    const email = clean(body.email, 200);
    const phone = clean(body.phone, 50);
    const service = clean(body.service, 100);
    const message = clean(body.message, 5000);

    if (!name || !email) {
        return res.status(400).json({ error: 'Naam en e-mailadres zijn verplicht.' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
    }

    // Honeypot — bots fill hidden fields. Pretend success, store nothing.
    if (clean(body.company, 100)) {
        return res.status(200).json({ ok: true });
    }

    const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ipHash = fwd ? createHash('sha256').update(fwd).digest('hex').slice(0, 32) : null;

    try {
        const { error } = await serviceClient()
            .from('contact_requests')
            .insert({
                name,
                email,
                phone,
                service,
                message,
                source: 'website',
                ip_hash: ipHash,
                user_agent: clean(req.headers['user-agent'], 400),
            });

        if (error) {
            console.error('[contact] insert error:', error);
            return res.status(500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.' });
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[contact] unexpected error:', err);
        return res.status(500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.' });
    }
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return {}; }
}
