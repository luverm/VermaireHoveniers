// ----------------------------------------------------------------------------
// E-mail versturen via Resend.
//
// Bewust geen SDK: het is één POST met JSON, en de rest van dit project draait
// ook zonder afhankelijkheden.
//
// Zonder RESEND_API_KEY verstuurt dit niets en klaagt het alleen in het log.
// Dat is met opzet: een aanvraag mag nooit verloren gaan omdat de mail hapert.
// ----------------------------------------------------------------------------

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 5000;

const AFZENDER_STANDAARD = 'Vermaire Hoveniers <onboarding@resend.dev>';

/**
 * @returns {Promise<{verstuurd: boolean, reden?: string, id?: string}>}
 *          Werpt nooit — de aanroeper hoeft dit niet af te vangen.
 */
export async function stuurMail({ naar, onderwerp, html, tekst, antwoordNaar }) {
    const sleutel = process.env.RESEND_API_KEY;

    if (!sleutel) {
        console.warn('[mail] RESEND_API_KEY ontbreekt — niets verstuurd naar', naar);
        return { verstuurd: false, reden: 'geen sleutel' };
    }
    if (!naar) return { verstuurd: false, reden: 'geen ontvanger' };

    const bericht = {
        from: process.env.MAIL_FROM || AFZENDER_STANDAARD,
        to: [naar],
        subject: onderwerp,
        html,
        text: tekst,
    };
    if (antwoordNaar) bericht.reply_to = antwoordNaar;

    try {
        const res = await fetch(RESEND_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sleutel}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bericht),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
            const fout = await res.text().catch(() => '');
            console.error('[mail] afgewezen', res.status, fout.slice(0, 300));
            return { verstuurd: false, reden: `status ${res.status}` };
        }

        const data = await res.json().catch(() => ({}));
        return { verstuurd: true, id: data.id };
    } catch (err) {
        console.error('[mail] mislukt:', err.message);
        return { verstuurd: false, reden: err.message };
    }
}

/* ---------- opmaak ---------- */

const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Nieuwe regels van een klant worden alineas, geen ruwe HTML.
const alinea = (v) => esc(v).split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`).join('');

const DIENST = {
    beplanting: 'Beplanting',
    groenadvies: 'Groenadvies',
    onderhoud: 'Onderhoud',
    anders: 'Iets anders',
};

// Mailclients negeren stylesheets, dus alles staat inline. Geen flexbox,
// geen grid — dat overleeft Outlook niet.
function omhulsel(inhoud, voettekst) {
    return `<!doctype html>
<html lang="nl"><body style="margin:0;padding:0;background:#f5faf6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5faf6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e5e9e6;border-radius:14px;">
        <tr><td style="padding:28px 30px 8px;">
          <div style="font:700 18px/1.2 'Trebuchet MS',Arial,sans-serif;color:#0d2818;
                      letter-spacing:-0.02em;">
            VERM<span style="color:#2d8a4e;">AI</span>RE
            <span style="color:#2d8a4e;font-size:12px;letter-spacing:0.22em;">HOVENIERS</span>
          </div>
        </td></tr>
        <tr><td style="padding:14px 30px 26px;
                       font:400 15px/1.6 -apple-system,'Segoe UI',Arial,sans-serif;color:#0d2818;">
          ${inhoud}
        </td></tr>
      </table>
      <div style="max-width:560px;margin:14px auto 0;
                  font:400 12px/1.5 -apple-system,'Segoe UI',Arial,sans-serif;color:#99a39b;">
        ${voettekst}
      </div>
    </td></tr>
  </table>
</body></html>`;
}

/* ---------- bevestiging aan de klant ---------- */

export function bevestigingAanKlant({ naam, dienst, bericht, telefoon, email }) {
    const voornaam = String(naam || '').trim().split(/\s+/)[0] || 'daar';
    const dienstLabel = dienst ? (DIENST[dienst] || dienst) : null;

    const html = omhulsel(`
        <p style="margin:0 0 14px">Beste ${esc(voornaam)},</p>
        <p style="margin:0 0 14px">
          Bedankt voor uw aanvraag. Hij is goed aangekomen en ik neem
          <strong>binnen twee werkdagen</strong> contact met u op.
        </p>
        ${dienstLabel || bericht ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f5faf6;border-radius:10px;margin:0 0 16px;">
          <tr><td style="padding:14px 16px;font-size:14px;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
                        color:#5a6b5f;margin-bottom:6px;">Uw aanvraag</div>
            ${dienstLabel ? `<div style="margin-bottom:${bericht ? '8px' : '0'}">
              <strong>${esc(dienstLabel)}</strong></div>` : ''}
            ${bericht ? `<div style="color:#5a6b5f;">${alinea(bericht)}</div>` : ''}
          </td></tr>
        </table>` : ''}
        <p style="margin:0 0 14px">
          Heeft u haast, of wilt u iets aanvullen? Bel of app gerust naar
          <a href="tel:${esc(String(telefoon || '').replace(/\s/g, ''))}"
             style="color:#2d8a4e;text-decoration:none;font-weight:600;">${esc(telefoon)}</a>.
        </p>
        <p style="margin:0;">Met vriendelijke groet,<br>
          <strong>Thijmen Vermaire</strong><br>
          <span style="color:#5a6b5f;font-size:14px;">Vermaire Hoveniers · Wemeldinge</span>
        </p>`,
        `U ontvangt deze e-mail omdat er een aanvraag is gedaan op vermairehoveniers.nl.
         Was u dit niet? Dan mag u deze mail negeren.`);

    const tekst = [
        `Beste ${voornaam},`, '',
        'Bedankt voor uw aanvraag. Hij is goed aangekomen en ik neem binnen twee werkdagen contact met u op.',
        dienstLabel ? `\nUw aanvraag: ${dienstLabel}` : '',
        bericht ? `\n"${bericht}"` : '',
        '', `Haast? Bel of app naar ${telefoon}.`,
        '', 'Met vriendelijke groet,', 'Thijmen Vermaire',
        'Vermaire Hoveniers · Wemeldinge',
    ].filter((r) => r !== '').join('\n');

    return {
        naar: email,
        onderwerp: 'Uw aanvraag bij Vermaire Hoveniers',
        html,
        tekst,
    };
}

/* ---------- seintje aan Thijmen ---------- */

export function meldingAanHovenier({ naam, email, telefoon, dienst, bericht, site, naarAdres }) {
    const dienstLabel = dienst ? (DIENST[dienst] || dienst) : '—';
    const rij = (label, waarde) => `
        <tr>
          <td style="padding:6px 0;color:#5a6b5f;font-size:13px;width:88px;
                     vertical-align:top;">${label}</td>
          <td style="padding:6px 0;font-size:14px;">${waarde}</td>
        </tr>`;

    const html = omhulsel(`
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;
                  text-transform:uppercase;color:#2d8a4e;font-weight:600;">Nieuwe aanvraag</p>
        <p style="margin:0 0 16px;font:700 20px/1.3 'Trebuchet MS',Arial,sans-serif;">
          ${esc(naam)}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border-top:1px solid #e5e9e6;margin-bottom:16px;">
          ${rij('E-mail', `<a href="mailto:${esc(email)}"
                 style="color:#2d8a4e;text-decoration:none;">${esc(email)}</a>`)}
          ${telefoon ? rij('Telefoon', `<a href="tel:${esc(String(telefoon).replace(/\s/g, ''))}"
                 style="color:#2d8a4e;text-decoration:none;">${esc(telefoon)}</a>`) : ''}
          ${rij('Dienst', esc(dienstLabel))}
        </table>

        ${bericht ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#f5faf6;border-radius:10px;margin:0 0 20px;">
          <tr><td style="padding:14px 16px;font-size:14px;color:#0d2818;">
            ${alinea(bericht)}
          </td></tr>
        </table>` : ''}

        <a href="${esc(site)}/admin?tab=aanvragen"
           style="display:inline-block;background:#2d8a4e;color:#ffffff;text-decoration:none;
                  padding:11px 22px;border-radius:999px;font-weight:600;font-size:14px;">
          Openen in het portaal
        </a>

        <p style="margin:18px 0 0;font-size:13px;color:#5a6b5f;">
          Antwoorden op deze mail gaat rechtstreeks naar ${esc(naam)}.
        </p>`,
        'Automatisch bericht van vermairehoveniers.nl');

    const tekst = [
        `Nieuwe aanvraag — ${naam}`, '',
        `E-mail:   ${email}`,
        telefoon ? `Telefoon: ${telefoon}` : '',
        `Dienst:   ${dienstLabel}`,
        bericht ? `\n${bericht}` : '',
        '', `Portaal: ${site}/admin?tab=aanvragen`,
    ].filter((r) => r !== '').join('\n');

    return {
        naar: naarAdres,
        onderwerp: `Nieuwe aanvraag: ${naam}`,
        html,
        tekst,
        antwoordNaar: email,
    };
}
