/**
 * og-dispatch.test.ts — pin the URL → DispatchDecision contract.
 *
 * `decideDispatch` is pure (no I/O, no globalThis.fetch dependency),
 * so every branch is testable directly. Tests use a CUSTOM catalog
 * for deterministic coverage; a small smoke section at the bottom
 * exercises the default `PRODUCTION_CATALOG` to verify wiring.
 *
 * Safety-net contract (2026-06-03): the endpoint NEVER hard-fails a
 * social card. There is no `bad-request` kind — any input we cannot
 * render (unknown slug in a known family, invalid/absent id, no
 * recognized param) degrades to the home generic card. The custom
 * catalog gives page.home a DISTINCT config (HOME_CONFIG) so a
 * fallback can be asserted by object identity, not just by kind.
 *
 * Branches covered:
 *   1.  ?page=map                → render-map (special-case)
 *   2.  ?page=<known>            → render-generic (PAGE_CARDS lookup)
 *   3.  ?page=<unknown>          → render-generic (HOME fallback)
 *   4.  ?ranking=<known>         → render-generic (RANKING_CARDS lookup)
 *   5.  ?ranking=<unknown>       → render-generic (HOME fallback)
 *   6.  ?interest=<known/unknown>→ render-generic / HOME fallback
 *   7.  ?skill=<known/unknown>   → render-generic / HOME fallback
 *   8.  ?compare=<known/unknown> → render-generic / HOME fallback
 *   9.  ?route=<known/unknown>   → render-generic / HOME fallback  (NEW family)
 *  10.  ?sector=<id>             → render-sector (id forwarded raw; validation
 *                                   is the renderer's job)
 *  11.  ?id=<digits>             → render-occupation
 *  12.  ?id=<non-digit/overflow> → render-generic (HOME fallback)
 *  13.  (no recognized params)   → render-generic (HOME fallback)
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

/** Minimal in-memory card config — used as every NON-home catalog value
 *  so tests can assert object-identity (catalog returns THIS config). */
const STUB_CONFIG: GenericCardConfig = {
  eyebrow: 'STUB EYEBROW',
  title: 'STUB TITLE',
  subtitle: 'STUB SUBTITLE',
};

/** Distinct config for page.home so safety-net fallback tests can
 *  assert the decision is SPECIFICALLY the home card (object identity),
 *  not a coincidental match with some other family's STUB_CONFIG. */
const HOME_CONFIG: GenericCardConfig = {
  eyebrow: 'HOME EYEBROW',
  title: 'HOME TITLE',
  subtitle: 'HOME SUBTITLE',
};

const STUB_CATALOG: CardCatalog = {
  page: { home: HOME_CONFIG, about: STUB_CONFIG },
  ranking: { 'ai-risk-low': STUB_CONFIG, 'public-sector': STUB_CONFIG },
  interest: { realistic: STUB_CONFIG, social: STUB_CONFIG },
  skill: { 'critical-thinking': STUB_CONFIG, programming: STUB_CONFIG },
  compare: { 'kango-vs-helper': STUB_CONFIG },
  route: { 'by-industry': STUB_CONFIG, 'find-your-fit': STUB_CONFIG },
};

function url(query: string): URL {
  return new URL(`https://example.com/api/og${query}`);
}

/** Assert the decision is a render-generic carrying exactly `expected`. */
function assertCard(d: DispatchDecision, expected: GenericCardConfig): void {
  assert.equal(d.kind, 'render-generic');
  assert.equal((d as { kind: 'render-generic'; config: GenericCardConfig }).config, expected);
}

/** Assert the decision is the home-card safety-net fallback. */
function assertHomeFallback(d: DispatchDecision): void {
  assertCard(d, HOME_CONFIG);
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
  test('?page=about → render-generic with looked-up config', () => {
    const d = decideDispatch(url('?page=about'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?page=home → render-generic with the home config', () => {
    const d = decideDispatch(url('?page=home'), STUB_CATALOG);
    assertCard(d, HOME_CONFIG);
  });

  test('?page=<unknown> → HOME fallback (no longer a 400)', () => {
    const d = decideDispatch(url('?page=unknown_page_xyz'), STUB_CATALOG);
    assertHomeFallback(d);
  });
});

describe('decideDispatch — ranking branch', () => {
  test('?ranking=ai-risk-low → render-generic', () => {
    const d = decideDispatch(url('?ranking=ai-risk-low'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?ranking=<unknown> → HOME fallback', () => {
    const d = decideDispatch(url('?ranking=nope'), STUB_CATALOG);
    assertHomeFallback(d);
  });
});

describe('decideDispatch — interest / skill / compare branches', () => {
  test('?interest=realistic → render-generic', () => {
    const d = decideDispatch(url('?interest=realistic'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?interest=<unknown> → HOME fallback', () => {
    const d = decideDispatch(url('?interest=nope'), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('?skill=programming → render-generic', () => {
    const d = decideDispatch(url('?skill=programming'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?skill=<unknown> → HOME fallback', () => {
    const d = decideDispatch(url('?skill=nope'), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('?compare=kango-vs-helper → render-generic', () => {
    const d = decideDispatch(url('?compare=kango-vs-helper'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?compare=<unknown> → HOME fallback', () => {
    const d = decideDispatch(url('?compare=nope'), STUB_CATALOG);
    assertHomeFallback(d);
  });
});

describe('decideDispatch — route branch (explore routes)', () => {
  test('?route=by-industry → render-generic', () => {
    const d = decideDispatch(url('?route=by-industry'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?route=find-your-fit → render-generic', () => {
    const d = decideDispatch(url('?route=find-your-fit'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('?route=<unknown> → HOME fallback', () => {
    const d = decideDispatch(url('?route=nope'), STUB_CATALOG);
    assertHomeFallback(d);
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

  test('?id=non-digit → HOME fallback (was bad-request; CODE-008 stays safe)', () => {
    const d = decideDispatch(url('?id=abc'), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('?id=156.5 (decimal) → HOME fallback', () => {
    const d = decideDispatch(url('?id=156.5'), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('?id=10001 (5-digit overflow) → HOME fallback, never a wrong card (CODE-008)', () => {
    // padId would throw on 5 digits; the dispatcher must never route it
    // to the occupation renderer. It degrades to the home card.
    const d = decideDispatch(url('?id=10001'), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('?id= (empty) → HOME fallback', () => {
    const d = decideDispatch(url('?id='), STUB_CATALOG);
    assertHomeFallback(d);
  });
});

describe('decideDispatch — safety net (no recognized params)', () => {
  test('empty query → HOME fallback', () => {
    const d = decideDispatch(url(''), STUB_CATALOG);
    assertHomeFallback(d);
  });

  test('unknown unrelated param → HOME fallback', () => {
    const d = decideDispatch(url('?foo=bar'), STUB_CATALOG);
    assertHomeFallback(d);
  });
});

describe('decideDispatch — param precedence', () => {
  test('page beats ranking (home config proves page won)', () => {
    const d = decideDispatch(url('?page=home&ranking=ai-risk-low'), STUB_CATALOG);
    // page.home → HOME_CONFIG; ranking would give STUB_CONFIG. Identity
    // with HOME_CONFIG proves the page branch took precedence.
    assertCard(d, HOME_CONFIG);
  });

  test('page beats sector', () => {
    const d = decideDispatch(url('?page=home&sector=iryo'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('ranking beats interest', () => {
    const d = decideDispatch(url('?ranking=ai-risk-low&interest=realistic'), STUB_CATALOG);
    assert.equal(d.kind, 'render-generic');
  });

  test('route beats sector', () => {
    const d = decideDispatch(url('?route=by-industry&sector=iryo'), STUB_CATALOG);
    assertCard(d, STUB_CONFIG);
  });

  test('sector beats id', () => {
    const d = decideDispatch(url('?sector=iryo&id=156'), STUB_CATALOG);
    assert.deepEqual(d, { kind: 'render-sector', id: 'iryo' });
  });
});

describe('decideDispatch — PRODUCTION_CATALOG wiring smoke', () => {
  test('default catalog (no second arg) uses PRODUCTION_CATALOG', () => {
    const d = decideDispatch(url('?page=home'));
    assert.equal(d.kind, 'render-generic');
    const cfg = (d as { config: GenericCardConfig }).config;
    assert.ok(cfg.eyebrow, 'production PAGE_CARDS.home should have eyebrow text');
    assert.ok(cfg.title, 'production PAGE_CARDS.home should have title text');
  });

  test('PRODUCTION_CATALOG.page contains "home", "about", and "me"', () => {
    // Anchor known keys so an accidental delete in og-cards.ts fails
    // here. "me" is anchored because /me (linked in MobileNav) pointed
    // at ?page=me with no card until 2026-06-03 — keep it wired.
    assert.ok('home' in PRODUCTION_CATALOG.page, 'page catalog missing "home"');
    assert.ok('about' in PRODUCTION_CATALOG.page, 'page catalog missing "about"');
    assert.ok('me' in PRODUCTION_CATALOG.page, 'page catalog missing "me"');
  });

  test('PRODUCTION_CATALOG.interest contains the 6 RIASEC types', () => {
    const RIASEC = ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'];
    for (const t of RIASEC) {
      assert.ok(t in PRODUCTION_CATALOG.interest, `interest catalog missing "${t}"`);
    }
  });

  test('PRODUCTION_CATALOG.route contains all 7 explore routes', () => {
    // Anchors the explore fix: /explore/<slug> pointed at ?route= with
    // no dispatch branch (→ 400) until 2026-06-03.
    const ROUTES = [
      'by-industry', 'by-ranking', 'find-your-fit', 'by-skill-and-license',
      'by-work-style', 'compare', 'methodology-trust',
    ];
    for (const r of ROUTES) {
      assert.ok(r in PRODUCTION_CATALOG.route, `route catalog missing "${r}"`);
    }
  });

  test('production ?route=by-industry resolves to a real card (not the fallback)', () => {
    const d = decideDispatch(url('?route=by-industry'));
    assert.equal(d.kind, 'render-generic');
    const cfg = (d as { config: GenericCardConfig }).config;
    assert.ok(cfg.title, 'explore route card should carry a title');
  });

  test('production unknown page degrades to the real home card (safety net wired end-to-end)', () => {
    const d = decideDispatch(url('?page=definitely_not_a_real_page'));
    assert.equal(d.kind, 'render-generic');
    const cfg = (d as { config: GenericCardConfig }).config;
    assert.equal(cfg, PRODUCTION_CATALOG.page.home, 'unknown page should fall back to PAGE_CARDS.home');
  });
});

describe('decideDispatch — type discipline', () => {
  test('exhaustiveness: every DispatchDecision kind has a runtime test above', () => {
    // Sanity check that the type union and the test suite stay in
    // sync. The `bad-request` kind was removed in the 2026-06-03
    // safety-net change — 4 render kinds remain.
    const KNOWN_KINDS: ReadonlyArray<DispatchDecision['kind']> = [
      'render-map',
      'render-generic',
      'render-sector',
      'render-occupation',
    ];
    assert.equal(KNOWN_KINDS.length, 4, 'expected 4 dispatch kinds');
  });
});
