import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DynamicEmitSite, SourceFile, ScanResult } from '../../check-analytics-spec';
import { lexSource, lineOf, type LexedSource } from './lex';
import { readLiteral, readParams, splitTopLevel, type Span } from './calls';

const EVENT_NAME = /^[a-z0-9_]+$/;

export function createScanner(ROOT: string, fail: (message: string) => never) {

  /**
   * Every source file that calls `gtag('event', X, …)` with a non-literal `X`.
   *
   * `wrapper` — the file defines a forwarding function; its literal call sites
   * carry the real event names, so they are read from there.
   * `emits` — the name cannot be recovered statically (read from the DOM, or
   * chosen by a ternary), so the reachable names are declared here.
   *
   * Adding a new dynamic call site without adding it here fails the gate.
   */
  const DYNAMIC_EMIT_SITES: readonly DynamicEmitSite[] = [
    {
      file: 'src/pages/_shindan.js',
      wrapper: 'track',
      why: 'track(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/pages/_map-inline.js',
      wrapper: 'ga',
      why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/pages/_me-inline.js',
      wrapper: 'ga',
      why: 'ga(name, params) forwards to gtag; names are literals at its call sites.',
    },
    {
      file: 'src/components/Footer.astro',
      emits: ['jobtag_outbound_click', 'me_entry_click', 'list_row_click'],
      branchVar: 'name',
      why: 'Reads the name from <a data-track-event>, then builds params per known name.',
    },
    {
      file: 'src/pages/_index-inline.js',
      emits: ['popular_job_click', 'job_search_navigate'],
      why: 'Ternary on `source === "chip"` picks between these two literals.',
    },
  ];

  /**
   * Parameters the Edge middleware sends server-side. They never appear in a
   * `gtag()` call, so they must be read from their own definitions or the gate
   * would report every one of them as an unused dimension.
   *
   * Both anchors are required to resolve; a rename that breaks either one fails
   * the gate rather than silently dropping the parameters it can no longer find.
   */
  const SERVER_PARAM_SOURCE = 'src/lib/middleware/mp-hit.ts';
  const SERVER_PARAM_ANCHORS: readonly { readonly source: string; readonly anchor: string; readonly why: string }[] = [
    {
      source: SERVER_PARAM_SOURCE,
      anchor: 'export function buildMpPayload',
      why: 'the `params:` object of the server-side page_delivery',
    },
    {
      source: 'src/lib/middleware/geo-referral.ts',
      anchor: 'export interface GeoReferralParams',
      why: 'the geo attribution params merged in by attachDeliveryParams',
    },
  ];

  /**
   * The event the Edge middleware emits. It is not a `gtag()` call, so the scan
   * cannot see it and would report it as registered-but-never-sent.
   *
   * Read from the source instead of hard-coded here: renaming the constant in
   * code without updating spec.yaml must fail this gate, not slip past it. That
   * a server-side emit was invisible to every gate is a large part of how
   * `page_view` came to mean two different things for 18 days (#253).
   */
  function serverEventName(): string {
    const full = join(ROOT, SERVER_PARAM_SOURCE);
    if (!existsSync(full)) {
      fail(`${SERVER_PARAM_SOURCE} is missing; the server-side event name cannot be read.`);
    }
    const match = readFileSync(full, 'utf-8').match(
      /export const DELIVERY_EVENT_NAME\s*=\s*['"]([a-z0-9_]+)['"]/,
    );
    if (!match) {
      fail(
        `${SERVER_PARAM_SOURCE} no longer exports a literal DELIVERY_EVENT_NAME — ` +
          `the anchor for the server-side event name. Update serverEventName() in ` +
          `scripts/check-analytics-spec.ts so the middleware emit stays visible.`,
      );
    }
    return match![1]!;
  }

  // ─────────────────────────────── source scanning ───────────────────────────

  function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx|mjs|cjs|astro|html)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          out.push(full);
        }
      }
    };
    walk(join(ROOT, 'src'));
    return out.sort();
  }

  /**
   * Returns the body of the `{…}` that starts at `open`, excluding the braces.
   * Tracks nesting and skips string literals so a `}` inside a string or a nested
   * object does not end the scan early. Returns null if unbalanced.
   */
  function balancedBraceBody(text: string, open: number): string | null {
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < text.length; i++) {
      const ch = text[i]!;
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(open + 1, i);
      }
    }
    return null;
  }

  /** Top-level keys of an object-literal body; nested objects are not descended. */
  function topLevelKeys(body: string): string[] {
    const keys: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let atKeyPosition = true;
    let token = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]!;
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '}' || ch === ']' || ch === ')') depth--;
      else if (depth === 0) {
        if (ch === ',') {
          atKeyPosition = true;
          token = '';
          continue;
        }
        if (ch === ':') {
          if (atKeyPosition) {
            const name = token.trim().replace(/^readonly\s+/, '');
            if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
          }
          atKeyPosition = false;
          token = '';
          continue;
        }
        if (ch === ';') {
          // interface field separator
          const name = token.trim().replace(/^readonly\s+/, '');
          if (/^[a-z_][a-z0-9_]*$/i.test(name)) keys.push(name);
          atKeyPosition = true;
          token = '';
          continue;
        }
        if (atKeyPosition) token += ch;
      }
    }
    const tail = token.trim().replace(/^readonly\s+/, '');
    if (atKeyPosition && /^[a-z_][a-z0-9_]*$/i.test(tail)) keys.push(tail);
    return keys;
  }

  function collectSources(): SourceFile[] {
    return sourceFiles().map((full) => ({
      file: relative(ROOT, full),
      text: readFileSync(full, 'utf-8'),
    }));
  }

  /** Every standalone occurrence of `name` in the code view. */
  function references(code: string, name: string, allowMember: boolean): { start: number; end: number }[] {
    const before = allowMember ? '(?<![\\w$])' : '(?<![\\w$.])';
    const re = new RegExp(`${before}${name}(?![\\w$])`, 'g');
    return [...code.matchAll(re)].map((m) => ({ start: m.index!, end: m.index! + name.length }));
  }

  /** Offset of the `(` when `end` is followed by a call, else -1. */
  function callParen(code: string, end: number): number {
    const gap = code.slice(end).match(/^\s*\(/);
    return gap ? end + gap[0].length - 1 : -1;
  }

  const isDefinition = (code: string, start: number): boolean => /function\s+$/.test(code.slice(0, start));

  /**
   * True for the presence tests the codebase uses before calling gtag —
   * `typeof window.gtag === 'function'`, `if (window.gtag)`, `window.gtag &&` —
   * and for the bootstrap assignment `window.gtag = function gtag() {…}`.
   */
  function isGuardOrAssignment(code: string, start: number, end: number): boolean {
    const before = code.slice(Math.max(0, start - 40), start);
    const after = code.slice(end, end + 8).trimStart();
    if (/typeof\s+(?:window\s*\.\s*)?$/.test(before)) return true;
    if (/^=(?!=)/.test(after)) return true;
    if (/^(?:===|!==|==|!=|&&|\|\||\?(?!\.))/.test(after)) return true;
    return /(?:\bif\s*\(|&&|\|\||!)\s*(?:window\s*\.\s*)?$/.test(before) && /^(?:\)|&&|\|\|)/.test(after);
  }

  interface SourceScan {
    readonly file: string;
    readonly lexed: LexedSource;
    readonly site: DynamicEmitSite | undefined;
    readonly result: ScanResult;
    readonly seenSites: Set<string>;
    readonly unreadable: (offset: number, reason: string) => void;
  }

  /** The event-name argument of a gtag('event', …) or wrapper call. */
  function emitLiteral(scan: SourceScan, args: readonly Span[], nameIndex: number, at: number): string | null {
    const span = args[nameIndex];
    if (!span) {
      scan.unreadable(at, 'an event call without an event name');
      return null;
    }
    const name = readLiteral(scan.lexed, span);
    if (name.kind === 'template') {
      scan.unreadable(at, 'an event name in a template literal');
      return null;
    }
    if (name.kind === 'other') return null;
    if (!EVENT_NAME.test(name.value)) {
      scan.unreadable(at, `invalid GA4 event name "${name.value}" (snake_case [a-z0-9_] only)`);
      return null;
    }
    return name.value;
  }

  function pushEmission(scan: SourceScan, event: string, paramsSpan: Span | undefined, at: number): void {
    const params = readParams(scan.lexed, paramsSpan);
    if (params.kind === 'unreadable') {
      scan.unreadable(at, `${event} is sent with ${params.reason}`);
      return;
    }
    scan.result.emissions.push({ event, params: params.kind === 'object' ? params.keys : [], file: scan.file });
  }

  /** Shapes 1-4 of gtag() — everything else is reported as unreadable. */
  function scanGtagReferences(scan: SourceScan): void {
    const { code } = scan.lexed;
    for (const { start, end } of references(code, 'gtag', true)) {
      if (isDefinition(code, start)) continue;
      const paren = callParen(code, end);
      if (paren < 0) {
        if (!isGuardOrAssignment(code, start, end)) {
          scan.unreadable(start, 'gtag is referenced in a way the gate cannot follow (alias, callback, .call/.apply)');
        }
        continue;
      }
      const args = splitTopLevel(scan.lexed, paren);
      if (!args || args.length === 0) {
        scan.unreadable(start, 'a gtag call the gate cannot split into arguments');
        continue;
      }
      const command = readLiteral(scan.lexed, args[0]!);
      if (command.kind !== 'string') {
        scan.unreadable(start, `a non-literal gtag command${command.kind === 'template' ? ' (template literal)' : ''}`);
        continue;
      }
      if (command.value !== 'event') continue; // config / consent / js / set
      const nameArg = args[1] ? readLiteral(scan.lexed, args[1]) : null;
      if (nameArg?.kind === 'other') {
        scanDynamicEmission(scan);
        continue;
      }
      const event = emitLiteral(scan, args, 1, start);
      if (event) pushEmission(scan, event, args[2], start);
    }
  }

  /** gtag('event', <non-literal>, …) — only allowed in a declared site. */
  function scanDynamicEmission({ file, site, result, seenSites }: SourceScan): void {
    if (!site) {
      result.undeclaredDynamic.push(file);
      return;
    }
    seenSites.add(file);
    for (const event of site.emits ?? []) {
      result.emissions.push({ event, params: [], file });
    }
  }

  /**
   * gtag's own bootstrap defines `window.dataLayer` and pushes `arguments` into
   * it. Any other use writes events the gate never sees.
   */
  function scanDataLayerReferences(scan: SourceScan): void {
    const { code } = scan.lexed;
    for (const { start, end } of references(code, 'dataLayer', true)) {
      const after = code.slice(end, end + 40).trimStart();
      if (/^(?:=(?!=)|\|\||\.\s*push\s*\(\s*arguments\s*\))/.test(after)) continue;
      scan.unreadable(start, 'dataLayer is referenced directly; send events through gtag() so the gate can read them');
    }
  }

  function scanBracketAccess(scan: SourceScan): void {
    for (const m of scan.lexed.text.matchAll(/\[\s*(['"`])(gtag|dataLayer)\1\s*\]/g)) {
      scan.unreadable(m.index!, `${m[2]} through bracket access`);
    }
  }

  /** Wrapper call sites carry the real names and params. */
  function scanWrapperCalls(scan: SourceScan): void {
    const wrapper = scan.site?.wrapper;
    if (!wrapper) return;
    const { code } = scan.lexed;
    for (const { start, end } of references(code, wrapper, false)) {
      if (isDefinition(code, start)) continue;
      const paren = callParen(code, end);
      const args = paren < 0 ? null : splitTopLevel(scan.lexed, paren);
      if (!args) {
        scan.unreadable(start, `${wrapper} is referenced without a readable call`);
        continue;
      }
      const name = args[0] ? readLiteral(scan.lexed, args[0]) : null;
      if (name?.kind !== 'string') {
        scan.unreadable(start, `${wrapper}(…) is called with a non-literal event name`);
        continue;
      }
      const event = emitLiteral(scan, args, 0, start);
      if (event) pushEmission(scan, event, args[1], start);
    }
  }

  /** A site that branches on the event name must declare every branch. */
  function scanDeclaredBranches(scan: SourceScan): void {
    const branchVar = scan.site?.branchVar;
    if (!branchVar) return;
    const declared = new Set(scan.site?.emits ?? []);
    const re = new RegExp(`(?<![\\w$.])${branchVar}\\s*===\\s*(?=['"])`, 'g');
    for (const m of scan.lexed.code.matchAll(re)) {
      const quote = m.index! + m[0].length;
      const literal = scan.lexed.text.slice(quote).match(/^(['"])([^'"\n]*)\1/);
      if (literal && !declared.has(literal[2]!)) {
        scan.unreadable(m.index!, `branches on "${literal[2]}", which DYNAMIC_EMIT_SITES does not declare in emits`);
      }
    }
  }

  function scanSource(
    source: SourceFile,
    site: DynamicEmitSite | undefined,
    result: ScanResult,
    seenSites: Set<string>,
  ): void {
    const lexed = lexSource(source.text, { markup: /\.(astro|html)$/.test(source.file) });
    const scan: SourceScan = {
      file: source.file, lexed, site, result, seenSites,
      unreadable: (offset, reason) =>
        result.unreadable.push(`${source.file}:${lineOf(source.text, offset)}: ${reason}`),
    };
    scanBracketAccess(scan);
    scanGtagReferences(scan);
    scanDataLayerReferences(scan);
    scanWrapperCalls(scan);
    scanDeclaredBranches(scan);
  }

  function validateDynamicEmitSites(seenSites: ReadonlySet<string>): void {
    // A declared site that no longer has a dynamic call is stale — drop it from
    // the registry rather than leaving a rule nobody can trace to code.
    for (const site of DYNAMIC_EMIT_SITES) {
      if (!existsSync(join(ROOT, site.file))) {
        fail(
          `DYNAMIC_EMIT_SITES lists ${site.file}, which does not exist. ` +
            `Remove the entry.`,
        );
      }
      if (!seenSites.has(site.file)) {
        fail(
          `DYNAMIC_EMIT_SITES lists ${site.file}, but it has no dynamic ` +
            `gtag('event', …) call any more. Remove the entry so the registry ` +
            `keeps describing real code.`,
        );
      }
    }
  }

  function scan(sources: readonly SourceFile[]): ScanResult {
    const result: ScanResult = { emissions: [], undeclaredDynamic: [], unreadable: [] };
    const siteByFile = new Map(DYNAMIC_EMIT_SITES.map((s) => [s.file, s]));
    const seenSites = new Set<string>();
    for (const source of sources) {
      scanSource(source, siteByFile.get(source.file), result, seenSites);
    }
    validateDynamicEmitSites(seenSites);
    return { ...result, undeclaredDynamic: [...new Set(result.undeclaredDynamic)] };
  }

  function serverParams(): string[] {
    const params: string[] = [];
    for (const { source, anchor, why } of SERVER_PARAM_ANCHORS) {
      const full = join(ROOT, source);
      if (!existsSync(full)) {
        fail(`${source} is missing; server-side GA4 params cannot be read.`);
      }
      const text = readFileSync(full, 'utf-8');
      const at = text.indexOf(anchor);
      if (at < 0) {
        fail(
          `${source} no longer contains "${anchor}" — the anchor for ` +
            `${why}. It was renamed or removed; update SERVER_PARAM_ANCHORS in ` +
            `scripts/check-analytics-spec.ts so the params stay visible.`,
        );
      }
      const open = text.indexOf('{', at);
      if (open < 0) fail(`No object literal after "${anchor}" in ${source}.`);
      const body = balancedBraceBody(text, open);
      if (body === null) fail(`Unbalanced braces after "${anchor}" in ${source}.`);
      // buildMpPayload nests the params under events[0].params.
      const nested = body.indexOf('params:');
      if (anchor.includes('buildMpPayload')) {
        if (nested < 0) fail(`buildMpPayload no longer has a \`params:\` object.`);
        const nestedOpen = body.indexOf('{', nested);
        const nestedBody = balancedBraceBody(body, nestedOpen);
        if (nestedBody === null) fail(`Unbalanced \`params:\` object in buildMpPayload.`);
        params.push(...topLevelKeys(nestedBody));
      } else {
        params.push(...topLevelKeys(body));
      }
    }
    return params;
  }

  return { collectSources, scan, serverEventName, serverParams, DYNAMIC_EMIT_SITES, SERVER_PARAM_SOURCE };
}
