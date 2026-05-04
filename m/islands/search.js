// search.js — vanilla JS island for ③ 検索結果.
// Per docs/MOBILE_DESIGN.md §7. Reads /data.search.json on first interaction
// (or immediately if URL has ?q= or ?sector=). No external lib.
(function () {
  var lang = window.M_LANG || 'ja';
  var form = document.querySelector('[data-island="search"]');
  if (!form) return;

  var input = form.querySelector('.m-search__input');
  var sortSelect = document.getElementById('m-search-sort');
  var sectorChips = document.querySelectorAll('.m-search__sectors .m-chip');
  var resultsEl = document.querySelector('[data-role="results"]');
  var countEl = document.querySelector('[data-role="count"]');
  var emptyEl = document.querySelector('[data-role="empty"]');

  var documents = null;
  var loading = null;
  var activeSector = 'all';

  function ensureDocuments() {
    if (documents) return Promise.resolve(documents);
    if (loading) return loading;
    loading = fetch('/data.search.json').then(function (r) { return r.json(); }).then(function (j) {
      documents = j.documents || [];
      return documents;
    });
    return loading;
  }

  function bandClass(score) {
    if (score == null) return '';
    if (score <= 3.9) return 'm-risk-low';
    if (score <= 6.9) return 'm-risk-mid';
    return 'm-risk-high';
  }

  function fmtRow(doc) {
    var name = lang === 'en' && doc.title_en ? doc.title_en : doc.title_ja;
    var url = '/m/' + lang + '/' + doc.id;
    var risk = doc.ai_risk;
    var riskBand = bandClass(risk);
    var sectorLabel = doc.sector_id ? doc.sector_id : '';
    var meta = [sectorLabel, doc.workforce_band || ''].filter(Boolean).join(' · ');
    return '<li class="m-search__row">' +
      '<div><a href="' + url + '">' + escapeHtml(name) + '</a>' +
      '<span class="m-search__row-meta">' + escapeHtml(meta) + '</span></div>' +
      '<span class="m-search__row-score ' + riskBand + '">' +
      (risk != null ? risk : '–') + '</span>' +
      '</li>';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function applyFilter() {
    var q = (input.value || '').trim().toLowerCase();
    var sort = sortSelect ? sortSelect.value : 'popular';

    ensureDocuments().then(function (docs) {
      var filtered = docs.filter(function (d) {
        if (activeSector !== 'all' && d.sector_id !== activeSector) return false;
        if (!q) return true;
        var hay = ((d.title_ja || '') + ' ' + (d.title_en || '') + ' ' +
                   (d.aliases_ja || []).join(' ') + ' ' + (d.aliases_en || []).join(' ')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });

      filtered.sort(function (a, b) {
        if (sort === 'risk_low')  return (a.ai_risk || 0) - (b.ai_risk || 0);
        if (sort === 'risk_high') return (b.ai_risk || 0) - (a.ai_risk || 0);
        if (sort === 'salary')    return (b.salary || 0) - (a.salary || 0);
        // popular: by ai_risk neutral, fall back to id order
        return 0;
      });

      var top = filtered.slice(0, 60);
      resultsEl.innerHTML = top.map(fmtRow).join('');
      var label = lang === 'en' ? (filtered.length + ' results') : (filtered.length + ' 件');
      countEl.textContent = filtered.length ? label : '';
      emptyEl.hidden = filtered.length > 0;
    });
  }

  // Wire interactions
  form.addEventListener('submit', function (e) { e.preventDefault(); applyFilter(); });
  input.addEventListener('input', function () {
    clearTimeout(input._t);
    input._t = setTimeout(applyFilter, 120);
  });
  if (sortSelect) sortSelect.addEventListener('change', applyFilter);
  sectorChips.forEach(function (c) {
    c.addEventListener('click', function () {
      sectorChips.forEach(function (s) { s.setAttribute('data-active', 'false'); });
      c.setAttribute('data-active', 'true');
      activeSector = c.dataset.sector;
      applyFilter();
    });
  });

  // Honor URL params on first load
  var params = new URLSearchParams(location.search);
  var initialQ = params.get('q');
  var initialSector = params.get('sector');
  if (initialQ) input.value = initialQ;
  if (initialSector) {
    activeSector = initialSector;
    sectorChips.forEach(function (c) {
      c.setAttribute('data-active', c.dataset.sector === initialSector ? 'true' : 'false');
    });
  }
  if (initialQ || initialSector) applyFilter();
})();
