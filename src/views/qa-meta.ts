/**
 * src/views/qa-meta.ts — 49 Q&A hub の質問・回答・例選定ロジック。
 *
 * 各 Q&A は:
 *   - question: h1 になる質問
 *   - short_answer: 150 字のリード回答
 *   - reasoning: 300-500 字の根拠展開
 *   - selector: 該当例を選ぶ predicate
 * から成る。
 *
 * Migrated from src/data/lib/qa-meta.ts 2026-05-14 (Phase B).
 * Lives under src/views/ per §6.2.
 *
 * Pure-data モジュール。
 */
import type { DetailFileMin } from './genre-hub.js';
import { AI_ANXIETY_ITEMS } from './qa-items/ai-anxiety.js';
import { SECTOR_FUTURE_ITEMS } from './qa-items/sector-future.js';
import { CAREER_ITEMS } from './qa-items/career.js';
import { LIFE_ITEMS } from './qa-items/life.js';
import { APTITUDE_ITEMS } from './qa-items/aptitude.js';
import { APTITUDE_EXTRA_ITEMS } from './qa-items/aptitude-extra.js';
import { LIFE_EXTRA_ITEMS } from './qa-items/life-extra.js';
import { AI_ANXIETY_EXTRA_ITEMS } from './qa-items/ai-anxiety-extra.js';
import { CAREER_EXTRA_ITEMS } from './qa-items/career-extra.js';

export interface QAItem {
  slug: string;
  question: string;
  short_answer: string;
  reasoning: string;
  /** Predicate that returns sort score, or null to exclude */
  selector: (d: DetailFileMin) => number | null;
  related_topics: ReadonlyArray<string>;
  og_eyebrow: string;
}

export const QA_ITEMS: ReadonlyArray<QAItem> = [
  ...AI_ANXIETY_ITEMS,
  ...SECTOR_FUTURE_ITEMS,
  ...CAREER_ITEMS,
  ...LIFE_ITEMS,
  ...APTITUDE_ITEMS,
  ...APTITUDE_EXTRA_ITEMS,
  ...LIFE_EXTRA_ITEMS,
  ...AI_ANXIETY_EXTRA_ITEMS,
  ...CAREER_EXTRA_ITEMS,
];

/**
 * Nine thematic groups of QA_ITEMS, matching the section comments above.
 * #328 writes the first-screen answer line per group (different sort
 * dimensions). Keep this partition in lockstep with the catalog — the
 * test in qa-meta.test.ts asserts every slug is in exactly one group.
 */
export const QA_GROUP_SLUGS = {
  'ai-anxiety': [
    'ai-de-kienai', 'ai-de-kieru', 'ai-augment-vs-replace', 'shikaku-mamoru',
    'genba-vs-jimu', 'shokunin-mirai', 'hito-aite-shigoto', 'ai-jidai-osusume',
  ],
  'sector-future': [
    'kango-ai', 'it-engineer-ai', 'jimu-mirai', 'hanbai-mirai',
    'driver-mirai', 'kyouiku-ai',
  ],
  'career': [
    'shinso-osusume', 'tenshoku-30s', 'tenshoku-40s', 'over-50-katsuyaku',
    'tenshoku-yasashii', 'career-change-mirai', 'blank-fukki',
    'hoshou-nashi-tenshoku', 'tenshoku-kaisuu-ooi',
  ],
  'life': [
    'ikuji-ryouritsu', 'kaigo-ryouritsu', 'female-long', 'zaitaku-shigoto',
    'fukugyou-ok', 'shougai-mochi-ok',
  ],
  'aptitude': [
    'bunkei-osusume', 'rikei-osusume', 'hito-mishiri-ok', 'suugaku-nigate',
    'eigo-ikasu', 'geijutsu-keikei',
  ],
  'aptitude-extra': [
    'naiko-osusume', 'gaiko-osusume', 'kanjou-roudou-sukunai', 'ronri-shiko-ikasu',
  ],
  'life-extra': [
    'tsuukin-friendly', 'yakin-nashi', 'dokushin-friendly',
  ],
  'ai-anxiety-extra': [
    'ai-shitsugyou-yobou', 'ai-skill-mi-ni-tsukeru', 'ai-hoshou-shoku',
  ],
  'career-extra': [
    'gakureki-konpurekkusu', 'mikeiken-it', 'nenshu-up', 'kaigai-iju-shoku',
  ],
} as const;

export type QaGroup = keyof typeof QA_GROUP_SLUGS;

const QA_SLUG_TO_GROUP: ReadonlyMap<string, QaGroup> = (() => {
  const map = new Map<string, QaGroup>();
  (Object.entries(QA_GROUP_SLUGS) as Array<[QaGroup, readonly string[]]>).forEach(
    ([group, slugs]) => {
      for (const slug of slugs) map.set(slug, group);
    },
  );
  return map;
})();

export function qaGroup(slug: string): QaGroup {
  const group = QA_SLUG_TO_GROUP.get(slug);
  if (!group) throw new Error(`qa-meta: unknown Q&A slug ${slug}`);
  return group;
}

export function selectExamples(items: ReadonlyArray<DetailFileMin>, qa: QAItem, n: number = 10): ReadonlyArray<DetailFileMin> {
  const scored = items
    .map((d) => ({ d, score: qa.selector(d) }))
    .filter((x): x is { d: DetailFileMin; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.d);
}
