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
import { DESIGN_TOKENS, DESIGN_VERSION, type TokenGroup } from '../design-tokens.js';

export interface SyncProblem {
  readonly kind: 'value' | 'missing-in-module' | 'missing-in-doc' | 'version' | 'parse';
  readonly token: string;
  readonly doc: string;
  readonly module: string;
}

const SECTION = '## §21.2';

/**
 * Until #866 every failure to READ the canon came back as "no problems": a
 * renamed §21.2 heading, an emptied table or a re-spaced version sentence all
 * left the gate with nothing to compare and rc=0. Each of those is now a
 * `parse` problem.
 */
function parseProblem(token: string, doc: string): SyncProblem {
  return { kind: 'parse', token, doc, module: '—' };
}

function sectionText(md: string): string | null {
  const start = md.indexOf(SECTION);
  if (start === -1) return null;
  const next = md.indexOf('\n## ', start + SECTION.length);
  return md.slice(start, next === -1 ? undefined : next);
}

/**
 * `--s-1: 4px` … `--s-8: 64px`（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64） — a
 * range whose middle steps are written only as the bracketed list. Without
 * expanding it `--s-2` … `--s-7` were never compared.
 */
function expandRanges(row: string, out: Map<string, string>, problems: SyncProblem[]): void {
  const re = /`(--[a-z]+-)(\d+):\s*[0-9.]+([a-z%]*)`\s*…\s*`\1(\d+):\s*[^`]+`\s*[（(]([^）)]+)[）)]/g;
  for (const m of row.matchAll(re)) {
    const prefix = m[1] ?? '';
    const lo = Number(m[2]);
    const hi = Number(m[4]);
    const unit = m[3] ?? '';
    const values = (m[5] ?? '').split('/').map((v) => v.trim()).filter((v) => v !== '');
    if (values.length !== hi - lo + 1) {
      problems.push(parseProblem(`${prefix}${lo}…${hi}`, `range lists ${values.length} value(s) for ${hi - lo + 1} step(s)`));
      continue;
    }
    values.forEach((v, i) => {
      const token = `${prefix}${lo + i}`;
      const value = /^[0-9.]+$/.test(v) ? `${v}${unit}` : v;
      const stated = out.get(token);
      if (stated != null && stated !== value) {
        problems.push(parseProblem(token, `endpoint says ${stated}, list says ${value}`));
      }
      out.set(token, value);
    });
  }
}

/**
 * `--sh-card` / `--sh-raised` …（値は §8.3 の表） — named in §21.2 with the
 * value held by another section's table. Resolve the name against any
 * `| \`--name\` | \`value\` |` row in the document.
 */
function resolveByTable(md: string, token: string): string | null {
  const esc = token.replace(/[-]/g, '\\-');
  const m = md.match(new RegExp(`^\\|\\s*\`${esc}\`\\s*\\|\\s*\`([^\`]+)\`\\s*\\|`, 'm'));
  return m ? (m[1] ?? '').trim() : null;
}

/** `--t-h1: 28px` / `--t-h1` … `28px` — §21.2 writes them inside backticks. */
function parseDocTokens(md: string, problems: SyncProblem[]): Map<string, string> {
  const out = new Map<string, string>();
  const section = sectionText(md);
  if (section == null) {
    problems.push(parseProblem(SECTION, 'heading not found in docs/Design.md'));
    return out;
  }
  const rows = section.split('\n').filter((l) => l.startsWith('|'));
  for (const row of rows) {
    for (const m of row.matchAll(/`(--[a-z0-9-]+):\s*([^`]+)`/g)) {
      out.set(m[1] ?? '', (m[2] ?? '').trim());
    }
    expandRanges(row, out, problems);
  }
  for (const row of rows) {
    for (const m of row.matchAll(/`(--[a-z0-9-]+)`/g)) {
      const token = m[1] ?? '';
      if (out.has(token)) continue;
      const value = resolveByTable(md, token);
      if (value == null) problems.push(parseProblem(token, 'named in §21.2 but no value found'));
      else out.set(token, value);
    }
  }
  if (out.size === 0) problems.push(parseProblem(SECTION, 'no `--token: value` pairs parsed'));
  return out;
}

export function findSyncProblems(
  root: string = process.cwd(),
  tokens: TokenGroup = DESIGN_TOKENS,
  version: string = DESIGN_VERSION,
): SyncProblem[] {
  const md = readFileSync(join(root, 'docs/Design.md'), 'utf-8').replace(/\r\n/g, '\n');
  const problems: SyncProblem[] = [];
  const doc = parseDocTokens(md, problems);
  // §21.2 writes shorthand ranges like `--s-1: 4px` … `--s-8: 64px`; compare
  // after collapsing whitespace so 'clamp(32px, 6vw, 40px)' matches either
  // spelling.
  const norm = (v: string): string => v.replace(/\s+/g, ' ').trim();

  for (const [token, docValue] of doc) {
    const mod = tokens[token];
    if (mod == null) {
      problems.push({ kind: 'missing-in-module', token, doc: docValue, module: '—' });
      continue;
    }
    if (norm(mod) !== norm(docValue)) {
      problems.push({ kind: 'value', token, doc: docValue, module: mod });
    }
  }
  // The other direction: a token the module emits that the canon never names.
  if (doc.size > 0) {
    for (const [token, mod] of Object.entries(tokens)) {
      if (!doc.has(token)) problems.push({ kind: 'missing-in-doc', token, doc: '—', module: mod });
    }
  }

  // §20.2 — the version is declared in several places and they must agree.
  // Not finding it is a failure too: it is what a re-spaced sentence looks like.
  const declared = [...md.matchAll(/Design v(\d+\.\d+)（制定/g)].map((m) => m[1] ?? '');
  if (declared.length === 0) {
    problems.push(parseProblem('DESIGN_VERSION', 'no "Design vX.Y（制定" declaration found'));
  }
  for (const d of new Set(declared)) {
    if (d !== version) problems.push({ kind: 'version', token: 'DESIGN_VERSION', doc: d, module: version });
  }
  return problems;
}
