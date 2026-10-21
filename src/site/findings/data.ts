/** Frozen release inputs, canonical arithmetic and byte-pinned CSV exports. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { computeDrift } from '../../../scripts/lib/drift-core';
import { ScoreRunSchema } from '../../data/schema/score-run';
import { fmean } from '../../data/lib/fsum';
import { pickFlagshipMeanScore, pickLatestScore, type ScoreHistEntry } from '../../graph/score-strategy';
import { CSV_FILES, downloadPath, type CsvFile, type FindingsManifest, type FrozenFile } from './registry';

export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(`findings: ${message}`); }
const OccupationsSchema = z.array(z.object({ id: z.number().int().positive(), title_ja: z.string().min(1), url: z.url() }).strict());
const ProvenanceSchema = z.object({
  ipd_version: z.string(), ipd_retrieved_at: z.iso.date(), source_index_url: z.url(),
  source_file_url_description: z.url(), tos_url: z.url(),
  files: z.object({ description: z.object({ name: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }) }),
});

function verifiedText(file: FrozenFile): string {
  assert(!file.path.includes('..') && /^(data|docs)\//.test(file.path), 'invalid frozen source path');
  const text = readFileSync(file.path, 'utf8');
  assert(sha256(text) === file.sha256, `source hash mismatch: ${file.path}`);
  return text;
}

/** RFC 4180, UTF-8, LF and fixed field order; null is empty, never zero. */
export function csv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n') + '\n';
}

export const CSV_HEADERS = {
  scores: ['issue_id', 'occupation_id', 'occupation_name_ja', 'occupation_source_url', 'standard_version', 'before_panel_id', 'after_panel_id', 'before_raw', 'after_raw', 'before_display', 'after_display', 'delta_display', 'delta_raw', 'before_band', 'after_band', 'band_changed', 'source_ref'],
  summary: ['issue_id', 'run_date', 'report_generated_on', 'occupation_count', 'skipped_count', 'mean_before_raw', 'mean_after_raw', 'mean_before_display', 'mean_after_display', 'n_abs_ge_05', 'n_abs_ge_10', 'low_before', 'mid_before', 'high_before', 'low_after', 'mid_after', 'high_after', 'n_band_changed', 'up_example_id', 'down_example_id'],
  panel: ['panel_id', 'provider', 'model_id', 'run_date', 'batch_file', 'batch_sha256', 'scoring_method_id', 'backfill'],
  provenance: ['source_id', 'field_names', 'source_file_name', 'source_version', 'source_url', 'retrieved_on', 'rights_holder', 'terms_url', 'transform_note', 'snapshot_commit', 'source_sha256'],
} as const;
export const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

export function buildFindings(issue: FindingsManifest) {
  const occupations = OccupationsSchema.parse(JSON.parse(verifiedText(issue.occupations)));
  const provenance = ProvenanceSchema.parse(JSON.parse(verifiedText(issue.provenance)));
  const report = verifiedText(issue.report);
  const ids = occupations.map(occupation => occupation.id);
  assert(ids.length === new Set(ids).size && ids.every((id, i) => i === 0 || id > ids[i - 1]!), 'occupation IDs must be unique and sorted');
  const titles = new Map(occupations.map(occupation => [occupation.id, occupation.title_ja]));
  const panelId = (side: 'before' | 'after') => `${issue.issue_id}:${side}`;
  for (const side of ['before', 'after'] as const) {
    const panel = issue.panels[side];
    assert(panel.length === 3 && new Set(panel.map(run => run.provider)).size === 3, 'exactly one seat per provider required');
    assert(panel.every(run => ['anthropic', 'openai', 'xai'].includes(run.provider) && !run.backfill), 'invalid provider or backfill');
  }
  const swapped = issue.panels.after.filter(run => !issue.panels.before.some(old => old.batch_sha256 === run.batch_sha256));
  assert(swapped.length === 1 && swapped[0]!.run_date === issue.incoming_run_date, 'only one incoming seat may change');
  const incoming = swapped[0]!;
  const outgoing = issue.panels.before.find(run => run.provider === incoming.provider)!;
  assert(outgoing && outgoing.run_date < incoming.run_date && outgoing.model_id !== incoming.model_id, 'invalid outgoing seat');
  assert(issue.panels.after.every(run => run.run_date <= issue.incoming_run_date), 'future panel contamination');

  const union = [...new Map([...issue.panels.before, ...issue.panels.after].map(run => [run.batch_file, run])).values()];
  const batches = union.map(ref => {
    const batch = ScoreRunSchema.parse(JSON.parse(verifiedText({ path: ref.batch_file, sha256: ref.batch_sha256 })));
    assert(batch.scope === 'occupations' && batch.scorer.model === ref.model_id && batch.run.run_date === ref.run_date
      && batch.scorer.model_provider === ref.provider && batch.scorer.scoring_method_id === ref.scoring_method_id
      && batch.run.backfill !== true, `batch metadata mismatch: ${ref.batch_file}`);
    assert(batch.prompt.prompt_file === ref.prompt_file && batch.prompt.prompt_sha256 === ref.prompt_sha256, 'prompt metadata mismatch');
    assert(Object.keys(batch.scores).length === ids.length && ids.every(id => batch.scores[String(id)]?.aiois != null), 'incomplete occupation coverage');
    return { ref, batch };
  });
  const histories = new Map<number, ScoreHistEntry[]>(ids.map(id => [id, batches.map(({ ref, batch }) => {
    const entry = batch.scores[String(id)]!;
    return { model: ref.model_id, provider: ref.provider, date: ref.run_date, backfill: false, ai_risk: entry.ai_risk, rationale_ja: entry.rationale_ja, aiois: entry.aiois };
  })]));
  const { summary, selectedScores } = computeDrift(histories, incoming.model_id, titles, {
    comparableOf: history => [...history],
    selectScores: (afterHistory, beforeHistory) => ({
      beforeUnrounded: pickFlagshipMeanScore(beforeHistory).transformation,
      afterUnrounded: pickFlagshipMeanScore(afterHistory).transformation,
      latestT: pickLatestScore(afterHistory).aiois!.transformation,
    }),
  });
  assert(summary.occupationCount === ids.length && summary.skippedOccupationIds.length === 0, 'full comparison coverage required');
  const rawById = new Map(ids.map((id, i) => [id, selectedScores[i]!]));
  const occupationById = new Map(occupations.map(occupation => [occupation.id, occupation]));
  const sourceRef = (id: number) => union.map(run => `${issue.snapshot_commit}:${run.batch_file}#scores.${id}@sha256:${run.batch_sha256}`).join(';');
  const rows = [...summary.movers].sort((a, b) => a.id - b.id).map(row => {
    const raw = rawById.get(row.id)!;
    return { ...row, beforeRaw: raw.beforeUnrounded, afterRaw: raw.afterUnrounded,
      deltaRaw: raw.afterUnrounded - raw.beforeUnrounded, sourceUrl: occupationById.get(row.id)!.url, sourceRef: sourceRef(row.id) };
  });
  const up = rows.filter(row => row.delta > 0).sort((a, b) => b.delta - a.delta || a.id - b.id);
  const down = rows.filter(row => row.delta < 0).sort((a, b) => a.delta - b.delta || a.id - b.id);
  const meanBeforeRaw = fmean(rows.map(row => row.beforeRaw));
  const meanAfterRaw = fmean(rows.map(row => row.afterRaw));
  const b = summary.bandBefore, a = summary.bandAfter;
  // Independent archival evidence guard; no silent inheritance of old report errors.
  for (const evidence of [
    `| 全職業平均 | ${summary.meanBefore.toFixed(2)} | ${summary.meanAfter.toFixed(2)} |`,
    `| \\|Δ\\| ≥ 0.5 | — | ${summary.absDeltaGe05} |`,
    `| \\|Δ\\| ≥ 1.0 | — | ${summary.absDeltaGe10} |`,
    `| リスク帯 low / mid / high | ${b.low} / ${b.mid} / ${b.high} | ${a.low} / ${a.mid} / ${a.high}（変化 ${summary.bandChanges} 職業） |`,
  ]) assert(report.includes(evidence), `report disagrees with canonical computation: ${evidence}`);

  const payloads: Record<CsvFile, string> = {
    scores: csv(CSV_HEADERS.scores, rows.map(row => [issue.issue_id, row.id, row.title, row.sourceUrl, issue.standard_version, panelId('before'), panelId('after'), row.beforeRaw, row.afterRaw, row.before.toFixed(1), row.after.toFixed(1), signed(row.delta), row.deltaRaw, row.beforeBand, row.afterBand, row.beforeBand !== row.afterBand, row.sourceRef])),
    summary: csv(CSV_HEADERS.summary, [[issue.issue_id, issue.incoming_run_date, issue.report.generated_on, summary.occupationCount, summary.skippedOccupationIds.length, meanBeforeRaw, meanAfterRaw, summary.meanBefore.toFixed(2), summary.meanAfter.toFixed(2), summary.absDeltaGe05, summary.absDeltaGe10, b.low, b.mid, b.high, a.low, a.mid, a.high, summary.bandChanges, up[0]?.id, down[0]?.id]]),
    panel: csv(CSV_HEADERS.panel, (['before', 'after'] as const).flatMap(side => issue.panels[side].map(run => [panelId(side), run.provider, run.model_id, run.run_date, run.batch_file, run.batch_sha256, run.scoring_method_id, run.backfill]))),
    provenance: csv(CSV_HEADERS.provenance, [
      ['site-analysis', 'before_raw;after_raw;before_display;after_display;delta_display;delta_raw;before_band;after_band;band_changed;summary;panel', issue.report.path, issue.standard_version, `https://github.com/jasonhnd/jobs/blob/${issue.snapshot_commit}/${issue.report.path}`, '', 'mirai-shigoto.com', `https://github.com/jasonhnd/jobs/blob/${issue.snapshot_commit}/LICENSE`, 'AIOIS-10 vendor means and displayed-score differences; MIT applies only to site-owned contributions.', issue.snapshot_commit, issue.report.sha256],
      ['ipd-description', 'occupation_name_ja;occupation_source_url', provenance.files.description.name, provenance.ipd_version.replace(/^v/, ''), provenance.source_file_url_description, provenance.ipd_retrieved_at, 'JILPT', provenance.tos_url, 'Selected occupation names and source URLs; edited into a comparison table. Job tag TOS Article 9; no MIT sublicense.', issue.snapshot_commit, provenance.files.description.sha256],
      ['site-occupation-id', 'occupation_id', issue.occupations.path, issue.dataset_version, `https://github.com/jasonhnd/jobs/tree/${issue.snapshot_commit}/data/occupations`, '', 'mirai-shigoto.com', `https://github.com/jasonhnd/jobs/blob/${issue.snapshot_commit}/LICENSE`, 'Site identifiers, not IPD identifiers.', issue.snapshot_commit, issue.occupations.sha256],
      ['source-records', 'source_ref;batch_file;batch_sha256;source_id;source_file_name;source_version;source_url;retrieved_on;rights_holder;terms_url;transform_note;snapshot_commit;source_sha256', issue.provenance.source_path, provenance.ipd_version.replace(/^v/, ''), provenance.source_index_url, provenance.ipd_retrieved_at, '', provenance.tos_url, 'Factual attribution records. Source organizations and model names remain the property of their respective rights holders; no affiliation or endorsement.', issue.snapshot_commit, issue.provenance.sha256],
    ]),
  };
  const downloads = CSV_FILES.map(file => {
    const text = payloads[file];
    return { file, text, href: downloadPath(issue, file), bytes: Buffer.byteLength(text), sha256: sha256(text) };
  });
  return { issue, provenance, summary, rows, up, down, chartRows: [...up.slice(0, 2), ...down.slice(0, 2)],
    tableRows: rows.filter(row => row.beforeBand !== row.afterBand || Math.abs(row.delta * 10) >= 5),
    incoming, outgoing, meanBeforeRaw, meanAfterRaw, downloads };
}

export type FindingsData = ReturnType<typeof buildFindings>;
export type FindingsRow = FindingsData['rows'][number];
const cache = new Map<string, FindingsData>();
export function loadFindings(issue: FindingsManifest): FindingsData {
  const key = `${issue.issue_id}/${issue.dataset_version}`;
  if (cache.has(key)) return cache.get(key)!;
  const data = buildFindings(issue);
  for (const download of data.downloads) {
    const pin = issue.downloads[`${download.file}.csv`];
    assert(pin && pin.sha256 === download.sha256 && pin.bytes === download.bytes, `immutable CSV mismatch: ${download.href}`);
  }
  cache.set(key, data);
  return data;
}
