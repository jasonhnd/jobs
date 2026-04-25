# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-jasonhnd.github.io%2Fjobs-ffb84d)](https://jasonhnd.github.io/jobs/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![Pages](https://img.shields.io/github/deployments/jasonhnd/jobs/github-pages?label=pages)](https://github.com/jasonhnd/jobs/deployments)

> **🌏 [English README is here](README.md)**

厚生労働省の **職業情報提供サイト（job tag）** に登録されている約 **500 の日本の職業** を対象に、年収・学歴・就業者数・将来性に加えて **LLM による AI 代替リスクスコア** を重ねた、バイリンガル可視化サイトです。

データは 1 つ、UI は 2 つ。日本語は国内向け、English は海外向け。右上のトグルで切り替えられます。

🔗 **公開サイト:** https://jasonhnd.github.io/jobs/

---

## ステータス

`v0.1.0` — **可視化リリース第一弾**。MHLW jobtag からスクレイピングした **552 の日本の職業** を squarified treemap で可視化しました。色レイヤーは 5 種類（年収 / 平均年齢 / 労働時間 / 求人倍率 / 学歴）。バイリンガル UI（日本語/英語、ブラウザロケール自動判定）、ツールチップ、jobtag 詳細ページへのクリックスルーを実装。AI 代替リスクと英訳は `null` プレースホルダーのまま、`v0.0.4` で実装予定。

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

### v0.0.1 — スキャフォールディング ✅（現行）

バイリンガルのプレースホルダー、GitHub Pages デプロイ、MIT ライセンス、README、CHANGELOG。

### v0.0.2 — スクレイパー PoC

`scripts/list_occupations.py`（jobtag A〜Z 抽出）と `scripts/scrape_jobtag.py`（1 職業 end-to-end の動作確認）。

### v0.0.3 — フル取り込み

jobtag 約 500 ページをローカルにキャッシュ + `scripts/parse.py` と `scripts/extract_fields.py` でクリーンな CSV を出力。

### v0.0.4 — 翻訳 + スコアリング

`scripts/translate.py`（LLM による日→英バッチ翻訳）と `scripts/score_ai_risk.py`（0〜10 の AI 代替スコア）。アンカーとルーブリックは [karpathy/jobs](https://github.com/karpathy/jobs/blob/main/score.py) から日本の職業例に置き換えて移植。

### v0.0.5 — 最初の `data.json`

`scripts/build_data.py` が CSV とスコアをマージしてバイリンガルの `data.json` を生成。可視化はまだプレースホルダーのまま。

### v0.1.0 — 可視化

業種 × AI 代替リスク × 年収軸の squarified treemap、フィルタ UI、検索、職業詳細ツールチップ。`?lang=ja` / `?lang=en` の URL 切り替え。

### v0.2.0 — 仕上げ

総務省 統計局による就業者数の補正、パフォーマンスチューニング、アクセシビリティ、共有可能 URL、OGP / Twitter Card。バイリンガル `prompt.md` の生成（karpathy の `make_prompt.py` 相当）。

### v1.0.0 — 安定版

公開準備完了。手法解説ページ、引用、データダンプのダウンロード。

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
├── index.html             # バイリンガルのフロントエンド（GitHub Pages がルートから配信）
├── data.json              # （v0.0.5+）index.html が読み込むコンパクトなバイリンガルデータ
├── occupations.json       # （v0.0.2+）jobtag A〜Z から生成したマスター職業リスト
├── occupations.csv        # （v0.0.3+）構造化フィールドのテーブル
├── scores.json            # （v0.0.4+）AI 代替スコアと理由
├── prompt.md              # （v0.2.0+）LLM に貼り付けやすい単一ファイル形式のデータダンプ
├── scripts/               # （v0.0.2+）パイプラインスクリプト群
├── html/                  # （gitignore）取得した jobtag の生 HTML
├── pages/                 # （gitignore）職業ごとのクリーン Markdown
├── README.md              # English
├── README.ja.md           # 日本語（このファイル）
├── CHANGELOG.md
├── LICENSE                # MIT
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
