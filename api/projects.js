import { anonClient, publicStorageUrl } from './_lib/supabase.js';

// Returns published projects with their photos resolved to public URLs.
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const sb = anonClient();
        const { data, error } = await sb
            .from('projects')
            .select('id, title, description, location, sort_order, created_at, project_photos(id, storage_path, alt, sort_order)')
            .eq('published', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[projects] read error:', error);
            return res.status(500).json({ error: 'Kon de projecten niet laden.' });
        }

        const projects = (data || []).map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            location: p.location || '',
            created_at: p.created_at,
            photos: (p.project_photos || [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((ph) => ({
                    id: ph.id,
                    alt: ph.alt || p.title,
                    url: publicStorageUrl('project-photos', ph.storage_path),
                })),
        }));

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ projects });
    } catch (err) {
        console.error('[projects] unexpected:', err);
        return res.status(500).json({ error: 'Onverwachte fout.' });
    }
}
