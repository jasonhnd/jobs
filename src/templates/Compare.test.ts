import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderJsonLd } from './Compare.js';
import type { CompareSide } from '../views/compare-hub.js';
import type { CompareMeta } from '../views/compare-meta.js';

const meta: CompareMeta = {
  slug: 'kango-vs-helper',
  occ_a_id: 1,
  occ_b_id: 2,
  title_ja: 'A vs B',
  description_ja: 'desc',
  comparison_points_ja: [],
  decision_hints_ja: [],
  og_eyebrow: 'COMPARE',
};

const side = (id: number, name: string): CompareSide => ({
  id,
  name_ja: name,
  ai_risk: 4,
  risk_band: 'mid',
  rationale_ja: null,
  summary_ja: null,
  salary: 500,
  workers: 1000,
  monthly_hours: 160,
  average_age: 40,
  recruit_ratio: 1,
  sector_id: 'iryo',
  sector_ja: '医療',
  related_certs_ja: [],
  top_skills: [],
});

describe('Compare JSON-LD speakable', () => {
  test('WebPage points to the citable fact block and compare body', () => {
    const got = JSON.parse(renderJsonLd(
      'https://mirai-shigoto.com/compare/kango-vs-helper',
      meta,
      side(1, 'A'),
      side(2, 'B'),
      'desc',
      null,
    ));
    const webpage = (got['@graph'] as Array<{ '@type': string; speakable?: unknown }>)
      .find((node) => node['@type'] === 'WebPage');
    assert.deepEqual(webpage?.speakable, {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.ai-fact', '.intro', '.compare-table'],
    });
  });
});
