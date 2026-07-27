import type { GeoAttribution, GeoFacts, GeoOccupationSummary, GeoSectorSummary } from './geo-facts.js';

function fmtInt(n: number | null): string {
  return typeof n === 'number' ? n.toLocaleString('en-US') : 'unknown';
}

function fmtScore(n: number | null): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : 'unknown';
}

function fmtMean(n: number): string {
  return n.toFixed(2);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function occLine(occ: GeoOccupationSummary): string {
  const dr = occ.displacementRisk === null ? '' : `; displacement-risk ${fmtScore(occ.displacementRisk)}/10`;
  return `${occ.nameJa} (#${occ.id}) — AI Impact ${fmtScore(occ.aiImpact)}/10${dr}; workers ${fmtInt(occ.workers)}.`;
}

function tableRows(items: readonly GeoOccupationSummary[], limit: number): string {
  return items.slice(0, limit).map((occ, i) =>
    `| ${i + 1} | ${occ.nameJa} | ${fmtScore(occ.aiImpact)} | ${occ.displacementRisk === null ? 'n/a' : fmtScore(occ.displacementRisk)} | ${fmtInt(occ.workers)} |`,
  ).join('\n');
}

function sectorRows(items: readonly GeoSectorSummary[]): string {
  return items.map((s) =>
    `| ${s.id} | ${s.nameJa} | ${s.occupationCount} | ${fmtMean(s.meanAiImpact)} | ${fmtInt(s.totalWorkforce)} |`,
  ).join('\n');
}

function bandRows(facts: GeoFacts): string {
  return facts.fiveBandDistribution.map((b) =>
    `| ${b.label} | ${b.count} | ${fmtPct(b.sharePct)} |`,
  ).join('\n');
}

export const CROSS_MODEL_VALIDATION_NOTE =
  'Methodology note: AIOIS-10 scores (Claude Fable 5) were cross-checked on a representative 40-occupation sample against Claude Opus 4.8 and Claude Sonnet 4.6 under the same rubric - inter-model correlation r=0.92-0.97, mean spread 1.02/10, and 95% (38/40) were within 2.0 points (validation sample, not a full multi-model consensus).';

const HOME_OCCUPATION_COUNT_PLACEHOLDER = '__OCCUPATION_COUNT_SCORED__';

/**
 * The note records ONE validation exercise: 40 occupations from the Fable 5
 * batch, re-scored by Opus 4.8 and Sonnet 4.6 on 2026-06-23. It is a statement
 * about that batch, so the hardcoded pair is deliberate — do not generalise it
 * to "the active batch". Rendering it beside a different model's scores would
 * attribute a validation to a batch it never covered.
 *
 * Consequently this is false whenever the canonical batch is not Fable 5, which
 * it has been since the GPT batch landed. `scripts/check-geo-freshness.ts`
 * asserts BOTH directions so the false case is still covered rather than
 * silently skipped (issue #219 follow-up).
 *
 * A future batch with its own validation needs its own note and its own entry
 * here, plus a `data/validation/` archive like `issue-15-d2b/results.json`.
 */
export function hasCrossModelValidationNote(attribution: GeoAttribution): boolean {
  return attribution.modelId === 'claude-fable-5' && attribution.runDate === '2026-06-13';
}

function crossModelValidationNote(facts: GeoFacts): string {
  if (!hasCrossModelValidationNote(facts.attribution)) {
    return '';
  }
  return `\n${CROSS_MODEL_VALIDATION_NOTE}\n`;
}

export function renderLlmsTxt(facts: GeoFacts): string {
  const { attribution } = facts;
  return `# mirai-shigoto.com — Japan Jobs x AI Impact Map

> Independent, unofficial analysis of ${facts.occupationCount} Japanese occupations from MHLW jobtag/JILPT IPD v7.00. Scores use ${attribution.modelDisplay} (${attribution.modelId}) under ${attribution.standardLabel}; active score run: ${attribution.runDate}. The headline "AI Impact" number is Transformation: how much the work is reshaped by AI. It is not a job-loss probability.

## Key facts

| Field | Value |
|---|---|
| Canonical URL | https://mirai-shigoto.com/ |
| Coverage | ${facts.occupationCount} occupations |
| Total workforce mapped | ${fmtInt(facts.totalWorkforce)} workers |
| Score source | ${attribution.modelDisplay} (${attribution.modelId}) |
| Score date | ${attribution.runDate} |
| Standard | ${attribution.standardLabel} v1.0 |
| Mean AI Impact | ${fmtMean(facts.meanAiImpact)} / 10 |
| Median AI Impact | ${fmtMean(facts.medianAiImpact)} / 10 |
| Mean Displacement-Risk | ${fmtMean(facts.meanDisplacementRisk)} / 10 |
| Occupations at AI Impact >= ${facts.highImpactThreshold} | ${facts.highImpactCount} |
| Annual wages in occupations at AI Impact >= ${facts.highImpactThreshold} | ${facts.highImpactAnnualWagesTrillion.toFixed(6)} trillion yen |
| High AI Impact occupations | ${facts.highRiskCount} / ${facts.occupationCount} (${fmtPct(facts.highRiskOccupationSharePct)}) |
| Workers in high AI Impact occupations | ${fmtInt(facts.highRiskWorkforce)} (${fmtPct(facts.highRiskWorkforceSharePct)} of mapped workforce) |
| Largest occupation | ${facts.largestOccupation.nameJa} (${fmtInt(facts.largestOccupation.workers)} workers; AI Impact ${fmtScore(facts.largestOccupation.aiImpact)}/10) |
| Highest AI Impact occupation | ${facts.highestImpactOccupation.nameJa} (${fmtScore(facts.highestImpactOccupation.aiImpact)}/10) |
| Lowest AI Impact occupation | ${facts.lowestImpactOccupation.nameJa} (${fmtScore(facts.lowestImpactOccupation.aiImpact)}/10) |

## Distribution

| AI Impact band | Occupations | Share |
|---|---:|---:|
${bandRows(facts)}

Risk-band count using the site threshold (<4 low, 4-6.9 mid, >=7 high): low=${facts.lowRiskCount}, mid=${facts.midRiskCount}, high=${facts.highRiskCount}.

## Quotable claims

- ${occLine(facts.largestOccupation)}
- ${occLine(facts.highestImpactOccupation)}
- ${occLine(facts.lowestImpactOccupation)}
- Mean AI Impact across all ${facts.occupationCount} occupations is ${fmtMean(facts.meanAiImpact)}/10; mean Displacement-Risk is ${fmtMean(facts.meanDisplacementRisk)}/10.
- ${facts.highRiskCount} occupations score 7.0 or higher on AI Impact, covering ${fmtInt(facts.highRiskWorkforce)} mapped workers (${fmtPct(facts.highRiskWorkforceSharePct)}).
- Highest-impact sector: ${facts.sectorsByMeanImpact[0]!.nameJa} (${fmtMean(facts.sectorsByMeanImpact[0]!.meanAiImpact)}/10). Lowest-impact sector: ${facts.sectorsByMeanImpact[facts.sectorsByMeanImpact.length - 1]!.nameJa} (${fmtMean(facts.sectorsByMeanImpact[facts.sectorsByMeanImpact.length - 1]!.meanAiImpact)}/10).

## Pages

- Main map: https://mirai-shigoto.com/
- AIOIS-10 standard: https://mirai-shigoto.com/standard
- Methodology: https://mirai-shigoto.com/methodology
- Public data: https://mirai-shigoto.com/data
- Rankings: https://mirai-shigoto.com/rankings
- Sectors: https://mirai-shigoto.com/sectors
- Answers: https://mirai-shigoto.com/answers
- Extended GEO companion: https://mirai-shigoto.com/llms-full.txt

## Methodology

AIOIS-10 separates Transformation (AI Impact) from Displacement-Risk. Transformation equals mean(D1, D2): cognitive/generative exposure and routine/procedural exposure. Displacement-Risk combines exposure with human moat, feasibility, and labor-market context. The active batch keeps all D1-D10 dimensions and the two derived indices for every occupation.
${crossModelValidationNote(facts)}
## FAQ

Q: Are these official government forecasts?
A: No. This is an independent LLM estimate built from public occupation data. It is not endorsed by MHLW, jobtag, or JILPT.

Q: Does high AI Impact mean the job disappears?
A: No. AI Impact measures work reshaping. Use Displacement-Risk for job shrinkage risk.

Q: Where can the data be checked?
A: Use https://mirai-shigoto.com/data.treemap.json for compact rows. Per-occupation detail IDs are zero-padded to four digits; for example, occupation #1 is https://mirai-shigoto.com/data.detail/0001.json.

## How to cite

Plain: ZKSC (2026). Japan Jobs x AI Impact Map. https://mirai-shigoto.com/

\`\`\`bibtex
@misc{mirai_shigoto_2026,
  author = {ZKSC},
  title  = {Japan Jobs x AI Impact Map},
  year   = {2026},
  url    = {https://mirai-shigoto.com/},
  note   = {Independent AIOIS-10 analysis. Active score run: ${attribution.modelDisplay}, ${attribution.runDate}. AI Impact scores are LLM estimates, not official government forecasts.}
}
\`\`\`

## Disclaimer

mirai-shigoto.com is not operated by MHLW, jobtag, or JILPT. Scores are opinion-grade estimates for analysis and should not be used as the sole basis for career, hiring, investment, or policy decisions.
`;
}

export function renderLlmsFullTxt(facts: GeoFacts): string {
  const { attribution } = facts;
  return `# mirai-shigoto.com — Japan Jobs x AI Impact Map (full)

Extended GEO companion to https://mirai-shigoto.com/llms.txt. This file is generated from the same source facts as the public data and homepage JSON-LD.

## 1. Summary

mirai-shigoto.com maps ${facts.occupationCount} Japanese occupations against AI Impact using ${attribution.standardLabel} v1.0. The active scoring batch is ${attribution.modelDisplay} (${attribution.modelId}), run date ${attribution.runDate}. The site UI is Japanese-only; this companion gives AI systems and researchers a compact English reference.

## 2. Dataset

| Metric | Value |
|---|---|
| Occupations | ${facts.occupationCount} |
| Workforce mapped | ${fmtInt(facts.totalWorkforce)} |
| Mean AI Impact | ${fmtMean(facts.meanAiImpact)} / 10 |
| Median AI Impact | ${fmtMean(facts.medianAiImpact)} / 10 |
| Mean Displacement-Risk | ${fmtMean(facts.meanDisplacementRisk)} / 10 |
| Occupations at AI Impact >= ${facts.highImpactThreshold} | ${facts.highImpactCount} |
| Annual wages at AI Impact >= ${facts.highImpactThreshold} | ${facts.highImpactAnnualWagesTrillion.toFixed(6)} trillion yen |
| Low / mid / high risk-band counts | ${facts.lowRiskCount} / ${facts.midRiskCount} / ${facts.highRiskCount} |
| High-impact workforce | ${fmtInt(facts.highRiskWorkforce)} (${fmtPct(facts.highRiskWorkforceSharePct)}) |

### AI Impact distribution

| Band | Occupations | Share |
|---|---:|---:|
${bandRows(facts)}

## 3. Methodology

AI Impact is the Transformation index: mean(D1, D2). It estimates how much daily work changes when current AI tools are available. Displacement-Risk is a separate index estimating job shrinkage risk after human moat, adoption cost, and labor-market context are considered.
${crossModelValidationNote(facts)}
## 4. Rubric

- D1 Cognitive/generative exposure.
- D2 Routine/procedural exposure.
- D3 Manual/physical demand.
- D4 Judgment and accountability.
- D5 Social and emotional intelligence.
- D6 Creative/original intelligence.
- D7 Regulatory and safety barrier.
- D8 Economic feasibility.
- D9 Institutional and labor-market context for Japan.
- D10 Labor-demand trajectory.

## 5. Sector means

| Sector ID | Sector | Occupations | Mean AI Impact | Workforce |
|---|---|---:|---:|---:|
${sectorRows(facts.sectorsByMeanImpact)}

## 6. Highest AI Impact occupations

| Rank | Occupation | AI Impact | Displacement-Risk | Workers |
|---:|---|---:|---:|---:|
${tableRows(facts.topImpactOccupations, 20)}

## 7. Lowest AI Impact occupations

| Rank | Occupation | AI Impact | Displacement-Risk | Workers |
|---:|---|---:|---:|---:|
${tableRows(facts.bottomImpactOccupations, 20)}

## 8. Frequently asked questions

Q: Which occupation is most exposed to AI?
A: ${facts.highestImpactOccupation.nameJa} has the highest AI Impact in the active batch at ${fmtScore(facts.highestImpactOccupation.aiImpact)}/10.

Q: Which occupation is least exposed to AI?
A: ${facts.lowestImpactOccupation.nameJa} has the lowest AI Impact in the active batch at ${fmtScore(facts.lowestImpactOccupation.aiImpact)}/10.

Q: How should high AI Impact be interpreted?
A: It means the work is strongly reshaped by AI. It does not by itself mean the occupation disappears.

Q: Are the scores official?
A: No. They are independent LLM estimates produced under ${attribution.standardLabel}, not government forecasts.

## 9. Sources

- MHLW jobtag occupation data: https://shigoto.mhlw.go.jp/User/
- JILPT occupation database/IPD data: https://www.jil.go.jp/
- Public compact dataset: https://mirai-shigoto.com/data.treemap.json
- Per-occupation detail IDs are zero-padded to four digits; for example, occupation #1 is https://mirai-shigoto.com/data.detail/0001.json

## 10. How to cite

Plain: ZKSC (2026). Japan Jobs x AI Impact Map. https://mirai-shigoto.com/

\`\`\`bibtex
@misc{mirai_shigoto_2026,
  author = {ZKSC},
  title  = {Japan Jobs x AI Impact Map},
  year   = {2026},
  url    = {https://mirai-shigoto.com/},
  note   = {Independent AIOIS-10 analysis. Active score run: ${attribution.modelDisplay}, ${attribution.runDate}. AI Impact scores are LLM estimates, not official government forecasts.}
}
\`\`\`

## 11. Disclaimer

This site is independent and unofficial. It does not represent MHLW, jobtag, or JILPT. The AI Impact and Displacement-Risk scores are subjective estimates and should not be used as the sole basis for career, hiring, investment, or policy decisions.
`;
}

export function renderHomeJsonLd(facts: GeoFacts): string {
  const site = 'https://mirai-shigoto.com';
  const { attribution } = facts;
  const occupationCount = HOME_OCCUPATION_COUNT_PLACEHOLDER;
  const fiveBandSummary = facts.fiveBandDistribution
    .map((band) => `${band.key}:${band.count} (${band.sharePct}%)`)
    .join(', ');
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${site}/#organization`,
      name: 'ZKSC',
      legalName: 'ZKSC株式会社',
      alternateName: ['未来の仕事', 'Japan Jobs x AI Impact Map'],
      url: 'https://zksc.io',
      logo: `${site}/api/og?page=home`,
      email: 'info@mirai-shigoto.com',
      foundingDate: '2026',
      description: `ZKSC operates mirai-shigoto.com, an independent analysis of ${occupationCount} Japanese occupations and AI impact.`,
      knowsAbout: [
        'Japanese labor market',
        'AI occupational impact',
        'MHLW jobtag',
        'JILPT occupational database',
        attribution.standardLabel,
      ],
      address: { '@type': 'PostalAddress', addressLocality: 'Tokyo', addressCountry: 'JP' },
      areaServed: { '@type': 'Country', name: 'Japan' },
    },
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      url: `${site}/`,
      name: '未来の仕事',
      alternateName: 'Japan Jobs x AI Impact Map',
      description: `Independent map of ${occupationCount} Japanese occupations scored for AI Impact under ${attribution.standardLabel}.`,
      inLanguage: ['ja'],
      creator: { '@id': `${site}/#organization` },
      publisher: { '@id': `${site}/#organization` },
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      datePublished: attribution.runDate,
      dateModified: attribution.runDate,
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1 .accent', 'h1 .h1-sub', '.banner-text'],
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${site}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Dataset',
      '@id': `${site}/#dataset`,
      name: `Japan ${occupationCount} Occupations x AI Impact`,
      alternateName: '日本の職業 AI 影響度マップ',
      description: `${occupationCount} Japanese occupations sourced from MHLW jobtag and JILPT, scored 0-10 for AI Impact by ${attribution.modelDisplay}. Mean AI Impact ${fmtMean(facts.meanAiImpact)}/10; mean Displacement-Risk ${fmtMean(facts.meanDisplacementRisk)}/10.`,
      url: `${site}/`,
      creator: { '@id': `${site}/#organization` },
      publisher: { '@id': `${site}/#organization` },
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      datePublished: attribution.runDate,
      dateModified: attribution.runDate,
      version: `${attribution.modelId}:${attribution.runDate}`,
      keywords: ['AI', 'labor market', 'Japan', 'occupations', 'AIOIS-10', 'MHLW jobtag', 'JILPT'],
      spatialCoverage: { '@type': 'Place', name: 'Japan' },
      temporalCoverage: '2025/2026',
      measurementTechnique: `Scored with ${attribution.standardLabel} v1.0. Active model: ${attribution.modelDisplay}.`,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Mapped occupation count', value: facts.occupationCount },
        { '@type': 'PropertyValue', name: 'Mapped workforce', value: facts.totalWorkforce, unitText: 'people' },
        { '@type': 'PropertyValue', name: 'Mean AI Impact', value: facts.meanAiImpactRaw, minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: 'Mean Displacement-Risk', value: facts.meanDisplacementRiskRaw, minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: `Occupations with AI Impact >= ${facts.highImpactThreshold}`, value: facts.highImpactCount },
        { '@type': 'PropertyValue', name: `Annual wages with AI Impact >= ${facts.highImpactThreshold}`, value: facts.highImpactAnnualWagesTrillion, unitText: 'trillion JPY' },
        { '@type': 'PropertyValue', name: 'Rounded AI Impact five-band distribution', value: fiveBandSummary },
      ],
      citation: [
        'MHLW jobtag: https://shigoto.mhlw.go.jp/User/',
        'JILPT occupation database: https://www.jil.go.jp/',
      ],
      includedInDataCatalog: {
        '@type': 'DataCatalog',
        name: 'mirai-shigoto.com',
        url: `${site}/`,
      },
      variableMeasured: [
        { '@type': 'PropertyValue', name: 'AI Impact / Transformation index (0-10)', minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: 'Displacement-Risk index (0-10)', minValue: 0, maxValue: 10 },
        { '@type': 'PropertyValue', name: 'AIOIS-10 D1-D10 dimensions (0-10)' },
        { '@type': 'PropertyValue', name: 'Workforce size' },
        { '@type': 'PropertyValue', name: 'Annual salary' },
      ],
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: `${site}/data.treemap.json`,
        },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${site}/#top-findings`,
      name: `Notable findings - Japan ${occupationCount} occupations x AI Impact`,
      description: `Generated from the active ${attribution.modelDisplay} ${attribution.runDate} score batch.`,
      itemListOrder: 'https://schema.org/ItemListUnordered',
      numberOfItems: 5,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: facts.largestOccupation.nameJa,
          description: `${facts.largestOccupation.nameJa} is the largest mapped occupation with ${fmtInt(facts.largestOccupation.workers)} workers and AI Impact ${fmtScore(facts.largestOccupation.aiImpact)}/10.`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: facts.highestImpactOccupation.nameJa,
          description: `${facts.highestImpactOccupation.nameJa} has the highest AI Impact at ${fmtScore(facts.highestImpactOccupation.aiImpact)}/10.`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: facts.lowestImpactOccupation.nameJa,
          description: `${facts.lowestImpactOccupation.nameJa} has the lowest AI Impact at ${fmtScore(facts.lowestImpactOccupation.aiImpact)}/10.`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: `Occupations and wages at AI Impact >= ${facts.highImpactThreshold}`,
          description: `${facts.highImpactCount} occupations score ${facts.highImpactThreshold}.0 or higher, representing ${facts.highImpactAnnualWagesTrillion.toFixed(6)} trillion yen in annual wages.`,
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Mean AI Impact',
          description: `Mean AI Impact is ${fmtMean(facts.meanAiImpact)}/10; mean Displacement-Risk is ${fmtMean(facts.meanDisplacementRisk)}/10.`,
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${site}/#faq`,
      inLanguage: 'ja',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'mirai-shigoto.com とは？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `厚生労働省 jobtag と JILPT の公開データをもとに、日本の ${occupationCount} 職業を ${attribution.modelDisplay} による AI 影響度スコアで可視化した独立分析サイトです。`,
          },
        },
        {
          '@type': 'Question',
          name: 'AI 影響度は失業確率ですか？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'いいえ。AI 影響度は仕事がどれだけ AI によって変化するかを示す Transformation 指数であり、失業確率ではありません。',
          },
        },
        {
          '@type': 'Question',
          name: '現在の採点モデルと日付は？',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `現在の公開データは ${attribution.modelDisplay}（${attribution.runDate}）による ${attribution.standardLabel} v1.0 採点です。`,
          },
        },
      ],
    },
  ];

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2) + '\n';
}
