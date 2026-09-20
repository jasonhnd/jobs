/**
 * src/pages/sectors/_sector-css.ts — Sector page (`/sectors/[sector]`) の
 * page-specific CSS。
 *
 * Page class: **Sector** (Design.md §6.5)
 *   - 共通の reset / wrapper (980) / body (palt on) / typography / crumb / header /
 *     section h2 は `src/lib/canonical/sector.ts` の `CANONICAL_SECTOR_CSS` から継承
 *   - `:root{}` token は `src/lib/canonical-css.ts` 経由で全 page global emit、
 *     ここでは再宣言しない
 *
 * 本ファイルが定義する **Sector-page-only** な部分:
 *   .top-banner / .badge / .top-list / .full-list / .related-sectors /
 *   .risk-pill / .ai-era-essay / .patterns / .ai-distribution / footer.*
 *
 * Page-local sibling (Astro `_`-prefix → not routed)。
 */

import { CANONICAL_SECTOR_CSS } from '@/lib/canonical/sector';
import { AI_FACT_CSS } from '@/lib/ai-fact-css';
import { RANK_LIST_CSS } from '@/lib/rank-list-css';

const SECTOR_PAGE_SPECIFIC_CSS = `
.top-banner{background:var(--bg3);border-bottom:1px solid var(--border);padding:8px 16px;font-size:var(--t-sm);color:var(--fg2);display:flex;gap:12px;align-items:center;justify-content:center}
.badge{background:var(--orange-hot);color:var(--paper);padding:2px 8px;font-size:var(--t-xs);letter-spacing:.05em;font-weight:700;border-radius:2px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:32px 0}
@media (max-width:768px){.stats{grid-template-columns:1fr 1fr}}
@media (max-width:480px){.stats{grid-template-columns:1fr}}
.stats>div{background:var(--bg2);border:1px solid var(--border);padding:16px;border-radius:6px}
.stats dt{font-size:var(--t-xs);color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.stats dd{font-family:var(--font-serif);font-size:var(--t-h2);color:var(--fg)}
${AI_FACT_CSS}
.top-list{list-style:none;display:grid;gap:8px}
.top-list li{background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px}
.top-list a{color:var(--fg);text-decoration:none;font-weight:600}
.top-list a:hover{color:var(--accent-deep);text-decoration:underline}
.top-list .meta{color:var(--fg2);font-size:var(--t-sm);white-space:nowrap;font-variant-numeric:tabular-nums}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:var(--r-md);font-size:var(--t-xs);font-weight:600;font-variant-numeric:tabular-nums;margin-right:8px}
.risk-pill.low{background:var(--risk-pill-low-bg);color:var(--risk-pill-low-fg)}
.risk-pill.mid{background:var(--risk-pill-mid-bg);color:var(--risk-pill-mid-fg)}
.risk-pill.high{background:var(--risk-pill-high-bg);color:var(--risk-pill-high-fg)}
.full-list{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:6px}
.full-list li{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:49px}
.full-list li > a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg);text-decoration:none}
.full-list li > a:hover{color:var(--accent-deep);text-decoration:underline}
.full-list a{color:var(--fg);text-decoration:none}
.full-list a:hover{color:var(--accent-deep);text-decoration:underline}
.related-sectors{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;list-style:none}
.related-sectors li{background:var(--bg2);border:1px solid var(--border);border-radius:4px}
.related-sectors a{display:block;padding:12px 14px;text-decoration:none;color:var(--fg)}
.related-sectors a:hover{background:var(--bg3);color:var(--accent-deep)}
.related-sectors .ja-name{font-family:var(--font-serif);font-weight:600}
.related-sectors .count{color:var(--fg2);font-size:var(--t-xs);display:block;margin-top:2px}
footer{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);font-size:var(--t-xs);color:var(--fg2);text-align:center}
footer .footer-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;margin-bottom:14px}
footer .footer-links a{color:var(--fg2);text-decoration:none;padding:5px 14px;border:1px solid var(--border);border-radius:999px;font-size:var(--t-xs);line-height:1.2;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
footer .footer-links a:hover{color:var(--orange-hot);border-color:var(--accent);background:color-mix(in srgb, var(--orange) 6%, transparent);text-decoration:none}
footer .footer-meta{color:var(--fg2);font-size:var(--t-xs);text-wrap:pretty;line-height:1.65}
footer .footer-meta a{color:var(--orange-hot)}
footer .footer-meta .nowrap{white-space:nowrap}
@media (max-width:540px){footer .footer-meta{line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}}
/* SEO Phase 7: FAQ section — visible Q&A matching FAQPage JSON-LD schema. */
section.faq{margin:48px 0}
.faq-list{display:flex;flex-direction:column;gap:8px}
.faq-item{background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden;transition:border-color 150ms ease}
.faq-item[open]{border-color:var(--accent-deep)}
.faq-item summary{padding:16px 18px;font-family:var(--font-serif);font-size:var(--t-body);font-weight:600;color:var(--fg);cursor:pointer;list-style:none;position:relative;padding-right:42px;line-height:1.5}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:"+";position:absolute;right:18px;top:50%;transform:translateY(-50%);font-size:var(--t-h2);color:var(--fg2);transition:transform 150ms ease,color 150ms ease;font-weight:300}
.faq-item[open] summary::after{transform:translateY(-50%) rotate(45deg);color:var(--orange-hot)}
.faq-item summary:hover{color:var(--accent-deep)}
.faq-answer{padding:0 18px 16px;color:var(--fg);font-size:var(--t-body);line-height:1.75}
@media (max-width:600px){.top-list li{flex-direction:column;align-items:flex-start;gap:6px}.faq-item summary{padding:14px 16px;padding-right:38px}}
/* Phase 2: AI 時代の特性 essay + データから見えるパターン */
.ai-era-essay{background:var(--bg2);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;padding:24px 28px;margin:32px 0}
.ai-era-essay h2{color:var(--ink);margin:0 0 14px;padding:0;border:none}
.ai-era-essay p{font-size:var(--t-body);line-height:1.85;color:var(--fg);margin:0}
.patterns{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;margin:32px 0}
.patterns h2{color:var(--ink);margin:0 0 16px;padding:0;border:none}
.ai-distribution{margin-bottom:18px}
.ai-dist-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;margin-bottom:10px;background:var(--bg3)}
.ai-dist-bar span{display:block;height:100%}
.ai-dist-bar .dist-low{background:#6E9B89}
.ai-dist-bar .dist-mid{background:#D4A749}
.ai-dist-bar .dist-high{background:#D96B3D}
.ai-dist-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:var(--t-xs);color:var(--fg2)}
.ai-dist-legend .ldot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
.ai-dist-legend .ldot-low{background:#6E9B89}
.ai-dist-legend .ldot-mid{background:#D4A749}
.ai-dist-legend .ldot-high{background:#D96B3D}
.ai-dist-legend strong{color:var(--fg);font-variant-numeric:tabular-nums}
.pattern-observations{list-style:none;padding:0;margin:18px 0 0;display:flex;flex-direction:column;gap:8px}
.pattern-observations li{padding:10px 14px;background:var(--bg3);border-radius:4px;font-size:var(--t-sm);color:var(--fg);line-height:1.65}
.pattern-observations li strong{color:var(--ink);font-weight:700}
@media (max-width:600px){.ai-dist-legend{gap:8px}}
:where(main) header{margin-bottom:16px;padding-bottom:14px}
.sec-list-sec{margin:8px 0 28px}
.sec-list-sec h2{color:var(--ink);letter-spacing:.04em;border:none;padding:0;margin:0 0 8px;word-break:keep-all;overflow-wrap:anywhere}
.chap-body .stats{margin:16px 0}
.chap-body .ai-fact{margin-bottom:16px}
.chap-body .ai-era-essay{margin:16px 0;padding:16px 18px}
.chap-body .patterns{margin:16px 0}
.chap-body section{margin:20px 0}
${RANK_LIST_CSS}
`;

export const SECTOR_PAGE_CSS = CANONICAL_SECTOR_CSS + SECTOR_PAGE_SPECIFIC_CSS;
