# Edge Security

対象は `middleware.ts`、OG 画像生成 (`api/og.tsx` と `src/lib/og-*`)、診断結果共有 (`api/shindan-share.ts` と関連 helper)。これらの入口は外部入力を受けるため、preview convenience より fail-safe な境界を優先する。

**Runtime status:** `api/og.tsx`, `api/shindan-share.ts`, and `middleware.ts` are `runtime: "nodejs"` so `"bunVersion": "1.4.x"` runs them on Bun 1.4 (#303–#305). Middleware helpers are `@vercel/functions`. IP / origin / font rules below are input-boundary rules — they stay after the runtime cut. Do not drop `trustedFetchOrigin` or the gstatic-only font fetch because Node/Bun has `fs`.

## Client IP

`src/lib/middleware/ga-identity.ts` の `clientIpFromRequest()` が GA4 geolocation 用の client IP 抽出の正典。

- Vercel が設定する `x-real-ip`、`x-vercel-forwarded-for` を優先する。
- raw `x-forwarded-for` は fallback とし、client が偽装できる first hop ではなく last hop を使う。
- usable な header がない場合は `anonymous` を返し、middleware は空の `ip_override` に変換する。
- IP はアクセス制御の境界には使わない。

## OG data fetch

OG renderer は request origin の data projection を読む。ただし spoofed host への SSRF を避けるため、`trustedFetchOrigin(url)` を通す。

許可する host:

- `mirai-shigoto.com`
- `*.mirai-shigoto.com`
- `jobs-<deployment>-zkscio.vercel.app` (alphanumeric deployment identifier)
- `jobs-git-<branch>-zkscio.vercel.app` (alphanumeric branch segments separated by single hyphens)
- `localhost`
- `127.0.0.1`

その他の host は production origin に fallback する。

The Vercel rules match the entire hostname for the `jobs` project in the
`zkscio` scope, not the shared `*.vercel.app` suffix. Read-only checks on
2026-10-02 (`vercel ls jobs --scope zkscio` and `vercel inspect`) confirmed
`jobs-dn8kq25rc-zkscio.vercel.app` and the branch alias
`jobs-git-docs-data-readme-leftovers-zkscio.vercel.app`. Other projects or
teams, nested subdomains, and misleading prefixes/suffixes fall back to
`https://mirai-shigoto.com`. If the project or scope is renamed, verify the
new deployment names and update the code, tests, and this contract together.

**Known fallbacks (safe direction).** These real Vercel hostnames do not match
the allowlist, so OG cards served from them read `https://mirai-shigoto.com`
data instead of their own deployment's data (a valid card, never a failure;
only preview-specific data is not reflected):

- The project-level alias `jobs-zkscio.vercel.app` (no deployment or `git-`
  segment).
- Branch aliases whose author/branch segment contains characters outside
  `[a-z0-9]` and single hyphens in the pattern above, for example an
  author-name alias with a hyphen in the name.
- Branch aliases Vercel truncates when the branch name is too long (the
  truncated host no longer fits the `jobs-git-<branch>-zkscio` shape).

To change this, edit `PROJECT_VERCEL_HOST` in `src/lib/og-helpers.ts`, the
host cases in `src/lib/og-helpers.test.ts`, and the allowed-host list above
in the same PR. The same applies when a new hostname format appears (new
project name, new scope, or a Vercel alias scheme change). Widening the
pattern back to `*.vercel.app` reopens the SSRF surface this rule closes.

## Font fetch

Google Fonts CSS から抽出した font binary URL は `https://fonts.gstatic.com/` で始まる場合だけ fetch する。CSS response は外部入力なので、任意 host へ server-side fetch しない。

## `@vercel/og` 1.0.1 on Bun 1.4

**Today (#303):** `api/og.tsx` is `runtime: "nodejs"` / `regions: ["hnd1", "kix1"]` on `@vercel/og@1.0.1` (satori 0.29), so `"bunVersion": "1.4.x"` runs it on Bun 1.4. Issue 287 verified the previous Edge boot (`λ api/og (855.83KB)`). Fonts stay `loadGoogleFont` → gstatic-only; data stays `trustedFetchOrigin`. Do not bundle TTF. PNG oracle vs production is required on the #303 preview (same six URLs as Issue 287).

**#280 rule:** do not flip `runtime` to `"nodejs"` inside a package bump. That rule still holds for version bumps.

**§9 rule:** the Function-runtime series **does** flip `api/og` to `runtime: "nodejs"` (with `"bunVersion": "1.4.x"`) so the Function runs on Bun 1.4. Keep regions, keep fetch-based fonts, keep `trustedFetchOrigin`. Repeat the six-PNG oracle. If that preview fails to boot or pixels regress, revert that PR — do not invent `runtime: "bun"`.

## OG 表示契約

- occupation ID は 1-4 桁の ASCII digit のみ。overflow を truncate しない。
- upstream projection は Zod schema で validate する。壊れた data は 502。
- missing occupation / sector は 404。
- salary / workers が null の場合は `0` ではなく em dash を出す。`平均年収 0 万円` のような虚偽表示を避ける。
