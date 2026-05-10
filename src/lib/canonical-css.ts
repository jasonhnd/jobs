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
 *   `/compliance`, `/privacy`, `/404`, `/map`, `/ja/sectors`,
 *   `/ja/sectors/<slug>`, `/ja/rankings/<slug>`, and `/ja/<id>` we measured
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
/* ───── Canonical typography (single source of truth) ───── */
/* Selector chain html body <tag> beats page-local bare-element rules. */

html body {
  font-family: "Plus Jakarta Sans", "Hiragino Sans", -apple-system, BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}

html body h1,
html body h2,
html body h3,
html body h4 {
  font-family: "Noto Serif JP", "Source Serif Pro", Georgia, serif;
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
  justify-content: center;
  align-items: center;
  margin-bottom: 14px;
}
html body footer.site-footer .footer-links a {
  color: var(--fg2);
  text-decoration: none;
  padding: 5px 14px;
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
html body footer.site-footer .footer-meta .nowrap {
  white-space: nowrap;
}
html body footer.site-footer .footer-meta em {
  font-style: italic;
}
html body footer.site-footer time {
  font-variant-numeric: tabular-nums;
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
  align-items: baseline;
  gap: 4px 14px;
  padding: 11px 20px;
  background: rgba(252, 248, 241, 0.92);
  backdrop-filter: saturate(140%) blur(8px);
  -webkit-backdrop-filter: saturate(140%) blur(8px);
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
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
  font-family: "Noto Serif JP", "Source Serif Pro", Georgia, serif;
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

html body nav.top-nav a:not(.top-nav-brand) {
  color: var(--fg2);
  text-decoration: none;
  padding: 2px 0;
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
  opacity: 0.4;
  font-size: 0.7rem;
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
html body nav.top-nav + .skip-link + #wrapper > nav.crumb,
html body nav.top-nav + #wrapper > nav.crumb {
  margin-top: 8px;
}
`;
