/**
 * _q-bindings.test.ts — #328 family 1 (Q&A list-first).
 *
 * Pins the answer-line switch (AI-risk vs condition groups) and the
 * §3.3 whole-row atom. Synthetic occupations only — no fs, no graph.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QA_ITEMS, selectExamples, type QAItem } from '@/views/qa-meta.js';
import { loadAllDetails, type DetailFileMin } from '@/views/genre-hub.js';
import { renderExampleList, renderQaAnswerLine } from './_q-bindings.js';

function makeQa(over: Partial<QAItem> & Pick<QAItem, 'slug' | 'og_eyebrow'>): QAItem {
  return {
    question: '質問？',
    short_answer: '直答',
    reasoning: '根拠',
    selector: () => 1,
    related_topics: [],
    ...over,
  };
}

function makeDoc(over: Partial<DetailFileMin> & { id: number; title_ja: string; ai?: number | null }): DetailFileMin {
  const { title_ja, ai, ...rest } = over;
  return {
    title: { ja: title_ja },
    ai_risk: { score: ai ?? null },
    sector: { id: 'jimu', ja: '事務・公務' },
    stats: { salary_man_yen: 400 },
    ...rest,
  };
}

describe('renderQaAnswerLine', () => {
  test('empty examples → empty string', () => {
    const qa = makeQa({ slug: 'ai-de-kieru', og_eyebrow: 'Q&A · AI で消える' });
    assert.equal(renderQaAnswerLine(qa, []), '');
  });

  test('AI-anxiety high-first uses 最も高いのは + row-1 name + mean', () => {
    const qa = makeQa({ slug: 'ai-de-kieru', og_eyebrow: 'Q&A · AI で消える' });
    const html = renderQaAnswerLine(qa, [
      makeDoc({ id: 1, title_ja: 'データ入力', ai: 9.4 }),
      makeDoc({ id: 2, title_ja: '一般事務', ai: 8.0 }),
    ]);
    assert.match(html, /<p class="qa-sum">/);
    assert.match(html, /AI で消えるの2職/);
    assert.match(html, /最も高いのは<strong>データ入力<\/strong>（9\.4\/10）/);
    assert.match(html, /2職の平均は8\.7\/10です/);
    assert.equal(html.includes('一般事務'), false);
  });

  test('AI-anxiety low-first uses 最も低いのは so the named job is row 1', () => {
    const qa = makeQa({ slug: 'ai-de-kienai', og_eyebrow: 'Q&A · AI で残る仕事' });
    const html = renderQaAnswerLine(qa, [
      makeDoc({ id: 1, title_ja: '看護師', ai: 2.1 }),
      makeDoc({ id: 2, title_ja: '介護福祉士', ai: 3.4 }),
    ]);
    assert.match(html, /最も低いのは<strong>看護師<\/strong>（2\.1\/10）/);
    assert.equal(html.includes('最も高いのは'), false);
  });

  test('AI-anxiety-extra group also uses the AI pattern', () => {
    const qa = makeQa({ slug: 'ai-hoshou-shoku', og_eyebrow: 'Q&A · AI 補佐' });
    const html = renderQaAnswerLine(qa, [
      makeDoc({ id: 1, title_ja: '営業', ai: 5 }),
      makeDoc({ id: 2, title_ja: '編集', ai: 5 }),
    ]);
    // equal scores → 先頭は (not 最も高い/低い)
    assert.match(html, /先頭は<strong>営業<\/strong>（5\/10）/);
    assert.match(html, /2職の平均は5\.0\/10です/);
  });

  test('sector-future uses に当てはまる + 先頭は, not AI 最も高い', () => {
    const qa = makeQa({ slug: 'jimu-mirai', og_eyebrow: 'Q&A · 事務系' });
    const html = renderQaAnswerLine(qa, [
      makeDoc({ id: 1, title_ja: 'データ入力', ai: 9.4 }),
      makeDoc({ id: 2, title_ja: '一般事務', ai: 8.0 }),
    ]);
    assert.match(html, /事務系に当てはまる2職。先頭は<strong>データ入力<\/strong>です。/);
    assert.equal(html.includes('最も高いのは'), false);
    assert.equal(html.includes('/10'), false);
  });

  test('life / aptitude / career groups name row 1 via 先頭は', () => {
    const cases: Array<{ slug: string; eyebrow: string; stem: string }> = [
      { slug: 'ikuji-ryouritsu', eyebrow: 'Q&A · 育児両立', stem: '育児両立' },
      { slug: 'bunkei-osusume', eyebrow: 'Q&A · 文系', stem: '文系' },
      { slug: 'shinso-osusume', eyebrow: 'Q&A · 新卒', stem: '新卒' },
      { slug: 'naiko-osusume', eyebrow: 'Q&A · 内向型', stem: '内向型' },
      { slug: 'tsuukin-friendly', eyebrow: 'Q&A · 通勤', stem: '通勤' },
      { slug: 'nenshu-up', eyebrow: 'Q&A · 年収アップ', stem: '年収アップ' },
    ];
    for (const c of cases) {
      const html = renderQaAnswerLine(
        makeQa({ slug: c.slug, og_eyebrow: c.eyebrow }),
        [makeDoc({ id: 7, title_ja: '保育士', ai: 3 })],
      );
      assert.match(html, new RegExp(`${c.stem}に当てはまる1職。先頭は<strong>保育士<\\/strong>です。`));
    }
  });

  test('live catalog: answer line names row 1 on one slug per thematic group', () => {
    const details = loadAllDetails();
    const checked: Record<string, string> = {
      'ai-anxiety': 'ai-de-kieru',
      'sector-future': 'jimu-mirai',
      'career': 'shinso-osusume',
      'life': 'ikuji-ryouritsu',
      'aptitude': 'bunkei-osusume',
      'aptitude-extra': 'naiko-osusume',
      'life-extra': 'tsuukin-friendly',
      'ai-anxiety-extra': 'ai-hoshou-shoku',
      'career-extra': 'nenshu-up',
    };
    for (const [group, slug] of Object.entries(checked)) {
      const qa = QA_ITEMS.find((q) => q.slug === slug);
      assert.ok(qa, `${slug} missing from catalog`);
      const examples = selectExamples(details, qa!, 10);
      assert.ok(examples.length > 0, `${slug} (${group}) has no examples`);
      const html = renderQaAnswerLine(qa!, examples);
      const name = examples[0]!.title?.ja ?? '';
      assert.ok(name.length > 0, `${slug}: row 1 has no title`);
      assert.ok(html.includes(name), `${slug} (${group}): answer missing row-1 「${name}」: ${html}`);
    }
  });

  test('escapes occupation names in the answer line', () => {
    const qa = makeQa({ slug: 'ikuji-ryouritsu', og_eyebrow: 'Q&A · 育児両立' });
    const html = renderQaAnswerLine(qa, [
      makeDoc({ id: 1, title_ja: '<script>x</script>', ai: 2 }),
    ]);
    assert.equal(html.includes('<script>'), false);
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  });
});

describe('renderExampleList', () => {
  test('empty → 該当例なし', () => {
    assert.equal(renderExampleList([]), '<p>該当例なし</p>');
  });

  test('§3.3 whole-row tap + list_row_click + pill + chevron', () => {
    const got = renderExampleList([
      makeDoc({ id: 7, title_ja: '看護師', ai: 3 }),
    ]);
    assert.equal(got.startsWith('<ol class="rank-list">'), true);
    assert.match(got, /<a class="rl-row" href="\/7" data-track-event="list_row_click">/);
    assert.match(got, /<span class="rl-name">看護師<\/span>/);
    assert.match(got, /<span class="rl-meta">事務・公務 · <span class="rl-salary">400万円<\/span><\/span>/);
    assert.match(got, /<span class="risk-pill low">3\/10<\/span>/);
    assert.match(got, /<span class="rl-chevron" aria-hidden="true">›<\/span>/);
    assert.equal([...got.matchAll(/<a /g)].length, 1);
    assert.equal(got.includes('class="rl-name" href='), false);
  });

  test('escapes title and sector', () => {
    const got = renderExampleList([
      makeDoc({
        id: 1,
        title_ja: '<b>x</b>',
        ai: 8,
        sector: { id: 'it', ja: 'A & B' },
        stats: { salary_man_yen: null },
      }),
    ]);
    assert.equal(got.includes('<b>'), false);
    assert.match(got, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(got, /A &amp; B/);
    assert.match(got, /<span class="risk-pill high">8\/10<\/span>/);
  });

  test('null AI score renders em-dash pill in mid band', () => {
    const got = renderExampleList([
      makeDoc({ id: 1, title_ja: 'X', ai: null, stats: { salary_man_yen: null }, sector: { id: 'it', ja: '' } }),
    ]);
    assert.match(got, /<span class="risk-pill mid">—<\/span>/);
  });
});
