// runCliProcess coverage with /bin/sh children only — no scoring CLI runs.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CLI_CALL_TIMEOUT_MS, cliTimeoutMessage, parseCallTimeoutMs, runCliProcess } from './cli-spawn.js';
import { classifyErrorText, shouldBackoff, shouldRetry } from './errors.js';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitFor = async (check: () => boolean, ms: number): Promise<boolean> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return check();
};

describe('runCliProcess', () => {
  test('returns stdout, stderr and the exit code of a child that finishes', async () => {
    const res = await runCliProcess('/bin/sh', ['-c', 'cat; echo err >&2; exit 3'], {
      cwd: tmpdir(),
      input: 'PROMPT',
      timeoutMs: 10_000,
    });
    assert.equal(res.exitCode, 3);
    assert.equal(res.stdout, 'PROMPT');
    assert.equal(res.stderr, 'err\n');
    assert.equal(res.error, null);
    assert.equal(res.timedOut, false);
  });

  test('kills a hung child and settles with a retryable transport failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-spawn-'));
    try {
      const pidFile = join(dir, 'pid');
      const started = Date.now();
      const res = await runCliProcess('/bin/sh', ['-c', `echo $$ > "${pidFile}"; exec sleep 30`], {
        cwd: dir,
        timeoutMs: 300,
        killGraceMs: 200,
      });
      assert.ok(Date.now() - started < 5_000, 'must settle long before the child would exit');
      assert.equal(res.timedOut, true);
      assert.equal(res.exitCode, null);
      assert.match(res.error ?? '', /timed out after 0s and was killed/);
      const pid = Number(readFileSync(pidFile, 'utf8').trim());
      assert.ok(await waitFor(() => !isAlive(pid), 3_000), `child ${pid} must be killed`);
      const kind = classifyErrorText(res.error ?? '');
      assert.equal(kind, 'transport');
      assert.equal(shouldRetry(kind), true);
      assert.equal(shouldBackoff(kind), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('SIGKILLs a child that ignores SIGTERM', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-spawn-'));
    try {
      const pidFile = join(dir, 'pid');
      const res = await runCliProcess(
        '/bin/sh',
        ['-c', `trap '' TERM; echo $$ > "${pidFile}"; while :; do sleep 0.05; done`],
        { cwd: dir, timeoutMs: 300, killGraceMs: 200 },
      );
      assert.equal(res.timedOut, true);
      const pid = Number(readFileSync(pidFile, 'utf8').trim());
      assert.ok(await waitFor(() => !isAlive(pid), 3_000), `child ${pid} must be SIGKILLed`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports a spawn error without throwing', async () => {
    const res = await runCliProcess('/nonexistent/scoring-cli', [], { cwd: tmpdir(), timeoutMs: 5_000 });
    assert.equal(res.exitCode, 1);
    assert.equal(res.timedOut, false);
    assert.match(res.error ?? '', /ENOENT/);
  });

  test('the timeout message names the command and the limit', () => {
    assert.equal(
      cliTimeoutMessage('grok', 1_200_000),
      'grok timed out after 1200s and was killed (transport failure, retryable)',
    );
  });
});

describe('parseCallTimeoutMs', () => {
  test('defaults, accepts positive integers, rejects anything else', () => {
    assert.equal(parseCallTimeoutMs(undefined), CLI_CALL_TIMEOUT_MS);
    assert.equal(parseCallTimeoutMs('90'), 90_000);
    for (const bad of ['true', '0', '-5', '1.5', '', 'abc']) {
      assert.throws(() => parseCallTimeoutMs(bad), /--call-timeout-sec must be a positive integer/);
    }
  });
});
