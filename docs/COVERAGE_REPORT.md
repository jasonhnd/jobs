# Coverage report

`bun test --coverage` reports only source files a test loaded. Files that no
test imports are absent, so the headline percentage is not the whole tree.

Bun 1.4 has no flag that forces those files into the report, and this repo
does not set coverage options in `bunfig.toml`. `bun run test:coverage` runs
the same unit tests as `bun run test`, writes Bun's lcov file, then appends
every never-loaded source file at 0%.

The source set is non-test `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`
files under `src/`, `scripts/`, and `api/`, plus `middleware.ts`. The script
does not import or execute those files. It writes:

- `.cache/cov/lcov.info` — Bun's loaded-file report
- `.cache/cov/lcov.with-untested.info` — same records plus 0% files
- `.cache/cov/untested-files.txt` — loaded-file percentage, augmented
  percentage, and the blind-spot list

`.cache/` is gitignored. The appender is `scripts/append-untested-coverage.ts`.
Its test checks that the F-9 paths from the 2026-10-02 coverage audit stay in
the source scan, using a temp directory for the lcov fixture.
