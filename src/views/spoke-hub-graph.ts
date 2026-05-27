/**
 * src/views/spoke-hub-graph.ts — Phase A: compute "related hubs" for each spoke (occupation).
 *
 * For every occupation page, derive 8-12 contextually relevant hubs from across
 * all 17 hub categories. This builds a dense back-link network: each spoke points
 * to its sector + matching ranking + matching ability/skill/knowledge/value
 * + matching career persona + matching license category + matching Q&A
 * + matching compare pair.
 *
 * Pure data computation — no rendering. Consumers (the spoke template) get a
 * grouped + sorted list of hub references and render them however they want.
 *
 * Performance: this runs once per spoke build, so it's called 556 times. Each
 * call walks lookup data structures sized at ~100 entries; total cost stays
 * sub-second across the full build.
 *
 * Migrated from src/data/lib/spoke-hub-graph.ts 2026-05-14 (Phase B).
 * DetailFileMin / genre-configs / rankings-meta still in src/data/lib/
 * (cross-directory imports — resolves when those migrate later).
 */
import type { DetailFileMin } from './genre-hub.js';
import { ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS,
  WORK_STYLES_CONFIGS } from './genre-configs.js';
import { SKILL_META } from './skills-meta.js';
import { INTEREST_META, type InterestType } from './interests-meta.js';
import { CAREER_PERSONAS } from './careers-meta.js';
import { LICENSE_HUBS, matchLicense } from './licenses-meta.js';
import { QA_ITEMS } from './qa-meta.js';
import { COMPARE_META } from './compare-meta.js';
import { RANKING_META, type RankingSlug } from './rankings-meta.js';
import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';

// ─── Public types ─────────────────────────────────────────────────────────

export interface RelatedHub {
  /** Category label shown to user, e.g. "業種" / "AI 影響度" / "資格" */
  category: string;
  /** Display name of this specific hub, e.g. "医療・保健" */
  name: string;
  /** href, e.g. "/ja/sectors/iryo" */
  href: string;
  /** Optional 1-line description (shown smaller below name) */
  desc?: string;
}

export interface SpokeHubsResult {
  /** Grouped by category, in display order */
  groups: ReadonlyArray<{ category: string; items: ReadonlyArray<RelatedHub> }>;
  /** Total number of hub links produced */
  total: number;
}

// ─── Detail-shape extras (Phase A also reads holland + interest if present) ──

export interface DetailFileSpoke extends DetailFileMin {
  /** Phase 3 added — RIASEC scores per occupation, 0-5 per dim */
  interests?: { realistic?: number; investigative?: number; artistic?: number;
                social?: number; enterprising?: number; conventional?: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Top-N entries of a `dimension_top5`-style array, returns the keys that
 * are in the GIVEN allowlist (so we can find which configured hubs apply).
 */
function topDimensionMatches(
  arr: Array<{ key: string; score: number }> | null | undefined,
  hubKeys: ReadonlyArray<string>,
  topN: number,
): Array<{ key: string; score: number }> {
  if (!arr || arr.length === 0) return [];
  const sorted = [...arr].sort((a, b) => b.score - a.score).slice(0, topN);
  return sorted.filter((entry) => hubKeys.includes(entry.key));
}

/**
 * RIASEC: detect which interest type(s) this occupation scores HIGHEST in.
 * Returns at most 2 (the top 2 dim names).
 */
function topInterestTypes(d: DetailFileSpoke, max: number = 2): InterestType[] {
  const i = d.interests;
  if (!i) return [];
  const pairs: Array<[InterestType, number]> = [
    ['realistic', i.realistic ?? 0],
    ['investigative', i.investigative ?? 0],
    ['artistic', i.artistic ?? 0],
    ['social', i.social ?? 0],
    ['enterprising', i.enterprising ?? 0],
    ['conventional', i.conventional ?? 0],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  // Only return interests where the score is >0
  return pairs.filter(([, s]) => s > 0).slice(0, max).map(([k]) => k);
}

// ─── Ranking match: which rankings does THIS occupation appear in (TOP30)? ──
// The caller (spoke template) is responsible for building this map ONCE
// (across all 556 spokes) by calling buildRankingHitsByOcc and passing it
// into computeSpokeHubs as part of the context. This avoids circular imports
// between rankings.ts and this module, and keeps everything synchronous.

export interface RankingHit { slug: RankingSlug; rank: number; }

/**
 * One-time builder: pass in the result of buildRankings() and get a Map
 * keyed by occupation id → list of ranking hits (with rank position).
 *
 * Call this ONCE in the spoke template's getStaticPaths, then pass the
 * resulting map to computeSpokeHubs for each occupation.
 */
export function buildRankingHitsByOcc(
  rankingResults: Iterable<{ slug: string; items: ReadonlyArray<{ id: number }> }>,
): Map<number, RankingHit[]> {
  const out = new Map<number, RankingHit[]>();
  for (const r of rankingResults) {
    r.items.forEach((occ, idx) => {
      const arr = out.get(occ.id) ?? [];
      arr.push({ slug: r.slug as RankingSlug, rank: idx + 1 });
      out.set(occ.id, arr);
    });
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface ComputeSpokeHubsContext {
  /** Pre-built Map<occId, RankingHit[]> from buildRankingHitsByOcc(). */
  rankingHitsByOcc?: ReadonlyMap<number, ReadonlyArray<RankingHit>>;
}

/**
 * Compute the "related hubs" map for a single occupation.
 *
 * Inputs:
 *   - d: this occupation's DetailFileMin (read from public/data.detail/<id>.json)
 *   - ctx: optional context with pre-built lookups (e.g. rankingHitsByOcc).
 *
 * Output: groups in display order. Each group has 1-3 hubs; total ~8-12.
 */
export function computeSpokeHubs(d: DetailFileSpoke, ctx: ComputeSpokeHubsContext = {}): SpokeHubsResult {
  const groups: Array<{ category: string; items: RelatedHub[] }> = [];

  // 1) Sector hub (always 1)
  if (d.sector?.id && d.sector?.ja) {
    groups.push({
      category: '業種',
      items: [{
        category: '業種',
        name: d.sector.ja,
        href: `/ja/sectors/${d.sector.id}`,
        desc: `${d.sector.ja}業界の他の職業を探す`,
      }],
    });
  }

  // 2) Rankings (top 3 ranks this occupation appears in)
  const rankings = (ctx.rankingHitsByOcc?.get(d.id) ?? []).slice(0, 3);
  if (rankings.length > 0) {
    const items: RelatedHub[] = rankings.map((rh) => {
      const meta = RANKING_META.find((m) => m.slug === rh.slug);
      const name = meta?.name_ja ?? rh.slug;
      return {
        category: 'ランキング',
        name,
        href: `/ja/rankings/${rh.slug}`,
        desc: `この職業は ${rh.rank} 位`,
      };
    });
    groups.push({ category: 'ランキング', items });
  }

  // 3) Abilities (top 2 of this occupation's abilities that have a configured hub)
  const abilityKeys = ABILITIES_CONFIGS.map((c) => c.dimension_key!).filter(Boolean);
  const abilityHits = topDimensionMatches(d.abilities_top5, abilityKeys, 5).slice(0, 2);
  if (abilityHits.length > 0) {
    const items: RelatedHub[] = abilityHits.map((h) => {
      const cfg = ABILITIES_CONFIGS.find((c) => c.dimension_key === h.key)!;
      return {
        category: '能力',
        name: cfg.short_ja,
        href: `/ja/abilities/${cfg.slug}`,
        desc: cfg.title_ja,
      };
    });
    groups.push({ category: '能力', items });
  }

  // 4) Knowledge (top 2)
  const knowledgeKeys = KNOWLEDGE_CONFIGS.map((c) => c.dimension_key!).filter(Boolean);
  const knowledgeHits = topDimensionMatches(d.knowledge_top5, knowledgeKeys, 5).slice(0, 2);
  if (knowledgeHits.length > 0) {
    const items: RelatedHub[] = knowledgeHits.map((h) => {
      const cfg = KNOWLEDGE_CONFIGS.find((c) => c.dimension_key === h.key)!;
      return {
        category: '知識',
        name: cfg.short_ja,
        href: `/ja/knowledge/${cfg.slug}`,
        desc: cfg.title_ja,
      };
    });
    groups.push({ category: '知識', items });
  }

  // 5) Skills (top 2 — note SKILL_META uses ipd_key as the dim key)
  const skillKeys = SKILL_META.map((m) => m.ipd_key);
  const skillHits = topDimensionMatches(d.skills_top10, skillKeys, 10).slice(0, 2);
  if (skillHits.length > 0) {
    const items: RelatedHub[] = skillHits.map((h) => {
      const meta = SKILL_META.find((m) => m.ipd_key === h.key)!;
      return {
        category: 'スキル',
        name: meta.short_ja,
        href: `/ja/skills/${meta.slug}`,
        desc: meta.title_ja,
      };
    });
    groups.push({ category: 'スキル', items });
  }

  // 6) Values (top 1 — values are highly personal so 1 link suffices)
  const valueKeys = VALUES_CONFIGS.map((c) => c.dimension_key!).filter(Boolean);
  const valueHits = topDimensionMatches(d.work_values_top5, valueKeys, 5).slice(0, 1);
  if (valueHits.length > 0) {
    const items: RelatedHub[] = valueHits.map((h) => {
      const cfg = VALUES_CONFIGS.find((c) => c.dimension_key === h.key)!;
      return {
        category: '価値観',
        name: cfg.short_ja,
        href: `/ja/values/${cfg.slug}`,
        desc: cfg.title_ja,
      };
    });
    groups.push({ category: '価値観', items });
  }

  // 7) Work styles (top 1)
  const workKeys = WORK_STYLES_CONFIGS.map((c) => c.dimension_key!).filter(Boolean);
  const workHits = topDimensionMatches(d.work_characteristics_top5, workKeys, 5).slice(0, 1);
  if (workHits.length > 0) {
    const items: RelatedHub[] = workHits.map((h) => {
      const cfg = WORK_STYLES_CONFIGS.find((c) => c.dimension_key === h.key)!;
      return {
        category: '働き方',
        name: cfg.short_ja,
        href: `/ja/work-styles/${cfg.slug}`,
        desc: cfg.title_ja,
      };
    });
    groups.push({ category: '働き方', items });
  }

  // 8) Interests / RIASEC (top 1-2 dominant types)
  const interestSlugs = topInterestTypes(d, 2);
  if (interestSlugs.length > 0) {
    const items: RelatedHub[] = interestSlugs.map((slug) => {
      const meta = INTEREST_META.find((m) => m.slug === slug)!;
      return {
        category: '興味タイプ',
        name: `${meta.letter} (${meta.name_ja})`,
        href: `/ja/interests/${slug}`,
        desc: `${meta.name_ja}タイプ向けの職業`,
      };
    });
    groups.push({ category: '興味タイプ', items });
  }

  // 9) Career personas (top 2 personas where this occ is recommended)
  const personaScores = CAREER_PERSONAS
    .map((p) => ({ persona: p, score: p.recommend(d) }))
    .filter((x): x is { persona: typeof CAREER_PERSONAS[number]; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  if (personaScores.length > 0) {
    const items: RelatedHub[] = personaScores.map((x) => ({
      category: 'キャリア段階',
      name: x.persona.short_ja,
      href: `/ja/careers/${x.persona.slug}`,
      desc: x.persona.title_ja,
    }));
    groups.push({ category: 'キャリア段階', items });
  }

  // 10) Licenses (top 2 license categories that match this occupation's certs)
  const licenseHits = LICENSE_HUBS.filter((hub) => matchLicense(d, hub)).slice(0, 2);
  if (licenseHits.length > 0) {
    const items: RelatedHub[] = licenseHits.map((hub) => ({
      category: '資格',
      name: hub.short_ja,
      href: `/ja/licenses/${hub.slug}`,
      desc: hub.title_ja,
    }));
    groups.push({ category: '資格', items });
  }

  // 11) Q&A (top 2 questions where this occ is in the answer's example list)
  const qaHits = QA_ITEMS
    .map((qa) => ({ qa, score: qa.selector(d) }))
    .filter((x): x is { qa: typeof QA_ITEMS[number]; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  if (qaHits.length > 0) {
    const items: RelatedHub[] = qaHits.map((x) => ({
      category: 'Q&A',
      name: x.qa.question,
      href: `/ja/q/${x.qa.slug}`,
      desc: x.qa.short_answer.slice(0, 50) + '…',
    }));
    groups.push({ category: 'Q&A', items });
  }

  // 12) Compare hubs (any compare that includes this occupation)
  const compareHits = COMPARE_META.filter((m) => m.occ_a_id === d.id || m.occ_b_id === d.id).slice(0, 2);
  if (compareHits.length > 0) {
    const items: RelatedHub[] = compareHits.map((m) => ({
      category: '比較',
      name: m.title_ja,
      href: `/ja/compare/${m.slug}`,
      desc: 'この職業の比較ページ',
    }));
    groups.push({ category: '比較', items });
  }

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return { groups, total };
}

/**
 * Render the related-hubs section as HTML. Keep it simple: a section title,
 * a series of category sub-headers, each with a horizontal pill-list of links.
 */
export function renderSpokeHubsSection(result: SpokeHubsResult): SafeHtml {
  if (result.total === 0) return '' as SafeHtml;

  const groupsHtml = result.groups.map((g) => {
    const itemsHtml = g.items.map((item) =>
      `<li><a class="rh-link" href="${escapeHtml(item.href)}">` +
      `<span class="rh-name">${escapeHtml(item.name)}</span>` +
      (item.desc ? `<span class="rh-desc">${escapeHtml(item.desc)}</span>` : '') +
      `</a></li>`
    ).join('');
    return `<div class="related-hub-group">` +
           `<h3 class="rh-cat">${escapeHtml(g.category)}</h3>` +
           `<ul class="rh-list">${itemsHtml}</ul>` +
           `</div>`;
  }).join('');

  return (`<section class="related-hubs" aria-label="この職業に関連する hub">
    <h2>この職業を探した人が見る hub（${result.total} 件）</h2>
    <div class="related-hubs-grid">${groupsHtml}</div>
  </section>`) as SafeHtml;
}

/** CSS for the related-hubs section — to be injected into the spoke <style>. */
export const RELATED_HUBS_CSS = `
.related-hubs{margin:48px 0 24px;padding:24px 22px;background:var(--bg2);border:1px solid var(--border);border-radius:10px}
.related-hubs h2{font-family:var(--font-serif);font-size:1.1rem;color:var(--accent-deep);margin:0 0 18px;font-weight:600}
/* RA-118 (2026-05-18): grid-auto-rows + flex height:100% chain so groups
   with fewer links don't show large empty space below; rh-link cards in
   different groups stay aligned even when one has rh-desc and another
   does not. */
.related-hubs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;grid-auto-rows:1fr;align-items:start}
.related-hub-group{display:flex;flex-direction:column;height:100%}
.related-hub-group .rh-cat{font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);margin:0 0 8px;font-weight:600;font-family:var(--font-sans)}
.related-hub-group .rh-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;flex:1}
.related-hub-group .rh-list li{margin:0;display:flex}
.related-hub-group .rh-link{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);transition:border-color 150ms,background 150ms;width:100%;min-height:71px}
.related-hub-group .rh-link:hover{border-color:var(--accent);background:rgba(217,107,61,0.04);text-decoration:none}
.related-hub-group .rh-name{font-family:var(--font-serif);font-size:.92rem;color:var(--fg);line-height:1.35}
.related-hub-group .rh-desc{font-size:.72rem;color:var(--fg2);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:600px){.related-hubs{padding:18px 16px;margin:32px 0 18px}.related-hubs h2{font-size:1rem}.related-hubs-grid{grid-template-columns:1fr;gap:14px}}
`;
