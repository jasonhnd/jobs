/**
 * src/pages/_index-bindings.ts — fs-read helpers for the homepage.
 *
 * After the BaseLayout migration (2026-05-18, RA-??), the homepage no longer
 * carries its own `<head>` / `<nav>` / `<footer>` / cookie banner / analytics.
 * BaseLayout owns all of those — env-driven (single source of truth) instead
 * of the previous duplicate hardcoding (GA4 ID `G-GLDNBDPF13`, X Pixel
 * `rC3xs`, Meta Pixel `1476745404149398` had been pasted twice).
 *
 * The three files below hold what's left of the homepage:
 *   • index-source.html — the body fragment (just `<div id="wrapper">…</div>`).
 *   • _index-json-ld.json — the JSON-LD `@graph` schema (Organization +
 *     WebSite + Dataset + ItemList + FAQPage). Slotted into BaseLayout's
 *     `jsonLd` slot so AI search engines (ChatGPT, Claude, Perplexity,
 *     Gemini) still pick it up.
 *   • _index-inline.js — the ~1880 lines of home-specific JS (treemap
 *     canvas + tooltip + mobile drawer + I18N + share buttons). Slotted
 *     into BaseLayout's `bodyEnd` slot. The share-button wiring has a
 *     `footer.dataset.shareWired === '1'` guard so it coexists safely
 *     with Footer.astro's identical wiring (whichever runs first wins).
 *
 * Architecture-doc exception (§3.1): fs reads in page-layer code. Mirrors
 * the existing _map-css.ts pattern — at build time only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';

// The static JSON-LD carries __SCORE_MODEL_DISPLAY__ / __SCORE_RUN_DATE__
// placeholders — substituted here so the homepage attribution follows the
// active score batch (single source of truth: src/site/score-attribution.ts).
const withAttribution = (s: string): string =>
  s
    .replaceAll('__SCORE_MODEL_DISPLAY__', SCORE_ATTRIBUTION.modelDisplay)
    .replaceAll('__SCORE_RUN_DATE__', SCORE_ATTRIBUTION.runDate);

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PAGES = join(SRC, 'pages');

export const HOME_BODY_HTML: string = readFileSync(
  join(SRC, 'index-source.html'),
  'utf-8',
);

export const HOME_JSON_LD: string = withAttribution(readFileSync(
  join(PAGES, '_index-json-ld.json'),
  'utf-8',
));

export const HOME_INLINE_JS: string = readFileSync(
  join(PAGES, '_index-inline.js'),
  'utf-8',
);
