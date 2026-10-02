import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement as h } from 'react';
import type { ReactElement, ReactNode, CSSProperties } from 'react';
import {
  BADGE_TEXT, COLORS, FOOTER_LEFT, FOOTER_RIGHT, FRAME_SUBSET, SITE_MARK,
  eyebrow, footer, miniScale, ogShell, topBar,
} from './_frame.js';

type Element = ReactElement<{ children?: ReactNode; style: CSSProperties }>;
const children = (node: ReactElement): Element[] => {
  const value = (node as Element).props.children;
  return (Array.isArray(value) ? value : [value]) as Element[];
};
const style = (node: ReactElement) => (node as Element).props.style;

test('shared top bar keeps badge, four brand tiles and site mark in order', () => {
  const bar = topBar();
  const [badge, brand] = children(bar);
  const [mark, site] = children(brand);
  assert.equal(style(bar).justifyContent, 'space-between');
  assert.equal(badge.props.children, BADGE_TEXT);
  assert.equal(style(badge).background, COLORS.accent);
  assert.equal(site.props.children, SITE_MARK);
  assert.equal(style(mark).width, '28px');
  assert.equal(style(mark).height, '28px');
  assert.equal(style(mark).flexWrap, 'wrap');
  const tiles = children(mark);
  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles.map(tile => style(tile).background), ['#FFD84D', '#FF8A3D', '#80C0FF', '#00B04B']);
  assert.ok(tiles.every(tile => style(tile).width === '50%' && style(tile).height === '50%'));
  for (const text of [BADGE_TEXT, SITE_MARK, FOOTER_LEFT, FOOTER_RIGHT]) {
    assert.ok(FRAME_SUBSET.includes(text), 'font subset includes shared frame copy');
  }
});

test('eyebrow uses the default accent or the caller accent', () => {
  assert.equal(style(eyebrow('fixture')).color, COLORS.accent);
  const custom = eyebrow('fixture', '#123456');
  assert.equal(style(custom).color, '#123456');
  assert.equal((custom as Element).props.children, 'fixture');
});

test('footer accepts one node or a row of nodes and preserves the sign-off', () => {
  const a = h('span', {}, 'first');
  const b = h('span', {}, 'second');
  for (const left of [a, [a, b]]) {
    const bar = footer(left);
    const [items, signoff] = children(bar);
    assert.deepEqual(children(items), Array.isArray(left) ? left : [left]);
    assert.equal(signoff.props.children, FOOTER_RIGHT);
    assert.equal(style(signoff).flexShrink, 0);
    assert.equal(style(bar).borderTop, `1px solid ${COLORS.hairline}`);
  }
});

test('mini scale clamps its fill and retains the 0/5/10 labels', () => {
  for (const [score, width] of [[-2, '0%'], [0, '0%'], [4.25, '42.5%'], [10, '100%'], [12, '100%']] as const) {
    const [track, labels] = children(miniScale(score, '#123456'));
    const fill = (track.props.children as Element);
    assert.equal(style(fill).width, width);
    assert.equal(style(fill).backgroundColor, '#123456');
    assert.equal(style(track).overflow, 'hidden');
    assert.deepEqual(children(labels).map(label => label.props.children), ['0', '5', '10']);
  }
});

test('shell keeps its full canvas, accent rule and child order', () => {
  const content = [h('div', {}, 'top'), h('div', {}, 'body'), h('div', {}, 'bottom')];
  const shell = ogShell('#123456', content);
  assert.deepEqual(children(shell), content);
  assert.equal(style(shell).width, '100%');
  assert.equal(style(shell).height, '100%');
  assert.equal(style(shell).flexDirection, 'column');
  assert.equal(style(shell).borderLeft, '16px solid #123456');
  assert.equal(style(shell).backgroundColor, COLORS.bg);
  assert.equal(style(shell).fontFamily, 'NotoSansJP');
});
