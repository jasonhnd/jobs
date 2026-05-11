// Tests for src/data/schema/occupation.ts — primarily for the security /
// reliability checks added in Phase 0.4 + 1.1: http(s) URL refinement and
// IPD numeric range bounds.
//
// These tests guard the schema, not the rest of the project — so they
// build minimal fixture objects rather than reading a real occupation
// file (keeps the test self-contained and immune to data churn).

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  OccupationSchema,
  RelatedOrgSchema,
  type Occupation,
} from './occupation.js';

// ─── Minimal valid Occupation fixture ─────────────────────────────────────
//
// Built field-by-field against the current schema so a future schema
// change (e.g. a new required field) breaks this test in one place
// rather than 30. Override individual fields in each test by spreading.

function makeValidOccupation(overrides: Partial<Occupation> = {}): unknown {
  const base = {
    id: 1,
    ipd_id: 'IPD_01_01_001',
    schema_version: '7.00',
    ingested_at: '2026-05-11',
    title_ja: 'テスト職業',
    aliases_ja: [],
    classifications: {
      mhlw_main: '12_072-06',
      mhlw_all: ['12_072-06'],
      jsoc_main: 'H533',
      jsoc_all: ['H533'],
    },
    description: {
      summary_ja: null,
      what_it_is_ja: null,
      how_to_become_ja: null,
      working_conditions_ja: null,
    },
    interests: null,
    work_values: null,
    skills: null,
    knowledge: null,
    abilities: null,
    work_characteristics: null,
    work_activities: null,
    education_distribution: null,
    training_pre: null,
    training_post: null,
    experience: null,
    employment_type: null,
    tasks_lead_ja: null,
    tasks: [],
    related_orgs: [],
    related_certs_ja: [],
    url: 'https://example.com/occupation/1',
    data_source_versions: {
      ipd_numeric: 'v7.00',
      ipd_description: 'v7.00',
      ipd_retrieved_at: '2026-05-11',
    },
    last_updated_per_section: {},
  };
  return { ...base, ...overrides };
}

describe('OccupationSchema baseline', () => {
  test('minimal fixture parses cleanly', () => {
    const result = OccupationSchema.safeParse(makeValidOccupation());
    assert.equal(result.success, true,
      result.success ? '' : JSON.stringify(result.error.issues, null, 2));
  });
});

// ─── safeHttpUrl (Phase 0.4) ──────────────────────────────────────────────

describe('safeHttpUrl on Occupation.url', () => {
  test('accepts https URL', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'https://www.example.com/path?q=1',
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('accepts http URL', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'http://example.com',
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('REJECTS javascript: URL (stored-XSS vector)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'javascript:alert(1)',
    } as Partial<Occupation>));
    assert.equal(r.success, false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join('|');
      assert.match(msg, /http\(s\)/i, 'error must mention http(s)');
    }
  });

  test('REJECTS data: URL (also stored-XSS vector)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'data:text/html,<script>alert(1)</script>',
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS file: URL', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'file:///etc/passwd',
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS malformed URL', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      url: 'not a url',
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });
});

describe('safeHttpUrl on RelatedOrgSchema.url', () => {
  test('accepts null (orgs without URL are valid)', () => {
    const r = RelatedOrgSchema.safeParse({
      name_ja: '日本豆腐協会',
      url: null,
    });
    assert.equal(r.success, true);
  });

  test('accepts omitted url (nullish)', () => {
    const r = RelatedOrgSchema.safeParse({
      name_ja: '日本豆腐協会',
    });
    assert.equal(r.success, true);
  });

  test('accepts https URL', () => {
    const r = RelatedOrgSchema.safeParse({
      name_ja: '日本豆腐協会',
      url: 'https://tofu.example.jp',
    });
    assert.equal(r.success, true);
  });

  test('REJECTS javascript: URL', () => {
    const r = RelatedOrgSchema.safeParse({
      name_ja: 'malicious org',
      url: 'javascript:void(0)',
    });
    assert.equal(r.success, false);
  });
});

// ─── IPD numeric bounds (Phase 1.1) ───────────────────────────────────────

describe('IPD score dimensions: [0, 7] bound', () => {
  test('accepts in-range scores', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      skills: { reading_comprehension: 2.371, speaking: 6.85 },
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('accepts 0 (lower bound inclusive)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      knowledge: { mathematics: 0 },
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('accepts 7 (upper bound inclusive)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      abilities: { stamina: 7 },
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('REJECTS negative score', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      skills: { reading_comprehension: -1 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS score > 7 (no out-of-band stale data)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      work_activities: { something: 99 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS even small overshoot (7.01)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      interests: { realistic: 7.01 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });
});

describe('Fraction dimensions: [0, 1] bound', () => {
  test('accepts 0 and 1 inclusive', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      education_distribution: { high_school: 0, university: 1 },
    } as Partial<Occupation>));
    assert.equal(r.success, true);
  });

  test('REJECTS percentage-style 100 (not a fraction)', () => {
    // Common bug: someone wrote 100 thinking percent. Schema must catch this.
    const r = OccupationSchema.safeParse(makeValidOccupation({
      employment_type: { full_time: 100 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS negative fraction', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      experience: { years: -0.1 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });

  test('REJECTS slight overshoot (1.001)', () => {
    const r = OccupationSchema.safeParse(makeValidOccupation({
      training_pre: { weeks_intro: 1.001 },
    } as Partial<Occupation>));
    assert.equal(r.success, false);
  });
});
