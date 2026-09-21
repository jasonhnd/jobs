/**
 * src/lib/canonical/sector.ts — Sector page class の canonical CSS。
 *
 * Design.md §6.5 Page Class System で定義された "Sector class" の共通 CSS:
 *   - 範囲: 17 個の `/sectors/` page (index + 16 sectors)
 *   - 視覚言語: Hub class とほぼ同じ (wrapper 980、h1 600 weight)
 *   - 特徴: `font-feature-settings:"palt"` (CJK パワー字幅) ── Hub class との唯一の差分
 *
 * このファイルは Hub class と sector class 共通部分のみ。
 * Sector 固有 (treemap chart, top-list, related-sectors 等) は `_sector-css.ts` に残す。
 *
 * `:root{}` token 宣言は **このファイルに含めない**。`canonical-css.ts` に一元化。
 */
export const CANONICAL_SECTOR_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.65;font-feature-settings:"palt"}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--orange-hot)}
/* .skip-link rule moved to canonical-css.ts (RA-004, 2026-05-18) */

/* Sector class layout: shared content-column width, same as Hub class */
#wrapper{max-width:var(--content-max);margin:0 auto;padding:32px var(--gutter) 80px}

/* Breadcrumb */
.crumb{font-size:var(--t-sm);color:var(--fg2);margin-bottom:24px}
.crumb a{color:var(--fg2)}
.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}

/* Header + h1 (sector class can have flex layout for switch widgets) */
/* Page hero header only. BaseLayout wraps the site chrome (MobileNav + TopNav)
   in a bare header element for the banner landmark; a bare header selector painted
   a second rule and 24px of padding under the top nav on every page of this
   class (2026-06-03 → 2026-09-20). The hero sits inside the main element; the
   chrome does not. :where() keeps the specificity at (0,0,1), so page rules such as
   /me's .me-head still win exactly as they did against the bare selector. */
:where(main) header{margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:24px}
h1{color:var(--fg);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
h1 .accent{color:var(--ink)}
.sub{color:var(--fg2);font-size:var(--t-h3)}
.sub strong{color:var(--ink);font-weight:700}
.intro{margin:24px 0;color:var(--fg);font-size:var(--t-h3);max-width:64ch}

/* Section spacing + h2 with bottom border */
section{margin:48px 0}
h2{color:var(--fg);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}

/* Sector class mobile: tighten + reflow h1 */
@media (max-width:599px){#wrapper{padding:20px var(--gutter) 60px}h1{flex-direction:column;align-items:flex-start;gap:6px}}
`;
