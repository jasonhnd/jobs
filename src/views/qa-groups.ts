/**
 * src/views/qa-groups.ts — the Q&A group partition, kept free of the question
 * bodies so light consumers (the OG card table) can count questions without
 * bundling every answer text. qa-meta.ts re-exports these.
 */

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

type QaGroupKey = keyof typeof QA_GROUP_SLUGS;

/**
 * /q hub sections in page order. The *-extra groups fold into the section of
 * their parent theme, so the five section titles stay as they are (#884).
 */
export const QA_HUB_SECTIONS: ReadonlyArray<readonly [string, ReadonlyArray<QaGroupKey>]> = [
  ['AI 不安に答える', ['ai-anxiety', 'ai-anxiety-extra']],
  ['業種別の未来', ['sector-future']],
  ['キャリア相談', ['career', 'career-extra']],
  ['ライフ条件', ['life', 'life-extra']],
  ['適性・興味', ['aptitude', 'aptitude-extra']],
];

/** Number of Q&A pages — the sum of the partition (qa-meta.test.ts pins it to QA_ITEMS). */
export function qaQuestionCount(): number {
  return Object.values(QA_GROUP_SLUGS).reduce((n, slugs) => n + slugs.length, 0);
}
