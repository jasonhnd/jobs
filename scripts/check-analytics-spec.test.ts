import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures: string[] = [];
const events = [
  'literal_event', 'track_event', 'map_event', 'me_event',
  'jobtag_outbound_click', 'me_entry_click', 'list_row_click',
  'popular_job_click', 'job_search_navigate', 'page_delivery',
];
const dimensions = ['item_id', 'group_id', 'delivery_kind', 'referral_kind'];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function write(root: string, file: string, text: string): void {
  const full = join(root, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function spec(eventNames = events, parameterNames = dimensions): string {
  return [
    'events:', ...eventNames.map((name) => `  - name: ${name}`),
    'event_scoped_dimensions:',
    ...parameterNames.flatMap((name) => [
      `  - parameter_name: ${name}`, `    display_name: ${name}`, '    description: Fixture',
    ]),
    'user_scoped_dimensions:', '',
  ].join('\n');
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'jobs-analytics-spec-'));
  fixtures.push(root);
  for (const file of [
    'scripts/check-analytics-spec.ts',
    'scripts/lib/analytics-spec/scan.ts',
    'scripts/lib/analytics-spec/spec.ts',
    'scripts/lib/analytics-spec/compare.ts',
    'scripts/lib/analytics-spec/lex.ts',
    'scripts/lib/analytics-spec/calls.ts',
    'analytics/ga4-spec-validation.mjs',
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(REPO, file), join(root, file));
  }
  write(root, 'analytics/spec.yaml', spec());
  write(root, 'src/literal.ts',
    "gtag('event', 'literal_event', {item_id: 'fixture', page_title: 'A } title', value: {nested_key: true}});");
  for (const [file, wrapper, event] of [
    ['_shindan.js', 'track', 'track_event'],
    ['_map-inline.js', 'ga', 'map_event'],
    ['_me-inline.js', 'ga', 'me_event'],
  ]) {
    write(root, `src/pages/${file}`,
      `function ${wrapper}(name, params) { gtag('event', name, params); }\n` +
      `${wrapper}('${event}', {group_id: 'fixture'});`);
  }
  write(root, 'src/components/Footer.astro', "gtag('event', eventName);");
  write(root, 'src/pages/_index-inline.js',
    "gtag('event', source === 'chip' ? 'popular_job_click' : 'job_search_navigate');");
  write(root, 'src/lib/middleware/mp-hit.ts', [
    "export const DELIVERY_EVENT_NAME = 'page_delivery';",
    "export function buildMpPayload() { return {events: [{params: {delivery_kind: 'fixture'}}]}; }",
  ].join('\n'));
  write(root, 'src/lib/middleware/geo-referral.ts',
    'export interface GeoReferralParams { referral_kind: string; }');
  // Tests are deliberately not executable source for the gate.
  write(root, 'src/ignored.test.ts', "gtag('event', 'must_be_ignored', {unknown_param: true});");
  return root;
}

function run(root: string) {
  return spawnSync(process.execPath, [join(root, 'scripts/check-analytics-spec.ts')], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
}

function rejects(root: string, diagnostic: string | RegExp): void {
  const result = run(root);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^\[check-analytics-spec\] FAIL:/);
  if (typeof diagnostic === 'string') assert.ok(result.stderr.includes(diagnostic), result.stderr);
  else assert.match(result.stderr, diagnostic);
}

describe('check-analytics-spec CLI regression contract', () => {
  test('accepts literals, all dynamic shapes, server params and built-ins with exact output', () => {
    const result = run(fixture());
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, [
      '[check-analytics-spec] OK — 10 events / 6 params match analytics/spec.yaml (5 dynamic emit sites declared).',
      '[check-analytics-spec] GA4 event-dimension headroom: 46 (4/50 declared in spec).',
      '[check-analytics-spec] Not checked here: whether the GA4 property matches this spec. Verify with `node analytics/setup-ga4.mjs --check` (read-only, needs credentials); apply with the same script without --check.',
      '',
    ].join('\n'));
  });

  test('rejects a missing spec and a missing spec section', () => {
    const root = fixture();
    rmSync(join(root, 'analytics/spec.yaml'));
    rejects(root, 'analytics/spec.yaml is missing.');
    write(root, 'analytics/spec.yaml', spec().replace('user_scoped_dimensions:', 'other:'));
    rejects(root, 'has no top-level `user_scoped_dimensions:` section.');
  });

  test('rejects an empty dimension list', () => {
    const root = fixture();
    write(root, 'analytics/spec.yaml', spec(events, []));
    rejects(root, 'parsed zero event-scoped dimensions — the parser is broken.');
  });

  test('rejects dimension contract violations, block scalars and property caps', () => {
    const root = fixture();
    write(root, 'analytics/spec.yaml', spec().replace('description: Fixture', `description: ${'x'.repeat(151)}`));
    rejects(root, /violates the GA4 Admin API dimension contract[\s\S]*description exceeds 150 characters/);
    write(root, 'analytics/spec.yaml', spec().replace('description: Fixture', 'description: |'));
    rejects(root, 'uses a YAML block scalar for description.');
    write(root, 'analytics/spec.yaml', spec(events, Array.from({ length: 51 }, (_, i) => `dimension_${i}`)));
    rejects(root, 'declares 51 event-scoped dimensions, over the GA4 property cap of 50.');
  });

  test('rejects an undeclared dynamic call instead of silently skipping it', () => {
    const root = fixture();
    write(root, 'src/new-dynamic.ts', "gtag('event', unknownName, {});");
    rejects(root, /not in DYNAMIC_EMIT_SITES:\n    src\/new-dynamic.ts/);
  });

  test('ignores commented-out calls so they do not count as sent', () => {
    const root = fixture();
    write(root, 'src/commented.ts', [
      "// gtag('event', 'commented_event', {});",
      "/* gtag('event', 'block_commented', {}); */",
      "const url = 'https://example.com/gtag/js'; // a gtag mention in a string",
    ].join('\n'));
    write(root, 'src/pages/_map-inline.js',
      "function ga(name, params) { gtag('event', name, params); }\n" +
      "ga('map_event', {group_id: 'fixture'});\n// ga('commented_event', {});");
    write(root, 'src/markup.astro',
      "<!-- Keep `function gtag()` top-level; gtag('event', 'html_commented') -->\n<p>don't</p>");
    write(root, 'analytics/spec.yaml', spec([...events, 'commented_event']));
    rejects(root, /registered in spec.yaml but never sent:\n    commented_event/);
  });

  for (const [label, source, reason] of [
    ['a space before the call paren', "gtag ('event', 'Bad-Name', {});", /invalid GA4 event name "Bad-Name"/],
    ['an upper-case name', "gtag('event', 'BadName', {});", /invalid GA4 event name "BadName"/],
    ['a template-literal name', "gtag('event', `literal_event`, {});", /template literal/],
    ['a non-literal command', "gtag(command, 'literal_event', {});", /non-literal gtag command/],
    ['bracket access', "window['gtag']('event', 'literal_event', {});", /bracket access/],
    ['aliasing', "const g = window.gtag; g('event', 'literal_event', {});", /gtag is referenced/],
    ['gtag.apply', "gtag.apply(null, ['event', 'literal_event']);", /gtag is referenced/],
    ['a direct dataLayer.push', "window.dataLayer.push({event: 'literal_event'});", /dataLayer is referenced/],
    ['shorthand params', "const unknown_param = 1; gtag('event', 'literal_event', {unknown_param});", /unknown_param\s+← literal_event/],
    ['quoted params', "gtag('event', 'literal_event', {'unknown_param': 1});", /unknown_param\s+← literal_event/],
    ['a params variable', "gtag('event', 'literal_event', params);", /params that are not an object literal/],
    ['spread params', "gtag('event', 'literal_event', {...base});", /spread or computed/],
    ['computed params', "gtag('event', 'literal_event', {[key]: 1});", /spread or computed/],
  ] as const) {
    test(`fails closed on ${label}`, () => {
      const root = fixture();
      write(root, 'src/unreadable.ts', source);
      rejects(root, reason);
    });
  }

  test('fails closed on a non-literal wrapper call and an undeclared Footer branch', () => {
    const root = fixture();
    write(root, 'src/pages/_shindan.js',
      "function track(name, params) { gtag('event', name, params); }\n" +
      "track('track_event', {group_id: 'fixture'});\ntrack(eventName, {});");
    rejects(root, /src\/pages\/_shindan.js:3: track\(…\) is called with a non-literal event name/);
    const fresh = fixture();
    write(fresh, 'src/components/Footer.astro',
      "if (name === 'jobtag_outbound_click') {} else if (name === 'new_branch') {}\ngtag('event', name, params);");
    rejects(fresh, /Footer.astro:1: branches on "new_branch", which DYNAMIC_EMIT_SITES does not declare/);
  });

  test('rejects missing or stale dynamic registry entries', () => {
    const root = fixture();
    rmSync(join(root, 'src/pages/_shindan.js'));
    rejects(root, 'DYNAMIC_EMIT_SITES lists src/pages/_shindan.js, which does not exist.');
    write(root, 'src/pages/_shindan.js', "track('track_event', {group_id: 'fixture'});");
    rejects(root, "src/pages/_shindan.js, but it has no dynamic gtag('event', …) call any more.");
  });

  test('rejects missing server event names and parameter anchors', () => {
    const root = fixture();
    const file = 'src/lib/middleware/mp-hit.ts';
    const original = readFileSync(join(root, file), 'utf8');
    rmSync(join(root, file));
    rejects(root, `${file} is missing; the server-side event name cannot be read.`);
    write(root, file, original.replace('DELIVERY_EVENT_NAME', 'RENAMED_EVENT_NAME'));
    rejects(root, 'no longer exports a literal DELIVERY_EVENT_NAME');
    write(root, file, original.replace('buildMpPayload', 'renamedPayload'));
    rejects(root, 'no longer contains "export function buildMpPayload"');
    write(root, file, original);
    const geoFile = 'src/lib/middleware/geo-referral.ts';
    const geoOriginal = readFileSync(join(root, geoFile), 'utf8');
    rmSync(join(root, geoFile));
    rejects(root, `${geoFile} is missing; server-side GA4 params cannot be read.`);
    write(root, geoFile, geoOriginal.replace('GeoReferralParams', 'RenamedParams'));
    rejects(root, 'no longer contains "export interface GeoReferralParams"');
  });

  test('rejects a server event rename that is absent from the spec', () => {
    const root = fixture();
    const file = 'src/lib/middleware/mp-hit.ts';
    write(root, file, readFileSync(join(root, file), 'utf8').replace('page_delivery', 'renamed_delivery'));
    rejects(root, /renamed_delivery\s+src\/lib\/middleware\/mp-hit.ts \(Edge middleware\)/);
  });

  test('keeps all four drift diagnostics in their original order and wording', () => {
    const root = fixture();
    write(root, 'analytics/spec.yaml', spec(
      [...events.filter((name) => name !== 'track_event'), 'unfired_event'],
      [...dimensions.filter((name) => name !== 'item_id'), 'unused_dimension'],
    ));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, [
      '[check-analytics-spec] FAIL: analytics/spec.yaml has drifted from the code.', '',
      '  1 event(s) are sent but not registered in analytics/spec.yaml `events:`:',
      `    ${'track_event'.padEnd(24)} src/pages/_shindan.js`, '',
      '  1 event(s) are registered in spec.yaml but never sent:',
      '    unfired_event',
      '  Either the emit was deleted (remove the spec entry, keeping a comment about when and why) or a new call shape needs declaring.', '',
      '  1 parameter(s) are sent but have no `event_scoped_dimensions` entry, so GA4 cannot report on them:',
      `    ${'item_id'.padEnd(22)} ← literal_event`, '',
      '  1 dimension(s) are declared in spec.yaml but no code sends them:',
      '    unused_dimension', '',
    ].join('\n'));
  });
});
