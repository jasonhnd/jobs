/**
 * src/views/ranking/utilities.ts — pure helper functions used by the
 * per-theme ranking builders + the orchestrator.
 *
 * Extracted from src/views/ranking.ts (2026-05-17, audit finding
 * CODE-010). Functions here are stateless, side-effect-free, and accept
 * Occupation values via parameter — no module-level state, no I/O.
 */

import type { Occupation } from './config.js';

// ─── Sector groupings ────────────────────────────────────────────

/** Sector groups used by physical / interpersonal / craft rankings. */
export const PHYSICAL_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'noringyo', 'keiseki',
]);

export const INTERPERSONAL_SECTORS: ReadonlySet<string> = new Set([
  'iryo', 'fukushi', 'kyoiku', 'hanbai', 'service',
]);

export const CRAFT_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'keiseki', 'noringyo',
]);

export const PUBLIC_SECTORS: ReadonlySet<string> = new Set([
  'hoan', // 保安・公安 (police/fire/etc)
]);

export function inSectorSet(o: Occupation, set: ReadonlySet<string>): boolean {
  return set.has(o.sector_id);
}

// ─── Distribution-key lookups ────────────────────────────────────
// 2026-05-17 CODE-011 fix: education / employment JA labels are no
// longer hard-coded in this file. They flow from the single source
// of truth at src/data/domain/distribution-labels.ts, which is also
// what src/data/projections/treemap.ts uses to map IPD EN keys →
// JA labels. Any future label rename now propagates mechanically;
// TypeScript catches stale literals downstream.
import { EDU, EMP } from '../../data/domain/distribution-labels.js';
// Re-export for ranking sub-files (../rankings/*).
export { EDU, EMP };

/**
 * Pull a 学歴 key from education_pct (JA keys via `EDU.*` const).
 * Returns 0 when missing — safe for sort comparisons.
 */
export function eduPct(o: Occupation, key: string): number {
  return o.education_pct?.[key] ?? 0;
}

/**
 * 大学院卒比率 = 修士 + 博士 (combined).
 */
export function gradPct(o: Occupation): number {
  return eduPct(o, EDU.masters) + eduPct(o, EDU.doctorate);
}

/**
 * Pull 雇用形態 key (JA via `EMP.*` const).
 */
export function empPct(o: Occupation, key: string): number {
  return o.employment_type?.[key] ?? 0;
}

// ─── Sort helpers ────────────────────────────────────────────────

export function byKeyDesc<T>(
  items: T[],
  key: (o: T) => number | null | undefined,
  tie: (o: T) => number = () => 0,
): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (bv !== av) return bv - av;
    return tie(a) - tie(b);
  });
}

export function byKeyAsc<T>(
  items: T[],
  key: (o: T) => number | null | undefined,
  tie: (o: T) => number = () => 0,
): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (av !== bv) return av - bv;
    return tie(a) - tie(b);
  });
}

// ─── Aggregations ────────────────────────────────────────────────

/**
 * `export` so ranking-renderers.ts can reuse them. Exposed-internal helpers,
 * not part of the rankings.ts façade — callers should still import from
 * the './ranking' barrel to keep the public surface in one place.
 */
export function safeMean(items: Occupation[], key: keyof Occupation): number {
  const vals = items
    .map((o) => o[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// ─── Hub-card preview helper ─────────────────────────────────────

/**
 * Build a short "1位 <name>（<metric>）" preview string for the hub
 * cards on /ja/rankings/.
 */
export function makePreview(items: Occupation[], metric: (o: Occupation) => string): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  return `1位 ${name}（${metric(top)}）`;
}
