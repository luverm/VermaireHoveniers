import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
    console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
}

// Service-role client — bypasses RLS. Server-side only, never sent to the browser.
export function serviceClient() {
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Anonymous client — RLS-protected reads, safe for public endpoints.
export function anonClient() {
    return createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Public URL for a file in a public Supabase Storage bucket.
export function publicStorageUrl(bucket, path) {
    if (!url || !path) return null;
    return `${url}/storage/v1/object/public/${bucket}/${path}`;
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
