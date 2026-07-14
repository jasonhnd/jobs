import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

function builtModelsPath(): string | null {
  const candidates = [
    join(process.cwd(), 'dist-astro', 'models', 'index.html'),
    join(process.cwd(), 'dist-astro', 'models.html'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function builtModelDetailPath(slug: string): string | null {
  const candidates = [
    join(process.cwd(), 'dist-astro', 'models', slug, 'index.html'),
    join(process.cwd(), 'dist-astro', 'models', `${slug}.html`),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
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
    assert.equal(/fetch\s*\(/.test(html), false);
    assert.equal(/data\.models_deep\.json/.test(html), false);
    assert.equal(/<table\b/i.test(visible), false);
    assert.equal(/\bD(?:[1-9]|10)\b|D1[〜-]D10|drift/i.test(visible), false);
    assert.equal(/バッチ間|方法論メモ|ヒストグラム|散布図/.test(visible), false);
    assert.match(visible, /<h1>AIモデル比較<\/h1>/);
    assert.match(visible, /<h2 id="models-roster">これまでのモデル<\/h2>/);
    assert.match(visible, /Claude Opus 4\.7/);
    assert.match(visible, /Claude Opus 4\.8/);
    assert.match(visible, /Claude Fable 5/);
    assert.match(visible, /GPT 5\.6 SOL/);
  });

  test('emits scoped heading typography that beats the canonical serif heading rule', () => {
    if (htmlPath == null) return;
    const html = readFileSync(htmlPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertHeadingSansRuleBeatsCanonical(styleCss(html), '.models-feature');
  });

  test('renders model detail public metadata without raw ids', () => {
    const detailPath = builtModelDetailPath('gpt-5.6-sol');
    if (detailPath == null) return;
    const html = readFileSync(detailPath, 'utf-8');
    const visible = visibleHtml(html);

    assert.match(visible, /<h1>GPT 5\.6 SOL の職業スコア<\/h1>/);
    assert.match(visible, /<dt>提供元<\/dt><dd>OpenAI<\/dd>/);
    assert.match(visible, /<dt>評価基準<\/dt><dd>AIOIS-10 v1\.0<\/dd>/);
    assert.match(visible, /2026年7月12日/);
    assert.equal(/プロンプト|AIOIS-10-v1\.0-gpt-5\.6-sol/.test(visible), false);
  });

  test('emits scoped model detail heading typography that beats the canonical serif heading rule', () => {
    const detailPath = builtModelDetailPath('gpt-5.6-sol');
    if (detailPath == null) return;
    const html = readFileSync(detailPath, 'utf-8');

    assertModelsSurfaceBodyReset(html);
    assertHeadingSansRuleBeatsCanonical(styleCss(html), '#wrapper');
  });
});
