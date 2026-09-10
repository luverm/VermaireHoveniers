/* ==========================================================================
   VERMAIRE HOVENIERS — APP-SCHIL
   Alles wat het portaal als app laat aanvoelen zodra het op het beginscherm
   staat: standalone herkennen, offline melden, en een nieuwe versie netjes
   aanbieden in plaats van er stiekem tussendoor te wisselen.
   ========================================================================== */

(function () {
    'use strict';

    const root = document.documentElement;

    /* ---------- app-modus ---------- */

    // Draait dit als geïnstalleerde app of gewoon in een browsertab? De hele
    // opmaak hangt hiervan af (onderbalk, veilige zones), dus zetten we het
    // als attribuut neer in plaats van in de CSS met display-mode te werken:
    // zo is het ook te testen en kan iOS' eigen vlag meedoen.
    function bepaalModus() {
        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true;

        root.dataset.mode = standalone ? 'app' : 'web';
        return standalone;
    }

    bepaalModus();
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', bepaalModus);

    // iOS meldt geen pointer-type wisselingen; dit is genoeg om aanraakspecifieke
    // opmaak (zoals grotere invoervelden) alleen daar toe te passen.
    if (window.matchMedia('(pointer: coarse)').matches) root.dataset.pointer = 'coarse';

    /* ---------- verbinding ---------- */

    const balk = document.createElement('div');
    balk.className = 'offline-balk';
    balk.setAttribute('role', 'status');
    balk.innerHTML =
        '<span>Geen verbinding — u ziet de laatst opgehaalde gegevens.</span>';

    function toonVerbinding() {
        const offline = !navigator.onLine;
        root.classList.toggle('is-offline', offline);
        if (offline && !balk.isConnected) document.body.appendChild(balk);
        requestAnimationFrame(() => balk.classList.toggle('open', offline));
        if (!offline) setTimeout(() => { if (!balk.classList.contains('open')) balk.remove(); }, 400);
    }

    window.addEventListener('online', toonVerbinding);
    window.addEventListener('offline', toonVerbinding);
    if (!navigator.onLine) toonVerbinding();

    /* ---------- service worker ---------- */

    // Bewust géén automatische wissel: midden in het invullen van een klus
    // wil je niet dat de pagina onder je handen herlaadt.
    function meldNieuweVersie(wachtende) {
        const melding = document.createElement('button');
        melding.type = 'button';
        melding.className = 'update-melding';
        melding.innerHTML = '<span>Nieuwe versie beschikbaar</span><strong>Vernieuwen</strong>';

        melding.addEventListener('click', () => {
            melding.disabled = true;
            wachtende.postMessage('SKIP_WAITING');
        });

        document.body.appendChild(melding);
        requestAnimationFrame(() => melding.classList.add('open'));
    }

    // isSecureContext dekt https én localhost — precies waar een service
    // worker mag draaien, zonder de hostnaam zelf te hoeven raden.
    if ('serviceWorker' in navigator && window.isSecureContext) {
        window.addEventListener('load', async () => {
            try {
                // Het portaal staat op /admin (zonder schuine streep), maar een
                // worker in /admin/ mag standaard alleen /admin/ bedienen. De
                // header Service-Worker-Allowed in vercel.json rekt dat op.
                // Ontbreekt die, dan vallen we terug op de standaardscope: dan
                // werkt offline openen niet, maar wordt de rest wél bewaard.
                const reg = await navigator.serviceWorker
                    .register('/admin/sw.js', { scope: '/admin' })
                    .catch(() => navigator.serviceWorker.register('/admin/sw.js'));

                if (reg.waiting && navigator.serviceWorker.controller) meldNieuweVersie(reg.waiting);

                reg.addEventListener('updatefound', () => {
                    const nieuwe = reg.installing;
                    if (!nieuwe) return;
                    nieuwe.addEventListener('statechange', () => {
                        // Alleen melden bij een échte update, niet bij de
                        // allereerste installatie (dan is er nog geen controller).
                        if (nieuwe.state === 'installed' && navigator.serviceWorker.controller) {
                            meldNieuweVersie(nieuwe);
                        }
                    });
                });

                let herladen = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (herladen) return;
                    herladen = true;
                    location.reload();
                });
            } catch {
                // Geen service worker is geen ramp; het portaal werkt online prima.
            }
        });
    }

    /* ---------- tip om te installeren ---------- */

    // Safari kent geen installatieprompt; je moet het via Deel → Zet op
    // beginscherm doen. Eén keer laten zien, daarna nooit meer.
    const GEZIEN = 'vh-installtip';

    function toonInstallTip() {
        if (root.dataset.mode === 'app') return;
        if (localStorage.getItem(GEZIEN)) return;

        const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const safari = iOS && !/crios|fxios|edgios/i.test(navigator.userAgent);
        if (!safari) return;

        const tip = document.createElement('div');
        tip.className = 'install-tip';
        tip.innerHTML = `
            <button class="install-tip-sluit" aria-label="Sluiten">&times;</button>
            <strong>Zet dit portaal op uw beginscherm</strong>
            <span>Tik onderin op <b>Deel</b> en kies <b>Zet op beginscherm</b>.
                  Daarna opent het als een app, ook zonder bereik.</span>`;

        tip.querySelector('.install-tip-sluit').addEventListener('click', () => {
            try { localStorage.setItem(GEZIEN, '1'); } catch {}
            tip.classList.remove('open');
            setTimeout(() => tip.remove(), 300);
        });

        document.body.appendChild(tip);
        requestAnimationFrame(() => tip.classList.add('open'));
    }

    // Pas tonen als het portaal echt in gebruik is, niet op het inlogscherm.
    window.addEventListener('vh:ingelogd', () => setTimeout(toonInstallTip, 2500), { once: true });

    /* ---------- kleine app-details ---------- */

    // Dubbeltik-zoom op iOS uitzetten zonder pinch-zoom te blokkeren: dat
    // laatste is een toegankelijkheidsfunctie die je niet mag afnemen.
    let laatsteTik = 0;
    document.addEventListener('touchend', (e) => {
        const nu = Date.now();
        if (nu - laatsteTik < 300 && e.target.closest('button, .tab, .filter, a')) {
            e.preventDefault();
        }
        laatsteTik = nu;
    }, { passive: false });

    // In standalone-modus openen externe links anders het portaal in Safari
    // en kom je niet meer terug. Die sturen we bewust naar een nieuw venster.
    document.addEventListener('click', (e) => {
        if (root.dataset.mode !== 'app') return;
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        if (/^(tel:|mailto:|webcal:|sms:)/i.test(href)) return;   // eigen handler

        const url = new URL(href, location.href);
        if (url.origin !== location.origin && !link.target) link.target = '_blank';
    });
})();
