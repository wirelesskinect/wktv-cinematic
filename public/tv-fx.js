// WKTV — TV-style touches: picture panels "power on" when scrolled to,
// and the mini account card counts its days and shows a real date.
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mini account card: expiry one year from today
  var exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
  var expEl = document.getElementById('md-expires');
  if (expEl) expEl.textContent = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  var daysEl = document.getElementById('md-days');

  function countDays() {
    if (!daysEl || reduce) return;
    var target = 365, start = null;
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / 1100);
      daysEl.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var panels = Array.prototype.slice.call(document.querySelectorAll('.visual-benefits .visual-art'));
  if (reduce || !('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target; io.unobserve(el);
      var i = panels.indexOf(el);
      setTimeout(function () {
        el.classList.remove('tv-off'); el.classList.add('tv-on');
        if (el.classList.contains('visual-account')) setTimeout(countDays, 450);
      }, i * 160);
    });
  }, { threshold: 0.35 });

  panels.forEach(function (el) { el.classList.add('tv-off'); io.observe(el); });
})();
