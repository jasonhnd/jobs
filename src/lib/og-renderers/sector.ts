/**
 * src/lib/og-renderers/sector.ts — render a sector hub OG card.
 *
 * Each of the 16 sectors gets a distinct accent (left rule + eyebrow)
 * derived from `SECTOR_HUE_COLOR[hue]`. Chrome (shell, top bar, footer,
 * eyebrow) comes from _frame.ts so all four card types stay identical.
 *
 * The pre-render contract (sectorId regex → fetch → zod validate →
 * lookup, with 400/404/502 branches) is pinned by sector.test.ts — keep
 * it byte-stable.
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader for
 * dependencies. See _frame.ts for the full rationale.
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import {
  SECTOR_HUE_COLOR,
  loadGoogleFont,
  fmtNumber,
  SectorsProjectionSchema,
} from '../og-helpers.js';
import { COLORS, FRAME_SUBSET, ogShell, topBar, footer, eyebrow } from './_frame.js';

const HEADLINE_LABEL = '業界 / SECTOR';
const DEFAULT_ACCENT = '#6E9B89';

export async function renderSectorOgCard(
  url: URL,
  sectorId: string,
): Promise<Response> {
  if (!/^[a-z_]+$/.test(sectorId)) {
    return new Response('Bad request: invalid sector id', { status: 400 });
  }

  const sectorsUrl = new URL('/data.sectors.json', url.origin);
  const res = await fetch(sectorsUrl.toString());
  if (!res.ok) {
    return new Response('Upstream sectors fetch failed', { status: 502 });
  }
  // Validate the projection shape at runtime — corrupted upstream
  // shouldn't crash the Edge function with a cryptic undefined deref.
  const projectionRaw: unknown = await res.json();
  const parsed = SectorsProjectionSchema.safeParse(projectionRaw);
  if (!parsed.success) {
    // Log structured detail server-side; respond with a fixed message.
    // Edge runtime logs surface via Vercel observability — never leak
    // field names through the response body to social-card scrapers.
    // eslint-disable-next-line no-console
    console.error(
      '[og] sectors projection schema mismatch',
      parsed.error.issues.slice(0, 3),
    );
    return new Response('Upstream sectors data invalid', { status: 502 });
  }
  const projection = parsed.data;
  const sector = projection.sectors.find((s) => s.id === sectorId);
  if (!sector) {
    return new Response('Sector not found', { status: 404 });
  }

  const accent = SECTOR_HUE_COLOR[sector.hue] ?? DEFAULT_ACCENT;
  const nameLoc = sector.ja;

  const countLabel = `${sector.occupation_count} 職業`;
  const riskLabel = `平均 AI 影響 ${sector.mean_ai_risk.toFixed(1)} / 10`;
  const workforceLabel = `就業者 計 ${fmtNumber(sector.total_workforce)} 人`;
  const samples = (sector.sample_titles_ja ?? []).slice(0, 3).join('　・　');

  const subsetText =
    `${nameLoc} ${HEADLINE_LABEL} ${countLabel} ${riskLabel} ${workforceLabel} ${samples} ${FRAME_SUBSET}`;

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    ogShell(accent, [
      topBar(),
      // Sector eyebrow + name + samples.
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            marginTop: '20px',
            gap: '18px',
          },
        },
        eyebrow(HEADLINE_LABEL, accent),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'NotoSerifJP',
              fontSize: '104px',
              fontWeight: 600,
              lineHeight: 1.05,
              color: COLORS.ink,
              letterSpacing: '-0.01em',
            },
          },
          nameLoc,
        ),
        samples
          ? h(
              'div',
              { style: { display: 'flex', fontSize: '24px', color: COLORS.muted, fontWeight: 500 } },
              samples,
            )
          : null,
      ),
      footer([
        h('span', { style: { display: 'flex' } }, countLabel),
        h('span', { style: { display: 'flex' } }, riskLabel),
        h('span', { style: { display: 'flex' } }, workforceLabel),
      ]),
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
