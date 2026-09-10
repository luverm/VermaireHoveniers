/* ==========================================================================
   VERMAIRE HOVENIERS — WEER
   Haalt de samengevoegde verwachting op bij /api/weer en vertaalt die naar
   wat een hovenier wil weten: kan ik hier werken, en hoe zeker is dat?
   ========================================================================== */

(function () {
    'use strict';

    const WMO = {
        0:  ['Onbewolkt', '☀️'],          1:  ['Overwegend zonnig', '🌤️'],
        2:  ['Half bewolkt', '⛅'],        3:  ['Bewolkt', '☁️'],
        45: ['Mist', '🌫️'],               48: ['Aanvriezende mist', '🌫️'],
        51: ['Lichte motregen', '🌦️'],    53: ['Motregen', '🌦️'],
        55: ['Zware motregen', '🌧️'],     56: ['Lichte ijzel', '🌨️'],
        57: ['IJzel', '🌨️'],              61: ['Lichte regen', '🌦️'],
        63: ['Regen', '🌧️'],              65: ['Zware regen', '🌧️'],
        66: ['Lichte ijzel', '🌨️'],       67: ['IJzel', '🌨️'],
        71: ['Lichte sneeuw', '🌨️'],      73: ['Sneeuw', '❄️'],
        75: ['Zware sneeuw', '❄️'],        77: ['Sneeuwkorrels', '🌨️'],
        80: ['Lichte buien', '🌦️'],       81: ['Buien', '🌧️'],
        82: ['Zware buien', '🌧️'],        85: ['Lichte sneeuwbuien', '🌨️'],
        86: ['Sneeuwbuien', '❄️'],         95: ['Onweer', '⛈️'],
        96: ['Onweer met hagel', '⛈️'],    99: ['Zwaar onweer', '⛈️'],
    };

    const icoon = (code) => (WMO[code] ? WMO[code][1] : '·');
    const omschrijving = (code) => (WMO[code] ? WMO[code][0] : '—');

    // Windkracht in Beaufort; daar denkt een hovenier in, niet in km/u.
    function bft(kmu) {
        if (kmu == null) return null;
        const grenzen = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
        let n = 0;
        grenzen.forEach((g, i) => { if (kmu >= g) n = i + 1; });
        return n;
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    const sleutel = (d) =>
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const komma = (n, d = 1) => (n == null ? '–' : n.toFixed(d).replace('.', ','));

    /* ---------- ophalen ---------- */

    let data = null;
    let bezig = null;
    let opgehaald = 0;

    // Een kwartier is ruim binnen de versheid van de bronnen zelf en voorkomt
    // dat elke weeknavigatie opnieuw acht modellen aanspreekt.
    const VERS_MS = 15 * 60 * 1000;

    async function laden(force = false) {
        if (!force && data && Date.now() - opgehaald < VERS_MS) return data;
        if (bezig) return bezig;

        bezig = fetch('/api/weer')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
            .then((j) => {
                data = j;
                opgehaald = Date.now();
                data._perUur = new Map((j.uren || []).map((u) => [u.tijd, u]));
                data._perDag = new Map((j.dagen || []).map((d) => [d.datum, d]));
                return data;
            })
            .catch(() => null)
            .finally(() => { bezig = null; });

        return bezig;
    }

    const dag = (datum) => data?._perDag.get(datum) || null;
    const beschikbaar = () => !!data;

    /* ---------- beoordeling ---------- */

    // De uren die een klus daadwerkelijk raakt. Een klus van 08:30 tot 12:00
    // raakt de uren 8 tot en met 11.
    function urenVan(start, eind) {
        if (!data) return [];
        const uit = [];
        const t = new Date(start);
        t.setMinutes(0, 0, 0);

        while (t < eind) {
            const u = data._perUur.get(sleutel(t));
            if (u) uit.push(u);
            t.setHours(t.getHours() + 1);
        }
        return uit;
    }

    // Wat is er mis met dit weer, voor dit soort werk? Volgorde is belangrijk:
    // het zwaarste bezwaar moet als eerste in beeld komen.
    function beoordeel(start, eind, soort) {
        const uren = urenVan(start, eind);
        if (!uren.length) return null;

        const max = (v) => Math.max(...uren.map((u) => u[v] ?? -Infinity));
        const min = (v) => Math.min(...uren.map((u) => u[v] ?? Infinity));
        const totaalMm = uren.reduce((s, u) => s + (u.mm || 0), 0);

        const stoot = max('windstoot');
        const kans = max('regenkans');
        const tempMin = min('temp');
        const tempMax = max('temp');
        const onweer = uren.some((u) => [95, 96, 99].includes(u.code));
        const slechtsteZekerheid = uren.some((u) => u.zekerheid === 'laag') ? 'laag'
            : uren.some((u) => u.zekerheid === 'redelijk') ? 'redelijk' : 'hoog';

        const punten = [];

        if (onweer) punten.push({ niveau: 'ernstig', icoon: '⛈️', tekst: 'Onweer verwacht' });

        if (stoot >= 62) {
            punten.push({ niveau: 'ernstig', icoon: '🌬️',
                tekst: `Storm — windstoten ${bft(stoot)} Bft. Geen werk op hoogte.` });
        } else if (stoot >= 50) {
            punten.push({ niveau: 'waarschuwing', icoon: '🌬️',
                tekst: `Harde windstoten (${bft(stoot)} Bft, ${Math.round(stoot)} km/u)` });
        } else if (stoot >= 39 && soort === 'beplanting') {
            punten.push({ niveau: 'info', icoon: '🌬️',
                tekst: `Stevige wind (${bft(stoot)} Bft) — vervelend bij het planten` });
        }

        if (tempMin <= 0) {
            punten.push({ niveau: 'ernstig', icoon: '🧊',
                tekst: `Vorst (${komma(tempMin, 0)}°C) — grond is bevroren` });
        } else if (tempMin <= 3 && soort === 'beplanting') {
            punten.push({ niveau: 'waarschuwing', icoon: '🧊',
                tekst: `Kans op nachtvorst (${komma(tempMin, 0)}°C) — vers plantgoed loopt risico` });
        }

        if (totaalMm >= 3 || max('mm_max') >= 2) {
            punten.push({ niveau: 'waarschuwing', icoon: '🌧️',
                tekst: `Flinke regen verwacht (${komma(totaalMm)} mm)` });
        } else if (kans >= 50) {
            punten.push({ niveau: 'waarschuwing', icoon: '🌦️',
                tekst: `${kans}% kans op regen` });
        } else if (kans >= 25) {
            punten.push({ niveau: 'info', icoon: '🌦️', tekst: `${kans}% kans op een bui` });
        }

        if (tempMax >= 30) {
            punten.push({ niveau: 'waarschuwing', icoon: '🥵',
                tekst: `Hitte (${komma(tempMax, 0)}°C) — drink genoeg` });
        }

        if (slechtsteZekerheid === 'laag' && !punten.some((p) => p.niveau === 'ernstig')) {
            punten.push({ niveau: 'info', icoon: '❓',
                tekst: 'De bronnen zijn het oneens — check kort van tevoren' });
        }

        const niveau = punten.some((p) => p.niveau === 'ernstig') ? 'ernstig'
            : punten.some((p) => p.niveau === 'waarschuwing') ? 'waarschuwing'
            : punten.length ? 'info' : 'goed';

        return {
            niveau, punten, uren,
            temp_min: tempMin, temp_max: tempMax,
            mm: totaalMm, regenkans: kans, windstoot: stoot,
            zekerheid: slechtsteZekerheid,
            code: uren[Math.floor(uren.length / 2)]?.code ?? null,
        };
    }

    /* ---------- weergave ---------- */

    // Compacte regel onder de dagnaam in de weekkalender.
    function dagkopHTML(datum) {
        const d = dag(datum);
        if (!d) return '';

        const nat = d.regenkans != null && d.regenkans >= 25;
        const stormachtig = d.windstoot != null && d.windstoot >= 50;

        const titel = [
            omschrijving(d.code),
            `${d.min ?? '–'} tot ${d.max ?? '–'} °C`,
            d.mm ? `${komma(d.mm)} mm over de werkdag` : 'droog',
            d.regenkans != null ? `regenkans ${d.regenkans}%` : '',
            d.windstoot != null ? `windstoten tot ${Math.round(d.windstoot)} km/u (${bft(d.windstoot)} Bft)` : '',
            `${d.bronnen} bronnen · zekerheid ${d.zekerheid}`,
        ].filter(Boolean).join('\n');

        return `
            <div class="cal-weer zeker-${d.zekerheid}" title="${esc(titel)}">
                <span class="cal-weer-icoon">${icoon(d.code)}</span>
                <span class="cal-weer-temp">${d.max ?? '–'}°<small>${d.min ?? '–'}°</small></span>
                <span class="cal-weer-regen${nat ? ' is-nat' : ''}">
                    ${d.mm ? komma(d.mm) + ' mm' : (d.regenkans != null ? d.regenkans + '%' : '')}
                </span>
                ${stormachtig ? `<span class="cal-weer-wind">${bft(d.windstoot)} Bft</span>` : ''}
            </div>`;
    }

    // Klein hoekje op een klusblok. Alleen tonen als er iets aan de hand is —
    // een vinkje bij elk droog klusje is ruis.
    function klusMerkHTML(start, eind, soort) {
        const w = beoordeel(start, eind, soort);
        if (!w || w.niveau === 'goed') return '';
        return `<span class="klus-weer niveau-${w.niveau}" title="${esc(
            w.punten.map((p) => p.tekst).join('\n'))}">${w.punten[0].icoon}</span>`;
    }

    // Volledig blok in de klus-lade.
    function ladeHTML(start, eind, soort) {
        if (!beschikbaar()) {
            return '<p class="weer-leeg">Weerbronnen zijn even niet bereikbaar.</p>';
        }

        const w = beoordeel(start, eind, soort);
        if (!w) {
            return '<p class="weer-leeg">Deze datum valt buiten de verwachting van 7 dagen.</p>';
        }

        const kop = `
            <div class="weer-kop niveau-${w.niveau}">
                <span class="weer-kop-icoon">${icoon(w.code)}</span>
                <div>
                    <strong>${Math.round(w.temp_min) === Math.round(w.temp_max)
                        ? `${komma(w.temp_max, 0)}°C`
                        : `${komma(w.temp_min, 0)}° tot ${komma(w.temp_max, 0)}°C`}</strong>
                    <span>${w.mm ? komma(w.mm) + ' mm' : 'droog'}
                        · ${w.regenkans ?? 0}% regenkans
                        · windstoot ${Math.round(w.windstoot)} km/u (${bft(w.windstoot)} Bft)</span>
                </div>
            </div>`;

        const punten = w.punten.length
            ? `<ul class="weer-punten">${w.punten.map((p) =>
                `<li class="niveau-${p.niveau}"><span>${p.icoon}</span>${esc(p.tekst)}</li>`).join('')}</ul>`
            : '<p class="weer-goed">✅ Prima werkweer — geen bijzonderheden.</p>';

        const uren = `
            <div class="weer-uren">
                ${w.uren.map((u) => `
                    <div class="weer-uur zeker-${u.zekerheid}" title="${esc(
                        `${omschrijving(u.code)}\n${u.eens} van de ${u.bronnen} bronnen eens`)}">
                        <span class="weer-uur-tijd">${u.tijd.slice(11, 16)}</span>
                        <span class="weer-uur-icoon">${icoon(u.code)}</span>
                        <span class="weer-uur-temp">${Math.round(u.temp)}°</span>
                        <span class="weer-uur-regen${u.regenkans >= 25 ? ' is-nat' : ''}">${u.regenkans ?? 0}%</span>
                    </div>`).join('')}
            </div>`;

        return kop + punten + uren +
            `<p class="weer-bron">Samengesteld uit ${data.aantal_bronnen} bronnen · zekerheid ${w.zekerheid}</p>`;
    }

    // Balk boven de kalender: wat het station nú meet en of er regen aankomt.
    function nuHTML() {
        if (!data) return '';

        const n = data.nu;
        const nc = data.nowcast;
        const delen = [];

        if (n) {
            delen.push(`<strong>${komma(n.temp, 0)}°C</strong> in ${esc(n.station)}` +
                (n.km ? ` <small>(${n.km} km)</small>` : ''));
            if (n.omschrijving) delen.push(esc(n.omschrijving));
            if (n.bft != null) delen.push(`wind ${n.bft} Bft`);
        }

        if (nc?.regen_binnen_2u) {
            delen.push(`<span class="weer-nu-regen">🌧️ regen vanaf ${esc(nc.begint)}</span>`);
        } else if (nc) {
            delen.push('komende 2 uur droog');
        }

        if (!delen.length) return '';

        // Buienradar vraagt om bronvermelding met link; Met.no om naamsvermelding.
        return `
            <div class="weer-nu">
                <span class="weer-nu-tekst">${delen.join(' · ')}</span>
                <span class="weer-nu-bron">
                    Bron: <a href="https://www.buienradar.nl" target="_blank" rel="noopener">Buienradar</a>,
                    KNMI, ECMWF, DWD, Met Office, Met.no
                </span>
            </div>`;
    }

    window.Weer = {
        laden, beschikbaar, dag, beoordeel, urenVan,
        icoon, omschrijving, bft,
        dagkopHTML, klusMerkHTML, ladeHTML, nuHTML,
        get data() { return data; },
    };
})();
