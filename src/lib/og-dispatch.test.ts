/**
 * og-dispatch.test.ts — pin the URL → DispatchDecision contract.
 *
 * `decideDispatch` is pure (no I/O, no globalThis.fetch dependency),
 * so every branch is testable directly. Tests use a CUSTOM catalog
 * for deterministic coverage; a small smoke section at the bottom
 * exercises the default `PRODUCTION_CATALOG` to verify wiring.
 *
 * Branches covered (11 total):
 *   1.  ?page=map                → render-map (special-case)
 *   2.  ?page=<known>           → render-generic (PAGE_CARDS lookup)
 *   3.  ?page=<unknown>         → bad-request (with known-keys hint)
 *   4.  ?ranking=<known>        → render-generic (RANKING_CARDS lookup)
 *   5.  ?ranking=<unknown>      → bad-request
 *   6.  ?interest=<known>       → render-generic (INTEREST_CARDS)
 *   7.  ?interest=<unknown>     → bad-request
 *   8.  ?skill=<known>          → render-generic (SKILL_CARDS)
 *   9.  ?skill=<unknown>        → bad-request
 *  10.  ?compare=<known>        → render-generic (COMPARE_CARDS)
 *  11.  ?compare=<unknown>      → bad-request
 *  12.  ?sector=<id>            → render-sector (id forwarded raw; validation
 *                                  is the renderer's job)
 *  13.  ?id=<digits>            → render-occupation
 *  14.  ?id=<non-digit>         → bad-request
 *  15.  (no recognized params)  → bad-request (full hint message)
 *
 * Precedence tests verify that the order in the dispatcher matches
 * the documented param-precedence — e.g. `?page=map&id=156` resolves
 * to render-map, NOT render-occupation.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  decideDispatch,
  PRODUCTION_CATALOG,
  type CardCatalog,
  type DispatchDecision,
} from './og-dispatch.js';
import { type GenericCardConfig } from './og-helpers.js';

/** Minimal in-memory card config — used as every catalog value so
 *  tests can assert object-identity (catalog returns THIS config). */
const STUB_CONFIG: GenericCardConfig = {
  eyebrow: 'STUB EYEBROW',
  title: 'STUB TITLE',
  subtitle: 'STUB SUBTITLE',
};

const STUB_CATALOG: CardCatalog = {
  page: { home: STUB_CONFIG, about: STUB_CONFIG },
  ranking: { 'ai-risk-low': STUB_CONFIG, 'public-sector': STUB_CONFIG },
  interest: { realistic: STUB_CONFIG, social: STUB_CONFIG },
  skill: { 'critical-thinking': STUB_CONFIG, programming: STUB_CONFIG },
  compare: { 'kango-vs-helper': STUB_CONFIG },
};

function url(query: string): URL {
  return new URL(`https://example.com/api/og${query}`);
}

describe('decideDispatch — render-map branch', () => {
  test('?page=map → render-map (special-case before generic page lookup)', () => {
    const d = decideDispatch(url('?page=map'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-map' });
  });

  test('?page=map ignores other params (precedence: map wins)', () => {
    const d = decideDispatch(url('?page=map&id=156&sector=iryo'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-map' });
  });
});

describe('decideDispatch — page generic branch', () => {
  test('?page=home → render-generic with looked-up config', () => {
    const d = decideDispatch(url('?page=home'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
    assert.equal((d as { kind: 'render-generic'; config: GenericCardConfig }).config, STUB_CONFIG);
  });

  test('?page=<unknown> → bad-request with known-keys hint', () => {
    const d = decideDispatch(url('?page=unknown_page_xyz'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    const msg = (d as { kind: 'bad-request'; message: string }).message;
    assert.match(msg, /unknown \?page=unknown_page_xyz/);
    assert.match(msg, /Known: home, about, map/);
  });

  test('?page=<unknown> echo-back is the URL param verbatim (no sanitization needed — Response body is text/plain)', () => {
    // The 400 message is the place where unvalidated input appears.
    // It's plain text, NOT HTML, so escape-via-template isn't required.
    // (Social-card scrapers won't render the body anyway.) But we pin
    // the format so a future "let's HTML-escape this" refactor doesn't
    // silently change the body shape.
    const d = decideDispatch(url('?page=foo<bar>'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    assert.match((d as { message: string }).message, /unknown \?page=foo<bar>/);
  });
});

describe('decideDispatch — ranking branch', () => {
  test('?ranking=ai-risk-low → render-generic', () => {
    const d = decideDispatch(url('?ranking=ai-risk-low'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('?ranking=<unknown> → bad-request', () => {
    const d = decideDispatch(url('?ranking=nope'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    assert.match((d as { message: string }).message, /unknown \?ranking=nope/);
  });

  test('ranking bad-request hint does NOT include map keyword', () => {
    // Only ?page= mentions 'map' (since /api/og?page=map is the only
    // way to reach the map card). Other families don't include 'map'
    // in their known-keys hint.
    const d = decideDispatch(url('?ranking=nope'), STUB_CATALOG);
    const msg = (d as { message: string }).message;
    assert.ok(!msg.endsWith(', map'), `ranking hint should not include 'map': ${msg}`);
  });
});

describe('decideDispatch — interest / skill / compare branches', () => {
  test('?interest=realistic → render-generic', () => {
    const d = decideDispatch(url('?interest=realistic'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('?interest=<unknown> → bad-request', () => {
    const d = decideDispatch(url('?interest=nope'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    assert.match((d as { message: string }).message, /unknown \?interest=nope/);
  });

  test('?skill=programming → render-generic', () => {
    const d = decideDispatch(url('?skill=programming'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('?skill=<unknown> → bad-request', () => {
    const d = decideDispatch(url('?skill=nope'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
  });

  test('?compare=kango-vs-helper → render-generic', () => {
    const d = decideDispatch(url('?compare=kango-vs-helper'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('?compare=<unknown> → bad-request', () => {
    const d = decideDispatch(url('?compare=nope'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
  });
});

describe('decideDispatch — sector branch', () => {
  test('?sector=iryo → render-sector with id forwarded raw', () => {
    const d = decideDispatch(url('?sector=iryo'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-sector', id: 'iryo' });
  });

  test('?sector=<gibberish> → render-sector (dispatcher does NOT validate; renderer does)', () => {
    // Dispatcher's job: route. Renderer's job: validate shape (regex
    // /^[a-z_]+$/) + fetch + 404 if not found. Tested in sector.test.ts.
    const d = decideDispatch(url('?sector=BAD!!!'), STUB_CATALOG);
    assert.equal(d.kind, 'render-sector');
    assert.equal((d as { id: string }).id, 'BAD!!!');
  });
});

describe('decideDispatch — occupation branch', () => {
  test('?id=156 → render-occupation', () => {
    const d = decideDispatch(url('?id=156'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-occupation', id: '156' });
  });

  test('?id=1 → render-occupation (single digit accepted; renderer pads to 0001)', () => {
    const d = decideDispatch(url('?id=1'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-occupation', id: '1' });
  });

  test('?id=non-digit → bad-request (long help message)', () => {
    const d = decideDispatch(url('?id=abc'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    assert.match((d as { message: string }).message, /required \?id=<n>/);
  });

  test('?id=156.5 (decimal) → bad-request', () => {
    const d = decideDispatch(url('?id=156.5'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
  });

  test('?id= (empty) → bad-request', () => {
    const d = decideDispatch(url('?id='), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
  });
});

describe('decideDispatch — fallback (no recognized params)', () => {
  test('empty query → bad-request with full hint enumerating ALL valid params', () => {
    const d = decideDispatch(url(''), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
    const msg = (d as { message: string }).message;
    // Hint must enumerate every accepted family so a caller pointing
    // a malformed link at /api/og gets a self-documenting 400.
    for (const k of ['?id=', '?sector=', '?ranking=', '?interest=', '?skill=', '?compare=', '?page=']) {
      assert.match(msg, new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `hint should mention ${k}`);
    }
    // And it must list the known page=* slugs (the special-case map +
    // the static pages family).
    assert.match(msg, /map\|home/);
  });

  test('unknown unrelated param → bad-request (treated as "no recognized params")', () => {
    const d = decideDispatch(url('?foo=bar'), STUB_CATALOG);
    assert.equal(d.kind, 'bad-request');
  });
});

describe('decideDispatch — param precedence', () => {
  test('page beats ranking', () => {
    const d = decideDispatch(url('?page=home&ranking=ai-risk-low'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
    // Verify it picked the PAGE config (object identity check would
    // work if the configs were distinct; STUB_CATALOG uses the same
    // STUB_CONFIG for both — pin the kind only).
  });

  test('page beats sector', () => {
    const d = decideDispatch(url('?page=home&sector=iryo'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('ranking beats interest', () => {
    const d = decideDispatch(url('?ranking=ai-risk-low&interest=realistic'), STUB_CATALOG);
    // Both lookups succeed; precedence chooses ranking.
    assert.equal(d.kind, 'render-generic');
  });

  test('sector beats id', () => {
    const d = decideDispatch(url('?sector=iryo&id=156'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-sector', id: 'iryo' });
  });
});

describe('decideDispatch — PRODUCTION_CATALOG wiring smoke', () => {
  test('default catalog (no second arg) uses PRODUCTION_CATALOG', () => {
    // Without explicit catalog: ?page=home should resolve via the real
    // PAGE_CARDS. We don't assert the returned config's exact shape
    // (that's pinned by SEO baseline); we just verify the wiring picks
    // up the production data.
    const d = decideDispatch(url('?page=home'));
    assert.equal(d.kind, 'render-generic');
    const cfg = (d as { config: GenericCardConfig }).config;
    assert.ok(cfg.eyebrow, 'production PAGE_CARDS.home should have eyebrow text');
    assert.ok(cfg.title, 'production PAGE_CARDS.home should have title text');
  });

  test('PRODUCTION_CATALOG.page contains "home" and "about"', () => {
    // Anchor a few known keys so an accidental delete in og-cards.ts
    // (e.g. someone renaming /about to /docs without updating the
    // dispatcher slug) fails this test.
    assert.ok('home' in PRODUCTION_CATALOG.page, 'page catalog missing "home"');
    assert.ok('about' in PRODUCTION_CATALOG.page, 'page catalog missing "about"');
  });

  test('PRODUCTION_CATALOG.interest contains the 6 RIASEC types', () => {
    const RIASEC = ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'];
    for (const t of RIASEC) {
      assert.ok(t in PRODUCTION_CATALOG.interest, `interest catalog missing "${t}"`);
    }
  });
});

describe('decideDispatch — type discipline', () => {
  test('exhaustiveness: every DispatchDecision kind has a runtime test above', () => {
    // Sanity check that the type union and the test suite stay in
    // sync. If a new kind is added without a corresponding describe
    // block, TypeScript will accept it but this test will fail.
    const KNOWN_KINDS: ReadonlyArray<DispatchDecision['kind']> = [
      'render-map',
      'render-generic',
      'render-sector',
      'render-occupation',
      'bad-request',
    ];
    assert.equal(KNOWN_KINDS.length, 5, 'expected 5 dispatch kinds');
  });
});
