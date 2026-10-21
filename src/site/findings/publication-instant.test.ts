import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderFindingsAtom } from './atom';
import { applyFindingsPublication, atomInstant, writePublishedManifest } from './publish';
import { isPublicationInstant } from './publication-instant';
import { FINDINGS, publishedFindings } from './registry';

const issue = FINDINGS[0]!;
const script = resolve('scripts/publish-findings-issue.ts');

const accepted = [
  '2026-11-10T09:00:00+09:00',
  '2026-11-10T00:00:00Z',
  '2026-12-31T23:59:59-23:59',
  '2026-01-01T00:00:00+23:59',
  '2026-11-10T09:00:00+00:00',
  '2026-11-10T09:00:00-00:00',
  '2024-02-29T00:00:00Z',
  '2000-02-29T00:00:00Z',
  '0096-02-29T00:00:00Z',
  '2016-12-31T23:59:60Z',
  '2017-01-01T08:59:60+09:00',
  '2026-11-10T09:00:00.123456789+09:00',
];

const rejected = [
  '2026-13-40T25:61:00+99:99',
  '2026-13-01T00:00:00Z',
  '2026-00-01T00:00:00Z',
  '2026-01-00T00:00:00Z',
  '2026-01-32T00:00:00Z',
  '2026-02-30T00:00:00Z',
  '2026-02-29T00:00:00Z',
  '1900-02-29T00:00:00Z',
  '2100-02-29T00:00:00Z',
  '2026-04-31T00:00:00Z',
  '2026-06-31T00:00:00Z',
  '2026-09-31T00:00:00Z',
  '2026-11-31T00:00:00Z',
  '2026-11-10T25:61:00Z',
  '2026-11-10T24:00:00Z',
  '2026-11-10T00:60:00Z',
  '2026-11-10T00:00:61Z',
  '2026-11-10T09:00:00+99:99',
  '2026-11-10T09:00:00+24:00',
  '2026-11-10T09:00:00-00:60',
  '2026-11-10T09:00:00',
  '2026-11-10',
  '2026-1-10T09:00:00Z',
  '2026-11-10T9:00:00Z',
  '2026-11-10T09:00:00+0900',
  '2026-11-10T09:00:00.Z',
  '2026-11-10t09:00:00z',
  ' 2026-11-10T09:00:00Z',
  '2026-11-10T09:00:00Z\n',
  '2026-11-10T09:00:00Zextra',
];

describe('Findings publication instant calendar and field ranges', () => {
  for (const instant of accepted) test(`accepts ${instant}`, () => {
    expect(isPublicationInstant(instant)).toBe(true);
  });

  for (const instant of rejected) test(`rejects ${JSON.stringify(instant)}`, () => {
    expect(isPublicationInstant(instant)).toBe(false);
  });
});

describe('Findings publication boundaries share strict validation', () => {
  for (const instant of accepted) test(`preserves accepted instant ${instant}`, () => {
    const published = applyFindingsPublication(issue, instant);
    expect(published.first_published_on).toBe(instant);
    assert.deepEqual(publishedFindings([published]), [published]);
    expect(renderFindingsAtom([published])).toContain(`<published>${instant}</published>`);
    expect(atomInstant(instant)).toBe(instant);
  });

  for (const instant of rejected) test(`refuses invalid publication ${JSON.stringify(instant)}`, () => {
    expect(() => applyFindingsPublication(issue, instant)).toThrow('timezone');
    assert.deepEqual(publishedFindings([{ ...issue, status: 'published', first_published_on: instant }]), []);
    expect(() => renderFindingsAtom([{ ...issue, first_published_on: instant }])).toThrow('timezone');
  });

  test('invalid publication never changes manifest bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'findings-instant-'));
    const path = join(dir, 'manifest.json');
    const original = `${JSON.stringify(issue, null, 2)}\n`;
    try {
      writeFileSync(path, original);
      for (const instant of rejected) {
        expect(() => writePublishedManifest(path, instant)).toThrow('timezone');
        expect(readFileSync(path, 'utf8')).toBe(original);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('Atom updated rejects invalid instants and calendar days', () => {
    for (const value of [...rejected.filter(value => value !== '2026-11-10'), '2026-13-40', '2026-02-30', '1900-02-29']) {
      expect(() => atomInstant(value)).toThrow('calendar day');
      expect(() => renderFindingsAtom([{ ...issue, modified_on: value }])).toThrow('calendar day');
    }
    expect(atomInstant('2026-11-10')).toBe('2026-11-10T00:00:00+09:00');
    expect(atomInstant('2000-02-29')).toBe('2000-02-29T00:00:00+09:00');
  });

  for (const instant of rejected) test(`CLI rejects ${JSON.stringify(instant)} before reading or writing a manifest`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'findings-cli-invalid-'));
    try {
      const result = spawnSync(process.execPath, [script, issue.issue_id, instant], { cwd: dir, encoding: 'utf8' });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Usage:');
      expect(result.stderr).not.toContain('ENOENT');
      expect(result.stdout).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const instant of accepted) test(`CLI records ${instant} only in a temporary manifest`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'findings-cli-valid-'));
    const manifestDir = join(dir, 'data/findings', issue.issue_id);
    const path = join(manifestDir, 'manifest.json');
    try {
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(path, `${JSON.stringify(issue, null, 2)}\n`);
      const result = spawnSync(process.execPath, [script, issue.issue_id, instant], { cwd: dir, encoding: 'utf8' });
      expect(result.status).toBe(0);
      assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { ...issue, status: 'published', first_published_on: instant });
      expect(issue.first_published_on).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
