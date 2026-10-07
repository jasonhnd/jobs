/**
 * ast.ts — parses the executable parts of a source file with @babel/parser.
 *
 * The gate used to tell code from strings, comments and regex literals with a
 * hand-written scanner. Every heuristic for `/` (regex or division?) had a
 * counter-example that hid a real call from the gate (review of #868), so the
 * JS itself is now read by a real parser: comments are not in the AST, a
 * string that merely contains `gtag(…)` is a StringLiteral, and a regex is a
 * RegExpLiteral, whatever precedes it.
 *
 * What is parsed:
 *   .ts .tsx .js .jsx .mjs .cjs   the whole file
 *   .astro                        the frontmatter and each `<script>` body
 *   .html                         each `<script>` body
 *
 * Splitting a markup file into those regions is an HTML-level step: find
 * `<!-- … -->`, `{/* … *\/}` and `<script …>…</script>`. The markup between
 * them is not parsed; scan.ts fails the gate if a watched name appears there,
 * so nothing outside a parsed region can send an event unseen.
 *
 * A region that does not parse fails the gate with its file and line.
 */
import { parse } from '@babel/parser';
import type { Node } from '@babel/types';

export interface Region {
  /** Offset of the region's first character in the file. */
  readonly start: number;
  readonly code: string;
}

export interface MarkupSplit {
  readonly regions: readonly Region[];
  /** The file with comments, parsed regions and non-JS scripts blanked; only markup is left. */
  readonly markup: string;
  /** Bodies of `<script type="…">` blocks that are not JS (JSON-LD and the like). */
  readonly dataBlocks: readonly Region[];
}

const NON_JS_SCRIPT = /\btype\s*=\s*["']?(?!(?:text\/javascript|module|application\/javascript)["'\s>])[^"'\s>]+/i;

function blank(chars: string[], source: string, from: number, to: number): void {
  for (let k = from; k < to; k++) if (source[k] !== '\n') chars[k] = ' ';
}

/** Splits an .astro / .html file into JS regions and leftover markup. */
export function splitMarkup(source: string, { frontmatter }: { frontmatter: boolean }): MarkupSplit {
  const regions: Region[] = [];
  const dataBlocks: Region[] = [];
  const markup = source.split('');
  let from = 0;
  const front = frontmatter ? source.match(/^\s*---[^\n]*\n/) : null;
  if (front) {
    const close = source.indexOf('\n---', front[0].length - 1);
    const end = close < 0 ? source.length : close + 1;
    regions.push({ start: front[0].length, code: source.slice(front[0].length, end) });
    blank(markup, source, 0, close < 0 ? end : end + 3);
    from = close < 0 ? end : end + 3;
  }
  const tag = /<!--|\{\s*\/\*|<script\b([^>]*)>/gi;
  tag.lastIndex = from;
  for (let m = tag.exec(source); m; m = tag.exec(source)) {
    if (m[0] === '<!--' || m[0].startsWith('{')) {
      const closer = m[0] === '<!--' ? '-->' : '*/';
      const end = source.indexOf(closer, m.index + m[0].length);
      let stop = end < 0 ? source.length : end + closer.length;
      if (closer === '*/') {
        const brace = source.slice(stop).match(/^\s*\}/);
        if (brace) stop += brace[0].length;
      }
      blank(markup, source, m.index, stop);
      tag.lastIndex = stop;
      continue;
    }
    const bodyStart = m.index + m[0].length;
    if (/\/\s*$/.test(m[1] ?? '')) {
      tag.lastIndex = bodyStart; // `<script … />` (Astro set:html) has no body
      continue;
    }
    const close = source.slice(bodyStart).search(/<\/script\s*>/i);
    const bodyEnd = close < 0 ? source.length : bodyStart + close;
    const region = { start: bodyStart, code: source.slice(bodyStart, bodyEnd) };
    if (NON_JS_SCRIPT.test(m[1] ?? '')) dataBlocks.push(region);
    else regions.push(region);
    blank(markup, source, bodyStart, bodyEnd);
    tag.lastIndex = bodyEnd;
  }
  return { regions, markup: markup.join(''), dataBlocks };
}

export type ParseOutcome =
  | { readonly ok: true; readonly program: Node }
  | { readonly ok: false; readonly offset: number; readonly message: string };

/** Parses one region. Offsets in the returned AST are relative to the region. */
export function parseRegion(region: Region, { jsx }: { jsx: boolean }): ParseOutcome {
  try {
    const file = parse(region.code, {
      sourceType: 'unambiguous',
      plugins: jsx ? ['typescript', 'jsx'] : ['typescript'],
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowUndeclaredExports: true,
      errorRecovery: false,
    });
    return { ok: true, program: file.program };
  } catch (error) {
    const pos = (error as { pos?: number }).pos ?? 0;
    const message = error instanceof Error ? error.message.replace(/\s*\(\d+:\d+\)$/, '') : String(error);
    return { ok: false, offset: pos, message };
  }
}

/**
 * TypeScript nodes that hold runtime code. Every other `TS*` node is a type,
 * so a `gtag` named inside it (`interface Window { gtag: … }`) is not a call.
 */
const TS_CODE_NODES = new Set([
  'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion',
  'TSInstantiationExpression', 'TSModuleDeclaration', 'TSModuleBlock', 'TSEnumDeclaration',
  'TSEnumMember', 'TSExportAssignment', 'TSParameterProperty',
  // `import x = a.b` binds a runtime value; emits.ts reads its moduleReference.
  // `import type x = require('…')` is a type and is skipped in walk().
  'TSImportEqualsDeclaration',
]);
const SKIP_KEYS = new Set([
  'type', 'start', 'end', 'loc', 'range', 'extra', 'leadingComments', 'trailingComments',
  'innerComments', 'typeAnnotation', 'returnType', 'typeParameters', 'typeArguments',
  'superTypeParameters', 'implements',
]);

export interface Visit {
  readonly node: Node;
  readonly parent: Node | null;
  /** The parent's property that holds `node`. */
  readonly key: string;
  readonly ancestors: readonly Node[];
}

/** Depth-first walk over runtime code, skipping type-only subtrees. */
export function walk(root: Node, visit: (v: Visit) => void): void {
  const stack: Node[] = [];
  const go = (node: Node, parent: Node | null, key: string): void => {
    if (node.type.startsWith('TS') && !TS_CODE_NODES.has(node.type)) return;
    if (node.type === 'TSImportEqualsDeclaration' && (node as { importKind?: string }).importKind === 'type') return;
    visit({ node, parent, key, ancestors: stack });
    stack.push(node);
    for (const [childKey, value] of Object.entries(node)) {
      if (SKIP_KEYS.has(childKey)) continue;
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) go(item, node, childKey);
      } else if (isNode(value)) {
        go(value, node, childKey);
      }
    }
    stack.pop();
  };
  go(root, null, '');
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}
