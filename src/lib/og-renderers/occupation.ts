/**
 * src/lib/og-renderers/occupation.ts — render a per-occupation OG card.
 *
 * Step 9 part 2 final (2026-05-13): extracted from api/og.tsx
 * inline branch of the request handler. Each of the 556
 * occupations gets a distinct card with a giant risk-score badge
 * coloured by the 0-10 RISK_COLORS palette + the occupation name
 * rendered in Noto Serif JP.
 *
 * Input: route param `idParam` (string) + the request URL (used
 * as the origin for fetching `/data.detail/{padded}.json`).
 *
 * Validates the detail record at runtime via `DetailRecordSchema`
 * so a corrupted upstream doesn't crash the Edge function with a
 * cryptic "Cannot read of undefined".
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader
 * for dependencies. See generic.ts header for the full rationale.
 *
 * Lives in src/lib/ alongside its sibling card renderers — binary PNG
 * output, neither SafeHtml (templates) nor typed data (views).
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import {
  RISK_COLORS,
  loadGoogleFont,
  fmtNumber,
  padId,
  DetailRecordSchema,
} from '../og-helpers.js';

const SITE_MARK = 'mirai-shigoto.com';
const RISK_LABEL = 'AI 影響';
const DEFAULT_RISK_COLOR = '#8a93a3';

// Direction C palette — synced from styles/mobile-tokens.css.
const COLORS = {
  bg: '#FAF6EE', // warm cream canvas
  ink: '#241E18', // primary ink
  muted: '#7A6F5E', // secondary muted
  hairline: 'rgba(36, 30, 24, 0.12)',
  accent: '#D96B3D', // terracotta — "独立分析" badge
  bg2: '#FFFFFF', // elevated card surface
} as const;

export async function renderOccupationOgCard(
  url: URL,
  idParam: string,
): Promise<Response> {
  // Defence-in-depth against CODE-008: the dispatcher already 400s on
  // non-1-to-4-digit ids, but if a caller bypasses the dispatcher (or
  // the contract drifts), padId throws rather than silently truncating.
  // Translate that throw into a 400 so the endpoint never 500s on a
  // malformed id.
  let paddedId: string;
  try {
    paddedId = padId(idParam);
  } catch {
    return new Response('Bad request: invalid id', { status: 400 });
  }
  // Fetch the per-occupation detail file (~3.5 KB gz). Vercel CDN caches the
  // upstream fetch by URL, so concurrent OG requests for the same id share it.
  const detailUrl = new URL(`/data.detail/${paddedId}.json`, url.origin);
  const detailRes = await fetch(detailUrl.toString());
  if (detailRes.status === 404) {
    return new Response('Occupation not found', { status: 404 });
  }
  if (!detailRes.ok) {
    return new Response('Upstream detail fetch failed', { status: 502 });
  }
  const detailRaw: unknown = await detailRes.json();
  const detailParsed = DetailRecordSchema.safeParse(detailRaw);
  if (!detailParsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      `[og] detail projection schema mismatch for id=${idParam}`,
      detailParsed.error.issues.slice(0, 3),
    );
    return new Response('Upstream detail data invalid', { status: 502 });
  }
  const rec = detailParsed.data;

  const risk = rec.ai_risk?.score ?? null;
  const riskColor = risk != null ? (RISK_COLORS[risk] ?? DEFAULT_RISK_COLOR) : DEFAULT_RISK_COLOR;
  const primaryName = rec.title?.ja ?? '';
  const workers = rec.stats?.workers ?? 0;
  const salary = rec.stats?.salary_man_yen ?? 0;

  const workersLabel = `就業者 ${fmtNumber(workers)} 人`;
  const salaryLabel = `平均年収 ${salary} 万円`;
  const riskNumberStr = risk != null ? String(risk) : '—';

  // Subset string covers every glyph we are about to render. This keeps the
  // Google Fonts fetch tiny (a few KB instead of ~3 MB for full Noto Sans JP).
  const subsetText =
    `独立分析 ${SITE_MARK} ${primaryName} ${RISK_LABEL} ` +
    `${workersLabel} ${salaryLabel} ${riskNumberStr} / 10 ·`;

  // v1.2.0 Direction C convergence: serif for the occupation name, sans for everything else.
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
        },
      },
      // Top bar — "独立分析" badge + site mark.
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
      // Main row — risk block + names.
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '56px',
            flex: 1,
            marginTop: '40px',
          },
        },
        h(
          'div',
          {
            style: {
              background: COLORS.bg2,
              border: `4px solid ${riskColor}`,
              color: riskColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              height: '320px',
              borderRadius: '24px',
              flexShrink: 0,
            },
          },
          h(
            'div',
            {
              style: {
                fontFamily: 'NotoSerifJP',
                fontSize: '200px',
                fontWeight: 600,
                lineHeight: 1,
              },
            },
            riskNumberStr,
          ),
          h(
            'div',
            {
              style: {
                fontSize: '36px',
                fontWeight: 600,
                marginTop: '-4px',
                color: COLORS.muted,
                letterSpacing: '0.04em',
              },
            },
            '/ 10',
          ),
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              gap: '14px',
            },
          },
          h(
            'div',
            {
              style: {
                fontSize: '26px',
                color: COLORS.muted,
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              },
            },
            RISK_LABEL,
          ),
          h(
            'div',
            {
              style: {
                fontFamily: 'NotoSerifJP',
                fontSize: '72px',
                fontWeight: 600,
                lineHeight: 1.12,
                color: COLORS.ink,
                letterSpacing: '-0.01em',
              },
            },
            primaryName,
          ),
        ),
      ),
      // Bottom stats line.
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '28px',
            fontSize: '26px',
            color: COLORS.ink,
            fontWeight: 500,
            borderTop: `1px solid ${COLORS.hairline}`,
            paddingTop: '24px',
            marginTop: '32px',
          },
        },
        h('span', null, workersLabel),
        h('span', { style: { color: COLORS.muted, opacity: 0.5 } }, '·'),
        h('span', null, salaryLabel),
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
        // Tell Vercel CDN + downstream caches to keep this card for a day,
        // serve-stale-while-revalidate for a week. Social platforms aggressively
        // cache anyway; this just protects against thundering herd on cold edges.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
