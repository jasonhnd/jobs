import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Black-box contract: the gate is copied into a throwaway repository and run
// there, so each case exercises exactly what `bun run check:architecture` does.
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-architecture.cjs');
const NODE_MODULES = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');
const REAL_TSCONFIG = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tsconfig.json'), 'utf8'),
) as { compilerOptions: { paths: Record<string, string[]> } };
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

type Files = Readonly<Record<string, string>>;

// A clean minimal tree: one file per layer, a nodejs function and middleware.
const CLEAN: Files = {
  'src/graph/index.ts': 'export const graph = 1;\n',
  'src/graph/loader.ts': 'export const loadGraph = () => 1;\n',
  'src/views/view.ts': "import { graph } from '../graph/index.js';\nexport const view = graph;\n",
  'src/page-data/data.ts': "import { loadGraph } from '@/graph/loader.js';\nexport const data = loadGraph();\n",
  'src/templates/T.ts': 'export const T = () => "<p></p>";\n',
  'src/pages/index.astro': "---\nimport { view } from '@/views/view.js';\n---\n<p>{view}</p>\n",
  'src/data/projections/p.json': '{}\n',
  'src/data/lib/helper.ts': 'export const helper = 1;\n',
  'src/components/C.tsx': 'export const C = () => null;\n',
  'src/layouts/L.astro': '<slot />\n',
  'src/lib/strict-load.ts': 'export const strictLoad = 1;\n',
  'src/lib/plain.ts': 'export const plain = 1;\n',
  'api/og.tsx': "import { plain } from '../src/lib/plain.js';\nexport const config = { runtime: 'nodejs' };\nexport default () => plain;\n",
  'middleware.ts': "export const config = { runtime: 'nodejs' };\nexport default () => 1;\n",
};

function fixture(overrides: Files = {}): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'jobs-check-architecture-')));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  copyFileSync(SCRIPT, join(root, 'scripts', 'check-architecture.cjs'));
  // The gate parses sources with @babel/parser; let the copy resolve it.
  symlinkSync(NODE_MODULES, join(root, 'node_modules'), 'dir');
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { paths: REAL_TSCONFIG.compilerOptions.paths },
  }));
  for (const [file, text] of Object.entries({ ...CLEAN, ...overrides })) {
    const full = join(root, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}

function run(root: string, env: Record<string, string> = {}) {
  const cleanEnv: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1', ...env };
  if (!('EDGE_ENTRIES_ADDITIONAL' in env)) delete cleanEnv.EDGE_ENTRIES_ADDITIONAL;
  if (!('EDGE_ENTRIES_OVERRIDE' in env)) delete cleanEnv.EDGE_ENTRIES_OVERRIDE;
  return spawnSync(process.execPath, [join(root, 'scripts', 'check-architecture.cjs')], {
    cwd: root, encoding: 'utf8', timeout: 20_000, env: cleanEnv,
  });
}

function assertViolation(overrides: Files, expected: RegExp): void {
  const result = run(fixture(overrides));
  assert.equal(result.status, 1, `expected exit 1\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, expected);
}

describe('check-architecture layer rules resolve imports before judging them', () => {
  test('a clean tree passes', () => {
    const result = run(fixture());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /all enforced layer boundaries respected/);
  });

  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['graph → @/components alias', 'src/graph/bad.ts', "import { C } from '@/components/C.js';\n"],
    ['graph → @/layouts alias', 'src/graph/bad.ts', "import L from '@/layouts/L.astro';\n"],
    ['graph → ../pages relative', 'src/graph/bad.ts', "import P from '../pages/index.astro';\n"],
    ['views → @/data/projections alias', 'src/views/bad.ts', "import p from '@/data/projections/p.json';\n"],
    ['views → ../components relative', 'src/views/bad.ts', "import { C } from '../components/C.js';\n"],
    ['views → bare fs', 'src/views/bad.ts', "import { readFileSync } from 'fs';\n"],
    ['views → fs/promises', 'src/views/bad.ts', "import { readFile } from 'fs/promises';\n"],
    ['views → require(node:fs)', 'src/views/bad.ts', "const fs = require('node:fs');\n"],
    ['views → template-literal dynamic import', 'src/views/bad.ts', 'export const t = () => import(`../templates/T.js`);\n'],
    ['views → module.require()', 'src/views/bad.cjs', "const fs = module.require('fs');\nmodule.exports = fs;\n"],
    ['views → graph loader via alias', 'src/views/bad.ts', "import { loadGraph } from '@/graph/loader.js';\n"],
    ['views → strict-load via alias', 'src/views/bad.ts', "import { strictLoad } from '@/lib/strict-load.js';\n"],
    ['views .js file is scanned', 'src/views/bad.js', "import { T } from '../templates/T.js';\n"],
    ['views .mjs file is scanned', 'src/views/bad.mjs', "import { T } from '../templates/T.js';\n"],
    ['page-data → ../data/projections relative', 'src/page-data/bad.ts', "import p from '../data/projections/p.json';\n"],
    ['templates → @/data/projections alias', 'src/templates/bad.ts', "import p from '@/data/projections/p.json';\n"],
    ['templates → @/pages (no alias, maps onto src/)', 'src/templates/bad.ts', "import P from '@/pages/index.astro';\n"],
    ['templates → ../pages relative', 'src/templates/bad.ts', "import P from '../pages/index.astro';\n"],
    ['templates → @/graph exact alias', 'src/templates/bad.ts', "import { graph } from '@/graph';\n"],
    ['templates → @/data/lib alias', 'src/templates/bad.ts', "import { helper } from '@/data/lib/helper.js';\n"],
    ['pages → src/data/projections via ../ path', 'src/pages/bad.ts', "import p from '../data/projections/p.json';\n"],
    ['views → static import after another statement on the same line', 'src/views/bad.js', "export const view = 1; import { T } from '../templates/T.js';\n"],
    ['views → multi-line namespace import whose next line starts with *', 'src/views/bad.js', "import\n  * as T from '../templates/T.js';\nexport const view = T;\n"],
    ['views → require() after a closed block comment on the same line', 'src/views/bad.js', "/* explanatory comment */ const fs = require('fs');\nexport const view = 1;\n"],
    ['views → import after a multi-line block comment closes', 'src/views/bad.ts', "/*\n * docs\n */ import { T } from '../templates/T.js';\n"],
    ['views → import after a string containing a comment opener', 'src/views/bad.ts', "const glob = '@/lib/*'; import { T } from '../templates/T.js';\n"],
    ['views → require() after a regex literal containing // on the same line', 'src/views/bad.js', "if (true) /[//]/.test('x'); const fs = require('fs');\n"],
    ['views → require() after a division and a regex on the same line', 'src/views/bad.ts', "export const r = 4 / 2 / /x/.source.length; const fs = require('fs');\n"],
    ['views → TS import-equals require', 'src/views/bad.ts', "import fs = require('fs');\nexport const x = fs;\n"],
    ['views → export * re-export', 'src/views/bad.ts', "export * from '../templates/T.js';\n"],
    ['views → bare side-effect import', 'src/views/bad.ts', "import '../templates/T.js';\n"],
    ['pages .astro frontmatter import', 'src/pages/bad.astro', "---\nimport p from '../data/projections/p.json';\n---\n<p>{p}</p>\n"],
    ['pages .astro <script data-type> import', 'src/pages/bad.astro', '<script data-type="example">import p from "../data/projections/p.json";</script>\n'],
    ['pages .astro <script> import', 'src/pages/bad.astro', "<p>x</p>\n<script>\n  import p from '../data/projections/p.json';\n  console.info(p);\n</script>\n"],
  ];

  for (const [name, file, source] of cases) {
    test(`rejects ${name}`, () => {
      assertViolation({ [file]: source }, new RegExp(`${file.replace(/[.]/g, '\\.')}:\\d+[\\s\\S]*forbidden import`));
    });
  }

  test('type-only imports stay exempt', () => {
    const result = run(fixture({ 'src/templates/ok.ts': "import type { graph } from '@/graph';\nexport const x = 1;\n" }));
    assert.equal(result.status, 0, result.stderr);
  });

  test('similarly named directories are not confused with a forbidden layer', () => {
    const result = run(fixture({
      'src/views-extra/x.ts': 'export const x = 1;\n',
      'src/graph/ok.ts': "import { x } from '../views-extra/x.js';\nexport const y = x;\n",
    }));
    assert.equal(result.status, 0, result.stderr);
  });

  test('a require() inside a comment line is not an import', () => {
    const result = run(fixture({
      'src/views/commented.ts': "// const fs = require('fs');\n/*\n * import('node:fs') is forbidden here\n */\nexport const x = 1;\n",
    }));
    assert.equal(result.status, 0, result.stderr);
  });

  test('imports inside trailing and block comments are not imports', () => {
    const result = run(fixture({
      'src/views/commented.ts': "export const x = 1; // require('fs')\nexport const y = /* import('node:fs') */ 2;\nexport const re = /\\/\\/ '/; // import x from 'fs'\n",
    }));
    assert.equal(result.status, 0, result.stderr);
  });

  test('a dynamic import() with a non-literal argument fails closed', () => {
    assertViolation(
      { 'src/views/bad.ts': 'export const load = (name: string) => import(name);\n' },
      /src\/views\/bad\.ts:1[\s\S]*non-literal/,
    );
  });

  for (const [name, source] of [
    ['a forbidden prefix', 'export const t = (n: string) => import(`../templates/${n}.js`);\n'],
    ['an allowed-looking prefix', 'export const t = (n: string) => import(`../lib/${n}.js`);\n'],
  ] as const) {
    test(`an interpolated template import() with ${name} fails closed`, () => {
      assertViolation({ 'src/views/bad.ts': source }, /src\/views\/bad\.ts:1[\s\S]*non-literal import\(\)/);
    });
  }

  test('a require() with a non-literal argument fails closed', () => {
    assertViolation(
      { 'src/views/bad.js': "const name = 'fs';\nconst fs = require(name);\n" },
      /src\/views\/bad\.js:2[\s\S]*non-literal/,
    );
  });

  test('a file that does not parse fails with file:line', () => {
    assertViolation(
      { 'src/views/bad.ts': "export const ok = 1;\nexport const broken = (;\n" },
      /src\/views\/bad\.ts:2[\s\S]*cannot parse/,
    );
  });

  test('an .astro <script> that does not parse fails with the file line', () => {
    assertViolation(
      { 'src/pages/bad.astro': "---\nconst a = 1;\n---\n<p>{a}</p>\n<script>\n  const b = (;\n</script>\n" },
      /src\/pages\/bad\.astro:6[\s\S]*cannot parse/,
    );
  });

  test('.astro markup, JSON-LD scripts and type-only import() types are not imports', () => {
    const result = run(fixture({
      'src/pages/ok.astro':
        "---\nconst ld = { '@context': 'https://schema.org' };\n---\n<p>require('fs') and import('node:fs') in prose</p>\n" +
        '<script type="application/ld+json" set:html={JSON.stringify(ld)} />\n' +
        '<script type="application/ld+json">{"@context": "https://schema.org"}</script>\n' +
        "<script>\n  console.info('/[//]/');\n</script>\n",
      'src/views/types.ts': "export type T = import('../templates/T.js').T;\nexport const x = 1;\n",
    }));
    assert.equal(result.status, 0, result.stderr);
  });

  test('test files remain exempt from layer rules', () => {
    const result = run(fixture({ 'src/views/view.test.ts': "import { readFileSync } from 'node:fs';\n" }));
    assert.equal(result.status, 0, result.stderr);
  });
});

describe('check-architecture walks every Vercel function regardless of runtime', () => {
  test('a .tsx dependency of a nodejs api entry fails', () => {
    assertViolation({
      'api/og.tsx': "import { C } from '../src/components/C.js';\nexport const config = { runtime: 'nodejs' };\nexport default C;\n",
    }, /src\/components\/C\.tsx[\s\S]*reachable from function entry api\/og\.tsx/);
  });

  test('a .tsx dependency of nodejs middleware fails', () => {
    assertViolation({
      'middleware.ts': "import { C } from '@/components/C.js';\nexport const config = { runtime: 'nodejs' };\nexport default C;\n",
    }, /src\/components\/C\.tsx[\s\S]*reachable from function entry middleware\.ts/);
  });

  test('middleware without any runtime key is still walked', () => {
    assertViolation({
      'middleware.ts': "import { C } from './src/components/C.js';\nexport default C;\n",
    }, /src\/components\/C\.tsx/);
  });

  test('nested api/** functions are discovered', () => {
    assertViolation({
      'api/cron/job.ts': "import { C } from '../../src/components/C.js';\nexport default C;\n",
    }, /reachable from function entry api\/cron\/job\.ts/);
  });

  test('module.require() dependencies are followed', () => {
    assertViolation({
      'api/index.cjs': "module.exports = module.require('../src/components/C.js');\n",
    }, /src\/components\/C\.tsx[\s\S]*reachable from function entry api\/index\.cjs/);
  });

  test('an interpolated dynamic import() inside the function closure fails closed', () => {
    assertViolation({
      'api/index.ts': 'export default (n: string) => import(`../src/components/${n}.js`);\n',
    }, /api\/index\.ts:1 \(reachable from function entry api\/index\.ts\)[\s\S]*non-literal import\(\)/);
  });

  test('require() dependencies are followed', () => {
    assertViolation({
      'api/cron/job.ts': "const { C } = require('../../src/components/C.js');\nexport default C;\n",
    }, /src\/components\/C\.tsx/);
  });

  test('a .mjs specifier resolves to its .mts source and the walk continues', () => {
    assertViolation({
      'api/index.ts': "import { a } from '../src/lib/a.mjs';\nexport default a;\n",
      'src/lib/a.mts': "import { C } from '../components/C.js';\nexport const a = C;\n",
    }, /src\/components\/C\.tsx[\s\S]*reachable from function entry api\/index\.ts/);
  });

  test('a .cjs specifier resolves to its .cts source', () => {
    assertViolation({
      'api/index.ts': "const { a } = require('../src/lib/a.cjs');\nexport default a;\n",
      'src/lib/a.cts': "const { C } = require('../components/C.js');\nexports.a = C;\n",
    }, /src\/components\/C\.tsx/);
  });

  test('an unresolvable relative import inside the walk fails (coverage lost)', () => {
    assertViolation({
      'api/index.ts': "import { gone } from '../src/lib/gone.js';\nexport default gone;\n",
    }, /unresolvable import `\.\.\/src\/lib\/gone\.js`/);
  });

  test('underscore-prefixed helpers and tests under api/ are not entries', () => {
    const result = run(fixture({
      'api/_lib/helper.tsx': 'export const h = 1;\n',
      'api/og.test.ts': "import { C } from '../src/components/C.js';\n",
    }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /function entry api\/og\.tsx/);
    assert.doesNotMatch(result.stdout, /api\/_lib|og\.test/);
  });

  test('zero discovered function entries fails closed', () => {
    const root = fixture();
    rmSync(join(root, 'api'), { recursive: true, force: true });
    rmSync(join(root, 'middleware.ts'));
    const result = run(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /no Vercel function entries/);
  });

  test('an explicitly named entry that does not exist fails', () => {
    const result = run(fixture(), { EDGE_ENTRIES_ADDITIONAL: 'api/missing.ts' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /api\/missing\.ts/);
  });
});
