# Japan Jobs × AI Impact

[![Live Site](https://img.shields.io/badge/live-mirai--shigoto.com-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hosting: Vercel](https://img.shields.io/badge/hosting-Vercel%20(hnd1)-000)](https://vercel.com)

![Japan Jobs × AI Impact — 厚労省 jobtag/JILPT IPD に基づく日本の 556 職業の treemap に AIOIS-10 の AI 影響度と仕事が減るリスクを重ねた可視化サイト](https://mirai-shigoto.com/api/og?page=home)

厚生労働省の **職業情報提供サイト（job tag）** / JILPT IPD v7.00 に登録されている **556 の日本の職業** について、年収・学歴・就業者数・将来性などの構造化データに加えて、**Claude Fable 5 が AIOIS-10 で採点した AI 影響度（Transformation）と仕事が減るリスク（Displacement-Risk）**、およびその理由を重ねた可視化サイトです。UI は日本語で、国内の読者を対象としています。

🔗 **公開サイト:** **<https://mirai-shigoto.com/>**

---

## このサイトの位置づけ

ひとつの squarified treemap で、**どの職業の業務が AI によって大きく変わりうるか** と **仕事そのものが減るリスクはどの程度か** を、就業者数の重み付き視点で一目で見られるように設計されています。

データの土台は、公開されている日本政府統計（job tag、労働力調査、経済センサス）です。AIOIS-10 スコアは別途 LLM が生成しており、調査結果ではなく **モデル出力であることを明記** しています。UI は日本語で、国内の読者を対象としています。

本プロジェクトは **厚生労働省、独立行政法人 労働政策研究・研修機構（JILPT）、その他いかなる政府機関とも提携していません**。独立した分析です。

---

## サイトでできること

[mirai-shigoto.com](https://mirai-shigoto.com/) を開くと、以下が見られます：

- **556 職業の treemap**。タイルの **大きさ** は就業者数、**色** は AI 影響度（Transformation、既定）。大きい赤いタイル = 多くの人が従事しており、AI による業務変化も大きい職業。大きい緑のタイル = 多くの人が従事しており、AI による業務変化は小さい職業。
- **6 種類の色レイヤー** をツールバーから切替可能：AI 影響度 / 年収 / 平均年齢 / 労働時間 / 求人倍率 / 学歴。タイルの大きさは変わらず、色の意味だけが変わります。
- **色覚配慮（viridis）** トグル。
- **Direction C ウォームエディトリアル・テーマ** — 暖米色パレット、Noto Serif JP 見出し、テラコッタのアクセント。`prefers-color-scheme` による検出は組み込み済み、手動ライト/ダーク切替トグルは現在非表示。
- **職業名でリアルタイム検索**。
- **タイルにマウスオーバー（PC）またはタップ（スマホ）** で tooltip — AI 影響度、年収、就業者数、LLM の評価理由を表示。
- **556 職業の専用詳細ページ** — `/ja/<id>.html`（JILPT IPD v7.00 の職業を全量反映）、各ページに評価理由のフルテキスト、AIOIS-10 プロファイル、年収 / 平均年齢 / 労働時間 / 求人倍率 / 学歴の内訳、転職パス推薦、検索エンジン向けの構造化データ（Schema.org `Occupation` JSON-LD）を含む。
- **17 のセクターハブページ** — `/ja/sectors/` に 16 業種の一覧インデックスと各業種専用ハブ。各ハブは AI 影響 TOP 5（高/低）、就業者数 TOP 5、全職業ソート一覧を集約。
- **専用ページ** — データについて（`/about`）、コンプライアンス（`/compliance`）、プライバシー（`/privacy`）、カスタム 404。
- **ソーシャル共有ボタン** — X、LINE、Hatena Bookmark、LinkedIn、Copy Link、モバイルでは Web Share API。
- **クッキーレス解析レイヤー** を Google Analytics と並走。クッキーを許可していなくても主要な集計は機能します。

UI は 360 px のスマートフォンと 4K デスクトップの両方で同じコンテンツ密度で読めるよう設計しています。

---

## なぜこのサイトを作ったか

2024 年に Andrej Karpathy 氏が公開した [karpathy/jobs](https://github.com/karpathy/jobs) は、米国労働統計局の Occupational Outlook Handbook（342 職業）を題材に、各職業に対して LLM が AI による仕事への影響を 0〜10 で採点した可視化作品でした。きれいな構造でした — 実在する BLS の職業、実在する BLS の就業者数、その上に LLM が生成したスコアという 1 層だけが合成データ。

中国でフォークされた [madeye/jobs](https://github.com/madeye/jobs) は同じフォーマットを採用したものの、土台を変えてしまいました — 職業リスト自体が AI 生成だったのです。これでは出所をたどる連鎖が切れ、数字が公的データに接地しません。

日本にも BLS OOH に相当する公的データが存在します — **厚生労働省 職業情報提供サイト（job tag）**、約 500 職業、年収・学歴・就業者数・将来性などが構造化された形で提供されています。このデータセットは数年前から存在していたにもかかわらず、Karpathy 流の treatment（政府データに基づき、LLM スコア付き）を施したものは **誰も作っていませんでした**。

本プロジェクトはその欠けていたピースです。Karpathy のアイデアを日本に移植したものです。

---

## AIOIS-10 スコアの算出方法

ここはこの可視化作品で **最も重要かつ、最も議論の余地がある** 部分なので、紙面を割いて説明します。

### 2 つの指標

本サイトは **AIOIS-10 v1.0** に基づき、各職業に 10 次元（D1〜D10）と 2 つの派生指標を付与しています。従来の単一スコアではなく、次の 2 つを分けて読みます。

- **Transformation（AI 影響度）** — D1「認知・生成暴露」と D2「定型反復」の平均。現在の生成 AI が、その職業の日々の仕事をどの程度作り変えるかを示します。サイト上の見出しスコアと treemap の既定色はこの指標です。高い値は「業務変化が大きい」を意味し、失業確率ではありません。
- **Displacement-Risk（仕事が減るリスク）** — Transformation に、人間の強み（D3〜D7）、自動化の費用対効果、制度・需給、日本の労働市場文脈（D8〜D10）を掛け合わせた指標。職そのものが縮小しやすいかを見るための別軸です。

AIOIS-10 の 10 次元は、AI が届く部分（D1〜D2）、人間の強みとして残りやすい部分（D3〜D7）、導入・制度・労働市場の調整要因（D8〜D10）を分けて採点します。各次元は 0.0〜10.0、小数第 1 位までです。

Karpathy の「政府職業データ × LLM スコア」という構造は継承していますが、現行版では AIOIS-10 により、業務が変わる大きさと職が減るリスクを分離しています。

### スコアが生成される流れ

スコアリングは下記のキャリブレーションアンカーに基づき Claude Code セッションで実行します。各職業について：

1. **入力バンドル** — 職業名（日 + 英）、業種、job tag の「仕事内容」記述、構造化フィールド（年収、就業者数、学歴分布、将来性）。
2. **プロンプト** — AIOIS-10 v1.0 の定義 + 入力バンドル + 構造化出力指示（JSON: `ai_risk`, `rationale_ja`, `confidence`, `aiois: { d1...d10, transformation, displacement }`。本サイトは日本語専用）。
3. **モデル** — Claude Fable 5（`claude-fable-5`）。現行の active score run は 2026-06-13 です。AIOIS-10 run では、別モデルへの silent fallback は行いません。
4. **出力** — モデルの AIOIS-10 スコア + 理由文、職業ごとにキャッシュ。再実行時は既出力の職業はスキップ。
5. **集約** — `bun run build:data`（`src/data/build.ts`）が IPD ソースデータ + AI スコア + 統計を結合し、`public/` 下に projection を出力（treemap / top10 / detail / search / labels / sectors / profile5 / transfer_paths / holland / skills など）。ホーム画面は desktop で canvas が近づいた時だけ `/data.treemap.json` を読み込み、mobile の TOP 10 は軽量な `/data.top10.json` を読み込みます。

各理由文は 1〜3 文で、*なぜそのスコアになったか* — 業務のどの部分が現時点の LLM でこなせそうか、どの部分が難しそうか — を簡潔に説明します。

### 限界 — このスコアは何で、何ではないか

これらのスコアは **「現在のフロンティア LLM がこの職業について構造化された意見を述べたもの」** であり、**ground truth ではない** とご理解ください。具体的には：

- **モデル出力であって、調査統計ではありません。** 就業者数や年収中央値は実在の統計値です。AI 影響度と仕事が減るリスクは、軽く構造化された生成テキストです。
- **プロンプトの言い回しに敏感です。** ルーブリックを変える、アンカーを変える、あるいは worked example の言い方を変えるだけで、データセット全体で 1〜2 ポイントずれることがあります。公開しているアンカーとプロンプトは安定したものですが、それは可能なキャリブレーションのひとつであり、唯一解ではありません。
- **「現時点の LLM の見解」を反映しており、その見解は変動します。** 新しいモデルで再採点するとスコアが動きます。古いモデルはクリエイティブ職に対して系統的に悲観的、新しいモデルは事務職に対して悲観的、という傾向もあります。スコアはスナップショットです。
- **理由文は日本語を正としています。** サイトと README は日本語を正本として運用しています。英語 UI は v1.4.0 で廃止済みです。
- **face validity 以上の妥当性は主張しません。** 実務者へのフォローアップ調査も、実際の代替率との比較も、信頼区間もありません。将来の安定版では複数 LLM のクロス整合性チェックを追加する予定ですが、現バージョンには含まれていません。

このダッシュボードは、すでに発表されている学術的演習を日本の読者にとって具体的・クリック可能な形で提示するためのものです。**特定の個人の仕事の将来を予測する目的では作っていません。**

---

## データソース

| 出典 | 用途 | URL |
| --- | --- | --- |
| 厚生労働省 職業情報提供サイト（job tag） | 主要データ：職業名、年収、学歴分布、就業者数、将来性、仕事内容記述 | <https://shigoto.mhlw.go.jp/User/> |
| 総務省 労働力調査 | 就業者数の補正および産業横断検証 | <https://www.stat.go.jp/data/roudou/> |
| 総務省 経済センサス | 事業所単位の産業分布 | <https://www.stat.go.jp/data/e-census/> |

すべて公開されている政府統計です。本サイトはこれらの生データを再公開するものではありません — 職業ごとの構造化フィールドを取り込み、その上に LLM 生成スコアを重ねて提示するだけです。

---

## ビルドパイプライン

TypeScript ETL（`src/data/build.ts`）が MHLW jobtag の政府公開データを取り込み、Claude Fable 5 が AIOIS-10 で生成した AI 影響度 / 仕事が減るリスクと結合し、Zod スキーマ（`src/data/schema/*.ts`）で検証した上で、`public/` 配下に projection を書き出します。続いて Astro が `src/pages/` を静的レンダリングし、結果の `dist-astro/` を Vercel がデプロイします。パイプライン全体は `bun run build` で実行できます。

フォントは Google Fonts から実行時に読み込まず、`assets/fonts-src/` に vendoring した Noto Serif JP / Plus Jakarta Sans の TTF を元にします。`astro build` 後に `scripts/subset-fonts.ts` が `dist-astro/**/*.html` の表示テキストを走査し、必要な glyph だけを content-hashed WOFF2 と `@font-face` CSS として `dist-astro/fonts/` に出力します。見出しは Noto Serif JP を優先し、subset にない文字は Hiragino / Yu Mincho に per-glyph fallback します。

---

## 本番環境スタック

| レイヤー | 内容 |
| --- | --- |
| ランタイム / ビルド | Node 24・Bun・Astro 7（Vite 8 / Rust コンパイラ）・TypeScript・React 19（OG 画像のみ） |
| ホスティング | Vercel（Tokyo edge）— `main` から自動デプロイ |
| ドメイン | `mirai-shigoto.com`（Cloudflare Registrar → Vercel） |
| メール | Resend via Edge Function（`api/subscribe.js`、`api/feedback.js`） |
| アナリティクス | Cloudflare WA、GA4、Vercel WA、Vercel Speed Insights（[仕様](analytics/spec.yaml)） |
| SEO | `robots.txt`、`sitemap.xml`、[`/llms.txt`](https://mirai-shigoto.com/llms.txt)、Schema.org 構造化データ |

キャッシュポリシーは `vercel.json` で管理します。Astro が生成する fingerprint 付き静的アセット（`/_astro/*`）と build-time subset フォント（`/fonts/*`）は `Cache-Control: public, max-age=31536000, immutable`、頻繁に更新される projection JSON / sitemap / robots / llms は短めの `max-age` + CDN `s-maxage` を明示します。

---

## 免責事項

> **本サイトは非公式サイトです / This site is unofficial.**
>
> 独立した分析です。**厚生労働省、独立行政法人 労働政策研究・研修機構（JILPT）、総務省、または job tag そのものとは提携・後援関係はなく、その公式見解を示すものでもありません。**
>
> AI 影響度と仕事が減るリスクは **モデル出力** であり、調査統計ではありません。AIOIS-10 に照らして大規模言語モデルが生成したものであり、特定個人のキャリア予測ではなく、モデルの構造化された意見として読まれるべきものです。詳しい限界は [算出方法](#aiois-10-スコアの算出方法) を参照してください。
>
> 就業者数、年収中央値、年齢分布、学歴分布は公開されている日本政府統計に由来しますが、本サイトはそれらを非権威的な形（一次出版物ではなく可視化）で提示しています。意思決定にあたっては必ず公式情報源をご確認ください。

---

## ディレクトリ構成

```text
jobs/
├── src/
│   ├── pages/              # Astro ルート（index、about、map、ja/[id] など）
│   ├── components/         # 共通 Astro コンポーネント（Footer など）
│   ├── layouts/            # BaseLayout
│   ├── data/               # TypeScript ETL（build.ts + projections + schemas）
│   └── lib/                # サイト全体のユーティリティ（canonical-css など）
├── api/                    # Vercel Edge Function（OG 画像、登録、フィードバック）
├── assets/fonts-src/       # OFL font sources used by build-time WOFF2 subsetting
├── analytics/              # GA4 計測スペック + 同期スクリプト
├── data/                   # ソースデータ（職業別 JSON、スコア、ラベル、セクター）
├── dist/                   # ビルド済み projection + SEO 静的（Astro publicDir）
├── dist-astro/             # Vercel がデプロイする最終ビルド出力（gitignored）
├── astro.config.mjs        # Astro 設定
├── vercel.json             # Vercel デプロイ設定 + キャッシュヘッダ
├── CHANGELOG.md            # リリース履歴
└── README.md（日本語、正本）
```

---

## 引用フォーマット

本サイトを文章で引用される場合は、以下のフォーマットをご利用ください。

### 文中（記事・ブログ・SNS）

> *出典：Japan Jobs × AI Impact（mirai-shigoto.com）— 厚労省 job tag / JILPT IPD v7.00 の 556 職業に、Claude Fable 5 が AIOIS-10 で生成した Transformation（AI 影響度）と Displacement-Risk（仕事が減るリスク）を重ねた独立可視化サイト。就業者数等は厚労省の公開データ、AI スコアはモデル出力であり統計値ではない。*

### APA

> Mirai Shigoto. (2026). *Japan Jobs × AI Impact: An AIOIS-10 visualization of 556 Japanese occupations with Claude Fable 5-scored AI Impact and Displacement-Risk* [Web visualization]. <https://mirai-shigoto.com/>

### BibTeX

```bibtex
@misc{japan_jobs_ai_risk,
  author       = {{Mirai Shigoto}},
  title        = {Japan Jobs × AI Impact: An AIOIS-10 visualization of 556 Japanese occupations with Claude Fable 5-scored AI Impact and Displacement-Risk},
  year         = {2026},
  howpublished = {\url{https://mirai-shigoto.com/}},
  note         = {Workforce data from MHLW jobtag/JILPT IPD v7.00; AIOIS-10 scores use Claude Fable 5 and are LLM-generated, not survey statistics. Source code: \url{https://github.com/jasonhnd/jobs}}
}
```

### Schema.org Dataset（機械可読）

ホームの `<head>` 内に `Dataset` 型の JSON-LD を埋め込み、`variableMeasured` / `creator` / `license` / `isBasedOn`（厚労省の一次データへの参照）を記述しています。検索エンジンや LLM は自動で拾ってくれるので、利用者側で別途書き起こす必要はありません。

**データセットを引用する** 場合は、就業者数 / 年収 / 学歴などの数値については 厚生労働省（job tag）を、AI 影響度 / 仕事が減るリスク + 提示レイヤーについて本プロジェクトをクレジットしていただければと思います。

---

## コントリビュート

GitHub Issues と Pull Request を歓迎します：

- **Issues** — 手法に関する質問、データソースの提案、キャリブレーションへのフィードバック（「職業 X のスコアはおかしい — その理由は…」）。
- **PR** — バグ修正、新しい色レイヤー、アクセシビリティ改善。
- **スコアへの異議** — 特定職業のスコアが大きく間違っていると感じた場合は、Issue で：職業名、現在のスコア、提案するスコア、*理由*（モデルが過大 or 過小評価していると思う業務内容）を添えてください。バッチでレビューします。

---

## ライセンス

[MIT](LICENSE) © 2026 mirai-shigoto.com

MIT ライセンスは本リポジトリ内のソースコードに適用されます。土台となる厚労省 job tag のデータは厚生労働省が独自の利用条件で公開しています — 一次データの利用条件は <https://shigoto.mhlw.go.jp/User/> をご確認ください。

`assets/fonts-src/` に vendoring している Noto Serif JP と Plus Jakarta Sans、および build 時に生成される WOFF2 subset は SIL Open Font License 1.1 で配布されます。各 family の `OFL.txt` を source TTF と一緒に保持してください。

---

## 謝辞

- **[karpathy/jobs](https://github.com/karpathy/jobs)** — 本プロジェクトが日本向けに移植している、BLS OOH × LLM スコアリングのオリジナルテンプレート。
- **厚生労働省 職業情報提供サイト（job tag）** および **総務省 統計局** — 構造化された職業データ・労働力データを公開し、第三者がその上に積み上げられる形にしてくださっていること。
- **独立行政法人 労働政策研究・研修機構（JILPT）** — job tag が参照している土台の「職業情報データベース」を整備していること。
- **Claude Fable 5** — AIOIS-10 v1.0 に基づく現行スコアリングに使用している LLM。
- **Vercel、Cloudflare、Resend** — 一人開発のサイドプロジェクトでも国内訪問者に 50 ms 以下のレイテンシを提供できるインフラ。

---

## 関連ドキュメント

README は *このサイトが何であるか* を説明します。以下のファイルは *どう動いているかの詳細* を扱い、プロジェクト進化に合わせて随時更新されます：

- **[CHANGELOG.md](CHANGELOG.md)** — リリース履歴。リリースごとに更新される唯一のドキュメント。
- **[`analytics/spec.yaml`](analytics/spec.yaml)** — GA4 計測仕様：すべてのイベント、パラメータ、ディメンション、キーイベント。
- **[`/privacy`](https://mirai-shigoto.com/privacy)** — プライバシーポリシー（APPI + GDPR 対応）。
- **[`/llms.txt`](https://mirai-shigoto.com/llms.txt)** — AI 検索エンジンが本サイトを索引付けする際に見るドキュメント。
- **[`astro.config.mjs`](astro.config.mjs)** + **[`vercel.json`](vercel.json)** — ビルド出力ディレクトリ + Vercel デプロイ設定 + キャッシュヘッダ設定。
