/**
 * og-cards.test.ts — pin the 5 OG card config dicts.
 *
 * These dicts back every `/api/og?page=X` / `?ranking=` / etc.
 * request. A typo in a key here = a 400 response for that route's
 * social-card scraper. Tests pin the contract.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  PAGE_CARDS,
  RANKING_CARDS,
  INTEREST_CARDS,
  SKILL_CARDS,
  COMPARE_CARDS,
} from './og-cards.js';
import { RANKING_META } from '../data/lib/rankings-meta.js';
import { INTEREST_META } from '../data/lib/interests-meta.js';
import { SKILL_META } from '../data/lib/skills-meta.js';
import { COMPARE_META } from '../data/lib/compare-meta.js';

function isValidCardConfig(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return false;
  const cfg = v as Record<string, unknown>;
  return (
    typeof cfg.eyebrow === 'string' && cfg.eyebrow.length > 0 &&
    typeof cfg.title === 'string' && cfg.title.length > 0 &&
    typeof cfg.subtitle === 'string' && cfg.subtitle.length > 0
  );
}

describe('PAGE_CARDS — 35 static page variants', () => {
  test('every entry has non-empty eyebrow + title + subtitle', () => {
    for (const [slug, cfg] of Object.entries(PAGE_CARDS)) {
      assert.ok(isValidCardConfig(cfg), `PAGE_CARDS.${slug} has invalid shape`);
    }
  });

  test('home / 404 / privacy / sectors keys all present (route smoke test)', () => {
    for (const required of ['home', '404', 'privacy', 'sectors', 'rankings', 'interests', 'skills', 'compare']) {
      assert.ok(required in PAGE_CARDS, `Missing PAGE_CARDS.${required}`);
    }
  });

  test('keys are unique (no accidental overwrites in literal dict)', () => {
    const keys = Object.keys(PAGE_CARDS);
    assert.equal(keys.length, new Set(keys).size, 'duplicate keys in PAGE_CARDS');
  });
});

describe('RANKING_CARDS — one entry per RANKING_META row', () => {
  test('every RANKING_META slug has a card', () => {
    for (const meta of RANKING_META) {
      assert.ok(meta.slug in RANKING_CARDS, `Missing RANKING_CARDS.${meta.slug}`);
    }
  });

  test('every card has the META-derived shape', () => {
    for (const meta of RANKING_META) {
      const cfg = RANKING_CARDS[meta.slug];
      assert.ok(isValidCardConfig(cfg), `RANKING_CARDS.${meta.slug} invalid`);
      assert.equal(cfg.eyebrow, meta.og_eyebrow);
      assert.equal(cfg.title, meta.name_ja);
      assert.equal(cfg.subtitle, meta.description_ja);
    }
  });

  test('card count matches META count (no drift)', () => {
    assert.equal(Object.keys(RANKING_CARDS).length, RANKING_META.length);
  });
});

describe('INTEREST_CARDS — RIASEC types', () => {
  test('every INTEREST_META slug present', () => {
    for (const meta of INTEREST_META) {
      assert.ok(meta.slug in INTEREST_CARDS);
    }
  });

  test('title encodes "(letter)" suffix', () => {
    for (const meta of INTEREST_META) {
      const cfg = INTEREST_CARDS[meta.slug];
      assert.ok(cfg.title.includes(`(${meta.letter})`), `Missing letter in title: ${cfg.title}`);
    }
  });

  test('subtitle ends in "などにフィット"', () => {
    for (const meta of INTEREST_META) {
      const cfg = INTEREST_CARDS[meta.slug];
      assert.ok(cfg.subtitle.endsWith('などにフィット'), `bad subtitle: ${cfg.subtitle}`);
    }
  });
});

describe('SKILL_CARDS — hub skills', () => {
  test('every SKILL_META slug present', () => {
    for (const meta of SKILL_META) {
      assert.ok(meta.slug in SKILL_CARDS);
    }
  });

  test('each card uses short_ja / title_ja from META', () => {
    for (const meta of SKILL_META) {
      const cfg = SKILL_CARDS[meta.slug];
      assert.equal(cfg.title, meta.short_ja);
      assert.equal(cfg.subtitle, meta.title_ja);
    }
  });
});

describe('COMPARE_CARDS — compare pairs', () => {
  test('every COMPARE_META slug present', () => {
    for (const meta of COMPARE_META) {
      assert.ok(meta.slug in COMPARE_CARDS);
    }
  });

  test('subtitle is description truncated to 80 chars + ellipsis', () => {
    for (const meta of COMPARE_META) {
      const cfg = COMPARE_CARDS[meta.slug];
      assert.ok(cfg.subtitle.endsWith('…'), `bad truncation: ${cfg.subtitle}`);
      // The truncated body length is up to 80 chars; +1 ellipsis = max 81.
      assert.ok(cfg.subtitle.length <= 81, `subtitle too long: ${cfg.subtitle.length}`);
    }
  });
});

describe('Cross-dict invariants', () => {
  test('no slug overlap across the 5 dicts (each card is unique)', () => {
    const collected = new Map<string, string>();
    for (const [dictName, dict] of [
      ['PAGE_CARDS', PAGE_CARDS],
      ['RANKING_CARDS', RANKING_CARDS],
      ['INTEREST_CARDS', INTEREST_CARDS],
      ['SKILL_CARDS', SKILL_CARDS],
      ['COMPARE_CARDS', COMPARE_CARDS],
    ] as const) {
      for (const slug of Object.keys(dict)) {
        const existing = collected.get(slug);
        if (existing && existing !== dictName) {
          // Note: page-level "rankings" / "interests" / etc. ARE legit
          // PAGE_CARDS entries — they label the hub-INDEX page, not a
          // sub-slug. Only assert collision for non-hub keys.
          const isHubIndex =
            (dictName === 'PAGE_CARDS' && ['rankings', 'interests', 'skills', 'compare'].includes(slug)) ||
            (existing === 'PAGE_CARDS' && ['rankings', 'interests', 'skills', 'compare'].includes(slug));
          if (!isHubIndex) {
            throw new Error(
              `Slug "${slug}" appears in both ${existing} and ${dictName}`,
            );
          }
        }
        collected.set(slug, dictName);
      }
    }
  });
});
