/**
 * src/lib/og-renderers/worktype.ts — render AI働き方診断 result share cards.
 *
 * The result identity is family + variant + exact aggregate margins. The
 * renderer stays stateless: validated URL params select the already-computed
 * display identity, while /data.worktypes.json supplies the family assignment
 * and optional occupation context. Any displayed gap is recomputed from that
 * projection rather than trusted from the URL. No quiz answers, saved result
 * id, backend scoring, or runtime LLM are involved.
 *
 * The card does not draw the family rarity figure — this comment claimed it did
 * until 2026-07-29 (issue #235). Rarity appears only on the /shindan result and
 * on /gyakuten.
 *
 * Plain `.ts` (not `.tsx`) — Vercel's Edge bundler has no TSX loader for
 * dependencies. See _frame.ts for the shared OG renderer convention.
 */

import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import type { ReactElement } from 'react';
import {
  DetailRecordSchema,
  RISK_COLORS,
  WorktypesProjectionSchema,
  loadGoogleFont,
  padId,
  trustedFetchOrigin,
} from '../og-helpers.js';
import { WORKTYPE_CARDS } from '../../views/og-cards.js';
import {
  DISCLAIMER,
  FAMILIES,
  GAP,
  LABELS,
  SHARE,
  VARIANTS,
  VARIANT_IDS_BY_FAMILY,
  type FamilyCode,
  type GapKind,
  type WorktypeVariant,
  type WorktypeVariantId,
} from '../../site/worktype-copy.js';
import {
  COLORS,
  FOOTER_LEFT,
  FRAME_SUBSET,
  footer,
  ogShell,
  topBar,
} from './_frame.js';
import type { WorktypeOgShape } from '../og-dispatch.js';
import type { WorktypesProjectionShape } from '../projection-schemas.js';
import { classifyShindanGap } from '../../site/shindan-result-state.js';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
} as const;

interface WorktypeRenderInput {
  readonly family: FamilyCode;
  readonly variant: WorktypeVariantId;
  readonly gap?: GapKind;
  readonly job?: string;
  readonly shape: WorktypeOgShape;
}

export interface WorktypeJobContext {
  readonly title: string;
  readonly worktypeCode: FamilyCode;
  readonly worktypeName?: string;
  readonly score: number | null;
}

export async function renderWorktypeOgCard(
  url: URL,
  input: WorktypeRenderInput,
): Promise<Response> {
  const worktypesUrl = new URL('/data.worktypes.json', trustedFetchOrigin(url));
  const worktypesRes = await fetch(worktypesUrl.toString());
  if (!worktypesRes.ok) {
    return new Response('Upstream worktypes fetch failed', { status: 502 });
  }

  const worktypesRaw: unknown = await worktypesRes.json();
  const worktypesParsed = WorktypesProjectionSchema.safeParse(worktypesRaw);
  if (!worktypesParsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      '[og] worktypes projection schema mismatch',
      worktypesParsed.error.issues.slice(0, 3),
    );
    return new Response('Upstream worktypes data invalid', { status: 502 });
  }

  const projection = worktypesParsed.data;
  const variantCopy = resolveVariantCopy(input.family, input.variant);
  const visual = WORKTYPE_CARDS[input.family];
  const jobContext = input.job ? await fetchJobContext(url, input.job, projection) : null;
  const score = jobContext?.score ?? null;
  const scoreLabel = score != null && !Number.isNaN(score) ? String(score) : null;
  const scoreColor =
    score != null ? (RISK_COLORS[Math.round(score)] ?? visual.accent) : visual.accent;
  const accent = scoreLabel ? scoreColor : visual.accent;
  const sharePrompt = scoreLabel
    ? SHARE.challengeHookWithJob
    : (SHARE.challengeHooks[0] ?? 'あなたの1枚もめくってみる?');
  const computedGap = jobContext
    ? classifyShindanGap(input.family, jobContext.worktypeCode).kind
    : undefined;
  const gapLine = computedGap ? GAP[computedGap].label : '';
  const contextLine = buildWorktypeContextCopy(computedGap, gapLine, jobContext);
  const featureLabel = scoreLabel ? `${LABELS.featureName} / AI 影響` : buildWorktypeFeatureLabel(input.family);
  const introLabel = scoreLabel && jobContext ? jobContext.title : variantCopy.name;

  const subsetText = [
    visual.glyphSet,
    featureLabel,
    introLabel,
    variantCopy.catch,
    sharePrompt,
    contextLine,
    DISCLAIMER,
    FOOTER_LEFT,
    SHARE.hashtag,
    SHARE.challengeHookWithJob,
    scoreLabel ? `${scoreLabel} / 10` : '',
    FRAME_SUBSET,
  ].join(' ');

  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont('Noto+Serif+JP', 600, subsetText),
    loadGoogleFont('Noto+Sans+JP', 800, subsetText),
    loadGoogleFont('Noto+Sans+JP', 500, subsetText),
  ]);

  const isSquare = input.shape === 'square';
  return new ImageResponse(
    isSquare
      ? renderSquareCard({
          accent,
          contextLine,
          featureLabel,
          introLabel,
          sharePrompt,
          variantCopy,
          visual,
          scoreLabel,
          scoreColor,
        })
      : renderWideCard({
          accent,
          contextLine,
          featureLabel,
          introLabel,
          sharePrompt,
          variantCopy,
          visual,
          scoreLabel,
          scoreColor,
        }),
    {
      width: isSquare ? 1080 : 1200,
      height: isSquare ? 1080 : 630,
      fonts: [
        { name: 'NotoSerifJP', data: fontSerifBuf, weight: 600, style: 'normal' },
        { name: 'NotoSansJP', data: fontSansBoldBuf, weight: 800, style: 'normal' },
        { name: 'NotoSansJP', data: fontSansRegBuf, weight: 500, style: 'normal' },
      ],
      headers: CACHE_HEADERS,
    },
  );
}

interface CardLayoutData {
  readonly accent: string;
  readonly contextLine: string;
  readonly featureLabel: string;
  readonly introLabel: string;
  readonly sharePrompt: string;
  readonly variantCopy: WorktypeVariant;
  readonly visual: { readonly character: string; readonly accent: string; readonly glyphSet: string };
  readonly scoreLabel: string | null;
  readonly scoreColor: string;
}

function renderWideCard(data: CardLayoutData): ReactElement {
  return ogShell(data.accent, [
    topBar(),
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          gap: '42px',
          marginTop: '24px',
        },
      },
      data.scoreLabel
        ? scoreBadge(data.scoreLabel, data.scoreColor, 270)
        : characterBlock(data.visual.character, data.accent, 270, 152),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: '12px',
          },
        },
        labelText(data.featureLabel, data.accent, 24),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'NotoSerifJP',
              fontSize: '74px',
              fontWeight: 600,
              lineHeight: 1.12,
              color: COLORS.ink,
              letterSpacing: '0',
            },
          },
          data.introLabel,
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: '28px',
              fontWeight: 500,
              lineHeight: 1.35,
              color: COLORS.ink,
            },
          },
          data.scoreLabel ? data.variantCopy.name : data.variantCopy.catch,
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' } },
          chip(SHARE.hashtag, COLORS.muted),
        ),
        data.contextLine ? contextPill(data.contextLine, data.accent) : null,
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: '18px',
              lineHeight: 1.45,
              color: COLORS.muted,
              marginTop: '2px',
            },
          },
          DISCLAIMER,
        ),
      ),
    ),
    footer([
      h('span', { style: { display: 'flex', color: data.accent, fontWeight: 800 } }, data.sharePrompt),
      h('span', { style: { display: 'flex' } }, FOOTER_LEFT),
    ]),
  ]);
}

function renderSquareCard(data: CardLayoutData): ReactElement {
  return ogShell(data.accent, [
    topBar(),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: '18px',
          padding: '30px 42px 8px',
          textAlign: 'center',
        },
      },
      labelText(data.featureLabel, data.accent, 28),
      data.scoreLabel
        ? scoreBadge(data.scoreLabel, data.scoreColor, 280)
        : characterBlock(data.visual.character, data.accent, 330, 190),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'NotoSerifJP',
            fontSize: '82px',
            fontWeight: 600,
            lineHeight: 1.08,
            color: COLORS.ink,
            letterSpacing: '0',
          },
        },
        data.introLabel,
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '30px',
            fontWeight: 500,
            lineHeight: 1.35,
            color: COLORS.ink,
          },
        },
        data.scoreLabel ? data.variantCopy.name : data.variantCopy.catch,
      ),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' } },
        chip(SHARE.hashtag, COLORS.muted),
      ),
      data.contextLine ? contextPill(data.contextLine, data.accent) : null,
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '20px',
            lineHeight: 1.45,
            color: COLORS.muted,
          },
        },
        DISCLAIMER,
      ),
    ),
    footer([
      h('span', { style: { display: 'flex', color: data.accent, fontWeight: 800 } }, data.sharePrompt),
      h('span', { style: { display: 'flex' } }, FOOTER_LEFT),
    ]),
  ]);
}

function scoreBadge(scoreLabel: string, color: string, size: number): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg2,
        border: `4px solid ${color}`,
        color,
        width: `${size}px`,
        height: `${size}px`,
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
          fontSize: size > 270 ? '160px' : '140px',
          fontWeight: 600,
          lineHeight: 1,
        },
      },
      scoreLabel,
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: '28px',
          fontWeight: 600,
          marginTop: '-4px',
          color: COLORS.muted,
          letterSpacing: '0.04em',
        },
      },
      '/ 10',
    ),
  );
}

function characterBlock(character: string, accent: string, size: number, fontSize: number): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '34px',
        border: `6px solid ${accent}`,
        background: `linear-gradient(135deg, ${withAlpha(accent, 0.18)}, #FFFFFF)`,
        boxShadow: `0 18px 42px ${withAlpha(accent, 0.16)}`,
        flexShrink: 0,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: 'NotoSerifJP',
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          lineHeight: 1,
          color: accent,
        },
      },
      character,
    ),
  );
}

function labelText(text: string, accent: string, fontSize: number): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        color: accent,
        fontSize: `${fontSize}px`,
        fontWeight: 800,
        lineHeight: 1.2,
      },
    },
    text,
  );
}

function chip(text: string, color: string): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        border: `2px solid ${withAlpha(color, 0.32)}`,
        color,
        background: withAlpha(color, 0.08),
        borderRadius: '999px',
        padding: '8px 14px',
        fontSize: '22px',
        fontWeight: 800,
        lineHeight: 1.1,
      },
    },
    text,
  );
}

function contextPill(text: string, accent: string): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        borderLeft: `8px solid ${accent}`,
        background: COLORS.bg2,
        color: COLORS.ink,
        padding: '12px 16px',
        fontSize: '24px',
        fontWeight: 800,
        lineHeight: 1.25,
      },
    },
    text,
  );
}

function resolveVariantCopy(family: FamilyCode, variant: WorktypeVariantId): WorktypeVariant {
  const variants = VARIANTS[family] as Record<string, WorktypeVariant>;
  return variants[variant] ?? variants[VARIANT_IDS_BY_FAMILY[family][0]!]!;
}

export function buildWorktypeFeatureLabel(family: FamilyCode): string {
  return `${LABELS.featureName} / ${FAMILIES[family].name}`;
}

export function buildWorktypeContextCopy(
  gap: GapKind | undefined,
  gapLine: string,
  job: WorktypeJobContext | null,
): string {
  if (!gap && !job) return '';
  const parts: string[] = [];
  if (job) {
    parts.push(job.worktypeName ? `${job.title} / ${job.worktypeName}` : job.title);
  }
  if (gapLine) parts.push(gapLine);
  return `${LABELS.gap}: ${parts.join(' · ')}`;
}

async function fetchJobContext(
  url: URL,
  jobId: string,
  projection: WorktypesProjectionShape,
): Promise<WorktypeJobContext | null> {
  let paddedId: string;
  try {
    paddedId = padId(jobId);
  } catch {
    return null;
  }

  const detailUrl = new URL(`/data.detail/${paddedId}.json`, trustedFetchOrigin(url));
  const detailRes = await fetch(detailUrl.toString());
  if (!detailRes.ok) return null;

  const detailRaw: unknown = await detailRes.json();
  const detailParsed = DetailRecordSchema.safeParse(detailRaw);
  if (!detailParsed.success) return null;

  const title = detailParsed.data.title?.ja;
  if (!title) return null;

  const worktypeRecord = projection.occupations[String(Number(jobId))];
  if (!worktypeRecord) return null;
  return {
    title,
    worktypeCode: worktypeRecord.code,
    worktypeName: FAMILIES[worktypeRecord.code].name,
    score: detailParsed.data.ai_risk?.score ?? null,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
