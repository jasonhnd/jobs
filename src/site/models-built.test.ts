import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';
import { SCORE_PANEL } from './score-attribution.js';
import {
  comparableAioisRuns,
  latestOccupationRun,
  listOccupationRuns,
} from './occupation-runs.js';
import { formatJapaneseDate } from '../views/models.js';
import { MODELS_RUN_VOTE_NOTE } from './consensus-copy.js';

function builtModelsPath(): string | null {
  const candidates = [
    join(process.cwd(), 'dist-astro', 'models', 'index.html'),
    join(process.cwd(), 'dist-astro', 'models.html'),
  ];
  return requireBuiltArtifact(
    candidates.find((candidate) => existsSync(candidate)) ?? null,
    'dist-astro/models/index.html',
  );
}

function builtModelDetailPath(slug: string): string | null {
  const candidates = [
    join(process.cwd(), 'dist-astro', 'models', slug, 'index.html'),
    join(process.cwd(), 'dist-astro', 'models', `${slug}.html`),
  ];
  return requireBuiltArtifact(
    candidates.find((candidate) => existsSync(candidate)) ?? null,
    `dist-astro/models/${slug}/index.html`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function visibleHtml(html: string): string {
  return html
    .replace(/<template id="models-projection"[\s\S]*?<\/template>/, '')
    .replace(/<template id="model-page-payload"[\s\S]*?<\/template>/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
}

function styleCss(html: string): string {
  return Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g), (match) => match[1] ?? '').join('\n');
}

function specificity(selector: string): [number, number, number] {
  const idCount = (selector.match(/#[\w-]+/g) ?? []).length;
  const classLikeCount = (selector.match(/(?:\.[\w-]+|\[[^\]]+\]|:[\w-]+)/g) ?? []).length;
  const withoutPseudoArgs = selector.replace(/:(?:not|is|where|has)\([^)]*\)/g, '');
  const typeCount = (withoutPseudoArgs.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) ?? []).length;
  return [idCount, classLikeCount, typeCount];
}

function compareSpecificity(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}

function matchingSelectors(css: string, heading: 'h1' | 'h2' | 'h3'): string[] {
  const selectors: string[] = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selectorList = rule[1] ?? '';
    const declarations = rule[2] ?? '';
    if (!/font-family\s*:\s*var\(--font-sans\)/.test(declarations)) continue;
    if (/font-family\s*:\s*var\(--font-sans\)\s*!important/.test(declarations)) continue;
    for (const selector of selectorList.split(',')) {
      const trimmed = selector.trim();
      if (new RegExp(`(?:^|[\\s>+~])${heading}(?:$|[\\s.#:[>+~])`).test(trimmed)) {
        selectors.push(trimmed);
      }
    }
  }
  return selectors;
}

function assertHeadingSansRuleBeatsCanonical(css: string, scope: string): void {
  const canonical = specificity('html body h1');
  for (const heading of ['h1', 'h2', 'h3'] as const) {
    const selectors = matchingSelectors(css, heading).filter((selector) => selector.includes(scope));
    assert.ok(
      selectors.some((selector) => compareSpecificity(specificity(selector), canonical) > 0),
      `missing scoped ${heading} font-family rule stronger than canonical html body ${heading}`,
    );
  }
}

function assertModelsSurfaceBodyReset(html: string): void {
  assert.match(html, /<body class="models-surface">/);
  assert.match(styleCss(html), /html body\.models-surface\{[^}]*\bmargin:0\b/);
}

describe('/models built page contract', () => {
  const htmlPath = builtModelsPath();

  test('renders without client fetch, raw tables, or visible drift internals', () => {
    if (htmlPath == null) return;
    const html = readFileSync(htmlPath, 'utf-8');
    const visible = visibleHtml(html);

    assert.match(html, /<template id="models-projection">/);
    // Global #327 overlay fetches /data.search.json; models itself stays static.
    assert.equal(/fetch\s*\([^)]*models/.test(html), false);
    assert.equal(/data\.models_deep\.json/.test(html), false);
    assert.equal(/<table\b/i.test(visible), false);
    assert.equal(/\bD(?:[1-9]|10)\b|D1[〜-]D10|drift/i.test(visible), false);
    assert.equal(/バッチ間|方法論メモ|ヒストグラム|散布図/.test(visible), false);
    assert.match(visible, /<h1>AIモデル比較<\/h1>/);
    assert.match(visible, /<h2 id="models-roster">これまでのモデル<\/h2>/);
    const runs = listOccupationRuns();
    const coverages = runs.map((run) => run.coveredCount);
    const coverageMin = Math.min(...coverages);
    const coverageMax = Math.max(...coverages);
    const coverageText = coverageMin === coverageMax
      ? `${coverageMax}職業`
      : `${coverageMin}〜${coverageMax}職業`;
    assert.match(visible, /いまの総合/);
    assert.match(visible, /複数のAIによる総合/);
    assert.match(visible, /AI 影響度の出し方を変えました/);
    assert.match(visible, /全職業の平均が 5\.23 から 4\.68/);
    assert.match(visible, new RegExp(`${SCORE_PANEL.voteCount}票`));
    assert.equal(/現行モデル/.test(visible), false);
    for (const run of runs) {
      assert.match(visible, new RegExp(escapeRegExp(run.modelDisplay)));
    }
    assert.match(visible, new RegExp(`各回の対象は${coverageText}`));
    assert.match(visible, /共通する 556 職業を比べ/);
    assert.equal(
      new RegExp(`556職業を、${runs.length}つのAIモデルがそれぞれ採点`).test(visible),
      false,
    );
    assert.match(
      html,
      new RegExp(`${SCORE_PANEL.voteCount}つのAIモデルによる採点を総合した、各回${coverageText}の結果から`),
    );
  });

  test('emits scoped heading typography that beats the canonical serif heading rule', () => {
    if (htmlPath == null) return;
    const html = readFileSync(htmlPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertHeadingSansRuleBeatsCanonical(styleCss(html), '.models-feature');
  });

  test('renders model detail public metadata without raw ids', () => {
    const sample = comparableAioisRuns()[1] ?? comparableAioisRuns()[0]!;
    const detailPath = builtModelDetailPath(sample.slug);
    if (detailPath == null) return;
    const html = readFileSync(detailPath, 'utf-8');
    const visible = visibleHtml(html);
    const display = escapeRegExp(sample.modelDisplay);

    assert.match(visible, new RegExp(`<h1>${display} の職業スコア</h1>`));
    assert.match(visible, /<dt>評価基準<\/dt><dd>AIOIS-10 v1\.0<\/dd>/);
    assert.match(visible, new RegExp(escapeRegExp(formatJapaneseDate(sample.runDate))));
    assert.equal(new RegExp(`プロンプト|AIOIS-10-v1\\.0-${escapeRegExp(sample.model)}`).test(visible), false);

    const latestRun = latestOccupationRun();
    const latestPath = builtModelDetailPath(latestRun.slug);
    if (latestPath == null) return;
    const latest = visibleHtml(readFileSync(latestPath, 'utf-8'));
    const latestDisplay = escapeRegExp(latestRun.modelDisplay);
    assert.match(latest, new RegExp(`<h1>${latestDisplay} の職業スコア</h1>`));
    assert.match(latest, new RegExp(escapeRegExp(formatJapaneseDate(latestRun.runDate))));
    assert.match(latest, new RegExp(escapeRegExp(MODELS_RUN_VOTE_NOTE)));
    assert.equal(new RegExp(`プロンプト|AIOIS-10-v1\\.0-${escapeRegExp(latestRun.model)}`).test(latest), false);
  });

  test('renders the AIOIS predecessor sequence without a synthetic legacy comparison', () => {
    const runs = listOccupationRuns();
    const aiois = comparableAioisRuns(runs);
    const legacyRuns = runs.filter((run) => !run.hasAiois);
    if (legacyRuns.length === 0 || aiois.length < 2) return;

    for (const legacyRun of legacyRuns) {
      const path = builtModelDetailPath(legacyRun.slug);
      if (path == null) return;
      const legacy = visibleHtml(readFileSync(path, 'utf-8'));
      assert.match(legacy, /AIOIS-10 導入前の旧方式スコア/);
      assert.match(legacy, /D1〜D10 や置換指数を補完せず/);
      assert.equal(legacy.includes(MODELS_RUN_VOTE_NOTE), false);
    }

    const firstPath = builtModelDetailPath(aiois[0]!.slug);
    if (firstPath == null) return;
    const firstAiois = visibleHtml(readFileSync(firstPath, 'utf-8'));
    assert.match(firstAiois, /AIOIS-10 系列で最初の採点/);
    assert.match(firstAiois, /比較可能な前回モデルがない/);

    for (let i = 1; i < aiois.length; i += 1) {
      const path = builtModelDetailPath(aiois[i]!.slug);
      if (path == null) return;
      const page = visibleHtml(readFileSync(path, 'utf-8'));
      const predecessor = aiois[i - 1]!;
      const predDisplay = escapeRegExp(predecessor.modelDisplay);
      const predDate = escapeRegExp(formatJapaneseDate(predecessor.runDate));
      assert.match(page, new RegExp(`${predDisplay}（${predDate}）と比べて`));
      assert.match(page, /共通して比較できた職業は \d+ 件/);
      assert.match(page, new RegExp(escapeRegExp(MODELS_RUN_VOTE_NOTE)));
    }
  });

  test('emits scoped model detail heading typography that beats the canonical serif heading rule', () => {
    const detailPath = builtModelDetailPath((comparableAioisRuns()[0] ?? latestOccupationRun()).slug);
    if (detailPath == null) return;
    const html = readFileSync(detailPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertHeadingSansRuleBeatsCanonical(styleCss(html), '#wrapper');
  });
});
