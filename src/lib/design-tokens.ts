/**
 * design-tokens.ts — machine canon for Design v1.0 token VALUES.
 *
 * Two canons, one subject (docs/Design.md 現行契約):
 *
 *   design-tokens.ts  → the values (px / hex / ms). Guarded by typecheck + tests.
 *   docs/Design.md    → the rules and the reasoning. Guarded by review.
 *
 * Every value below is copied verbatim from Design.md §21.2. **Do not choose
 * your own.** Adding a step, a role, or a token requires updating Design.md
 * first and owner approval (§19.4 / §20.6) — an agent must never revise the
 * canon to match its implementation.
 *
 * Emission: `canonical-css.ts` interpolates `DESIGN_TOKENS_CSS` into its single
 * `:root` block, which every page ships via `Footer.astro`'s `<style is:global>`
 * (§18.4 — `:root{}` exists in exactly one file).
 *
 * Migration step 1 (`tokens` surface, DESIGN_CONFORMANCE.md): these custom
 * properties are DECLARED here but REFERENCED by nothing. Declared-but-unused
 * custom properties have no rendering effect, so this unit is visually inert
 * and independently revertible. Consumers arrive surface by surface, in the
 * order fixed by §19.5.
 */

/**
 * §20.2 — the version is declared in exactly three places: Design.md §0,
 * this constant, and the leading comment of the generated CSS. `check-design-sync`
 * (§19.1, not yet implemented) will assert the three agree.
 */
export const DESIGN_VERSION = '1.0';

/** §4.2 — the type scale. Seven steps, no others. Site-wide minimum is 12px. */
export const TYPE_SCALE = {
  '--t-display': 'clamp(32px, 6vw, 40px)',
  '--t-h1': '28px',
  '--t-h2': '22px',
  '--t-h3': '18px',
  '--t-body': '16px',
  '--t-sm': '14px',
  '--t-xs': '12px',
} as const;

/** §4.6 — line height. Larger type is set tighter. */
export const LINE_HEIGHT = {
  '--lh-display': '1.15',
  '--lh-h1': '1.25',
  '--lh-h2': '1.35',
  '--lh-h3': '1.4',
  '--lh-h4': '1.5',
  '--lh-body': '1.75',
  '--lh-dense': '1.4',
} as const;

/** §4.4 — the only monospace stack. Bare `monospace` is prohibited. */
export const FONT = {
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/**
 * §2.1 — new in v1.0. AA-safe negative / error foreground at body size;
 * `--red` (#c95a3a) does not clear 4.5:1 at --t-xs (§2.2).
 *
 * This is the only colour that lives in this module. Layer 1 and layer 2
 * colours stay in `canonical-css.ts` untouched — layer 2 aliases are NOT
 * equal to their layer 1 counterparts and must never be folded into them
 * (§21.4).
 */
export const COLOR = {
  '--red-text': '#ad4d32',
} as const;

/** §8.1 — 4px grid, eight steps. "padding inside, gap between." */
export const SPACE = {
  '--s-1': '4px',
  '--s-2': '8px',
  '--s-3': '12px',
  '--s-4': '16px',
  '--s-5': '24px',
  '--s-6': '32px',
  '--s-7': '48px',
  '--s-8': '64px',
} as const;

/** §8.2 — four radii, replacing the 32 in-flight values. */
export const RADIUS = {
  '--r-sm': '6px',
  '--r-md': '10px',
  '--r-lg': '16px',
  '--r-pill': '999px',
} as const;

/**
 * §8.3 — three shadows, replacing 21. Warm-biased on purpose: a neutral
 * `rgba(0,0,0,·)` shadow reads muddy over the cream canvas.
 */
export const SHADOW = {
  '--sh-card': '0 1px 0 rgba(0,0,0,0.03), 0 6px 18px rgba(120,80,30,0.04)',
  '--sh-raised': '0 1px 0 rgba(0,0,0,0.03), 0 12px 28px rgba(120,80,30,0.06)',
  '--sh-accent': '0 4px 14px rgba(217,107,61,0.28)',
} as const;

/** §9.3 — six layers, replacing 19. `9999` / `10000` are prohibited. */
export const Z_INDEX = {
  '--z-base': '0',
  '--z-raised': '10',
  '--z-sticky': '100',
  '--z-overlay': '200',
  '--z-modal': '300',
  '--z-toast': '400',
} as const;

/** §10 — motion. Animate `transform` and `opacity` only. */
export const MOTION = {
  '--dur-fast': '120ms',
  '--dur-base': '200ms',
  '--ease': 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/**
 * §9.2 — the three breakpoints, replacing 16 in-flight values.
 *
 * These are TS constants rather than custom properties because CSS variables
 * cannot be used inside a media-query condition — `@media (max-width: var(--x))`
 * does not work. The numbers are written into the CSS text directly.
 */
export const BREAKPOINTS = {
  /** smartphone — up to and including 599px */
  sp: 599,
  /** tablet — lower bound (upper bound is pc - 1) */
  tb: 600,
  /** desktop — from 900px up */
  pc: 900,
} as const;

/** §9.2 — the only three media-query conditions permitted. */
export const MEDIA = {
  sp: `(max-width: ${BREAKPOINTS.sp}px)`,
  tb: `(min-width: ${BREAKPOINTS.tb}px) and (max-width: ${BREAKPOINTS.pc - 1}px)`,
  pc: `(min-width: ${BREAKPOINTS.pc}px)`,
} as const;

/** A `--custom-property` → value map, as declared inside `:root`. */
export type TokenGroup = Readonly<Record<string, string>>;

/**
 * Declaration order inside `:root`. Groups carry their Design.md clause so the
 * generated CSS stays traceable to the canon without opening this file.
 */
export const DESIGN_TOKEN_GROUPS: ReadonlyArray<{
  readonly clause: string;
  readonly label: string;
  readonly tokens: TokenGroup;
}> = [
  { clause: '§4.2', label: 'type scale', tokens: TYPE_SCALE },
  { clause: '§4.6', label: 'line height', tokens: LINE_HEIGHT },
  { clause: '§4.4', label: 'monospace', tokens: FONT },
  { clause: '§2.1', label: 'AA-safe negative text', tokens: COLOR },
  { clause: '§8.1', label: 'spacing (4px grid)', tokens: SPACE },
  { clause: '§8.2', label: 'radius', tokens: RADIUS },
  { clause: '§8.3', label: 'shadow', tokens: SHADOW },
  { clause: '§9.3', label: 'z-index', tokens: Z_INDEX },
  { clause: '§10', label: 'motion', tokens: MOTION },
];

/** Every token name → value, flattened. Used by tests and future gates. */
export const DESIGN_TOKENS: TokenGroup = Object.freeze(
  Object.fromEntries(
    DESIGN_TOKEN_GROUPS.flatMap((group) => Object.entries(group.tokens)),
  ),
);

const INDENT = '  ';

/**
 * The `:root` declaration text, indented to match `canonical-css.ts`.
 * Interpolated inside that file's single `:root { … }` block — never emitted
 * as its own `:root`, which §18.4 forbids.
 */
export const DESIGN_TOKENS_CSS: string = DESIGN_TOKEN_GROUPS.map((group) => {
  const header = `${INDENT}/* ${group.clause} ${group.label} */`;
  const decls = Object.entries(group.tokens).map(
    ([name, value]) => `${INDENT}${name}: ${value};`,
  );
  return [header, ...decls].join('\n');
}).join('\n');
