import { expect, test } from '@playwright/test';
import { loadGeoFacts } from '../../src/page-data/geo-facts-loader';
import { SCORE_ATTRIBUTION, SCORE_PANEL } from '../../src/site/score-attribution';
import { CONSENSUS_HEADLINE_LABEL } from '../../src/site/consensus-copy';

for (const [path, href, pro] of [
  ['/1', '/pro/1#chp-source', false],
  ['/pro/1', '#chp-source', true],
  ['/occupations/404', '/pro/404#chp-source', false],
  ['/pro/404', '#chp-source', true],
] as const) {
  test(`${path} cites its displayed score and source`, async ({ page }) => {
    await page.goto(path);
    const citation = page.locator('[data-score-citation]');
    const name = (await page.locator('h1').textContent())!.trim();
    const score = (await page.locator(pro ? '.v-num.main .score-num' : '.summary-number').textContent())!.replace('/10', '').trim();
    await expect(citation).toBeVisible();
    await expect(citation).toHaveText(`${name}のAI影響度は${score}/10（${SCORE_ATTRIBUTION.standardLabel}・${CONSENSUS_HEADLINE_LABEL}、対象${loadGeoFacts().occupationCount}職業、最新採点 ${SCORE_PANEL.latestRunDate}）です。本サイトの独自分析（非公式）で、失業の確率ではありません。職業情報の出典：厚生労働省 jobtag。 出典と数字`);
    const link = citation.locator('a');
    await expect(link).toHaveAttribute('href', href);
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    if (pro) {
      await expect(page.locator('.risk-card + [data-score-citation]')).toHaveCount(1);
      await expect(page.locator('[data-score-citation] + .me-cta-strip')).toHaveCount(1);
      await expect(page.locator('#chp-source')).toBeAttached();
    } else {
      await expect(page.locator('.summary-score + [data-score-citation] + .summary-conclusion')).toHaveCount(1);
    }
  });
}
