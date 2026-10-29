/**
 * Pins Pro ranking titles and H1s for signed legacy batch 2 R1/R2 (#1003).
 * Slugs stay the same. R3 wording on other lines stays.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const SIGNED: ReadonlyArray<readonly [file: string, title: string, h1: string]> = [
  [
    'education.ts',
    "title: '無資格で就ける × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `無資格で就ける × AI影響が少ない TOP${noLicenseRequired.length}`',
  ],
  [
    'employment.ts',
    "title: 'AI影響が少ない × 正規雇用率高の職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `AI影響が少ない × 正規雇用率高 TOP${aiStableEmployment.length}`',
  ],
  [
    'high-risk.ts',
    "title: 'AIで大きく変わる仕事ランキング TOP30【2026年版】| 未来の仕事'",
    'h1Text: `AIで大きく変わる仕事 TOP${TOP_N}`',
  ],
  [
    'intent.ts',
    "title: '高需要 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `高需要 × AI影響が少ない TOP${aiSafeHighDemand.length}`',
  ],
  [
    'intent.ts',
    "title: '低労働時間 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `低労働時間 × AI影響が少ない TOP${TOP_N}`',
  ],
  [
    'intent.ts',
    "title: '若手中心 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `若手中心 × AI影響が少ない TOP${TOP_N}`',
  ],
  [
    'intent.ts',
    "title: '無資格 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `無資格 × AI影響が少ない TOP${aiSafeNoLicense.length}`',
  ],
  [
    'intent.ts',
    "title: '身体性 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `身体性 × AI影響が少ない TOP${aiSafePhysical.length}`',
  ],
  [
    'intent.ts',
    "title: '対人 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `対人 × AI影響が少ない TOP${aiSafeInterpersonal.length}`',
  ],
  [
    'workforce.ts',
    "title: '大規模就業 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事'",
    'h1Text: `大規模就業 × AI影響が少ない TOP${largeWorkforceStable.length}`',
  ],
];

const RETIRED = [
  'AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事',
  'AIに奪われる仕事 TOP${TOP_N}',
  '無資格で就ける × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '無資格で就ける × AI 安全 TOP${noLicenseRequired.length}',
  'AI 安全 × 正規雇用率高の職業 TOP30【2026年版】| 未来の仕事',
  'AI 安全 × 正規雇用率高 TOP${aiStableEmployment.length}',
  '高需要 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '高需要 × AI 安全 TOP${aiSafeHighDemand.length}',
  '低労働時間 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '低労働時間 × AI 安全 TOP${TOP_N}',
  '若手中心 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '若手中心 × AI 安全 TOP${TOP_N}',
  '無資格 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '無資格 × AI 安全 TOP${aiSafeNoLicense.length}',
  '身体性 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '身体性 × AI 安全 TOP${aiSafePhysical.length}',
  '対人 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '対人 × AI 安全 TOP${aiSafeInterpersonal.length}',
  '大規模就業 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
  '大規模就業 × AI 安全 TOP${largeWorkforceStable.length}',
] as const;

test('R1/R2: Pro ranking titles and H1s use the signed strings once', () => {
  const cache = new Map<string, string>();
  const sourceOf = (file: string): string => {
    const cached = cache.get(file);
    if (cached !== undefined) return cached;
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    cache.set(file, source);
    return source;
  };
  for (const [file, title, h1] of SIGNED) {
    const source = sourceOf(file);
    assert.equal(source.split(title).length - 1, 1, `${file} ${title}`);
    assert.equal(source.split(h1).length - 1, 1, `${file} ${h1}`);
  }
});

test('R1/R2: retired Pro title phrases stay out of these ranking sources', () => {
  const files = ['education.ts', 'employment.ts', 'high-risk.ts', 'intent.ts', 'workforce.ts'];
  for (const file of files) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    for (const phrase of RETIRED) {
      assert.equal(source.split(phrase).length - 1, 0, `${file} still has ${phrase}`);
    }
  }
});
