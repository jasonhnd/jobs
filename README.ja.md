# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-jasonhnd.github.io%2Fjobs-ffb84d)](https://jasonhnd.github.io/jobs/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-lightgrey.svg)](CHANGELOG.md)
[![Pages](https://img.shields.io/github/deployments/jasonhnd/jobs/github-pages?label=pages)](https://github.com/jasonhnd/jobs/deployments)

> **🌏 [English README is here](README.md)**

厚生労働省の **職業情報提供サイト（job tag）** に登録されている約 **500 の日本の職業** を対象に、年収・学歴・就業者数・将来性に加えて **LLM による AI 代替リスクスコア** を重ねた、バイリンガル可視化サイトです。

データは 1 つ、UI は 2 つ。日本語は国内向け、English は海外向け。右上のトグルで切り替えられます。

🔗 **公開サイト:** https://jasonhnd.github.io/jobs/

---

## ステータス

`v0.1.0` — **スキャフォールディングのみ**。デプロイされているページはバイリンガルのプレースホルダーで、職業データはまだ取り込まれていません。スクレイパー・パーサー・翻訳・スコアリングは `0.2.0` 以降で実装します。

リリース内容は [CHANGELOG](CHANGELOG.md)、今後の予定は下記の [ロードマップ](#ロードマップ) を参照してください。

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

5 ステップのパイプラインで jobtag のページを可視化用データに変換します。

| # | スクリプト | 役割 | 出力 |
| --- | --- | --- | --- |
| 1 | `scripts/scrape_jobtag.py` | 各職業ページを礼儀正しいレートで取得 | `raw/*.html` |
| 2 | `scripts/parse.py` | HTML から構造化フィールドを抽出 | `data/jobs.csv` |
| 3 | `scripts/translate.py` | LLM による日→英のバッチ翻訳（職業名・業種・説明） | 同 CSV にバイリンガル列を追加 |
| 4 | `scripts/score_ai_risk.py` | 職業ごとの AI 代替リスクを 0〜10 で LLM がスコアリング | `data/scores.csv` |
| 5 | `scripts/build_site_data.py` | マージしてバイリンガルの単一ファイルを出力 | `data.json` |

フロントエンド（`index.html`）は `data.json` を読み込み、treemap でフィルタ付きに表示します。`?lang=ja` / `?lang=en` で表示言語を切り替えます。

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

### v0.1.0 — スキャフォールディング ✅（現行）

バイリンガルのプレースホルダー、GitHub Pages デプロイ、ライセンス、README、CHANGELOG。

### v0.2.0 — パイプライン

スクレイパー・パーサー・翻訳・スコアリング。動作確認用に約 50 職業の `data.json` を出力。

### v0.3.0 — 可視化

業種 × AI 代替リスク × 年収の treemap、フィルタ UI、検索、職業詳細ドロワー。

### v0.4.0 — 全データセット

jobtag 全約 500 職業を取り込み、総務省 統計局のデータで補正。

### v0.5.0 — 仕上げ

パフォーマンスチューニング、アクセシビリティ、共有可能 URL（`?lang=ja&filter=high-risk` 等）、OGP / Twitter Card。

### v1.0.0 — 安定版

公開準備完了。引用、手法解説ページ、データダンプのダウンロード。

詳しくは [CHANGELOG.md](CHANGELOG.md) をご覧ください。

---

## ローカル開発

現在は静的な `index.html` 1 枚なので、任意の静的サーバで動きます：

```bash
git clone https://github.com/jasonhnd/jobs.git
cd jobs
python -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

パイプラインが入ったあとは、追加で以下が必要になります：

```bash
# Python 3.11+ 推奨
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt   # v0.2.0 で追加予定
```

---

## ディレクトリ構成

```text
jobs/
├── index.html           # バイリンガルのフロントエンド
├── data.json            # （v0.2.0+ でパイプラインが生成）
├── scripts/             # （v0.2.0+）スクレイパー・パーサー・スコアラー
├── raw/                 # （gitignore）取得した生 HTML
├── data/                # （v0.2.0+）中間 CSV
├── README.md            # English
├── README.ja.md         # 日本語（このファイル）
├── CHANGELOG.md
├── LICENSE              # MIT
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
