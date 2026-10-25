import { createElement as h } from 'react';
import type { ReactElement } from 'react';
import { COLORS } from './_frame.js';

/** Draw precomputed bin counts without labels, axes, or other copy.
 * Callers supply the model run's existing 20 half-point bins in score order.
 * Empty and shorter arrays are supported without recomputing the distribution.
 */
export function renderScoreHistogram(
  bins: readonly number[],
  opts: { width: number; height: number },
): ReactElement {
  const { width, height } = opts;
  const maxCount = Math.max(1, ...bins);
  const slotWidth = bins.length === 0 ? 0 : width / bins.length;

  return h(
    'svg',
    { width, height, viewBox: `0 0 ${width} ${height}` },
    ...bins.map((count, index) => {
      const barHeight = (count / maxCount) * height;
      return h('rect', {
        key: index,
        x: (index + 0.1) * slotWidth,
        y: height - barHeight,
        width: slotWidth * 0.8,
        height: barHeight,
        fill: COLORS.accent,
      });
    }),
  );
}
