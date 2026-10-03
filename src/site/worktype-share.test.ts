import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  formatShareMetaDescription,
  formatShareMetaTitle,
} from './worktype-share.js';

describe('worktype share (#237)', () => {
  test('identity-only when there is no occupation score', () => {
    assert.equal(
      formatShareMetaTitle({
        variantName: 'ふれあい創造家',
        familyName: 'ふれあい',
      }),
      'ふれあい創造家｜ふれあい - AI働き方診断',
    );
    assert.equal(
      formatShareMetaDescription({ catchLine: '人のそばで形にします。' }),
      '人のそばで形にします。',
    );
    assert.equal(
      formatShareMetaTitle({
        variantName: 'ふれあい創造家',
        familyName: 'ふれあい',
        jobTitle: null,
        score: 7.2,
      }).includes('AI影響度'),
      false,
    );
    assert.equal(
      formatShareMetaTitle({
        variantName: 'ふれあい創造家',
        familyName: 'ふれあい',
        jobTitle: '教員',
        score: null,
      }).includes('AI影響度'),
      false,
    );
  });

  test('measurement-led when job title and score are present', () => {
    assert.equal(
      formatShareMetaTitle({
        variantName: 'ふれあい創造家',
        familyName: 'ふれあい',
        jobTitle: 'データサイエンティスト',
        score: 7.2,
      }),
      'データサイエンティストのAI影響度は7.2/10｜AI働き方診断',
    );
    assert.equal(
      formatShareMetaDescription({
        catchLine: '人のそばで形にします。',
        jobTitle: 'データサイエンティスト',
        score: 7.2,
      }).includes('ふれあい創造家'),
      false,
    );
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
  });
});
