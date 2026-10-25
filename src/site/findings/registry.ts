import firstIssue from '../../../data/findings/2026-10-01-gpt-6.1-sol/manifest.json' with { type: 'json' };
import { siteConfig } from '../config';
import { isPublicationInstant } from './publication-instant';

export interface FrozenFile { readonly path: string; readonly sha256: string }
export interface FindingsPanelRun {
  readonly provider: string;
  readonly model_id: string;
  readonly run_date: string;
  readonly batch_file: string;
  readonly batch_sha256: string;
  readonly scoring_method_id: string;
  readonly prompt_file: string;
  readonly prompt_sha256: string;
  readonly backfill: boolean;
}
export interface FindingsManifest {
  readonly issue_id: string;
  readonly issue_number: number;
  readonly status: 'draft' | 'signed' | 'published';
  readonly template_version: string;
  readonly template_signed: boolean;
  readonly rights_signed: boolean;
  readonly first_published_on: string | null;
  readonly modified_on: string;
  readonly incoming_run_date: string;
  readonly standard_version: string;
  readonly dataset_version: string;
  readonly snapshot_commit: string;
  readonly report: FrozenFile & { readonly generated_on: string };
  readonly occupations: FrozenFile;
  readonly provenance: FrozenFile & { readonly source_path: string };
  readonly panels: { readonly before: readonly FindingsPanelRun[]; readonly after: readonly FindingsPanelRun[] };
  readonly downloads: Readonly<Record<string, { readonly sha256: string; readonly bytes: number }>>;
}

/** Explicit releases only: a new scoring batch never silently creates an issue. */
export const FINDINGS: readonly FindingsManifest[] = [firstIssue as FindingsManifest];
export const CSV_FILES = ['scores', 'summary', 'panel', 'provenance'] as const;
export type CsvFile = typeof CSV_FILES[number];
export const findingsPath = (issue: FindingsManifest) => `/pro/findings/${issue.issue_id}`;
export const findingsUrl = (issue: FindingsManifest) => siteConfig.origin + findingsPath(issue);
export const rightsPath = (issue: FindingsManifest) => `${findingsPath(issue)}/rights`;
export const downloadPath = (issue: FindingsManifest, file: CsvFile) =>
  `/data.findings/${issue.issue_id}/${issue.dataset_version}/${file}.csv`;

/** Signed copy is discoverable. The production publication instant may still be null. */
export function isDiscoverable(issue: FindingsManifest): boolean {
  return issue.status !== 'draft' && issue.template_signed && issue.rights_signed;
}

export function discoverableFindings(issues: readonly FindingsManifest[] = FINDINGS): readonly FindingsManifest[] {
  return issues.filter(isDiscoverable);
}

export function publishedFindings(issues: readonly FindingsManifest[] = FINDINGS): readonly FindingsManifest[] {
  return issues.filter(issue => issue.status === 'published' && issue.template_signed && issue.rights_signed
    && issue.first_published_on !== null && isPublicationInstant(issue.first_published_on));
}

/** Only the two runs in the changed seat get a comparison link. */
export function findingsForRun(model: string, date: string): readonly FindingsManifest[] {
  return FINDINGS.filter(issue => {
    const incoming = issue.panels.after.find(run => run.run_date === issue.incoming_run_date);
    const outgoing = issue.panels.before.find(run => run.provider === incoming?.provider);
    return [incoming, outgoing].some(run => run?.model_id === model && run.run_date === date);
  });
}
