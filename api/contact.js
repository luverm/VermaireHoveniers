import { serviceClient } from './_lib/supabase.js';
import { stuurMail, bevestigingAanKlant, meldingAanHovenier } from './_lib/mail.js';
import { createHash } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SITE = (process.env.SITE_URL || 'https://www.vermairehoveniers.nl').replace(/\/$/, '');

// Waar de melding heen gaat en welk telefoonnummer in de bevestiging staat.
// Instelbaar in het portaal, zodat dat niet in Vercel hoeft.
async function contactgegevens(sb) {
    const standaard = {
        meldAdres: 'info@vermairehoveniers.nl',
        telefoon: '+31 6 23 29 32 74',
    };

    try {
        const [site, admin] = await Promise.all([
            sb.from('site_settings').select('key, value').in('key', ['contact_email', 'contact_phone']),
            sb.from('admin_settings').select('value').eq('key', 'meld_email').maybeSingle(),
        ]);

        const map = Object.fromEntries((site.data || []).map((r) => [r.key, r.value]));
        return {
            meldAdres: (admin.data?.value || '').trim() || map.contact_email || standaard.meldAdres,
            telefoon: map.contact_phone || standaard.telefoon,
        };
    } catch {
        return standaard;
    }
}

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
        const sb = serviceClient();

        const { error } = await sb
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

        // De aanvraag staat veilig opgeslagen. Vanaf hier mag er van alles
        // misgaan met de mail zonder dat de bezoeker daar iets van merkt:
        // een lead verliezen omdat de mailserver hapert is het ergste wat
        // er kan gebeuren.
        //
        // Wel áfwachten en niet losjes wegsturen: op Vercel wordt de functie
        // afgekapt zodra het antwoord de deur uit is, en dan vertrekt de mail
        // soms wel en soms niet.
        const { meldAdres, telefoon } = await contactgegevens(sb);

        const [klant, hovenier] = await Promise.all([
            stuurMail(bevestigingAanKlant({ naam: name, dienst: service, bericht: message, telefoon, email })),
            stuurMail(meldingAanHovenier({
                naam: name, email, telefoon: phone, dienst: service,
                bericht: message, site: SITE, naarAdres: meldAdres,
            })),
        ]);

        if (!klant.verstuurd) console.warn('[contact] bevestiging niet verstuurd:', klant.reden);
        if (!hovenier.verstuurd) console.warn('[contact] melding niet verstuurd:', hovenier.reden);

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[contact] unexpected error:', err);
        return res.status(500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.' });
    }
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return {}; }
}
