/**
 * src/pages/_id-css.ts — Detail page (/[id]) の page-specific CSS。
 *
 * Page class: **Detail** (Design.md §6.5)
 *   - 共通の reset / wrapper / typography baseline / crumb / hero h1 / section base
 *     は `src/lib/canonical/detail.ts` の `CANONICAL_DETAIL_CSS` から継承
 *   - `:root{}` token は `src/lib/canonical-css.ts` 経由で全 page global emit、
 *     ここでは再宣言しない (Design.md §18.3 に違反するため)
 *
 * 本ファイルが定義する **Detail-page-only** な部分:
 *   .meta-row, .risk-card, .verdict-card, .ai-risk-detail, dl.stats,
 *   section.{context,how-to-become,working-conditions}, .radar-wrap,
 *   .topn-block, .transfer-card, .faq-item, .org-cert-grid, .map-back-link
 *
 * RELATED_HUBS_CSS + SAME_RISK_CSS は spoke-graph section スタイル (末尾連結)。
 *
 * Page-local sibling (Astro `_`-prefix = not routed)。
 */

import { CANONICAL_DETAIL_CSS } from '@/lib/canonical/detail';
import { RELATED_HUBS_CSS } from '@/views/spoke-hub-graph';
import { SAME_RISK_CSS } from '@/views/spoke-spoke-graph';

const DETAIL_PAGE_SPECIFIC_CSS = `
    /* Sector chip + risk-band chips in meta-row */
    .meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:10px 0 14px;font-size:0.78rem;color:var(--ink-3)}
    .meta-row .sector-chip{display:inline-flex;align-items:center;gap:6px;font-size:0.74rem;padding:3px 11px;background:rgba(95,160,80,0.12);color:var(--green-deep);border-radius:999px;text-decoration:none;font-weight:600}
    .meta-row .sector-chip:hover{background:rgba(95,160,80,0.20);color:var(--green-deep);text-decoration:none}
    .meta-row .band{font-family:var(--font-sans);font-size:0.66rem;padding:3px 10px;border-radius:999px;letter-spacing:0.05em;text-transform:uppercase;font-weight:600}
    .meta-row .band-low,.meta-row .band-cool{background:rgba(95,160,80,0.18);color:var(--green-deep)}
    .meta-row .band-mid,.meta-row .band-warm{background:rgba(212,167,73,0.18);color:#8B6B2A}
    .meta-row .band-high,.meta-row .band-hot{background:rgba(217,107,61,0.18);color:var(--orange-hot)}

    /* Work-type verdict card (DIAG-4) */
    .risk-card.verdict-card{display:block;margin:0 0 18px;padding:18px;background:var(--paper);border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 10px 28px rgba(120,80,30,0.07)}
    @media (min-width:900px){.risk-card.verdict-card{padding:26px 30px;margin-bottom:22px}}
    .verdict-main{display:grid;grid-template-columns:1fr;gap:18px;align-items:stretch}
    @media (min-width:900px){.verdict-main{grid-template-columns:minmax(0,1.45fr) minmax(280px,0.85fr);gap:26px}}
    .verdict-copy{min-width:0}
    .verdict-kicker{margin:0 0 9px;font-size:0.72rem;line-height:1.2;color:var(--ink-3);font-weight:700;letter-spacing:0;text-transform:uppercase}
    .verdict-title-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px 12px;margin:0 0 10px}
    .verdict-card h2{font-family:var(--font-serif);font-size:1.42rem;line-height:1.2;margin:0;color:var(--ink);font-weight:800;letter-spacing:0}
    @media (min-width:900px){.verdict-card h2{font-size:1.9rem}}
    .verdict-lede{font-family:var(--font-serif);font-size:0.98rem;line-height:1.8;color:var(--ink);margin:0 0 16px}
    @media (min-width:900px){.verdict-lede{font-size:1.07rem;line-height:1.9}}
    .verdict-task-grid{display:grid;grid-template-columns:1fr;gap:10px;margin:0}
    @media (min-width:720px){.verdict-task-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}
    .verdict-task{min-width:0;padding:12px 13px;background:var(--cream);border:1px solid rgba(0,0,0,0.04);border-radius:8px}
    .verdict-task span{display:block;margin:0 0 6px;font-size:0.7rem;line-height:1.25;color:var(--green-deep);font-weight:800;letter-spacing:0}
    .verdict-task p{margin:0;font-size:0.82rem;line-height:1.65;color:var(--ink-2)}
    @media (min-width:900px){.verdict-task{padding:14px 15px}.verdict-task p{font-size:0.88rem;line-height:1.7}}
    .verdict-side{display:flex;flex-direction:column;gap:12px;min-width:0;padding:14px;background:var(--cream-2);border:1px solid var(--line-strong);border-radius:8px}
    @media (min-width:900px){.verdict-side{padding:18px}}
    .aiois-score-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .aiois-score{min-width:0;background:var(--paper);border:1px solid rgba(0,0,0,0.05);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px}
    .aiois-score.primary{border-left:4px solid var(--orange-hot)}
    .score-label{font-size:0.68rem;line-height:1.25;color:var(--ink-3);font-weight:800;letter-spacing:0}
    .score-num{font-family:var(--font-sans);font-size:2rem;font-weight:900;line-height:1;letter-spacing:0;color:var(--ink);font-variant-numeric:tabular-nums}
    .score-num small{font-size:0.32em;font-weight:600;color:var(--ink-3);margin-left:3px}
    .score-sub{font-size:0.7rem;line-height:1.35;color:var(--ink-3)}
    .verdict-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .verdict-rank,.verdict-delta{display:inline-flex;align-items:center;min-height:28px;padding:5px 10px;border-radius:999px;background:var(--paper);border:1px solid rgba(0,0,0,0.05);font-size:0.76rem;line-height:1.2;font-weight:800;color:var(--ink)}
    .verdict-delta.delta-up{color:var(--orange-hot)}
    .verdict-delta.delta-down{color:var(--green-deep)}
    .verdict-delta.delta-flat{color:var(--ink-3)}
    .verdict-disclaimer{margin:0;font-size:0.72rem;line-height:1.65;color:var(--ink-3)}
    .verdict-share{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:9px 14px;border-radius:999px;background:var(--ink);color:var(--paper);text-decoration:none;font-size:0.84rem;font-weight:800;transition:background 150ms ease,transform 150ms ease}
    .verdict-share svg{width:17px;height:17px;fill:currentColor}
    .verdict-share:hover,.verdict-share:focus-visible{background:var(--orange-hot);color:#fff;text-decoration:none;transform:translateY(-1px);outline:none}
    .verdict-one-line{margin:14px 0 0;padding:12px 14px;background:var(--orange-soft);border-left:3px solid var(--orange);border-radius:0 8px 8px 0;font-size:0.88rem;line-height:1.65;color:var(--ink);font-weight:700}
    @media (min-width:900px){.verdict-one-line{margin-top:18px;font-size:0.94rem;padding:14px 16px}}

    /* Multi-model score history (mms-3) */
    section.score-history{margin-top:18px;line-break:strict}
    section.score-history > h2{margin-bottom:8px;overflow-wrap:anywhere}
    .score-history-note{max-width:var(--content-max);margin:0 0 12px;font-size:0.82rem;line-height:1.7;color:var(--ink-3)}
    @media (min-width:900px){.score-history-note{margin-left:auto;margin-right:auto;font-size:0.9rem}}
    .score-history-note a{color:var(--accent);text-decoration:underline;text-decoration-thickness:0.06em;text-underline-offset:0.16em}
    .score-history-note a:hover{text-decoration-thickness:0.08em}
    .score-history-current{max-width:var(--content-max);margin:0 0 12px;padding:16px 18px;background:var(--paper);border:1px solid var(--line-strong);border-left:4px solid var(--orange-hot);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04)}
    @media (min-width:900px){.score-history-current{margin-left:auto;margin-right:auto;padding:18px 22px}}
    .score-history-current > div{min-width:0;display:grid;gap:4px}
    .score-history-current-label{font-size:0.72rem;line-height:1.2;color:var(--orange-hot);font-weight:900;overflow-wrap:anywhere}
    .score-history-current-model{font-size:1rem;line-height:1.35;font-weight:900;color:var(--ink);overflow-wrap:anywhere}
    .score-history-current-date{font-size:0.78rem;line-height:1.35;color:var(--ink-3);font-weight:700}
    .score-history-current strong{font-family:var(--font-sans);font-size:2rem;line-height:1;font-weight:900;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
    .score-history-current strong span{font-size:0.36em;font-weight:600;color:var(--ink-3);margin-left:2px}
    .score-history-details{max-width:var(--content-max);margin:0;background:transparent}
    @media (min-width:900px){.score-history-details{margin-left:auto;margin-right:auto}}
    .score-history-details summary{display:flex;align-items:center;min-height:40px;width:max-content;max-width:100%;padding:8px 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--cream-2);color:var(--ink);font-size:0.84rem;line-height:1.35;font-weight:900;cursor:pointer;overflow-wrap:anywhere}
    .score-history-details summary:hover{border-color:var(--orange);color:var(--orange-hot)}
    .score-history-details[open] summary{margin-bottom:10px}
    .score-history-table-wrap{max-width:var(--content-max);overflow-x:auto;background:var(--paper);border:1px solid var(--line-strong);border-radius:12px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04)}
    @media (min-width:900px){.score-history-table-wrap{margin-left:auto;margin-right:auto}}
    .score-history-table{width:100%;min-width:560px;border-collapse:collapse;font-size:0.8rem;font-variant-numeric:tabular-nums}
    @media (min-width:900px){.score-history-table{font-size:0.88rem}}
    .score-history-table th,.score-history-table td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}
    @media (min-width:900px){.score-history-table th,.score-history-table td{padding:12px 16px}}
    .score-history-table th{background:var(--cream-2);color:var(--ink-3);font-size:0.72rem;line-height:1.3;font-weight:800}
    .score-history-table tbody tr:last-child td{border-bottom:none}
    .score-history-table .sh-model{font-weight:800;color:var(--ink)}
    .score-history-table .sh-model a{color:var(--ink);overflow-wrap:anywhere}
    .score-history-table .sh-num,.score-history-table .sh-delta{font-family:var(--font-sans);font-weight:900;color:var(--ink)}
    .score-history-table .sh-num span{font-size:0.72em;font-weight:600;color:var(--ink-3);margin-left:2px}
    @media (max-width:560px){.score-history-current{align-items:flex-start;flex-direction:column}.score-history-current strong{font-size:1.75rem}.score-history-table{min-width:520px}}

    /* Citable fact block (Phase 1, SEO_GEO_STRATEGY.md) — the number-dense,
       attributed lead paragraph AI answer engines can quote verbatim. */
    .ai-fact{margin:0 0 18px;padding:16px 18px;background:var(--paper);border:1px solid var(--line-strong);border-left:4px solid var(--red);border-radius:0 12px 12px 0;font-size:0.96rem;line-height:1.85;color:var(--ink);box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04)}
    @media (min-width:900px){.ai-fact{font-size:1.04rem;padding:20px 22px}}

    /* AI risk detail (rendered if rationale_long_ja data exists; usually empty for now) */
    .ai-risk-detail{background:var(--paper);border:1px solid var(--line-strong);border-radius:14px;padding:20px 22px;margin:14px 0 22px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04)}
    @media (min-width:900px){.ai-risk-detail{max-width:var(--content-max);margin-left:auto;margin-right:auto;padding:28px 32px}}
    .ai-risk-detail h2{font-family:var(--font-serif);font-size:1.1rem;color:var(--orange-hot);margin:0 0 12px;font-weight:700}
    @media (min-width:900px){.ai-risk-detail h2{font-size:1.4rem;margin:0 0 16px}}
    .ai-risk-detail .ai-rationale-long{font-family:var(--font-serif);font-size:0.92rem;line-height:1.85;color:var(--ink-2);margin:0 0 18px}
    @media (min-width:900px){.ai-risk-detail .ai-rationale-long{font-size:1rem;line-height:1.95}}
    .ai-risk-detail .ai-task-grid{display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:16px}
    @media (min-width:768px){.ai-risk-detail .ai-task-grid{grid-template-columns:1fr 1fr;gap:24px}}
    .ai-risk-detail .ai-task-block h3{font-size:0.74rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--green-deep);margin:0 0 8px;font-weight:700}
    .ai-risk-detail .ai-task-block ul{list-style:disc;padding-left:18px;margin:0;font-size:0.88rem;line-height:1.7;color:var(--ink-2);font-family:var(--font-serif)}
    .ai-risk-detail .ai-task-block li{margin-bottom:5px}
    .ai-risk-detail .ai-horizon{font-size:0.88rem;line-height:1.7;color:var(--ink-3);margin:0;padding-top:14px;border-top:1px solid var(--line);font-family:var(--font-serif)}
    .ai-risk-detail .ai-horizon strong{color:var(--green-deep);font-weight:700}

    /* Stat grid (was dl.stats) — 2x2 mobile, 4-col desktop. Trimmed: drop 求人倍率 / 時給 hidden later via JS or kept. */
    dl.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 0;padding:0;background:transparent;border:none;list-style:none;grid-auto-rows:1fr}
    @media (min-width:640px){dl.stats{grid-template-columns:repeat(3,1fr)}}
    @media (min-width:900px){dl.stats{grid-template-columns:repeat(3,1fr);gap:16px}}
    dl.stats > div{background:var(--paper);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(120,80,30,0.04);border:1px solid rgba(0,0,0,0.04);display:flex;flex-direction:column;justify-content:center}
    @media (min-width:900px){dl.stats > div{padding:22px 24px;border-radius:14px}}
    /* RA-008 (2026-05-18): bumped from 0.7rem→0.78rem mobile + --ink-3→--ink-meta
       to clear WCAG AA 4.5:1 (was 3.84:1 at 11.2px). */
    dl.stats dt{font-size:0.78rem;color:var(--ink-meta);text-transform:none;letter-spacing:normal;margin:6px 0 0;order:2;font-weight:500}
    @media (min-width:900px){dl.stats dt{font-size:0.82rem;margin:8px 0 0}}
    dl.stats dd{font-size:1.2rem;font-weight:800;color:var(--ink);letter-spacing:-0.02em;line-height:1.1;order:1;word-break:keep-all;overflow-wrap:anywhere}
    @media (min-width:900px){dl.stats dd{font-size:1.4rem}}
    /* RA-007 (2026-05-18): em-dash stat cells get visually demoted so they
       don't compete with real numbers. aria-label="データなし" is on the
       inner span so screen readers announce intent (see _StatsGrid.astro). */
    dl.stats dd .stat-empty{color:var(--ink-3);font-weight:500;font-size:0.7em;cursor:help;text-align:left;display:inline-block;vertical-align:middle}

    /* Editorial sections — context / how-to-become / working-conditions — wrap in sec-card narrow */
    section.context,section.how-to-become,section.working-conditions{background:var(--paper);padding:18px 20px;border-radius:14px;border:1px solid rgba(0,0,0,0.04);box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04)}
    @media (min-width:900px){section.context,section.how-to-become,section.working-conditions{max-width:var(--content-max);margin-left:auto;margin-right:auto;padding:28px 32px}}
    section.context > h2,section.how-to-become > h2,section.working-conditions > h2{padding:0;margin:0 0 12px}
    section.context p,section.how-to-become p,section.working-conditions p{font-family:var(--font-serif);font-size:0.92rem;line-height:1.85;color:var(--ink-2);margin:0 0 12px}
    section.context p:last-child,section.how-to-become p:last-child,section.working-conditions p:last-child{margin-bottom:0}
    @media (min-width:900px){section.context p,section.how-to-become p,section.working-conditions p{font-size:1rem;line-height:1.95}}
    section.context p.definition{font-family:var(--font-sans);font-size:0.85rem;font-weight:500;color:var(--ink);background:var(--cream-2);border-left:none;padding:11px 14px;border-radius:10px;margin:0 0 14px;line-height:1.65;display:flex;gap:10px;align-items:flex-start}
    section.context p.definition::before{content:"TL;DR";color:var(--orange);font-weight:800;flex-shrink:0;font-size:0.66rem;letter-spacing:0.06em;padding-top:3px}
    @media (min-width:900px){section.context p.definition{font-size:0.92rem;padding:14px 18px;margin:0 0 20px}}

    /* Align section headers above narrow cards on desktop */
    @media (min-width:900px){
      section.context > h2,section.how-to-become > h2,section.working-conditions > h2{padding:28px 0 0;margin-top:-28px}
    }

    /* Profile / radar */
    section.profile{margin-top:26px}
    .radar-wrap{display:flex;flex-direction:column;align-items:center;padding:18px 16px;background:var(--paper);border:1px solid rgba(0,0,0,0.04);border-radius:14px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04);gap:14px}
    @media (min-width:900px){.radar-wrap{flex-direction:row;align-items:center;gap:40px;padding:28px 32px;max-width:var(--content-max);margin-left:auto;margin-right:auto}}
    .radar-svg{width:280px;height:280px;flex-shrink:0;max-width:100%}
    @media (min-width:900px){.radar-svg{width:340px;height:340px}}
    dl.radar-legend{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:0;width:100%;text-align:center;padding:0;background:none;border:none}
    @media (min-width:900px){dl.radar-legend{grid-template-columns:repeat(5,1fr);gap:10px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}
    dl.radar-legend dt{font-family:var(--font-sans);font-size:0.66rem;color:var(--ink-3);margin:0;text-transform:none;letter-spacing:normal;order:1;font-weight:400}
    dl.radar-legend dd{font-family:var(--font-sans);font-size:1.1rem;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;margin:2px 0 0;order:2}
    @media (min-width:900px){dl.radar-legend dd{font-size:1.5rem}}

    /* TopN — skills/knowledge/abilities */
    section.topn{margin-top:26px}
    .topn-grid{display:grid;grid-template-columns:1fr;gap:14px;margin:0}
    @media (min-width:900px){.topn-grid{grid-template-columns:1.4fr 1fr 1fr;gap:18px}}
    .topn-block{background:var(--paper);border-radius:14px;padding:16px 18px;box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.04);border:1px solid rgba(0,0,0,0.04)}
    @media (min-width:900px){.topn-block{padding:20px 22px}}
    .topn-block h3{font-family:var(--font-serif);font-size:0.92rem;color:var(--orange-hot);margin:0 0 10px;font-weight:700;font-style:normal}
    @media (min-width:900px){.topn-block h3{font-size:1rem;margin:0 0 14px}}
    .topn-block ol{list-style:none;padding:0;margin:0;counter-reset:rank}
    .topn-block li{counter-increment:rank;display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px dotted var(--line-strong);font-size:0.82rem}
    .topn-block li:last-child{border-bottom:none}
    .topn-block li::before{content:counter(rank);font-family:var(--font-sans);color:var(--ink-3);font-size:0.7rem;font-variant-numeric:tabular-nums;font-weight:600}
    .topn-block .topn-name{color:var(--ink);font-family:var(--font-serif)}
    .topn-block .topn-score{font-family:var(--font-sans);color:var(--ink-2);font-size:0.74rem;font-variant-numeric:tabular-nums;font-weight:700}

    /* Transfer (転職先候補) — restyled .transfer-card to look like unified occ-card */
    section.transfer{margin-top:26px}
    section.transfer > h2{color:var(--green-deep)}
    .transfer-grid{display:grid;grid-template-columns:1fr;gap:8px;margin:0}
    @media (min-width:768px){.transfer-grid{grid-template-columns:1fr 1fr;gap:12px}}
    .transfer-card{display:block;padding:14px 16px;background:var(--paper);border-radius:12px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 0 rgba(0,0,0,0.03),0 6px 18px rgba(120,80,30,0.05);text-decoration:none;color:inherit;transition:transform 0.18s ease,box-shadow 0.18s ease,border-color 0.18s ease}
    @media (min-width:900px){.transfer-card{padding:20px 22px}}
    .transfer-card:hover,.transfer-card:focus-visible{transform:translateY(-2px);border-color:rgba(217,107,61,0.30);box-shadow:0 1px 0 rgba(0,0,0,0.03),0 12px 28px rgba(217,107,61,0.10);outline:none;text-decoration:none}
    .transfer-card .tc-name{display:block;font-family:var(--font-serif);font-size:1rem;color:var(--ink);font-weight:600;line-height:1.2;margin-bottom:8px}
    @media (min-width:900px){.transfer-card .tc-name{font-size:1.15rem;margin-bottom:10px}}
    .transfer-card .tc-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:0.72rem;color:var(--ink-3)}
    @media (min-width:900px){.transfer-card .tc-meta{font-size:0.78rem;gap:12px}}
    .transfer-card .tc-risk{font-family:var(--font-sans);font-weight:700;padding:3px 8px;border-radius:5px;font-size:0.68rem;letter-spacing:0.01em;background:rgba(217,107,61,0.14);color:var(--orange-hot)}
    .transfer-card .tc-similarity{color:var(--ink-3)}

    /* FAQ — uses native <details> with restyled summary */
    section.faq{margin-top:26px}
    .faq-list{display:flex;flex-direction:column;gap:8px;max-width:var(--content-max);margin-left:0;margin-right:0}
    @media (min-width:900px){.faq-list{margin-left:auto;margin-right:auto}}
    .faq-item{background:var(--paper);border:1px solid rgba(0,0,0,0.04);border-radius:12px;box-shadow:0 1px 0 rgba(0,0,0,0.03);overflow:hidden;transition:border-color 150ms ease}
    .faq-item[open]{border-color:rgba(217,107,61,0.30)}
    .faq-item summary{padding:14px 16px;font-family:var(--font-serif);font-size:0.92rem;font-weight:500;color:var(--ink);cursor:pointer;list-style:none;position:relative;padding-right:42px;line-height:1.45}
    @media (min-width:900px){.faq-item summary{font-size:1rem;padding:18px 22px;padding-right:50px}}
    .faq-item summary::-webkit-details-marker{display:none}
    .faq-item summary::after{content:"+";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:1.4rem;color:var(--ink-3);transition:transform 200ms ease,color 200ms ease;font-weight:300}
    @media (min-width:900px){.faq-item summary::after{right:22px;font-size:1.5rem}}
    .faq-item[open] summary::after{transform:translateY(-50%) rotate(45deg);color:var(--accent)}
    .faq-item summary:hover{color:var(--accent)}
    .faq-answer{padding:14px 16px;color:var(--ink-2);font-size:0.88rem;line-height:1.8;font-family:var(--font-serif);border-top:1px solid var(--line)}
    @media (min-width:900px){.faq-answer{padding:14px 22px 18px;font-size:0.95rem}}
    .faq-answer b{color:var(--orange-hot)}

    /* Legacy related fallback (used only if transferHtml is empty) */
    section.related ul{list-style:none;padding:0;display:grid;grid-template-columns:1fr;gap:8px}
    @media (min-width:768px){section.related ul{grid-template-columns:1fr 1fr;gap:10px}}
    section.related li{display:flex;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--paper);border:1px solid rgba(0,0,0,0.06);border-radius:10px;font-size:0.85rem;align-items:baseline;margin:0}
    section.related li:hover{border-color:var(--accent)}
    section.related .r-name{flex:1;color:var(--ink);font-family:var(--font-serif);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    section.related .r-risk{font-size:0.7rem;color:var(--ink-3);font-variant-numeric:tabular-nums}

    /* Orgs + Certs — certs styled as a grid card */
    section.orgs-certs{margin-top:26px}
    .org-cert-grid{display:grid;grid-template-columns:1fr;gap:14px;margin:0;align-items:start}
    /* auto-fit: when only one block (orgs OR certs) exists it fills the full
       width instead of being stranded at half; two blocks still split 50/50. */
    @media (min-width:768px){.org-cert-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}}
    .org-cert-block{background:var(--paper);border:1px solid var(--line-strong);border-radius:12px;padding:16px 18px}
    .org-cert-block h3{font-family:var(--font-serif);font-size:0.95rem;color:var(--orange-hot);margin:0 0 10px;font-weight:700}
    .org-list,.cert-list{list-style:none;padding:0;margin:0}
    .org-list li{padding:5px 0;font-size:0.86rem;color:var(--ink);border-bottom:1px dashed var(--line-strong)}
    .org-list li:last-child{border-bottom:none}
    .org-list a{color:var(--accent);text-decoration:none}
    .org-list a:hover{text-decoration:underline}
    /* auto-fill chips so they pack to a consistent ~150px regardless of whether
       the cert block is half- or full-width (no sparse wide cells). */
    .cert-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:0;margin:0}
    @media (min-width:900px){.cert-list{gap:8px}}
    .cert-list li{font-size:0.74rem;color:var(--ink);padding:8px 10px;background:var(--cream);border-radius:6px;font-family:var(--font-serif);border-bottom:none}
    @media (min-width:900px){.cert-list li{font-size:0.78rem;padding:10px 12px;border-radius:8px}}

    /* Map back link */
    .map-back-link{margin:32px 0 8px;text-align:center}
    .map-back-link a{display:inline-block;color:var(--ink-3);font-size:0.84rem;padding:10px 18px;border:1px solid var(--line-strong);border-radius:999px;text-decoration:none;transition:color 150ms ease,border-color 150ms ease,background 150ms ease}
    .map-back-link a:hover,.map-back-link a:focus-visible{color:var(--accent);border-color:var(--accent);background:rgba(217,107,61,0.06)}

    /* AIOIS-10 per-occupation 10-dimension breakdown */
    section.aiois10{margin-top:24px}
    section.aiois10 > h2 a{color:inherit;text-decoration:none;border-bottom:2px solid var(--accent)}
    section.aiois10 > h2 a:hover{color:var(--accent)}
    .aio-indices{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px}
    .aio-idx{flex:1 1 160px;background:var(--paper);border:1px solid var(--line-strong);border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:2px}
    .aio-idx.idx-t{border-left:4px solid var(--orange-hot)}
    .aio-idx.idx-d{border-left:4px solid var(--ink-3)}
    .aio-idx-lbl{font-family:var(--font-sans);font-size:0.72rem;font-weight:700;letter-spacing:0.04em;color:var(--ink-3)}
    .aio-idx-num{font-family:var(--font-sans);font-size:2rem;font-weight:900;line-height:1;letter-spacing:-0.03em;color:var(--ink)}
    .aio-idx.idx-t .aio-idx-num{color:var(--orange-hot)}
    .aio-idx-num small{font-size:0.32em;font-weight:600;color:var(--ink-3);margin-left:3px}
    .aio-idx-sub{font-size:0.72rem;color:var(--ink-3)}
    .aio-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
    .aio-row{display:grid;grid-template-columns:34px 1.7fr 2fr 34px;align-items:center;gap:8px;font-size:0.8rem;line-height:1.35}
    @media (max-width:560px){.aio-row{grid-template-columns:30px 1.6fr 1.3fr 28px;gap:6px;font-size:0.72rem}}
    .aio-code{font-family:var(--font-sans);font-weight:700;font-size:0.7rem;color:var(--ink-3);font-variant-numeric:tabular-nums}
    .aio-name{color:var(--ink);font-family:var(--font-serif)}
    .aio-tag{font-size:0.7em;margin-right:5px;color:var(--ink-3)}
    .aio-bar{display:block;height:9px;background:var(--cream);border-radius:999px;overflow:hidden}
    .aio-fill{display:block;height:100%;border-radius:999px;min-width:2px}
    .aio-drv .aio-fill{background:linear-gradient(90deg,#E6A23C,var(--orange-hot))}
    .aio-moat .aio-fill{background:linear-gradient(90deg,#7FB069,var(--green-deep))}
    .aio-mod .aio-fill{background:var(--ink-3)}
    .aio-drv .aio-tag{color:var(--orange-hot)}
    .aio-moat .aio-tag{color:var(--green-deep)}
    .aio-val{font-family:var(--font-sans);font-weight:700;font-size:0.74rem;color:var(--ink-2);text-align:right;font-variant-numeric:tabular-nums}
    .aio-note{margin-top:12px;font-size:0.72rem;color:var(--ink-3);line-height:1.7}
    .aio-note .aio-tag{margin:0 1px 0 4px}
    .aio-note a{color:var(--accent);text-decoration:underline;text-decoration-thickness:0.06em;text-underline-offset:0.16em}
    .aio-note a:hover{text-decoration-thickness:0.08em}
`;

export const ID_PAGE_CSS = CANONICAL_DETAIL_CSS + DETAIL_PAGE_SPECIFIC_CSS + `
    ${RELATED_HUBS_CSS}
    ${SAME_RISK_CSS}
  `;
