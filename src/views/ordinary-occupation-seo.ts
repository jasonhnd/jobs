/** Owner-signed variant A (Issue #912), scoped to ordinary occupation metadata. */
import type { OccupationSeoOutput } from './occupation-seo';
import type { OccupationSummary } from './occupation-summary';

type SeoSummary = Pick<OccupationSummary, 'nameJa' | 'salary' | 'hours' | 'score' | 'conclusion'>;

/** Availability comes from the same projection as the visible summary statistics. */
export function buildOrdinaryOccupationSeo(summary: SeoSummary, legacy: OccupationSeoOutput): OccupationSeoOutput {
  if (summary.salary === null || summary.hours === null || summary.score === null) {
    // Ordinary descriptions previously used the conclusion, not legacy.description.
    const description = summary.conclusion ?? summary.nameJa;
    return { ...legacy, description, ogDescription: description };
  }

  const title = `${summary.nameJa}の年収・労働時間・AIの影響｜未来の仕事`;
  const description = `${summary.nameJa}の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。`;
  return { title, description, ogTitle: title, ogDescription: description, keywords: legacy.keywords };
}
