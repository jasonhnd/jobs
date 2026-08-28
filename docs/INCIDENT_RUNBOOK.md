# Incident Runbook — Vercel 運用の即応手順とプラットフォーム状態台帳

対象は production（`mirai-shigoto.com`）の障害・回帰・攻撃への即応と、repo の外に存在する Vercel プラットフォーム状態の台帳・回放。平常時の開発手順は [`WORKFLOW.md`](WORKFLOW.md)、操作の権限境界は同 §「Vercel 操作の権限境界」を正典とする。**状態変更コマンドはすべて Owner 承認の対象**（読み取りは agent 承認不要）。

## 1. 即時ロールバック

新しい production deployment が壊れているとき:

```bash
vercel rollback            # 直前の production へ即時復帰
vercel rollback <url|id>   # 特定 deployment を指名
```

- Rolling release が進行中（5% 段階）の場合は先に abort する（§2）。
- 恒久修正は通常フロー（topic → `preview` → promotion PR）で行い、rollback は止血に限る。

## 2. Rolling release 操作

現行設定: production は **5% → 10 分 → 自動で 100%**（project 設定; 台帳 §6.2）。

```bash
vercel rolling-release fetch     # 進行中リリースの状態（なければ null）
vercel rolling-release abort     # 新版を止め、旧版へ全量復帰
vercel rolling-release approve   # 自動進行を待たず次段階へ
vercel rolling-release complete  # 即時 100%
```

## 3. 回帰の二分探索

「いつからか壊れている」への最短経路。1 日 10–20 deploys の本番では目視の commit 追跡より速い:

```bash
vercel bisect                    # good/bad の deployment を対話で挟み込み
```

## 4. 攻撃時（attack mode）

```bash
vercel firewall attack-mode enable
vercel firewall attack-mode disable
```

**警告: attack mode は全リクエストに challenge を課すため、有効中は AI crawler が全滅し GEO 方針（[`EDGE_SECURITY.md`](EDGE_SECURITY.md)、`analytics/geo-observation-sop.md`）を毀損する。** 実攻撃で可用性が脅かされる場合に限り、最短時間で使い、解除を忘れない。平常の防御は rate limit の log / deny(429) のみ — challenge は恒久禁止。

## 5. 調査・確認コマンド（読み取り: agent 承認不要）

```bash
vercel ls                        # 直近 deployments
vercel inspect <url> --logs      # build ログ（失敗調査の第一手）
vercel logs <url>                # runtime ログ
vercel alerts --ai               # 未解決 alert を agent 向け書式で
vercel firewall overview         # WAF / rate limit / attack mode の現況
vercel usage --group-by project  # 費用のプロジェクト帰属
vercel curl <path>               # linked project の deployment へ認証付き請求
vercel redeploy <url|id>         # 同一コミットの再ビルド（キャッシュ疑い時）
```

## 6. プラットフォーム状態の台帳と回放

`vercel.json` と repo に載らない production 状態は本節がすべて。**変更したら同じ変更で本節を更新する**（[`WORKFLOW.md`](WORKFLOW.md) の docs-first に従う）。消失時は各コマンドで再作成できる。

### 6.1 WAF custom rule（2026-08-27 作成）

`ratelimit-shindan-share` — path starts with `/api/shindan-share` → Rate Limit **60 req / 60s / IP**、超過 action **deny (429)**（2026-08-27〜28 の log 観察で誤検知なしを確認し、2026-08-28 に切替済）。challenge は使わない。

```bash
vercel firewall rules add ratelimit-shindan-share \
  --description "Billing fuse for /api/shindan-share (per-invocation cost endpoint). NEVER use challenge (GEO/AI-crawler policy)." \
  --condition '{"type":"path","op":"pre","value":"/api/shindan-share"}' \
  --action rate_limit --rate-limit-algo fixed_window \
  --rate-limit-window 60 --rate-limit-requests 60 \
  --rate-limit-keys ip --rate-limit-action deny \
  --non-interactive -y
vercel firewall publish --yes
```

補足: rate limit の計数は region ごとに独立（hnd1 + kix1 で実効上限 ≈ 設定値の 2 倍）。

### 6.2 Rolling release 設定（2026-08-27 有効化）

```bash
vercel rolling-release configure --enable \
  --advancement-type automatic --stage "5,10m"
```

確認: `vercel api "/v9/projects/<projectId>?teamId=<teamId>"` の `rollingRelease` が
`{"target":"production","stages":[{"targetPercentage":5,"duration":10},{"targetPercentage":100}]}`。

### 6.3 Spend Management（2026-03 設定済）

Team budget **$200 / 月、通知のみ**（`pauseProjects: false`）。auto-pause は**有効化しない** — サイト停止は超過額より高くつく。設定は dashboard（Team Settings → Billing → Spend Management）、読み取り確認は `vercel api "/v1/budgets?teamId=<teamId>"`。

### 6.4 Alert rule

`ar_default`（team 既定）: error / critical の anomaly を owner へ自動通知（email / 站内）。確認: `vercel alerts rules ls`。measurement sentinel（`api/cron/measurement-sentinel`、#333）はこの経路を通知に使う — 不健全時に意図的な 500 を返す設計。

### 6.5 環境変数台帳（名前のみ。値は Vercel 側が正）

| 名前 | 環境 | 用途 |
|---|---|---|
| `PUBLIC_GA4_MEASUREMENT_ID` | Production, Preview | GA4 計測 ID |
| `GA4_MP_API_SECRET` | Production | middleware の MP 送信（Sensitive） |
| `CRON_SECRET` | Production | sentinel の caller gate（Sensitive、2026-08-27） |
| `PUBLIC_CF_BEACON_TOKEN` | Production, Preview | Cloudflare beacon |
| `PUBLIC_X_PIXEL_ID` | Production | X pixel |

確認: `vercel env ls`。2026-08-27 に孤児 `aijobs_REDIS_URL` を全環境から削除済（#202/#205 で退役した機能の残骸。対応する Marketplace 統合 `redis-citrine-chair` は Uninstalled だった）。

### 6.6 MCP / OIDC

- Vercel MCP: 4 つの local coding agent（Claude Code / Codex / Gemini CLI / Grok）が `https://mcp.vercel.com` へ接続。権限境界は [`WORKFLOW.md`](WORKFLOW.md)。Gemini / Grok は `mcp-remote` 橋（OAuth トークンは `~/.mcp-auth` 共有）。
- Project `oidcTokenConfig`: **enabled / issuerMode `team`**。sentinel phase 2（GA4 Data API 照合、#334）で使用予定。
