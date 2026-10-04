# Toolchain contract

Canonical pins for install, build, and runtime. README’s one-line stack table is a reader summary; **this file is what an implementer must follow**. Version bumps in the #280 series update the tables here in the same PR as the lockfile.

Issue-first / docs-first order: [`WORKFLOW.md`](WORKFLOW.md). Contributor commands: [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Edge behaviour: [`EDGE_SECURITY.md`](EDGE_SECURITY.md). SEO snapshots: [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md).

Historical deployment evidence recorded **as of 2026-08-25** on `preview` `aa1e7e40` (PR 310 merged; alias `pre.mirai-shigoto.com` → `dpl_H6SSo3shrsTzHvMAtr8TyZwV56yz`). Re-read Vercel **Build** logs (not email) and `vercel inspect --format=json` (`lambda.runtime`, not the CLI `λ` glyph) when changing Bun, `bunVersion`, `engines.node`, or Function `runtime`.

Refreshed 2026-09-24 on preview 9b4e7197 for the 2026-09 series (#635).

**PR 299** set `"bunVersion": "1.4.x"` and did **not** put Functions on Bun 1.4 (`engines.node` won; inspect was still Edge). **#302–#305** (PRs 307–310) removed `engines.node` and moved `api/og`, `api/shindan-share`, and middleware to `runtime: "nodejs"`. On that preview they run as `lambda.runtime: "bun1.4.x"`, `edge: null`. §9 is the shipped series, not remaining work.

---

## 1. Three Vercel planes

A deploy is not one runtime. Mixing these planes is how `bunVersion` accidentally replaces Edge.

| Plane | What it is | What sets the version | What actually runs |
| --- | --- | --- | --- |
| **A Install** | `vercel.json` `installCommand` | Build-image Bun (`"bunVersion": "1.4.x"`), unless the command pins with `bunx bun@x.y.z` | Today: `bun install --frozen-lockfile`. **2026-09-20:** the `bunx bun@1.4.0` pin stopped working on Vercel CLI 59.23.2 — the bunx bootstrap exited 1 before `bun install` ran, on every deploy (preview `d0d945ed`, then an empty-commit retry). The build image's own Bun is 1.4.x via `bunVersion`, so the exact pin is dropped; the current CI pin is maintained only in §2 (updated by [PR #653](https://github.com/jasonhnd/jobs/pull/653)); it is separate from this failed historical bootstrap. Must be able to read `bun.lock`. |
| **B Build** | `buildCommand` in the same container | **No `engines.node`** (#302) so it cannot steal Function runtime from `bunVersion`. Builds stay Node **24.x** via platform default + `.nvmrc` + CI `node-version: 24.x`. | `rm -rf dist-astro node_modules/.astro && bun run build` only. `typecheck`, `verify:gates` and `test` run in GitHub CI `quality`, not on Vercel (Issue #855). `bun run build` still runs `check-rendered-leaks` and `compute-csp-hashes`, so CSP hashes are regenerated against the real `PUBLIC_*` values. **`astro build` uses the `astro` bin shebang (Node).** ETL, `bun test`, and most `scripts/*` use Bun. |
| **C Runtime** | After the deploy is live | Not the install Bun | HTML: CDN files from `outputDirectory` `dist-astro/`. **Today (#305):** `api/og`, `api/shindan-share`, and `middleware.ts` are `runtime: "nodejs"` + `"bunVersion": "1.4.x"` (Bun 1.4). OG/share `regions: ["hnd1", "kix1"]`. Middleware uses `@vercel/functions` (`next`, `rewrite`, `waitUntil`). |

This repo does **not** use `@astrojs/vercel`. Static Astro + `outputDirectory: dist-astro` is the deploy model. Do not add the adapter as part of a version bump.

---

## 2. Current versions

Current Bun targets and install commands are centralized here. Tracked CI and
bootstrap pins were reconciled against `.github/workflows/ci.yml` and
`.cursor/install.sh`, and the install command against `vercel.json`, on
2026-10-02. This is configuration evidence, not a new deployment/runtime check.
Local observations and Vercel build/runtime observations retain their dates:
Node v24.20.0 is the earlier local record retained by the 2026-09-24 refresh,
not a new measurement of this executor's shell. Bun 1.4.2 is the local/CI target
from [PR #653](https://github.com/jasonhnd/jobs/pull/653).

| Item | Local target / recorded observation | CI `quality` (`.github/workflows/ci.yml`) | Vercel configuration / dated observation |
| --- | --- | --- | --- |
| Node | **v24.20.0** (`nvm alias default` → 24). Non-interactive shells may still see Hermes **22** first via `~/.local/bin/node`. | `24.x` via `actions/setup-node` | Builds: **no `engines.node`** (#302). Node **24.x** via Vercel default ([Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)). Functions do **not** use this — they use `bunVersion`. |
| Bun | **1.4.2** (`744846f84`) | **`bun-version: 1.4.2`** | Install Command: `bun install --frozen-lockfile` (build image 1.4.x (observed **1.4.1** on 2026-09-23); the bunx pin was dropped 2026-09-20, see §1 plane A). **`"bunVersion": "1.4.x"`**. `#303`–`#305`: `api/og`, `api/shindan-share`, **and middleware** all `lambda.runtime: "bun1.4.x"` (`edge: null`). Historical 2026-08-25 post-build pack step on `aa1e7e40` (after the Edge migration) printed `bun install v1.4.0` twice (not 1.3.14). Keep lockfileVersion 1 until a dedicated Issue proves v2. |
| Astro | lockfile **7.3.5** | same lockfile | same |
| `esbuild` | **0.28.2** (exact `package.json` pin); home-script minification in `astro.config.mjs`, guarded by `scripts/home-js-asset.test.ts` | same lockfile | same home-script minification during the Astro build |
| `typescript` (JS package) | **7.0.2** (native compiler; platform binary via optional deps) | same | same |
| typecheck binary | `typescript` **7.0.2** via `node node_modules/typescript/bin/tsc --noEmit` (the `@typescript/native` alias was removed in #635 order 8) | same | same (`bun run typecheck` in CI `quality`; not in `buildCommand` since Issue #855) |
| `@vercel/og` | **1.0.1** (exact pin; 1.0.2/1.0.3 abort — vercel/satori#801). overrides.fflate ^0.7.5. | same | `api/og` `runtime: "nodejs"` + Bun 1.4. Named `GET`. |
| `@vercel/functions` | **3.9.9** | same | `middleware.ts` (`next`, `rewrite`, `waitUntil`). `@vercel/edge` removed. |
| React | **19.3.0** (`@types/react` **19.3.0**; OG `createElement` only; no `@astrojs/react`, no client React) | same | inside the `api/og` Bun 1.4 bundle |
| Playwright / axe | **1.63.0** / **4.13.0** (exact pins, no `^`; Chromium 153) | **executed** since design-1.20 (f05ba940, 2026-09-17): bun x playwright install --with-deps chromium, then bun x playwright test --reporter=line | npm packages may install as devDependencies; **Chromium is not installed**; e2e is not in `buildCommand` |
| `api/og` Function | — | — | Preview `aa1e7e40`: **bun1.4.x**, `edge: null`, **18,051,748** bytes, `[hnd1, kix1]`. Named `GET`. (Issue 287 Edge was 855.83 KB.) CLI inspect may still draw `λ` — that glyph is not proof of Edge; read `builds[].output[].lambda.runtime` and `edge` in deployment JSON. |
| `api/shindan-share` | — | — | Preview `aa1e7e40`: **bun1.4.x**, `edge: null`, **373,416** bytes, `[hnd1, kix1]`. Named `GET`. |
| middleware | — | — | Preview `aa1e7e40`: **bun1.4.x**, `edge: null`, **57,461** bytes, `[iad1, hnd1]`. Default export + `@vercel/functions`. |
| Vercel plan Edge gzip limit | — | — | Unused while there are **no** Edge entries. Historical: Hobby 1MB / Pro 2MB / Enterprise 4MB. |

overrides.sharp ^0.35.4 (GHSA-rgj7-g3m4-5g8c; astro and @vercel/og only declare sharp as optional ^0.35).

`bun.lock` today: **`lockfileVersion: 1`**. Current CI and Vercel install selection are in the §2 table above (Bun 1.4 can read v1). A v2 lockfile previously broke a preview while Edge packing still ran `bun install v1.3.14`. Historical 2026-08-25 evidence after #305: `aa1e7e40` had no Edge entries and packed with **1.4.0**. Still do not migrate to v2 without a dedicated Issue.

`.nvmrc` contains `24`. Use that locally before Astro compiler work. `astro build` is Node. Do **not** put `engines.node` back after §9.1 — Vercel treats it as winning over `bunVersion` for Function runtime.

### 2.1 Scoring CLIs (owner machine only)

CI and Vercel do not install these CLIs. They are not Bun, Node, or Astro pins. A minimum below is a preflight floor from a tracked constant. An observation is a version named in a landed runbook row and is not a pin.

| CLI | Contract | Evidence | Where it runs |
| --- | --- | --- | --- |
| Codex CLI | `>= 0.159.2`, current-seat minimum | `GPT_6_1_SOL_CODEX_MIN_VERSION` in `scripts/lib/scoring/gpt-6.1-sol-run.ts` | Owner machine, `codex` provider. Not installed by CI or Vercel. |
| grok CLI | `>= 1.0.40`, preflight minimum | `GROK_CLI_MIN_VERSION` in `scripts/lib/scoring/providers/grok-cli.ts` and `GROK_4_7_MIN_CLI_VERSION` in `scripts/lib/scoring/grok-4.7-run.ts` | Owner machine, `grok-cli` provider. Not installed by CI or Vercel. |
| Claude Code | `2.1.280`, observation, not a pin | mms-11 transport row in [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md) (chunked `claude -p`) | Owner machine for that in-agent run. Not a tracked constant, and not installed by CI or Vercel. |

Older runbook notes are not this minimum. mms-12 recorded Codex `>= 0.156.0`. The Astra preflight recorded Codex `>= 0.153.1`. Do not promote those notes, or the Claude Code observation, to an exact pin.

---

## 3. Vercel support matrix

Citations include the document date so they can go stale on purpose.

| Topic | Supported? | Source |
| --- | --- | --- |
| Node Builds/Functions **24.x** (default), **22.x**, **20.x** | Yes. 20.x new deploys stop 2026-10-01. | [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) (doc 2026-02-27; 24.x GA changelog earlier) |
| Node **26** for Builds/Functions | **No.** Wait for October LTS. Sandbox is unrelated. | Vercel staff 2026-08-20; no 26.x in the versions doc |
| Static Astro, no adapter, custom `outputDirectory` | Yes. Platform does **not** pin an Astro semver. | [Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro) (2026-06-15) |
| Adding `@astrojs/vercel` for a 7.2 bump | Must **not**. Changes output from `dist-astro/` to adapter output. | same + this repo’s `vercel.json` |
| `bun.lock` → `bun install` | Yes. Supported line is **“Bun 1”** only. No lockfileVersion 1 vs 2 mapping (unlike pnpm). | [Package managers](https://vercel.com/docs/package-managers) (**2026-07-01**, before Bun 1.4) |
| Pinning **build** Bun | Yes: Install Command `bunx bun@x.y.z install`. | [Pin Bun for Vercel builds](https://vercel.com/kb/guide/how-to-pin-a-specific-bun-version-for-vercel-builds) (2026-06-17) |
| Function runtime `bunVersion: "1.x"` | Selects Bun **1.3.14**. Not used here. | [Bun runtime](https://vercel.com/docs/functions/runtimes/bun) |
| Function runtime `bunVersion: "1.4.x"` | Selects Bun **1.4** (Zig→Rust). **Set in PR 299.** Applies only to Functions and Routing Middleware **not** using Edge. Also lost when `engines.node` is present (Build log: `package.json` takes precedence, using `"node"`). | [Bun runtime](https://vercel.com/docs/functions/runtimes/bun); [changelog 2026-08-20](https://vercel.com/changelog/bun-1-4-is-now-available-in-vercel-functions); [vercel.json bunVersion](https://vercel.com/docs/project-configuration/vercel-json#bunversion) |
| Routing Middleware on Bun | Yes, if `bunVersion` is set **and** middleware `config.runtime` is `"nodejs"` (default is still `edge`). Helpers: `@vercel/functions` (`next`, `rewrite`, `waitUntil`), not `@vercel/edge`. | [Routing Middleware API](https://vercel.com/docs/routing-middleware/api) (doc 2026-07-15) |
| Edge Functions | Still supported. Vercel *recommends* migrating Edge → Node.js (advice, not a shutdown). Dynamic `WebAssembly.compile` forbidden; wasm must be imported. Gzip caps: Hobby 1MB / Pro 2MB / Enterprise 4MB. | [Edge runtime](https://vercel.com/docs/functions/runtimes/edge) (2026-08-03) |
| `@vercel/og` on Edge vs Node | Platform OG docs (2026-06-16) lead with **Node.js**. npm `@vercel/og@1.0.1` README still says Node **and** Edge. **1.0.1 boots on Edge** (Issue 287: `λ api/og (855.83KB) [hnd1, kix1]`; six production PNGs byte-identical). The #280 series was forbidden from flipping runtime. **§9 is the architecture series that does flip** `api/og` to `runtime: "nodejs"` so `bunVersion` can apply. If that preview fails to boot or PNGs regress, stop — do not invent `runtime: "bun"` (docs say `nodejs` + `bunVersion`). | [OG image generation](https://vercel.com/docs/og-image-generation) (2026-06-16) |
| Playwright / axe on Vercel | Not run. Do not add them to `buildCommand`. | this repo `vercel.json` + CHANGELOG |

`vercel.json` `buildCommand` is `bun run build` only (Issue #855). `verify:gates`, which includes the SEO baseline diff, runs in GitHub CI `quality`: extracted-field HTML drift **fails `quality`**, not the Vercel build. (Before #855 `buildCommand` also ran `typecheck`, `verify:gates` and `test`.)

Vercel's Ignored Build Step (`scripts/vercel-ignore-build.sh`, via `ignoreCommand`) skips every branch except `preview` and `main`: a topic-branch push or PR does not build on Vercel, because `quality` already verifies it. The skipped deployment is reported as a successful `Vercel` status ("Canceled by Ignored Build Step"), so the required `Vercel` check stays green and branch protection needs no change. To force a Vercel preview build on a topic branch, put `[vercel-build]` in the HEAD commit message (e.g. `git commit --allow-empty -m "ci: vercel preview [vercel-build]"`). On `preview` / `main`, documentation-only commits are still skipped and everything else builds; any anomaly builds (fail-safe).

---

## 4. Forbidden for the #280 series (historical)

#280–#299 are merged on `preview`. Keep these as the reason those PRs did **not** flip runtime. **§9 is a new series** and is allowed — required — to change `runtime` and `engines.node`.

- `engines.node` → 26 or `@types/node@26`.
- Removing `runtime: "edge"` from `api/og` / `api/shindan-share` / middleware *inside a version-bump PR* because `"bunVersion": "1.4.x"` is set. The flag does not apply to Edge; flipping runtime is an architecture change (now §9).
- ~~Replacing the npm package name typescript with 7.0.2~~ — **lifted by owner ruling 2026-09-24 「A」** (#635 order 8). Nothing in the repo imports the TypeScript JS API (grep in #636), so waiting for 7.1 protected nothing. After order 8, typecheck is node node_modules/typescript/bin/tsc --noEmit and the @typescript/native alias is gone.
- Adding `@astrojs/vercel` “so Astro 7.2 works”.
- Silently changing `api/og.tsx`, `api/shindan-share.ts`, or `middleware.ts` from `runtime: "edge"` to `nodejs` or Bun **inside a package bump**. If `@vercel/og@1.0` cannot boot on Edge, **stop** and open an architecture Issue (that Issue is now §9).
- Enabling Astro `experimental.incrementalBuild`, `session: false`, or other flags unused today as part of a bump.
- Recapturing `tests/baseline/*` without a written reason ([`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md)).

---

## 5. Upgrade queue (#280) — historical

One Issue → one PR → `preview` (`quality` + `Vercel`) → next Issue. Do not combine lockfiles. Do not stack on product branches.

| Order | Kind | Issue | Target |
| --- | --- | --- | --- |
| 0 | docs | [#281](https://github.com/jasonhnd/jobs/issues/281) | this file (done when this PR merges) |
| 1 | code | [#282](https://github.com/jasonhnd/jobs/issues/282) | Astro **7.2.4** + `overrides.devalue` **^5.9.1** |
| 2 | code | [#283](https://github.com/jasonhnd/jobs/issues/283) | React **19.2.8** + `@types/react` **19.2.18** |
| 3 | code | [#284](https://github.com/jasonhnd/jobs/issues/284) | `@vercel/edge` **1.3.3** + `@types/node` **24.13.3** (stay on 24) |
| 4 | code | [#285](https://github.com/jasonhnd/jobs/issues/285) | Playwright **1.62.1** (paste local `bun run test:e2e`) |
| 5 | code | [#286](https://github.com/jasonhnd/jobs/issues/286) | `@axe-core/playwright` **4.13.0** (fix pages; don’t skip) |
| 6 | code | [#287](https://github.com/jasonhnd/jobs/issues/287) | `@vercel/og` **1.0.1**, **keep Edge**; preview PNG vs production |
| 7 | code | [#288](https://github.com/jasonhnd/jobs/issues/288) | Bun **1.4.0** on local + CI `bun-version` + `installCommand` `bunx bun@1.4.0 install --frozen-lockfile`; **no `bunVersion`** |

Hub: [#280](https://github.com/jasonhnd/jobs/issues/280).

When an item ships, update **§2 current versions** in the same PR. Do not leave this table as the only record of “what is installed”.

Not in the series: Node 26; `typescript` package → 7; analytics/ `googleapis` / pnpm; Playwright on CI/Vercel.

---

## 6. What “green” means

| Check | Proves | Does not prove |
| --- | --- | --- |
| GitHub **`quality`** | CI Bun pin can `bun install --frozen-lockfile`; unit tests; native typecheck; production `build`; `home-css-loading` + `models-built` + `home-js-asset` with `REQUIRE_BUILT_ARTIFACTS=1`; `verify:gates`; no uncommitted generated files (`git diff --exit-code`); Playwright + axe rendered-output suite against the CI build (design-1.20) | a real `/api/og` PNG, production alias |
| GitHub **`Vercel`** | On `preview` / `main` (or a topic branch with `[vercel-build]` in its HEAD commit message), ran `installCommand` + `buildCommand` (`bun run build`) on Vercel’s image. Otherwise the check is the skipped-and-passing "Canceled by Ignored Build Step" status and proves nothing about the build. `verify:gates` (SEO baseline) is a `quality` gate, not a Vercel one. Install log must show `bun install` succeeding with the build-image Bun (1.4.x). | e2e; OG pixels. A green check is not enough — read `inspect --format=json` `lambda.runtime` (`bun1.4.x` after #303–#305). |
| Local `bun run test:e2e` | Chromium against `dist-astro/` via `scripts/e2e-server.cjs`. The CI / [`AGENTS.md`](../AGENTS.md) acceptance build exports `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_X_PIXEL_ID`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_CF_BEACON_TOKEN`, and `PUBLIC_GOOGLE_ADS_ID` as empty strings, so the dist has no GA4 markup and `tests/e2e/analytics.spec.ts` skips. The dedicated analytics run (`scripts/run-e2e.sh`) is a separate isolated config: it rebuilds with the throwaway id `PUBLIC_GA4_MEASUREMENT_ID=G-E2E0000000` and must leave the other four tracker variables empty. Do not copy tracker IDs from production HTML or a live preview. `vercel env pull` writes empty strings for Encrypted vars; leave those empty. | CI/Vercel |
| Preview `/api/og` | Function boots and returns PNG. After #303: Bun 1.4 (`lambda.runtime: "bun1.4.x"`). | `astro preview` (it does **not** serve `/api/`) |

Five HTML fingerprints (do not treat them as one):

| Fingerprint | Compared how | Typical Astro-bump effect |
| --- | --- | --- |
| SEO baseline | Extracted title/description/canonical/h1/og/JSON-LD/links/sitemap | Often unchanged if copy/helpers unchanged |
| CSP | SHA-256 of static `is:inline` scripts → `vercel.json` | One compiler whitespace change rewrites hashes; commit them with a reason |
| Home CSS URL | `scripts/home-css-loading.test.ts` pattern `/_astro/_index.[A-Za-z0-9_-]+\.css` | Hash change still passes; filename **shape** change fails CI, not `verify:gates` |
| Home JS URL | Content-addressed `/_astro/_index-inline.<sha256>.js` from the final minified bytes; `scripts/home-js-asset.test.ts` guards emission and the built HTML reference | Changed final bytes change the URL; a filename/hash mismatch fails CI |
| Fonts | `scripts/subset-fonts.ts` content-hash | Nav/footer glyph change retargets `/fonts/*`; no SEO gate |

Occupation bodies are mostly `src/templates/` SafeHtml injected from `[...id].astro`. Compiler risk is layout, slots, asset URLs, and output filenames (`156.html` vs `156/index.html`).

---

## 7. Known drift (record here; do not “fix” in a docs-only PR)

1. **Historical local Node observation: 24.20.0** (`nvm alias default 24`, retained in the 2026-09-24 refresh; not remeasured here). Hermes 22 remains at `~/.hermes/node/bin/node` for its CLI shims. Do not jump **Node 26**.
2. **Current Bun local/CI target and Vercel install/runtime selection: see §2.** The install command is `bun install --frozen-lockfile`, not a non-frozen install. `#302` removed `engines.node`. `#303`–`#305` moved `api/og`, `api/shindan-share`, and middleware to `runtime: "nodejs"` (Bun 1.4). OG/share use named `GET`. Middleware keeps the Routing Middleware default export. `bun.lock` stays **lockfileVersion 1**.
3. **No Edge entries** on preview after #305. The Edge gzip cap is unused. OG on Bun is ~18 MB uncompressed (not an Edge gzip budget).

---

## 8. How to refresh Vercel cells

```text
vercel ls                          # latest jobs preview/production URLs
vercel inspect <deployment-url>    # Function sizes under Builds
```

Install Bun string: deployment **Build** log → search `bun install v`. Dashboard: Project → Deployments → open a **preview** → Building → Install.

Do not invent a Bun version from `bunVersion` docs (`1.x` = 1.3.14 is the **Function** default, not proof of Install). Do not treat a green `Vercel` check as proof of runtime: grep the Build log for the `engines.node` / `bunVersion` warning, and read `vercel inspect --format=json` → `builds[].output[].lambda.runtime` (`bun1.4.x` vs `nodejs24.x`) and the corresponding `edge` field (`null` for the recorded Bun Functions). The CLI `λ` glyph does not distinguish Edge from Bun/Node. Tracked `runtime: "nodejs"` + `bunVersion` is intended configuration; deployment JSON is runtime evidence for that specific deployment. No live deployment was inspected in this reconciliation.

---

## 9. Bun 1.4 Function runtime series (after #280)

#280 upgraded install/CI Bun to 1.4.0 and PR 299 set `"bunVersion": "1.4.x"`. That flag was a no-op until `#302` removed `engines.node` and `#303`–`#305` moved the three entries off Edge. **Shipped on `preview`:** `api/og`, `api/shindan-share`, and middleware run as `lambda.runtime: "bun1.4.x"`.

Do not use the Bun **framework preset** (`server.ts` + `Bun.serve()`). This repo stays static Astro (`framework: "astro"`, `outputDirectory: dist-astro`, no `@astrojs/vercel`) plus three `/api`+middleware Functions.

### 9.1 Why `"bunVersion": "1.4.x"` was a no-op (PR 299)

Two independent blockers. Fixing only one still left Functions off Bun. Both are done (#302–#305).

| Blocker | What it is | Evidence | Required change |
| --- | --- | --- | --- |
| **1. `engines.node` wins** | `package.json` `"engines": { "node": "24.x" }` plus `vercel.json` `"bunVersion"` → Vercel uses **Node** for the non-Edge runtime choice. | PR 299 Build log, four times: `Warning detected "engines": { "node": ... } in package.json and "bunVersion" in vercel.json. package.json takes precedence, using "node".` | **Remove** `engines.node`. Keep Node 24 for **Builds** via `.nvmrc` `24`, CI `node-version: 24.x`, and Vercel’s default Node **24.x**. Do not jump Node 26. Do not put `engines.node` back. |
| **2. Edge excludes the flag** | [vercel.json `bunVersion`](https://vercel.com/docs/project-configuration/vercel-json#bunversion): the flag applies to Functions and Routing Middleware **not** using Edge. | `api/og.tsx` and `api/shindan-share.ts` export `runtime: "edge"`. `middleware.ts` has no `runtime` (platform default **edge**) and imports `next` / `rewrite` from `@vercel/edge`. Historical PR 299 inspect JSON identified Edge; the displayed `λ api/og … [hnd1, kix1]` line alone does not identify runtime. | Set each entry `runtime: "nodejs"`. Middleware also needs that key ([Routing Middleware API](https://vercel.com/docs/routing-middleware/api)). Replace `@vercel/edge` with `@vercel/functions`. |

`engines.node` existed only to pin Builds to Node 24. Vercel’s current default **is already 24.x**, CI already pins 24.x, `.nvmrc` is `24`, and `astro` still uses the Node shebang. Removing the key does **not** move `astro build` onto Bun. Do not put it back.

There is no `runtime: "bun"` in this repo’s contract. Official path: `runtime: "nodejs"` + `"bunVersion": "1.4.x"`.

### 9.2 Serial queue

One Issue → one PR → `preview` (`quality` + `Vercel`) → next. Do not combine lockfiles. Do not stack on product branches. Do not open a PR against `main`.

| Order | Kind | Issue | Target | Failure domain |
| --- | --- | --- | --- | --- |
| 0 | docs | [#301](https://github.com/jasonhnd/jobs/issues/301) | This section + CHANGELOG / CONTRIBUTING / EDGE_SECURITY honesty that PR 299 is a no-op | Words only. Must not claim Functions already run on Bun 1.4. |
| 1 | code | [#302](https://github.com/jasonhnd/jobs/issues/302) | Remove `package.json` `engines.node`. Keep `.nvmrc` 24 + CI 24.x. Keep `"bunVersion": "1.4.x"`. | Build-log warning gone. Functions **still Edge** at this historical step — verify the deployment JSON runtime/edge fields, not the glyph. |
| 2 | code | [#303](https://github.com/jasonhnd/jobs/issues/303) | `api/og.tsx` `runtime: "edge"` → `"nodejs"`. Keep `regions: ["hnd1", "kix1"]`. Keep `loadGoogleFont` (do **not** start bundling TTF / `fs` just because Node has `fs`). | OG boot + PNG oracle vs production. First Function that can actually run on Bun 1.4. |
| 3 | code | [#304](https://github.com/jasonhnd/jobs/issues/304) | `api/shindan-share.ts` `runtime: "edge"` → `"nodejs"`. Keep regions. Product HTML/rewrite behaviour unchanged. | Share HTML still 200; unfurlers still get OG metadata. |
| 4 | code | [#305](https://github.com/jasonhnd/jobs/issues/305) | `middleware.ts`: `config.runtime: "nodejs"`; replace `@vercel/edge` (`next`, `rewrite`, `RequestContext`) with `@vercel/functions`; drop `@vercel/edge` if unused. Update `scripts/check-architecture.cjs` so **zero Edge entries is success** (today it fails closed when discovery finds none). Matcher, 301s, share rewrites, `page_delivery` / `waitUntil` stay. | Middleware still fires MP; occupation/`/me` routing still 301/rewrite. Inspect JSON must show `lambda.runtime: "bun1.4.x"` and `edge: null` for these three. |

Order is mandatory: if order 2–4 run while `engines.node` is still present, Vercel will run those Functions on **Node**, not Bun 1.4.

### 9.3 What each code PR must change (and must not)

**Order 1 — `engines.node`**

- Delete the `engines` object from root `package.json` (the `node` key is the problem; do not leave an empty `engines`).
- Do **not** change `analytics/package.json` engines (separate package, not Vercel Functions).
- Update this file §1–§2, CONTRIBUTING, CHANGELOG so Node 24 is documented via `.nvmrc` + CI + Vercel default, not via `engines.node`.
- `package.json` `description` may still say “Edge Functions” until order 4.

**Order 2 — OG**

- `api/og.tsx` `export const config`: `runtime: "nodejs"`, keep regions.
- Change the Edge-style `export default async function handler(req): Promise<Response>` to a named **`export async function GET(req: Request)`**. On nodejs/Bun, a default export that returns `Response` is treated as `(req, res) => void` and the return is ignored (preview log: `default export returned a Response` → 300s timeout + `Invalid URL`). Do not keep both exports.
- Do not rewrite renderers. Do not add `@astrojs/react`. Do not change dispatch.
- Fonts stay `loadGoogleFont` → `fonts.gstatic.com` only ([`EDGE_SECURITY.md`](EDGE_SECURITY.md)). Data stays `trustedFetchOrigin`.
- Record new Function size from `vercel inspect`. Node/Bun size limits are not the Edge gzip cap; still paste the number.
- PNG oracle: same six production URLs as Issue 287 (`/api/og`, `?id=156`, `?sector=iryo`, `?page=map`, one worktype wide + `shape=square`). Prefer byte-identical. If bytes differ, stop and compare visually + Content-Type `image/png` + dimensions 1200×630 (square variant 630×630 if that is what production served). Do not “fix” pixels by recapturing SEO baseline.

**Order 3 — shindan-share**

- `api/shindan-share.ts` config: `runtime: "nodejs"`, keep regions. Named **`export async function GET`** (same nodejs/Bun rule as OG — do not leave an Edge-style default export that returns `Response`).
- No share-copy rewrite. `renderShindanShareResponse` stays the testable helper.

**Order 4 — middleware**

- `export const config` gains `runtime: "nodejs"` next to the existing `matcher`.
- Imports move to `@vercel/functions`. Add that dependency at the current latest that still provides `next`, `rewrite`, and `RequestContext` / `waitUntil`. Remove `@vercel/edge` from `package.json` if nothing else imports it.
- `scripts/check-architecture.cjs`: the TSX-dep walk stays for any remaining Edge entries. When zero Edge entries remain, **do not** fail with “Expected at least one”. Keep walking `api/og.tsx` if we still want “no TSX in deps” — but that rule was an **Edge bundler** trap. Do not silently apply Edge bundler constraints to Bun without a written reason. Prefer: walk only files that still have `runtime: "edge"` or `from '@vercel/edge'`; if none, print that plane C is Bun/Node and exit 0 from that pass.
- Behaviour: `noOccAliasRedirectTarget` 301, occupation `/shindan` → `/me` 301 for humans, share unfurler rewrites, `x-shindan-shell-fetch` skip, `page_delivery` via `context.waitUntil`. No new events. No client-visible change when GA env is missing.

### 9.4 Forbidden in this series

- `"bunVersion": "1.x"` (that selects **1.3.14**).
- `runtime: "bun"` (not a documented value here).
- Putting `engines.node` back, or setting it to 26 / `@types/node@26`.
- Adding `@astrojs/vercel` or a root `server.ts` / `Bun.serve()` preset.
- Rewriting `bun.lock` to **lockfileVersion 2**. Image Bun 1.3.14 still packs Edge until order 4 is proven; v2 already broke a preview (`Unknown lockfile version` → ignored lockfile → `astro@7.2.6` / `@vercel/og@1.0.2` → Edge `@vercel: module`).
- Changing OG/share/middleware **product** behaviour (copy, 301 targets, MP event name, CSP, SEO baseline) as part of the runtime cut.
- Targeting `main`. Base is `preview`.

### 9.5 What “green” means for this series

Historical migration acceptance (2026-08-25). Runtime criteria use deployment JSON, not the CLI glyph; sizes and dated observations remain in §2. This checklist does not assert a newly verified live runtime.

| Check | Order 1 | Order 2–4 |
| --- | --- | --- |
| GitHub `quality` | green | green |
| GitHub `Vercel` | green | green |
| Build log `engines.node` / `bunVersion` warning | **Absent**. Paste grep. | Still absent. |
| Deployment JSON `builds[].output[]` runtime evidence | All three remain Edge at this historical step; paste their `lambda.runtime` / `edge` fields. | Each moved Function must have `lambda.runtime: "bun1.4.x"`, `edge: null`; paste those fields plus size and deployment identifier/date. The CLI glyph is not an acceptance criterion. |
| Preview `/api/og` | unchanged Edge PNG | 200 `image/png`; oracle vs production |
| Preview share + middleware | unchanged | 301/rewrite + HTML 200 as today |
| `bun.lock` `lockfileVersion` | **1** | **1** |

Dump Vercel logs to a file (`vercel inspect <url> --logs` into `/tmp`, then SIGTERM if it hangs). Do not claim an email; do not guess a Bun version from docs.

### 9.6 Rollback

Revert the single PR. Order 2–4 each revert independently. If OG on `nodejs`+Bun fails to boot, revert order 2 and leave `engines.node` removed only if order 1 already merged — do not restore `engines.node` as a “fix” for an OG boot failure.

Hub: [#300](https://github.com/jasonhnd/jobs/issues/300). Per-step Issues are in the order table above.

---

## 10. Cloud Agent plane (`.cursor/`)

A Cursor Cloud Agent boots a bare VM with neither Bun nor the `.nvmrc` Node, so
every `bun run …` fails until it is bootstrapped. That makes it a fourth plane
on top of §1's three, and it is repository-managed so it is versioned with the
code it bootstraps: a branch that moves the Bun pin carries its own environment.

| Item | Where | Value |
| --- | --- | --- |
| Config | `.cursor/environment.json` | `install` only. No `start`, no `terminals`, no Dockerfile — nothing here needs a live service. |
| Bootstrap | `.cursor/install.sh` | Node `.nvmrc` major via nvm, Bun target from [§2](#2-current-versions), `bun install --frozen-lockfile`, Chromium (best effort). Idempotent. |
| Ignore rule | `.gitignore` | `.cursor/*` with `!environment.json` and `!install.sh`. The rest of `.cursor/` stays per-machine LLM-tool state. |

`install` runs after checkout, and once into the baseline snapshot when
environment builds are enabled, so it may only produce on-disk state that
survives a reboot. Two omissions are deliberate:

- **No `bun run build`.** `verify:gates` reads `dist-astro/`. A `dist-astro/`
  baked into a snapshot would be stale against the next branch and the gates
  would report on the wrong HTML. Build before gates, every time.
- **No `PUBLIC_*` analytics env.** Setting them makes `BaseLayout.astro` emit
  the tracker blocks, which changes the inline-script hashes
  `compute-csp-hashes.cjs` writes into `vercel.json` — and that breaks
  `git diff --exit-code`.

The image places its own `node` ahead of nvm in `PATH`, so `nvm use` alone is
not enough. The script writes one marker-guarded block into `~/.bashrc` that
prepends the nvm Node and Bun.

### 10.1 What a Cloud Agent can and cannot verify

| Surface | Cloud Agent | Note |
| --- | --- | --- |
| `test` / `typecheck` / `build` / `verify:gates` / `git diff --exit-code` | Yes | The whole `quality` chain runs on the VM. This is the §6 green bar minus the Vercel build half (which only runs on `preview` / `main`, or on a topic branch whose HEAD commit message contains `[vercel-build]`). |
| `bun run test:e2e` | Yes | CI `quality` runs the Playwright suite after installing Chromium (`bun x playwright install --with-deps chromium`, step "Install Chromium for rendered-output checks" in `.github/workflows/ci.yml`), then `bun x playwright test --reporter=line` (step "Run rendered-output checks (a11y, §4.2 floor, layout invariants)" in `.github/workflows/ci.yml`), so it gates merges. The analytics specs skip themselves when the build carries no GA4 markup (build with the `PUBLIC_*` analytics variables exported as empty strings, see [`AGENTS.md`](../AGENTS.md) → Acceptance commands). Playwright defaults to port 4321. For parallel workspaces, use `PLAYWRIGHT_PORT=<available port>` with a distinct port for each suite; never reuse another workspace's server. An explicit override disables server reuse. |
| Scoring batches | Yes, `in-agent` only | The `in-agent` provider needs no credential — the agent session is the model, as for `claude-opus-4-8`, `claude-fable-5`, `grok-4.6`, `claude-fable-5-1`, the `grok-4.5` backfill, and `claude-opus-5-5`. Any keyed provider is owner-only. The `codex` provider (gpt-5.6-sol, gpt-6-astra, gpt-6-sol, gpt-6.1-sol) is owner-machine only. The `grok-cli` provider is owner-machine only, alongside `codex`. See [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md). |
| `bun run audit` | No | `analytics/` pins `pnpm@12.6.0` for corepack to fetch, and the GA4 scripts need credentials. |
| Vercel CLI (`alerts`, `ls`, `inspect`, `firewall overview`) | No | Not installed, not authenticated. §8's refresh procedure needs an operator. |
| Preview deployment | No | Verification ends at `git push`. A topic-branch push does not build on Vercel unless its HEAD commit message contains `[vercel-build]`; §6 and §9.5 — `lambda.runtime`, OG pixels — still need a human. The SEO baseline is a GitHub CI `quality` gate (`verify:gates`), not a deploy gate, so the VM covers it.

---

## 11. 2026-09 upgrade queue (#635)

### Queue

| Order | Kind | Issue | Target |
| --- | --- | --- | --- |
| 0 | docs | #636 | `docs/TOOLCHAIN.md`: this queue, §2 drift fixes, §4 TypeScript rule change (owner ruling 2026-09-24 「A」) — done (#649) |
| 1 | code | #637 | `astro` 7.2.4 → **7.3.5** + `overrides.sharp` **^0.35.4** (+ transitive `js-yaml` 4.3.2) — done (#650) |
| 2 | code | #638 | `@vercel/og` `^1.0.1` → exact **`1.0.1`** + `overrides.fflate` **^0.7.5** (1.0.2/1.0.3 abort on import — vercel/satori#801) — done (#651) |
| 3 | code | #639 | `@vercel/functions` 3.9.5 → **3.9.9** (middleware) — done (#652) |
| 4 | code | #640 | Bun 1.4.0 → **1.4.2**: CI `bun-version`, `.cursor/install.sh`, CONTRIBUTING, docs (Vercel `1.4.x` observed at 1.4.1) — done (#653) |
| 5 | code | #641 | `react` + `@types/react` → **19.3.0** (OG only; 6 PNGs byte-identical) — done (#654) |
| 6 | code | #642 | `zod` 4.4.3 → **4.6.5** — done (#655) |
| 7 | code | #643 | `subset-font` 2.5.0 → **2.9.0** (font hashes) — done (#656) |
| 8 | code | #644 | `typescript` 6.0.3 → **7.0.2**; drop the `@typescript/native` alias — done (#657) |
| 9 | code | #645 | `@types/node` 24.13.3 → **24.13.6** (stay on 24) — done (#658) |
| 10 | code | #646 | `@playwright/test` 1.62.1 → **1.63.0** + dedupe `playwright-core` (CI runs Playwright + axe since design-1.20 `f05ba940`) — done (#659) |
| 11 | code | #647 | `.github/workflows/ci.yml`: `actions/checkout` v4 → **v7**, `actions/setup-node` v4 → **v7** — done (#660) |
| 12 | code | #648 | `analytics/`: `js-yaml` → **5.4.2**, `googleapis` → **181**, `qs` override **^6.16.0**, pnpm 11.9.0 → **12.6.0** — done (#661) |

### Not in this series

| Item | Why | Trigger to reopen |
| --- | --- | --- |
| Node 26 / `@types/node@26` | Vercel Builds/Functions reject `26.x` as of 2026-09-24 (Sandbox only). Node 26 is not LTS until October. | Vercel changelog announces 26.x for Builds. Separate Issue. |
| `overrides.devalue` → 6 | `astro@7.3.5` declares `devalue: ^5.8.1`. Forcing a major under Astro is not an upgrade, it is a fork. Keep `^5.9.1`. | Astro itself moves to devalue 6. |
| `@vercel/og` ≥ 1.0.2 | Ships no `dist/hb.wasm`; satori 0.33's harfbuzz aborts on import (reproduced 2026-09-24; vercel/satori#801 OPEN). | A release whose tarball contains `dist/hb.wasm` and passes the 6-card local oracle in order 2. |
| `bun.lock` lockfileVersion 2 | Still forbidden without a dedicated Issue (TOOLCHAIN §2). | — |
| `@astrojs/vercel`, `experimental.*` | Forbidden (TOOLCHAIN §3–4). | — |

When an item ships, update §2 in the same PR (same rule as §5).
