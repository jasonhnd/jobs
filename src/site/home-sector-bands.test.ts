/**
 * Home sector-card eyebrows must be the signed word for the same unrounded
 * mean the sector page prints. A hardcoded 低/中 swap drifts from that mean.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { riskBandWord } from '../lib/risk.js';
import { formatShownMeanLabel } from '../lib/score-format.js';
import { loadGeoFacts } from '../page-data/geo-facts-loader.js';
import { bindHomeFacts } from './home-facts-render.js';

describe('home sector cards match the sector page', () => {
  test('each of the 16 eyebrows is the band word of that sector mean', () => {
    const template = readFileSync('src/index-source.html', 'utf8');
    const slots = [...template.matchAll(/href="\/sectors\/([a-z0-9]+)">\s*<span class="hc-eyebrow">__SECTOR_BAND_([a-z0-9]+)__/g)];
    assert.equal(slots.length, 16);
    for (const [, hrefId, token] of slots) assert.equal(token, hrefId, hrefId);

    const facts = loadGeoFacts();
    const html = bindHomeFacts(template, facts);
    const cards = [...html.matchAll(/<a class="hub-card" href="\/sectors\/([a-z0-9]+)">\s*<span class="hc-eyebrow">([^<]+)<\/span>/g)];
    assert.equal(cards.length, 16);
    const byId = new Map(facts.sectorsByMeanImpact.map((sector) => [sector.id, sector]));
    assert.equal(byId.size, cards.length);

    for (const [, id, eyebrow] of cards) {
      const sector = byId.get(id);
      assert.ok(sector, id);
      const word = riskBandWord(sector.meanAiImpactRaw);
      const detail = formatShownMeanLabel(sector.meanAiImpactRaw);
      assert.equal(eyebrow, word, `${id} raw ${sector.meanAiImpactRaw} prints ${detail}`);
      assert.ok(detail.endsWith(` ${word}`), detail);
      assert.doesNotMatch(eyebrow, /__SECTOR_BAND_/);
    }
  });

  test('the sector page uses that same raw mean and label helper', () => {
    const bindings = readFileSync('src/pages/sectors/_sector-bindings.ts', 'utf8');
    const page = readFileSync('src/pages/sectors/[sector].astro', 'utf8');
    assert.match(bindings, /const meanRisk: number \| null = geoSector\.meanAiImpactRaw;/);
    assert.match(bindings, /formatShownMeanLabel\(meanRisk\)/);
    assert.match(page, /formatShownMeanLabel\(meanRisk\)/);
  });
});
