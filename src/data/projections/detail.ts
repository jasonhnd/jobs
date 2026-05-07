/**
 * data.detail/<padded>.json projection — per docs/DATA_ARCHITECTURE.md §6.2 (v1.2.0).
 *
 * Status: Planned
 * Consumer: build_occupations.py (legacy), api/og.tsx, mobile ④/⑤ 詳細
 * Shape: nested object — main occupation + stats + latest score + top-N skills
 *
 * `*_top_N` rule per §6.2:
 *   Sort by the occupation's score descending; take first N.
 *   When the parent block is null (no numeric profile), the top_N field is also null.
 *   N: skills=10, knowledge=5, abilities=5.
 *
 * Migrated from scripts/projections/detail.py.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import type { LabelEntry } from '../schema/labels.js';
import { demandBand, riskBand, workforceBand } from '../lib/bands.js';

interface TopNEntry {
  key: string;
  label_ja: string;
  score: number;
}

export interface DetailBuildResult {
  files: string[];
  dir: string;
  fileCount: number;
}

/** Sort `block` by score descending, take top `n`. Return null when block is null. */
function topN(
  block: Record<string, number> | null | undefined,
  labelsDim: Map<string, LabelEntry>,
  n: number,
): TopNEntry[] | null {
  if (block == null) return null;
  // Python's `sorted(items, key=..., reverse=True)` is stable.
  // V8's Array.prototype.sort is stable since Node 12.
  const entries = Object.entries(block).sort((a, b) => b[1] - a[1]);
  const out: TopNEntry[] = [];
  for (const [key, score] of entries.slice(0, n)) {
    const label = labelsDim.get(key);
    out.push({
      key,
      label_ja: label ? label.ja : key,
      score,
    });
  }
  return out;
}

export async function buildDetail(
  indexes: Indexes,
  distRoot: string,
): Promise<DetailBuildResult> {
  const outDir = join(distRoot, 'data.detail');
  await mkdir(outDir, { recursive: true });

  const skillsLabels = indexes.labelsByDim.get('skills') ?? new Map<string, LabelEntry>();
  const knowledgeLabels = indexes.labelsByDim.get('knowledge') ?? new Map<string, LabelEntry>();
  const abilitiesLabels = indexes.labelsByDim.get('abilities') ?? new Map<string, LabelEntry>();
  const sectorById = new Map(indexes.sectors.map((s) => [s.id, s] as const));

  const writtenFiles: string[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const stats = indexes.statsById.get(occId);
    const score = indexes.latestScoreByOcc.get(occId);
    const assignment = indexes.sectorByOcc.get(occId);
    const sectorDef = assignment ? sectorById.get(assignment.sector_id) : undefined;

    let sectorBlock: Record<string, unknown> | null = null;
    if (assignment != null) {
      sectorBlock = {
        id: assignment.sector_id,
        ja: sectorDef ? sectorDef.ja : null,
        hue: sectorDef ? sectorDef.hue : null,
        provenance: assignment.provenance,
      };
    }

    // Emit fields in EXACTLY the order Python emits them (Pydantic model_dump
    // preserves declaration order; JSON.stringify preserves object insertion
    // order). Order matters for byte-equivalence.
    const payload: Record<string, unknown> = {
      id: occId,
      schema_version: '1.2',
      title: {
        ja: occ.title_ja,
        aliases_ja: occ.aliases_ja,
      },
      classifications: {
        mhlw_main: occ.classifications.mhlw_main ?? null,
        mhlw_all: occ.classifications.mhlw_all,
        jsoc_main: occ.classifications.jsoc_main ?? null,
        jsoc_all: occ.classifications.jsoc_all,
      },
      sector: sectorBlock,
      risk_band: riskBand(score ? score.ai_risk : null),
      workforce_band: workforceBand(stats ? stats.workers ?? null : null),
      demand_band: demandBand(stats ? stats.recruit_ratio ?? null : null),
      description: {
        summary_ja: occ.description.summary_ja ?? null,
        what_it_is_ja: occ.description.what_it_is_ja ?? null,
        how_to_become_ja: occ.description.how_to_become_ja ?? null,
        working_conditions_ja: occ.description.working_conditions_ja ?? null,
      },
      ai_risk: score
        ? {
            score: score.ai_risk,
            model: score.model,
            scored_at: score.date,
            rationale_ja: score.rationale_ja,
          }
        : null,
      stats: stats
        ? {
            // Match Pydantic's exclude={"id", "schema_version"} model_dump
            source: stats.source,
            salary_man_yen: stats.salary_man_yen ?? null,
            workers: stats.workers ?? null,
            monthly_hours: stats.monthly_hours ?? null,
            average_age: stats.average_age ?? null,
            recruit_wage_man_yen: stats.recruit_wage_man_yen ?? null,
            recruit_ratio: stats.recruit_ratio ?? null,
          }
        : null,
      skills_top10: topN(occ.skills, skillsLabels, 10),
      knowledge_top5: topN(occ.knowledge, knowledgeLabels, 5),
      abilities_top5: topN(occ.abilities, abilitiesLabels, 5),
      tasks_count: occ.tasks.length,
      tasks_lead_ja: occ.tasks_lead_ja ?? null,
      related_orgs: occ.related_orgs.map((o) => ({
        name_ja: o.name_ja,
        url: o.url ?? null,
      })),
      related_certs_ja: occ.related_certs_ja,
      url: occ.url,
      data_source_versions: {
        ipd_numeric: occ.data_source_versions.ipd_numeric,
        ipd_description: occ.data_source_versions.ipd_description,
        ipd_retrieved_at: occ.data_source_versions.ipd_retrieved_at,
      },
    };

    const padded = String(occId).padStart(4, '0');
    const filePath = join(outDir, `${padded}.json`);
    await writeFile(
      filePath,
      JSON.stringify(payload) + '\n',
      'utf-8',
    );
    writtenFiles.push(filePath);
  }

  return {
    files: writtenFiles,
    dir: outDir,
    fileCount: writtenFiles.length,
  };
}
