/**
 * src/views/og-cards.ts — typed OG card configs per URL param.
 *
 * Step 9 part 1 (2026-05-13): the `api/og.tsx` Edge Function used
 * to inline 80+ lines of `{slug → {eyebrow, title, subtitle}}`
 * dictionaries for the generic text-only OG cards covering every
 * non-rich page family on the site. Per docs/architecture.md §5
 * "横切关注点 = view 的另一种实例", these typed-data maps are a
 * view: input = route param, output = typed `GenericCardConfig`.
 *
 * The 5 dicts here cover:
 *
 *   PAGE_CARDS      — 35 static pages (home / legal / hubs / yearly)
 *   RANKING_CARDS   — N rankings (built from RANKING_META)
 *   INTEREST_CARDS  — 6 RIASEC types (built from INTEREST_META)
 *   SKILL_CARDS     — 10 hub skills (built from SKILL_META)
 *   COMPARE_CARDS   — 12 compare pairs (built from COMPARE_META)
 *
 * The 4 built-from-META dicts re-derive on every import, but
 * the META modules are static const data so cost is negligible.
 *
 * Rich (non-generic) cards — occupation / sector / map — have
 * dedicated render functions in api/og.tsx that consume the
 * graph directly. Those don't reduce to a {slug → text} table.
 */

import { RANKING_META } from '../data/lib/rankings-meta.js';
import { INTEREST_META } from './interests-meta.js';
import { SKILL_META } from './skills-meta.js';
import { COMPARE_META } from './compare-meta.js';
import type { GenericCardConfig } from '../lib/og-helpers.js';

/** 35 static page variants — homepage, legal, hub indexes, yearly,
 *  about/methodology/glossary/etc. */
export const PAGE_CARDS: Record<string, GenericCardConfig> = {
  home: {
    eyebrow: 'JAPAN OCCUPATIONS · 552 職業 × AI 影響',
    title: 'AIの時代でも、あなたらしい働き方を',
    subtitle: '552 職業を AI 影響度・就業者数・年収・5 次元で多角分析',
  },
  about: {
    eyebrow: 'ABOUT',
    title: 'データについて',
    subtitle: '厚労省 jobtag · JILPT · Claude Opus 4.7 採点の方法論',
  },
  privacy: {
    eyebrow: 'PRIVACY',
    title: 'プライバシーポリシー',
    subtitle: 'APPI / GDPR 対応 · 何を集め、何を集めないか',
  },
  compliance: {
    eyebrow: 'COMPLIANCE',
    title: 'データ出典 · 二次利用',
    subtitle: 'MIT ライセンス · IPD は © JILPT TOS 第 9 条に従う',
  },
  '404': {
    eyebrow: '404',
    title: 'ページが見つかりません',
    subtitle: '/ に戻って続きをご覧ください',
  },
  sectors: {
    eyebrow: 'SECTORS · 16 業界',
    title: '業界別 AI 影響',
    subtitle: '16 業界 552 職業を業界別にナビゲート',
  },
  rankings: {
    eyebrow: 'RANKINGS · 9 視点',
    title: 'AI × 仕事 ランキング',
    subtitle: '9 視点で見る "変わる仕事" / "変わらない仕事"',
  },
  interests: {
    eyebrow: 'INTERESTS · RIASEC 6 タイプ',
    title: '興味タイプから職業を探す',
    subtitle: 'RIASEC 6 分類で 552 職業を整理',
  },
  skills: {
    eyebrow: 'SKILLS · 主要 10 スキル',
    title: 'スキルから職業を探す',
    subtitle: 'IPD 39 スキル軸から 10 を hub 化',
  },
  compare: {
    eyebrow: 'COMPARE · 12 ペア',
    title: '職業を比較する',
    subtitle: '迷いやすい職業 12 ペアを side-by-side で',
  },
  // Phase 3 page cards
  abilities:        { eyebrow: 'ABILITIES · 8 軸',   title: '能力から職業を探す',       subtitle: 'IPD 52 能力軸から 8 を hub 化' },
  knowledge:        { eyebrow: 'KNOWLEDGE · 5 軸',   title: '知識から職業を探す',       subtitle: 'IPD 33 知識領域から 5 を hub 化' },
  values:           { eyebrow: 'VALUES · 6 軸',      title: '価値観から職業を探す',     subtitle: 'IPD 12 価値観軸から 6 を hub 化' },
  education:        { eyebrow: 'EDUCATION · 6 段階', title: '学歴から職業を探す',       subtitle: '学歴別 6 段階で 552 職業を分類' },
  training:         { eyebrow: 'TRAINING · 4 段階',  title: '修行期間から職業を探す',   subtitle: '入職後 4 段階の修行期間別' },
  'work-styles':    { eyebrow: 'WORK-STYLE · 6 軸',  title: '働き方から職業を探す',     subtitle: '業務形態 6 軸で分類' },
  'employment-types': { eyebrow: 'EMPLOY · 4 軸',   title: '雇用形態から職業を探す',   subtitle: '正社員/フリー/パート/公務員' },
  'life-balance':   { eyebrow: 'LIFE · 5 軸',        title: 'ライフ整合から職業を探す', subtitle: '育児・介護・健康・趣味との両立' },
  'entry-paths':    { eyebrow: 'ENTRY · 4 軸',       title: '入職経路から職業を探す',   subtitle: '新卒/中途/バイト/独立' },
  careers:          { eyebrow: 'CAREER · 10 persona', title: 'キャリア段階から探す',   subtitle: '10 persona 別おすすめ職業' },
  licenses:         { eyebrow: 'LICENSE · 15 カテゴリー', title: '資格から職業を探す', subtitle: '15 資格カテゴリー別の関連職業' },
  qa:               { eyebrow: 'Q&A · 36 個',        title: 'よくある質問',            subtitle: 'AI 時代のキャリア 36 質問に回答' },
  'about-trust':    { eyebrow: 'ABOUT',              title: '方法論・信頼性',          subtitle: '本サイトの分析方法を全公開' },
  methodology:      { eyebrow: 'METHOD',             title: 'AI 影響度評価の方法論',   subtitle: 'Claude Opus 4.7 ロジック詳細' },
  glossary:         { eyebrow: 'GLOSSARY',           title: '用語集',                  subtitle: '本サイト独自用語の定義' },
  'data-sources':   { eyebrow: 'SOURCES',            title: 'データソース一覧',         subtitle: '厚労省・JILPT・統計調査の出典' },
  yearly:           { eyebrow: 'YEARLY',             title: '年次レポート',            subtitle: 'AI と日本の仕事 年次定点観測' },
  'yearly-2026':    { eyebrow: 'REPORT 2026',        title: '2026 年版 AI と仕事',     subtitle: '552 職業の全量分析' },
  'yearly-5year':   { eyebrow: '5 YEARS',            title: '5 年で変わった職業',      subtitle: '2021→2026 の変化追跡' },
  'yearly-next-decade': { eyebrow: 'NEXT 10 YEARS',  title: '今後 10 年の職業展望',    subtitle: '2030 年代の予測' },
  explore:          { eyebrow: 'EXPLORE · 7 入口',   title: '探す方法',                subtitle: '7 つの入口から職業を整理' },
};

/** N ranking detail card variants — built from the shared RANKING_META.
 *  Single source of truth lives in src/data/lib/rankings-meta.ts; adding
 *  a new ranking there auto-registers its OG card here. The drift test
 *  at src/data/lib/rankings-meta.test.ts asserts both sides stay aligned. */
export const RANKING_CARDS: Record<string, GenericCardConfig> = Object.fromEntries(
  RANKING_META.map((m) => [
    m.slug,
    { eyebrow: m.og_eyebrow, title: m.name_ja, subtitle: m.description_ja },
  ]),
);

/** 6 RIASEC interest type cards — built from INTEREST_META. */
export const INTEREST_CARDS: Record<string, GenericCardConfig> = Object.fromEntries(
  INTEREST_META.map((m) => [
    m.slug,
    {
      eyebrow: m.og_eyebrow,
      title: `${m.name_ja}タイプ (${m.letter})`,
      subtitle: m.typical_fields_ja.slice(0, 3).join(' · ') + ' などにフィット',
    },
  ]),
);

/** 10 skill detail card variants — built from SKILL_META. */
export const SKILL_CARDS: Record<string, GenericCardConfig> = Object.fromEntries(
  SKILL_META.map((m) => [
    m.slug,
    { eyebrow: m.og_eyebrow, title: m.short_ja, subtitle: m.title_ja },
  ]),
);

/** 12 compare detail card variants — built from COMPARE_META. */
export const COMPARE_CARDS: Record<string, GenericCardConfig> = Object.fromEntries(
  COMPARE_META.map((m) => [
    m.slug,
    { eyebrow: m.og_eyebrow, title: m.title_ja, subtitle: m.description_ja.slice(0, 80) + '…' },
  ]),
);
