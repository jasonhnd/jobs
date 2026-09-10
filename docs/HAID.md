# HAID — Human–AI Distance（人類と AI の距離 10 段階）

サイト上の公開正典は `/haid`、その実装ソースは [`src/pages/haid.astro`](../src/pages/haid.astro)、定義の単一ソースは [`src/site/haid-spec.ts`](../src/site/haid-spec.ts) である。このファイルは、公開標準と四半期リリース、projection、開発手順をつなぐ開発者向け入口として維持する。

## 現行契約

- 標準: HAID v1.0（制定 2026-09-11、CC BY 4.0）
- 対象: 人（世界人口）。端末・契約・アカウントは分母にしない
- 定義の正典: [`src/site/haid-spec.ts`](../src/site/haid-spec.ts)（10 段階、4 関係、3 境目、用語、確度ラベル、境界事例）
- 機械可読: `public/data.haid-spec.json`（[`src/data/projections/haid-spec.ts`](../src/data/projections/haid-spec.ts) が生成。数字は含まない）
- 不変条件: [`src/site/haid-spec.test.ts`](../src/site/haid-spec.test.ts)

## 構造

- 段階は 1〜10。番号は永久に固定し、付け直し・再利用をしない。
- 4 つの関係: 無縁（1–2）／道具（3–6）／同席（7–8）／一体（9–10）。関係の境目は種類の差、関係の中は入れ子。
- 頻度は「道具」の中だけ（第 4 段階＝過去 30 日、第 5 段階＝過去 7 日）。「毎日」段階は置かない。
- 頂点（第 10 段階）は「分けられない」。第 9・10 段階は持続（記憶・嗜好・関係の置き場）と反事実で判定する。
- 対価は段階ではなく属性。仕事での利用は段階に入れない。
- 3 本の境目は図で太く描く: 2→3「AI が届いた」、6→7「呼ぶ側から、呼ばれる側へ」、8→9「道具から、自分の一部へ」。

## 改定ルール

- 境界事例の追加 = 小版（v1.1）。段階の意味の変更 = 大版（v2.0）。旧版は残す。
- 将来の細分化は内側へ枝分かれ（例: 8.1）。第 11 段階は作らない。
- `HAID_SPEC_DATE` は定義が変わったときだけ動かす。build clock を使わない（SEO baseline の drift 防止）。

## 現状ページ（四半期リリース）

- 現状は `/aiadoption`（最新回への固定 URL）と `/aiadoption/{YYYY}-q{N}`（回ごとの固定 URL、追記のみ）に公開する。
- 初回は 2026-Q3、2026 年 10 月下旬に公開する。暫定版は出さない。
- 各回は各段階の N(≥k) / n(k) を低・中・高と確度つきで出す。錨点データは `data/haid/releases/{quarter}/` に置く（このディレクトリと release projection は次の PR）。
- 図示規則: 「下限のみ」の段階は境目を実線で描かない。極端に少ない段階は最小サイズで描き、拡大していることを明記する。

## 関連

- 職業側の基準: [`AIOIS-10.md`](AIOIS-10.md) / `/standard`
- データ契約: [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md)
- SEO/OG baseline: [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md)
