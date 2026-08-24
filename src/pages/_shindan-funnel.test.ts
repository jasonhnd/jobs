import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { runInNewContext } from 'node:vm';

interface FunnelEvent {
  readonly name: string;
  readonly params: Readonly<Record<string, number>>;
}

interface FunnelState {
  readonly started: boolean;
  readonly lastStep: number;
  readonly events: readonly FunnelEvent[];
}

interface RuntimeHooks {
  nextFunnelEvents(started: boolean, lastStep: number, answered: number): FunnelState;
}

function loadRuntimeHooks(): RuntimeHooks {
  const hooks: Partial<RuntimeHooks> = {};
  const source = readFileSync('src/pages/_shindan.js', 'utf8');
  runInNewContext(source, {
    document: {
      getElementById: () => null,
      readyState: 'loading',
      addEventListener: () => undefined,
    },
    window: { __SHINDAN_TEST_HOOKS__: hooks },
  });
  assert.equal(typeof hooks.nextFunnelEvents, 'function');
  return hooks as RuntimeHooks;
}

const hooks = loadRuntimeHooks();

/** Bun 1.4 deepStrictEqual treats vm.runInNewContext arrays as another realm. */
function hostClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('shindan quiz funnel (#256)', () => {
  test('emits nothing before the first answer', () => {
    const next = hooks.nextFunnelEvents(false, 0, 0);
    assert.equal(next.started, false);
    assert.equal(next.lastStep, 0);
    assert.deepEqual(hostClone(next.events), []);
  });

  test('first answer emits start then step value 1', () => {
    const next = hooks.nextFunnelEvents(false, 0, 1);
    assert.equal(next.started, true);
    assert.equal(next.lastStep, 1);
    assert.deepEqual(
      hostClone(next.events.map((event) => [event.name, event.params])),
      [
        ['shindan_start', {}],
        ['shindan_step', { value: 1 }],
      ],
    );
  });

  test('later answers emit only the new steps', () => {
    const next = hooks.nextFunnelEvents(true, 1, 3);
    assert.equal(next.started, true);
    assert.equal(next.lastStep, 3);
    assert.deepEqual(
      hostClone(next.events.map((event) => [event.name, event.params.value])),
      [
        ['shindan_step', 2],
        ['shindan_step', 3],
      ],
    );
  });

  test('repeat of the same count is a no-op', () => {
    const next = hooks.nextFunnelEvents(true, 4, 4);
    assert.deepEqual(hostClone(next.events), []);
    assert.equal(next.lastStep, 4);
  });

  test('ninth answer reaches value 9 without a second start', () => {
    const next = hooks.nextFunnelEvents(true, 8, 9);
    assert.equal(next.started, true);
    assert.deepEqual(hostClone(next.events), [{ name: 'shindan_step', params: { value: 9 } }]);
  });

  test('source restores a result without calling the funnel helper from init', () => {
    const source = readFileSync('src/pages/_shindan.js', 'utf8');
    assert.match(source, /resultFromUrl\(\)/);
    assert.match(source, /resultFromStorage\(\)/);
    assert.doesNotMatch(
      source,
      /fromUrl[\s\S]{0,200}emitQuizFunnel|fromStorage[\s\S]{0,200}emitQuizFunnel/,
    );
    assert.match(source, /\$form\.addEventListener\('change'/);
  });
});
