/* ==========================================================================
   PROJECTS PAGE — fetch + render + per-card photo slider
   ========================================================================== */

(function () {
    'use strict';

    const fullGrid = document.getElementById('projectsGrid');     // /projecten
    const homeGrid = document.getElementById('homeProjectsGrid'); // homepage section
    const grids = [fullGrid, homeGrid].filter(Boolean);
    if (!grids.length) return;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function renderEmpty(target, msg) {
        target.innerHTML = `
            <div class="proj-empty">
                <h3>${esc(msg || 'Nog geen projecten')}</h3>
                <p>Binnenkort vindt u hier ons werk terug.</p>
            </div>`;
    }

    function projectMarkup(p) {
        const hasPhotos = p.photos && p.photos.length > 0;
        const photos = hasPhotos ? p.photos : [];

        const slides = hasPhotos
            ? photos.map((ph) => `<img class="proj-slide" src="${esc(ph.url)}" alt="${esc(ph.alt)}" decoding="async">`).join('')
            : `<div class="proj-empty-photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <circle cx="9" cy="11" r="1.5"/>
                    <path d="m21 17-4-4-9 9"/>
                </svg>
                <span>Geen foto's</span>
               </div>`;

        const dots = hasPhotos && photos.length > 1
            ? `<div class="proj-dots" role="tablist">${
                photos.map((_, i) => `<button type="button" class="proj-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Foto ${i + 1}"></button>`).join('')
            }</div>` : '';

        const arrows = hasPhotos && photos.length > 1
            ? `<button type="button" class="proj-arrow prev" aria-label="Vorige foto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>
               </button>
               <button type="button" class="proj-arrow next" aria-label="Volgende foto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
               </button>` : '';

        const counter = hasPhotos && photos.length > 1
            ? `<span class="proj-counter"><span class="cur">1</span> / ${photos.length}</span>` : '';

        const locationBlock = p.location
            ? `<span class="proj-meta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  ${esc(p.location)}
               </span>` : '';

        return `
            <article class="proj-card" data-id="${esc(p.id)}">
                <div class="proj-slider">
                    <div class="proj-track">${slides}</div>
                    ${counter}
                    ${arrows}
                    ${dots}
                </div>
                <div class="proj-info">
                    ${locationBlock}
                    <h3 class="proj-title">${esc(p.title)}</h3>
                    ${p.description ? `<p class="proj-desc">${esc(p.description)}</p>` : ''}
                </div>
            </article>`;
    }

    function initSlider(card) {
        const track = card.querySelector('.proj-track');
        const slides = card.querySelectorAll('.proj-slide');
        if (!track || slides.length <= 1) return;

        const dots = card.querySelectorAll('.proj-dot');
        const counter = card.querySelector('.proj-counter .cur');
        const prev = card.querySelector('.proj-arrow.prev');
        const next = card.querySelector('.proj-arrow.next');

        function update() {
            const idx = Math.round(track.scrollLeft / track.clientWidth);
            const i = Math.max(0, Math.min(slides.length - 1, idx));
            dots.forEach((d, di) => d.classList.toggle('active', di === i));
            if (counter) counter.textContent = String(i + 1);
            if (prev) prev.disabled = i === 0;
            if (next) next.disabled = i === slides.length - 1;
        }

        let raf = 0;
        track.addEventListener('scroll', () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(update);
        }, { passive: true });

        dots.forEach((d) => d.addEventListener('click', () => {
            const i = Number(d.dataset.index);
            track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
        }));

        prev?.addEventListener('click', () => {
            track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
        });
        next?.addEventListener('click', () => {
            track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
        });

        // Recompute on resize (clientWidth changes)
        let ro;
        if ('ResizeObserver' in window) {
            ro = new ResizeObserver(() => update());
            ro.observe(track);
        }

        update();
    }

    function renderInto(target, list) {
        target.innerHTML = list.map(projectMarkup).join('');
        target.querySelectorAll('.proj-card').forEach(initSlider);
    }

    // On the homepage, an empty/failed projects feed hides the whole section
    // (customers shouldn't see an empty teaser); the /projecten page keeps
    // its visible empty state.
    function hideHomeSection() {
        homeGrid?.closest('.home-projects')?.style.setProperty('display', 'none');
    }

    async function load() {
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error('http ' + res.status);
            const { projects } = await res.json();

            if (!projects || projects.length === 0) {
                if (fullGrid) renderEmpty(fullGrid, 'Nog geen projecten');
                hideHomeSection();
                return;
            }

            if (fullGrid) renderInto(fullGrid, projects);
            if (homeGrid) renderInto(homeGrid, projects.slice(0, 3)); // recent 3 op de home
        } catch (err) {
            console.error('[projecten] load failed:', err);
            if (fullGrid) renderEmpty(fullGrid, 'Projecten konden niet geladen worden');
            hideHomeSection();
        }
    }

    load();
})();
