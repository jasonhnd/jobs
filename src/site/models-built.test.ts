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

function visibleHtml(html: string): string {
  return html
    .replace(/<template id="models-projection"[\s\S]*?<\/template>/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
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
  });
});
