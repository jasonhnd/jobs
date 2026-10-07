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

  test('markup text is never lexed as JS; scripts and frontmatter are; comments go', () => {
    const source = "---\nconst a = 'q';\n---\n<p>don't</p><script>gtag('event', 'y')</script>\n<!-- gtag('event', 'x') -->\n{/* z */}";
    const { text, code } = lexSource(source, { markup: true });
    assert.ok(!text.includes("'x'"));
    assert.ok(!text.includes('z'));
    assert.ok(code.includes("<p>don't</p>"));
    assert.match(code, /<script>gtag\(' +', ' '\)<\/script>/);
    assert.match(code, /const a = ' ';/);
    assert.equal(lineOf(source, source.indexOf('<script>')), 4);
  });

  test('a / after a postfix ++, a name, ) or ] divides; after an operator or keyword it starts a regex', () => {
    for (const division of ['a++ / b; "s"', 'x / y; "s"', '(a) / 2; "s"', 'a[0] / 2; "s"']) {
      assert.match(js(division).code, /" "$/, division);
    }
    for (const regex of ["x = /'/; f()", "return /'/.test(s); f()", "f(/'/); g()"]) {
      assert.match(js(regex).code, /\b[fg]\(\)$/, regex);
    }
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
