/**
 * src/templates/Aiois10Profile.ts — per-occupation AIOIS-10 breakdown.
 *
 * Renders the 10-dimension profile (D1–D10) plus the two derived indices
 * (Transformation / Displacement-Risk) below the headline risk card on an
 * occupation detail page. Pure CSS bars (no JS → no CSP hash). Returns empty
 * SafeHtml when the occupation has no AIOIS-10 profile (legacy/unscored), so
 * the section self-omits.
 *
 * Layout:
 *   <section class="aiois10">
 *     <h2>AI 影響の内訳 — AIOIS-10</h2>
 *     <div class="aio-indices"> 変化指数 / 代替リスク </div>
 *     <ul class="aio-list"> 10 × (code · label · bar · value) </ul>
 *     <p class="aio-note"> legend + links </p>
 *   </section>
 */

import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

export interface Aiois10ProfileInput {
  readonly d1: number; readonly d2: number; readonly d3: number; readonly d4: number; readonly d5: number;
  readonly d6: number; readonly d7: number; readonly d8: number; readonly d9: number; readonly d10: number;
  readonly transformation: number;
  readonly displacement: number;
}

type Role = 'drv' | 'moat' | 'mod';
export const AIOIS10_DIMENSIONS = [
  { key: 'd1', code: 'D1', ja: '頭脳・情報の仕事', role: 'drv', tag: '▲' },
  { key: 'd2', code: 'D2', ja: '決まった手順のくり返し', role: 'drv', tag: '▲' },
  { key: 'd3', code: 'D3', ja: '体・現場の仕事', role: 'moat', tag: '■' },
  { key: 'd4', code: 'D4', ja: '判断と責任', role: 'moat', tag: '■' },
  { key: 'd5', code: 'D5', ja: '人とのやりとり・気持ち', role: 'moat', tag: '■' },
  { key: 'd6', code: 'D6', ja: '新しいものを生み出す力', role: 'moat', tag: '■' },
  { key: 'd7', code: 'D7', ja: '資格・安全のかべ', role: 'moat', tag: '■' },
  { key: 'd8', code: 'D8', ja: '自動化が安く済むか', role: 'mod', tag: '◐' },
  { key: 'd9', code: 'D9', ja: '人手不足・制度の影響', role: 'mod', tag: '◐' },
  { key: 'd10', code: 'D10', ja: 'これから仕事は増えるか', role: 'drv', tag: '▲' },
] as const satisfies ReadonlyArray<{ key: keyof Aiois10ProfileInput; code: string; ja: string; role: Role; tag: string }>;

const DIMS = AIOIS10_DIMENSIONS;

const pct = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 10)));

export function renderAiois10Profile(a: Aiois10ProfileInput | null): SafeHtml {
  if (!a) return '' as SafeHtml;

  let rows = '';
  for (const dm of DIMS) {
    const v = a[dm.key] as number;
    rows += `<li class="aio-row aio-${dm.role}">` +
      `<span class="aio-code">${dm.code}</span>` +
      `<span class="aio-name"><span class="aio-tag" aria-hidden="true">${dm.tag}</span>${escapeHtml(dm.ja)}</span>` +
      `<span class="aio-bar" role="img" aria-label="${dm.code} ${escapeHtml(dm.ja)} ${v.toFixed(1)} / 10">` +
      `<span class="aio-fill" style="width:${pct(v)}%"></span></span>` +
      `<span class="aio-val">${v.toFixed(1)}</span>` +
      `</li>`;
  }

  return (`<section class="aiois10" aria-labelledby="aiois10-h2">
        <h2 id="aiois10-h2">AI 影響の内訳 — <a href="/standard">AIOIS-10</a></h2>
        <div class="aio-indices">
          <div class="aio-idx idx-t">
            <span class="aio-idx-lbl">変化の大きさ</span>
            <span class="aio-idx-num">${a.transformation.toFixed(1)}<small>/10</small></span>
            <span class="aio-idx-sub">仕事のやり方がどれだけ変わるか</span>
          </div>
          <div class="aio-idx idx-d">
            <span class="aio-idx-lbl">仕事が減るリスク</span>
            <span class="aio-idx-num">${a.displacement.toFixed(1)}<small>/10</small></span>
            <span class="aio-idx-sub">仕事そのものが減る・なくなる確率</span>
          </div>
        </div>
        <ul class="aio-list">${rows}</ul>
        <p class="aio-note">見方：<span class="aio-tag">▲</span>AI が届く部分（高いほど影響が大きい）／<span class="aio-tag">■</span>人間の強み（高いほど守られる）／<span class="aio-tag">◐</span>その他の調整。各 0〜10。くわしくは <a href="/standard">AIOIS-10 とは</a>、点数の付け方は <a href="/methodology">調べ方</a> を参照。</p>
      </section>`) as SafeHtml;
}
