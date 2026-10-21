import type { APIRoute } from 'astro';
import { CSV_FILES, FINDINGS } from '@/site/findings/registry';
import { loadFindings } from '@/site/findings/data';

export function getStaticPaths() {
  return FINDINGS.flatMap(issue => CSV_FILES.map(file => ({
    params: { issue: issue.issue_id, revision: issue.dataset_version, file },
    props: { download: loadFindings(issue).downloads.find(download => download.file === file)! },
  })));
}
export const GET: APIRoute = ({ props }) => new Response(props.download.text, {
  headers: { 'Content-Type': 'text/csv; charset=utf-8' },
});
