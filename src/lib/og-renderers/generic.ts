/**
 * src/lib/og-renderers/generic.ts — render the text-only OG card
 * shared by every non-rich page family on the site.
 *
 * Step 9 part 2 (2026-05-13): the renderer used to live inline at
 * the top of api/og.tsx. Extracted here so the endpoint stays a
 * thin dispatcher and the renderer can grow / be tested without
 * touching the Vercel Edge entry point.
 *
 * Why `.ts` (not `.tsx`)
 * ─────────────────────────────────────────────────────────────────
 * Vercel's Edge Function bundler compiles the entry .tsx file but
 * has no TSX loader for dependencies — only `.js` / `.ts`. Writing
 * the renderer as JSX in a .tsx file forced an awkward esbuild
 * pre-compile step (commit 33783386). Hand-rolling the element
 * tree with `createElement` (aliased to `h` for brevity) keeps the
 * source as a plain `.ts` file that Vercel resolves directly. No
 * build step, no .gitignored artifacts, no platform-specific
 * workaround. The verbosity tax is real but bounded.
 *
 * Output: 1200×630 PNG with the "独立分析" badge + site mark on top,
 * giant serif title in the middle, a sans-serif subtitle, and the
 * data-source footer.
 *
 * Lives in src/lib/ (not src/templates/ or src/views/) because:
 *   - It produces a binary (`Response` wrapping `ImageResponse`),
 *     not SafeHtml (templates layer's contract) and not typed
 *     data (views layer's contract).
 *   - The architecture-boundary gate's "lib" layer has no
 *     forbidden imports — appropriate for general-purpose
 *     utility code like this.
 *
 * The accompanying card-config dicts (PAGE_CARDS / RANKING_CARDS /
 * etc.) are pure data and live in src/views/og-cards.ts. This
 * renderer just consumes whatever GenericCardConfig the dispatcher
 * looks up.
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { loadGoogleFont, type GenericCardConfig } from '../og-helpers.js';

const SITE_MARK = 'mirai-shigoto.com';
const FOOTER_LEFT = '厚生労働省 jobtag · JILPT IPD v7.00 · Claude Opus 4.7';
const FOOTER_RIGHT = '非公式 / Independent';

// Direction C palette — synced from styles/mobile-tokens.css.
const COLORS = {
  bg: '#FAF6EE',
  ink: '#241E18',
  muted: '#7A6F5E',
  hairline: 'rgba(36, 30, 24, 0.12)',
  accent: '#D96B3D',
} as const;

export async function renderGenericOgCard(
  config: GenericCardConfig,
): Promise<Response> {
  const subsetText =
    `独立分析 ${SITE_MARK} ${config.eyebrow} ${config.title} ${config.subtitle} ・ /`;

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    h(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          color: COLORS.ink,
          fontFamily: 'NotoSansJP',
          padding: '48px 64px',
          borderLeft: `14px solid ${COLORS.accent}`,
        },
      },
      // Top bar — "独立分析" badge + site mark.
      h(
        'div',
        {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        },
        h(
          'div',
          {
            style: {
              background: COLORS.accent,
              color: '#FFFFFF',
              padding: '8px 18px',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '22px',
              letterSpacing: '0.05em',
            },
          },
          '独立分析',
        ),
        h(
          'div',
          { style: { fontSize: '24px', color: COLORS.muted, fontWeight: 500 } },
          SITE_MARK,
        ),
      ),
      // Eyebrow + giant title + subtitle.
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            marginTop: '12px',
            gap: '20px',
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: '30px',
              color: COLORS.muted,
              fontWeight: 600,
              letterSpacing: '0.05em',
            },
          },
          config.eyebrow,
        ),
        h(
          'div',
          {
            style: {
              fontSize: '84px',
              fontFamily: 'NotoSerifJP',
              fontWeight: 600,
              lineHeight: 1.15,
              color: COLORS.ink,
              letterSpacing: '-0.01em',
            },
          },
          config.title,
        ),
        h(
          'div',
          {
            style: {
              fontSize: '32px',
              color: COLORS.muted,
              fontWeight: 500,
              lineHeight: 1.4,
              marginTop: '8px',
            },
          },
          config.subtitle,
        ),
      ),
      // Bottom hairline + tagline.
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '20px',
            borderTop: `1px solid ${COLORS.hairline}`,
            color: COLORS.muted,
            fontSize: '22px',
          },
        },
        h('span', null, FOOTER_LEFT),
        h('span', null, FOOTER_RIGHT),
      ),
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'NotoSerifJP', data: fontSerifBuf, style: 'normal', weight: 600 },
        { name: 'NotoSansJP', data: fontSansBoldBuf, style: 'normal', weight: 800 },
        { name: 'NotoSansJP', data: fontSansRegBuf, style: 'normal', weight: 500 },
      ],
    },
  );
}
