import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface OccExtract {
  readonly id: number;
  readonly text: string;
}

/** Compact scoring extract for one occupation JSON. Sends only stable scoring signal, not the full source file. */
export function extractOcc(raw: Record<string, any>): OccExtract {
  const d = (raw.description ?? {}) as Record<string, string | undefined>;
  const aliases = Array.isArray(raw.aliases_ja) ? (raw.aliases_ja as string[]) : [];
  const text = [
    `職業ID: ${raw.id}`,
    `名称: ${raw.title_ja ?? ''}`,
    aliases.length ? `別名: ${aliases.join('、')}` : '',
    d.summary_ja ? `概要: ${d.summary_ja}` : '',
    d.what_it_is_ja ? `仕事内容:\n${d.what_it_is_ja}` : '',
    d.working_conditions_ja ? `労働条件:\n${d.working_conditions_ja}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { id: Number(raw.id), text };
}

export function loadOccupationExtracts(occDir: string): OccExtract[] {
  return readdirSync(occDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => extractOcc(JSON.parse(readFileSync(join(occDir, f), 'utf8')) as Record<string, any>));
}
