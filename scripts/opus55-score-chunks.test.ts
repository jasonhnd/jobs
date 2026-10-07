// opus55_score_chunks.py: a hung `claude -p` chunk is killed at --timeout.
// A /bin/sh stub stands in for claude; no model runs.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
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
