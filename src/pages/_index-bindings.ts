/**
 * src/pages/_index-bindings.ts — page binding for index.astro.
 *
 * Wraps the hand-maintained `src/index-source.html` legacy file:
 *   1. Reads the source file from disk.
 *   2. Patches the build-time JST timestamp into <time> and footer.
 *   3. Injects canonical typography CSS into <head>.
 *   4. Inflates the `<style>/*__INDEX_CSS__*\/</style>` placeholder.
 *
 * This is the only architecture-doc exception (§3.1) for fs reads in
 * page-layer code: `index-source.html` is a hand-maintained 4500-line
 * file co-located with the page route, NOT a data file under data/ or
 * public/data.*. Documented in docs/architecture.md decision log
 * (2026-05-14 Phase D audit #8).
 *
 * Phase D audit #8 (2026-05-14): extracted from index.astro frontmatter.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANONICAL_CSS } from '../lib/canonical-css.js';
import { INDEX_CSS } from './_index-css.js';

const SOURCE_PATH = join(process.cwd(), 'src', 'index-source.html');
const SITE_CANONICAL_BLOCK = `<style id="site-canonical">${CANONICAL_CSS}</style>`;

/** Build-time JST timestamp matching Footer.astro's display format. */
function buildTimeJst(): { iso: string; display: string } {
  const d = new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return {
    iso: `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`,
    display: `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())}_${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}_JST`,
  };
}

/**
 * Patch by regex-replace. Throws if the pattern didn't match — the source
 * HTML legacy file is hand-maintained and silent-no-match would let stale
 * timestamps or missing canonical CSS ship without anyone noticing.
 * Audit's #7.3.
 */
function patchOrThrow(input: string, pattern: RegExp, replacement: string, tag: string): string {
  if (!pattern.test(input)) {
    throw new Error(
      `[index.astro] template patch failed: pattern for "${tag}" did not match src/index-source.html. ` +
      `Did the upstream HTML change shape?`,
    );
  }
  return input.replace(pattern, replacement);
}

export function buildIndexPageHtml(): string {
  const raw = readFileSync(SOURCE_PATH, 'utf-8');
  const { iso, display } = buildTimeJst();

  // 1. Replace static timestamp (tolerant regex matches old "YYYY/MM/DD/HH:MM JST"
  //    and new "YYYY/MM/DD_HH:MM_JST" forms so re-runs stay idempotent).
  let html = patchOrThrow(
    raw,
    /datetime="20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00"/,
    `datetime="${iso}"`,
    'datetime attribute',
  );
  html = patchOrThrow(
    html,
    />20\d{2}\/\d{2}\/\d{2}[\/_]\d{2}:\d{2}[ _]JST</,
    `>${display}<`,
    'JST footer timestamp',
  );

  // 2. Inject canonical typography CSS into <head>. Index uses Fragment
  //    set:html so a trailing <style> would fall outside </html>.
  html = patchOrThrow(
    html,
    /<\/head>/,
    `${SITE_CANONICAL_BLOCK}\n  </head>`,
    'canonical CSS injection point (</head>)',
  );

  // 3. Inflate <style>/*__INDEX_CSS__*/</style> placeholder (1 line in the
  //    source HTML) back into the full ~2200-line inline CSS block.
  html = patchOrThrow(
    html,
    /<style>\/\*__INDEX_CSS__\*\/<\/style>/,
    `<style>\n${INDEX_CSS}\n    </style>`,
    'INDEX_CSS placeholder',
  );

  return html;
}
