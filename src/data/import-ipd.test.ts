import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { parseArgs, resolveRetrievalMetadata } from './import-ipd.js';

const hashes = { numeric: 'numeric-hash', description: 'description-hash' };
const recorded = {
  ipd_retrieved_at: '2026-05-02',
  ipd_retrieved_at_evidence: 'Verified original workbook timestamps and hashes.',
  files: {
    numeric: { sha256: hashes.numeric },
    description: { sha256: hashes.description },
  },
};

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'import-ipd-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, provenancePath: join(root, 'provenance.json') };
}

describe('IPD retrieval metadata', () => {
  test('reads the explicit CLI date and rejects a missing argument', () => {
    assert.equal(parseArgs(['--retrieved-at', '2026-05-02']).retrievedAt, '2026-05-02');
    assert.throws(() => parseArgs(['--retrieved-at']), /requires a YYYY-MM-DD date/);
    assert.throws(() => parseArgs(['--retrieved-at', '--numeric', 'input.xlsx']), /requires a YYYY-MM-DD date/);
  });

  test('preserves the recorded date and evidence for matching workbooks', async (t) => {
    const { provenancePath } = await fixture(t);
    await writeFile(provenancePath, JSON.stringify(recorded));
    assert.deepEqual(await resolveRetrievalMetadata(undefined, provenancePath, hashes), {
      retrievedAt: '2026-05-02', evidence: recorded.ipd_retrieved_at_evidence,
    });
  });

  test('accepts an explicit date without provenance', async (t) => {
    const { provenancePath } = await fixture(t);
    assert.deepEqual(await resolveRetrievalMetadata('2024-02-29', provenancePath, hashes), {
      retrievedAt: '2024-02-29',
    });
  });

  test('fails instead of substituting today when the date is missing', async (t) => {
    const { provenancePath } = await fixture(t);
    await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, hashes), /retrieval date is required/);
    await writeFile(provenancePath, '{}');
    await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, hashes), /retrieval date is required/);
  });

  test('rejects malformed, impossible, or non-string dates from either source', async (t) => {
    const { provenancePath } = await fixture(t);
    for (const date of ['', 'today', '2026-5-2', '2026-02-29', '2026-04-31', '2026-05-02T00:00:00Z']) {
      await assert.rejects(resolveRetrievalMetadata(date, provenancePath, hashes), /valid YYYY-MM-DD date/);
    }
    for (const date of [null, 20260502, '2026-02-29']) {
      await writeFile(provenancePath, JSON.stringify({ ...recorded, ipd_retrieved_at: date }));
      await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, hashes), /valid YYYY-MM-DD date/);
    }
  });

  test('does not silently ignore corrupt provenance', async (t) => {
    const { provenancePath } = await fixture(t);
    await writeFile(provenancePath, '{');
    await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, hashes), SyntaxError);
  });

  test('requires an explicit date if either source hash is different or missing', async (t) => {
    const { provenancePath } = await fixture(t);
    await writeFile(provenancePath, JSON.stringify(recorded));
    for (const changed of [{ ...hashes, numeric: 'new' }, { ...hashes, description: 'new' }]) {
      await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, changed), /source hashes differ/);
      assert.deepEqual(await resolveRetrievalMetadata('2026-05-02', provenancePath, changed), { retrievedAt: '2026-05-02' });
    }
    await writeFile(provenancePath, JSON.stringify({ ipd_retrieved_at: '2026-05-02' }));
    await assert.rejects(resolveRetrievalMetadata(undefined, provenancePath, hashes), /source hashes differ/);
  });

  test('explicit override retains evidence only for the same files and date', async (t) => {
    const { provenancePath } = await fixture(t);
    await writeFile(provenancePath, JSON.stringify(recorded));
    assert.deepEqual(await resolveRetrievalMetadata('2026-05-02', provenancePath, hashes), {
      retrievedAt: '2026-05-02', evidence: recorded.ipd_retrieved_at_evidence,
    });
    assert.deepEqual(await resolveRetrievalMetadata('2026-06-01', provenancePath, hashes), { retrievedAt: '2026-06-01' });
  });

  test('CLI exits nonzero before parsing workbooks or writing output without a retrieval date', async (t) => {
    const { root } = await fixture(t);
    const sourcePath = join(root, 'fixture.xlsx');
    await writeFile(sourcePath, 'No workbook parsing should occur.');
    const child = spawnSync(process.execPath, [
      resolve('src/data/import-ipd.ts'), '--numeric', sourcePath, '--description', sourcePath,
    ], { cwd: root, encoding: 'utf-8' });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /IPD retrieval date is required/);
    await assert.rejects(readFile(join(root, 'data/.ipd_provenance.json')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(root, 'data/occupations/0001.json')), { code: 'ENOENT' });
  });

  test('CLI writes the same retrieval date to provenance and occupations across a reimport', async (t) => {
    const { root } = await fixture(t);
    await mkdir(join(root, 'data/labels'), { recursive: true });
    const numeric = new ExcelJS.Workbook();
    const numSheet = numeric.addWorksheet('IPD形式');
    numSheet.getCell(18, 3).value = 'IPD_01_01_001';
    numSheet.getCell(19, 3).value = 1;
    const numericPath = join(root, 'numeric.xlsx');
    await numeric.xlsx.writeFile(numericPath);
    const description = new ExcelJS.Workbook();
    const descSheet = description.addWorksheet('解説系');
    descSheet.getCell(14, 3).value = 'IPD_01_01_001';
    descSheet.getCell(14, 4).value = 'IPD_02_01_001';
    descSheet.getCell(15, 3).value = 1;
    descSheet.getCell(15, 4).value = 'Fixture occupation';
    const descriptionPath = join(root, 'description.xlsx');
    await description.xlsx.writeFile(descriptionPath);

    const args = [resolve('src/data/import-ipd.ts'), '--numeric', numericPath, '--description', descriptionPath];
    const first = spawnSync(process.execPath, [...args, '--retrieved-at', '2024-02-29'], { cwd: root, encoding: 'utf-8' });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const provenancePath = join(root, 'data/.ipd_provenance.json');
    const provenance = JSON.parse(await readFile(provenancePath, 'utf-8'));
    const occupationPath = join(root, 'data/occupations/0001.json');
    const occupation = JSON.parse(await readFile(occupationPath, 'utf-8'));
    assert.equal(provenance.ipd_retrieved_at, '2024-02-29');
    assert.equal(occupation.data_source_versions.ipd_retrieved_at, '2024-02-29');
    assert.equal(provenance.ipd_ingested_at, occupation.ingested_at);
    assert.notEqual(provenance.ipd_ingested_at, provenance.ipd_retrieved_at);

    provenance.ipd_retrieved_at_evidence = recorded.ipd_retrieved_at_evidence;
    await writeFile(provenancePath, JSON.stringify(provenance));
    const second = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf-8' });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(JSON.parse(await readFile(provenancePath, 'utf-8')).ipd_retrieved_at_evidence, recorded.ipd_retrieved_at_evidence);
    assert.deepEqual(JSON.parse(await readFile(occupationPath, 'utf-8')), occupation);
  });
});
