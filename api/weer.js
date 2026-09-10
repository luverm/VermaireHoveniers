import { haalWeer, zoekPlaats, WEMELDINGE } from './_lib/weer.js';
import { serviceClient } from './_lib/supabase.js';

// ----------------------------------------------------------------------------
// Samengevoegde weersverwachting voor de planning.
//
// Draait server-side omdat Met.no een eigen User-Agent eist, Buienradar geen
// CORS-headers meestuurt, en omdat de CDN-cache de gratis bronnen ontziet:
// met 15 minuten cache halen we hooguit ~100 verzoeken per dag op, ver onder
// elke limiet.
// ----------------------------------------------------------------------------

// Plaatsnaam → coördinaten verandert nooit; onthouden zolang de functie leeft.
const plaatsCache = new Map();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const locatie = await bepaalLocatie(req.query?.plaats);
        const dagen = Math.min(7, Math.max(1, Number(req.query?.dagen) || 7));

        const weer = await haalWeer(locatie.lat, locatie.lon, dagen);
        weer.locatie = locatie;

        // 15 minuten vers, daarna een uur lang de oude versie serveren terwijl
        // op de achtergrond wordt ververst. Zo wacht Thijmen nooit op de API.
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
        return res.status(200).json(weer);
    } catch (err) {
        console.error('[weer] mislukt:', err);
        return res.status(502).json({ error: 'De weerbronnen zijn even niet bereikbaar.' });
    }
}

// Locatie komt uit de query, anders uit de portaalinstellingen, anders
// Wemeldinge. De instelling is een plaatsnaam — coördinaten intypen hoeft niet.
async function bepaalLocatie(uitQuery) {
    let plaats = (uitQuery || '').trim();

    if (!plaats) {
        try {
            const { data } = await serviceClient()
                .from('admin_settings').select('value').eq('key', 'weer_plaats').maybeSingle();
            plaats = (data?.value || '').trim();
        } catch {
            // instelling niet leesbaar — dan de standaard
        }
    }

    if (!plaats) return { ...WEMELDINGE };
    if (plaatsCache.has(plaats)) return plaatsCache.get(plaats);

    const gevonden = await zoekPlaats(plaats);
    plaatsCache.set(plaats, gevonden);
    return gevonden;
}
