/**
 * _index-css.ts — homepage critical CSS loader.
 *
 * The full homepage stylesheet now lives in `_index.css` and is imported by
 * `src/pages/index.astro` as a Vite `?url` asset, so Astro emits it as a
 * hashed, cacheable file instead of embedding the whole block in `/`.
 *
 * Build-time injection: `index.astro` keeps only `INDEX_CRITICAL_CSS` inline
 * in `<head>` for the above-the-fold hero / KPI / mobile map-preview surface.
 * The rest of `_index.css` is loaded through a normal stylesheet link.
 *
 * Byte-identity contract: this intentionally changes the rendered homepage
 * HTML byte stream. Recapture `tests/baseline/` after a build before running
 * the SEO baseline gate.
 *
 * Sibling-file convention: leading "_" excludes this helper and `_index.css`
 * from Astro's filesystem routing — only routable templates live under
 * `src/pages/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const INDEX_CSS_PATH = join(ROOT, 'src', 'pages', '_index.css');
const END = '__END__';

export const INDEX_CSS: string = readFileSync(INDEX_CSS_PATH, 'utf-8');

type CssRange = readonly [start: string, end: string];

function cssSlice([start, end]: CssRange): string {
  const from = INDEX_CSS.indexOf(start);
  if (from < 0) {
    throw new Error(`INDEX_CRITICAL_CSS start marker not found: ${start}`);
  }
  const to = end === END ? INDEX_CSS.length : INDEX_CSS.indexOf(end, from);
  if (to < 0) {
    throw new Error(`INDEX_CRITICAL_CSS end marker not found: ${end}`);
  }
  return INDEX_CSS.slice(from, to);
}

const CRITICAL_CSS_RANGES: readonly CssRange[] = [
  // Reset, theme tokens, and typography needed before the stylesheet arrives.
  ['      *,', '      /* ═══════════ v1.2.x mobile TOP 10'],
  // Mobile first viewport shows the static map preview before the full map UI.
  ['      /* ═══════════ Mobile Map Preview', '      /* Phase 7: legacy .m-topbar removed.'],
  // Homepage wrapper and legacy banner only; explanatory/content blocks are deferred.
  ['      /* Theme toggle hidden', '      .lang-switch {'],
  // Desktop search-first hero; typeahead dropdown styling can wait for the asset.
  ['      /* ============ Desktop Hero', '      /* Search suggest dropdown'],
  // Desktop visibility rules that swap in the search-first hero.
  [
    '      @media (min-width: 769px) {\n        .desktop-hero { display: block; }',
    '      @media (max-width: 480px) {\n        .desktop-hero-search',
  ],
  // Mobile hero base styles.
  ['      /* ============ Mobile Hero', '      @media (max-width: 768px) {\n        #wrapper'],
  // Mobile first-viewport ordering and hidden embedded-map chrome.
  ['      @media (max-width: 768px) {\n        #wrapper', '        /* stats-panel already hidden by earlier rule'],
  // Above-the-fold labor-market KPI band. It appears late in the source CSS.
  ['      /* RA-135', END],
];

export const INDEX_CRITICAL_CSS: string = CRITICAL_CSS_RANGES.map(cssSlice).join('\n');
