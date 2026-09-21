/**
 * design-gates/design-sync.ts — Design.md §19.1 `check-design-sync`.
 *
 * Two canons hold the same values (§ 現行契約): design-tokens.ts holds them as
 * data, Design.md §21.2 holds them as a table a human reads. §20.2 adds a third
 * declaration of the version. This gate makes a silent divergence impossible.
 *
 * It parses the canon, not the other way round: the document is the human
 * canon and the module must follow it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_TOKENS, DESIGN_VERSION } from '../design-tokens.js';

export interface SyncProblem {
  readonly kind: 'value' | 'missing-in-module' | 'missing-in-doc' | 'version';
  readonly token: string;
  readonly doc: string;
  readonly module: string;
}

/** `--t-h1: 28px` / `--t-h1` … `28px` — §21.2 writes them inside backticks. */
function parseDocTokens(md: string): Map<string, string> {
  const start = md.indexOf('## §21.2');
  const end = md.indexOf('## §21.3', start === -1 ? 0 : start);
  const section = start === -1 ? '' : md.slice(start, end === -1 ? undefined : end);
  const out = new Map<string, string>();
  for (const m of section.matchAll(/`(--[a-z0-9-]+):\s*([^`]+)`/g)) {
    out.set(m[1] ?? '', (m[2] ?? '').trim());
  }
  return out;
}

export function findSyncProblems(root: string = process.cwd()): SyncProblem[] {
  const md = readFileSync(join(root, 'docs/Design.md'), 'utf-8').replace(/\r\n/g, '\n');
  const doc = parseDocTokens(md);
  const problems: SyncProblem[] = [];

  for (const [token, docValue] of doc) {
    const mod = DESIGN_TOKENS[token];
    if (mod == null) {
      problems.push({ kind: 'missing-in-module', token, doc: docValue, module: '—' });
      continue;
    }
    // §21.2 writes shorthand ranges like `--s-1: 4px` … `--s-8: 64px`; compare
    // after collapsing whitespace so 'clamp(32px, 6vw, 40px)' matches either
    // spelling.
    const norm = (v: string): string => v.replace(/\s+/g, ' ').trim();
    if (norm(mod) !== norm(docValue)) {
      problems.push({ kind: 'value', token, doc: docValue, module: mod });
    }
  }

  // §20.2 — the version is declared in three places and they must agree.
  const declared = md.match(/Design v(\d+\.\d+)（制定/)?.[1];
  if (declared != null && declared !== DESIGN_VERSION) {
    problems.push({ kind: 'version', token: 'DESIGN_VERSION', doc: declared, module: DESIGN_VERSION });
  }
  return problems;
}
