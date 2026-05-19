/* ==========================================================================
   VERMAIRE HOVENIERS - SIMPLIFIED JS
   ========================================================================== */

(function() {
    'use strict';

    /* Loaded class for hero entrance */
    window.addEventListener('load', () => {
        requestAnimationFrame(() => document.body.classList.add('loaded'));
    });
    // Fallback if load already fired
    if (document.readyState === 'complete') {
        document.body.classList.add('loaded');
    }

    /* Navigation scroll state */
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    const progressBar = document.getElementById('progressBar');
    const sections = document.querySelectorAll('section[id]');

    function onScroll() {
        const y = window.scrollY;

        if (y > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
        progressBar.style.width = Math.min(pct, 100) + '%';

        // Active nav link
        const scrollPos = y + 150;
        sections.forEach(section => {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');
            const link = document.querySelector(`.nav-link[href="#${id}"]`);
            if (scrollPos >= top && scrollPos < bottom) {
                navLinks.forEach(l => l.classList.remove('active'));
                if (link) link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    /* Mobile menu */
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    /* Smooth scroll for anchor links with offset */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
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

    /* Lazy image fade-in */
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
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
