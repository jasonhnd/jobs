// runCliProcess coverage with /bin/sh children only — no scoring CLI runs.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const CLI_SPAWN = fileURLToPath(new URL('./cli-spawn.ts', import.meta.url));

/** A launcher (like a Node or shell shim) whose grandchild ignores SIGTERM and holds the pipes. */
const launcherScript = (gcFile: string): string =>
  `/bin/sh -c 'trap "" TERM; echo $$ > "${gcFile}"; while :; do sleep 0.05; done' & wait`;

const killPidFile = (file: string): void => {
  try {
    process.kill(Number(readFileSync(file, 'utf8').trim()), 'SIGKILL');
  } catch {
    // already gone or never started
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

  test('kills a grandchild that ignores SIGTERM when the launcher times out', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-spawn-'));
    const gcFile = join(dir, 'grandchild.pid');
    try {
      const res = await runCliProcess('/bin/sh', ['-c', launcherScript(gcFile)], {
        cwd: dir,
        timeoutMs: 400,
        killGraceMs: 200,
      });
      assert.equal(res.timedOut, true);
      const pid = Number(readFileSync(gcFile, 'utf8').trim());
      assert.ok(await waitFor(() => !isAlive(pid), 3_000), `grandchild ${pid} must be killed with its group`);
    } finally {
      killPidFile(gcFile);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a runner stopped by SIGINT or SIGTERM takes the CLI process group down with it', { skip: process.platform === 'win32' }, async () => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const dir = mkdtempSync(join(tmpdir(), 'cli-spawn-'));
      const gcFile = join(dir, 'grandchild.pid');
      try {
        const runner = join(dir, 'runner.ts');
        writeFileSync(
          runner,
          `import { runCliProcess } from ${JSON.stringify(CLI_SPAWN)};\n` +
            `await runCliProcess('/bin/sh', ['-c', ${JSON.stringify(launcherScript(gcFile))}], ` +
            `{ cwd: ${JSON.stringify(dir)}, timeoutMs: 60_000, killGraceMs: 200 });\n`,
          'utf8',
        );
        const proc = spawn(process.execPath, [runner], { stdio: 'ignore' });
        const exited = new Promise<NodeJS.Signals | null>((r) => proc.on('exit', (_c, sig) => r(sig)));
        assert.ok(await waitFor(() => existsSync(gcFile) && readFileSync(gcFile, 'utf8').trim() !== '', 10_000));
        proc.kill(signal);
        assert.equal(await exited, signal, 'the runner must still die by the signal it received');
        const pid = Number(readFileSync(gcFile, 'utf8').trim());
        assert.ok(await waitFor(() => !isAlive(pid), 3_000), `${signal}: grandchild ${pid} must not survive the runner`);
      } finally {
        killPidFile(gcFile);
        rmSync(dir, { recursive: true, force: true });
      }
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
