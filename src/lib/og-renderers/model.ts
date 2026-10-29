/**
 * src/lib/og-renderers/model.ts — per-run model share card.
 *
 * `GET /api/og?model=<model@date>` renders the four owner-signed lines
 * through the generic text card. The score histogram is a later card;
 * this adapter does not draw it.
 *
 * Same pre-render shape as sector.ts: trusted-origin timed fetch of
 * `/data.models_by_model.json`, zod validation, own-property run lookup,
 * then model/date/slug consistency (`runSlug` / `runFromSlug`). Unknown,
 * malformed, and bare-model slugs render the home card. Upstream fetch
 * and schema failures stay retriable and are not replaced with that card.
 */

import { fetchJsonWithTimeout } from '../http-client.js';
import {
  ModelsByModelProjectionSchema,
  OG_DATA_FETCH_TIMEOUT_MS,
  trustedFetchOrigin,
} from '../og-helpers.js';
import { formatModelDisplay, isDatedRunSlug, runFromSlug, runSlug } from '../../site/score-attribution.js';
import { formatJapaneseDate, formatProviderDisplay } from '../../views/models.js';
import { PAGE_CARDS } from '../../views/og-cards.js';
import { renderGenericOgCard } from './generic.js';

const MODEL_EYEBROW = 'AIモデル比較 · 未来の仕事';

interface RunRecord {
  readonly slug: string;
  readonly model: string;
  readonly date: string;
}

function modelRunConsistent(
  slug: string,
  record: RunRecord,
  models: Readonly<Record<string, RunRecord>>,
): boolean {
  if (record.slug !== slug) return false;
  const runs: { model: string; runDate: string }[] = [];
  for (const key of Object.keys(models)) {
    if (!Object.hasOwn(models, key)) continue;
    const entry = models[key];
    if (entry === undefined) continue;
    runs.push({ model: entry.model, runDate: entry.date });
  }
  const resolved = runFromSlug(slug, runs);
  if (resolved === null || resolved.model !== record.model || resolved.runDate !== record.date) {
    return false;
  }
  try {
    return runSlug({ model: record.model, runDate: record.date }) === slug;
  } catch {
    return false;
  }
}

export async function renderModelOgCard(url: URL, slug: string): Promise<Response> {
  if (!isDatedRunSlug(slug)) {
    return renderGenericOgCard(PAGE_CARDS.home);
  }

  const modelsUrl = new URL('/data.models_by_model.json', trustedFetchOrigin(url));
  const { response: res, body: projectionRaw } =
    await fetchJsonWithTimeout(modelsUrl.toString(), {}, OG_DATA_FETCH_TIMEOUT_MS);
  if (!res.ok) {
    return new Response('Upstream models fetch failed', { status: 502 });
  }
  const parsed = ModelsByModelProjectionSchema.safeParse(projectionRaw);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      '[og] models projection schema mismatch',
      parsed.error.issues.slice(0, 3),
    );
    return new Response('Upstream models data invalid', { status: 502 });
  }

  const models = parsed.data.models;
  // Own property only: `models['constructor']` / `['__proto__']` / `['toString']`
  // resolve through Object.prototype (#861).
  if (!Object.hasOwn(models, slug)) {
    return renderGenericOgCard(PAGE_CARDS.home);
  }
  const record = models[slug];
  if (record === undefined || !modelRunConsistent(slug, record, models)) {
    // eslint-disable-next-line no-console
    console.error('[og] models projection run identity mismatch');
    return new Response('Upstream models data invalid', { status: 502 });
  }

  const scoringDate = formatJapaneseDate(record.date);
  return renderGenericOgCard({
    eyebrow: MODEL_EYEBROW,
    title: formatModelDisplay(record.model),
    subtitle: formatProviderDisplay(record.provider),
    detail: `採点日 ${scoringDate} · 対象 ${record.covered_count}職業`,
  });
}
