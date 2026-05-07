/**
 * data.tasks/<padded>.json projection — per docs/DATA_ARCHITECTURE.md §6.3.
 *
 * Status: Future (skipped by default)
 * Consumer: future "task-level AI risk map" page
 *
 * Task-level AI scoring is not yet wired (only scope='occupations' is loaded
 * in indexes.ts). All task-level ai_risk fields are emitted as null until
 * tasks_<model>_<date>.json files appear.
 *
 * Migrated from scripts/projections/tasks.py.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';

export interface TasksBuildResult {
  files: string[];
  dir: string;
  fileCount: number;
}

export async function buildTasks(
  indexes: Indexes,
  distRoot: string,
): Promise<TasksBuildResult> {
  const outDir = join(distRoot, 'data.tasks');
  await mkdir(outDir, { recursive: true });

  const writtenFiles: string[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const tasksPayload = occ.tasks.map((task) => ({
      task_id: task.task_id,
      description_ja: task.description_ja,
      execution_rate: task.execution_rate ?? null,
      importance: task.importance ?? null,
      ai_risk: null,
      ai_rationale_ja: null,
      scored_by: null,
      scored_at: null,
    }));

    const payload = {
      id: occId,
      title_ja: occ.title_ja,
      tasks_lead_ja: occ.tasks_lead_ja ?? null,
      tasks: tasksPayload,
    };
    const padded = String(occId).padStart(4, '0');
    const filePath = join(outDir, `${padded}.json`);
    await writeFile(
      filePath,
      JSON.stringify(payload) + '\n',
      'utf-8',
    );
    writtenFiles.push(filePath);
  }

  return {
    files: writtenFiles,
    dir: outDir,
    fileCount: writtenFiles.length,
  };
}
