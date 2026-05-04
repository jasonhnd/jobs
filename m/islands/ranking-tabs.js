// ranking-tabs.js — vanilla JS island for ⑦ ランキング tab toggle.
// Per docs/MOBILE_DESIGN.md §7 (Islands Architecture)
// Both lists rendered in HTML; this just toggles which one is visible.
(function () {
  var tabs = document.querySelectorAll('.m-rank__tab');
  var lists = document.querySelectorAll('.m-rank__list');
  if (!tabs.length || !lists.length) return;

  function setActive(target) {
    tabs.forEach(function (t) {
      t.setAttribute('data-active', t.dataset.target === target ? 'true' : 'false');
    });
    lists.forEach(function (l) {
      l.style.display = l.dataset.side === target ? 'block' : 'none';
    });
    // Sync URL hash (shareable link to a specific tab) without scroll
    if (history.replaceState) {
      history.replaceState(null, '', '#' + target);
    }
  }

  // Wire clicks
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { setActive(t.dataset.target); });
  });

  // Honor URL hash on load (#low or #high)
  var initial = (location.hash || '').replace(/^#/, '');
  if (initial === 'low' || initial === 'high') setActive(initial);
})();
