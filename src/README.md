# src/

TypeScript + Astro のソースルート。

## 構成

projection の本数やページ数は契約にしない。追加・削除は各ディレクトリのファイルを見る。

```
src/
├── components/              # Footer、ナビなど共通 Astro コンポーネント
├── content/
├── data/
│   ├── schema/              # Zod スキーマ — データ形状の正典
│   ├── lib/                 # bands / indexes / fsum / banker-round / rewrite-generated-module
│   ├── domain/
│   ├── loaders.ts
│   ├── projections/         # build.ts が public/ に書き出す projection モジュール
│   ├── build.ts             # TS-ETL オーケストレータ (`bun run build:data`)
│   ├── promote.ts           # staging の entry 単位の atomic rename / 失敗時 rollback
│   ├── consistency/         # files / models / shared / treemap — L3 sanity check
│   ├── import-ipd.ts        # IPD xlsx → data/occupations/*.json
│   └── test-consistency.ts  # consistency/ の薄い入口 (`bun run test:consistency`)
├── graph/                   # score-strategy / sector-resolver / 知識グラフ
├── layouts/                 # BaseLayout.astro
├── lib/                     # urls.ts（/{id}。ID 404 は /occupations/404）、canonical-css.ts、now.ts
├── page-data/
├── pages/                   # Astro ルート。ja/ サブツリーは無い（2026-06-02 に撤去）
│   ├── index.astro          # /
│   ├── [...id].astro        # /{id}。ID 404 だけ /occupations/404
│   ├── 404.astro            # /404（カスタム not-found）
│   ├── about.astro / compliance.astro / privacy.astro
│   ├── map.astro / me.astro / methodology.astro / data.astro / standard.astro
│   ├── models.astro / haid.astro / aiadoption.astro / shindan.astro / gyakuten.astro
│   ├── sitemap.xml.ts / image-sitemap.xml.ts
│   ├── sectors/             # /sectors と /sectors/[sector]
│   ├── rankings/            # /rankings と /rankings/[type]
│   ├── models/              # /models/[model]
│   ├── abilities/ answers/ careers/ compare/ education/
│   ├── employment-types/ entry-paths/ explore/ interests/ knowledge/
│   ├── licenses/ life-balance/ q/ skills/ training/ values/
│   ├── work-styles/ yearly/ aiadoption/
│   └── index-source は pages ではなく src/index-source.html（index.astro が埋め込む）
├── site/
├── templates/
├── views/
└── index-source.html        # / のレガシー生 HTML
```
