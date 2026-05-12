/**
 * OrgsCerts.test.ts — pin the byte-for-byte output of the orgs+certs
 * block extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderOrgsCerts } from './OrgsCerts.js';

describe('renderOrgsCerts', () => {
  test('both empty returns empty SafeHtml (no empty <section>)', () => {
    assert.equal(renderOrgsCerts({ orgs: [], certs: [] }), '');
  });

  test('orgs only renders 関連業界団体 block', () => {
    const out = renderOrgsCerts({
      orgs: [{ nameJa: '日本看護協会', url: 'https://example.org/' }],
      certs: [],
    });
    assert.equal(
      out,
      '<section class="orgs-certs"><div class="org-cert-grid">' +
        '<div class="org-cert-block"><h3>関連業界団体</h3>' +
        '<ul class="org-list">' +
        '<li><a href="https://example.org/" rel="external noopener noreferrer" target="_blank">日本看護協会</a></li>' +
        '</ul></div>' +
        '</div></section>',
    );
  });

  test('certs only renders 関連資格 block', () => {
    const out = renderOrgsCerts({
      orgs: [],
      certs: ['看護師', '保健師'],
    });
    assert.equal(
      out,
      '<section class="orgs-certs"><div class="org-cert-grid">' +
        '<div class="org-cert-block"><h3>関連資格</h3>' +
        '<ul class="cert-list">' +
        '<li>看護師</li><li>保健師</li>' +
        '</ul></div>' +
        '</div></section>',
    );
  });

  test('both populated renders both blocks in order (orgs first, certs second)', () => {
    const out = renderOrgsCerts({
      orgs: [{ nameJa: 'A', url: 'https://a.example/' }],
      certs: ['cert-1'],
    });
    assert.ok(out.indexOf('関連業界団体') < out.indexOf('関連資格'));
  });

  test('null URL falls back to # anchor', () => {
    const out = renderOrgsCerts({
      orgs: [{ nameJa: 'X', url: null }],
      certs: [],
    });
    assert.ok(out.includes('href="#"'));
  });

  test('orgs with null nameJa are dropped (no empty <a>)', () => {
    const out = renderOrgsCerts({
      orgs: [
        { nameJa: null, url: 'https://x.example/' },
        { nameJa: 'real', url: 'https://y.example/' },
      ],
      certs: [],
    });
    // Only 1 <li> survives.
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 1);
    assert.ok(out.includes('real'));
  });

  test('XSS payloads in name + url + cert are escaped', () => {
    const out = renderOrgsCerts({
      orgs: [{ nameJa: '<script>', url: 'a"b' }],
      certs: ['c<d>'],
    });
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(out.includes('a&quot;b'));
    assert.ok(out.includes('c&lt;d&gt;'));
    assert.ok(!out.includes('<script>'));
  });

  test('orgs all dropped (nameJa null) but array non-empty → emit block with empty <ul> (legacy parity)', () => {
    // Legacy [id].astro behaviour: the outer <section> + <h3> ship as
    // soon as orgs.length > 0, even when every entry filters out. The
    // <ul> ends up empty. This is intentionally preserved so the SEO
    // baseline diff stays byte-equivalent during migration.
    const out = renderOrgsCerts({
      orgs: [
        { nameJa: null, url: 'https://x.example/' },
        { nameJa: null, url: 'https://y.example/' },
      ],
      certs: [],
    });
    assert.ok(out.includes('<ul class="org-list"></ul>'));
    assert.ok(out.includes('<h3>関連業界団体</h3>'));
  });
});
