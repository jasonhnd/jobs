/**
 * lex.ts — two offset-preserving views of a source file for the analytics gate.
 *
 *   text  comments replaced by spaces; string literals kept, so a literal
 *         event name or param key can be read back at a known offset.
 *   code  comments AND string / template / regex contents replaced by spaces
 *         (the delimiters stay), so a `gtag` inside a string, a URL or a
 *         comment is not mistaken for a call, and a `,` / `)` / `}` inside a
 *         string cannot end an argument early.
 *
 * Both views have exactly the source's length and keep every newline, so an
 * offset found in `code` is valid in `text` and maps to the same line.
 *
 * Markup files (.astro / .html) are split first: the frontmatter and every
 * `<script>` body are lexed as JS; HTML comments and Astro expression
 * comments (a block comment wrapped in braces) are removed; everything else
 * (markup text, attributes, `<style>`) is left untouched in both views. An
 * apostrophe in prose ("don't") is therefore never read as a string opener,
 * and a `gtag` in markup (an `onclick="…"`) stays visible to the classifier.
 *
 * This is a scanner, not a parser. Where it could still guess wrong — a `/`
 * that is a regex or a division — scan.ts re-checks the raw source (see
 * `hiddenCalls`), so a call the lexer blanked by mistake fails the gate
 * instead of disappearing.
 */

export interface LexedSource {
  readonly text: string;
  readonly code: string;
}

/**
 * Keywords after which a `/` starts a regex. After any other identifier, a
 * number, `)`, `]`, `}` or a postfix `++` / `--`, it is a division.
 */
const REGEX_AFTER_KEYWORD = new Set([
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'void', 'delete',
  'throw', 'yield', 'await', 'instanceof', 'new',
]);

class Views {
  readonly text: string[];
  readonly code: string[];
  constructor(readonly source: string) {
    this.text = source.split('');
    this.code = source.split('');
  }
  blankBoth(from: number, to: number): void {
    for (let k = from; k < to; k++) {
      if (this.source[k] !== '\n') {
        this.text[k] = ' ';
        this.code[k] = ' ';
      }
    }
  }
  blankCode(from: number, to: number): void {
    for (let k = from; k < to; k++) if (this.source[k] !== '\n') this.code[k] = ' ';
  }
}

export function lexSource(source: string, { markup }: { markup: boolean }): LexedSource {
  const views = new Views(source);
  if (markup) lexMarkup(views);
  else lexJs(views, 0, source.length);
  return { text: views.text.join(''), code: views.code.join('') };
}

/** Frontmatter and `<script>` bodies are JS; HTML comments go; the rest is left as is. */
function lexMarkup(views: Views): void {
  const { source } = views;
  let i = 0;
  const front = source.match(/^\s*---[^\n]*\n/);
  if (front) {
    const close = source.indexOf('\n---', front[0].length - 1);
    const end = close < 0 ? source.length : close + 1;
    lexJs(views, front[0].length, end);
    i = end;
  }
  // HTML comments, Astro expression comments (`{` + block comment), and script tags.
  const tag = /<!--|\{\s*\/\*|<script\b[^>]*>/gi;
  tag.lastIndex = i;
  for (let m = tag.exec(source); m; m = tag.exec(source)) {
    const comment = m[0] === '<!--' ? '-->' : m[0].startsWith('{') ? '*/' : null;
    if (comment) {
      const from = m[0] === '<!--' ? m.index : source.indexOf('/*', m.index);
      const end = source.indexOf(comment, from + 2);
      const stop = end < 0 ? source.length : end + comment.length;
      views.blankBoth(from, stop);
      tag.lastIndex = stop;
      continue;
    }
    const bodyStart = m.index + m[0].length;
    const close = source.slice(bodyStart).search(/<\/script\s*>/i);
    const bodyEnd = close < 0 ? source.length : bodyStart + close;
    lexJs(views, bodyStart, bodyEnd);
    tag.lastIndex = bodyEnd;
  }
}

/** Lexes `source[from, to)` as JS / TS. */
function lexJs(views: Views, from: number, to: number): void {
  const { source } = views;
  // Each entry is the brace depth at which a `${` opened inside a template.
  const templateStack: number[] = [];
  let braceDepth = 0;
  // The last significant token: '' at start, 'word', 'keyword-regex', 'postfix', or the punctuator.
  let last = '';
  let i = from;

  const scanQuoted = (quote: string): void => {
    let j = i + 1;
    while (j < to) {
      const ch = source[j]!;
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === quote || ch === '\n') break;
      j++;
    }
    views.blankCode(i + 1, Math.min(j, to));
    i = source[j] === quote ? j + 1 : j;
    last = 'word';
  };

  /** Scans template text from `i`; stops after the closing backtick or after a `${`. */
  const scanTemplate = (): void => {
    const start = i;
    let j = start;
    while (j < to) {
      const ch = source[j]!;
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (ch === '`') {
        views.blankCode(start, j);
        i = j + 1;
        last = 'word';
        return;
      }
      if (ch === '$' && source[j + 1] === '{') {
        views.blankCode(start, j);
        templateStack.push(braceDepth);
        braceDepth++;
        i = j + 2;
        last = '{';
        return;
      }
      j++;
    }
    views.blankCode(start, to);
    i = to;
  };

  const scanRegex = (): void => {
    let j = i + 1;
    let inClass = false;
    while (j < to && source[j] !== '\n') {
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
    views.blankCode(i + 1, Math.min(j, to));
    i = j + 1;
    while (i < to && /[a-z]/i.test(source[i]!)) i++;
    last = 'word';
  };

  const startsRegex = (): boolean =>
    last === '' || last === 'keyword-regex' || (last !== 'word' && last !== 'postfix' && !/^[)\]}]$/.test(last));

  while (i < to) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      let end = source.indexOf('\n', i);
      if (end < 0 || end > to) end = to;
      views.blankBoth(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 || end + 2 > to ? to : end + 2;
      views.blankBoth(i, stop);
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
    if (/[\w$]/.test(ch)) {
      const word = source.slice(i).match(/^[\w$]+/)![0];
      last = REGEX_AFTER_KEYWORD.has(word) ? 'keyword-regex' : 'word';
      i += word.length;
      continue;
    }
    if ((ch === '+' || ch === '-') && next === ch) {
      // `a++ / b` divides; `++a` / `x = ++y` is followed by an operand anyway.
      last = last === 'word' || /^[)\]]$/.test(last) ? 'postfix' : ch;
      i += 2;
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
    if (!/\s/.test(ch)) last = ch;
    i++;
  }
}

/** 1-based line number of `offset`. */
export function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let k = 0; k < offset && k < source.length; k++) if (source[k] === '\n') line++;
  return line;
}
