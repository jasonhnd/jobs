/**
 * cli-spawn.ts — run one scoring CLI call (codex, grok) with a hard timeout.
 *
 * A hung CLI must not hang the run: mapLimit only finishes when every call
 * settles. On timeout the child gets SIGTERM, then SIGKILL after a grace
 * period, and the call settles at once with a "timed out" error. That wording
 * is classified as `transport` by errors.ts, so the runner retries it with
 * backoff like any other transport failure.
 */
import { spawn } from 'node:child_process';

/** Default per-call limit. One occupation normally answers in a few minutes. */
export const CLI_CALL_TIMEOUT_MS = 20 * 60_000;
/** Time between SIGTERM and SIGKILL for a child that ignores SIGTERM. */
export const CLI_KILL_GRACE_MS = 5_000;

export interface CliRunOptions {
  readonly cwd: string;
  /** Written to stdin, which is then closed. Omit to give the child no stdin. */
  readonly input?: string;
  readonly timeoutMs?: number;
  readonly killGraceMs?: number;
}

export interface CliRunResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Spawn error or timeout message; null when the process exited on its own. */
  readonly error: string | null;
  readonly timedOut: boolean;
}

export function cliTimeoutMessage(command: string, timeoutMs: number): string {
  return `${command} timed out after ${Math.round(timeoutMs / 1000)}s and was killed (transport failure, retryable)`;
}

/** Parse `--call-timeout-sec`; undefined keeps the default. */
export function parseCallTimeoutMs(raw: string | undefined): number {
  if (raw === undefined) return CLI_CALL_TIMEOUT_MS;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1) {
    throw new Error('--call-timeout-sec must be a positive integer');
  }
  return n * 1000;
}

export function runCliProcess(command: string, args: readonly string[], options: CliRunOptions): Promise<CliRunResult> {
  const timeoutMs = options.timeoutMs ?? CLI_CALL_TIMEOUT_MS;
  const killGraceMs = options.killGraceMs ?? CLI_KILL_GRACE_MS;
  return new Promise((resolveRun) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const finish = (result: Omit<CliRunResult, 'stdout' | 'stderr'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const killer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, killGraceMs);
      killer.unref();
      finish({ exitCode: null, error: cliTimeoutMessage(command, timeoutMs), timedOut: true });
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      finish({ exitCode: 1, error: err.message, timedOut: false });
    });
    child.on('close', (code) => {
      finish({ exitCode: code, error: null, timedOut: false });
    });
    if (options.input !== undefined && child.stdin) {
      // A child that exits without reading stdin raises EPIPE here; the close
      // handler already reports the exit.
      child.stdin.on('error', () => {});
      child.stdin.end(options.input, 'utf8');
    }
  });
}
