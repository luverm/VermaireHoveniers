// ----------------------------------------------------------------------------
// Weer voor de planning — meerdere onafhankelijke bronnen, samengevoegd tot
// één verwachting mét een eerlijke betrouwbaarheidsscore.
//
// Waarom meerdere bronnen: één model dat regen voorspelt zegt weinig. Zes
// modellen die het eens zijn zegt veel. De regenkans die hieruit komt is dus
// geen modelgetal maar het aandeel bronnen dat neerslag verwacht — dat is
// uitlegbaar ("4 van de 6 bronnen") en robuuster dan welk model dan ook.
//
// Bronnen:
//   - Open-Meteo levert in één verzoek meerdere nationale weermodellen:
//     KNMI (NL), DWD ICON (DE), ECMWF (EU), UK Met Office (VK), GFS (VS).
//   - Met.no (Noors KNMI) draait op eigen infrastructuur — echt losstaand.
//   - Buienradar geeft metingen van het dichtstbijzijnde KNMI-station en een
//     neerslagverwachting voor de komende twee uur.
// ----------------------------------------------------------------------------

const TIMEOUT_MS = 6000;

// Zeeuwse standaardlocatie als geocoding faalt of niets is ingesteld.
export const WEMELDINGE = { lat: 51.5203, lon: 3.9903, plaats: 'Wemeldinge' };

// De modellen die de volle zeven dagen halen, plus twee hoge-resolutiemodellen
// die maar 2 dagen vooruitkijken maar dáár het scherpst zijn.
const MODELLEN = [
    { id: 'knmi_seamless',                   naam: 'KNMI',           bereik: 'week' },
    { id: 'dwd_icon',                        naam: 'DWD (Duitsland)', bereik: 'week' },
    { id: 'ecmwf_ifs025',                    naam: 'ECMWF',          bereik: 'week' },
    { id: 'ukmo_seamless',                   naam: 'Met Office (VK)', bereik: 'week' },
    { id: 'gfs_seamless',                    naam: 'GFS (VS)',       bereik: 'week' },
    { id: 'knmi_harmonie_arome_netherlands', naam: 'KNMI Harmonie',  bereik: 'kort' },
    { id: 'meteofrance_arome_france_hd',     naam: 'AROME (Frankrijk)', bereik: 'kort' },
];

export const WMO = {
    0:  { tekst: 'Onbewolkt',            icoon: '☀️' },
    1:  { tekst: 'Overwegend zonnig',    icoon: '🌤️' },
    2:  { tekst: 'Half bewolkt',         icoon: '⛅' },
    3:  { tekst: 'Bewolkt',              icoon: '☁️' },
    45: { tekst: 'Mist',                 icoon: '🌫️' },
    48: { tekst: 'Aanvriezende mist',    icoon: '🌫️' },
    51: { tekst: 'Lichte motregen',      icoon: '🌦️' },
    53: { tekst: 'Motregen',             icoon: '🌦️' },
    55: { tekst: 'Zware motregen',       icoon: '🌧️' },
    56: { tekst: 'Lichte ijzel',         icoon: '🌨️' },
    57: { tekst: 'IJzel',                icoon: '🌨️' },
    61: { tekst: 'Lichte regen',         icoon: '🌦️' },
    63: { tekst: 'Regen',                icoon: '🌧️' },
    65: { tekst: 'Zware regen',          icoon: '🌧️' },
    66: { tekst: 'Lichte ijzel',         icoon: '🌨️' },
    67: { tekst: 'IJzel',                icoon: '🌨️' },
    71: { tekst: 'Lichte sneeuw',        icoon: '🌨️' },
    73: { tekst: 'Sneeuw',               icoon: '❄️' },
    75: { tekst: 'Zware sneeuw',         icoon: '❄️' },
    77: { tekst: 'Sneeuwkorrels',        icoon: '🌨️' },
    80: { tekst: 'Lichte buien',         icoon: '🌦️' },
    81: { tekst: 'Buien',                icoon: '🌧️' },
    82: { tekst: 'Zware buien',          icoon: '🌧️' },
    85: { tekst: 'Lichte sneeuwbuien',   icoon: '🌨️' },
    86: { tekst: 'Sneeuwbuien',          icoon: '❄️' },
    95: { tekst: 'Onweer',               icoon: '⛈️' },
    96: { tekst: 'Onweer met hagel',     icoon: '⛈️' },
    99: { tekst: 'Zwaar onweer',         icoon: '⛈️' },
};

/* ---------- rekenhulpjes ---------- */

const getal = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function mediaan(reeks) {
    const s = reeks.filter((v) => v !== null).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// km/u naar Beaufort — een hovenier denkt in windkracht, niet in km/u.
export function beaufort(kmu) {
    if (kmu === null) return null;
    const grenzen = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
    let bft = 0;
    grenzen.forEach((g, i) => { if (kmu >= g) bft = i + 1; });
    return bft;
}

// Verzoek met eigen tijdslimiet. Eén trage bron mag de rest niet ophouden.
async function haal(url, opts = {}) {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
}

// Lokale tijd als "2026-09-10T09:00", zonder om te rekenen naar UTC.
function lokaalUur(date, tijdzone = 'Europe/Amsterdam') {
    const d = new Date(date);
    const p = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tijdzone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
    return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}

/* ---------- bronnen ---------- */

// Meerdere weermodellen in één verzoek. Open-Meteo zet per model een eigen
// achtervoegsel achter elke kolom: precipitation_dwd_icon, enzovoort.
async function openMeteo(lat, lon, dagen) {
    const velden = 'temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code';
    const data = await haal(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=${velden}&models=${MODELLEN.map((m) => m.id).join(',')}` +
        `&timezone=Europe%2FAmsterdam&forecast_days=${dagen}`);

    const uren = data.hourly?.time || [];
    const reeksen = [];

    for (const model of MODELLEN) {
        const kolom = (veld) => data.hourly?.[`${veld}_${model.id}`] || [];
        const temp = kolom('temperature_2m');
        if (!temp.length) continue;

        const punten = new Map();
        uren.forEach((tijd, i) => {
            const t = getal(temp[i]);
            if (t === null) return;                       // model reikt niet zo ver
            punten.set(tijd, {
                temp: t,
                mm: getal(kolom('precipitation')[i]) ?? 0,
                wind: getal(kolom('wind_speed_10m')[i]),
                stoot: getal(kolom('wind_gusts_10m')[i]),
                code: getal(kolom('weather_code')[i]),
            });
        });

        if (punten.size) reeksen.push({ id: model.id, naam: model.naam, punten });
    }

    return reeksen;
}

// Het Noorse meteorologisch instituut. Andere infrastructuur, andere
// nabewerking — daarom een echt onafhankelijke stem naast Open-Meteo.
async function metNo(lat, lon) {
    const data = await haal(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact` +
        `?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
        { headers: { 'User-Agent': 'VermaireHoveniers/1.0 (info@vermairehoveniers.nl)' } });

    const punten = new Map();
    for (const stap of data.properties?.timeseries || []) {
        const det = stap.data?.instant?.details || {};
        const uur = stap.data?.next_1_hours;
        if (!uur) continue;                                // verderop alleen 6-uursblokken

        punten.set(lokaalUur(stap.time), {
            temp: getal(det.air_temperature),
            mm: getal(uur.details?.precipitation_amount) ?? 0,
            wind: det.wind_speed != null ? det.wind_speed * 3.6 : null,
            stoot: null,                                   // levert Met.no hier niet
            code: null,
        });
    }

    return punten.size ? [{ id: 'metno', naam: 'Met.no (Noorwegen)', punten }] : [];
}

// Metingen van het dichtstbijzijnde KNMI-station plus de landelijke
// vijfdaagse. Geen model maar de werkelijkheid — goed als ijkpunt.
async function buienradar(lat, lon) {
    const data = await haal('https://data.buienradar.nl/2.0/feed/json');

    const stations = data.actual?.stationmeasurements || [];
    let dichtstbij = null;
    for (const s of stations) {
        if (s.temperature == null) continue;               // station levert niets
        const km = Math.hypot((s.lat - lat) * 111, (s.lon - lon) * 69);
        if (!dichtstbij || km < dichtstbij.km) dichtstbij = { ...s, km };
    }

    const nu = dichtstbij ? {
        station: dichtstbij.stationname.replace(/^Meetstation /, ''),
        km: Math.round(dichtstbij.km),
        temp: getal(dichtstbij.temperature),
        gevoel: getal(dichtstbij.feeltemperature),
        wind: dichtstbij.windspeed != null ? Math.round(dichtstbij.windspeed * 3.6) : null,
        stoot: dichtstbij.windgusts != null ? Math.round(dichtstbij.windgusts * 3.6) : null,
        bft: getal(dichtstbij.windspeedBft),
        regen_mm_uur: getal(dichtstbij.rainFallLastHour),
        omschrijving: dichtstbij.weatherdescription || null,
        gemeten: dichtstbij.timestamp || null,
    } : null;

    const dagen = (data.forecast?.fivedayforecast || []).map((d) => ({
        datum: String(d.day).slice(0, 10),
        min: getal(d.mintemperatureMin ?? Number(d.mintemperature)),
        max: getal(d.maxtemperatureMax ?? Number(d.maxtemperature)),
        regenkans: getal(d.rainChance),
        mm: getal(d.mmRainMax),
        zon: getal(d.sunChance),
    }));

    return { nu, dagen, zon_op: data.actual?.sunrise || null, zon_onder: data.actual?.sunset || null };
}

// Neerslagradar: per vijf minuten, twee uur vooruit. Het getal is een
// logaritmische schaal; de formule eronder komt uit hun eigen documentatie.
async function nowcast(lat, lon) {
    const res = await fetch(
        `https://gpsgadget.buienradar.nl/data/raintext?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`${res.status}`);

    const regels = (await res.text()).trim().split('\n');
    const punten = regels.map((r) => {
        const [waarde, tijd] = r.split('|');
        const n = Number(waarde);
        return {
            tijd: (tijd || '').trim(),
            mmu: Number.isFinite(n) ? Math.max(0, 10 ** ((n - 109) / 32)) : 0,
        };
    }).filter((p) => p.tijd);

    // Onder 0,1 mm/u is het radarruis, geen regen.
    const nat = punten.filter((p) => p.mmu >= 0.1);
    return {
        regen_binnen_2u: nat.length > 0,
        begint: nat[0]?.tijd || null,
        piek_mm_uur: Number((punten.length ? Math.max(...punten.map((p) => p.mmu)) : 0).toFixed(1)),
    };
}

/* ---------- samenvoegen ---------- */

// Per uur: wat vinden de bronnen, en hoe eens zijn ze het?
function consensusPerUur(reeksen) {
    const alleUren = new Set();
    reeksen.forEach((r) => r.punten.forEach((_, tijd) => alleUren.add(tijd)));

    return [...alleUren].sort().map((tijd) => {
        const punten = reeksen
            .map((r) => (r.punten.has(tijd) ? { bron: r.naam, ...r.punten.get(tijd) } : null))
            .filter(Boolean);

        const temps = punten.map((p) => p.temp).filter((v) => v !== null);
        const mms = punten.map((p) => p.mm).filter((v) => v !== null);
        const winden = punten.map((p) => p.wind).filter((v) => v !== null);
        const stoten = punten.map((p) => p.stoot).filter((v) => v !== null);
        const codes = punten.map((p) => p.code).filter((v) => v !== null);

        // Dit is de kern: niet een modelkans, maar het aandeel bronnen dat
        // neerslag verwacht. "4 van de 6" is uit te leggen aan een klant.
        const natte = mms.filter((v) => v >= 0.1).length;
        const regenkans = mms.length ? Math.round((natte / mms.length) * 100) : null;

        // Eensgezindheid over de hoofdvraag: wordt het nat of niet?
        const meerderheid = Math.max(natte, mms.length - natte);
        const eensRegen = mms.length ? meerderheid / mms.length : 1;

        // Grote temperatuurspreiding is óók onzekerheid, ook als het droog
        // blijft. Ruime drempels: modellen lopen 's ochtends standaard een paar
        // graden uiteen doordat ze de opwarming anders timen, en dat is voor
        // een hovenier geen onzekerheid die ertoe doet.
        const spreiding = temps.length ? Math.max(...temps) - Math.min(...temps) : 0;

        let zekerheid = 'hoog';
        if (eensRegen < 0.7 || spreiding > 6) zekerheid = 'laag';
        else if (eensRegen < 1 || spreiding > 4) zekerheid = 'redelijk';
        if (punten.length < 3) zekerheid = 'laag';         // te weinig stemmen

        return {
            tijd,
            temp: rond(mediaan(temps), 1),
            temp_min: rond(temps.length ? Math.min(...temps) : null, 1),
            temp_max: rond(temps.length ? Math.max(...temps) : null, 1),
            mm: rond(mediaan(mms), 1),
            mm_max: rond(mms.length ? Math.max(...mms) : null, 1),
            regenkans,
            wind: rond(mediaan(winden), 0),
            windstoot: rond(stoten.length ? Math.max(...stoten) : null, 0),
            code: codes.length ? modus(codes) : null,
            bronnen: punten.length,
            eens: mms.length ? meerderheid : punten.length,
            zekerheid,
        };
    });
}

const rond = (v, n) => (v === null || v === undefined ? null : Number(v.toFixed(n)));

// Meest voorkomende waarde; bij gelijkspel het zwaarste weertype, want
// "kans op onweer" moet je niet wegmiddelen naar "half bewolkt".
function modus(reeks) {
    const telling = new Map();
    reeks.forEach((v) => telling.set(v, (telling.get(v) || 0) + 1));
    let beste = reeks[0];
    let hoogste = 0;
    for (const [waarde, aantal] of telling) {
        if (aantal > hoogste || (aantal === hoogste && waarde > beste)) {
            beste = waarde;
            hoogste = aantal;
        }
    }
    return beste;
}

// Dagsamenvatting uit de uren. Alleen werkuren tellen mee voor het weerbeeld:
// dat het om 3 uur 's nachts regent interesseert een hovenier niet.
function perDag(uren, werkVan = 7, werkTot = 19) {
    const dagen = new Map();

    for (const u of uren) {
        const datum = u.tijd.slice(0, 10);
        const uur = Number(u.tijd.slice(11, 13));
        if (!dagen.has(datum)) dagen.set(datum, { datum, alle: [], werk: [] });
        dagen.get(datum).alle.push(u);
        if (uur >= werkVan && uur < werkTot) dagen.get(datum).werk.push(u);
    }

    return [...dagen.values()].map(({ datum, alle, werk }) => {
        const basis = werk.length ? werk : alle;
        const temps = alle.map((u) => u.temp).filter((v) => v !== null);
        const mm = basis.map((u) => u.mm).filter((v) => v !== null);
        const kansen = basis.map((u) => u.regenkans).filter((v) => v !== null);
        const stoten = basis.map((u) => u.windstoot).filter((v) => v !== null);
        const codes = basis.map((u) => u.code).filter((v) => v !== null);

        const laag = basis.filter((u) => u.zekerheid === 'laag').length;
        const redelijk = basis.filter((u) => u.zekerheid === 'redelijk').length;

        return {
            datum,
            min: temps.length ? rond(Math.min(...temps), 0) : null,
            max: temps.length ? rond(Math.max(...temps), 0) : null,
            mm: rond(mm.reduce((a, b) => a + b, 0), 1),
            regenkans: kansen.length ? Math.max(...kansen) : null,
            natte_uren: basis.filter((u) => (u.mm ?? 0) >= 0.1).length,
            windstoot: stoten.length ? rond(Math.max(...stoten), 0) : null,
            code: codes.length ? modus(codes) : null,
            bronnen: Math.max(...basis.map((u) => u.bronnen), 0),
            zekerheid: laag > basis.length / 3 ? 'laag'
                : (laag || redelijk > basis.length / 2) ? 'redelijk' : 'hoog',
        };
    });
}

/* ---------- publieke functie ---------- */

export async function haalWeer(lat, lon, dagen = 7) {
    const bronstatus = [];

    // Elke bron los afgehandeld: valt er één weg, dan werkt de rest gewoon door.
    const [om, mn, br, nc] = await Promise.allSettled([
        openMeteo(lat, lon, dagen),
        metNo(lat, lon),
        buienradar(lat, lon),
        nowcast(lat, lon),
    ]);

    const reeksen = [];

    if (om.status === 'fulfilled') {
        reeksen.push(...om.value);
        om.value.forEach((r) => bronstatus.push({ naam: r.naam, status: 'ok' }));
        MODELLEN.filter((m) => !om.value.some((r) => r.id === m.id))
            .forEach((m) => bronstatus.push({ naam: m.naam, status: 'geen data' }));
    } else {
        MODELLEN.forEach((m) => bronstatus.push({ naam: m.naam, status: 'niet bereikbaar' }));
    }

    if (mn.status === 'fulfilled' && mn.value.length) {
        reeksen.push(...mn.value);
        bronstatus.push({ naam: 'Met.no (Noorwegen)', status: 'ok' });
    } else {
        bronstatus.push({ naam: 'Met.no (Noorwegen)', status: 'niet bereikbaar' });
    }

    const meting = br.status === 'fulfilled' ? br.value : null;
    bronstatus.push({ naam: 'Buienradar', status: meting ? 'ok' : 'niet bereikbaar' });

    if (!reeksen.length) throw new Error('Geen enkele weerbron reageerde.');

    // Bronnen reiken niet even ver; Met.no loopt bijvoorbeeld door waar een
    // gevraagd venster van twee dagen ophoudt. Afkappen op het gevraagde
    // aantal dagen, zodat het antwoord doet wat er is gevraagd.
    const grens = new Date();
    grens.setHours(0, 0, 0, 0);
    grens.setDate(grens.getDate() + dagen);
    const laatsteDag = grens.toISOString().slice(0, 10);

    const uren = consensusPerUur(reeksen).filter((u) => u.tijd.slice(0, 10) < laatsteDag);

    return {
        locatie: { lat, lon },
        bijgewerkt: new Date().toISOString(),
        bronnen: bronstatus,
        aantal_bronnen: reeksen.length,
        nu: meting?.nu || null,
        zon_op: meting?.zon_op || null,
        zon_onder: meting?.zon_onder || null,
        nowcast: nc.status === 'fulfilled' ? nc.value : null,
        uren,
        dagen: perDag(uren),
        // Buienradars eigen vijfdaagse, apart gehouden als extra ijkpunt
        // in plaats van meegemiddeld — het is een landelijke verwachting.
        buienradar_dagen: meting?.dagen || [],
    };
}

/* ---------- geocoding ---------- */

// Plaatsnaam naar coördinaten, beperkt tot Nederland. Faalt dit, dan valt
// alles terug op Wemeldinge in plaats van op een lege kaart.
export async function zoekPlaats(naam) {
    if (!naam || !naam.trim()) return WEMELDINGE;
    try {
        const data = await haal(
            `https://geocoding-api.open-meteo.com/v1/search` +
            `?name=${encodeURIComponent(naam.trim())}&count=1&language=nl&countryCode=NL`);
        const hit = data.results?.[0];
        if (!hit) return WEMELDINGE;
        return { lat: hit.latitude, lon: hit.longitude, plaats: hit.name };
    } catch {
        return WEMELDINGE;
    }
}
