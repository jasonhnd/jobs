/**
 * cli-spawn.ts — run one scoring CLI call (codex, grok) with a hard timeout.
 *
 * A hung CLI must not hang the run: mapLimit only finishes when every call
 * settles. On timeout the child's whole process tree gets SIGTERM, then SIGKILL
 * after a grace period, and the call settles at once with a "timed out" error.
 * That wording is classified as `transport` by errors.ts, so the runner retries
 * it with backoff like any other transport failure.
 *
 * The CLIs are launchers (Node or shell shims), so killing only the direct
 * child can leave a grandchild running that still holds the pipes. On POSIX
 * the child leads its own process group and the group is signalled; on
 * Windows `taskkill /T` kills the tree. A detached group no longer receives
 * the terminal's Ctrl-C, so while any group is live this module forwards
 * SIGINT/SIGTERM/SIGHUP to it, SIGKILLs survivors after the grace period and
 * then re-raises the signal; on process exit it SIGKILLs whatever is left.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

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

const IS_WINDOWS = process.platform === 'win32';
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
type ForwardedSignal = (typeof FORWARDED_SIGNALS)[number];
const TREE_POLL_MS = 50;

/** Signal the child's whole tree. Errors (tree already gone) are ignored. */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    if (IS_WINDOWS) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    // ESRCH: every process in the group has exited. macOS reports EPERM for a
    // group whose only member is an unreaped zombie, which is gone too.
  }
}

/** True while any process of the child's tree may still run (always true on Windows). */
function treeAlive(child: ChildProcess): boolean {
  if (child.pid === undefined) return false;
  if (IS_WINDOWS) return true;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Process trees that may still be running, with each one's SIGKILL grace. */
const liveTrees = new Map<ChildProcess, number>();
let stopping = false;

function onRunnerSignal(signal: ForwardedSignal): void {
  if (stopping) return;
  stopping = true;
  const trees = [...liveTrees];
  for (const [child] of trees) killTree(child, signal);
  const deadline = Date.now() + Math.max(0, ...trees.map(([, ms]) => ms));
  const poll = setInterval(() => {
    if (Date.now() < deadline && trees.some(([child]) => treeAlive(child))) return;
    clearInterval(poll);
    for (const [child] of trees) killTree(child, 'SIGKILL');
    liveTrees.clear();
    uninstallHandlers();
    // Without other listeners the default action ends the runner as the signal would have.
    if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
  }, TREE_POLL_MS);
}

function onRunnerExit(): void {
  for (const child of liveTrees.keys()) killTree(child, 'SIGKILL');
  liveTrees.clear();
}

let handlersInstalled = false;
function installHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  for (const signal of FORWARDED_SIGNALS) process.on(signal, onRunnerSignal);
  process.on('exit', onRunnerExit);
}
function uninstallHandlers(): void {
  if (!handlersInstalled) return;
  handlersInstalled = false;
  for (const signal of FORWARDED_SIGNALS) process.off(signal, onRunnerSignal);
  process.off('exit', onRunnerExit);
}

function trackTree(child: ChildProcess, killGraceMs: number): void {
  liveTrees.set(child, killGraceMs);
  installHandlers();
}
function untrackTree(child: ChildProcess): void {
  liveTrees.delete(child);
  if (liveTrees.size === 0 && !stopping) uninstallHandlers();
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
      // Own process group on POSIX so the timeout can signal the whole tree.
      detached: !IS_WINDOWS,
    });
    if (child.pid !== undefined) trackTree(child, killGraceMs);
    const finish = (result: Omit<CliRunResult, 'stdout' | 'stderr'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      killTree(child, 'SIGTERM');
      // The leader may exit while a grandchild that ignores SIGTERM keeps
      // running, so the group gets SIGKILL whatever the leader did. If the
      // runner exits first, onRunnerExit sends it instead.
      const killer = setTimeout(() => {
        killTree(child, 'SIGKILL');
        untrackTree(child);
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
      untrackTree(child);
      finish({ exitCode: 1, error: err.message, timedOut: false });
    });
    child.on('close', (code) => {
      // After a timeout the SIGKILL timer still owns the tree.
      if (!settled) untrackTree(child);
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
