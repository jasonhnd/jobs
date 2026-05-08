/**
 * canonical-css.ts — single source of truth for site-wide typography +
 * footer styling. Loaded by:
 *
 *   src/components/Footer.astro       → emits via <style is:global>
 *   src/pages/index.astro              → injected into raw <head> via regex
 *
 * Why this file exists:
 *   The 10 page templates that came from the legacy Python build each had
 *   their own inline <style slot="head"> with hand-tuned font sizes,
 *   weights, and colors. Across `/`, `/about`, `/compliance`, `/privacy`,
 *   `/404`, `/map`, `/ja/sectors`, `/ja/sectors/<slug>`,
 *   `/ja/rankings/<slug>`, and `/ja/<id>` we measured **10 different
 *   typography systems** (h1 sizes 22px–40px, p colors fg vs fg2, p sizes
 *   14.4px–16.32px, line-heights 1.55–1.75). The user reported that pages
 *   "look different from each other" — they were right.
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

html body h1 {
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.3;
}

html body h2 {
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.4;
}

html body h3 {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
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
`;
