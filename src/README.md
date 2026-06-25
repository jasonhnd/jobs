# src/

TypeScript + Astro のソースルート。

## 構成

```
src/
├── data/
│   ├── schema/              # Zod スキーマ — データ形状の正典
│   ├── lib/                 # bands / score-strategy / sector-resolver / indexes / now / fsum / banker-round / rankings
│   ├── projections/         # build.ts が public/data.* に書き出す projection
│   ├── build.ts             # TS-ETL オーケストレータ (`npm run build:data`)
│   ├── import-ipd.ts        # IPD xlsx → data/occupations/*.json
│   └── test-consistency.ts  # L3 projection の sanity check (`npm run test:consistency`)
├── pages/                   # Astro ルート
│   ├── index.astro          # /  (src/index-source.html を Fragment 注入で使用)
│   ├── about.astro / compliance.astro / privacy.astro / 404.astro
│   ├── map.astro            # /map
│   ├── sitemap.xml.ts       # /sitemap.xml (動的)
│   ├── image-sitemap.xml.ts # /image-sitemap.xml (動的)
│   └── ja/
│       ├── [id].astro       # /ja/{id}
│       ├── sectors/index.astro + [sector].astro
│       └── rankings/index.astro + [type].astro
├── components/              # Footer.astro 等
├── layouts/                 # BaseLayout.astro
├── lib/                     # canonical-css.ts (サイト全体のタイポグラフィ正典)
└── index-source.html        # / のレガシー生 HTML、index.astro が埋め込む
```
