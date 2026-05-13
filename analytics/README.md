# GA4 セットアップ自動化

mirai-shigoto.com の GA4 計測設定の正典:

| ファイル | 役割 |
| --- | --- |
| `spec.yaml` | すべての event、parameter、custom dimension、key event。**仕様本体** |
| `setup-ga4.mjs` | `spec.yaml` を読み、GA4 Admin API 経由で適用する。冪等性あり |
| `oauth-init.mjs` | 一回限りの OAuth フロー — Google ログインを refresh token に交換する |
| `package.json` | 依存: `googleapis`、`js-yaml` |

`spec.yaml` を編集した後、`npm run setup` を再実行して GA4 に同期する。

## 認証: 2 つの経路、OAuth ユーザー認証情報が推奨

`setup-ga4.mjs` は 2 つの認証経路をサポートし、以下の順で試す:

1. **OAuth ユーザー認証情報**(`~/.config/mirai-shigoto/oauth-token.json`)— ログイン済の人間(あなた)として動き、既に持っている GA4 admin アクセスを継承する。**推奨**。クロス組織 / 個人アカウント構成で service-account メールが `此电子邮件地址没有对应的 Google 账号` で拒否される GA4 の既知問題を回避できる。一回だけ `npm run oauth-init` で設定(下記「OAuth クイックスタート」参照)、その後はすべて非対話で実行できる

2. **Service account JSON**(`GOOGLE_APPLICATION_CREDENTIALS` env var)— ヒトの OAuth フローが適さない CI / 共有環境向けのフォールバック。GA4 アカウントの Admin → Account Access Management で service-account メールにアクセス許可を付与する必要がある。**実際に必要でない限りこの経路は使わない**

---

## OAuth クイックスタート(~5 分、推奨)

このマシンで *実際に動いた* 経路(service-account 経路は 2026-05 の GA4 クロス組織検証でブロックされた)。

### 1. GCP で OAuth Desktop client を作成

https://console.cloud.google.com → APIs & Services → Credentials → **+ Create credentials** → **OAuth client ID** → application type **Desktop app**。名前: `mirai-shigoto-cli`。Create クリック → 「Download JSON」クリック。

GCP が OAuth consent screen の設定を先に要求してくる場合:
- User type: **External**
- 自分を **Test users** に追加(さもないと Google が `Error 403: access_denied` でログインをブロック)
- Branding / Scopes 詳細はスキップ — Desktop app のデフォルトで OK

### 2. 標準位置に JSON を保存

```bash
mkdir -p ~/.config/mirai-shigoto
mv ~/Downloads/client_secret_*.apps.googleusercontent.com.json \
   ~/.config/mirai-shigoto/oauth-client.json
chmod 600 ~/.config/mirai-shigoto/oauth-client.json
```

### 3. 一回限りの OAuth フローを実行

```bash
cd analytics
npm install            # 未実行なら
npm run oauth-init
```

これによりブラウザが Google の OAuth 同意ページに開く。「Advanced → Go to mirai-shigoto-cli (unsafe)」をクリックして未検証アプリ警告を超え、GA4 を持つ Google アカウントでサインインし、`analytics.edit` スコープを許可する。ブラウザに「✓ Authentication successful」が表示される。スクリプトが refresh token を `~/.config/mirai-shigoto/oauth-token.json`(perms 600)に書き、終了する。

### 4. property を発見して spec を適用

```bash
npm run discover                                    # property_id を一覧
GA4_PROPERTY_ID=298707336 npm run setup:dry         # 変更プレビュー
GA4_PROPERTY_ID=298707336 npm run setup             # 適用
```

最初の成功実行後、その後の `npm run setup` はすべて非対話で動く(refresh token は自動更新される)。

---

## Service account セットアップ(レガシー経路、~10 分)

> service account が必要(CI パイプライン等)な場合のみこのセクションに従う。上記の OAuth 経路の方が速く、GA4 の service-account 検証の癖を回避できる。

### 1. GCP プロジェクトを選ぶ or 作成

https://console.cloud.google.com → 左上の project picker → 「New Project」。

推奨名: `mirai-shigoto-analytics`。project ID は自動生成される、控えておく。

> 他の仕事から GCP project が既にある? 再利用可 — これらの API と service account はプロジェクト内に住むが他のサービスと衝突しない。

### 2. Google Analytics Admin API を有効化

新規プロジェクトのコンソール → APIs & Services → Library → 「Google Analytics Admin API」を検索 → **Enable**。

(ついでに「Google Analytics Data API」も有効化しておく — 後で GA MCP server に必要)

### 3. Service Account を作成

APIs & Services → Credentials → **+ Create Credentials** → Service Account。

| フィールド | 値 |
| --- | --- |
| Service account name | `mirai-shigoto-ga4-admin` |
| Service account ID | (auto) |
| Description | "Manages GA4 custom dimensions + key events for mirai-shigoto.com" |

「Grant access to this project」と「Grant users access」ステップはスキップ可。**Done** クリック。

### 4. Service Account JSON key をダウンロード

新規 service account をクリック → **Keys** タブ → **Add Key** → **Create new key** → JSON → **Create**。

`mirai-shigoto-analytics-1234567890ab.json` のようなファイルがダウンロードされる。**リポジトリ外の安全な場所に移動する**(これは認証情報 — 漏洩するとその service account として誰でも動ける)。

推奨場所:

```bash
mkdir -p ~/.config/mirai-shigoto
mv ~/Downloads/mirai-shigoto-analytics-*.json ~/.config/mirai-shigoto/ga4-admin-sa.json
chmod 600 ~/.config/mirai-shigoto/ga4-admin-sa.json
```

### 5. Service account に GA4 property アクセスを付与

https://analytics.google.com を開く → ⚙️ Admin → property `mirai-shigoto.com`(measurement ID `G-GLDNBDPF13` のもの)→ **Property Access Management** → **+**(右上)→ **Add users**。

| フィールド | 値 |
| --- | --- |
| Email addresses | (service account メールを貼る — ダウンロード済 JSON 内の `client_email` フィールド、`mirai-shigoto-ga4-admin@mirai-shigoto-analytics.iam.gserviceaccount.com` のようなもの) |
| Roles | **Editor** |
| Notify by email | チェックを外す(service account なので人間ではない) |

**Add** クリック。

### 6. Node 依存をインストール

```bash
cd analytics
npm install
```

`googleapis` と `js-yaml` を `analytics/node_modules`(gitignored)に取り込む。

### 7. GA4 property ID を発見

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
  npm run discover
```

出力例:

```
Account: ZKSC_KK  (name=accountSummaries/12345)
  └─ Property: mirai-shigoto.com    property_id=501234567
```

数値 `property_id`(例: `501234567`)をコピー。

### 8. spec を適用

まず dry run で変更を確認:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
GA4_PROPERTY_ID=501234567 \
  npm run setup:dry
```

問題なければ:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/mirai-shigoto/ga4-admin-sa.json \
GA4_PROPERTY_ID=501234567 \
  npm run setup
```

出力:

```
[12:00:01]    Target property: properties/501234567
[12:00:01]    Syncing 16 event custom dimensions…
[12:00:01] +  created event dimension: occupation_id
[12:00:02] +  created event dimension: occupation_name_ja
...
[12:00:18]    Syncing 4 user custom dimensions…
[12:00:18] +  created user dimension: language_preference
...
[12:00:24]    Syncing 4 key events…
[12:00:24] +  marked as key event: email_submit_modal
[12:00:25] +  marked as key event: email_submit_header
[12:00:25] +  marked as key event: feedback_submit
[12:00:26] +  marked as key event: report_cta_click
[12:00:26]    Done. Audiences and data retention must be set manually in dashboard.
```

再実行は安全 — 既存エンティティは検出されスキップされる(`= ` lines)。

---

## 手動 GA4 ダッシュボードタスク(スクリプトでは扱わない)

### Data retention → 14 ヶ月

Admin → Data Settings → Data Retention → **Event data retention: 14 months** → Save。

(デフォルトは 2 ヶ月。14 が無料 GA4 の上限で、前年比較が可能になる)

### Enhanced measurement → 全 ON

Admin → Data Streams → Web → stream クリック → 「Enhanced measurement」横の ⚙️ → **全トグル ON** にする(page views、scrolls、outbound clicks、site search、video、file downloads、form interactions)。

### Audiences

`spec.yaml` の `audiences_manual:` 配下に 5 つの audience が記載されている。各々を以下で作成:

Admin → Audiences → **New audience** → Custom(または template)。

| Audience | フィルタ |
| --- | --- |
| Subscribed | Event count `email_submit_modal` ≥ 1 OR `email_submit_header` ≥ 1、duration 540 日 |
| Engaged but unconverted | `occupation_modal_open` ≥ 1 AND `email_submit_modal` = 0 AND `email_submit_header` = 0、duration 30 日 |
| B2B signal | Event `feedback_submit`、parameter `selected_options` が `b2b_hr` OR `b2b_training` を含む、duration 540 日 |
| High-intent occupations | Event `occupation_modal_open` で `risk_tier` = `high`、duration 90 日 |
| Returning visitors | 28 日窓内で Event count `session_start` ≥ 2、duration 28 日 |

(B2B signal は custom dimension `selected_options` の存在が必要 — 上記 step 8 後に存在する)

### Funnel exploration: Modal conversion funnel

Explore → New → Funnel exploration。ステップ:

1. `page_view`
2. `occupation_tile_click`
3. `occupation_modal_open`
4. `report_cta_click`
5. `email_submit_modal`

「Modal funnel」として保存。6 週間の OPC 検証に最も重要なチャート。

---

## spec 適用後

1. spec はバージョン管理下にある。将来の schema 変更は `spec.yaml` + `npm run setup` 経由、ダッシュボードクリックではない
2. 実際の `gtag('event', ...)` 呼び出しはクライアントサイド `index.html` で実行される(別タスクで処理 — OPC plan の `Phase 0 D5` 参照)
3. これらのイベント呼び出しが追加されるまで dimension は空のまま(データが流れない)。それで OK — まず schema、次にデータ

---

## 決定ログ — 明示的な「やらない」エントリ

これらは決定済の選択で、監査のたびに再検討したくない。GA4 セットアップを監査していてこれらの 1 つを検討する場合、**やる前に** サイトオーナーと議論を再開する。

- **Consent Mode v2(GDPR / DMA cookie consent)** — *実装しない*。
  2026-05-06 決定。サイトには計測可能な EU/UK トラフィックが無く、オーディエンスは日本中心。Consent Mode v2 の 3-4 時間コスト + 継続的な cookie バナー UX オーバーヘッドは、規制エクスポージャに見合わない。EU トラフィックが session の > 5% を超えた場合に再検討。

- **A/B テストフレームワーク(GrowthBook / LaunchDarkly / Statsig)** —
  *無期限延期*。2026-05-06 決定。サイトトラフィック量はほとんどの UI 変更について統計的に意味のある A/B テストには低すぎる。現在の規模では before/after analytics 比較で十分。継続 sessions/day がコホート分割の閾値を超えたら再検討。
