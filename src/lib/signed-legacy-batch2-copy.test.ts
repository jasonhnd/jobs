/** Owner-signed legacy-copy batch 2, item 14 (#958). */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { OCCUPATION_COUNT } from '../site/config';
import { renderHubJsonLd, renderRankingsHubGroups } from '../templates/Ranking';
import { buildRankings } from '../views/ranking';

const description = `日本${OCCUPATION_COUNT.SCORED}職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要でランキング。AIで大きく変わる仕事、高年収×低AIリスクの職業などを一覧。`;

test('#958 item 14: index lists 39 distinct rankings, rather than ten viewpoints', () => {
  const { hub } = buildRankings(() => []);
  const html = renderRankingsHubGroups(hub.groups);
  const links = [...html.matchAll(/href="\/(?:pro\/)?rankings\/([^"]+)"/g)].map((match) => match[1]);
  assert.equal(links.length, 39);
  assert.equal(new Set(links).size, 39);
});

test('#958 item 14: JSON-LD fallback preserves the exact signed copy and R3 wording', () => {
  for (const edition of ['ordinary', 'pro'] as const) {
    const webpage = JSON.parse(renderHubJsonLd(edition))['@graph'][0];
    assert.equal(webpage.description, edition === 'pro' ? `Pro · ${description}` : description);
  }
});
