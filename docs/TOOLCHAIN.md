# Toolchain contract

Canonical pins for install, build, and runtime. README’s one-line stack table is a reader summary; **this file is what an implementer must follow**. Version bumps in the #280 series update the tables here in the same PR as the lockfile.

Issue-first / docs-first order: [`WORKFLOW.md`](WORKFLOW.md). Contributor commands: [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Edge behaviour: [`EDGE_SECURITY.md`](EDGE_SECURITY.md). SEO snapshots: [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md).

Recorded **as of 2026-08-25** after PR 299 (`2e08ed74` on `preview`). Re-read Vercel **Build** logs (not email) and `vercel inspect` Function lines when changing Bun, `bunVersion`, `engines.node`, or Function `runtime`.

**PR 299 set `"bunVersion": "1.4.x"` and did not put Functions on Bun 1.4.** Evidence from preview `jobs-1p0j8x8ce-zkscio.vercel.app` Build log:

```text
Warning detected "engines": { "node": ... } in `package.json` and "bunVersion" in `vercel.json`. `package.json` takes precedence, using "node".
```

`vercel inspect` still listed `λ api/og (855.83KB) [hnd1, kix1]` — Edge. The #280 series is done. The contract to **actually run** Functions on Bun 1.4 is §9.

---

## 1. Three Vercel planes

A deploy is not one runtime. Mixing these planes is how `bunVersion` accidentally replaces Edge.

| Plane | What it is | What sets the version | What actually runs |
| --- | --- | --- | --- |
| **A Install** | `vercel.json` `installCommand` | Build-image Bun, unless the command pins with `bunx bun@x.y.z` | Today: `bun install --frozen-lockfile`. Must be able to read `bun.lock`. |
| **B Build** | `buildCommand` in the same container | **No `engines.node`** (#302) so it cannot steal Function runtime from `bunVersion`. Builds stay Node **24.x** via platform default + `.nvmrc` + CI `node-version: 24.x`. | `bun run typecheck` → `bun run build` → `bun run verify:gates` → `bun run test`. **`astro build` uses the `astro` bin shebang (Node).** ETL, `bun test`, and most `scripts/*` use Bun. |
| **C Runtime** | After the deploy is live | Not the install Bun | HTML: CDN files from `outputDirectory` `dist-astro/`. **Today (#305):** `api/og`, `api/shindan-share`, and `middleware.ts` are `runtime: "nodejs"` + `"bunVersion": "1.4.x"` (Bun 1.4). OG/share `regions: ["hnd1", "kix1"]`. Middleware uses `@vercel/functions` (`next`, `rewrite`, `waitUntil`). |

This repo does **not** use `@astrojs/vercel`. Static Astro + `outputDirectory: dist-astro` is the deploy model. Do not add the adapter as part of a version bump.

---

## 2. Current versions

| Item | Local (this machine, 2026-08-24) | CI `quality` (`.github/workflows/ci.yml`) | Vercel |
| --- | --- | --- | --- |
| Node | **v24.18.0** (nvm `default` → 24; `~/.local/bin/node` Hermes 22 is no longer first) | `24.x` via `actions/setup-node` | Builds: **no `engines.node`** (#302). Node **24.x** via Vercel default ([Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)). Edge Functions do **not** use this. |
| Bun | **1.4.0** (`34cbb9a40`) | **`bun-version: 1.4.0`** | Install Command: `bunx bun@1.4.0 install --frozen-lockfile`. **`"bunVersion": "1.4.x"`**. `#303`: `api/og` on Bun 1.4. Share + middleware still Edge. Image pack may still print `bun install v1.3.14` while Edge entries remain. |
| Astro | lockfile **7.2.4** | same lockfile | same |
| `typescript` (JS package) | **6.0.3** | same | same |
| typecheck binary | `@typescript/native` **7.0.2** via `node node_modules/@typescript/native/bin/tsc --noEmit` | same | same (`bun run typecheck` in `buildCommand`) |
| `@vercel/og` | **1.0.1** | same | `api/og` `runtime: "nodejs"` + Bun 1.4 via `bunVersion` (#303). Size: refresh from inspect on that PR. |
| `@vercel/functions` | **3.9.5** | same | `middleware.ts` (`next`, `rewrite`, `waitUntil`). `@vercel/edge` removed. |
| React | **19.2.8** (OG `createElement` only; no `@astrojs/react`, no client React) | same | inside the `api/og` Bun 1.4 bundle |
| Playwright / axe | **1.62.1** / **4.13.0** (exact pins, no `^`) | **not executed** | npm packages may install as devDependencies; **Chromium is not installed**; e2e is not in `buildCommand` |
| `api/og` Function bundle | — | — | Issue 287 Edge: **855.83 KB** `λ`. #303 moves it off Edge — paste the new inspect line (must not be `λ`) in that PR. |
| `api/shindan-share` | — | — | #304: `runtime: "nodejs"` + Bun 1.4. Paste inspect `lambda.runtime` (must be `bun1.4.x`, `edge: null`). |
| middleware | — | — | #305: `runtime: "nodejs"` + Bun 1.4. Paste inspect `lambda.runtime` (must be `bun1.4.x`, `edge: null`). |
| Vercel plan Edge gzip limit | — | — | **unknown** (Hobby 1MB / Pro 2MB / Enterprise 4MB). How to fill: Vercel dashboard → team/project **Settings** or billing; 854.9KB fits all three. Do not guess the plan. |

`bun.lock` today: **`lockfileVersion: 1`**. CI and Vercel `installCommand` are Bun **1.4.0** (1.4 can read v1). Keep v1 until Vercel’s **image** Bun is 1.4: after `buildCommand`, the platform runs a second `bun install v1.3.14` to pack Edge Functions, and 1.3.14 errors on v2 (`Unknown lockfile version`), then ignores the lockfile and re-resolves `astro@7.2.6` / `@vercel/og@1.0.2`.

`.nvmrc` contains `24`. Use that locally before Astro compiler work. `astro build` is Node. Do **not** put `engines.node` back after §9.1 — Vercel treats it as winning over `bunVersion` for Function runtime.

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

`vercel.json` `buildCommand` includes `verify:gates`, which includes the SEO baseline diff. Extracted-field HTML drift **fails the Vercel build**. (Older CHANGELOG text that said SEO baseline was local-only is stale.)

---

## 4. Forbidden for the #280 series (historical)

#280–#299 are merged on `preview`. Keep these as the reason those PRs did **not** flip runtime. **§9 is a new series** and is allowed — required — to change `runtime` and `engines.node`.

- `engines.node` → 26 or `@types/node@26`.
- Removing `runtime: "edge"` from `api/og` / `api/shindan-share` / middleware *inside a version-bump PR* because `"bunVersion": "1.4.x"` is set. The flag does not apply to Edge; flipping runtime is an architecture change (now §9).
- Replacing the npm package name `typescript` with 7.0.2. Typecheck already uses `@typescript/native@7.0.2`. The JS compiler API is not in 7.0; Microsoft’s side-by-side layout keeps 6.x under `typescript` until 7.1.
- Adding `@astrojs/vercel` “so Astro 7.2 works”.
- Silently changing `api/og.tsx`, `api/shindan-share.ts`, or `middleware.ts` from `runtime: "edge"` to `nodejs` or Bun **inside a package bump**. If `@vercel/og@1.0` cannot boot on Edge, **stop** and open an architecture Issue (that Issue is now §9).
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
| GitHub **`Vercel`** | Preview ran `installCommand` + `buildCommand` on Vercel’s image, including `verify:gates` (SEO baseline is a **deploy** gate). Issue 288: Install must show `bunx bun@1.4.0` succeeding. | e2e; OG pixels. After PR 299, a green `Vercel` check does **not** prove Functions run on Bun 1.4. |
| Local `bun run test:e2e` | Chromium against `dist-astro/` via `scripts/e2e-server.cjs`. Analytics specs need `PUBLIC_*` tracker IDs baked into that dist (`vercel env pull` writes empty strings for Encrypted vars — fill from production HTML or a real preview). | CI/Vercel |
| Preview `/api/og` | Function boots and returns PNG. **#303:** Bun 1.4 via `runtime: "nodejs"` + `bunVersion` (inspect must not be `λ`). | `astro preview` (it does **not** serve `/api/`) |

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
2. **CI / local Bun 1.4.0**; Vercel **installCommand** is `bunx bun@1.4.0`; **`bunVersion`: `1.4.x`**. `#302` removed `engines.node`. `#303`–`#305` moved `api/og`, `api/shindan-share`, and middleware to `runtime: "nodejs"` (Bun 1.4). OG/share use named `GET`. Middleware keeps the Routing Middleware default export. `bun.lock` stays **lockfileVersion 1**.
3. **Vercel plan** for Edge size cap is `unknown` until someone reads billing/settings. 854.9KB currently fits Hobby 1MB; still record the plan before #287 if the 1.0 bundle grows.

---

## 8. How to refresh Vercel cells

```text
vercel ls                          # latest jobs preview/production URLs
vercel inspect <deployment-url>    # Function sizes under Builds
```

Install Bun string: deployment **Build** log → search `bun install v`. Dashboard: Project → Deployments → open a **preview** → Building → Install.

Do not invent a Bun version from `bunVersion` docs (`1.x` = 1.3.14 is the **Function** default, not proof of Install). Do not treat a green `Vercel` check as proof that Functions run on Bun: grep the Build log for the `engines.node` / `bunVersion` warning, and read `vercel inspect` Function lines (`λ` = Edge).

---

## 9. Bun 1.4 Function runtime series (after #280)

#280 upgraded install/CI Bun to 1.4.0 and PR 299 set `"bunVersion": "1.4.x"`. Functions still run on **Edge**. `#302` removed `engines.node` so the platform no longer prints `using "node"` over `bunVersion`. Remaining work is `runtime: "nodejs"` on the three entries (#303–#305).

Do not use the Bun **framework preset** (`server.ts` + `Bun.serve()`). This repo stays static Astro (`framework: "astro"`, `outputDirectory: dist-astro`, no `@astrojs/vercel`) plus three `/api`+middleware Functions.

### 9.1 Why `"bunVersion": "1.4.x"` is currently a no-op

Two independent blockers. Fixing only one still leaves Functions off Bun.

| Blocker | What it is | Evidence | Required change |
| --- | --- | --- | --- |
| **1. `engines.node` wins** | `package.json` `"engines": { "node": "24.x" }` plus `vercel.json` `"bunVersion"` → Vercel uses **Node** for the non-Edge runtime choice. | PR 299 Build log, four times: `Warning detected "engines": { "node": ... } in package.json and "bunVersion" in vercel.json. package.json takes precedence, using "node".` | **Remove** `engines.node`. Keep Node 24 for **Builds** via `.nvmrc` `24`, CI `node-version: 24.x`, and Vercel’s default Node **24.x**. Do not jump Node 26. Do not put `engines.node` back. |
| **2. Edge excludes the flag** | [vercel.json `bunVersion`](https://vercel.com/docs/project-configuration/vercel-json#bunversion): the flag applies to Functions and Routing Middleware **not** using Edge. | `api/og.tsx` and `api/shindan-share.ts` export `runtime: "edge"`. `middleware.ts` has no `runtime` (platform default **edge**) and imports `next` / `rewrite` from `@vercel/edge`. Inspect: `λ api/og … [hnd1, kix1]`. | Set each entry `runtime: "nodejs"`. Middleware also needs that key ([Routing Middleware API](https://vercel.com/docs/routing-middleware/api)). Replace `@vercel/edge` with `@vercel/functions`. |

`engines.node` existed only to pin Builds to Node 24. Vercel’s current default **is already 24.x**, CI already pins 24.x, `.nvmrc` is `24`, and `astro` still uses the Node shebang. Removing the key does **not** move `astro build` onto Bun. Do not put it back.

There is no `runtime: "bun"` in this repo’s contract. Official path: `runtime: "nodejs"` + `"bunVersion": "1.4.x"`.

### 9.2 Serial queue

One Issue → one PR → `preview` (`quality` + `Vercel`) → next. Do not combine lockfiles. Do not stack on product branches. Do not open a PR against `main`.

| Order | Kind | Issue | Target | Failure domain |
| --- | --- | --- | --- | --- |
| 0 | docs | [#301](https://github.com/jasonhnd/jobs/issues/301) | This section + CHANGELOG / CONTRIBUTING / EDGE_SECURITY honesty that PR 299 is a no-op | Words only. Must not claim Functions already run on Bun 1.4. |
| 1 | code | [#302](https://github.com/jasonhnd/jobs/issues/302) | Remove `package.json` `engines.node`. Keep `.nvmrc` 24 + CI 24.x. Keep `"bunVersion": "1.4.x"`. | Build-log warning gone. Functions **still Edge** this step — inspect still `λ`. |
| 2 | code | [#303](https://github.com/jasonhnd/jobs/issues/303) | `api/og.tsx` `runtime: "edge"` → `"nodejs"`. Keep `regions: ["hnd1", "kix1"]`. Keep `loadGoogleFont` (do **not** start bundling TTF / `fs` just because Node has `fs`). | OG boot + PNG oracle vs production. First Function that can actually run on Bun 1.4. |
| 3 | code | [#304](https://github.com/jasonhnd/jobs/issues/304) | `api/shindan-share.ts` `runtime: "edge"` → `"nodejs"`. Keep regions. Product HTML/rewrite behaviour unchanged. | Share HTML still 200; unfurlers still get OG metadata. |
| 4 | code | [#305](https://github.com/jasonhnd/jobs/issues/305) | `middleware.ts`: `config.runtime: "nodejs"`; replace `@vercel/edge` (`next`, `rewrite`, `RequestContext`) with `@vercel/functions`; drop `@vercel/edge` if unused. Update `scripts/check-architecture.cjs` so **zero Edge entries is success** (today it fails closed when discovery finds none). Matcher, 301s, share rewrites, `page_delivery` / `waitUntil` stay. | Middleware still fires MP; occupation/`/me` routing still 301/rewrite. Inspect must not show `λ` for these three. |

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

| Check | Order 1 | Order 2–4 |
| --- | --- | --- |
| GitHub `quality` | green | green |
| GitHub `Vercel` | green | green |
| Build log `engines.node` / `bunVersion` warning | **Absent**. Paste grep. | Still absent. |
| `vercel inspect` Function lines | Still `λ` Edge for all three (expected). | The Function(s) this PR moved must **not** be `λ`. Paste the new line + size. |
| Preview `/api/og` | unchanged Edge PNG | 200 `image/png`; oracle vs production |
| Preview share + middleware | unchanged | 301/rewrite + HTML 200 as today |
| `bun.lock` `lockfileVersion` | **1** | **1** |

Dump Vercel logs to a file (`vercel inspect <url> --logs` into `/tmp`, then SIGTERM if it hangs). Do not claim an email; do not guess a Bun version from docs.

### 9.6 Rollback

Revert the single PR. Order 2–4 each revert independently. If OG on `nodejs`+Bun fails to boot, revert order 2 and leave `engines.node` removed only if order 1 already merged — do not restore `engines.node` as a “fix” for an OG boot failure.

Hub: [#300](https://github.com/jasonhnd/jobs/issues/300). Per-step Issues are in the order table above.
