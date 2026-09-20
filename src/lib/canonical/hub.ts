/**
 * src/lib/canonical/hub.ts — Hub page class の canonical CSS。
 *
 * Design.md §6.5 Page Class System で定義された "Hub class" の共通 CSS:
 *   - 範囲: hub-index (13 genre/) + hub-slug (9 genre [slug]) = 22 ページ
 *   - 視覚言語: 中庸、navigation 指向、wrapper 980、grid 配置可
 *   - 特徴: `--fg*` alias naming、line-height 1.65、h1 700 weight
 *
 * このファイルは class 共通部分のみ。Page 固有 (genre-cards / rank-list / faq / sector-chart 等)
 * は `templates/Hub.ts` の GENRE_HUB_CSS や個別 page CSS に残す。
 *
 * `:root{}` token 宣言は **このファイルに含めない**。`canonical-css.ts` に一元化。
 */
export const CANONICAL_HUB_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.65}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--orange-hot)}
/* .skip-link rule moved to canonical-css.ts (RA-004, 2026-05-18) */

/* Hub class layout: shared content-column width, vertical-rhythm 32px padding */
#wrapper{max-width:var(--content-max);margin:0 auto;padding:32px 20px 80px}

/* Breadcrumb */
.crumb{font-size:var(--t-sm);color:var(--fg2);margin-bottom:24px}
.crumb a{color:var(--fg2)}
.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}

/* Header + h1 — hub class signature */
header{margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:24px}
h1{color:var(--fg);margin-bottom:12px}
h1 .accent{color:var(--ink)}
.sub{color:var(--fg2);font-size:var(--t-h3)}
.sub strong{color:var(--ink);font-weight:700}
.intro{margin:24px 0;color:var(--fg);font-size:var(--t-h3);max-width:64ch}

/* Section spacing + h2 with bottom border */
section{margin:48px 0}
h2{color:var(--fg);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}

/* Hub class mobile: tighten wrapper padding + h1 size */
@media (max-width:600px){#wrapper{padding:20px 16px 60px}}
`;
