import { anonClient } from './_lib/supabase.js';

// Returns the editable site copy as a flat object: { key: value, ... }
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data, error } = await anonClient()
            .from('site_settings')
            .select('key, value');

        if (error) {
            console.error('[site-settings] read error:', error);
            return res.status(500).json({ error: 'Kon de instellingen niet laden.' });
        }

        const settings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ settings });
    } catch (err) {
        console.error('[site-settings] unexpected:', err);
        return res.status(500).json({ error: 'Onverwachte fout.' });
    }
}
