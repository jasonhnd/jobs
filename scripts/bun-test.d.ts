// Minimal ambient types for the `bun:test` members the script tests use.
// `bun-types` is not a dependency (see bun-import-meta.d.ts), so declare just
// the subset needed for `tsc --noEmit`. Runtime behaviour comes from bun itself.
declare module 'bun:test' {
  type AnyFn = (...args: any[]) => any;

  export interface Mock<T extends AnyFn = AnyFn> {
    (...args: Parameters<T>): ReturnType<T>;
    mock: { calls: Parameters<T>[] };
    mockReturnValue(value: ReturnType<T>): Mock<T>;
    mockImplementation(fn: T): Mock<T>;
    mockRestore(): void;
  }

  export interface Matchers {
    not: Matchers;
    rejects: Matchers;
    toBe(expected: unknown): any;
    toContain(expected: unknown): any;
    toMatch(expected: RegExp | string): any;
    toThrow(expected?: unknown): any;
    toBeGreaterThan(expected: number | bigint): any;
    toBeGreaterThanOrEqual(expected: number | bigint): any;
  }

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matchers;
  export function spyOn<T extends object, K extends keyof T>(
    target: T,
    key: K,
  ): Mock<T[K] extends AnyFn ? T[K] : AnyFn>;
}
