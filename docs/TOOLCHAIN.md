# Toolchain contract

Canonical pins for install, build, and runtime. README’s one-line stack table is a reader summary; **this file is what an implementer must follow**. Version bumps in the #280 series update the tables here in the same PR as the lockfile.

Issue-first / docs-first order: [`WORKFLOW.md`](WORKFLOW.md). Contributor commands: [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Edge behaviour: [`EDGE_SECURITY.md`](EDGE_SECURITY.md). SEO snapshots: [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md).

Recorded **as of 2026-08-25** (preview deploy `dpl_FvJ3KQaLxHZekpiPBy4uV7QDLsVU`, `jobs-cdzvt3etz-zkscio.vercel.app`). Re-read Vercel Install logs and Function sizes when bumping Bun or `@vercel/og`.

---

## 1. Three Vercel planes

A deploy is not one runtime. Mixing these planes is how `bunVersion` accidentally replaces Edge.

| Plane | What it is | What sets the version | What actually runs |
| --- | --- | --- | --- |
| **A Install** | `vercel.json` `installCommand` | Build-image Bun, unless the command pins with `bunx bun@x.y.z` | Today: `bun install --frozen-lockfile`. Must be able to read `bun.lock`. |
| **B Build** | `buildCommand` in the same container | `package.json` `engines.node: "24.x"` (overrides Project Settings) | `bun run typecheck` → `bun run build` → `bun run verify:gates` → `bun run test`. **`astro build` uses the `astro` bin shebang (Node).** ETL, `bun test`, and most `scripts/*` use Bun. |
| **C Runtime** | After the deploy is live | Not the install Bun | HTML: CDN files from `outputDirectory` `dist-astro/`. `api/og.tsx`, `api/shindan-share.ts`, `middleware.ts`: **`runtime: "edge"`**, `regions: ["hnd1", "kix1"]` (middleware also listed `iad1` on the last inspect). **`vercel.json` sets `"bunVersion": "1.4.x"`** (Vercel Functions 1.4 opt-in). Docs: that flag applies to Functions and Routing Middleware **not** using Edge — Edge entries stay Edge. |

This repo does **not** use `@astrojs/vercel`. Static Astro + `outputDirectory: dist-astro` is the deploy model. Do not add the adapter as part of a version bump.

---

## 2. Current versions

| Item | Local (this machine, 2026-08-24) | CI `quality` (`.github/workflows/ci.yml`) | Vercel |
| --- | --- | --- | --- |
| Node | **v24.18.0** (nvm `default` → 24; `~/.local/bin/node` Hermes 22 is no longer first) | `24.x` via `actions/setup-node` | `engines.node: "24.x"` → latest 24.x on Builds. Edge Functions do **not** use this. |
| Bun | **1.4.0** (`34cbb9a40`) | **`bun-version: 1.4.0`** | Install Command: `bunx bun@1.4.0 install --frozen-lockfile`. **`"bunVersion": "1.4.x"`** (Functions 1.4). Image pack step may still print `bun install v1.3.14`. |
| Astro | lockfile **7.2.4** | same lockfile | same |
| `typescript` (JS package) | **6.0.3** | same | same |
| typecheck binary | `@typescript/native` **7.0.2** via `node node_modules/@typescript/native/bin/tsc --noEmit` | same | same (`bun run typecheck` in `buildCommand`) |
| `@vercel/og` | **1.0.1** | same | Edge Function `api/og` |
| `@vercel/edge` | **1.3.3** | same | `middleware.ts` |
| React | **19.2.8** (OG `createElement` only; no `@astrojs/react`, no client React) | same | inside the `api/og` Edge bundle |
| Playwright / axe | **1.62.1** / **4.13.0** (exact pins, no `^`) | **not executed** | npm packages may install as devDependencies; **Chromium is not installed**; e2e is not in `buildCommand` |
| `api/og` Edge bundle | — | — | **855.83 KB** (`vercel inspect` Builds: `λ api/og (855.83KB) [hnd1, kix1]` on the Issue 287 preview `jobs-fwarb5np7-zkscio.vercel.app`). Was 854.9 KB on `@vercel/og@0.11.1`. CHANGELOG 2026-05-28 recorded 748KB. Refresh the same way. |
| `api/shindan-share` | — | — | **91.39 KB** `[hnd1, kix1]` |
| middleware | — | — | **23.72 KB** `[iad1, hnd1]` |
| Vercel plan Edge gzip limit | — | — | **unknown** (Hobby 1MB / Pro 2MB / Enterprise 4MB). How to fill: Vercel dashboard → team/project **Settings** or billing; 854.9KB fits all three. Do not guess the plan. |

`bun.lock` today: **`lockfileVersion: 1`**. CI and Vercel `installCommand` are Bun **1.4.0** (1.4 can read v1). Keep v1 until Vercel’s **image** Bun is 1.4: after `buildCommand`, the platform runs a second `bun install v1.3.14` to pack Edge Functions, and 1.3.14 errors on v2 (`Unknown lockfile version`), then ignores the lockfile and re-resolves `astro@7.2.6` / `@vercel/og@1.0.2`.

`.nvmrc` contains `24`. Use that (or `engines.node`) locally before Astro compiler work. `astro build` is Node.

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
| Function runtime `bunVersion: "1.4.x"` | Selects Bun **1.4** (Zig→Rust). **Set.** Applies to non-Edge Functions/middleware. OG / shindan-share / middleware stay `runtime: "edge"`. | [changelog 2026-08-20](https://vercel.com/changelog/bun-1-4-is-now-available-in-vercel-functions) |
| Edge Functions | Still supported. Vercel *recommends* migrating Edge → Node.js (advice, not a shutdown). Dynamic `WebAssembly.compile` forbidden; wasm must be imported. Gzip caps: Hobby 1MB / Pro 2MB / Enterprise 4MB. | [Edge runtime](https://vercel.com/docs/functions/runtimes/edge) (2026-08-03) |
| `@vercel/og` on Edge vs Node | Platform OG docs (2026-06-16) lead with **Node.js**. npm `@vercel/og@1.0.1` README still says Node **and** Edge. **1.0.1 boots on Edge** (Issue 287 preview: `λ api/og (855.83KB) [hnd1, kix1]`). If a later bump fails to boot, stop; do not flip `runtime` to `nodejs`. | [OG image generation](https://vercel.com/docs/og-image-generation) (2026-06-16) |
| Playwright / axe on Vercel | Not run. Do not add them to `buildCommand`. | this repo `vercel.json` + CHANGELOG |

`vercel.json` `buildCommand` includes `verify:gates`, which includes the SEO baseline diff. Extracted-field HTML drift **fails the Vercel build**. (Older CHANGELOG text that said SEO baseline was local-only is stale.)

---

## 4. Forbidden for the #280 series

- `engines.node` → 26 or `@types/node@26`.
- Removing `runtime: "edge"` from `api/og` / `api/shindan-share` / middleware because `"bunVersion": "1.4.x"` is set. The flag does not apply to Edge.
- Replacing the npm package name `typescript` with 7.0.2. Typecheck already uses `@typescript/native@7.0.2`. The JS compiler API is not in 7.0; Microsoft’s side-by-side layout keeps 6.x under `typescript` until 7.1.
- Adding `@astrojs/vercel` “so Astro 7.2 works”.
- Silently changing `api/og.tsx`, `api/shindan-share.ts`, or `middleware.ts` from `runtime: "edge"` to `nodejs` or Bun. If `@vercel/og@1.0` cannot boot on Edge, **stop** and open a new architecture Issue; do not flip runtime in the version-bump PR.
- Enabling Astro `experimental.incrementalBuild`, `session: false`, or other flags unused today as part of a bump.
- Recapturing `tests/baseline/*` without a written reason ([`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md)).

---

## 5. Upgrade queue (#280)

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
| GitHub **`quality`** | CI Bun pin can `bun install --frozen-lockfile`; unit tests; native typecheck; production `build`; `home-css-loading` + `models-built` with `REQUIRE_BUILT_ARTIFACTS=1`; `verify:gates`; no uncommitted generated files (`git diff --exit-code`) | Playwright, axe, a real `/api/og` PNG, production alias |
| GitHub **`Vercel`** | Preview ran `installCommand` + `buildCommand` on Vercel’s image, including `verify:gates` (SEO baseline is a **deploy** gate). Issue 288: Install must show `bunx bun@1.4.0` succeeding. | e2e; OG pixels; Function runtime (must stay Edge, not `bunVersion`) |
| Local `bun run test:e2e` | Chromium against `dist-astro/` via `scripts/e2e-server.cjs`. Analytics specs need `PUBLIC_*` tracker IDs baked into that dist (`vercel env pull` writes empty strings for Encrypted vars — fill from production HTML or a real preview). | CI/Vercel |
| Preview `/api/og` | Edge Function boots and returns PNG | `astro preview` (it does **not** serve `/api/`) |

Four HTML fingerprints (do not treat them as one):

| Fingerprint | Compared how | Typical Astro-bump effect |
| --- | --- | --- |
| SEO baseline | Extracted title/description/canonical/h1/og/JSON-LD/links/sitemap | Often unchanged if copy/helpers unchanged |
| CSP | SHA-256 of static `is:inline` scripts → `vercel.json` | One compiler whitespace change rewrites hashes; commit them with a reason |
| Home CSS URL | `scripts/home-css-loading.test.ts` pattern `/_astro/_index.[A-Za-z0-9_-]+\.css` | Hash change still passes; filename **shape** change fails CI, not `verify:gates` |
| Fonts | `scripts/subset-fonts.ts` content-hash | Nav/footer glyph change retargets `/fonts/*`; no SEO gate |

Occupation bodies are mostly `src/templates/` SafeHtml injected from `[...id].astro`. Compiler risk is layout, slots, asset URLs, and output filenames (`156.html` vs `156/index.html`).

---

## 7. Known drift (record here; do not “fix” in a docs-only PR)

1. **Local Node is 24.18.0** (`nvm alias default 24`). Hermes 22 remains at `~/.hermes/node/bin/node` for its CLI shims. Do not jump **Node 26**.
2. **CI / local Bun 1.4.0**; Vercel **installCommand** is `bunx bun@1.4.0`; **`bunVersion`: `1.4.x`**. The **image** Bun for packing Edge Functions can still print **1.3.14**, so `bun.lock` stays **lockfileVersion 1**. OG/middleware remain Edge.
3. **Vercel plan** for Edge size cap is `unknown` until someone reads billing/settings. 854.9KB currently fits Hobby 1MB; still record the plan before #287 if the 1.0 bundle grows.

---

## 8. How to refresh Vercel cells

```text
vercel ls                          # latest jobs preview/production URLs
vercel inspect <deployment-url>    # Function sizes under Builds
```

Install Bun string: deployment **Build** log → search `bun install v`. Dashboard: Project → Deployments → open a **preview** → Building → Install.

Do not invent a Bun version from `bunVersion` docs (`1.x` = 1.3.14 is the **Function** default, not proof of Install).
