# Analytics アーキテクチャ

mirai-shigoto.com の全トラッカーに関するリファレンス + ランブック。
監査履歴: 本ドキュメントの大部分は 2026-05-12、数時間の障害診断後に書かれた。具体的に発見された bug と現在敷かれている多層防御は「既知の障害モード」を参照。

---

## トラッカースタック一覧

| トラッカー | 採用理由 | クライアントスクリプト | サーバーエンドポイント | 環境変数 |
|---|---|---|---|---|
| **GA4(クライアント)** | プライマリプロダクトアナリティクス | `gtag/js?id=G-…` | `g/collect` | `PUBLIC_GA4_MEASUREMENT_ID` |
| **Google Ads** | 広告コンバージョン計測 | GA4 と同じ `gtag.js`、`gtag('config', 'AW-…')` | `googleads.g.doubleclick.net` / `www.googleadservices.com` | `PUBLIC_GOOGLE_ADS_ID` |
| **GA4(サーバー、MP)** | 配信計測(`page_delivery`)+ AI クローラー観測 | (なし — Vercel Edge で動く) | `mp/collect` | `PUBLIC_GA4_MEASUREMENT_ID` + `GA4_MP_API_SECRET` |
| **Vercel Web Analytics** | 訪問者数の真実値ソース | `/_vercel/insights/script.js`(first-party) | `/_vercel/insights/event` | Vercel が自動注入 |
| **Vercel Speed Insights** | Core Web Vitals トレンド | `/_vercel/speed-insights/script.js` | `vitals.vercel-insights.com` | 自動注入 |
| **Cloudflare Web Analytics** | プライバシー尊重の二次ソース | `cloudflareinsights.com/beacon.min.js` | `cloudflareinsights.com/cdn-cgi/rum` | `PUBLIC_CF_BEACON_TOKEN` |
| **X(Twitter)Ads pixel** | 広告コンバージョンアトリビューション | `static.ads-twitter.com/uwt.js` | `analytics.twitter.com/1/i/adsct` | `PUBLIC_X_PIXEL_ID` |
| **Meta Pixel** | Facebook / Instagram 広告アトリビューション | `connect.facebook.net/en_US/fbevents.js` | `www.facebook.com` / `connect.facebook.net` | `PUBLIC_META_PIXEL_ID` |

---

## 計測単位(この文書で最も重要な契約)

**`page_view` と `page_delivery` は別の単位である。混ぜてはならない。**

| イベント | 単位 | 誰が送るか | 何を答えるか |
|---|---|---|---|
| `page_view` | **人がページを見た 1 回** | クライアント `gtag.js` のみ | 「何人が何を見たか」。GA4 の `Views` / セッション / エンゲージメントはこの単位で計算される |
| `page_delivery` | **ページを 1 回配信した** | Edge middleware(MP)のみ | 「実際に何を何回配ったか」。ブラウザが gtag.js をブロックした相手と AI クローラーを含む |

2026-07-28 から 2026-08-14 まで、両方が `page_view` という 1 つの名前で送られていた。GA4 は送られたものを必ずセッションとして数えるので、この期間のセッション / ユーザー / エンゲージメント率はすべて読めない(#253)。**その 2 週間の数値を後から解釈しようとしないこと。**

### なぜ分けるか

`gtag.js` が実行されるのは全配信の約 56% にすぎない(残りは Tracking Prevention / 広告ブロッカー)。1 つの名前では次のどちらかしか選べない:

- サーバー側を送らない → 実リーチを 44% 過小評価する
- サーバー側も `page_view` として送る → 幽霊セッションが本物を埋め、全指標が読めなくなる(これが起きた)

単位を分けると両方成立する。`page_view` は 2026-07-28 以前と同じ定義に戻るので**過去との比較が復活し**、`page_delivery` が実リーチを別枠で持つ。

### 派生する 4 つの数値

| 数値 | 読み方 |
|---|---|
| `page_view`(クライアント) | 人。履歴と比較可能 |
| `page_delivery` × `client_kind=browser` | 実リーチ(ブロックされた人を含む) |
| **`page_delivery ÷ page_view`** | **Tracking Prevention 率**。これ以外に測る手段がない |
| `page_delivery` × `client_kind=ai_agent` × `agent_name` | どの AI エンジンが何を取りに来ているか |

### アイデンティティの規則

| 配信の種類 | client_id | 結果 |
|---|---|---|
| `_ga` cookie あり(join 可能) | cookie の値 | 本人の実セッションに合流する。セッションは増えない |
| `_ga` なし(gtag ブロック) | (client_kind × referrer bucket × 日)ごとの決定的バケット | 1 日あたり数個のセッションに収束する |
| AI クローラー | (agent_name × 日)ごとの決定的バケット | agent ごとに 1 日 1 セッション |

**リクエストごとに新しい ID を作ってはならない。** 以前は `_ga` が無い時に IP + UA + Accept-Language のハッシュを使っていたが、これは 1 日あたり約 1,100 個の幽霊セッションを生んだうえ、日本のキャリア NAT では複数人が 1 つに潰れるため人数としても信用できなかった。バケット ID なら配信数(`eventCount`)は正確なまま、セッション汚染だけが消える。

### 何を落とし、何を落とさないか

落とすのは **スキャナ**(`/wp-admin`、`.env`、`.php` 等を狙う UA / パス)、**非 HTML リクエスト**、**`cookieConsent=rejected`** の 3 つだけ。

**AI クローラーを落としてはならない。** 2026-05-24 から 2026-08-14 まで `shouldSendMpHit` が既知の AI クローラーを一律で捨てていたため、「どの AI が何を取りに来たか」はどこにも記録されていなかった。これは GEO 施策の効果を測る一次信号であり、破棄対象ではない。

---

## 各部品の配線先

```
┌──────────────────────────────────────────────────────────────┐
│ src/layouts/BaseLayout.astro                                  │
│   - GA4 クライアントスニペット(set:html を使用 — define:vars 不可)│
│   - Google Ads AW-… config(同じ gtag.js を共有)                │
│   - CF beacon <script defer>                                  │
│   - X Ads pixel スニペット                                    │
│   - Meta Pixel スニペット(consent-gated init)                 │
│   - Vercel insights + speed-insights スクリプト               │
│   → BaseLayout でラップする全ページ(820+)で出力               │
├──────────────────────────────────────────────────────────────┤
│ src/index-source.html                                         │
│   - 同じトラッカー、ただし ID はハードコード(env 補間なし)     │
│   → / ホームのみで出力(生 HTML 注入、Astro 経由ではない)      │
├──────────────────────────────────────────────────────────────┤
│ middleware.ts(プロジェクトルート、Vercel Edge)               │
│   - HTML リクエストごとに GA4 MP `page_delivery` を fire       │
│     (`page_view` は送らない — クライアント専用。「計測単位」参照)│
│   - PUBLIC_GA4_MEASUREMENT_ID + GA4_MP_API_SECRET を読む       │
│   - waitUntil() でユーザー応答をブロックしない                 │
│   - UA を client_kind(browser / ai_agent)に分類               │
│     スキャナと非 HTML だけを除外。AI クローラーは除外しない     │
│   → 一致するすべてのルートで実行、クライアントブロック時も動く  │
├──────────────────────────────────────────────────────────────┤
│ vercel.json `Content-Security-Policy`                         │
│   - トラッカーが呼ぶすべての third-party origin を列挙         │
│   - check-analytics-config.cjs が build 時に検証               │
└──────────────────────────────────────────────────────────────┘
```

---

## 環境変数(全範囲)

Vercel project → Settings → Environment Variables で設定する。analytics 関係は原則 **Production scope のみ**。preview/development を未設定のままにしておけば、staging トラフィックが production stats を汚染しない。例外として `PUBLIC_META_PIXEL_ID` は preview / production の両方に設定されることがある。

| Env 名 | スコープ | 機密 | 使用箇所 | メモ |
|---|---|---|---|---|
| `PUBLIC_GA4_MEASUREMENT_ID` | Production | no | BaseLayout クライアント + middleware | 形式: `G-XXXXXXXXXX`。実値: `G-GLDNBDPF13`。末尾空白厳禁 |
| `PUBLIC_CF_BEACON_TOKEN` | Production | no | BaseLayout クライアント | Cloudflare dashboard 発行の 32 文字 hex token |
| `PUBLIC_X_PIXEL_ID` | Production | no | BaseLayout クライアント | 短い pixel ID。実値: `rC3xs`。末尾空白厳禁 |
| `PUBLIC_META_PIXEL_ID` | Preview + Production | no | BaseLayout クライアント | Meta Pixel ID。`fbq('init')` + `PageView` は cookie banner で拒否されていない場合のみ fire |
| `PUBLIC_GOOGLE_ADS_ID` | Production | no | BaseLayout クライアント | 形式: `AW-XXXXXXXXX`。GA4 と同じ `gtag.js` を共有するため、`PUBLIC_GA4_MEASUREMENT_ID` が未設定の build では inert |
| `GA4_MP_API_SECRET` | Production | **yes** | middleware.ts | GA4 → Admin → Data Streams → Web stream → Measurement Protocol API secrets → Create で発行。サーバー専用 — `PUBLIC_` prefix なし |
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
| 5 | 実ユーザーの `g/collect` が Chromium 137+ Tracking Prevention でブロック | 業界規模のブラウザポリシー変更 — gtag.js は `sendBeacon('g/collect', …)` を呼び、Chromium は既知の追跡エンドポイントに対し抑制する | middleware.ts が Edge リクエストごとに MP `page_delivery` を fire → 100% ブラウザポリシー独立 |
| 6 | セッション数が 687 → 1,969/日 に「増加」した裏で、実際の有料流入は 74% 減っていた(7/28〜8/14) | サーバーとクライアントが同じ `page_view` を送り、`_ga` の無い配信がリクエストごとに新 ID を発行 → 1 日約 1,100 の幽霊セッションが本物を埋め、**定義変更をトレンドと誤読させた** | (a)「計測単位」の契約を本ドキュメントに明文化。(b) サーバーは `page_delivery` を送り `page_view` を送らない。(c) join 不能な配信は決定的バケット ID を使い、リクエストごとの ID 発行を禁止。(d) `check-analytics-spec.ts` が spec との整合を守る |

---

## 現在敷かれている多層防御

### Layer 1: E2E テスト
- ファイル: `tests/e2e/analytics.spec.ts`
- 実行: `bun run test:e2e`(または `bun run test:e2e` ショートカット)
- アサート: GA4 / Cloudflare / Vercel / X のライブラリが load、`window.gtag` + `window.twq` が関数、GA4 `g/collect` が 12 秒以内に fire、`PUBLIC_GOOGLE_ADS_ID` 設定時は `AW-…` config が dataLayer に queue、CSP が E2E 対象トラッカーの origin を列挙、埋め込み pixel ID に空白文字なし
- 配線先: ローカルでの手動実行のみ(`bun run test:e2e`)。GitHub Actions は 2026-05-28 に廃止され、Vercel build gate にも含まれない
- **キャッチする障害モード**: 1、2、3、4

### Layer 2: Build-time 整合性
- ファイル: `scripts/check-analytics-config.cjs`
- 実行: `bun run build` の最初のステップとして自動実行(`bun run check:analytics-config` でアドホック実行も可)
- アサート: vercel.json CSP `script-src` / `connect-src` がコードの参照するすべての origin を含む、すべての `import.meta.env.PUBLIC_*` 参照が `.env.example` にドキュメントされている、middleware.ts のすべての `process.env.*` が `.env.example` にドキュメントされている
- **キャッチする障害モード**: 3(CSP に origin 欠落)、4(env 未ドキュメント)

### Layer 3: サーバーサイド配信計測
- ファイル: `middleware.ts`
- prerendered ファイル配信前、Vercel Edge で各 HTML リクエストごとに実行
- クライアントサイド gtag.js が 100% ブロックされても、Measurement Protocol 経由で `page_delivery` を記録する
- `page_view` は送らない。これはフォールバックではなく**別単位の計測**である(「計測単位」参照)
- **キャッチする障害モード**: 5(業界規模のブラウザブロック)、6(単位の混同)

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
- `https://connect.facebook.net/en_US/fbevents.js` → 200(`PUBLIC_META_PIXEL_ID` 設定時、かつ cookie banner で拒否されていない場合)

Console で評価:
- `typeof window.gtag` → `"function"`
- `window.dataLayer.length` → ≥ 3
- `window.dataLayer` に `['config', 'AW-…']` が含まれる(`PUBLIC_GOOGLE_ADS_ID` 設定時)
- `Object.keys(window.google_tag_manager)` → `"G-GLDNBDPF13"` を含む

### 4. サーバーサイドチェーンの確認
- Vercel project → Logs → `/ja/` でフィルタ → 直近のリクエストで middleware の行が存在することを確認
- GA4 Realtime → `page_delivery` イベントを探す(`ssrc=mw` param 付き)→ これがサーバーサイドヒット
- `page_delivery` が出ていて `page_view` が出ていない場合、壊れているのはクライアント側(step 3)。逆なら middleware か `GA4_MP_API_SECRET`
- `client_kind=ai_agent` の `page_delivery` は正常。AI クローラーは意図的に計測している(「計測単位」参照)ので、これを見て「bot が混入している」と判断しないこと

### 5. env 配線の確認
- Vercel → Settings → Environment Variables → `PUBLIC_GA4_MEASUREMENT_ID`、`PUBLIC_CF_BEACON_TOKEN`、`PUBLIC_X_PIXEL_ID`、`PUBLIC_META_PIXEL_ID`、`PUBLIC_GOOGLE_ADS_ID`、`GA4_MP_API_SECRET` が想定 scope に設定されていることを確認
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
