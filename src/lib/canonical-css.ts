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

import { DESIGN_TOKENS_CSS, DESIGN_VERSION } from './design-tokens.js';

export const CANONICAL_CSS = `
/* Design v${DESIGN_VERSION} */
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

/* The UA gives body an 8px margin; every class used to reset it in its own
   CSS and /aiadoption did not, so its whole page sat 8px in (2026-09-20). */
html body { margin: 0; }

/* 文節 break for headings: a <br class="ja-phrase-break"> renders only on
   narrow viewports, so a title breaks between phrases instead of inside a
   number or a word (「…を9 / 問で見る」). Was home-only until 2026-09-20. */
html body .ja-phrase-break { display: inline; }
@media (min-width: 769px) { html body .ja-phrase-break { display: none; } }

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
  --line: color-mix(in srgb, var(--ink) 6%, transparent);
  --line-strong: color-mix(in srgb, var(--ink) 12%, transparent);
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
  --border: color-mix(in srgb, var(--ink) 10%, transparent);
  --font-serif: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  --font-sans: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  /* 第 3 層 — AI-impact (risk) color scale: --risk-0..4, --risk-soft-0..4 and
     the per-band tile foreground --risk-fg-0..4. Declared in
     src/lib/design-tokens.ts (RISK, §2.3) and emitted below with the other
     tokens (2026-09-20, design-1.21) — one source for CSS, OG renderers and
     the inline map/treemap scripts. Was 7 ad-hoc hardcoded ramps; 2026-05-31. */
  /* Pills: soft-tint background (from the scale) + readable dark text. */
  --risk-pill-low-bg: var(--risk-soft-0);  --risk-pill-low-fg: #446a5a;
  --risk-pill-mid-bg: var(--risk-soft-2);  --risk-pill-mid-fg: #826427;
  --risk-pill-high-bg: var(--risk-soft-3); --risk-pill-high-fg: #A24A28;
  /* 第 4 層 — layout. Single content-column width: every page's #wrapper / main
     references this, and the top-nav + footer align to it, so the content edge
     is identical across the map, occupation, hub, sector, and legal pages.
     (2026-05-31: replaced 6 ad-hoc per-page widths 740/760/820/900/980/1080.) */
  --content-max: 1080px;
  /* §9.1 — the column's inside gutter: --s-5 (24px) from 600px, --s-4 (16px)
     below (see the html rule after this block). Every wrapper, the top nav,
     the mobile topbar and full-bleed bands reference this and nothing else,
     so the brand and the first line of every page share a left edge at every
     width. */
  --gutter: var(--s-5);
  /* 第 5 層 — Design v1.0 tokens。値の正典は src/lib/design-tokens.ts
     (Design.md §21.2)。移行 step 1 の時点では宣言のみで参照者はゼロであり、
     未参照のカスタムプロパティは描画に影響しない。消費者は §19.5 の順序で
     surface ごとに接続していく。 */
${DESIGN_TOKENS_CSS}
}
/* :root, not html — the declaration above is on :root (0,1,0) and would beat an
   html rule (0,0,1) regardless of order. */
@media (max-width: 599px) {
  :root { --gutter: var(--s-4); }
}

/* Dark mode neutralized: theme は Design.md §3 で NEUTRALIZED 状態。
   [data-theme="light"] / ["dark"] / prefers-color-scheme すべて同じ cream に解決。 */
:root[data-theme="light"],
:root[data-theme="dark"] {
  --bg: #FAF6EE; --bg2: #FFFFFF; --bg3: #F2EADB;
  --fg: #241E18; --fg2: #7A6F5E; --fg3: #A39785;
  --accent: #D96B3D; --accent-2: #6E9B89; --accent-deep: #48705F;
  --border: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* ───── Cookie consent banner (RA-013, 2026-05-18; compact #320) ─────
   Sticky bottom bar. Visible when localStorage.cookieConsent is unset.
   Height budget: ≤48px + env(safe-area-inset-bottom). One line at 390px;
   wrap to two lines only below that so the bar never overflows. Buttons
   keep a 44px hit area; the visual pill is shorter via ::before. */
html body .cookie-banner {
  position: fixed;
  inset: auto 0 0 0;
  z-index: var(--z-toast);
  background: var(--ink);
  color: #fff;
  padding: 2px 8px calc(2px + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--sh-sheet);
  font-size: var(--t-xs);
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
  font-size: var(--t-xs);
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
  font-size: var(--t-xs);
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
  border: 1px solid color-mix(in srgb, var(--paper) 40%, transparent);
}
html body .cookie-banner .cb-btn-reject:hover::before {
  background: color-mix(in srgb, var(--paper) 8%, transparent);
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
  z-index: var(--z-toast);
  background: var(--orange-hot);
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--orange) 28%, transparent);
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
  font-size: var(--t-body);
  line-height: var(--lh-body);
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

/* Design.md §4.3 — 見出しは 4 級 + Display の 5 段。書体の分界は H2 と H3 の間。
   セリフ (Display / H1 / H2) は配信 1 ファイルで 400–700 が同一に描画されるため
   字号だけで階層を作る。H3 (18px) / H4 (16px) では字号差が足りず、字重を実際に
   持っているのはサンセリフだけなので、ここでサンセリフ 700 に切り替える (§4.4)。 */
/* §4.2 — the 12px floor has no exception, and a bare <small> is the one way to
   fall through it without declaring anything: the UA default is 0.83em, so a
   <small> inside a --t-sm parent renders at 11.67px and inside --t-xs at 10px.
   check-type-scale reads declared values and cannot see an inherited one, which
   is why /haid shipped an 11.67px <small> through a green board. Give the
   element the caption step (§4.7 caption・出典) so the floor holds by default;
   a page that wants a different size still sets it with a class. */
html body small {
  font-size: var(--t-xs);
}

html body h1,
html body h2 {
  font-family: var(--font-serif);
  color: var(--fg);
  letter-spacing: -0.005em;
}

html body h3,
html body h4 {
  font-family: var(--font-sans);
  color: var(--fg);
  letter-spacing: -0.005em;
}

/* design-1.9 (§4.9.1) removed the !important that used to sit on every one of
   these declarations. It existed to suppress class-scoped page heading rules;
   all of them are gone now, so html body h1 (specificity 0,0,0,3) governs on
   its own and the specificity war is over. Nothing in src/ may reintroduce
   an !important on font-size (§4.9).

   font-weight is NOT declared on h1/h2: the shipped serif renders 400/500/
   600/700 identically (measured 595.97px at each), so writing a weight there
   is a claim the font cannot honour (§4.5). */
html body h1 {
  font-size: var(--t-h1);
  line-height: var(--lh-h1);
}

html body h2 {
  font-size: var(--t-h2);
  line-height: var(--lh-h2);
}

html body h3 {
  font-size: var(--t-h3);
  font-weight: 700;
  line-height: var(--lh-h3);
}

/* Feature class (§4.8) — exactly / , /models and /aiadoption. The class grants
   ONE thing: permission to put the page title on --t-display. Everything below
   H1 is identical to every other class, and arbitrary values are not permitted
   even here.

   body.page-feature h1 is (0,0,1,2) and beats html body h1 (0,0,0,3) on
   specificity, so the result does not depend on declaration order and no
   !important is needed. The class is set through BaseLayout's existing
   bodyClass prop. */
html body.page-feature h1 {
  font-size: var(--t-display);
  line-height: var(--lh-display);
}

html body h4 {
  font-size: var(--t-body);
  font-weight: 700;
  line-height: var(--lh-h4);
}

html body p {
  font-size: var(--t-body);
  line-height: var(--lh-body);
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
  /* No border-top: the share divider 23px below it already draws the rule
     that separates the footer from the page, so this was a second line on
     every page (owner ruling 2026-09-20). */
  font-size: var(--t-xs);
  color: var(--fg2);
  text-align: center;
  font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  line-height: 1.65;
}
html body footer.site-footer a {
  color: var(--orange-hot);
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
  font-size: var(--t-xs);
  line-height: 1.2;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
}
html body footer.site-footer .footer-links a:hover {
  color: var(--orange-hot);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--orange) 6%, transparent);
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
  font-size: var(--t-xs);
  font-weight: 600;
  color: var(--ink-meta);
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
  font-size: var(--t-xs);
}
html body footer.site-footer .footer-legal a {
  color: var(--fg2);
  text-decoration: none;
}
html body footer.site-footer .footer-legal a:hover {
  color: var(--orange-hot);
  text-decoration: underline;
}
html body footer.site-footer .footer-legal span {
  color: var(--ink-meta);
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
/* Design.md §4.7 本文中の行内強調 — em reads like strong: ink, 700, upright.
   The UA stylesheet makes em italic; the shipped fonts have no italic faces
   (scripts/subset-fonts.ts emits font-style:normal only), so any italic on
   this site is a synthesised oblique. Site-wide base; page CSS may not
   reintroduce font-style:italic (design-1.21). */
html body em {
  font-style: normal;
  font-weight: 700;
  color: var(--ink);
}
html body footer.site-footer .footer-meta {
  color: var(--ink-meta);
  font-size: var(--t-xs);
  text-wrap: pretty;
  line-height: 1.65;
}
html body footer.site-footer .footer-meta a {
  color: var(--orange-hot);
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
html body footer.site-footer time {
  font-variant-numeric: tabular-nums;
}

/* ───── Footer share section ───── */
/* Phase 8: 7 share buttons (X / LINE / Hatena / LinkedIn / Facebook / Copy /
   Native) sit at the very top of the footer on every page. Each button
   shares the CURRENT page URL via window.location.href; per-platform brand
   color appears on hover. */

html body footer.site-footer .share-divider {
  font-size: var(--t-xs);
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
  font-size: var(--t-xs);
  color: var(--orange-hot);
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
  /* Full-bleed sticky bar, but the brand + links align to the TEXT edge of
     the centered content column: column edge + the --s-5 gutter every page
     wrapper uses (§9.1). Until 2026-09-20 the nav sat on the column's outer
     edge while page text started 20–32px further in, so the brand and the
     first line of every page were visibly out of line. On viewports narrower
     than --content-max the max() floor keeps the same --s-5 gutter. */
  padding: 11px max(var(--gutter), calc((100% - var(--content-max)) / 2 + var(--gutter)));
  background: rgba(252, 248, 241, 0.92);
  backdrop-filter: saturate(140%) blur(8px);
  -webkit-backdrop-filter: saturate(140%) blur(8px);
  border-bottom: 1px solid var(--border);
  font-size: var(--t-sm);
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
  font-size: var(--t-body);
  color: var(--fg);
  text-decoration: none;
  margin-right: 6px;
  letter-spacing: -0.005em;
}
html body nav.top-nav .top-nav-brand:hover {
  color: var(--orange-hot);
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
  font-size: var(--t-sm);
  transition: color 150ms ease;
}
html body nav.top-nav a:not(.top-nav-brand):hover {
  color: var(--orange-hot);
  text-decoration: none;
}
/* Design.md §4 role table — グローバルナビの現在地は --orange-hot + 下線。
   色だけで現在地を示さない。 */
html body nav.top-nav a[aria-current="page"] {
  color: var(--orange-hot);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.06em;
  text-underline-offset: 0.2em;
}

html body nav.top-nav .sep {
  color: var(--ink-meta);
  font-size: var(--t-xs);
  user-select: none;
}

@media (max-width: 540px) {
  html body nav.top-nav {
    padding: 9px 14px;
    gap: 4px 10px;
    font-size: var(--t-sm);
  }
  html body nav.top-nav .top-nav-brand { font-size: var(--t-body); }
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
  html body div.mob-drawer,
  html body div.mob-search { display: none !important; }
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
    /* §9.1: the brand sits on the column's text edge (--gutter). */
    padding: 0 12px 0 var(--gutter);
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
    font-size: var(--t-body);
    font-weight: 600;
    color: var(--fg);
    text-decoration: none;
    letter-spacing: -0.005em;
    padding: 6px 4px;
    min-height: 44px;
  }
  html body header.mob-topbar a.mob-topbar-brand:hover { color: var(--orange-hot); }
  html body header.mob-topbar a.mob-topbar-brand svg {
    color: var(--accent);
    flex-shrink: 0;
  }

  html body header.mob-topbar .mob-topbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }
  html body header.mob-topbar button.mob-topbar-search {
    width: 44px;
    height: 44px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    padding: 0;
    color: var(--fg);
  }
  html body header.mob-topbar button.mob-topbar-search:hover {
    background: var(--bg2);
  }
  html body header.mob-topbar button.mob-topbar-search:active {
    background: var(--bg3);
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

  /* ── Search overlay (#327): above top bar (100) / drawer (99), below skip (9999) / cookie (10000) ── */
  html body div.mob-search {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    background: var(--bg);
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    overflow: hidden;
  }
  html body div.mob-search[hidden] { display: none !important; }
  html body div.mob-search .mob-search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  html body div.mob-search .mob-search-bar input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg2);
    color: var(--fg);
    font: inherit;
    font-size: var(--t-body);
  }
  html body div.mob-search .mob-search-bar input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }
  html body div.mob-search .mob-search-close {
    flex-shrink: 0;
    min-height: 44px;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: var(--fg2);
    font: inherit;
    font-size: var(--t-sm);
    font-weight: 700;
    cursor: pointer;
    word-break: keep-all;
  }
  html body div.mob-search .mob-search-hint {
    margin: 10px 4px 12px;
    font-size: var(--t-xs);
    color: var(--fg2);
  }
  html body div.mob-search .mob-search-results,
  html body div.mob-search .mob-search-recent-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    min-height: 0;
  }
  html body div.mob-search .mob-search-results { flex: 1 1 auto; }
  html body div.mob-search .mob-search-results:empty { display: none; }
  html body div.mob-search .mob-search-recent { flex: 0 1 auto; overflow-y: auto; min-height: 0; }
  html body div.mob-search .mob-search-kicker,
  html body div.mob-search .mob-search-empty-head {
    margin: 0 4px 8px;
    font-size: var(--t-xs);
    color: var(--fg2);
    font-weight: 700;
  }
  html body div.mob-search a.mob-search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    column-gap: 12px;
    row-gap: 2px;
    align-items: center;
    min-height: 44px;
    padding: 12px 14px;
    background: var(--bg2);
    border: 1px solid color-mix(in srgb, var(--fg3) 30%, transparent);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
  }
  html body div.mob-search a.mob-search-row:hover { text-decoration: none; border-color: var(--accent); }
  html body div.mob-search .mob-search-name {
    grid-column: 1;
    grid-row: 1;
    font-size: var(--t-h3);
    font-weight: 600;
    line-height: 1.3;
    color: var(--fg);
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  html body div.mob-search .mob-search-sub {
    grid-column: 1;
    grid-row: 2;
    font-size: var(--t-xs);
    color: var(--fg2);
  }
  html body div.mob-search .mob-search-pill {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: var(--t-xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  html body div.mob-search .mob-search-pill.low { color: var(--risk-pill-low-fg); background: var(--risk-pill-low-bg); }
  html body div.mob-search .mob-search-pill.mid { color: var(--risk-pill-mid-fg); background: var(--risk-pill-mid-bg); }
  html body div.mob-search .mob-search-pill.high { color: var(--risk-pill-high-fg); background: var(--risk-pill-high-bg); }
  html body div.mob-search .mob-search-doors {
    flex-shrink: 0;
    margin-top: 12px;
    padding-top: 8px;
  }
  html body div.mob-search .mob-search-door-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  html body div.mob-search .mob-search-door-row a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg2);
    color: var(--fg);
    text-decoration: none;
    font-size: var(--t-sm);
    font-weight: 700;
    word-break: keep-all;
  }
  html body div.mob-search .mob-search-door-row a:hover {
    border-color: var(--accent);
    color: var(--orange-hot);
    text-decoration: none;
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
    /* §4.9 — no !important on font-size anywhere. §4.4-1 — serif is Display /
       H1 / H2 only, and this drawer title sits at H3 size, so it is sans. */
    font-family: var(--font-sans);
    font-size: var(--t-h3);
    font-weight: 700;
    line-height: var(--lh-h3);
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
    font-size: var(--t-xs);
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
    font-size: var(--t-body);
    font-weight: 500;
    transition: transform 100ms ease, border-color 150ms ease, background 150ms ease;
  }
  html body div.mob-drawer a.mob-drawer-item:hover {
    background: color-mix(in srgb, var(--orange) 4%, transparent);
    border-color: var(--accent);
    text-decoration: none;
  }
  html body div.mob-drawer a.mob-drawer-item:active {
    transform: scale(0.98);
    background: color-mix(in srgb, var(--orange) 8%, transparent);
    border-color: var(--accent);
  }

  html body div.mob-drawer .mob-drawer-label {
    font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
    color: var(--fg);
    flex: 1 1 auto;
    line-height: 1.35;
  }
  html body div.mob-drawer .mob-drawer-meta {
    font-size: var(--t-xs);
    color: var(--fg2);
    font-weight: 400;
    flex-shrink: 0;
    text-align: right;
  }
  html body div.mob-drawer .mob-drawer-count {
    font-size: var(--t-xs);
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
    font-size: var(--t-h2);
    font-weight: 300;
    line-height: 1;
    flex-shrink: 0;
    margin-left: 2px;
    transition: color 150ms, transform 150ms;
  }
  html body div.mob-drawer a.mob-drawer-item:hover .mob-drawer-arrow,
  html body div.mob-drawer a.mob-drawer-item:active .mob-drawer-arrow {
    color: var(--orange-hot);
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
  border: 1px solid var(--border, color-mix(in srgb, var(--ink) 10%, transparent));
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
  font-size: var(--t-sm);
  color: var(--fg, #241E18);
  line-height: 1.5;
  flex: 1 1 320px;
}
.me-cta-strip p strong {
  color: var(--ink);
  font-weight: 600;
}
.me-cta-strip a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 20px;
  min-height: 44px;
  background: var(--orange-hot, #c0411e);
  color: var(--bg, #FAF6EE);
  text-decoration: none;
  border-radius: 999px;
  font-size: var(--t-sm);
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
  font-size: var(--t-body);
  color: var(--fg);
}
html body details.chap > summary::-webkit-details-marker { display: none; }
html body details.chap > summary::after {
  content: "›";
  flex-shrink: 0;
  color: var(--ink-meta);
  font-size: var(--t-h3);
  line-height: 1;
  transform: rotate(90deg);
}
html body details.chap[open] > summary::after { transform: rotate(-90deg); }
html body details.chap .chap-body { padding: 0 16px 16px; }
@media (min-width: 900px) {
  html body details.chap > summary::after { display: none; }
}
`;
