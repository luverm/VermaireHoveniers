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
        await supabase.auth.signOut();
        location.reload();
    });

    function enterApp(user) {
        el.userEmail.textContent = user.email;
        el.loginView.classList.add('hidden');
        el.appView.classList.remove('hidden');
        loadRequests();
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
        if (name === 'projecten' && !projects.length) loadProjects();
        if (name === 'settings')  loadSettings();
    }

    /* ==========================================================================
       AANVRAGEN
       ========================================================================== */
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
        renderRequests();
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
        if (e.target.closest('.status-select')) return;
        const tr = e.target.closest('tr');
        if (tr) openRequestDrawer(tr.dataset.id);
    });

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

    el.dDelete.addEventListener('click', async () => {
        if (!activeRequestId) return;
        const row = rows.find((r) => r.id === activeRequestId);
        if (!row) return;
        if (!confirm(`Aanvraag van "${row.name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;

        const { error } = await supabase
            .from('contact_requests')
            .delete()
            .eq('id', activeRequestId);

        if (error) { toast('Verwijderen mislukt.'); return; }

        rows = rows.filter((r) => r.id !== activeRequestId);
        updateStats();
        renderRequests();
        closeRequestDrawer();
        toast('Aanvraag verwijderd.');
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

        const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });

        el.saveSettingsBtn.disabled = false;
        el.saveSettingsBtn.textContent = origText;

        if (error) { toast('Opslaan mislukt.'); return; }
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

    /* ---------- global keyboard ---------- */
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (el.drawer.classList.contains('open')) closeRequestDrawer();
        if (el.projDrawer.classList.contains('open')) closeProjectEditor();
        if (el.cropModal.classList.contains('open')) closeCropModal();
    });

    boot();
})();
