import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  formatShareHook,
  formatShareMetaDescription,
  formatShareMetaTitle,
  formatShareScore,
  formatShareText,
  hasMeasurementShare,
} from './worktype-share.js';

describe('worktype share (#237)', () => {
  test('identity-only when there is no occupation score', () => {
    const text = formatShareText({
      url: 'https://mirai-shigoto.com/shindan?self=CPB',
      variantName: 'ふれあい創造家',
      catchLine: '人のそばで形にします。',
    });
    assert.match(text, /私は【ふれあい創造家】/);
    assert.doesNotMatch(text, /AI影響度/);
    assert.equal(hasMeasurementShare(null, 7.2), false);
    assert.equal(hasMeasurementShare('教員', null), false);
  });

  test('measurement-led when job title and score are present', () => {
    const text = formatShareText({
      url: 'https://mirai-shigoto.com/me?id=133',
      variantName: 'ふれあい創造家',
      catchLine: '人のそばで形にします。',
      jobTitle: 'データサイエンティスト',
      score: 7.2,
    });
    assert.equal(
      text,
      '#AI働き方診断 データサイエンティストのAI影響度は7.2/10。あなたの仕事は？ https://mirai-shigoto.com/me?id=133',
    );
    assert.doesNotMatch(text, /ふれあい創造家/);
    assert.equal(formatShareScore(7.2), '7.2/10');
    assert.equal(hasMeasurementShare('データサイエンティスト', 7.2), true);
  });

  test('native share can omit the URL token', () => {
    const text = formatShareText({
      url: 'https://mirai-shigoto.com/me?id=1',
      variantName: 'x',
      catchLine: 'y',
      jobTitle: '教員',
      score: 4,
      includeUrl: false,
    });
    assert.equal(text, '#AI働き方診断 教員のAI影響度は4/10。あなたの仕事は？');
  });

  test('OG title and description follow the same hero', () => {
    assert.equal(
      formatShareMetaTitle({
        variantName: '段取りの世話役',
        familyName: '段取りの世話役',
        jobTitle: 'データ職業',
        score: 8.1,
      }),
      'データ職業のAI影響度は8.1/10｜AI働き方診断',
    );
    assert.match(
      formatShareMetaDescription({
        catchLine: '一言',
        jobTitle: 'データ職業',
        score: 8.1,
        gapLine: '自分 x 仕事のギャップ: 働き方を更新する余地があります。',
      }),
      /データ職業のAI影響度は8\.1\/10。あなたの仕事は？/,
    );
    assert.equal(
      formatShareHook({
        variantName: '段取りの世話役',
        catchLine: '現場を回します。',
        jobTitle: 'データ職業',
        score: 8.1,
      }),
      'データ職業のAI影響度は8.1/10。あなたの仕事は？',
    );
  });
});
