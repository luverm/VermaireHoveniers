import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
}

// Service-role client — bypasses RLS. Server-side only, never sent to the browser.
export function serviceClient() {
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Verifies a Supabase access token and returns the user, or null.
export async function getUserFromToken(token) {
    if (!token) return null;
    const { data, error } = await serviceClient().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
}

export function bearer(req) {
    const h = req.headers.authorization || '';
    return h.startsWith('Bearer ') ? h.slice(7) : '';
}
