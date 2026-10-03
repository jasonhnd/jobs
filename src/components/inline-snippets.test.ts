/**
 * Guards the shared inline snippets (issue #777, JOB_0032 F1/F2):
 * `ChapDesktopOpen.astro` (details.chap desktop-open) and
 * `ThemeToggleScript.astro` (legal-page theme toggle).
 *
 * Source half: no page template may grow a private copy again.
 * Built half: each sampled page still ships the snippet exactly once, with
 * the byte-identical body (so one CSP hash covers every page).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { requireBuiltArtifact } from '../../scripts/lib/built-artifacts.js';

const ROOT = process.cwd();
const PAGES = join(ROOT, 'src', 'pages');
const DIST = join(ROOT, 'dist-astro');

const CHAP_PAGES = [
  'sectors/[sector].astro',
  'licenses/[license].astro',
  'life-balance/[balance].astro',
  'training/[training].astro',
  'education/[education].astro',
  'entry-paths/[entry].astro',
  'work-styles/[workstyle].astro',
  'values/[value].astro',
  'abilities/[ability].astro',
  'careers/[career].astro',
  'rankings/[type].astro',
  'knowledge/[knowledge].astro',
  'compare/[pair].astro',
  'skills/[skill].astro',
  'interests/[type].astro',
  'employment-types/[employment].astro',
  'q/[q].astro',
] as const;

/** One built page per template above (first file of each route directory). */
const CHAP_BUILT = [
  'sectors/hanbai.html',
  'licenses/accounting-licenses.html',
  'life-balance/child-care-balance.html',
  'training/1-3-years.html',
  'education/graduate-school-careers.html',
  'entry-paths/apprenticeship.html',
  'work-styles/desk-sitting-work.html',
  'values/achievement.html',
  'abilities/deductive-reasoning.html',
  'careers/20-late.html',
  'rankings/aging-workforce.html',
  'knowledge/computers-electronics-knowledge.html',
  'compare/bengoshi-vs-kaikeishi.html',
  'skills/coordination.html',
  'interests/artistic.html',
  'employment-types/freelance-friendly.html',
  'q/ai-augment-vs-replace.html',
] as const;

const CHAP_BODY = [
  '(function () {',
  '  try {',
  "    if (!window.matchMedia('(min-width: 900px)').matches) return;",
  "    var nodes = document.querySelectorAll('details.chap');",
  '    for (var i = 0; i < nodes.length; i++) nodes[i].open = true;',
  '  } catch (e) {}',
  '})();',
].join('\n');

function read(path: string): string {
  return readFileSync(path, 'utf-8');
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Collapse indentation so the check is about the code, not the template. */
function normalise(text: string): string {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

describe('shared inline snippets — source', () => {
  test('every details.chap page renders <ChapDesktopOpen> and has no private copy', () => {
    for (const rel of CHAP_PAGES) {
      const src = read(join(PAGES, rel));
      assert.match(src, /import ChapDesktopOpen from '@\/components\/ChapDesktopOpen\.astro';/, rel);
      assert.match(src, /<ChapDesktopOpen slot="bodyEnd" \/>/, rel);
      assert.ok(!src.includes("querySelectorAll('details.chap')"), `${rel} has a private copy`);
    }
  });

  test('only the shared component and _IdPageScript query details.chap in page templates', () => {
    const offenders: string[] = [];
    for (const file of walk(PAGES)) {
      if (!file.endsWith('.astro')) continue;
      if (file.endsWith('_IdPageScript.astro')) continue;
      if (read(file).includes("querySelectorAll('details.chap')")) offenders.push(file);
    }
    assert.deepEqual(offenders, []);
  });

  test('privacy and compliance use ThemeToggleScript; no private toggle remains', () => {
    const privacy = read(join(PAGES, 'privacy.astro'));
    const compliance = read(join(PAGES, 'compliance.astro'));
    assert.match(privacy, /<ThemeToggleScript slot="bodyEnd" track \/>/);
    assert.match(compliance, /<ThemeToggleScript slot="bodyEnd" \/>/);
    for (const src of [privacy, compliance]) {
      assert.ok(!src.includes('getElementById("themeToggle")'));
    }
  });
});

describe('shared inline snippets — built artifacts', () => {
  test('each chapter page ships the shared snippet exactly once', () => {
    for (const rel of CHAP_BUILT) {
      const full = join(DIST, rel);
      const resolved = requireBuiltArtifact(existsSync(full) ? full : null, `dist-astro/${rel}`);
      if (resolved === null) return;
      const html = read(resolved);
      const bodies = [...html.matchAll(/<script>((?:(?!<\/script>)[\s\S])*?querySelectorAll\('details\.chap'\)(?:(?!<\/script>)[\s\S])*?)<\/script>/g)].map((m) => m[1]);
      assert.equal(bodies.length, 1, `${rel}: expected one details.chap script`);
      assert.equal(normalise(bodies[0]), normalise(CHAP_BODY), rel);
    }
  });

  test('privacy tracks theme_change, compliance does not, both wire #themeToggle', () => {
    const page = (rel: string): string | null => {
      const full = join(DIST, rel);
      const resolved = requireBuiltArtifact(existsSync(full) ? full : null, `dist-astro/${rel}`);
      return resolved === null ? null : read(resolved);
    };
    const privacy = page('privacy.html');
    const compliance = page('compliance.html');
    if (privacy === null || compliance === null) return;
    assert.ok(privacy.includes('getElementById("themeToggle")'));
    assert.ok(privacy.includes('gtag("event", "theme_change"'));
    assert.ok(compliance.includes('getElementById("themeToggle")'));
    assert.ok(!compliance.includes('theme_change'));
  });
});
