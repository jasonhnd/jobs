/**
 * src/lib/canonical/doc.ts — 共通「ドキュメント class」の CSS + 小ヘルパー。
 *
 * 範囲: /standard・/methodology・/about の 3 リファレンス文書ページ。
 * これまで 3 ページが別々の page-local CSS を持ち、横幅・カード・配色が
 * 微妙にズレていた（about は 760px + theme toggle、他は 1080px）。本モジュールで
 * 単一のビジュアル言語に統一する（Design.md §6.5 の Static class を文書向けに拡張）。
 *
 * すべて CSS / inline-SVG のみ。インライン JS なし（CSP ハッシュ追加なし）。
 * トークン（:root）は canonical-css.ts に一元化済みのため、ここでは var() 参照のみ。
 *
 * EMFO の段階配色（▲ 影響を強める / ■ 人間の強み / ◐ 調整）は第 3 層 --risk-*
 * スケールと語義色を流用し、全文書ページで一貫させる。
 */

/** EMFO 段階の向き。ヒートセル・カードの色分けに使う。 */
export type DimDir = 'up' | 'moat' | 'friction';

/**
 * 0–10 の値を 5 バンド（0=最弱 … 4=最強）に量子化。
 */
function band(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value >= 8) return 4;
  if (value >= 6) return 3;
  if (value >= 4) return 2;
  if (value >= 2) return 1;
  return 0;
}

/**
 * 採点例テーブルのセル背景。向きを考慮して着色する（生値の高低ではなく、
 * 「働く人にとっての意味」で色を決める）:
 *   - up   ▲ 影響を強める  : 高いほど影響大 → 赤側
 *   - moat ■ 人間の強み    : 高いほど守られる → 緑側（反転）
 *   - friction ◐ 調整      : 中立の砂色トーンで、赤緑の判断を主張しない
 * soft トークン（--risk-soft-0..4）を返す。
 */
export function heatBg(value: number, dir: DimDir): string {
  if (dir === 'friction') {
    // 中立: 値の大きさだけを砂色の濃淡で示す（向きの主張をしない）。
    const b = band(value);
    return `color-mix(in oklab, var(--risk-soft-2) ${30 + b * 16}%, var(--paper))`;
  }
  const b = dir === 'moat' ? (4 - band(value)) : band(value);
  return `var(--risk-soft-${b})`;
}

/**
 * レーダー多角形の points 文字列を返す。N 軸を時計回り（真上始点）に配置し、
 * 各値 v∈[0,10] を半径 r = R·v/10 に写す。インライン SVG にそのまま差し込む。
 */
export function radarPoints(values: ReadonlyArray<number>, cx: number, cy: number, R: number): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (R * Math.max(0, Math.min(10, v))) / 10;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** レーダー軸線の端点（cx,cy → 外周）を返す。 */
export function radarAxis(i: number, n: number, cx: number, cy: number, R: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
}

export const CANONICAL_DOC_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;line-height:1.75}

/* ── Layout: single content column, aligns with nav + footer edge ── */
#wrapper{max-width:var(--content-max);margin:0 auto;padding:28px 28px 88px}
.doc-prose{max-width:74ch}

/* ── Breadcrumb ── */
nav.crumb{font-size:.85rem;color:var(--fg2);margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid var(--border)}
nav.crumb a{color:var(--fg2);text-decoration:none}
nav.crumb a:hover{color:var(--accent);text-decoration:underline}
nav.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}

/* ── Header ── */
h1{font-family:var(--font-serif);font-size:clamp(1.7rem,1rem + 2.4vw,2.2rem);font-weight:700;line-height:1.25;letter-spacing:-.01em;color:var(--fg);margin-bottom:8px}
h1 .accent{color:var(--accent);font-style:italic}
.subtitle{color:var(--fg2);font-size:.95rem;margin-bottom:8px;max-width:74ch}
.meta-line{display:inline-flex;align-items:center;gap:8px;color:var(--ink-meta);font-size:.76rem;margin-bottom:28px;padding:4px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:999px;font-variant-numeric:tabular-nums}

/* ── Lead ── */
.lead{font-size:1.05rem;line-height:1.8;color:var(--fg);max-width:74ch;margin-bottom:8px}

/* ── Sections ── */
h2{font-family:var(--font-serif);font-size:1.2rem;font-weight:600;line-height:1.4;color:var(--fg);margin:48px 0 14px;padding-left:13px;border-left:3px solid var(--accent)}
h2 .num{color:var(--accent);font-variant-numeric:tabular-nums;margin-right:6px}
h3{font-family:var(--font-serif);font-size:1rem;font-weight:600;color:var(--fg);margin:22px 0 6px}
p{margin:0 0 14px;line-height:1.8;color:var(--fg);max-width:74ch}
ul,ol{margin:0 0 14px 22px;max-width:74ch}
li{margin-bottom:7px;line-height:1.7}
strong{color:var(--fg);font-weight:600}
em{color:var(--fg2);font-style:italic}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.84em;background:var(--bg2);padding:1px 6px;border-radius:4px;color:var(--accent);border:1px solid var(--border)}

/* ── Direction legend (▲ ■ ◐) ── */
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 18px}
.chip{display:inline-flex;align-items:center;gap:7px;font-size:.8rem;font-weight:500;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:var(--bg2);color:var(--fg)}
.chip .gly{font-size:.78rem;line-height:1}
.chip-up{border-color:rgba(226,122,51,.4)}.chip-up .gly{color:var(--risk-3)}
.chip-moat{border-color:rgba(72,112,95,.4)}.chip-moat .gly{color:var(--green-deep)}
.chip-friction{border-color:rgba(217,160,59,.45)}.chip-friction .gly{color:var(--risk-2)}

/* ── EMFO funnel ── */
.emfo{display:flex;align-items:stretch;gap:0;margin:10px 0 22px;flex-wrap:nowrap}
.emfo .stage{flex:1 1 0;background:var(--bg2);border:1px solid var(--border);border-top:3px solid var(--accent);border-radius:10px;padding:13px 15px;position:relative;min-width:0}
.emfo .stage.s1{border-top-color:var(--risk-3)}
.emfo .stage.s2{border-top-color:var(--green-deep)}
.emfo .stage.s3{border-top-color:var(--risk-2)}
.emfo .stage.s4{border-top-color:var(--risk-4)}
.emfo .stage + .stage{margin-left:18px}
.emfo .stage + .stage::before{content:"";position:absolute;left:-15px;top:50%;width:9px;height:9px;border-top:2px solid var(--fg3);border-right:2px solid var(--fg3);transform:translateY(-50%) rotate(45deg)}
.emfo .n{font-size:.7rem;letter-spacing:.06em;color:var(--fg2);font-weight:600}
.emfo .en{font-family:var(--font-serif);font-weight:600;font-size:.98rem;margin:3px 0 3px;color:var(--fg)}
.emfo .d{font-size:.8rem;color:var(--fg2);line-height:1.55}
@media(max-width:680px){
  .emfo{flex-direction:column}
  .emfo .stage + .stage{margin-left:0;margin-top:18px}
  .emfo .stage + .stage::before{left:50%;top:-15px;transform:translate(-50%,0) rotate(135deg)}
}

/* ── Dimension cards ── */
.dim{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:9px;padding:14px 18px;margin:10px 0}
.dim.up{border-left-color:var(--risk-3)}
.dim.moat{border-left-color:var(--green-deep)}
.dim.friction{border-left-color:var(--risk-2)}
.dim .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:4px}
.dim .code{font-weight:700;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}
.dim.up .code{color:var(--risk-3)}.dim.moat .code{color:var(--green-deep)}.dim.friction .code{color:var(--risk-2)}
.dim .name{font-weight:600;font-size:1.02rem;color:var(--fg)}
.dim .name .en{font-size:.78rem;color:var(--fg3);font-family:var(--font-serif);font-weight:500;margin-left:7px;font-style:italic}
.dim .stage-tag{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:.72rem;color:var(--fg2);border:1px solid var(--border);border-radius:999px;padding:2px 10px;white-space:nowrap}
.dim.up .stage-tag .gly{color:var(--risk-3)}.dim.moat .stage-tag .gly{color:var(--green-deep)}.dim.friction .stage-tag .gly{color:var(--risk-2)}
.dim .body{font-size:.92rem;color:var(--fg);line-height:1.7;max-width:none}

/* ── Formula / spec card ── */
.formula{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);border-radius:9px;padding:14px 18px;margin:10px 0 18px}
.formula .flabel{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);font-weight:600;margin-bottom:8px}
.formula .row{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem;line-height:1.9;color:var(--fg);overflow-x:auto}
.formula .k{color:var(--accent);font-weight:600}

/* ── Example heat table ── */
.wrap-x{overflow-x:auto;margin:10px 0 6px;border:1px solid var(--border);border-radius:9px}
table.ex{width:100%;border-collapse:collapse;font-size:.8rem;font-variant-numeric:tabular-nums}
table.ex th,table.ex td{padding:7px 6px;text-align:right;border-bottom:1px solid var(--border)}
table.ex tbody tr:last-child td{border-bottom:none}
table.ex th:first-child,table.ex td:first-child{text-align:left;position:sticky;left:0;background:var(--bg2);padding-left:14px;font-weight:600;color:var(--fg)}
table.ex thead th{color:var(--fg2);font-weight:600;font-size:.72rem;background:var(--bg2)}
table.ex thead .gly{display:block;font-size:.7rem;margin-top:1px}
table.ex thead .gly.up{color:var(--risk-3)}table.ex thead .gly.moat{color:var(--green-deep)}table.ex thead .gly.friction{color:var(--risk-2)}
table.ex td.cell{color:var(--ink);border-left:1px solid var(--paper)}
table.ex td.idx{font-weight:700;font-variant-numeric:tabular-nums;background:var(--bg3)}
.heat-caption{font-size:.76rem;color:var(--fg2);margin:4px 0 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.heat-caption .swatch{display:inline-block;width:46px;height:10px;border-radius:3px;background:linear-gradient(90deg,var(--risk-soft-0),var(--risk-soft-2),var(--risk-soft-4))}

/* ── Radar ── */
.radar-row{display:flex;flex-wrap:wrap;gap:18px;margin:14px 0 8px}
.radar-card{flex:1 1 280px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px}
.radar-card .rc-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
.radar-card .rc-name{font-family:var(--font-serif);font-weight:600;font-size:1rem;color:var(--fg)}
.radar-card .rc-nums{font-size:.74rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.radar-card .rc-nums b{color:var(--accent)}
.radar svg{width:100%;height:auto;display:block}
.radar .grid{fill:none;stroke:var(--border)}
.radar .axis{stroke:var(--border)}
.radar .poly{fill:rgba(217,107,61,.16);stroke:var(--accent);stroke-width:2;stroke-linejoin:round}
.radar .alabel{fill:var(--fg3);font-size:9px;font-family:var(--font-sans)}

/* ── Source card (key/value rows) ── */
.src-card{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:9px;padding:6px 18px;margin:14px 0}
.src-row{display:grid;grid-template-columns:172px 1fr;gap:8px 14px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.9rem;align-items:baseline}
.src-row:last-child{border-bottom:none}
.src-label{color:var(--fg2);font-size:.74rem;text-transform:uppercase;letter-spacing:.05em}

/* ── Definition / score-band table ── */
table.bands{width:100%;border-collapse:collapse;margin:12px 0;font-size:.9rem}
table.bands th,table.bands td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top}
table.bands thead th{background:var(--bg3);font-family:var(--font-serif);font-weight:600;color:var(--fg);font-size:.86rem}
table.bands td.sc{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}

/* ── Scale dl ── */
.scale{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:14px 18px;margin:12px 0 18px}
.scale dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:8px 16px}
.scale dt{font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent);font-size:.9rem;white-space:nowrap}
.scale dd{margin:0;font-size:.9rem;color:var(--fg)}

/* ── Numbered steps ── */
.steps{counter-reset:step;margin:14px 0}
.step-item{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:13px 16px 13px 50px;margin:8px 0;position:relative}
.step-item::before{counter-increment:step;content:counter(step);position:absolute;left:14px;top:13px;width:24px;height:24px;border-radius:999px;background:var(--accent);color:#fff;font-size:.82rem;font-weight:700;display:flex;align-items:center;justify-content:center}
.step-item .t{font-weight:600;margin-bottom:2px;color:var(--fg)}
.step-item .d{font-size:.88rem;color:var(--fg2);line-height:1.7;max-width:none}

/* ── Callout ── */
.callout{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);border-radius:9px;padding:13px 16px;margin:14px 0;font-size:.92rem;line-height:1.75;color:var(--fg)}
.callout strong{color:var(--accent-deep)}

/* ── FAQ ── */
.faq details{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:12px 16px;margin-bottom:10px}
.faq summary{cursor:pointer;font-weight:600;color:var(--fg);font-size:.95rem;list-style:none;position:relative;padding-right:26px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";position:absolute;right:2px;top:-1px;color:var(--accent);font-weight:700;font-size:1.1rem;transition:transform .2s ease}
.faq details[open] summary::after{content:"–"}
.faq details[open] summary{margin-bottom:8px}
.faq p{margin-bottom:0;font-size:.92rem;color:var(--fg2);max-width:none}
.faq p strong{color:var(--fg)}

/* ── Glossary ── */
.glossary{display:flex;flex-direction:column;gap:10px}
.gloss-item{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:14px 18px}
.gloss-item h3{margin:0 0 6px;font-size:1rem;color:var(--accent-deep);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.gloss-item .term-en{font-size:.76rem;color:var(--fg3);font-family:ui-monospace,monospace;font-weight:400}
.gloss-item p{margin:0;font-size:.92rem;line-height:1.7;color:var(--fg);max-width:none}

/* ── Non-official banner (top of /about) ── */
.top-banner{background:linear-gradient(90deg,rgba(201,90,58,.16),rgba(217,107,61,.12));border:1px solid rgba(201,90,58,.4);border-radius:9px;padding:10px 16px;margin:0 0 24px;font-size:.84rem;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;text-align:center;color:var(--fg)}
.top-banner .badge{background:var(--orange-hot);color:#fff;padding:3px 10px;border-radius:5px;font-size:.72rem;font-weight:700;letter-spacing:.06em}

@media(max-width:600px){
  #wrapper{padding:20px 16px 64px}
  h1{font-size:1.4rem}
  h2{font-size:1.06rem}
  .src-row{grid-template-columns:1fr;gap:2px}
  .scale dl{grid-template-columns:1fr;gap:2px 0}
  .scale dt{margin-top:8px}
}
`;
