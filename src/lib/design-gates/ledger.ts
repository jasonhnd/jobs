/**
 * design-gates/ledger.ts — read docs/DESIGN_CONFORMANCE.md as data.
 *
 * Design.md §19.1 makes every design gate read the conformance ledger and
 * switch behaviour per surface:
 *
 *   conformant -> fail the build
 *   migrating  -> warn
 *   legacy     -> ignore
 *
 * The ledger is the canon for that state (§20.4) and it only moves one way, so
 * the gates parse it rather than carrying their own copy. If the two ever
 * disagree, the ledger wins and the gate is the bug.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SurfaceState = 'conformant' | 'migrating' | 'legacy';

export interface Surface {
  readonly name: string;
  readonly state: SurfaceState;
  /** Repo-relative paths named in the ledger's 対象ファイル table. */
  readonly files: readonly string[];
}

const LEDGER = 'docs/DESIGN_CONFORMANCE.md';
const STATES: ReadonlySet<string> = new Set(['conformant', 'migrating', 'legacy']);

/** `| \`name\` | … |` → the cells, with backticks and spaces stripped. */
function cells(row: string): string[] {
  return row
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim().replace(/^\*\*|\*\*$/g, ''));
}

function unquote(cell: string): string {
  const m = cell.match(/^`([^`]+)`/);
  return m ? (m[1] ?? '') : cell;
}

export function readLedger(root: string = process.cwd()): Surface[] {
  const text = readFileSync(join(root, LEDGER), 'utf-8').replace(/\r\n/g, '\n');

  // ── state table: | surface | 範囲 | ページ数 | 実装 | 状態 | 備考 |
  const states = new Map<string, SurfaceState>();
  for (const row of text.split('\n')) {
    if (!row.startsWith('| `')) continue;
    const c = cells(row);
    if (c.length < 5) continue;
    const state = unquote(c[4] ?? '');
    if (!STATES.has(state)) continue;
    states.set(unquote(c[0] ?? ''), state as SurfaceState);
  }

  // ── file table: | surface | `a.ts`, `b.ts` |
  const files = new Map<string, string[]>();
  for (const row of text.split('\n')) {
    if (!row.startsWith('| `')) continue;
    const c = cells(row);
    if (c.length !== 2) continue;
    const name = unquote(c[0] ?? '');
    if (!states.has(name)) continue;
    const paths = [...(c[1] ?? '').matchAll(/`([^`]+)`/g)]
      .map((m) => m[1] ?? '')
      .filter((p) => p.startsWith('src/'));
    if (paths.length > 0) files.set(name, paths);
  }

  return [...states].map(([name, state]) => ({
    name,
    state,
    files: files.get(name) ?? [],
  }));
}

/**
 * Which surface owns a file, or null when the ledger assigns it to none.
 *
 * A file can appear under more than one surface (canonical-css.ts is both the
 * `tokens` implementation and the `canonical-type` one). The strictest state
 * wins, so a gate never under-enforces because of an alias.
 */
export function surfaceStateFor(
  relPath: string,
  surfaces: readonly Surface[],
): SurfaceState | null {
  const owning = surfaces.filter((s) => s.files.includes(relPath));
  if (owning.length === 0) return null;
  if (owning.some((s) => s.state === 'conformant')) return 'conformant';
  if (owning.some((s) => s.state === 'migrating')) return 'migrating';
  return 'legacy';
}
