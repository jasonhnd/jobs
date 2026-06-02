/**
 * src/lib/og-renderers/generic.ts — the text-only OG card shared by every
 * non-rich page family (home / legal / hub indexes / yearly / etc.).
 *
 * Chrome (shell, top bar, footer, eyebrow) comes from _frame.ts so all
 * four card types stay visually identical. This file owns only the
 * generic card's middle block: eyebrow → giant serif title → subtitle.
 *
 * Why `.ts` (not `.tsx`): Vercel's Edge bundler has no TSX loader for
 * dependencies, so the element tree is hand-rolled with `createElement`
 * (aliased `h`). See _frame.ts for the full rationale.
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { loadGoogleFont, type GenericCardConfig } from '../og-helpers.js';
import {
  COLORS,
  FRAME_SUBSET,
  FOOTER_LEFT,
  ogShell,
  topBar,
  footer,
  eyebrow,
} from './_frame.js';

export async function renderGenericOgCard(
  config: GenericCardConfig,
): Promise<Response> {
  const subsetText = `${config.eyebrow} ${config.title} ${config.subtitle} ${FRAME_SUBSET}`;

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    ogShell(COLORS.accent, [
      topBar(),
      // Eyebrow + giant serif title + subtitle.
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
        eyebrow(config.eyebrow),
        h(
          'div',
          {
            style: {
              display: 'flex',
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
              display: 'flex',
              fontSize: '32px',
              color: COLORS.muted,
              fontWeight: 500,
              lineHeight: 1.4,
            },
          },
          config.subtitle,
        ),
      ),
      footer(h('span', { style: { display: 'flex' } }, FOOTER_LEFT)),
    ]),
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
