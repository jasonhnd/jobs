import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FINDINGS, findingsUrl, publishedFindings } from './registry';
import { loadFindings } from './data';
import { findingsCopy } from './copy';
import { findingsJsonLd } from './structured';
import { renderFindingsAtom } from './atom';
import { applyFindingsPublication, atomInstant, publishedOnLabel, writePublishedManifest } from './publish';

const issue = FINDINGS[0]!;
const INSTANT = '2026-10-22T09:30:00+09:00';
const ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;

function parseAtom(xml: string) {
  const result = spawnSync('python3', ['-c', `
import json, sys, xml.etree.ElementTree as ET
ns = {"a": "http://www.w3.org/2005/Atom"}
root = ET.fromstring(sys.stdin.read())
def text(el, name):
    node = el.find(f"a:{name}", ns)
    return None if node is None else node.text
def link(el, rel):
    node = el.find(f"a:link[@rel='{rel}']", ns)
    return None if node is None else node.get("href")
print(json.dumps({
  "id": text(root, "id"),
  "title": text(root, "title"),
  "updated": text(root, "updated"),
  "self": link(root, "self"),
  "entries": [{
    "id": text(entry, "id"),
    "title": text(entry, "title"),
    "updated": text(entry, "updated"),
    "published": text(entry, "published"),
    "summary": text(entry, "summary"),
    "content": text(entry, "content"),
    "link": link(entry, "alternate"),
  } for entry in root.findall("a:entry", ns)],
}))
`], { input: xml, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as {
    id: string; title: string; updated: string; self: string;
    entries: Array<{ id: string; title: string; updated: string; published: string | null; summary: string; content: string; link: string }>;
  };
}

describe('preview publication instants stay empty', () => {
  test('preview build keeps publication instants empty and omits mustache placeholders', () => {
    const data = loadFindings(issue);
    const copy = findingsCopy(data);
    const dataset = findingsJsonLd(data)['@graph'].find(node => node['@type'] === 'Dataset') as { datePublished?: string; dateModified: string };
    const page = findingsJsonLd(data)['@graph'].find(node => node['@type'] === 'WebPage') as { datePublished?: string };
    assert.equal(issue.first_published_on, null);
    assert.equal(publishedOnLabel(issue), '—');
    assert.equal(dataset.datePublished, undefined);
    assert.equal(page.datePublished, undefined);
    assert.equal(dataset.dateModified, issue.modified_on);
    assert.deepEqual(publishedFindings(), []);
    const feed = parseAtom(renderFindingsAtom());
    assert.equal(feed.entries.length, 1);
    assert.equal(feed.entries[0]!.published, null);
    assert.doesNotMatch(renderFindingsAtom(), /<published>/);
    for (const value of [publishedOnLabel(issue), feed.entries[0]!.updated, copy.T25]) {
      assert.equal(value.includes('{{'), value === copy.T25);
    }
    assert.doesNotMatch(publishedOnLabel(issue), /\{\{/);
    assert.doesNotMatch(feed.entries[0]!.updated, /\{\{/);
    assert.doesNotMatch(JSON.stringify({ datePublished: dataset.datePublished ?? null }), /\{\{/);
    expect(copy.T25).toContain('https://mirai-shigoto.com/pro/findings/2026-10-01-gpt-6.1-sol');
    expect(copy.T25).not.toContain('{{issue_url}}');
  });
});

describe('recorded publication instant', () => {
  test('published fixture validates JSON-LD, Atom and page metadata with timezones', () => {
    const dated = applyFindingsPublication(issue, INSTANT);
    const data = loadFindings(dated);
    const dataset = findingsJsonLd(data)['@graph'].find(node => node['@type'] === 'Dataset') as { datePublished: string; dateModified: string };
    const page = findingsJsonLd(data)['@graph'].find(node => node['@type'] === 'WebPage') as { datePublished: string };
    assert.equal(dated.status, 'published');
    assert.deepEqual(publishedFindings([dated]), [dated]);
    assert.equal(dataset.datePublished, INSTANT);
    assert.equal(page.datePublished, INSTANT);
    assert.match(dataset.datePublished, ZONE);
    assert.equal(publishedOnLabel(dated), INSTANT);
    const xml = renderFindingsAtom([dated]);
    const feed = parseAtom(xml);
    const entry = feed.entries[0]!;
    assert.equal(feed.id, 'https://mirai-shigoto.com/pro/findings');
    assert.equal(feed.title, findingsCopy(data).T44);
    assert.equal(feed.self, 'https://mirai-shigoto.com/pro/findings/atom.xml');
    assert.match(feed.updated, ZONE);
    assert.equal(entry.id, findingsUrl(dated));
    assert.equal(entry.link, findingsUrl(dated));
    assert.equal(entry.title, findingsCopy(data).T43);
    assert.equal(entry.summary, findingsCopy(data).T42);
    assert.equal(entry.published, INSTANT);
    assert.equal(entry.updated, atomInstant(issue.modified_on));
    assert.match(entry.published!, ZONE);
    assert.match(entry.updated, ZONE);
    assert.match(entry.content, new RegExp(findingsCopy(data).T06.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(xml, /\{\{/);
    expect(() => applyFindingsPublication({ ...issue, status: 'draft' }, INSTANT)).toThrow('unsigned draft');
    expect(() => applyFindingsPublication(issue, '2026-10-22')).toThrow('timezone');
    expect(() => applyFindingsPublication(dated, '2026-10-23T00:00:00Z')).toThrow('already recorded');
  });

  test('publish script writes only a temporary manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'findings-publish-'));
    const path = join(dir, 'manifest.json');
    writeFileSync(path, `${JSON.stringify(issue, null, 2)}\n`);
    const next = writePublishedManifest(path, INSTANT);
    assert.equal(next.first_published_on, INSTANT);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).status, 'published');
    assert.equal(issue.first_published_on, null);
  });
});
