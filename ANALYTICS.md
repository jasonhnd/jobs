# Analytics アーキテクチャ

mirai-shigoto.com の全トラッカーに関するリファレンス + ランブック。
監査履歴: 本ドキュメントの大部分は 2026-05-12、数時間の障害診断後に書かれた。具体的に発見された bug と現在敷かれている多層防御は「既知の障害モード」を参照。

---

## トラッカースタック一覧

| トラッカー | 採用理由 | クライアントスクリプト | サーバーエンドポイント | 環境変数 |
|---|---|---|---|---|
| **GA4(クライアント)** | プライマリプロダクトアナリティクス | `gtag/js?id=G-…` | `g/collect` | `PUBLIC_GA4_MEASUREMENT_ID` |
| **GA4(サーバー、MP)** | Tracking-Prevention 耐性フォールバック | (なし — Vercel Edge で動く) | `mp/collect` | `PUBLIC_GA4_MEASUREMENT_ID` + `GA4_MP_API_SECRET` |
| **Vercel Web Analytics** | 訪問者数の真実値ソース | `/_vercel/insights/script.js`(first-party) | `/_vercel/insights/event` | Vercel が自動注入 |
| **Vercel Speed Insights** | Core Web Vitals トレンド | `/_vercel/speed-insights/script.js` | `vitals.vercel-insights.com` | 自動注入 |
| **Cloudflare Web Analytics** | プライバシー尊重の二次ソース | `cloudflareinsights.com/beacon.min.js` | `cloudflareinsights.com/cdn-cgi/rum` | `PUBLIC_CF_BEACON_TOKEN` |
| **X(Twitter)Ads pixel** | 広告コンバージョンアトリビューション | `static.ads-twitter.com/uwt.js` | `analytics.twitter.com/1/i/adsct` | `PUBLIC_X_PIXEL_ID` |

---

## 各部品の配線先

```
┌──────────────────────────────────────────────────────────────┐
│ src/layouts/BaseLayout.astro                                  │
│   - GA4 クライアントスニペット(set:html を使用 — define:vars 不可)│
│   - CF beacon <script defer>                                  │
│   - X Ads pixel スニペット                                    │
│   - Vercel insights + speed-insights スクリプト               │
│   → BaseLayout でラップする全ページ(820+)で出力               │
├──────────────────────────────────────────────────────────────┤
│ src/index-source.html                                         │
│   - 同じトラッカー、ただし ID はハードコード(env 補間なし)     │
│   → / ホームのみで出力(生 HTML 注入、Astro 経由ではない)      │
├──────────────────────────────────────────────────────────────┤
│ middleware.ts(プロジェクトルート、Vercel Edge)               │
│   - HTML リクエストごとにサーバーサイド GA4 MP page_view を fire│
│   - PUBLIC_GA4_MEASUREMENT_ID + GA4_MP_API_SECRET を読む       │
│   - waitUntil() でユーザー応答をブロックしない                 │
│   - fire 前に Bot UA フィルタ                                  │
│   → 一致するすべてのルートで実行、クライアントブロック時も動く  │
├──────────────────────────────────────────────────────────────┤
│ vercel.json `Content-Security-Policy`                         │
│   - トラッカーが呼ぶすべての third-party origin を列挙         │
│   - check-analytics-config.cjs が build 時に検証               │
└──────────────────────────────────────────────────────────────┘
```

---

## 環境変数(全範囲)

Vercel project → Settings → Environment Variables で設定する。analytics 関係は **Production scope のみ**。preview/development を未設定のままにしておけば、staging トラフィックが production stats を汚染しない。

| Env 名 | スコープ | 機密 | 使用箇所 | メモ |
|---|---|---|---|---|
| `PUBLIC_GA4_MEASUREMENT_ID` | Production | no | BaseLayout クライアント + middleware | 形式: `G-XXXXXXXXXX`。実値: `G-GLDNBDPF13`。末尾空白厳禁 |
| `PUBLIC_CF_BEACON_TOKEN` | Production | no | BaseLayout クライアント | Cloudflare dashboard 発行の 32 文字 hex token |
| `PUBLIC_X_PIXEL_ID` | Production | no | BaseLayout クライアント | 短い pixel ID。実値: `rC3xs`。末尾空白厳禁 |
| `GA4_MP_API_SECRET` | Production | **yes** | middleware.ts | GA4 → Admin → Data Streams → Web stream → Measurement Protocol API secrets → Create で発行。サーバー専用 — `PUBLIC_` prefix なし |
| `RESEND_API_KEY`、`RESEND_AUDIENCE_ID_*`、`FEEDBACK_*` | Production | yes | api/* エンドポイント | analytics 無関係。`.env.example` にドキュメント済 |
| `GA4_PROPERTY_ID`、`GOOGLE_APPLICATION_CREDENTIALS` | local | yes | `analytics/setup-ga4.mjs` | オペレーター側 GA4 admin セットアップのみ、ランタイム不要 |

env が欠落している場合、対応するトラッカーは静かにスルーする — 5xx もクライアント可視エラーも出ない。これは意図的: fork / preview はデフォルトで未設定。Production deploy は必須 env をすべて設定すること。

---

## 既知の障害モード(と各々を防ぐ防衛)

| # | 何が起きたか | 根本原因 | 現在敷かれている防衛 |
|---|---|---|---|
| 1 | GA4 が 820+ ページで静かに停止(5/11) | Astro `define:vars` が gtag `<script>` を IIFE でラップ → `function gtag(){}` が window でなくローカル関数に → gtag.js ライブラリが dataLayer queue を処理できず → `g/collect` 発火せず | (a) BaseLayout は `set:html` テンプレ置換を使い、`define:vars` を使わない。(b) tests/e2e/analytics.spec.ts が全ページで `window.gtag === 'function'` をアサート。(c) コーディングルール: `~/.claude/rules/web/security.md` 参照 |
| 2 | env 必須化リファクタ後 gtag ブロックが丸ごと消えた | `{GA4_MEASUREMENT_ID && (...)}` が Vercel env 未設定でショートサーキット | tests/e2e/analytics.spec.ts が全ページで `gtag/js?id=G-` リクエストの発火をアサート。CI でマージ前に落ちる |
| 3 | X Ads pixel が一度も動かなかった | `static.ads-twitter.com` が vercel.json CSP `script-src` に入っていなかった | scripts/check-analytics-config.cjs が必須 origin がすべて CSP に入っているか検証。デプロイ前に build が落ちる |
| 4 | `PUBLIC_X_PIXEL_ID = "rC3xs\n"`(UI ペーストの末尾改行) | オペレーターが隠れた `\n` を含む値をペースト、build が文字列リテラル `"rC3xs\n"` を埋め込み、Twitter が拒否 | tests/e2e/analytics.spec.ts が埋め込み pixel ID に空白文字が無いことをアサート。CLI で設定するときは `printf "value" \| vercel env add` を必ず使う(`echo` は不可) |
| 5 | 実ユーザーの `g/collect` が Chromium 137+ Tracking Prevention でブロック | 業界規模のブラウザポリシー変更 — gtag.js は `sendBeacon('g/collect', …)` を呼び、Chromium は既知の追跡エンドポイントに対し抑制する | middleware.ts が Edge リクエストごとにサーバーサイド MP `page_view` を fire → 100% ブラウザポリシー独立 |

---

## 現在敷かれている多層防御

### Layer 1: E2E テスト
- ファイル: `tests/e2e/analytics.spec.ts`
- 実行: `pnpm run test:e2e`(または `pnpm test:e2e` ショートカット)
- アサート: 各トラッカーライブラリが load、`window.gtag` + `window.twq` が関数、GA4 `g/collect` が 12 秒以内に fire、CSP がコードの呼ぶすべての origin を列挙、埋め込み pixel ID に空白文字なし
- 配線先: ローカルでの手動実行のみ(`pnpm test:e2e`)。GitHub Actions は 2026-05-28 に廃止され、Vercel build gate にも含まれない
- **キャッチする障害モード**: 1、2、3、4

### Layer 2: Build-time 整合性
- ファイル: `scripts/check-analytics-config.cjs`
- 実行: `npm run build` の最初のステップとして自動実行(`pnpm check:analytics-config` でアドホック実行も可)
- アサート: vercel.json CSP `script-src` / `connect-src` がコードの参照するすべての origin を含む、すべての `import.meta.env.PUBLIC_*` 参照が `.env.example` にドキュメントされている、middleware.ts のすべての `process.env.*` が `.env.example` にドキュメントされている
- **キャッチする障害モード**: 3(CSP に origin 欠落)、4(env 未ドキュメント)

### Layer 3: サーバーサイドフォールバック
- ファイル: `middleware.ts`
- prerendered ファイル配信前、Vercel Edge で各 HTML リクエストごとに実行
- クライアントサイド gtag.js が 100% ブロックされても、Measurement Protocol 経由で page_view を記録
- **キャッチする障害モード**: 5(業界規模のブラウザブロック)

### Layer 4: コーディングルール
- `~/.claude/rules/web/security.md` 参照 — third-party スニペットの落とし穴
- 具体的に: third-party ライブラリが `window.X` で見つけることを期待する `function gtag(){…}` / `function fbq(){…}` / `function twq(){…}` 宣言を含む `<script>` には、Astro `define:vars` を **絶対に使わない**。代わりに `set:html` テンプレリテラル補間を使う
- **キャッチする障害モード**: 1(別トラッカーでの再発)

---

## インシデント後検証ランブック

analytics に異常がある(リアルタイムデータが低く感じる、GA4 トレンドが下がる等)と疑った時は、以下を **順番に** 確認する:

### 1. 真実値ソースの sanity チェック
- Vercel project → Analytics タブ → 「Last 30 minutes」の訪問者数
- これは first-party(Tracking-Prevention 耐性)で、実ヒト pageview の真実値に最も近い

### 2. GA4 Realtime を比較
- GA4 → Reports → Realtime → 「Active users in last 30 minutes」
- Vercel の数字の 50-100% 以内にあるべき。低い場合:
  - **0 active**: GA4 が完全に壊れている。step 3 へ
  - **20-50%**: ブラウザブロックが効いている(2026 年では normal)。middleware.ts のデプロイを確認し(step 4)、Vercel を真実値として扱う
  - **\>100%**: クライアント + middleware で二重カウント。短期的には許容、middleware に consent-check ロジックを追加すれば修正可能

### 3. クライアントサイドチェーンの確認
DevTools Network パネルで `https://mirai-shigoto.com/ja/sectors` を開く。ページロード後 10 秒以内に以下が見えるはず:
- `https://www.googletagmanager.com/gtag/js?id=G-GLDNBDPF13` → 200
- `https://www.google-analytics.com/g/collect?…` → 204(これが page_view ヒット。欠落 → クライアントサイドが壊れている)
- `https://static.cloudflareinsights.com/beacon.min.js` → 200
- `https://static.ads-twitter.com/uwt.js` → 200

Console で評価:
- `typeof window.gtag` → `"function"`
- `window.dataLayer.length` → ≥ 3
- `Object.keys(window.google_tag_manager)` → `"G-GLDNBDPF13"` を含む

### 4. サーバーサイドチェーンの確認
- Vercel project → Logs → `/ja/` でフィルタ → 直近のリクエストで middleware の行が存在することを確認
- GA4 Realtime → `ssrc=mw` タグ付きイベントを探す(middleware が送る param)→ これがサーバーサイドヒット

### 5. env 配線の確認
- Vercel → Settings → Environment Variables → `PUBLIC_GA4_MEASUREMENT_ID`、`PUBLIC_CF_BEACON_TOKEN`、`PUBLIC_X_PIXEL_ID`、`GA4_MP_API_SECRET` がすべて Production に設定されていることを確認
- 値には **末尾空白なし**。Vercel CLI で編集する場合は必ず `printf "value" | vercel env add NAME production` を使い、`echo "value" | …` は使わない(echo は `\n` を追加する)

### 6. property の確認
- GA4 → Admin → Data Streams → Web stream → 以下を確認:
  - Status: 「Receiving traffic in past 48 hours」
  - Enhanced Measurement: ON、Page views を含む
  - Tag quality が「Critical」でない(Warnings は OK)
- GA4 → Admin → Data Filters → アクティブな「Internal traffic」フィルタが過剰広範になっていないか確認

---

## analytics スタックを変更する場合

新しいトラッカーを追加 / ID を入れ替え / CSP を変更する場合:

1. **CSP に origin を追加**: `vercel.json` → `Content-Security-Policy` → 新 origin を `script-src`(ライブラリ用)と `connect-src`(レポートエンドポイント用)に追加
2. **env var をドキュメント**: `.env.example` → `PUBLIC_NEW_*=` を追加、値の意味、取得先、用途をコメントで説明
3. **analytics-config check を更新**: `scripts/check-analytics-config.cjs` → 新 origin を `REQUIRED_SCRIPT_SRC_ORIGINS` / `REQUIRED_CONNECT_SRC_ORIGINS` に追加
4. **本ドキュメントを更新**: 上部のトラッカーテーブルに行を追加
5. **E2E アサーションを追加**: `tests/e2e/analytics.spec.ts` → 新 origin を `REQUIRED_REQUESTS` に追加、`window.X` グローバル(`gtag` / `twq` 等)を expose するトラッカーなら `waitForFunction` チェックも追加
6. **Vercel で env 設定**: 新 env を Production scope に追加。CLI 経由なら `printf "..." | vercel env add` を使う
7. **再デプロイをトリガー**: main に空コミットを push、または Vercel UI から redeploy。env 変更は次回 build まで反映されない

デプロイ後、上記の検証ランブックを実行し、新トラッカーが実際にデータを受け取っているか確認すること。
