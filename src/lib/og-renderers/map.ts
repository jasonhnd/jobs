/**
 * src/lib/og-renderers/map.ts — render the /map page OG card.
 *
 * Step 9 part 2 (2026-05-13): extracted from api/og.tsx inline
 * `renderMapCard`. Output is a static 1200×630 PNG with the
 * "職業マップ" hero, a 5-band stylized risk-color swatch (no
 * upstream data fetch — purely visual), and a hand-curated
 * legend / subtitle.
 *
 * Unlike the occupation / sector renderers, this card has no
 * parameters and reads no external data, so the boundary is
 * the cleanest of the three rich renderers.
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader
 * for dependencies. See generic.ts header for the full rationale.
 *
 * Lives in src/lib/ — binary PNG output, neither SafeHtml (templates)
 * nor typed data (views).
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { loadGoogleFont } from '../og-helpers.js';

const SITE_MARK = 'mirai-shigoto.com';
const EYEBROW = 'OCCUPATION MAP / 全 556 職業';
const TITLE = '職業マップ';
const SUBTITLE = 'AI 影響度 × 就業者数 ヒートマップ';
const BOTTOM_LABEL = '面積 = 就業者数 ・ 色 = AI 影響(低 → 高)';

const COLORS = {
  bg: '#FAF6EE',
  ink: '#241E18',
  muted: '#7A6F5E',
  hairline: 'rgba(36, 30, 24, 0.12)',
  accent: '#D96B3D',
} as const;

// 5-tier risk palette (matches the page's inline thumbnail in
// build_occupations.py generate_map_thumbnail()).
// Cool → warm to read as "spectrum of AI impact".
const RISK_BAND_COLORS = ['#0F8A66', '#5BA84F', '#D9A03B', '#E27A33', '#C4422F'] as const;

export async function renderMapOgCard(): Promise<Response> {
  const subsetText =
    `独立分析 ${SITE_MARK} ${EYEBROW} ${TITLE} ${SUBTITLE} ${BOTTOM_LABEL} ・ /`;

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
      // Top bar.
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
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
              letterSpacing: '0.08em',
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
      // Eyebrow + giant title + 5-band swatch.
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            marginTop: '20px',
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: '26px',
              color: COLORS.accent,
              fontWeight: 800,
              letterSpacing: '0.18em',
              marginBottom: '16px',
            },
          },
          EYEBROW,
        ),
        h(
          'div',
          {
            style: {
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
          {
            style: {
              fontSize: '30px',
              color: COLORS.muted,
              fontWeight: 500,
              marginTop: '20px',
            },
          },
          SUBTITLE,
        ),
        // 5-band stylized swatch — implies the heatmap palette without
        // fetching real data (keeps this card upstream-fetch-free).
        h(
          'div',
          {
            style: {
              display: 'flex',
              gap: '0',
              marginTop: '32px',
              height: '26px',
              borderRadius: '4px',
              overflow: 'hidden',
            },
          },
          ...RISK_BAND_COLORS.map((c, i) =>
            h('div', { key: i, style: { flex: 1, background: c } }),
          ),
        ),
      ),
      // Bottom legend.
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '16px',
            fontSize: '24px',
            color: COLORS.muted,
            fontWeight: 500,
            borderTop: `1px solid ${COLORS.hairline}`,
            paddingTop: '24px',
            marginTop: '20px',
          },
        },
        h('span', null, BOTTOM_LABEL),
      ),
    ),
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
