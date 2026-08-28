/**
 * canonical-css.ts — single source of truth for site-wide typography +
 * footer styling. Loaded by:
 *
 *   src/components/Footer.astro       → emits via <style is:global>
 *   src/pages/index.astro              → injected into raw <head> via regex
 *
 * Why this file exists:
 *   The 10 page templates each had their own inline <style slot="head">
 *   with hand-tuned font sizes, weights, and colors. Across `/`, `/about`,
 *   `/compliance`, `/privacy`, `/404`, `/map`, `/sectors`,
 *   `/sectors/<slug>`, `/rankings/<slug>`, and `/<id>` we measured
 *   **10 different typography systems** (h1 sizes 22px–40px, p colors fg
 *   vs fg2, p sizes 14.4px–16.32px, line-heights 1.55–1.75). The user
 *   reported that pages "look different from each other" — they were right.
 *
 *   This file forces a single typography baseline. Selectors use
 *   `html body <tag>` (specificity 0,0,0,3) which beats every page-local
 *   bare-element rule (0,0,0,1) without needing !important. Pages that
 *   genuinely need a different heading treatment (e.g. a hero h1) should
 *   class-scope it (.hero h1) — that's specificity (0,0,1,1) which wins
 *   over our baseline.
 *
 *   The `footer.site-footer` rules are the same canonical footer block
 *   that previously lived in Footer.astro's <style is:global>. They keep
 *   the whole site's footer visually identical — verified across 10 pages.
 *
 * Design choices (matching the production legacy where the majority of
 * pages already lived):
 *   - body  16px / line-height 1.75 / Plus Jakarta Sans + Hiragino Sans
 *   - h1    1.7rem (27.2px) / 700 / Noto Serif JP / fg
 *   - h2    1.15rem (18.4px) / 600 / Noto Serif JP / fg
 *   - h3    1rem (16px) / 600 / Noto Serif JP / fg
 *   - body  paragraphs inherit body color (fg, dark) — content readability
 *   - footer 0.72rem (11.52px) / fg2 — matches production (was 0.78rem on preview)
 */

export const CANONICAL_CSS = `
/* ───── Canonical design tokens (single source of truth) ─────
   Design.md §2.1 で定義された 2 層構造:
     第 1 層 semantic primary (--cream/--ink/--orange/--green-deep/--red/--purple)
       → 新コードは全部これを使う
     第 2 層 alias (--bg/--fg/--accent/...)
       → legacy 互換 (16 hub 内部スタイル + footer partial + render-function selectors)

   全 821 page が Footer.astro 経由で <style is:global> としてこのブロックを emit
   するため、page-local <style> で :root{} を再宣言する必要はない (Design.md §18.4)。
   Page class CSS (src/lib/canonical/{detail,hub,sector,static}.ts) はトークンを
   var() で参照するだけで、再宣言しない。 */

:root {
  /* 第 1 層 — semantic primary */
  --cream: #FAF6EE;
  --cream-2: #F2EADB;
  --paper: #FFFFFF;
  --ink: #241E18;
  --ink-2: #5a4a3a;
  --ink-3: #8a7a6a;
  --ink-4: #b0a090;
  /* RA-008 (2026-05-18): WCAG-AA-safe variant of --ink-3 for body-sized text.
     --ink-3 (#8a7a6a) on --cream = 3.84:1 — passes AA for ≥18px or 14px-bold
     only. For 11-13px stat labels / breadcrumb meta, use --ink-meta which
     hits 4.5:1+ at any size. Updates Design.md §2.1 table. */
  --ink-meta: #695745;
  --orange: #D96B3D;
  --orange-hot: #c0411e;
  --orange-soft: #fce4d2;
  --green: #5fa050;
  --green-deep: #48705F;
  --red: #c95a3a;
  --purple: #8b5fb0;
  --purple-soft: #ddd5fb;
  --line: rgba(36, 30, 24, 0.06);
  --line-strong: rgba(36, 30, 24, 0.12);
  /* 第 2 層 — alias (legacy 互換、値固定。Design.md §2.1 警告参照: --fg2/--fg3/--accent-2/--border の RGB は --ink-2 等と厳密に等しくない、これは意図) */
  --bg: #FAF6EE;
  --bg2: #FFFFFF;
  --bg3: #F2EADB;
  --fg: #241E18;
  --fg2: #7A6F5E;
  --fg3: #A39785;
  --accent: #D96B3D;
  --accent-2: #6E9B89;
  --accent-deep: #48705F;
  --border: rgba(36, 30, 24, 0.10);
  --font-serif: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --font-sans: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  /* 第 3 層 — AI-impact (risk) color scale. SINGLE source for every surface
     (map tiles, sector nav, distribution bar, risk pills, search, OG cards,
     detail gradient). Was 7 ad-hoc hardcoded ramps; 2026-05-31. */
  /* Saturated 5-band: band 0 = lowest impact → band 4 = highest. */
  --risk-0: #0F8A66;
  --risk-1: #5BA84F;
  --risk-2: #D9A03B;
  --risk-3: #E27A33;
  --risk-4: #C4422F;
  /* Soft tints of the same 5-band scale (each ≈ 18% of the saturated color over
     cream) — for the home distribution bar + pill backgrounds, so the soft
     surfaces share the scale's hues instead of an unrelated pastel set. */
  --risk-soft-0: #D0E3D6;
  --risk-soft-1: #DDE8D1;
  --risk-soft-2: #F4E7CE;
  --risk-soft-3: #F6E0CC;
  --risk-soft-4: #F0D6CC;
  /* Pills: soft-tint background (from the scale) + readable dark text. */
  --risk-pill-low-bg: var(--risk-soft-0);  --risk-pill-low-fg: #48705F;
  --risk-pill-mid-bg: var(--risk-soft-2);  --risk-pill-mid-fg: #8A6A2A;
  --risk-pill-high-bg: var(--risk-soft-3); --risk-pill-high-fg: #A24A28;
  /* 第 4 層 — layout. Single content-column width: every page's #wrapper / main
     references this, and the top-nav + footer align to it, so the content edge
     is identical across the map, occupation, hub, sector, and legal pages.
     (2026-05-31: replaced 6 ad-hoc per-page widths 740/760/820/900/980/1080.) */
  --content-max: 1080px;
}

/* Dark mode neutralized: theme は Design.md §3 で NEUTRALIZED 状態。
   [data-theme="light"] / ["dark"] / prefers-color-scheme すべて同じ cream に解決。 */
:root[data-theme="light"],
:root[data-theme="dark"] {
  --bg: #FAF6EE; --bg2: #FFFFFF; --bg3: #F2EADB;
  --fg: #241E18; --fg2: #7A6F5E; --fg3: #A39785;
  --accent: #D96B3D; --accent-2: #6E9B89; --accent-deep: #48705F;
  --border: rgba(36, 30, 24, 0.10);
}

/* ───── Cookie consent banner (RA-013, 2026-05-18; compact #320) ─────
   Sticky bottom bar. Visible when localStorage.cookieConsent is unset.
   Height budget: ≤48px + env(safe-area-inset-bottom). One line at 390px;
   wrap to two lines only below that so the bar never overflows. Buttons
   keep a 44px hit area; the visual pill is shorter via ::before. */
html body .cookie-banner {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 10000;
  background: var(--ink);
  color: #fff;
  padding: 2px 8px calc(2px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.22);
  font-size: 12px;
  line-height: 1.2;
}
html body .cookie-banner .cb-inner {
  max-width: var(--content-max);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-items: center;
  min-height: 44px;
}
html body .cookie-banner .cb-text {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
}
html body .cookie-banner .cb-text a {
  color: var(--orange-soft);
  text-decoration: underline;
  margin-left: 0.4em;
  white-space: nowrap;
}
html body .cookie-banner .cb-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}
html body .cookie-banner .cb-btn {
  position: relative;
  z-index: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 44px;
  min-width: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
html body .cookie-banner .cb-btn::before {
  content: "";
  position: absolute;
  z-index: -1;
  left: 0;
  right: 0;
  top: 50%;
  height: 28px;
  transform: translateY(-50%);
  border-radius: 999px;
  pointer-events: none;
}
html body .cookie-banner .cb-btn-accept { color: #fff; }
html body .cookie-banner .cb-btn-accept::before { background: var(--accent); }
html body .cookie-banner .cb-btn-accept:hover::before { filter: brightness(1.08); }
html body .cookie-banner .cb-btn-reject { color: #fff; }
html body .cookie-banner .cb-btn-reject::before {
  border: 1px solid rgba(255, 255, 255, 0.4);
}
html body .cookie-banner .cb-btn-reject:hover::before {
  background: rgba(255, 255, 255, 0.08);
}
html body .cookie-banner .cb-btn:focus-visible {
  outline: 2px solid var(--orange-soft);
  outline-offset: 2px;
}
@media (min-width: 390px) {
  html body .cookie-banner .cb-inner { flex-wrap: nowrap; }
  html body .cookie-banner .cb-text { white-space: nowrap; }
}

/* ───── Skip link (WCAG 2.4.1 Bypass Blocks) ─────
   Visually hidden by default; revealed when focused so keyboard users
   can see where focus is. RA-004 audit (2026-05-18): the previous
   left:-9999 trick worked for visually-hidden but Chrome treats
   off-screen elements as effectively non-focusable for :focus matching
   under modern focus heuristics. Switched to the standard visually
   hidden transform pattern, which both screen readers and Chrome accept.

   Canonical implementation lives here so every page (BaseLayout + the
   raw home page) picks up the same behaviour without page-local copies.
   Page-local overrides in src/lib/canonical/{detail,hub,sector,static}.ts
   + src/pages/_index-css.ts were removed in the same audit pass. */
html body a.skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 9999;
  background: var(--orange);
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(217, 107, 61, 0.28);
  /* Hide visually without removing from focus order: zero size + clip-path */
  transform: translateY(-200%);
  transition: transform 150ms ease;
}
html body a.skip-link:focus,
html body a.skip-link:focus-visible,
html body a.skip-link.is-focused {
  transform: translateY(0);
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ───── Global :focus-visible (WCAG 2.4.7 Focus Visible) ─────
   Every interactive element gets a visible focus ring when focused via
   keyboard. RA-004 audit (2026-05-18): site previously stripped outline
   to 0 site-wide, leaving keyboard users with no focus indicator. */
html body :focus-visible {
  outline: 2px solid var(--orange);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ───── Canonical typography (single source of truth) ───── */
/* Selector chain html body <tag> beats page-local bare-element rules. */

html body {
  font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
  /* RA-006 audit (2026-05-18): defence-in-depth against horizontal-swipe
     carousels (.m-top10-track etc.) leaking past their parent and
     triggering document-level horizontal scroll on narrow viewports. */
  overflow-x: clip;
}

/* RA-006 follow-up (2026-05-29): the clip above is on the body element, but
   the document scroll container is the root html element. The full-bleed
   carousel's negative-margin bleed still pushed documentElement.scrollWidth
   ~8px past the viewport on narrow widths (the visual e2e caught it). Clipping
   the root too removes the document-level horizontal scroll; overflow-x:clip
   leaves the y-axis visible, so vertical scroll and sticky are unaffected. */
html {
  overflow-x: clip;
}

html body h1,
html body h2,
html body h3,
html body h4 {
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  color: var(--fg);
  letter-spacing: -0.005em;
}

/* !important on h1/h2/h3 forces hero / nav / detail-article variations
   (specificity 0,0,1,1 from class-scoped rules) to fall back to the canonical
   site-wide typography. Trade-off: map's sticky nav h1 will be bigger; index
   hero h2 retracts; detail h1 normalises. User opted into uniform headings. */
html body h1 {
  font-size: 1.7rem !important;
  font-weight: 700 !important;
  line-height: 1.3 !important;
}

html body h2 {
  font-size: 1.15rem !important;
  font-weight: 600 !important;
  line-height: 1.4 !important;
}

html body h3 {
  font-size: 1rem !important;
  font-weight: 600 !important;
  line-height: 1.5 !important;
}

html body p {
  font-size: 1rem;
  line-height: 1.75;
  color: var(--fg);
}

/* Reset paragraph color inside the legacy "page intro / sub copy" wrappers
   that used a lighter shade. We keep the readable dark default for body
   content; a few legacy paragraphs styled themselves via direct color.
   No override needed — the html-body chain wins by specificity. */

/* ───── Site-wide footer (canonical) ───── */
/* Specificity 0,0,1,3 beats both page-local 'footer { ... }' (0,0,0,1)
   and any 'footer.foo { ... }' (0,0,1,1) without needing !important. */

html body footer.site-footer {
  max-width: none;
  margin: 48px auto 0;
  padding: 22px 16px 24px;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--fg2);
  text-align: center;
  font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  line-height: 1.65;
}
html body footer.site-footer a {
  color: var(--accent);
  text-decoration: none;
}
html body footer.site-footer a:hover {
  text-decoration: underline;
}
html body footer.site-footer .footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
  align-items: center;
  margin: 0;
}
html body footer.site-footer .footer-links a {
  color: var(--fg2);
  text-decoration: none;
  /* RA-009 (2026-05-18): tap target ≥24px (WCAG 2.5.8). Was 5px 14px →
     ~22px tall, now 8px 14px → ~28px tall. */
  padding: 8px 14px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.74rem;
  line-height: 1.2;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
}
html body footer.site-footer .footer-links a:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(217, 107, 61, 0.06);
  text-decoration: none;
}
/* Footer nav grouped by purpose (2026-05-31): a right-aligned label column
   keeps the chip rows aligned and reads as navigation, not a flat tag cloud. */
html body footer.site-footer .footer-nav {
  max-width: var(--content-max);
  margin: 0 auto 4px;
}
html body footer.site-footer .footer-group {
  display: flex;
  gap: 14px;
  align-items: baseline;
  margin-bottom: 12px;
}
html body footer.site-footer .footer-group-label {
  flex: 0 0 84px;
  text-align: right;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--fg2);
  opacity: 0.7;
  letter-spacing: 0.03em;
  white-space: nowrap;
  padding-top: 5px;
}
/* Demoted utility / legal row — plain text, separated from the content nav. */
html body footer.site-footer .footer-legal {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  max-width: 480px;
  margin: 16px auto 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  font-size: 0.72rem;
}
html body footer.site-footer .footer-legal a {
  color: var(--fg2);
  text-decoration: none;
}
html body footer.site-footer .footer-legal a:hover {
  color: var(--accent);
  text-decoration: underline;
}
html body footer.site-footer .footer-legal span {
  color: var(--fg2);
  opacity: 0.4;
}
@media (max-width: 560px) {
  html body footer.site-footer .footer-group {
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
  }
  html body footer.site-footer .footer-group-label {
    flex: none;
    text-align: center;
    padding-top: 0;
  }
  html body footer.site-footer .footer-group .footer-links {
    justify-content: center;
  }
}
html body footer.site-footer .footer-meta {
  color: var(--fg2);
  font-size: 0.7rem;
  opacity: 0.92;
  text-wrap: pretty;
  line-height: 1.65;
}
html body footer.site-footer .footer-meta a {
  color: var(--accent);
}
html body footer.site-footer .footer-meta em a {
  /* RA follow-up (2026-05-29): this disclaimer link sits inside body text, so
     color alone is not a sufficient distinction (axe link-in-text-block /
     WCAG 1.4.1). An underline gives the required non-color cue. */
  text-decoration: underline;
}
html body footer.site-footer .footer-meta .nowrap {
  white-space: nowrap;
}
html body footer.site-footer .footer-meta em {
  font-style: italic;
}
html body footer.site-footer time {
  font-variant-numeric: tabular-nums;
}

/* ───── Footer share section ───── */
/* Phase 8: 7 share buttons (X / LINE / Hatena / LinkedIn / Facebook / Copy /
   Native) sit at the very top of the footer on every page. Each button
   shares the CURRENT page URL via window.location.href; per-platform brand
   color appears on hover. */

html body footer.site-footer .share-divider {
  font-size: 0.74rem;
  color: var(--fg2);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 auto 14px;
  max-width: 480px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}
html body footer.site-footer .share-divider::before,
html body footer.site-footer .share-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}
@media (min-width: 769px) {
  html body footer.site-footer .share-divider { max-width: 720px; }
}

html body footer.site-footer .share-row {
  display: flex;
  gap: 10px;
  margin: 0 auto 24px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  max-width: 720px;
}

html body footer.site-footer .share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--fg2);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease;
  text-decoration: none;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
html body footer.site-footer .share-btn[hidden] { display: none; }
html body footer.site-footer .share-btn:hover {
  transform: translateY(-1px);
  border-color: transparent;
  color: #fff;
  text-decoration: none;
}
html body footer.site-footer .share-btn[data-platform="x"]:hover        { background: #000; }
html body footer.site-footer .share-btn[data-platform="line"]:hover     { background: #06C755; }
html body footer.site-footer .share-btn[data-platform="hatena"]:hover   { background: #00A4DE; }
html body footer.site-footer .share-btn[data-platform="linkedin"]:hover { background: #0A66C2; }
html body footer.site-footer .share-btn[data-platform="facebook"]:hover { background: #1877F2; }
html body footer.site-footer .share-btn[data-platform="copy"]:hover,
html body footer.site-footer .share-btn[data-platform="native"]:hover   { background: var(--accent); color: #1a1206; }
html body footer.site-footer .share-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
html body footer.site-footer .share-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

html body footer.site-footer .share-toast {
  font-size: 0.78rem;
  color: var(--accent);
  margin-left: 6px;
  opacity: 0;
  transition: opacity 200ms ease;
  font-variant-numeric: tabular-nums;
}
html body footer.site-footer .share-toast.visible { opacity: 1; }

@media (max-width: 540px) {
  html body footer.site-footer .share-row { gap: 8px; }
  html body footer.site-footer .share-btn { width: 36px; height: 36px; }
  html body footer.site-footer .share-toast {
    flex-basis: 100%;
    text-align: center;
    margin: 6px 0 0;
  }
}
/* RA-124 (2026-05-18): very narrow viewports (≤340px, common older Android)
   were wrapping the 7-button share row into 5+2 layout. Shrink button + gap
   so 7 buttons fit: 32 × 7 + 4 × 6 = 248px content width. */
@media (max-width: 340px) {
  html body footer.site-footer .share-row { gap: 4px; }
  html body footer.site-footer .share-btn { width: 32px; height: 32px; }
  html body footer.site-footer .share-btn svg { width: 16px; height: 16px; }
}

/* ───── Top navigation (canonical, sticky slim bar) ───── */
/* Magazine-style top masthead: sticky to viewport top, warm-cream backdrop
   with subtle blur. Provides lateral nav across all hub categories without
   stealing space from content (collapses on scroll-down via CSS only).
   Specificity 0,0,1,3 beats page-local nav rules. */

html body nav.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  /* Full-bleed sticky bar, but the brand + links align to the same centered
     content column as the page body (no inner wrapper needed). On viewports
     narrower than --content-max the max() floor keeps a 20px gutter. */
  padding: 11px max(20px, calc((100% - var(--content-max)) / 2));
  background: rgba(252, 248, 241, 0.92);
  backdrop-filter: saturate(140%) blur(8px);
  -webkit-backdrop-filter: saturate(140%) blur(8px);
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
  line-height: 1.4;
  font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
}
html[data-theme="dark"] body nav.top-nav {
  background: rgba(28, 22, 18, 0.92);
}
/* Solid fallback for browsers without backdrop-filter (Firefox <103, etc). */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  html body nav.top-nav { background: var(--bg); }
}

html body nav.top-nav .top-nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 600;
  font-size: 1rem;
  color: var(--fg);
  text-decoration: none;
  margin-right: 6px;
  letter-spacing: -0.005em;
}
html body nav.top-nav .top-nav-brand:hover {
  color: var(--accent);
  text-decoration: none;
}
html body nav.top-nav .top-nav-brand-mark {
  color: var(--accent);
  flex-shrink: 0;
}

html body nav.top-nav a:not(.top-nav-brand) {
  color: var(--fg2);
  text-decoration: none;
  padding: 2px 0;
  font-size: 0.9rem;
  transition: color 150ms ease;
}
html body nav.top-nav a:not(.top-nav-brand):hover {
  color: var(--accent);
  text-decoration: none;
}
html body nav.top-nav a[aria-current="page"] {
  color: var(--accent);
  font-weight: 600;
}

html body nav.top-nav .sep {
  color: var(--fg2);
  opacity: 0.6;
  font-size: 0.85rem;
  user-select: none;
}

@media (max-width: 540px) {
  html body nav.top-nav {
    padding: 9px 14px;
    gap: 4px 10px;
    font-size: 0.78rem;
  }
  html body nav.top-nav .top-nav-brand { font-size: 0.92rem; }
}

/* When the page <header id="content"> sits directly under the sticky nav,
   the first heading needs extra top-margin so the nav doesn't visually
   crowd it. This is content-side breathing room, not a nav property. */
html body nav.top-nav ~ main nav.crumb,
html body nav.top-nav ~ main #wrapper > nav.crumb {
  margin-top: 16px;
}

/* ───── Mobile nav (mobile-only sticky topbar + full-screen drawer) ───── */
/* On viewports ≤768px, the desktop sticky slim bar is hidden and replaced
   by a 44px-tall topbar (brand + ハンバーガー). Tap the burger to open a
   full-screen drawer with all 24 hub categories grouped into 3 sections.
   85% of traffic is mobile — this is the canonical primary navigation. */

/* Hide desktop top-nav on mobile, show mobile topbar */
@media (max-width: 768px) {
  html body nav.top-nav { display: none !important; }
}
/* Hide mobile components on desktop */
@media (min-width: 769px) {
  html body header.mob-topbar,
  html body div.mob-drawer { display: none !important; }
}

@media (max-width: 768px) {
  /* ── Layer 1: top bar ── */
  html body header.mob-topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 12px 0 16px;
    background: rgba(252, 248, 241, 0.94);
    backdrop-filter: saturate(140%) blur(10px);
    -webkit-backdrop-filter: saturate(140%) blur(10px);
    border-bottom: 1px solid var(--border);
  }
  html[data-theme="dark"] body header.mob-topbar {
    background: rgba(28, 22, 18, 0.94);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    html body header.mob-topbar { background: var(--bg); }
  }

  html body header.mob-topbar a.mob-topbar-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg);
    text-decoration: none;
    letter-spacing: -0.005em;
    padding: 6px 4px;
    min-height: 44px;
  }
  html body header.mob-topbar a.mob-topbar-brand:hover { color: var(--accent); }
  html body header.mob-topbar a.mob-topbar-brand svg {
    color: var(--accent);
    flex-shrink: 0;
  }

  html body header.mob-topbar button.mob-topbar-burger {
    width: 44px;
    height: 44px;
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    padding: 0;
    transition: background 150ms;
  }
  html body header.mob-topbar button.mob-topbar-burger:hover {
    background: var(--bg2);
  }
  html body header.mob-topbar button.mob-topbar-burger:active {
    background: var(--bg3);
  }
  html body header.mob-topbar button.mob-topbar-burger span {
    display: block;
    width: 18px;
    height: 1.5px;
    background: var(--fg);
    border-radius: 1px;
    transition: transform 200ms ease, opacity 150ms ease;
  }
  html body header.mob-topbar button.mob-topbar-burger[aria-expanded="true"] span:nth-child(1) {
    transform: translateY(5.5px) rotate(45deg);
  }
  html body header.mob-topbar button.mob-topbar-burger[aria-expanded="true"] span:nth-child(2) {
    opacity: 0;
  }
  html body header.mob-topbar button.mob-topbar-burger[aria-expanded="true"] span:nth-child(3) {
    transform: translateY(-5.5px) rotate(-45deg);
  }

  /* ── Layer 2: full-screen drawer ── */
  html body div.mob-drawer {
    position: fixed;
    top: 48px;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg);
    z-index: 99;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-12px);
    transition: opacity 220ms ease, transform 220ms ease;
  }
  html body div.mob-drawer:not([hidden]) {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
  html body div.mob-drawer .mob-drawer-inner {
    padding: 10px 14px 60px;
    max-width: 560px;
    margin: 0 auto;
  }

  /* RA-122 (2026-05-18): drawer scrollHeight reduction.
     Previously 1858px / 760 viewport = 2.4 screens of scroll to reach
     section 3. Tightened section padding 18→12px, list gap 6→4px, and
     item min-height 56→48px. New total ~1380px = 1.8 screens. Still
     scrollable on a 760px viewport but section 3 is reachable in 1
     thumb-swipe (was 2). */
  html body div.mob-drawer section.mob-drawer-sec {
    margin: 12px 0;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 14px 12px;
  }
  html body div.mob-drawer section.mob-drawer-sec:first-child { margin-top: 6px; }

  /* Section header: serif-bold title with accent dot + italic lede.
     1.05rem (vs 0.7rem before) makes the heading read as a clear category
     title, not a tiny editorial kicker. !important needed because the canonical
     html-body chain forces h3 to 1rem; this title needs to be larger. */
  html body div.mob-drawer header.mob-drawer-sec-head {
    margin: 0 0 14px;
    padding: 0 0 12px;
    border-bottom: 1px solid var(--border);
  }
  html body div.mob-drawer .mob-drawer-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif !important;
    font-size: 1.05rem !important;
    font-weight: 700 !important;
    line-height: 1.35 !important;
    color: var(--fg);
    margin: 0 0 5px !important;
    letter-spacing: -0.005em;
  }
  html body div.mob-drawer .mob-drawer-title-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: var(--accent);
    border-radius: 50%;
    flex-shrink: 0;
  }
  html body div.mob-drawer p.mob-drawer-lede {
    font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
    font-size: 0.8rem;
    font-style: italic;
    color: var(--fg2);
    line-height: 1.5;
    margin: 0 0 0 17px;  /* align under the dot+title baseline */
  }

  /* List wrapper — items are individual cards stacked with 6px gap, NOT a
     bottom-border list. Card style makes "buttonness" explicit. */
  html body div.mob-drawer .mob-drawer-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* RA-122: item min-height 56→48px (still WCAG 2.5.5 enhanced 44+ + Apple
     HIG 44+ minimum tap target). Padding tightened 12→10/12px. */
  html body div.mob-drawer a.mob-drawer-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 10px 12px 10px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--fg);
    text-decoration: none;
    font-size: 1rem;
    font-weight: 500;
    transition: transform 100ms ease, border-color 150ms ease, background 150ms ease;
  }
  html body div.mob-drawer a.mob-drawer-item:hover {
    background: rgba(217, 107, 61, 0.04);
    border-color: var(--accent);
    text-decoration: none;
  }
  html body div.mob-drawer a.mob-drawer-item:active {
    transform: scale(0.98);
    background: rgba(217, 107, 61, 0.08);
    border-color: var(--accent);
  }

  html body div.mob-drawer .mob-drawer-label {
    font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
    color: var(--fg);
    flex: 1 1 auto;
    line-height: 1.35;
  }
  html body div.mob-drawer .mob-drawer-meta {
    font-size: 0.76rem;
    color: var(--fg2);
    font-weight: 400;
    flex-shrink: 0;
    text-align: right;
  }
  html body div.mob-drawer .mob-drawer-count {
    font-size: 0.78rem;
    color: var(--fg2);
    font-variant-numeric: tabular-nums;
    background: var(--bg2);
    padding: 3px 10px;
    border-radius: 999px;
    /* RA-123 (2026-05-18): uniform width across single/double-digit counts.
       Was min-width:32px → 32 for single-digit + 35 for double-digit (3px
       left-edge jitter). Now min-width:38px forces all badges same width. */
    min-width: 38px;
    text-align: center;
    font-weight: 500;
    flex-shrink: 0;
  }
  /* Right chevron — flat, light-weight, no underline. Visual hint that the
     row is a "go to" button, not just static text. */
  html body div.mob-drawer .mob-drawer-arrow {
    color: var(--fg2);
    font-size: 1.3rem;
    font-weight: 300;
    line-height: 1;
    flex-shrink: 0;
    margin-left: 2px;
    transition: color 150ms, transform 150ms;
  }
  html body div.mob-drawer a.mob-drawer-item:hover .mob-drawer-arrow,
  html body div.mob-drawer a.mob-drawer-item:active .mob-drawer-arrow {
    color: var(--accent);
    transform: translateX(2px);
  }

  /* Honor reduced motion */
  @media (prefers-reduced-motion: reduce) {
    html body div.mob-drawer { transition: none; }
    html body header.mob-topbar button.mob-topbar-burger span { transition: none; }
    html body div.mob-drawer a.mob-drawer-item,
    html body div.mob-drawer a.mob-drawer-item:active,
    html body div.mob-drawer .mob-drawer-arrow { transition: none; transform: none; }
  }
}

/* RA-139 — cross-page "自分の現在地" CTA strip (placed before <footer> on hub pages) */
.me-cta-strip {
  margin: 48px 0 24px;
  padding: 20px 24px;
  background: var(--bg2, #FFFFFF);
  border: 1px solid var(--border, rgba(36,30,24,0.10));
  border-left: 4px solid var(--accent, #D96B3D);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}
.me-cta-strip p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--fg, #241E18);
  line-height: 1.5;
  flex: 1 1 320px;
}
.me-cta-strip p strong {
  color: var(--accent-deep, #48705F);
  font-weight: 600;
}
.me-cta-strip a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 20px;
  min-height: 44px;
  background: var(--accent, #D96B3D);
  color: var(--bg, #FAF6EE);
  text-decoration: none;
  border-radius: 999px;
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 120ms, transform 120ms;
}
.me-cta-strip a:hover {
  background: var(--accent-deep, #48705F);
  transform: translateY(-1px);
}
.me-cta-strip a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .me-cta-strip { padding: 16px 18px; flex-direction: column; align-items: stretch; gap: 12px; }
  .me-cta-strip p { flex: 0 0 auto; }
  .me-cta-strip a { justify-content: center; }
}

/* ───── Shared chapter fold (#321; reused by later mobile-shape issues) ─────
   Mobile default is closed. A static bodyEnd helper sets open at
   min-width 900px; this block only hides the chevron on desktop. */
html body details.chap {
  margin: 8px 0 32px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg2);
}
html body details.chap > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  min-height: 44px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--fg);
}
html body details.chap > summary::-webkit-details-marker { display: none; }
html body details.chap > summary::after {
  content: "›";
  flex-shrink: 0;
  color: var(--fg3);
  font-size: 1.15rem;
  line-height: 1;
  transform: rotate(90deg);
}
html body details.chap[open] > summary::after { transform: rotate(-90deg); }
html body details.chap .chap-body { padding: 0 16px 16px; }
@media (min-width: 900px) {
  html body details.chap > summary::after { display: none; }
}
`;
