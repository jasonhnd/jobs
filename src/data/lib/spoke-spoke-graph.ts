/**
 * spoke-spoke-graph.ts — Phase C: cross-sector "same AI risk ±1" neighbors,
 * with mandatory symmetry.
 *
 * Each spoke gets a second related-spoke section beyond transfer_paths:
 *   - 5 occupations with AI risk = (this.risk ± 1)
 *   - cross-sector (different sector_id), so it's a distinct semantic axis
 *     from "transfer paths" which is same-sector skill similarity
 *   - sorted by workforce desc (so user sees big, well-known peers first)
 *   - SYMMETRIZED: if A→B then B→A, by union of both directions' top-K
 *
 * Symmetry matters for SEO: Google identifies topic clusters more confidently
 * when nodes are mutually connected. Top-N alone produces an asymmetric graph
 * (a big occupation may not list a small same-risk peer because workforce-rank
 * pushes the small one out of TOP 5, but the small peer ALWAYS lists the big
 * one — that's the asymmetry). Union top-K corrects it.
 */

import { escapeHtml } from '../../lib/safe-html.js';

export interface SpokeNeighbor {
  id: number;
  name_ja: string;
  ai_risk: number | null;
  sector_id: string | null;
  sector_ja: string | null;
  workers: number | null;
}

export interface SpokeMin {
  id: number;
  name_ja: string;
  ai_risk: number | null;
  sector_id: string | null;
  sector_ja: string | null;
  workers: number | null;
}

interface ComputeOptions {
  /** AI-risk window radius. Default 1 (so ±1 means risk-1 to risk+1). */
  span?: number;
  /** Top N per direction. Default 5. */
  topN?: number;
}

/**
 * For each spoke, compute its top-N cross-sector same-risk peers,
 * symmetrized via union (if either A→B or B→A makes the cut, both link).
 *
 * Returns: Map<id, SpokeNeighbor[]>
 */
export function buildSameRiskNeighbors(
  all: ReadonlyArray<SpokeMin>,
  opts: ComputeOptions = {},
): Map<number, SpokeNeighbor[]> {
  const span = opts.span ?? 1;
  const topN = opts.topN ?? 5;

  // First pass: per-source top-N (asymmetric).
  const oneWay = new Map<number, SpokeNeighbor[]>();
  for (const src of all) {
    if (src.ai_risk === null) {
      oneWay.set(src.id, []);
      continue;
    }
    const candidates = all
      .filter((c) =>
        c.id !== src.id &&
        c.ai_risk !== null &&
        Math.abs((c.ai_risk as number) - (src.ai_risk as number)) <= span &&
        c.sector_id !== src.sector_id, // cross-sector
      )
      .sort((a, b) => {
        const aw = a.workers ?? 0;
        const bw = b.workers ?? 0;
        if (aw !== bw) return bw - aw;
        return a.id - b.id;
      })
      .slice(0, topN);
    oneWay.set(src.id, candidates);
  }

  // Second pass: symmetrize. For each (A, B) where B is in A's list, ensure
  // A is also in B's list. If not, add A to B's list (capped at topN + 3
  // to avoid runaway growth in dense risk bands).
  const symCap = topN + 3;
  const symmetric = new Map<number, SpokeNeighbor[]>();
  for (const [id, list] of oneWay) {
    symmetric.set(id, [...list]);
  }
  for (const [aId, aList] of oneWay) {
    const aRecord = all.find((x) => x.id === aId);
    if (!aRecord) continue;
    for (const b of aList) {
      const bSym = symmetric.get(b.id) ?? [];
      if (bSym.some((x) => x.id === aId)) continue; // already in B's list
      if (bSym.length >= symCap) continue; // cap to avoid bloat
      // Add A to B's list as a SpokeNeighbor view of A.
      bSym.push({
        id: aRecord.id,
        name_ja: aRecord.name_ja,
        ai_risk: aRecord.ai_risk,
        sector_id: aRecord.sector_id,
        sector_ja: aRecord.sector_ja,
        workers: aRecord.workers,
      });
      symmetric.set(b.id, bSym);
    }
  }

  // Re-sort each list by workers desc, id asc (stable order after the merge).
  for (const list of symmetric.values()) {
    list.sort((a, b) => {
      const aw = a.workers ?? 0;
      const bw = b.workers ?? 0;
      if (aw !== bw) return bw - aw;
      return a.id - b.id;
    });
  }

  return symmetric;
}

/** Render the cross-sector same-risk neighbors as an HTML section. */
export function renderSameRiskSection(neighbors: ReadonlyArray<SpokeNeighbor>, sourceRisk: number | null): string {
  if (neighbors.length === 0) return '';
  const fmtInt = (n: number | null): string =>
    n === null ? '—' : Math.trunc(n).toLocaleString('en-US');

  const cards = neighbors.map((n) => {
    const ai = n.ai_risk === null ? '—' : `${n.ai_risk}/10`;
    const sec = n.sector_ja ?? '';
    const wkr = fmtInt(n.workers);
    return `<a class="srn-card" href="/ja/${n.id}">` +
           `<span class="srn-name">${escapeHtml(n.name_ja)}</span>` +
           `<span class="srn-meta"><span class="srn-risk">AI 影響 ${ai}</span>` +
           (sec ? `<span class="srn-sector">${escapeHtml(sec)}</span>` : '') +
           (n.workers ? `<span class="srn-workers">${wkr} 人</span>` : '') +
           `</span></a>`;
  }).join('');

  const riskLabel = sourceRisk !== null ? `${sourceRisk}/10` : '—';
  return `<section class="same-risk-neighbors" aria-label="同 AI 影響度の他職業（クロスセクター）">
    <h2>同 AI 影響度（${escapeHtml(riskLabel)} ±1）の他職業</h2>
    <p class="srn-subtitle">業界をまたいで、AI 影響度が同水準の代表職業（規模順）。</p>
    <div class="srn-grid">${cards}</div>
  </section>`;
}

export const SAME_RISK_CSS = `
.same-risk-neighbors{margin:36px 0}
.same-risk-neighbors h2{font-family:var(--font-serif);font-size:1.05rem;color:var(--accent);margin:0 0 6px;font-weight:600}
.same-risk-neighbors .srn-subtitle{font-size:.84rem;color:var(--fg2);margin:0 0 14px;line-height:1.55}
.srn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.srn-card{display:flex;flex-direction:column;gap:6px;padding:12px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--fg);transition:border-color 150ms,transform 100ms}
.srn-card:hover{border-color:var(--accent);transform:translateY(-1px);text-decoration:none}
.srn-card .srn-name{font-family:var(--font-serif);font-size:1rem;color:var(--fg);line-height:1.35}
.srn-card .srn-meta{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:.74rem;color:var(--fg2);align-items:baseline}
.srn-card .srn-risk{font-family:ui-monospace,monospace;color:var(--accent-deep);font-variant-numeric:tabular-nums}
.srn-card .srn-sector{color:var(--fg2)}
.srn-card .srn-workers{font-variant-numeric:tabular-nums;color:var(--fg3)}
@media (max-width:600px){.srn-grid{grid-template-columns:1fr}}
`;
