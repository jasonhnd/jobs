import templates from '../../content/findings.ja.json' with { type: 'json' };
import type { FindingsManifest } from './registry';
export const findingsTitle = templates.T44;
export const findingsLinkTitle = (issue: FindingsManifest) => templates.T43
  .replace('{{issue_number}}', String(issue.issue_number)).replace('{{run_date}}', issue.incoming_run_date);
export const HISTORICAL_REPORTS = [
  'VENDOR_UPDATE_DRIFT_gpt-6-astra_2026-09-10.md',
  'VENDOR_UPDATE_DRIFT_grok-4.7_2026-09-22.md',
  'VENDOR_UPDATE_DRIFT_claude-opus-5-5_2026-09-23.md',
  'VENDOR_UPDATE_DRIFT_gpt-6-sol_2026-09-23.md',
] as const;
