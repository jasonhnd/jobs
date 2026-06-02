/**
 * src/lib/og-renderers/map.ts — render the /map page OG card.
 *
 * Output is a static 1200×630 PNG with the "職業マップ" hero, a 5-band
 * stylized risk-color swatch (no upstream data fetch — purely visual),
 * and a hand-curated legend / subtitle. Chrome (shell, top bar, footer,
 * eyebrow) comes from _frame.ts so all four card types stay identical.
 *
 * Unlike the occupation / sector renderers, this card has no parameters
 * and reads no external data.
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader for
 * dependencies. See _frame.ts for the full rationale.
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { loadGoogleFont } from '../og-helpers.js';
import { COLORS, FRAME_SUBSET, ogShell, topBar, footer, eyebrow } from './_frame.js';

const EYEBROW = 'OCCUPATION MAP / 全 556 職業';
const TITLE = '職業マップ';
const SUBTITLE = 'AI 影響度 × 就業者数 ヒートマップ';
const BOTTOM_LABEL = '面積 = 就業者数 ・ 色 = AI 影響(低 → 高)';

// 5-tier risk palette (matches the page's inline thumbnail in
// build_occupations.py generate_map_thumbnail()).
// Cool → warm to read as "spectrum of AI impact".
const RISK_BAND_COLORS = ['#0F8A66', '#5BA84F', '#D9A03B', '#E27A33', '#C4422F'] as const;

export async function renderMapOgCard(): Promise<Response> {
  const subsetText = `${EYEBROW} ${TITLE} ${SUBTITLE} ${BOTTOM_LABEL} ${FRAME_SUBSET}`;

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    ogShell(COLORS.accent, [
      topBar(),
      // Eyebrow + giant title + subtitle + 5-band swatch.
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            marginTop: '20px',
            gap: '20px',
          },
        },
        eyebrow(EYEBROW),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'NotoSerifJP',
              fontSize: '128px',
              fontWeight: 600,
              lineHeight: 1.0,
              color: COLORS.ink,
              letterSpacing: '-0.01em',
            },
          },
          TITLE,
        ),
        h(
          'div',
          { style: { display: 'flex', fontSize: '30px', color: COLORS.muted, fontWeight: 500 } },
          SUBTITLE,
        ),
        // 5-band stylized swatch — implies the heatmap palette without
        // fetching real data (keeps this card upstream-fetch-free).
        h(
          'div',
          {
            style: {
              display: 'flex',
              marginTop: '12px',
              height: '26px',
              borderRadius: '6px',
              overflow: 'hidden',
            },
          },
          ...RISK_BAND_COLORS.map((c, i) =>
            h('div', { key: i, style: { display: 'flex', flex: 1, background: c } }),
          ),
        ),
      ),
      footer([h('span', { style: { display: 'flex' } }, BOTTOM_LABEL)]),
    ]),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'NotoSerifJP', data: fontSerifBuf, weight: 600, style: 'normal' },
        { name: 'NotoSansJP', data: fontSansBoldBuf, weight: 800, style: 'normal' },
        { name: 'NotoSansJP', data: fontSansRegBuf, weight: 500, style: 'normal' },
      ],
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
