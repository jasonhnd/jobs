import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFindings, csv, CSV_HEADERS, loadFindings, sha256 } from './data';
import { FINDINGS, publishedFindings, findingsForRun } from './registry';
import { findingsCopy, unexpectedJapanese, renderTemplate } from './copy';

const issue = FINDINGS[0]!;
const data = loadFindings(issue);

describe('frozen Findings issue 1', () => {
  test('matches all sample claims with raw aggregates and deterministic examples', () => {
    assert.deepEqual([data.summary.occupationCount, data.summary.skippedOccupationIds, data.summary.meanBefore, data.summary.meanAfter, data.summary.absDeltaGe05, data.summary.absDeltaGe10, data.summary.bandChanges], [556, [], 4.55, 4.68, 12, 0, 34]);
    assert.deepEqual([data.summary.bandBefore, data.summary.bandAfter], [{ low: 179, mid: 354, high: 23 }, { low: 157, mid: 368, high: 31 }]);
    assert.deepEqual(data.chartRows.map(row => [row.id, row.before, row.after, row.delta]), [[325, 4.7, 5.3, 0.6], [365, 5.1, 5.7, 0.6], [129, 3.6, 3.3, -0.3], [402, 3.1, 2.8, -0.3]]);
    assert.equal(data.tableRows.length, 45);
    expect(data.meanBeforeRaw).not.toBe(data.summary.meanBefore);
    expect(data.rows.find(row => row.id === 404)?.title).toBe('内科医');
  });

  test('exports exactly the sample schemas, with pinned bytes and field-level rights', () => {
    for (const file of data.downloads) {
      expect(file.text.split('\n')[0]).toBe(CSV_HEADERS[file.file].join(','));
      assert.deepEqual({ sha256: sha256(file.text), bytes: file.bytes }, issue.downloads[`${file.file}.csv`]);
      expect(file.text.split('\n')[0]).not.toMatch(/salary|workers|rationale/);
    }
    assert.equal(data.downloads[0]!.text.trim().split('\n').length, 557);
    assert.equal(data.downloads.find(file => file.file === 'panel')!.text.trim().split('\n').length, 7);
    expect(data.provenance.ipd_retrieved_at).toBe(JSON.parse(readFileSync(issue.provenance.path, 'utf8')).ipd_retrieved_at);
    const mappedFields = new Set(data.downloads.find(file => file.file === 'provenance')!.text.trim().split('\n').slice(1).flatMap(line => line.split(',')[1]!.split(';')));
    for (const fields of Object.values(CSV_HEADERS)) for (const field of fields) assert(mappedFields.has(field), `missing field-level attribution: ${field}`);
    const provenance = data.downloads.find(file => file.file === 'provenance')!.text;
    expect(provenance).toContain('MIT applies only to site-owned contributions');
    expect(provenance).toContain('Job tag TOS Article 9; no MIT sublicense');
    expect(provenance).toContain('not IPD identifiers');
    expect(csv(['a', 'b'], [[null, 'a,"b"\nc']])).toBe('a,b\n,"a,""b""\nc"\n');
  });

  test('adding a later release cannot change earlier CSV bytes or hashes', () => {
    const before = buildFindings(issue).downloads.map(file => [file.href, file.text, file.sha256]);
    const future = { ...issue, issue_id: '2026-11-01-example', issue_number: 2, status: 'draft' as const };
    const releases = [...FINDINGS, future];
    assert.deepEqual(publishedFindings(releases), []);
    // Build a later identity between two independent builds of the old release.
    expect(buildFindings(future).downloads[0]!.href).toContain('2026-11-01-example');
    assert.deepEqual(buildFindings(releases[0]!).downloads.map(file => [file.href, file.text, file.sha256]), before);
    assert.equal(data.issue.first_published_on, null);
    assert.deepEqual(findingsForRun('gpt-6.1-sol', '2026-10-01'), [issue]);
    assert.deepEqual(findingsForRun('grok-4.7', '2026-09-22'), []);
  });

  test('fails closed on altered sources, missing seats and future contamination', () => {
    expect(() => buildFindings({ ...issue, report: { ...issue.report, sha256: '0'.repeat(64) } })).toThrow('source hash mismatch');
    expect(() => buildFindings({ ...issue, panels: { ...issue.panels, before: issue.panels.before.slice(1) } })).toThrow('one seat per provider');
    expect(() => buildFindings({ ...issue, incoming_run_date: '2026-09-30' })).toThrow('incoming seat');
    const unsigned = { ...issue, status: 'published' as const, first_published_on: '2026-10-21' };
    assert.deepEqual(publishedFindings([unsigned]), []);
  });
});

describe('Findings template contract', () => {
  test('pins the verbatim unsigned Japanese template and Legal draft', () => {
    assert.equal(sha256(readFileSync('src/content/findings.ja.json')), '0e51b1fe9e06fba20aa5add835532515602e9fb52b985867a3ba54e8ee01c3ab');
    assert.equal(sha256(readFileSync('src/content/findings-rights.ja.json')), 'e32d5c108c6368a28caea939c490f5eef5b9bf5e2316a62d7c2651f99cefcd2a');
  });
  test('keeps copy variables from raw totals, source provenance and frozen panel only', () => {
    const copy = findingsCopy(data);
    expect(copy.T06).toBe('2026-10-01 の更新前後で、全職業のAI影響度の平均は4.55から4.68になりました。');
    expect(copy.upSentence).toBe('2026-10-01 の更新前後で、AIエンジニアのAI影響度は4.7から5.3へ、+0.6点変わりました。');
    expect(copy.T41).toContain(`より${data.provenance.ipd_retrieved_at}にダウンロード`);
    expect(copy.T25).toContain('{{issue_url}}');
    expect(copy.T25).toContain('{{accessed_on}}');
    expect(copy.rightsSections.flatMap(section => section.lines).join('\n')).not.toMatch(/\bT\d{2}\b/);
    expect(() => renderTemplate('T01', {})).toThrow('missing template variable');
  });

  test('rejects a Japanese sentence appended outside the template or inside a valid node', () => {
    const copy = findingsCopy(data);
    assert.deepEqual(unexpectedJapanese([copy.T06, copy.T16, copy.citation, data.rows[0]!.title], data), []);
    const added = 'これはテンプレート外の追加文です。';
    assert.deepEqual(unexpectedJapanese([copy.T06, added], data), [added]);
    assert.deepEqual(unexpectedJapanese([copy.T06 + added], data), [copy.T06 + added]);
    const legal = copy.rightsSections[0]!.lines[0]!;
    assert.deepEqual(unexpectedJapanese([legal], data), [legal]);
    assert.deepEqual(unexpectedJapanese([legal], data, true), []);
    const citation = copy.rightsSections[4]!.lines[0]!;
    assert.deepEqual(unexpectedJapanese([citation], data, true), []);
    assert.deepEqual(unexpectedJapanese([citation + added], data, true), [citation + added]);
  });
});
