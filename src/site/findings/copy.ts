import templates from '../../content/findings.ja.json' with { type: 'json' };
import rights from '../../content/findings-rights.ja.json' with { type: 'json' };
import { formatVendorDisplay } from '../score-attribution';
import { findingsUrl } from './registry';
import { signed, type FindingsData } from './data';

export type TemplateId = keyof typeof templates;
export const controls = { copy: 'コピー', copied: 'コピーしました', read: '読む' } as const;
export function renderTemplate(id: TemplateId, values: Readonly<Record<string, string | number>>): string {
  return templates[id].replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`findings: missing template variable ${key}`);
    return String(values[key]);
  });
}

export function findingsCopy(data: FindingsData) {
  const { issue, summary, provenance, incoming, outgoing } = data;
  const citationRow = data.up[0] ?? data.down[0] ?? data.rows[0]!;
  const values: Record<string, string | number> = {
    issue_number: issue.issue_number, run_date: issue.incoming_run_date, occupation_count: summary.occupationCount,
    provider_display: formatVendorDisplay(incoming.provider), old_model_id: outgoing.model_id, new_model_id: incoming.model_id,
    mean_before: summary.meanBefore.toFixed(2), mean_after: summary.meanAfter.toFixed(2), n_band_changed: summary.bandChanges,
    low_before: summary.bandBefore.low, mid_before: summary.bandBefore.mid, high_before: summary.bandBefore.high,
    low_after: summary.bandAfter.low, mid_after: summary.bandAfter.mid, high_after: summary.bandAfter.high,
    n_abs_ge_05: summary.absDeltaGe05, n_abs_ge_10: summary.absDeltaGe10,
    cite_occupation_name: citationRow.title, cite_score: citationRow.after.toFixed(1),
    issue_url: issue.status === 'draft' ? '{{issue_url}}' : findingsUrl(issue), accessed_on: '{{accessed_on}}',
    source_report_ref: `${issue.report.path}:3–12 @ ${issue.snapshot_commit} (sha256:${issue.report.sha256})`,
    before_panel_refs: issue.panels.before.map(run => `${run.provider}:${run.model_id}@${run.run_date}`).join('、'),
    after_panel_refs: issue.panels.after.map(run => `${run.provider}:${run.model_id}@${run.run_date}`).join('、'),
    ipd_file_label: '解説系ダウンロードデータ', ipd_version: provenance.ipd_version.replace(/^v/, ''),
    ipd_retrieved_on: provenance.ipd_retrieved_at, ipd_download_url: provenance.source_index_url,
  };
  for (const [direction, row] of [['up', data.up[0]], ['down', data.down[0]]] as const) {
    if (row) Object.assign(values, { [`${direction}_name`]: row.title, [`${direction}_before`]: row.before.toFixed(1), [`${direction}_after`]: row.after.toFixed(1), [`${direction}_delta`]: signed(row.delta) });
  }
  const copy = Object.fromEntries(Object.keys(templates)
    .filter(id => id !== (data.up.length ? 'T13b' : 'T13a') && id !== (data.down.length ? 'T15b' : 'T15a'))
    .map(id => [id, renderTemplate(id as TemplateId, values)])) as Record<TemplateId, string>;
  const labels = {
    chart: copy.T27.split(' / '), table: copy.T35.split(' / '), meta: copy.T36.split(' / '),
    links: copy.T37.split(' / '), bands: copy.T38.split(' / '),
  };
  const citation = `${copy.T21}${copy.T22}${copy.T23}`;
  const rightsSections = rights.map(section => ({ heading: section.heading, lines: section.lines.map(line =>
    'template' in line ? copy[line.template as TemplateId] : line.text!) }));
  return { ...copy, labels, citation, citationRow, rightsSections, issueLabel: copy.T01.split(' — ')[1]!,
    upSentence: copy[data.up.length ? 'T13a' : 'T13b'], downSentence: copy[data.down.length ? 'T15a' : 'T15b'] };
}

/** Exact Japanese text-node/attribute allowlist, including schema-derived cells. */
export function allowedJapanese(data: FindingsData, withRights = false): ReadonlySet<string> {
  const copy = findingsCopy(data);
  const lines = [...Object.keys(templates).map(id => copy[id as TemplateId]), ...Object.values(copy.labels).flat(),
    ...Object.values(controls), copy.issueLabel, copy.citation, ...data.rows.map(row => row.title), data.issue.standard_version];
  if (withRights) lines.push(...copy.rightsSections.flatMap(section => [section.heading, ...section.lines]));
  return new Set(lines.filter((line): line is string => typeof line === 'string').map(normalizeCopy));
}
export const normalizeCopy = (text: string) => text.replace(/[\t\r\n ]+/g, ' ').trim();
export function unexpectedJapanese(texts: readonly string[], data: FindingsData, withRights = false): string[] {
  const allowed = allowedJapanese(data, withRights);
  return texts.map(normalizeCopy).filter(text => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text) && !allowed.has(text));
}
