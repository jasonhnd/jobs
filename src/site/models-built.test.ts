import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';
import { SCORE_PANEL } from './score-attribution.js';
import {
  activeOccupationRuns,
  comparableAioisRuns,
  latestOccupationRun,
  latestRunPerVendor,
  listOccupationRuns,
} from './occupation-runs.js';
import { formatJapaneseDate } from '../views/models.js';
import {
  CONSENSUS_FLAGSHIP_SWITCH_NOTE_LEAD,
  CONSENSUS_VENDOR_UPDATE_NOTE_LEAD,
  MODELS_HUB_VENDORS_HEADING,
  MODELS_RUN_HISTORY_NOTE,
  MODELS_RUN_IN_PANEL_NOTE,
} from './consensus-copy.js';
import { isWhitelistedVendor } from './score-attribution.js';

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

function assertModelsSurfaceBodyReset(html: string): void {
  assert.match(html, /<body class="models-surface(?: page-feature)?">/);
  assert.match(styleCss(html), /html body\.models-surface\{[^}]*\bmargin:0\b/);
}

/**
 * Design.md §4.4 draws the typeface boundary between H2 and H3: serif covers
 * Display / H1 / H2, and H3 / H4 are sans 700 because the shipped serif has a
 * single weight and cannot carry contrast below 22px (§4.5).
 *
 * This guard therefore checks h1/h2 only. It used to include h3, which pinned
 * the pre-v1.0 state — the canonical rule that design-1.3 (#526) had to change
 * is `html body h3, html body h4 { font-family: var(--font-sans) }`, and the
 * old assertion made the canon unimplementable. Per §20.6 the implementation
 * is the bug when it disagrees with the canon, so the assertion moved to the
 * canon's boundary instead of holding the canon back.
 */
function assertSerifHeadingsStaySerif(html: string): void {
  const css = styleCss(html);
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selectors = rule[1] ?? '';
    const declarations = rule[2] ?? '';
    if (!/font-family\s*:\s*var\(--font-sans\)/.test(declarations)) continue;
    assert.equal(
      /(?:^|,)[^{},]*\bh[12]\b/.test(selectors),
      false,
      `serif heading selector must not switch to sans: ${selectors.trim()}`,
    );
  }
}

/**
 * Design.md §19.2 — this replaces assertHeroSizeBeatsCanonical(), which
 * asserted that a page override BEAT canonical. That was a regression test
 * protecting the drift: it made the canon unimplementable by contract, and it
 * is exactly the kind of invariant §19.2 says to rewrite rather than keep.
 *
 * The contract now is conformance: /models is Feature class (§4.8), so its
 * title comes from body.page-feature h1 in canonical-css.ts, and the page
 * itself declares no heading size, typeface, weight or !important at all.
 */
function assertNoPageHeadingOverrides(html: string): void {
  const css = styleCss(html);

  assert.doesNotMatch(
    css,
    /font-size:[^;}]*!important/,
    'no !important on font-size may survive on a Feature page (§4.9)',
  );

  // canonical-css.ts legitimately sizes html body h1/h2/h3 and
  // body.page-feature h1 — those are the canon. What must not exist is a
  // CLASS-scoped page rule sizing a heading, which is what the specificity
  // war was made of. Comments are stripped first so a /* … */ block cannot be
  // mistaken for a selector.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of bare.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selectors = (rule[1] ?? '').trim();
    const declarations = rule[2] ?? '';
    if (!/\bh[1-6]\b/.test(selectors)) continue;
    if (!selectors.includes('.')) continue;
    if (/^html body\.page-feature h1$/.test(selectors)) continue;
    assert.doesNotMatch(
      declarations,
      /font-size:/,
      `page CSS must not size a heading — canonical owns it (§4.9): ${selectors}`,
    );
  }

  assert.doesNotMatch(
    css,
    /body\.models-surface[^{]*h[1-6]/,
    'the models-surface heading overrides are gone (design-1.9)',
  );
}

function assertFeatureClass(html: string): void {
  assert.match(
    html,
    /<body class="[^"]*\bpage-feature\b/,
    'Feature class is carried by BaseLayout bodyClass, not by page CSS (§4.8)',
  );
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
    assert.match(
      visible,
      new RegExp(`<h2 id="models-vendors">${escapeRegExp(MODELS_HUB_VENDORS_HEADING)}</h2>`),
    );
    const runs = listOccupationRuns();
    const coverages = runs.map((run) => run.coveredCount);
    const coverageMin = Math.min(...coverages);
    const coverageMax = Math.max(...coverages);
    const coverageText = coverageMin === coverageMax
      ? `${coverageMax}職業`
      : `${coverageMin}〜${coverageMax}職業`;
    const historyLaneCount = [...runs.reduce((counts, run) => {
      if (!isWhitelistedVendor(run.provider)) return counts;
      counts.set(run.provider, (counts.get(run.provider) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).values()].filter((count) => count > 1).length;
    assert.match(visible, /現行の総合/);
    assert.match(visible, /複数のAIによる総合/);
    assert.match(visible, /AI 影響度の算出方法を変更しました/);
    assert.match(visible, new RegExp(escapeRegExp(CONSENSUS_VENDOR_UPDATE_NOTE_LEAD.slice(0, 12))));
    assert.match(visible, new RegExp(escapeRegExp(CONSENSUS_FLAGSHIP_SWITCH_NOTE_LEAD.slice(0, 12))));
    assert.match(visible, /全職業の平均は 5\.23 から 4\.68/);
    assert.match(visible, /全職業の平均は 4\.68 から 4\.73/);
    assert.match(visible, new RegExp(`${SCORE_PANEL.vendorCount}社`));
    assert.match(visible, /Anthropic/);
    assert.match(visible, /OpenAI/);
    assert.match(visible, /xAI/);
    assert.equal(/現行モデル/.test(visible), false);
    assert.equal(/roster-link/.test(html), false);
    for (const run of runs) {
      assert.match(visible, new RegExp(escapeRegExp(run.modelDisplay)));
    }
    assert.match(visible, new RegExp(`各回の対象は${coverageText}`));
    assert.equal(/2026-09-10 \/ 2026-09-10/.test(visible), false);
    assert.match(html, /<details class="data-note-history">/);
    assert.match(visible, /これまでの変更/);
    assert.match(visible, /3社のAIそれぞれの最新モデルによる採点を平均しています/);
    assert.match(visible, /3社の最新モデルが共通する \d+ 職業を比べると/);
    assert.equal(
      new RegExp(`556職業を、${runs.length}つのAIモデルがそれぞれ採点`).test(visible),
      false,
    );
    assert.match(
      html,
      new RegExp(`3社のAIそれぞれの最新モデルによる採点を平均した、各回${coverageText}の結果から`),
    );
    assert.equal(
      (html.match(/<details class="vendor-history">/g) ?? []).length,
      historyLaneCount,
    );
    const storyCards = html.match(/<article class="story-card">/g) ?? [];
    assert.equal(
      (html.match(/<div class="score-row">/g) ?? []).length,
      storyCards.length * SCORE_PANEL.vendorCount,
    );
    assert.equal(
      (html.match(/<figure class="quote-block">/g) ?? []).length,
      storyCards.length * SCORE_PANEL.vendorCount,
    );
  });

  test('keeps serif headings at the magazine title size', () => {
    if (htmlPath == null) return;
    const html = readFileSync(htmlPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertSerifHeadingsStaySerif(html);
    assertNoPageHeadingOverrides(html);
    assertFeatureClass(html);
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
    assert.match(latest, new RegExp(escapeRegExp(MODELS_RUN_IN_PANEL_NOTE)));
    assert.equal(new RegExp(`プロンプト|AIOIS-10-v1\\.0-${escapeRegExp(latestRun.model)}`).test(latest), false);

    const panel = latestRunPerVendor();
    const xai = panel.find((run) => run.provider === 'xai');
    if (xai != null) {
      const grokPath = builtModelDetailPath(xai.slug);
      if (grokPath != null) {
        const grok = visibleHtml(readFileSync(grokPath, 'utf-8'));
        assert.match(grok, /提供元<\/dt><dd>xAI</);
        assert.match(grok, new RegExp(escapeRegExp(MODELS_RUN_IN_PANEL_NOTE)));
      }
    }
    const historyRun = comparableAioisRuns().find(
      (run) => isWhitelistedVendor(run.provider) && !panel.some((entry) => entry.slug === run.slug),
    );
    if (historyRun != null) {
      const historyPath = builtModelDetailPath(historyRun.slug);
      if (historyPath != null) {
        const history = visibleHtml(readFileSync(historyPath, 'utf-8'));
        assert.match(history, new RegExp(escapeRegExp(MODELS_RUN_HISTORY_NOTE)));
        assert.equal(history.includes(MODELS_RUN_IN_PANEL_NOTE), false);
      }
    }
  });

  test('renders the AIOIS predecessor sequence without a synthetic legacy comparison', () => {
    const runs = listOccupationRuns();
    const aiois = comparableAioisRuns(activeOccupationRuns(runs));
    const legacyRuns = runs.filter((run) => !run.hasAiois);
    if (legacyRuns.length === 0 || aiois.length < 2) return;

    for (const legacyRun of legacyRuns) {
      const path = builtModelDetailPath(legacyRun.slug);
      if (path == null) return;
      const legacy = visibleHtml(readFileSync(path, 'utf-8'));
      assert.match(legacy, /AIOIS-10 導入前の旧方式スコア/);
      assert.match(legacy, /D1〜D10 や置換指数を補完せず/);
      assert.equal(legacy.includes(MODELS_RUN_IN_PANEL_NOTE), false);
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
      assert.equal(
        page.includes(MODELS_RUN_IN_PANEL_NOTE) || page.includes(MODELS_RUN_HISTORY_NOTE),
        true,
      );
    }
  });

  test('no built page today contains the backfill signed string (mms-9)', () => {
    if (listOccupationRuns().some((run) => run.backfill)) return;
    const marker = '公開後に日をあけて補完した採点です';
    const hub = builtModelsPath();
    if (hub == null) return;
    assert.equal(readFileSync(hub, 'utf-8').includes(marker), false);
    for (const run of listOccupationRuns()) {
      const path = builtModelDetailPath(run.slug);
      if (path == null) return;
      assert.equal(readFileSync(path, 'utf-8').includes(marker), false, run.slug);
    }
  });

  test('keeps model-detail serif headings at the magazine title size', () => {
    const detailPath = builtModelDetailPath((comparableAioisRuns()[0] ?? latestOccupationRun()).slug);
    if (detailPath == null) return;
    const html = readFileSync(detailPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertSerifHeadingsStaySerif(html);
    assertNoPageHeadingOverrides(html);
  });
});
