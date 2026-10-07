// opus55_score_chunks.py: a hung `claude -p` chunk is killed at --timeout.
// A /bin/sh stub stands in for claude; no model runs.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./opus55_score_chunks.py', import.meta.url));
const hasPython = spawnSync('python3', ['--version']).status === 0;

const HARNESS = `
import importlib.util, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("chunks", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
root = Path(sys.argv[2])
run = root / "run"
mod.run_chunk(root, run, "run", sys.argv[3], "chunk-01", [1, 2], 1, int(sys.argv[4]))
`;

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('a hung claude chunk is killed at --timeout and reported as a retryable TIMEOUT', { skip: !hasPython }, () => {
  const root = mkdtempSync(join(tmpdir(), 'opus55-chunks-'));
  try {
    mkdirSync(join(root, 'run', 'prompts'), { recursive: true });
    const pidFile = join(root, 'claude.pid');
    const stub = join(root, 'claude-stub');
    writeFileSync(stub, `#!/bin/sh\necho $$ > "${pidFile}"\nexec sleep 30\n`, 'utf8');
    chmodSync(stub, 0o755);
    const harness = join(root, 'harness.py');
    writeFileSync(harness, HARNESS, 'utf8');

    const started = Date.now();
    const res = spawnSync('python3', [harness, SCRIPT, root, stub, '1'], { encoding: 'utf8', timeout: 20_000 });
    assert.ok(Date.now() - started < 15_000, 'the chunk must not wait for the stub to exit');
    assert.equal(res.status, 1, res.stderr);
    assert.match(res.stderr, /STOP: TIMEOUT chunk-01 after 1s .*transport failure.*re-run the same command/);
    assert.ok(existsSync(pidFile));
    const pid = Number(readFileSync(pidFile, 'utf8').trim());
    assert.equal(isAlive(pid), false, `stub claude ${pid} must be killed`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--timeout rejects a non-positive value before any chunk runs', { skip: !hasPython }, () => {
  const res = spawnSync('python3', [SCRIPT, '--run', 'x', '--timeout', '0'], { encoding: 'utf8', cwd: tmpdir() });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--timeout must be a positive number of seconds/);
});

// A launcher whose grandchild ignores SIGTERM and holds the pipes, like a real CLI shim.
const launcherStub = (gcFile: string): string =>
  `#!/bin/sh\n/bin/sh -c 'trap "" TERM; echo $$ > "${gcFile}"; while :; do sleep 0.05; done' &\nwait\n`;

const GROUP_HARNESS = `
import importlib.util, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("chunks", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.install_stop_signals()
root = Path(sys.argv[2])
mod.run_chunk(root, root / "run", "run", sys.argv[3], "chunk-01", [1, 2], 1, int(sys.argv[4]), float(sys.argv[5]))
`;

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

const setupGroupFixture = (): { root: string; gcFile: string; harness: string; stub: string } => {
  const root = mkdtempSync(join(tmpdir(), 'opus55-chunks-'));
  mkdirSync(join(root, 'run', 'prompts'), { recursive: true });
  const gcFile = join(root, 'grandchild.pid');
  const stub = join(root, 'claude-stub');
  writeFileSync(stub, launcherStub(gcFile), 'utf8');
  chmodSync(stub, 0o755);
  const harness = join(root, 'harness.py');
  writeFileSync(harness, GROUP_HARNESS, 'utf8');
  return { root, gcFile, harness, stub };
};

test('a timed-out chunk also kills a grandchild that ignores SIGTERM', { skip: !hasPython || process.platform === 'win32' }, async () => {
  const { root, gcFile, harness, stub } = setupGroupFixture();
  try {
    const res = spawnSync('python3', [harness, SCRIPT, root, stub, '1', '0.2'], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(res.status, 1, res.stderr);
    assert.match(res.stderr, /STOP: TIMEOUT chunk-01 after 1s/);
    const pid = Number(readFileSync(gcFile, 'utf8').trim());
    assert.ok(await waitFor(() => !isAlive(pid), 3_000), `grandchild ${pid} must be killed with the claude group`);
  } finally {
    killPidFile(gcFile);
    rmSync(root, { recursive: true, force: true });
  }
});

test('Ctrl-C or SIGTERM to the chunk runner kills the claude process group', { skip: !hasPython || process.platform === 'win32' }, async () => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const { root, gcFile, harness, stub } = setupGroupFixture();
    try {
      const proc = spawn('python3', [harness, SCRIPT, root, stub, '600', '0.2'], { stdio: 'ignore' });
      const exited = new Promise<void>((r) => proc.on('exit', () => r()));
      assert.ok(await waitFor(() => existsSync(gcFile) && readFileSync(gcFile, 'utf8').trim() !== '', 10_000));
      proc.kill(signal);
      await exited;
      assert.notEqual(proc.exitCode, 0);
      const pid = Number(readFileSync(gcFile, 'utf8').trim());
      assert.ok(await waitFor(() => !isAlive(pid), 3_000), `${signal}: grandchild ${pid} must not survive the runner`);
    } finally {
      killPidFile(gcFile);
      rmSync(root, { recursive: true, force: true });
    }
  }
});
