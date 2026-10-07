/**
 * lex.ts — two offset-preserving views of a source file for the analytics gate.
 *
 *   text  comments replaced by spaces; string literals kept, so a literal
 *         event name or param key can be read back at a known offset.
 *   code  comments AND string contents replaced by spaces (the quote
 *         characters stay), so a `gtag` inside a string, a URL or a comment
 *         is not mistaken for a call, and a `,` / `)` / `}` inside a string
 *         cannot end an argument early.
 *
 * Both views have exactly the source's length and keep every newline, so an
 * offset found in `code` is valid in `text` and maps to the same line.
 *
 * This is a scanner, not a parser. It knows JS/TS comments, the three quote
 * kinds (with `${…}` nesting in template literals), regex literals, and HTML
 * comments in markup files. A `'` or `"` string stops at a newline, as JS
 * requires, so a stray apostrophe in Astro markup ("don't") can only blank
 * the rest of its own line — and blanking only ever hides text from the
 * scan of literals, never makes an unreadable call look readable: the call
 * classifier treats anything it cannot read as a failure.
 */

export interface LexedSource {
  readonly text: string;
  readonly code: string;
}

/** Characters after which a `/` starts a regex literal rather than a division. */
const REGEX_PRECEDERS = new Set([...'(,=:[!&|?{};+-*%<>~^']);
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|delete|throw|yield|await)$/;

export function lexSource(source: string, { markup }: { markup: boolean }): LexedSource {
  const text = source.split('');
  const code = source.split('');
  const blankBoth = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (source[k] !== '\n') {
        text[k] = ' ';
        code[k] = ' ';
      }
    }
  };
  const blankCode = (from: number, to: number): void => {
    for (let k = from; k < to; k++) if (source[k] !== '\n') code[k] = ' ';
  };

  // Each entry is the brace depth at which a `${` opened inside a template.
  const templateStack: number[] = [];
  let braceDepth = 0;
  let lastSignificant = '';
  let i = 0;

  const scanQuoted = (quote: string): void => {
    // `i` is on the opening quote; leaves `i` after the closing one.
    const start = i + 1;
    let j = start;
    while (j < source.length) {
      const ch = source[j]!;
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === quote || ch === '\n') break;
      j++;
    }
    blankCode(start, Math.min(j, source.length));
    i = source[j] === quote ? j + 1 : j;
    lastSignificant = quote;
  };

  /** Scans template text from `i`; stops after the closing backtick or after a `${`. */
  const scanTemplate = (): void => {
    const start = i;
    let j = start;
    while (j < source.length) {
      const ch = source[j]!;
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === '`') {
        blankCode(start, j);
        i = j + 1;
        lastSignificant = '`';
        return;
      }
      if (ch === '$' && source[j + 1] === '{') {
        blankCode(start, j);
        templateStack.push(braceDepth);
        braceDepth++;
        i = j + 2;
        lastSignificant = '{';
        return;
      }
      j++;
    }
    blankCode(start, source.length);
    i = source.length;
  };

  const scanRegex = (): void => {
    let j = i + 1;
    let inClass = false;
    while (j < source.length && source[j] !== '\n') {
      const ch = source[j]!;
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) break;
      j++;
    }
    blankCode(i + 1, Math.min(j, source.length));
    i = j + 1;
    while (i < source.length && /[a-z]/i.test(source[i]!)) i++;
    lastSignificant = '/';
  };

  const startsRegex = (): boolean => {
    // `</tag>` in markup, never `a < /re/` in code.
    if (source[i - 1] === '<') return false;
    if (lastSignificant === '' || REGEX_PRECEDERS.has(lastSignificant)) return true;
    return REGEX_KEYWORDS.test(source.slice(Math.max(0, i - 12), i).trimEnd());
  };

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (markup && source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      const stop = end < 0 ? source.length : end + 3;
      blankBoth(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end < 0) end = source.length;
      blankBoth(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blankBoth(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"') {
      scanQuoted(ch);
      continue;
    }
    if (ch === '`') {
      i++;
      scanTemplate();
      continue;
    }
    if (ch === '/' && startsRegex()) {
      scanRegex();
      continue;
    }
    if (ch === '{') braceDepth++;
    if (ch === '}') {
      braceDepth--;
      if (templateStack.length > 0 && templateStack[templateStack.length - 1] === braceDepth) {
        templateStack.pop();
        i++;
        scanTemplate();
        continue;
      }
    }
    if (!/\s/.test(ch)) lastSignificant = /[\w$]/.test(ch) ? 'a' : ch;
    i++;
  }
  return { text: text.join(''), code: code.join('') };
}

/** 1-based line number of `offset`. */
export function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let k = 0; k < offset && k < source.length; k++) if (source[k] === '\n') line++;
  return line;
}
