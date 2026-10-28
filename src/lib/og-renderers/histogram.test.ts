import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isValidElement } from 'react';
import type { ReactElement } from 'react';
import { COLORS } from './_frame.js';
import { renderScoreHistogram } from './histogram.js';

type Bar = ReactElement<{
  x: number; y: number; width: number; height: number; fill: string;
}>;

function bars(tree: ReactElement): Bar[] {
  const { children } = tree.props as { children?: Bar | Bar[] };
  return children === undefined ? [] : Array.isArray(children) ? children : [children];
}

function assertBarsOnly(tree: ReactElement): void {
  assert.equal(tree.type, 'svg');
  for (const bar of bars(tree)) {
    assert.ok(isValidElement(bar));
    assert.equal(bar.type, 'rect');
    assert.equal((bar.props as { children?: unknown }).children, undefined);
    assert.equal(bar.props.fill, COLORS.accent);
    for (const value of [bar.props.x, bar.props.y, bar.props.width, bar.props.height]) {
      assert.ok(Number.isFinite(value) && value >= 0);
    }
  }
}

test('histogram preserves all 20 bins in order and scales counts to the requested canvas', () => {
  const bins = Object.freeze(Array.from({ length: 20 }, (_, index) => index));
  const tree = renderScoreHistogram(bins, { width: 400, height: 95 });
  assertBarsOnly(tree);
  assert.equal((tree.props as { width: number }).width, 400);
  assert.equal((tree.props as { height: number }).height, 95);
  assert.equal((tree.props as { viewBox: string }).viewBox, '0 0 400 95');
  const output = bars(tree);
  assert.equal(output.length, 20);
  output.forEach((bar, index) => {
    assert.equal(bar.props.height, index * 5);
    assert.equal(bar.props.y + bar.props.height, 95, 'bars share a bottom edge');
    assert.ok(bar.props.x + bar.props.width <= 400);
    if (index > 0) {
      const previous = output[index - 1].props;
      assert.ok(previous.x + previous.width < bar.props.x, 'bins have visible gaps');
      assert.equal(previous.width, bar.props.width);
    }
  });
});

test('all-zero and empty input render no visible bars or text', () => {
  for (const bins of [[], Array(20).fill(0)]) {
    const tree = renderScoreHistogram(bins, { width: 200, height: 80 });
    assertBarsOnly(tree);
    assert.equal(bars(tree).length, bins.length);
    assert.ok(bars(tree).every(bar => bar.props.height === 0 && bar.props.y === 80));
  }
});

test('a single bin fits within the canvas at full height', () => {
  const tree = renderScoreHistogram([7], { width: 100, height: 60 });
  assertBarsOnly(tree);
  assert.equal(bars(tree).length, 1);
  const { x, y, width, height } = bars(tree)[0].props;
  assert.equal(y, 0);
  assert.equal(height, 60);
  assert.ok(x > 0 && x + width < 100);
});

test('a single populated score bin keeps its position among zero-count bins', () => {
  const bins = Array(20).fill(0);
  bins[13] = 556;
  const tree = renderScoreHistogram(bins, { width: 600, height: 120 });
  assertBarsOnly(tree);
  assert.deepEqual(bars(tree).map(bar => bar.props.height), bins.map(count => count ? 120 : 0));
  assert.ok(bars(tree)[13].props.x > 600 / 2);
});
