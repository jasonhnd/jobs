import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildIndexes, type Indexes } from '../lib/indexes.js';
import { listOccupationRuns } from '../../site/occupation-runs.js';
import { buildScoreHistoryPayload } from './score-history.js';

let fixturePromise: Promise<{ indexes: Indexes; payload: ReturnType<typeof buildScoreHistoryPayload> }> | null = null;

async function fixture() {
  if (!fixturePromise) {
    fixturePromise = (async () => {
      const { indexes, errors } = await buildIndexes();
      assert.deepEqual(errors, []);
      return {
        indexes,
        payload: buildScoreHistoryPayload(indexes),
      };
    })();
  }
  return fixturePromise;
}

describe('score-history projection', () => {
  test('emits the latest-score occupation universe with shorter legacy gaps preserved', async () => {
    const { indexes, payload } = await fixture();
    const histories = Object.values(payload);
    const runCount = listOccupationRuns().length;
    const sourceLengths = [...indexes.historyByOcc.values()].map((history) => history.length);

    assert.equal(Object.keys(payload).length, 556);
    assert.equal(histories.length, sourceLengths.length);
    assert.equal(Math.max(...histories.map((history) => history.length)), runCount);
    assert.deepEqual(
      histories.map((history) => history.length).sort((a, b) => a - b),
      sourceLengths.sort((a, b) => a - b),
    );
  });

  test('occupation 1 carries every known batch in date order', async () => {
    const { indexes, payload } = await fixture();
    const history = payload['1'];
    const sourceHistory = indexes.historyByOcc.get(1);

    assert.ok(history);
    assert.ok(sourceHistory);
    assert.deepEqual(history.map((entry) => entry.model), sourceHistory.map((entry) => entry.model));
    assert.deepEqual(history.map((entry) => entry.date), sourceHistory.map((entry) => entry.date));
    assert.deepEqual(
      history.map((entry) => entry.transformation),
      sourceHistory.map((entry) => entry.aiois?.transformation ?? entry.ai_risk),
    );
  });

  test('legacy entries use null AIOIS fields while AIOIS entries expose all ten dims', async () => {
    const { payload } = await fixture();
    const history = payload['1']!;
    const legacy = history[0]!;
    const opus48 = history[1]!;

    assert.equal(legacy.displacement, null);
    assert.equal(legacy.dims, null);

    assert.equal(typeof opus48.displacement, 'number');
    assert.ok(opus48.dims);
    assert.deepEqual(Object.keys(opus48.dims).sort(), ['d1', 'd10', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9']);
  });

  test('does not expose rationale_ja anywhere', async () => {
    const { payload } = await fixture();
    assert.equal(JSON.stringify(payload).includes('rationale_ja'), false);
  });

  test('uses the AIOIS Transformation field for AIOIS projection rows', () => {
    const sourceEntry = {
      model: 'fixture-model',
      date: '2026-07-17',
      ai_risk: 4.5,
      rationale_ja: 'fixture',
      confidence: 0.8,
      aiois: {
        d1: 4.8, d2: 4.4, d3: 5, d4: 6.5, d5: 5.8,
        d6: 3, d7: 4.2, d8: 3.6, d9: 2.8, d10: 3.5,
        transformation: 4.6,
        displacement: 1.7,
      },
    };
    const indexes = {
      latestScoreByOcc: new Map([[42, sourceEntry]]),
      historyByOcc: new Map([[42, [sourceEntry]]]),
    } as unknown as Indexes;

    const payload = buildScoreHistoryPayload(indexes);
    assert.equal(payload['42']?.[0]?.transformation, 4.6);
  });

  test('entries are ordered by run date ascending for every occupation', async () => {
    const { payload } = await fixture();
    for (const [occId, history] of Object.entries(payload)) {
      for (let i = 1; i < history.length; i += 1) {
        assert.ok(
          history[i - 1]!.date <= history[i]!.date,
          `history for occupation ${occId} is not sorted`,
        );
      }
    }
  });
});
