/**
 * src/lib/og-renderers/sector.tsx — render a sector hub OG card.
 *
 * Step 9 part 2 (2026-05-13): extracted from api/og.tsx inline
 * `renderSectorCard`. Each of the 16 sectors gets a distinct
 * accent color derived from `SECTOR_HUE_COLOR[hue]`.
 *
 * Input: route param `sectorId` plus the request URL (used as
 * the origin for fetching `/data.sectors.json`).
 *
 * Validates the sectors projection at runtime via
 * `SectorsProjectionSchema` so a corrupted upstream doesn't
 * crash the Edge function with a cryptic "Cannot read of
 * undefined".
 *
 * Lives in src/lib/og-renderers/ — binary PNG output, neither
 * SafeHtml (templates) nor typed data (views). The view-shaped
 * data prep (validate + look up sector by id) is co-located here
 * because it's part of the same response-or-fail flow as the
 * render; splitting them across a view module would add an
 * Either-type boundary for no real reuse benefit.
 */

import { ImageResponse } from '@vercel/og';
import {
  SECTOR_HUE_COLOR,
  loadGoogleFont,
  fmtNumber,
  SectorsProjectionSchema,
} from '../og-helpers.js';

const SITE_MARK = 'mirai-shigoto.com';
const HEADLINE_LABEL = '業界 / SECTOR';

const COLORS = {
  bg: '#FAF6EE',
  ink: '#241E18',
  muted: '#7A6F5E',
  hairline: 'rgba(36, 30, 24, 0.12)',
  accent: '#D96B3D',
  bg2: '#FFFFFF',
} as const;

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
    `独立分析 ${SITE_MARK} ${nameLoc} ${HEADLINE_LABEL} ` +
    `${countLabel} ${riskLabel} ${workforceLabel} ${samples} ・ /`;

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          color: COLORS.ink,
          fontFamily: 'NotoSansJP',
          padding: '48px 64px',
          borderLeft: `14px solid ${accent}`,
        }}
      >
        {/* Top bar — "独立分析" badge + site mark */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              background: COLORS.accent,
              color: '#FFFFFF',
              padding: '8px 18px',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '22px',
              letterSpacing: '0.08em',
            }}
          >
            独立分析
          </div>
          <div style={{ fontSize: '24px', color: COLORS.muted, fontWeight: 500 }}>
            {SITE_MARK}
          </div>
        </div>

        {/* Sector eyebrow + name */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            marginTop: '20px',
          }}
        >
          <div
            style={{
              fontSize: '26px',
              color: accent,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            {HEADLINE_LABEL}
          </div>
          <div
            style={{
              fontFamily: 'NotoSerifJP',
              fontSize: '104px',
              fontWeight: 600,
              lineHeight: 1.05,
              color: COLORS.ink,
              letterSpacing: '-0.01em',
            }}
          >
            {nameLoc}
          </div>
          {samples ? (
            <div
              style={{
                fontSize: '24px',
                color: COLORS.muted,
                fontWeight: 500,
                marginTop: '20px',
              }}
            >
              {samples}
            </div>
          ) : null}
        </div>

        {/* Bottom stats row */}
        <div
          style={{
            display: 'flex',
            gap: '28px',
            fontSize: '26px',
            color: COLORS.ink,
            fontWeight: 500,
            borderTop: `1px solid ${COLORS.hairline}`,
            paddingTop: '24px',
            marginTop: '20px',
          }}
        >
          <span>{countLabel}</span>
          <span style={{ color: COLORS.muted, opacity: 0.5 }}>·</span>
          <span>{riskLabel}</span>
          <span style={{ color: COLORS.muted, opacity: 0.5 }}>·</span>
          <span>{workforceLabel}</span>
        </div>
      </div>
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
