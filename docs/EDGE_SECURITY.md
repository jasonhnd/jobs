# Edge Security

対象は `api/*`、`middleware.ts`、OG 画像生成 (`api/og.tsx` と `src/lib/og-*`)。Edge runtime は外部入力を受けるため、preview convenience より fail-safe な境界を優先する。

## Origin / Referer gate

`src/lib/api-security.js` の `makeOriginGate()` が POST endpoint の origin check 正典。

- `Origin` が存在し allowlist にある場合だけ通す。
- `Origin` が存在して hostile な場合は、`Referer` が allowlist に見えても拒否する。
- `Origin` がない場合のみ、parsed `Referer` origin へ fallback する。
- prefix match は禁止。必ず `URL(...).origin` と allowlist の完全一致で見る。

## Production fail-closed

`VERCEL_ENV === "production"` のときだけ production とみなす。

- Upstash rate limit と Turnstile は production で missing config / upstream failure を fail-closed にする。
- Preview/dev/test は local 開発を壊さないため fail-open できる。
- override env はテストで固定されているため、挙動変更時は `src/lib/api-security.test.ts` も更新する。

## Body size

`readBodyText(req, capBytes)` は stream を読みながら累積 byte 数で cap する。`content-length` は信用しない。

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

## OG 表示契約

- occupation ID は 1-4 桁の ASCII digit のみ。overflow を truncate しない。
- upstream projection は Zod schema で validate する。壊れた data は 502。
- missing occupation / sector は 404。
- salary / workers が null の場合は `0` ではなく em dash を出す。`平均年収 0 万円` のような虚偽表示を避ける。
