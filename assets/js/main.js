/* ============================================================
   linux-hpc-security — Main JavaScript
   smooth scroll · copy code · scroll-reveal · dynamic year
   ============================================================ */

(function () {
    'use strict';

    function updateYear() {
        var el = document.getElementById('current-year');
        if (el) el.textContent = new Date().getFullYear();
    }

    function initCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var codeEl = document.querySelector(this.getAttribute('data-target'));
                if (!codeEl) return;
                var text = codeEl.textContent || codeEl.innerText;
                var self = this;
                navigator.clipboard.writeText(text).then(function () {
                    var original = self.textContent;
                    self.textContent = '✓ Copied!';
                    self.style.background = 'var(--green)';
                    self.style.color = 'var(--bg)';
                    setTimeout(function () {
                        self.textContent = original;
                        self.style.background = '';
                        self.style.color = '';
                    }, 1500);
                }).catch(function () {
                    self.textContent = '✗ Failed';
                    setTimeout(function () { self.textContent = 'Copy'; }, 1500);
                });
            });
        });
    }

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                var target = document.querySelector(this.getAttribute('href'));
                if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
            });
        });
    }

    function initScrollReveal() {
        var els = document.querySelectorAll('.reveal');
        if (!els.length) return;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        els.forEach(function (el) { observer.observe(el); });
    }

    function initNavScroll() {
        var header = document.querySelector('.site-header');
        if (!header) return;
        var toggle = function () {
            header.style.background = window.scrollY > 10
                ? 'rgba(10, 14, 20, 0.95)'
                : 'rgba(10, 14, 20, 0.85)';
        };
        window.addEventListener('scroll', toggle);
        toggle();
    }

    document.documentElement.classList.add('js');
    document.addEventListener('DOMContentLoaded', function () {
        updateYear();
        initCopyButtons();
        initSmoothScroll();
        initScrollReveal();
        initNavScroll();
    });
})();
