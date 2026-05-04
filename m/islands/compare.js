// compare.js — vanilla JS island for ⑥ 比較.
// Reads ?a=<id>&b=<id> URL params; fetches /data.detail/<padded>.json + /data.profile5.json.
(function () {
  var lang = window.M_LANG || 'ja';
  var root = document.querySelector('[data-island="compare"]');
  if (!root) return;
  var hint = document.querySelector('[data-role="hint"]');

  function pad(n) { return String(n).padStart(4, '0'); }
  function bandClass(score) {
    if (score == null) return '';
    if (score <= 3.9) return 'm-risk-low';
    if (score <= 6.9) return 'm-risk-mid';
    return 'm-risk-high';
  }
  function fmtSalary(v) {
    if (v == null) return '–';
    return lang === 'ja' ? '¥' + v.toFixed(0) + '万' : '¥' + (v / 100).toFixed(2) + 'M';
  }
  function fmtWorkers(v) {
    if (v == null) return '–';
    return lang === 'ja' ? (v / 10000).toFixed(0) + '万人' : (v / 1000).toFixed(0) + 'k';
  }

  function fillSide(side, detail, profile) {
    var nameEl = document.querySelector('[data-role="picker-name-' + side + '"]');
    if (nameEl) {
      nameEl.textContent = lang === 'en' && detail.title.en ? detail.title.en : detail.title.ja;
    }
    var stats = detail.stats || {};
    var risk = detail.ai_risk ? detail.ai_risk.score : null;
    var rows = {
      ai_score:  risk != null ? '<span class="' + bandClass(risk) + '" style="padding:2px 8px;border-radius:999px;">' + risk + '</span>' : '–',
      salary:    fmtSalary(stats.salary_man_yen),
      workforce: fmtWorkers(stats.workers),
      ratio:     stats.recruit_ratio != null ? stats.recruit_ratio.toFixed(2) : '–',
    };
    Object.keys(rows).forEach(function (k) {
      var td = root.querySelector('td[data-side="' + side + '"][data-row="' + k + '"]');
      if (td) td.innerHTML = rows[k];
    });
    if (profile) {
      ['creative', 'social', 'judgment', 'physical', 'routine'].forEach(function (axis) {
        var v = profile[axis];
        var td = root.querySelector('td[data-side="' + side + '"][data-axis="' + axis + '"]');
        if (td) td.textContent = v != null ? v.toFixed(0) : '–';
      });
    }
  }

  var params = new URLSearchParams(location.search);
  var a = params.get('a');
  var b = params.get('b');
  if (!a || !b) return;  // hint visible by default

  if (hint) hint.style.display = 'none';

  Promise.all([
    fetch('/data.detail/' + pad(a) + '.json').then(function (r) { return r.json(); }),
    fetch('/data.detail/' + pad(b) + '.json').then(function (r) { return r.json(); }),
    fetch('/data.profile5.json').then(function (r) { return r.json(); }),
  ]).then(function (vals) {
    var detailA = vals[0], detailB = vals[1], p5 = vals[2].profiles;
    fillSide('a', detailA, p5[String(a)]);
    fillSide('b', detailB, p5[String(b)]);
  }).catch(function (e) {
    console.error('compare island error', e);
    if (hint) {
      hint.style.display = 'block';
      hint.textContent = 'データ取得エラー';
    }
  });
})();
