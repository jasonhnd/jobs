/**
 * src/lib/canonical/detail.ts — Detail page class の canonical CSS。
 *
 * Design.md §6.5 Page Class System で定義された "Detail class" の共通 CSS:
 *   - 範囲: 556 個の `/<id>` spoke detail page
 *   - 視覚言語: 親密、読み物指向、狭め wrapper (480→640→1080)、serif body
 *   - 特徴: `--ink-*` semantic naming、line-height 1.6 (canonical-css.ts が 1.75 で上書き)
 *
 * このファイルは class 共通部分のみ。Page 固有スタイル (radar / transfer / FAQ 等)
 * は `src/pages/_id-css.ts` に残す。`_id-css.ts` がこの canonical を import して
 * 連結する。
 *
 * `:root{}` token 宣言は **このファイルに含めない**。token は
 * `src/lib/canonical-css.ts` に一元化、Footer.astro 経由で全 page に global emit
 * されるため。
 */
export const CANONICAL_DETAIL_CSS = `
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    html,body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);-webkit-font-smoothing:antialiased;line-height:1.6}
    h1,h2,h3,h4{font-family:var(--font-serif);font-weight:700;letter-spacing:-0.005em;color:var(--ink)}
    a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
    /* .skip-link rule moved to canonical-css.ts (RA-004, 2026-05-18) */
    .theme-toggle{display:none !important}

    /* Detail class layout: mobile-first single column, scale up on desktop. */
    #wrapper{max-width:480px;margin:0 auto;padding:env(safe-area-inset-top,12px) 18px env(safe-area-inset-bottom,24px)}
    @media (min-width:640px){#wrapper{max-width:640px;padding:18px 24px 32px}}
    @media (min-width:900px){#wrapper{max-width:var(--content-max);padding:24px 32px 48px}}

    /* Breadcrumb */
    nav.crumb{font-size:0.74rem;color:var(--ink-3);margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    nav.crumb a{color:var(--ink-3);text-decoration:none;background:transparent;border:none;padding:0}
    nav.crumb a::before{content:none}
    nav.crumb a:hover{color:var(--accent);text-decoration:none;background:transparent}
    nav.crumb > span[aria-hidden]{color:var(--ink-4)}
    nav.crumb > span:not([aria-hidden]){color:var(--ink);font-weight:500}

    /* Hero h1 — detail class signature */
    header#content{margin-bottom:6px}
    h1{font-size:clamp(1.9rem,1.5rem+1.4vw,3.2rem);font-weight:700;letter-spacing:-0.015em;line-height:1.06;margin:0;color:var(--ink)}
    h1 .accent{color:var(--ink);font-style:normal}
    h1 .h1-sub{font-size:0.66em;color:var(--ink-3);font-weight:500;margin-left:8px}

    /* Section spacing + section h2 (sec-h pattern) */
    section{margin-top:26px}
    @media (min-width:900px){section{margin-top:44px}}
    section > h2{font-family:var(--font-serif);font-size:1.1rem;font-weight:700;color:var(--orange-hot);letter-spacing:-0.005em;margin:0 0 12px;padding:0}
    @media (min-width:900px){section > h2{font-size:1.5rem;margin:0 0 18px}}
`;
