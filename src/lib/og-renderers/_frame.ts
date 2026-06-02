/**
 * src/lib/og-renderers/_frame.ts — shared chrome for every OG card.
 *
 * The four card renderers (generic / occupation / sector / map) each used
 * to carry their own copy of the COLORS table, the top bar (badge + site
 * mark) and the footer hairline. That duplication drifted: the occupation
 * card was missing the left rule the others had, badge letter-spacing
 * diverged, and only the generic card carried the "非公式" sign-off. This
 * module is the single source of that chrome so all four stay identical.
 *
 * Everything here is satori-renderable (@vercel/og): flexbox + gradients
 * only — no grid, no external images, no absolute positioning. Renderers
 * build their element tree with `createElement` (aliased `h`) because
 * Vercel's Edge bundler has no TSX loader for dependencies (see the
 * generic.ts header for the full rationale).
 */

import { createElement as h } from 'react';
import type { ReactElement, ReactNode } from 'react';

export const SITE_MARK = 'mirai-shigoto.com';
export const FOOTER_LEFT = '厚生労働省 jobtag · JILPT IPD v7.00 · Claude Opus 4.8';
export const FOOTER_RIGHT = '非公式 / Independent';
export const BADGE_TEXT = '独立分析';

// Direction C palette — synced from styles/mobile-tokens.css.
export const COLORS = {
  bg: '#FAF6EE', // warm cream canvas
  ink: '#241E18', // primary ink
  muted: '#7A6F5E', // secondary muted
  hairline: 'rgba(36, 30, 24, 0.12)',
  accent: '#D96B3D', // terracotta — badge / default left rule
  bg2: '#FFFFFF', // elevated surface
} as const;

// favicon の 4 タイル色 (treemap mark). Synced with BaseLayout の inline SVG favicon.
const MARK_COLORS = ['#FFD84D', '#FF8A3D', '#80C0FF', '#00B04B'] as const;

/**
 * Glyphs the shared chrome always renders. Each renderer appends this to
 * its own subset string so `loadGoogleFont` fetches every character used
 * (a missing glyph renders as tofu □). The 2×2 mark has no text, so it
 * contributes nothing here.
 */
export const FRAME_SUBSET = `${BADGE_TEXT} ${SITE_MARK} ${FOOTER_LEFT} ${FOOTER_RIGHT}`;

/** 2×2 treemap tile mark — brand echo of the site favicon. */
export function treemapMark(size = 28): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '6px',
        overflow: 'hidden',
        flexShrink: 0,
      },
    },
    ...MARK_COLORS.map((c, i) =>
      h('div', { key: i, style: { display: 'flex', width: '50%', height: '50%', background: c } }),
    ),
  );
}

/** Top bar: 独立分析 badge (left) + treemap mark & site mark (right). */
export function topBar(): ReactElement {
  return h(
    'div',
    { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
    h(
      'div',
      {
        style: {
          display: 'flex',
          background: COLORS.accent,
          color: '#FFFFFF',
          padding: '8px 18px',
          borderRadius: '999px',
          fontWeight: 800,
          fontSize: '22px',
          letterSpacing: '0.08em',
        },
      },
      BADGE_TEXT,
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
      treemapMark(28),
      h(
        'div',
        { style: { display: 'flex', fontSize: '24px', color: COLORS.muted, fontWeight: 500 } },
        SITE_MARK,
      ),
    ),
  );
}

/** Eyebrow line — uppercase accent label above the title. Unified across
 *  all card types (generic used to render this muted, the rest accent). */
export function eyebrow(text: string, color: string = COLORS.accent): ReactElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        fontSize: '28px',
        color,
        fontWeight: 800,
        letterSpacing: '0.16em',
      },
    },
    text,
  );
}

/**
 * Bottom bar: hairline + caller's data items on the left, 非公式 sign-off
 * on the right. `left` may be a single node or an array of <span>s; they
 * are laid out in a gap-separated flex row.
 */
export function footer(left: ReactNode): ReactElement {
  const leftItems = Array.isArray(left) ? left : [left];
  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: `1px solid ${COLORS.hairline}`,
        paddingTop: '22px',
        marginTop: '28px',
        color: COLORS.muted,
        fontSize: '22px',
        fontWeight: 500,
      },
    },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '18px' } }, ...leftItems),
    h('div', { style: { display: 'flex', flexShrink: 0, marginLeft: '24px' } }, FOOTER_RIGHT),
  );
}

/**
 * 0–10 mini scale bar with the current score filled in `color`. Gives the
 * occupation card's giant number a "measured against the scale" read.
 * Caller must include the glyphs "0 5 10" in its font subset.
 */
export function miniScale(score: number, color: string): ReactElement {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' } },
    h(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          height: '12px',
          borderRadius: '999px',
          backgroundColor: 'rgba(36, 30, 24, 0.10)',
          overflow: 'hidden',
        },
      },
      h('div', {
        style: {
          display: 'flex',
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: '999px',
        },
      }),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '18px',
          color: COLORS.muted,
          fontWeight: 500,
        },
      },
      h('span', { style: { display: 'flex' } }, '0'),
      h('span', { style: { display: 'flex' } }, '5'),
      h('span', { style: { display: 'flex' } }, '10'),
    ),
  );
}

/**
 * Outer card shell: warm-cream canvas, parameterised left rule (terracotta
 * for generic/map, risk colour for occupation, sector hue for sector), and
 * a faint top-right warm highlight for depth. `children` are the top bar,
 * main block, and footer in order.
 */
export function ogShell(accent: string, children: ReactNode[]): ReactElement {
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        backgroundImage:
          'radial-gradient(circle at 92% 4%, rgba(217, 107, 61, 0.12), rgba(217, 107, 61, 0) 42%)',
        color: COLORS.ink,
        fontFamily: 'NotoSansJP',
        padding: '48px 64px',
        borderLeft: `16px solid ${accent}`,
      },
    },
    ...children,
  );
}
