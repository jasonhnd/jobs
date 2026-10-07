/**
 * Which `<TS_DIST>.tmp-<pid>` staging siblings a build may delete.
 *
 * A hard-killed build leaves its staging dir behind. Only a dir whose PID
 * belongs to no running process is an orphan; a concurrent build's dir (live
 * PID) and anything without a numeric PID suffix are never touched.
 */

/** True when `pid` is a running process (EPERM means it exists but is not ours). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

export function orphanStagingDirNames(
  names: readonly string[],
  orphanPrefix: string,
  ownName: string,
  isAlive: (pid: number) => boolean = isProcessAlive,
): string[] {
  return names.filter((name) => {
    if (name === ownName || !name.startsWith(orphanPrefix)) return false;
    const suffix = name.slice(orphanPrefix.length);
    if (!/^\d+$/.test(suffix)) return false;
    const pid = Number(suffix);
    return Number.isSafeInteger(pid) && pid > 0 && !isAlive(pid);
  });
}
