/* WKTV — motion & interaction layer */
(function(){
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };

  /* Scroll progress bar + back-to-top button */
  var bar = document.createElement('div'); bar.className = 'fx-progress'; bar.setAttribute('aria-hidden','true');
  document.body.appendChild(bar);
  var top = document.createElement('button'); top.className = 'fx-top'; top.type = 'button';
  top.setAttribute('aria-label','Back to top'); top.innerHTML = '&uarr;';
  top.addEventListener('click', function(){ window.scrollTo({top:0, behavior: reduce ? 'auto' : 'smooth'}); });
  document.body.appendChild(top);

  var header = document.querySelector('header');
  var scene = document.querySelector('.screen-scene');
  var ticking = false;
  function onScroll(){
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (header) header.classList.toggle('fx-scrolled', y > 60);
    top.classList.toggle('fx-show', y > 700);
    if (scene && !reduce && scene.classList.contains('fx-tilt')) {
      scene.style.setProperty('--py', Math.min(y * 0.12, 80).toFixed(1) + 'px');
    }
    ticking = false;
  }
  window.addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  onScroll();

  /* Hero screen: parallax on scroll + 3D tilt toward the cursor */
  if (scene && !reduce) {
    var enableTilt = function(){ scene.classList.add('fx-tilt'); onScroll(); };
    scene.addEventListener('animationend', function h(e){ if (e.target === scene) { scene.removeEventListener('animationend', h); enableTilt(); } });
    setTimeout(function(){ if (!scene.classList.contains('fx-tilt')) enableTilt(); }, 1800);
    if (fine) {
      var hero = scene.closest('.hero') || scene;
      hero.addEventListener('pointermove', function(e){
        var r = scene.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        scene.style.setProperty('--ry', (dx * 8).toFixed(2) + 'deg');
        scene.style.setProperty('--rx', (-dy * 6).toFixed(2) + 'deg');
      });
      hero.addEventListener('pointerleave', function(){
        scene.style.setProperty('--ry', '0deg'); scene.style.setProperty('--rx', '0deg');
      });
    }
  }

  /* Scroll reveal (staggered) */
  var revealSel = [
    '.device-band', '.section-heading', '.editorial article', '.catalog-note', '.pricing-title',
    '.plan-layout article', '.lifetime', '.connection-note', '.try-row', '.comparison-layout > *',
    '.comparison-disclaimer', '.setup > div:first-child', '.setup-list > div', '.faq > div:first-child',
    '.faq details', '.footer-inner', '.video-guide', '.support-subheading', '.device-card', '.install-card',
    '.install-note', '.after-setup', '.option-card', '.help-questions > *', '.help-callout', '.setup-done',
    '.next-steps', '.flyer-grid > *', '.help-contact-note'
  ].join(',');
  var cardSel = '.editorial article, .plan-layout article, .lifetime-option, .comparison-results article, .device-card, .install-card, .option-card, .setup-list > div';

  if (!reduce && 'IntersectionObserver' in window) {
    var targets = $$(revealSel).filter(function(el){ return !el.closest('dialog') && !el.closest('.hero') && !(el.parentElement && el.parentElement.closest('details')); });
    var vh = window.innerHeight;
    targets.forEach(function(el){
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92) return; // already on screen at load: leave visible, no flash
      var sibs = Array.prototype.filter.call(el.parentElement.children, function(c){ return targets.indexOf(c) > -1; });
      var i = Math.max(0, sibs.indexOf(el));
      el.style.setProperty('--fx-delay', Math.min(i * 0.09, 0.45) + 's');
      el.classList.add('fx-reveal');
    });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        el.classList.add('fx-in');
        // Hand transitions back to hover effects once the reveal finishes
        setTimeout(function(){ el.classList.remove('fx-reveal','fx-in'); el.style.removeProperty('--fx-delay'); }, 1400);
      });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.08});
    $$('.fx-reveal').forEach(function(el){ io.observe(el); });
  }

  /* Card spotlight that follows the cursor */
  $$(cardSel).forEach(function(card){
    card.classList.add('fx-card');
    if (!fine) return;
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* Highlight the nav link for the section in view */
  var links = $$('nav a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function(a){ var s = document.querySelector(a.getAttribute('href')); if (s) map[s.id] = a; });
    var nio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var a = map[en.target.id]; if (!a) return;
        if (en.isIntersecting) { links.forEach(function(l){ l.classList.remove('fx-active'); }); a.classList.add('fx-active'); }
        else a.classList.remove('fx-active');
      });
    }, {rootMargin: '-45% 0px -50% 0px'});
    Object.keys(map).forEach(function(id){ nio.observe(document.getElementById(id)); });
  }
})();
