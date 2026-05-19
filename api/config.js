// Returns the *public* Supabase values so the static admin portal can
// initialise the JS client. The anon key is safe to expose — Row Level
// Security protects the data. The service role key is NEVER sent here.
export default function handler(req, res) {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;

    if (!url || !anon) {
        return res.status(500).json({ error: 'Supabase is niet geconfigureerd.' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ supabaseUrl: url, supabaseAnonKey: anon });
}
