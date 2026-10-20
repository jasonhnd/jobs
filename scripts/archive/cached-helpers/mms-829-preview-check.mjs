import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = 'https://pre.mirai-shigoto.com';
const OUT = '/tmp/mms-829';
mkdirSync(OUT, { recursive: true });

const report = { base: BASE, sha: 'ed42ae9e', items: {}, console: {}, failures: [] };

function fail(item, msg) {
  report.failures.push({ item, msg });
  console.error(`FAIL [${item}] ${msg}`);
}

async function goto(page, path, { width = 1440, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  const errors = [];
  const onErr = (msg) => {
    const t = msg.text();
    if (msg.type() === 'error') errors.push(t);
  };
  page.on('console', onErr);
  const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  page.off('console', onErr);
  const status = resp?.status() ?? 0;
  const key = `${path}@${width}`;
  report.console[key] = { status, errors };
  if (!resp || status >= 400) fail(path, `HTTP ${status}`);
  return { status, errors, html: await page.content(), text: await page.locator('body').innerText() };
}

async function shot(page, name) {
  const p = `${OUT}/${name}.png`;
  mkdirSync(dirname(p), { recursive: true });
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    ok: document.body.scrollWidth <= window.innerWidth,
  }));
}

function snippet(text, needle, radius = 180) {
  const i = text.indexOf(needle);
  if (i < 0) return null;
  const start = Math.max(0, i - 40);
  return text.slice(start, i + needle.length + radius).replace(/\s+/g, ' ').trim();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'ja-JP',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
await context.addInitScript(() => {
  try {
    localStorage.setItem('cookieConsent', 'accepted');
  } catch {}
});
const page = await context.newPage();

// 1 home
{
  const r = await goto(page, '/');
  const footer = 'AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 2026-09-09）';
  const ok = r.text.includes(footer);
  if (!ok) fail(1, 'footer line missing');
  report.items[1] = {
    ok,
    status: r.status,
    errors: r.errors,
    snippet: snippet(r.text, 'AI 影響度：複数のAIモデルによる総合') || r.text.slice(-400),
    shot: await shot(page, '01-home'),
  };
}

// 2 map + rankings
for (const path of ['/map', '/rankings']) {
  const r = await goto(page, path);
  const key = path.replace('/', '');
  const ok = r.status === 200 && r.errors.length === 0;
  if (!ok) fail(2, `${path} status=${r.status} errors=${r.errors.join(' | ')}`);
  report.items[`2-${key}`] = {
    ok,
    status: r.status,
    errors: r.errors,
    title: await page.title(),
    h1: await page.locator('h1').first().innerText().catch(() => ''),
    shot: await shot(page, `02-${key}`),
  };
}

// 3 /standard
{
  const expected =
    '本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、現在は3社のAIそれぞれの最新モデルによる採点の平均として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。';
  const r = await goto(page, '/standard');
  const ok = r.text.includes(expected);
  if (!ok) fail(3, 'CONSENSUS_STANDARD_FORMAL missing');
  report.items[3] = {
    ok,
    status: r.status,
    snippet: snippet(r.text, '本サイトの公開値は、各次元') || r.text.slice(0, 500),
    shot: await shot(page, '03-standard'),
  };
}

// 4 /methodology
{
  const r = await goto(page, '/methodology');
  const hasMean = /平均/.test(r.text);
  const faq = '現在は、3社のAIそれぞれの最新モデルによる採点の平均を公開値としています。';
  const fable =
    'これは現行の公開総合値の検証ではありません。';
  const ok = hasMean && r.text.includes(faq) && r.text.includes(fable) && r.text.includes('Claude Fable 5 batch');
  if (!ok) fail(4, `mean=${hasMean} faq=${r.text.includes(faq)} fableHist=${r.text.includes(fable)}`);
  report.items[4] = {
    ok,
    status: r.status,
    faqSnippet: snippet(r.text, faq),
    fableSnippet: snippet(r.text, 'Claude Fable 5 batch'),
    shot: await shot(page, '04-methodology'),
  };
}

// 5 /about /answers
{
  const faq = '現在は、3社のAIそれぞれの最新モデルによる採点の平均を公開値としています。';
  const answersVal = '公開値: 複数のAIによる総合（3社の最新モデルの平均）';
  const about = await goto(page, '/about');
  const answers = await goto(page, '/answers');
  const ok = about.text.includes(faq) && answers.text.includes(faq) && answers.text.includes(answersVal);
  if (!ok) fail(5, `about faq=${about.text.includes(faq)} answers faq=${answers.text.includes(faq)} answers hub=${answers.text.includes(answersVal)}`);
  report.items[5] = {
    ok,
    aboutSnippet: snippet(about.text, faq),
    answersSnippet: snippet(answers.text, answersVal) || snippet(answers.text, faq),
    shotAbout: await shot(page, '05-answers'),
  };
  await goto(page, '/about');
  report.items[5].shotAbout = await shot(page, '05-about');
}

// 6 /data
{
  const r = await goto(page, '/data');
  const heading = 'スコアの算出方法を変更し、採点を1件追加しました';
  const impact =
    '今回の変更では、全職業の平均は 4.73 から 4.67 になります。公開値が 0.5 以上変わる職業は 32、リスク帯が変わる職業は 33 です。公開値が 1.0 以上変わる職業は 1 です。';
  const lead = 'これからは、3社のAIそれぞれの最新モデルによる採点の平均を公開値とします。';
  const posHeading = r.text.indexOf(heading);
  const posFifth = r.text.indexOf('総合の票を1件増やしました');
  const onTop = posHeading >= 0 && (posFifth < 0 || posHeading < posFifth);
  const ok = r.text.includes(heading) && r.text.includes(impact) && r.text.includes(lead) && onTop;
  if (!ok) fail(6, `heading=${r.text.includes(heading)} impact=${r.text.includes(impact)} onTop=${onTop}`);
  report.items[6] = {
    ok,
    onTop,
    headingSnippet: snippet(r.text, heading),
    impactSnippet: snippet(r.text, '全職業の平均は 4.73'),
    shot: await shot(page, '06-data'),
  };
}

// 7 /models desktop
{
  const r = await goto(page, '/models', { width: 1440 });
  const need = [
    'Claude Fable 5.1',
    'Claude Opus 5',
    'Claude Fable 5',
    'Claude Opus 4.8',
    'Claude Opus 4.7',
    'GPT 5.6 SOL',
    'Grok 4.6',
    'スコアの算出方法を変更し、採点を1件追加しました',
    '全職業の平均は 4.73 から 4.67',
  ];
  const missing = need.filter((s) => !r.text.includes(s));
  // open Anthropic fold if present
  const fold = page.locator('details').filter({ hasText: '以前のモデル' }).first();
  if (await fold.count()) {
    await fold.locator('summary').click();
    await page.waitForTimeout(300);
  }
  const after = await page.locator('body').innerText();
  const foldMissing = ['Claude Opus 5', 'Claude Fable 5', 'Claude Opus 4.8', 'Claude Opus 4.7'].filter(
    (s) => !after.includes(s),
  );
  const ov = await overflow(page);
  const storyBars = await page.locator('.models-story, .story, [class*="story"]').count();
  const quotes = await page.locator('blockquote, .models-quote, [class*="quote"]').count();
  const ok = missing.length === 0 && foldMissing.length === 0 && ov.ok;
  if (!ok) fail(7, `missing=${missing} foldMissing=${foldMissing} overflow=${JSON.stringify(ov)}`);
  report.items[7] = {
    ok,
    missing,
    foldMissing,
    overflow: ov,
    storyBars,
    quotes,
    snippet: snippet(after, 'Claude Fable 5.1'),
    dataNote: snippet(after, 'スコアの算出方法を変更し、採点を1件追加しました'),
    shot: await shot(page, '07-models-1440'),
  };
  // mobile
  await goto(page, '/models', { width: 390, height: 844 });
  const foldM = page.locator('details').filter({ hasText: '以前のモデル' }).first();
  if (await foldM.count()) {
    await foldM.locator('summary').click();
    await page.waitForTimeout(200);
  }
  const ovM = await overflow(page);
  if (!ovM.ok) fail(7, `mobile overflow ${JSON.stringify(ovM)}`);
  report.items['7-mobile'] = { overflow: ovM, shot: await shot(page, '07-models-390') };
}

// 8 model run pages
{
  const pages = [
    {
      path: '/models/fable-5-1@2026-09-09',
      note: 'このモデルの採点は、現在の公開値（3社の最新モデルの平均）に含まれています。',
      vendor: '提供元 Anthropic',
    },
    {
      path: '/models/opus-5@2026-07-26',
      note: 'このモデルの採点は履歴として公開しています。現在の公開値には含まれていません。',
      vendor: '提供元 Anthropic',
    },
    {
      path: '/models/grok-4.6@2026-09-07',
      note: null,
      vendor: 'xAI',
    },
  ];
  const out = [];
  for (const spec of pages) {
    const r = await goto(page, spec.path);
    const hasNote = spec.note ? r.text.includes(spec.note) : true;
    const hasVendor = r.text.includes(spec.vendor);
    const ok = hasNote && hasVendor;
    if (!ok) fail(8, `${spec.path} note=${hasNote} vendor=${hasVendor}`);
    out.push({
      path: spec.path,
      ok,
      noteSnippet: spec.note ? snippet(r.text, spec.note.slice(0, 20)) : snippet(r.text, 'xAI'),
      vendorSnippet: snippet(r.text, spec.vendor),
      shot: await shot(page, `08-${spec.path.replace(/[/@.]/g, '_')}`),
    });
  }
  report.items[8] = { ok: out.every((x) => x.ok), pages: out };
}

// 9 occupation pages
{
  const jobs = [
    {
      id: 116,
      title: '美容師',
      band: 'low',
      shown: '2.7',
      arith: '2.3 + 2.4 + 3.4',
      fold: 'モデル別の採点を表示（7件）',
      obs: false,
    },
    {
      id: 111,
      title: '観光バスガイド',
      band: 'mid',
      shown: '4.4',
      arith: '4.5 + 4.2 + 4.5',
      fold: 'モデル別の採点を表示（7件）',
      obs: false,
    },
    {
      id: 430,
      title: '経理事務',
      band: 'high',
      shown: '8',
      arith: '7.5 + 8.7 + 7.9',
      fold: 'モデル別の採点を表示（7件）',
      obs: false,
    },
    {
      id: 317,
      title: 'ソフトウェア開発（スマホアプリ）',
      band: 'mid',
      shown: '6.7',
      arith: null,
      fold: 'モデル別の採点を表示（7件）',
      obs: true,
      obsLine: '最新のAIは、この仕事の変化をより小さく見ています（5.5）',
    },
    {
      id: 581,
      title: 'ブロックチェーン・エンジニア',
      band: 'mid',
      shown: '6.1',
      arith: null,
      fold: 'モデル別の採点を表示（6件）',
      obs: false,
    },
  ];
  const out = [];
  for (const job of jobs) {
    const r = await goto(page, `/${job.id}`, { width: 1440 });
    const details = page.locator('#score-history-details, details').filter({ hasText: 'モデル別の採点' }).first();
    if (await details.count()) {
      await details.locator('summary').click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const text = await page.locator('body').innerText();
    const current = '3社の最新モデルの平均 · 最新採点 2026年9月9日';
    const aging = 'この総合値には、採点日から6ヶ月を超えた採点が含まれています。';
    const hasFold = text.includes(job.fold);
    const hasCurrent = text.includes(current);
    const hasAging = text.includes(aging);
    const hasObs = text.includes('最新のAIは、この仕事の変化を');
    const obsOk = job.obs ? text.includes(job.obsLine) : !hasObs;
    const ov = await overflow(page);
    const ok = hasFold && hasCurrent && !hasAging && obsOk && ov.ok && text.includes(job.title);
    if (!ok)
      fail(
        9,
        `/${job.id} fold=${hasFold} current=${hasCurrent} aging=${hasAging} obsOk=${obsOk} overflow=${ov.ok}`,
      );
    out.push({
      id: job.id,
      title: job.title,
      band: job.band,
      ok,
      hasFold,
      hasCurrent,
      hasAging,
      hasObs,
      obsOk,
      overflow: ov,
      headline: snippet(text, job.shown) || snippet(text, '複数のAIによる総合'),
      foldSnippet: snippet(text, job.fold),
      currentSnippet: snippet(text, '3社の最新モデルの平均'),
      obsSnippet: job.obs ? snippet(text, '最新のAIは') : null,
      shot: await shot(page, `09-${job.id}-1440`),
    });
    await goto(page, `/${job.id}`, { width: 390, height: 844 });
    const ovM = await overflow(page);
    if (!ovM.ok) fail(9, `/${job.id} mobile overflow ${JSON.stringify(ovM)}`);
    out[out.length - 1].mobileOverflow = ovM;
    out[out.length - 1].shotMobile = await shot(page, `09-${job.id}-390`);
  }
  report.items[9] = { ok: out.every((x) => x.ok), jobs: out };
}

// 10 view-source 中央値 / 票
{
  const paths = [
    '/',
    '/data',
    '/models',
    '/models/fable-5-1@2026-09-09',
    '/models/opus-5@2026-07-26',
    '/standard',
    '/methodology',
    '/about',
    '/answers',
    '/116',
    '/111',
    '/430',
    '/llms.txt',
  ];
  const rows = [];
  for (const path of paths) {
    const html = await (await fetch(BASE + path)).text();
    const chuuin = [];
    const hyo = [];
    const lines = html.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('中央値')) chuuin.push({ n: i + 1, t: line.trim().slice(0, 240) });
      if (line.includes('票')) hyo.push({ n: i + 1, t: line.trim().slice(0, 240) });
    });
    rows.push({ path, chuuinCount: chuuin.length, hyoCount: hyo.length, chuuin, hyo });
  }
  report.items[10] = { rows };
}

// 12 llms.txt
{
  const r = await goto(page, '/llms.txt');
  const hasMean = r.text.includes('mean of the latest model from each of 3 vendors');
  const forbidden = ['claude-fable-5-1', 'gpt-5.6-sol', 'grok-4.6', 'Claude Fable', 'GPT 5.6', 'Grok 4.6'];
  const hits = forbidden.filter((s) => r.text.toLowerCase().includes(s.toLowerCase()));
  const ok = hasMean && hits.length === 0;
  if (!ok) fail(12, `hasMean=${hasMean} modelIds=${hits}`);
  report.items[12] = {
    ok,
    hasMean,
    modelIdHits: hits,
    snippet: snippet(r.text, 'mean of the latest model from each of 3 vendors') || r.text.slice(0, 600),
    shot: await shot(page, '12-llms'),
  };
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log('\n=== FAILURES', report.failures.length, '===');
console.log(JSON.stringify(report.failures, null, 2));
console.log('wrote', `${OUT}/report.json`);
