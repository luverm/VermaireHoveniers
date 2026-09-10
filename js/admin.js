/* ==========================================================================
   VERMAIRE HOVENIERS — ADMIN PORTAL
   Auth + data via the Supabase JS client. RLS protects everything:
   only an authenticated admin can read/update.
   ========================================================================== */

(function () {
    'use strict';

    const STATUSES = ['nieuw', 'gecontacteerd', 'afgerond', 'gearchiveerd'];
    const STATUS_LABEL = {
        nieuw: 'Nieuw',
        gecontacteerd: 'Gecontacteerd',
        afgerond: 'Afgerond',
        gearchiveerd: 'Gearchiveerd',
    };
    const SERVICE_LABEL = {
        beplanting: 'Beplanting',
        groenadvies: 'Groenadvies',
        onderhoud: 'Onderhoud',
        anders: 'Iets anders',
    };
    const BUCKET = 'project-photos';
    const SETTING_KEYS = [
        'hero_description',
        'stat1_number', 'stat1_label',
        'stat2_number', 'stat2_label',
        'service1_title', 'service1_description',
        'service2_title', 'service2_description',
        'service3_title', 'service3_description',
        'about_paragraph1', 'about_paragraph2',
        'contact_phone', 'contact_email', 'contact_area',
        'footer_tagline',
    ];

    const $ = (id) => document.getElementById(id);

    /* ---------- DOM refs ---------- */
    const el = {
        // login
        loginView: $('loginView'), appView: $('appView'),
        loginForm: $('loginForm'), loginBtn: $('loginBtn'), loginError: $('loginError'),
        email: $('email'), password: $('password'),
        userEmail: $('userEmail'), logoutBtn: $('logoutBtn'),
        // aanvragen
        filters: $('filters'), search: $('search'),
        tableState: $('tableState'), table: $('table'), tbody: $('tbody'),
        statNew: $('statNew'), statContacted: $('statContacted'),
        statDone: $('statDone'), statTotal: $('statTotal'),
        drawer: $('drawer'), drawerOverlay: $('drawerOverlay'), drawerClose: $('drawerClose'),
        dName: $('dName'), dPill: $('dPill'), dEmail: $('dEmail'), dPhone: $('dPhone'),
        dService: $('dService'), dDate: $('dDate'), dMessage: $('dMessage'),
        dMailto: $('dMailto'), dArchive: $('dArchive'), dDelete: $('dDelete'),
        dToKlant: $('dToKlant'),
        // planning
        calPrev: $('calPrev'), calNext: $('calNext'), calToday: $('calToday'),
        calTitle: $('calTitle'), calSummary: $('calSummary'),
        calState: $('calState'), calendar: $('calendar'),
        calHead: $('calHead'), calBody: $('calBody'), weerNu: $('weerNu'),
        jdWeer: $('jdWeer'), jdWeerBody: $('jdWeerBody'),
        newKlusBtn: $('newKlusBtn'), agendaBtn: $('agendaBtn'),
        klusDrawer: $('klusDrawer'), klusOverlay: $('klusOverlay'),
        jdClose: $('jdClose'), jdHeading: $('jdHeading'), jdError: $('jdError'),
        jdSave: $('jdSave'), jdDelete: $('jdDelete'), jdSnelstart: $('jdSnelstart'),
        jfTitel: $('jf-titel'), jfKlant: $('jf-klant'), jfSoort: $('jf-soort'),
        jfDatum: $('jf-datum'), jfStart: $('jf-start'), jfEind: $('jf-eind'),
        jfAdres: $('jf-adres'), jfOmschrijving: $('jf-omschrijving'),
        jfStatus: $('jf-status'), jfPrijsmodel: $('jf-prijsmodel'),
        jfUurtarief: $('jf-uurtarief'), jfVast: $('jf-vast'),
        jfUurtariefWrap: $('jfUurtariefWrap'), jfVastWrap: $('jfVastWrap'),
        jfTariefHint: $('jfTariefHint'),
        jfWeer: $('jf-weer'), jfGefactureerd: $('jf-gefactureerd'),
        jfHerhaling: $('jf-herhaling'), jfTot: $('jf-tot'),
        jfTotWrap: $('jfTotWrap'), jfReeksUitleg: $('jfReeksUitleg'),
        jdReeksBanner: $('jdReeksBanner'), jdReeksTekst: $('jdReeksTekst'),
        jdReeksBewerk: $('jdReeksBewerk'), jdReeksStop: $('jdReeksStop'),
        jdMatLijst: $('jdMatLijst'), jdMatVoortgang: $('jdMatVoortgang'),
        jdMatToevoegen: $('jdMatToevoegen'),
        matModal: $('matModal'), matOverlay: $('matOverlay'), matSluit: $('matSluit'),
        matZoek: $('matZoek'), matCategorieen: $('matCategorieen'),
        matKeuzeLijst: $('matKeuzeLijst'), matEigen: $('matEigen'), matKlaar: $('matKlaar'),
        // agenda modal
        agendaModal: $('agendaModal'), agendaOverlay: $('agendaOverlay'),
        agendaClose: $('agendaClose'), agendaUrl: $('agendaUrl'),
        agendaCopy: $('agendaCopy'), agendaOpen: $('agendaOpen'),
        agendaRotate: $('agendaRotate'),
        // klanten
        newKlantBtn: $('newKlantBtn'), klantFilters: $('klantFilters'),
        klantSearch: $('klantSearch'),
        klantenState: $('klantenState'), klantenList: $('klantenList'),
        klantDrawer: $('klantDrawer'), klantOverlay: $('klantOverlay'),
        kdClose: $('kdClose'), kdHeading: $('kdHeading'), kdError: $('kdError'),
        kdSave: $('kdSave'), kdDelete: $('kdDelete'), kdPlan: $('kdPlan'),
        kdKlussenWrap: $('kdKlussenWrap'), kdKlussen: $('kdKlussen'),
        kfNaam: $('kf-naam'), kfBedrijf: $('kf-bedrijf'), kfEmail: $('kf-email'),
        kfTelefoon: $('kf-telefoon'), kfAdres: $('kf-adres'),
        kfPostcode: $('kf-postcode'), kfPlaats: $('kf-plaats'),
        kfUurtarief: $('kf-uurtarief'), kfNotities: $('kf-notities'),
        kfArchived: $('kf-archived'),
        // projects
        newProjectBtn: $('newProjectBtn'),
        projectsState: $('projectsState'), projectsList: $('projectsList'),
        projDrawer: $('projDrawer'), projDrawerOverlay: $('projDrawerOverlay'),
        pdClose: $('pdClose'), pdHeading: $('pdHeading'),
        pfTitle: $('pf-title'), pfLocation: $('pf-location'),
        pfDescription: $('pf-description'), pfPublished: $('pf-published'),
        pfFiles: $('pf-files'), photoGrid: $('photoGrid'),
        photoUploading: $('photoUploading'), photoUploadingText: $('photoUploadingText'),
        pdError: $('pdError'), pdSave: $('pdSave'), pdDelete: $('pdDelete'),
        // settings
        settingsState: $('settingsState'), settingsBody: $('settingsBody'),
        settingsForm: $('settingsForm'), settingsSaved: $('settingsSaved'),
        saveSettingsBtn: $('saveSettingsBtn'),
        // hero photo + crop modal
        heroPhotoPreview: $('heroPhotoPreview'),
        heroPhotoChange:  $('heroPhotoChange'),
        heroPhotoReset:   $('heroPhotoReset'),
        heroPhotoFile:    $('heroPhotoFile'),
        cropOverlay: $('cropOverlay'),
        cropModal:   $('cropModal'),
        cropClose:   $('cropClose'),
        cropCancel:  $('cropCancel'),
        cropSave:    $('cropSave'),
        cropStage:   $('cropStage'),
        cropImage:   $('cropImage'),
        cropZoom:    $('cropZoom'),
        cropZoomIn:  $('cropZoomIn'),
        cropZoomOut: $('cropZoomOut'),
        // misc
        toast: $('toast'),
    };

    /* ---------- state ---------- */
    let supabase = null;
    let rows = [];
    let filter = 'all';
    let query = '';
    let activeRequestId = null;

    let projects = [];
    let editingProject = null;   // null | { id?, photos: [{id?, storage_path, url, sort_order, _new?}] }

    let klanten = [];
    let klusCounts = {};
    let klantenLoaded = false;
    let klantFilter = 'actief';
    let klantQuery = '';
    let editingKlantId = null;   // null = nieuwe klant

    let weekStart = startOfWeek(new Date());
    let weekKlussen = [];
    let editingKlusId = null;
    let bewerktReeks = null;       // de reeks waar de open klus bij hoort
    let bewerktHeleReeks = false;  // opslaan werkt de hele reeks bij
    let planningLoaded = false;
    let uitCacheSinds = null;      // gevuld als de week uit de lokale kopie komt
    let adminSettings = {};

    /* ---------- helpers ---------- */
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function showError(msg) {
        el.loginError.textContent = msg;
        el.loginError.classList.remove('hidden');
    }

    let toastTimer;
    function toast(msg) {
        el.toast.textContent = msg;
        el.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) +
            ' · ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }

    const serviceLabel = (s) => (s ? SERVICE_LABEL[s] || s : '—');

    function publicUrl(path) {
        if (!supabase || !path) return '';
        return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    /* ---------- lokale kopie voor offline ---------- */

    // Zonder bereik in een tuin moet de planning van vandaag gewoon in beeld
    // staan. De service worker bewaart de schil; deze kopie bewaart de inhoud.
    // Bewust op dit toestel en achter de login: het staat naast het
    // sessietoken dat Supabase daar toch al neerzet, en gaat er bij uitloggen
    // ook weer samen mee weg.
    const CACHE_PREFIX = 'vh-cache-';

    function bewaarLokaal(sleutel, waarde) {
        try {
            localStorage.setItem(CACHE_PREFIX + sleutel,
                JSON.stringify({ op: Date.now(), waarde }));
        } catch {
            // vol of geweigerd (privémodus) — dan gewoon zonder kopie verder
        }
    }

    function leesLokaal(sleutel) {
        try {
            const ruw = localStorage.getItem(CACHE_PREFIX + sleutel);
            return ruw ? JSON.parse(ruw) : null;
        } catch {
            return null;
        }
    }

    function wisLokaal() {
        try {
            Object.keys(localStorage)
                .filter((k) => k.startsWith(CACHE_PREFIX))
                .forEach((k) => localStorage.removeItem(k));
        } catch {}
    }

    /* ---------- boot ---------- */
    async function boot() {
        let cfg;
        try {
            const res = await fetch('/api/config');
            if (!res.ok) throw new Error();
            cfg = await res.json();
        } catch {
            showError('Kan de serverconfiguratie niet laden. Is Supabase ingesteld in Vercel?');
            return;
        }

        supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

        const { data } = await supabase.auth.getSession();
        if (data.session) enterApp(data.session.user);
    }

    /* ---------- auth ---------- */
    el.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        el.loginError.classList.add('hidden');
        el.loginBtn.disabled = true;
        el.loginBtn.textContent = 'Bezig…';

        const { data, error } = await supabase.auth.signInWithPassword({
            email: el.email.value.trim(),
            password: el.password.value,
        });

        el.loginBtn.disabled = false;
        el.loginBtn.textContent = 'Inloggen';

        if (error) {
            showError('Inloggen mislukt. Controleer uw e-mailadres en wachtwoord.');
            return;
        }
        enterApp(data.user);
    });

    el.logoutBtn.addEventListener('click', async () => {
        // De lokale kopie hoort bij deze gebruiker; die gaat mee de deur uit.
        wisLokaal();
        await supabase.auth.signOut();
        location.reload();
    });

    async function enterApp(user) {
        el.userEmail.textContent = user.email;
        el.loginView.classList.add('hidden');
        el.appView.classList.remove('hidden');

        loadRequests(true);      // stil op de achtergrond, voor de badge

        // De app-schil wacht hierop met de tip om het portaal op het
        // beginscherm te zetten — die hoort niet op het inlogscherm.
        window.dispatchEvent(new Event('vh:ingelogd'));

        // Wachten voordat de diepe link opengaat: de lade heeft de klantenlijst
        // en het standaardtarief nodig om compleet te zijn.
        await Promise.all([loadAdminSettings(), loadPlanning()]);
        volgStartLink();
    }

    /* ---------- view switching ---------- */
    const tabs = document.querySelectorAll('.tab');
    const views = document.querySelectorAll('.view');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    function switchView(name) {
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === name));
        views.forEach((v) => v.classList.toggle('active', v.dataset.viewContent === name));
        if (name === 'planning'  && !planningLoaded)  loadPlanning();
        // De planning haalt de klanten stil op; dan is er data maar nog geen
        // lijst getekend. Alleen opnieuw laden als we echt niets hebben.
        if (name === 'klanten')  klantenLoaded ? renderKlanten() : loadKlanten();
        if (name === 'projecten' && !projects.length) loadProjects();
        if (name === 'settings')  loadSettings();
    }

    /* ==========================================================================
       AANVRAGEN
       ========================================================================== */
    async function loadRequests(silent = false) {
        if (!silent) {
            el.tableState.classList.remove('hidden');
            el.table.classList.add('hidden');
            el.tableState.innerHTML = '<div class="spinner"></div>Aanvragen laden…';
        }

        const { data, error } = await supabase
            .from('contact_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            if (!silent) {
                el.tableState.innerHTML =
                    '<div class="empty"><h3>Kon de aanvragen niet laden</h3><p>' +
                    esc(error.message) + '</p></div>';
            }
            return;
        }

        rows = data || [];
        updateStats();
        renderRequests();
    }

    function updateStats() {
        const c = { nieuw: 0, gecontacteerd: 0, afgerond: 0, gearchiveerd: 0 };
        rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
        el.statNew.textContent = c.nieuw;
        el.statContacted.textContent = c.gecontacteerd;
        el.statDone.textContent = c.afgerond;
        el.statTotal.textContent = rows.length;

        // Tab badge with the number of unhandled (nieuw) requests
        const badge = document.getElementById('tabBadgeNieuw');
        if (badge) {
            badge.textContent = String(c.nieuw);
            badge.classList.toggle('hidden', c.nieuw === 0);
        }
    }

    /* "5 min. geleden" for fresh items, full date for older ones */
    function relTime(iso) {
        const ms = Date.now() - new Date(iso).getTime();
        const min = Math.floor(ms / 60000);
        if (min < 1) return 'zojuist';
        if (min < 60) return `${min} min. geleden`;
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return `${hrs} uur geleden`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return days === 1 ? 'gisteren' : `${days} dagen geleden`;
        return fmtDate(iso);
    }

    function visibleRows() {
        return rows.filter((r) => {
            // "Alle" hides archived requests — only the Gearchiveerd filter shows them
            if (filter === 'all' && r.status === 'gearchiveerd') return false;
            if (filter !== 'all' && r.status !== filter) return false;
            if (query) {
                const hay = (r.name + ' ' + r.email + ' ' + (r.message || '') + ' ' + (r.phone || '')).toLowerCase();
                if (!hay.includes(query)) return false;
            }
            return true;
        });
    }

    function renderRequests() {
        const list = visibleRows();
        el.tableState.classList.add('hidden');
        el.table.classList.remove('hidden');

        if (!list.length) {
            el.table.classList.add('hidden');
            el.tableState.classList.remove('hidden');
            el.tableState.innerHTML =
                '<div class="empty"><h3>Geen aanvragen</h3><p>Er zijn geen berichten die aan dit filter voldoen.</p></div>';
            return;
        }

        el.tbody.innerHTML = list.map((r) => `
            <tr data-id="${r.id}" data-status="${esc(r.status)}">
                <td>
                    <div class="cell-name">${esc(r.name)}</div>
                    <div class="cell-sub">${esc(r.email)}</div>
                </td>
                <td class="col-hide-sm">${esc(serviceLabel(r.service))}</td>
                <td class="col-hide-sm"><span class="cell-date" title="${esc(fmtDate(r.created_at))}">${esc(relTime(r.created_at))}</span></td>
                <td>
                    <div class="row-actions">
                        <select class="status-select" data-id="${r.id}">
                            ${STATUSES.map((s) =>
                                `<option value="${s}" ${s === r.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
                            ).join('')}
                        </select>
                        <button type="button" class="row-delete" data-id="${r.id}" aria-label="Verwijder aanvraag" title="Verwijderen">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    el.filters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter');
        if (!btn) return;
        el.filters.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        renderRequests();
    });

    el.search.addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        renderRequests();
    });

    el.tbody.addEventListener('click', (e) => {
        const del = e.target.closest('.row-delete');
        if (del) {
            e.stopPropagation();
            deleteRequest(del.dataset.id);
            return;
        }
        if (e.target.closest('.status-select')) return;
        const tr = e.target.closest('tr');
        if (tr) openRequestDrawer(tr.dataset.id);
    });

    async function deleteRequest(id) {
        const row = rows.find((r) => r.id === id);
        if (!row) return;
        if (!confirm(`Aanvraag van "${row.name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;

        const { error } = await supabase
            .from('contact_requests')
            .delete()
            .eq('id', id);

        if (error) { toast('Verwijderen mislukt.'); return; }

        rows = rows.filter((r) => r.id !== id);
        updateStats();
        renderRequests();
        if (activeRequestId === id) closeRequestDrawer();
        toast('Aanvraag verwijderd.');
    }

    el.tbody.addEventListener('change', async (e) => {
        const sel = e.target.closest('.status-select');
        if (!sel) return;
        await updateRequestStatus(sel.dataset.id, sel.value);
    });

    async function updateRequestStatus(id, status) {
        const { error } = await supabase
            .from('contact_requests').update({ status }).eq('id', id);
        if (error) return toast('Bijwerken mislukt.');
        const row = rows.find((r) => r.id === id);
        if (row) row.status = status;
        // keep the row accent in sync without a full re-render
        el.tbody.querySelector(`tr[data-id="${id}"]`)?.setAttribute('data-status', status);
        updateStats();
        if (activeRequestId === id) paintRequestPill(status);
        if (filter !== 'all') renderRequests();
        toast('Status bijgewerkt naar “' + STATUS_LABEL[status] + '”.');
    }

    function paintRequestPill(status) {
        el.dPill.className = 'pill pill-' + status;
        el.dPill.textContent = STATUS_LABEL[status];
    }

    function openRequestDrawer(id) {
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        activeRequestId = id;
        el.dName.textContent = r.name;
        paintRequestPill(r.status);
        el.dEmail.textContent = r.email;
        el.dEmail.href = 'mailto:' + r.email;
        el.dPhone.textContent = r.phone || '—';
        el.dPhone.href = r.phone ? 'tel:' + r.phone.replace(/\s/g, '') : '#';
        el.dService.textContent = serviceLabel(r.service);
        el.dDate.textContent = fmtDate(r.created_at);
        el.dMessage.textContent = r.message || 'Geen bericht meegegeven.';
        el.dMailto.href = `mailto:${r.email}?subject=${encodeURIComponent('Uw aanvraag bij Vermaire Hoveniers')}&body=${encodeURIComponent('Beste ' + r.name + ',\n\n')}`;
        el.drawer.classList.add('open');
        el.drawer.setAttribute('aria-hidden', 'false');
        el.drawerOverlay.classList.add('open');
    }

    function closeRequestDrawer() {
        activeRequestId = null;
        el.drawer.classList.remove('open');
        el.drawer.setAttribute('aria-hidden', 'true');
        el.drawerOverlay.classList.remove('open');
    }

    el.drawerClose.addEventListener('click', closeRequestDrawer);
    el.drawerOverlay.addEventListener('click', closeRequestDrawer);
    el.dArchive.addEventListener('click', async () => {
        if (!activeRequestId) return;
        await updateRequestStatus(activeRequestId, 'gearchiveerd');
        const sel = el.tbody.querySelector(`.status-select[data-id="${activeRequestId}"]`);
        if (sel) sel.value = 'gearchiveerd';
        closeRequestDrawer();
    });

    el.dDelete.addEventListener('click', () => {
        if (activeRequestId) deleteRequest(activeRequestId);
    });

    /* ==========================================================================
       PROJECTEN
       ========================================================================== */
    async function loadProjects() {
        el.projectsState.classList.remove('hidden');
        el.projectsList.classList.add('hidden');

        const { data, error } = await supabase
            .from('projects')
            .select('id, title, description, location, sort_order, published, created_at, project_photos(id, storage_path, alt, sort_order)')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            el.projectsState.innerHTML = '<div class="proj-empty"><h3>Kon projecten niet laden</h3><p>' + esc(error.message) + '</p></div>';
            return;
        }

        projects = (data || []).map((p) => ({
            ...p,
            photos: (p.project_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order),
        }));

        renderProjects();
    }

    function renderProjects() {
        el.projectsState.classList.add('hidden');
        el.projectsList.classList.remove('hidden');

        if (!projects.length) {
            el.projectsList.innerHTML = `
                <div class="proj-empty">
                    <h3>Nog geen projecten</h3>
                    <p>Klik op "+ Nieuw project" om uw eerste project toe te voegen.</p>
                </div>`;
            return;
        }

        el.projectsList.innerHTML = projects.map((p) => {
            const cover = p.photos[0] ? publicUrl(p.photos[0].storage_path) : null;
            return `
                <div class="proj-row" data-id="${p.id}" draggable="true">
                    <span class="proj-row-handle" aria-hidden="true" title="Sleep om te ordenen">⋮⋮</span>
                    <div class="proj-row-cover" ${cover ? `style="background-image:url('${esc(cover)}')"` : ''}>
                        ${!cover ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="1.5"/><path d="m21 17-4-4-9 9"/></svg>` : ''}
                        ${p.photos.length ? `<span class="proj-row-count">${p.photos.length} foto${p.photos.length === 1 ? '' : '\'s'}</span>` : ''}
                        ${!p.published ? `<span class="proj-row-status">Verborgen</span>` : ''}
                    </div>
                    <div class="proj-row-info">
                        <div class="proj-row-title">${esc(p.title)}</div>
                        ${p.location ? `<div class="proj-row-loc">${esc(p.location)}</div>` : ''}
                    </div>
                </div>`;
        }).join('');

        wireProjectDnD();
    }

    /* Drag-and-drop reorder of project rows. Persists the new sort_order to Supabase. */
    function wireProjectDnD() {
        const rows = el.projectsList.querySelectorAll('.proj-row');
        rows.forEach((row) => {
            row.addEventListener('dragstart', (e) => {
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.id);
            });
            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                rows.forEach((r) => r.classList.remove('dragover'));
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!row.classList.contains('dragging')) row.classList.add('dragover');
            });
            row.addEventListener('dragleave', () => row.classList.remove('dragover'));
            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                row.classList.remove('dragover');
                const fromId = e.dataTransfer.getData('text/plain');
                const toId   = row.dataset.id;
                if (!fromId || fromId === toId) return;

                const fromIdx = projects.findIndex((p) => p.id === fromId);
                const toIdx   = projects.findIndex((p) => p.id === toId);
                if (fromIdx < 0 || toIdx < 0) return;

                const moved = projects.splice(fromIdx, 1)[0];
                projects.splice(toIdx, 0, moved);

                // Rewrite sort_order in memory + DB
                projects.forEach((p, i) => { p.sort_order = i; });
                renderProjects();
                try {
                    await Promise.all(projects.map((p) =>
                        supabase.from('projects').update({ sort_order: p.sort_order }).eq('id', p.id)
                    ));
                    toast('Volgorde opgeslagen.');
                } catch (err) {
                    console.error(err);
                    toast('Volgorde opslaan mislukt.');
                }
            });
        });
    }

    el.projectsList.addEventListener('click', (e) => {
        const row = e.target.closest('.proj-row');
        if (!row) return;
        openProjectEditor(row.dataset.id);
    });

    el.newProjectBtn.addEventListener('click', () => openProjectEditor(null));

    /* ---- Project editor ---- */
    function openProjectEditor(id) {
        editingProject = id ? { ...projects.find((p) => p.id === id) } : { title: '', location: '', description: '', published: true, photos: [] };
        editingProject.photos = (editingProject.photos || []).map((p) => ({ ...p }));

        el.pdHeading.textContent = id ? 'Project bewerken' : 'Nieuw project';
        el.pdDelete.style.display = id ? 'inline-flex' : 'none';
        el.pdError.classList.add('hidden');

        el.pfTitle.value = editingProject.title || '';
        el.pfLocation.value = editingProject.location || '';
        el.pfDescription.value = editingProject.description || '';
        el.pfPublished.checked = editingProject.published !== false;

        renderPhotoGrid();

        el.projDrawer.classList.add('open');
        el.projDrawer.setAttribute('aria-hidden', 'false');
        el.projDrawerOverlay.classList.add('open');
    }

    function closeProjectEditor() {
        editingProject = null;
        el.projDrawer.classList.remove('open');
        el.projDrawer.setAttribute('aria-hidden', 'true');
        el.projDrawerOverlay.classList.remove('open');
    }

    el.pdClose.addEventListener('click', closeProjectEditor);
    el.projDrawerOverlay.addEventListener('click', closeProjectEditor);

    function renderPhotoGrid() {
        if (!editingProject) return;
        const photos = editingProject.photos;
        if (!photos.length) {
            el.photoGrid.innerHTML = '<div class="photo-hint" style="grid-column:1/-1;text-align:center;padding:1rem 0;">Nog geen foto\'s — klik "+ Foto\'s toevoegen".</div>';
            return;
        }
        el.photoGrid.innerHTML = photos.map((ph, i) => {
            const url = ph._localUrl || publicUrl(ph.storage_path);
            return `
                <div class="photo-tile" draggable="true" data-index="${i}">
                    <img src="${esc(url)}" alt="">
                    ${i === 0 ? '<span class="photo-tile-cover-badge">Cover</span>' : ''}
                    <div class="photo-tile-actions">
                        ${i > 0 ? '<button type="button" class="photo-tile-btn" data-act="up" title="Omhoog">↑</button>' : ''}
                        ${i < photos.length - 1 ? '<button type="button" class="photo-tile-btn" data-act="down" title="Omlaag">↓</button>' : ''}
                        <button type="button" class="photo-tile-btn danger" data-act="del" title="Verwijderen">×</button>
                    </div>
                </div>`;
        }).join('');

        // wire up drag-to-reorder + button actions
        el.photoGrid.querySelectorAll('.photo-tile').forEach((tile) => {
            tile.addEventListener('dragstart', (e) => {
                tile.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tile.dataset.index);
            });
            tile.addEventListener('dragend', () => {
                tile.classList.remove('dragging');
                el.photoGrid.querySelectorAll('.photo-tile').forEach((t) => t.classList.remove('dragover'));
            });
            tile.addEventListener('dragover', (e) => { e.preventDefault(); tile.classList.add('dragover'); });
            tile.addEventListener('dragleave', () => tile.classList.remove('dragover'));
            tile.addEventListener('drop', (e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData('text/plain'));
                const to   = Number(tile.dataset.index);
                if (Number.isFinite(from) && Number.isFinite(to) && from !== to) {
                    const ph = editingProject.photos.splice(from, 1)[0];
                    editingProject.photos.splice(to, 0, ph);
                    renderPhotoGrid();
                }
            });
        });

        el.photoGrid.addEventListener('click', onPhotoAction, { once: true });
    }

    function onPhotoAction(e) {
        const btn = e.target.closest('.photo-tile-btn');
        if (!btn) { renderPhotoGrid(); return; }
        const tile = btn.closest('.photo-tile');
        const i = Number(tile.dataset.index);
        const act = btn.dataset.act;

        if (act === 'del') {
            editingProject.photos.splice(i, 1);
        } else if (act === 'up' && i > 0) {
            [editingProject.photos[i - 1], editingProject.photos[i]] = [editingProject.photos[i], editingProject.photos[i - 1]];
        } else if (act === 'down' && i < editingProject.photos.length - 1) {
            [editingProject.photos[i + 1], editingProject.photos[i]] = [editingProject.photos[i], editingProject.photos[i + 1]];
        }
        renderPhotoGrid();
    }

    /* ---- Photo upload ---- */
    el.pfFiles.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length || !editingProject) return;

        el.photoUploading.classList.remove('hidden');

        for (let idx = 0; idx < files.length; idx++) {
            el.photoUploadingText.textContent = `Bezig met uploaden (${idx + 1}/${files.length})…`;
            const file = files[idx];
            try {
                const blob = await resizeImage(file, 1600, 0.85);
                const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
                const name = `${crypto.randomUUID()}.${ext}`;
                const { error } = await supabase.storage.from(BUCKET).upload(name, blob, {
                    contentType: blob.type, cacheControl: '31536000', upsert: false,
                });
                if (error) throw error;
                editingProject.photos.push({
                    storage_path: name,
                    alt: '',
                    sort_order: editingProject.photos.length,
                    _new: true,
                });
                renderPhotoGrid();
            } catch (err) {
                console.error('upload error', err);
                toast('Upload van een foto mislukt.');
            }
        }
        el.photoUploading.classList.add('hidden');
    });

    async function resizeImage(file, maxSize, quality) {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(file);
        });
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src);
        return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
    }

    /* ---- Save / Delete project ---- */
    el.pdSave.addEventListener('click', async () => {
        if (!editingProject) return;
        const title = (el.pfTitle.value || '').trim();
        if (!title) {
            el.pdError.textContent = 'Geef het project een titel.';
            el.pdError.classList.remove('hidden');
            return;
        }
        el.pdError.classList.add('hidden');
        el.pdSave.disabled = true;
        const origText = el.pdSave.textContent;
        el.pdSave.textContent = 'Opslaan…';

        try {
            const payload = {
                title,
                location: (el.pfLocation.value || '').trim() || null,
                description: (el.pfDescription.value || '').trim() || null,
                published: el.pfPublished.checked,
                sort_order: editingProject.sort_order || 0,
            };

            let projectId = editingProject.id;
            if (projectId) {
                const { error } = await supabase.from('projects').update(payload).eq('id', projectId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
                if (error) throw error;
                projectId = data.id;
            }

            // Reconcile photos: delete photos that were removed, upsert order/ids for rest
            const original = projects.find((p) => p.id === projectId)?.photos || [];
            const keepIds = new Set(editingProject.photos.filter((p) => p.id).map((p) => p.id));
            const toDelete = original.filter((p) => !keepIds.has(p.id));

            for (const p of toDelete) {
                await supabase.from('project_photos').delete().eq('id', p.id);
                await supabase.storage.from(BUCKET).remove([p.storage_path]).catch(() => {});
            }

            for (let i = 0; i < editingProject.photos.length; i++) {
                const ph = editingProject.photos[i];
                if (ph.id) {
                    await supabase.from('project_photos').update({ sort_order: i }).eq('id', ph.id);
                } else {
                    await supabase.from('project_photos').insert({
                        project_id: projectId,
                        storage_path: ph.storage_path,
                        alt: ph.alt || title,
                        sort_order: i,
                    });
                }
            }

            toast('Project opgeslagen.');
            closeProjectEditor();
            await loadProjects();
        } catch (err) {
            console.error('save project error', err);
            el.pdError.textContent = 'Opslaan mislukt: ' + (err.message || 'onbekende fout');
            el.pdError.classList.remove('hidden');
        } finally {
            el.pdSave.disabled = false;
            el.pdSave.textContent = origText;
        }
    });

    el.pdDelete.addEventListener('click', async () => {
        if (!editingProject?.id) return;
        if (!confirm(`Project "${editingProject.title}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;

        const paths = (editingProject.photos || []).map((p) => p.storage_path).filter(Boolean);
        const { error } = await supabase.from('projects').delete().eq('id', editingProject.id);
        if (error) { toast('Verwijderen mislukt.'); return; }
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});

        toast('Project verwijderd.');
        closeProjectEditor();
        await loadProjects();
    });

    /* ==========================================================================
       SITE SETTINGS
       ========================================================================== */
    async function loadSettings() {
        el.settingsState.classList.remove('hidden');
        el.settingsBody.classList.add('hidden');
        el.settingsSaved.classList.add('hidden');

        const keys = [...SETTING_KEYS, 'hero_image_url'];
        const { data, error } = await supabase
            .from('site_settings')
            .select('key, value')
            .in('key', keys);

        if (error) {
            el.settingsState.innerHTML = '<p>Kon instellingen niet laden: ' + esc(error.message) + '</p>';
            return;
        }

        const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
        SETTING_KEYS.forEach((key) => {
            const input = document.querySelector(`[data-key="${key}"]`);
            if (input) input.value = map[key] || '';
        });

        // Hero photo preview (custom URL from settings, or fallback to bundled default)
        el.heroPhotoPreview.src = map.hero_image_url || '../assets/hero.jpg';

        await loadAdminSettings();
        document.querySelectorAll('[data-adminkey]').forEach((input) => {
            input.value = adminSettings[input.dataset.adminkey] ?? '';
        });

        el.settingsState.classList.add('hidden');
        el.settingsBody.classList.remove('hidden');
    }

    el.settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        el.saveSettingsBtn.disabled = true;
        const origText = el.saveSettingsBtn.textContent;
        el.saveSettingsBtn.textContent = 'Opslaan…';
        el.settingsSaved.classList.add('hidden');

        const rows = SETTING_KEYS.map((key) => {
            const input = document.querySelector(`[data-key="${key}"]`);
            return { key, value: input ? input.value.trim() : '' };
        });

        // De interne instellingen staan in een eigen tabel, omdat site_settings
        // publiek leesbaar is en tarieven daar niet in horen.
        const adminRows = Array.from(document.querySelectorAll('[data-adminkey]'))
            .map((input) => ({ key: input.dataset.adminkey, value: input.value.trim() }));

        const [{ error }, { error: adminError }] = await Promise.all([
            supabase.from('site_settings').upsert(rows, { onConflict: 'key' }),
            supabase.from('admin_settings').upsert(adminRows, { onConflict: 'key' }),
        ]);

        el.saveSettingsBtn.disabled = false;
        el.saveSettingsBtn.textContent = origText;

        if (error || adminError) { toast('Opslaan mislukt.'); return; }
        await loadAdminSettings();
        el.settingsSaved.classList.remove('hidden');
        toast('Site info opgeslagen.');
        setTimeout(() => el.settingsSaved.classList.add('hidden'), 3000);
    });

    /* ==========================================================================
       HERO PHOTO — pick → crop → upload → save URL in site_settings
       ========================================================================== */

    const crop = {
        baseW: 0,    // width image is set to in CSS (covers stage)
        baseH: 0,
        zoom: 1,
        posX: 0,
        posY: 0,
        dragging: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
    };

    function openCropModal() {
        el.cropOverlay.hidden = false;
        el.cropModal.hidden = false;
        // next frame so CSS transition fires
        requestAnimationFrame(() => {
            el.cropOverlay.classList.add('open');
            el.cropModal.classList.add('open');
            el.cropModal.setAttribute('aria-hidden', 'false');
        });
    }

    function closeCropModal() {
        el.cropOverlay.classList.remove('open');
        el.cropModal.classList.remove('open');
        el.cropModal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            el.cropOverlay.hidden = true;
            el.cropModal.hidden = true;
            // clean up the object URL we created
            if (el.cropImage.src && el.cropImage.src.startsWith('blob:')) {
                URL.revokeObjectURL(el.cropImage.src);
            }
        }, 260);
    }

    function fitCropImage() {
        const sw = el.cropStage.clientWidth;
        const sh = el.cropStage.clientHeight;
        const iw = el.cropImage.naturalWidth;
        const ih = el.cropImage.naturalHeight;
        if (!iw || !ih) return;
        const scale = Math.max(sw / iw, sh / ih);
        crop.baseW = iw * scale;
        crop.baseH = ih * scale;
        el.cropImage.style.width  = crop.baseW + 'px';
        el.cropImage.style.height = crop.baseH + 'px';
        crop.zoom = 1;
        el.cropZoom.value = '1';
        // Center
        crop.posX = (sw - crop.baseW * crop.zoom) / 2;
        crop.posY = (sh - crop.baseH * crop.zoom) / 2;
        applyCropTransform();
    }

    function applyCropTransform() {
        const sw = el.cropStage.clientWidth;
        const sh = el.cropStage.clientHeight;
        const dispW = crop.baseW * crop.zoom;
        const dispH = crop.baseH * crop.zoom;
        // clamp so the image always covers the stage
        const minX = sw - dispW;
        const minY = sh - dispH;
        crop.posX = Math.max(minX, Math.min(0, crop.posX));
        crop.posY = Math.max(minY, Math.min(0, crop.posY));
        el.cropImage.style.transform =
            `translate(${crop.posX}px, ${crop.posY}px) scale(${crop.zoom})`;
    }

    /* Drag (pointer events cover mouse + touch + pen) */
    el.cropStage.addEventListener('pointerdown', (e) => {
        crop.dragging = true;
        crop.startX = e.clientX;
        crop.startY = e.clientY;
        crop.startPosX = crop.posX;
        crop.startPosY = crop.posY;
        el.cropStage.setPointerCapture(e.pointerId);
    });
    el.cropStage.addEventListener('pointermove', (e) => {
        if (!crop.dragging) return;
        crop.posX = crop.startPosX + (e.clientX - crop.startX);
        crop.posY = crop.startPosY + (e.clientY - crop.startY);
        applyCropTransform();
    });
    const endDrag = (e) => {
        crop.dragging = false;
        try { el.cropStage.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.cropStage.addEventListener('pointerup',     endDrag);
    el.cropStage.addEventListener('pointercancel', endDrag);

    /* Zoom (slider + +/- buttons + wheel) */
    el.cropZoom.addEventListener('input', () => {
        const newZoom = Number(el.cropZoom.value);
        zoomAround(newZoom, el.cropStage.clientWidth / 2, el.cropStage.clientHeight / 2);
    });
    el.cropZoomIn.addEventListener('click',  () => stepZoom( 0.15));
    el.cropZoomOut.addEventListener('click', () => stepZoom(-0.15));
    el.cropStage.addEventListener('wheel', (e) => {
        e.preventDefault();
        stepZoom(e.deltaY > 0 ? -0.05 : 0.05, e.offsetX, e.offsetY);
    }, { passive: false });

    function stepZoom(delta, cx, cy) {
        const newZoom = Math.max(1, Math.min(3, crop.zoom + delta));
        if (cx == null) cx = el.cropStage.clientWidth / 2;
        if (cy == null) cy = el.cropStage.clientHeight / 2;
        zoomAround(newZoom, cx, cy);
        el.cropZoom.value = String(newZoom);
    }

    function zoomAround(newZoom, cx, cy) {
        // Keep the point under (cx,cy) stationary
        const oldZoom = crop.zoom;
        const k = newZoom / oldZoom;
        crop.posX = cx - (cx - crop.posX) * k;
        crop.posY = cy - (cy - crop.posY) * k;
        crop.zoom = newZoom;
        applyCropTransform();
    }

    /* "Wijzig foto" → file picker */
    el.heroPhotoChange.addEventListener('click', () => el.heroPhotoFile.click());

    el.heroPhotoFile.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        // Reset previous src if blob
        if (el.cropImage.src && el.cropImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(el.cropImage.src);
        }
        const url = URL.createObjectURL(file);
        el.cropImage.onload = () => {
            openCropModal();
            // wait one frame so layout is settled
            requestAnimationFrame(fitCropImage);
        };
        el.cropImage.src = url;
    });

    el.cropClose.addEventListener('click', closeCropModal);
    el.cropCancel.addEventListener('click', closeCropModal);
    el.cropOverlay.addEventListener('click', closeCropModal);

    /* Save crop → render canvas → upload → store URL */
    el.cropSave.addEventListener('click', async () => {
        const sw = el.cropStage.clientWidth;
        const sh = el.cropStage.clientHeight;
        const dispW = crop.baseW * crop.zoom;
        // displayed-pixel → natural-pixel ratio
        const ratio = el.cropImage.naturalWidth / dispW;

        const sx = -crop.posX * ratio;
        const sy = -crop.posY * ratio;
        const sWidth  = sw * ratio;
        const sHeight = sh * ratio;

        const outSize = 1000; // 1000×1000 output
        const canvas = document.createElement('canvas');
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(el.cropImage, sx, sy, sWidth, sHeight, 0, 0, outSize, outSize);

        el.cropSave.disabled = true;
        const orig = el.cropSave.textContent;
        el.cropSave.textContent = 'Bezig met opslaan…';

        try {
            const blob = await new Promise((resolve) =>
                canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88));
            if (!blob) throw new Error('Kon de afbeelding niet exporteren.');

            const name = `site/hero-${crypto.randomUUID()}.jpg`;
            const { error: upErr } = await supabase.storage
                .from(BUCKET)
                .upload(name, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
            if (upErr) throw upErr;

            const newUrl = supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

            const { error: setErr } = await supabase
                .from('site_settings')
                .upsert({ key: 'hero_image_url', value: newUrl }, { onConflict: 'key' });
            if (setErr) throw setErr;

            el.heroPhotoPreview.src = newUrl + '?v=' + Date.now(); // bust cache
            toast('Hero foto opgeslagen.');
            closeCropModal();
        } catch (err) {
            console.error('hero crop save error:', err);
            toast('Opslaan mislukt: ' + (err.message || 'onbekende fout'));
        } finally {
            el.cropSave.disabled = false;
            el.cropSave.textContent = orig;
        }
    });

    /* "Herstel standaard" → wipe the setting, preview returns to bundled image */
    el.heroPhotoReset.addEventListener('click', async () => {
        if (!confirm('Hero foto terug naar de standaardfoto?')) return;
        const { error } = await supabase
            .from('site_settings')
            .upsert({ key: 'hero_image_url', value: '' }, { onConflict: 'key' });
        if (error) { toast('Herstellen mislukt.'); return; }
        el.heroPhotoPreview.src = '../assets/hero.jpg';
        toast('Hero foto teruggezet naar standaard.');
    });

    /* ==========================================================================
       PLANNING — weekkalender
       ========================================================================== */

    const ROW = 46;              // hoogte van één uur in px, spiegelt --row in de CSS
    const DAY_START = 7;         // standaard zichtbaar venster
    const DAY_END = 19;
    const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

    const SOORT_LABEL = {
        beplanting: 'Beplanting',
        groenadvies: 'Groenadvies',
        onderhoud: 'Onderhoud',
        bezichtiging: 'Bezichtiging',
        anders: 'Overig',
    };

    const pad2 = (n) => String(n).padStart(2, '0');

    // Let op: geen toISOString() voor datums in formulieren — die zet om naar
    // UTC en verschuift 's zomers de dag.
    const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const hm  = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    function startOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const shift = (d.getDay() + 6) % 7;   // maandag = 0
        d.setDate(d.getDate() - shift);
        return d;
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    async function loadPlanning(silent = false) {
        if (!silent) {
            el.calState.classList.remove('hidden');
            el.calendar.classList.add('hidden');
            el.calState.innerHTML = '<div class="spinner"></div>Planning laden…';
        }

        if (!klanten.length) await loadKlanten(true);

        const from = weekStart.toISOString();
        const until = addDays(weekStart, 7).toISOString();

        // Overlappend in plaats van "begint in deze week", anders valt een klus
        // die zondag om 23:00 begint uit beeld zodra je een week verder klikt.
        const { data, error } = await supabase
            .from('klussen')
            .select('*')
            .lt('start_tijd', until)
            .gt('eind_tijd', from)
            .order('start_tijd', { ascending: true });

        const weekSleutel = 'klussen-' + ymd(weekStart);

        if (error) {
            // Geen bereik? Toon de laatst opgehaalde week in plaats van een
            // foutmelding — dat is precies waar deze kopie voor is.
            const bewaard = leesLokaal(weekSleutel);
            if (bewaard) {
                weekKlussen = bewaard.waarde;
                planningLoaded = true;
                uitCacheSinds = bewaard.op;
                renderCalendar();
                return;
            }

            uitCacheSinds = null;

            // Meest waarschijnlijke oorzaak: het uitgebreide schema is nog niet
            // in Supabase gedraaid. Zeg dat, in plaats van een Postgres-foutcode.
            const missing = /does not exist|schema cache/i.test(error.message || '');
            el.calState.innerHTML = missing
                ? '<div class="empty"><h3>Planning nog niet ingericht</h3>' +
                  '<p>Draai <code>supabase/schema.sql</code> opnieuw in de Supabase SQL Editor. ' +
                  'Daarna werkt de planning meteen.</p></div>'
                : '<div class="empty"><h3>Kon de planning niet laden</h3><p>' +
                  esc(error.message) + '</p></div>';
            return;
        }

        weekKlussen = data || [];
        planningLoaded = true;
        uitCacheSinds = null;
        bewaarLokaal(weekSleutel, weekKlussen);
        renderCalendar();

        // Het weer mag de kalender niet ophouden: eerst tekenen, dan het weer
        // erbij zodra het binnen is. Valt de weerdienst uit, dan mist alleen
        // de weerstrook en werkt de planning gewoon door.
        if (window.Weer) {
            window.Weer.laden().then((w) => { if (w) renderCalendar(); });
        }
    }

    function renderCalendar() {
        el.calState.classList.add('hidden');
        el.calendar.classList.remove('hidden');
        el.calendar.style.setProperty('--row', ROW + 'px');

        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const today = new Date();

        /* --- kop --- */
        el.calTitle.textContent = weekLabel(days[0], days[6]);

        let head = '<div class="cal-head-cell cal-head-gutter"></div>';
        days.forEach((d, i) => {
            head += `
                <div class="cal-head-cell${sameDay(d, today) ? ' is-today' : ''}">
                    <div class="cal-dayname">${DAY_NAMES[i]}</div>
                    <div class="cal-daynum">${d.getDate()}</div>
                    ${window.Weer ? window.Weer.dagkopHTML(ymd(d)) : ''}
                </div>`;
        });
        el.calHead.innerHTML = head;
        if (window.Weer) el.weerNu.innerHTML = window.Weer.nuHTML();

        /* --- zichtbaar urenvenster oprekken tot alles past --- */
        let minH = DAY_START;
        let maxH = DAY_END;
        weekKlussen.forEach((k) => {
            const s = new Date(k.start_tijd);
            const e = new Date(k.eind_tijd);
            minH = Math.min(minH, s.getHours());
            maxH = Math.max(maxH, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
        });
        minH = Math.max(0, minH);
        maxH = Math.min(24, Math.max(maxH, minH + 4));

        const height = (maxH - minH) * ROW;

        /* --- urenkolom --- */
        let body = '<div class="cal-gutter">';
        for (let h = minH; h < maxH; h++) {
            body += `<div class="cal-hour">${pad2(h)}:00</div>`;
        }
        body += '</div>';

        /* --- dagkolommen --- */
        days.forEach((day, i) => {
            const isToday = sameDay(day, today);
            const classes = ['cal-day'];
            if (i >= 5) classes.push('is-weekend');
            if (isToday) classes.push('is-today');

            let cell = `<div class="${classes.join(' ')}" data-date="${ymd(day)}"
                             style="height:${height}px">`;

            if (isToday) {
                const nowH = today.getHours() + today.getMinutes() / 60;
                if (nowH >= minH && nowH <= maxH) {
                    cell += `<div class="cal-now" style="top:${(nowH - minH) * ROW}px"></div>`;
                }
            }

            const items = klussenForDay(day);
            layoutDay(items);

            items.forEach((it) => {
                const width = 100 / it.lanes;
                const top = Math.max(0, (it.from - minH) * ROW);
                const blockH = Math.max(24, (it.to - it.from) * ROW - 2);
                const k = it.klus;
                const klant = klanten.find((c) => c.id === k.klant_id);
                const cls = ['cal-klus', 'soort-' + k.soort, 'is-' + k.status];

                cell += `
                    <button type="button" class="${cls.join(' ')}" data-klus="${k.id}"
                            style="top:${top}px;height:${blockH}px;
                                   left:calc(${it.lane * width}% + 2px);
                                   width:calc(${width}% - 4px)"
                            title="${esc(tooltip(k, klant))}">
                        ${window.Weer && k.status !== 'geannuleerd'
                            ? window.Weer.klusMerkHTML(new Date(k.start_tijd), new Date(k.eind_tijd), k.soort)
                            : ''}
                        <span class="cal-klus-time">${hm(new Date(k.start_tijd))}${
                            k.reeks_id ? '<span class="cal-klus-reeks" aria-label="Terugkerend">⟳</span>' : ''}</span>
                        <span class="cal-klus-title">${esc(k.titel)}</span>
                        ${klant ? `<span class="cal-klus-klant">${esc(klant.naam)}</span>` : ''}
                    </button>`;
            });

            cell += '</div>';
            body += cell;
        });

        el.calBody.innerHTML = body;
        renderWeekSummary();
        scrollToToday(days.findIndex((d) => sameDay(d, today)));
    }

    // Op een telefoon passen zeven dagen niet naast elkaar. In plaats van de
    // week af te knippen laten we hem scrollen en beginnen we bij vandaag.
    function scrollToToday(index) {
        if (index < 0) return;
        if (el.calendar.scrollWidth <= el.calendar.clientWidth) return;

        const column = el.calBody.children[index + 1];   // +1: de urenkolom
        const gutter = el.calBody.querySelector('.cal-gutter');
        if (!column || !gutter) return;

        const offset = column.getBoundingClientRect().left
            - el.calendar.getBoundingClientRect().left
            - gutter.getBoundingClientRect().width;

        el.calendar.scrollLeft += offset;
    }

    // Het blok zelf is klein; de tooltip geeft het hele verhaal.
    function tooltip(klus, klant) {
        const s = new Date(klus.start_tijd);
        const e = new Date(klus.eind_tijd);
        return [
            `${hm(s)}–${hm(e)}  ${klus.titel}`,
            SOORT_LABEL[klus.soort] || klus.soort,
            klant ? klant.naam : '',
            klus.adres || klantAdres(klant),
            klus.status !== 'gepland' ? `Status: ${klus.status}` : '',
        ].filter(Boolean).join('\n');
    }

    // Alles wat op deze dag zichtbaar is, met start/eind als uren-in-decimalen
    // en geklemd op de dag zelf (een klus over middernacht loopt niet door).
    function klussenForDay(day) {
        const dayStart = new Date(day);
        const dayEnd = addDays(dayStart, 1);

        return weekKlussen
            .filter((k) => new Date(k.start_tijd) < dayEnd && new Date(k.eind_tijd) > dayStart)
            .map((k) => {
                const s = new Date(k.start_tijd);
                const e = new Date(k.eind_tijd);
                const from = s < dayStart ? 0 : s.getHours() + s.getMinutes() / 60;
                const to = e > dayEnd ? 24 : e.getHours() + e.getMinutes() / 60;
                return {
                    klus: k,
                    from,
                    to: Math.max(to, from + 0.25),
                    startMs: Math.max(s.getTime(), dayStart.getTime()),
                    endMs: Math.min(e.getTime(), dayEnd.getTime()),
                    lane: 0,
                    lanes: 1,
                };
            });
    }

    // Verdeelt overlappende klussen over kolommen. Alleen klussen die elkaar
    // écht raken delen de breedte — twee losse klussen blijven vol breed.
    function layoutDay(items) {
        items.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

        let cluster = [];
        let clusterEnd = -Infinity;

        const flush = () => {
            if (!cluster.length) return;
            const lanes = [];
            cluster.forEach((it) => {
                let lane = lanes.findIndex((end) => end <= it.startMs);
                if (lane === -1) { lane = lanes.length; lanes.push(0); }
                lanes[lane] = it.endMs;
                it.lane = lane;
            });
            cluster.forEach((it) => { it.lanes = lanes.length; });
            cluster = [];
        };

        items.forEach((it) => {
            if (it.startMs >= clusterEnd) flush();
            cluster.push(it);
            clusterEnd = Math.max(clusterEnd, it.endMs);
        });
        flush();
    }

    function weekLabel(from, to) {
        const opts = { day: 'numeric', month: 'long' };
        const a = from.toLocaleDateString('nl-NL', opts);
        const b = to.toLocaleDateString('nl-NL', opts);
        const year = to.getFullYear() === new Date().getFullYear() ? '' : ' ' + to.getFullYear();
        return `${a} — ${b}${year}`;
    }

    function renderWeekSummary() {
        const actief = weekKlussen.filter((k) => k.status !== 'geannuleerd');
        const uren = actief.reduce((sum, k) => {
            const ms = new Date(k.eind_tijd) - new Date(k.start_tijd);
            return sum + ms / 3600000;
        }, 0);

        if (!actief.length) {
            el.calSummary.innerHTML = uitCacheSinds
                ? 'Geen verbinding — deze week stond niets ingepland.'
                : 'Nog niets ingepland deze week.';
            return;
        }

        const n = actief.length;
        el.calSummary.innerHTML =
            `<strong>${n}</strong> ${n === 1 ? 'klus' : 'klussen'} · ` +
            `<strong>${uren.toFixed(1).replace('.', ',')}</strong> uur ingepland` +
            (uitCacheSinds ? ` · <span class="cal-oud">bijgewerkt ${relTime(new Date(uitCacheSinds).toISOString())}</span>` : '');
    }

    /* ---------- week-navigatie ---------- */
    el.calPrev.addEventListener('click', () => { weekStart = addDays(weekStart, -7); loadPlanning(); });
    el.calNext.addEventListener('click', () => { weekStart = addDays(weekStart, 7); loadPlanning(); });
    el.calToday.addEventListener('click', () => { weekStart = startOfWeek(new Date()); loadPlanning(); });

    /* ---------- klikken in de kalender ---------- */
    el.calBody.addEventListener('click', (e) => {
        const block = e.target.closest('.cal-klus');
        if (block) return openKlusDrawer(block.dataset.klus);

        const day = e.target.closest('.cal-day');
        if (!day) return;

        // Op het aangeklikte uur beginnen, afgerond op het kwartier erboven.
        const firstHour = Number(el.calBody.querySelector('.cal-hour')?.textContent.slice(0, 2) || DAY_START);
        const offset = e.clientY - day.getBoundingClientRect().top;
        const hour = Math.min(23, firstHour + Math.floor(offset / ROW));

        openKlusDrawer(null, { datum: day.dataset.date, start: `${pad2(hour)}:00` });
    });

    /* ==========================================================================
       KLUS-LADE
       ========================================================================== */

    function fillKlantSelect(selected) {
        const actief = klanten.filter((k) => !k.archived || k.id === selected);
        el.jfKlant.innerHTML =
            '<option value="">— Geen klant —</option>' +
            actief.map((k) => {
                const label = k.bedrijf ? `${k.naam} (${k.bedrijf})` : k.naam;
                return `<option value="${k.id}">${esc(label)}</option>`;
            }).join('');
        el.jfKlant.value = selected || '';
    }

    function syncPrijsmodel() {
        const vast = el.jfPrijsmodel.value === 'vast';
        el.jfUurtariefWrap.classList.toggle('hidden', vast);
        el.jfVastWrap.classList.toggle('hidden', !vast);
    }

    el.jfPrijsmodel.addEventListener('change', syncPrijsmodel);

    // Verwachting voor precies de uren die deze klus beslaat. Verschuift
    // Thijmen de tijden, dan verschuift het weerbeeld mee.
    function syncWeer() {
        if (!window.Weer) return;

        const { datum, start, eind } = el.jfDatum.value
            ? { datum: el.jfDatum.value, start: el.jfStart.value, eind: el.jfEind.value }
            : {};

        if (!datum || !start || !eind) {
            el.jdWeer.classList.add('hidden');
            return;
        }

        const van = new Date(`${datum}T${start}`);
        const tot = new Date(`${datum}T${eind}`);
        if (!(tot > van)) { el.jdWeer.classList.add('hidden'); return; }

        el.jdWeer.classList.remove('hidden');
        el.jdWeerBody.innerHTML = window.Weer.ladeHTML(van, tot, el.jfSoort.value);
    }

    [el.jfDatum, el.jfStart, el.jfEind, el.jfSoort].forEach((input) => {
        input.addEventListener('change', syncWeer);
    });

    // Adres en tarief van de klant overnemen zolang de velden nog leeg zijn —
    // typt Thijmen zelf iets, dan blijft dat staan.
    el.jfKlant.addEventListener('change', () => {
        const klant = klanten.find((k) => k.id === el.jfKlant.value);
        const tarief = klant?.uurtarief ?? adminSettings.standaard_uurtarief;

        el.jfTariefHint.textContent = klant?.uurtarief
            ? `afwijkend tarief van ${klant.naam}`
            : 'standaardtarief';

        if (!el.jfUurtarief.value && tarief) el.jfUurtarief.value = tarief;
        if (!el.jfAdres.value && klant) el.jfAdres.placeholder = klantAdres(klant) || 'leeg = adres van de klant';
    });

    function klantAdres(klant) {
        if (!klant) return '';
        const plaats = [klant.postcode, klant.plaats].filter(Boolean).join(' ');
        return [klant.adres, plaats].filter(Boolean).join(', ');
    }

    async function openKlusDrawer(id, prefill = {}) {
        editingKlusId = id || null;
        bewerktReeks = null;
        bewerktHeleReeks = false;
        el.jdError.classList.add('hidden');
        el.jdReeksBanner.classList.add('hidden');
        el.jdReeksBanner.classList.remove('is-bewerken');
        el.jdReeksBewerk.classList.remove('hidden');

        let klus = id ? weekKlussen.find((k) => k.id === id) : null;

        // Vanuit een agenda-afspraak kan de klus buiten de zichtbare week vallen.
        if (id && !klus) {
            const { data } = await supabase.from('klussen').select('*').eq('id', id).maybeSingle();
            klus = data;
            if (!klus) return toast('Deze klus bestaat niet meer.');
        }

        if (klus) {
            const s = new Date(klus.start_tijd);
            const e = new Date(klus.eind_tijd);
            el.jdHeading.textContent = klus.titel;
            el.jfTitel.value = klus.titel;
            el.jfSoort.value = klus.soort;
            el.jfDatum.value = ymd(s);
            el.jfStart.value = hm(s);
            el.jfEind.value = hm(e);
            el.jfAdres.value = klus.adres || '';
            el.jfOmschrijving.value = klus.omschrijving || '';
            el.jfStatus.value = klus.status;
            el.jfPrijsmodel.value = klus.prijsmodel;
            el.jfUurtarief.value = klus.uurtarief ?? '';
            el.jfVast.value = klus.vast_bedrag ?? '';
            el.jfWeer.checked = !!klus.weersgevoelig;
            el.jfGefactureerd.checked = !!klus.gefactureerd;
            el.jfHerhaling.value = '0';
            el.jfTot.value = '';
            fillKlantSelect(klus.klant_id);
            el.jdDelete.classList.remove('hidden');

            // Hoort deze klus bij een reeks? Dan het patroon erbij halen, zodat
            // "Hele reeks" meteen de juiste instellingen laat zien.
            if (klus.reeks_id) {
                const { data: reeks } = await supabase
                    .from('klus_reeksen').select('*').eq('id', klus.reeks_id).maybeSingle();
                if (reeks) {
                    bewerktReeks = reeks;
                    el.jfHerhaling.value = String(reeks.interval_weken);
                    el.jfTot.value = reeks.tot_datum || '';
                    el.jdReeksTekst.textContent = reeksOmschrijving(reeks) +
                        (klus.losgekoppeld ? ' · deze beurt is losgetrokken' : '');
                    el.jdReeksBanner.classList.remove('hidden');
                }
            }
        } else {
            const datum = prefill.datum || ymd(new Date());
            const start = prefill.start || '09:00';
            const [h, m] = start.split(':').map(Number);

            el.jdHeading.textContent = 'Nieuwe klus';
            el.jfTitel.value = '';
            el.jfSoort.value = 'onderhoud';
            el.jfDatum.value = datum;
            el.jfStart.value = start;
            el.jfEind.value = `${pad2(Math.min(23, h + 2))}:${pad2(m)}`;
            el.jfAdres.value = '';
            el.jfOmschrijving.value = '';
            el.jfStatus.value = 'gepland';
            el.jfPrijsmodel.value = 'uurtarief';
            el.jfUurtarief.value = '';
            el.jfVast.value = '';
            el.jfWeer.checked = false;
            el.jfGefactureerd.checked = false;
            el.jfHerhaling.value = '0';
            el.jfTot.value = '';
            fillKlantSelect(prefill.klantId || '');
            el.jdDelete.classList.add('hidden');
        }

        el.jfKlant.dispatchEvent(new Event('change'));
        syncPrijsmodel();
        syncHerhaling();

        await loadKlusMaterialen(editingKlusId);
        renderKlusMaterialen();
        // Stil voorladen; fouten pas tonen als de kiezer opengaat. Wel opnieuw
        // tekenen als de uitslag binnen is, anders staat er "nog niets gekozen"
        // terwijl de lijst in werkelijkheid niet geladen kón worden.
        loadCatalogus(true).then(() => renderKlusMaterialen());

        // Weer kan nog onderweg zijn als de lade meteen na inloggen opengaat.
        syncWeer();
        if (window.Weer && !window.Weer.beschikbaar()) {
            window.Weer.laden().then(() => syncWeer());
        }

        el.jdSnelstart.href = adminSettings.snelstart_url || 'https://web.snelstart.nl/';

        el.klusDrawer.classList.add('open');
        el.klusDrawer.setAttribute('aria-hidden', 'false');
        el.klusOverlay.classList.add('open');
        setTimeout(() => el.jfTitel.focus(), 60);
    }

    function closeKlusDrawer() {
        editingKlusId = null;
        bewerktReeks = null;
        bewerktHeleReeks = false;
        el.klusDrawer.classList.remove('open');
        el.klusDrawer.setAttribute('aria-hidden', 'true');
        el.klusOverlay.classList.remove('open');
    }

    el.jdClose.addEventListener('click', closeKlusDrawer);
    el.klusOverlay.addEventListener('click', closeKlusDrawer);
    el.newKlusBtn.addEventListener('click', () => openKlusDrawer(null));

    function klusError(msg) {
        el.jdError.textContent = msg;
        el.jdError.classList.remove('hidden');
    }

    el.jdSave.addEventListener('click', async () => {
        const titel = el.jfTitel.value.trim();
        if (!titel) return klusError('Geef de klus een titel.');
        if (!el.jfDatum.value || !el.jfStart.value || !el.jfEind.value) {
            return klusError('Vul datum, begintijd en eindtijd in.');
        }

        const start = new Date(`${el.jfDatum.value}T${el.jfStart.value}`);
        const eind = new Date(`${el.jfDatum.value}T${el.jfEind.value}`);
        if (!(eind > start)) return klusError('De eindtijd moet ná de begintijd liggen.');

        const vast = el.jfPrijsmodel.value === 'vast';
        const num = (v) => (v === '' || v == null ? null : Number(v));

        const payload = {
            titel,
            klant_id: el.jfKlant.value || null,
            soort: el.jfSoort.value,
            start_tijd: start.toISOString(),
            eind_tijd: eind.toISOString(),
            adres: el.jfAdres.value.trim() || null,
            omschrijving: el.jfOmschrijving.value.trim() || null,
            status: el.jfStatus.value,
            prijsmodel: el.jfPrijsmodel.value,
            uurtarief: vast ? null : num(el.jfUurtarief.value),
            vast_bedrag: vast ? num(el.jfVast.value) : null,
            weersgevoelig: el.jfWeer.checked,
            gefactureerd: el.jfGefactureerd.checked,
        };

        el.jdError.classList.add('hidden');
        el.jdSave.disabled = true;
        el.jdSave.textContent = 'Opslaan…';

        let melding = 'Klus opgeslagen. Apple Agenda werkt zichzelf zo bij.';

        try {
            const interval = Number(el.jfHerhaling.value);
            const reeksVeld = {
                klant_id: payload.klant_id,
                titel: payload.titel,
                soort: payload.soort,
                start_datum: el.jfDatum.value,
                tot_datum: el.jfTot.value || null,
                interval_weken: interval,
                start_tijd: el.jfStart.value,
                eind_tijd: el.jfEind.value,
                adres: payload.adres,
                omschrijving: payload.omschrijving,
                prijsmodel: payload.prijsmodel,
                uurtarief: payload.uurtarief,
                vast_bedrag: payload.vast_bedrag,
                weersgevoelig: payload.weersgevoelig,
                actief: true,
            };

            if (interval > 0 && (!bewerktReeks || bewerktHeleReeks)) {
                // Nieuwe reeks, of de hele reeks bijwerken.
                const { data: reeks, error: reeksFout } = bewerktReeks
                    ? await supabase.from('klus_reeksen').update(reeksVeld)
                        .eq('id', bewerktReeks.id).select('*').maybeSingle()
                    : await supabase.from('klus_reeksen').insert(reeksVeld)
                        .select('*').maybeSingle();

                if (reeksFout || !reeks) throw new Error(reeksFout?.message || 'reeks niet opgeslagen');

                // Bij een nieuwe reeks vervangen de gegenereerde beurten deze
                // ene klus; anders zou de eerste beurt dubbel staan.
                if (!bewerktReeks && editingKlusId) {
                    await supabase.from('klussen').delete().eq('id', editingKlusId);
                }

                const aantal = await genereerReeks(reeks);
                melding = `Reeks opgeslagen — ${aantal} ${aantal === 1 ? 'beurt' : 'beurten'} ingepland.`;
            } else {
                // Eén losse klus. Zat hij in een reeks, dan trekken we hem los,
                // zodat een latere reeksupdate deze aanpassing niet overschrijft.
                if (bewerktReeks) payload.losgekoppeld = true;

                const { data: bewaard, error } = editingKlusId
                    ? await supabase.from('klussen').update(payload).eq('id', editingKlusId)
                        .select('id').maybeSingle()
                    : await supabase.from('klussen').insert(payload).select('id').maybeSingle();

                if (error) throw new Error(error.message);

                await bewaarKlusMaterialen(editingKlusId || bewaard?.id);
                if (bewerktReeks) melding = 'Deze beurt is aangepast en losgetrokken van de reeks.';
            }
        } catch (err) {
            el.jdSave.disabled = false;
            el.jdSave.textContent = 'Opslaan';
            return klusError('Opslaan mislukt: ' + err.message);
        }

        el.jdSave.disabled = false;
        el.jdSave.textContent = 'Opslaan';

        // Buiten de zichtbare week opgeslagen? Spring mee, anders lijkt hij weg.
        if (start < weekStart || start >= addDays(weekStart, 7)) {
            weekStart = startOfWeek(start);
        }

        closeKlusDrawer();
        await loadPlanning(true);
        if (editingKlantId) refreshKlantKlussen(editingKlantId);
        toast(melding);
    });

    el.jdDelete.addEventListener('click', async () => {
        if (!editingKlusId) return;
        if (!confirm('Deze klus verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;

        const { error } = await supabase.from('klussen').delete().eq('id', editingKlusId);
        if (error) return klusError('Verwijderen mislukt: ' + error.message);

        const removed = editingKlusId;
        closeKlusDrawer();
        await loadPlanning(true);
        if (editingKlantId) refreshKlantKlussen(editingKlantId);
        toast('Klus verwijderd.');
        return removed;
    });

    // Waar moet de app op openen? Een afspraak in Apple Agenda linkt naar
    // /admin?klus=<id>, en de snelkoppelingen op het beginscherm gebruiken
    // ?tab= en ?nieuw=klus.
    async function volgStartLink() {
        const p = new URLSearchParams(location.search);
        const klus = p.get('klus');
        const tab = p.get('tab');
        const nieuw = p.get('nieuw');

        if (!klus && !tab && !nieuw) return;
        history.replaceState(null, '', location.pathname);

        if (tab) switchView(tab);
        if (klus) return openKlusDrawer(klus);
        if (nieuw === 'klus') return openKlusDrawer(null);
    }

    /* ==========================================================================
       SPULLEN & MATERIALEN
       Eén catalogus met twee soorten: gereedschap gaat mee en komt mee terug,
       verbruik gaat op bij de klant. Beide belanden als afvinklijst in de
       omschrijving van de agenda-afspraak.
       ========================================================================== */

    let catalogus = [];
    let matRegels = [];          // wat er bij de open klus hoort
    let matCategorie = 'alle';
    let matZoek = '';

    let catalogusFout = null;

    /**
     * @param {boolean} stil  true bij het voorladen op de achtergrond: dan mag
     *                        een fout niet in beeld komen. De gebruiker heeft
     *                        er niet om gevraagd en kan er niets mee.
     */
    async function loadCatalogus(stil = false) {
        if (catalogus.length) return catalogus;

        const { data, error } = await supabase
            .from('materiaal_catalogus')
            .select('*')
            .eq('actief', true)
            .order('sort_order', { ascending: true });

        if (error) {
            // Verreweg de meest waarschijnlijke oorzaak: het uitgebreide schema
            // is nog niet in Supabase gedraaid. Zeg dat, in plaats van een
            // Postgres-melding die niemand verder helpt.
            catalogusFout = /does not exist|schema cache|relation/i.test(error.message || '')
                ? 'ontbreekt'
                : error.message;
            return [];
        }

        catalogusFout = null;
        catalogus = data || [];
        return catalogus;
    }

    // Regels van deze klus ophalen. Nieuwe klus = lege lijst.
    async function loadKlusMaterialen(klusId) {
        matRegels = [];
        if (!klusId) return;

        const { data } = await supabase
            .from('materialen')
            .select('*')
            .eq('klus_id', klusId)
            .order('sort_order', { ascending: true });

        matRegels = (data || []).map((r) => ({
            id: r.id,
            catalogus_id: r.catalogus_id,
            naam: r.omschrijving,
            soort: r.soort || 'verbruik',
            eenheid: r.eenheid || 'stuk',
            aantal: Number(r.aantal) || 1,
            afgevinkt: !!r.afgevinkt,
        }));
    }

    // Hele hoeveelheden voor stuks, halven voor kuubs en meters.
    const matStap = (eenheid) => (['m2', 'm3', 'kg', 'liter', 'm'].includes(eenheid) ? 0.5 : 1);
    const matGetal = (n) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

    function renderKlusMaterialen() {
        const gereedschap = matRegels.filter((r) => r.soort === 'gereedschap');
        const verbruik = matRegels.filter((r) => r.soort !== 'gereedschap');

        if (!matRegels.length) {
            el.jdMatLijst.innerHTML = catalogusFout === 'ontbreekt'
                ? '<p class="mat-leeg">Materiaallijst nog niet aangemaakt — draai ' +
                  '<code>supabase/schema.sql</code> opnieuw in Supabase.</p>'
                : '<p class="mat-leeg">Nog niets gekozen. Voeg toe wat mee moet en wat er verbruikt wordt.</p>';
            el.jdMatVoortgang.textContent = '';
            return;
        }

        const groep = (titel, regels) => regels.length ? `
            <div class="mat-groep">
                <div class="mat-groep-kop">${titel}</div>
                ${regels.map((r) => `
                    <div class="mat-regel${r.afgevinkt ? ' is-af' : ''}" data-mat="${r.catalogus_id || r.naam}">
                        <button type="button" class="mat-vink" data-actie="vink"
                                aria-label="Afvinken">${r.afgevinkt ? '☑' : '☐'}</button>
                        <span class="mat-naam">${esc(r.naam)}</span>
                        <span class="mat-stepper">
                            <button type="button" data-actie="min" aria-label="Minder">−</button>
                            <span class="mat-aantal">${matGetal(r.aantal)}</span>
                            <button type="button" data-actie="plus" aria-label="Meer">+</button>
                        </span>
                        <span class="mat-eenheid">${esc(r.eenheid)}</span>
                        <button type="button" class="mat-weg" data-actie="weg" aria-label="Verwijderen">×</button>
                    </div>`).join('')}
            </div>` : '';

        el.jdMatLijst.innerHTML =
            groep('Meenemen', gereedschap) + groep('Verbruik', verbruik);

        const af = matRegels.filter((r) => r.afgevinkt).length;
        el.jdMatVoortgang.textContent = af
            ? `${af} van ${matRegels.length} ingeladen`
            : `${matRegels.length} ${matRegels.length === 1 ? 'regel' : 'regels'}`;
    }

    const matSleutel = (r) => r.catalogus_id || r.naam;

    el.jdMatLijst.addEventListener('click', (e) => {
        const knop = e.target.closest('[data-actie]');
        if (!knop) return;
        const regel = matRegels.find((r) => matSleutel(r) === knop.closest('.mat-regel').dataset.mat);
        if (!regel) return;

        const actie = knop.dataset.actie;
        if (actie === 'plus') regel.aantal = Math.round((regel.aantal + matStap(regel.eenheid)) * 10) / 10;
        if (actie === 'min') regel.aantal = Math.max(matStap(regel.eenheid),
            Math.round((regel.aantal - matStap(regel.eenheid)) * 10) / 10);
        if (actie === 'vink') regel.afgevinkt = !regel.afgevinkt;
        if (actie === 'weg') matRegels = matRegels.filter((r) => r !== regel);

        renderKlusMaterialen();
    });

    /* ---------- kiezer ---------- */

    async function openMatModal() {
        await loadCatalogus();
        matCategorie = 'alle';
        matZoek = '';
        el.matZoek.value = '';
        renderMatCategorieen();
        renderMatKeuze();

        el.matModal.hidden = false;
        el.matOverlay.hidden = false;
        requestAnimationFrame(() => {
            el.matModal.classList.add('open');
            el.matOverlay.classList.add('open');
            el.matModal.setAttribute('aria-hidden', 'false');
        });
    }

    function closeMatModal() {
        el.matModal.classList.remove('open');
        el.matOverlay.classList.remove('open');
        el.matModal.setAttribute('aria-hidden', 'true');
        setTimeout(() => { el.matModal.hidden = true; el.matOverlay.hidden = true; }, 200);
    }

    function renderMatCategorieen() {
        const cats = [...new Set(catalogus.map((c) => c.categorie))];
        el.matCategorieen.innerHTML =
            `<button type="button" class="filter${matCategorie === 'alle' ? ' active' : ''}"
                     data-cat="alle">Alle</button>` +
            cats.map((c) => `<button type="button" class="filter${matCategorie === c ? ' active' : ''}"
                     data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    }

    function renderMatKeuze() {
        if (catalogusFout) {
            el.matKeuzeLijst.innerHTML = catalogusFout === 'ontbreekt'
                ? '<div class="mat-melding"><strong>Materiaallijst nog niet aangemaakt</strong>' +
                  '<span>Draai <code>supabase/schema.sql</code> opnieuw in de Supabase SQL Editor. ' +
                  'Daarna staat de hele lijst er — bestaande gegevens blijven staan.</span></div>'
                : '<div class="mat-melding"><strong>Kon de lijst niet laden</strong>' +
                  '<span>' + esc(catalogusFout) + '</span></div>';
            el.matCategorieen.innerHTML = '';
            return;
        }

        const q = matZoek.trim().toLowerCase();
        const lijst = catalogus.filter((c) =>
            (matCategorie === 'alle' || c.categorie === matCategorie) &&
            (!q || c.naam.toLowerCase().includes(q)));

        if (!lijst.length) {
            el.matKeuzeLijst.innerHTML =
                '<p class="mat-leeg">Niets gevonden. Voeg het onderaan toe als eigen materiaal.</p>';
            return;
        }

        el.matKeuzeLijst.innerHTML = lijst.map((c) => {
            const gekozen = matRegels.find((r) => r.catalogus_id === c.id);
            return `
                <div class="mat-keuze${gekozen ? ' is-gekozen' : ''}" data-cat-id="${c.id}">
                    <span class="mat-keuze-naam">
                        ${esc(c.naam)}
                        <small>${esc(c.categorie)} · ${esc(c.eenheid)}${
                            c.soort === 'gereedschap' ? ' · meenemen' : ''}</small>
                    </span>
                    <span class="mat-stepper">
                        <button type="button" data-actie="min" aria-label="Minder"
                                ${gekozen ? '' : 'disabled'}>−</button>
                        <span class="mat-aantal">${gekozen ? matGetal(gekozen.aantal) : '0'}</span>
                        <button type="button" data-actie="plus" aria-label="Meer">+</button>
                    </span>
                </div>`;
        }).join('');
    }

    el.matKeuzeLijst.addEventListener('click', (e) => {
        const knop = e.target.closest('[data-actie]');
        const rij = e.target.closest('.mat-keuze');
        if (!rij) return;

        const item = catalogus.find((c) => c.id === rij.dataset.catId);
        if (!item) return;

        const bestaat = matRegels.find((r) => r.catalogus_id === item.id);
        // Op de rij tikken telt als toevoegen; dat scheelt mikken op een
        // klein plusje met werkhandschoenen aan.
        const actie = knop?.dataset.actie || 'plus';

        if (actie === 'plus') {
            if (bestaat) bestaat.aantal = Math.round((bestaat.aantal + matStap(item.eenheid)) * 10) / 10;
            else matRegels.push({
                catalogus_id: item.id, naam: item.naam, soort: item.soort,
                eenheid: item.eenheid, aantal: matStap(item.eenheid) === 0.5 ? 1 : 1,
                afgevinkt: false,
            });
        } else if (actie === 'min' && bestaat) {
            const nieuw = Math.round((bestaat.aantal - matStap(item.eenheid)) * 10) / 10;
            if (nieuw <= 0) matRegels = matRegels.filter((r) => r !== bestaat);
            else bestaat.aantal = nieuw;
        }

        renderMatKeuze();
        renderKlusMaterialen();
    });

    el.matCategorieen.addEventListener('click', (e) => {
        const knop = e.target.closest('.filter');
        if (!knop) return;
        matCategorie = knop.dataset.cat;
        renderMatCategorieen();
        renderMatKeuze();
    });

    el.matZoek.addEventListener('input', (e) => { matZoek = e.target.value; renderMatKeuze(); });
    el.jdMatToevoegen.addEventListener('click', openMatModal);
    el.matSluit.addEventListener('click', closeMatModal);
    el.matKlaar.addEventListener('click', closeMatModal);
    el.matOverlay.addEventListener('click', closeMatModal);

    el.matEigen.addEventListener('click', async () => {
        const naam = prompt('Naam van het materiaal of gereedschap:');
        if (!naam || !naam.trim()) return;

        const meenemen = confirm('Is dit gereedschap dat meegaat en weer meekomt?\n\n' +
                                 'OK = gereedschap · Annuleren = verbruik');
        const eenheid = (prompt('Eenheid (stuk, m2, m3, zak, kg, liter, rol, m):', 'stuk') || 'stuk').trim();

        const { data, error } = await supabase.from('materiaal_catalogus').insert({
            naam: naam.trim(),
            categorie: 'Eigen',
            soort: meenemen ? 'gereedschap' : 'verbruik',
            eenheid,
            sort_order: 900,
            eigen: true,
        }).select('*').maybeSingle();

        if (error) return toast(/duplicate|unique/i.test(error.message)
            ? 'Die naam staat al in de lijst.' : 'Toevoegen mislukt.');

        catalogus.push(data);
        catalogus.sort((a, b) => a.sort_order - b.sort_order);
        matRegels.push({
            catalogus_id: data.id, naam: data.naam, soort: data.soort,
            eenheid: data.eenheid, aantal: 1, afgevinkt: false,
        });

        matCategorie = 'Eigen';
        renderMatCategorieen();
        renderMatKeuze();
        renderKlusMaterialen();
        toast('Toegevoegd aan de lijst.');
    });

    // Materialen horen bij een klus die al bestaat, dus wegschrijven kan pas
    // als het id bekend is. Alles vervangen is simpeler en veiliger dan
    // per regel bijhouden wat er is veranderd.
    async function bewaarKlusMaterialen(klusId) {
        if (!klusId) return;

        const { error: wis } = await supabase.from('materialen').delete().eq('klus_id', klusId);
        if (wis) throw new Error(wis.message);
        if (!matRegels.length) return;

        const rijen = matRegels.map((r, i) => ({
            klus_id: klusId,
            catalogus_id: r.catalogus_id || null,
            omschrijving: r.naam,
            soort: r.soort,
            eenheid: r.eenheid,
            aantal: r.aantal,
            afgevinkt: r.afgevinkt,
            sort_order: i,
            bedrag: 0,
        }));

        const { error } = await supabase.from('materialen').insert(rijen);
        if (error) throw new Error(error.message);
    }

    /* ==========================================================================
       TERUGKERENDE KLUSSEN
       Een reeks legt het patroon vast; de losse klussen worden er echt uit
       weggeschreven. Zo hoeven de agenda-feed, de weerwaarschuwingen en straks
       de facturatie niets van herhaling te weten.
       ========================================================================== */

    // Doorlopende reeksen moeten ergens ophouden. Een jaar vooruit is genoeg
    // om een heel seizoen te plannen zonder de agenda vol te gooien.
    const REEKS_HORIZON_MAANDEN = 12;

    const HERHALING_TEKST = {
        1: 'elke week', 2: 'elke 2 weken', 3: 'elke 3 weken', 4: 'elke 4 weken',
        6: 'elke 6 weken', 8: 'elke 8 weken', 12: 'elk kwartaal',
        26: 'elk half jaar', 52: 'elk jaar',
    };

    // Alle datums van een reeks, vanaf de startdatum met vaste tussenpozen.
    // De weekdag volgt vanzelf uit de startdatum.
    function reeksDatums(reeks) {
        const eerste = new Date(`${reeks.start_datum}T00:00`);
        const horizon = new Date();
        horizon.setMonth(horizon.getMonth() + REEKS_HORIZON_MAANDEN);

        const eind = reeks.tot_datum
            ? new Date(Math.min(new Date(`${reeks.tot_datum}T23:59`), horizon))
            : horizon;

        const uit = [];
        const loop = new Date(eerste);
        // Bovengrens tegen een tikfout in het interval; 400 beurten is meer
        // dan een jaar wekelijks.
        while (loop <= eind && uit.length < 400) {
            uit.push(ymd(loop));
            loop.setDate(loop.getDate() + 7 * reeks.interval_weken);
        }
        return uit;
    }

    function klusUitReeks(reeks, datum) {
        return {
            reeks_id: reeks.id,
            klant_id: reeks.klant_id,
            titel: reeks.titel,
            soort: reeks.soort,
            start_tijd: new Date(`${datum}T${reeks.start_tijd}`).toISOString(),
            eind_tijd: new Date(`${datum}T${reeks.eind_tijd}`).toISOString(),
            adres: reeks.adres,
            omschrijving: reeks.omschrijving,
            status: 'gepland',
            prijsmodel: reeks.prijsmodel,
            uurtarief: reeks.uurtarief,
            vast_bedrag: reeks.vast_bedrag,
            weersgevoelig: reeks.weersgevoelig,
            gefactureerd: false,
        };
    }

    /**
     * Schrijft de beurten van een reeks weg.
     *
     * Raakt uitsluitend toekomstige klussen die nog op 'gepland' staan en niet
     * los zijn getrokken. Wat al bezig, afgerond, geannuleerd of gefactureerd
     * is blijft staan — dat is geschiedenis, daar komen we niet aan.
     */
    async function genereerReeks(reeks) {
        const vanaf = new Date();
        vanaf.setHours(0, 0, 0, 0);

        const { error: wisFout } = await supabase
            .from('klussen')
            .delete()
            .eq('reeks_id', reeks.id)
            .eq('status', 'gepland')
            .eq('losgekoppeld', false)
            .eq('gefactureerd', false)
            .gte('start_tijd', vanaf.toISOString());

        if (wisFout) throw new Error(wisFout.message);

        // Wat er na het opschonen nog staat, niet dubbel aanmaken.
        const { data: blijft } = await supabase
            .from('klussen').select('start_tijd').eq('reeks_id', reeks.id);

        const bezet = new Set((blijft || []).map((k) => ymd(new Date(k.start_tijd))));

        const nieuw = reeksDatums(reeks)
            .filter((d) => new Date(`${d}T23:59`) >= vanaf && !bezet.has(d))
            .map((d) => klusUitReeks(reeks, d));

        if (!nieuw.length) return 0;

        const { data: gemaakt, error } = await supabase
            .from('klussen').insert(nieuw).select('id');
        if (error) throw new Error(error.message);

        // Elke beurt krijgt dezelfde spullenlijst mee: bij onderhoud neem je
        // elke keer hetzelfde gereedschap mee.
        for (const k of gemaakt || []) await bewaarKlusMaterialen(k.id);

        return nieuw.length;
    }

    function reeksOmschrijving(reeks) {
        const hoe = HERHALING_TEKST[reeks.interval_weken] || `elke ${reeks.interval_weken} weken`;
        const dag = new Date(`${reeks.start_datum}T00:00`)
            .toLocaleDateString('nl-NL', { weekday: 'long' });
        const tot = reeks.tot_datum
            ? ' t/m ' + new Date(`${reeks.tot_datum}T00:00`)
                .toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
            : ' — doorlopend';
        return `${hoe} op ${dag}${tot}`;
    }

    /* ---------- knoppen in de lade ---------- */

    function syncHerhaling() {
        const herhaalt = el.jfHerhaling.value !== '0';
        el.jfTotWrap.classList.toggle('hidden', !herhaalt);
        el.jfReeksUitleg.classList.toggle('hidden', !herhaalt);

        if (!herhaalt || !el.jfDatum.value) return;

        const proef = {
            start_datum: el.jfDatum.value,
            tot_datum: el.jfTot.value || null,
            interval_weken: Number(el.jfHerhaling.value),
        };
        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0);

        const datums = reeksDatums(proef);
        // Beurten in het verleden worden niet aangemaakt; noem dus het aantal
        // dat er straks écht komt te staan, niet het aantal in het patroon.
        const komend = datums.filter((d) => new Date(`${d}T23:59`) >= vandaag);
        const laatste = komend[komend.length - 1];
        const voorbij = datums.length - komend.length;

        el.jfReeksUitleg.textContent = komend.length
            ? `${komend.length} ${komend.length === 1 ? 'beurt' : 'beurten'} — ` +
              `${reeksOmschrijving(proef)}. Ingepland t/m ` +
              new Date(`${laatste}T00:00`).toLocaleDateString('nl-NL',
                  { day: 'numeric', month: 'long', year: 'numeric' }) + '.' +
              (voorbij ? ` (${voorbij} in het verleden worden overgeslagen.)` : '')
            : 'Deze reeks levert geen komende beurten op — controleer de datums.';
    }

    [el.jfHerhaling, el.jfTot, el.jfDatum].forEach((v) =>
        v.addEventListener('change', syncHerhaling));

    // "Hele reeks": de instellingen van de reeks overnemen in het formulier,
    // zodat opslaan de hele reeks bijwerkt in plaats van deze ene beurt.
    el.jdReeksBewerk.addEventListener('click', () => {
        if (!bewerktReeks) return;
        bewerktHeleReeks = true;
        el.jdReeksBanner.classList.add('is-bewerken');
        el.jdReeksTekst.textContent =
            'U bewerkt nu de hele reeks. Opslaan vervangt alle toekomstige beurten ' +
            'die nog op "gepland" staan.';
        el.jdReeksBewerk.classList.add('hidden');
        toast('U bewerkt nu de hele reeks.');
    });

    el.jdReeksStop.addEventListener('click', async () => {
        if (!bewerktReeks) return;
        if (!confirm('Deze reeks stoppen? Toekomstige beurten die nog op "gepland" ' +
                     'staan worden verwijderd. Wat al is gedaan blijft staan.')) return;

        const vanaf = new Date();
        vanaf.setHours(0, 0, 0, 0);

        const { error: wis } = await supabase.from('klussen').delete()
            .eq('reeks_id', bewerktReeks.id).eq('status', 'gepland')
            .eq('losgekoppeld', false).eq('gefactureerd', false)
            .gte('start_tijd', vanaf.toISOString());

        if (wis) return klusError('Stoppen mislukt: ' + wis.message);

        await supabase.from('klus_reeksen').update({ actief: false }).eq('id', bewerktReeks.id);

        closeKlusDrawer();
        await loadPlanning(true);
        toast('Reeks gestopt.');
    });

    /* ==========================================================================
       AGENDA-FEED (Apple Agenda)
       ========================================================================== */

    async function openAgendaModal() {
        const { data, error } = await supabase
            .from('agenda_feed').select('token').eq('id', true).maybeSingle();

        if (error || !data?.token) {
            toast('Kon de agendalink niet ophalen. Draai het schema opnieuw in Supabase.');
            return;
        }

        setAgendaUrl(data.token);
        el.agendaModal.hidden = false;
        el.agendaOverlay.hidden = false;
        requestAnimationFrame(() => {
            el.agendaModal.classList.add('open');
            el.agendaOverlay.classList.add('open');
            el.agendaModal.setAttribute('aria-hidden', 'false');
        });
    }

    function setAgendaUrl(token) {
        const url = `${location.origin}/api/agenda/${token}.ics`;
        el.agendaUrl.value = url;
        el.agendaOpen.href = url.replace(/^https?:/, 'webcal:');
    }

    function closeAgendaModal() {
        el.agendaModal.classList.remove('open');
        el.agendaOverlay.classList.remove('open');
        el.agendaModal.setAttribute('aria-hidden', 'true');
        setTimeout(() => { el.agendaModal.hidden = true; el.agendaOverlay.hidden = true; }, 200);
    }

    el.agendaBtn.addEventListener('click', openAgendaModal);
    el.agendaClose.addEventListener('click', closeAgendaModal);
    el.agendaOverlay.addEventListener('click', closeAgendaModal);

    el.agendaCopy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(el.agendaUrl.value);
        } catch {
            el.agendaUrl.select();          // clipboard geweigerd (of http) — dan maar handmatig
            document.execCommand('copy');
        }
        toast('Link gekopieerd.');
    });

    el.agendaRotate.addEventListener('click', async () => {
        if (!confirm('Nieuwe agendalink maken? De oude stopt direct met werken en u moet het abonnement op uw telefoon opnieuw toevoegen.')) return;

        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

        const { error } = await supabase.from('agenda_feed').update({ token }).eq('id', true);
        if (error) return toast('Nieuwe link maken mislukt.');

        setAgendaUrl(token);
        toast('Nieuwe agendalink gemaakt.');
    });

    /* ==========================================================================
       KLANTEN
       ========================================================================== */

    async function loadKlanten(silent = false) {
        if (!silent) {
            el.klantenState.classList.remove('hidden');
            el.klantenList.classList.add('hidden');
            el.klantenState.innerHTML = '<div class="spinner"></div>Klanten laden…';
        }

        const { data, error } = await supabase
            .from('klanten').select('*').order('naam', { ascending: true });

        if (error) {
            // Namen en adressen van de laatste keer, zodat de klusblokken
            // offline niet ineens naamloos zijn.
            const bewaard = leesLokaal('klanten');
            if (bewaard) {
                klanten = bewaard.waarde;
                klantenLoaded = true;
                if (!silent) renderKlanten();
                return;
            }
            if (!silent) {
                el.klantenState.innerHTML =
                    '<div class="proj-empty"><h3>Kon de klanten niet laden</h3><p>' +
                    esc(error.message) + '</p></div>';
            }
            return;
        }

        klanten = data || [];
        klantenLoaded = true;
        bewaarLokaal('klanten', klanten);
        await loadKlusCounts();
        if (!silent) renderKlanten();
    }

    // Alleen de klant_id-kolom ophalen; genoeg om per klant te tellen zonder
    // de hele klussentabel binnen te trekken.
    async function loadKlusCounts() {
        const { data } = await supabase.from('klussen').select('klant_id');
        klusCounts = {};
        (data || []).forEach((k) => {
            if (k.klant_id) klusCounts[k.klant_id] = (klusCounts[k.klant_id] || 0) + 1;
        });
    }

    function visibleKlanten() {
        const q = klantQuery.trim().toLowerCase();

        return klanten.filter((k) => {
            if (klantFilter === 'actief' && k.archived) return false;
            if (klantFilter === 'archief' && !k.archived) return false;
            if (!q) return true;
            return [k.naam, k.bedrijf, k.email, k.plaats, k.telefoon, k.adres]
                .filter(Boolean).join(' ').toLowerCase().includes(q);
        });
    }

    function renderKlanten() {
        el.klantenState.classList.add('hidden');
        el.klantenList.classList.remove('hidden');

        const list = visibleKlanten();

        if (!list.length) {
            el.klantenList.innerHTML = `
                <div class="proj-empty">
                    <h3>${klanten.length ? 'Geen klanten gevonden' : 'Nog geen klanten'}</h3>
                    <p>${klanten.length
                        ? 'Pas uw zoekopdracht of filter aan.'
                        : 'Voeg uw eerste klant toe, of maak er één van een binnengekomen aanvraag.'}</p>
                </div>`;
            return;
        }

        const pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
        const tel = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>';
        const mail = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m22 7-10 6L2 7"/></svg>';

        el.klantenList.innerHTML = list.map((k) => {
            const adres = klantAdres(k);
            const aantal = klusCounts[k.id] || 0;

            return `
                <button type="button" class="klant-card${k.archived ? ' is-archived' : ''}" data-klant="${k.id}">
                    <h3>${esc(k.naam)}</h3>
                    ${k.bedrijf ? `<div class="klant-bedrijf">${esc(k.bedrijf)}</div>` : ''}
                    <div class="klant-meta">
                        ${adres ? `<span>${pin}${esc(adres)}</span>` : ''}
                        ${k.telefoon ? `<span>${tel}${esc(k.telefoon)}</span>` : ''}
                        ${k.email ? `<span>${mail}${esc(k.email)}</span>` : ''}
                    </div>
                    <div class="klant-foot">
                        <span>${aantal ? `${aantal} ${aantal === 1 ? 'klus' : 'klussen'}` : 'Nog geen klussen'}</span>
                        ${k.uurtarief ? `<strong>€ ${Number(k.uurtarief).toFixed(2).replace('.', ',')}/uur</strong>` : ''}
                    </div>
                </button>`;
        }).join('');
    }

    el.klantenList.addEventListener('click', (e) => {
        const card = e.target.closest('.klant-card');
        if (card) openKlantDrawer(card.dataset.klant);
    });

    el.klantFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter');
        if (!btn) return;
        klantFilter = btn.dataset.kfilter;
        el.klantFilters.querySelectorAll('.filter')
            .forEach((b) => b.classList.toggle('active', b === btn));
        renderKlanten();
    });

    el.klantSearch.addEventListener('input', (e) => {
        klantQuery = e.target.value;
        renderKlanten();
    });

    el.newKlantBtn.addEventListener('click', () => openKlantDrawer(null));

    function openKlantDrawer(id, prefill = {}) {
        editingKlantId = id || null;
        el.kdError.classList.add('hidden');

        const k = id ? klanten.find((c) => c.id === id) : prefill;

        el.kdHeading.textContent = id ? (k.naam || 'Klant') : 'Nieuwe klant';
        el.kfNaam.value = k.naam || '';
        el.kfBedrijf.value = k.bedrijf || '';
        el.kfEmail.value = k.email || '';
        el.kfTelefoon.value = k.telefoon || '';
        el.kfAdres.value = k.adres || '';
        el.kfPostcode.value = k.postcode || '';
        el.kfPlaats.value = k.plaats || '';
        el.kfUurtarief.value = k.uurtarief ?? '';
        el.kfNotities.value = k.notities || '';
        el.kfArchived.checked = !!k.archived;

        el.kdDelete.classList.toggle('hidden', !id);
        el.kdKlussenWrap.classList.add('hidden');
        el.kdKlussen.innerHTML = '';
        if (id) refreshKlantKlussen(id);

        el.klantDrawer.classList.add('open');
        el.klantDrawer.setAttribute('aria-hidden', 'false');
        el.klantOverlay.classList.add('open');
        setTimeout(() => el.kfNaam.focus(), 60);
    }

    function closeKlantDrawer() {
        editingKlantId = null;
        el.klantDrawer.classList.remove('open');
        el.klantDrawer.setAttribute('aria-hidden', 'true');
        el.klantOverlay.classList.remove('open');
    }

    el.kdClose.addEventListener('click', closeKlantDrawer);
    el.klantOverlay.addEventListener('click', closeKlantDrawer);

    // Klussen van deze klant, nieuwste eerst — zodat je meteen ziet wanneer
    // je er voor het laatst bent geweest.
    async function refreshKlantKlussen(klantId) {
        const { data } = await supabase
            .from('klussen')
            .select('id, titel, start_tijd, status')
            .eq('klant_id', klantId)
            .order('start_tijd', { ascending: false })
            .limit(25);

        if (!data || !data.length) return;

        el.kdKlussenWrap.classList.remove('hidden');
        el.kdKlussen.innerHTML = data.map((k) => {
            const d = new Date(k.start_tijd);
            return `
                <button type="button" class="kk-item" data-klus="${k.id}">
                    <span class="kk-date">${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    <span class="kk-title">${esc(k.titel)}</span>
                    <span class="pill pill-${k.status}">${k.status}</span>
                </button>`;
        }).join('');
    }

    el.kdKlussen.addEventListener('click', (e) => {
        const item = e.target.closest('.kk-item');
        if (item) openKlusDrawer(item.dataset.klus);
    });

    function klantError(msg) {
        el.kdError.textContent = msg;
        el.kdError.classList.remove('hidden');
    }

    // Slaat op en geeft het id terug, zodat "Klus inplannen" er meteen op verder kan.
    async function saveKlant() {
        const naam = el.kfNaam.value.trim();
        if (!naam) { klantError('Vul in ieder geval een naam in.'); return null; }

        const payload = {
            naam,
            bedrijf: el.kfBedrijf.value.trim() || null,
            email: el.kfEmail.value.trim() || null,
            telefoon: el.kfTelefoon.value.trim() || null,
            adres: el.kfAdres.value.trim() || null,
            postcode: el.kfPostcode.value.trim() || null,
            plaats: el.kfPlaats.value.trim() || null,
            uurtarief: el.kfUurtarief.value === '' ? null : Number(el.kfUurtarief.value),
            notities: el.kfNotities.value.trim() || null,
            archived: el.kfArchived.checked,
        };

        el.kdError.classList.add('hidden');

        const q = editingKlantId
            ? supabase.from('klanten').update(payload).eq('id', editingKlantId).select('id').maybeSingle()
            : supabase.from('klanten').insert(payload).select('id').maybeSingle();

        const { data, error } = await q;
        if (error) { klantError('Opslaan mislukt: ' + error.message); return null; }

        await loadKlanten(true);
        renderKlanten();
        return editingKlantId || data?.id || null;
    }

    el.kdSave.addEventListener('click', async () => {
        el.kdSave.disabled = true;
        el.kdSave.textContent = 'Opslaan…';
        const id = await saveKlant();
        el.kdSave.disabled = false;
        el.kdSave.textContent = 'Opslaan';

        if (!id) return;
        closeKlantDrawer();
        toast('Klant opgeslagen.');
    });

    el.kdPlan.addEventListener('click', async () => {
        const id = await saveKlant();
        if (!id) return;
        closeKlantDrawer();
        switchView('planning');
        openKlusDrawer(null, { klantId: id });
    });

    el.kdDelete.addEventListener('click', async () => {
        if (!editingKlantId) return;
        const k = klanten.find((c) => c.id === editingKlantId);

        if (!confirm(`Klant "${k?.naam || ''}" verwijderen? De klussen blijven bestaan, maar raken hun klant kwijt. Archiveren is meestal beter.`)) return;

        const { error } = await supabase.from('klanten').delete().eq('id', editingKlantId);
        if (error) return klantError('Verwijderen mislukt: ' + error.message);

        closeKlantDrawer();
        await loadKlanten(true);
        renderKlanten();
        if (planningLoaded) loadPlanning(true);
        toast('Klant verwijderd.');
    });

    /* ---------- aanvraag → klant ---------- */
    el.dToKlant.addEventListener('click', () => {
        const r = rows.find((x) => x.id === activeRequestId);
        if (!r) return;

        const bestaand = klanten.find(
            (k) => (r.email && k.email && k.email.toLowerCase() === r.email.toLowerCase()) ||
                   (r.phone && k.telefoon && k.telefoon.replace(/\D/g, '') === r.phone.replace(/\D/g, '')),
        );

        if (bestaand) {
            closeRequestDrawer();
            switchView('klanten');
            openKlantDrawer(bestaand.id);
            toast('Deze klant bestond al — hier is de bestaande kaart.');
            return;
        }

        const notities = [
            `Via de website op ${fmtDate(r.created_at)}`,
            r.service ? `Interesse in: ${serviceLabel(r.service)}` : '',
            r.message ? `\n"${r.message}"` : '',
        ].filter(Boolean).join('\n');

        closeRequestDrawer();
        switchView('klanten');
        openKlantDrawer(null, {
            naam: r.name,
            email: r.email,
            telefoon: r.phone,
            notities,
        });
    });

    /* ---------- interne instellingen ---------- */
    async function loadAdminSettings() {
        const { data } = await supabase.from('admin_settings').select('key, value');
        adminSettings = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    }

    /* ---------- refresh buttons + auto-refresh on return ---------- */
    async function withSpin(btn, fn) {
        btn.classList.add('spinning');
        btn.disabled = true;
        try { await fn(); } finally {
            btn.classList.remove('spinning');
            btn.disabled = false;
        }
    }

    document.getElementById('refreshRequests')?.addEventListener('click', (e) => {
        withSpin(e.currentTarget, () => loadRequests());
    });

    document.getElementById('refreshProjects')?.addEventListener('click', (e) => {
        withSpin(e.currentTarget, () => loadProjects());
    });

    document.getElementById('refreshKlanten')?.addEventListener('click', (e) => {
        withSpin(e.currentTarget, () => loadKlanten());
    });

    // When Thijmen returns to the tab/app, silently pull fresh data
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        if (el.appView.classList.contains('hidden')) return; // not logged in
        loadRequests(true);
        if (planningLoaded) loadPlanning(true);
    });

    /* ---------- global keyboard ---------- */
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (el.drawer.classList.contains('open')) closeRequestDrawer();
        if (el.projDrawer.classList.contains('open')) closeProjectEditor();
        if (el.klantDrawer.classList.contains('open')) closeKlantDrawer();
        if (el.klusDrawer.classList.contains('open')) closeKlusDrawer();
        if (el.cropModal.classList.contains('open')) closeCropModal();
        if (el.agendaModal.classList.contains('open')) closeAgendaModal();
        if (el.matModal.classList.contains('open')) closeMatModal();
    });

    /* Enter in een tekstveld van de klus- of klantlade = opslaan, niet
       de pagina herladen. */
    document.getElementById('klusForm')?.addEventListener('submit', (e) => e.preventDefault());
    document.getElementById('klantForm')?.addEventListener('submit', (e) => e.preventDefault());

    [el.jfTitel, el.jfDatum, el.jfStart, el.jfEind, el.jfAdres].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.jdSave.click(); }
        });
    });

    [el.kfNaam, el.kfBedrijf, el.kfEmail, el.kfTelefoon,
     el.kfAdres, el.kfPostcode, el.kfPlaats].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); el.kdSave.click(); }
        });
    });

    boot();
})();
