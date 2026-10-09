/** Ordinary stage-2 projection. Japanese templates are unsigned candidates in Issue #897. */
import { displayScore } from '../data/lib/banker-round';
import { riskBandWord, riskClass } from '../lib/risk';
import { occupationPath, occupationUrl } from '../lib/urls';
import { stringifyJsonLd } from '../lib/json-for-script';
import { siteConfig } from '../site/config';
import type { Rec } from './occupation-detail';

const COPY = {
  high: {
    conclusion: 'は、仕事のやり方の多くがAIで変わる仕事です。',
    advice: 'AIに任せられる作業と、自分に残る作業を分けて考えるのが先です。',
    action: 'AIで変わる作業を見る',
  },
  mid: {
    conclusion: 'は、AIで変わる部分と、人が続ける部分が両方ある仕事です。',
    advice: 'どの作業がAIで変わるかを知っておくと、準備がしやすくなります。',
    action: 'AIで変わる作業を見る',
  },
  low: {
    conclusion: 'は、いまのところAIで仕事の中身が変わりにくい仕事です。',
    advice: 'AIを道具として使える場面を、知っておきましょう。',
    action: 'なぜ変わりにくいか',
  },
} as const;

// Preserve the complete page's old chapter/section IDs; no redirects or hidden prose.
export const PRO_CHAPTER_LINKS = [
  { id: 'chp-score', title: 'スコアの中身', anchors: ['sec-aiois', 'sec-ai-detail', 'score-history-details'] },
  { id: 'chp-about', title: 'この仕事とは', anchors: [] },
  { id: 'chp-path', title: 'なるには・資格', anchors: [] },
  { id: 'chp-work', title: '待遇と働き方', anchors: [] },
  { id: 'chp-next', title: '似た仕事・移り先', anchors: ['sec-transfer', 'sec-similar'] },
  { id: 'chp-faq', title: 'よくある質問', anchors: [] },
  { id: 'chp-source', title: '出典と数字', anchors: [] },
] as const;

function publishedStat(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

export function buildOccupationSummary(rec: Pick<Rec, 'id' | 'name_ja' | 'ai_risk' | 'salary' | 'hours'>) {
  const score = rec.ai_risk !== null && Number.isFinite(rec.ai_risk) ? displayScore(rec.ai_risk) : null;
  const band = score === null ? null : riskClass(score);
  const copy = band === null ? null : COPY[band];
  const salary = publishedStat(rec.salary);
  const hours = publishedStat(rec.hours);
  return {
    id: rec.id, nameJa: rec.name_ja, score, band,
    scoreText: score === null ? '未評価' : String(score),
    bandWord: riskBandWord(score),
    salary, hours,
    salaryText: salary === null ? '—' : `${salary.toLocaleString('en-US')} 万円`,
    hoursText: hours === null ? '—' : `${hours} 時間`,
    conclusion: copy ? rec.name_ja + copy.conclusion : null,
    advice: copy?.advice ?? null,
    primaryLabel: copy?.action ?? 'Pro で詳しく見る',
    primaryHref: `${occupationPath(rec.id, 'pro')}#sec-aiois`,
    ordinaryPath: occupationPath(rec.id), proPath: occupationPath(rec.id, 'pro'),
  };
}

export type OccupationSummary = ReturnType<typeof buildOccupationSummary>;

/** A separate narrow schema prevents full Pro properties leaking into ordinary HTML. */
export function renderOccupationSummaryJsonLd(summary: OccupationSummary, dates: { datePublished: string; dateModified: string }): string {
  const pageUrl = occupationUrl(summary.id);
  const entity = `${pageUrl}#occupation`;
  const description = summary.conclusion ?? summary.nameJa;
  const additionalProperty: Array<Record<string, unknown>> = [];
  if (summary.score !== null) additionalProperty.push({ '@type': 'PropertyValue', name: 'AIで仕事の中身がどれだけ変わるか（0〜10）', value: summary.score, minValue: 0, maxValue: 10 });
  if (summary.hours !== null) additionalProperty.push({ '@type': 'PropertyValue', name: 'Monthly working hours', value: summary.hours, unitText: 'hours' });
  return stringifyJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${pageUrl}#webpage`, url: pageUrl,
        name: summary.nameJa, description, inLanguage: 'ja',
        isPartOf: { '@id': `${siteConfig.origin}/#website` },
        about: { '@id': entity }, mainEntity: { '@id': entity },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        publisher: { '@id': `${siteConfig.origin}/#organization` },
        primaryImageOfPage: `${siteConfig.origin}/api/og?id=${summary.id}`,
        ...dates,
        ...(summary.conclusion ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.summary-conclusion', '.summary-advice'] } } : {}),
      },
      {
        '@type': 'Occupation', '@id': entity, name: summary.nameJa, description,
        isPartOf: { '@id': `${siteConfig.origin}/#dataset` },
        occupationLocation: { '@type': 'Country', name: 'Japan' }, additionalProperty,
        ...(summary.salary === null ? {} : {
          estimatedSalary: { '@type': 'MonetaryAmountDistribution', name: '年収', currency: 'JPY', duration: 'P1Y', median: summary.salary * 10000 },
        }),
      },
      {
        '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteConfig.siteName, item: `${siteConfig.origin}/` },
          { '@type': 'ListItem', position: 2, name: summary.nameJa, item: pageUrl },
        ],
      },
    ],
  }, 2);
}
