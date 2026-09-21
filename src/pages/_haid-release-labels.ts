/**
 * Read every release payload's label_ja so the switcher can name the other
 * rounds. Page-local sibling (underscore → not routed).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HaidReleasePayload } from '../site/haid-release-types.js';
import type { ReleaseLabels } from '../views/haid-release.js';

export async function loadHaidReleasePayload(release: string): Promise<HaidReleasePayload> {
  return JSON.parse(await readFile(join(process.cwd(), 'public', `data.haid-${release}.json`), 'utf-8'));
}

export async function loadHaidReleaseLabels(releases: readonly string[]): Promise<ReleaseLabels> {
  const entries = await Promise.all(releases.map(async (id) => [id, (await loadHaidReleasePayload(id)).label_ja] as const));
  return Object.fromEntries(entries);
}
