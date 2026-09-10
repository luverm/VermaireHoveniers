// ----------------------------------------------------------------------------
// iCalendar (RFC 5545) generator — dependency-free.
//
// Apple Agenda is streng: regels moeten met CRLF eindigen, mogen maximaal
// 75 octets lang zijn (daarna "folden" met een spatie) en tijden geven we in
// UTC zodat we geen VTIMEZONE-blok hoeven mee te sturen.
// ----------------------------------------------------------------------------

// Escapet een tekstwaarde volgens RFC 5545 §3.3.11.
function esc(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

// Vouwt een regel op 75 octets. Breekt nooit midden in een UTF-8 teken,
// anders ziet Apple er mojibake van (é wordt dan twee halve bytes).
function fold(line) {
    const bytes = Buffer.from(line, 'utf8');
    if (bytes.length <= 75) return line;

    const parts = [];
    let start = 0;
    let limit = 75; // vervolgregels beginnen met een spatie, dus 74 content-octets

    while (start < bytes.length) {
        let end = Math.min(start + limit, bytes.length);
        if (end < bytes.length) {
            // 10xxxxxx is een UTF-8 vervolgbyte — terug tot een tekengrens.
            while (end > start + 1 && (bytes[end] & 0xc0) === 0x80) end--;
        }
        parts.push(bytes.subarray(start, end).toString('utf8'));
        start = end;
        limit = 74;
    }

    return parts.join('\r\n ');
}

// 2026-09-11T07:00:00.000Z -> 20260911T070000Z
export function toUtcStamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// updated_at -> een oplopend geheel getal, zodat Apple een gewijzigde
// afspraak als nieuwe versie ziet in plaats van als duplicaat. Geteld vanaf
// 2020 in plaats van 1970, want rauwe epoch-seconden lopen in 2038 over de
// 32-bits grens die sommige agenda-clients aanhouden.
const SEQ_EPOCH = Date.UTC(2020, 0, 1);

function sequence(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.floor((date.getTime() - SEQ_EPOCH) / 1000));
}

function event(ev, stamp) {
    const start = toUtcStamp(ev.start);
    const end = toUtcStamp(ev.end);
    if (!start || !end) return [];

    const lines = [
        'BEGIN:VEVENT',
        `UID:${ev.uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${esc(ev.summary)}`,
    ];

    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    if (ev.url) lines.push(`URL;VALUE=URI:${ev.url}`);
    if (ev.categories) lines.push(`CATEGORIES:${esc(ev.categories)}`);

    lines.push(`STATUS:${ev.status || 'CONFIRMED'}`);
    lines.push(`TRANSP:${ev.status === 'CANCELLED' ? 'TRANSPARENT' : 'OPAQUE'}`);
    lines.push(`SEQUENCE:${sequence(ev.updatedAt)}`);
    if (ev.createdAt) lines.push(`CREATED:${toUtcStamp(ev.createdAt) || stamp}`);
    if (ev.updatedAt) lines.push(`LAST-MODIFIED:${toUtcStamp(ev.updatedAt) || stamp}`);

    if (ev.alarmMinutes > 0 && ev.status !== 'CANCELLED') {
        lines.push(
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            `TRIGGER:-PT${Math.round(ev.alarmMinutes)}M`,
            `DESCRIPTION:${esc(ev.summary)}`,
            'END:VALARM',
        );
    }

    lines.push('END:VEVENT');
    return lines;
}

/**
 * Bouwt een complete VCALENDAR-string.
 *
 * @param {object}   options
 * @param {string}   options.name            Naam zoals Apple hem toont.
 * @param {string}   [options.description]   Ondertitel van de agenda.
 * @param {number}   [options.refreshMinutes] Hoe vaak Apple mag verversen.
 * @param {object[]} options.events
 */
export function buildCalendar({ name, description, refreshMinutes = 15, events = [] }) {
    const stamp = toUtcStamp(new Date());
    const refresh = `PT${Math.max(5, Math.round(refreshMinutes))}M`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Vermaire Hoveniers//Planning//NL',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${esc(name)}`,
        'X-WR-TIMEZONE:Europe/Amsterdam',
        `X-PUBLISHED-TTL:${refresh}`,
        `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    ];

    if (description) lines.push(`X-WR-CALDESC:${esc(description)}`);

    for (const ev of events) lines.push(...event(ev, stamp));

    lines.push('END:VCALENDAR');

    return lines.map(fold).join('\r\n') + '\r\n';
}
