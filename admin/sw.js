/* ==========================================================================
   VERMAIRE HOVENIERS — SERVICE WORKER
   Zorgt dat het portaal opent en werkt zonder bereik. Een hovenier staat in
   een tuin in Zeeland, niet naast een router.

   Harde regel: bedrijfsdata en inloggegevens gaan NOOIT in de cache. Alles
   richting Supabase is netwerk-only. Wat we bewaren is de schil (HTML, CSS,
   JS, iconen) plus het weer, want dat is publieke informatie.
   ========================================================================== */

const VERSIE = 'vermaire-2026-09-10a';
const SCHIL = `schil-${VERSIE}`;
const DATA = `data-${VERSIE}`;

// Alles wat nodig is om het portaal te tonen zonder verbinding.
const SCHIL_BESTANDEN = [
    '/admin',
    '/css/admin.css',
    '/js/admin.js',
    '/js/weer.js',
    '/js/app.js',
    '/assets/logo.png',
    '/assets/app/icon-192.png',
    '/admin/manifest.webmanifest',
];

// Deze hosts leveren de bibliotheek en de lettertypen. Zonder deze in de
// cache staat er offline wel een pagina, maar werkt er niets.
const EXTERNE_SCHIL = [
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(SCHIL);
        // Losse verzoeken: één 404 mag niet de hele installatie laten mislukken.
        await Promise.all(SCHIL_BESTANDEN.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const namen = await caches.keys();
        await Promise.all(namen
            .filter((n) => n !== SCHIL && n !== DATA)
            .map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});

// De pagina vraagt om de wissel zodra de gebruiker op "vernieuwen" tikt.
self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- strategieën ---------- */

// Scripts en lettertypen van een andere host komen binnen als "opaque":
// een antwoord waar we niet in kunnen kijken, met status 0. Die moeten we
// wél bewaren — anders ontbreekt offline juist de Supabase-bibliotheek en
// start het portaal helemaal niet op.
const bewaarbaar = (res) => res && (res.ok || res.type === 'opaque');

async function netwerkEerst(request, cacheNaam) {
    const cache = await caches.open(cacheNaam);
    try {
        const res = await fetch(request);
        if (bewaarbaar(res)) cache.put(request, res.clone());
        return res;
    } catch (err) {
        const bewaard = await cache.match(request);
        if (bewaard) return bewaard;
        throw err;
    }
}

// Meteen uit de cache antwoorden en op de achtergrond verversen. Snel bij
// het openen, en de volgende keer weer actueel.
async function uitCacheEnVerversen(request, cacheNaam, event) {
    const cache = await caches.open(cacheNaam);
    const bewaard = await cache.match(request);

    const vers = fetch(request).then((res) => {
        if (bewaarbaar(res)) cache.put(request, res.clone());
        return res;
    }).catch(() => null);

    if (bewaard) {
        // Verversen mag doorlopen nadat we al geantwoord hebben.
        event?.waitUntil(vers);
        return bewaard;
    }

    const res = await vers;
    return res || new Response('Offline en niet in de cache.', {
        status: 504,
        statusText: 'Offline',
    });
}

self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Supabase: inloggen, klanten, klussen. Nooit bewaren, nooit onderscheppen.
    if (url.hostname.endsWith('.supabase.co')) return;

    // De agendafeed bevat het geheime token — die hoort niet op schijf.
    if (url.pathname.startsWith('/api/agenda/')) return;

    // Navigatie: eerst het net, anders de bewaarde schil. Zo opent het
    // portaal ook zonder bereik in plaats van een foutpagina te tonen.
    if (request.mode === 'navigate') {
        e.respondWith((async () => {
            try {
                return await fetch(request);
            } catch (err) {
                const cache = await caches.open(SCHIL);
                return (await cache.match('/admin')) || Response.error();
            }
        })());
        return;
    }

    // Het weer is publieke informatie en mag oud getoond worden — beter een
    // verwachting van een uur oud dan een leeg vak.
    if (url.origin === self.location.origin && url.pathname === '/api/weer') {
        e.respondWith(uitCacheEnVerversen(request, DATA, e));
        return;
    }

    // De sleutels waarmee het portaal opstart. Zonder deze geen app.
    if (url.origin === self.location.origin && url.pathname === '/api/config') {
        e.respondWith(netwerkEerst(request, DATA));
        return;
    }

    // Verder geen API-antwoorden bewaren.
    if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

    // Eigen bestanden en de vaste externe bronnen.
    if (url.origin === self.location.origin || EXTERNE_SCHIL.includes(url.hostname)) {
        e.respondWith(uitCacheEnVerversen(request, SCHIL, e));
    }
});
