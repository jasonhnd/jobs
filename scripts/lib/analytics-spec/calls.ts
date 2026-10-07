/**
 * calls.ts — reads the arguments of a call found in a lexed source.
 *
 * Every function here works on the two views from lex.ts: structure (commas,
 * brackets) is read from `code`, where string contents are blanked, and
 * literal values are read back from `text` at the same offsets.
 */
import type { LexedSource } from './lex';

export interface Span {
  readonly start: number;
  readonly end: number;
}

export type LiteralRead =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'template' }
  | { readonly kind: 'other' };

export type ParamsRead =
  | { readonly kind: 'none' }
  | { readonly kind: 'object'; readonly keys: readonly string[] }
  | { readonly kind: 'unreadable'; readonly reason: string };

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
const PARAM_KEY = /^[a-z_][a-z0-9_]*$/i;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Offset of the bracket that closes the one at `open`, or -1. */
export function matchingClose(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i]!;
    if (OPEN.has(ch)) depth++;
    else if (CLOSE.has(ch) && --depth === 0) return i;
  }
  return -1;
}

/**
 * Splits the top-level comma-separated items between the bracket at `open`
 * and its partner. Returns null when the bracket is never closed.
 */
export function splitTopLevel({ code }: LexedSource, open: number): Span[] | null {
  const items: Span[] = [];
  let depth = 0;
  let itemStart = open + 1;
  for (let i = open; i < code.length; i++) {
    const ch = code[i]!;
    if (OPEN.has(ch)) depth++;
    else if (CLOSE.has(ch)) {
      depth--;
      if (depth === 0) {
        // A trailing comma, or no arguments at all, leaves an empty last item.
        const last = { start: itemStart, end: i };
        return code.slice(last.start, last.end).trim() === '' ? items : [...items, last];
      }
    } else if (ch === ',' && depth === 1) {
      items.push({ start: itemStart, end: i });
      itemStart = i + 1;
    }
  }
  return null;
}

/** Classifies one argument as a plain string literal, a template literal, or anything else. */
export function readLiteral({ text, code }: LexedSource, span: Span): LiteralRead {
  const raw = text.slice(span.start, span.end).trim();
  const shape = code.slice(span.start, span.end).trim();
  if (raw.startsWith('`')) return { kind: 'template' };
  const quoted = raw.match(/^(['"])([\s\S]*)\1$/);
  // In the code view a lone literal is just its two quotes around blanks.
  if (quoted && /^(['"])\s*\1$/.test(shape)) return { kind: 'string', value: quoted[2]! };
  return { kind: 'other' };
}

/** Reads the param keys of an optional object-literal argument. */
export function readParams(source: LexedSource, span: Span | undefined): ParamsRead {
  if (!span) return { kind: 'none' };
  const shape = source.code.slice(span.start, span.end);
  const open = shape.indexOf('{');
  if (open < 0 || shape.slice(0, open).trim() !== '') {
    return { kind: 'unreadable', reason: 'params that are not an object literal' };
  }
  const close = matchingClose(source.code, span.start + open);
  if (close < 0) return { kind: 'unreadable', reason: 'an unbalanced params object' };
  // The object must be the whole argument: `{a: 1} && {b: 2}` sends `{b: 2}`.
  if (source.code.slice(close + 1, span.end).trim() !== '') {
    return { kind: 'unreadable', reason: 'params that are not an object literal' };
  }
  const props = splitTopLevel(source, span.start + open)!;
  const keys: string[] = [];
  for (const prop of props) {
    const key = readPropertyKey(source, prop);
    if (key === null) continue;
    if (typeof key === 'object') return key;
    keys.push(key);
  }
  return { kind: 'object', keys };
}

/** A key, null for an empty slot (trailing comma), or the reason it is unreadable. */
function readPropertyKey(
  source: LexedSource,
  prop: Span,
): string | null | { readonly kind: 'unreadable'; readonly reason: string } {
  const shape = source.code.slice(prop.start, prop.end).trim();
  if (shape === '') return null;
  if (shape.startsWith('...') || shape.startsWith('[')) {
    return { kind: 'unreadable', reason: 'params with a spread or computed key' };
  }
  const colon = topLevelColon(shape);
  if (colon < 0) {
    if (IDENTIFIER.test(shape) && PARAM_KEY.test(shape)) return shape; // shorthand `{ item_id }`
    return { kind: 'unreadable', reason: `a params entry the gate cannot read ("${shape.slice(0, 40)}")` };
  }
  const offset = source.code.indexOf(shape, prop.start);
  const keySpan = { start: offset, end: offset + colon };
  const literal = readLiteral(source, keySpan);
  const key = literal.kind === 'string' ? literal.value : source.text.slice(keySpan.start, keySpan.end).trim();
  if (!PARAM_KEY.test(key)) {
    return { kind: 'unreadable', reason: `a params key the gate cannot read ("${key.slice(0, 40)}")` };
  }
  return key;
}

function topLevelColon(shape: string): number {
  let depth = 0;
  for (let i = 0; i < shape.length; i++) {
    const ch = shape[i]!;
    if (OPEN.has(ch)) depth++;
    else if (CLOSE.has(ch)) depth--;
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}
