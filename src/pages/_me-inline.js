
  (function () {
    'use strict';

    var SEARCH_URL = '/data.search.json';
    var POSITIONS_URL = '/data.me-positions.json';
    var TREEMAP_URL = '/data.treemap.json';
    var FETCH_TIMEOUT_MS = 10000;
    var INITIAL_RANKS_SHOWN = 8;

    function occupationPath(id) {
      return Number(id) === 404 ? '/occupations/404' : '/' + id;
    }

    var $form = document.getElementById('meForm');
    var $input = document.getElementById('meInput');
    var $listbox = document.getElementById('meListbox');
    var $announce = document.getElementById('meAnnounce');
    var $empty = document.getElementById('meEmpty');
    var $results = document.getElementById('meResults');
    var $summaryName = document.getElementById('meSummaryName');
    var $summarySector = document.getElementById('meSummarySector');
    var $statRisk = document.getElementById('meStatRisk');
    var $statWorkers = document.getElementById('meStatWorkers');
    var $statSalary = document.getElementById('meStatSalary');
    var $statSector = document.getElementById('meStatSector');
    var $rankList = document.getElementById('meRankList');
    var $rankToggle = document.getElementById('meRankToggle');
    var $rankRest = document.getElementById('meRankRest');
    var $similar = document.getElementById('meSimilar');
    var $quizCta = document.getElementById('meQuizCta');
    var $quizOpen = document.getElementById('meQuizOpen');
    var $quiz = document.getElementById('meQuiz');
    var $quizForm = document.getElementById('meQuizForm');
    var $quizSubmit = document.getElementById('meQuizSubmit');
    var $quizDone = document.getElementById('meQuizDone');
    var $quizCopy = document.getElementById('meQuizCopy');

    var WORKTYPES_URL = '/data.worktypes.json';
    var quizCopy = null;
    var worktypes = null;
    var quizStarted = false;
    var quizLastStep = 0;
    var currentQuizResult = null;

    var AXES = [
      { key: 'A1', leftPole: 'C', rightPole: 'R', exposedPole: 'R' },
      { key: 'A2', leftPole: 'P', rightPole: 'D', exposedPole: 'D' },
      { key: 'A3', leftPole: 'B', rightPole: 'K', exposedPole: 'K' }
    ];

    var searchDocs = null;
    var positionsData = null; // { meta, rankings, positions }
    var treemapData = null; // array
    var byId = {};
    var focusedIdx = -1;
    var rankExpanded = false;
    var currentJobId = null;

    // ── format helpers ──────────────────────────────────────────────
    function fmtSalary(s) { if (s == null) return '—'; return Math.round(s) + ' 万円'; }
    function fmtWorkers(w) {
      if (w == null) return '—';
      if (w >= 10000) return (w / 10000).toFixed(0) + ' 万人';
      return w.toLocaleString('ja-JP') + ' 人';
    }
    function riskBand(r) {
      if (r == null) return null;
      if (r < 4.0) return 'low';
      if (r < 7.0) return 'mid';
      return 'high';
    }
    function riskLabel(r) {
      if (r == null) return '—';
      var band = riskBand(r);
      var prefix = band === 'high' ? '▲ 影響大' : band === 'low' ? '◎ 影響小' : '▼ 中程度';
      return r + '/10 ' + prefix;
    }

    function ga(name, params) {
      try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {
        if (typeof console !== 'undefined') console.warn('[analytics] gtag event failed:', e);
      }
    }

    function fetchWithTimeout(url, ms) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var t = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
        fetch(url)
          .then(function (r) {
            if (!done) { done = true; clearTimeout(t); }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(resolve)
          .catch(function (e) { if (!done) { done = true; clearTimeout(t); } reject(e); });
      });
    }

    // ── data loaders ────────────────────────────────────────────────
    function loadSearchIndex() {
      if (searchDocs) return Promise.resolve(searchDocs);
      return fetchWithTimeout(SEARCH_URL, FETCH_TIMEOUT_MS).then(function (j) {
        searchDocs = j.documents || [];
        for (var i = 0; i < searchDocs.length; i++) byId[searchDocs[i].id] = searchDocs[i];
        return searchDocs;
      });
    }
    function loadPositions() {
      if (positionsData) return Promise.resolve(positionsData);
      return fetchWithTimeout(POSITIONS_URL, FETCH_TIMEOUT_MS).then(function (j) {
        positionsData = j;
        return j;
      });
    }
    function loadTreemap() {
      if (treemapData) return Promise.resolve(treemapData);
      return fetchWithTimeout(TREEMAP_URL, FETCH_TIMEOUT_MS).then(function (j) {
        treemapData = j || [];
        return treemapData;
      });
    }

    // ── typeahead matching ─────────────────────────────────────────
    function rankMatches(q) {
      q = q.trim().toLowerCase();
      if (!q || !searchDocs) return [];
      var exact = [], starts = [], contains = [];
      for (var i = 0; i < searchDocs.length; i++) {
        var d = searchDocs[i];
        var hay = (d.title_ja || '').toLowerCase();
        var aliases = (d.aliases_ja || []).map(function (a) { return (a || '').toLowerCase(); });
        var all = [hay].concat(aliases);
        var hit = false, isExact = false, isStart = false;
        for (var k = 0; k < all.length; k++) {
          var f = all[k];
          if (f === q) { isExact = true; hit = true; break; }
          if (f.indexOf(q) === 0) { isStart = true; hit = true; }
          else if (f.indexOf(q) >= 0) { hit = true; }
        }
        if (!hit) continue;
        if (isExact) exact.push(d);
        else if (isStart) starts.push(d);
        else contains.push(d);
      }
      var lenAsc = function (a, b) { return (a.title_ja || '').length - (b.title_ja || '').length; };
      return exact.concat(starts.sort(lenAsc), contains.sort(lenAsc)).slice(0, 8);
    }

    function sectorJaForDoc(d) {
      if (positionsData && positionsData.positions[d.id]) {
        return positionsData.positions[d.id].summary.sectorJa || '';
      }
      return '';
    }

    function renderSuggest(matches) {
      $listbox.replaceChildren();
      if (!matches.length) {
        $listbox.setAttribute('data-open', 'false');
        $input.setAttribute('aria-expanded', 'false');
        focusedIdx = -1;
        $announce.textContent = '候補なし';
        return;
      }
      for (var i = 0; i < matches.length; i++) {
        var d = matches[i];
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = 'meOpt-' + d.id;
        li.dataset.id = String(d.id);
        var nameWrap = document.createElement('div');
        var nameSpan = document.createElement('span');
        nameSpan.className = 'me-li-name';
        nameSpan.textContent = d.title_ja || '';
        var sectorSpan = document.createElement('div');
        sectorSpan.className = 'me-li-sector';
        sectorSpan.textContent = sectorJaForDoc(d);
        nameWrap.appendChild(nameSpan);
        nameWrap.appendChild(sectorSpan);
        var pill = document.createElement('span');
        var band = riskBand(d.ai_risk);
        pill.className = 'me-li-pill ' + (band || 'mid');
        pill.textContent = 'AI ' + (d.ai_risk != null ? d.ai_risk : '?') + '/10';
        li.appendChild(nameWrap);
        li.appendChild(pill);
        $listbox.appendChild(li);
      }
      $listbox.setAttribute('data-open', 'true');
      $input.setAttribute('aria-expanded', 'true');
      focusedIdx = 0;
      updateFocusedRow();
      $announce.textContent = matches.length + ' 件の結果';
    }

    function updateFocusedRow() {
      var items = $listbox.querySelectorAll('li');
      items.forEach(function (li, i) {
        if (i === focusedIdx) {
          li.classList.add('focused');
          li.setAttribute('aria-selected', 'true');
          $input.setAttribute('aria-activedescendant', li.id);
        } else {
          li.classList.remove('focused');
          li.setAttribute('aria-selected', 'false');
        }
      });
      if (focusedIdx < 0) {
        $input.removeAttribute('aria-activedescendant');
      }
    }

    function closeListbox() {
      $listbox.setAttribute('data-open', 'false');
      $input.setAttribute('aria-expanded', 'false');
      $input.removeAttribute('aria-activedescendant');
      focusedIdx = -1;
    }

    var searchDebounce = null;
    var searchSeq = 0;
    $input.addEventListener('input', function () {
      if (searchDebounce) clearTimeout(searchDebounce);
      var q = $input.value;
      if (!q.trim()) {
        // Invalidate any in-flight typeahead so a slow resolve can't
        // re-open the listbox after we cleared it.
        searchSeq++;
        closeListbox();
        $announce.textContent = '';
        return;
      }
      var seq = ++searchSeq;
      searchDebounce = setTimeout(function () {
        Promise.all([loadSearchIndex(), loadPositions()]).then(function () {
          // Bail if the user has typed more since this fetch started —
          // otherwise the stale result would overwrite fresher matches.
          if (seq !== searchSeq) return;
          renderSuggest(rankMatches($input.value));
        });
      }, 80);
    });

    $input.addEventListener('keydown', function (e) {
      var items = $listbox.querySelectorAll('li');
      if (e.key === 'ArrowDown') {
        if (!items.length) {
          // re-open if there's a query but listbox is closed
          if ($input.value.trim()) {
            Promise.all([loadSearchIndex(), loadPositions()]).then(function () {
              renderSuggest(rankMatches($input.value));
            });
          }
          e.preventDefault();
          return;
        }
        e.preventDefault();
        focusedIdx = (focusedIdx + 1) % items.length;
        updateFocusedRow();
      } else if (e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        focusedIdx = (focusedIdx - 1 + items.length) % items.length;
        updateFocusedRow();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items.length && focusedIdx >= 0) {
          var sel = items[focusedIdx];
          if (sel) selectJob(parseInt(sel.dataset.id, 10));
        }
      } else if (e.key === 'Escape') {
        closeListbox();
      }
    });

    $form.addEventListener('submit', function (e) {
      e.preventDefault();
      var items = $listbox.querySelectorAll('li');
      var pick = items[focusedIdx >= 0 ? focusedIdx : 0];
      if (pick) selectJob(parseInt(pick.dataset.id, 10));
    });

    $listbox.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]');
      if (!li) return;
      selectJob(parseInt(li.dataset.id, 10));
    });

    $input.addEventListener('blur', function () {
      // Delay closing so click on listbox lands first.
      setTimeout(closeListbox, 150);
    });
    $input.addEventListener('focus', function () {
      if ($input.value.trim() && $listbox.children.length > 0) {
        $listbox.setAttribute('data-open', 'true');
        $input.setAttribute('aria-expanded', 'true');
      }
    });

    // ── render results ──────────────────────────────────────────────
    function selectJob(jobId) {
      if (!jobId || isNaN(jobId)) return;
      Promise.all([loadSearchIndex(), loadPositions(), loadTreemap()]).then(function () {
        var pos = positionsData.positions[jobId];
        if (!pos) {
          $announce.textContent = 'データが見つかりませんでした';
          return;
        }
        currentJobId = jobId;
        closeListbox();
        $input.value = pos.nameJa;
        renderResults(pos);
        updateUrl(jobId);
        ga('me_select_job', { job_id: jobId, sector: pos.summary.sectorId });
      });
    }

    function renderResults(pos) {
      $empty.style.display = 'none';
      $results.setAttribute('data-visible', 'true');

      $summaryName.textContent = pos.nameJa;
      $summarySector.textContent = pos.summary.sectorJa || '';
      $statRisk.textContent = riskLabel(pos.summary.aiRisk);
      $statWorkers.textContent = fmtWorkers(pos.summary.workers);
      $statSalary.textContent = fmtSalary(pos.summary.salary);
      $statSector.textContent = pos.summary.sectorJa || '—';

      renderRankList(pos);
      renderSimilar(pos);
      resetQuizForJob();

      $announce.textContent = pos.nameJa + ' の全 39 ランキングを表示しました';
    }

    function readQuizCopy() {
      if (quizCopy) return quizCopy;
      if (!$quizCopy) return null;
      try {
        quizCopy = JSON.parse($quizCopy.textContent || '{}');
      } catch (err) {
        quizCopy = null;
      }
      return quizCopy;
    }

    function loadWorktypes() {
      if (worktypes) return Promise.resolve(worktypes);
      return fetchWithTimeout(WORKTYPES_URL, FETCH_TIMEOUT_MS).then(function (raw) {
        if (!raw || raw.schema_version !== '1.0' || !raw.variants) throw new Error('bad worktypes');
        worktypes = raw;
        return worktypes;
      });
    }

    function quizAnsweredCount() {
      var copy = readQuizCopy();
      if (!copy || !copy.questions || !$quizForm) return 0;
      var n = 0;
      for (var i = 0; i < copy.questions.length; i += 1) {
        if ($quizForm.querySelector('input[name="me-q' + i + '"]:checked')) n += 1;
      }
      return n;
    }

    function selectedQuizSide(index) {
      var checked = $quizForm && $quizForm.querySelector('input[name="me-q' + index + '"]:checked');
      return checked ? checked.value : null;
    }

    function bucketFromMachine(machineVariant) {
      if (!machineVariant || typeof machineVariant !== 'string') return 'balance';
      if (machineVariant.indexOf('-sweep') >= 0) return 'sweep';
      if (machineVariant.indexOf('-mixed') >= 0) return 'mixed';
      return 'balance';
    }

    function variantFromBucket(code, bucket) {
      var copy = readQuizCopy();
      var byBucket = copy && copy.variantBuckets && copy.variantBuckets[code];
      if (byBucket && byBucket[bucket]) return byBucket[bucket];
      return '';
    }

    function scoreQuizAnswers() {
      var copy = readQuizCopy();
      if (!copy || !copy.questions || !worktypes) return null;
      var counts = {
        A1: { C: 0, R: 0 },
        A2: { P: 0, D: 0 },
        A3: { B: 0, K: 0 }
      };
      for (var i = 0; i < copy.questions.length; i += 1) {
        var q = copy.questions[i];
        var side = selectedQuizSide(i);
        if (!side) return null;
        var pole = side === 'left' ? q.leftPole : q.rightPole;
        counts[q.axis][pole] += 1;
      }
      var code = '';
      var margins = [];
      for (var a = 0; a < AXES.length; a += 1) {
        var cfg = AXES[a];
        var leftCount = counts[cfg.key][cfg.leftPole];
        var winner = leftCount >= 2 ? cfg.leftPole : cfg.rightPole;
        var loser = winner === cfg.leftPole ? cfg.rightPole : cfg.leftPole;
        code += winner;
        margins.push(counts[cfg.key][winner] + '-' + counts[cfg.key][loser]);
      }
      var pattern = margins.join('/');
      var machineVariant = worktypes.variants[code] && worktypes.variants[code][pattern];
      var bucket = bucketFromMachine(machineVariant);
      return {
        code: code,
        pattern: pattern,
        bucket: bucket,
        variantId: variantFromBucket(code, bucket)
      };
    }

    function resetQuizForJob() {
      quizStarted = false;
      quizLastStep = 0;
      currentQuizResult = null;
      if ($quizForm) $quizForm.reset();
      if ($quizSubmit) $quizSubmit.disabled = true;
      if ($quiz) $quiz.hidden = true;
      if ($quizDone) $quizDone.hidden = true;
      if ($quizCta) $quizCta.hidden = false;
    }

    function openQuiz() {
      if (!$quiz || !$quizCta) return;
      $quizCta.hidden = true;
      $quiz.hidden = false;
      $quizDone.hidden = true;
      if (!quizStarted) {
        quizStarted = true;
        ga('shindan_start');
      }
      loadWorktypes().catch(function () {});
      $quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function onQuizChange() {
      var n = quizAnsweredCount();
      if ($quizSubmit) $quizSubmit.disabled = n !== 9;
      for (var s = quizLastStep + 1; s <= n; s += 1) {
        ga('shindan_step', { value: s });
      }
      if (n > quizLastStep) quizLastStep = n;
    }

    function submitQuiz(e) {
      e.preventDefault();
      loadWorktypes().then(function () {
        var result = scoreQuizAnswers();
        if (!result) return;
        currentQuizResult = result;
        if ($quiz) $quiz.hidden = true;
        if ($quizDone) $quizDone.hidden = false;
        updateUrl(currentJobId);
      });
    }

    function wireQuiz() {
      if ($quizOpen) $quizOpen.addEventListener('click', openQuiz);
      if ($quizForm) {
        $quizForm.addEventListener('change', onQuizChange);
        $quizForm.addEventListener('submit', submitQuiz);
      }
    }

    function renderRankList(pos) {
      $rankList.replaceChildren();
      var rankings = positionsData.rankings;
      // Sort: in-TOP first (asc by rank), then by outOfUniverse asc (圏外 included).
      var rows = rankings.map(function (r) {
        var fallbackUniverse = positionsData.meta && positionsData.meta.universe_size ? positionsData.meta.universe_size : 0;
        var p = pos.inRankings[r.slug] || { rank: null, total: 0, outOfUniverse: null, universeSize: fallbackUniverse, percentile: null };
        return { meta: r, pos: p };
      });
      rows.sort(function (a, b) {
        var ar = a.pos.rank, br = b.pos.rank;
        if (ar !== null && br === null) return -1;
        if (br !== null && ar === null) return 1;
        if (ar !== null && br !== null) return ar - br;
        var ao = a.pos.outOfUniverse == null ? 9999 : a.pos.outOfUniverse;
        var bo = b.pos.outOfUniverse == null ? 9999 : b.pos.outOfUniverse;
        return ao - bo;
      });

      var initial = rankExpanded ? rows.length : Math.min(INITIAL_RANKS_SHOWN, rows.length);
      for (var i = 0; i < initial; i++) {
        $rankList.appendChild(renderRankRow(rows[i]));
      }
      var rest = rows.length - initial;
      if (rest > 0) {
        $rankToggle.style.display = '';
        $rankToggle.setAttribute('aria-expanded', rankExpanded ? 'true' : 'false');
        renderToggleLabel(rankExpanded, rest);
      } else {
        $rankToggle.style.display = 'none';
      }
      // Keep rows reference so expand doesn't re-sort.
      $rankList.dataset.rendered = String(initial);
      $rankList._rows = rows;
    }

    function renderRankRow(row) {
      var li = document.createElement('li');
      if (row.pos.rank !== null) li.classList.add('in-top');
      var leftWrap = document.createElement('div');
      var a = document.createElement('a');
      a.href = '/rankings/' + row.meta.slug;
      a.textContent = row.meta.name_ja;
      var desc = document.createElement('div');
      desc.className = 'me-rank-desc';
      desc.textContent = row.meta.description_ja || '';
      leftWrap.appendChild(a);
      leftWrap.appendChild(desc);
      var posWrap = document.createElement('div');
      posWrap.className = 'me-rank-pos';
      if (row.pos.rank !== null) {
        var pill = document.createElement('span');
        pill.className = 'rank-top';
        pill.textContent = '第 ' + row.pos.rank + ' 位 / ' + row.pos.total;
        posWrap.appendChild(pill);
      } else {
        var out = document.createElement('span');
        out.className = 'rank-out';
        out.textContent = '圏外';
        posWrap.appendChild(out);
      }
      var detail = document.createElement('div');
      detail.className = 'rank-detail';
      if (row.pos.outOfUniverse !== null) {
        var universe = row.pos.universeSize;
        var rank = row.pos.outOfUniverse;
        var pct = row.pos.percentile;
        var universeLabel = row.meta.universe_scope === 'all' ? '全 ' : '対象 ';
        detail.textContent = universeLabel + universe + ' 中 ' + rank + ' 位 (上位 ' + pct + '%)';
      } else {
        detail.textContent = '対象外';
      }
      posWrap.appendChild(detail);
      li.appendChild(leftWrap);
      li.appendChild(posWrap);
      return li;
    }

    function renderToggleLabel(showCollapse, remaining) {
      // Rebuild the button content from scratch — text node + the
      // $rankRest <span> placeholder for the count. Avoids drift between
      // expand/collapse state and stale text nodes.
      $rankToggle.replaceChildren();
      if (showCollapse) {
        $rankToggle.appendChild(document.createTextNode('折りたたむ'));
      } else {
        $rankToggle.appendChild(document.createTextNode('残り '));
        $rankRest.textContent = String(remaining);
        $rankToggle.appendChild($rankRest);
        $rankToggle.appendChild(document.createTextNode(' 件を見る'));
      }
    }

    $rankToggle.addEventListener('click', function () {
      var rows = $rankList._rows;
      if (!rows) return;
      var alreadyShown = parseInt($rankList.dataset.rendered || '0', 10);
      if (alreadyShown >= rows.length) {
        // collapse back to initial
        rankExpanded = false;
        $rankList.replaceChildren();
        var n = Math.min(INITIAL_RANKS_SHOWN, rows.length);
        for (var i = 0; i < n; i++) $rankList.appendChild(renderRankRow(rows[i]));
        $rankList.dataset.rendered = String(n);
        $rankToggle.setAttribute('aria-expanded', 'false');
        renderToggleLabel(false, rows.length - n);
      } else {
        // expand to all
        rankExpanded = true;
        for (var j = alreadyShown; j < rows.length; j++) $rankList.appendChild(renderRankRow(rows[j]));
        $rankList.dataset.rendered = String(rows.length);
        $rankToggle.setAttribute('aria-expanded', 'true');
        renderToggleLabel(true, 0);
      }
    });

    function renderSimilar(pos) {
      $similar.replaceChildren();
      var sid = pos.summary.sectorId;
      var risk = pos.summary.aiRisk;
      if (sid == null || risk == null || !treemapData) {
        $similar.textContent = '類似職業データを取得できませんでした';
        return;
      }
      var candidates = [];
      for (var i = 0; i < treemapData.length; i++) {
        var r = treemapData[i];
        if (r.id === pos.jobId) continue;
        if (r.sector_id !== sid) continue;
        if (r.ai_risk == null) continue;
        if (Math.abs(r.ai_risk - risk) > 1) continue;
        candidates.push(r);
      }
      // Sort: closer AI risk first, then by workers desc.
      candidates.sort(function (a, b) {
        var da = Math.abs(a.ai_risk - risk);
        var db = Math.abs(b.ai_risk - risk);
        if (da !== db) return da - db;
        return (b.workers || 0) - (a.workers || 0);
      });
      var shown = candidates.slice(0, 5);
      if (!shown.length) {
        $similar.textContent = '同業種で AI 影響度が近い職業は見つかりませんでした。';
        return;
      }
      for (var k = 0; k < shown.length; k++) {
        var r2 = shown[k];
        var a = document.createElement('a');
        a.href = occupationPath(r2.id);
        var nm = document.createElement('span');
        nm.textContent = r2.name_ja;
        var meta = document.createElement('span');
        meta.className = 'me-similar-meta';
        var pill = document.createElement('span');
        pill.className = 'me-li-pill ' + (riskBand(r2.ai_risk) || 'mid');
        pill.textContent = 'AI ' + r2.ai_risk + '/10';
        var workers = document.createElement('span');
        workers.textContent = fmtWorkers(r2.workers);
        meta.appendChild(pill);
        meta.appendChild(workers);
        a.appendChild(nm);
        a.appendChild(meta);
        $similar.appendChild(a);
      }
    }

    // ── URL state ──────────────────────────────────────────────────
    function updateUrl(jobId) {
      var p = new URLSearchParams();
      if (jobId) p.set('id', String(jobId));
      if (currentQuizResult) {
        p.set('self', currentQuizResult.code);
        p.set('variant', currentQuizResult.variantId);
        p.set('axes', currentQuizResult.pattern);
      }
      var qs = p.toString();
      var newPath = location.pathname + (qs ? '?' + qs : '');
      if (newPath !== location.pathname + location.search) {
        history.replaceState(null, '', newPath);
      }
    }

    function readUrlId() {
      var p = new URLSearchParams(location.search);
      var s = p.get('id');
      if (!s) return null;
      var n = parseInt(s, 10);
      return isNaN(n) ? null : n;
    }

    // ── init ───────────────────────────────────────────────────────
    function init() {
      wireQuiz();
      var urlId = readUrlId();
      // Pre-load positions + search so first selection is instant.
      Promise.all([loadSearchIndex(), loadPositions(), loadTreemap()]).then(function () {
        if (urlId) selectJob(urlId);
        ga('me_open', { from_bookmark: urlId ? 1 : 0 });
      }).catch(function (err) {
        console.warn('[me] data load failed:', err);
        $empty.textContent = 'データの読み込みに失敗しました。再読み込みしてください。';
      });
    }

    if (typeof window !== 'undefined' && window.__ME_TEST_HOOKS__) {
      window.__ME_TEST_HOOKS__.scoreQuizAnswers = scoreQuizAnswers;
      window.__ME_TEST_HOOKS__.quizAnsweredCount = quizAnsweredCount;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
