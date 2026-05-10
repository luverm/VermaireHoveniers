/* ==========================================================================
   VERMAIRE HOVENIERS - MAIN JAVASCRIPT
   Interactive functionality, animations, and effects
   ========================================================================== */

(function() {
    'use strict';

    /* ==========================================================================
       LOADER
       ========================================================================== */
    const loader = document.getElementById('loader');
    const loaderBarFill = document.getElementById('loaderBarFill');

    let progress = 0;
    const loaderInterval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress > 100) progress = 100;
        loaderBarFill.style.width = progress + '%';

        if (progress >= 100) {
            clearInterval(loaderInterval);
            setTimeout(() => {
                loader.classList.add('loaded');
                document.body.classList.add('hero-loaded');

                setTimeout(() => {
                    loader.style.display = 'none';
                }, 600);
            }, 300);
        }
    }, 100);

    // Fallback: hide loader on full page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            loaderBarFill.style.width = '100%';
            setTimeout(() => {
                loader.classList.add('loaded');
                document.body.classList.add('hero-loaded');
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 600);
            }, 300);
        }, 500);
    });

    /* ==========================================================================
       CUSTOM CURSOR
       ========================================================================== */
    const cursor = document.getElementById('cursor');
    const cursorFollower = document.getElementById('cursorFollower');

    if (cursor && cursorFollower && window.matchMedia('(hover: hover)').matches) {
        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;
        let followerX = 0, followerY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animateCursor() {
            // Smooth main cursor
            cursorX += (mouseX - cursorX) * 0.7;
            cursorY += (mouseY - cursorY) * 0.7;
            cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;

            // Smoother follower
            followerX += (mouseX - followerX) * 0.15;
            followerY += (mouseY - followerY) * 0.15;
            cursorFollower.style.transform = `translate(${followerX}px, ${followerY}px) translate(-50%, -50%)`;

            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover states
        document.querySelectorAll('[data-cursor="hover"]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.classList.add('cursor-hover');
                cursorFollower.classList.add('cursor-hover');
            });
            el.addEventListener('mouseleave', () => {
                cursor.classList.remove('cursor-hover');
                cursorFollower.classList.remove('cursor-hover');
            });
        });

        // Hide on mouse leave window
        document.addEventListener('mouseleave', () => {
            cursor.style.opacity = '0';
            cursorFollower.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursor.style.opacity = '1';
            cursorFollower.style.opacity = '1';
        });
    }

    /* ==========================================================================
       NAVIGATION
       ========================================================================== */
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    let lastScroll = 0;

    function handleNavScroll() {
        const currentScroll = window.scrollY;

        // Add scrolled class
        if (currentScroll > 50) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }

        // Hide/show on scroll direction
        if (currentScroll > 200) {
            if (currentScroll > lastScroll) {
                nav.classList.add('nav-hidden');
            } else {
                nav.classList.remove('nav-hidden');
            }
        } else {
            nav.classList.remove('nav-hidden');
        }

        lastScroll = currentScroll;
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });

    // Mobile menu toggle
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    /* ==========================================================================
       PROGRESS BAR
       ========================================================================== */
    const progressBar = document.getElementById('progressBar');

    function updateProgressBar() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = Math.min(scrollPercent, 100) + '%';
    }

    window.addEventListener('scroll', updateProgressBar, { passive: true });

    /* ==========================================================================
       ACTIVE NAV LINK BASED ON SCROLL POSITION
       ========================================================================== */
    const sections = document.querySelectorAll('section[id]');

    function setActiveLink() {
        const scrollPos = window.scrollY + 200;
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

    window.addEventListener('scroll', setActiveLink, { passive: true });

    /* ==========================================================================
       TEXT REVEAL WITH WORDS WRAP
       ========================================================================== */
    function wrapWordsInMaskElements() {
        document.querySelectorAll('[data-reveal-text-mask]').forEach(el => {
            const html = el.innerHTML;
            // Process text nodes only, preserving HTML tags
            const wrap = document.createElement('div');
            wrap.innerHTML = html;

            function processNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    const fragment = document.createDocumentFragment();
                    const words = text.split(/(\s+)/);
                    words.forEach(word => {
                        if (word.trim() === '') {
                            fragment.appendChild(document.createTextNode(word));
                        } else {
                            const span = document.createElement('span');
                            span.className = 'word-wrap';
                            const inner = document.createElement('span');
                            inner.className = 'word';
                            inner.textContent = word;
                            span.appendChild(inner);
                            fragment.appendChild(span);
                        }
                    });
                    node.parentNode.replaceChild(fragment, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    Array.from(node.childNodes).forEach(processNode);
                }
            }

            Array.from(wrap.childNodes).forEach(processNode);
            el.innerHTML = wrap.innerHTML;

            // Set indices for stagger
            el.querySelectorAll('.word').forEach((word, i) => {
                word.style.setProperty('--word-index', i);
            });
        });
    }

    wrapWordsInMaskElements();

    /* ==========================================================================
       INTERSECTION OBSERVER FOR ANIMATIONS
       ========================================================================== */
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };

    const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');

                // Trigger counters
                if (entry.target.hasAttribute('data-counter') && !entry.target.dataset.counted) {
                    animateCounter(entry.target);
                    entry.target.dataset.counted = 'true';
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('[data-reveal], [data-reveal-text], [data-reveal-card], [data-reveal-text-mask]').forEach(el => {
        animateOnScroll.observe(el);
    });

    // Counter observer
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                animateCounter(entry.target);
                entry.target.dataset.counted = 'true';
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

    // About images / values observer
    document.querySelectorAll('.about-image, .about-badge').forEach(el => {
        animateOnScroll.observe(el);
    });

    /* ==========================================================================
       COUNTER ANIMATION
       ========================================================================== */
    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-counter'), 10);
        const duration = 2000;
        const startTime = performance.now();
        const startValue = 0;

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuart(progress);
            const current = Math.floor(startValue + (target - startValue) * easedProgress);
            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }

        requestAnimationFrame(update);
    }

    /* ==========================================================================
       PARALLAX EFFECTS
       ========================================================================== */
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    function updateParallax() {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;

        parallaxElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const elementTop = rect.top + scrollTop;
            const speed = parseFloat(el.getAttribute('data-parallax')) || 0.3;

            // Only animate when in/near viewport
            if (rect.top < windowHeight && rect.bottom > 0) {
                const scrolled = scrollTop - elementTop + windowHeight;
                const yPos = scrolled * speed;
                // Combine translation with subtle scale for richer effect
                const isNegative = speed < 0;
                const scale = isNegative ? 1.05 : 1.05;
                el.style.transform = `translate3d(0, ${yPos * -1}px, 0) scale(${scale})`;
            }
        });
    }

    let parallaxTicking = false;
    window.addEventListener('scroll', () => {
        if (!parallaxTicking) {
            requestAnimationFrame(() => {
                updateParallax();
                parallaxTicking = false;
            });
            parallaxTicking = true;
        }
    }, { passive: true });

    /* ==========================================================================
       HERO PARTICLES (FLOATING LEAVES)
       ========================================================================== */
    const heroParticles = document.getElementById('heroParticles');

    if (heroParticles) {
        const leafSVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 2 C 6 6, 4 14, 8 22 C 10 24, 14 24, 16 22 C 20 14, 18 6, 12 2 Z" opacity="0.6"/>
        </svg>`;

        function createLeaf() {
            const leaf = document.createElement('div');
            leaf.className = 'leaf-particle';
            leaf.innerHTML = leafSVG;
            leaf.style.left = Math.random() * 100 + '%';
            leaf.style.animationDuration = (15 + Math.random() * 10) + 's';
            leaf.style.animationDelay = Math.random() * 5 + 's';
            leaf.style.fontSize = (12 + Math.random() * 16) + 'px';
            heroParticles.appendChild(leaf);

            setTimeout(() => leaf.remove(), 25000);
        }

        // Create initial particles
        for (let i = 0; i < 8; i++) {
            setTimeout(() => createLeaf(), i * 800);
        }

        // Continuously create
        setInterval(createLeaf, 2000);
    }

    /* ==========================================================================
       PROJECT FILTER
       ========================================================================== */
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');

            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            projectCards.forEach(card => {
                const category = card.getAttribute('data-category');
                if (filter === 'all' || category === filter) {
                    card.classList.remove('fade-out');
                    setTimeout(() => {
                        card.classList.remove('hidden');
                    }, 50);
                } else {
                    card.classList.add('fade-out');
                    setTimeout(() => {
                        card.classList.add('hidden');
                    }, 400);
                }
            });
        });
    });

    /* ==========================================================================
       TESTIMONIALS SLIDER
       ========================================================================== */
    const testimonialsTrack = document.getElementById('testimonialsTrack');
    const testimonialPrev = document.getElementById('testimonialPrev');
    const testimonialNext = document.getElementById('testimonialNext');
    const testimonialProgress = document.getElementById('testimonialProgress');

    if (testimonialsTrack && testimonialPrev && testimonialNext) {
        const testimonials = testimonialsTrack.querySelectorAll('.testimonial');
        let currentIndex = 0;
        const visibleCount = window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3;

        function getMaxIndex() {
            return Math.max(0, testimonials.length - (window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3));
        }

        function updateSlider() {
            const visible = window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3;
            const maxIndex = Math.max(0, testimonials.length - visible);
            currentIndex = Math.min(currentIndex, maxIndex);

            const cardWidth = testimonials[0].offsetWidth + 32; // gap
            testimonialsTrack.style.transform = `translateX(-${currentIndex * cardWidth}px)`;

            // Update progress
            const progress = maxIndex === 0 ? 100 : ((currentIndex + 1) / (maxIndex + 1)) * 100;
            testimonialProgress.style.width = progress + '%';
        }

        testimonialPrev.addEventListener('click', () => {
            currentIndex = Math.max(0, currentIndex - 1);
            updateSlider();
        });

        testimonialNext.addEventListener('click', () => {
            const maxIndex = getMaxIndex();
            currentIndex = Math.min(maxIndex, currentIndex + 1);
            updateSlider();
        });

        // Auto-advance
        let autoAdvance = setInterval(() => {
            const maxIndex = getMaxIndex();
            if (currentIndex >= maxIndex) {
                currentIndex = 0;
            } else {
                currentIndex++;
            }
            updateSlider();
        }, 6000);

        // Pause on hover
        testimonialsTrack.addEventListener('mouseenter', () => clearInterval(autoAdvance));
        testimonialsTrack.addEventListener('mouseleave', () => {
            autoAdvance = setInterval(() => {
                const maxIndex = getMaxIndex();
                if (currentIndex >= maxIndex) {
                    currentIndex = 0;
                } else {
                    currentIndex++;
                }
                updateSlider();
            }, 6000);
        });

        // Drag/swipe support
        let isDragging = false;
        let startX = 0;
        let scrollLeft = 0;

        testimonialsTrack.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.pageX - testimonialsTrack.offsetLeft;
            testimonialsTrack.style.cursor = 'grabbing';
        });

        testimonialsTrack.addEventListener('mouseleave', () => {
            isDragging = false;
            testimonialsTrack.style.cursor = 'grab';
        });

        testimonialsTrack.addEventListener('mouseup', () => {
            isDragging = false;
            testimonialsTrack.style.cursor = 'grab';
        });

        // Touch support
        testimonialsTrack.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX;
        }, { passive: true });

        testimonialsTrack.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].pageX;
            const diff = startX - endX;

            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    const maxIndex = getMaxIndex();
                    currentIndex = Math.min(maxIndex, currentIndex + 1);
                } else {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
                updateSlider();
            }
        }, { passive: true });

        // Update on resize
        window.addEventListener('resize', () => {
            updateSlider();
        });

        updateSlider();
    }

    /* ==========================================================================
       MAGNETIC BUTTONS
       ========================================================================== */
    if (window.matchMedia('(hover: hover)').matches) {
        document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
            btn.classList.add('btn-magnetic');

            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                const intensity = 0.2;
                btn.style.transform = `translate(${x * intensity}px, ${y * intensity}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    /* ==========================================================================
       FORM HANDLING
       ========================================================================== */
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData);

            // Basic validation
            if (!data.name || !data.email) {
                alert('Vul alstublieft uw naam en e-mailadres in.');
                return;
            }

            // Simulate submission
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.querySelector('.btn-text').textContent;
            submitBtn.querySelector('.btn-text').textContent = 'Bezig met verzenden...';
            submitBtn.disabled = true;

            setTimeout(() => {
                formSuccess.classList.add('active');

                // Reset form
                contactForm.reset();
                submitBtn.querySelector('.btn-text').textContent = originalText;
                submitBtn.disabled = false;

                // Hide success after delay
                setTimeout(() => {
                    formSuccess.classList.remove('active');
                }, 5000);
            }, 1200);
        });
    }

    /* ==========================================================================
       LAZY LOAD IMAGES
       ========================================================================== */
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.complete) {
                        img.classList.add('loaded');
                    } else {
                        img.addEventListener('load', () => img.classList.add('loaded'));
                    }
                    imageObserver.unobserve(img);
                }
            });
        });

        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        lazyImages.forEach(img => img.classList.add('loaded'));
    }

    /* ==========================================================================
       FAQ ACCORDION (close others when opening)
       ========================================================================== */
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                faqItems.forEach(other => {
                    if (other !== item) {
                        other.open = false;
                    }
                });
            }
        });
    });

    /* ==========================================================================
       PREVENT FOUC (Flash of Unstyled Content)
       ========================================================================== */
    document.body.classList.add('loaded');

    /* ==========================================================================
       PERFORMANCE: Pause animations when not in viewport
       ========================================================================== */
    const animationPauser = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const target = entry.target;
            if (entry.isIntersecting) {
                target.style.animationPlayState = 'running';
            } else {
                target.style.animationPlayState = 'paused';
            }
        });
    }, { threshold: 0 });

    document.querySelectorAll('.hero-bg-image, .showcase-bg, .footer-marquee-track, .marquee-track').forEach(el => {
        animationPauser.observe(el);
    });

    /* ==========================================================================
       KEY HANDLERS
       ========================================================================== */
    document.addEventListener('keydown', (e) => {
        // ESC closes mobile menu
        if (e.key === 'Escape') {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    /* ==========================================================================
       INITIAL CALLS
       ========================================================================== */
    handleNavScroll();
    updateProgressBar();
    setActiveLink();
    updateParallax();

})();
