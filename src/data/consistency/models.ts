/** L3 consistency checks for models projections. */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ModelsByModelProjectionSchema, ModelsDeepProjectionSchema, ScoreHistoryProjectionSchema } from '../../lib/projection-schemas.js';
import { readJsonOrFail, type Report } from './shared.js';

const MODELS_DEEP_MAX_BYTES = 30 * 1024;

const MODELS_BY_MODEL_PAGE_MAX_BYTES = 24 * 1024;

function containsForbiddenKey(value: unknown, forbiddenKey: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenKey(item, forbiddenKey));
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === forbiddenKey) return true;
      if (containsForbiddenKey(child, forbiddenKey)) return true;
    }
  }
  return false;
}

export async function checkScoreHistory(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const f = join(distRoot, 'data.score_history.json');
  if (!existsSync(f)) return;

  const result = await readJsonOrFail<unknown>(r, f, `data.score_history.json invalid JSON`);
  if (!result.ok) return;
  const data = result.data;

  const parsed = ScoreHistoryProjectionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    r.fail(
      `data.score_history.json schema invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : parsed.error.message}`,
    );
    return;
  }

  if (containsForbiddenKey(parsed.data, 'rationale_ja')) {
    r.fail('data.score_history.json must not contain rationale_ja');
  }

  const actualIds = new Set(Object.keys(parsed.data).map((id) => Number.parseInt(id, 10)));
  if (actualIds.size !== expectedIds.size) {
    r.fail(`data.score_history.json key count (${actualIds.size}) != total source occupations (${expectedIds.size})`);
  }
  const missing: number[] = [];
  for (const id of expectedIds) if (!actualIds.has(id)) missing.push(id);
  const extra: number[] = [];
  for (const id of actualIds) if (!expectedIds.has(id)) extra.push(id);
  if (missing.length > 0) r.fail(`data.score_history.json missing ids: ${missing.slice(0, 5).join(', ')}`);
  if (extra.length > 0) r.fail(`data.score_history.json has unknown ids: ${extra.slice(0, 5).join(', ')}`);

  let entries = 0;
  for (const [occId, history] of Object.entries(parsed.data)) {
    entries += history.length;
    for (let i = 1; i < history.length; i += 1) {
      if (history[i - 1]!.date > history[i]!.date) {
        r.fail(`data.score_history.json id=${occId} entries are not ordered by date ascending`);
        break;
      }
    }
    for (const [idx, entry] of history.entries()) {
      if (entry.dims != null && Object.keys(entry.dims).length !== 10) {
        r.fail(`data.score_history.json id=${occId}[${idx}] dims must have all 10 dimensions`);
      }
    }
  }

  r.note(`score_history: ${actualIds.size} occupations, ${entries} entries`);
}

export async function checkModelsDeep(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const f = join(distRoot, 'data.models_deep.json');
  if (!existsSync(f)) return;

  const bytes = statSync(f).size;
  if (bytes > MODELS_DEEP_MAX_BYTES) {
    r.fail(`data.models_deep.json is ${bytes} bytes, expected <= ${MODELS_DEEP_MAX_BYTES}`);
  }

  const result = await readJsonOrFail<unknown>(r, f, `data.models_deep.json invalid JSON`);
  if (!result.ok) return;
  const data = result.data;

  const parsed = ModelsDeepProjectionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    r.fail(
      `data.models_deep.json schema invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : parsed.error.message}`,
    );
    return;
  }

  const referencedIds = [
    ...parsed.data.consensus.map((row) => row.id),
    ...parsed.data.stories.map((story) => story.id),
  ];
  for (const id of referencedIds) {
    if (!expectedIds.has(id)) {
      r.fail(`data.models_deep.json references unknown occupation id: ${id}`);
    }
  }

  if (new Set(parsed.data.stories.map((story) => story.id)).size !== parsed.data.stories.length) {
    r.fail('data.models_deep.json stories contain duplicate occupation ids');
  }

  r.note(
    `models_deep: lanes=${parsed.data.lanes.length} panel=${parsed.data.panel.entries.length} consensus=${parsed.data.consensus.length} stories=${parsed.data.stories.length} bytes=${bytes}`,
  );
}

export async function checkModelsByModel(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const f = join(distRoot, 'data.models_by_model.json');
  if (!existsSync(f)) return;

  const result = await readJsonOrFail<unknown>(r, f, `data.models_by_model.json invalid JSON`);
  if (!result.ok) return;
  const data = result.data;

  const parsed = ModelsByModelProjectionSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    r.fail(
      `data.models_by_model.json schema invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : parsed.error.message}`,
    );
    return;
  }

  if (containsForbiddenKey(parsed.data, 'rationale_ja')) {
    r.fail('data.models_by_model.json must not contain rationale_ja');
  }

  let maxPageBytes = 0;
  for (const [slug, model] of Object.entries(parsed.data.models)) {
    const pageBytes = Buffer.byteLength(JSON.stringify(model), 'utf-8');
    maxPageBytes = Math.max(maxPageBytes, pageBytes);
    if (pageBytes > MODELS_BY_MODEL_PAGE_MAX_BYTES) {
      r.fail(`data.models_by_model.json ${slug} page payload is ${pageBytes} bytes, expected <= ${MODELS_BY_MODEL_PAGE_MAX_BYTES}`);
    }
    if (model.slug !== slug) {
      r.fail(`data.models_by_model.json key ${slug} does not match inner slug ${model.slug}`);
    }
    const histogramCount = model.distribution.histogram.reduce((sum, bin) => sum + bin.count, 0);
    if (histogramCount !== model.covered_count) {
      r.fail(`data.models_by_model.json ${slug} histogram count ${histogramCount} != covered_count ${model.covered_count}`);
    }
    for (const row of [...model.highest, ...model.lowest]) {
      if (!expectedIds.has(row.id)) {
        r.fail(`data.models_by_model.json ${slug} references unknown occupation id: ${row.id}`);
      }
    }
    if (!('baseline' in model.drift)) {
      for (const row of [...model.drift.movers, ...model.drift.band_crossings]) {
        if (!expectedIds.has(row.id)) {
          r.fail(`data.models_by_model.json ${slug} drift references unknown occupation id: ${row.id}`);
        }
      }
    }
  }

  r.note(`models_by_model: models=${Object.keys(parsed.data.models).length} max_page_bytes=${maxPageBytes}`);
}
