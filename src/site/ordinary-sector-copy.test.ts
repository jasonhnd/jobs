import { expect, test } from 'bun:test';
import { ordinarySectorCopy } from './ordinary-sector-copy';

for (const [raw, band] of [[3.94, '小さい'], [3.97, '中くらい'], [6.94, '中くらい'], [6.97, '大きい']] as const) {
  test(`sector conclusion follows displayed score ${raw}`, () => {
    expect(ordinarySectorCopy('テスト業界', 36, raw)?.conclusion).toContain(`「${band}」`);
    expect(ordinarySectorCopy('テスト業界', 36, raw)?.band).toBe(`変化 ${band}`);
  });
}

test('missing and invalid sector averages never manufacture a band', () => {
  for (const mean of [null, NaN, Infinity]) expect(ordinarySectorCopy('テスト業界', 1, mean)).toBeNull();
});
