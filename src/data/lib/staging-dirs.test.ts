import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { isProcessAlive, orphanStagingDirNames } from './staging-dirs.js';

describe('orphanStagingDirNames', () => {
  const prefix = 'public.tmp-';
  const alive = new Set([100, 200]);
  const isAlive = (pid: number): boolean => alive.has(pid);

  test('deletes only dead-PID staging dirs and never its own or a live build', () => {
    const names = [
      'public.tmp-100', // own
      'public.tmp-200', // concurrent live build
      'public.tmp-300', // dead
      'public.tmp-abc', // not a PID
      'public.tmp-', // empty suffix
      'public.tmp-12x',
      'public.tmp-0',
      'public', // the publish dir itself
      'other.tmp-400',
    ];
    assert.deepEqual(orphanStagingDirNames(names, prefix, 'public.tmp-100', isAlive), ['public.tmp-300']);
  });

  test('the default liveness check treats the current process as alive', () => {
    assert.equal(isProcessAlive(process.pid), true);
    const own = `${prefix}${process.pid}`;
    assert.deepEqual(orphanStagingDirNames([own], prefix, 'public.tmp-1'), []);
  });
});
