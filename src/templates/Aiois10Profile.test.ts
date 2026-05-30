import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderAiois10Profile } from './Aiois10Profile.js';

const sample = {
  d1: 9.5, d2: 9.0, d3: 0.6, d4: 0.3, d5: 0.0, d6: 0.7, d7: 0.8, d8: 4.4, d9: 6.6, d10: 7.9,
  transformation: 9.2, displacement: 7.6,
};

describe('renderAiois10Profile', () => {
  test('returns empty SafeHtml when profile is null', () => {
    assert.equal(renderAiois10Profile(null), '');
  });

  test('renders all 10 dimension codes and both indices', () => {
    const html = renderAiois10Profile(sample);
    for (const code of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10']) {
      assert.ok(html.includes(`>${code}<`), `missing ${code}`);
    }
    assert.ok(html.includes('変化指数'));
    assert.ok(html.includes('代替リスク'));
    assert.ok(html.includes('>9.2<'), 'transformation value');
    assert.ok(html.includes('>7.6<'), 'displacement value');
  });

  test('bar fill width tracks the 0-10 value (×10%)', () => {
    const html = renderAiois10Profile(sample);
    assert.ok(html.includes('width:95%'), 'D1=9.5 → 95%');
    assert.ok(html.includes('width:6%'), 'D3=0.6 → 6%');
  });

  test('clamps and rounds bar width into [0,100]', () => {
    const html = renderAiois10Profile({ ...sample, d1: 10, d3: 0 });
    assert.ok(html.includes('width:100%'));
    assert.ok(html.includes('width:0%'));
  });

  test('renders one decimal place for each value', () => {
    const html = renderAiois10Profile(sample);
    assert.ok(html.includes('>0.0<'), 'D5=0.0 shows one decimal');
  });
});
