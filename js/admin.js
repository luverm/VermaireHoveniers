/* ==========================================================================
   VERMAIRE HOVENIERS — ADMIN PORTAL LOGIC
   Auth + data via the Supabase JS client. RLS protects the table:
   only an authenticated admin can read/update contact_requests.
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

    const $ = (id) => document.getElementById(id);

    const el = {
        loginView: $('loginView'),
        appView: $('appView'),
        loginForm: $('loginForm'),
        loginBtn: $('loginBtn'),
        loginError: $('loginError'),
        email: $('email'),
        password: $('password'),
        userEmail: $('userEmail'),
        logoutBtn: $('logoutBtn'),
        filters: $('filters'),
        search: $('search'),
        tableState: $('tableState'),
        table: $('table'),
        tbody: $('tbody'),
        statNew: $('statNew'),
        statContacted: $('statContacted'),
        statDone: $('statDone'),
        statTotal: $('statTotal'),
        drawer: $('drawer'),
        drawerOverlay: $('drawerOverlay'),
        drawerClose: $('drawerClose'),
        dName: $('dName'),
        dPill: $('dPill'),
        dEmail: $('dEmail'),
        dPhone: $('dPhone'),
        dService: $('dService'),
        dDate: $('dDate'),
        dMessage: $('dMessage'),
        dMailto: $('dMailto'),
        dArchive: $('dArchive'),
        toast: $('toast'),
    };

    let supabase = null;
    let rows = [];
    let filter = 'all';
    let query = '';
    let activeId = null;

    /* ---------- helpers ---------- */

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

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const SERVICE_LABEL = {
        beplanting: 'Beplanting',
        groenadvies: 'Groenadvies',
        onderhoud: 'Onderhoud',
        anders: 'Iets anders',
    };
    const serviceLabel = (s) => (s ? SERVICE_LABEL[s] || s : '—');

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
        if (data.session) {
            enterApp(data.session.user);
        }
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
        await supabase.auth.signOut();
        location.reload();
    });

    function enterApp(user) {
        el.userEmail.textContent = user.email;
        el.loginView.classList.add('hidden');
        el.appView.classList.remove('hidden');
        loadRequests();
    }

    /* ---------- data ---------- */

    async function loadRequests() {
        el.tableState.classList.remove('hidden');
        el.table.classList.add('hidden');
        el.tableState.innerHTML = '<div class="spinner"></div>Aanvragen laden…';

        const { data, error } = await supabase
            .from('contact_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            el.tableState.innerHTML =
                '<div class="empty"><h3>Kon de aanvragen niet laden</h3><p>' +
                esc(error.message) + '</p></div>';
            return;
        }

        rows = data || [];
        updateStats();
        render();
    }

    function updateStats() {
        const c = { nieuw: 0, gecontacteerd: 0, afgerond: 0, gearchiveerd: 0 };
        rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
        el.statNew.textContent = c.nieuw;
        el.statContacted.textContent = c.gecontacteerd;
        el.statDone.textContent = c.afgerond;
        el.statTotal.textContent = rows.length;
    }

    function visibleRows() {
        return rows.filter((r) => {
            if (filter !== 'all' && r.status !== filter) return false;
            if (query) {
                const hay = (r.name + ' ' + r.email + ' ' + (r.message || '') + ' ' +
                    (r.phone || '')).toLowerCase();
                if (!hay.includes(query)) return false;
            }
            return true;
        });
    }

    function render() {
        const list = visibleRows();
        el.tableState.classList.add('hidden');
        el.table.classList.remove('hidden');

        if (!list.length) {
            el.table.classList.add('hidden');
            el.tableState.classList.remove('hidden');
            el.tableState.innerHTML =
                '<div class="empty">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
                '<path d="M22 6l-10 7L2 6"/></svg>' +
                '<h3>Geen aanvragen</h3><p>Er zijn geen berichten die aan dit filter voldoen.</p></div>';
            return;
        }

        el.tbody.innerHTML = list.map((r) => `
            <tr data-id="${r.id}">
                <td>
                    <div class="cell-name">${esc(r.name)}</div>
                    <div class="cell-sub">${esc(r.email)}</div>
                </td>
                <td class="col-hide-sm">${esc(serviceLabel(r.service))}</td>
                <td class="col-hide-sm"><span class="cell-date">${esc(fmtDate(r.created_at))}</span></td>
                <td>
                    <select class="status-select" data-id="${r.id}">
                        ${STATUSES.map((s) =>
                            `<option value="${s}" ${s === r.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
                        ).join('')}
                    </select>
                </td>
            </tr>
        `).join('');
    }

    /* ---------- interactions ---------- */

    el.filters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter');
        if (!btn) return;
        el.filters.querySelectorAll('.filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.filter;
        render();
    });

    el.search.addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        render();
    });

    el.tbody.addEventListener('click', (e) => {
        if (e.target.closest('.status-select')) return; // handled separately
        const tr = e.target.closest('tr');
        if (tr) openDrawer(tr.dataset.id);
    });

    el.tbody.addEventListener('change', async (e) => {
        const sel = e.target.closest('.status-select');
        if (!sel) return;
        await updateStatus(sel.dataset.id, sel.value);
    });

    async function updateStatus(id, status) {
        const { error } = await supabase
            .from('contact_requests')
            .update({ status })
            .eq('id', id);

        if (error) {
            toast('Bijwerken mislukt.');
            return;
        }
        const row = rows.find((r) => r.id === id);
        if (row) row.status = status;
        updateStats();
        if (activeId === id) paintDrawerPill(status);
        if (filter !== 'all') render();
        toast('Status bijgewerkt naar “' + STATUS_LABEL[status] + '”.');
    }

    /* ---------- drawer ---------- */

    function paintDrawerPill(status) {
        el.dPill.className = 'pill pill-' + status;
        el.dPill.textContent = STATUS_LABEL[status];
    }

    function openDrawer(id) {
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        activeId = id;

        el.dName.textContent = r.name;
        paintDrawerPill(r.status);
        el.dEmail.textContent = r.email;
        el.dEmail.href = 'mailto:' + r.email;
        el.dPhone.textContent = r.phone || '—';
        el.dPhone.href = r.phone ? 'tel:' + r.phone.replace(/\s/g, '') : '#';
        el.dService.textContent = serviceLabel(r.service);
        el.dDate.textContent = fmtDate(r.created_at);
        el.dMessage.textContent = r.message || 'Geen bericht meegegeven.';

        const subject = encodeURIComponent('Uw aanvraag bij Vermaire Hoveniers');
        const body = encodeURIComponent('Beste ' + r.name + ',\n\n');
        el.dMailto.href = `mailto:${r.email}?subject=${subject}&body=${body}`;

        el.drawer.classList.add('open');
        el.drawer.setAttribute('aria-hidden', 'false');
        el.drawerOverlay.classList.add('open');
    }

    function closeDrawer() {
        activeId = null;
        el.drawer.classList.remove('open');
        el.drawer.setAttribute('aria-hidden', 'true');
        el.drawerOverlay.classList.remove('open');
    }

    el.drawerClose.addEventListener('click', closeDrawer);
    el.drawerOverlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });

    el.dArchive.addEventListener('click', async () => {
        if (!activeId) return;
        await updateStatus(activeId, 'gearchiveerd');
        const sel = el.tbody.querySelector(`.status-select[data-id="${activeId}"]`);
        if (sel) sel.value = 'gearchiveerd';
        closeDrawer();
    });

    boot();
})();
