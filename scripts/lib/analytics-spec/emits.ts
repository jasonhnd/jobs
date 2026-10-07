/**
 * emits.ts — finds what a source file sends to GA4, from its AST.
 *
 * Readable shapes:
 *   gtag('event', 'literal_name', { key: value, … })     window.gtag(…) too
 *   gtag('event', <non-literal>, …)                       only in a declared site
 *   wrapper('literal_name', { … })                        in a declared wrapper site
 *
 * Everything else that touches `gtag` / `dataLayer` / a declared wrapper is
 * reported as unreadable — the gate fails rather than guessing. Allowed
 * without being a call: the bootstrap (`function gtag`, `window.gtag = …`,
 * `window.dataLayer = window.dataLayer || []`, `dataLayer.push(arguments)`),
 * `typeof gtag`, and presence tests such as `if (window.gtag)`.
 */
import type { Node } from '@babel/types';
import type { DynamicEmitSite, Emission } from '../../check-analytics-spec';
import { parseRegion, splitMarkup, walk, type Region, type Visit } from './ast';

const EVENT_NAME = /^[a-z0-9_]+$/;
const PARAM_KEY = /^[a-z_][a-z0-9_]*$/i;
const WATCHED = /(?<![\w$])(gtag|dataLayer)(?![\w$])/g;

export interface SourceAnalysis {
  readonly emissions: Emission[];
  /** True when a declared site's dynamic gtag('event', <non-literal>) call was seen. */
  dynamicSeen: boolean;
  /** True when an undeclared file has a dynamic gtag('event', <non-literal>) call. */
  undeclaredDynamic: boolean;
  /** File offset and reason, one per call the gate cannot read. */
  readonly unreadable: { readonly offset: number; readonly reason: string }[];
}

interface Context {
  readonly file: string;
  readonly site: DynamicEmitSite | undefined;
  readonly out: SourceAnalysis;
  /** Region start, so AST offsets map back to the file. */
  readonly base: number;
}

type AnyNode = Node & Record<string, unknown>;

export function analyseSource(file: string, text: string, site: DynamicEmitSite | undefined): SourceAnalysis {
  const out: SourceAnalysis = { emissions: [], dynamicSeen: false, undeclaredDynamic: false, unreadable: [] };
  const markup = /\.(astro|html)$/.test(file);
  if (!markup) {
    analyseRegion({ file, site, out, base: 0 }, { start: 0, code: text }, /\.(tsx|jsx)$/.test(file));
    return out;
  }
  const split = splitMarkup(text, { frontmatter: file.endsWith('.astro') });
  for (const region of split.regions) analyseRegion({ file, site, out, base: region.start }, region, false);
  // Outside a parsed region nothing can be read, so any mention there fails.
  for (const m of split.markup.matchAll(WATCHED)) {
    out.unreadable.push({ offset: m.index!, reason: `${m[1]} outside a <script> block the gate can parse` });
  }
  for (const block of split.dataBlocks) {
    for (const m of block.code.matchAll(WATCHED)) {
      out.unreadable.push({ offset: block.start + m.index!, reason: `${m[1]} inside a non-JS <script> block` });
    }
  }
  return out;
}

function analyseRegion(ctx: Context, region: Region, jsx: boolean): void {
  const parsed = parseRegion(region, { jsx });
  if (!parsed.ok) {
    ctx.out.unreadable.push({ offset: region.start + parsed.offset, reason: `cannot be parsed (${parsed.message})` });
    return;
  }
  walk(parsed.program, (v) => visit(ctx, v));
}

const at = (ctx: Context, node: Node): number => ctx.base + (node.start ?? 0);
const unreadable = (ctx: Context, node: Node, reason: string): void => {
  ctx.out.unreadable.push({ offset: at(ctx, node), reason });
};

function visit(ctx: Context, v: Visit): void {
  const node = v.node as AnyNode;
  if (isCall(node)) {
    const callee = unwrapParens(node.callee as AnyNode);
    if (isNamed(callee, 'gtag')) return analyseGtagCall(ctx, node);
    if (ctx.site?.wrapper && callee.type === 'Identifier' && callee.name === ctx.site.wrapper) {
      return analyseWrapperCall(ctx, node);
    }
  }
  if (node.type === 'BinaryExpression') checkBranch(ctx, node);
  const name = referencedName(node, v.parent as AnyNode | null, v.key);
  if (!name) return;
  if (name === 'gtag' && !isAllowedGtagReference(node, v)) {
    unreadable(ctx, node, 'gtag is referenced in a way the gate cannot follow (alias, callback, .call/.apply, bracket access)');
  } else if (name === 'dataLayer' && !isAllowedDataLayerReference(node, v)) {
    unreadable(ctx, node, 'dataLayer is referenced directly; send events through gtag() so the gate can read them');
  } else if (node.type === 'Identifier' && name === ctx.site?.wrapper && !isWrapperCallOrDefinition(node, v)) {
    unreadable(ctx, node, `${name} is referenced without a readable call`);
  }
}

// ───────────────────────────── node helpers ──────────────────────────────

function isCall(node: AnyNode): boolean {
  return node.type === 'CallExpression' || node.type === 'OptionalCallExpression';
}

function unwrapParens(node: AnyNode): AnyNode {
  return node.type === 'ParenthesizedExpression' ? unwrapParens(node.expression as AnyNode) : node;
}

function stringValue(node: AnyNode | undefined): string | null {
  return node?.type === 'StringLiteral' ? (node.value as string) : null;
}

/** `gtag`, `window.gtag`, `x?.gtag` — but not `window['gtag']`, which is reported. */
function isNamed(node: AnyNode, name: string): boolean {
  if (node.type === 'Identifier') return node.name === name;
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const property = node.property as AnyNode;
    return !node.computed && property.type === 'Identifier' && property.name === name;
  }
  return false;
}

/**
 * The watched name a node refers to, if the node is the whole reference:
 * the Identifier `gtag`, or the member expression `window.gtag` /
 * `window['gtag']` (not the `gtag` property identifier inside it).
 */
function referencedName(node: AnyNode, parent: AnyNode | null, key: string): string | null {
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const property = node.property as AnyNode;
    if (!node.computed && property.type === 'Identifier') return property.name as string;
    return stringValue(property);
  }
  if (node.type !== 'Identifier') return null;
  if (parent && (parent.type === 'MemberExpression' || parent.type === 'OptionalMemberExpression')
      && key === 'property' && !parent.computed) return null;
  if (parent && (parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod'
      || parent.type === 'ClassProperty' || parent.type === 'ClassMethod')
      && key === 'key' && !parent.computed) return null;
  return node.name as string;
}

const parentOf = (v: Visit, up = 1): AnyNode | null => (v.ancestors[v.ancestors.length - up] as AnyNode) ?? null;

function isAssignmentTarget(node: AnyNode, parent: AnyNode | null): boolean {
  return parent?.type === 'AssignmentExpression' && parent.left === node && parent.operator === '=';
}

function isDefinitionName(node: AnyNode, parent: AnyNode | null): boolean {
  return (parent?.type === 'FunctionDeclaration' || parent?.type === 'FunctionExpression') && parent.id === node;
}

/**
 * `typeof gtag`, `if (window.gtag)`, `window.gtag && …`, `!window.gtag || …`.
 * Climbs through `!` and `&&` / `||` to a test position; a reference that is
 * the left operand of `&&` only guards what follows.
 */
function isPresenceTest(node: AnyNode, v: Visit): boolean {
  let child: AnyNode = node;
  for (let up = 1; up <= v.ancestors.length; up++) {
    const parent = parentOf(v, up)!;
    if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') return true;
    if (parent.type === 'UnaryExpression' && parent.operator === '!') {
      child = parent;
      continue;
    }
    if (parent.type === 'LogicalExpression') {
      if (parent.operator === '&&' && parent.left === child) return true;
      child = parent;
      continue;
    }
    if (parent.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator as string)) return true;
    return ['IfStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ConditionalExpression']
      .includes(parent.type) && parent.test === child;
  }
  return false;
}

function isAllowedGtagReference(node: AnyNode, v: Visit): boolean {
  const parent = parentOf(v);
  if (node.type === 'MemberExpression' && node.computed) return false; // window['gtag']
  if (parent && isCall(parent) && parent.callee === node) return true; // analysed as a call
  if (isDefinitionName(node, parent) || isAssignmentTarget(node, parent)) return true;
  return isPresenceTest(node, v);
}

/** `window.dataLayer = window.dataLayer || []` and `window.dataLayer.push(arguments)`. */
function isAllowedDataLayerReference(node: AnyNode, v: Visit): boolean {
  const parent = parentOf(v);
  if (node.type === 'MemberExpression' && node.computed) return false;
  if (isAssignmentTarget(node, parent)) return true;
  if (parent?.type === 'LogicalExpression' && parent.operator === '||' && parent.left === node) {
    const assign = parentOf(v, 2);
    const target = assign?.type === 'AssignmentExpression' ? (assign.left as AnyNode) : null;
    return assign?.right === parent && target !== null && isNamed(target, 'dataLayer');
  }
  const call = parentOf(v, 2);
  if (parent?.type === 'MemberExpression' && parent.object === node && isNamed(parent, 'push')
      && call && isCall(call) && call.callee === parent) {
    const args = call.arguments as AnyNode[];
    return args.length === 1 && args[0]!.type === 'Identifier' && args[0]!.name === 'arguments';
  }
  return false;
}

function isWrapperCallOrDefinition(node: AnyNode, v: Visit): boolean {
  const parent = parentOf(v);
  return isDefinitionName(node, parent) || (parent !== null && isCall(parent) && parent.callee === node);
}

// ───────────────────────────── call analysis ─────────────────────────────

function analyseGtagCall(ctx: Context, call: AnyNode): void {
  const args = call.arguments as AnyNode[];
  const command = args[0];
  if (!command || command.type === 'SpreadElement') {
    return unreadable(ctx, call, 'a gtag call without a literal command');
  }
  const commandValue = stringValue(command);
  if (commandValue === null) {
    const template = command.type === 'TemplateLiteral' ? ' (template literal)' : '';
    return unreadable(ctx, call, `a non-literal gtag command${template}`);
  }
  if (commandValue !== 'event') return; // config / consent / js / set
  const name = args[1];
  if (name && name.type !== 'StringLiteral' && name.type !== 'TemplateLiteral' && name.type !== 'SpreadElement') {
    return dynamicEmission(ctx);
  }
  const event = readEventName(ctx, call, name);
  if (event) pushEmission(ctx, call, event, args[2]);
}

/** gtag('event', <non-literal>, …) — allowed only in a declared site. */
function dynamicEmission({ site, out, file }: Context): void {
  if (!site) {
    out.undeclaredDynamic = true;
    return;
  }
  out.dynamicSeen = true;
  for (const event of site.emits ?? []) out.emissions.push({ event, params: [], file });
}

function analyseWrapperCall(ctx: Context, call: AnyNode): void {
  const args = call.arguments as AnyNode[];
  if (stringValue(args[0]) === null) {
    return unreadable(ctx, call, `${ctx.site!.wrapper}(…) is called with a non-literal event name`);
  }
  const event = readEventName(ctx, call, args[0]);
  if (event) pushEmission(ctx, call, event, args[1]);
}

function readEventName(ctx: Context, call: AnyNode, name: AnyNode | undefined): string | null {
  if (!name) {
    unreadable(ctx, call, 'an event call without an event name');
    return null;
  }
  if (name.type === 'TemplateLiteral') {
    unreadable(ctx, call, 'an event name in a template literal');
    return null;
  }
  const value = stringValue(name);
  if (value === null) {
    unreadable(ctx, call, 'a non-literal event name');
    return null;
  }
  if (!EVENT_NAME.test(value)) {
    unreadable(ctx, call, `invalid GA4 event name "${value}" (snake_case [a-z0-9_] only)`);
    return null;
  }
  return value;
}

function pushEmission(ctx: Context, call: AnyNode, event: string, params: AnyNode | undefined): void {
  const keys = readParams(params);
  if (typeof keys === 'string') return unreadable(ctx, call, `${event} is sent with ${keys}`);
  ctx.out.emissions.push({ event, params: keys, file: ctx.file });
}

/** Param keys of a whole object literal, or the reason they cannot be read. */
function readParams(params: AnyNode | undefined): string[] | string {
  if (!params) return [];
  const object = unwrapParens(params);
  if (object.type !== 'ObjectExpression') return 'params that are not an object literal';
  const keys: string[] = [];
  for (const prop of object.properties as AnyNode[]) {
    if (prop.type === 'SpreadElement' || prop.computed) return 'params with a spread or computed key';
    if (prop.type !== 'ObjectProperty') return 'a params entry the gate cannot read (method)';
    const key = prop.key as AnyNode;
    const name = key.type === 'Identifier' ? (key.name as string) : stringValue(key);
    if (name === null || !PARAM_KEY.test(name)) {
      return `a params key the gate cannot read ("${String(name ?? key.type).slice(0, 40)}")`;
    }
    keys.push(name);
  }
  return keys;
}

/** A site that branches on the event name (`name === '…'`) must declare every branch. */
function checkBranch(ctx: Context, node: AnyNode): void {
  const branchVar = ctx.site?.branchVar;
  if (!branchVar || (node.operator !== '===' && node.operator !== '==')) return;
  const [left, right] = [node.left as AnyNode, node.right as AnyNode];
  const literal = left.type === 'Identifier' && left.name === branchVar ? stringValue(right)
    : right.type === 'Identifier' && right.name === branchVar ? stringValue(left) : null;
  if (literal !== null && !(ctx.site?.emits ?? []).includes(literal)) {
    unreadable(ctx, node, `branches on "${literal}", which DYNAMIC_EMIT_SITES does not declare in emits`);
  }
}

/** 1-based line number of `offset`. */
export function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let k = 0; k < offset && k < source.length; k++) if (source[k] === '\n') line++;
  return line;
}
