/* ==========================================================================
   VERMAIRE HOVENIERS - SIMPLIFIED JS
   ========================================================================== */

(async function() {
    'use strict';

    /* ----------------------------------------------------------------------
       Loading screen
       Hides when window 'load' fires (all images/styles ready) AND a small
       minimum delay has passed — but never sticks around longer than 4 s.
       ---------------------------------------------------------------------- */
    (function setupLoader() {
        const loader = document.getElementById('loader');
        if (!loader) {
            document.body.classList.remove('loading');
            return;
        }

        const MIN_MS = 700;   // never flash for less than this
        const MAX_MS = 4000;  // never hang past this

        let ready = false;
        let minPassed = false;
        let hidden = false;

        const hide = () => {
            if (hidden) return;
            hidden = true;
            loader.classList.add('done');
            document.body.classList.remove('loading');
            loader.addEventListener('transitionend', () => loader.remove(), { once: true });
            setTimeout(() => loader.remove(), 1200); // safety net
        };

        const maybeHide = () => { if (ready && minPassed) hide(); };

        setTimeout(() => { minPassed = true; maybeHide(); }, MIN_MS);
        setTimeout(hide, MAX_MS); // hard cap

        if (document.readyState === 'complete') {
            ready = true; maybeHide();
        } else {
            window.addEventListener('load', () => { ready = true; maybeHide(); });
        }
    })();

    /* Loaded class for hero entrance */
    window.addEventListener('load', () => {
        requestAnimationFrame(() => document.body.classList.add('loaded'));
    });
    // Fallback if load already fired
    if (document.readyState === 'complete') {
        document.body.classList.add('loaded');
    }

    /* ----------------------------------------------------------------------
       Site settings (CMS) — fetch & apply BEFORE observers register so the
       hero counters animate to the configured number. Falls back silently
       to the hardcoded HTML if /api/site-settings is unavailable.
       ---------------------------------------------------------------------- */
    async function loadSettings() {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 2500);
            const res = await fetch('/api/site-settings', { signal: ctrl.signal });
            clearTimeout(t);
            if (!res.ok) return null;
            const { settings } = await res.json();
            return settings || null;
        } catch { return null; }
    }

    function applySettings(settings) {
        if (!settings) return;
        document.querySelectorAll('[data-cms]').forEach((el) => {
            const key = el.getAttribute('data-cms');
            const v = settings[key];
            if (v != null && v !== '') el.textContent = v;
        });
        document.querySelectorAll('[data-cms-counter]').forEach((el) => {
            const key = el.getAttribute('data-cms-counter');
            const v = settings[key];
            if (v != null && v !== '') el.setAttribute('data-counter', String(v));
        });
        document.querySelectorAll('[data-cms-src]').forEach((el) => {
            const key = el.getAttribute('data-cms-src');
            const v = settings[key];
            if (v) el.setAttribute('src', v);
        });
    }

    applySettings(await loadSettings());

    /* Navigation scroll state */
    const nav = document.getElementById('nav');
    const progressBar = document.getElementById('progressBar');
    const sections = document.querySelectorAll('section[id]');
    const menuLinks = document.querySelectorAll('.menu-link');

    function onScroll() {
        const y = window.scrollY;

        if (y > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
        progressBar.style.width = Math.min(pct, 100) + '%';

        // Highlight active link in the menu drawer
        const scrollPos = y + 150;
        sections.forEach(section => {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.menu-link[href="#${id}"]`);
            if (scrollPos >= top && scrollPos < bottom) {
                menuLinks.forEach(l => l.classList.remove('active'));
                if (link) link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    /* Slide-in menu drawer */
    const hamburger = document.getElementById('hamburger');
    const menuDrawer = document.getElementById('menuDrawer');
    const menuBackdrop = document.getElementById('menuBackdrop');
    const menuClose = document.getElementById('menuClose');

    let lockedScrollY = 0;

    function openMenu() {
        lockedScrollY = window.scrollY;
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.classList.add('menu-open');
        hamburger.setAttribute('aria-expanded', 'true');
        hamburger.setAttribute('aria-label', 'Sluit menu');
        menuDrawer.classList.add('open');
        menuDrawer.setAttribute('aria-hidden', 'false');
        menuBackdrop.classList.add('open');
    }

    function closeMenu(restoreScroll = true) {
        document.body.classList.remove('menu-open');
        document.body.style.top = '';
        if (restoreScroll) window.scrollTo(0, lockedScrollY);
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        menuDrawer.classList.remove('open');
        menuDrawer.setAttribute('aria-hidden', 'true');
        menuBackdrop.classList.remove('open');
    }

    if (hamburger && menuDrawer && menuBackdrop) {
        hamburger.addEventListener('click', () => {
            if (hamburger.getAttribute('aria-expanded') === 'true') closeMenu();
            else openMenu();
        });

        menuBackdrop.addEventListener('click', closeMenu);
        menuClose?.addEventListener('click', closeMenu);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menuDrawer.classList.contains('open')) closeMenu();
        });

        menuDrawer.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href');
                if (href && href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    closeMenu(false); // don't restore the old scroll — we're going somewhere new
                    if (target) {
                        // Wait one frame so the body lock is released before measuring/scrolling
                        requestAnimationFrame(() => {
                            const offset = 70;
                            window.scrollTo({
                                top: target.getBoundingClientRect().top + window.scrollY - offset,
                                behavior: 'smooth'
                            });
                        });
                    }
                } else {
                    closeMenu();
                }
            });
        });
    }

    /* Smooth scroll for anchor links with offset (skip menu links — handled separately) */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        if (anchor.closest('#menuDrawer')) return;
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = 70;
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - offset,
                    behavior: 'smooth'
                });
            }
        });
    });

    /* Reveal on scroll */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                if (entry.target.hasAttribute('data-counter') && !entry.target.dataset.counted) {
                    animateCounter(entry.target);
                    entry.target.dataset.counted = 'true';
                }
            }
        });
    }, { rootMargin: '0px 0px -80px 0px', threshold: 0.1 });

    document.querySelectorAll('[data-reveal], [data-reveal-card]').forEach(el => observer.observe(el));

    /* Counter animation */
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                animateCounter(entry.target);
                entry.target.dataset.counted = 'true';
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-counter'), 10);
        const duration = 1600;
        const start = performance.now();

        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.floor(target * eased);
            if (t < 1) requestAnimationFrame(step);
            else el.textContent = target;
        }
        requestAnimationFrame(step);
    }

    /* FAQ — close others when opening */
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                faqItems.forEach(other => {
                    if (other !== item) other.open = false;
                });
            }
        });
    });

    /* Contact form */
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(contactForm));

            if (!data.name || !data.email) {
                alert('Vul alstublieft uw naam en e-mailadres in.');
                return;
            }

            const btn = contactForm.querySelector('button[type="submit"]');
            const span = btn.querySelector('span');
            const orig = span.textContent;
            span.textContent = 'Bezig met verzenden...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || 'Verzenden mislukt.');
                }

                formSuccess.classList.add('active');
                contactForm.reset();
                setTimeout(() => formSuccess.classList.remove('active'), 6000);
            } catch (err) {
                alert(err.message + ' U kunt ons ook direct bellen op +31 6 23 29 32 74.');
            } finally {
                span.textContent = orig;
                btn.disabled = false;
            }
        });
    }

    /* Floating action menu (WhatsApp + Instagram) */
    const fab = document.getElementById('fab');
    const fabToggle = document.getElementById('fabToggle');
    if (fab && fabToggle) {
        const openFab = () => {
            fab.classList.add('open');
            fabToggle.setAttribute('aria-expanded', 'true');
            fabToggle.setAttribute('aria-label', 'Sluit contact opties');
            fab.querySelectorAll('.fab-action').forEach((a) => a.setAttribute('tabindex', '0'));
        };
        const closeFab = () => {
            fab.classList.remove('open');
            fabToggle.setAttribute('aria-expanded', 'false');
            fabToggle.setAttribute('aria-label', 'Open contact opties');
            fab.querySelectorAll('.fab-action').forEach((a) => a.setAttribute('tabindex', '-1'));
        };
        fabToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fab.classList.contains('open')) closeFab(); else openFab();
        });
        document.addEventListener('click', (e) => {
            if (!fab.contains(e.target) && fab.classList.contains('open')) closeFab();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fab.classList.contains('open')) closeFab();
        });
        // close after picking an action so the FAB resets
        fab.querySelectorAll('.fab-action').forEach((a) => {
            a.addEventListener('click', () => setTimeout(closeFab, 100));
        });
    }

    /* Lazy image fade-in */
    const lazyImages = document.querySelectorAll('img.lazy-fade');
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.complete) img.classList.add('loaded');
                    else img.addEventListener('load', () => img.classList.add('loaded'));
                    imgObserver.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => imgObserver.observe(img));
    } else {
        lazyImages.forEach(img => img.classList.add('loaded'));
    }

    /* Initial */
    onScroll();
})();
