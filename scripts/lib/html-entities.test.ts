// decodeHtmlEntities (used by subset-fonts) must never throw on a numeric entity the browser would
// render as U+FFFD; a RangeError here would crash `bun run build`.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { decodeHtmlEntities } from './html-entities.js';

test('decodes valid numeric and named entities', () => {
  assert.equal(decodeHtmlEntities('&#x4E00;&#19968;&amp;&lt;&gt;&quot;&#39;&nbsp;'), '一一&<>"\' ');
  assert.equal(decodeHtmlEntities('&#x1F600;'), '😀');
});

test('out-of-range, surrogate and NUL code points become U+FFFD instead of throwing', () => {
  for (const entity of ['&#99999999;', '&#x110000;', '&#xFFFFFFFFFF;', '&#xD800;', '&#57343;', '&#0;', '&#x0;']) {
    assert.equal(decodeHtmlEntities(`a${entity}b`), 'a�b', entity);
  }
  assert.equal(decodeHtmlEntities(`&#${'9'.repeat(400)};`), '�');
});
