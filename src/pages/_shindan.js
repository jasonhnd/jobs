
  (function () {
    'use strict';

    var WORKTYPES_URL = '/data.worktypes.json';
    var TREEMAP_URL = '/data.treemap.json';
    var SEARCH_URL = '/data.search.json';
    var TRANSFER_PATHS_URL = '/data.transfer_paths.json';
    var FETCH_TIMEOUT_MS = 10000;
    var LOCAL_KEY = 'shindan:lastResult:v1';
    var GAP_LOCAL_KEY = 'shindan:jobGap:v1';

    var AXES = [
      { key: 'A1', dataKey: 'a1', leftPole: 'C', rightPole: 'R', exposedPole: 'R', label: '創造 / 定型', leftLabel: '創造', rightLabel: '定型' },
      { key: 'A2', dataKey: 'a2', leftPole: 'P', rightPole: 'D', exposedPole: 'D', label: '人 / データ', leftLabel: '人', rightLabel: 'データ' },
      { key: 'A3', dataKey: 'a3', leftPole: 'B', rightPole: 'K', exposedPole: 'K', label: '身体 / 知識', leftLabel: '身体', rightLabel: '知識' }
    ];

    var FAMILY_COLORS = {
      CPB: '#D96B3D',
      CPK: '#8D6E63',
      CDB: '#D4A749',
      CDK: '#4E8FA8',
      RPB: '#6E9B89',
      RPK: '#B26D3D',
      RDB: '#5F8F6B',
      RDK: '#7A6F5E'
    };

    var $form = document.getElementById('shindanForm');
    var $submit = document.getElementById('shindanSubmit');
    var $status = document.getElementById('shindanStatus');
    var $progressFill = document.getElementById('shindanProgressFill');
    var $progressText = document.getElementById('shindanProgressText');
    var $result = document.getElementById('shindanResult');
    var $resultCard = document.getElementById('shindanResultCard');
    var $resultLabel = document.getElementById('shindanResultLabel');
    var $familyName = document.getElementById('shindanFamilyName');
    var $variantName = document.getElementById('shindanVariantName');
    var $resultCode = document.getElementById('shindanResultCode');
    var $identity = document.getElementById('shindanIdentity');
    var $variantCatch = document.getElementById('shindanVariantCatch');
    var $strengths = document.getElementById('shindanStrengths');
    var $aiRelation = document.getElementById('shindanAiRelation');
    var $nextStep = document.getElementById('shindanNextStep');
    var $axisList = document.getElementById('shindanAxisList');
    var $rarity = document.getElementById('shindanRarity');
    var $occupations = document.getElementById('shindanOccupations');
    var $gapSelfCode = document.getElementById('shindanGapSelfCode');
    var $gapForm = document.getElementById('shindanGapForm');
    var $jobInput = document.getElementById('shindanJobInput');
    var $jobListbox = document.getElementById('shindanJobListbox');
    var $jobAnnounce = document.getElementById('shindanJobAnnounce');
    var $gapResult = document.getElementById('shindanGapResult');
    var $gapJobName = document.getElementById('shindanGapJobName');
    var $gapJobMeta = document.getElementById('shindanGapJobMeta');
    var $gapBadge = document.getElementById('shindanGapBadge');
    var $gapCodes = document.getElementById('shindanGapCodes');
    var $gapMeterText = document.getElementById('shindanGapMeterText');
    var $gapMeterFill = document.getElementById('shindanGapMeterFill');
    var $gapReading = document.getElementById('shindanGapReading');
    var $gapAction = document.getElementById('shindanGapAction');
    var $gapDetailLink = document.getElementById('shindanGapDetailLink');
    var $gapTransfers = document.getElementById('shindanGapTransfers');
    var $shareHook = document.getElementById('shindanShareHook');
    var $shareX = document.getElementById('shindanShareX');
    var $shareLine = document.getElementById('shindanShareLine');
    var $shareNative = document.getElementById('shindanShareNative');
    var $shareCopy = document.getElementById('shindanShareCopy');
    var $shareToast = document.getElementById('shindanShareToast');
    var $ogLink = document.getElementById('shindanOgLink');
    var $retake = document.getElementById('shindanRetake');

    var copy = null;
    var worktypes = null;
    var treemap = null;
    var searchDocs = null;
    var searchById = {};
    var transferPaths = null;
    var dataReady = false;
    var currentResult = null;
    var focusedJobIdx = -1;
    var jobSearchDebounce = null;
    var jobSearchSeq = 0;

    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function fetchWithTimeout(url, ms) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () {
          if (done) return;
          done = true;
          reject(new Error('timeout'));
        }, ms);
        fetch(url)
          .then(function (res) {
            if (done) return null;
            done = true;
            clearTimeout(timer);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (json) {
            if (json !== null) resolve(json);
          })
          .catch(function (err) {
            if (!done) {
              done = true;
              clearTimeout(timer);
            }
            reject(err);
          });
      });
    }

    function readCopy() {
      var el = document.getElementById('shindanCopy');
      if (!el || !el.textContent) return null;
      try {
        return JSON.parse(el.textContent);
      } catch (err) {
        return null;
      }
    }

    function setStatus(text, isError) {
      if (!$status) return;
      $status.textContent = text || '';
      $status.className = isError ? 'shindan-status shindan-error' : 'shindan-status';
    }

    function answeredCount() {
      var count = 0;
      for (var i = 0; i < copy.questions.length; i += 1) {
        if (selectedSide(i)) count += 1;
      }
      return count;
    }

    function selectedSide(index) {
      var checked = $form.querySelector('input[name="shindan-q' + index + '"]:checked');
      return checked ? checked.value : null;
    }

    function updateProgress() {
      if (!copy) return;
      var count = answeredCount();
      var total = copy.questions.length;
      var pct = Math.round((count / total) * 100);
      if ($progressFill) $progressFill.style.width = pct + '%';
      if ($progressText) $progressText.textContent = count + ' / ' + total;
      if ($submit) $submit.disabled = !dataReady || count !== total;
      if (count === total && dataReady) {
        setStatus('結果を表示できます。');
      } else if (!dataReady) {
        setStatus('職業データを読み込んでいます。');
      } else {
        setStatus('9問すべてに答えると、結果を表示します。');
      }
    }

    function normalizeWorktypes(raw) {
      if (!raw || raw.schema_version !== '1.0') throw new Error('bad worktypes schema');
      if (!raw.thresholds || typeof raw.thresholds.a1 !== 'number') throw new Error('missing thresholds');
      if (!raw.families || !raw.variants || !raw.occupations) throw new Error('missing worktypes data');
      return raw;
    }

    function loadData() {
      return Promise.all([
        fetchWithTimeout(WORKTYPES_URL, FETCH_TIMEOUT_MS).then(normalizeWorktypes),
        fetchWithTimeout(TREEMAP_URL, FETCH_TIMEOUT_MS)
      ]).then(function (parts) {
        worktypes = parts[0];
        treemap = Array.isArray(parts[1]) ? parts[1] : [];
        dataReady = true;
        updateProgress();
      });
    }

    function loadSearchIndex() {
      if (searchDocs) return Promise.resolve(searchDocs);
      return fetchWithTimeout(SEARCH_URL, FETCH_TIMEOUT_MS).then(function (json) {
        searchDocs = json && Array.isArray(json.documents) ? json.documents : [];
        searchById = {};
        for (var i = 0; i < searchDocs.length; i += 1) {
          searchById[String(searchDocs[i].id)] = searchDocs[i];
        }
        return searchDocs;
      });
    }

    function loadTransferPaths() {
      if (transferPaths) return Promise.resolve(transferPaths);
      return fetchWithTimeout(TRANSFER_PATHS_URL, FETCH_TIMEOUT_MS).then(function (json) {
        transferPaths = json && json.paths ? json.paths : {};
        return transferPaths;
      }).catch(function () {
        transferPaths = {};
        return transferPaths;
      });
    }

    function riskBand(value) {
      if (value == null || isNaN(value)) return 'mid';
      if (value < 4.0) return 'low';
      if (value < 7.0) return 'mid';
      return 'high';
    }

    function scoreAnswers() {
      var counts = {
        A1: { C: 0, R: 0 },
        A2: { P: 0, D: 0 },
        A3: { B: 0, K: 0 }
      };

      for (var i = 0; i < copy.questions.length; i += 1) {
        var q = copy.questions[i];
        var side = selectedSide(i);
        if (!side) return null;
        var pole = side === 'left' ? q.leftPole : q.rightPole;
        counts[q.axis][pole] += 1;
      }

      var code = '';
      var margins = [];
      var axes = [];
      for (var a = 0; a < AXES.length; a += 1) {
        var cfg = AXES[a];
        var leftCount = counts[cfg.key][cfg.leftPole];
        var rightCount = counts[cfg.key][cfg.rightPole];
        var winner = leftCount >= 2 ? cfg.leftPole : cfg.rightPole;
        var loser = winner === cfg.leftPole ? cfg.rightPole : cfg.leftPole;
        var winCount = counts[cfg.key][winner];
        var loseCount = counts[cfg.key][loser];
        var margin = winCount + '-' + loseCount;
        var exposedCount = counts[cfg.key][cfg.exposedPole];
        code += winner;
        margins.push(margin);
        axes.push({
          key: cfg.key,
          label: cfg.label,
          leftLabel: cfg.leftLabel,
          rightLabel: cfg.rightLabel,
          leftPole: cfg.leftPole,
          rightPole: cfg.rightPole,
          exposedPole: cfg.exposedPole,
          exposedPct: Math.round((exposedCount / 3) * 100),
          winner: winner,
          loser: loser,
          winCount: winCount,
          loseCount: loseCount,
          margin: margin
        });
      }

      return resultFromCodePattern(code, margins.join('/'), axes);
    }

    function resultFromCodePattern(code, pattern, axes) {
      var machineVariant = worktypes.variants[code] && worktypes.variants[code][pattern];
      var bucket = bucketFromMachine(machineVariant);
      var variantId = variantFromBucket(code, bucket);
      return {
        code: code,
        pattern: pattern,
        machineVariant: machineVariant || '',
        bucket: bucket,
        variantId: variantId,
        axes: axes || axesFromCodePattern(code, pattern),
        savedAt: new Date().toISOString()
      };
    }

    function bucketFromMachine(machineVariant) {
      if (!machineVariant || typeof machineVariant !== 'string') return 'balance';
      if (machineVariant.indexOf('-sweep') >= 0) return 'sweep';
      if (machineVariant.indexOf('-mixed') >= 0) return 'mixed';
      return 'balance';
    }

    function variantFromBucket(code, bucket) {
      var byBucket = copy.variantBuckets && copy.variantBuckets[code];
      if (byBucket && byBucket[bucket]) return byBucket[bucket];
      var variants = copy.variants[code] || {};
      var keys = Object.keys(variants);
      return keys[0] || '';
    }

    function bucketForVariant(code, variantId) {
      var byBucket = copy.variantBuckets && copy.variantBuckets[code];
      if (!byBucket) return 'balance';
      for (var bucket in byBucket) {
        if (hasOwn(byBucket, bucket) && byBucket[bucket] === variantId) return bucket;
      }
      return 'balance';
    }

    function normalizeVariant(code, value) {
      if (!value) return null;
      var variants = copy.variants[code] || {};
      if (hasOwn(variants, value)) return value;
      if (value === 'balance' || value === 'mixed' || value === 'sweep') {
        return variantFromBucket(code, value);
      }
      var bucket = bucketFromMachine(value);
      return variantFromBucket(code, bucket);
    }

    function patternForBucket(bucket) {
      if (bucket === 'sweep') return '3-0/3-0/3-0';
      if (bucket === 'mixed') return '3-0/2-1/2-1';
      return '2-1/2-1/2-1';
    }

    function axesFromCodePattern(code, pattern) {
      var parts = pattern.split('/');
      var axes = [];
      for (var i = 0; i < AXES.length; i += 1) {
        var cfg = AXES[i];
        var winner = code.charAt(i);
        var loser = winner === cfg.leftPole ? cfg.rightPole : cfg.leftPole;
        var margin = parts[i] || '2-1';
        var nums = margin.split('-');
        var winCount = parseInt(nums[0], 10);
        var loseCount = parseInt(nums[1], 10);
        if (isNaN(winCount) || isNaN(loseCount)) {
          winCount = 2;
          loseCount = 1;
        }
        var exposedCount = winner === cfg.exposedPole ? winCount : loseCount;
        axes.push({
          key: cfg.key,
          label: cfg.label,
          leftLabel: cfg.leftLabel,
          rightLabel: cfg.rightLabel,
          leftPole: cfg.leftPole,
          rightPole: cfg.rightPole,
          exposedPole: cfg.exposedPole,
          exposedPct: Math.round((exposedCount / 3) * 100),
          winner: winner,
          loser: loser,
          winCount: winCount,
          loseCount: loseCount,
          margin: margin
        });
      }
      return axes;
    }

    function resultFromUrl() {
      var params = new URLSearchParams(location.search);
      if (!params.get('self') && location.hash && location.hash.indexOf('self=') >= 0) {
        params = new URLSearchParams(location.hash.replace(/^#\??/, ''));
      }
      var code = (params.get('self') || '').toUpperCase();
      if (!hasOwn(copy.families, code) || !hasOwn(worktypes.families, code)) return null;
      var variantId = normalizeVariant(code, params.get('variant'));
      if (!variantId) return null;
      var bucket = bucketForVariant(code, variantId);
      var pattern = patternForBucket(bucket);
      var machineVariant = worktypes.variants[code] && worktypes.variants[code][pattern] || '';
      return {
        code: code,
        pattern: pattern,
        machineVariant: machineVariant,
        bucket: bucket,
        variantId: variantId,
        axes: axesFromCodePattern(code, pattern),
        savedAt: ''
      };
    }

    function resultFromStorage() {
      try {
        var raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !hasOwn(copy.families, parsed.code)) return null;
        var variantId = normalizeVariant(parsed.code, parsed.variantId);
        if (!variantId) return null;
        var pattern = parsed.pattern || patternForBucket(bucketForVariant(parsed.code, variantId));
        return {
          code: parsed.code,
          pattern: pattern,
          machineVariant: parsed.machineVariant || '',
          bucket: parsed.bucket || bucketForVariant(parsed.code, variantId),
          variantId: variantId,
          axes: Array.isArray(parsed.axes) && parsed.axes.length === 3 ? parsed.axes : axesFromCodePattern(parsed.code, pattern),
          savedAt: parsed.savedAt || ''
        };
      } catch (err) {
        return null;
      }
    }

    function persistResult(result) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(result));
      } catch (err) {}
    }

    function updateUrl(result) {
      var url = new URL(location.href);
      url.searchParams.set('self', result.code);
      url.searchParams.set('variant', result.variantId);
      url.searchParams.delete('job');
      url.searchParams.delete('gap');
      var next = url.pathname + '?' + url.searchParams.toString();
      if (next !== location.pathname + location.search) {
        history.replaceState(null, '', next);
      }
    }

    function canonicalResultUrl(result) {
      var url = new URL(location.pathname, location.origin);
      url.searchParams.set('self', result.code);
      url.searchParams.set('variant', result.variantId);
      return url.toString();
    }

    function ogImageUrl(result) {
      var url = new URL('/api/og', location.origin);
      url.searchParams.set('worktype', result.code);
      url.searchParams.set('variant', result.variantId);
      url.searchParams.set('gap', 'aligned');
      return url.toString();
    }

    function updateShareMeta(result) {
      var image = ogImageUrl(result);
      var metas = [
        document.querySelector('meta[property="og:image"]'),
        document.querySelector('meta[name="twitter:image"]')
      ];
      metas.forEach(function (meta) {
        if (meta) meta.setAttribute('content', image);
      });
    }

    function renderResult(result, options) {
      currentResult = result;
      var family = copy.families[result.code];
      var variant = copy.variants[result.code] && copy.variants[result.code][result.variantId];
      var familyMeta = worktypes.families[result.code];
      if (!family || !variant || !familyMeta) return;

      var accent = FAMILY_COLORS[result.code] || '#D96B3D';
      if ($resultCard) {
        $resultCard.style.setProperty('--accent', accent);
        $resultCard.style.setProperty('--shindan-soft', colorAlpha(accent, 0.09));
        $resultCard.style.setProperty('--shindan-soft-strong', colorAlpha(accent, 0.16));
      }

      $result.hidden = false;
      $resultLabel.textContent = options && options.restored ? '前回のタイプ' : copy.labels.personalType;
      $familyName.textContent = family.name;
      $variantName.textContent = variant.name;
      $resultCode.textContent = result.code;
      $identity.textContent = family.identity;
      $variantCatch.textContent = variant.catch;
      $strengths.textContent = family.strengths;
      $aiRelation.textContent = family.aiRelation;
      $nextStep.textContent = family.empowerment;
      $rarity.textContent = rarityText(familyMeta.pct);

      renderAxes(result.axes);
      renderOccupations(result.code);
      resetGapResult();
      renderShare(result, variant);
      updateShareMeta(result);
      restoreGapForResult(result);
      if (!(options && options.skipScroll)) {
        $result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      track('shindan_result_view', {
        family_code: result.code,
        variant_id: result.variantId,
        variant_bucket: result.bucket
      });
    }

    function colorAlpha(hex, alpha) {
      var value = (hex || '').replace('#', '');
      if (value.length !== 6) return 'rgba(217,107,61,' + alpha + ')';
      var r = parseInt(value.slice(0, 2), 16);
      var g = parseInt(value.slice(2, 4), 16);
      var b = parseInt(value.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function rarityText(pct) {
      if (typeof pct !== 'number') return copy.rarity.pending;
      return copy.rarity.familyTemplate.replace('{割合}', pct.toFixed(1).replace(/\.0$/, ''));
    }

    function renderAxes(axes) {
      $axisList.replaceChildren();
      axes.forEach(function (axis) {
        var row = document.createElement('div');
        row.className = 'shindan-axis';

        var name = document.createElement('div');
        name.className = 'shindan-axis-name';
        name.textContent = axis.label;

        var meter = document.createElement('div');
        var poles = document.createElement('div');
        poles.className = 'shindan-axis-poles';
        var left = document.createElement('span');
        var right = document.createElement('span');
        left.textContent = axis.leftPole + ' ' + axis.leftLabel;
        right.textContent = axis.rightPole + ' ' + axis.rightLabel;
        poles.appendChild(left);
        poles.appendChild(right);
        var trackEl = document.createElement('div');
        trackEl.className = 'shindan-axis-track';
        trackEl.setAttribute('aria-label', axis.exposedPole + ' 方向 ' + axis.exposedPct + '%');
        var fill = document.createElement('span');
        fill.className = 'shindan-axis-fill';
        fill.style.width = axis.exposedPct + '%';
        trackEl.appendChild(fill);
        meter.appendChild(poles);
        meter.appendChild(trackEl);

        var margin = document.createElement('div');
        margin.className = 'shindan-axis-margin';
        margin.textContent = axis.winner + ' ' + axis.winCount + ' - ' + axis.loser + ' ' + axis.loseCount;

        row.appendChild(name);
        row.appendChild(meter);
        row.appendChild(margin);
        $axisList.appendChild(row);
      });
    }

    function renderOccupations(code) {
      $occupations.replaceChildren();
      var rows = [];
      for (var i = 0; i < treemap.length; i += 1) {
        var item = treemap[i];
        var record = worktypes.occupations[String(item.id)];
        if (!record || record.code !== code) continue;
        rows.push(item);
      }
      rows.sort(function (a, b) {
        return (b.workers || 0) - (a.workers || 0) || String(a.name_ja || '').localeCompare(String(b.name_ja || ''), 'ja');
      });
      rows.slice(0, 6).forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '/' + item.id;
        var name = document.createElement('span');
        name.textContent = item.name_ja || ('職業 ' + item.id);
        var meta = document.createElement('small');
        meta.textContent = '就業者数 ' + formatWorkers(item.workers);
        a.appendChild(name);
        a.appendChild(meta);
        li.appendChild(a);
        $occupations.appendChild(li);
      });
      if ($occupations.children.length === 0) {
        var empty = document.createElement('li');
        empty.textContent = '代表職業データを読み込めませんでした。';
        $occupations.appendChild(empty);
      }
    }

    function rankMatches(q) {
      q = String(q || '').trim().toLowerCase();
      if (!q || !searchDocs) return [];
      var exact = [];
      var starts = [];
      var contains = [];
      for (var i = 0; i < searchDocs.length; i += 1) {
        var d = searchDocs[i];
        var hay = String(d.title_ja || '').toLowerCase();
        var aliases = Array.isArray(d.aliases_ja) ? d.aliases_ja : [];
        var all = [hay];
        for (var a = 0; a < aliases.length; a += 1) {
          all.push(String(aliases[a] || '').toLowerCase());
        }
        var hit = false;
        var isExact = false;
        var isStart = false;
        for (var k = 0; k < all.length; k += 1) {
          var field = all[k];
          if (field === q) {
            isExact = true;
            hit = true;
            break;
          }
          if (field.indexOf(q) === 0) {
            isStart = true;
            hit = true;
          } else if (field.indexOf(q) >= 0) {
            hit = true;
          }
        }
        if (!hit) continue;
        if (isExact) exact.push(d);
        else if (isStart) starts.push(d);
        else contains.push(d);
      }
      var lenAsc = function (a, b) {
        return String(a.title_ja || '').length - String(b.title_ja || '').length;
      };
      return exact.concat(starts.sort(lenAsc), contains.sort(lenAsc)).slice(0, 8);
    }

    function closeJobListbox() {
      if (!$jobListbox || !$jobInput) return;
      $jobListbox.setAttribute('data-open', 'false');
      $jobInput.setAttribute('aria-expanded', 'false');
      $jobInput.removeAttribute('aria-activedescendant');
      focusedJobIdx = -1;
    }

    function updateFocusedJobRow() {
      if (!$jobListbox || !$jobInput) return;
      var items = $jobListbox.querySelectorAll('li');
      items.forEach(function (li, index) {
        if (index === focusedJobIdx) {
          li.classList.add('focused');
          li.setAttribute('aria-selected', 'true');
          $jobInput.setAttribute('aria-activedescendant', li.id);
        } else {
          li.classList.remove('focused');
          li.setAttribute('aria-selected', 'false');
        }
      });
      if (focusedJobIdx < 0) {
        $jobInput.removeAttribute('aria-activedescendant');
      }
    }

    function renderJobSuggest(matches) {
      if (!$jobListbox || !$jobInput) return;
      $jobListbox.replaceChildren();
      if (!matches.length) {
        closeJobListbox();
        if ($jobAnnounce) $jobAnnounce.textContent = '候補なし';
        return;
      }
      matches.forEach(function (doc) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = 'shindanJobOpt-' + doc.id;
        li.dataset.id = String(doc.id);

        var text = document.createElement('div');
        var name = document.createElement('span');
        name.className = 'shindan-job-name';
        name.textContent = doc.title_ja || ('職業 ' + doc.id);
        var sector = document.createElement('div');
        sector.className = 'shindan-job-sector';
        var record = worktypes && worktypes.occupations ? worktypes.occupations[String(doc.id)] : null;
        sector.textContent = record ? '職業タイプ ' + record.code : '';
        text.appendChild(name);
        text.appendChild(sector);

        var pill = document.createElement('span');
        pill.className = 'shindan-job-pill ' + riskBand(doc.ai_risk);
        pill.textContent = 'AI ' + (doc.ai_risk != null ? doc.ai_risk : '?') + '/10';

        li.appendChild(text);
        li.appendChild(pill);
        $jobListbox.appendChild(li);
      });
      $jobListbox.setAttribute('data-open', 'true');
      $jobInput.setAttribute('aria-expanded', 'true');
      focusedJobIdx = 0;
      updateFocusedJobRow();
      if ($jobAnnounce) $jobAnnounce.textContent = matches.length + ' 件の結果';
    }

    function computeGap(selfCode, jobCode) {
      var matches = 0;
      var underusedSelfPole = false;
      var mismatchLabels = [];
      for (var i = 0; i < AXES.length; i += 1) {
        var axis = AXES[i];
        var selfPole = selfCode.charAt(i);
        var jobPole = jobCode.charAt(i);
        if (selfPole === jobPole) {
          matches += 1;
        } else {
          mismatchLabels.push(axis.label);
          if (selfPole === axis.leftPole) underusedSelfPole = true;
        }
      }

      var kind = 'hidden_risk';
      if (matches >= 2) {
        kind = 'aligned';
      } else if (underusedSelfPole) {
        kind = 'hidden_strength';
      }

      return {
        kind: kind,
        matches: matches,
        gapAxes: 3 - matches,
        mismatchLabels: mismatchLabels
      };
    }

    function gapFromStorage(selfCode) {
      try {
        var raw = localStorage.getItem(GAP_LOCAL_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.selfCode !== selfCode || !parsed.jobId) return null;
        return parseInt(parsed.jobId, 10);
      } catch (err) {
        return null;
      }
    }

    function persistGap(gap) {
      try {
        localStorage.setItem(GAP_LOCAL_KEY, JSON.stringify({
          selfCode: gap.selfCode,
          jobId: gap.jobId,
          gap: gap.kind,
          savedAt: new Date().toISOString()
        }));
      } catch (err) {}
    }

    function formatRisk(value) {
      if (value == null || isNaN(value)) return '不明';
      return value + '/10';
    }

    function jobTitle(doc, jobId) {
      return doc && doc.title_ja ? doc.title_ja : '職業 ' + jobId;
    }

    function resetGapResult() {
      if ($gapSelfCode && currentResult) $gapSelfCode.textContent = currentResult.code;
      if ($gapResult) $gapResult.hidden = true;
      if ($gapTransfers) $gapTransfers.replaceChildren();
      if ($jobInput) $jobInput.value = '';
      if ($jobAnnounce) $jobAnnounce.textContent = '';
      closeJobListbox();
    }

    function renderTransferCandidates(jobId) {
      if (!$gapTransfers) return;
      $gapTransfers.replaceChildren();
      var entry = transferPaths && transferPaths[String(jobId)];
      var candidates = entry && Array.isArray(entry.candidates) ? entry.candidates : [];
      if (!candidates.length) {
        var empty = document.createElement('span');
        empty.className = 'shindan-transfer-empty';
        empty.textContent = '近い職業データを読み込めませんでした。';
        $gapTransfers.appendChild(empty);
        return;
      }
      candidates.slice(0, 5).forEach(function (candidate) {
        var id = String(candidate.id);
        var doc = searchById[id];
        var a = document.createElement('a');
        a.href = '/' + id;
        var name = document.createElement('span');
        name.textContent = candidate.title_ja || jobTitle(doc, id);
        var meta = document.createElement('small');
        meta.textContent = 'AI ' + formatRisk(candidate.ai_risk);
        a.appendChild(name);
        a.appendChild(meta);
        $gapTransfers.appendChild(a);
      });
    }

    function renderGap(gap, doc, record) {
      var gapCopy = copy.gap && copy.gap[gap.kind] ? copy.gap[gap.kind] : {
        label: gap.kind,
        reading: '',
        action: ''
      };
      var meterPct = Math.round((gap.gapAxes / 3) * 100);
      var meta = [
        (copy.labels && copy.labels.occupationType ? copy.labels.occupationType : 'この職業のタイプ') + ' ' + record.code,
        'AI 影響度 ' + formatRisk(doc.ai_risk),
        'AIに渡しやすい軸 ' + record.exposure + '/3'
      ];

      if ($gapResult) {
        $gapResult.hidden = false;
        $gapResult.dataset.gap = gap.kind;
      }
      if ($gapJobName) $gapJobName.textContent = jobTitle(doc, gap.jobId);
      if ($gapJobMeta) $gapJobMeta.textContent = meta.join(' / ');
      if ($gapBadge) $gapBadge.textContent = gapCopy.label;
      if ($gapCodes) $gapCodes.textContent = gap.selfCode + ' -> ' + gap.jobCode;
      if ($gapMeterText) $gapMeterText.textContent = 'ギャップ ' + gap.gapAxes + '/3軸';
      if ($gapMeterFill) $gapMeterFill.style.width = meterPct + '%';
      if ($gapReading) $gapReading.textContent = gapCopy.reading;
      if ($gapAction) $gapAction.textContent = gapCopy.action;
      if ($gapDetailLink) $gapDetailLink.href = '/' + gap.jobId;
      renderTransferCandidates(gap.jobId);
      if ($jobAnnounce) {
        $jobAnnounce.textContent = jobTitle(doc, gap.jobId) + ' とのギャップを表示しました';
      }
    }

    function updateGapUrl(gap) {
      if (!currentResult) return;
      var url = new URL(location.href);
      url.searchParams.set('self', currentResult.code);
      url.searchParams.set('variant', currentResult.variantId);
      url.searchParams.set('job', String(gap.jobId));
      url.searchParams.set('gap', gap.kind);
      var next = url.pathname + '?' + url.searchParams.toString();
      if (next !== location.pathname + location.search) {
        history.replaceState(null, '', next);
      }
    }

    function selectGapJob(jobId, options) {
      if (!currentResult || !worktypes || !jobId || isNaN(jobId)) return;
      Promise.all([loadSearchIndex(), loadTransferPaths()]).then(function () {
        var id = String(jobId);
        var doc = searchById[id];
        var record = worktypes.occupations[id];
        if (!doc || !record || !record.code) {
          if ($jobAnnounce) $jobAnnounce.textContent = '職業タイプを読み込めませんでした';
          return;
        }
        var computed = computeGap(currentResult.code, record.code);
        var gap = {
          selfCode: currentResult.code,
          jobId: id,
          jobCode: record.code,
          kind: computed.kind,
          matches: computed.matches,
          gapAxes: computed.gapAxes,
          mismatchLabels: computed.mismatchLabels
        };
        closeJobListbox();
        if ($jobInput) $jobInput.value = jobTitle(doc, id);
        renderGap(gap, doc, record);
        persistGap(gap);
        if (!(options && options.restored) || options.updateUrl) {
          updateGapUrl(gap);
        }
        if (!(options && options.restored)) {
          track('shindan_gap_select_job', {
            family_code: gap.selfCode,
            job_id: parseInt(id, 10),
            job_code: gap.jobCode,
            gap: gap.kind
          });
        }
      }).catch(function () {
        if ($jobAnnounce) $jobAnnounce.textContent = '職業データの読み込みに失敗しました';
      });
    }

    function readUrlJobId() {
      var params = new URLSearchParams(location.search);
      var raw = params.get('job') || params.get('id');
      if (!raw) return null;
      var id = parseInt(raw, 10);
      return isNaN(id) ? null : id;
    }

    function restoreGapForResult(result) {
      var urlJobId = readUrlJobId();
      if (urlJobId) {
        selectGapJob(urlJobId, { restored: true, updateUrl: true });
        return;
      }
      var storedJobId = gapFromStorage(result.code);
      if (!storedJobId) return;
      selectGapJob(storedJobId, { restored: true });
    }

    function formatWorkers(value) {
      if (value == null || isNaN(value)) return '不明';
      if (value >= 10000) {
        var man = value / 10000;
        return (man >= 10 ? man.toFixed(0) : man.toFixed(1).replace(/\.0$/, '')) + '万人';
      }
      return Math.round(value).toLocaleString('ja-JP') + '人';
    }

    function renderShare(result, variant) {
      var resultUrl = canonicalResultUrl(result);
      var hook = challengeHook(result.code, result.variantId);
      var template = copy.share.textTemplate || '#AI働き方診断 私は【{タイプ名}】でした！ {リンク}';
      var shareText = template
        .replace('{タイプ名}', variant.name)
        .replace('{リンク}', resultUrl);
      var xUrl = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText);
      var lineUrl = 'https://line.me/R/msg/text/?' + encodeURIComponent(shareText);
      var imageUrl = ogImageUrl(result);

      $shareHook.textContent = hook;
      $shareX.href = xUrl;
      $shareLine.href = lineUrl;
      $ogLink.href = imageUrl;
      $ogLink.textContent = 'カード画像を開く';

      if (typeof navigator.share === 'function') {
        $shareNative.hidden = false;
      } else {
        $shareNative.hidden = true;
      }
    }

    function challengeHook(code, variantId) {
      var hooks = copy.share.challengeHooks || ['あなたの同僚は何タイプ?'];
      var index = (code.charCodeAt(0) + variantId.length) % hooks.length;
      return hooks[index] || hooks[0];
    }

    function copyResultLink() {
      if (!currentResult) return;
      var url = canonicalResultUrl(currentResult);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          toast('コピーしました');
        }).catch(function () {
          toast(url);
        });
      } else {
        toast(url);
      }
      track('shindan_share_click', { platform: 'copy', family_code: currentResult.code, variant_id: currentResult.variantId });
    }

    function nativeShare() {
      if (!currentResult || typeof navigator.share !== 'function') return;
      var variant = copy.variants[currentResult.code][currentResult.variantId];
      var text = (copy.share.textTemplate || '#AI働き方診断 私は【{タイプ名}】でした！ {リンク}')
        .replace('{タイプ名}', variant.name)
        .replace(' {リンク}', '');
      navigator.share({
        title: copy.labels.featureName,
        text: text,
        url: canonicalResultUrl(currentResult)
      }).then(function () {
        track('shindan_share_click', { platform: 'native', family_code: currentResult.code, variant_id: currentResult.variantId });
      }).catch(function () {});
    }

    function toast(text) {
      $shareToast.textContent = text;
      $shareToast.classList.add('visible');
      setTimeout(function () {
        $shareToast.classList.remove('visible');
      }, 2200);
    }

    function track(name, params) {
      try {
        if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      } catch (err) {}
    }

    function handleSubmit(e) {
      e.preventDefault();
      if (!dataReady) return;
      var result = scoreAnswers();
      if (!result) {
        setStatus('未回答の設問があります。', true);
        return;
      }
      persistResult(result);
      updateUrl(result);
      renderResult(result);
    }

    function wireGapEvents() {
      if (!$gapForm || !$jobInput || !$jobListbox) return;

      $jobInput.addEventListener('input', function () {
        if (jobSearchDebounce) clearTimeout(jobSearchDebounce);
        var q = $jobInput.value;
        if (!q.trim()) {
          jobSearchSeq += 1;
          closeJobListbox();
          if ($jobAnnounce) $jobAnnounce.textContent = '';
          return;
        }
        var seq = ++jobSearchSeq;
        jobSearchDebounce = setTimeout(function () {
          loadSearchIndex().then(function () {
            if (seq !== jobSearchSeq) return;
            renderJobSuggest(rankMatches($jobInput.value));
          }).catch(function () {
            if ($jobAnnounce) $jobAnnounce.textContent = '検索データの読み込みに失敗しました';
          });
        }, 80);
      });

      $jobInput.addEventListener('keydown', function (e) {
        var items = $jobListbox.querySelectorAll('li');
        if (e.key === 'ArrowDown') {
          if (!items.length) {
            if ($jobInput.value.trim()) {
              loadSearchIndex().then(function () {
                renderJobSuggest(rankMatches($jobInput.value));
              });
            }
            e.preventDefault();
            return;
          }
          e.preventDefault();
          focusedJobIdx = (focusedJobIdx + 1) % items.length;
          updateFocusedJobRow();
        } else if (e.key === 'ArrowUp') {
          if (!items.length) return;
          e.preventDefault();
          focusedJobIdx = (focusedJobIdx - 1 + items.length) % items.length;
          updateFocusedJobRow();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items.length && focusedJobIdx >= 0) {
            var selected = items[focusedJobIdx];
            if (selected) selectGapJob(parseInt(selected.dataset.id, 10));
          }
        } else if (e.key === 'Escape') {
          closeJobListbox();
        }
      });

      $gapForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var items = $jobListbox.querySelectorAll('li');
        var pick = items[focusedJobIdx >= 0 ? focusedJobIdx : 0];
        if (pick) selectGapJob(parseInt(pick.dataset.id, 10));
      });

      $jobListbox.addEventListener('click', function (e) {
        var li = e.target.closest('li[data-id]');
        if (!li) return;
        selectGapJob(parseInt(li.dataset.id, 10));
      });

      $jobInput.addEventListener('blur', function () {
        setTimeout(closeJobListbox, 150);
      });
      $jobInput.addEventListener('focus', function () {
        if ($jobInput.value.trim() && $jobListbox.children.length > 0) {
          $jobListbox.setAttribute('data-open', 'true');
          $jobInput.setAttribute('aria-expanded', 'true');
        }
      });
    }

    function wireEvents() {
      $form.addEventListener('change', updateProgress);
      $form.addEventListener('reset', function () {
        setTimeout(updateProgress, 0);
      });
      $form.addEventListener('submit', handleSubmit);
      wireGapEvents();
      $shareCopy.addEventListener('click', function (e) {
        e.preventDefault();
        copyResultLink();
      });
      $shareNative.addEventListener('click', function (e) {
        e.preventDefault();
        nativeShare();
      });
      $shareX.addEventListener('click', function () {
        if (currentResult) track('shindan_share_click', { platform: 'x', family_code: currentResult.code, variant_id: currentResult.variantId });
      });
      $shareLine.addEventListener('click', function () {
        if (currentResult) track('shindan_share_click', { platform: 'line', family_code: currentResult.code, variant_id: currentResult.variantId });
      });
      $retake.addEventListener('click', function () {
        $form.reset();
        updateProgress();
        document.getElementById('shindanQuiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function init() {
      if (!$form || !$result) return;
      copy = readCopy();
      if (!copy || !copy.questions || !copy.families || !copy.variants) {
        setStatus('診断コピーを読み込めませんでした。', true);
        return;
      }
      wireEvents();
      updateProgress();
      loadData().then(function () {
        var fromUrl = resultFromUrl();
        if (fromUrl) {
          renderResult(fromUrl, { skipScroll: true });
          return;
        }
        var fromStorage = resultFromStorage();
        if (fromStorage) {
          renderResult(fromStorage, { restored: true, skipScroll: true });
        }
      }).catch(function () {
        setStatus('データの読み込みに失敗しました。時間をおいて再読み込みしてください。', true);
        if ($submit) $submit.disabled = true;
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
