// Bun-only `import.meta.dir`, used by the script tests and CLIs. `bun-types`
// is not a dependency, so declare the one member the scripts rely on.
interface ImportMeta {
  readonly dir: string;
}
