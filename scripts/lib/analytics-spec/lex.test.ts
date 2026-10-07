import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { lexSource, lineOf } from './lex';
import { readParams, splitTopLevel } from './calls';

const js = (source: string) => lexSource(source, { markup: false });

describe('analytics-spec lexer', () => {
  test('keeps offsets and newlines in both views', () => {
    const source = "a('x') // c\n/* b\n */ b";
    const { text, code } = js(source);
    assert.equal(text.length, source.length);
    assert.equal(code.length, source.length);
    assert.equal(text, "a('x')     \n    \n    b");
    assert.equal(code, "a(' ')     \n    \n    b");
  });

  test('a // inside a string or a regex literal is not a comment', () => {
    const { code } = js("u = 'https://x/gtag/js'; r = /\\/\\//g; gtag('event', 'e');");
    assert.ok(!code.slice(0, 40).includes('gtag'));
    assert.match(code, /gtag\(' +', ' '\);$/);
  });

  test('template literals blank their text but keep ${…} code', () => {
    const { code } = js('t = `a ${gtag("event", "e")} b`; z()');
    assert.match(code, /\$\{gtag\(" +", " "\)\}/);
    assert.ok(code.endsWith('; z()'));
  });

  test('a stray apostrophe in markup only blanks its own line; HTML comments go', () => {
    const source = "<p>don't</p>\n<!-- gtag('event', 'x') -->\n<script>gtag('event', 'y')</script>";
    const { text } = lexSource(source, { markup: true });
    assert.ok(!text.includes("'x'"));
    assert.ok(text.includes("gtag('event', 'y')"));
    assert.equal(lineOf(source, source.indexOf('<script>')), 3);
  });

  test('readParams reads shorthand and quoted keys, rejects spreads', () => {
    const source = "f({a_b, 'c_d': 1, e: {nested: 1}}); g({...x}); h(p)";
    const lexed = js(source);
    const args = (at: number) => splitTopLevel(lexed, source.indexOf('(', at))!;
    assert.deepEqual(readParams(lexed, args(0)[0]), { kind: 'object', keys: ['a_b', 'c_d', 'e'] });
    assert.equal(readParams(lexed, args(source.indexOf('g('))[0]).kind, 'unreadable');
    assert.equal(readParams(lexed, args(source.indexOf('h('))[0]).kind, 'unreadable');
    assert.deepEqual(readParams(lexed, undefined), { kind: 'none' });
  });
});
