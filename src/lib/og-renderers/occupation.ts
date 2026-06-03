/**
 * src/lib/og-renderers/occupation.ts — render a per-occupation OG card.
 *
 * Each of the 556 occupations gets a distinct card: a giant risk-score
 * badge coloured by the 0-10 RISK_COLORS palette, the occupation name in
 * Noto Serif JP, and a 0-10 mini scale showing where the score sits. The
 * left rule of the shell is tinted by the same risk colour.
 *
 * Chrome (shell, top bar, footer, eyebrow, scale) comes from _frame.ts so
 * all four card types stay visually identical.
 *
 * The pre-render contract (padId → fetch → zod validate, with 400/404/502
 * branches) is pinned by occupation.test.ts — keep it byte-stable.
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader for
 * dependencies. See _frame.ts for the full rationale.
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
import {
  COLORS,
  FRAME_SUBSET,
  ogShell,
  topBar,
  footer,
  eyebrow,
  miniScale,
} from './_frame.js';

const RISK_LABEL = 'AI 影響';
// Warm "no score" gray (matches --ink-3); satori needs a literal, not a CSS var.
const DEFAULT_RISK_COLOR = '#8a7a6a';

/**
 * Footer stat labels. Null stats render an em-dash, NOT 0 — "平均年収 0 万円"
 * would assert zero income for the 12 occupations (警察官・裁判官 etc.) whose
 * salary the source leaves blank. Matches the main site's null convention
 * (occupation-display.ts / compare-hub.ts): the dash replaces value + unit.
 */
export function statLabels(
  workers: number | null,
  salary: number | null,
): { workersLabel: string; salaryLabel: string } {
  return {
    workersLabel: workers != null ? `就業者 ${fmtNumber(workers)} 人` : '就業者 —',
    salaryLabel: salary != null ? `平均年収 ${salary} 万円` : '平均年収 —',
  };
}

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
  const riskColor = risk != null ? (RISK_COLORS[Math.round(risk)] ?? DEFAULT_RISK_COLOR) : DEFAULT_RISK_COLOR;
  const primaryName = rec.title?.ja ?? '';
  const { workersLabel, salaryLabel } = statLabels(
    rec.stats?.workers ?? null,
    rec.stats?.salary_man_yen ?? null,
  );
  const riskNumberStr = risk != null ? String(risk) : '—';

  // Subset string covers every glyph we are about to render (incl. the
  // shared chrome + the "0 5 10" scale labels). Keeps the Google Fonts
  // fetch tiny (a few KB instead of ~3 MB for full Noto Sans JP).
  const subsetText =
    `${primaryName} ${RISK_LABEL} ${workersLabel} ${salaryLabel} ` +
    `${riskNumberStr} / 10 0 5 ${FRAME_SUBSET}`;

  // v1.2.0 Direction C convergence: serif for the occupation name, sans for everything else.
  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  return new ImageResponse(
    ogShell(riskColor, [
      topBar(),
      // Main row — risk score block + name + 0-10 scale.
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '56px',
            flex: 1,
            marginTop: '28px',
          },
        },
        // Score block.
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.bg2,
              border: `4px solid ${riskColor}`,
              color: riskColor,
              width: '300px',
              height: '300px',
              borderRadius: '24px',
              flexShrink: 0,
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                fontFamily: 'NotoSerifJP',
                fontSize: '190px',
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
                display: 'flex',
                fontSize: '34px',
                fontWeight: 600,
                marginTop: '-4px',
                color: COLORS.muted,
                letterSpacing: '0.04em',
              },
            },
            '/ 10',
          ),
        ),
        // Name + scale column.
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', flex: 1, gap: '18px' } },
          eyebrow(RISK_LABEL, riskColor),
          h(
            'div',
            {
              style: {
                display: 'flex',
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
          risk != null ? miniScale(risk, riskColor) : null,
        ),
      ),
      footer([
        h('span', { style: { display: 'flex' } }, workersLabel),
        h('span', { style: { display: 'flex' } }, salaryLabel),
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
        // Tell Vercel CDN + downstream caches to keep this card for a day,
        // serve-stale-while-revalidate for a week. Social platforms aggressively
        // cache anyway; this just protects against thundering herd on cold edges.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
