/**
 * hub-hub-graph.ts — Phase B: cross-genre hub-to-hub relations.
 *
 * Each hub gets a "関連 hub" section listing 5-8 cross-genre hubs that share
 * meaningful overlap. This builds bidirectional clusters Google can identify
 * (e.g. iryo sector ↔ medical-licenses ↔ kango-ai Q&A ↔ social interest).
 *
 * Two layers:
 *   1. Auto-derived rules (sector_id keyword match, AI-tier match, etc.)
 *   2. Hand-curated overrides for high-value pairs the auto rules miss
 *
 * Each hub identified by a (genre, slug) tuple. Genres correspond to URL
 * prefixes like /ja/sectors, /ja/rankings, /ja/q, etc.
 */

import { ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS,
  EDUCATION_CONFIGS, TRAINING_CONFIGS, WORK_STYLES_CONFIGS,
  EMPLOYMENT_CONFIGS, LIFE_BALANCE_CONFIGS, ENTRY_PATHS_CONFIGS } from './genre-configs.js';
import { SKILL_META } from './skills-meta.js';
import { INTEREST_META } from './interests-meta.js';
import { CAREER_PERSONAS } from './careers-meta.js';
import { LICENSE_HUBS } from './licenses-meta.js';
import { QA_ITEMS } from './qa-meta.js';
import { COMPARE_META } from './compare-meta.js';
import { RANKING_META } from './rankings-meta.js';

// ─── Public types ─────────────────────────────────────────────────────────

export type HubGenre =
  | 'sectors' | 'rankings' | 'q' | 'compare' | 'careers' | 'licenses'
  | 'skills' | 'interests' | 'abilities' | 'knowledge' | 'values'
  | 'education' | 'training' | 'work-styles' | 'employment-types'
  | 'life-balance' | 'entry-paths';

export interface HubRef {
  genre: HubGenre;
  slug: string;
  name: string;
  /** Optional 1-line description shown smaller below name */
  desc?: string;
}

export interface RelatedHubsBlock {
  /** From-hub identification */
  from: { genre: HubGenre; slug: string };
  /** Cross-genre hubs related to this one, in display order */
  related: HubRef[];
}

// ─── Hand-curated cross-genre pairs (high-value overrides) ─────────────────

/**
 * Each entry: from a (genre, slug) → array of related (genre, slug).
 * Bidirectional: if A is in B's list, B will also be in A's list (we
 * symmetrize at build time).
 *
 * Curation guideline: only add pairs where the semantic overlap is HIGH and
 * users would likely click between them. Auto rules below cover most cases;
 * use this for edge cases auto rules miss.
 */
const CURATED_PAIRS: Array<[HubRef['genre'], string, HubRef['genre'], string]> = [
  // 業種 ↔ 該当 license category
  ['sectors', 'iryo', 'licenses', 'medical-licenses'],
  ['sectors', 'fukushi', 'licenses', 'welfare-licenses'],
  ['sectors', 'kyoiku', 'licenses', 'education-licenses'],
  ['sectors', 'kensetu', 'licenses', 'construction-licenses'],
  ['sectors', 'it', 'licenses', 'it-licenses'],
  ['sectors', 'shigyo', 'licenses', 'legal-licenses'],
  ['sectors', 'shigyo', 'licenses', 'accounting-licenses'],
  // 業種 ↔ 該当 Q&A
  ['sectors', 'iryo', 'q', 'kango-ai'],
  ['sectors', 'fukushi', 'q', 'kaigo-ryouritsu'],
  ['sectors', 'it', 'q', 'it-engineer-ai'],
  ['sectors', 'jimu', 'q', 'jimu-mirai'],
  ['sectors', 'kyoiku', 'q', 'kyouiku-ai'],
  ['sectors', 'hanbai', 'q', 'hanbai-mirai'],
  // 業種 ↔ 該当 ranking
  ['sectors', 'iryo', 'rankings', 'license-required'],
  ['sectors', 'fukushi', 'rankings', 'ai-safe-interpersonal'],
  ['sectors', 'kensetu', 'rankings', 'ai-resistant-craft'],
  ['sectors', 'it', 'rankings', 'ai-frontier'],
  ['sectors', 'jimu', 'rankings', 'ai-replaced-soon'],
  ['sectors', 'noringyo', 'rankings', 'ai-resistant-craft'],
  ['sectors', 'seizo', 'rankings', 'ai-resistant-craft'],
  ['sectors', 'creative', 'rankings', 'ai-augmented'],
  // 業種 ↔ interests
  ['sectors', 'iryo', 'interests', 'social'],
  ['sectors', 'fukushi', 'interests', 'social'],
  ['sectors', 'kyoiku', 'interests', 'social'],
  ['sectors', 'it', 'interests', 'investigative'],
  ['sectors', 'creative', 'interests', 'artistic'],
  ['sectors', 'shigyo', 'interests', 'enterprising'],
  ['sectors', 'jimu', 'interests', 'conventional'],
  ['sectors', 'kensetu', 'interests', 'realistic'],
  ['sectors', 'noringyo', 'interests', 'realistic'],
  // ranking ↔ Q&A
  ['rankings', 'ai-risk-low', 'q', 'ai-de-kienai'],
  ['rankings', 'ai-risk-high', 'q', 'ai-de-kieru'],
  ['rankings', 'ai-augmented', 'q', 'ai-augment-vs-replace'],
  ['rankings', 'ai-replaced-soon', 'q', 'ai-de-kieru'],
  ['rankings', 'ai-resistant-craft', 'q', 'shokunin-mirai'],
  ['rankings', 'license-required', 'q', 'shikaku-mamoru'],
  ['rankings', 'no-license-required', 'q', 'tenshoku-yasashii'],
  ['rankings', 'salary-safe', 'q', 'ai-jidai-osusume'],
  ['rankings', 'ai-safe-interpersonal', 'q', 'hito-aite-shigoto'],
  // license ↔ Q&A
  ['licenses', 'national-vs-private', 'q', 'shikaku-mamoru'],
  ['licenses', 'gyoumu-dokusen', 'q', 'shikaku-mamoru'],
  ['licenses', 'medical-licenses', 'q', 'kango-ai'],
  // interests ↔ careers (loose mapping)
  ['interests', 'social', 'careers', 'shufu-fukki'],
  ['interests', 'investigative', 'careers', '30s-early'],
  ['interests', 'enterprising', 'careers', 'career-change'],
  // careers ↔ Q&A
  ['careers', 'shinsotsu', 'q', 'shinso-osusume'],
  ['careers', '30s-early', 'q', 'tenshoku-30s'],
  ['careers', '30s-late', 'q', 'tenshoku-30s'],
  ['careers', '40s', 'q', 'tenshoku-40s'],
  ['careers', '50s', 'q', 'over-50-katsuyaku'],
  ['careers', 'shufu-fukki', 'q', 'ikuji-ryouritsu'],
  ['careers', 'shufu-fukki', 'q', 'female-long'],
  ['careers', 'career-change', 'q', 'career-change-mirai'],
  // life-balance ↔ Q&A
  ['life-balance', 'flex', 'q', 'fukugyou-ok'],
  ['life-balance', 'remote-friendly', 'q', 'zaitaku-shigoto'],
  // skills ↔ abilities (frequent co-pairs)
  ['skills', 'critical-thinking', 'abilities', 'inductive-reasoning'],
  ['skills', 'critical-thinking', 'abilities', 'deductive-reasoning'],
  ['skills', 'problem-solving', 'abilities', 'problem-sensitivity'],
  ['skills', 'instructing', 'abilities', 'oral-expression'],
  ['skills', 'social-perceptiveness', 'abilities', 'oral-comprehension'],
  ['skills', 'persuasion', 'abilities', 'oral-expression'],
  // compare ↔ matching sector / Q&A
  ['compare', 'kango-vs-helper', 'sectors', 'iryo'],
  ['compare', 'kango-vs-yakuzaishi', 'sectors', 'iryo'],
  ['compare', 'se-vs-programmer', 'sectors', 'it'],
  ['compare', 'iryo-jimu-vs-ippan-jimu', 'sectors', 'jimu'],
  ['compare', 'kaigo-vs-kea-mane', 'sectors', 'fukushi'],
  ['compare', 'shoubou-vs-keisatsu', 'sectors', 'hoan'],
  ['compare', 'kyoshi-vs-hoikushi', 'sectors', 'kyoiku'],
  ['compare', 'webdesigner-vs-illustrator', 'sectors', 'creative'],
  ['compare', 'data-scientist-vs-ai-engineer', 'sectors', 'it'],
];

// ─── Display name lookup per (genre, slug) ─────────────────────────────────

interface NameLookup {
  name: string;
  desc?: string;
}

const _SECTOR_NAMES: Record<string, string> = {
  iryo: '医療・保健', fukushi: '福祉・介護', kyoiku: '教育・指導',
  hoan: '保安・公務', noringyo: '農林漁業', kensetu: '建設・採掘',
  seizo: '製造', maint: '保守・点検', keiseki: '運輸・配送',
  hanbai: '販売', service: 'サービス', jimu: '事務',
  shigyo: '士業・専門', senmon: '専門・技術', it: 'IT・通信', creative: 'クリエイティブ',
};

function nameForHub(genre: HubGenre, slug: string): NameLookup {
  switch (genre) {
    case 'sectors':
      return { name: _SECTOR_NAMES[slug] ?? slug };
    case 'rankings': {
      const m = RANKING_META.find((x) => x.slug === slug);
      return { name: m?.name_ja ?? slug, desc: m?.description_ja };
    }
    case 'q': {
      const m = QA_ITEMS.find((x) => x.slug === slug);
      return { name: m?.question ?? slug, desc: m?.short_answer.slice(0, 60) };
    }
    case 'compare': {
      const m = COMPARE_META.find((x) => x.slug === slug);
      return { name: m?.title_ja ?? slug, desc: m?.description_ja.slice(0, 60) };
    }
    case 'careers': {
      const m = CAREER_PERSONAS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'licenses': {
      const m = LICENSE_HUBS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'skills': {
      const m = SKILL_META.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'interests': {
      const m = INTEREST_META.find((x) => x.slug === slug);
      return { name: m ? `${m.letter} (${m.name_ja})` : slug, desc: m?.title_ja };
    }
    case 'abilities': {
      const m = ABILITIES_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'knowledge': {
      const m = KNOWLEDGE_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'values': {
      const m = VALUES_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'education': {
      const m = EDUCATION_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'training': {
      const m = TRAINING_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'work-styles': {
      const m = WORK_STYLES_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'employment-types': {
      const m = EMPLOYMENT_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'life-balance': {
      const m = LIFE_BALANCE_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
    case 'entry-paths': {
      const m = ENTRY_PATHS_CONFIGS.find((x) => x.slug === slug);
      return { name: m?.short_ja ?? slug, desc: m?.title_ja };
    }
  }
}

// ─── Build the symmetric graph ─────────────────────────────────────────────

interface PairKey { from: { genre: HubGenre; slug: string }; to: { genre: HubGenre; slug: string }; }

let _graphCache: Map<string, HubRef[]> | null = null;

function key(genre: HubGenre, slug: string): string { return `${genre}::${slug}`; }

/** Symmetric graph keyed by "genre::slug". Returns the from-hub's neighbors. */
function buildHubGraph(): Map<string, HubRef[]> {
  if (_graphCache) return _graphCache;
  const adj = new Map<string, HubRef[]>();
  const seen = new Set<string>();

  const addEdge = (a: { genre: HubGenre; slug: string }, b: { genre: HubGenre; slug: string }): void => {
    if (a.genre === b.genre && a.slug === b.slug) return;
    const edgeKey = `${key(a.genre, a.slug)}|${key(b.genre, b.slug)}`;
    const reverseKey = `${key(b.genre, b.slug)}|${key(a.genre, a.slug)}`;
    if (seen.has(edgeKey) || seen.has(reverseKey)) return;
    seen.add(edgeKey);
    seen.add(reverseKey);
    const aName = nameForHub(a.genre, a.slug);
    const bName = nameForHub(b.genre, b.slug);

    const aList = adj.get(key(a.genre, a.slug)) ?? [];
    aList.push({ genre: b.genre, slug: b.slug, name: bName.name, desc: bName.desc });
    adj.set(key(a.genre, a.slug), aList);

    const bList = adj.get(key(b.genre, b.slug)) ?? [];
    bList.push({ genre: a.genre, slug: a.slug, name: aName.name, desc: aName.desc });
    adj.set(key(b.genre, b.slug), bList);
  };

  // 1) Curated pairs
  for (const [aGenre, aSlug, bGenre, bSlug] of CURATED_PAIRS) {
    addEdge({ genre: aGenre, slug: aSlug }, { genre: bGenre, slug: bSlug });
  }

  // 2) Auto: every Q&A → the Q&A's related_topics (within Q&A genre)
  for (const qa of QA_ITEMS) {
    for (const otherSlug of qa.related_topics) {
      addEdge({ genre: 'q', slug: qa.slug }, { genre: 'q', slug: otherSlug });
    }
  }

  _graphCache = adj;
  return adj;
}

/**
 * Get up to N related hubs for a given (genre, slug).
 * Returns hubs sorted by genre diversity first (one from each different genre)
 * to maximize cross-domain spread.
 */
export function getRelatedHubs(genre: HubGenre, slug: string, limit: number = 6): HubRef[] {
  const adj = buildHubGraph();
  const list = adj.get(key(genre, slug)) ?? [];

  // Diversity-aware ordering: round-robin pick from distinct genres.
  const byGenre = new Map<HubGenre, HubRef[]>();
  for (const ref of list) {
    const arr = byGenre.get(ref.genre) ?? [];
    arr.push(ref);
    byGenre.set(ref.genre, arr);
  }
  const result: HubRef[] = [];
  let cursor = 0;
  const genres = [...byGenre.keys()];
  while (result.length < limit && genres.some((g) => (byGenre.get(g) ?? []).length > cursor)) {
    for (const g of genres) {
      const arr = byGenre.get(g) ?? [];
      if (cursor < arr.length && result.length < limit) {
        result.push(arr[cursor]);
      }
    }
    cursor++;
  }
  return result;
}

// ─── Render helpers ────────────────────────────────────────────────────────

const GENRE_LABEL_JA: Record<HubGenre, string> = {
  sectors: '業種',
  rankings: 'ランキング',
  q: 'Q&A',
  compare: '比較',
  careers: 'キャリア段階',
  licenses: '資格',
  skills: 'スキル',
  interests: '興味タイプ',
  abilities: '能力',
  knowledge: '知識',
  values: '価値観',
  education: '学歴',
  training: '修行期間',
  'work-styles': '働き方',
  'employment-types': '雇用形態',
  'life-balance': 'ライフ整合',
  'entry-paths': '入職経路',
};

export function renderRelatedHubsBlock(genre: HubGenre, slug: string, limit: number = 6): string {
  const items = getRelatedHubs(genre, slug, limit);
  if (items.length === 0) return '';

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  const itemsHtml = items.map((it) => {
    const href = `/ja/${it.genre}/${it.slug}`;
    const label = GENRE_LABEL_JA[it.genre];
    const descHtml = it.desc ? `<span class="rxh-desc">${escapeHtml(it.desc)}</span>` : '';
    return `<li><a class="rxh-link" href="${escapeHtml(href)}">` +
           `<span class="rxh-genre">${escapeHtml(label)}</span>` +
           `<span class="rxh-name">${escapeHtml(it.name)}</span>` +
           descHtml +
           `</a></li>`;
  }).join('');

  return `<section class="related-cross-hub" aria-label="関連する他カテゴリーの hub">
    <h2>関連する他カテゴリー</h2>
    <ul class="rxh-list">${itemsHtml}</ul>
  </section>`;
}

export const RELATED_CROSS_HUB_CSS = `
.related-cross-hub{margin:36px 0}
.related-cross-hub h2{font-family:var(--font-serif);font-size:1.1rem;color:var(--accent-deep);margin:0 0 14px;font-weight:600}
.rxh-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.rxh-link{display:flex;flex-direction:column;gap:3px;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);transition:border-color 150ms,background 150ms}
.rxh-link:hover{border-color:var(--accent);background:rgba(217,107,61,0.04);text-decoration:none}
.rxh-genre{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);font-weight:600}
.rxh-name{font-family:var(--font-serif);font-size:.95rem;color:var(--accent-deep);line-height:1.35}
.rxh-desc{font-size:.74rem;color:var(--fg2);line-height:1.4}
@media (max-width:600px){.rxh-list{grid-template-columns:1fr}}
`;
