# Edge Security

対象は `middleware.ts`、OG 画像生成 (`api/og.tsx` と `src/lib/og-*`)、診断結果共有 (`api/shindan-share.ts` と関連 helper)。これらの入口は外部入力を受けるため、preview convenience より fail-safe な境界を優先する。

**Runtime status (2026-08-25, after PR 299):** all three still `runtime: "edge"`. `"bunVersion": "1.4.x"` is set and does **not** apply to Edge. The series that moves them to `runtime: "nodejs"` so Bun 1.4 actually runs them is [`TOOLCHAIN.md`](TOOLCHAIN.md) §9. IP / origin / font rules below are input-boundary rules — they stay after the runtime cut. Do not drop `trustedFetchOrigin` or the gstatic-only font fetch because Node/Bun has `fs`.

## Client IP

`src/lib/middleware-helpers.ts` の `clientIpFromRequest()` が GA4 geolocation 用の client IP 抽出の正典。

- Vercel が設定する `x-real-ip`、`x-vercel-forwarded-for` を優先する。
- raw `x-forwarded-for` は fallback とし、client が偽装できる first hop ではなく last hop を使う。
- usable な header がない場合は `anonymous` を返し、middleware は空の `ip_override` に変換する。
- IP はアクセス制御の境界には使わない。

## OG data fetch

OG renderer は request origin の data projection を読む。ただし spoofed host への SSRF を避けるため、`trustedFetchOrigin(url)` を通す。

許可する host:

- `mirai-shigoto.com`
- `*.mirai-shigoto.com`
- `*.vercel.app`
- `localhost`
- `127.0.0.1`

その他の host は production origin に fallback する。

## Font fetch

Google Fonts CSS から抽出した font binary URL は `https://fonts.gstatic.com/` で始まる場合だけ fetch する。CSS response は外部入力なので、任意 host へ server-side fetch しない。

## `@vercel/og` 1.0.1 — current Edge, then §9 Bun

**Today:** `api/og.tsx` is `runtime: "edge"` / `regions: ["hnd1", "kix1"]` on `@vercel/og@1.0.1` (satori 0.29). Issue 287 verified Edge boot: `λ api/og (855.83KB) [hnd1, kix1]`. Six production PNGs were byte-identical (`/api/og`, `?id=156`, `?sector=iryo`, `?page=map`, one worktype wide + `shape=square`). Fonts stay `loadGoogleFont` → gstatic-only; data stays `trustedFetchOrigin`. Do not bundle TTF.

**#280 rule:** do not flip `runtime` to `"nodejs"` inside a package bump. That rule still holds for version bumps.

**§9 rule:** the Function-runtime series **does** flip `api/og` to `runtime: "nodejs"` (with `"bunVersion": "1.4.x"`) so the Function runs on Bun 1.4. Keep regions, keep fetch-based fonts, keep `trustedFetchOrigin`. Repeat the six-PNG oracle. If that preview fails to boot or pixels regress, revert that PR — do not invent `runtime: "bun"`.

## OG 表示契約

- occupation ID は 1-4 桁の ASCII digit のみ。overflow を truncate しない。
- upstream projection は Zod schema で validate する。壊れた data は 502。
- missing occupation / sector は 404。
- salary / workers が null の場合は `0` ではなく em dash を出す。`平均年収 0 万円` のような虚偽表示を避ける。
