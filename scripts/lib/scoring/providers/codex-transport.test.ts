// codex transport coverage without the real Codex CLI.
// A temp directory is prepended to PATH and holds a stub named `codex`.
// The stub is the only `codex` these tests execute.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { codexProvider, runCodexExec } from './codex.js';
import type { PrepareRunContext } from '../provider.js';

const STUB = `#!/bin/sh
log="\${CODEX_STUB_LOG:-/dev/null}"
printf '%s\\n' "$@" > "$log"
if [ "$1" = "--version" ]; then
  echo "codex-stub 0.0.0-test"
  exit 0
fi
if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then
  if [ "\${CODEX_STUB_HELP_EXIT:-0}" != "0" ]; then
    echo "bad option" >&2
    exit "$CODEX_STUB_HELP_EXIT"
  fi
  if [ "\${CODEX_STUB_HELP_MODE:-model}" = "none" ]; then
    echo "Usage: codex exec"
    exit 0
  fi
  printf '%s\\n' "  -m, --model <MODEL>"
  exit 0
fi
cat > "$log.stdin"
echo "stdout-from-stub"
echo "stderr-from-stub" >&2
prev=""
out=""
for arg in "$@"; do
  if [ "$prev" = "--output-last-message" ]; then
    out=$arg
  fi
  prev=$arg
done
if [ "\${CODEX_STUB_WRITE_LAST:-0}" = "1" ] && [ -n "$out" ]; then
  printf '%s' "\${CODEX_STUB_LAST_BODY}" > "$out"
fi
exit "\${CODEX_STUB_EXIT:-0}"
`;

const ctx = (dir: string, options: Readonly<Record<string, string>>): PrepareRunContext => ({
  cwd: dir,
  model: 'gpt-job0064',
  runDir: dir,
  options,
});

test('codex transport uses a PATH stub instead of the real CLI', async () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-transport-'));
  const stubDir = join(root, 'bin');
  const emptyDir = join(root, 'empty');
  const savedPath = process.env.PATH;
  const savedEnv = {
    log: process.env.CODEX_STUB_LOG,
    helpExit: process.env.CODEX_STUB_HELP_EXIT,
    helpMode: process.env.CODEX_STUB_HELP_MODE,
    writeLast: process.env.CODEX_STUB_WRITE_LAST,
    lastBody: process.env.CODEX_STUB_LAST_BODY,
    exit: process.env.CODEX_STUB_EXIT,
  };
  const clearStubEnv = (): void => {
    delete process.env.CODEX_STUB_LOG;
    delete process.env.CODEX_STUB_HELP_EXIT;
    delete process.env.CODEX_STUB_HELP_MODE;
    delete process.env.CODEX_STUB_WRITE_LAST;
    delete process.env.CODEX_STUB_LAST_BODY;
    delete process.env.CODEX_STUB_EXIT;
  };
  try {
    mkdirSync(stubDir);
    mkdirSync(emptyDir);
    const stubPath = join(stubDir, 'codex');
    writeFileSync(stubPath, STUB, 'utf8');
    chmodSync(stubPath, 0o755);
    process.env.PATH = `${stubDir}:${savedPath ?? ''}`;

    const version = spawnSync('codex', ['--version'], { encoding: 'utf8' });
    assert.equal(version.stdout, 'codex-stub 0.0.0-test\n', 'PATH must resolve the stub, not the real codex binary');

    assert.throws(
      () => codexProvider.preflight(ctx(root, { 'reasoning-effort': 'max' })),
      /--reasoning-effort must be one of/,
    );

    process.env.CODEX_STUB_HELP_EXIT = '2';
    assert.throws(
      () => codexProvider.preflight(ctx(root, {})),
      /exited with status 2: bad option/,
    );

    delete process.env.CODEX_STUB_HELP_EXIT;
    process.env.CODEX_STUB_HELP_MODE = 'none';
    assert.throws(
      () => codexProvider.preflight(ctx(root, { 'reasoning-effort': 'high' })),
      /does not advertise codex exec --model/,
    );

    delete process.env.CODEX_STUB_HELP_MODE;
    assert.doesNotThrow(() => codexProvider.preflight(ctx(root, { 'reasoning-effort': 'low' })));

    const logPath = join(root, 'exec.log');
    const lastPath = join(root, 'last.txt');
    const schemaPath = join(root, 'schema.json');
    process.env.CODEX_STUB_LOG = logPath;
    process.env.CODEX_STUB_WRITE_LAST = '1';
    process.env.CODEX_STUB_LAST_BODY = 'from-last-message';
    const withFile = await runCodexExec('PROMPT-BODY', {
      cwd: root,
      model: 'gpt-job0064',
      outputLastMessagePath: lastPath,
      outputSchemaPath: schemaPath,
    });
    assert.equal(withFile.exitCode, 0);
    assert.equal(withFile.stdout, 'stdout-from-stub\n');
    assert.equal(withFile.stderr, 'stderr-from-stub\n');
    assert.equal(withFile.rawText, 'from-last-message');
    const args = readFileSync(logPath, 'utf8').trim().split('\n');
    assert.deepEqual(args, [
      'exec',
      '--ephemeral',
      '--cd',
      root,
      '--color',
      'never',
      '--output-schema',
      schemaPath,
      '--output-last-message',
      lastPath,
      '--model',
      'gpt-job0064',
      '-',
    ]);
    assert.equal(readFileSync(`${logPath}.stdin`, 'utf8'), 'PROMPT-BODY');

    delete process.env.CODEX_STUB_WRITE_LAST;
    const missingLast = join(root, 'missing-last.txt');
    const fromStdout = await runCodexExec('PROMPT-BODY', {
      cwd: root,
      model: 'gpt-job0064',
      outputLastMessagePath: missingLast,
      outputSchemaPath: schemaPath,
    });
    assert.equal(fromStdout.rawText, 'stdout-from-stub\n');
    assert.equal(fromStdout.exitCode, 0);

    clearStubEnv();
    process.env.PATH = emptyDir;
    const failed = await runCodexExec('PROMPT-BODY', {
      cwd: root,
      model: 'gpt-job0064',
      outputLastMessagePath: lastPath,
      outputSchemaPath: schemaPath,
    });
    assert.equal(failed.exitCode, 1);
    assert.match(failed.stderr, /Executable not found in \$PATH: "codex"/);
    assert.equal(failed.rawText, '');
  } finally {
    process.env.PATH = savedPath;
    const restore = (key: string, value: string | undefined): void => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('CODEX_STUB_LOG', savedEnv.log);
    restore('CODEX_STUB_HELP_EXIT', savedEnv.helpExit);
    restore('CODEX_STUB_HELP_MODE', savedEnv.helpMode);
    restore('CODEX_STUB_WRITE_LAST', savedEnv.writeLast);
    restore('CODEX_STUB_LAST_BODY', savedEnv.lastBody);
    restore('CODEX_STUB_EXIT', savedEnv.exit);
    rmSync(root, { recursive: true, force: true });
  }
});

test('runCodexExec rejects a call that prepareRun did not set up', async () => {
  const response = await runCodexExec('prompt', {
    cwd: '/tmp',
    model: 'gpt-job0064',
    outputLastMessagePath: '/tmp/last.txt',
  });
  assert.equal(response.exitCode, 1);
  assert.match(response.stderr, /outputSchemaPath/);
});
