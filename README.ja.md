# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-mirai--shigoto.com-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](CHANGELOG.md)
[![Hosting: Vercel](https://img.shields.io/badge/hosting-Vercel%20(hnd1)-000)](https://vercel.com)

> **🌏 [English README is here](README.md)**

厚生労働省の **職業情報提供サイト（job tag）** に登録されている約 **500 の日本の職業** を対象に、年収・学歴・就業者数・将来性に加えて **LLM による AI 代替リスクスコア** を重ねた、バイリンガル可視化サイトです。

データは 1 つ、UI は 2 つ。日本語は国内向け、English は海外向け。右上のトグルで切り替えられます。

🔗 **公開サイト:** https://mirai-shigoto.com/

---

## ステータス

`v0.5.0` — **本番運用中**。パイプラインは完成しており、**552 の日本の職業** に対して LLM スコアによる AI 代替リスク（0〜10）、英訳、フル機能のバイリンガル UI が独自ドメインで稼働しています。v0.5.0 以降に未リリースの大量の改善が積み上がっています — 次回リリースに含まれる内容は [CHANGELOG.md](CHANGELOG.md) の **Unreleased** ブロックを参照してください。

実装済み:

- **独自ドメイン** `mirai-shigoto.com`、Vercel Tokyo edge（`hnd1`）配信 — 国内訪問者の TTFB は 50 ms 未満。
- **552 職業の squarified treemap**、色レイヤー 6 種類（AI リスク / 年収 / 平均年齢 / 労働時間 / 求人倍率 / 学歴）+ 色覚配慮（viridis）切替。
- **バイリンガル UI**（日本語 / English、ブラウザロケール自動判定、ページごとに hreflang）。
- **ライト / ダークモード** — `prefers-color-scheme` 検出、フラッシュ防止のインライン初期化、`localStorage` 永続化、太陽 / 月のトグル。テーマ切替で treemap 配色とキャンバス背景も同時に変更。
- **552 職業の静的詳細ページ**（合計 1,104 HTML、日 + 英）— 各ページに Schema.org `Occupation` JSON-LD、リスク根拠、ホームと同一の 4 種類の解析タグを完備。
- **メール収集バックエンド** — `api/subscribe.js` + `api/feedback.js`（Vercel Edge Functions, Tokyo edge, Resend バックエンド）。
- **プライバシーポリシー**（`/privacy`、バイリンガル、APPI + GDPR 対応）、Cloudflare Email Routing で `privacy@mirai-shigoto.com` を運営者宛に転送。
- **アナリティクス**: Cloudflare Web Analytics + GA4 + Vercel Web Analytics + Vercel Speed Insights — 4 系統並走でクロス検証可。
- **SEO + GEO**: `robots.txt`（17 種の LLM クローラーを明示的に許可）、`sitemap.xml`（1,104 URL + hreflang ペア）、`llms.txt`（[llmstxt.org](https://llmstxt.org/) 標準準拠）、Schema.org `WebSite` + `Dataset` + `Person` グラフ。
- **`Design.md`** — トークン、テーマシステム、レスポンシブブレークポイント、treemap 規定、コンポーネント標準を一括定義した視覚仕様書。

パフォーマンス予算: LCP 1.6 s 未満（4G）、INP 80 ms 未満、CLS = 0、バンドル 80 KB マイクロサイト予算内。

詳しい履歴は [CHANGELOG](CHANGELOG.md)、視覚仕様は [`Design.md`](Design.md) を参照してください。

---

## なぜ作るのか

Andrej Karpathy 氏の [karpathy/jobs](https://github.com/karpathy/jobs) は、米国労働統計局の Occupational Outlook Handbook（342 職業）を題材に、LLM で AI による代替リスクを評価する試みでした。中国版のフォーク [madeye/jobs](https://github.com/madeye/jobs) もありますが、職業リスト自体を AI で生成しているため、政府統計に裏付けられていません。

日本には BLS OOH に相当する公的データがあります — **厚生労働省 jobtag（約 500 職業）** です。年収・学歴・就業者数・将来性が構造化された形で提供されており、本プロジェクトはこれを土台とします。

つまり本プロジェクトは、karpathy/jobs の **政府データに裏付けられた日本版**、しかもバイリンガル、という位置づけです。

---

## データソース

| 出典 | 用途 | URL |
| --- | --- | --- |
| 厚生労働省 職業情報提供サイト（job tag） | 主要データ：職業名、年収、学歴、就業者数、将来性 | https://shigoto.mhlw.go.jp/User/ |
| 総務省 労働力調査 | 就業者数の補正・産業別構成 | https://www.stat.go.jp/data/roudou/ |
| 総務省 経済センサス | 事業所単位の産業分布 | https://www.stat.go.jp/data/e-census/ |

すべて公開されている政府統計です。AI 代替リスクスコアは別途 LLM が算出するもので、統計値ではなくモデル出力であることを明記します。

---

## 手法

パイプラインは [karpathy/jobs](https://github.com/karpathy/jobs) の構造を日本向けにローカライズしたもので、翻訳ステップが 1 つ追加され、すべての出力がバイリンガルになっています。

| # | スクリプト | 役割 | 出力 |
| --- | --- | --- | --- |
| 1 | `scripts/list_occupations.py` | jobtag の A〜Z インデックスからマスター職業リストを生成 | `occupations.json` |
| 2 | `scripts/scrape_jobtag.py` | 各職業ページを礼儀正しいレートで取得（httpx 優先、Playwright フォールバック） | `html/<slug>.html` |
| 3 | `scripts/parse.py` | BeautifulSoup で HTML をクリーンな Markdown に変換 | `pages/<slug>.md` |
| 4 | `scripts/extract_fields.py` | 構造化フィールド（年収・学歴・就業者数・成長性）を集計 | `occupations.csv` |
| 5 | `scripts/translate.py` | LLM による日→英のバッチ翻訳（職業名・業種・説明） | 同 CSV にバイリンガル列をマージ |
| 6 | `scripts/score_ai_risk.py` | 職業ごとの AI 代替リスクを 0〜10 で LLM がスコアリング（理由は日英両方） | `scores.json` |
| 7 | `scripts/build_data.py` | CSV とスコアをマージしてバイリンガルの単一アーティファクトを出力 | `data.json` |

各ステップは増分キャッシュ済み — 再実行時は出力済みのものをスキップします。スコアリングは OpenRouter（既定で Gemini Flash）を使い、karpathy が用いている 0〜10 のアンカーキャリブレーションをそのまま日本の職業例に置き換えて移植します。

フロントエンド（`index.html`）は `data.json` を読み込み、squarified treemap でフィルタ付きに表示します。`?lang=ja` / `?lang=en` で表示言語を切り替えます。

### 予定している `data.json` スキーマ

```jsonc
{
  "version": "0.x.0",
  "generated_at": "YYYY-MM-DD",
  "occupations": [
    {
      "id": "string",
      "name": { "ja": "...", "en": "..." },
      "industry": { "ja": "...", "en": "..." },
      "description": { "ja": "...", "en": "..." },
      "salary_median_jpy": 0,
      "headcount": 0,
      "education_level": "高卒|専門|短大|大卒|院卒",
      "growth_outlook": "increasing|stable|declining",
      "ai_risk_score": 0.0,
      "ai_risk_rationale": { "ja": "...", "en": "..." },
      "source_url": "https://..."
    }
  ]
}
```

フィールド名は `0.2.0`（パーサー実装時）に確定させます。それまでは予告なく変更される可能性があります。

---

## ロードマップ

過去のリリース（詳細は [CHANGELOG.md](CHANGELOG.md)）:

- **v0.0.1 〜 v0.0.5** — スキャフォールディング、スクレイパー、パーサー、翻訳、スコアリング、初版 `data.json`。✅
- **v0.1.0 〜 v0.3.x** — Squarified treemap、バイリンガル UI、検索、レイヤー切替、モバイル最適化、OGP / hreflang、警告バナー。✅
- **v0.4.x** — 独自ドメイン `mirai-shigoto.com`、GA4、モバイル tooltip 修正。✅
- **v0.5.0** — Vercel 移行、バイリンガルプライバシーポリシー、4 系統解析、SEO + GEO（robots / sitemap / llms.txt / JSON-LD）。✅（現行）

進行中（Unreleased）:

- `prefers-color-scheme` 検出と GA4 `theme_change` イベントを伴うライト / ダークモード。
- 鮮やかなライト配色 + 白背景に最適化した alpha + テーマ感知のキャンバス再描画。
- デスクトップ treemap の縦長化（`w × 1.05`）と tooltip の拡大（0.92 rem / 400 px）。
- 552 職業の静的詳細ページ（`/ja/<id>.html`, `/en/<id>.html`）。
- Resend を呼び出す Vercel Edge Functions（subscribe + feedback）。
- フッター下部のソーシャル共有ボタン（X / LINE / Hatena / LinkedIn / Copy / Native）。
- `Design.md` — 視覚の単一真相源仕様書。
- A-tier パフォーマンス改善（`data.json` の preload、552 件フォールバックリストの遅延、GTM の遅延）。

予定:

### v0.6.x — ニュースレター運用化

メールファネルを end-to-end で。言語別オーディエンス（JA / EN）、職業別モーダルから取得した場合は occupation_id でタグ付け。ウェルカムメール + セグメント別月次ダイジェスト。プライバシーポリシーに記載した解約フローの実機確認。

### v0.7.x — コンテンツ強化

`/methodology` に手法ロングリード — LLM スコアリングのルーブリック、アンカー、BLS 移植スコアとの照合、既知のキャリブレーションドリフトを解説。`?embed=1` で UI クロームを取り除き、第三者記事に treemap を埋め込めるモード。

### v0.8.x — データダンプ公開

公開済みの `data.json` に加えて、`/exports/` 配下に CSV と Parquet 形式を追加。BibTeX / APA / Schema.org Dataset JSON を生成する「Cite this dataset」ウィジェット。学術引用が安定するよう、バージョン付きスナップショットを保持。

### v1.0.0 — 安定版

公開ローンチの基準: 手法解説を 2 名以上の外部読者にレビュー済み、独立した 2 種類の LLM でスコア安定性を検証、アクセシビリティ監査（WCAG AA）、外部発表記事での引用 1 件以上、OPC バリデーション計画の質的インプレッション基準達成。

---

## ローカル開発

現在は静的な `index.html` 1 枚なので、任意の静的サーバで動きます：

```bash
git clone https://github.com/jasonhnd/jobs.git
cd jobs
python -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

パイプラインが入ったあとは、追加で [uv](https://docs.astral.sh/uv/) が必要になります：

```bash
uv sync                              # pyproject.toml から依存をインストール
uv run playwright install chromium   # 一度きり（jobtag は Imperva CDN 配下のため）
```

パイプラインスクリプトは `scripts/` 配下にあります。実行順序は [`scripts/README.md`](scripts/README.md) を参照してください。

---

## ディレクトリ構成

```text
jobs/
├── index.html             # バイリンガル treemap フロントエンド（Vercel が配信）
├── privacy.html           # バイリンガルプライバシーポリシー → cleanUrls で /privacy
├── ja/<id>.html           # 552 職業詳細ページ（日本語）
├── en/<id>.html           # 552 職業詳細ページ（英語）
├── api/
│   ├── subscribe.js       # Edge Function — メール登録（Resend audiences）
│   └── feedback.js        # Edge Function — フッター下部のフィードバックフォーム
├── analytics/
│   ├── spec.yaml          # GA4 計測スペック（events / dimensions / key events）
│   ├── setup-ga4.mjs      # Admin API でスペックを冪等同期するスクリプト
│   └── README.md          # スペック反映手順
├── data.json              # 各ページが読み込むコンパクトなバイリンガルデータ
├── occupations.json       # jobtag A〜Z から生成したマスター職業リスト
├── occupations.csv        # 構造化フィールドのテーブル
├── scores.json            # AI 代替スコアと理由（日 + 英）
├── prompt.en.md /         # LLM に貼り付けやすい単一ファイル形式のデータダンプ
│   prompt.ja.md
├── og.png                 # 1200×630 ソーシャルカード
├── robots.txt /           # SEO / GEO 発見性
│   sitemap.xml /
│   llms.txt
├── scripts/               # 取得・ビルドパイプライン（Python）+ seo-check.sh
├── vercel.json            # 静的サイト設定（cleanUrls / redirects / headers）
├── Design.md              # 視覚の単一真相源 — トークン、テーマ、ブレークポイント
├── README.md              # English
├── README.ja.md           # 日本語（このファイル）
├── CHANGELOG.md
├── LICENSE                # MIT
├── .gitattributes         # `* text=auto eol=lf`
└── .gitignore
```

---

## コントリビュート

現在はスキャフォールディング段階です。`v0.2.0` 以降で PR を歓迎します。それまでは：

- アイデア・データソースの提案・手法に関する質問は Issue でどうぞ。
- 翻訳の改善（特に学歴区分・業種境界の日本語用語）は、パイプラインが英訳ドラフトを出すようになった時点で `translation` ラベルで管理します。

---

## ライセンス

[MIT](LICENSE) © 2026 jasonhnd

---

## 謝辞

- [karpathy/jobs](https://github.com/karpathy/jobs) — BLS OOH × LLM スコアリングのオリジナルアプローチ。
- 厚生労働省、総務省 統計局 — 構造化された職業データを公開していること。
