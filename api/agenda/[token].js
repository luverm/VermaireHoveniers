import crypto from 'node:crypto';
import { serviceClient } from '../_lib/supabase.js';
import { buildCalendar } from '../_lib/ics.js';

// ----------------------------------------------------------------------------
// Read-only agenda-feed voor Apple Agenda (en elke andere ICS-client).
//
//   webcal://www.vermairehoveniers.nl/api/agenda/<token>.ics
//
// De URL bevat een geheim token — wie hem heeft, ziet de planning. Er is dus
// geen login; het token IS het wachtwoord. Rotatie gaat via het admin portaal.
// ----------------------------------------------------------------------------

const SITE = (process.env.SITE_URL || 'https://www.vermairehoveniers.nl').replace(/\/$/, '');

// Hoever de feed terug- en vooruitkijkt. Apple hoeft geen historie van jaren.
const DAYS_BACK = 90;
const DAYS_AHEAD = 400;

const SOORT_LABEL = {
    beplanting: 'Beplanting',
    groenadvies: 'Groenadvies',
    onderhoud: 'Onderhoud',
    bezichtiging: 'Bezichtiging',
    anders: 'Overig',
};

const STATUS_ICS = {
    gepland: 'CONFIRMED',
    bezig: 'CONFIRMED',
    afgerond: 'CONFIRMED',
    geannuleerd: 'CANCELLED',
};

// Vergelijkt twee tokens zonder dat de looptijd iets over de inhoud verraadt.
function tokensMatch(a, b) {
    if (!a || !b) return false;
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function addDays(date, days) {
    const out = new Date(date);
    out.setDate(out.getDate() + days);
    return out;
}

// Plakt de losse adresvelden aan elkaar tot iets wat Apple Kaarten snapt.
function formatAddress(klus, klant) {
    if (klus.adres) return klus.adres;
    if (!klant) return '';
    const street = klant.adres || '';
    const city = [klant.postcode, klant.plaats].filter(Boolean).join(' ');
    return [street, city].filter(Boolean).join(', ');
}

// Hele aantallen zonder komma, halven met een Nederlandse komma.
function hoeveelheid(aantal, eenheid) {
    const n = Number(aantal);
    if (!Number.isFinite(n)) return '';
    const tekst = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    return `${tekst} ${eenheid || 'stuk'}`;
}

// Afvinklijst voor in de agenda. Apple toont platte tekst, dus een vakje is
// een teken en geen aankruisvakje: aanvinken doe je in het portaal.
function checklist(materialen) {
    if (!materialen || !materialen.length) return [];

    const regels = [...materialen].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const groepen = [
        ['Meenemen', regels.filter((m) => m.soort === 'gereedschap')],
        ['Verbruik', regels.filter((m) => m.soort !== 'gereedschap')],
    ];

    const uit = [];
    for (const [titel, lijst] of groepen) {
        if (!lijst.length) continue;
        uit.push('', `${titel}:`);
        for (const m of lijst) {
            uit.push(`${m.afgevinkt ? '☑' : '☐'} ${m.omschrijving} — ${hoeveelheid(m.aantal, m.eenheid)}`);
        }
    }
    return uit;
}

function buildDescription(klus, klant) {
    const parts = [];

    if (klant) {
        parts.push(`Klant: ${klant.naam}${klant.bedrijf ? ` (${klant.bedrijf})` : ''}`);
        if (klant.telefoon) parts.push(`Telefoon: ${klant.telefoon}`);
    }

    parts.push(`Soort: ${SOORT_LABEL[klus.soort] || klus.soort}`);

    if (klus.status && klus.status !== 'gepland') {
        parts.push(`Status: ${klus.status}`);
    }
    if (klus.weersgevoelig) {
        parts.push('Weersgevoelig — check de buienradar.');
    }
    if (klus.omschrijving) {
        parts.push('', klus.omschrijving);
    }

    parts.push(...checklist(klus.materialen));

    parts.push('', `Openen in het portaal: ${SITE}/admin?klus=${klus.id}`);

    return parts.join('\n');
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method not allowed');
    }

    // Zoekmachines en previews moeten hier nooit induiken.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, no-store');

    // De route accepteert zowel /api/agenda/<token> als /api/agenda/<token>.ics
    const token = String(req.query?.token || '').trim().replace(/\.ics$/i, '');
    if (!token) return res.status(404).send('Not found');

    try {
        const sb = serviceClient();

        const { data: feed, error: feedError } = await sb
            .from('agenda_feed')
            .select('token')
            .eq('id', true)
            .maybeSingle();

        if (feedError) {
            console.error('[agenda] feed lookup error:', feedError);
            return res.status(500).send('Server error');
        }

        // Onbekend token krijgt 404, niet 403: verklap niet dat de feed bestaat.
        if (!feed || !tokensMatch(token, feed.token)) {
            return res.status(404).send('Not found');
        }

        const now = new Date();
        const from = addDays(now, -DAYS_BACK).toISOString();
        const until = addDays(now, DAYS_AHEAD).toISOString();

        const [{ data: klussen, error: klussenError }, { data: settings }] = await Promise.all([
            sb
                .from('klussen')
                .select(
                    'id, titel, soort, start_tijd, eind_tijd, adres, omschrijving, status, ' +
                    'weersgevoelig, created_at, updated_at, ' +
                    'klanten(naam, bedrijf, telefoon, adres, postcode, plaats), ' +
                    'materialen(omschrijving, aantal, eenheid, soort, afgevinkt, sort_order)',
                )
                .gte('eind_tijd', from)
                .lte('start_tijd', until)
                .order('start_tijd', { ascending: true }),
            sb.from('admin_settings').select('key, value').eq('key', 'agenda_herinnering_minuten'),
        ]);

        if (klussenError) {
            console.error('[agenda] klussen read error:', klussenError);
            return res.status(500).send('Server error');
        }

        const alarmMinutes = Number((settings || [])[0]?.value ?? 60) || 0;

        const events = (klussen || []).map((klus) => {
            const klant = klus.klanten || null;
            const label = SOORT_LABEL[klus.soort] || '';

            return {
                uid: `klus-${klus.id}@vermairehoveniers.nl`,
                start: klus.start_tijd,
                end: klus.eind_tijd,
                summary: klant ? `${klus.titel} · ${klant.naam}` : klus.titel,
                location: formatAddress(klus, klant),
                description: buildDescription(klus, klant),
                url: `${SITE}/admin?klus=${klus.id}`,
                categories: label,
                status: STATUS_ICS[klus.status] || 'CONFIRMED',
                createdAt: klus.created_at,
                updatedAt: klus.updated_at,
                alarmMinutes,
            };
        });

        const ics = buildCalendar({
            name: 'Vermaire Hoveniers',
            description: 'Planning vanuit het Vermaire Hoveniers portaal',
            refreshMinutes: 15,
            events,
        });

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="vermaire-hoveniers.ics"');

        if (req.method === 'HEAD') return res.status(200).end();
        return res.status(200).send(ics);
    } catch (err) {
        console.error('[agenda] unexpected:', err);
        return res.status(500).send('Server error');
    }
}
